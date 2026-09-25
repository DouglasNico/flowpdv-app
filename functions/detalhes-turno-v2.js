const { HttpsError } = require('firebase-functions/v2/https');
const fail = () => { throw new HttpsError('failed-precondition', 'Itens da venda inconsistentes ou acima do limite. Confira antes de integrar.'); };
const inteiro = (v, min = 0) => { if (!Number.isSafeInteger(v) || v < min || v > 1e12) fail(); return v; };
const texto = (v, max) => { if (typeof v !== 'string' || !v || v.length > max) fail(); return v; };

// Somente o retrato da venda: preços atuais do catálogo e status posterior não alteram o histórico.
function detalharMovimento(movimentoId, movimento, venda) {
  const sinal = movimento.tipo === 'recebimento_manual' ? 1 : movimento.tipo === 'estorno_manual' ? -1 : 0;
  if (!sinal || !venda || !Array.isArray(venda.itens) || !venda.itens.length || venda.itens.length > 300 || inteiro(venda.totalCentavos) !== sinal * movimento.totalCentavos) fail();
  const vistos = new Set();
  const itens = venda.itens.map(item => {
    const origemLinhaId = texto(item.origemLinhaId, 200);
    if (vistos.has(origemLinhaId)) fail(); vistos.add(origemLinhaId);
    const quantidade = inteiro(item.quantidade, 1), unitario = inteiro(item.precoUnitarioCentavos), total = inteiro(item.totalCentavos);
    if (quantidade * unitario !== total || !Array.isArray(item.opcoes) || item.opcoes.length > 100) fail();
    const opcoes = item.opcoes.map(o => ({ nome: texto(o.nome, 200), quantidade: inteiro(o.quantidade, 1), precoCentavos: inteiro(o.precoCentavos) }));
    if (opcoes.reduce((sum, o) => sum + o.quantidade * o.precoCentavos, 0) > unitario) fail();
    return { origemLinhaId, origemPedidoId: texto(item.origemPedidoId, 100), produtoId: texto(item.produtoId, 100), nome: texto(item.nome, 200), quantidade: sinal * quantidade, precoUnitarioCentavos: unitario, totalCentavos: sinal * total, opcoes };
  });
  const taxa = venda.tipo === 'delivery' ? inteiro(venda.taxaEntregaCentavos) : 0;
  if (taxa > 100000 || (venda.tipo !== 'delivery' && venda.taxaEntregaCentavos)) fail();
  if (itens.reduce((sum, i) => sum + i.totalCentavos, 0) + sinal * taxa !== movimento.totalCentavos) fail();
  return { movimentoId, vendaId: movimento.vendaId, tipo: movimento.tipo, totalCentavos: movimento.totalCentavos, itens,
    ...(venda.tipo === 'delivery' ? { taxaEntregaCentavos: sinal * taxa } : {}) };
}
module.exports = { detalharMovimento };
