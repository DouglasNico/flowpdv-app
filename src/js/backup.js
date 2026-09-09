/**
 * backup.js - Backup Diário em Nuvem & Recuperação de Desastre (Cloud Safe)
 */
import { StorageService } from './storage.js';
import { CloudSyncModule } from './cloud-sync.js';
import { db, doc, getDoc, setDoc } from './firebase-config.js';

const COLECAO_BACKUPS = "backups_lojas";
const COLECAO_LEGADA = "backups_adegas";

export const BackupModule = {
  init() {
    this.verificarBackupDiarioAutomatico();
    this.atualizarStatusBackupUI();
  },

  getChaveLicenca() {
    const lic = StorageService.getLicenca() || {};
    return (lic.chaveLicenca || '').trim().toUpperCase();
  },

  async verificarBackupDiarioAutomatico() {
    try {
      const chave = this.getChaveLicenca();
      if (!chave) return;

      const hoje = new Date().toISOString().split('T')[0];
      const ultimoBackupData = localStorage.getItem('flowpdv_ultimo_backup_data');

      // Se ainda não fez backup hoje, faz silenciosamente
      if (ultimoBackupData !== hoje) {
        console.log('[BackupCloud] Iniciando backup automático diário...');
        await this.fazerBackupNuvem({ silencioso: true });
      }
    } catch (e) {
      console.warn('[BackupCloud] Erro no backup automático diário:', e);
    }
  },

  async fazerBackupNuvem(opts = {}) {
    const silencioso = opts.silencioso || false;
    const btn = document.getElementById('btn-fazer-backup');
    const originalHtml = btn ? btn.innerHTML : '☁️ Fazer Backup Agora';

    if (btn && !silencioso) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Fazendo Backup...';
    }

    const chave = this.getChaveLicenca();
    const lic = StorageService.getLicenca() || {};
    const produtos = StorageService.getProdutos() || [];
    const clientes = StorageService.getClientes() || [];
    const contasPagar = StorageService.getContasPagar() || [];
    const usuarios = StorageService.getUsuarios() || [];
    const categorias = StorageService.getCategorias() || [];
    const turnosHistorico = StorageService.getHistoricoTurnos() || [];
    const vendas = StorageService.getVendas() || [];
    const config = StorageService.getConfig() || {};
    const produtosExcluidos = StorageService.getProdutosExcluidosIds() || [];
    const comandas = StorageService.getComandas ? StorageService.getComandas() : [];

    if (!chave) {
      if (btn && !silencioso) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
      if (!silencioso && window.App) {
        window.App.showToast('⚠️ Licença não identificada para backup.', 'warning');
      }
      return false;
    }

    try {
      const backupData = {
        chaveLicenca: chave,
        razaoSocial: lic.razaoSocial || config.nomeEmpresa || config.nomeLoja || 'Minha Loja',
        cnpj: lic.cnpj || config.cnpj || '',
        produtos: produtos,
        produtosExcluidos: produtosExcluidos,
        clientes: clientes,
        contasPagar: contasPagar,
        usuarios: usuarios,
        categorias: categorias,
        comandas: comandas,
        turnosHistorico: turnosHistorico,
        turnoAtual: StorageService.getTurnoAtual() || null,
        turnosAtivos: {
          [StorageService.getDeviceId()]: StorageService.getTurnoAtual() || null
        },
        vendas: vendas,
        config: config,
        dataBackup: new Date().toISOString(),
        dataBackupFormatada: new Date().toLocaleString('pt-BR'),
        totalProdutos: produtos.length,
        totalClientes: clientes.length,
        totalUsuarios: usuarios.length,
        versaoApp: '3.2.0',
        atualizadoEm: new Date().toISOString()
      };

      // Mesma gravação particionada do CloudSync: um backup manual não pode
      // recriar o documento gigante que estoura o limite do Firestore.
      await CloudSyncModule.gravarPacote(chave, backupData, StorageService.getMovimentosEstoque());

      const hoje = new Date().toISOString().split('T')[0];
      localStorage.setItem('flowpdv_ultimo_backup_data', hoje);
      localStorage.setItem('flowpdv_ultimo_backup_timestamp', backupData.dataBackupFormatada);
      localStorage.setItem('flowpdv_ultimo_backup_info', JSON.stringify({
        data: backupData.dataBackupFormatada,
        totalProdutos: produtos.length,
        totalClientes: clientes.length
      }));

      this.atualizarStatusBackupUI();

      if (!silencioso && window.App) {
        window.App.showToast(`☁️ Backup de ${produtos.length} produtos e ${clientes.length} clientes salvo na nuvem com sucesso!`, 'success');
      }
      return true;
    } catch (e) {
      console.error('[BackupCloud] Erro ao salvar backup:', e);
      if (!silencioso && window.App) {
        window.App.showToast('❌ Erro ao conectar com o servidor para backup.', 'error');
      }
      return false;
    } finally {
      if (btn && !silencioso) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  },

  async restaurarBackupNuvem() {
    const chave = this.getChaveLicenca();
    if (!chave) {
      if (window.App) window.App.showToast('⚠️ Licença não encontrada.', 'warning');
      return;
    }

    try {
      if (window.App) window.App.showToast('🔄 Buscando backup na nuvem...', 'info');

      const data = await CloudSyncModule.lerPacote(chave);
      if (!data) {
        if (window.App) window.App.showToast('⚠️ Nenhum backup encontrado na nuvem para esta licença.', 'warning');
        return;
      }

      const qtdProd = Array.isArray(data.produtos) ? data.produtos.length : 0;
      const qtdCli = Array.isArray(data.clientes) ? data.clientes.length : 0;
      const dataBkp = data.dataBackupFormatada || 'Recente';

      window.App.confirmarAcao({
        titulo: '☁️ RESTAURAR BACKUP DA NUVEM',
        mensagem: `Backup encontrado com sucesso na nuvem!<br><br>• <strong>Data:</strong> ${dataBkp}<br>• <strong>Produtos:</strong> ${qtdProd} itens<br>• <strong>Clientes:</strong> ${qtdCli} cadastros<br><br>Deseja restaurar estes dados agora neste terminal?`,
        icone: '☁️',
        textoConfirmar: '📥 Sim, Restaurar [ENTER]',
        textoCancelar: 'Cancelar [ESC]',
        perigo: false,
        onConfirm: () => {
          // Aplicar restauração
          if (Array.isArray(data.produtos)) {
            StorageService.saveProdutos(data.produtos);
          }
          if (Array.isArray(data.clientes)) {
            StorageService.saveClientes(data.clientes);
          }
          if (Array.isArray(data.contasPagar)) {
            StorageService.saveContasPagar(data.contasPagar);
          }
          if (Array.isArray(data.usuarios)) {
            StorageService.saveUsuarios(data.usuarios);
          }
          if (Array.isArray(data.categorias)) {
            StorageService.salvarCategorias(data.categorias);
          }
          if (Array.isArray(data.vendas)) {
            localStorage.setItem('adega_vendas', JSON.stringify(data.vendas));
          }
          if (Array.isArray(data.comandas) && typeof StorageService.saveComandas === 'function') {
            StorageService.saveComandas(data.comandas);
          }
          if (Array.isArray(data.turnosHistorico)) {
            StorageService.salvarHistoricoTurnos(data.turnosHistorico);
          }
          if (data.turnoAtual) {
            StorageService.salvarTurno(data.turnoAtual);
          }
          if (Array.isArray(data.produtosExcluidos)) {
            localStorage.setItem('adega_produtos_excluidos_ids', JSON.stringify(data.produtosExcluidos));
          }
          if (Array.isArray(data.turnosExcluidos)) {
            localStorage.setItem('adega_turnos_excluidos_ids', JSON.stringify(data.turnosExcluidos));
          }
          if (data.config && typeof data.config === 'object') {
            StorageService.saveConfig(data.config);
          }
          if (data.fiscalConfig && typeof data.fiscalConfig === 'object') {
            StorageService.saveFiscalConfig(data.fiscalConfig);
          }
          if (data.tefConfig && typeof data.tefConfig === 'object') {
            StorageService.saveTefConfig(data.tefConfig);
          }

          if (window.EstoqueModule) {
            window.EstoqueModule.renderBarraCategorias();
            window.EstoqueModule.renderTabelaProdutos();
          }
          if (window.ClientesModule) window.ClientesModule.renderTabelaClientes();
          if (window.GerenciaModule) window.GerenciaModule.renderContasPagar();
          if (window.AuthModule && typeof window.AuthModule.renderTabelaOperadoresConfig === 'function') {
            window.AuthModule.renderTabelaOperadoresConfig();
          }
          if (window.App && typeof window.App.carregarConfiguracoes === 'function') {
            window.App.carregarConfiguracoes();
          }
          localStorage.setItem('flowpdv_ultimo_backup_timestamp', dataBkp);
          this.atualizarStatusBackupUI();

          window.App.showToast('✅ Backup da nuvem restaurado com sucesso!', 'success');
        }
      });
    } catch (e) {
      console.error('[BackupCloud] Erro ao restaurar:', e);
      if (window.App) window.App.showToast('❌ Erro ao baixar dados da nuvem.', 'error');
    }
  },

  async atualizarStatusBackupUI() {
    const statusEl = document.getElementById('cfg-backup-status-text');
    if (!statusEl) return;

    const chave = this.getChaveLicenca();
    if (!chave) {
      statusEl.innerHTML = `🟡 Nenhuma licença ativa vinculada.`;
      return;
    }

    const timestamp = localStorage.getItem('flowpdv_ultimo_backup_timestamp');
    const bkpInfoStr = localStorage.getItem('flowpdv_ultimo_backup_info');

    if (timestamp) {
      let extra = '';
      if (bkpInfoStr) {
        try {
          const info = JSON.parse(bkpInfoStr);
          extra = ` (${info.totalProdutos} produtos, ${info.totalClientes} clientes)`;
        } catch (e) {}
      }
      statusEl.innerHTML = `🟢 Último backup salvo na nuvem: <strong>${timestamp}</strong>${extra}.`;
    } else {
      statusEl.innerHTML = `🟡 Nenhum backup salvo na nuvem para esta licença. Clique ao lado para sincronizar agora.`;
    }

    // Consulta de garantia no Firestore em segundo plano para refletir dados reais da licença ativa
    try {
      await CloudSyncModule.garantirSessao(chave);
      let docSnap = await getDoc(doc(db, COLECAO_BACKUPS, chave));
      if (!docSnap.exists()) {
        const snapLegado = await getDoc(doc(db, COLECAO_LEGADA, chave));
        if (snapLegado.exists()) docSnap = snapLegado;
      }
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data() || {};
        const bkpData = data.dataBackupFormatada || data.dataBackup || 'Recente';
        // Os totais vêm do resumo: as listas agora moram nas partes.
        const totalP = Array.isArray(data.produtos) ? data.produtos.length : (parseInt(data.totalProdutos, 10) || 0);
        const totalC = Array.isArray(data.clientes) ? data.clientes.length : (parseInt(data.totalClientes, 10) || 0);
        localStorage.setItem('flowpdv_ultimo_backup_timestamp', bkpData);
        localStorage.setItem('flowpdv_ultimo_backup_info', JSON.stringify({
          data: bkpData,
          totalProdutos: totalP,
          totalClientes: totalC
        }));
        statusEl.innerHTML = `🟢 Último backup salvo na nuvem: <strong>${bkpData}</strong> (${totalP} produtos, ${totalC} clientes).`;
      } else if (!timestamp) {
        statusEl.innerHTML = `🟡 Nenhum backup salvo na nuvem para esta licença. Clique ao lado para sincronizar agora.`;
      }
    } catch(e) {}
  }
};
