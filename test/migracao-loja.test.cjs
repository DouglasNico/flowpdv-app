const test = require('node:test');
const assert = require('node:assert/strict');
const { prepararMigracaoLoja, documentData } = require('../functions/migracao-loja-core.cjs');
const { encode, writesFor } = require('../scripts/preparar-burger-v2.cjs');
const { prepararPilotoAvulsos } = require('../functions/piloto-avulsos-core.cjs');
const key = 'LIC-FLOW-937278';
const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
function fixture() {
  const doc = (p, value) => ({ name: prefix + p, updateTime: '2026-09-23T12:00:00Z', fields: encode(value).mapValue.fields });
  const snaps = {};
  const add = (p, value) => { snaps[p] = doc(p, value); };
  add(`licencas/${key}`, { nome: 'Loja teste', pin: 'SEGREDO', modulos: {} });
  add(`backups_lojas/${key}`, { partes: { produtos: 1 }, comandas: [], usuarios: [{ senha: 'SEGREDO' }] });
  add(`backups_lojas/${key}/partes/produtos_0`, { itens: [{ id: 'p1', nome: 'Bebida', precoVenda: 6, controlarEstoque: true, estoque: 50, unidadeMedida: 'UN' }] });
  add(`cardapio_publico/${key}`, { nome: 'Loja teste', produtos: [{ id: 'p1', preco: 6, grupos: [] }] });
  add(`cardapio_config/${key}`, { whatsapp: '19999999999' });
  return { key, capturadoEm: '2026-09-23T12:01:00Z', snaps, lists: { [`backups_lojas/${key}/pedidos`]: [doc(`backups_lojas/${key}/pedidos/pedido1`, { status: 'em_preparo', total: 6 })], [`cardapio_config/${key}/produtos`]: [] } };
}
const prepare = s => prepararMigracaoLoja(s, { slug: 'burger-teste' });

test('piloto avulso exige decisão explícita do histórico e não transporta credenciais', () => {
  const s = fixture(), before = structuredClone(s);
  assert.throws(() => prepararPilotoAvulsos(s), /decisão/);
  const p = prepararPilotoAvulsos(s, { pedidosSomenteHistorico: ['pedido1'] });
  assert.deepEqual(s, before);
  assert.equal(p.resumo.pedidosOperacionaisImportados, 0);
  assert.equal(p.catalogo.publicado, false);
  assert.equal(p.corteOperacional, false);
  assert.equal(p.saldos[0].saldoMili, 50000);
  assert.equal(JSON.stringify(p).includes('SEGREDO'), false);
  assert.throws(() => prepararPilotoAvulsos({ ...s, key: 'LIC-OUTRA' }), /restrito/);
});

test('piloto avulso retira opções ambíguas e preserva produto explicitamente sem estoque', () => {
  const s = fixture(), productPath = `backups_lojas/${key}/partes/produtos_0`;
  s.snaps[productPath].fields = encode({ itens: [
    { id: 'p1', nome: 'Lanche', precoVenda: 18.9, controlarEstoque: false, unidadeMedida: 'UN' }
  ] }).mapValue.fields;
  s.snaps[`cardapio_publico/${key}`].fields = encode({ nome: 'Teste', produtos: [{ id: 'p1', preco: 18.9,
    grupos: [{ id: 'combo', nome: 'Combo', min: 0, max: 1, opcoes: [{ id: 'bebida', nome: 'Bebida', preco: 6 }] }] }] }).mapValue.fields;
  const p = prepararPilotoAvulsos(s, { pedidosSomenteHistorico: ['pedido1'] });
  assert.deepEqual(p.catalogo.produtos[0].grupos, []);
  assert.equal(p.catalogo.produtos[0].precoCentavos, 1890);
  assert.deepEqual(p.fichas[0].ficha, { semEstoque: true });
  assert.equal(p.saldos.length, 0);
  const product = documentData(s.snaps[productPath]).itens[0];
  s.snaps[productPath].fields = encode({ itens: [{ ...product, unidadeMedida: 'KG' }] }).mapValue.fields;
  assert.throws(() => prepararPilotoAvulsos(s, { pedidosSomenteHistorico: ['pedido1'] }), /Unidade/);
});
test('prepara saldos e histórico sem criar recebimento, venda ou estoque operacional', () => {
  const source = fixture(), before = structuredClone(source), result = prepare(source);
  assert.deepEqual(source, before);
  assert.equal(result.resumo.pedidosEmAndamento, 1);
  assert.equal(result.resumo.saldosPreparados, 1);
  assert.ok(!result.docs.some(d => /\/(estoque|pedidos|vendas|atendimentos|movimentos_estoque)\//.test(d.path)));
  assert.equal(result.docs.find(d => d.path.includes('/preparacao_estoque/')).data.plano.saldoMili, 50000);
  assert.equal(result.docs.find(d => d.path.startsWith('catalogos_publicos_v2/')).data.publicado, false);
  assert.equal(result.docs.find(d => d.path === 'lojas_v2/legado-lic-flow-937278').data.ativo, false);
  assert.ok(!JSON.stringify(result.docs).includes('SEGREDO'));
});
test('lote protege todas as versões de origem e nunca atualiza destino existente', () => {
  const plan = prepare(fixture()), writes = writesFor(plan);
  assert.equal(writes.filter(w => w.verify).length, plan.sourceDocs.length);
  for (const w of writes) {
    if (w.verify) assert.ok(w.currentDocument.updateTime);
    else { assert.deepEqual(w.currentDocument, { exists: false }); assert.ok(!w.updateMask); }
  }
  assert.throws(() => writesFor({ ...plan, resumo: { ...plan.resumo, chave: 'LIC-FLOW-OUTRA' } }), /Escopo/);
});
test('recusa parte ausente, produtos duplicados e origem sem versão', () => {
  const missing = fixture(); delete missing.snaps[`backups_lojas/${key}/partes/produtos_0`];
  assert.throws(() => prepare(missing), /Parte/);
  const duplicate = fixture(), part = duplicate.snaps[`backups_lojas/${key}/partes/produtos_0`];
  part.fields.itens.arrayValue.values.push(structuredClone(part.fields.itens.arrayValue.values[0]));
  assert.throws(() => prepare(duplicate), /duplicados/);
  const stale = fixture(); delete stale.lists[`backups_lojas/${key}/pedidos`][0].updateTime;
  assert.throws(() => prepare(stale), /Versões/);
});
test('serialização preserva nulos, listas e valores monetários e rejeita perda silenciosa', () => {
  const value = { a: null, b: [12, 12.5, false, 'x'], c: {} };
  assert.deepEqual(documentData({ fields: encode(value).mapValue.fields }), value);
  assert.throws(() => encode({ a: undefined }), /serializável/);
  assert.throws(() => encode(NaN), /serializável/);
});
