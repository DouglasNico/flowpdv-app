const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  admin.initializeApp({ projectId: 'demo-flowpdv' });
  await admin.auth().createUser({ uid: 'gerente-ui', email: 'gerente-ui@example.test', password: 'TesteLocal-123!', emailVerified: true });
  const db = admin.firestore();
  await admin.auth().createUser({ uid: 'caixa-recuperacao-ui' });
  await db.doc('terminais_v2/caixa-recuperacao-ui').set({ lojaId: 'demo-loja-interface', papel: 'caixa', ativo: true });
  await db.doc('lojas_v2/demo-loja-interface/membros/caixa-recuperacao-ui').set({ papel: 'caixa', tipo: 'terminal', ativo: true });
  for (const id of ['demo-loja-interface', 'demo-loja-outra']) await db.doc(`lojas_v2/${id}`).set({ nome: 'Lanchonete fictícia', ativo: true });
  await db.doc('lojas_v2/demo-loja-interface').update({ caixaV2: { exigirTurno: true }, cozinha: { impressao: true, kds: true, papelMm: 80 } });
  await db.doc('lojas_v2/demo-loja-interface/membros/gerente-ui').set({ papel: 'gerente', tipo: 'usuario', ativo: true });
  await db.doc('lojas_v2/demo-loja-interface/mesas/mesa-1').set({ ativo: true, nome: 'Mesa 1', comandaPdvId: 'MESA-1' });
  await db.doc('lojas_v2/demo-loja-interface/fichas_estoque/lanche').set({ consumos: [{ estoqueId: 'lanche', quantidadeMili: 1000 }], opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', consumos: [{ estoqueId: 'bacon', quantidadeMili: 200 }] }] });
  for (const stockId of ['lanche', 'bacon']) await db.doc(`lojas_v2/demo-loja-interface/estoque/${stockId}`).set({ saldoMili: 10000 });
  await db.doc('rotas_publicas_v2/recebimento-ui').set({ lojaId: 'demo-loja-interface' });
  await db.doc('catalogos_publicos_v2/recebimento-ui').set({ publicado: true, pausado: false, versao: 1, produtos: [
    { id: 'lanche', nome: 'Lanche fictício', ativo: true, precoCentavos: 1000, grupos: [
      { id: 'extras', nome: 'Adicionais', min: 0, max: 1, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 1 }] }
    ] }
  ] });
  const local = require('node:module').createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
  const { initializeApp, deleteApp } = local('firebase/app');
  const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
  const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
  const app = initializeApp({ projectId: 'demo-flowpdv', apiKey: 'demo-key' }, 'customer-ui');
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInAnonymously(auth);
  const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const created = (await httpsCallable(fn, 'criarPedidoPublicoV2')({ slug: 'recebimento-ui', requestId: require('node:crypto').randomUUID(), tipo: 'mesa', mesaId: 'mesa-1', catalogoVersao: 1,
    itens: [{ produtoId: 'lanche', quantidade: 1, observacao: 'Sem cebola', opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', quantidade: 1 }] }] })).data;
  await deleteApp(app);
  const result = spawnSync(require('electron'), [path.join(__dirname, 'electron-isolation.smoke.cjs')], {
    stdio: 'inherit', timeout: 440000, env: { ...process.env, FLOWPDV_PAIRING_UI_TEST: '1' }
  });
  if (result.status === 0) {
    const recovered = (await db.doc('terminais_v2/caixa-recuperacao-ui').get()).data();
    assert.ok(recovered.identidadeOperacionalUid);
    const original = (await db.doc(`terminais_v2/${recovered.identidadeOperacionalUid}`).get()).data();
    assert.equal(original.ativo, false); assert.equal(original.substituidoPor, 'caixa-recuperacao-ui');
    assert.equal((await db.collection('lojas_v2/demo-loja-interface/recuperacoes_terminais').get()).size, 1);
    const settings = (await db.doc('lojas_v2/demo-loja-interface').get()).data();
    assert.equal(settings.segmento, 'padaria'); assert.equal(settings.cozinha.kds, true); assert.ok(settings.cozinha.terminalUid);
    assert.equal((await db.doc('lojas_v2/demo-loja-interface/estoque/sal-painel').get()).data().saldoMili, 2500);
    assert.equal((await db.doc('lojas_v2/demo-loja-interface/fichas_estoque/agua-painel').get()).data().semEstoque, true);
    const product = (await db.doc('catalogos_publicos_v2/recebimento-ui').get()).data().produtos.find(p => p.id === 'agua-painel');
    assert.equal(product.precoCentavos, 350); assert.equal(product.grupos[0].opcoes[0].nome, 'Gelada');
    const saved = (await db.doc(`lojas_v2/demo-loja-interface/pedidos/${created.pedidoId}`).get()).data();
    assert.equal(saved.recebidoPdv, true);
    const account = (await db.doc(`lojas_v2/demo-loja-interface/atendimentos/${saved.atendimentoId}`).get()).data();
    assert.equal(account.itens.length, 1); assert.equal(account.totalCentavos, 1250);
    assert.equal(saved.status, 'cancelado'); assert.equal(saved.pagamento, 'estornado'); assert.equal(account.status, 'fechado');
    const sale = (await db.doc(`lojas_v2/demo-loja-interface/vendas/${saved.vendaId}`).get()).data();
    assert.equal(sale.trocoCentavos, 750); assert.equal(sale.status, 'estornada');
    assert.equal((await db.collection('lojas_v2/demo-loja-interface/vendas').get()).size, 1);
    const turns=await db.collection('lojas_v2/demo-loja-interface/turnos_v2').get();assert.equal(turns.size,3);
    const opened=turns.docs.map(d=>d.data()).filter(t=>t.status==='aberto');assert.equal(opened.length,1);assert.equal(opened[0].trocoInicialCentavos,1000);assert.equal(opened[0].totalCentavos,0);
    const migrated=await db.collection('lojas_v2/demo-loja-interface/estoque').where('legadoId','==','farinha-legado-teste').get();assert.equal(migrated.size,1);assert.equal(migrated.docs[0].data().saldoMili,2250);assert.equal(migrated.docs[0].data().unidade,'kg');
    const sugar=await db.collection('lojas_v2/demo-loja-interface/estoque').where('legadoId','==','acucar-legado-teste').get();assert.equal(sugar.size,1);assert.equal(sugar.docs[0].data().saldoMili,750);
    const localSales=await db.collection('lojas_v2/demo-loja-interface/vendas_locais_v2').get();assert.equal(localSales.size,4);
    const cartSales=localSales.docs.filter(d=>d.data().status==='confirmado');assert.equal(cartSales.length,1);assert.equal(cartSales[0].data().recibo.venda.itens.length,2);assert.equal(cartSales[0].data().recibo.venda.totalCentavos,800);
    assert.deepEqual(cartSales[0].data().recibo.venda.pagamentos,[{forma:'Dinheiro',valorCentavos:300},{forma:'PIX',valorCentavos:200},{forma:'Débito',valorCentavos:100},{forma:'Crédito',valorCentavos:200}]);assert.equal(cartSales[0].data().recibo.venda.recebidoDinheiroCentavos,1000);assert.equal(cartSales[0].data().recibo.venda.trocoCentavos,700);
    assert.equal(localSales.docs.filter(d=>d.data().status==='estornado').length,1);
    assert.deepEqual(cartSales[0].data().recibo.venda.ajuste,{descontoCentavos:50,acrescimoCentavos:150,motivo:'Acordo comercial'});assert.equal(cartSales[0].data().recibo.venda.subtotalCentavos,700);
    const refunded=localSales.docs.find(d=>d.data().status==='estornado').data().estorno.recibo;
    assert.equal(refunded.totalCentavos,500);assert.notEqual(refunded.turno.id,refunded.turnoVenda.id);
    const canceled=localSales.docs.filter(d=>d.data().status==='cancelado');assert.equal(canceled.length,2);
    assert.equal(canceled.filter(d=>d.data().cancelamento.estoqueDevolvido).length,1);assert.equal(opened[0].baixasLocaisPendentes,0);
    for (const stockId of ['lanche', 'bacon']) assert.equal((await db.doc(`lojas_v2/demo-loja-interface/estoque/${stockId}`).get()).data().saldoMili, 10000);
    const jobs = await db.collection('lojas_v2/demo-loja-interface/impressoes_cozinha').get();
    assert.equal(jobs.size, 3); assert.ok(jobs.docs.every(d => d.data().status === 'simulado'));
    const tracking = await fetch('http://127.0.0.1:5001/demo-flowpdv/us-central1/acompanharPedidoPublicoV2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { token: created.acompanhamentoToken } }) });
    const trackingBody = await tracking.json(); assert.equal(trackingBody.result.status, 'cancelado'); assert.equal(trackingBody.result.pagamento, 'estornado');
    console.log('FECHAMENTO UI PASS: pagamento manual, troco, recarga sem venda duplicada, estorno com estoque e aviso de cancelamento.');
    console.log('COZINHA UI PASS: simulação automática, KDS até entrega, acompanhamento público, segunda via e recarga sem impressão extra.');
    console.log('RECEBIMENTO UI PASS: API pública → PDV → mesa, adicionais, observações e recarga sem duplicação.');
  }
  await admin.app().delete();
  if (result.error) throw result.error;
  process.exitCode = result.status === 0 ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
