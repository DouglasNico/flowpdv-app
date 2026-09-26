const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict'), path = require('node:path'), { randomUUID } = require('node:crypto');
const local = require('node:module').createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const apps = []; let db, lojaId, caixa, cozinha, outra;
const isolated = process.env.FLOWPDV_COMBOS_ISOLADO === '1';
const ports = isolated ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
async function client(role, shop) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true }); await signInAnonymously(auth);
  const uid = auth.currentUser.uid, fn = getFunctions(app); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
  await db.doc(`terminais_v2/${uid}`).set({ ativo: true, papel: role, lojaId: shop });
  await db.doc(`lojas_v2/${shop}/membros/${uid}`).set({ ativo: true, papel: role, tipo: 'terminal' });
  return { uid, call: async data => (await httpsCallable(fn, 'listarEntregasCaixaV2')(data)).data };
}
before(() => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore();
});
beforeEach(async () => {
  lojaId = randomUUID(); const outroId = randomUUID();
  await db.doc(`lojas_v2/${lojaId}`).set({ ativo: true }); await db.doc(`lojas_v2/${outroId}`).set({ ativo: true });
  caixa = await client('caixa', lojaId); cozinha = await client('cozinha', lojaId); outra = await client('caixa', outroId);
  const batch = db.batch();
  for (let i = 0; i < 55; i++) batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/p-${String(i).padStart(3,'0')}`), { tipo: 'delivery', status: 'novo', totalCentavos: 1500, telefone: 'não retornar' });
  for (const status of ['entregue', 'cancelado']) batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/${status}`), { tipo: 'delivery', status, totalCentavos: 1500 });
  batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/mesa`), { tipo: 'mesa', status: 'novo', totalCentavos: 500 });
  await batch.commit();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });

test('consulta percorre mais de 50 entregas sem duplicar nem expor contatos', async () => {
  const ids = []; let cursor = null;
  do {
    const result = await caixa.call({ filtro: 'andamento', cursor });
    assert.ok(result.pedidos.length <= 25);
    for (const p of result.pedidos) { ids.push(p.id); assert.equal(p.telefone, undefined); }
    cursor = result.proximo;
  } while (cursor);
  assert.equal(ids.length, 55); assert.equal(new Set(ids).size, 55);
  assert.equal((await caixa.call({ filtro: 'finalizadas' })).pedidos[0].id, 'entregue');
  assert.equal((await caixa.call({ filtro: 'canceladas' })).pedidos[0].id, 'cancelado');
});

test('cursor não atravessa loja ou filtro e cozinha não acessa o histórico do caixa', async () => {
  const page = await caixa.call({});
  await assert.rejects(outra.call({ cursor: page.proximo }), { code: 'functions/invalid-argument' });
  await assert.rejects(caixa.call({ filtro: 'finalizadas', cursor: page.proximo }), { code: 'functions/invalid-argument' });
  await assert.rejects(caixa.call({ cursor: { ...page.proximo, apos: '../segredo' } }), { code: 'functions/invalid-argument' });
  await assert.rejects(cozinha.call({}), { code: 'functions/permission-denied' });
  assert.equal((await outra.call({ lojaId })).pedidos.length, 0);
});

test('revogação entre páginas bloqueia a continuação', async () => {
  const page = await caixa.call({});
  await db.doc(`terminais_v2/${caixa.uid}`).update({ ativo: false });
  await assert.rejects(caixa.call({ cursor: page.proximo }), { code: 'functions/permission-denied' });
});

test('mudança de status do último item não invalida o cursor nem repete itens anteriores', async () => {
  const page = await caixa.call({});
  await db.doc(`lojas_v2/${lojaId}/pedidos/${page.proximo.apos}`).update({ status: 'entregue' });
  const next = await caixa.call({ cursor: page.proximo });
  assert.equal(next.pedidos[0].id, 'p-025'); assert.equal(next.pedidos.length, 25);
});
