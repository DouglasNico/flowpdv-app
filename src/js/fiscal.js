/**
 * fiscal.js - Emissão real de NFC-e via Focus NFe e configuração do TEF.
 *
 * Fluxo: a venda é gravada primeiro; a NFC-e é emitida em seguida com a
 * referência estável `fp-<id da venda>`. Se faltar internet a venda fica
 * "pendente" e a fila reenvia quando a conexão voltar. Rejeição da SEFAZ fica
 * gravada na venda com a mensagem para o operador corrigir e reemitir.
 */

import { StorageService } from './storage.js';
import { AuditModule } from './audit.js';
import {
  FOCUS_URLS,
  montarPayloadNFCe,
  interpretarRespostaFocus,
  podeCancelarNFCe,
  refDaVenda,
  somenteDigitos
} from './fiscal-core.js';

const INTERVALO_FILA_MS = 2 * 60 * 1000;

export const FiscalModule = {
  _processandoFila: false,
  _emitindo: new Set(),

  init() {
    this.renderStatusFiscalDisplay();

    // Vendas que ficaram sem NFC-e (sem internet, Focus fora) são reenviadas
    // ao voltar online e periodicamente.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.processarFilaFiscal());
      setInterval(() => this.processarFilaFiscal(), INTERVALO_FILA_MS);
      setTimeout(() => this.processarFilaFiscal(), 15000);
    }
  },

  getFiscalConfig() {
    return StorageService.getFiscalConfig();
  },

  getTefConfig() {
    return StorageService.getTefConfig();
  },

  fiscalAtivo() {
    const cfg = this.getFiscalConfig();
    return StorageService.isModuloAtivo('fiscalNfce') && cfg && cfg.habilitado === true;
  },

  renderStatusFiscalDisplay() {
    const isFiscalLicenciado = StorageService.isModuloAtivo('fiscalNfce');
    const isTefLicenciado = StorageService.isModuloAtivo('tefCartao');
    const cfg = this.getFiscalConfig();
    const tefCfg = this.getTefConfig();

    const displayFiscal = document.getElementById('cfg-display-fiscal');
    if (displayFiscal) {
      if (!isFiscalLicenciado) {
        displayFiscal.innerHTML = `<span style="color: #94a3b8; font-weight: 700;">⚪ Desativado pelo administrador</span>`;
      } else if (!cfg.habilitado) {
        displayFiscal.innerHTML = `<span style="color: #64748b; font-weight: 700;">⚪ Não Fiscal (Desativado)</span>`;
      } else {
        const ambTag = cfg.ambiente === 'producao'
          ? '<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">PRODUÇÃO</span>'
          : '<span style="background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">HOMOLOGAÇÃO / TESTES</span>';
        const pendentes = this.vendasPendentesFiscal().length;
        const pendTag = pendentes > 0
          ? ` <span style="background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">${pendentes} pendente(s)</span>`
          : '';
        displayFiscal.innerHTML = `<span style="color: #0284c7; font-weight: 800;">🟢 NFC-e Ativa (Focus NFe)</span> ${ambTag}${pendTag}`;
      }
    }

    const displayTef = document.getElementById('cfg-display-tef');
    if (displayTef) {
      if (!isTefLicenciado) {
        displayTef.innerHTML = `<span style="color: #94a3b8; font-weight: 700;">⚪ Desativado pelo administrador</span>`;
      } else if (!tefCfg.habilitado) {
        displayTef.innerHTML = `<span style="color: #64748b; font-weight: 700;">⚪ TEF Desativado</span>`;
      } else {
        displayTef.innerHTML = `<span style="color: #10b981; font-weight: 800;">🟢 TEF Ativo (${(tefCfg.provedor || 'PayGo').toUpperCase()})</span>`;
      }
    }
  },

  // ---------------------------------------------------------------------
  // Configuração NFC-e
  // ---------------------------------------------------------------------

  abrirModalConfigFiscal() {
    if (!StorageService.isModuloAtivo('fiscalNfce')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🏛️ O módulo Fiscal NFC-e está desativado para esta licença pelo administrador.', 'info');
      }
      return;
    }

    const modal = document.getElementById('modal-config-fiscal');
    const cfg = this.getFiscalConfig();
    const configGeral = StorageService.getConfig();

    if (modal) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      document.getElementById('fiscal-habilitado').checked = cfg.habilitado === true;
      set('fiscal-ambiente', cfg.ambiente || 'homologacao');
      set('fiscal-token-focus', cfg.tokenFocus || '');
      set('fiscal-token-focus-homolog', cfg.tokenFocusHomolog || '');
      set('fiscal-cnpj-emitente', cfg.cnpjEmitente || configGeral.cnpj || '');
      set('fiscal-ie-emitente', cfg.inscricaoEstadual || '');
      set('fiscal-serie', cfg.serieNfce || '');
      set('fiscal-regime', cfg.regimeTributario || '1');
      set('fiscal-cfop-padrao', cfg.cfopPadrao || '5102');
      set('fiscal-ncm-padrao', cfg.ncmPadrao || '22030000');
      set('fiscal-csosn-padrao', cfg.csosnPadrao || '102');
      const auto = document.getElementById('fiscal-auto-emitir');
      if (auto) auto.checked = cfg.autoEmitirAoFinalizar !== false;

      this.toggleCamposProvedorFiscal();
      modal.classList.add('active');
    }
  },

  fecharModalConfigFiscal() {
    const modal = document.getElementById('modal-config-fiscal');
    if (modal) modal.classList.remove('active');
  },

  toggleCamposProvedorFiscal() {
    const habilitado = document.getElementById('fiscal-habilitado')?.checked;
    const boxCampos = document.getElementById('box-campos-fiscais-detalhes');
    if (boxCampos) {
      boxCampos.style.display = habilitado ? 'block' : 'none';
    }
  },

  salvarConfigFiscal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const habilitado = document.getElementById('fiscal-habilitado')?.checked || false;
    const ambiente = val('fiscal-ambiente') || 'homologacao';
    const tokenFocus = val('fiscal-token-focus');
    const tokenFocusHomolog = val('fiscal-token-focus-homolog');
    const cnpjEmitente = somenteDigitos(val('fiscal-cnpj-emitente'));
    const inscricaoEstadual = somenteDigitos(val('fiscal-ie-emitente'));
    const serieNfce = parseInt(val('fiscal-serie'), 10) || 0;
    const regimeTributario = val('fiscal-regime') || '1';
    const cfopPadrao = somenteDigitos(val('fiscal-cfop-padrao')) || '5102';
    const ncmPadrao = somenteDigitos(val('fiscal-ncm-padrao')) || '22030000';
    const csosnPadrao = somenteDigitos(val('fiscal-csosn-padrao')) || '102';
    const autoEmitirAoFinalizar = document.getElementById('fiscal-auto-emitir')?.checked || false;

    if (habilitado) {
      if (cnpjEmitente.length !== 14) {
        window.App.showToast('❌ Informe o CNPJ do emitente com 14 dígitos.', 'error');
        return;
      }
      const tokenDoAmbiente = ambiente === 'producao' ? tokenFocus : (tokenFocusHomolog || tokenFocus);
      if (!tokenDoAmbiente) {
        window.App.showToast(`❌ Informe o token da Focus NFe do ambiente de ${ambiente === 'producao' ? 'produção' : 'homologação'}.`, 'error');
        return;
      }
    }

    const anterior = this.getFiscalConfig();
    const novoConfig = {
      ...anterior,
      habilitado,
      provedor: 'focus_nfe',
      ambiente,
      tokenFocus,
      tokenFocusHomolog,
      cnpjEmitente,
      inscricaoEstadual,
      serieNfce,
      regimeTributario,
      cfopPadrao,
      ncmPadrao,
      csosnPadrao,
      naturezaOperacao: 'VENDA AO CONSUMIDOR',
      autoEmitirAoFinalizar
    };
    delete novoConfig.cscId;
    delete novoConfig.cscToken;
    delete novoConfig.ultimoNumeroNfce;

    StorageService.saveFiscalConfig(novoConfig);

    AuditModule.registrarLog('configuracao_fiscal', `Alterou as configurações fiscais (NFC-e ${habilitado ? 'ATIVADA' : 'DESATIVADA'}, Focus NFe, Ambiente: ${ambiente})`, {
      habilitado,
      ambiente,
      cnpjEmitente
    });

    this.renderStatusFiscalDisplay();
    this.fecharModalConfigFiscal();
    window.App.showToast('🏛️ Configurações Fiscais salvas com sucesso!', 'success');
  },

  // ---------------------------------------------------------------------
  // Configuração TEF
  // ---------------------------------------------------------------------

  abrirModalConfigTef() {
    if (!StorageService.isModuloAtivo('tefCartao')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('💳 O módulo TEF / Cartão está desativado para esta licença pelo administrador.', 'info');
      }
      return;
    }

    const modal = document.getElementById('modal-config-tef');
    const cfg = this.getTefConfig();
    if (modal) {
      document.getElementById('tef-habilitado').checked = cfg.habilitado === true;
      document.getElementById('tef-provedor').value = cfg.provedor || 'paygo';
      document.getElementById('tef-ip-servidor').value = cfg.ipServidor || '127.0.0.1';
      document.getElementById('tef-porta').value = cfg.porta || '60906';
      document.getElementById('tef-codigo-empresa').value = cfg.codigoEmpresa || '';
      document.getElementById('tef-codigo-terminal').value = cfg.codigoTerminal || '0001';

      const boxTef = document.getElementById('box-campos-tef-detalhes');
      if (boxTef) boxTef.style.display = cfg.habilitado ? 'block' : 'none';

      modal.classList.add('active');
    }
  },

  fecharModalConfigTef() {
    const modal = document.getElementById('modal-config-tef');
    if (modal) modal.classList.remove('active');
  },

  toggleCamposTef() {
    const habilitado = document.getElementById('tef-habilitado')?.checked;
    const boxCampos = document.getElementById('box-campos-tef-detalhes');
    if (boxCampos) {
      boxCampos.style.display = habilitado ? 'block' : 'none';
    }
  },

  salvarConfigTef(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const habilitado = document.getElementById('tef-habilitado')?.checked || false;
    const provedor = document.getElementById('tef-provedor')?.value || 'paygo';
    const ipServidor = document.getElementById('tef-ip-servidor')?.value.trim() || '127.0.0.1';
    const porta = document.getElementById('tef-porta')?.value.trim() || '60906';
    const codigoEmpresa = document.getElementById('tef-codigo-empresa')?.value.trim() || '';
    const codigoTerminal = document.getElementById('tef-codigo-terminal')?.value.trim() || '0001';

    const novoTef = {
      habilitado,
      provedor,
      ipServidor,
      porta,
      codigoEmpresa,
      codigoTerminal
    };

    StorageService.saveTefConfig(novoTef);

    AuditModule.registrarLog('configuracao_tef', `Alterou as configurações do TEF (${habilitado ? 'ATIVADO' : 'DESATIVADO'}, Provedor: ${provedor})`, {
      habilitado,
      provedor
    });

    this.renderStatusFiscalDisplay();
    this.fecharModalConfigTef();
    window.App.showToast('💳 Configurações TEF salvas com sucesso!', 'success');
  },

  // ---------------------------------------------------------------------
  // Comunicação com a Focus NFe
  // ---------------------------------------------------------------------

  _tokenDoAmbiente(cfg) {
    if ((cfg.ambiente || 'homologacao') === 'producao') return cfg.tokenFocus || '';
    return cfg.tokenFocusHomolog || cfg.tokenFocus || '';
  },

  _baseUrl(cfg) {
    return FOCUS_URLS[(cfg.ambiente || 'homologacao') === 'producao' ? 'producao' : 'homologacao'];
  },

  /**
   * Faz a requisição HTTP. No Electron passa pelo processo principal; no
   * navegador usa fetch (a Focus pode bloquear por CORS, então o desktop é o
   * caminho oficial).
   * @returns {Promise<{status:number, body:any}>}
   */
  async _requisicaoFocus(metodo, caminho, body, cfgOverride) {
    const cfg = cfgOverride || this.getFiscalConfig();
    const token = this._tokenDoAmbiente(cfg);
    const url = this._baseUrl(cfg) + caminho;

    if (window.electronAPI && typeof window.electronAPI.fiscalHttp === 'function') {
      return window.electronAPI.fiscalHttp({ method: metodo, url, token, body, timeoutMs: 45000 });
    }

    try {
      const resp = await fetch(url, {
        method: metodo,
        headers: {
          'Authorization': 'Basic ' + btoa(token + ':'),
          'Accept': 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      let json = null;
      try { json = await resp.json(); } catch (e) { json = null; }
      return { status: resp.status, body: json };
    } catch (err) {
      return { status: 0, body: { codigo: 'erro_rede', mensagem: err.message } };
    }
  },

  async testarConexaoFocus() {
    const btnTestar = document.getElementById('btn-testar-focus-api');
    const ambiente = document.getElementById('fiscal-ambiente')?.value || 'homologacao';
    const cfgTeste = {
      ambiente,
      tokenFocus: (document.getElementById('fiscal-token-focus')?.value || '').trim(),
      tokenFocusHomolog: (document.getElementById('fiscal-token-focus-homolog')?.value || '').trim()
    };

    if (!this._tokenDoAmbiente(cfgTeste)) {
      window.App.showToast('Informe o token da Focus NFe antes de testar.', 'warning');
      return;
    }

    if (btnTestar) {
      btnTestar.disabled = true;
      btnTestar.innerHTML = '⏳ Conectando à Focus NFe...';
    }

    try {
      // Consulta uma referência inexistente: 404 prova que o token autenticou.
      const r = await this._requisicaoFocus('GET', '/v2/nfce/flowpdv-teste-conexao', null, cfgTeste);
      if (r.status === 404 || (r.status >= 200 && r.status < 300)) {
        window.App.showToast(`✅ Focus NFe (${ambiente.toUpperCase()}) respondeu: token válido.`, 'success');
      } else if (r.status === 401 || r.status === 403) {
        window.App.showToast(`❌ Token recusado pela Focus NFe (${ambiente}). Confira se é o token deste ambiente.`, 'error');
      } else if (r.status === 0) {
        window.App.showToast('❌ Sem resposta da Focus NFe: ' + (r.body?.mensagem || 'verifique a internet.'), 'error');
      } else {
        window.App.showToast(`⚠️ Focus NFe respondeu HTTP ${r.status}: ${r.body?.mensagem || ''}`, 'warning');
      }
    } finally {
      if (btnTestar) {
        btnTestar.disabled = false;
        btnTestar.innerHTML = '⚡ Testar Conexão Focus NFe';
      }
    }
  },

  // ---------------------------------------------------------------------
  // Emissão
  // ---------------------------------------------------------------------

  _mapaProdutos() {
    const mapa = new Map();
    (StorageService.getProdutos() || []).forEach(p => { if (p && p.id != null) mapa.set(p.id, p); });
    return mapa;
  },

  _aplicarAutorizacao(venda, dados) {
    venda.chaveNfe = dados.chaveAcesso;
    venda.protocoloNfe = dados.protocoloAutorizacao;
    venda.numeroNfce = dados.numeroNfce;
    venda.serieNfce = dados.serieNfce;
    venda.qrcodeUrl = dados.qrcodeUrl;
    venda.urlConsultaNfce = dados.urlConsulta;
    venda.caminhoXmlNfce = dados.caminhoXml;
    venda.caminhoDanfeNfce = dados.caminhoDanfe;
    venda.dataAutorizacaoNfce = dados.dataAutorizacao;
    venda.statusFiscal = 'autorizada';
    venda.fiscalErro = '';
  },

  /**
   * Emite (ou reemite) a NFC-e da venda. Sempre grava o resultado na venda.
   * @returns {Promise<{sucesso:boolean, estado:string, mensagem:string}>}
   */
  async emitirNFCe(venda) {
    if (!venda || !venda.id) return { sucesso: false, estado: 'erro_config', mensagem: 'Venda inválida.' };
    if (this._emitindo.has(venda.id)) return { sucesso: false, estado: 'processando', mensagem: 'Emissão já em andamento.' };

    const cfg = this.getFiscalConfig();
    if (!this.fiscalAtivo()) {
      return { sucesso: false, estado: 'erro_config', mensagem: 'Módulo fiscal desativado.' };
    }
    if (venda.statusFiscal === 'autorizada' && venda.chaveNfe) {
      return { sucesso: true, estado: 'autorizada', mensagem: 'NFC-e já autorizada.' };
    }

    this._emitindo.add(venda.id);
    const ref = refDaVenda(venda);
    venda.fiscalRef = ref;

    try {
      let payload;
      try {
        payload = montarPayloadNFCe(venda, cfg, this._mapaProdutos());
      } catch (err) {
        // Venda que nunca vai gerar nota (R$ 0, sem itens, CNPJ inválido).
        venda.statusFiscal = 'rejeitada';
        venda.fiscalErro = err.message;
        venda.ambiente = cfg.ambiente;
        StorageService.atualizarVenda(venda);
        return { sucesso: false, estado: 'rejeitada', mensagem: err.message };
      }

      const resp = await this._requisicaoFocus('POST', `/v2/nfce?ref=${encodeURIComponent(ref)}`, payload);
      let resultado = interpretarRespostaFocus(resp.status, resp.body);

      // Ref já autorizada num envio anterior que não recebemos a resposta:
      // consulta e aproveita a nota existente em vez de duplicar.
      if (resultado.estado === 'ja_processada' || resultado.estado === 'processando') {
        const consulta = await this._requisicaoFocus('GET', `/v2/nfce/${encodeURIComponent(ref)}`);
        const r2 = interpretarRespostaFocus(consulta.status, consulta.body);
        if (r2.estado === 'autorizada' || r2.estado === 'cancelada' || r2.estado === 'rejeitada') resultado = r2;
      }

      venda.ambiente = cfg.ambiente || 'homologacao';
      venda.fiscalTentativas = (venda.fiscalTentativas || 0) + 1;
      venda.fiscalUltimaTentativa = new Date().toISOString();

      switch (resultado.estado) {
        case 'autorizada':
          this._aplicarAutorizacao(venda, resultado.dados);
          AuditModule.registrarLog('emissao_nfce', `NFC-e nº ${venda.numeroNfce} série ${venda.serieNfce} autorizada para a venda #${StorageService.formatarNumeroVenda ? StorageService.formatarNumeroVenda(venda) : venda.id} (chave ${String(venda.chaveNfe).slice(0, 12)}...)`, {
            vendaId: venda.id, numeroNfce: venda.numeroNfce, serieNfce: venda.serieNfce, chaveAcesso: venda.chaveNfe, protocolo: venda.protocoloNfe, ambiente: venda.ambiente
          });
          break;
        case 'cancelada':
          this._aplicarAutorizacao(venda, resultado.dados);
          venda.statusFiscal = 'cancelada';
          break;
        case 'rejeitada':
        case 'erro_config':
          venda.statusFiscal = 'rejeitada';
          venda.fiscalErro = resultado.mensagem;
          AuditModule.registrarLog('erro_nfce', `NFC-e da venda #${venda.id} rejeitada: ${resultado.mensagem}`, { vendaId: venda.id, mensagem: resultado.mensagem });
          break;
        case 'processando':
          venda.statusFiscal = 'pendente';
          venda.fiscalErro = resultado.mensagem;
          break;
        default: // erro_rede, nao_encontrada
          venda.statusFiscal = 'pendente';
          venda.fiscalErro = resultado.mensagem;
      }

      StorageService.atualizarVenda(venda);
      this.renderStatusFiscalDisplay();
      return { sucesso: resultado.estado === 'autorizada', estado: resultado.estado, mensagem: resultado.mensagem, venda };
    } finally {
      this._emitindo.delete(venda.id);
    }
  },

  vendasPendentesFiscal() {
    if (!this.fiscalAtivo()) return [];
    return (StorageService.getVendas() || []).filter(v => v && v.statusFiscal === 'pendente');
  },

  // Reenvia as vendas pendentes (sem internet na hora, Focus fora do ar).
  async processarFilaFiscal() {
    if (this._processandoFila) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const pendentes = this.vendasPendentesFiscal();
    if (pendentes.length === 0) return;

    this._processandoFila = true;
    let autorizadas = 0;
    try {
      for (const v of pendentes) {
        const r = await this.emitirNFCe(v);
        if (r.estado === 'autorizada') autorizadas++;
        if (r.estado === 'erro_rede' || r.estado === 'erro_config') break; // sem rede ou token errado: não adianta insistir agora
      }
    } finally {
      this._processandoFila = false;
    }
    if (autorizadas > 0 && window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`🏛️ ${autorizadas} NFC-e pendente(s) autorizada(s) com sucesso.`, 'success');
    }
    this.renderStatusFiscalDisplay();
  },

  async consultarNFCe(venda) {
    const ref = venda.fiscalRef || refDaVenda(venda);
    const resp = await this._requisicaoFocus('GET', `/v2/nfce/${encodeURIComponent(ref)}`);
    const r = interpretarRespostaFocus(resp.status, resp.body);
    if (r.estado === 'autorizada') {
      this._aplicarAutorizacao(venda, r.dados);
      StorageService.atualizarVenda(venda);
    } else if (r.estado === 'cancelada') {
      this._aplicarAutorizacao(venda, r.dados);
      venda.statusFiscal = 'cancelada';
      StorageService.atualizarVenda(venda);
    }
    return r;
  },

  podeCancelar(venda) {
    return podeCancelarNFCe(venda);
  },

  /**
   * Cancela a NFC-e autorizada (até 30 min). A venda continua registrada no
   * caixa; só o documento fiscal é cancelado.
   */
  async cancelarNFCe(venda, justificativa) {
    const just = String(justificativa || '').trim();
    if (just.length < 15) return { sucesso: false, mensagem: 'A justificativa precisa ter no mínimo 15 caracteres.' };
    if (!podeCancelarNFCe(venda)) return { sucesso: false, mensagem: 'Esta NFC-e não pode mais ser cancelada (prazo de 30 minutos ou nota não autorizada).' };

    const ref = venda.fiscalRef || refDaVenda(venda);
    const resp = await this._requisicaoFocus('DELETE', `/v2/nfce/${encodeURIComponent(ref)}`, { justificativa: just.slice(0, 255) });
    const b = resp.body || {};

    if (resp.status >= 200 && resp.status < 300 && b.status === 'cancelado') {
      venda.statusFiscal = 'cancelada';
      venda.protocoloCancelamentoNfce = b.numero_protocolo || '';
      venda.caminhoXmlCancelamentoNfce = b.caminho_xml_cancelamento || '';
      venda.dataCancelamentoNfce = new Date().toISOString();
      venda.justificativaCancelamentoNfce = just;
      StorageService.atualizarVenda(venda);
      AuditModule.registrarLog('cancelamento_nfce', `NFC-e nº ${venda.numeroNfce} cancelada na SEFAZ. Motivo: ${just}`, {
        vendaId: venda.id, chaveAcesso: venda.chaveNfe, protocolo: venda.protocoloCancelamentoNfce
      });
      return { sucesso: true, mensagem: 'NFC-e cancelada na SEFAZ.' };
    }

    if (b.codigo === 'already_processed') {
      venda.statusFiscal = 'cancelada';
      StorageService.atualizarVenda(venda);
      return { sucesso: true, mensagem: 'A NFC-e já estava cancelada.' };
    }

    const msg = b.mensagem_sefaz || b.mensagem || (resp.status === 0 ? 'Sem conexão com a Focus NFe.' : `HTTP ${resp.status}`);
    return { sucesso: false, mensagem: msg };
  },

  urlDanfe(venda) {
    if (!venda || !venda.caminhoDanfeNfce) return '';
    const cfg = { ambiente: venda.ambiente || this.getFiscalConfig().ambiente };
    return this._baseUrl(cfg) + venda.caminhoDanfeNfce;
  },

  urlXml(venda) {
    if (!venda || !venda.caminhoXmlNfce) return '';
    const cfg = { ambiente: venda.ambiente || this.getFiscalConfig().ambiente };
    return this._baseUrl(cfg) + venda.caminhoXmlNfce;
  },

  abrirDanfe(venda) {
    const url = this.urlDanfe(venda);
    if (!url) {
      window.App.showToast('Esta venda não tem DANFE disponível.', 'info');
      return;
    }
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') window.electronAPI.openExternal(url);
    else window.open(url, '_blank');
  },

  // ---------------------------------------------------------------------
  // Ações do histórico de vendas
  // ---------------------------------------------------------------------

  rotuloStatusFiscal(venda) {
    if (!venda) return '';
    switch (venda.statusFiscal) {
      case 'autorizada': return `<span style="display:inline-block;background:#dcfce7;color:#15803d;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">🏛️ NFC-e Nº ${venda.numeroNfce || '-'} AUTORIZADA${venda.ambiente === 'homologacao' ? ' (HOMOLOG.)' : ''}</span>`;
      case 'cancelada': return `<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">🏛️ NFC-e Nº ${venda.numeroNfce || '-'} CANCELADA</span>`;
      case 'pendente': return `<span style="display:inline-block;background:#fef3c7;color:#b45309;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">⏳ NFC-e PENDENTE (aguardando envio)</span>`;
      case 'manual': return `<span style="display:inline-block;background:#e0f2fe;color:#0369a1;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">🧾 NFC-e NÃO EMITIDA (emissão manual)</span>`;
      case 'rejeitada':
      case 'erro': return `<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">❌ NFC-e REJEITADA</span>`;
      default: return '';
    }
  },

  htmlBlocoFiscalVenda(venda) {
    if (!venda || !venda.statusFiscal) return '';
    const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const botoes = [];
    if (venda.statusFiscal === 'manual') {
      botoes.push(`<button type="button" class="btn-primary-action" style="height:34px;font-size:12px;background:#0284c7;color:#fff;" onclick="FiscalModule.reemitirVendaSelecionada()">🏛️ Emitir NFC-e</button>`);
    } else if (venda.statusFiscal === 'pendente' || venda.statusFiscal === 'rejeitada' || venda.statusFiscal === 'erro') {
      botoes.push(`<button type="button" class="btn-primary-action" style="height:34px;font-size:12px;background:#0284c7;color:#fff;" onclick="FiscalModule.reemitirVendaSelecionada()">🔁 Reemitir NFC-e</button>`);
    }
    if (venda.statusFiscal === 'autorizada' || venda.statusFiscal === 'cancelada') {
      if (venda.caminhoDanfeNfce) botoes.push(`<button type="button" class="btn-primary-action" style="height:34px;font-size:12px;background:#f1f5f9;color:var(--text-main);border:1px solid #cbd5e1;" onclick="FiscalModule.abrirDanfeVendaSelecionada()">📄 Abrir DANFE</button>`);
      botoes.push(`<button type="button" class="btn-primary-action" style="height:34px;font-size:12px;background:#f1f5f9;color:var(--text-main);border:1px solid #cbd5e1;" onclick="FiscalModule.consultarVendaSelecionada()">🔎 Consultar na SEFAZ</button>`);
    }
    if (podeCancelarNFCe(venda)) {
      botoes.push(`<button type="button" class="btn-primary-action" style="height:34px;font-size:12px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;" onclick="FiscalModule.cancelarNfceVendaSelecionada()">🚫 Cancelar NFC-e</button>`);
    }

    return `
      <div style="background:#f8fafc;border:1px solid var(--border-card);border-radius:var(--radius-md);padding:12px;margin-bottom:14px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div>${this.rotuloStatusFiscal(venda)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${botoes.join('')}</div>
        </div>
        ${venda.chaveNfe ? `<div style="margin-top:8px;font-family:'JetBrains Mono';font-size:11px;color:var(--text-dim);word-break:break-all;">Chave: ${esc(venda.chaveNfe)}</div>` : ''}
        ${venda.protocoloNfe ? `<div style="font-size:11px;color:var(--text-dim);">Protocolo: ${esc(venda.protocoloNfe)}${venda.dataAutorizacaoNfce ? ' em ' + new Date(venda.dataAutorizacaoNfce).toLocaleString('pt-BR') : ''}</div>` : ''}
        ${venda.statusFiscal === 'cancelada' && venda.justificativaCancelamentoNfce ? `<div style="font-size:11px;color:#b91c1c;margin-top:4px;">Cancelamento: ${esc(venda.justificativaCancelamentoNfce)}</div>` : ''}
        ${(venda.statusFiscal === 'rejeitada' || venda.statusFiscal === 'erro' || venda.statusFiscal === 'pendente') && venda.fiscalErro ? `<div style="margin-top:6px;color:#b91c1c;font-weight:700;">${esc(venda.fiscalErro)}</div>` : ''}
      </div>`;
  },

  _vendaSelecionada() {
    return window.CaixaModule && window.CaixaModule.vendaDetalheSelecionada;
  },

  async reemitirVendaSelecionada() {
    const venda = this._vendaSelecionada();
    if (!venda) return;
    window.App.showToast('⏳ Enviando NFC-e para a SEFAZ...', 'info');
    const r = await this.emitirNFCe(venda);
    window.App.showToast(r.sucesso ? '✅ NFC-e autorizada!' : '❌ ' + r.mensagem, r.sucesso ? 'success' : 'error');
    if (window.CaixaModule && typeof window.CaixaModule.abrirDetalhesVenda === 'function') window.CaixaModule.abrirDetalhesVenda(venda.id);
  },

  async consultarVendaSelecionada() {
    const venda = this._vendaSelecionada();
    if (!venda) return;
    const r = await this.consultarNFCe(venda);
    window.App.showToast(`SEFAZ: ${r.estado} - ${r.mensagem}`, r.estado === 'autorizada' ? 'success' : 'info');
    if (window.CaixaModule && typeof window.CaixaModule.abrirDetalhesVenda === 'function') window.CaixaModule.abrirDetalhesVenda(venda.id);
  },

  abrirDanfeVendaSelecionada() {
    const venda = this._vendaSelecionada();
    if (venda) this.abrirDanfe(venda);
  },

  cancelarNfceVendaSelecionada() {
    const venda = this._vendaSelecionada();
    if (!venda) return;
    const executar = async () => {
      const just = window.prompt('Justificativa do cancelamento da NFC-e (mínimo 15 caracteres):', 'Cancelamento solicitado pelo cliente no caixa');
      if (just == null) return;
      window.App.showToast('⏳ Cancelando NFC-e na SEFAZ...', 'info');
      const r = await this.cancelarNFCe(venda, just);
      window.App.showToast((r.sucesso ? '✅ ' : '❌ ') + r.mensagem, r.sucesso ? 'success' : 'error');
      if (window.CaixaModule && typeof window.CaixaModule.abrirDetalhesVenda === 'function') window.CaixaModule.abrirDetalhesVenda(venda.id);
    };
    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('cancelarVenda', executar, 'Autorização: Cancelar NFC-e');
    } else {
      executar();
    }
  }
};
