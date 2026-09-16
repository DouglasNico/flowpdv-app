/**
 * PDV de atendimento (mesas/comandas) em tela cheia.
 * Só liga para operador quando este PC é "atendimento". Não cobra.
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { ComandasModule } from './comandas.js';
import { idComandaPorNumero } from './tipo-terminal.js';

export const AtendimentoPdvModule = {
  tipoChip: 'comanda',

  init() {
    try {
      const salvo = sessionStorage.getItem('flowpdv_atend_tipo_chip');
      if (salvo === 'mesa' || salvo === 'comanda') this.tipoChip = salvo;
    } catch (e) {}
    this.bind();
  },

  bind() {
    const numInput = document.getElementById('atend-numero-input');
    if (numInput && !numInput.dataset.bound) {
      numInput.dataset.bound = 'true';
      numInput.addEventListener('input', () => {
        numInput.value = String(numInput.value || '').replace(/\D/g, '');
      });
      numInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.abrirPeloNumero();
        }
      });
    }
    const codInput = document.getElementById('atend-barcode-input');
    if (codInput && !codInput.dataset.bound) {
      codInput.dataset.bound = 'true';
      codInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const valor = String(codInput.value || '').trim();
          codInput.value = '';
          this.lancarCodigo(valor);
        }
      });
    }
    document.querySelectorAll('[data-atend-chip]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => this.setChip(btn.getAttribute('data-atend-chip')));
    });
    const btnAbrir = document.getElementById('atend-btn-abrir');
    if (btnAbrir && !btnAbrir.dataset.bound) {
      btnAbrir.dataset.bound = 'true';
      btnAbrir.addEventListener('click', () => this.abrirPeloNumero());
    }
    const pessoasInput = document.getElementById('atend-pessoas');
    if (pessoasInput && !pessoasInput.dataset.bound) {
      pessoasInput.dataset.bound = 'true';
      pessoasInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        if (this.dividirConta(pessoasInput.value)) {
          requestAnimationFrame(() => this.focarInput());
        }
      });
    }
  },

  estaAtivoOperador() {
    return !!(window.App && typeof window.App.operadorEmAtendimento === 'function' && window.App.operadorEmAtendimento());
  },

  mostrar() {
    this.bind();
    this.adaptarSalao();
    this.copiarLogoEOperador();
    if (!ComandasModule.comandaAtivaId) this.mostrarEntrada();
    else this.mostrarOperacao();
    this.focarInput();
  },

  ocultar() {
    const shell = document.getElementById('atendimento-pdv-shell');
    if (shell) shell.classList.remove('active');
  },

  adaptarChips() {
    this.adaptarSalao();
  },

  adaptarSalao() {
    const textos = (ComandasModule.textosModo && ComandasModule.textosModo()) || {};
    const modo = textos.modo || ComandasModule.getModoAtendimento();
    const wrap = document.getElementById('atend-chips-wrap');
    const misto = modo === 'mesas_e_comandas';
    if (wrap) wrap.style.display = misto ? 'flex' : 'none';
    if (modo === 'apenas_mesas') this.tipoChip = 'mesa';
    if (modo === 'apenas_comandas') this.tipoChip = 'comanda';
    this.pintarChips();

    const label = document.getElementById('atend-numero-label');
    if (label) {
      label.textContent = textos.labelNumero || (this.tipoChip === 'mesa' ? 'NÚMERO DA MESA' : 'NÚMERO DA COMANDA');
    }
    const caption = document.getElementById('atend-status-caption');
    if (caption && textos.caption) caption.textContent = textos.caption;
    const intro = document.getElementById('atend-intro');
    if (intro && textos.intro) intro.innerHTML = textos.intro;
    const transferir = document.getElementById('atend-transferir-label');
    if (transferir && textos.transferir) transferir.textContent = textos.transferir;
    const preconta = document.getElementById('atend-preconta-sub');
    if (preconta && textos.preconta) {
      preconta.innerHTML = `${textos.preconta} <kbd>F4</kbd>`;
    }
    const atalhoF5 = document.getElementById('atend-atalho-f5');
    if (atalhoF5 && textos.atalhoF5) {
      atalhoF5.innerHTML = `<kbd>F5</kbd> ${textos.atalhoF5}`;
    }
    if (!this.comandaAtual()) this.atualizarStatusEntrada();
  },

  textoStatusEntrada() {
    const textos = ComandasModule.textosModo && ComandasModule.textosModo();
    if (textos && textos.modo !== 'mesas_e_comandas' && textos.statusEntrada) return textos.statusEntrada;
    if (this.tipoChip === 'mesa') return 'DIGITE A MESA';
    if (this.tipoChip === 'comanda') return 'DIGITE A COMANDA';
    return 'DIGITE MESA OU COMANDA';
  },

  atualizarStatusEntrada() {
    const status = document.getElementById('atend-status-text');
    if (status) status.textContent = this.textoStatusEntrada();
  },

  setChip(tipo) {
    if (tipo !== 'mesa' && tipo !== 'comanda') return;
    const modo = ComandasModule.getModoAtendimento();
    if (modo === 'apenas_mesas' && tipo !== 'mesa') return;
    if (modo === 'apenas_comandas' && tipo !== 'comanda') return;
    this.tipoChip = tipo;
    try { sessionStorage.setItem('flowpdv_atend_tipo_chip', tipo); } catch (e) {}
    this.pintarChips();
    const label = document.getElementById('atend-numero-label');
    if (label && modo === 'mesas_e_comandas') {
      label.textContent = tipo === 'mesa' ? 'NÚMERO DA MESA' : 'NÚMERO DA COMANDA';
    }
    if (!this.comandaAtual()) this.atualizarStatusEntrada();
    this.focarInput();
  },

  pintarChips() {
    document.querySelectorAll('[data-atend-chip]').forEach((btn) => {
      btn.classList.toggle('on', btn.getAttribute('data-atend-chip') === this.tipoChip);
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-atend-chip') === this.tipoChip));
    });
  },

  mostrarEntrada() {
    const entrada = document.getElementById('atend-entrada');
    const op = document.getElementById('atend-operacao');
    if (entrada) entrada.style.display = 'flex';
    if (op) op.style.display = 'none';
    const num = document.getElementById('atend-numero-input');
    if (num) num.value = '';
    this.adaptarSalao();
    this.atualizarStatusEntrada();
  },

  mostrarOperacao() {
    const entrada = document.getElementById('atend-entrada');
    const op = document.getElementById('atend-operacao');
    if (entrada) entrada.style.display = 'none';
    if (op) op.style.display = '';
    this.renderOperacao();
  },

  abrirPeloNumero() {
    const input = document.getElementById('atend-numero-input');
    const bruto = input ? input.value : '';
    const modo = ComandasModule.getModoAtendimento();
    const id = idComandaPorNumero(modo, bruto, this.tipoChip);
    if (!id) {
      if (window.App) window.App.showToast('Digite um número válido.', 'warning');
      return;
    }
    const tipo = id.indexOf('MESA-') === 0 ? 'mesa' : 'comanda';
    const numero = parseInt(String(id).replace(/\D/g, ''), 10);
    const c = ComandasModule.buscarPorNumero(tipo, numero);
    if (!c) {
      const rotulo = tipo === 'mesa' ? 'Mesa' : 'Comanda';
      if (window.App) window.App.showToast(`${rotulo} ${numero} não existe. Confira o número ou peça ao gestor para cadastrar.`, 'error');
      if (window.PdvModule && typeof window.PdvModule.tocarSomBeep === 'function') window.PdvModule.tocarSomBeep(false);
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }
    if (ComandasModule.comandaAtivaId !== c.id) ComandasModule.numPessoasDivisao = 1;
    ComandasModule.comandaAtivaId = c.id;
    if (!c.itens || c.itens.length === 0) ComandasModule.toggleTaxaServico(c.id, true);
    this.mostrarOperacao();
    this.focarInput();
  },

  soltar() {
    ComandasModule.comandaAtivaId = null;
    this.mostrarEntrada();
    this.focarInput();
  },

  comandaAtual() {
    const id = ComandasModule.comandaAtivaId;
    if (!id) return null;
    return (ComandasModule.getComandas() || []).find((c) => c && c.id === id) || null;
  },

  renderOperacao() {
    const c = this.comandaAtual();
    const status = document.getElementById('atend-status-text');
    if (status) {
      status.textContent = c ? (String(c.nome || '').toUpperCase() + (c.status === 'fechando' ? ' · EM CONFERÊNCIA' : ' ABERTA')) : 'DIGITE O NÚMERO';
    }
    const tbody = document.getElementById('atend-itens-tbody');
    if (tbody) {
      const itens = (c && Array.isArray(c.itens)) ? c.itens : [];
      if (itens.length === 0) {
        tbody.innerHTML = '<tr class="atend-empty-row"><td colspan="6" class="atend-empty-msg">Seu pedido começa aqui.<br>Busque um produto ou leia o código de barras.</td></tr>';
      } else {
        tbody.innerHTML = itens.map((it, idx) => {
          const qtd = parseFloat(it.quantidade) || 0;
          const unit = (parseFloat(it.precoUnitario) || 0).toFixed(2).replace('.', ',');
          const tot = (parseFloat(it.total) || 0).toFixed(2).replace('.', ',');
          return `<tr>
            <td>${idx + 1}</td>
            <td>${this.esc((ComandasModule.codigoBarrasProduto && ComandasModule.codigoBarrasProduto(it)) || it.codigoBarras || it.codigo || '')}</td>
            <td>${this.esc(it.nome || '')}</td>
            <td style="text-align:center;">${qtd}</td>
            <td style="text-align:right;">${unit}</td>
            <td style="text-align:right;">${tot}</td>
          </tr>`;
        }).join('');
      }
    }
    const qtdItens = c && c.itens ? c.itens.reduce((a, i) => a + (parseFloat(i.quantidade) || 0), 0) : 0;
    const total = c ? (parseFloat(c.total) || 0) : 0;
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('atend-subtotal', total.toFixed(2).replace('.', ','));
    setTxt('atend-qtd-itens', String(qtdItens));
    const taxa = c && c.taxaServico ? total * 0.10 : 0;
    const totalComServico = total + taxa;
    const pessoas = ComandasModule.numPessoasDivisao || 1;
    setTxt('atend-total', totalComServico.toFixed(2).replace('.', ','));
    setTxt('atend-taxa-valor', 'R$ ' + taxa.toFixed(2).replace('.', ','));
    setTxt('atend-por-pessoa', 'R$ ' + (totalComServico / pessoas).toFixed(2).replace('.', ',') + ' / pessoa');
    const divisor = document.getElementById('atend-pessoas');
    if (divisor) divisor.value = String(pessoas);
    const checkbox = document.getElementById('atend-taxa-servico');
    if (checkbox) checkbox.checked = !!(c && c.taxaServico);
    for (const id of ['atend-pre-conta', 'atend-transferir']) {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !c || !c.itens || c.itens.length === 0;
    }
  },

  dividirConta(valor) {
    const pessoas = Number(valor);
    if (!Number.isSafeInteger(pessoas) || pessoas < 1) {
      if (window.App) window.App.showToast('Informe uma quantidade inteira de pessoas, a partir de 1.', 'warning');
      this.renderOperacao();
      return false;
    }
    ComandasModule.setDivisaoPessoas(pessoas);
    this.renderOperacao();
    return true;
  },

  alterarTaxa(ativa) {
    const c = this.comandaAtual();
    if (!c) return;
    ComandasModule.toggleTaxaServico(c.id, ativa);
    this.renderOperacao();
  },

  imprimirPreConta() {
    const c = this.comandaAtual();
    if (!c || !c.itens || !c.itens.length) return;
    ComandasModule.imprimirPreConta(c.id);
    this.renderOperacao();
  },

  trocarMesa() {
    const c = this.comandaAtual();
    if (!c) return;
    ComandasModule.abrirModalTransferir(c.id);
    const modal = document.getElementById('modal-transferir-comanda');
    if (modal && modal.classList.contains('active')) document.getElementById('transferir-destino-select')?.focus();
  },

  esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  copiarLogoEOperador() {
    const src = document.getElementById('classic-client-logo');
    const dest = document.getElementById('atend-client-logo');
    if (src && dest && src.getAttribute('src')) dest.src = src.getAttribute('src');
    const u = AuthModule.getUsuario && AuthModule.getUsuario();
    const op = document.getElementById('atend-operator-name');
    if (op) op.textContent = u && u.nome ? ('Operador: ' + u.nome) : 'Operador: —';
  },

  focarInput() {
    const entrada = document.getElementById('atend-entrada');
    const naEntrada = entrada && entrada.style.display !== 'none';
    const alvo = document.getElementById(naEntrada ? 'atend-numero-input' : 'atend-barcode-input');
    if (!alvo) return;
    try { alvo.focus({ preventScroll: true }); } catch (e) { alvo.focus(); }
  },

  encontrarProduto(entrada) {
    const trimEntrada = String(entrada || '').trim();
    if (!trimEntrada) return null;
    const produtos = StorageService.getProdutos() || [];
    let quantidade = 1;
    let codigo = trimEntrada;
    if (trimEntrada.includes('*') && !trimEntrada.startsWith('*')) {
      const partes = trimEntrada.split('*');
      quantidade = parseFloat(String(partes[0]).replace(',', '.')) || 1;
      codigo = String(partes[1] || '').trim();
    }
    const codNormalizado = String(codigo || '').trim().toUpperCase();
    const fardo = produtos.find(p => p.codigoBarrasFardo && String(p.codigoBarrasFardo).trim().toUpperCase() === codNormalizado);
    if (fardo) return { produto: fardo, quantidade };
    const exato = produtos.find(p =>
      String(p.codigoBarras || '').trim().toUpperCase() === codNormalizado ||
      String(p.codigo || '').trim().toUpperCase() === codNormalizado ||
      String(p.id || '').trim().toUpperCase() === codNormalizado
    );
    if (exato) return { produto: exato, quantidade };
    const porNome = produtos.find(p => String(p.nome || '').trim().toUpperCase() === codNormalizado);
    if (porNome) return { produto: porNome, quantidade };
    return null;
  },

  lancarCodigo(entrada) {
    const c = this.comandaAtual();
    if (!c) {
      if (window.App) window.App.showToast((ComandasModule.textosModo && ComandasModule.textosModo().abraPrimeiro) || 'Abra uma mesa ou comanda primeiro.', 'warning');
      return;
    }
    const achou = this.encontrarProduto(entrada);
    if (!achou) {
      if (window.App) window.App.showToast('Produto não encontrado: ' + entrada, 'error');
      return;
    }
    this.pintarItemAtual(achou.produto, achou.quantidade);
    ComandasModule.adicionarItem(c.id, achou.produto, achou.quantidade);
    this.renderOperacao();
    this.focarInput();
  },

  adicionarProdutoPorId(id, isFardo) {
    const c = this.comandaAtual();
    if (!c) {
      if (window.App) window.App.showToast((ComandasModule.textosModo && ComandasModule.textosModo().abraPrimeiro) || 'Abra uma mesa ou comanda primeiro.', 'warning');
      return;
    }
    const produtos = StorageService.getProdutos() || [];
    const p = produtos.find(item => item && item.id === id);
    if (!p) return;
    this.pintarItemAtual(p, 1);
    ComandasModule.adicionarItem(c.id, p, 1);
    this.renderOperacao();
    this.focarInput();
    return isFardo;
  },

  pintarItemAtual(produto, qtd) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const preco = parseFloat(produto.precoVenda || produto.preco || 0);
    set('atend-codigo-barras', produto.codigoBarras || produto.codigo || produto.id || '');
    set('atend-valor-unitario', preco.toFixed(2).replace('.', ','));
    set('atend-total-item', (preco * (parseFloat(qtd) || 1)).toFixed(2).replace('.', ','));
  },

  abrirModalExcluirItem() {
    const c = this.comandaAtual();
    if (!c || !c.itens || c.itens.length === 0) {
      if (window.App) window.App.showToast('Não há item para excluir.', 'warning');
      return;
    }
    const modal = document.getElementById('modal-cancelar-item-carrinho');
    if (modal && modal.classList.contains('active')) {
      this.executarAberturaModalExcluirItem();
      return;
    }
    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('cancelarItem', () => {
        this.executarAberturaModalExcluirItem();
      }, 'Autorização: Cancelar Item');
    } else {
      this.executarAberturaModalExcluirItem();
    }
  },

  executarAberturaModalExcluirItem() {
    const c = this.comandaAtual();
    const itens = (c && Array.isArray(c.itens)) ? c.itens : [];
    if (!itens.length) {
      if (window.App) window.App.showToast('Não há item para excluir.', 'warning');
      return;
    }
    if (window.PdvModule) window.PdvModule._cancelarItemAtendimento = true;

    const pdv = window.PdvModule;
    const modal = document.getElementById('modal-cancelar-item-carrinho');
    const lista = document.getElementById('cancelar-item-lista-tbody');
    const countBadge = document.getElementById('cancelar-item-total-badge');
    const input = document.getElementById('input-cancelar-item-num');
    const titulo = modal ? modal.querySelector('h3') : null;
    if (titulo) titulo.textContent = 'Cancelar Item do Pedido [DEL]';

    if (countBadge) countBadge.textContent = `${itens.length} item(ns)`;
    if (lista) {
      lista.innerHTML = itens.map((item, idx) => {
        const qtd = parseFloat(item.quantidade) || 0;
        const unit = parseFloat(item.precoUnitario) || 0;
        const qtdTxt = pdv ? pdv.formatarQtdItem(item) : String(qtd);
        const peso = pdv ? pdv.itemEhPeso(item) : false;
        return `<div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; cursor: pointer; transition: all 0.15s ease;" onclick="PdvModule.selecionarItemParaCancelar(${idx})" onmouseover="this.style.borderColor='#f87171'; this.style.background='#fef2f2';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#ffffff';">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; padding-right: 12px;">
            <span style="background: #0f172a; color: #38bdf8; font-family: 'JetBrains Mono'; font-weight: 900; font-size: 12px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;">#${idx + 1}</span>
            <div style="min-width: 0;">
              <strong style="font-size: 13.5px; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.esc(item.nome)}</strong>
              <span style="font-size: 11.5px; color: var(--text-muted);">Qtd no pedido: <strong style="color: #0f172a;">${qtdTxt}</strong> × R$ ${unit.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
            <div style="text-align: right; min-width: 85px;">
              <strong style="font-size: 14.5px; font-family: 'JetBrains Mono'; color: #059669; display: block;">R$ ${(unit * qtd).toFixed(2).replace('.', ',')}</strong>
              <span style="font-size: 11px; color: var(--text-muted);">${qtdTxt}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${!peso && qtd > 1 ? `
                <button type="button" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; height: 32px; padding: 0 10px; font-size: 11.5px; font-weight: 800; border-radius: 6px; cursor: pointer;" onclick="event.stopPropagation(); PdvModule.excluirItemPorIndice(${idx}, 1);" title="Remover apenas 1 unidade deste item">
                  -1 UN
                </button>
              ` : ''}
              <button type="button" style="background: #ef4444; color: #ffffff; border: none; height: 32px; padding: 0 10px; font-size: 11.5px; font-weight: 800; border-radius: 6px; cursor: pointer;" onclick="event.stopPropagation(); PdvModule.excluirItemPorIndice(${idx});" title="Remover item #${idx + 1}">
                🗑️ Remover
              </button>
            </div>
          </div>
        </div>`;
      }).join('');
    }

    if (modal) modal.classList.add('active');
    if (input) {
      input.value = itens.length;
      this.atualizarQtdMaximaCancelamento();
      setTimeout(() => {
        input.focus();
        input.select();
      }, 80);
    }
  },

  atualizarQtdMaximaCancelamento() {
    const c = this.comandaAtual();
    const itens = (c && Array.isArray(c.itens)) ? c.itens : [];
    const inputNum = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    const detalhe = document.getElementById('cancelar-item-detalhe-selecionado');
    const num = parseInt(inputNum ? inputNum.value : '', 10);
    const pdv = window.PdvModule;

    if (!isNaN(num) && num >= 1 && num <= itens.length) {
      const item = itens[num - 1];
      if (inputQtd) {
        inputQtd.max = item.quantidade;
        inputQtd.step = pdv && pdv.itemEhPeso(item) ? '0.001' : '1';
        inputQtd.value = pdv ? pdv.valorQtdInput(item.quantidade) : String(item.quantidade);
      }
      if (detalhe) {
        detalhe.style.display = 'block';
        const qtdTxt = pdv ? pdv.formatarQtdItem(item) : String(item.quantidade);
        detalhe.innerHTML = `📌 Item #${num}: <strong>${this.esc(item.nome)}</strong> (Qtd total no pedido: <strong>${qtdTxt}</strong> - Total: <strong>R$ ${((parseFloat(item.precoUnitario) || 0) * (parseFloat(item.quantidade) || 0)).toFixed(2).replace('.', ',')}</strong>)`;
      }
    } else if (detalhe) {
      detalhe.style.display = 'none';
    }
  },

  selecionarItemParaExcluir(idx) {
    const input = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    if (input) input.value = idx + 1;
    this.atualizarQtdMaximaCancelamento();
    if (inputQtd) {
      inputQtd.focus();
      inputQtd.select();
    }
  },

  confirmarExclusaoItemPorNumero() {
    const c = this.comandaAtual();
    const itens = (c && Array.isArray(c.itens)) ? c.itens : [];
    const inputNum = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    const num = parseInt(inputNum ? inputNum.value : '', 10);
    const qtd = parseFloat(String(inputQtd ? inputQtd.value : '1').replace(',', '.')) || 0;

    if (isNaN(num) || num < 1 || num > itens.length) {
      if (window.App) window.App.showToast(`Digite um número válido de item (entre 1 e ${itens.length})!`, 'warning');
      if (inputNum) { inputNum.focus(); inputNum.select(); }
      return;
    }
    if (isNaN(qtd) || qtd <= 0) {
      if (window.App) window.App.showToast('Digite uma quantidade válida para remover!', 'warning');
      if (inputQtd) { inputQtd.focus(); inputQtd.select(); }
      return;
    }
    this.excluirItemPorIndice(num - 1, qtd);
  },

  excluirItemPorIndice(idx, qtd = null) {
    const c = this.comandaAtual();
    const itens = (c && Array.isArray(c.itens)) ? c.itens : [];
    if (idx < 0 || idx >= itens.length) return;
    const item = itens[idx];
    if (!item) return;
    const qtdItem = parseFloat(item.quantidade) || 0;
    const qtdRemover = qtd !== null ? Math.min(parseFloat(qtd) || 0, qtdItem) : qtdItem;
    if (!qtdRemover || qtdRemover <= 0) return;

    const nomeItem = item.nome;
    if (qtdRemover + 1e-6 >= qtdItem) {
      ComandasModule.removerItemComanda(c.id, idx);
      if (window.App) window.App.showToast(`Item #${idx + 1} (${nomeItem}) removido!`, 'info');
    } else {
      ComandasModule.alterarQtdItem(c.id, idx, -qtdRemover);
      if (window.App) window.App.showToast(`Removido ${qtdRemover} de "${nomeItem}".`, 'info');
    }
    this.renderOperacao();
    if (window.PdvModule) window.PdvModule.fecharModalCancelarItem();
  },

  excluirUltimoItem() {
    this.abrirModalExcluirItem();
  }
};
