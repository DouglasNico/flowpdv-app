const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const { getFirestore, connectFirestoreEmulator, getDocFromServer, setDoc, doc, setLogLevel } = local('firebase/firestore');
const apps = []; let db, a, b, kitchen, stranger;
const isolated = process.env.FLOWPDV_COMBOS_ISOLADO === '1';
const ports = isolated ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
async function client(role, lojaId = 'cozinha-a') {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true }); await signInAnonymously(auth);
  const uid = auth.currentUser.uid;
  const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
  const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', ports.firestore);
  if (role) {
    await db.doc(`terminais_v2/${uid}`).set({ ativo: true, papel: role, lojaId });
    await db.doc(`lojas_v2/${lojaId}/membros/${uid}`).set({ ativo: true, papel: role, tipo: 'terminal' });
  }
  return { uid, store, call: async (name, data) => (await httpsCallable(fn, name)(data)).data, receive: async pedidoId => (await httpsCallable(fn, 'receberPedidoPdvV2')({ pedidoId, lojaId: 'ignored' })).data };
}
const base = 'lojas_v2/cozinha-a';
async function order({ tipo = 'mesa', mapped = true, mesaId = randomUUID(), status = 'novo' } = {}) {
  const id = randomUUID();
  if (tipo === 'mesa') await db.doc(`${base}/mesas/${mesaId}`).set({ ativo: true, nome: 'Mesa 7', ...(mapped ? { comandaPdvId: 'MESA-7' } : {}) }, { merge: true });
  await db.doc(`${base}/pedidos/${id}`).set({ tipo, mesaId: tipo === 'mesa' ? mesaId : null, mesaNome: tipo === 'mesa' ? 'Mesa 7' : null, recebidoPdv: false, status, totalCentavos: 2500, itens: [
    { linhaId: randomUUID(), produtoId: 'lanche', nome: 'Lanche', quantidade: 2, precoUnitarioCentavos: 1250, totalCentavos: 2500, observacao: 'Sem cebola', opcoes: [{ nome: 'Bacon', quantidade: 1, precoCentavos: 250 }] }
  ] });
  return id;
}
const attendance = async id => (await db.doc(`${base}/atendimentos/${id}`).get()).data();
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore(); setLogLevel('silent');
  await db.doc(base).set({ ativo: true }); await db.doc('lojas_v2/cozinha-b').set({ ativo: true });
  a = await client('caixa'); b = await client('caixa'); kitchen = await client('cozinha'); stranger = await client();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });
const setup = async (impressao = true, kds = true) => db.doc(base).update({ cozinha: { impressao, kds, papelMm: 80 } });
const jobRef = id => db.doc(`${base}/impressoes_cozinha/${id}`);
const reserve = (c, jobId, tentativa = randomUUID()) => c.call('reservarImpressaoCozinhaV2', { jobId, tentativa });
const advance = (c, pedidoId, de, para) => c.call('avancarPreparoV2', { pedidoId, de, para });

test('recepção cria somente um cupom por pedido, inclusive com dois caixas', async () => {
  await setup(); const id = await order(); await Promise.all([a.receive(id), b.receive(id)]);
  const job = (await jobRef(id).get()).data(); assert.equal(job.status, 'pendente'); assert.equal(job.via, 1);
  const attempt = randomUUID(); const results = await Promise.all([reserve(a, id, attempt), reserve(kitchen, id)]);
  assert.equal(results.filter(r => r.autorizado).length, 1);
  const winner = results.find(r => r.autorizado);
  assert.equal(winner.pedido.itens[0].observacao, 'Sem cebola'); assert.equal(winner.pedido.itens[0].opcoes[0].nome, 'Bacon');
  assert.equal(winner.pedido.totalCentavos, undefined);
  assert.equal((await reserve(a, id, attempt)).autorizado, false);
});
test('resultado só é confirmado pelo terminal da tentativa e replay não imprime novamente', async () => {
  await setup(); const id = await order(); await a.receive(id); const tentativa = randomUUID(); await reserve(a, id, tentativa);
  const data = { jobId: id, tentativa, resultado: 'simulado' };
  await assert.rejects(kitchen.call('concluirImpressaoCozinhaV2', data), { code: 'functions/permission-denied' });
  assert.equal((await a.call('concluirImpressaoCozinhaV2', data)).status, 'simulado');
  assert.equal((await a.call('concluirImpressaoCozinhaV2', data)).reutilizado, true);
  assert.equal((await reserve(a, id)).autorizado, false);
});
test('tentativa expirada não reimprime sozinha; nova via exige motivo e é idempotente', async () => {
  await setup(); const id = await order(); await a.receive(id); await reserve(a, id);
  await assert.rejects(a.call('reimprimirCozinhaV2', { jobId: id, requestId: randomUUID(), motivo: 'Conferido sem papel' }), { code: 'functions/failed-precondition' });
  await jobRef(id).update({ expiraEm: admin.firestore.Timestamp.fromMillis(1) });
  assert.deepEqual(await reserve(a, id), { autorizado: false, status: 'incerto' });
  const request = { jobId: id, requestId: randomUUID(), motivo: 'Conferido sem papel' };
  await assert.rejects(a.call('reimprimirCozinhaV2', { ...request, motivo: '' }), { code: 'functions/invalid-argument' });
  const copy = await a.call('reimprimirCozinhaV2', request);
  assert.equal((await a.call('reimprimirCozinhaV2', request)).jobId, copy.jobId);
  await assert.rejects(b.call('reimprimirCozinhaV2', { ...request, requestId: randomUUID() }), { code: 'functions/failed-precondition' });
  const saved = (await jobRef(copy.jobId).get()).data(); assert.equal(saved.via, 2); assert.equal(saved.motivo, request.motivo);
  const print = await reserve(kitchen, copy.jobId); assert.equal(print.autorizado, true); assert.equal(print.via, 2);
});
test('KDS avança em ordem, permite reenvio da mesma transição e não retrocede', async () => {
  await setup(); const id = await order();
  await assert.rejects(advance(kitchen, id, 'novo', 'em_preparo'), { code: 'functions/failed-precondition' });
  await a.receive(id);
  await assert.rejects(advance(kitchen, id, 'novo', 'entregue'), { code: 'functions/invalid-argument' });
  for (const [de, para] of [['novo', 'em_preparo'], ['em_preparo', 'pronto'], ['pronto', 'entregue']]) {
    assert.equal((await advance(kitchen, id, de, para)).status, para);
    assert.equal((await advance(kitchen, id, de, para)).reutilizado, true);
  }
  await assert.rejects(advance(kitchen, id, 'novo', 'em_preparo'), { code: 'functions/failed-precondition' });
});
test('impressora sem KDS e KDS sem impressora funcionam independentemente', async () => {
  await setup(true, false); const printed = await order(); await a.receive(printed);
  assert.equal((await reserve(a, printed)).autorizado, true);
  await assert.rejects(advance(kitchen, printed, 'novo', 'em_preparo'), { code: 'functions/failed-precondition' });
  await setup(false, true); const screen = await order(); await a.receive(screen);
  assert.equal((await jobRef(screen).get()).exists, false);
  assert.equal((await advance(kitchen, screen, 'novo', 'em_preparo')).status, 'em_preparo');
  await assert.rejects(reserve(a, printed), { code: 'functions/failed-precondition' });
  await setup(false, false); const disabled = await order(); await a.receive(disabled);
  assert.equal((await jobRef(disabled).get()).exists, false);
  await assert.rejects(advance(kitchen, disabled, 'novo', 'em_preparo'), { code: 'functions/failed-precondition' });
});
test('cancelamento antes do despacho impede a impressão e o preparo', async () => {
  await setup(); const id = await order(); await a.receive(id);
  await db.doc(`${base}/pedidos/${id}`).update({ status: 'cancelado' });
  assert.deepEqual(await reserve(a, id), { autorizado: false, status: 'cancelado' });
  await assert.rejects(advance(kitchen, id, 'novo', 'em_preparo'), { code: 'functions/failed-precondition' });
});
test('sem KDS o caixa confirma preparo de mesa e retirada, sem depender de impressão',async()=>{
  for(const impressao of [true,false]){
    await setup(impressao,false);
    for(const tipo of ['mesa','retirada']){
      const pedidoId=await order({tipo});await a.receive(pedidoId);
      const call=(c,de,para)=>c.call('avancarPreparoV2',{pedidoId,de,para,origem:'caixa'});
      await assert.rejects(call(kitchen,'novo','em_preparo'),{code:'functions/permission-denied'});
      for(const [de,para] of [['novo','em_preparo'],['em_preparo','pronto'],['pronto','entregue']]){
        assert.equal((await call(a,de,para)).status,para);assert.equal((await call(a,de,para)).reutilizado,true);
      }
      const record=(await db.doc(`${base}/pedidos/${pedidoId}`).get()).data();assert.equal(record.preparoOrigem,'caixa');assert.equal(record.preparoTerminalUid,a.uid);
      assert.equal((await jobRef(pedidoId).get()).exists,impressao);
    }
  }
});
test('controle sem KDS recusa configuração alterada, salto, pedido não recebido e cancelado',async()=>{
  await setup(false,false);const pedidoId=await order(),data={pedidoId,de:'novo',para:'em_preparo',origem:'caixa'};
  await assert.rejects(a.call('avancarPreparoV2',data),{code:'functions/failed-precondition'});await a.receive(pedidoId);
  await assert.rejects(a.call('avancarPreparoV2',{...data,para:'entregue'}),{code:'functions/invalid-argument'});
  await setup(false,true);await assert.rejects(a.call('avancarPreparoV2',data),{code:'functions/failed-precondition'});
  await setup(false,false);await db.doc(`${base}/pedidos/${pedidoId}`).update({status:'cancelado'});
  await assert.rejects(a.call('avancarPreparoV2',data),{code:'functions/failed-precondition'});
});
test('isolamento, revogação e bloqueio de adulteração da fila no Firestore', async () => {
  await setup(); const id = await order(); await a.receive(id); const other = await client('caixa', 'cozinha-b');
  await db.doc('lojas_v2/cozinha-b').update({ cozinha: { impressao: true, kds: true } });
  await assert.rejects(reserve(other, id), { code: 'functions/not-found' });
  await assert.rejects(reserve(stranger, id), { code: 'functions/permission-denied' });
  const p = `${base}/impressoes_cozinha/${id}`;
  assert.ok((await getDocFromServer(doc(kitchen.store, p))).exists());
  await assert.rejects(getDocFromServer(doc(other.store, p)), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(a.store, p), { status: 'simulado' }, { merge: true }), { code: 'permission-denied' });
  const revoked = await client('cozinha'); await db.doc(`terminais_v2/${revoked.uid}`).update({ ativo: false });
  await assert.rejects(reserve(revoked, id), { code: 'functions/permission-denied' });
});
