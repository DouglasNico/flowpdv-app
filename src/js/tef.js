/**
 * tef.js - TEF integrado: Stone Connect (API), SiTef (CliSiTef via DLL) e
 * um simulador explícito para demonstração.
 *
 * Fluxo no PDV: PdvModule chama iniciarTransacao({valor, tipo, parcelas}) e
 * recebe uma Promise com os dados da autorização (nsu, autorizacao, bandeira,
 * comprovantes). Rejeita quando recusado/cancelado.
 */

import { StorageService } from './storage.js';
import { AuditModule } from './audit.js';
import {
  STONE_API,
  STONE_TIMEOUT_MS,
  STONE_POLL_MS,
  montarPedidoStone,
  interpretarPedidoStone,
  mensagemErroStone,
  funcaoSitef,
  valorSitef,
  parseMenuSitef,
  interpretarCamposSitef,
  mensagemRetornoSitef,
  mensagemConfiguraSitef
} from './tef-core.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const TefModule = {
  transacaoAtiva: null,
  temporizador: null,
  segundosRestantes: 0,
  resolverPromessa: null,
  rejeitarPromessa: null,
  _cancelarStone: false,
  _sitefConfigurado: false,
  _sitefOuvindo: false,
  _eventoSitefAtual: null,

  init() {
    this._ouvirEventosSitef();
  },

  getConfig() {
    return StorageService.getTefConfig();
  },

  provedor() {
    const cfg = this.getConfig();
    const p = cfg.provedor || 'simulador';
    // Provedores antigos (paygo, pagbank, cielo) eram só simulação.
    return ['stone', 'sitef', 'simulador'].includes(p) ? p : 'simulador';
  },

  tefAtivo() {
    const cfg = this.getConfig();
    return StorageService.isModuloAtivo('tefCartao') && cfg && cfg.habilitado === true;
  },

  abrirModalConfig() {
    if (window.FiscalModule && typeof window.FiscalModule.abrirModalConfigTef === 'function') {
      window.FiscalModule.abrirModalConfigTef();
    }
  },

  fecharModalConfig() {
    if (window.FiscalModule && typeof window.FiscalModule.fecharModalConfigTef === 'function') {
      window.FiscalModule.fecharModalConfigTef();
    }
  },

  // ---------------------------------------------------------------------
  // Modal de processamento (comum a todos os provedores)
  // ---------------------------------------------------------------------

  _abrirModal(params, opcoes = {}) {
    const modal = document.getElementById('modal-tef-processamento');
    if (!modal) return false;

    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('tef-modal-valor', `R$ ${(Number(params.valor) || 0).toFixed(2).replace('.', ',')}`);
    set('tef-modal-tipo', `${params.tipo || 'Cartão'}${params.parcelas > 1 ? ` em ${params.parcelas}x` : ''} · ${opcoes.rotuloProvedor || ''}`);
    this._status('Iniciando transação...', 'Aguarde.', '📲');

    const demo = document.getElementById('tef-modal-painel-demo');
    if (demo) demo.style.display = opcoes.mostrarDemo ? 'block' : 'none';
    const interacao = document.getElementById('tef-modal-interacao');
    if (interacao) { interacao.style.display = 'none'; interacao.innerHTML = ''; }
    const visorCliente = document.getElementById('tef-modal-visor-cliente');
    if (visorCliente) visorCliente.textContent = '';

    const timerEl = document.getElementById('tef-modal-timer');
    if (this.temporizador) clearInterval(this.temporizador);
    if (opcoes.segundos > 0) {
      this.segundosRestantes = opcoes.segundos;
      if (timerEl) { timerEl.style.display = ''; timerEl.textContent = `${this.segundosRestantes}s`; }
      this.temporizador = setInterval(() => {
        this.segundosRestantes--;
        if (timerEl) timerEl.textContent = `${Math.max(0, this.segundosRestantes)}s`;
        if (this.segundosRestantes <= 0) {
          clearInterval(this.temporizador);
          if (typeof opcoes.aoExpirar === 'function') opcoes.aoExpirar();
        }
      }, 1000);
    } else if (timerEl) {
      timerEl.style.display = 'none';
    }

    modal.classList.add('active');
    document.body.classList.add('modal-open');
    return true;
  },

  _status(titulo, detalhe, icone) {
    const statusEl = document.getElementById('tef-modal-status-text');
    const stepEl = document.getElementById('tef-modal-passo-instrucao');
    const iconeEl = document.getElementById('tef-modal-icone-status');
    if (statusEl && titulo != null) statusEl.textContent = titulo;
    if (stepEl && detalhe != null) stepEl.textContent = detalhe;
    if (iconeEl && icone) iconeEl.innerHTML = icone;
  },

  fecharModalTef() {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    const modal = document.getElementById('modal-tef-processamento');
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  },

  _concluir(dados) {
    if (this.temporizador) clearInterval(this.temporizador);
    this._status('Transação aprovada!', `${dados.bandeira || dados.rede || ''} · NSU ${dados.nsu || '-'}`.trim(), '✅');
    AuditModule.registrarLog('tef_aprovado', `TEF ${dados.provedor || ''} aprovado: R$ ${(Number(dados.valor) || 0).toFixed(2)} ${dados.tipo || ''} NSU ${dados.nsu || ''}`, {
      provedor: dados.provedor, nsu: dados.nsu, autorizacao: dados.autorizacao, valor: dados.valor
    });
    setTimeout(() => {
      this.fecharModalTef();
      const r = this.resolverPromessa;
      this.resolverPromessa = null;
      this.rejeitarPromessa = null;
      this.transacaoAtiva = null;
      if (r) r(dados);
    }, 900);
  },

  _falhar(motivo, silencioso = false) {
    if (this.temporizador) clearInterval(this.temporizador);
    this._status('Transação não concluída', motivo, '❌');
    setTimeout(() => {
      this.fecharModalTef();
      const rej = this.rejeitarPromessa;
      this.resolverPromessa = null;
      this.rejeitarPromessa = null;
      this.transacaoAtiva = null;
      if (rej) rej(new Error(motivo));
      if (!silencioso && window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`❌ TEF: ${motivo}`, 'error');
      }
    }, 1300);
  },

  // ---------------------------------------------------------------------
  // Entrada única usada pelo PDV
  // ---------------------------------------------------------------------

  /**
   * @param params { valor, tipo: 'Débito'|'Crédito'|'Pix'|'Voucher', parcelas?, itens?, descricao? }
   * @returns {Promise<Object>} dados da autorização
   */
  iniciarTransacao(params) {
    return new Promise((resolve, reject) => {
      if (this.transacaoAtiva) {
        reject(new Error('Já existe uma transação TEF em andamento.'));
        return;
      }
      this.resolverPromessa = resolve;
      this.rejeitarPromessa = reject;
      this.transacaoAtiva = {
        id: 'TEF-' + Date.now().toString(36).toUpperCase(),
        valor: Number(params.valor) || 0,
        tipo: params.tipo || 'Crédito',
        parcelas: Math.max(1, parseInt(params.parcelas, 10) || 1),
        status: 'processando',
        dataHora: new Date().toISOString()
      };

      const provedor = this.provedor();
      if (provedor === 'stone') this._executarStone(params);
      else if (provedor === 'sitef') this._executarSitef(params);
      else this._executarSimulador(params);
    });
  },

  cancelarPeloOperador() {
    const provedor = this.provedor();
    if (provedor === 'stone') {
      this._cancelarStone = true;
      this._status('Cancelando pedido na Stone...', 'Aguarde a confirmação.', '⏳');
      return;
    }
    if (provedor === 'sitef') {
      this._status('Cancelando no SiTef...', 'Aguarde a confirmação do pinpad.', '⏳');
      if (window.electronAPI && typeof window.electronAPI.sitefCancelar === 'function') window.electronAPI.sitefCancelar();
      return;
    }
    this._falhar('Cancelado pelo operador no caixa.', true);
  },

  // ---------------------------------------------------------------------
  // Simulador (modo demonstração explícito)
  // ---------------------------------------------------------------------

  _executarSimulador(params) {
    const aberto = this._abrirModal(params, {
      rotuloProvedor: 'SIMULADOR',
      mostrarDemo: true,
      segundos: 45,
      aoExpirar: () => this._falhar('Tempo limite excedido na maquininha (simulação).')
    });
    if (!aberto) {
      this._falhar('Tela do TEF indisponível.');
      return;
    }
    this._status('Modo demonstração', 'Nenhuma maquininha real está conectada. Use os botões abaixo para simular.', '🧪');
  },

  // Botões do painel de demonstração
  aprovarTransacao(bandeira = 'Mastercard') {
    if (this.provedor() !== 'simulador' || !this.transacaoAtiva) return;
    const t = this.transacaoAtiva;
    const nsu = String(Math.floor(100000 + Math.random() * 900000));
    const aut = 'SIM' + Math.floor(10000 + Math.random() * 90000);
    this._concluir({
      sucesso: true,
      provedor: 'simulador',
      nsu,
      autorizacao: aut,
      bandeira,
      rede: 'SIMULADOR (sem valor)',
      tipo: t.tipo,
      parcelas: t.parcelas,
      valor: t.valor,
      comprovanteLoja: `*** SIMULACAO - SEM VALOR ***\nVENDA ${String(t.tipo).toUpperCase()}\nVALOR: R$ ${t.valor.toFixed(2)}\nNSU: ${nsu}  AUT: ${aut}`,
      comprovanteCliente: `*** SIMULACAO - SEM VALOR ***\nVALOR: R$ ${t.valor.toFixed(2)}\nNSU: ${nsu}`,
      dataHora: new Date().toISOString()
    });
  },

  rejeitarTransacao(motivo = 'Transação recusada (simulação).') {
    if (this.provedor() !== 'simulador' || !this.transacaoAtiva) return;
    this._falhar(motivo);
  },

  // ---------------------------------------------------------------------
  // Stone Connect 2.0 (pedido na API Pagar.me -> maquininha Stone)
  // ---------------------------------------------------------------------

  async _httpStone(metodo, caminho, body) {
    const cfg = this.getConfig();
    const headers = {};
    if (cfg.stoneServiceRefererName) headers['ServiceRefererName'] = String(cfg.stoneServiceRefererName).trim();
    const req = { method: metodo, url: STONE_API + caminho, token: String(cfg.stoneSecretKey || '').trim(), body, headers, timeoutMs: 30000 };

    if (window.electronAPI && typeof window.electronAPI.httpJson === 'function') {
      return window.electronAPI.httpJson(req);
    }
    try {
      const resp = await fetch(req.url, {
        method: metodo,
        headers: { 'Authorization': 'Basic ' + btoa(req.token + ':'), 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined
      });
      let json = null;
      try { json = await resp.json(); } catch (e) { json = null; }
      return { status: resp.status, body: json };
    } catch (err) {
      return { status: 0, body: { mensagem: err.message } };
    }
  },

  async _executarStone(params) {
    const cfg = this.getConfig();
    if (!cfg.stoneSecretKey) {
      this._abrirModal(params, { rotuloProvedor: 'STONE' });
      this._falhar('Chave secreta da Stone não configurada.');
      return;
    }

    this._cancelarStone = false;
    this._abrirModal(params, {
      rotuloProvedor: 'STONE CONNECT',
      segundos: Math.round(STONE_TIMEOUT_MS / 1000),
      aoExpirar: () => { this._cancelarStone = true; }
    });

    let pedido;
    try {
      pedido = montarPedidoStone({
        valor: params.valor,
        tipo: params.tipo,
        parcelas: this.transacaoAtiva.parcelas,
        itens: params.itens,
        descricao: params.descricao || 'FlowPDV',
        codigo: this.transacaoAtiva.id
      }, {
        serialMaquininha: cfg.stoneSerial,
        recipientId: cfg.stoneRecipientId,
        imprimirNaMaquininha: cfg.stoneImprimirNaMaquininha !== false
      });
    } catch (err) {
      this._falhar(err.message);
      return;
    }

    this._status('Enviando pedido à maquininha Stone...', 'A maquininha vai abrir a tela de pagamento sozinha.', '📡');
    const criado = await this._httpStone('POST', '/core/v5/orders/', pedido);
    if (criado.status < 200 || criado.status >= 300 || !criado.body || !criado.body.id) {
      this._falhar(mensagemErroStone(criado.status, criado.body));
      return;
    }

    const orderId = criado.body.id;
    this.transacaoAtiva.pedidoId = orderId;
    let resultado = interpretarPedidoStone(criado.body);
    this._status('Aguardando o cliente na maquininha...', `Pedido ${orderId} enviado${cfg.stoneSerial ? ' para o terminal ' + cfg.stoneSerial : ''}.`, '💳');

    const inicio = Date.now();
    while (resultado.estado === 'aguardando') {
      if (this._cancelarStone || (Date.now() - inicio) > STONE_TIMEOUT_MS) {
        await this._httpStone('PATCH', `/core/v5/orders/${orderId}/closed`, { status: 'canceled' });
        this._falhar(this._cancelarStone ? 'Cancelado pelo operador no caixa.' : 'Tempo esgotado aguardando a maquininha.', this._cancelarStone);
        return;
      }
      await new Promise(r => setTimeout(r, STONE_POLL_MS));
      if (!this.transacaoAtiva) return;
      const consulta = await this._httpStone('GET', `/core/v5/orders/${orderId}`);
      if (consulta.status >= 200 && consulta.status < 300 && consulta.body) {
        resultado = interpretarPedidoStone(consulta.body);
      } else if (consulta.status === 401 || consulta.status === 403) {
        this._falhar(mensagemErroStone(consulta.status, consulta.body));
        return;
      }
    }

    if (resultado.estado === 'aprovada') {
      // Fecha o pedido para ele sair da fila da maquininha.
      this._httpStone('PATCH', `/core/v5/orders/${orderId}/closed`, { status: 'paid' }).catch(() => {});
      const dados = { ...resultado.dados, tipo: resultado.dados.tipo || this.transacaoAtiva.tipo, parcelas: this.transacaoAtiva.parcelas };
      if (!dados.valor) dados.valor = this.transacaoAtiva.valor;
      this._concluir(dados);
      return;
    }

    this._httpStone('PATCH', `/core/v5/orders/${orderId}/closed`, { status: 'canceled' }).catch(() => {});
    this._falhar(resultado.mensagem || 'Pagamento não aprovado.');
  },

  async testarStone(cfgTeste) {
    const cfg = cfgTeste || this.getConfig();
    const anterior = this.getConfig();
    // Usa a config da tela sem salvar.
    const salvo = StorageService.getTefConfig;
    StorageService.getTefConfig = () => ({ ...anterior, ...cfg });
    try {
      const r = await this._httpStone('GET', '/core/v5/orders?size=1');
      if (r.status >= 200 && r.status < 300) return { ok: true, mensagem: 'Chave Stone válida. API respondendo.' };
      return { ok: false, mensagem: mensagemErroStone(r.status, r.body) };
    } finally {
      StorageService.getTefConfig = salvo;
    }
  },

  // ---------------------------------------------------------------------
  // SiTef (CliSiTefI.dll via processo principal)
  // ---------------------------------------------------------------------

  _sitefDisponivel() {
    return Boolean(window.electronAPI && typeof window.electronAPI.sitefExecutar === 'function');
  },

  async configurarSitef(cfgTeste) {
    if (!this._sitefDisponivel()) return { ok: false, mensagem: 'SiTef só funciona no FlowPDV instalado (Windows).' };
    const cfg = cfgTeste || this.getConfig();
    const r = await window.electronAPI.sitefConfigurar({
      caminhoDll: cfg.sitefCaminhoDll,
      ipServidor: cfg.sitefIp,
      codigoLoja: cfg.sitefLoja,
      codigoTerminal: cfg.sitefTerminal,
      parametrosAdicionais: cfg.sitefParametros || ''
    });
    this._sitefConfigurado = Boolean(r && r.ok);
    if (r && r.ok) return { ok: true, mensagem: 'CliSiTef configurada.' };
    return { ok: false, mensagem: (r && r.erro) || mensagemConfiguraSitef(r && r.codigo) };
  },

  async testarSitef(cfgTeste) {
    const conf = await this.configurarSitef(cfgTeste);
    if (!conf.ok) return conf;
    let pinpad = false;
    try { pinpad = await window.electronAPI.sitefPinpadPresente(); } catch (e) {}
    return { ok: true, mensagem: pinpad ? 'CliSiTef configurada e pinpad detectado.' : 'CliSiTef configurada. Pinpad não detectado (confira o cabo/porta).' };
  },

  _ouvirEventosSitef() {
    if (this._sitefOuvindo || !window.electronAPI || typeof window.electronAPI.onSitefEvento !== 'function') return;
    this._sitefOuvindo = true;
    window.electronAPI.onSitefEvento((ev) => this._tratarEventoSitef(ev));
  },

  _responderSitef(id, buffer, continua = 0, cancelar = false) {
    this._eventoSitefAtual = null;
    const interacao = document.getElementById('tef-modal-interacao');
    if (interacao) { interacao.style.display = 'none'; interacao.innerHTML = ''; }
    if (window.electronAPI && typeof window.electronAPI.sitefResponder === 'function') {
      window.electronAPI.sitefResponder({ id, buffer: String(buffer ?? ''), continua, cancelar });
    }
  },

  _tratarEventoSitef(ev) {
    if (!ev || !this.transacaoAtiva) {
      if (ev && ev.id) this._responderSitef(ev.id, '', -1, true);
      return;
    }
    const visorCliente = document.getElementById('tef-modal-visor-cliente');
    const texto = String(ev.texto || '').trim();

    switch (ev.comando) {
      case 1: this._status(texto || null, null, null); return;
      case 2: if (visorCliente) visorCliente.textContent = texto; return;
      case 3: this._status(texto || null, null, null); if (visorCliente) visorCliente.textContent = texto; return;
      case 4: this._sitefTituloMenu = texto; return;
      case 11: case 13: this._status(null, '', null); if (ev.comando === 13 && visorCliente) visorCliente.textContent = ''; return;
      case 12: if (visorCliente) visorCliente.textContent = ''; return;
      case 14: this._sitefTituloMenu = ''; return;
      case 15: this._status(null, texto, null); return;
      case 16: this._status(null, '', null); return;
      case 20: this._sitefPerguntaSimNao(ev); return;
      case 21: case 42: this._sitefMenu(ev); return;
      case 22: this._sitefAviso(ev); return;
      case 29: this._sitefCampoAutomatico(ev); return;
      case 30: case 31: case 34: case 35: case 41: this._sitefColeta(ev); return;
      default:
        if (ev.id) this._responderSitef(ev.id, '', 0);
    }
  },

  _sitefCaixa(html) {
    const box = document.getElementById('tef-modal-interacao');
    if (!box) return null;
    box.innerHTML = html;
    box.style.display = 'block';
    return box;
  },

  _sitefPerguntaSimNao(ev) {
    this._eventoSitefAtual = ev;
    this._sitefCaixa(`
      <div style="font-weight:700;margin-bottom:8px;">${esc(ev.texto)}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button type="button" class="btn-primary-action" style="height:38px;background:#059669;color:#fff;" onclick="TefModule._responderSitef(${ev.id}, '0')">✅ Sim</button>
        <button type="button" class="btn-primary-action" style="height:38px;background:#f1f5f9;color:var(--text-main);border:1px solid #cbd5e1;" onclick="TefModule._responderSitef(${ev.id}, '1')">✖ Não</button>
      </div>`);
  },

  _sitefMenu(ev) {
    this._eventoSitefAtual = ev;
    const opcoes = parseMenuSitef(ev.texto);
    this._sitefCaixa(`
      <div style="font-weight:700;margin-bottom:8px;">${esc(this._sitefTituloMenu || 'Escolha uma opção')}</div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;">
        ${opcoes.map(o => `<button type="button" class="btn-primary-action" style="height:36px;justify-content:flex-start;background:#eef2ff;color:#312e81;border:1px solid #c7d2fe;" onclick="TefModule._responderSitef(${ev.id}, '${esc(o.indice)}')">${esc(o.indice)}. ${esc(o.texto)}</button>`).join('')}
      </div>
      <button type="button" class="btn-primary-action" style="height:34px;margin-top:8px;background:#f1f5f9;color:var(--text-main);border:1px solid #cbd5e1;" onclick="TefModule._responderSitef(${ev.id}, '', -1, true)">Cancelar</button>`);
  },

  _sitefAviso(ev) {
    this._eventoSitefAtual = ev;
    this._sitefCaixa(`
      <div style="font-weight:700;margin-bottom:8px;">${esc(ev.texto)}</div>
      <button type="button" class="btn-primary-action" style="height:38px;background:#0284c7;color:#fff;" onclick="TefModule._responderSitef(${ev.id}, '')">OK</button>`);
  },

  _sitefCampoAutomatico(ev) {
    // Campo que a automação pode responder sem o operador (ex.: parcelas).
    const t = this.transacaoAtiva || {};
    let valor = '';
    if ([505, 506].includes(ev.tipoCampo)) valor = String(t.parcelas || 1);
    this._responderSitef(ev.id, valor, 0);
  },

  _sitefColeta(ev) {
    this._eventoSitefAtual = ev;
    const t = this.transacaoAtiva || {};
    const mascarado = ev.comando === 41;
    const monetario = ev.comando === 34;
    // Quantidade de parcelas já combinada no caixa.
    const sugestao = [505, 506].includes(ev.tipoCampo) ? String(t.parcelas || 1) : '';
    const rotulo = ev.texto || (monetario ? 'Informe o valor' : 'Informe o campo solicitado');
    const idInput = `tef-sitef-campo-${ev.id}`;
    this._sitefCaixa(`
      <div style="font-weight:700;margin-bottom:6px;">${esc(rotulo)}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">${ev.tamMin || 0} a ${ev.tamMax || '?'} caracteres</div>
      <input id="${idInput}" type="${mascarado ? 'password' : 'text'}" class="form-input-custom" value="${esc(sugestao)}" maxlength="${ev.tamMax || 200}" style="text-align:center;font-family:'JetBrains Mono';font-weight:700;margin-bottom:8px;" onkeydown="if(event.key==='Enter'){TefModule._confirmarColetaSitef(${ev.id}, '${idInput}', ${ev.comando})}">
      <div style="display:flex;gap:8px;justify-content:center;">
        <button type="button" class="btn-primary-action" style="height:38px;background:#059669;color:#fff;" onclick="TefModule._confirmarColetaSitef(${ev.id}, '${idInput}', ${ev.comando})">Confirmar</button>
        <button type="button" class="btn-primary-action" style="height:38px;background:#f1f5f9;color:var(--text-main);border:1px solid #cbd5e1;" onclick="TefModule._responderSitef(${ev.id}, '', -1, true)">Cancelar</button>
      </div>`);
    setTimeout(() => document.getElementById(idInput)?.focus(), 50);
  },

  _confirmarColetaSitef(id, idInput, comando) {
    const el = document.getElementById(idInput);
    let v = (el ? el.value : '').trim();
    if (comando === 35 && v) v = '0:' + v;          // código de barras digitado
    if (comando === 31 && v) v = '0:' + v;          // cheque: primeira linha digitada
    this._responderSitef(id, v, 0);
  },

  async _executarSitef(params) {
    if (!this._sitefDisponivel()) {
      this._abrirModal(params, { rotuloProvedor: 'SITEF' });
      this._falhar('SiTef só funciona no FlowPDV instalado (Windows).');
      return;
    }
    this._ouvirEventosSitef();
    this._abrirModal(params, { rotuloProvedor: 'SITEF' });

    if (!this._sitefConfigurado) {
      this._status('Conectando à CliSiTef...', 'Carregando a DLL e configurando loja/terminal.', '⏳');
      const conf = await this.configurarSitef();
      if (!conf.ok) { this._falhar(conf.mensagem); return; }
    }

    const agora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dataFiscal = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}`;
    const horaFiscal = `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
    const cupomFiscal = String(Date.now()); // sempre crescente, exigência da CliSiTef
    const operador = (window.AuthModule && window.AuthModule.usuarioAtual && window.AuthModule.usuarioAtual.nome) || 'CAIXA';
    const t = this.transacaoAtiva;
    t.sitef = { cupomFiscal, dataFiscal, horaFiscal };

    // Parcelamento decidido no caixa: já restringe o menu da CliSiTef.
    let paramAdic = '';
    if (funcaoSitef(t.tipo) === 3 && t.parcelas > 1) paramAdic = `[ParcelasAdmin=${t.parcelas}]`;

    this._status('Siga as instruções do pinpad...', 'Peça ao cliente para inserir ou aproximar o cartão.', '💳');
    const r = await window.electronAPI.sitefExecutar({
      funcao: funcaoSitef(t.tipo),
      valor: valorSitef(t.valor),
      cupomFiscal, dataFiscal, horaFiscal,
      operador: String(operador).slice(0, 20),
      paramAdic
    });

    if (!this.transacaoAtiva) return;

    if (!r || r.retorno !== 0) {
      const motivo = (r && r.erro) || mensagemRetornoSitef(r ? r.retorno : -100);
      if (r && r.campos && Object.keys(r.campos).length && window.electronAPI.sitefFinalizar) {
        window.electronAPI.sitefFinalizar({ confirma: false, cupomFiscal, dataFiscal, horaFiscal });
      }
      this._falhar(motivo, Boolean(r && r.cancelado));
      return;
    }

    const dados = interpretarCamposSitef(r.campos, { tipo: t.tipo, parcelas: t.parcelas, valor: t.valor });
    dados.cupomFiscalTef = cupomFiscal;

    // Imprime os comprovantes e só então confirma a transação no SiTef.
    let impressaoOk = true;
    try {
      if (window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirComprovanteTef === 'function') {
        if (dados.comprovanteLoja) window.ThermalPrintModule.imprimirComprovanteTef(dados.comprovanteLoja, 'VIA ESTABELECIMENTO');
        if (dados.comprovanteCliente) window.ThermalPrintModule.imprimirComprovanteTef(dados.comprovanteCliente, 'VIA CLIENTE');
      }
    } catch (e) {
      impressaoOk = false;
      console.warn('[TEF] Falha ao imprimir comprovante SiTef:', e);
    }
    window.electronAPI.sitefFinalizar({ confirma: impressaoOk, cupomFiscal, dataFiscal, horaFiscal });
    if (!impressaoOk) { this._falhar('Comprovante não impresso; transação desfeita no SiTef.'); return; }

    this._concluir(dados);
  },

  // Menu administrativo do SiTef (cancelamento, reimpressão, pendências).
  async abrirMenuAdministrativoSitef() {
    if (this.provedor() !== 'sitef') {
      window.App.showToast('O menu administrativo é do SiTef. Selecione SiTef como provedor.', 'info');
      return;
    }
    if (this.transacaoAtiva) { window.App.showToast('Há uma transação em andamento.', 'warning'); return; }
    this._ouvirEventosSitef();
    this.transacaoAtiva = { id: 'ADM-' + Date.now(), valor: 0, tipo: 'Administrativo', parcelas: 1 };
    this.resolverPromessa = () => {};
    this.rejeitarPromessa = () => {};
    this._abrirModal({ valor: 0, tipo: 'Menu administrativo' }, { rotuloProvedor: 'SITEF' });

    if (!this._sitefConfigurado) {
      const conf = await this.configurarSitef();
      if (!conf.ok) { this._falhar(conf.mensagem); return; }
    }
    const agora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dataFiscal = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}`;
    const horaFiscal = `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
    const cupomFiscal = String(Date.now());

    const r = await window.electronAPI.sitefExecutar({ funcao: 110, valor: '', cupomFiscal, dataFiscal, horaFiscal, operador: 'GERENTE', paramAdic: '' });
    if (!r || r.retorno !== 0) {
      this._falhar((r && r.erro) || mensagemRetornoSitef(r ? r.retorno : -100), Boolean(r && r.cancelado));
      return;
    }
    const campos = r.campos || {};
    try {
      if (campos[122]) window.ThermalPrintModule.imprimirComprovanteTef(campos[122], 'VIA ESTABELECIMENTO');
      if (campos[121]) window.ThermalPrintModule.imprimirComprovanteTef(campos[121], 'VIA CLIENTE');
    } catch (e) {}
    window.electronAPI.sitefFinalizar({ confirma: true, cupomFiscal, dataFiscal, horaFiscal });
    this._concluir({ sucesso: true, provedor: 'sitef', nsu: campos[133] || '', rede: 'SiTef', tipo: 'Administrativo', valor: 0 });
  },

  // ---------------------------------------------------------------------
  // Teste pela tela de configuração
  // ---------------------------------------------------------------------

  async testarTefConfig() {
    if (!StorageService.isModuloAtivo('tefCartao')) {
      window.App.showToast('💳 O módulo TEF / Cartão está desativado para esta licença pelo administrador.', 'info');
      return;
    }
    const btn = document.getElementById('btn-testar-tef');
    // Usa o que está na tela de configuração; fora dela, o que está salvo.
    const modalAberto = document.getElementById('modal-config-tef')?.classList.contains('active');
    const salvo = this.getConfig();
    const val = (id, chave) => {
      const v = modalAberto ? (document.getElementById(id)?.value || '').trim() : '';
      return v || salvo[chave] || '';
    };
    const provedor = val('tef-provedor', 'provedor') || 'simulador';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Testando...'; }

    try {
      let r;
      if (provedor === 'stone') {
        r = await this.testarStone({ provedor, stoneSecretKey: val('tef-stone-sk', 'stoneSecretKey'), stoneServiceRefererName: val('tef-stone-referer', 'stoneServiceRefererName') });
      } else if (provedor === 'sitef') {
        r = await this.testarSitef({ provedor, sitefCaminhoDll: val('tef-sitef-dll', 'sitefCaminhoDll'), sitefIp: val('tef-sitef-ip', 'sitefIp'), sitefLoja: val('tef-sitef-loja', 'sitefLoja'), sitefTerminal: val('tef-sitef-terminal', 'sitefTerminal'), sitefParametros: val('tef-sitef-parametros', 'sitefParametros') });
      } else {
        r = { ok: true, mensagem: 'Simulador ativo: nenhuma maquininha real será acionada.' };
      }
      window.App.showToast((r.ok ? '✅ ' : '❌ ') + r.mensagem, r.ok ? 'success' : 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '💳 Testar Conexão com Maquininha'; }
    }
  },

  // ==========================================
  // CAPTURA DE CPF NO PINPAD / MAQUININHA
  // ==========================================
  cpfColetadoDigitos: '',
  resolverPromessaCpf: null,
  rejeitarPromessaCpf: null,

  solicitarCpfPinpad() {
    return new Promise((resolve, reject) => {
      this.resolverPromessaCpf = resolve;
      this.rejeitarPromessaCpf = reject;
      this.cpfColetadoDigitos = '';

      const modal = document.getElementById('modal-tef-coleta-cpf');
      if (!modal) {
        const cpfPrompt = prompt('Digite o CPF do cliente (11 dígitos):');
        if (cpfPrompt) {
          const d = cpfPrompt.replace(/\D/g, '');
          const cpfFmt = d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d;
          resolve({ sucesso: true, cpf: cpfFmt });
        } else {
          resolve({ sucesso: false, motivo: 'Cancelado' });
        }
        return;
      }

      this.atualizarLcdCpfPinpad();
      modal.style.display = 'flex';
      modal.classList.add('active');
    });
  },

  digitarDigitoCpfPinpad(digito) {
    if (this.cpfColetadoDigitos.length < 14) {
      this.cpfColetadoDigitos += String(digito);
      this.atualizarLcdCpfPinpad();
      this.tocarBeepPinpad();
    }
  },

  apagarDigitoCpfPinpad() {
    if (this.cpfColetadoDigitos.length > 0) {
      this.cpfColetadoDigitos = this.cpfColetadoDigitos.slice(0, -1);
      this.atualizarLcdCpfPinpad();
      this.tocarBeepPinpad();
    }
  },

  limparCpfPinpad() {
    this.cpfColetadoDigitos = '';
    this.atualizarLcdCpfPinpad();
    this.tocarBeepPinpad();
  },

  atualizarLcdCpfPinpad() {
    const lcd = document.getElementById('pinpad-lcd-cpf-display');
    if (!lcd) return;

    if (!this.cpfColetadoDigitos) {
      lcd.textContent = '___.___.___-__';
      lcd.style.color = '#34d399';
      return;
    }

    const d = this.cpfColetadoDigitos;
    if (d.length <= 11) {
      let f = '';
      for (let i = 0; i < 11; i++) {
        if (i === 3 || i === 6) f += '.';
        if (i === 9) f += '-';
        f += d[i] ? d[i] : '_';
      }
      lcd.textContent = f;
      lcd.style.color = d.length === 11 ? '#10b981' : '#fbbf24';
    } else {
      let f = '';
      for (let i = 0; i < 14; i++) {
        if (i === 2 || i === 5) f += '.';
        if (i === 8) f += '/';
        if (i === 12) f += '-';
        f += d[i] ? d[i] : '_';
      }
      lcd.textContent = f;
      lcd.style.color = d.length === 14 ? '#10b981' : '#fbbf24';
    }
  },

  confirmarCpfPinpad() {
    const d = this.cpfColetadoDigitos.replace(/\D/g, '');
    if (!d || (d.length !== 11 && d.length !== 14)) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚠️ Digite os 11 dígitos do CPF ou 14 do CNPJ.', 'warning');
      }
      return;
    }

    let cpfFormatado = '';
    if (d.length === 11) {
      cpfFormatado = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      cpfFormatado = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    this.fecharModalCpfPinpad();

    if (this.resolverPromessaCpf) {
      this.resolverPromessaCpf({ sucesso: true, cpf: cpfFormatado });
      this.resolverPromessaCpf = null;
    }

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`✅ CPF ${cpfFormatado} capturado no PINPad!`, 'success');
    }
  },

  recusarCpfPinpad() {
    this.fecharModalCpfPinpad();
    if (this.resolverPromessaCpf) {
      this.resolverPromessaCpf({ sucesso: false, motivo: 'Cliente optou por não informar CPF.' });
      this.resolverPromessaCpf = null;
    }
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('ℹ️ Cliente optou por não informar CPF.', 'info');
    }
  },

  fecharModalCpfPinpad() {
    const modal = document.getElementById('modal-tef-coleta-cpf');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    this.cpfColetadoDigitos = '';
  },

  preencherCpfExemploPinpad(cpfDemo = '12345678909') {
    this.cpfColetadoDigitos = cpfDemo;
    this.atualizarLcdCpfPinpad();
    this.tocarBeepPinpad();
  },

  tocarBeepPinpad() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.06);
    } catch(e) {}
  }
};

window.TefModule = TefModule;
