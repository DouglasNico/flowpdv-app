/**
 * inventario.js - Sessão de conferência de estoque (bipar → divergir → processar = MOV).
 * Só produtos lidos entram na sessão. O que ninguém bipou não zera.
 */

import { StorageService } from './storage.js';
import { calcularDeltasInventario } from './merge-core.js';

export const InventarioModule = {
  sessaoAtivaId: null,

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
    sessao.status = 'processado';
    sessao.processadoEm = new Date().toISOString();
    this.persistir(sessao);
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

    if (!sessao) {
      if (statusEl) statusEl.textContent = 'Nenhuma sessão';
      if (listaEl) listaEl.innerHTML = '<div class="inventario-vazio">Abra uma sessão para começar a contar.</div>';
      return;
    }

    const linhas = Object.values(sessao.linhas || {});
    const divergentes = linhas.filter(l => Math.abs((parseFloat(l.contado) || 0) - (parseFloat(l.saldoDe) || 0)) > 0.0001);
    const rotulo = {
      em_andamento: 'Contando — só produtos bipados entram',
      concluido: 'Concluído — conferir divergências',
      processado: 'Processado — movimentos gerados'
    }[sessao.status] || sessao.status;

    if (statusEl) statusEl.textContent = rotulo;
    if (countEl) countEl.textContent = linhas.length + ' lido(s) · ' + divergentes.length + ' divergente(s)';
    if (bipBox) bipBox.style.display = sessao.status === 'em_andamento' ? 'block' : 'none';
    if (btnConcluir) btnConcluir.style.display = sessao.status === 'em_andamento' ? 'inline-flex' : 'none';
    if (btnReabrir) btnReabrir.style.display = sessao.status === 'concluido' ? 'inline-flex' : 'none';
    if (btnProcessar) btnProcessar.style.display = sessao.status === 'processado' ? 'none' : 'inline-flex';

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

    listaEl.innerHTML = linhas.slice().reverse().map(l => {
      const contado = parseFloat(l.contado) || 0;
      const saldo = parseFloat(l.saldoDe) || 0;
      const delta = contado - saldo;
      const classe = delta === 0 ? 'ok' : 'div';
      const sinal = delta > 0 ? '+' + delta : String(delta);
      return `<div class="inventario-linha ${classe}">
        <div>
          <strong>${this._esc(l.nome || l.produtoId)}</strong>
          <span>${this._esc(l.codigoBarras || '')}</span>
        </div>
        <div class="inventario-nums">
          <span>Sistema ${saldo}</span>
          <span>Contado ${contado}</span>
          <em>${sinal}</em>
        </div>
      </div>`;
    }).join('');
  },

  _esc(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
