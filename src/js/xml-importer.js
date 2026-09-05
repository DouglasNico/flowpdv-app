/**
 * xml-importer.js - Importador Automático de XML de Notas Fiscais de Entrada (NF-e)
 * FlowPDV SaaS - Gestão Inteligente de Compras, Estoque e Contas a Pagar
 */

import { StorageService } from './storage.js';
import { AuditModule } from './audit.js';

export const XmlImporterModule = {
  dadosNotaAtual: null,
  itensProcessados: [],
  duplicatasProcessadas: [],

  init() {
    this.bindDropzone();
  },

  abrirModalImportarXml() {
    if (!StorageService.isModuloAtivo('importadorXml')) {
      window.App.showToast('⚠️ O módulo de Importação de XML não está habilitado para esta licença.', 'warning');
      return;
    }

    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') 
      ? window.AuthModule.isGerente() 
      : StorageService.isGerente();

    if (!isGerente) {
      if (window.AuthModule && typeof window.AuthModule.solicitarAutorizacaoGerente === 'function') {
        window.AuthModule.solicitarAutorizacaoGerente(() => {
          this.abrirModalImportarXml();
        }, 'Acesso restrito ao Gerente para Importar Nota Fiscal XML');
      } else {
        window.App.showToast('⛔ Apenas Gerentes ou Administradores podem importar XML de Notas!', 'warning');
      }
      return;
    }

    const modal = document.getElementById('modal-importar-xml-nfe');
    if (!modal) return;

    this.resetarEstado();
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  },

  fecharModalImportarXml() {
    const modal = document.getElementById('modal-importar-xml-nfe');
    if (modal) {
      modal.classList.remove('active');
    }
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
    this.resetarEstado();
  },

  resetarEstado() {
    this.dadosNotaAtual = null;
    this.itensProcessados = [];
    this.duplicatasProcessadas = [];

    const dropzone = document.getElementById('xml-dropzone-area');
    const previewContainer = document.getElementById('xml-preview-container');
    const fileInput = document.getElementById('xml-file-input');

    if (dropzone) dropzone.style.display = 'flex';
    if (previewContainer) previewContainer.style.display = 'none';
    if (fileInput) fileInput.value = '';
  },

  bindDropzone() {
    const dropzone = document.getElementById('xml-dropzone-area');
    const fileInput = document.getElementById('xml-file-input');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.lerArquivoXml(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.lerArquivoXml(e.target.files[0]);
      }
    });
  },

  lerArquivoXml(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      alert('⚠️ Por favor, selecione um arquivo XML de Nota Fiscal válido (.xml)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const conteudo = e.target.result;
        this.parseXmlNFe(conteudo, file.name);
      } catch (err) {
        console.error('[XmlImporter] Erro ao ler XML:', err);
        alert('❌ Erro ao processar o arquivo XML: ' + (err.message || 'Formato de XML inválido.'));
      }
    };
    reader.onerror = () => {
      alert('❌ Erro ao abrir o arquivo no computador.');
    };
    reader.readAsText(file);
  },

  parseXmlNFe(xmlString, nomeArquivo = '') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('O arquivo fornecido não é um XML válido.');
    }

    // Localizar elemento infNFe
    const infNFe = xmlDoc.querySelector('infNFe') || xmlDoc.querySelector('NFe');
    if (!infNFe) {
      throw new Error('Estrutura de NF-e (infNFe) não encontrada neste XML.');
    }

    // 1. Dados da Nota Fiscal
    const ide = xmlDoc.querySelector('ide');
    const emit = xmlDoc.querySelector('emit');
    const total = xmlDoc.querySelector('total ICMSTot') || xmlDoc.querySelector('ICMSTot');

    const numeroNota = this.getNodeText(ide, 'nNF') || 'S/N';
    const serieNota = this.getNodeText(ide, 'serie') || '1';
    const dataEmissao = this.getNodeText(ide, 'dhEmi') || this.getNodeText(ide, 'dEmi') || new Date().toISOString();
    const chaveAcesso = (infNFe.getAttribute('Id') || '').replace(/\D/g, '');

    const fornecedorNome = this.getNodeText(emit, 'xNome') || this.getNodeText(emit, 'xFant') || 'Fornecedor Desconhecido';
    const fornecedorCnpj = this.formatarCnpj(this.getNodeText(emit, 'CNPJ') || this.getNodeText(emit, 'CPF') || '');
    const valorTotalNota = parseFloat(this.getNodeText(total, 'vNF')) || 0;

    this.dadosNotaAtual = {
      numeroNota,
      serieNota,
      dataEmissao: dataEmissao.split('T')[0],
      chaveAcesso,
      fornecedorNome,
      fornecedorCnpj,
      valorTotalNota,
      nomeArquivo
    };

    // 2. Extrair Itens / Produtos (<det>)
    const detNodes = xmlDoc.querySelectorAll('det');
    const produtosEstoque = StorageService.getProdutos() || [];
    this.itensProcessados = [];

    detNodes.forEach((det, index) => {
      const prod = det.querySelector('prod');
      if (!prod) return;

      const cProd = this.getNodeText(prod, 'cProd');
      let cEAN = this.getNodeText(prod, 'cEAN');
      if (cEAN === 'SEM GTIN' || cEAN === 'SEM_GTIN' || cEAN.length < 5) cEAN = '';

      const rawXProd = this.getNodeText(prod, 'xProd');
      const ncm = this.getNodeText(prod, 'NCM');
      const cest = this.getNodeText(prod, 'CEST');
      const cfop = this.getNodeText(prod, 'CFOP');
      const uCom = (this.getNodeText(prod, 'uCom') || 'UN').toUpperCase().trim();
      const qCom = parseFloat(this.getNodeText(prod, 'qCom')) || 0;
      const vUnCom = parseFloat(this.getNodeText(prod, 'vUnCom')) || 0;
      const vProd = parseFloat(this.getNodeText(prod, 'vProd')) || (qCom * vUnCom);

      // Localizar produto correspondente no estoque existente
      let produtoExistente = null;
      if (cEAN) {
        produtoExistente = produtosEstoque.find(p => p.codigoBarras === cEAN || p.codigoBarrasFardo === cEAN);
      }
      if (!produtoExistente && rawXProd) {
        const xProdNorm = rawXProd.toLowerCase().trim();
        produtoExistente = produtosEstoque.find(p => p.nome && p.nome.toLowerCase().trim() === xProdNorm);
      }

      // Nome elegante em Title Case se for novo cadastro ou o nome já existente
      const xProd = produtoExistente ? produtoExistente.nome : this.formatarNomeProduto(rawXProd);

      // Extrair Rastreabilidade (Lote & Validade) se presente na NF-e (tags <rastro> ou <med>)
      let dataValidadeXml = '';
      let numeroLoteXml = '';
      const rastroNode = det.querySelector('rastro') || prod.querySelector('rastro') || det.querySelector('med');
      if (rastroNode) {
        dataValidadeXml = this.getNodeText(rastroNode, 'dVal') || '';
        numeroLoteXml = this.getNodeText(rastroNode, 'nLote') || '';
      }

      const isUnidadeColetiva = (uCom === 'CX' || uCom === 'FD' || uCom === 'PAC' || uCom === 'PCT' || uCom === 'FARDO' || uCom === 'CAIXA');
      const fatorConversaoPadrao = isUnidadeColetiva ? 12 : 1;

      // Calcular Preço de Venda Sugerido
      let precoVendaSugerido = 0;
      if (produtoExistente && produtoExistente.precoVenda > 0) {
        precoVendaSugerido = produtoExistente.precoVenda;
      } else {
        // Aplica margem padrão de 35% de lucro sobre o custo unitário
        const custoUnitario = isUnidadeColetiva ? (vUnCom / fatorConversaoPadrao) : vUnCom;
        precoVendaSugerido = Math.ceil(custoUnitario * 1.35 * 10) / 10;
        if (precoVendaSugerido <= custoUnitario) precoVendaSugerido = custoUnitario * 1.30;
      }

      this.itensProcessados.push({
        index,
        cProd,
        cEAN: cEAN || (produtoExistente ? produtoExistente.codigoBarras : ''),
        xProd,
        ncm,
        cest,
        cfop,
        uComOriginal: uCom,
        fatorConversao: fatorConversaoPadrao,
        qComOriginal: qCom,
        vUnComOriginal: vUnCom,
        vProdTotal: vProd,
        dataValidade: dataValidadeXml || (produtoExistente ? (produtoExistente.dataValidade || '') : ''),
        numeroLote: numeroLoteXml || (produtoExistente ? (produtoExistente.lote || '') : ''),
        produtoExistenteId: produtoExistente ? produtoExistente.id : null,
        produtoExistenteNome: produtoExistente ? produtoExistente.nome : null,
        estoqueAtual: produtoExistente ? (produtoExistente.estoque || 0) : 0,
        categoria: this.adivinharCategoria(xProd, ncm, produtoExistente),
        precoCustoFinal: isUnidadeColetiva ? (vUnCom / fatorConversaoPadrao) : vUnCom,
        precoVendaFinal: precoVendaSugerido,
        importarItem: true
      });
    });

    // 3. Extrair Duplicatas / Boletos (<cobr> -> <dup>)
    const dupNodes = xmlDoc.querySelectorAll('cobr dup');
    this.duplicatasProcessadas = [];

    if (dupNodes && dupNodes.length > 0) {
      dupNodes.forEach((dup, idx) => {
        const nDup = this.getNodeText(dup, 'nDup') || String(idx + 1).padStart(3, '0');
        const dVenc = this.getNodeText(dup, 'dVenc') || new Date().toISOString().split('T')[0];
        const vDup = parseFloat(this.getNodeText(dup, 'vDup')) || 0;

        this.duplicatasProcessadas.push({
          parcela: nDup,
          vencimento: dVenc,
          valor: vDup,
          lancarConta: true
        });
      });
    } else if (valorTotalNota > 0) {
      // Se não houver tags de duplicata, cria 1 parcela padrão com vencimento em 30 dias
      const d30 = new Date();
      d30.setDate(d30.getDate() + 30);
      this.duplicatasProcessadas.push({
        parcela: '001',
        vencimento: d30.toISOString().split('T')[0],
        valor: valorTotalNota,
        lancarConta: true
      });
    }

    this.renderizarPreviaXml();
  },

  renderizarPreviaXml() {
    const dropzone = document.getElementById('xml-dropzone-area');
    const previewContainer = document.getElementById('xml-preview-container');
    if (dropzone) dropzone.style.display = 'none';
    if (previewContainer) previewContainer.style.display = 'block';

    // Cabeçalho da Nota
    const notaInfoEl = document.getElementById('xml-nota-info-header');
    if (notaInfoEl && this.dadosNotaAtual) {
      notaInfoEl.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(14, 165, 233, 0.02)); border: 1.5px solid rgba(14, 165, 233, 0.3); border-radius: 12px; padding: 16px 20px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
            <div style="min-width: 250px; flex: 1;">
              <span style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.6px; display: block; margin-bottom: 4px;">🏢 Fornecedor / Emitente</span>
              <strong style="font-size: 15.5px; color: var(--text-main); display: block; line-height: 1.3;">${this.dadosNotaAtual.fornecedorNome}</strong>
              <span style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; display: block; margin-top: 4px;">CNPJ: ${this.dadosNotaAtual.fornecedorCnpj || 'Não informado'}</span>
            </div>
            
            <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
              <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px 18px; text-align: center; min-width: 120px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <span style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Número da NF-e</span>
                <strong style="font-size: 15px; font-weight: 900; color: #0f172a; font-family: 'JetBrains Mono', monospace; display: block;"># ${this.dadosNotaAtual.numeroNota}</strong>
              </div>

              <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px 18px; text-align: center; min-width: 120px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                <span style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Emissão</span>
                <strong style="font-size: 14px; font-weight: 800; color: #0f172a; font-family: 'JetBrains Mono', monospace; display: block;">${this.formatarDataBR(this.dadosNotaAtual.dataEmissao)}</strong>
              </div>

              <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 8px 20px; text-align: center; min-width: 140px; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.12);">
                <span style="font-size: 10.5px; font-weight: 800; color: #166534; text-transform: uppercase; display: block; margin-bottom: 2px;">Valor Total da Nota</span>
                <strong style="font-size: 17.5px; font-weight: 900; color: #15803d; font-family: 'JetBrains Mono', monospace; display: block;">R$ ${this.dadosNotaAtual.valorTotalNota.toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Tabela de Produtos
    const tbody = document.getElementById('xml-produtos-tbody');
    const totalItensBadge = document.getElementById('xml-total-itens-badge');
    if (totalItensBadge) totalItensBadge.textContent = `${this.itensProcessados.length} itens encontrados`;

    if (tbody) {
      const categorias = StorageService.getCategorias();

      tbody.innerHTML = this.itensProcessados.map((item) => {
        const statusBadge = item.produtoExistenteId
          ? `<span class="badge-stock ok" style="font-size: 10.5px; padding: 2px 6px;">🔄 Atualiza Estoque</span>`
          : `<span class="badge-stock low" style="background: rgba(14, 165, 233, 0.15); color: #0284c7; border-color: rgba(14, 165, 233, 0.3); font-size: 10.5px; padding: 2px 6px;">✨ Novo Cadastro</span>`;

        const qtdEntradaCalculada = item.qComOriginal * (item.fatorConversao || 1);

        const isCategoriaValida = Boolean(item.categoria && categorias.some(c => c.toLowerCase() === item.categoria.toLowerCase()));
        const borderSelectStyle = isCategoriaValida 
          ? 'border: 1px solid #cbd5e1;' 
          : 'border: 2px solid #dc2626 !important; background: #fef2f2 !important; color: #b91c1c !important; box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);';

        return `
          <tr style="${item.importarItem ? '' : 'opacity: 0.4; background: #f8fafc;'}">
            <td style="text-align: center; width: 40px;">
              <input type="checkbox" ${item.importarItem ? 'checked' : ''} onchange="XmlImporterModule.toggleItemImportacao(${item.index}, this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
            </td>
            <td style="width: 110px;">
              ${statusBadge}
            </td>
            <td style="min-width: 130px; font-family: 'JetBrains Mono'; font-size: 12px; font-weight: 700;">
              <input type="text" class="form-input-custom" value="${item.cEAN}" placeholder="Sem EAN" style="height: 32px; font-size: 11px; font-family: 'JetBrains Mono';" onchange="XmlImporterModule.atualizarEanItem(${item.index}, this.value)">
            </td>
            <td style="min-width: 220px;">
              <input type="text" class="form-input-custom" value="${item.xProd}" style="height: 32px; font-size: 12.5px; font-weight: 700;" onchange="XmlImporterModule.atualizarNomeItem(${item.index}, this.value)">
              ${item.produtoExistenteNome ? `<span style="font-size: 10.5px; color: #059669; display: block; margin-top: 2px;">Vinculado ao item atual: <strong>${item.produtoExistenteNome}</strong></span>` : ''}
              ${item.dataValidade ? `<span style="font-size: 10.5px; color: #0284c7; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 4px; padding: 1px 6px; display: inline-block; margin-top: 3px; font-weight: 700;">📅 Validade NF-e: ${this.formatarDataBR(item.dataValidade)}${item.numeroLote ? ` (Lote: ${item.numeroLote})` : ''}</span>` : ''}
            </td>
            <td style="min-width: 210px;">
              <div style="display: flex; gap: 4px; align-items: center;">
                <select class="form-input-custom" style="height: 34px; font-size: 12px; font-weight: 700; flex: 1; min-width: 0; ${borderSelectStyle}" onchange="XmlImporterModule.atualizarCategoriaItem(${item.index}, this.value)">
                  ${!isCategoriaValida ? `<option value="" disabled selected style="color: #dc2626; font-weight: 800;">⚠️ Selecione a Categoria *</option>` : ''}
                  ${categorias.map(c => `<option value="${c}" ${isCategoriaValida && c.toLowerCase() === item.categoria.toLowerCase() ? 'selected' : ''}>${StorageService.getIconeCategoria(c)} ${c}</option>`).join('')}
                </select>
                <button type="button" class="btn-action-sm" onclick="XmlImporterModule.abrirModalCriarCategoriaRapida(${item.index})" title="Criar Nova Categoria" style="padding: 0 8px; height: 34px; font-weight: 800; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer; flex-shrink: 0;">➕</button>
              </div>
              ${!isCategoriaValida ? `<span style="font-size: 10.5px; color: #dc2626; font-weight: 800; display: block; margin-top: 3px;">❌ Categoria obrigatória!</span>` : ''}
            </td>
            <td style="width: 130px; text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                <span style="font-size: 12px; font-weight: 800; font-family: 'JetBrains Mono';">${item.qComOriginal} ${item.uComOriginal}</span>
                ${item.uComOriginal === 'CX' || item.uComOriginal === 'FD' ? `
                  <span style="font-size: 10px; color: var(--text-dim);">x</span>
                  <input type="number" min="1" value="${item.fatorConversao}" style="width: 44px; height: 28px; text-align: center; font-size: 11px; font-weight: 800; border-radius: 4px; border: 1px solid #cbd5e1;" title="Unidades por caixa/fardo" onchange="XmlImporterModule.atualizarFatorItem(${item.index}, this.value)">
                ` : ''}
              </div>
              <span style="font-size: 10.5px; color: #059669; font-weight: 700; display: block; margin-top: 2px;">+${qtdEntradaCalculada} un</span>
            </td>
            <td style="width: 110px; text-align: center; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-muted);">
              R$ ${item.precoCustoFinal.toFixed(2).replace('.', ',')}
            </td>
            <td style="width: 130px;">
              <div style="position: relative;">
                <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 700; color: var(--text-dim);">R$</span>
                <input type="number" step="0.01" min="0.01" class="form-input-custom" value="${item.precoVendaFinal.toFixed(2)}" style="height: 32px; font-size: 13px; font-weight: 800; color: var(--accent-green); font-family: 'JetBrains Mono'; padding-left: 26px;" onchange="XmlImporterModule.atualizarPrecoVendaItem(${item.index}, this.value)">
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Seção de Financeiro / Duplicatas
    const financeiroContainer = document.getElementById('xml-financeiro-secao');
    if (financeiroContainer) {
      if (this.duplicatasProcessadas.length > 0) {
        financeiroContainer.innerHTML = `
          <div style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 10px; padding: 14px 18px; margin-top: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">💳</span>
                <strong style="font-size: 13.5px; color: var(--text-main);">Agendamento Automático no Contas a Pagar</strong>
              </div>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--accent-green); cursor: pointer;">
                <input type="checkbox" id="xml-lancar-financeiro-geral" checked onchange="XmlImporterModule.toggleTodasDuplicatas(this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                Lançar boletos da nota no financeiro
              </label>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
              ${this.duplicatasProcessadas.map((dup, dIdx) => `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <span style="font-size: 11px; font-weight: 800; color: var(--text-dim); display: block;">Parcela ${dup.parcela}</span>
                    <strong style="font-size: 14px; color: #dc2626; font-family: 'JetBrains Mono';">R$ ${dup.valor.toFixed(2).replace('.', ',')}</strong>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 10.5px; color: var(--text-dim); display: block;">Vencimento:</span>
                    <input type="date" value="${dup.vencimento}" style="font-size: 11px; font-weight: 700; height: 26px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0 4px; cursor: pointer;" onchange="XmlImporterModule.atualizarVencimentoDuplicata(${dIdx}, this.value)">
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        financeiroContainer.innerHTML = '';
      }
    }
  },

  toggleItemImportacao(index, checked) {
    if (this.itensProcessados[index]) {
      this.itensProcessados[index].importarItem = checked;
      this.renderizarPreviaXml();
    }
  },

  atualizarEanItem(index, value) {
    if (this.itensProcessados[index]) {
      const novoEan = (value || '').trim();
      this.itensProcessados[index].cEAN = novoEan;

      const produtosEstoque = StorageService.getProdutos() || [];
      let match = null;
      if (novoEan) {
        match = produtosEstoque.find(p => p.codigoBarras === novoEan || p.codigoBarrasFardo === novoEan);
      }
      this.itensProcessados[index].produtoExistenteId = match ? match.id : null;
      this.itensProcessados[index].produtoExistenteNome = match ? match.nome : null;
      this.renderizarPreviaXml();
    }
  },

  atualizarNomeItem(index, value) {
    if (this.itensProcessados[index]) {
      this.itensProcessados[index].xProd = (value || '').trim();
    }
  },

  atualizarCategoriaItem(index, value) {
    if (this.itensProcessados[index]) {
      this.itensProcessados[index].categoria = value;
    }
  },

  atualizarFatorItem(index, value) {
    const val = parseInt(value, 10) || 1;
    if (this.itensProcessados[index]) {
      this.itensProcessados[index].fatorConversao = Math.max(1, val);
      this.itensProcessados[index].precoCustoFinal = this.itensProcessados[index].vUnComOriginal / this.itensProcessados[index].fatorConversao;
      this.renderizarPreviaXml();
    }
  },

  atualizarPrecoVendaItem(index, value) {
    const val = parseFloat(value) || 0;
    if (this.itensProcessados[index]) {
      this.itensProcessados[index].precoVendaFinal = Math.max(0.01, val);
    }
  },

  toggleTodasDuplicatas(checked) {
    this.duplicatasProcessadas.forEach(d => d.lancarConta = checked);
  },

  atualizarVencimentoDuplicata(index, value) {
    if (this.duplicatasProcessadas[index] && value) {
      this.duplicatasProcessadas[index].vencimento = value;
    }
  },

  async confirmarEntradaNota() {
    if (!this.dadosNotaAtual || this.itensProcessados.length === 0) {
      alert('⚠️ Nenhuma nota fiscal carregada para processamento.');
      return;
    }

    const itensParaImportar = this.itensProcessados.filter(i => i.importarItem);
    if (itensParaImportar.length === 0) {
      alert('⚠️ Selecione pelo menos 1 item para dar entrada no estoque.');
      return;
    }

    // Validação estrita de Categoria: impede entrada se houver produto sem categoria válida da loja
    const categoriasLoja = StorageService.getCategorias() || [];
    const itemInvalido = itensParaImportar.find(i => !i.categoria || !categoriasLoja.some(c => c.toLowerCase() === i.categoria.toLowerCase()));
    if (itemInvalido) {
      this.renderizarPreviaXml();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🚨 Categoria Obrigatória: O produto "${itemInvalido.xProd}" está sem categoria válida! Escolha uma categoria no campo em vermelho antes de confirmar.`, 'error', 8000);
      } else {
        alert(`🚨 CATEGORIA OBRIGATÓRIA!\n\nO produto "${itemInvalido.xProd}" está sem categoria válida da loja.\nPor favor, escolha uma categoria no campo em vermelho antes de confirmar.`);
      }
      return;
    }

    const btnConfirmar = document.getElementById('btn-confirmar-entrada-xml');
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = '⏳ Processando entrada...';
    }

    try {
      const produtosAtuais = StorageService.getProdutos() || [];
      let totalQtdEstoqueEntrada = 0;
      let totalNovosCadastros = 0;
      let totalAtualizados = 0;

      for (const item of itensParaImportar) {
        const qtdFinal = item.qComOriginal * (item.fatorConversao || 1);
        totalQtdEstoqueEntrada += qtdFinal;

        if (item.produtoExistenteId) {
          // Atualizar Produto Existente
          const idx = produtosAtuais.findIndex(p => p.id === item.produtoExistenteId);
          if (idx >= 0) {
            produtosAtuais[idx].estoque = Math.round(((produtosAtuais[idx].estoque || 0) + qtdFinal) * 1000) / 1000;
            produtosAtuais[idx].precoCusto = item.precoCustoFinal;
            if (item.precoVendaFinal > 0) {
              produtosAtuais[idx].precoVenda = item.precoVendaFinal;
            }
            if (item.dataValidade) produtosAtuais[idx].dataValidade = item.dataValidade;
            if (item.numeroLote) produtosAtuais[idx].lote = item.numeroLote;
            if (item.ncm) produtosAtuais[idx].ncm = item.ncm;
            if (item.cest) produtosAtuais[idx].cest = item.cest;
            if (item.cfop) produtosAtuais[idx].cfop = item.cfop;
            totalAtualizados++;
          }
        } else {
          // Cadastrar Novo Produto
          const novoProduto = {
            id: 'PROD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4),
            codigoBarras: item.cEAN || ('INT-' + Math.floor(100000 + Math.random() * 900000)),
            nome: item.xProd,
            categoria: item.categoria || 'Geral',
            precoCusto: item.precoCustoFinal,
            precoVenda: item.precoVendaFinal,
            estoque: qtdFinal,
            estoqueMinimo: 5,
            unidade: 'un',
            controlarEstoque: true,
            dataValidade: item.dataValidade || '',
            lote: item.numeroLote || '',
            ncm: item.ncm || '',
            cest: item.cest || '',
            cfop: item.cfop || '5102',
            criadoEm: new Date().toISOString()
          };
          produtosAtuais.unshift(novoProduto);
          totalNovosCadastros++;
        }
      }

      // Salvar Produtos
      StorageService.saveProdutos(produtosAtuais);

      // Registrar Contas a Pagar no Financeiro (se selecionado)
      const lancarFinanceiroGeral = document.getElementById('xml-lancar-financeiro-geral')?.checked ?? true;
      let totalContasCriadas = 0;

      if (lancarFinanceiroGeral && this.duplicatasProcessadas.length > 0) {
        const contasAtuais = StorageService.getContasPagar() || [];
        for (const dup of this.duplicatasProcessadas) {
          if (!dup.lancarConta) continue;

          const novaConta = {
            id: 'CTA-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4),
            descricao: `NF-e ${this.dadosNotaAtual.numeroNota} - ${this.dadosNotaAtual.fornecedorNome} (Parc. ${dup.parcela})`,
            categoria: 'Fornecedores',
            fornecedor: this.dadosNotaAtual.fornecedorNome,
            cnpjFornecedor: this.dadosNotaAtual.fornecedorCnpj,
            numeroNota: this.dadosNotaAtual.numeroNota,
            chaveNFe: this.dadosNotaAtual.chaveAcesso,
            valor: dup.valor,
            vencimento: dup.vencimento,
            status: 'pendente',
            dataPagamento: null,
            criadoEm: new Date().toISOString()
          };
          contasAtuais.unshift(novaConta);
          totalContasCriadas++;
        }
        StorageService.saveContasPagar(contasAtuais);
      }

      // Log de Auditoria
      AuditModule.registrarLog(
        'ENTRADA_ESTOQUE_XML',
        `Entrada NF-e #${this.dadosNotaAtual.numeroNota} (${this.dadosNotaAtual.fornecedorNome}): ${totalAtualizados} itens atualizados, ${totalNovosCadastros} novos produtos cadastrados. Total: ${totalQtdEstoqueEntrada.toFixed(2)} un.`
      );

      // Sincronização em Nuvem Imediata (Multi-Terminal)
      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('importacao_xml');
      }

      // Atualizar interface do PDV e Estoque imediatamente
      if (window.EstoqueModule) {
        if (typeof window.EstoqueModule.resetarFiltrosEstoque === 'function') {
          window.EstoqueModule.resetarFiltrosEstoque();
        }
        if (typeof window.EstoqueModule.renderBarraCategorias === 'function') {
          window.EstoqueModule.renderBarraCategorias();
        }
        if (typeof window.EstoqueModule.verificarAlertasValidade === 'function') {
          window.EstoqueModule.verificarAlertasValidade();
        }
        if (typeof window.EstoqueModule.renderTabelaProdutos === 'function') {
          window.EstoqueModule.renderTabelaProdutos();
        }
      }
      if (window.PdvModule) {
        if (typeof window.PdvModule.renderBotoesCategorias === 'function') {
          window.PdvModule.renderBotoesCategorias();
        }
      }
      if (window.GerenciaModule && typeof window.GerenciaModule.renderContasPagar === 'function') {
        window.GerenciaModule.renderContasPagar();
      }

      const numNota = this.dadosNotaAtual ? this.dadosNotaAtual.numeroNota : 'S/N';
      const fornNome = this.dadosNotaAtual ? this.dadosNotaAtual.fornecedorNome : '';

      this.fecharModalImportarXml();

      // Toast de Sucesso
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🎉 NF-e #${numNota} (${fornNome}) importada! +${totalNovosCadastros} novos, +${totalAtualizados} atualizados, +${totalContasCriadas} contas no financeiro.`);
      } else {
        alert(`🎉 Entrada concluída com sucesso!\n\n• ${totalNovosCadastros} novos produtos cadastrados\n• ${totalAtualizados} produtos com estoque somado\n• ${totalContasCriadas} parcelas lançadas no Contas a Pagar.`);
      }
    } catch (err) {
      console.error('[XmlImporter] Erro ao confirmar entrada:', err);
      alert('❌ Erro ao salvar dados da nota fiscal: ' + (err.message || err));
    } finally {
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '✅ Confirmar Entrada de Estoque & Financeiro';
      }
    }
  },

  // Helpers
  getNodeText(parent, tagName) {
    if (!parent) return '';
    const node = parent.querySelector(tagName);
    return node ? (node.textContent || '').trim() : '';
  },

  formatarCnpj(cnpj) {
    const limpo = (cnpj || '').replace(/\D/g, '');
    if (limpo.length === 14) {
      return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (limpo.length === 11) {
      return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return cnpj;
  },

  formatarDataBR(isoStr) {
    if (!isoStr) return '-';
    try {
      const p = isoStr.split('T')[0].split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    } catch(e) {}
    return isoStr;
  },

  adivinharCategoria(nomeProduto, ncmCode = '', produtoExistente = null) {
    const categoriasLoja = StorageService.getCategorias() || [];
    if (categoriasLoja.length === 0) return 'Geral';

    const norm = (str) => String(str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    // Função auxiliar para encontrar a categoria exata ou parcial bidirecional na loja
    const acharCat = (...nomes) => {
      // 1. Match exato normalizado
      for (const nome of nomes) {
        const nNome = norm(nome);
        const exato = categoriasLoja.find(c => norm(c) === nNome);
        if (exato) return exato;
      }
      // 2. Match parcial bidirecional normalizado (ex: 'cerveja' bate com 'cervejas')
      for (const nome of nomes) {
        const nNome = norm(nome);
        const parcial = categoriasLoja.find(c => {
          const nC = norm(c);
          return nC.includes(nNome) || nNome.includes(nC);
        });
        if (parcial) return parcial;
      }
      return null;
    };

    const n = String(nomeProduto || '').toLowerCase();
    const cleanNcm = String(ncmCode || '').replace(/\D/g, '');

    // Se o produto já existe no estoque com uma categoria que NÃO seja 'Geral' ou genérica/errada
    if (produtoExistente && produtoExistente.categoria) {
      const catEx = produtoExistente.categoria;
      const ehBebida = cleanNcm.startsWith('22') || n.includes('cervej') || n.includes('heineken') || n.includes('red bull') || n.includes('energy') || n.includes('whisky') || n.includes('vodka');
      const catExAlimento = norm(catEx).includes('aliment') || norm(catEx).includes('mercear');
      
      // Se era uma bebida mas estava cadastrada como Alimentos/Geral, corrige! Caso contrário, honra a categoria do item
      if (!(ehBebida && catExAlimento) && norm(catEx) !== 'geral') {
        const catValida = acharCat(catEx);
        if (catValida) return catValida;
      }
    }

    // 0. PETISCOS, SALGADINHOS & BOMBONIERE (Prioridade sobre bebidas para não confundir nomes como Pringles Original)
    if (cleanNcm.startsWith('1905') || cleanNcm.startsWith('2005') || cleanNcm.startsWith('1806') || cleanNcm.startsWith('1704') || cleanNcm.startsWith('2008') ||
        n.includes('pringles') || n.includes('batata') || n.includes('salgad') || n.includes('snack') || 
        n.includes('doritos') || n.includes('ruffles') || n.includes('cheetos') || n.includes('amendoim') || 
        n.includes('torcida') || n.includes('fandangos') || n.includes('baconzitos') || n.includes('cebolitos') || 
        n.includes('biscoito') || n.includes('bolacha') || n.includes('chocolate') || 
        n.includes('bala ') || n.includes('chiclete') || n.includes('halls') || n.includes('trident')) {
      const catSnack = acharCat('Petiscos', 'Salgadinhos', 'Snacks', 'Bomboniere', 'Alimentos', 'Mercearia');
      if (catSnack) return catSnack;
    }

    // 1. CERVEJAS & CHOPP (NCM 2203 ou nomes conhecidos - 'original' exige contexto alcoólico)
    const ehCervejaOriginal = n.includes('original') && (n.includes('cervej') || n.includes('chopp') || n.includes('antarctica') || cleanNcm.startsWith('2203'));
    if (cleanNcm.startsWith('2203') || 
        n.includes('cervej') || n.includes('chopp') || n.includes('heineken') || n.includes('skol') || 
        n.includes('brahma') || n.includes('amstel') || n.includes('corona') || n.includes('budweiser') || 
        n.includes('spaten') || n.includes('eisenbahn') || n.includes('stella') || n.includes('becks') || 
        n.includes('bohemia') || ehCervejaOriginal || n.includes('itaipava') || n.includes('petra') || 
        n.includes('imperio') || n.includes('colorado') || n.includes('baden') || n.includes('lager') || n.includes('pilsen') || n.includes('ipa')) {
      return acharCat('Cervejas', 'Cerveja', 'Chopp', 'Bebidas Alcoólicas', 'Bebidas', 'Alcoólicos') || '';
    }

    // 2. NÃO ALCOÓLICOS, ENERGÉTICOS, REFRIGERANTES, SUCOS & ÁGUAS (NCM 2202, 2201 ou nomes conhecidos)
    if (cleanNcm.startsWith('2202') || (cleanNcm.startsWith('2201') && !n.includes('gelo')) ||
        n.includes('energetico') || n.includes('energético') || n.includes('energy') || n.includes('red bull') || 
        n.includes('monster') || n.includes('bally') || n.includes('fusion') || n.includes('refrigerante') || 
        n.includes('coca') || n.includes('pepsi') || n.includes('guarana') || n.includes('guaraná') || 
        n.includes('fanta') || n.includes('sprite') || n.includes('schweppes') || n.includes('tonica') || 
        n.includes('suco') || n.includes('del valle') || n.includes('agua') || n.includes('água') || 
        n.includes('gatorade') || n.includes('powerade') || n.includes('matte') || n.includes('chá') || n.includes('cha') || n.includes('ice tea')) {
      return acharCat('Não Alcoólicos', 'Nao Alcoolicos', 'Energéticos', 'Refrigerantes', 'Sucos', 'Águas', 'Bebidas') || '';
    }

    // 3. DESTILADOS (NCM 2208 ou nomes conhecidos)
    if (cleanNcm.startsWith('2208') ||
        n.includes('whisky') || n.includes('whiskey') || n.includes('vodka') || n.includes('gin') || 
        n.includes('tanqueray') || n.includes('gordon') || n.includes('bombay') || n.includes('beefeater') || 
        n.includes('smirnoff') || n.includes('absolut') || n.includes('red label') || n.includes('black label') || 
        n.includes('jack daniel') || n.includes('chivas') || n.includes('ballantine') || n.includes('white horse') || 
        n.includes('cachaça') || n.includes('cachaca') || n.includes('rum') || n.includes('bacardi') || 
        n.includes('tequila') || n.includes('licor') || n.includes('aperol') || n.includes('campari') || 
        n.includes('jagermeister') || n.includes('conhaque') || n.includes('dreher') || n.includes('domecq') || 
        n.includes('velho barreiro') || n.includes('51') || n.includes('ypióca') || n.includes('ypioca')) {
      return acharCat('Destilados', 'Whiskies', 'Vodkas', 'Gins', 'Bebidas Alcoólicas', 'Bebidas') || '';
    }

    // 4. VINHOS & ESPUMANTES (NCM 2204, 2205, 2206 ou nomes conhecidos)
    if (cleanNcm.startsWith('2204') || cleanNcm.startsWith('2205') || cleanNcm.startsWith('2206') ||
        n.includes('vinho') || n.includes('espumante') || n.includes('champagne') || n.includes('prosecco') || 
        n.includes('cabernet') || n.includes('malbec') || n.includes('merlot') || n.includes('carmenere') || 
        n.includes('chardonnay') || n.includes('sauvignon') || n.includes('tinto') || n.includes('rose') || 
        n.includes('rosé') || n.includes('moscatel') || n.includes('pergola') || n.includes('pérgola') || 
        n.includes('campo largo') || n.includes('sangue de boi') || n.includes('casillero') || n.includes('reservado')) {
      return acharCat('Vinhos', 'Espumantes', 'Bebidas Alcoólicas', 'Bebidas') || '';
    }

    // 5. GELO & CARVÃO (NCM 4402 ou nomes conhecidos)
    if (cleanNcm.startsWith('4402') || n.includes('gelo') || n.includes('carvao') || n.includes('carvão') || n.includes('acendedor')) {
      return acharCat('Gelo & Carvão', 'Gelo e Carvão', 'Gelo', 'Carvão', 'Churrasco', 'Outros') || '';
    }

    // 6. TABACARIA (NCM 2402, 2403 ou nomes conhecidos)
    if (cleanNcm.startsWith('2402') || cleanNcm.startsWith('2403') ||
        n.includes('cigarro') || n.includes('tabaco') || n.includes('essencia') || n.includes('essência') || 
        n.includes('seda') || n.includes('pod') || n.includes('vape') || n.includes('palheiro') || 
        n.includes('fumo') || n.includes('charuto') || n.includes('narguile') || n.includes('narguilé') || 
        n.includes('piteira') || n.includes('isqueiro') || n.includes('clipper') || n.includes('bic')) {
      return acharCat('Tabacaria', 'Fumo', 'Conveniência', 'Outros') || '';
    }

    // 7. PETISCOS, SALGADINHOS & BOMBONIERE
    if (cleanNcm.startsWith('1905') || cleanNcm.startsWith('2005') || cleanNcm.startsWith('1806') || cleanNcm.startsWith('1704') || cleanNcm.startsWith('2008') ||
        n.includes('pringles') || n.includes('batata') || n.includes('salgad') || n.includes('snack') || 
        n.includes('doritos') || n.includes('ruffles') || n.includes('cheetos') || n.includes('amendoim') || 
        n.includes('torcida') || n.includes('fandangos') || n.includes('baconzitos') || n.includes('cebolitos') || 
        n.includes('biscoito') || n.includes('bolacha') || n.includes('chocolate') || 
        n.includes('bala ') || n.includes('chiclete') || n.includes('halls') || n.includes('trident')) {
      return acharCat('Petiscos', 'Salgadinhos', 'Snacks', 'Bomboniere', 'Alimentos', 'Mercearia') || '';
    }

    // 8. CARNES & AÇOUGUE (NCM 0201, 0202, 0203, etc.)
    if (cleanNcm.startsWith('02') || n.includes('carne') || n.includes('picanha') || n.includes('linguica') || n.includes('linguiça') || 
        n.includes('frango') || n.includes('costela') || n.includes('alcatra') || n.includes('bife')) {
      return acharCat('Carnes & Açougue', 'Açougue', 'Carnes', 'Alimentos') || '';
    }

    // 9. LATICÍNIOS & FRIOS (NCM 0401, 0402, 0406, etc.)
    if (cleanNcm.startsWith('04') || n.includes('queijo') || n.includes('leite') || n.includes('presunto') || n.includes('manteiga') || 
        n.includes('iogurte') || n.includes('mussarela')) {
      return acharCat('Laticínios & Frios', 'Frios', 'Laticínios', 'Alimentos') || '';
    }

    // 10. ALIMENTOS / MERCEARIA
    if (n.includes('arroz') || n.includes('feijao') || n.includes('feijão') || n.includes('macarrao') || 
        n.includes('macarrão') || n.includes('oleo') || n.includes('óleo') || n.includes('acucar') || 
        n.includes('açúcar') || n.includes('cafe') || n.includes('café')) {
      return acharCat('Alimentos', 'Mercearia') || '';
    }

    // Fallback inteligente: se for qualquer outra bebida, tenta achar 'Bebidas'
    if (cleanNcm.startsWith('22')) {
      const catBebida = acharCat('Bebidas', 'Cervejas', 'Não Alcoólicos', 'Destilados', 'Vinhos');
      if (catBebida) return catBebida;
    }

    return '';
  },

  formatarNomeProduto(str) {
    if (!str) return '';
    return String(str).trim().toUpperCase();
  },


  itemIndexParaNovaCategoria: null,

  abrirModalCriarCategoriaRapida(itemIndex) {
    this.itemIndexParaNovaCategoria = itemIndex;
    const modal = document.getElementById('modal-criar-categoria-rapida-xml');
    const input = document.getElementById('xml-nova-categoria-input');
    if (input) input.value = '';
    if (modal) {
      modal.classList.add('active');
      setTimeout(() => { if (input) input.focus(); }, 100);
    }
  },

  fecharModalCriarCategoriaRapida() {
    const modal = document.getElementById('modal-criar-categoria-rapida-xml');
    if (modal) modal.classList.remove('active');
    this.itemIndexParaNovaCategoria = null;
  },

  salvarNovaCategoriaRapida(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const input = document.getElementById('xml-nova-categoria-input');
    const nome = input ? input.value.trim() : '';

    if (!nome) {
      window.App.showToast('Informe o nome da categoria!', 'warning');
      return;
    }

    let categorias = StorageService.getCategorias() || [];
    const existe = categorias.find(c => c.toLowerCase() === nome.toLowerCase());

    let nomeFinal = nome;
    if (existe) {
      nomeFinal = existe;
    } else {
      categorias.push(nome);
      StorageService.removerCategoriaExcluida(nome);
      StorageService.salvarCategorias(categorias);
      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('categoria_criada');
      }
      if (window.LicencaModule && typeof window.LicencaModule.atualizarCategoriasNuvem === 'function') {
        window.LicencaModule.atualizarCategoriasNuvem(categorias, StorageService.getCategoriasExcluidas());
      }
      if (window.EstoqueModule && typeof window.EstoqueModule.renderBarraCategorias === 'function') {
        window.EstoqueModule.renderBarraCategorias();
      }
      if (window.EstoqueModule && typeof window.EstoqueModule.preencherSelectCategorias === 'function') {
        window.EstoqueModule.preencherSelectCategorias();
      }
      if (window.GerenciaModule && typeof window.GerenciaModule.renderGestaoCategorias === 'function') {
        window.GerenciaModule.renderGestaoCategorias();
      }
    }

    if (this.itemIndexParaNovaCategoria !== null && this.itensProcessados[this.itemIndexParaNovaCategoria]) {
      this.itensProcessados[this.itemIndexParaNovaCategoria].categoria = nomeFinal;
    }

    this.renderizarPreviaXml();
    this.fecharModalCriarCategoriaRapida();
    window.App.showToast(`✅ Categoria "${nomeFinal}" vinculada com sucesso!`, 'success');
  },

};

window.XmlImporterModule = XmlImporterModule;
