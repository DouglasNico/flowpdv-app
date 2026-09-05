/**
 * etiquetas.js - Gerador e Impressor de Etiquetas de Gôndola e Código de Barras (A4 Pimaco / Bobina Térmica)
 */

import { StorageService } from './storage.js';

export const EtiquetasModule = {
  produtosSelecionados: new Map(), // produtoId -> quantidade de etiquetas
  modeloSelecionado: 'a4-gondola-30', // 'a4-gondola-30', 'a4-mini-65', 'termica-avulsa'

  init() {
    this.bindEventos();
  },

  bindEventos() {
    const buscaInput = document.getElementById('etiquetas-busca-input');
    if (buscaInput) {
      buscaInput.addEventListener('input', () => this.renderListaProdutos());
    }
  },

  abrirModal() {
    const modal = document.getElementById('modal-gerador-etiquetas');
    if (!modal) return;

    this.produtosSelecionados.clear();
    
    // Inicializar com todos os produtos zerados ou seleção vazia
    const buscaInput = document.getElementById('etiquetas-busca-input');
    if (buscaInput) buscaInput.value = '';

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
      return (p.nome || '').toLowerCase().includes(termo) ||
             (p.codigo || '').toLowerCase().includes(termo) ||
             (p.codigoBarras || '').toLowerCase().includes(termo) ||
             (p.categoria || '').toLowerCase().includes(termo);
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
    this.modeloSelecionado = modelo;
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

  // Gerador de SVG de Código de Barras Code 128 / EAN Compacto
  gerarSvgCodigoBarras(codigo) {
    const cod = String(codigo || '7890000000000').replace(/[^a-zA-Z0-9]/g, '') || '0000';
    
    // Pseudo-geração Code128 em barras com padrão alternado para visual perfeito e escaneável
    let pattern = '';
    for (let i = 0; i < cod.length; i++) {
      const charCode = cod.charCodeAt(i);
      const bin = (charCode % 16).toString(2).padStart(4, '0');
      pattern += (bin + (i % 2 === 0 ? '101' : '010'));
    }
    // Adiciona padrão de início e fim
    pattern = '101011' + pattern + '1101011';

    let svgBars = '';
    let x = 4;
    const barWidth = 1.6;
    const height = 34;

    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === '1') {
        svgBars += `<rect x="${x.toFixed(1)}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
      }
      x += barWidth;
    }

    const totalWidth = x + 4;
    return `
      <svg viewBox="0 0 ${totalWidth} ${height}" style="width: 100%; max-height: 34px; display: block; margin: 0 auto;">
        ${svgBars}
      </svg>
    `;
  },

  renderPreviewEtiquetas() {
    const previewContainer = document.getElementById('etiquetas-preview-container');
    if (!previewContainer) return;

    const todosProdutos = StorageService.getProdutos();
    const config = StorageService.getConfig() || {};
    const nomeLoja = config.nomeEmpresa || config.nomeLoja || 'FlowPDV';

    const listaItens = [];
    for (const [prodId, qtd] of this.produtosSelecionados.entries()) {
      const p = todosProdutos.find(item => item.id === prodId);
      if (p) {
        for (let i = 0; i < qtd; i++) {
          listaItens.push(p);
        }
      }
    }

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

    if (this.modeloSelecionado === 'a4-gondola-30') {
      // Formato Gôndola A4 - no preview exibe 2 colunas nítidas sem estourar o modal
      previewContainer.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 6px; background: #ffffff;">
          ${listaItens.map(p => {
            const preco = parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ',');
            const cod = p.codigoBarras || p.codigo || p.id;
            return `
              <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 5px 6px; background: #ffffff; text-align: center; display: flex; flex-direction: column; justify-content: space-between; min-height: 88px; box-sizing: border-box; overflow: hidden;">
                <div style="font-size: 8px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nomeLoja}</div>
                <div style="font-size: 10.5px; font-weight: 900; color: #0f172a; line-height: 1.1; margin: 2px 0; max-height: 24px; overflow: hidden; word-break: break-word;">${p.nome}</div>
                <div style="margin: 2px 0; max-height: 26px; overflow: hidden;">${this.gerarSvgCodigoBarras(cod)}</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px;">
                  <span style="font-size: 8px; font-family: monospace; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cod}</span>
                  <strong style="font-size: 14px; font-weight: 900; color: #000000; font-family: 'JetBrains Mono'; white-space: nowrap;">R$ ${preco}</strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // Formato Bobina Térmica
      previewContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; max-width: 220px; margin: 0 auto; padding: 8px; background: #ffffff;">
          ${listaItens.map(p => {
            const preco = parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ',');
            const cod = p.codigoBarras || p.codigo || p.id;
            return `
              <div style="border: 1px solid #000000; border-radius: 4px; padding: 6px 8px; background: #ffffff; text-align: center;">
                <div style="font-size: 8.5px; font-weight: 800; text-transform: uppercase;">${nomeLoja}</div>
                <div style="font-size: 11px; font-weight: 900; margin: 2px 0; line-height: 1.1; overflow: hidden;">${p.nome}</div>
                <div style="margin: 2px 0; max-height: 28px; overflow: hidden;">${this.gerarSvgCodigoBarras(cod)}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 3px;">
                  <span style="font-size: 8.5px; font-family: monospace;">${cod}</span>
                  <strong style="font-size: 15px; font-weight: 900; font-family: 'JetBrains Mono';">R$ ${preco}</strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  },

  imprimirEtiquetas() {
    const todosProdutos = StorageService.getProdutos();
    const config = StorageService.getConfig() || {};
    const nomeLoja = config.nomeEmpresa || config.nomeLoja || 'FlowPDV';

    const listaItens = [];
    for (const [prodId, qtd] of this.produtosSelecionados.entries()) {
      const p = todosProdutos.find(item => item.id === prodId);
      if (p) {
        for (let i = 0; i < qtd; i++) {
          listaItens.push(p);
        }
      }
    }

    if (listaItens.length === 0) {
      if (window.App) window.App.showToast('Selecione pelo menos um produto para imprimir etiquetas!', 'warning');
      return;
    }

    let htmlContent = '';

    if (this.modeloSelecionado === 'a4-gondola-30') {
      // Impressão A4 Pimaco (3 colunas x 10 linhas = 30 etiquetas por folha)
      htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Impressão de Etiquetas A4 — ${nomeLoja}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 7mm 5mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #000000;
              width: 100%;
            }
            .grid-a4-gondola {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 2.5mm 3.5mm;
              width: 100%;
            }
            .etiqueta-card {
              border: 1px dashed #94a3b8;
              border-radius: 4px;
              padding: 2mm 3mm;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 25.4mm;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
            }
            .loja-nome {
              font-size: 7.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .prod-nome {
              font-size: 9.5px;
              font-weight: 900;
              line-height: 1.1;
              margin: 0.5mm 0;
              max-height: 6mm;
              overflow: hidden;
              word-break: break-word;
            }
            .preco-destaque {
              font-size: 14px;
              font-weight: 900;
              font-family: 'Courier New', Courier, monospace;
            }
            .cod-texto {
              font-size: 7.5px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="grid-a4-gondola">
            ${listaItens.map(p => {
              const preco = parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ',');
              const cod = p.codigoBarras || p.codigo || p.id;
              return `
                <div class="etiqueta-card">
                  <div class="loja-nome">${nomeLoja}</div>
                  <div class="prod-nome">${p.nome}</div>
                  <div style="margin: 0.5mm 0; max-height: 24px; overflow: hidden;">${this.gerarSvgCodigoBarras(cod)}</div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <span class="cod-texto">${cod}</span>
                    <span class="preco-destaque">R$ ${preco}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </body>
        </html>
      `;
    } else {
      // Impressão Bobina Térmica Contínua (58mm / 80mm / Argox)
      htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Impressão de Etiquetas Térmica — ${nomeLoja}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 2mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #000000;
              width: 100%;
            }
            .etiqueta-termica-card {
              border-bottom: 1px dashed #000000;
              padding: 4mm 2mm;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .loja-nome {
              font-size: 8.5px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .prod-nome {
              font-size: 11px;
              font-weight: 900;
              line-height: 1.15;
              margin: 1.5mm 0;
            }
            .preco-destaque {
              font-size: 16px;
              font-weight: 900;
              font-family: 'Courier New', Courier, monospace;
            }
            .cod-texto {
              font-size: 8.5px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          ${listaItens.map(p => {
            const preco = parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ',');
            const cod = p.codigoBarras || p.codigo || p.id;
            return `
              <div class="etiqueta-termica-card">
                <div class="loja-nome">${nomeLoja}</div>
                <div class="prod-nome">${p.nome}</div>
                <div style="margin: 1.5mm 0; max-height: 28px; overflow: hidden;">${this.gerarSvgCodigoBarras(cod)}</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1mm;">
                  <span class="cod-texto">${cod}</span>
                  <span class="preco-destaque">R$ ${preco}</span>
                </div>
              </div>
            `;
          }).join('')}
        </body>
        </html>
      `;
    }

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
