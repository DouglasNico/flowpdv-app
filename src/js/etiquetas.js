/**
 * etiquetas.js - Gerador e Impressor de Etiquetas de Gôndola e Código de Barras
 */

import { StorageService } from './storage.js';

const MODELOS_ETIQUETA = [
  {
    id: 'a4-gondola-30',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 3×10 — 30 etiquetas (gôndola)',
    hint: '66,7 × 25,4 mm · 30 por folha A4',
    tipo: 'a4',
    cols: 3,
    pageMargin: '7mm 5mm',
    gap: '2.5mm 3.5mm',
    altura: '25.4mm',
    previewCols: 2,
    lojaPx: 7.5,
    nomePx: 9.5,
    precoPx: 14,
    codPx: 7.5,
    barraH: 34
  },
  {
    id: 'a4-2x10-20',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 2×10 — 20 etiquetas (larga)',
    hint: '101,6 × 25,4 mm · 20 por folha A4',
    tipo: 'a4',
    cols: 2,
    pageMargin: '8mm 6mm',
    gap: '2.5mm 4mm',
    altura: '25.4mm',
    previewCols: 2,
    lojaPx: 8,
    nomePx: 11,
    precoPx: 16,
    codPx: 8,
    barraH: 32
  },
  {
    id: 'a4-3x7-21',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 3×7 — 21 etiquetas (gôndola média)',
    hint: '66,7 × 38,1 mm · 21 por folha A4',
    tipo: 'a4',
    cols: 3,
    pageMargin: '8mm 5mm',
    gap: '2.5mm 3.5mm',
    altura: '36mm',
    previewCols: 2,
    lojaPx: 8,
    nomePx: 11,
    precoPx: 18,
    codPx: 8,
    barraH: 36
  },
  {
    id: 'a4-2x7-14',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 2×7 — 14 etiquetas (gôndola grande)',
    hint: '101,6 × 33,9 mm · 14 por folha A4',
    tipo: 'a4',
    cols: 2,
    pageMargin: '10mm 6mm',
    gap: '3mm 4mm',
    altura: '33.9mm',
    previewCols: 1,
    lojaPx: 9,
    nomePx: 13,
    precoPx: 22,
    codPx: 9,
    barraH: 38
  },
  {
    id: 'a4-2x5-10',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 2×5 — 10 etiquetas (preço grande)',
    hint: '101,6 × 50,8 mm · 10 por folha A4',
    tipo: 'a4',
    cols: 2,
    pageMargin: '10mm 8mm',
    gap: '4mm 5mm',
    altura: '50mm',
    previewCols: 1,
    lojaPx: 10,
    nomePx: 15,
    precoPx: 28,
    codPx: 10,
    barraH: 42
  },
  {
    id: 'a4-mini-65',
    grupo: 'Folha A4 (Pimaco)',
    label: 'Pimaco 5×13 — 65 etiquetas (mini)',
    hint: '38,1 × 21,2 mm · 65 por folha A4',
    tipo: 'a4',
    cols: 5,
    pageMargin: '10mm 5mm',
    gap: '1mm 2mm',
    altura: '20.5mm',
    previewCols: 3,
    lojaPx: 6,
    nomePx: 7.5,
    precoPx: 11,
    codPx: 6.5,
    barraH: 22
  },
  {
    id: 'termica-40',
    grupo: 'Bobina térmica',
    label: 'Bobina térmica 40 mm',
    hint: 'Bobina contínua 40 mm',
    tipo: 'termica',
    pageSize: '40mm auto',
    previewMaxWidth: '180px',
    lojaPx: 7.5,
    nomePx: 10,
    precoPx: 14,
    codPx: 7.5,
    barraH: 28
  },
  {
    id: 'termica-58',
    grupo: 'Bobina térmica',
    label: 'Bobina térmica 58 mm',
    hint: 'Bobina contínua 58 mm (padrão PDV)',
    tipo: 'termica',
    pageSize: '58mm auto',
    previewMaxWidth: '220px',
    lojaPx: 8.5,
    nomePx: 11,
    precoPx: 16,
    codPx: 8.5,
    barraH: 34
  },
  {
    id: 'termica-80',
    grupo: 'Bobina térmica',
    label: 'Bobina térmica 80 mm',
    hint: 'Bobina contínua 80 mm',
    tipo: 'termica',
    pageSize: '80mm auto',
    previewMaxWidth: '280px',
    lojaPx: 10,
    nomePx: 13,
    precoPx: 20,
    codPx: 9.5,
    barraH: 38
  },
  {
    id: 'argox-40x30',
    grupo: 'Argox / adesiva térmica',
    label: 'Argox 40×30 mm',
    hint: 'Etiqueta adesiva 40 × 30 mm',
    tipo: 'argox',
    pageSize: '40mm 30mm',
    altura: '30mm',
    previewMaxWidth: '200px',
    lojaPx: 7,
    nomePx: 9.5,
    precoPx: 13,
    codPx: 7,
    barraH: 24
  },
  {
    id: 'argox-50x30',
    grupo: 'Argox / adesiva térmica',
    label: 'Argox 50×30 mm',
    hint: 'Etiqueta adesiva 50 × 30 mm',
    tipo: 'argox',
    pageSize: '50mm 30mm',
    altura: '30mm',
    previewMaxWidth: '240px',
    lojaPx: 8,
    nomePx: 10.5,
    precoPx: 15,
    codPx: 8,
    barraH: 28
  },
  {
    id: 'argox-60x40',
    grupo: 'Argox / adesiva térmica',
    label: 'Argox 60×40 mm',
    hint: 'Etiqueta adesiva 60 × 40 mm',
    tipo: 'argox',
    pageSize: '60mm 40mm',
    altura: '40mm',
    previewMaxWidth: '260px',
    lojaPx: 9,
    nomePx: 12,
    precoPx: 18,
    codPx: 8.5,
    barraH: 32
  },
  {
    id: 'argox-100x50',
    grupo: 'Argox / adesiva térmica',
    label: 'Argox 100×50 mm (gôndola)',
    hint: 'Etiqueta adesiva 100 × 50 mm',
    tipo: 'argox',
    pageSize: '100mm 50mm',
    altura: '50mm',
    previewMaxWidth: '300px',
    lojaPx: 11,
    nomePx: 15,
    precoPx: 26,
    codPx: 10,
    barraH: 40
  }
];

const ALIAS_MODELO = {
  'termica-avulsa': 'termica-58'
};

export const EtiquetasModule = {
  produtosSelecionados: new Map(),
  modeloSelecionado: 'a4-gondola-30',

  init() {
    try {
      const salvo = localStorage.getItem('flowpdv_etiqueta_modelo');
      if (salvo) this.modeloSelecionado = this.obterModelo(salvo).id;
    } catch (e) {}
    this.bindEventos();
    this.preencherSelectModelos();
  },

  bindEventos() {
    const buscaInput = document.getElementById('etiquetas-busca-input');
    if (buscaInput) {
      buscaInput.addEventListener('input', () => this.renderListaProdutos());
    }
    const selectModelo = document.getElementById('etiquetas-modelo-select');
    if (selectModelo) {
      selectModelo.addEventListener('change', () => this.mudarModelo(selectModelo.value));
    }
  },

  preencherSelectModelos() {
    const select = document.getElementById('etiquetas-modelo-select');
    if (!select) return;

    const grupos = [];
    MODELOS_ETIQUETA.forEach(m => {
      if (!grupos.includes(m.grupo)) grupos.push(m.grupo);
    });

    select.innerHTML = grupos.map(grupo => {
      const opts = MODELOS_ETIQUETA
        .filter(m => m.grupo === grupo)
        .map(m => `<option value="${m.id}">${m.label}</option>`)
        .join('');
      return `<optgroup label="${grupo}">${opts}</optgroup>`;
    }).join('');

    select.value = this.modeloSelecionado;
    this.atualizarHintModelo();
  },

  atualizarHintModelo() {
    const hintEl = document.getElementById('etiquetas-modelo-hint');
    if (!hintEl) return;
    const modelo = this.obterModelo(this.modeloSelecionado);
    hintEl.textContent = modelo.hint || '';
  },

  obterModelo(id) {
    const real = ALIAS_MODELO[id] || id;
    return MODELOS_ETIQUETA.find(m => m.id === real) || MODELOS_ETIQUETA[0];
  },

  abrirModal() {
    const modal = document.getElementById('modal-gerador-etiquetas');
    if (!modal) return;

    this.produtosSelecionados.clear();

    const buscaInput = document.getElementById('etiquetas-busca-input');
    if (buscaInput) buscaInput.value = '';

    this.preencherSelectModelos();
    this.renderListaProdutos();
    this.atualizarContadorEtiquetas();
    this.renderPreviewEtiquetas();

    modal.classList.add('active');
  },

  fecharModal() {
    const modal = document.getElementById('modal-gerador-etiquetas');
    if (modal) modal.classList.remove('active');
  },

  renderListaProdutos() {
    const container = document.getElementById('etiquetas-produtos-lista');
    if (!container) return;

    const termo = (document.getElementById('etiquetas-busca-input')?.value || '').toLowerCase().trim();
    const todosProdutos = StorageService.getProdutos().filter(p => p.ativo !== false);

    const filtrados = todosProdutos.filter(p => {
      if (!termo) return true;
      return StorageService.produtoCombinaBusca(p, termo, ['nome', 'codigo', 'codigoBarras', 'categoria']);
    });

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          Nenhum produto localizado para este filtro.
        </div>
      `;
      return;
    }

    container.innerHTML = filtrados.map(prod => {
      const qtdAtual = this.produtosSelecionados.get(prod.id) || 0;
      const isSelected = qtdAtual > 0;
      const preco = parseFloat(prod.precoVenda || prod.preco || 0).toFixed(2).replace('.', ',');
      const cod = prod.codigoBarras || prod.codigo || prod.id;

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; background: ${isSelected ? '#f0fdf4' : '#ffffff'}; transition: background 0.15s ease;">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <input type="checkbox" style="width: 17px; height: 17px; cursor: pointer;" ${isSelected ? 'checked' : ''} onchange="EtiquetasModule.toggleProduto('${prod.id}', this.checked)">
            <div style="min-width: 0;">
              <strong style="font-size: 13px; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prod.nome}</strong>
              <span style="font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono';">Cód: ${cod} &bull; R$ ${preco}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; color: var(--text-dim);">Qtd:</span>
            <input type="number" min="0" max="500" value="${qtdAtual}" style="width: 54px; height: 32px; font-size: 13px; font-weight: 800; text-align: center; border: 1px solid #cbd5e1; border-radius: 6px;" onchange="EtiquetasModule.alterarQuantidade('${prod.id}', this.value)">
          </div>
        </div>
      `;
    }).join('');
  },

  toggleProduto(prodId, checked) {
    if (checked) {
      if (!this.produtosSelecionados.has(prodId) || this.produtosSelecionados.get(prodId) === 0) {
        this.produtosSelecionados.set(prodId, 1);
      }
    } else {
      this.produtosSelecionados.delete(prodId);
    }
    this.renderListaProdutos();
    this.atualizarContadorEtiquetas();
    this.renderPreviewEtiquetas();
  },

  alterarQuantidade(prodId, qtdVal) {
    const qtd = parseInt(qtdVal, 10) || 0;
    if (qtd > 0) {
      this.produtosSelecionados.set(prodId, qtd);
    } else {
      this.produtosSelecionados.delete(prodId);
    }
    this.renderListaProdutos();
    this.atualizarContadorEtiquetas();
    this.renderPreviewEtiquetas();
  },

  selecionarTodos() {
    const todos = StorageService.getProdutos().filter(p => p.ativo !== false);
    todos.forEach(p => {
      this.produtosSelecionados.set(p.id, 1);
    });
    this.renderListaProdutos();
    this.atualizarContadorEtiquetas();
    this.renderPreviewEtiquetas();
  },

  desmarcarTodos() {
    this.produtosSelecionados.clear();
    this.renderListaProdutos();
    this.atualizarContadorEtiquetas();
    this.renderPreviewEtiquetas();
  },

  mudarModelo(modelo) {
    this.modeloSelecionado = this.obterModelo(modelo).id;
    const select = document.getElementById('etiquetas-modelo-select');
    if (select && select.value !== this.modeloSelecionado) select.value = this.modeloSelecionado;
    try { localStorage.setItem('flowpdv_etiqueta_modelo', this.modeloSelecionado); } catch (e) {}
    this.atualizarHintModelo();
    this.renderPreviewEtiquetas();
  },

  atualizarContadorEtiquetas() {
    let totalEtiquetas = 0;
    for (const qtd of this.produtosSelecionados.values()) {
      totalEtiquetas += qtd;
    }

    const badgeEl = document.getElementById('etiquetas-total-badge');
    if (badgeEl) {
      badgeEl.textContent = `${totalEtiquetas} ${totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'}`;
    }
  },

  listarItensSelecionados() {
    const todosProdutos = StorageService.getProdutos();
    const listaItens = [];
    for (const [prodId, qtd] of this.produtosSelecionados.entries()) {
      const p = todosProdutos.find(item => item.id === prodId);
      if (p) {
        for (let i = 0; i < qtd; i++) listaItens.push(p);
      }
    }
    return listaItens;
  },

  nomeLoja() {
    const config = StorageService.getConfig() || {};
    return config.nomeEmpresa || config.nomeLoja || 'FlowPDV';
  },

  dadosProduto(p) {
    return {
      nome: p.nome || '',
      preco: parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ','),
      cod: p.codigoBarras || p.codigo || p.id
    };
  },

  gerarSvgCodigoBarras(codigo, altura = 34) {
    const cod = String(codigo || '7890000000000').replace(/[^a-zA-Z0-9]/g, '') || '0000';
    const height = Number(altura) || 34;

    let pattern = '';
    for (let i = 0; i < cod.length; i++) {
      const charCode = cod.charCodeAt(i);
      const bin = (charCode % 16).toString(2).padStart(4, '0');
      pattern += (bin + (i % 2 === 0 ? '101' : '010'));
    }
    pattern = '101011' + pattern + '1101011';

    let svgBars = '';
    let x = 4;
    const barWidth = 1.6;

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        svgBars += `<rect x="${x.toFixed(1)}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
      }
      x += barWidth;
    }

    const totalWidth = x + 4;
    return `
      <svg viewBox="0 0 ${totalWidth} ${height}" style="width: 100%; max-height: ${height}px; display: block; margin: 0 auto;">
        ${svgBars}
      </svg>
    `;
  },

  htmlCardEtiqueta(p, modelo, modo) {
    const { nome, preco, cod } = this.dadosProduto(p);
    const loja = this.nomeLoja();
    const barra = this.gerarSvgCodigoBarras(cod, modelo.barraH);
    const preview = modo === 'preview';

    if (modelo.tipo === 'a4') {
      const box = preview
        ? `border: 1px dashed #94a3b8; border-radius: 6px; padding: 5px 6px; min-height: 88px;`
        : '';
      return `
        <div class="${preview ? '' : 'etiqueta-card'}" style="background: #ffffff; text-align: center; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; overflow: hidden; ${box}">
          <div style="font-size: ${modelo.lojaPx}px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${loja}</div>
          <div style="font-size: ${modelo.nomePx}px; font-weight: 900; color: #0f172a; line-height: 1.1; margin: 2px 0; max-height: ${modelo.nomePx * 2.2}px; overflow: hidden; word-break: break-word;">${nome}</div>
          <div style="margin: 2px 0; max-height: ${modelo.barraH}px; overflow: hidden;">${barra}</div>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px; gap: 4px;">
            <span style="font-size: ${modelo.codPx}px; font-family: monospace; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cod}</span>
            <strong style="font-size: ${modelo.precoPx}px; font-weight: 900; color: #000000; font-family: 'JetBrains Mono', 'Courier New', monospace; white-space: nowrap;">R$ ${preco}</strong>
          </div>
        </div>
      `;
    }

    const borda = preview ? 'border: 1px solid #000000; border-radius: 4px; padding: 6px 8px;' : '';
    return `
      <div class="${preview ? '' : 'etiqueta-termica-card'}" style="background: #ffffff; text-align: center; ${borda}">
        <div style="font-size: ${modelo.lojaPx}px; font-weight: 800; text-transform: uppercase;">${loja}</div>
        <div style="font-size: ${modelo.nomePx}px; font-weight: 900; margin: 2px 0; line-height: 1.1; overflow: hidden;">${nome}</div>
        <div style="margin: 2px 0; max-height: ${modelo.barraH}px; overflow: hidden;">${barra}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px; gap: 4px;">
          <span style="font-size: ${modelo.codPx}px; font-family: monospace;">${cod}</span>
          <strong style="font-size: ${modelo.precoPx}px; font-weight: 900; font-family: 'JetBrains Mono', 'Courier New', monospace;">R$ ${preco}</strong>
        </div>
      </div>
    `;
  },

  renderPreviewEtiquetas() {
    const previewContainer = document.getElementById('etiquetas-preview-container');
    if (!previewContainer) return;

    const listaItens = this.listarItensSelecionados();
    if (listaItens.length === 0) {
      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 280px; color: var(--text-muted); text-align: center; padding: 20px;">
          <span style="font-size: 36px; margin-bottom: 8px;">🏷️</span>
          <strong style="font-size: 14px; color: var(--text-main);">Nenhum produto selecionado</strong>
          <span style="font-size: 12px; margin-top: 4px;">Marque os produtos na lista ao lado para visualizar a prévia das etiquetas.</span>
        </div>
      `;
      return;
    }

    const modelo = this.obterModelo(this.modeloSelecionado);
    const cards = listaItens.map(p => this.htmlCardEtiqueta(p, modelo, 'preview')).join('');

    if (modelo.tipo === 'a4') {
      previewContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(${modelo.previewCols}, minmax(0, 1fr)); gap: 6px; padding: 6px; background: #ffffff;">
          ${cards}
        </div>
      `;
      return;
    }

    previewContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; max-width: ${modelo.previewMaxWidth || '220px'}; margin: 0 auto; padding: 8px; background: #ffffff;">
        ${cards}
      </div>
    `;
  },

  htmlDocumentoImpressao(listaItens, modelo) {
    const loja = this.nomeLoja();
    const cards = listaItens.map(p => this.htmlCardEtiqueta(p, modelo, 'print')).join('');

    if (modelo.tipo === 'a4') {
      return `<!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Impressão de Etiquetas A4 — ${loja}</title>
          <style>
            @page { size: A4 portrait; margin: ${modelo.pageMargin}; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            body { background: #ffffff; color: #000000; width: 100%; }
            .grid-a4 {
              display: grid;
              grid-template-columns: repeat(${modelo.cols}, minmax(0, 1fr));
              gap: ${modelo.gap};
              width: 100%;
            }
            .etiqueta-card {
              border: 1px dashed #94a3b8;
              border-radius: 4px;
              padding: 1.6mm 2mm;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: ${modelo.altura};
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="grid-a4">${cards}</div>
        </body>
        </html>`;
    }

    const corte = modelo.tipo === 'argox'
      ? `page-break-after: always; height: ${modelo.altura || '30mm'}; display: flex; flex-direction: column; justify-content: center; padding: 1.5mm;`
      : 'border-bottom: 1px dashed #000000; padding: 4mm 2mm;';

    return `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Impressão de Etiquetas — ${loja}</title>
        <style>
          @page { size: ${modelo.pageSize}; margin: 2mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          body { background: #ffffff; color: #000000; width: 100%; }
          .etiqueta-termica-card {
            ${corte}
            text-align: center;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>${cards}</body>
      </html>`;
  },

  imprimirEtiquetas() {
    const listaItens = this.listarItensSelecionados();
    if (listaItens.length === 0) {
      if (window.App) window.App.showToast('Selecione pelo menos um produto para imprimir etiquetas!', 'warning');
      return;
    }

    const modelo = this.obterModelo(this.modeloSelecionado);
    const htmlContent = this.htmlDocumentoImpressao(listaItens, modelo);

    try {
      const win = window.open('', '_blank', 'width=800,height=900');
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          setTimeout(() => win.close(), 1200);
        }, 300);
      }
    } catch (e) {
      console.error('[Etiquetas] Erro ao imprimir:', e);
    }
  }
};
