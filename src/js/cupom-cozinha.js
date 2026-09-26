const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function textoComboPedido(item) {
  if (item.variante !== 'combo') return '';
  return 'Combo — incluso por unidade: ' + (item.componentes || []).slice(1)
    .map(c => `${c.quantidade} × ${c.nome || c.produtoId}`).join(', ');
}

export function gerarCupomEntrega(pedido, { papelMm = 80 } = {}) {
  const mm=papelMm===58?58:80,e=pedido.entrega;
  const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{size:${mm}mm auto;margin:0}body{width:${mm-8}mm;margin:4mm;font:14px/1.4 monospace;overflow-wrap:anywhere}h1{font-size:20px}</style></head><body><h1>DELIVERY — TESTE</h1><p>PRÉVIA — SEM IMPRESSÃO FÍSICA</p><p>Pedido ${escape(pedido.pedidoId)}</p><p>${escape(e.nome)}<br>${escape(e.telefone)}</p><p>${escape(e.logradouro)}, ${escape(e.numero)}<br>${escape(e.complemento)}<br>${escape(e.bairro)} — ${escape(e.cidade)}/${escape(e.uf)}<br>CEP ${escape(e.cep)}</p>${pedido.itens.map(i=>`<p>${escape(i.quantidade)} × ${escape(i.nome)} — ${escape(money(i.totalCentavos))}</p>${i.variante === 'combo' ? `<p>${escape(textoComboPedido(i))}</p>` : ''}`).join('')}<p>Taxa de entrega: ${escape(money(pedido.taxaEntregaCentavos))}<br>Total: ${escape(money(pedido.totalCentavos))}</p><p>Pagamento: ${escape(pedido.pagamento)}<br>Responsável: ${escape(pedido.responsavel||'Não atribuído')}</p><p>Conferência de entrega — não fiscal</p></body></html>`;
}

export function gerarCupomCozinha(pedido, { papelMm = 80, via = 1, simulado = false } = {}) {
  const mm = papelMm === 58 ? 58 : 80;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>
    @page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}body{width:${mm - 8}mm;margin:4mm;font:15px/1.35 monospace;color:#000;background:#fff;overflow-wrap:anywhere}h1{font-size:24px;margin:0}h2{font-size:20px}p{margin:6px 0}section{border-top:1px dashed #000;padding:10px 0;break-inside:avoid}.obs{font-weight:bold;font-size:17px}.warning{border:2px solid #000;padding:6px;font-weight:bold}
    </style></head><body><h1>COZINHA</h1>${simulado ? '<p class="warning">TESTE — SEM IMPRESSÃO FÍSICA</p>' : ''}${via > 1 ? `<p class="warning">REIMPRESSÃO • VIA ${escape(via)}</p>` : ''}
    ${pedido.avisoCancelamento ? `<p class="warning">CANCELAMENTO — NÃO PREPARAR<br>${escape(pedido.avisoCancelamento)}</p>` : ''}<h2>${escape(pedido.tipo==='delivery'?'Delivery':pedido.mesaNome || 'Retirada')}</h2><p>Pedido: ${escape(pedido.pedidoId)}</p>
    ${pedido.criadoEm ? `<p>${escape(new Date(pedido.criadoEm).toLocaleString('pt-BR'))}</p>` : ''}
    ${pedido.itens.map(item => `<section><strong>${escape(item.quantidade)} × ${escape(item.nome)}</strong>${item.variante === 'combo' ? `<p>${escape(textoComboPedido(item))}</p>` : ''}${(item.opcoes || []).map(o => `<p>+ ${escape(o.quantidade)} × ${escape(o.nome)} (por unidade)</p>`).join('')}${item.observacao ? `<p class="obs">OBS.: ${escape(item.observacao)}</p>` : ''}</section>`).join('')}
    <p>Comanda de preparo — não fiscal</p></body></html>`;
}

// Adaptador reutilizável. O modo local nunca chama o driver ou a impressora.
export async function enviarCupomCozinha(pedido, { api, papelMm = 80, via = 1, impressora, preview } = {}) {
  if (!api) throw new Error('Impressão requer o aplicativo do PDV.');
  const simulado = api.ambienteTeste === true;
  if (!simulado && !impressora?.trim()) throw new Error('Selecione a impressora da cozinha.');
  const html = gerarCupomCozinha(pedido, { papelMm, via, simulado });
  if (preview) preview(html);
  if (simulado) return 'simulado';
  const result = await api.printThermalReceipt(html, true, { papelMm, deviceName: impressora });
  // Aceitação pelo driver não comprova que o papel saiu; erro também pode ser ambíguo.
  return result?.success ? 'enviado_driver' : 'incerto';
}
