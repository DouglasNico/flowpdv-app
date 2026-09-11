/**
 * thermal-print.js - Gerador e Impressor de Comprovantes Térmicos (58mm / 80mm)
 */

import { StorageService } from './storage.js';

export const ThermalPrintModule = {
  init() {},

  rotuloFormaCupom(forma) {
    return String(forma || 'Dinheiro')
      .replace(/\s*-\s*/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  formatarMoedaCupom(valor) {
    return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
  },

  escCupom(txt) {
    return String(txt || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  codigoCurtoCupom(item) {
    const digits = String(item && (item.codigoBarras || item.id) || '').replace(/\D/g, '');
    if (digits.length >= 5) return digits.slice(-5);
    const id = String(item && item.id || '').replace(/[^A-Z0-9]/gi, '');
    return (id.slice(-5) || '-----').toUpperCase();
  },

  formatarQtdCupom(qtd) {
    const n = Number(qtd) || 0;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(3).replace('.', ',').replace(/0+$/, '').replace(/,$/, '');
  },

  itemEhPeso(item) {
    if (!item) return false;
    if (item.permiteFracionado === true) return true;
    return !!(item.unidade && String(item.unidade).toLowerCase() === 'kg');
  },

  papelCupom() {
    const config = StorageService.getConfig() || {};
    const is80 = config.impressoraTipo === '80mm';
    return {
      config,
      is80,
      largura: is80 ? '72mm' : '48mm',
      pageSize: is80 ? '80mm auto' : '58mm auto',
      papelMm: is80 ? 80 : 58,
      fonte: is80 ? '13px' : '11px'
    };
  },

  unidadeQtdCupom(item) {
    return this.itemEhPeso(item) ? 'KG' : 'UN';
  },

  htmlItensCupom(itens) {
    const lista = itens || [];
    return lista.map((item) => {
      const qtd = Number(item.quantidade) || 0;
      const vu = Number(item.precoUnitario) || 0;
      return `<div class="item-block">
        <div class="item-name">${this.escCupom(this.codigoCurtoCupom(item))} ${this.escCupom(item.nome)}</div>
        <div class="item-vals">
          <span>${this.formatarQtdCupom(qtd)} ${this.unidadeQtdCupom(item)} x ${vu.toFixed(2).replace('.', ',')}${this.itemEhPeso(item) ? '/kg' : ''}</span>
          <span class="money">${(vu * qtd).toFixed(2).replace('.', ',')}</span>
        </div>
      </div>`;
    }).join('');
  },

  linhaPagamentoHtml(nome, valor) {
    return `<tr><td>${this.rotuloFormaCupom(nome)}</td><td class="text-right money">${this.formatarMoedaCupom(valor)}</td></tr>`;
  },

  htmlBlocoPagamento(venda) {
    const linhas = [];
    if (venda.pagamentos && venda.pagamentos.length > 0) {
      venda.pagamentos.forEach((p) => linhas.push(this.linhaPagamentoHtml(p.forma, p.valor)));
    } else if (venda.pagamentoDividido && venda.parcela1 && venda.parcela2) {
      linhas.push(this.linhaPagamentoHtml(venda.parcela1.forma, venda.parcela1.valor));
      linhas.push(this.linhaPagamentoHtml(venda.parcela2.forma, venda.parcela2.valor));
    } else {
      linhas.push(this.linhaPagamentoHtml(venda.formaPagamento || 'Dinheiro', venda.total));
    }

    const somaPagos = (venda.pagamentos && venda.pagamentos.length)
      ? venda.pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
      : (venda.pagamentoDividido ? (Number(venda.parcela1?.valor || 0) + Number(venda.parcela2?.valor || 0)) : Number(venda.total || 0));
    if (venda.valorPago > 0 && Math.abs(Number(venda.valorPago) - somaPagos) > 0.009) {
      linhas.push(this.linhaPagamentoHtml('Valor pago', venda.valorPago));
    }
    if (venda.troco > 0) {
      linhas.push(this.linhaPagamentoHtml('Troco', venda.troco));
    }

    return `
      <table class="pay-table">
        <tr class="bold"><td>FORMA DE PAGAMENTO</td><td class="text-right">VALOR PAGO</td></tr>
        ${linhas.join('')}
      </table>
    `;
  },

  executarImpressao(html) {
    const papelMm = this.papelCupom().papelMm;
    if (window.electronAPI && typeof window.electronAPI.printThermalReceipt === 'function') {
      window.electronAPI.printThermalReceipt(html, false, { papelMm }).catch((err) => {
        console.warn('[ThermalPrint] Falha IPC, usando fallback navegador:', err);
        this.imprimirViaJanelaNavegador(html);
      });
    } else {
      this.imprimirViaJanelaNavegador(html);
    }
  },

  imprimirViaJanelaNavegador(html) {
    try {
      const win = window.open('', '_blank', 'width=380,height=650');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          setTimeout(() => win.close(), 1000);
        }, 250);
      }
    } catch (e) {
      console.error('[ThermalPrint] Erro na janela de impressão:', e);
    }
  },  abrirGavetaDinheiro() {
    // Comando padrão ESC/POS para pulso no pino 2 da gaveta de dinheiro: ESC p 0 25 250 (27, 112, 0, 25, 250)
    const comandoGaveta = '\x1B\x70\x00\x19\xFA';
    if (window.electronAPI && typeof window.electronAPI.sendRawPrinterData === 'function') {
      window.electronAPI.sendRawPrinterData(comandoGaveta);
    } else {
      console.log('[ThermalPrint] Pulso de abertura de gaveta enviado via ESC/POS:', [27, 112, 0, 25, 250]);
    }
  },

  imprimirCupomVenda(venda) {
    if (!venda) return;
    const { config, largura, pageSize, fonte } = this.papelCupom();

    // Se a venda teve pagamento em dinheiro, envia pulso para abrir gaveta
    const teveDinheiro = venda.formaPagamento === 'Dinheiro' ||
      (Array.isArray(venda.pagamentos) && venda.pagamentos.some((p) => p && p.forma === 'Dinheiro')) ||
      (venda.pagamentoDividido && (venda.parcela1?.forma === 'Dinheiro' || venda.parcela2?.forma === 'Dinheiro'));
    if (teveDinheiro) {
      this.abrirGavetaDinheiro();
    }

    const isNfce = Boolean(venda.chaveNfe || venda.statusFiscal === 'autorizada');
    const chaveFormatada = (venda.chaveNfe || '').replace(/(.{4})/g, '$1 ').trim();
    const qtdeItens = (venda.itens || []).reduce((acc, item) => {
      if (this.itemEhPeso(item)) return acc + 1;
      return acc + (Number(item.quantidade) || 0);
    }, 0);
    const fiscal = StorageService.getFiscalConfig ? StorageService.getFiscalConfig() : {};
    const cnpj = fiscal.cnpjEmitente || config.cnpj || '';
    const ie = fiscal.inscricaoEstadual || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; size: ${pageSize}; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${largura};
            margin: 0 auto;
            padding: 6px 3px 10px;
            font-size: ${fonte};
            line-height: 1.28;
            color: #000;
            background: #fff;
            hyphens: none;
            -webkit-hyphens: none;
            word-break: normal;
            overflow-wrap: break-word;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .money, .col-num, .col-cod { white-space: nowrap; }
          .table-items { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
          .table-items td { padding: 2px 0; vertical-align: top; }
          .col-cod { width: 38px; }
          .col-num { width: 58px; text-align: right; }
          .col-desc { padding-right: 4px; overflow-wrap: break-word; word-break: normal; hyphens: none; }
          .item-block { margin: 3px 0 5px; }
          .item-name { overflow-wrap: break-word; word-break: normal; hyphens: none; }
          .item-vals { display: flex; justify-content: space-between; gap: 8px; white-space: nowrap; }
          .pay-table, .tot-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
          .pay-table td, .tot-table td { padding: 1px 0; vertical-align: top; }
          .pay-table td:first-child, .tot-table td:first-child { padding-right: 6px; overflow-wrap: break-word; word-break: normal; }
          .pay-table td:last-child, .tot-table td:last-child { width: 78px; white-space: nowrap; }
          .chave { font-size: 9px; letter-spacing: 0.2px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 13px;">${this.escCupom(config.nomeEmpresa || 'FLOWPDV')}</div>
        ${config.cidade ? `<div class="text-center">${this.escCupom(config.cidade)}</div>` : ''}
        ${cnpj ? `<div class="text-center">CNPJ: ${this.escCupom(cnpj)}</div>` : ''}
        ${ie ? `<div class="text-center">IE: ${this.escCupom(ie)}</div>` : ''}
        ${config.telefone ? `<div class="text-center">Tel: ${this.escCupom(config.telefone)}</div>` : ''}

        <div class="divider"></div>
        ${isNfce ? `
          <div class="text-center bold">Documento Auxiliar da Nota Fiscal</div>
          <div class="text-center bold">de Consumidor Eletrônica</div>
          ${venda.ambiente === 'homologacao' ? '<div class="text-center bold" style="font-size: 9.5px; margin-top: 2px;">EMITIDA EM HOMOLOGAÇÃO - SEM VALOR FISCAL</div>' : ''}
        ` : `
          <div class="text-center bold">CUPOM NÃO FISCAL</div>
        `}

        <div class="divider"></div>
        ${this.htmlItensCupom(venda.itens)}

        <div class="divider"></div>
        <table class="tot-table">
          <tr><td>QTDE. TOTAL DE ITENS</td><td class="text-right">${this.formatarQtdCupom(qtdeItens)}</td></tr>
          <tr><td>VALOR TOTAL</td><td class="text-right money">${this.formatarMoedaCupom(venda.subtotal || venda.total)}</td></tr>
          ${venda.desconto > 0 ? `<tr><td>DESCONTO</td><td class="text-right money">- ${this.formatarMoedaCupom(venda.desconto)}</td></tr>` : ''}
          <tr class="bold"><td>VALOR A PAGAR</td><td class="text-right money">${this.formatarMoedaCupom(venda.total)}</td></tr>
        </table>

        <div class="divider"></div>
        ${this.htmlBlocoPagamento(venda)}

        ${isNfce ? `
          <div class="divider"></div>
          <div class="text-center" style="font-size: 9.5px;">Consulte pela chave de acesso em</div>
          <div class="text-center" style="font-size: 9px;"><strong>www.nfce.fazenda.sp.gov.br/consulta</strong></div>
          <div class="text-center chave" style="margin-top: 4px;">${this.escCupom(chaveFormatada)}</div>
          <div class="text-center" style="font-size: 9.5px; margin-top: 6px;">
            ${venda.cpfCliente ? `CONSUMIDOR CPF: ${this.escCupom(venda.cpfCliente)}` : 'NÃO IDENTIFICADO'}
          </div>
          <div class="text-center" style="font-size: 9.5px; margin-top: 4px;">
            NFC-e numero ${venda.numeroNfce || 1}<br>
            Serie ${venda.serieNfce || 1} ${new Date(venda.data).toLocaleString('pt-BR')}<br>
            Protocolo de autorizacao: ${this.escCupom(venda.protocoloNfe || '')}
          </div>
          <div class="text-center" style="font-size: 8.5px; margin-top: 5px;">
            Valor aproximado dos tributos deste cupom ${this.formatarMoedaCupom(venda.tributosAproximados || (Number(venda.total || 0) * 0.184))}
            (Conf. Lei Fed. 12.741/2012)
          </div>
        ` : `
          <div>Venda: #${StorageService.formatarNumeroVenda(venda)}</div>
          <div>Data: ${new Date(venda.data).toLocaleString('pt-BR')}</div>
          ${venda.cpfCliente ? `<div>CONSUMIDOR CPF: ${this.escCupom(venda.cpfCliente)}</div>` : ''}
        `}

        <div class="divider"></div>
        <div class="text-center">Operador: ${this.escCupom(venda.operador || 'Caixa')}</div>
        <div class="text-center bold" style="margin-top: 6px;">VOLTE SEMPRE!</div>
      </body>
      </html>
    `;

    this.executarImpressao(html);
  },

  imprimirFechamentoCaixa(turno) {
    if (!turno) return;
    const { config, largura, pageSize, fonte } = this.papelCupom();

    const dataAb = turno.dataAbertura ? new Date(turno.dataAbertura).toLocaleString('pt-BR') : '-';
    const dataFc = turno.dataFechamento ? new Date(turno.dataFechamento).toLocaleString('pt-BR') : 'Em Aberto';
    const turnoId = StorageService.formatarNumeroTurno(turno.id);

    const diferenca = turno.diferenca !== undefined ? turno.diferenca : ((turno.saldoInformado || 0) - (turno.dinheiroGaveta || 0));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; size: ${pageSize}; }
          body {
            font-family: 'Courier New', monospace;
            width: ${largura};
            margin: 0 auto;
            padding: 8px 4px;
            font-size: ${fonte};
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row-flex { display: flex; justify-content: space-between; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 13px;">${config.nomeEmpresa || 'FLOWPDV'}</div>
        ${config.cnpj ? `<div class="text-center">CNPJ: ${config.cnpj}</div>` : ''}
        
        <div class="divider"></div>
        <div class="text-center bold">FECHAMENTO DE CAIXA</div>
        <div class="text-center bold">TURNO #${turnoId}</div>
        <div class="divider"></div>
        
        <div>Abertura: ${dataAb}</div>
        <div>Fechamento: ${dataFc}</div>
        <div>Operador: ${turno.operador || 'Operador Caixa'}</div>
        <div class="row-flex" style="margin-top: 4px;">
          <span>Troco Inicial:</span>
          <span>R$ ${(turno.trocoInicial || 0).toFixed(2).replace('.', ',')}</span>
        </div>

        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">RESUMO POR FORMA DE PAGTO:</div>
        
        <div class="row-flex">
          <span>💵 Dinheiro:</span>
          <span>R$ ${(turno.totalDinheiro || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="row-flex">
          <span>📱 PIX:</span>
          <span>R$ ${(turno.totalPix || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="row-flex">
          <span>💳 Débito:</span>
          <span>R$ ${(turno.totalDebito || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="row-flex">
          <span>💳 Crédito:</span>
          <span>R$ ${(turno.totalCredito || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="row-flex">
          <span>👥 Fiado / Prazo:</span>
          <span>R$ ${(turno.totalFiado || 0).toFixed(2).replace('.', ',')}</span>
        </div>

        <div class="divider"></div>
        <div class="row-flex" style="color: #000;">
          <span>💸 Sangrias (Retiradas):</span>
          <span>- R$ ${(turno.totalSangrias || 0).toFixed(2).replace('.', ',')}</span>
        </div>

        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">CONFERÊNCIA DE FECHAMENTO:</div>
        ${(window.AuthModule && (window.AuthModule.isGerente() || window.AuthModule.isSuperAdmin())) ? `
          <div class="row-flex">
            <span>Esperado na Gaveta:</span>
            <span>R$ ${(turno.saldoEsperado || turno.dinheiroGaveta || 0).toFixed(2).replace('.', ',')}</span>
          </div>
          ${turno.saldoInformado !== undefined ? `
            <div class="row-flex">
              <span>Contado pelo Operador:</span>
              <span>R$ ${(turno.saldoInformado || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="row-flex bold">
              <span>${diferenca === 0 ? 'Status da Gaveta:' : (diferenca > 0 ? 'Sobra de Caixa:' : 'Falta / Quebra de Caixa:')}</span>
              <span>${diferenca === 0 ? '✅ Bateu Perfeito' : (diferenca > 0 ? `+ R$ ${diferenca.toFixed(2).replace('.', ',')}` : `- R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')}`)}</span>
            </div>
          ` : ''}
        ` : `
          ${turno.saldoInformado !== undefined ? `
            <div class="row-flex">
              <span>Valor Declarado na Gaveta:</span>
              <span>R$ ${(turno.saldoInformado || 0).toFixed(2).replace('.', ',')}</span>
            </div>
          ` : ''}
          <div class="text-center" style="font-size: 9px; color: #444; margin-top: 4px;">
            🔒 Fechamento Cego Registrado (Auditoria do Gerente)
          </div>
        `}

        <div class="divider"></div>
        <div class="row-flex bold" style="font-size: 12.5px; margin-top: 4px;">
          <span>🎉 TOTAL FATURAMENTO:</span>
          <span>R$ ${(turno.totalVendasGeral || turno.totalFaturamento || turno.totalVendas || 0).toFixed(2).replace('.', ',')}</span>
        </div>

        <div class="divider"></div>
        <div class="text-center" style="margin-top: 10px; font-size: 10px;">
          Impresso em: ${new Date().toLocaleString('pt-BR')}
        </div>
      </body>
      </html>
    `;

    this.executarImpressao(html);
  },

  executarImpressaoA4(html) {
    try {
      const win = window.open('', '_blank', 'width=850,height=900');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          setTimeout(() => win.close(), 1500);
        }, 350);
      }
    } catch (e) {
      console.error('[ThermalPrint] Erro na janela A4:', e);
    }
  },

  imprimirA4Venda(venda) {
    if (!venda) return;
    const config = StorageService.getConfig() || {};
    const isNfce = Boolean(venda.chaveNfe || venda.statusFiscal === 'autorizada');
    const chaveFormatada = (venda.chaveNfe || '').replace(/(.{4})/g, '$1 ').trim();
    const clienteCpf = venda.cpfCliente || venda.cpfCnpj || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprovante A4 - Venda #${venda.id}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .company-name { font-size: 20px; font-weight: 800; color: #0f172a; }
          .doc-badge {
            background: #e0f2fe;
            color: #0369a1;
            padding: 6px 14px;
            border-radius: 8px;
            font-weight: 800;
            font-size: 13px;
            text-align: right;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 18px;
          }
          .meta-item label { display: block; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .meta-item span { font-weight: 700; font-size: 13px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          th { background: #0f172a; color: #fff; padding: 8px 10px; text-align: left; font-size: 11.5px; font-weight: 700; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          tr:nth-child(even) { background: #f8fafc; }
          .totals-box {
            margin-left: auto;
            width: 320px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 18px;
          }
          .totals-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12.5px; }
          .totals-row.grand-total {
            font-size: 16px;
            font-weight: 900;
            color: #059669;
            border-top: 1.5px solid #cbd5e1;
            padding-top: 6px;
            margin-top: 6px;
          }
          .fiscal-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 14px;
            margin-top: 16px;
          }
          .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px dashed #cbd5e1;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${config.nomeEmpresa || 'FLOWPDV SISTEMA'}</div>
            <div style="color: #64748b; font-size: 12px;">${config.cnpj ? `CNPJ: ${config.cnpj}` : ''} ${config.cidade ? `&bull; ${config.cidade}` : ''}</div>
            ${config.telefone ? `<div style="color: #64748b; font-size: 12px;">Telefone: ${config.telefone}</div>` : ''}
          </div>
          <div class="doc-badge">
            ${isNfce ? 'DANFE NFC-e<br><span style="font-size: 11px; font-weight: normal;">Doc. Auxiliar Consumidor</span>' : 'COMPROVANTE DE VENDA<br><span style="font-size: 11px; font-weight: normal;">Não Fiscal</span>'}
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <label>Nº da Venda</label>
            <span>#${StorageService.formatarNumeroVenda(venda)}</span>
          </div>
          <div class="meta-item">
            <label>Data / Hora</label>
            <span>${new Date(venda.data).toLocaleString('pt-BR')}</span>
          </div>
          <div class="meta-item">
            <label>Operador</label>
            <span>${venda.operador || 'Caixa'}</span>
          </div>
          <div class="meta-item">
            <label>Forma de Pagamento</label>
            <span>${venda.formaPagamento || 'À Vista'}</span>
          </div>
          <div class="meta-item">
            <label>Cliente / CPF</label>
            <span>${clienteCpf || venda.clienteNome || 'Consumidor Final'}</span>
          </div>
          <div class="meta-item">
            <label>Status</label>
            <span style="color: ${isNfce ? '#059669' : '#0284c7'}; font-weight: 800;">${isNfce ? (venda.ambiente === 'homologacao' ? '🧪 Homologação' : '🟢 Autorizada') : '✅ Concluída'}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 45%;">Produto / Descrição</th>
              <th style="text-align: center; width: 15%;">Qtd</th>
              <th style="text-align: right; width: 20%;">Preço Unit.</th>
              <th style="text-align: right; width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(venda.itens || []).map(item => `
              <tr>
                <td><strong>${item.nome}</strong></td>
                <td style="text-align: center;">${item.quantidade} ${item.permiteFracionado || (item.unidade && String(item.unidade).toLowerCase() === 'kg') ? 'kg' : 'un'}</td>
                <td style="text-align: right;">R$ ${(item.precoUnitario || 0).toFixed(2).replace('.', ',')}</td>
                <td style="text-align: right; font-weight: 700;">R$ ${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-box">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>R$ ${(venda.subtotal || venda.total || 0).toFixed(2).replace('.', ',')}</span>
          </div>
          ${venda.desconto > 0 ? `
            <div class="totals-row" style="color: #dc2626;">
              <span>Desconto:</span>
              <span>- R$ ${venda.desconto.toFixed(2).replace('.', ',')}</span>
            </div>
          ` : ''}
          <div class="totals-row grand-total">
            <span>TOTAL PAGO:</span>
            <span>R$ ${(venda.total || 0).toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        ${isNfce ? `
          <div class="fiscal-box">
            <div style="font-weight: 800; color: #166534; margin-bottom: 6px; font-size: 13px;">
              🏛️ DADOS FISCAIS SEFAZ — NFC-e Nº ${venda.numeroNfce || 1} &bull; Série ${venda.serieNfce || 1}
            </div>
            <div style="font-size: 12px; color: #14532d; font-family: monospace; word-break: break-all; margin-bottom: 6px;">
              <strong>Chave de Acesso:</strong> ${chaveFormatada}
            </div>
            <div style="font-size: 11.5px; color: #166534;">
              Protocolo de Autorização: <strong>${venda.protocoloNfe || '135260000000000'}</strong> &bull; Tributos Incidentes: R$ ${(venda.tributosAproximados || (venda.total * 0.184).toFixed(2))}
            </div>
          </div>
        ` : ''}

        <div class="footer">
          FlowPDV &bull; Sistema de Gestão Comercial &bull; Impresso em ${new Date().toLocaleString('pt-BR')}
        </div>
      </body>
      </html>
    `;

    this.executarImpressaoA4(html);
  }
};