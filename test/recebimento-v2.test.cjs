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
async function client(role, lojaId = 'recepcao-a') {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true }); await signInAnonymously(auth);
  const uid = auth.currentUser.uid;
  const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
  const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', ports.firestore);
  if (role) {
    await db.doc(`terminais_v2/${uid}`).set({ ativo: true, papel: role, lojaId });
    await db.doc(`lojas_v2/${lojaId}/membros/${uid}`).set({ ativo: true, papel: role, tipo: 'terminal' });
  }
  return { uid, store, receive: async pedidoId => (await httpsCallable(fn, 'receberPedidoPdvV2')({ pedidoId, lojaId: 'ignored' })).data };
}
const base = 'lojas_v2/recepcao-a';
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
  await db.doc(base).set({ ativo: true }); await db.doc('lojas_v2/recepcao-b').set({ ativo: true });
  a = await client('caixa'); b = await client('caixa'); kitchen = await client('cozinha'); stranger = await client();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });
test('dois caixas recebem o mesmo pedido uma única vez, mantendo opções e observações', async () => {
  const id = await order(); const results = await Promise.all([a.receive(id), b.receive(id)]);
  assert.equal(results[0].atendimentoId, results[1].atendimentoId);
  assert.equal(results.filter(r => !r.reutilizado).length, 1);
  const record = await attendance(results[0].atendimentoId);
  assert.equal(record.itens.length, 1); assert.equal(record.totalCentavos, 2500); assert.equal(record.comandaPdvId, 'MESA-7');
  assert.equal(record.itens[0].observacao, 'Sem cebola'); assert.equal(record.itens[0].opcoes[0].nome, 'Bacon');
  assert.equal((await a.receive(id)).reutilizado, true); // resposta perdida / reinício não duplica
});
test('pedidos simultâneos da mesma mesa são acumulados sem sobrescrever linhas', async () => {
  const mesaId = randomUUID(), one = await order({ mesaId }), two = await order({ mesaId });
  const [r1, r2] = await Promise.all([a.receive(one), b.receive(two)]);
  assert.equal(r1.atendimentoId, r2.atendimentoId);
  const record = await attendance(r1.atendimentoId);
  assert.equal(record.itens.length, 2); assert.equal(record.totalCentavos, 5000); assert.equal(record.versao, 2);
  assert.equal(new Set(record.itens.map(i => i.origemPedidoId)).size, 2);
});
test('mesa sem vínculo não é confirmada; corrigir configuração permite recuperar', async () => {
  const mesaId = randomUUID(), id = await order({ mesaId, mapped: false });
  await assert.rejects(a.receive(id), { code: 'functions/failed-precondition' });
  assert.equal((await db.doc(`${base}/pedidos/${id}`).get()).data().recebidoPdv, false);
  await db.doc(`${base}/mesas/${mesaId}`).update({ comandaPdvId: 'MESA-7' });
  assert.ok((await a.receive(id)).atendimentoId);
});
test('retirada tem conta própria; cancelado antes da recepção não entra na conta', async () => {
  const id = await order({ tipo: 'retirada' }), result = await a.receive(id);
  assert.equal(result.atendimentoId, `retirada-${id}`);
  const cancelled = await order({ status: 'cancelado' }); assert.equal((await a.receive(cancelled)).ignorado, true);
  assert.equal((await a.receive(cancelled)).reutilizado, true);
});
test('cozinha, consumidor e terminal de outra loja não conseguem receber', async () => {
  const id = await order();
  for (const c of [kitchen, stranger]) await assert.rejects(c.receive(id), { code: 'functions/permission-denied' });
  const other = await client('caixa', 'recepcao-b'); await assert.rejects(other.receive(id), { code: 'functions/not-found' });
});
test('atendimento é legível só na própria loja e não pode ser adulterado pelo cliente', async () => {
  const id = await order(), result = await a.receive(id), p = `${base}/atendimentos/${result.atendimentoId}`;
  assert.ok((await getDocFromServer(doc(a.store, p))).exists());
  await assert.rejects(setDoc(doc(a.store, p), { totalCentavos: 1 }, { merge: true }), { code: 'permission-denied' });
  await assert.rejects(getDocFromServer(doc(stranger.store, p)), { code: 'permission-denied' });
  const other = await client('caixa', 'recepcao-b');
  await assert.rejects(getDocFromServer(doc(other.store, p)), { code: 'permission-denied' });
});
test('mesa com atendimento encerrado não recebe em conta antiga', async () => {
  const mesaId = randomUUID(), id = await order({ mesaId }), r = await a.receive(id);
  await db.doc(`${base}/atendimentos/${r.atendimentoId}`).update({ status: 'fechado' });
  const next = await order({ mesaId }); await assert.rejects(a.receive(next), { code: 'functions/failed-precondition' });
  assert.equal((await attendance(r.atendimentoId)).itens.length, 1);
});
test('revogação de terminal é verificada mesmo em reenvio já recebido', async () => {
  const terminal = await client('caixa'), id = await order(); await terminal.receive(id);
  await db.doc(`terminais_v2/${terminal.uid}`).update({ ativo: false });
  await assert.rejects(terminal.receive(id), { code: 'functions/permission-denied' });
});
