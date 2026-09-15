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
import { TefLedger, validarConfigIntegracao, valorTefConfere } from './tef-ledger.js';
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
    setTimeout(() => {
      try { if (this.diario().pendentes().length) this.abrirPendencias(); }
      catch (e) { window.App.showToast(e.message, 'error'); }
    }, 1000);
  },

  getConfig() {
    return StorageService.getTefConfig();
  },
  contextoConfiguracao() {
    const c = this.getConfig();
    return JSON.stringify([c.provedor, c.stoneSerial || '', c.stoneRecipientId || '', c.sitefCaminhoDll || '', c.sitefIp || '', c.sitefLoja || '', c.sitefTerminal || '']);
  },
  validarContexto(op) {
    if (op.contexto && op.contexto !== this.contextoConfiguracao()) throw new Error('A configuração mudou desde o pagamento. Restaure a configuração original antes de recuperar o TEF.');
  },

  diario() {
    const loja = StorageService.getLicenca()?.chaveLicenca || 'sem-licenca';
    return new TefLedger(localStorage, `flowpdv_tef_diario_${loja}_${StorageService.getDeviceId()}`);
  },

  temPendencias() { return !!this.transacaoAtiva || !!this._reconciliando || this.diario().pendentes().length > 0; },
  async _exclusivo(acao) {
    if (this.transacaoAtiva || this._reconciliando) throw new Error('Aguarde a operação TEF em andamento.');
    this._reconciliando = true;
    try { return await acao(); } finally { this._reconciliando = false; }
  },
  confirmarVenda(venda) { return this._exclusivo(() => this._confirmarVenda(venda)); },
  cancelarOperacao(id) { return this._exclusivo(() => this._cancelarOperacao(id)); },
  consultarOperacao(id) { return this._exclusivo(() => this._consultarOperacao(id)); },
  vincularPedidoStone(id, pedidoId) {
    return this._exclusivo(async () => {
      if (!window.AuthModule?.isGerente()) throw new Error('Recuperação por identificador restrita ao gerente.');
      const op = this.diario().obter(id);
      if (!op || op.provedor !== 'stone' || !pedidoId || op.pedidoId) throw new Error('Referência inválida ou pedido já vinculado.');
      const r = await this._httpStone('GET', `/core/v5/orders/${encodeURIComponent(pedidoId.trim())}`);
      if (r.status !== 200 || r.body?.code !== op.id || !valorTefConfere(op.valor, Number(r.body.amount) / 100)) {
        throw new Error('O código e o valor do pedido Stone não correspondem à operação local.');
      }
      this.diario().salvar({ id, pedidoId: r.body.id });
      await this._consultarOperacao(id);
    });
  },
  temPagamentoDaVenda(vendaId) { return this.diario().pendentes().some(t => t.vendaId === vendaId); },

  _registrar(patch) {
    if (!this.transacaoAtiva || this.transacaoAtiva.demonstracao || this.transacaoAtiva.administrativa) return;
    this.diario().salvar({ id: this.transacaoAtiva.id, ...patch });
  },

  validarPagamentos(venda) {
    const ids = new Set();
    for (const p of venda.pagamentos || []) {
      if (!p.tefInfo) continue;
      const op = this.diario().obter(p.tefInfo.operacaoId);
      if (ids.has(p.tefInfo.operacaoId)) throw new Error('Pagamento TEF duplicado.');
      ids.add(p.tefInfo.operacaoId);
      if (!op || op.vendaId !== venda.id || !['autorizada', 'confirmando', 'concluida'].includes(op.estado)
          || !valorTefConfere(p.valor, op.dados?.valor) || op.provedor === 'simulador') {
        throw new Error('Pagamento integrado não confirmado para esta venda. Abra Pendências TEF.');
      }
      if (JSON.stringify(op.checkout?.carrinho) !== JSON.stringify(venda.itens)) throw new Error('Carrinho alterado após a autorização TEF. Recupere o pagamento.');
      if (op.checkout?.total != null && !valorTefConfere(op.checkout.total, venda.total)) throw new Error('Total alterado após autorização TEF. Recupere o pagamento.');
    }
    if (this.diario().pendentes().some(op => op.vendaId === venda.id && !ids.has(op.id))) throw new Error('Existem pagamentos pendentes fora desta venda. Abra Pendências TEF.');
  },

  async _confirmarVenda(venda) {
    venda = StorageService.getVendas().find(v => v.id === venda.id);
    // Nunca confirma na adquirente uma venda que só existe no carrinho.
    if (StorageService.temVendaPendente() || !venda) {
      throw new Error('Grave e recupere a venda antes de confirmar o TEF.');
    }
    this.validarPagamentos(venda);
    for (const p of venda.pagamentos || []) {
      if (!p.tefInfo) continue;
      const op = this.diario().obter(p.tefInfo.operacaoId);
      if (op.estado === 'concluida') continue;
      this.validarContexto(op);
      this.diario().salvar({ id: op.id, estado: 'confirmando' });
      if (op.provedor === 'sitef') {
        if (!this._sitefConfigurado) {
          const cfg = await this.configurarSitef();
          if (!cfg.ok) throw new Error(cfg.mensagem);
        }
        const ok = await window.electronAPI.sitefFinalizar({ ...op.sitef, confirma: true });
        if (ok !== true) throw new Error('Venda gravada; confirmação SiTef pendente. Não cobre novamente.');
      } else if (op.provedor === 'stone') {
        const fechado = await this._httpStone('PATCH', `/core/v5/orders/${encodeURIComponent(op.pedidoId)}/closed`, { status: 'paid' });
        if (fechado.status < 200 || fechado.status >= 300) throw new Error('Venda gravada; encerramento do pedido Stone pendente. Não cobre novamente.');
      }
      this.diario().salvar({ id: op.id, estado: 'concluida' });
    }
  },

  async _cancelarOperacao(id) {
    if (!window.AuthModule?.isGerente()) throw new Error('Estorno restrito ao gerente.');
    const op = this.diario().obter(id);
    if (!op) throw new Error('Operação TEF não encontrada.');
    this.validarContexto(op);
    if (this.transacaoAtiva) throw new Error('Cancele e aguarde a operação em andamento primeiro.');
    if (StorageService.getVendas().some(v => v.id === op.vendaId)) {
      throw new Error('A venda já foi gravada. Use o cancelamento da venda e o procedimento da adquirente.');
    }
    if (['cancelada', 'recusada'].includes(op.estado)) return true;
    this.diario().salvar({ id, estado: 'cancelando' });
    if (op.provedor === 'sitef') {
      if (!op.sitef) throw new Error('Sem referência SiTef: confira as pendências no menu administrativo.');
      if (!this._sitefConfigurado) {
        const cfg = await this.configurarSitef();
        if (!cfg.ok) throw new Error(cfg.mensagem);
      }
      if (await window.electronAPI.sitefFinalizar({ ...op.sitef, confirma: false }) !== true) {
        throw new Error('Estorno SiTef não confirmado. Não faça outra cobrança.');
      }
    } else {
      if (!op.pedidoId) throw new Error('Consulte a operação primeiro para recuperar o pedido Stone.');
      const closed = await this._httpStone('PATCH', `/core/v5/orders/${encodeURIComponent(op.pedidoId)}/closed`, { status: 'canceled' });
      if (closed.status < 200 || closed.status >= 300) throw new Error('Encerramento Stone não confirmado. Consulte novamente.');
      const consulta = await this._httpStone('GET', `/core/v5/orders/${encodeURIComponent(op.pedidoId)}`);
      if (consulta.status !== 200 || !Array.isArray(consulta.body?.charges)) throw new Error('Não foi possível conferir as cobranças Stone.');
      for (const c of consulta.body.charges) {
        if (!['paid', 'pending', 'processing'].includes(c.status)) continue;
        if (!c.id) throw new Error('Cobrança Stone sem identificador. Confira na adquirente.');
        const res = await this._httpStone('DELETE', `/core/v5/charges/${encodeURIComponent(c.id)}`);
        if (res.status < 200 || res.status >= 300) throw new Error('Estorno Stone pendente. Não cobre novamente.');
      }
      const final = await this._httpStone('GET', `/core/v5/orders/${encodeURIComponent(op.pedidoId)}`);
      if (final.status !== 200 || !Array.isArray(final.body?.charges)
          || final.body.charges.some(c => !['canceled', 'failed', 'voided'].includes(c.status))) {
        throw new Error('A adquirente ainda não confirmou todos os estornos. Consulte novamente.');
      }
    }
    this.diario().salvar({ id, estado: 'cancelada' });
    const p = window.PdvModule;
    if (p?.tefVendaId === op.vendaId) {
      p.pagamentosLancados = p.pagamentosLancados.filter(x => x.tefInfo?.operacaoId !== id);
      p.atualizarInterfacePagamentoNovo();
    }
    return true;
  },

  async _consultarOperacao(id) {
    if (this.transacaoAtiva) throw new Error('Aguarde a operação em andamento.');
    if (StorageService.temVendaPendente()) StorageService.recuperarVendaPendente();
    let op = this.diario().obter(id);
    if (!op) throw new Error('Operação não encontrada.');
    this.validarContexto(op);
    const venda = StorageService.getVendas().find(v => v.id === op.vendaId);
    if (venda) { await this._confirmarVenda(venda); return; }
    if (!op.pedido && !op.pedidoId && !op.sitef) {
      this.diario().salvar({ id, estado: 'cancelada' });
      return; // Interrompida antes de registrar qualquer envio ao provedor.
    }
    if (op.provedor === 'sitef') {
      if (op.estado === 'autorizada') return;
      throw new Error('SiTef interrompido: estorne esta referência antes de iniciar outra cobrança.');
    }
    let res;
    if (op.pedidoId) res = await this._httpStone('GET', `/core/v5/orders/${encodeURIComponent(op.pedidoId)}`);
    else {
      // A chave do provedor tem prazo. Nunca cria pedido novamente fora dele.
      if (!op.pedido || !Number.isFinite(Date.parse(op.criadoEm)) || Date.now() - Date.parse(op.criadoEm) >= 4 * 60 * 1000) {
        throw new Error('Prazo de recuperação automática encerrado. Confira o pedido na Stone pelo código ' + op.id + '.');
      }
      res = await this._httpStone('POST', '/core/v5/orders/', op.pedido, op.id);
    }
    if (res.status < 200 || res.status >= 300 || !res.body?.id) throw new Error('Consulta Stone não confirmada. Não cobre novamente.');
    op = this.diario().salvar({ id, pedidoId: res.body.id });
    const r = interpretarPedidoStone(res.body, op.valor);
    if (r.estado === 'aprovada') {
      this.diario().salvar({ id, estado: 'autorizada', dados: { ...r.dados, operacaoId: id, vendaId: op.vendaId } });
    } else if (['cancelada', 'recusada'].includes(r.estado) && !(res.body.charges || []).some(c => ['paid', 'pending', 'processing'].includes(c.status))) {
      this.diario().salvar({ id, estado: r.estado });
    } else throw new Error(r.mensagem || 'Pedido ainda pendente na Stone.');
  },

  recuperarCheckout(id) {
    if (this.transacaoAtiva || this._reconciliando) throw new Error('Aguarde a consulta em andamento.');
    const op = this.diario().obter(id);
    if (!op || op.estado !== 'autorizada' || !op.checkout) throw new Error('Consulte e confirme a autorização primeiro.');
    if (StorageService.getVendas().some(v => v.id === op.vendaId)) throw new Error('Venda já gravada: use Consultar / concluir.');
    const turno = StorageService.getTurnoAtual();
    if (!turno || turno.id !== op.checkout.turnoId || turno.status !== 'aberto') throw new Error('Reabra o turno original ou estorne a operação.');
    const p = window.PdvModule;
    if (p.carrinho.length && p.tefVendaId !== op.vendaId) throw new Error('Conclua ou limpe o carrinho atual antes de recuperar.');
    const todos = this.diario().pendentes().filter(t => t.vendaId === op.vendaId);
    if (todos.some(t => t.estado !== 'autorizada')) throw new Error('Consulte todas as pendências desta venda primeiro.');
    p.carrinho = JSON.parse(JSON.stringify(op.checkout.carrinho));
    p.desconto = op.checkout.desconto || 0;
    p.clienteClubeAtivo = op.checkout.clienteClubeAtivo || null;
    p.tefVendaId = op.vendaId;
    p.renderCarrinho();
    p.abrirModalPagamento(true);
    p.pagamentosLancados = [];
    for (const t of todos) p.pagamentosLancados.push({ id: t.id, forma: t.tipo, valor: t.valor, tefInfo: t.dados });
    p.trocoDinheiroTotal = 0;
    p.atualizarInterfacePagamentoNovo();
    window.App.showToast('Pagamentos integrados recuperados. Confira e lance novamente os valores recebidos manualmente.', 'info');
  },

  abrirPendencias() {
    let modal = document.getElementById('modal-pendencias-tef');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'modal-pendencias-tef'; modal.className = 'modal-overlay'; modal.style.zIndex = '20000';
      document.body.appendChild(modal);
    }
    modal.replaceChildren();
    const box = document.createElement('div'); box.className = 'modal-content-box'; box.style.cssText = 'max-width:760px;padding:24px;max-height:85vh;overflow:auto';
    const title = document.createElement('h3'); title.textContent = 'Pagamentos integrados pendentes'; box.appendChild(title);
    const texto = document.createElement('p'); texto.textContent = 'Confira antes de cobrar novamente. Consultar também conclui pagamentos de vendas já gravadas.'; box.appendChild(texto);
    const adicionarBotao = (parent, texto, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-primary-action'; b.style.margin = '6px'; b.textContent = texto; b.onclick = async () => { b.disabled = true; try { await action(); } catch (e) { window.App.showToast(e.message, 'error'); } finally { b.disabled = false; } }; parent.appendChild(b); };
    for (const op of this.diario().pendentes()) {
      const row = document.createElement('div'); row.style.cssText = 'padding:12px;border-bottom:1px solid #ddd';
      const desc = document.createElement('p'); desc.textContent = `${op.provedor} · R$ ${Number(op.valor).toFixed(2)} · ${op.estado} · ${op.id}`; row.appendChild(desc);
      adicionarBotao(row, 'Consultar / concluir', async () => { await this.consultarOperacao(op.id); this.abrirPendencias(); });
      if (op.provedor === 'stone' && !op.pedidoId) adicionarBotao(row, 'Localizar pelo ID Stone', async () => {
        const pedidoId = window.prompt('Informe o ID do pedido consultado na Stone (order_...). O FlowPDV verificará código e valor antes de vincular.');
        if (pedidoId) { await this.vincularPedidoStone(op.id, pedidoId); this.abrirPendencias(); }
      });
      adicionarBotao(row, 'Recuperar no caixa', () => { this.recuperarCheckout(op.id); modal.classList.remove('active'); });
      adicionarBotao(row, 'Estornar', async () => {
        if (!window.AuthModule?.isGerente()) throw new Error('O gerente deve autorizar o estorno.');
        if (!window.confirm('Solicitar estorno deste pagamento na adquirente?')) return;
        await this.cancelarOperacao(op.id); this.abrirPendencias();
      });
      box.appendChild(row);
    }
    adicionarBotao(box, 'Fechar', () => modal.classList.remove('active'));
    modal.appendChild(box); modal.classList.add('active');
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
    const op = this.transacaoAtiva;
    if (!op || op.encerrando) return;
    if (!op.demonstracao && !op.administrativa) {
      if (!valorTefConfere(op.valor, dados.valor)) { this._falhar('Valor confirmado diferente do solicitado. Confira Pendências TEF.'); return; }
      dados = { ...dados, operacaoId: op.id, vendaId: op.vendaId };
      try { this._registrar({ estado: 'autorizada', dados }); }
      catch (e) { this._falhar('Pagamento recebido, mas o disco falhou. Não cobre novamente; consulte Pendências TEF.'); return; }
    }
    op.encerrando = true;
    if (this.temporizador) clearInterval(this.temporizador);
    this._status('Transação aprovada!', `${dados.bandeira || dados.rede || ''} · NSU ${dados.nsu || '-'}`.trim(), '✅');
    try { AuditModule.registrarLog('tef_aprovado', `TEF ${dados.provedor || ''} aprovado: R$ ${(Number(dados.valor) || 0).toFixed(2)} ${dados.tipo || ''} NSU ${dados.nsu || ''}`, {
      provedor: dados.provedor, nsu: dados.nsu, autorizacao: dados.autorizacao, valor: dados.valor
    }); } catch (e) { console.warn('[TEF] Falha no log; autorização preservada no diário.', e); }
    setTimeout(() => {
      if (this.transacaoAtiva !== op) return;
      this.fecharModalTef();
      const r = this.resolverPromessa;
      this.resolverPromessa = null;
      this.rejeitarPromessa = null;
      this.transacaoAtiva = null;
      if (r) r(dados);
    }, 900);
  },

  _falhar(motivo, silencioso = false, definitivo = false) {
    const op = this.transacaoAtiva;
    if (!op || op.encerrando) return;
    try { this._registrar({ estado: definitivo ? 'recusada' : 'incerta', erro: motivo }); } catch (e) { console.error('[TEF] Diário indisponível:', e); }
    op.encerrando = true;
    if (this.temporizador) clearInterval(this.temporizador);
    this._status('Transação não concluída', motivo, '❌');
    setTimeout(() => {
      if (this.transacaoAtiva !== op) return;
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
      if (this.transacaoAtiva || this._reconciliando) {
        reject(new Error('Já existe uma transação TEF em andamento.'));
        return;
      }
      try {
        const cfg = this.getConfig();
        if (!this.tefAtivo()) throw new Error('TEF desativado. Confirme manualmente o pagamento realizado na maquininha.');
        const erro = validarConfigIntegracao(cfg);
        if (erro) throw new Error(erro);
        if (!params.vendaId || !params.checkout || !valorTefConfere(params.valor, params.valor)) throw new Error('Venda ou valor inválido para integração.');
        if (this.diario().pendentes().some(t => t.estado !== 'autorizada' || t.vendaId !== params.vendaId)) {
          throw new Error('Existe pagamento pendente. Abra Pendências TEF antes de cobrar novamente.');
        }
      } catch (e) { reject(e); return; }
      this.resolverPromessa = resolve;
      this.rejeitarPromessa = reject;
      this.transacaoAtiva = {
        id: 'TEF-' + crypto.randomUUID(),
        vendaId: params.vendaId,
        valor: Number(params.valor) || 0,
        tipo: params.tipo || 'Crédito',
        parcelas: Math.max(1, parseInt(params.parcelas, 10) || 1),
        status: 'processando',
        dataHora: new Date().toISOString()
      };

      const provedor = this.provedor();
      try {
        this._registrar({ ...this.transacaoAtiva, provedor, contexto: this.contextoConfiguracao(), estado: 'iniciada', criadoEm: new Date().toISOString(), checkout: params.checkout });
      } catch (e) { this.transacaoAtiva = null; this.resolverPromessa = null; this.rejeitarPromessa = null; reject(e); return; }
      const execucao = provedor === 'stone' ? this._executarStone(params) : this._executarSitef(params);
      Promise.resolve(execucao).catch(e => this._falhar('Falha de comunicação: ' + e.message + '. Confira Pendências TEF.'));
    });
  },

  cancelarPeloOperador() {
    if (!this.transacaoAtiva || this.transacaoAtiva.encerrando) return;
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

  async _httpStone(metodo, caminho, body, chaveIdempotencia, configTeste) {
    const cfg = configTeste || this.getConfig();
    const headers = {};
    if (chaveIdempotencia) headers['Idempotency-key'] = chaveIdempotencia;
    if (cfg.stoneServiceRefererName) headers['ServiceRefererName'] = String(cfg.stoneServiceRefererName).trim();
    const req = { method: metodo, url: STONE_API + caminho, token: String(cfg.stoneSecretKey || '').trim(), body, headers, timeoutMs: 30000 };

    if (window.electronAPI && typeof window.electronAPI.httpJson === 'function') {
      return window.electronAPI.httpJson(req);
    }
    try {
      const resp = await fetch(req.url, {
        method: metodo,
        headers: { 'Authorization': 'Basic ' + btoa(req.token + ':'), 'Accept': 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000)
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
    const opId = this.transacaoAtiva.id;
    this._registrar({ pedido });
    const criado = await this._httpStone('POST', '/core/v5/orders/', pedido, opId);
    if (criado.status < 200 || criado.status >= 300 || !criado.body || !criado.body.id) {
      this._falhar(mensagemErroStone(criado.status, criado.body));
      return;
    }

    const orderId = criado.body.id;
    this.transacaoAtiva.pedidoId = orderId;
    this._registrar({ pedidoId: orderId });
    let resultado = interpretarPedidoStone(criado.body, params.valor);
    this._status('Aguardando o cliente na maquininha...', `Pedido ${orderId} enviado${cfg.stoneSerial ? ' para o terminal ' + cfg.stoneSerial : ''}.`, '💳');

    const inicio = Date.now();
    while (resultado.estado === 'aguardando') {
      if (this._cancelarStone || (Date.now() - inicio) > STONE_TIMEOUT_MS) {
        const encerrado = await this._httpStone('PATCH', `/core/v5/orders/${orderId}/closed`, { status: 'canceled' });
        const consultaFinal = await this._httpStone('GET', `/core/v5/orders/${orderId}`);
        const charges = consultaFinal.body?.charges;
        const semCobranca = encerrado.status >= 200 && encerrado.status < 300 && consultaFinal.status === 200 && Array.isArray(charges)
          && charges.every(c => ['canceled', 'failed', 'voided'].includes(c.status));
        this._falhar(semCobranca ? 'Pedido encerrado sem cobrança.' : 'Resultado incerto. Abra Pendências TEF e confira antes de cobrar novamente.', false, semCobranca);
        return;
      }
      await new Promise(r => setTimeout(r, STONE_POLL_MS));
      if (!this.transacaoAtiva) return;
      const consulta = await this._httpStone('GET', `/core/v5/orders/${orderId}`);
      if (consulta.status >= 200 && consulta.status < 300 && consulta.body) {
        resultado = interpretarPedidoStone(consulta.body, params.valor);
      } else if (consulta.status === 401 || consulta.status === 403) {
        this._falhar(mensagemErroStone(consulta.status, consulta.body));
        return;
      }
    }

    if (resultado.estado === 'aprovada') {
      // O encerramento é verificado em confirmarVenda, após a gravação.
      const dados = { ...resultado.dados, tipo: resultado.dados.tipo || this.transacaoAtiva.tipo, parcelas: this.transacaoAtiva.parcelas };
      if (!dados.valor) dados.valor = this.transacaoAtiva.valor;
      this._concluir(dados);
      return;
    }

    const fechado = await this._httpStone('PATCH', `/core/v5/orders/${orderId}/closed`, { status: 'canceled' });
    const consultado = await this._httpStone('GET', `/core/v5/orders/${orderId}`);
    const definitivo = fechado.status >= 200 && fechado.status < 300 && consultado.status === 200
      && Array.isArray(consultado.body?.charges) && consultado.body.charges.every(c => ['canceled', 'failed', 'voided'].includes(c.status));
    this._falhar(definitivo ? (resultado.mensagem || 'Pagamento não aprovado.') : 'Encerramento não confirmado. Confira Pendências TEF.', false, definitivo);
  },

  async testarStone(cfgTeste) {
    const cfg = cfgTeste || this.getConfig();
      const r = await this._httpStone('GET', '/core/v5/orders?size=1', undefined, undefined, cfg);
      if (r.status >= 200 && r.status < 300) return { ok: true, mensagem: 'Chave Stone válida. API respondendo.' };
      return { ok: false, mensagem: mensagemErroStone(r.status, r.body) };
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
    this._sitefConfigurado = !cfgTeste && Boolean(r && r.ok);
    if (r && r.ok) return { ok: true, mensagem: 'CliSiTef configurada.' };
    return { ok: false, mensagem: (r && r.erro) || mensagemConfiguraSitef(r && r.codigo) };
  },

  async testarSitef(cfgTeste) {
    const conf = await this.configurarSitef(cfgTeste);
    if (!conf.ok) return conf;
    let pinpad = false;
    try { pinpad = await window.electronAPI.sitefPinpadPresente(); } catch (e) {}
    return { ok: pinpad === true, mensagem: pinpad ? 'CliSiTef configurada e pinpad detectado.' : 'CliSiTef configurada. Pinpad não detectado (confira o cabo/porta).' };
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
      this._falhar('SiTef só funciona no FlowPDV instalado (Windows).', false, true);
      return;
    }
    this._ouvirEventosSitef();
    this._abrirModal(params, { rotuloProvedor: 'SITEF' });

    if (!this._sitefConfigurado) {
      this._status('Conectando à CliSiTef...', 'Carregando a DLL e configurando loja/terminal.', '⏳');
      const conf = await this.configurarSitef();
      if (!conf.ok) { this._falhar(conf.mensagem, false, true); return; }
    }

    const agora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dataFiscal = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}`;
    const horaFiscal = `${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
    const cupomFiscal = String(Date.now()); // sempre crescente, exigência da CliSiTef
    const operador = (window.AuthModule && window.AuthModule.usuarioAtual && window.AuthModule.usuarioAtual.nome) || 'CAIXA';
    const t = this.transacaoAtiva;
    t.sitef = { cupomFiscal, dataFiscal, horaFiscal };
    this._registrar({ sitef: t.sitef });

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
        const desfeito = await window.electronAPI.sitefFinalizar({ confirma: false, cupomFiscal, dataFiscal, horaFiscal });
        if (desfeito !== true) { this._falhar('Estorno SiTef pendente. Confira antes de cobrar novamente.'); return; }
      }
      this._falhar(motivo, Boolean(r && r.cancelado), !!r && r.retorno !== -100);
      return;
    }

    const dados = interpretarCamposSitef(r.campos, { tipo: t.tipo, parcelas: t.parcelas, valor: t.valor });
    dados.cupomFiscalTef = cupomFiscal;

    // A confirmação ocorre somente em confirmarVenda, depois da gravação local.
    let impressaoOk = true;
    try {
      if (window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirComprovanteTef === 'function') {
        if (dados.comprovanteLoja) await window.ThermalPrintModule.imprimirComprovanteTef(dados.comprovanteLoja, 'VIA ESTABELECIMENTO');
        if (dados.comprovanteCliente) await window.ThermalPrintModule.imprimirComprovanteTef(dados.comprovanteCliente, 'VIA CLIENTE');
      } else {
        throw new Error('Impressão TEF indisponível.');
      }
    } catch (e) {
      impressaoOk = false;
      console.warn('[TEF] Falha ao imprimir comprovante SiTef:', e);
    }
    if (!impressaoOk) {
      const desfeito = await window.electronAPI.sitefFinalizar({ confirma: false, cupomFiscal, dataFiscal, horaFiscal });
      this._falhar(desfeito === true ? 'Comprovante não impresso; transação desfeita no SiTef.' : 'Impressão falhou; estorno pendente. Abra Pendências TEF.', false, desfeito === true);
      return;
    }

    this._concluir(dados);
  },

  // Menu administrativo do SiTef (cancelamento, reimpressão, pendências).
  async abrirMenuAdministrativoSitef() {
    if (!window.AuthModule?.isGerente()) { window.App.showToast('Acesso restrito ao gerente.', 'warning'); return; }
    if (this.provedor() !== 'sitef') {
      window.App.showToast('O menu administrativo é do SiTef. Selecione SiTef como provedor.', 'info');
      return;
    }
    if (this.transacaoAtiva || this._reconciliando) { window.App.showToast('Há uma transação em andamento.', 'warning'); return; }
    this._ouvirEventosSitef();
    this.transacaoAtiva = { id: 'ADM-' + Date.now(), administrativa: true, valor: 0, tipo: 'Administrativo', parcelas: 1 };
    this.resolverPromessa = () => {};
    this.rejeitarPromessa = () => {};
    this._abrirModal({ valor: 0, tipo: 'Menu administrativo' }, { rotuloProvedor: 'SITEF' });
    try {
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
      if (campos[122]) await window.ThermalPrintModule.imprimirComprovanteTef(campos[122], 'VIA ESTABELECIMENTO');
      if (campos[121]) await window.ThermalPrintModule.imprimirComprovanteTef(campos[121], 'VIA CLIENTE');
      if (await window.electronAPI.sitefFinalizar({ confirma: true, cupomFiscal, dataFiscal, horaFiscal }) !== true) throw new Error('Finalização administrativa pendente. Verifique no SiTef.');
    } catch (e) { this._falhar(e.message); return; }
    this._concluir({ sucesso: true, provedor: 'sitef', nsu: campos[133] || '', rede: 'SiTef', tipo: 'Administrativo', valor: 0 });
    } catch (e) { this._falhar('Falha no menu administrativo: ' + e.message + '. Confira o resultado no SiTef.'); }
  },

  // ---------------------------------------------------------------------
  // Teste pela tela de configuração
  // ---------------------------------------------------------------------

  async testarTefConfig() {
    if (this.temPendencias()) { window.App.showToast('Resolva as pendências antes de testar outra configuração.', 'warning'); return; }
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
      return modalAberto ? v : (salvo[chave] || '');
    };
    const provedor = val('tef-provedor', 'provedor') || 'simulador';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Testando...'; }
    this._reconciliando = true;

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
      this._reconciliando = false;
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
