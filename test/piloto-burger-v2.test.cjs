const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');

test('BURGER TESTE: avulsos preservam preço, turno e estoque, sem duplicar pedido ou baixa', async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8180');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9199');
  const plan = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../output/migracao-v2-20260923/burger-piloto-avulsos.json')));
  assert.equal(plan.chave, 'LIC-FLOW-937278');
  assert.equal(plan.decisoes.somenteAvulsos, true);
  assert.equal(plan.resumo.pedidosOperacionaisImportados, 0);
  const server = admin.initializeApp({ projectId: 'demo-flowpdv' }, randomUUID());
  const db = server.firestore(), base = `lojas_v2/${plan.lojaId}`, apps = [];
  async function client(caixa = false) {
    const app = initializeApp({ projectId: 'demo-flowpdv', apiKey: 'demo-key' }, randomUUID()); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true }); await signInAnonymously(auth);
    const fn = getFunctions(app); connectFunctionsEmulator(fn, '127.0.0.1', 5101);
    if (caixa) {
      await db.doc(`terminais_v2/${auth.currentUser.uid}`).set({ ativo: true, lojaId: plan.lojaId, papel: 'caixa' });
      await db.doc(`${base}/membros/${auth.currentUser.uid}`).set({ ativo: true, tipo: 'terminal', papel: 'caixa' });
    }
    return (name, data = {}) => httpsCallable(fn, name)(data).then(r => r.data);
  }
  try {
    const batch = db.batch();
    batch.set(db.doc(base), { ativo: true, slug: plan.slug, modulos: { cardapio: true, retirada: true, combos: false },
      caixaV2: { exigirTurno: true }, ativacaoOperacionalV2: { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 2 } });
    batch.set(db.doc(`rotas_publicas_v2/${plan.slug}`), { lojaId: plan.lojaId });
    batch.set(db.doc(`catalogos_publicos_v2/${plan.slug}`), { ...plan.catalogo, publicado: true, pausado: false });
    for (const p of plan.fichas) batch.set(db.doc(`${base}/fichas_estoque/${p.produtoId}`), p.ficha);
    for (const p of plan.saldos) batch.set(db.doc(`${base}/estoque/${p.produtoId}`), { unidade: p.unidade, saldoMili: p.saldoMili });
    for (const p of plan.mapeamentos) batch.set(db.doc(`${base}/migracoes_estoque/${createHash('sha256').update(p.produtoId).digest('hex')}`), p.registro);
    await batch.commit();
    const caixa = await client(true), cliente = await client();
    const turno = { id: 'TURNO-BURGER-ENSAIO', terminalId: 'TERMINAL-ENSAIO', dataAbertura: new Date().toISOString() };
    await caixa('abrirTurnoCaixaV2', { turno, trocoInicialCentavos: 0 });
    const products = plan.catalogo.produtos.filter(p => p.ativo && !p.esgotado);
    assert.ok(products.some(p => plan.saldos.some(s => s.produtoId === p.id)), 'Ensaio deve incluir estoque controlado.');
    assert.ok(products.some(p => plan.fichas.find(f => f.produtoId === p.id).ficha.semEstoque), 'Ensaio deve incluir produto sem estoque.');
    const payload = { slug: plan.slug, requestId: randomUUID(), tipo: 'retirada', catalogoVersao: plan.catalogo.versao,
      itens: products.map(p => ({ produtoId: p.id, quantidade: 1, precoEsperadoCentavos: p.precoCentavos, opcoes: [] })) };
    const total = products.reduce((s, p) => s + p.precoCentavos, 0);
    const [first, repeated] = await Promise.all([cliente('criarPedidoPublicoV2', payload), cliente('criarPedidoPublicoV2', payload)]);
    assert.equal(first.pedidoId, repeated.pedidoId); assert.equal(first.totalCentavos, total);
    await db.doc(base).update({'ativacaoOperacionalV2.estado':'suspensa'});
    await assert.rejects(caixa('receberPedidoPdvV2', { pedidoId:first.pedidoId }), /suspensas/i);
    assert.equal((await db.collection(base+'/atendimentos').get()).size,0);
    await db.doc(base).update({'ativacaoOperacionalV2.estado':'habilitada'});
    const [received, receivedAgain] = await Promise.all([caixa('receberPedidoPdvV2', { pedidoId: first.pedidoId }), caixa('receberPedidoPdvV2', { pedidoId: first.pedidoId })]);
    assert.equal(received.atendimentoId, receivedAgain.atendimentoId);
    const account = (await db.doc(`${base}/atendimentos/${received.atendimentoId}`).get()).data();
    assert.equal(account.itens.length, products.length); assert.equal(account.totalCentavos, total);
    const payment = { atendimentoId: received.atendimentoId, versao: account.versao, turno, confirmado: true,
      pagamentos: [{ forma: 'dinheiro', valorCentavos: total }] };
    await Promise.all([caixa('fecharAtendimentoV2', payment), caixa('fecharAtendimentoV2', payment)]);
    assert.equal((await caixa('fecharAtendimentoV2', payment)).reutilizado, true);
    for (const p of plan.saldos) {
      const expected = p.saldoMili - (products.some(i => i.id === p.produtoId) ? 1000 : 0);
      assert.equal((await db.doc(`${base}/estoque/${p.produtoId}`).get()).data().saldoMili, expected);
    }
    const financeiro = await caixa('consultarMovimentosTurnoV2', { turno });
    assert.equal(financeiro.movimentos.length, 1); assert.equal(financeiro.movimentos[0].totalCentavos, total);
    assert.equal((await db.collection(`${base}/pedidos`).get()).size, 1);
    for (const id of plan.decisoes.pedidosSomenteHistorico) assert.equal((await db.doc(`${base}/pedidos/${id}`).get()).exists, false);
    const bad = structuredClone(payload); bad.requestId = randomUUID(); bad.itens[0].precoEsperadoCentavos++;
    await assert.rejects(cliente('criarPedidoPublicoV2', bad), /preço/i);
    // Mesmo estoque também atende o balcão: misturar lanche sem controle e lata controlada.
    const localPayload = { vendaId: 'VL-BURGER-ENSAIO', turno, confirmado: true, totalCentavos: total,
      itens: products.map(p => ({ legadoId: p.id, quantidade: '1', precoUnitarioCentavos: p.precoCentavos })) };
    const sale = await caixa('registrarBaixaVendaLocalV2', localPayload);
    assert.equal(sale.itensSemEstoque.length + sale.consumos.length, products.length);
    assert.equal((await caixa('registrarBaixaVendaLocalV2', localPayload)).reutilizado, true);
    await caixa('confirmarGravacaoVendaLocalV2', { vendaId: localPayload.vendaId, reciboId: sale.reciboId });
    for (const p of plan.saldos) assert.equal((await db.doc(`${base}/estoque/${p.produtoId}`).get()).data().saldoMili,
      p.saldoMili - (products.some(i => i.id === p.produtoId) ? 2000 : 0));
    const sem = products.find(p => plan.fichas.find(f => f.produtoId === p.id).ficha.semEstoque);
    await db.doc(`${base}/fichas_estoque/${sem.id}`).set({ consumos: [] });
    await assert.rejects(caixa('registrarBaixaVendaLocalV2', { ...localPayload, vendaId: 'VL-INCONSISTENTE' }), /cadastro/i);
    const result = { ambiente: 'emuladores locais', captura: plan.capturadoEm, planoHash: plan.hash, produtosNoPedido: products.length,
      totalCentavos: total, pedidos: 1, movimentosFinanceiros: 1, estoqueBaixadoUmaVez: true, pedidoAntigoReimportado: false,
      vendaBalcaoMista: true, producaoAtivada: false, instaladorValidado: false };
    fs.writeFileSync(path.resolve(__dirname, '../../output/migracao-v2-20260923/ensaio-avulsos-recibo.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.resolve(__dirname, '../../output/migracao-v2-20260923/burger-piloto-avulsos-validado.json'), JSON.stringify(plan, null, 2));
    console.log(JSON.stringify(result));
  } finally { await Promise.all(apps.map(deleteApp)); await server.delete(); }
});
