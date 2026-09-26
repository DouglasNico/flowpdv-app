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
  return { uid, call: async data => (await httpsCallable(fn, 'listarPendenciasAtendimentoV2')(data)).data };
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
  for (let i = 0; i < 55; i++) batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/p-${String(i).padStart(3,'0')}`), { tipo: 'delivery', status: 'novo', recebidoPdv: false, totalCentavos: 1500, telefone: 'não retornar' });
  for (const status of ['entregue', 'cancelado']) batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/${status}`), { tipo: 'delivery', status, totalCentavos: 1500 });
  batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/mesa`), { tipo: 'mesa', status: 'novo', totalCentavos: 500 });
  for(let i=0;i<55;i++) batch.set(db.doc(`lojas_v2/${lojaId}/atendimentos/a-${String(i).padStart(3,'0')}`),{tipo:'mesa',status:'aberto',totalCentavos:1000,versao:1,telefone:'privado'});
  batch.set(db.doc(`lojas_v2/${lojaId}/atendimentos/fechado`),{tipo:'mesa',status:'fechado',totalCentavos:1000});
  batch.set(db.doc(`lojas_v2/${lojaId}/pedidos/cancelado-pendente`),{tipo:'retirada',status:'cancelado',recebidoPdv:false,totalCentavos:500});
  await batch.commit();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });


test('percorre contas e pedidos sem duplicar ou retornar dados de contato', async()=>{
 for(const [tipo,quantidade] of [['contas',55],['pedidos',56]]){
  const ids=[];let cursor=null;
  do{const r=await caixa.call({tipo,cursor}); assert.equal(r.somenteConferencia,true);assert.equal(r.tipo,tipo);assert.ok(r.registros.length<=50);
   for(const p of r.registros){ids.push(p.id);assert.equal(p.telefone,undefined);assert.equal(p.itens,undefined);}cursor=r.proximo;
  }while(cursor);
  assert.equal(ids.length,quantidade);assert.equal(new Set(ids).size,quantidade);
 }
 assert.equal((await db.doc(`lojas_v2/${lojaId}/pedidos/cancelado-pendente`).get()).data().recebidoPdv,false);
});
test('impede troca de loja, identidade, filtro, caminho e acesso de cozinha',async()=>{
 const r=await caixa.call({tipo:'contas'});
 for(const data of [{tipo:'pedidos',cursor:r.proximo},{tipo:'contas',cursor:{...r.proximo,apos:'../privado'}},{tipo:'contas',cursor:{...r.proximo,terminalUid:'outro'}},{tipo:'invalido'}])await assert.rejects(caixa.call(data),{code:'functions/failed-precondition'});
 await assert.rejects(outra.call({cursor:r.proximo}),{code:'functions/failed-precondition'});
 await assert.rejects(cozinha.call({}),{code:'functions/permission-denied'});
 assert.equal((await outra.call({lojaId})).registros.length,0);
});
test('revogação impede continuar; fechamento concorrente não repete contas',async()=>{
 const r=await caixa.call({});await db.doc(`lojas_v2/${lojaId}/atendimentos/a-049`).update({status:'fechado'});
 assert.equal((await caixa.call({cursor:r.proximo})).registros.length,5);
 await db.doc(`terminais_v2/${caixa.uid}`).update({ativo:false});await assert.rejects(caixa.call({cursor:r.proximo}),{code:'functions/permission-denied'});
});
test('não mascara valores corrompidos como ausência de pendências',async()=>{
 await db.doc(`lojas_v2/${lojaId}/atendimentos/a-000`).update({totalCentavos:-1});await assert.rejects(caixa.call({}),{code:'functions/failed-precondition'});
});
