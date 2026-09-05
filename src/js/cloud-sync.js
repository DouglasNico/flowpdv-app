/**
 * cloud-sync.js - Sincronização Automática em Tempo Real (Cloud Sync)
 * Mantém Operadores, Estoque, Produtos, Categorias e Clientes sincronizados entre todos os terminais da loja.
 */

import { StorageService } from './storage.js';
import { db, doc, getDoc, setDoc, onSnapshot } from './firebase-config.js';

const COLECAO_BACKUPS = "backups_lojas";
const COLECAO_LEGADA = "backups_adegas";

export const CloudSyncModule = {
  debounceTimer: null,
  ouvinteAtivo: false,
  isProcessandoRecebimento: false,

  init() {
    this.sincronizacaoInicialAuto();
    this.iniciarOuvinteTempoReal();
    this.configurarMonitorConexao();

    // Se o terminal estiver com caixa aberto, envia imediatamente o turno atual para a nuvem
    const turnoAtual = StorageService.getTurnoAtual();
    if (turnoAtual && (turnoAtual.status === 'aberto' || turnoAtual.dataAbertura)) {
      setTimeout(() => {
        this.enviarAlteracaoNuvem('turno_ativo_startup');
      }, 500);
    }
  },

  
  configurarMonitorConexao() {
    this.atualizarStatusConexaoUI(navigator.onLine);

    window.addEventListener('online', () => {
      console.log('[CloudSync] Conexão com a internet restabelecida!');
      this.atualizarStatusConexaoUI('sincronizando');
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🌐 Conexão restabelecida! Sincronizando dados com a nuvem...', 'info');
      }
      setTimeout(() => {
        this.sincronizacaoInicialAuto();
        this.enviarAlteracaoNuvem('retorno_conexao');
        setTimeout(() => this.atualizarStatusConexaoUI(true), 1500);
      }, 800);
    });

    window.addEventListener('offline', () => {
      console.warn('[CloudSync] Terminal desconectado da internet. Operando em modo offline.');
      this.atualizarStatusConexaoUI(false);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚠️ Modo Offline: Sem conexão com a internet. Suas operações serão salvas e sincronizadas automaticamente ao voltar a rede.', 'warning', 8000);
      }
    });
  },

  atualizarStatusConexaoUI(status) {
    const el = document.getElementById('header-status-conexao');
    if (!el) return;

    if (status === 'sincronizando') {
      el.innerHTML = '🟡 Sincronizando...';
      el.style.background = '#fef3c7';
      el.style.color = '#b45309';
      el.style.borderColor = '#fde68a';
      el.title = 'Enviando e recebendo dados da nuvem';
    } else if (status === true || status === 'online') {
      el.innerHTML = '🟢 Online';
      el.style.background = '#dcfce7';
      el.style.color = '#15803d';
      el.style.borderColor = '#bbf7d0';
      el.title = 'Conectado à nuvem e sincronizado em tempo real';
    } else {
      el.innerHTML = '🔴 Offline';
      el.style.background = '#fee2e2';
      el.style.color = '#dc2626';
      el.style.borderColor = '#fca5a5';
      el.title = 'Operando localmente. Conexão com a nuvem indisponível';
    }
  },

  getChaveLicenca() {
    const lic = StorageService.getLicenca() || {};
    return (lic.chaveLicenca || lic.clienteId || '').trim().toUpperCase();
  },

  pacotePertenceALicenca(cloudData) {
    const chaveAtual = this.getChaveLicenca();
    const chavePacote = String(cloudData?.chaveLicenca || '').trim().toUpperCase();
    return Boolean(chaveAtual && chavePacote && chaveAtual === chavePacote);
  },

  mesclarItensPorId(baseA = [], baseB = []) {
    const mapa = new Map();
    (baseA || []).forEach(item => {
      if (item && (item.id || item.codigoBarras)) {
        const key = String(item.id || item.codigoBarras);
        mapa.set(key, item);
      }
    });
    (baseB || []).forEach(item => {
      if (item && (item.id || item.codigoBarras)) {
        const key = String(item.id || item.codigoBarras);
        if (!mapa.has(key)) {
          mapa.set(key, item);
        } else {
          const existente = mapa.get(key);
          const timeExistente = existente.atualizadoEm ? new Date(existente.atualizadoEm).getTime() : 0;
          const timeNovo = item.atualizadoEm ? new Date(item.atualizadoEm).getTime() : 0;

          if (timeNovo && timeExistente) {
            if (timeNovo >= timeExistente) {
              mapa.set(key, { ...existente, ...item });
            } else {
              mapa.set(key, { ...item, ...existente });
            }
          } else if (timeNovo && !timeExistente) {
            mapa.set(key, { ...existente, ...item });
          } else if (!timeNovo && timeExistente) {
            mapa.set(key, { ...item, ...existente });
          } else {
            mapa.set(key, { ...existente, ...item });
          }
        }
      }
    });
    return Array.from(mapa.values());
  },

  mesclarCategorias(baseA = [], baseB = []) {
    const excluidas = (StorageService.getCategoriasExcluidas ? StorageService.getCategoriasExcluidas() : []).map(c => String(c).toLowerCase().trim());
    const categorias = [];
    [...(baseA || []), ...(baseB || [])].forEach(categoria => {
      const nome = String(categoria || '').trim();
      if (nome && !excluidas.includes(nome.toLowerCase()) && !categorias.some(item => item.toLowerCase() === nome.toLowerCase())) {
        categorias.push(nome);
      }
    });
    return categorias;
  },

  async sincronizacaoInicialAuto() {
    try {
      const chave = this.getChaveLicenca();
      if (!chave) return;

      let docSnap = await getDoc(doc(db, COLECAO_BACKUPS, chave));
      if (!docSnap.exists()) {
        const snapLegado = await getDoc(doc(db, COLECAO_LEGADA, chave));
        if (snapLegado.exists()) docSnap = snapLegado;
      }
      const produtosLocais = StorageService.getProdutos() || [];
      const contasLocais = StorageService.getContasPagar() || [];
      const clientesLocais = StorageService.getClientes() || [];
      const vendasLocais = StorageService.getVendas() || [];

      if (docSnap && docSnap.exists()) {
        const cloudData = docSnap.data() || {};
        if (!this.pacotePertenceALicenca(cloudData)) {
          console.warn('[CloudSync] Backup inicial ignorado: licença incompatível.');
          return;
        }
        const cloudProds = Array.isArray(cloudData.produtos) ? cloudData.produtos : [];
        const cloudContas = Array.isArray(cloudData.contasPagar) ? cloudData.contasPagar : [];
        const cloudClientes = Array.isArray(cloudData.clientes) ? cloudData.clientes : [];
        const cloudVendas = Array.isArray(cloudData.vendas) ? cloudData.vendas : [];

        if (Array.isArray(cloudData.produtosExcluidos)) {
          const excluidos = new Set(StorageService.getProdutosExcluidosIds());
          cloudData.produtosExcluidos.forEach(id => excluidos.add(String(id)));
          localStorage.setItem('adega_produtos_excluidos_ids', JSON.stringify(Array.from(excluidos)));
        }

        if (Array.isArray(cloudData.categoriasExcluidas) && StorageService.adicionarCategoriaExcluida) {
          cloudData.categoriasExcluidas.forEach(c => StorageService.adicionarCategoriaExcluida(c));
        }

        // 🛡️ MESCLAGEM INTELIGENTE (Smart Merge Anti-Perda Multi-Terminal)
        // Combina o que está na nuvem com o que foi feito localmente (ex: XML, cadastros novos)
        const produtosConsolidados = this.mesclarItensPorId(cloudProds, produtosLocais);
        const contasConsolidadas = this.mesclarItensPorId(cloudContas, contasLocais);
        const clientesConsolidados = this.mesclarItensPorId(cloudClientes, clientesLocais);
        const vendasConsolidadas = this.mesclarItensPorId(cloudVendas, vendasLocais);

        StorageService.saveProdutos(produtosConsolidados);
        StorageService.saveContasPagar(contasConsolidadas);
        StorageService.saveClientes(clientesConsolidados);
        localStorage.setItem('adega_vendas', JSON.stringify(vendasConsolidadas));

        const categoriasLocais = StorageService.getCategorias() || [];
        const categoriasConsolidadas = this.mesclarCategorias(cloudData.categorias, categoriasLocais);
        if (categoriasConsolidadas.length > 0) {
          StorageService.salvarCategorias(categoriasConsolidadas);
        }
        if (Array.isArray(cloudData.usuarios) && cloudData.usuarios.length > 0) {
          StorageService.saveUsuarios(cloudData.usuarios);
        }
        if (Array.isArray(cloudData.turnosHistorico) && cloudData.turnosHistorico.length > 0) {
          StorageService.salvarHistoricoTurnos(cloudData.turnosHistorico);
        }

        // Se tínhamos itens locais novos (como notas XML ou produtos recém-criados), enviamos a base unificada de volta para a nuvem
        if (produtosConsolidados.length > cloudProds.length || contasConsolidadas.length > cloudContas.length || clientesConsolidados.length > cloudClientes.length || vendasConsolidadas.length > cloudVendas.length || categoriasConsolidadas.length > (cloudData.categorias || []).length) {
          console.log('[CloudSync] Consolidando novos itens locais para a nuvem...');
          this.enviarAlteracaoNuvem('consolidacao_unificada');
        }

        // Atualiza as telas do sistema
        if (window.EstoqueModule && typeof window.EstoqueModule.renderTabelaProdutos === 'function') {
          window.EstoqueModule.renderTabelaProdutos();
        }
        if (window.GerenciaModule && typeof window.GerenciaModule.renderContasPagar === 'function') {
          window.GerenciaModule.renderContasPagar();
        }
        if (window.ClientesModule && typeof window.ClientesModule.renderTabela === 'function') {
          window.ClientesModule.renderTabela();
        }
      } else {
        // Se a nuvem ainda não tem backup dessa chave
        if (produtosLocais.length > 0 || contasLocais.length > 0) {
          console.log('[CloudSync] Primeira inicialização: enviando base local para a nuvem...');
          this.enviarAlteracaoNuvem('inicializacao');
        }
      }
    } catch (e) {
      console.warn('[CloudSync] Erro na sincronização inicial:', e);
    }
  },

  unsubOuvinte: null,

  iniciarOuvinteTempoReal() {
    if (this.ouvinteAtivo) return;

    try {
      const chave = this.getChaveLicenca();
      if (!chave) return;

      this.ouvinteAtivo = true;

      this.unsubOuvinte = onSnapshot(doc(db, COLECAO_BACKUPS, chave), (snap) => {
        if (!snap || !snap.exists()) return;
        const cloudData = snap.data();
        if (!cloudData) return;

        if (!this.pacotePertenceALicenca(cloudData)) {
          console.warn('[CloudSync] Pacote ignorado: licença incompatível.');
          return;
        }

        // Se a alteração partiu deste mesmo terminal, ignora
        const myDevId = StorageService.getDeviceId();
        if (cloudData.origemTerminal === myDevId) {
          return;
        }

        if (Array.isArray(cloudData.produtosExcluidos)) {
          const excluidos = new Set(StorageService.getProdutosExcluidosIds());
          cloudData.produtosExcluidos.forEach(id => excluidos.add(String(id)));
          localStorage.setItem('adega_produtos_excluidos_ids', JSON.stringify(Array.from(excluidos)));
        }

        console.log('[CloudSync] Alteração recebida de outro terminal:', cloudData.motivo || 'nuvem');
        this.aplicarDadosRecebidos(cloudData, { silencioso: false });
      }, (err) => {
        console.warn('[CloudSync] Erro no ouvinte em tempo real:', err);
      });
    } catch (e) {
      console.warn('[CloudSync] Erro ao iniciar ouvinte:', e);
    }
  },

  async trocarEmpresaSincronizacao(novaChave) {
    try {
      // 1. Cancelar o listener em tempo real da empresa anterior
      if (this.unsubOuvinte && typeof this.unsubOuvinte === 'function') {
        this.unsubOuvinte();
        this.unsubOuvinte = null;
      }
      this.ouvinteAtivo = false;

      if (!novaChave) return;

      console.log('[CloudSync] Trocando sincronização para nova empresa:', novaChave);

      // 2. Buscar o backup da nova empresa na nuvem
      let docSnap = await getDoc(doc(db, COLECAO_BACKUPS, novaChave));
      if (!docSnap.exists()) {
        const snapLegado = await getDoc(doc(db, COLECAO_LEGADA, novaChave));
        if (snapLegado.exists()) docSnap = snapLegado;
      }
      if (docSnap && docSnap.exists()) {
        const cloudData = docSnap.data() || {};
        if (cloudData.chaveLicenca && String(cloudData.chaveLicenca).trim().toUpperCase() !== String(novaChave).trim().toUpperCase()) {
          console.warn('[CloudSync] Base de empresa rejeitada: licença incompatível.');
          return;
        }
        console.log('[CloudSync] Dados da nova empresa encontrados na nuvem. Aplicando...');
        this.carregarBaseCompletaNovaEmpresa(cloudData);

        if (cloudData.dataBackupFormatada || cloudData.dataBackup) {
          const dataFmt = cloudData.dataBackupFormatada || cloudData.dataBackup;
          localStorage.setItem('flowpdv_ultimo_backup_timestamp', dataFmt);
          localStorage.setItem('flowpdv_ultimo_backup_info', JSON.stringify({
            data: dataFmt,
            totalProdutos: (cloudData.produtos || []).length,
            totalClientes: (cloudData.clientes || []).length
          }));
        } else {
          localStorage.removeItem('flowpdv_ultimo_backup_timestamp');
          localStorage.removeItem('flowpdv_ultimo_backup_info');
        }
      } else {
        console.log('[CloudSync] Nova empresa sem dados prévios na nuvem. Base limpa iniciada.');
        StorageService.saveProdutos([]);
        StorageService.saveClientes([]);
        StorageService.salvarHistoricoTurnos([]);
        localStorage.setItem('adega_vendas', JSON.stringify([]));
        localStorage.removeItem('flowpdv_ultimo_backup_timestamp');
        localStorage.removeItem('flowpdv_ultimo_backup_info');
        localStorage.removeItem('flowpdv_ultimo_backup_data');
      }

      // 3. Reativar o listener para a nova chave
      this.iniciarOuvinteTempoReal();

      // 4. Forçar renderização de todas as telas e tela de login da nova empresa
      if (window.BackupModule && typeof window.BackupModule.atualizarStatusBackupUI === 'function') {
        window.BackupModule.atualizarStatusBackupUI();
      }
      if (window.AuthModule && typeof window.AuthModule.init === 'function') {
        window.AuthModule.init();
      }
      if (window.AuditModule && typeof window.AuditModule.limparCacheLogsLicenca === 'function') {
        window.AuditModule.limparCacheLogsLicenca();
      }
      if (window.EstoqueModule) {
        if (typeof window.EstoqueModule.verificarAlertasValidade === 'function') window.EstoqueModule.verificarAlertasValidade();
        if (typeof window.EstoqueModule.renderBarraCategorias === 'function') window.EstoqueModule.renderBarraCategorias();
        if (typeof window.EstoqueModule.renderTabelaProdutos === 'function') window.EstoqueModule.renderTabelaProdutos();
      }
      if (window.PdvModule) {
        if (typeof window.PdvModule.renderCarrinho === 'function') window.PdvModule.renderCarrinho();
        if (typeof window.PdvModule.renderBotoesCategorias === 'function') window.PdvModule.renderBotoesCategorias();
      }
      if (window.ClientesModule && typeof window.ClientesModule.renderTabela === 'function') {
        window.ClientesModule.renderTabela();
      }
      if (window.CaixaModule && typeof window.CaixaModule.renderHistoricoTurnosFechados === 'function') {
        window.CaixaModule.renderHistoricoTurnosFechados();
      }
    } catch(err) {
      console.error('[CloudSync] Erro na troca de sincronização da empresa:', err);
    }
  },

  carregarBaseCompletaNovaEmpresa(cloudData) {
    if (!cloudData) return;

    // Produtos & Estoque
    if (Array.isArray(cloudData.produtos) && cloudData.produtos.length > 0) {
      StorageService.saveProdutos(cloudData.produtos);
    } else {
      StorageService.saveProdutos([]);
    }

    // Excluídos / Tombstones
    if (Array.isArray(cloudData.produtosExcluidos)) {
      localStorage.setItem('adega_produtos_excluidos_ids', JSON.stringify(cloudData.produtosExcluidos));
    } else {
      localStorage.removeItem('adega_produtos_excluidos_ids');
    }

    // Clientes & Fiados
    if (Array.isArray(cloudData.clientes)) {
      StorageService.saveClientes(cloudData.clientes);
    } else {
      StorageService.saveClientes([]);
    }

    // Histórico de Turnos
    if (Array.isArray(cloudData.turnosHistorico)) {
      StorageService.salvarHistoricoTurnos(cloudData.turnosHistorico);
    } else {
      StorageService.salvarHistoricoTurnos([]);
    }

    // Vendas
    if (Array.isArray(cloudData.vendas)) {
      localStorage.setItem('adega_vendas', JSON.stringify(cloudData.vendas));
    } else {
      localStorage.setItem('adega_vendas', JSON.stringify([]));
    }

    // Usuários / Operadores
    if (Array.isArray(cloudData.usuarios) && cloudData.usuarios.length > 0) {
      StorageService.saveUsuarios(cloudData.usuarios);
    }

    // Categorias
    if (Array.isArray(cloudData.categorias) && cloudData.categorias.length > 0) {
      StorageService.salvarCategorias(cloudData.categorias);
    }

    // Contas a Pagar (Financeiro)
    if (Array.isArray(cloudData.contasPagar)) {
      StorageService.saveContasPagar(cloudData.contasPagar);
    } else {
      StorageService.saveContasPagar([]);
    }
  },

  isUsuarioEditando() {
    // 1. Verificar se algum modal de edição/cadastro está aberto
    const modalEditarConfig = document.getElementById('modal-editar-config-loja');
    if (modalEditarConfig && modalEditarConfig.style.display !== 'none') return true;

    const modalProd = document.getElementById('modal-produto');
    if (modalProd && modalProd.style.display !== 'none') return true;

    const modalOp = document.getElementById('modal-operador');
    if (modalOp && modalOp.style.display !== 'none') return true;

    const modalCli = document.getElementById('modal-cliente');
    if (modalCli && modalCli.style.display !== 'none') return true;

    // 2. Verificar se o usuário está com foco em algum campo de digitação
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return true;
    }

    return false;
  },

  aplicarDadosRecebidos(cloudData, opts = {}) {
    if (this.isProcessandoRecebimento) return;
    if (!this.pacotePertenceALicenca(cloudData)) return;
    this.isProcessandoRecebimento = true;
    let precisaReenviarBaseConsolidada = false;

    try {
      let houveAlteracao = false;

      // 1. Sincronizar Operadores
      if (Array.isArray(cloudData.usuarios) && cloudData.usuarios.length > 0) {
        StorageService.saveUsuarios(cloudData.usuarios);
        houveAlteracao = true;
        if (window.AuthModule) {
          if (typeof window.AuthModule.renderCardsLogin === 'function') window.AuthModule.renderCardsLogin();
          if (typeof window.AuthModule.renderTabelaOperadoresConfig === 'function') window.AuthModule.renderTabelaOperadoresConfig();
        }
      }

      // 2. Sincronizar Produtos e Estoque
      if (Array.isArray(cloudData.produtos)) {
        const excluidos = new Set(StorageService.getProdutosExcluidosIds());
        const produtosNuvemAtivos = cloudData.produtos.filter(item => item && !excluidos.has(String(item.id)));
        const produtosLocaisAtivos = StorageService.getProdutos().filter(item => item && !excluidos.has(String(item.id)));
        const produtosConsolidados = this.mesclarItensPorId(produtosNuvemAtivos, produtosLocaisAtivos);
        StorageService.saveProdutos(produtosConsolidados);
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || produtosConsolidados.length > cloudData.produtos.length;
        houveAlteracao = true;
        if (window.EstoqueModule && typeof window.EstoqueModule.renderTabelaProdutos === 'function') {
          window.EstoqueModule.renderTabelaProdutos();
        }
        if (window.PdvModule && typeof window.PdvModule.renderBotoesCategorias === 'function') {
          window.PdvModule.renderBotoesCategorias();
        }
      }

      // 3. Sincronizar Categorias
      if (Array.isArray(cloudData.categoriasExcluidas) && StorageService.adicionarCategoriaExcluida) {
        cloudData.categoriasExcluidas.forEach(c => StorageService.adicionarCategoriaExcluida(c));
      }
      if (Array.isArray(cloudData.categorias)) {
        const categoriasConsolidadas = this.mesclarCategorias(cloudData.categorias, StorageService.getCategorias());
        if (categoriasConsolidadas.length > 0) StorageService.salvarCategorias(categoriasConsolidadas);
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || categoriasConsolidadas.length > cloudData.categorias.length;
        houveAlteracao = true;
        if (window.PdvModule && typeof window.PdvModule.renderBotoesCategorias === 'function') {
          window.PdvModule.renderBotoesCategorias();
        }
        if (window.EstoqueModule && typeof window.EstoqueModule.renderBarraCategorias === 'function') {
          window.EstoqueModule.renderBarraCategorias();
        }
        if (window.GerenciaModule && typeof window.GerenciaModule.renderGestaoCategorias === 'function') {
          window.GerenciaModule.renderGestaoCategorias();
        }
        if (window.EstoqueModule && typeof window.EstoqueModule.preencherSelectCategorias === 'function') {
          window.EstoqueModule.preencherSelectCategorias();
        }
      }

      // 4. Sincronizar Clientes / Fiado
      if (Array.isArray(cloudData.clientes)) {
        const clientesConsolidados = this.mesclarItensPorId(cloudData.clientes, StorageService.getClientes());
        StorageService.saveClientes(clientesConsolidados);
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || clientesConsolidados.length > cloudData.clientes.length;
        houveAlteracao = true;
        if (window.ClientesModule && typeof window.ClientesModule.renderTabela === 'function') {
          window.ClientesModule.renderTabela();
        }
      }

      // 5. Sincronizar Histórico de Turnos do Caixa (Multi-Terminal)
      if (Array.isArray(cloudData.turnosHistorico)) {
        const turnosConsolidados = this.mesclarItensPorId(cloudData.turnosHistorico, StorageService.getHistoricoTurnos());
        StorageService.salvarHistoricoTurnos(turnosConsolidados);
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || turnosConsolidados.length > cloudData.turnosHistorico.length;
        houveAlteracao = true;
        if (window.CaixaModule && typeof window.CaixaModule.renderHistoricoTurnosFechados === 'function') {
          window.CaixaModule.renderHistoricoTurnosFechados();
        }
      }

      // 6. Sincronizar Contas a Pagar
      if (Array.isArray(cloudData.contasPagar)) {
        const contasConsolidadas = this.mesclarItensPorId(cloudData.contasPagar, StorageService.getContasPagar());
        StorageService.saveContasPagar(contasConsolidadas);
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || contasConsolidadas.length > cloudData.contasPagar.length;
        houveAlteracao = true;
        if (window.GerenciaModule && window.GerenciaModule.subAbaAtiva === 'financeiro') {
          window.GerenciaModule.renderContasPagar();
        }
      }

      // 7. Sincronizar Mesas & Comandas
      if (Array.isArray(cloudData.comandas)) {
        StorageService.saveComandas(cloudData.comandas);
        houveAlteracao = true;
        if (window.ComandasModule && typeof window.ComandasModule.renderGrid === 'function') {
          window.ComandasModule.renderGrid();
        }
      }

      // 8. Sincronizar Vendas
      if (Array.isArray(cloudData.vendas)) {
        const vendasConsolidadas = this.mesclarItensPorId(cloudData.vendas, StorageService.getVendas());
        localStorage.setItem('adega_vendas', JSON.stringify(vendasConsolidadas));
        precisaReenviarBaseConsolidada = precisaReenviarBaseConsolidada || vendasConsolidadas.length > cloudData.vendas.length;
      }

      // 9. Sincronizar Configurações da Loja (com blindagem contra sobrescrever digitação ativa)
      if (cloudData.config && typeof cloudData.config === 'object') {
        StorageService.saveConfig(cloudData.config);
        if (!this.isUsuarioEditando() && window.App && typeof window.App.carregarConfiguracoes === 'function') {
          window.App.carregarConfiguracoes();
        }
      }

      if (cloudData.atualizadoEm) {
        localStorage.setItem('flowpdv_ultimo_sync_cloud', cloudData.atualizadoEm);
      }

      // Sincronização em tempo real 100% silenciosa em background (sem popups intrusivos na tela)
      if (opts.manual && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('☁️ Dados sincronizados com sucesso!', 'success');
      }
    } catch (e) {
      console.error('[CloudSync] Erro ao aplicar dados recebidos:', e);
    } finally {
      this.isProcessandoRecebimento = false;
      if (precisaReenviarBaseConsolidada) {
        setTimeout(() => this.enviarAlteracaoNuvem('consolidacao_recebida'), 0);
      }
    }
  },

  enviarAlteracaoNuvem(motivo = 'geral') {
    if (this.isProcessandoRecebimento) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const delay = (motivo === 'turno_excluido' || motivo === 'produtos' || motivo === 'comandas' || motivo === 'categorias_exclusao' || motivo === 'categoria_criada') ? 50 : 500;

    this.debounceTimer = setTimeout(async () => {
      try {
        const chave = this.getChaveLicenca();
        if (!chave) return;

        const myDevId = StorageService.getDeviceId();
        const lic = StorageService.getLicenca() || {};
        const config = StorageService.getConfig() || {};
        const produtos = StorageService.getProdutos() || [];
        const usuarios = StorageService.getUsuarios() || [];
        const categorias = StorageService.getCategorias() || [];
        const clientes = StorageService.getClientes() || [];
        const contasPagar = StorageService.getContasPagar() || [];
        const turnosHistorico = StorageService.getHistoricoTurnos() || [];
        const turnosExcluidos = StorageService.getTurnosExcluidosIds() || [];
        const produtosExcluidos = StorageService.getProdutosExcluidosIds() || [];
        const vendas = StorageService.getVendas() || [];
        const turnoAtual = StorageService.getTurnoAtual() || null;
        const comandas = StorageService.getComandas ? StorageService.getComandas() : [];

        const pacote = {
          chaveLicenca: chave,
          origemTerminal: myDevId,
          razaoSocial: lic.razaoSocial || config.nomeEmpresa || config.nomeLoja || 'Minha Loja',
          cnpj: lic.cnpj || config.cnpj || '',
          produtos: produtos,
          produtosExcluidos: produtosExcluidos,
          usuarios: usuarios,
          categorias: categorias,
          categoriasExcluidas: StorageService.getCategoriasExcluidas ? StorageService.getCategoriasExcluidas() : [],
          clientes: clientes,
          contasPagar: contasPagar,
          turnosHistorico: turnosHistorico,
          turnosExcluidos: turnosExcluidos,
          turnoAtual: turnoAtual,
          turnosAtivos: {
            [myDevId]: turnoAtual
          },
          vendas: vendas,
          comandas: comandas,
          config: config,
          motivo: motivo,
          atualizadoEm: new Date().toISOString(),
          dataBackupFormatada: new Date().toLocaleString('pt-BR'),
          totalProdutos: produtos.length,
          totalUsuarios: usuarios.length,
          totalClientes: clientes.length,
          totalTurnos: turnosHistorico.length
        };

        // 🛡️ PROTEÇÃO ANTI-WIPE ABSOLUTA:
        // Se este terminal estiver com produtos ou usuários vazios (ex: recém-instalado ou cache limpo),
        // ele JAMAIS envia array vazio para a nuvem para não zerar os dados de outros computadores!
        if (produtos.length === 0 && motivo !== 'limpeza_manual_confirmada') {
          delete pacote.produtos;
        }
        if (usuarios.length === 0 && motivo !== 'limpeza_manual_confirmada') {
          delete pacote.usuarios;
        }

        const docRef = doc(db, COLECAO_BACKUPS, chave);
        await setDoc(docRef, pacote, { merge: true });

        localStorage.setItem('flowpdv_ultimo_sync_cloud', pacote.atualizadoEm);
        console.log('[CloudSync] Alteração salva na nuvem com sucesso:', motivo);
      } catch (e) {
        console.warn('[CloudSync] Falha ao enviar alteração para a nuvem (offline):', e);
      }
    }, 500);
  },

  async salvarBackupGarantidoImediato(chaveAlvo) {
    try {
      const chave = (chaveAlvo || this.getChaveLicenca() || '').trim().toUpperCase();
      if (!chave) return;

      const myDevId = StorageService.getDeviceId();
      const lic = StorageService.getLicenca() || {};
      const config = StorageService.getConfig() || {};
      const produtos = StorageService.getProdutos() || [];
      const usuarios = StorageService.getUsuarios() || [];
      const categorias = StorageService.getCategorias() || [];
      const clientes = StorageService.getClientes() || [];
      const contasPagar = StorageService.getContasPagar() || [];
      const turnosHistorico = StorageService.getHistoricoTurnos() || [];
      const turnosExcluidos = StorageService.getTurnosExcluidosIds() || [];
      const produtosExcluidos = StorageService.getProdutosExcluidosIds() || [];
      const vendas = StorageService.getVendas() || [];
      const turnoAtual = StorageService.getTurnoAtual() || null;
      const comandas = StorageService.getComandas ? StorageService.getComandas() : [];

      const pacote = {
        chaveLicenca: chave,
        origemTerminal: myDevId,
        razaoSocial: lic.razaoSocial || config.nomeEmpresa || config.nomeLoja || 'Minha Loja',
        cnpj: lic.cnpj || config.cnpj || '',
        produtos: produtos,
        produtosExcluidos: produtosExcluidos,
        usuarios: usuarios,
        categorias: categorias,
        clientes: clientes,
        contasPagar: contasPagar,
        turnosHistorico: turnosHistorico,
        turnosExcluidos: turnosExcluidos,
        turnoAtual: turnoAtual,
        vendas: vendas,
        comandas: comandas,
        config: config,
        motivo: 'snapshot_pre_troca_licenca',
        atualizadoEm: new Date().toISOString(),
        dataBackupFormatada: new Date().toLocaleString('pt-BR'),
        totalProdutos: produtos.length,
        totalUsuarios: usuarios.length,
        totalClientes: clientes.length,
        totalTurnos: turnosHistorico.length
      };

      const docRef = doc(db, COLECAO_BACKUPS, chave);
      await setDoc(docRef, pacote, { merge: true });
      console.log('[CloudSync] Backup de segurança imediato salvo na nuvem com sucesso para chave:', chave);
      return true;
    } catch(e) {
      console.warn('[CloudSync] Erro ao salvar backup garantido imediato:', e);
      return false;
    }
  },

  async forcarEnvioBaseLocalParaNuvem() {
    const chave = this.getChaveLicenca();
    if (!chave) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('❌ Nenhuma licença ativa.', 'error');
      }
      return;
    }
    await this.salvarBackupGarantidoImediato(chave);
    const prods = (StorageService.getProdutos() || []).length;
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`☁️ Base com ${prods} produto(s) enviada para a nuvem!`, 'success');
    }
  },

  async forcarBaixarBaseNuvem() {
    const chave = this.getChaveLicenca();
    if (!chave) return;
    try {
      let docSnap = await getDoc(doc(db, COLECAO_BACKUPS, chave));
      if (!docSnap.exists()) {
        const snapLegado = await getDoc(doc(db, COLECAO_LEGADA, chave));
        if (snapLegado.exists()) docSnap = snapLegado;
      }
      if (docSnap && docSnap.exists()) {
        const cloudData = docSnap.data() || {};
        this.carregarBaseCompletaNovaEmpresa(cloudData);
        const prods = (cloudData.produtos || []).length;
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`⬇️ ${prods} produto(s) sincronizados da nuvem!`, 'success');
        }
      }
    } catch (e) {
      console.warn('[CloudSync] Erro ao baixar da nuvem:', e);
    }
  }
};
