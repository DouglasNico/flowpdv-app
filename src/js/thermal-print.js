/**
 * thermal-print.js - Gerador e Impressor de Comprovantes Térmicos (58mm / 80mm)
 */

import { StorageService } from './storage.js';

export const ThermalPrintModule = {
  init() {},

  executarImpressao(html) {
    if (window.electronAPI && typeof window.electronAPI.printThermalReceipt === 'function') {
      window.electronAPI.printThermalReceipt(html, false).catch((err) => {
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
    const config = StorageService.getConfig();
    const largura = config.impressoraTipo === '80mm' ? '72mm' : '48mm';

    // Se a venda teve pagamento em dinheiro, envia pulso para abrir gaveta
    const teveDinheiro = venda.formaPagamento === 'Dinheiro' ||
      (venda.pagamentoDividido && (venda.parcela1?.forma === 'Dinheiro' || venda.parcela2?.forma === 'Dinheiro'));
    if (teveDinheiro) {
      this.abrirGavetaDinheiro();
    }

    const isNfce = Boolean(venda.chaveNfe || venda.statusFiscal === 'autorizada');
    const chaveFormatada = (venda.chaveNfe || '').replace(/(.{4})/g, '$1 ').trim();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', monospace;
            width: ${largura};
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .table-items { width: 100%; border-collapse: collapse; font-size: 10px; }
          .table-items td { padding: 2px 0; vertical-align: top; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 13px;">${config.nomeEmpresa || 'FLOWPDV'}</div>
        ${config.cidade ? `<div class="text-center">${config.cidade}</div>` : ''}
        ${config.cnpj ? `<div class="text-center">CNPJ: ${config.cnpj}</div>` : ''}
        ${config.telefone ? `<div class="text-center">Tel/Whats: ${config.telefone}</div>` : ''}
        
        <div class="divider"></div>
        ${isNfce ? `
          <div class="text-center bold">DANFE NFC-e - Documento Auxiliar</div>
          <div class="text-center bold">Nota Fiscal de Consumidor Eletrônica</div>
          ${venda.ambiente === 'homologacao' ? '<div class="text-center bold" style="color: #555; font-size: 9.5px; margin-top: 2px;">EMITIDA EM HOMOLOGAÇÃO - SEM VALOR FISCAL</div>' : ''}
          <div style="font-size: 10px; margin-top: 4px;">NFC-e Nº: <strong>${venda.numeroNfce || 1}</strong> &bull; Série: <strong>${venda.serieNfce || 1}</strong></div>
          <div style="font-size: 10px;">Protocolo: <strong>${venda.protocoloNfe || '135260000000000'}</strong></div>
        ` : `
          <div class="text-center bold">CUPOM NÃO FISCAL</div>
        `}
        <div>Venda: #${venda.numeroVenda ? String(venda.numeroVenda).padStart(6, '0') : (venda.id || '').slice(-6)}</div>
        <div>Data: ${new Date(venda.data).toLocaleString('pt-BR')}</div>
        <div>Operador: ${venda.operador || 'Caixa'}</div>
        ${venda.cpfCliente ? `
          <div class="bold" style="font-size: 10.5px; margin-top: 2px;">CONSUMIDOR CPF: ${venda.cpfCliente}</div>
        ` : (isNfce ? `
          <div style="font-size: 9.5px; margin-top: 2px; color: #444;">CONSUMIDOR NÃO IDENTIFICADO</div>
        ` : '')}
        <div class="divider"></div>

        <table class="table-items">
          <thead>
            <tr class="bold">
              <td>ITEM</td>
              <td class="text-center">QTD</td>
              <td class="text-right">TOTAL</td>
            </tr>
          </thead>
          <tbody>
            ${(venda.itens || []).map(item => `
              <tr>
                <td>${item.nome}</td>
                <td class="text-center">${item.quantidade}x</td>
                <td class="text-right">R$ ${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>R$ ${(venda.subtotal || venda.total || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        ${venda.desconto > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Desconto:</span>
            <span>- R$ ${venda.desconto.toFixed(2).replace('.', ',')}</span>
          </div>
        ` : ''}
        <div class="bold" style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
          <span>TOTAL:</span>
          <span>R$ ${(venda.total || 0).toFixed(2).replace('.', ',')}</span>
        </div>
        
        <div class="divider"></div>
        ${(venda.pagamentos && venda.pagamentos.length > 0) ? `
          <div>Forma de Pagto: <span class="bold">MULTI-PAGAMENTO</span></div>
          ${venda.pagamentos.map(p => `
            <div style="font-size: 11px; padding-left: 4px; display: flex; justify-content: space-between;">
              <span>• ${p.forma}:</span>
              <span>R$ ${p.valor.toFixed(2).replace('.', ',')}</span>
            </div>
          `).join('')}
        ` : (venda.pagamentoDividido && venda.parcela1 && venda.parcela2) ? `
          <div>Forma de Pagto: <span class="bold">DIVIDIDO</span></div>
          <div style="font-size: 11px; padding-left: 4px;">• ${venda.parcela1.forma}: R$ ${venda.parcela1.valor.toFixed(2).replace('.', ',')}</div>
          <div style="font-size: 11px; padding-left: 4px;">• ${venda.parcela2.forma}: R$ ${venda.parcela2.valor.toFixed(2).replace('.', ',')}</div>
        ` : `
          <div>Forma de Pagto: <span class="bold">${venda.formaPagamento || 'Dinheiro'}</span></div>
        `}
        ${venda.valorPago > 0 ? `<div>Valor Pago: R$ ${venda.valorPago.toFixed(2).replace('.', ',')}</div>` : ''}
        ${venda.troco > 0 ? `<div>Troco: R$ ${venda.troco.toFixed(2).replace('.', ',')}</div>` : ''}

        ${isNfce ? `
          <div class="divider"></div>
          <div style="font-size: 9.5px; text-align: center; word-break: break-all;">
            <strong>CHAVE DE ACESSO:</strong><br>
            <span style="font-family: monospace; font-size: 9px;">${chaveFormatada}</span>
          </div>
          <div style="font-size: 9px; text-align: center; margin-top: 4px;">
            Consulte pela Chave de Acesso em:<br>
            <strong>www.fazenda.sp.gov.br/nfce/consulta</strong>
          </div>
          <div class="divider"></div>
          <div style="font-size: 8.5px; text-align: center; color: #444;">
            * Tributos Incidentes (Lei 12.741/2012): R$ ${venda.tributosAproximados || (venda.total * 0.184).toFixed(2).replace('.', ',')}
          </div>
        ` : ''}

        <div class="divider"></div>
        <div class="text-center" style="margin-top: 6px;">
          Obrigado pela preferência!<br>
          Volte Sempre!
        </div>
      </body>
      </html>
    `;

    this.executarImpressao(html);
  },

  imprimirFechamentoCaixa(turno) {
    if (!turno) return;
    const config = StorageService.getConfig();
    const largura = config.impressoraTipo === '80mm' ? '72mm' : '48mm';

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
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', monospace;
            width: ${largura};
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
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
            <span>#${venda.numeroVenda ? String(venda.numeroVenda).padStart(6, '0') : (venda.id || '').slice(-6)}</span>
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
                <td style="text-align: center;">${item.quantidade} un</td>
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