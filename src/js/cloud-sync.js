/**
 * cloud-sync.js - Sincronização Automática em Tempo Real (Cloud Sync)
 * Mantém Operadores, Estoque, Produtos, Categorias e Clientes sincronizados entre todos os terminais da loja.
 */

import { StorageService } from './storage.js';
import { db, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, query, where, orderBy, limit, garantirSessaoLoja, encerrarSessaoLoja } from './firebase-config.js';
import {
  mesclarItensPorId,
  mesclarComandas,
  consolidarProdutosComMovimentos,
  normalizarMovimentos,
  mapearMovimentosPorId,
  dividirEmLotes
} from './merge-core.js';

const COLECAO_BACKUPS = "backups_lojas";
const COLECAO_LEGADA = "backups_adegas";

// Um documento do Firestore só aguenta 1 MiB. As listas que crescem sem limite
// vão para a subcoleção `partes`, quebradas em lotes.
// `inverter` é para as listas que crescem pelo começo (venda nova entra no topo):
// gravamos da mais antiga para a mais nova, senão cada venda deslocaria todos os
// lotes e obrigaria a reescrever a base inteira.
const PARTES = {
  produtos: { lote: 300, inverter: false },
  vendas: { lote: 200, inverter: true },
  clientes: { lote: 400, inverter: false },
  turnosHistorico: { lote: 100, inverter: true }
};

const CHAVE_MANIFESTO = 'flowpdv_partes_manifesto';
const CHAVE_ASSINATURAS = 'flowpdv_partes_hash';
const CHAVE_MOV_ENVIADOS = 'flowpdv_movimentos_enviados';
const CHAVE_MOV_RECEBIDOS = 'flowpdv_ultimo_mov_sync';

export const CloudSyncModule = {
  debounceTimer: null,
  ouvinteAtivo: false,
  isProcessandoRecebimento: false,
  marcaDaguaMovimentos: null,
  timerReconexaoOuvinte: null,

  init() {
    this.sincronizacaoInicialAuto();
    this.iniciarOuvinteTempoReal();
    this.configurarMonitorConexao();
    setTimeout(() => {
      if (window.AuditModule && typeof window.AuditModule.descarregarPendentes === 'function') {
        window.AuditModule.descarregarPendentes();
      }
    }, 1200);

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
        this.iniciarOuvinteTempoReal();
        this.enviarAlteracaoNuvem('retorno_conexao');
        if (window.AuditModule && typeof window.AuditModule.descarregarPendentes === 'function') {
          window.AuditModule.descarregarPendentes();
        }
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
    return mesclarItensPorId(baseA, baseB);
  },

  mesclarProdutosComEstoque(nuvem = [], local = [], movimentosNuvem = []) {
    const movimentosLocais = StorageService.getMovimentosEstoque ? StorageService.getMovimentosEstoque() : [];
    const { produtos, novosMovimentos } = consolidarProdutosComMovimentos({
      produtosNuvem: nuvem,
      produtosLocais: local,
      movimentosNuvem,
      movimentosLocais
    });

    if (novosMovimentos.length && StorageService.saveMovimentosEstoque) {
      StorageService.saveMovimentosEstoque([...movimentosLocais, ...novosMovimentos]);
    }

    return produtos;
  },

  normalizarMovimentosNuvem(raw) {
    return normalizarMovimentos(raw);
  },

  mapearMovimentosParaNuvem(lista) {
    return mapearMovimentosPorId(lista);
  },

  // ---------------------------------------------------------------------------
  // Persistência particionada: main doc pequeno + subcoleções `partes` e `movimentos`
  // ---------------------------------------------------------------------------

  async garantirSessao(chave) {
    const alvo = String(chave || this.getChaveLicenca() || '').trim().toUpperCase();
    if (!alvo) return false;
    return garantirSessaoLoja(alvo, { deviceId: StorageService.getDeviceId() });
  },

  getManifestos() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_MANIFESTO) || '{}') || {};
    } catch (e) {
      return {};
    }
  },

  getManifesto(chave) {
    return this.getManifestos()[chave] || {};
  },

  salvarManifesto(chave, manifesto) {
    const todos = this.getManifestos();
    todos[chave] = { ...(todos[chave] || {}), ...(manifesto || {}) };
    localStorage.setItem(CHAVE_MANIFESTO, JSON.stringify(todos));
  },

  assinar(texto) {
    let hash = 2166136261;
    for (let i = 0; i < texto.length; i++) {
      hash ^= texto.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36) + ':' + texto.length;
  },

  getAssinaturas(chave) {
    try {
      const todas = JSON.parse(localStorage.getItem(CHAVE_ASSINATURAS) || '{}') || {};
      return todas[chave] || {};
    } catch (e) {
      return {};
    }
  },

  salvarAssinaturas(chave, assinaturas) {
    let todas = {};
    try {
      todas = JSON.parse(localStorage.getItem(CHAVE_ASSINATURAS) || '{}') || {};
    } catch (e) { /* cache corrompido: recomeça */ }
    todas[chave] = assinaturas;
    localStorage.setItem(CHAVE_ASSINATURAS, JSON.stringify(todas));
  },

  async gravarParte(chave, nome, lista, config) {
    const ordenada = config.inverter ? [...(lista || [])].reverse() : (lista || []);
    const lotes = dividirEmLotes(ordenada, config.lote);
    const atualizadoEm = new Date().toISOString();

    const assinaturas = this.getAssinaturas(chave);
    const gravadas = { ...assinaturas };

    // Reenviar lote idêntico só queima cota do Firestore.
    await Promise.all(lotes.map(async (itens, indice) => {
      const idLote = `${nome}_${indice}`;
      const assinatura = this.assinar(JSON.stringify(itens));
      if (assinaturas[idLote] === assinatura) return;

      await setDoc(
        doc(db, COLECAO_BACKUPS, chave, 'partes', idLote),
        { nome, indice, total: lotes.length, itens, atualizadoEm }
      );
      gravadas[idLote] = assinatura;
    }));

    // Sobras de quando a lista era maior: sem isso, o leitor futuro poderia
    // ressuscitar itens já apagados.
    const anterior = parseInt(this.getManifesto(chave)[nome], 10) || 0;
    const remocoes = [];
    for (let i = lotes.length; i < anterior; i++) {
      const idLote = `${nome}_${i}`;
      delete gravadas[idLote];
      remocoes.push(deleteDoc(doc(db, COLECAO_BACKUPS, chave, 'partes', idLote)).catch(() => {}));
    }
    await Promise.all(remocoes);

    this.salvarAssinaturas(chave, gravadas);
    return lotes.length;
  },

  async lerParte(chave, nome, total) {
    const qtd = parseInt(total, 10) || 0;
    if (qtd <= 0) return [];

    const snaps = await Promise.all(
      Array.from({ length: qtd }, (_, i) => getDoc(doc(db, COLECAO_BACKUPS, chave, 'partes', `${nome}_${i}`)).catch(() => null))
    );

    const itens = [];
    snaps.forEach(snap => {
      if (!snap || !snap.exists()) return;
      const dados = snap.data() || {};
      if (Array.isArray(dados.itens)) itens.push(...dados.itens);
    });

    return (PARTES[nome] && PARTES[nome].inverter) ? itens.reverse() : itens;
  },

  async gravarPacote(chave, pacote, movimentosEstoque) {
    await this.garantirSessao(chave);

    const envio = { ...pacote };
    const manifesto = {};

    // turnosAtivos NÃO pode ir no setDoc merge: o mapa inteiro seria
    // substituído e apagaria o caixa aberto dos outros terminais.
    const meuDevId = envio.origemTerminal || StorageService.getDeviceId();
    const meuTurno = Object.prototype.hasOwnProperty.call(envio, 'turnosAtivos')
      ? (envio.turnosAtivos && typeof envio.turnosAtivos === 'object'
          ? envio.turnosAtivos[meuDevId]
          : undefined)
      : undefined;
    const devePatchTurno = Object.prototype.hasOwnProperty.call(envio, 'turnosAtivos');
    delete envio.turnosAtivos;

    // Lista de operadores vazia nunca sobe: apagaria os operadores dos outros caixas.
    if (Array.isArray(envio.usuarios) && envio.usuarios.length === 0 && pacote.motivo !== 'limpeza_manual_confirmada') {
      delete envio.usuarios;
    }

    for (const [nome, config] of Object.entries(PARTES)) {
      // Campo ausente = proteção anti-wipe agiu; não tocamos na parte da nuvem.
      if (!Array.isArray(envio[nome])) continue;

      // Terminal recém-instalado (ou cache limpo) nunca zera o catálogo dos outros.
      if (nome === 'produtos' && envio[nome].length === 0 && pacote.motivo !== 'limpeza_manual_confirmada') {
        delete envio[nome];
        continue;
      }

      manifesto[nome] = await this.gravarParte(chave, nome, envio[nome], config);
      envio[nome] = deleteField();
    }

    // Formato antigo (mapa gigante dentro do doc principal) sai de cena.
    envio.movimentosEstoque = deleteField();

    if (Object.keys(manifesto).length > 0) {
      envio.partes = manifesto;
      this.salvarManifesto(chave, manifesto);
    }

    await setDoc(doc(db, COLECAO_BACKUPS, chave), envio, { merge: true });

    if (devePatchTurno && meuDevId) {
      await this.atualizarTurnoAtivoDoTerminal(chave, meuDevId, meuTurno === undefined ? null : meuTurno);
    }

    await this.enviarMovimentosPendentes(chave, movimentosEstoque);
  },

  /** Atualiza só o slot deste terminal em turnosAtivos (não apaga os outros). */
  async atualizarTurnoAtivoDoTerminal(chave, deviceId, turno) {
    const chaveNorm = String(chave || '').trim().toUpperCase();
    const id = String(deviceId || '').trim();
    if (!chaveNorm || !id) return;
    try {
      await updateDoc(doc(db, COLECAO_BACKUPS, chaveNorm), {
        [`turnosAtivos.${id}`]: turno || null,
        atualizadoEm: new Date().toISOString()
      });
    } catch (e) {
      // Doc pode não existir ainda — cria só o slot deste terminal
      try {
        await setDoc(doc(db, COLECAO_BACKUPS, chaveNorm), {
          turnosAtivos: { [id]: turno || null },
          atualizadoEm: new Date().toISOString()
        }, { merge: true });
      } catch (e2) {
        console.warn('[CloudSync] Falha ao atualizar turnosAtivos do terminal:', e2);
      }
    }
  },

  async completarPacote(chave, dados, legado = false) {
    if (!dados || legado || !dados.partes) return dados;

    const manifesto = dados.partes || {};
    this.salvarManifesto(chave, manifesto);

    const nomes = Object.keys(PARTES).filter(nome => manifesto[nome] !== undefined);
    const listas = await Promise.all(nomes.map(nome => this.lerParte(chave, nome, manifesto[nome])));

    const completo = { ...dados };
    nomes.forEach((nome, i) => { completo[nome] = listas[i]; });
    return completo;
  },

  async lerPacote(chave) {
    await this.garantirSessao(chave);

    let snap = await getDoc(doc(db, COLECAO_BACKUPS, chave));
    let legado = false;

    if (!snap.exists()) {
      snap = await getDoc(doc(db, COLECAO_LEGADA, chave));
      legado = true;
    }
    if (!snap.exists()) return null;

    const dados = snap.data() || {};
    const completo = await this.completarPacote(chave, dados, legado);
    completo.movimentosEstoque = await this.baixarMovimentosNovos(chave, completo.movimentosEstoque);
    return completo;
  },

  /**
   * Movimentos ficam em documentos individuais: cada terminal só escreve os
   * seus, então dois caixas nunca sobrescrevem a baixa de estoque um do outro.
   */
  async enviarMovimentosPendentes(chave, movimentos) {
    const lista = Array.isArray(movimentos) ? movimentos : [];
    if (lista.length === 0) return;

    let enviados;
    try {
      enviados = new Set(JSON.parse(localStorage.getItem(CHAVE_MOV_ENVIADOS) || '[]'));
    } catch (e) {
      enviados = new Set();
    }

    const pendentes = lista.filter(m => m && m.id && !enviados.has(m.id)).slice(-300);
    if (pendentes.length === 0) return;

    await Promise.all(pendentes.map(m => setDoc(
      doc(db, COLECAO_BACKUPS, chave, 'movimentos', String(m.id)),
      m
    )));

    pendentes.forEach(m => enviados.add(m.id));
    localStorage.setItem(CHAVE_MOV_ENVIADOS, JSON.stringify(Array.from(enviados).slice(-4000)));
  },

  async baixarMovimentosNovos(chave, movimentosLegado = null) {
    const meuTerminal = StorageService.getDeviceId();
    const desde = localStorage.getItem(CHAVE_MOV_RECEBIDOS)
      || new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const consulta = query(
        collection(db, COLECAO_BACKUPS, chave, 'movimentos'),
        where('at', '>', desde),
        orderBy('at'),
        limit(800)
      );
      const snap = await getDocs(consulta);

      const lista = [];
      let marcaDagua = desde;
      snap.forEach(d => {
        const mov = d.data();
        if (!mov || !mov.id) return;
        if (mov.at && mov.at > marcaDagua) marcaDagua = mov.at;
        if (mov.terminalId && mov.terminalId === meuTerminal) return;
        lista.push(mov);
      });

      this.marcaDaguaMovimentos = marcaDagua;
      if (lista.length === 0) return normalizarMovimentos(movimentosLegado);
      return lista;
    } catch (e) {
      console.warn('[CloudSync] Não foi possível ler os movimentos de estoque:', e);
      return normalizarMovimentos(movimentosLegado);
    }
  },

  confirmarMovimentosAplicados() {
    if (this.marcaDaguaMovimentos) {
      localStorage.setItem(CHAVE_MOV_RECEBIDOS, this.marcaDaguaMovimentos);
      this.marcaDaguaMovimentos = null;
    }
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

      const cloudData = await this.lerPacote(chave);
      const produtosLocais = StorageService.getProdutos() || [];
      const contasLocais = StorageService.getContasPagar() || [];
      const clientesLocais = StorageService.getClientes() || [];
      const vendasLocais = StorageService.getVendas() || [];

      if (cloudData) {
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
        const produtosConsolidados = this.mesclarProdutosComEstoque(cloudProds, produtosLocais, cloudData.movimentosEstoque);
        const contasConsolidadas = this.mesclarItensPorId(cloudContas, contasLocais);
        const clientesConsolidados = this.mesclarItensPorId(cloudClientes, clientesLocais);
        const vendasConsolidadas = this.mesclarItensPorId(cloudVendas, vendasLocais);

        StorageService.saveProdutos(produtosConsolidados);
        StorageService.saveContasPagar(contasConsolidadas);
        StorageService.saveClientes(clientesConsolidados);
        localStorage.setItem('adega_vendas', JSON.stringify(vendasConsolidadas));
        this.confirmarMovimentosAplicados();

        if (Array.isArray(cloudData.comandas)) {
          StorageService.saveComandas(mesclarComandas(cloudData.comandas, StorageService.getComandas()));
        }

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

  async iniciarOuvinteTempoReal() {
    if (this.ouvinteAtivo) return;

    try {
      const chave = this.getChaveLicenca();
      if (!chave) return;

      this.ouvinteAtivo = true;

      // Sem sessão o Firestore recusa a inscrição; se o PDV abriu offline,
      // reagendamos em vez de ficar sem tempo real até reiniciar o programa.
      const autenticado = await this.garantirSessao(chave);
      if (!autenticado) {
        this.ouvinteAtivo = false;
        this.reagendarOuvinte();
        return;
      }

      this.unsubOuvinte = onSnapshot(doc(db, COLECAO_BACKUPS, chave), async (snap) => {
        if (!snap || !snap.exists()) return;
        const resumo = snap.data();
        if (!resumo) return;

        if (!this.pacotePertenceALicenca(resumo)) {
          console.warn('[CloudSync] Pacote ignorado: licença incompatível.');
          return;
        }

        // Se a alteração partiu deste mesmo terminal, ignora
        const myDevId = StorageService.getDeviceId();
        if (resumo.origemTerminal === myDevId) {
          return;
        }

        // O documento principal só traz o resumo: as listas grandes e os
        // movimentos de estoque vivem nas subcoleções.
        let cloudData = resumo;
        try {
          cloudData = await this.completarPacote(chave, resumo);
          cloudData.movimentosEstoque = await this.baixarMovimentosNovos(chave, resumo.movimentosEstoque);
        } catch (e) {
          console.warn('[CloudSync] Falha ao carregar as partes do pacote recebido:', e);
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
        this.ouvinteAtivo = false;
        this.unsubOuvinte = null;
        this.reagendarOuvinte();
      });
    } catch (e) {
      console.warn('[CloudSync] Erro ao iniciar ouvinte:', e);
      this.ouvinteAtivo = false;
      this.reagendarOuvinte();
    }
  },

  reagendarOuvinte() {
    if (this.timerReconexaoOuvinte) return;
    this.timerReconexaoOuvinte = setTimeout(() => {
      this.timerReconexaoOuvinte = null;
      this.iniciarOuvinteTempoReal();
    }, 30000);
  },

  async trocarEmpresaSincronizacao(novaChave) {
    try {
      // 1. Cancelar o listener em tempo real da empresa anterior
      if (this.unsubOuvinte && typeof this.unsubOuvinte === 'function') {
        this.unsubOuvinte();
        this.unsubOuvinte = null;
      }
      this.ouvinteAtivo = false;
      if (this.timerReconexaoOuvinte) {
        clearTimeout(this.timerReconexaoOuvinte);
        this.timerReconexaoOuvinte = null;
      }

      if (!novaChave) return;

      console.log('[CloudSync] Trocando sincronização para nova empresa:', novaChave);

      // 2. A troca de loja começa do zero: nada de marca d'água ou fila de
      // envio da empresa anterior contaminando a nova.
      localStorage.removeItem(CHAVE_MOV_ENVIADOS);
      localStorage.removeItem(CHAVE_MOV_RECEBIDOS);
      localStorage.removeItem(CHAVE_MANIFESTO);
      localStorage.removeItem(CHAVE_ASSINATURAS);
      this.marcaDaguaMovimentos = null;
      await encerrarSessaoLoja();

      // 3. Buscar o backup da nova empresa na nuvem
      const cloudData = await this.lerPacote(novaChave);
      if (cloudData) {
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
    if (modalEditarConfig && modalEditarConfig.style.display !== 'none' && modalEditarConfig.style.display !== '') return true;

    const modalProd = document.getElementById('modal-novo-produto');
    if (modalProd && modalProd.classList.contains('active')) return true;

    const modalOp = document.getElementById('modal-novo-operador');
    if (modalOp && modalOp.classList.contains('active')) return true;

    const modalCli = document.getElementById('modal-novo-cliente');
    if (modalCli && modalCli.classList.contains('active')) return true;

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
        const produtosConsolidados = this.mesclarProdutosComEstoque(produtosNuvemAtivos, produtosLocaisAtivos, cloudData.movimentosEstoque);
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

      // 7. Sincronizar Mesas & Comandas (mesa a mesa: a versão mais recente de
      // cada mesa vence, então o caixa 1 não desfaz o pedido do caixa 2)
      if (Array.isArray(cloudData.comandas)) {
        StorageService.saveComandas(mesclarComandas(cloudData.comandas, StorageService.getComandas()));
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

      // Só avançamos a marca d'água depois que os movimentos foram aplicados:
      // se algo estourar acima, eles chegam de novo na próxima rodada.
      this.confirmarMovimentosAplicados();

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
        const movimentosEstoque = StorageService.getMovimentosEstoque ? StorageService.getMovimentosEstoque() : [];

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

        await this.gravarPacote(chave, pacote, movimentosEstoque);

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
      const movimentosEstoque = StorageService.getMovimentosEstoque ? StorageService.getMovimentosEstoque() : [];

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

      await this.gravarPacote(chave, pacote, movimentosEstoque);
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
      const cloudData = await this.lerPacote(chave);
      if (cloudData) {
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
