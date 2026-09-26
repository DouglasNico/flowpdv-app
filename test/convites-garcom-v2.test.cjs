const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict'), path = require('node:path'), { randomUUID } = require('node:crypto');
const local = require('node:module').createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const apps=[];let db,lojaId,slug,base,gerente,garcom,outro;
const isolated=process.env.FLOWPDV_COMBOS_ISOLADO==='1';
const ports=isolated?{auth:9199,firestore:8180,functions:5101}:{auth:9099,firestore:8080,functions:5001};
async function client() {
  const app=initializeApp({apiKey:'demo-key',projectId:'demo-flowpdv'},randomUUID());apps.push(app);
  const auth=getAuth(app);connectAuthEmulator(auth,`http://127.0.0.1:${ports.auth}`,{disableWarnings:true});await signInAnonymously(auth);
  const uid=auth.currentUser.uid,email=`${randomUUID()}@example.test`;
  await admin.auth().updateUser(uid,{email,emailVerified:true});
  const fn=getFunctions(app);connectFunctionsEmulator(fn,'127.0.0.1',ports.functions);
  return {uid,email,call:async(name,data)=>(await httpsCallable(fn,name)(data)).data};
}
before(()=>{
  assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,`127.0.0.1:${ports.auth}`);assert.equal(process.env.FIRESTORE_EMULATOR_HOST,`127.0.0.1:${ports.firestore}`);
  admin.initializeApp({projectId:'demo-flowpdv'});db=admin.firestore();
});
beforeEach(async()=>{
  lojaId=randomUUID();slug=randomUUID();base=`lojas_v2/${lojaId}`;
  await db.doc(base).set({ativo:true,modulos:{garcom:true}});await db.doc(`rotas_publicas_v2/${slug}`).set({lojaId});
  await db.doc(`catalogos_publicos_v2/${slug}`).set({versao:1,produtos:[]});
  gerente=await client();garcom=await client();outro=await client();
  await db.doc(`${base}/membros/${gerente.uid}`).set({ativo:true,tipo:'usuario',papel:'gerente'});
});
after(async()=>{await Promise.all(apps.map(deleteApp));await admin.app().delete();});
const emitir=()=>gerente.call('emitirConviteGarcomV2',{lojaId,slug,email:garcom.email});
const aceitar=token=>garcom.call('aceitarConviteGarcomV2',{slug,token});

test('convite é ligado ao e-mail, aceita uma vez e replay não reativa funcionário revogado',async()=>{
  const convite=await emitir();
  await assert.rejects(outro.call('aceitarConviteGarcomV2',{slug,token:convite.token}),{code:'functions/permission-denied'});
  assert.equal((await aceitar(convite.token)).reutilizado,false);
  assert.equal((await aceitar(convite.token)).reutilizado,true);
  assert.equal((await db.doc(`${base}/membros/${garcom.uid}`).get()).data().papel,'garcom');
  const saved=(await db.collection(`${base}/convites_garcom`).get()).docs[0].data();
  assert.equal(JSON.stringify(saved).includes(convite.token.split('.')[1]),false);
  await db.doc(`${base}/membros/${garcom.uid}`).update({ativo:false});
  await assert.rejects(aceitar(convite.token),{code:'functions/permission-denied'});
});

test('gerência de outra loja, e-mail sem verificação, expiração e revogação são recusados',async()=>{
  await assert.rejects(outro.call('emitirConviteGarcomV2',{lojaId,slug,email:garcom.email}),{code:'functions/permission-denied'});
  const convite=await emitir();await admin.auth().updateUser(garcom.uid,{emailVerified:false});
  await assert.rejects(aceitar(convite.token),{code:'functions/permission-denied'});
  await admin.auth().updateUser(garcom.uid,{emailVerified:true});
  await db.doc(`${base}/convites_garcom/${convite.token.split('.')[0]}`).update({expiraEmMs:0});
  await assert.rejects(aceitar(convite.token),{code:'functions/failed-precondition'});
  const novo=await emitir();await gerente.call('revogarConviteGarcomV2',{lojaId,slug,email:garcom.email});
  await assert.rejects(aceitar(novo.token),{code:'functions/permission-denied'});
});

test('regenerar invalida convite anterior e não substitui papel administrativo',async()=>{
  const anterior=await emitir(),novo=await emitir();
  await assert.rejects(aceitar(anterior.token),{code:'functions/permission-denied'});
  await db.doc(`${base}/membros/${garcom.uid}`).set({ativo:true,tipo:'usuario',papel:'gerente'});
  await assert.rejects(aceitar(novo.token),{code:'functions/failed-precondition'});
  assert.equal((await db.doc(`${base}/membros/${garcom.uid}`).get()).data().papel,'gerente');
});

test('garçom percorre mais de 200 mesas e revogação bloqueia próxima página',async()=>{
  await aceitar((await emitir()).token);
  const batch=db.batch();for(let i=0;i<205;i++)batch.set(db.doc(`${base}/mesas/m-${String(i).padStart(3,'0')}`),{ativo:true,nome:`Mesa ${i}`});await batch.commit();
  const first=await garcom.call('consultarAtendimentoGarcomV2',{slug});assert.equal(first.mesas.length,200);assert.ok(first.proximaMesa);
  const second=await garcom.call('consultarAtendimentoGarcomV2',{slug,apos:first.proximaMesa});assert.equal(second.mesas.length,5);assert.equal(second.proximaMesa,null);
  assert.equal(new Set([...first.mesas,...second.mesas].map(m=>m.id)).size,205);
  await db.doc(`${base}/membros/${garcom.uid}`).update({ativo:false});
  await assert.rejects(garcom.call('consultarAtendimentoGarcomV2',{slug,apos:first.proximaMesa}),{code:'functions/permission-denied'});
});
