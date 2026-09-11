/**
 * inventario.js - Sessão de conferência de estoque (bipar → divergir → processar = MOV).
 * Só produtos lidos entram na sessão. O que ninguém bipou não zera.
 */

import { StorageService } from './storage.js';
import { calcularDeltasInventario } from './merge-core.js';
import { AuditModule } from './audit.js';

export const InventarioModule = {
  sessaoAtivaId: null,
  historicoDetalheId: null,

  init() {
    const aberta = this.getSessoes().find(s => s.status === 'em_andamento' || s.status === 'concluido');
    if (aberta) this.sessaoAtivaId = aberta.id;
  },

  getSessoes() {
    return StorageService.getInventarios ? StorageService.getInventarios() : [];
  },

  getSessaoAtiva() {
    const lista = this.getSessoes();
    if (this.sessaoAtivaId) {
      const atual = lista.find(s => s && s.id === this.sessaoAtivaId);
      if (atual) return atual;
    }
    return lista.find(s => s && (s.status === 'em_andamento' || s.status === 'concluido')) || null;
  },

  persistir(sessao) {
    const lista = this.getSessoes();
    sessao.atualizadoEm = new Date().toISOString();
    const idx = lista.findIndex(s => s && s.id === sessao.id);
    if (idx >= 0) lista[idx] = sessao;
    else lista.unshift(sessao);
    StorageService.saveInventarios(lista);
    this.sessaoAtivaId = sessao.id;
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('inventario');
    }
  },

  abrirSessao() {
    const existente = this.getSessoes().find(s => s && (s.status === 'em_andamento' || s.status === 'concluido'));
    if (existente) {
      this.sessaoAtivaId = existente.id;
      return existente;
    }
    const op = window.AuthModule && typeof window.AuthModule.getUsuario === 'function'
      ? window.AuthModule.getUsuario()
      : null;
    const sessao = {
      id: 'INV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      status: 'em_andamento',
      tipo: 'somente_lidos',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: op ? op.nome : '',
      terminalId: StorageService.getDeviceId(),
      linhas: {}
    };
    this.persistir(sessao);
    return sessao;
  },

  encontrarProduto(codigo) {
    const c = String(codigo || '').trim().toUpperCase();
    if (!c) return null;
    const produtos = StorageService.getProdutos() || [];
    return produtos.find(p =>
      String(p.codigoBarras || '').toUpperCase() === c ||
      String(p.codigoBarrasFardo || '').toUpperCase() === c ||
      String(p.id || '').toUpperCase() === c
    ) || null;
  },

  bipar(codigo, qtd = 1) {
    const sessao = this.getSessaoAtiva();
    if (!sessao || sessao.status !== 'em_andamento') {
      return { erro: 'A sessão não está em contagem. Abra ou reabra o inventário.' };
    }
    const produto = this.encontrarProduto(codigo);
    if (!produto) return { erro: 'Produto não encontrado.' };
    if (produto.controlarEstoque === false) return { erro: 'Este produto não controla estoque.' };
    const quantidade = parseFloat(String(qtd).replace(',', '.')) || 0;
    if (quantidade <= 0) return { erro: 'Informe uma quantidade válida.' };

    const chave = String(produto.id);
    if (!sessao.linhas[chave]) {
      sessao.linhas[chave] = {
        produtoId: produto.id,
        nome: produto.nome,
        codigoBarras: produto.codigoBarras || '',
        saldoDe: parseFloat(produto.estoque) || 0,
        contado: 0,
        leituras: []
      };
    }
    sessao.linhas[chave].leituras.push({
      id: 'L-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      qtd: quantidade,
      terminalId: StorageService.getDeviceId(),
      operador: window.AuthModule && typeof window.AuthModule.getNomeOperador === 'function'
        ? window.AuthModule.getNomeOperador()
        : '',
      at: new Date().toISOString()
    });
    sessao.linhas[chave].contado = (sessao.linhas[chave].leituras || [])
      .reduce((soma, l) => soma + (parseFloat(l.qtd) || 0), 0);
    this.persistir(sessao);
    return { ok: true, produto, linha: sessao.linhas[chave] };
  },

  removerLinha(produtoId) {
    const sessao = this.getSessaoAtiva();
    if (!sessao || sessao.status === 'processado') {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Depois de processar não dá para apagar a linha. O estoque já foi ajustado.', 'warning');
      }
      return;
    }
    const chave = String(produtoId || '');
    if (!sessao.linhas || !sessao.linhas[chave]) return;
    delete sessao.linhas[chave];
    this.persistir(sessao);
    this.renderModal();
  },

  concluir() {
    const sessao = this.getSessaoAtiva();
    if (!sessao || sessao.status === 'processado') return null;
    sessao.status = 'concluido';
    this.persistir(sessao);
    return sessao;
  },

  reabrirContagem() {
    const sessao = this.getSessaoAtiva();
    if (!sessao || sessao.status === 'processado') return null;
    sessao.status = 'em_andamento';
    this.persistir(sessao);
    return sessao;
  },

  processar() {
    if (!window.AuthModule || typeof window.AuthModule.isGerente !== 'function' || !window.AuthModule.isGerente()) {
      return { erro: 'Só o gerente processa o inventário.' };
    }
    const sessao = this.getSessaoAtiva();
    if (!sessao || sessao.status === 'processado') {
      return { erro: 'Não há sessão para processar.' };
    }
    const produtos = StorageService.getProdutos() || [];
    const { deltas, avisos } = calcularDeltasInventario(sessao, produtos);
    if (avisos.length) {
      return { erro: 'venda_no_meio', avisos };
    }
    deltas.forEach(d => {
      const p = produtos.find(x => String(x.id) === String(d.produtoId));
      if (!p) return;
      p.estoque = Math.max(0, (parseFloat(p.estoque) || 0) + d.delta);
      StorageService.registrarMovimentoEstoque({
        produtoId: p.id,
        delta: d.delta,
        origem: 'inventario',
        refId: sessao.id
      });
    });
    StorageService.saveProdutos(produtos);
    Object.values(sessao.linhas || {}).forEach(l => {
      if (!l) return;
      const p = produtos.find(x => String(x.id) === String(l.produtoId));
      l.saldoPara = p && p.controlarEstoque !== false
        ? Math.max(0, parseFloat(p.estoque) || 0)
        : Math.max(0, parseFloat(l.contado) || 0);
    });
    sessao.status = 'processado';
    sessao.processadoEm = new Date().toISOString();
    sessao.processadoPor = this.nomeOperador();
    this.persistir(sessao);
    this.registrarLogProcessamento(sessao, deltas);
    if (window.EstoqueModule && typeof window.EstoqueModule.renderTabelaProdutos === 'function') {
      window.EstoqueModule.renderTabelaProdutos();
    }
    return { ok: true, deltas };
  },

  abrirModal() {
    const modal = document.getElementById('modal-inventario-sessao');
    if (!modal) return;
    this.abrirSessao();
    modal.classList.add('active');
    this.renderModal();
    const input = document.getElementById('inventario-bipar-codigo');
    if (input) setTimeout(() => input.focus(), 80);
  },

  fecharModal() {
    const modal = document.getElementById('modal-inventario-sessao');
    if (modal) modal.classList.remove('active');
  },

  onCodigoKey(event) {
    if (event.key !== 'Enter' && event.key !== 'Tab') return;
    const input = document.getElementById('inventario-bipar-codigo');
    if (!input || !String(input.value || '').trim()) return;
    event.preventDefault();
    const qtdEl = document.getElementById('inventario-bipar-qtd');
    if (qtdEl) {
      qtdEl.focus();
      qtdEl.select();
    }
  },

  onQtdKey(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.confirmarBipagem();
  },

  novaContagem() {
    this.sessaoAtivaId = null;
    this.abrirSessao();
    this.renderModal();
    const input = document.getElementById('inventario-bipar-codigo');
    if (input) setTimeout(() => input.focus(), 80);
  },

  confirmarBipagem() {
    const input = document.getElementById('inventario-bipar-codigo');
    const qtdEl = document.getElementById('inventario-bipar-qtd');
    const codigo = input ? input.value : '';
    const qtd = qtdEl ? qtdEl.value : 1;
    const r = this.bipar(codigo, qtd);
    const erro = document.getElementById('inventario-erro-msg');
    if (r.erro) {
      if (erro) {
        erro.textContent = r.erro;
        erro.style.display = 'block';
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(r.erro, 'warning');
      }
      return;
    }
    if (erro) erro.style.display = 'none';
    if (input) {
      input.value = '';
      input.focus();
    }
    if (qtdEl) qtdEl.value = '1';
    this.renderModal();
  },

  confirmarConcluir() {
    this.concluir();
    this.renderModal();
  },

  confirmarReabrir() {
    this.reabrirContagem();
    this.renderModal();
    const input = document.getElementById('inventario-bipar-codigo');
    if (input) input.focus();
  },

  confirmarProcessar() {
    const rodar = () => {
      const r = this.processar();
      if (r.erro === 'venda_no_meio') {
        const nomes = (r.avisos || []).map(a => a.nome).filter(Boolean).join(', ');
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(
            'Teve venda no meio da contagem' + (nomes ? ' em: ' + nomes : '') + '. Reconte esses itens.',
            'warning',
            8000
          );
        }
        this.renderModal(r.avisos);
        return;
      }
      if (r.erro) {
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(r.erro, 'warning');
        }
        return;
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Inventário processado. ' + (r.deltas || []).length + ' movimento(s) gerado(s).', 'success');
      }
      this.renderModal();
    };

    if (window.AuthModule && typeof window.AuthModule.isGerente === 'function' && window.AuthModule.isGerente()) {
      rodar();
      return;
    }
    if (window.AuthModule && typeof window.AuthModule.solicitarAutorizacaoGerente === 'function') {
      window.AuthModule.solicitarAutorizacaoGerente(rodar, 'Processar inventário');
    }
  },

  renderModal(avisosVenda) {
    const modal = document.getElementById('modal-inventario-sessao');
    if (!modal || !modal.classList.contains('active')) return;

    const sessao = this.getSessaoAtiva();
    const statusEl = document.getElementById('inventario-status-label');
    const listaEl = document.getElementById('inventario-lista-lidos');
    const countEl = document.getElementById('inventario-count-lidos');
    const avisoEl = document.getElementById('inventario-aviso-venda');
    const bipBox = document.getElementById('inventario-bipagem-box');
    const btnConcluir = document.getElementById('btn-inventario-concluir');
    const btnReabrir = document.getElementById('btn-inventario-reabrir');
    const btnProcessar = document.getElementById('btn-inventario-processar');
    const btnNova = document.getElementById('btn-inventario-nova');
    const avisoProcEl = document.getElementById('inventario-aviso-processado');

    if (!sessao) {
      modal.classList.remove('is-processado');
      const boxVazio = modal.querySelector('.inventario-modal');
      if (boxVazio) boxVazio.classList.remove('is-processado');
      if (statusEl) statusEl.textContent = 'Nenhuma sessão';
      if (listaEl) listaEl.innerHTML = '<div class="inventario-vazio">Abra uma sessão para começar a contar.</div>';
      return;
    }

    const linhas = Object.values(sessao.linhas || {});
    const divergentes = linhas.filter(l => Math.abs((parseFloat(l.contado) || 0) - (parseFloat(l.saldoDe) || 0)) > 0.0001);
    const rotulo = {
      em_andamento: 'Contando — só produtos bipados entram',
      concluido: 'Pausado — conferir divergências',
      processado: 'Processado — comprovante'
    }[sessao.status] || sessao.status;

    const processado = sessao.status === 'processado';
    modal.classList.toggle('is-processado', processado);
    const boxModal = modal.querySelector('.inventario-modal') || modal;
    boxModal.classList.toggle('is-processado', processado);

    if (statusEl) statusEl.textContent = rotulo;
    const metaEl = document.getElementById('inventario-meta');
    if (metaEl) metaEl.innerHTML = this.htmlMetaSessao(sessao);
    const hintEl = modal.querySelector('.inventario-hint');
    if (hintEl) {
      hintEl.style.display = processado ? 'none' : '';
      hintEl.textContent = 'Bipar não mexe no saldo. Só produtos lidos entram. O que ninguém bipar não zera. Os 3 PDVs podem contar a mesma sessão.';
    }
    const tituloLista = document.getElementById('inventario-lista-titulo');
    if (tituloLista) tituloLista.textContent = processado ? 'Comprovante' : 'Produtos lidos nesta sessão';

    let entrada = 0;
    let saida = 0;
    linhas.forEach(l => {
      const d = (parseFloat(l.contado) || 0) - (parseFloat(l.saldoDe) || 0);
      if (d > 0) entrada += d;
      else if (d < 0) saida += d;
    });
    if (countEl) {
      countEl.textContent = processado
        ? linhas.length + ' item(ns) · ' + divergentes.length + ' ajuste(s)'
        : linhas.length + ' lido(s) · ' + divergentes.length + ' divergente(s)';
    }
    if (bipBox) bipBox.style.display = sessao.status === 'em_andamento' ? 'block' : 'none';
    if (btnConcluir) btnConcluir.style.display = sessao.status === 'em_andamento' ? 'inline-flex' : 'none';
    if (btnReabrir) btnReabrir.style.display = sessao.status === 'concluido' ? 'inline-flex' : 'none';
    if (btnProcessar) btnProcessar.style.display = processado ? 'none' : 'inline-flex';
    if (btnNova) btnNova.style.display = processado ? 'inline-flex' : 'none';
    if (avisoProcEl) {
      if (processado) {
        avisoProcEl.style.display = 'block';
        avisoProcEl.innerHTML = '<strong>Estoque atualizado.</strong> '
          + divergentes.length + ' movimento(s) gravado(s)'
          + (entrada ? ' · entrada <b>+' + entrada + '</b>' : '')
          + (saida ? ' · saída <b>' + saida + '</b>' : '')
          + '.';
      } else {
        avisoProcEl.style.display = 'none';
        avisoProcEl.textContent = '';
      }
    }

    if (avisoEl) {
      if (avisosVenda && avisosVenda.length) {
        avisoEl.style.display = 'block';
        avisoEl.textContent = 'Teve venda no meio em: ' + avisosVenda.map(a => a.nome).join(', ') + '. Reconte esses itens antes de processar.';
      } else {
        avisoEl.style.display = 'none';
      }
    }

    if (!listaEl) return;
    if (!linhas.length) {
      listaEl.innerHTML = '<div class="inventario-vazio">Nenhum produto lido ainda. O que não for bipado não zera.</div>';
      return;
    }

    const podeApagar = !processado;
    const ordenadas = processado
      ? linhas.slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      : linhas.slice().reverse();
    const linhasHtml = ordenadas.map(l => {
      const contado = parseFloat(l.contado) || 0;
      const saldo = parseFloat(l.saldoDe) || 0;
      const delta = contado - saldo;
      const classe = delta === 0 ? 'ok' : (delta > 0 ? 'div mais' : 'div menos');
      const sinal = delta > 0 ? '+' + delta : String(delta);
      const idEsc = String(l.produtoId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const botao = podeApagar
        ? `<button type="button" class="inventario-linha-del" title="Remover este produto da contagem" onclick="InventarioModule.removerLinha('${idEsc}')">✕</button>`
        : '';
      const novo = l.saldoPara != null ? (parseFloat(l.saldoPara) || 0) : Math.max(0, contado);
      const colNovo = processado
        ? `<div class="inventario-num atualizado">
            <small>Estoque atualizado</small>
            <b>${novo}</b>
          </div>`
        : '';
      return `<div class="inventario-linha ${classe}">
        <div class="inventario-linha-prod">
          <strong>${this._esc(l.nome || l.produtoId)}</strong>
          <span>${this._esc(l.codigoBarras || '')}</span>
        </div>
        <div class="inventario-num sistema">
          <small>Sistema</small>
          <b>${saldo}</b>
        </div>
        <div class="inventario-num contado">
          <small>Contado</small>
          <b>${contado}</b>
        </div>
        <div class="inventario-num dif">
          <small>Diferença</small>
          <b>${sinal}</b>
        </div>
        ${colNovo}
        ${botao}
      </div>`;
    }).join('');
    listaEl.innerHTML = linhasHtml;
  },

  nomeOperador() {
    if (window.AuthModule && typeof window.AuthModule.getNomeOperador === 'function') {
      return window.AuthModule.getNomeOperador() || '';
    }
    const u = window.AuthModule && typeof window.AuthModule.getUsuario === 'function'
      ? window.AuthModule.getUsuario()
      : null;
    return (u && u.nome) || '';
  },

  resumoSessao(sessao) {
    const linhas = Object.values((sessao && sessao.linhas) || {});
    const operadores = new Set();
    if (sessao && sessao.criadoPor) operadores.add(sessao.criadoPor);
    linhas.forEach(l => {
      (l.leituras || []).forEach(r => {
        if (r && r.operador) operadores.add(r.operador);
      });
    });
    const divergentes = linhas.filter(l => Math.abs((parseFloat(l.contado) || 0) - (parseFloat(l.saldoDe) || 0)) > 0.0001);
    let entrada = 0;
    let saida = 0;
    linhas.forEach(l => {
      const d = (parseFloat(l.contado) || 0) - (parseFloat(l.saldoDe) || 0);
      if (d > 0) entrada += d;
      else if (d < 0) saida += d;
    });
    return { linhas, operadores: Array.from(operadores), divergentes, entrada, saida };
  },

  _fmtData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  },

  htmlMetaSessao(sessao) {
    if (!sessao) return '';
    const r = this.resumoSessao(sessao);
    const partes = [];
    if (sessao.criadoPor) partes.push('Aberto por <b>' + this._esc(sessao.criadoPor) + '</b>');
    if (sessao.criadoEm) partes.push(this._esc(this._fmtData(sessao.criadoEm)));
    if (r.operadores.length) partes.push('Contagem: <b>' + r.operadores.map(o => this._esc(o)).join(', ') + '</b>');
    if (sessao.processadoPor) partes.push('Processado por <b>' + this._esc(sessao.processadoPor) + '</b>');
    if (sessao.processadoEm) partes.push(this._esc(this._fmtData(sessao.processadoEm)));
    return partes.join(' · ');
  },

  registrarLogProcessamento(sessao, deltas) {
    const r = this.resumoSessao(sessao);
    const linhas = r.linhas.slice(0, 250).map(l => ({
      produtoId: l.produtoId,
      nome: l.nome,
      sistema: parseFloat(l.saldoDe) || 0,
      contado: parseFloat(l.contado) || 0,
      atualizado: l.saldoPara != null ? (parseFloat(l.saldoPara) || 0) : parseFloat(l.contado) || 0
    }));
    AuditModule.registrarLog(
      'inventario',
      'Inventário processado: ' + r.linhas.length + ' item(ns), ' + (deltas || []).length + ' ajuste(s)',
      {
        sessaoId: sessao.id,
        criadoPor: sessao.criadoPor || '',
        processadoPor: sessao.processadoPor || this.nomeOperador(),
        operadores: r.operadores,
        itens: r.linhas.length,
        ajustes: (deltas || []).length,
        entrada: r.entrada,
        saida: r.saida,
        linhas
      }
    );
  },

  abrirHistorico() {
    const modal = document.getElementById('modal-inventario-historico');
    if (!modal) return;
    modal.classList.add('active');
    this.renderHistorico();
  },

  fecharHistorico() {
    const modal = document.getElementById('modal-inventario-historico');
    if (modal) modal.classList.remove('active');
    this.historicoDetalheId = null;
  },

  abrirDetalheHistorico(id) {
    const auditModal = document.getElementById('modal-detalhes-auditoria');
    if (auditModal) auditModal.classList.remove('active');
    const sessao = this.getSessoes().find(s => s && s.id === id);
    if (!sessao) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Essa conferência ainda não chegou neste terminal. Espere o sync.', 'warning');
      }
      return;
    }
    if (sessao.status === 'em_andamento' || sessao.status === 'concluido') {
      this.fecharHistorico();
      this.sessaoAtivaId = sessao.id;
      this.abrirModal();
      return;
    }
    this.historicoDetalheId = id;
    const modal = document.getElementById('modal-inventario-historico');
    if (modal) modal.classList.add('active');
    this.renderHistorico();
  },

  voltarListaHistorico() {
    this.historicoDetalheId = null;
    this.renderHistorico();
  },

  rotuloStatus(status) {
    return {
      em_andamento: 'Contando',
      concluido: 'Pausado',
      processado: 'Processado'
    }[status] || status || '—';
  },

  renderHistorico() {
    const listaEl = document.getElementById('inventario-hist-lista');
    const detalheEl = document.getElementById('inventario-hist-detalhe');
    const tituloEl = document.getElementById('inventario-hist-title');
    const btnVoltar = document.getElementById('btn-inventario-hist-voltar');
    if (!listaEl || !detalheEl) return;

    const sessoes = this.getSessoes().slice().sort((a, b) => {
      const ta = new Date(b.processadoEm || b.atualizadoEm || b.criadoEm || 0).getTime();
      const tb = new Date(a.processadoEm || a.atualizadoEm || a.criadoEm || 0).getTime();
      return ta - tb;
    });

    const detalhe = this.historicoDetalheId
      ? sessoes.find(s => s && s.id === this.historicoDetalheId)
      : null;

    if (btnVoltar) btnVoltar.style.display = detalhe ? 'inline-flex' : 'none';
    if (tituloEl) tituloEl.textContent = detalhe ? 'Detalhes do inventário' : 'Histórico de inventário';

    if (detalhe) {
      listaEl.style.display = 'none';
      detalheEl.style.display = 'flex';
      detalheEl.innerHTML = this.htmlDetalheHistorico(detalhe);
      return;
    }

    detalheEl.style.display = 'none';
    detalheEl.innerHTML = '';
    listaEl.style.display = 'flex';

    if (!sessoes.length) {
      listaEl.innerHTML = '<div class="inventario-vazio">Nenhuma conferência ainda. Abra o Inventário para começar a contar.</div>';
      return;
    }

    listaEl.innerHTML = sessoes.map(s => {
      const r = this.resumoSessao(s);
      const quando = this._fmtData(s.processadoEm || s.criadoEm);
      const quem = s.processadoPor || s.criadoPor || (r.operadores[0] || '—');
      const idEsc = String(s.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<button type="button" class="inventario-hist-card" onclick="InventarioModule.abrirDetalheHistorico('${idEsc}')">
        <div class="inventario-hist-card-top">
          <strong>${this._esc(this.rotuloStatus(s.status))}</strong>
          <span>${this._esc(quando)}</span>
        </div>
        <div class="inventario-hist-card-meta">
          ${this._esc(quem)} · ${r.linhas.length} item(ns) · ${r.divergentes.length} ajuste(s)
        </div>
      </button>`;
    }).join('');
  },

  htmlDetalheHistorico(sessao) {
    const r = this.resumoSessao(sessao);
    const linhas = r.linhas.slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    const lista = linhas.length
      ? linhas.map(l => {
        const contado = parseFloat(l.contado) || 0;
        const saldo = parseFloat(l.saldoDe) || 0;
        const delta = contado - saldo;
        const classe = delta === 0 ? 'ok' : (delta > 0 ? 'div mais' : 'div menos');
        const sinal = delta > 0 ? '+' + delta : String(delta);
        const novo = l.saldoPara != null ? (parseFloat(l.saldoPara) || 0) : Math.max(0, contado);
        const quemLinha = [...new Set((l.leituras || []).map(x => x.operador).filter(Boolean))].join(', ');
        return `<div class="inventario-linha ${classe}">
          <div class="inventario-linha-prod">
            <strong>${this._esc(l.nome || l.produtoId)}</strong>
            <span>${this._esc(l.codigoBarras || '')}${quemLinha ? ' · ' + this._esc(quemLinha) : ''}</span>
          </div>
          <div class="inventario-num sistema"><small>Sistema</small><b>${saldo}</b></div>
          <div class="inventario-num contado"><small>Contado</small><b>${contado}</b></div>
          <div class="inventario-num dif"><small>Diferença</small><b>${sinal}</b></div>
          <div class="inventario-num atualizado"><small>Atualizado</small><b>${novo}</b></div>
        </div>`;
      }).join('')
      : '<div class="inventario-vazio">Nenhum produto lido nesta conferência.</div>';

    return `<div class="inventario-hist-detalhe-meta">${this.htmlMetaSessao(sessao)}</div>
      <div class="inventario-lista-head">
        <span>Comprovante</span>
        <span>${r.linhas.length} item(ns) · ${r.divergentes.length} ajuste(s)</span>
      </div>
      <div class="inventario-cols inventario-cols-hist" aria-hidden="true">
        <span>Produto</span>
        <span>Sistema</span>
        <span>Contado</span>
        <span>Diferença</span>
        <span>Atualizado</span>
      </div>
      <div class="inventario-lista">${lista}</div>`;
  },

  _esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
