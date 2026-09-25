const { createHash } = require('node:crypto');
const { prepararMigracaoLoja } = require('./migracao-loja-core.cjs');

// Plano puro: não ativa a loja, não publica e não copia credenciais/clientes.
function prepararPilotoAvulsos(snapshot, { pedidosSomenteHistorico = [] } = {}) {
  if (snapshot.key !== 'LIC-FLOW-937278') throw new Error('Piloto restrito à BURGER TESTE.');
  const migration = prepararMigracaoLoja(snapshot, { slug: 'burger-teste' });
  const active = migration.resumo.pendencias.find(p => p.tipo === 'pedidos_em_andamento')?.pedidoIds || [];
  if (active.some(id => !pedidosSomenteHistorico.includes(id))) throw new Error('Pedido em andamento sem decisão de migração.');
  const unsafe = migration.resumo.pendencias.filter(p => !['pedidos_em_andamento', 'combo_legado_sem_composicao', 'mapear_estoque_das_opcoes'].includes(p.tipo));
  if (unsafe.length) throw new Error('Saldo, comanda ou cadastro exige conferência antes do piloto.');
  const prepared = new Map(migration.docs.filter(d => d.path.includes('/preparacao_estoque/')).map(d => [d.data.plano.legadoId, d.data.plano]));
  const products = migration.docs.filter(d => d.path.includes('/produtos_legados/')).map(d => d.data.produto);
  const catalog = migration.docs.find(d => d.path === 'catalogos_publicos_v2/burger-teste').data;
  const fichas = products.map(p => {
    if (p.controlarEstoque === false) return { produtoId: String(p.id), ficha: { semEstoque: true } };
    if (!prepared.has(String(p.id))) throw new Error('Produto controlado sem saldo preparado.');
    return { produtoId: String(p.id), ficha: { consumos: [{ estoqueId: String(p.id), quantidadeMili: 1000 }] } };
  });
  // V2 vende unidades inteiras; não converter kg/g ou embalagem implicitamente.
  for (const p of products) if (String(p.unidade || p.unidadeMedida).toLowerCase() !== 'un'
    || p.precoFardo || p.codigoBarrasFardo || p.unidadeFracionada || Number(p.fatorConversao || 1) !== 1)
    throw new Error('Unidade ou embalagem incompatível com o piloto de avulsos.');
  const result = {
    schema: 1, lojaId: migration.resumo.lojaId, chave: snapshot.key, slug: 'burger-teste',
    capturadoEm: snapshot.capturadoEm, origemFingerprint: migration.resumo.fingerprint,
    decisoes: { somenteAvulsos: true, pedidosSomenteHistorico: [...active] },
    catalogo: { ...catalog, produtos: catalog.produtos.map(p => ({ ...p, grupos: [], migracaoRequerRevisao: false })),
      publicado: false, pausado: true, canais: { mesas: false, retirada: true, delivery: false } },
    fichas,
    mapeamentos: products.map(p => ({ produtoId: String(p.id),
      registro: p.controlarEstoque === false
        ? { semEstoque: true, plano: { legadoId: String(p.id), nome: p.nome, unidadeOrigem: 'un', unidade: 'un' } }
        : { estoqueId: String(p.id), plano: prepared.get(String(p.id)) } })),
    saldos: [...prepared.values()].map(p => ({ produtoId: p.legadoId, nome: p.nome, unidade: p.unidade, saldoMili: p.saldoMili })),
    resumo: { produtos: products.length, publicados: catalog.produtos.filter(p => p.ativo).length,
      comEstoque: prepared.size, semEstoque: products.length - prepared.size,
      pedidosHistoricos: migration.resumo.pedidosArquivados, pedidosOperacionaisImportados: 0 },
    corteOperacional: false
  };
  return { ...result, hash: createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}
module.exports = { prepararPilotoAvulsos };
