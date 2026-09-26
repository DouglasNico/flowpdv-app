const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, setLogLevel } = local('firebase/firestore');
const apps = []; let db, rootAdmin, managerA, managerB, caixa, anonymous, a, b;
const isolated = process.env.FLOWPDV_COMBOS_ISOLADO === '1';
const ports = isolated ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
const hash = token => createHash('sha256').update(token).digest('hex');
async function client(name, email) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, name); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
  const functions = getFunctions(app, 'us-central1'); connectFunctionsEmulator(functions, '127.0.0.1', ports.functions);
  const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', ports.firestore);
  if (email) await signInWithEmailAndPassword(auth, email, 'SenhaFicticia-123!');
  else await signInAnonymously(auth);
  return { auth, store, call: async (name, data) => (await httpsCallable(functions, name)(data)).data };
}
const denied = promise => assert.rejects(promise, error => ['functions/permission-denied', 'functions/unauthenticated', 'functions/failed-precondition', 'functions/already-exists', 'functions/invalid-argument', 'permission-denied'].includes(error.code));
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore(); setLogLevel('silent');
  for (const uid of ['admin-pairing', 'gerente-a', 'gerente-b', 'caixa-a', 'nao-verificado']) {
    await admin.auth().createUser({ uid, email: `${uid}@example.test`, emailVerified: uid !== 'nao-verificado', password: 'SenhaFicticia-123!' });
  }
  await admin.auth().setCustomUserClaims('admin-pairing', { admin: true });
  rootAdmin = await client('admin', 'admin-pairing@example.test');
  managerA = await client('a', 'gerente-a@example.test'); managerB = await client('b', 'gerente-b@example.test');
  caixa = await client('caixa', 'caixa-a@example.test'); anonymous = await client('anonymous');
  a = await rootAdmin.call('adminCriarLojaV2', { nome: 'Loja fictícia A', slug: 'teste-a', gerenteUid: 'gerente-a' });
  b = await rootAdmin.call('adminCriarLojaV2', { nome: 'Loja fictícia B', slug: 'teste-b', gerenteUid: 'gerente-b' });
  await rootAdmin.call('adminCadastrarMembroV2', { lojaId: a.lojaId, uid: 'caixa-a', papel: 'caixa' });
});
after(async () => { await Promise.all(apps.map(deleteApp)); if (admin.apps.length) await admin.app().delete(); });

test('somente admin provisiona loja/usuário; slug único e usuário verificado', async () => {
  assert.deepEqual((await db.doc(`lojas_v2/${a.lojaId}`).get()).data().ativacaoOperacionalV2, { schema: 1, estado: 'suspensa', ambiente: 'homologacao', revisao: 1 });
  await denied(managerA.call('adminCriarLojaV2', { nome: 'Invasão', slug: 'invasao', gerenteUid: 'gerente-a' }));
  await denied(anonymous.call('adminCadastrarMembroV2', { lojaId: a.lojaId, uid: anonymous.auth.currentUser.uid, papel: 'gerente' }));
  await denied(rootAdmin.call('adminCriarLojaV2', { nome: 'Duplicada', slug: 'teste-a', gerenteUid: 'gerente-b' }));
  await denied(rootAdmin.call('adminCadastrarMembroV2', { lojaId: a.lojaId, uid: 'nao-verificado', papel: 'caixa' }));
  const route = (await db.doc('rotas_publicas_v2/teste-a').get()).data(); assert.equal(route.lojaId, a.lojaId);
});
test('gerente só emite para sua loja; caixa não emite e terminal não vira gerente', async () => {
  const data = { lojaId: a.lojaId, terminalUid: anonymous.auth.currentUser.uid, papel: 'caixa', nome: 'Caixa teste' };
  await denied(managerB.call('emitirPareamentoV2', data));
  await denied(caixa.call('emitirPareamentoV2', data));
  await denied(managerA.call('emitirPareamentoV2', { ...data, papel: 'gerente' }));
  await denied(managerA.call('emitirPareamentoV2', { ...data, terminalUid: 'caixa-a' }));
});
test('token fica como hash e só o terminal destinado pode usá-lo; uso único', async () => {
  const terminal = await client('terminal-one');
  assert.equal((await terminal.call('consultarMeuTerminalV2', {})).vinculado, false);
  const invitation = await managerA.call('emitirPareamentoV2', { lojaId: a.lojaId, terminalUid: terminal.auth.currentUser.uid, papel: 'caixa', nome: 'Caixa um' });
  const saved = (await db.doc(`pareamentos_v2/${hash(invitation.token)}`).get()).data();
  assert.equal(saved.token, undefined); assert.equal(saved.usado, false);
  await denied(anonymous.call('concluirPareamentoV2', { token: invitation.token }));
  const result = await terminal.call('concluirPareamentoV2', { token: invitation.token });
  assert.equal(result.lojaId, a.lojaId); assert.equal(result.papel, 'caixa');
  const recovered = await terminal.call('consultarMeuTerminalV2', { uid: 'gerente-b' });
  assert.equal(recovered.lojaId, a.lojaId); assert.equal(recovered.papel, 'caixa');
  assert.equal((await getDocFromServer(doc(terminal.store, 'lojas_v2', a.lojaId))).exists(), true);
  await denied(getDocFromServer(doc(terminal.store, 'lojas_v2', b.lojaId)));
  await denied(terminal.call('concluirPareamentoV2', { token: invitation.token }));
  await denied(managerB.call('revogarTerminalV2', { lojaId: b.lojaId, terminalUid: terminal.auth.currentUser.uid }));
  await managerA.call('revogarTerminalV2', { lojaId: a.lojaId, terminalUid: terminal.auth.currentUser.uid });
  await denied(getDocFromServer(doc(terminal.store, 'lojas_v2', a.lojaId)));
  await denied(terminal.call('consultarMeuTerminalV2', {}));
});
test('token expirado não cria vínculo', async () => {
  const terminal = await client('expired'); const uid = terminal.auth.currentUser.uid;
  const invitation = await managerA.call('emitirPareamentoV2', { lojaId: a.lojaId, terminalUid: uid, papel: 'cozinha', nome: 'Cozinha' });
  await db.doc(`pareamentos_v2/${hash(invitation.token)}`).update({ expiraEm: admin.firestore.Timestamp.fromMillis(Date.now() - 1000) });
  await denied(terminal.call('concluirPareamentoV2', { token: invitation.token }));
  assert.equal((await db.doc(`terminais_v2/${uid}`).get()).exists, false);
});
test('duas tentativas simultâneas consomem token uma única vez', async () => {
  const terminal = await client('concurrent');
  const invitation = await managerA.call('emitirPareamentoV2', { lojaId: a.lojaId, terminalUid: terminal.auth.currentUser.uid, papel: 'cozinha', nome: 'Cozinha' });
  const results = await Promise.allSettled([terminal.call('concluirPareamentoV2', { token: invitation.token }), terminal.call('concluirPareamentoV2', { token: invitation.token })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});
test('perda de gerência invalida convite pendente', async () => {
  const terminal = await client('issuer-revoked');
  const invitation = await managerB.call('emitirPareamentoV2', { lojaId: b.lojaId, terminalUid: terminal.auth.currentUser.uid, papel: 'caixa', nome: 'Caixa' });
  await db.doc(`lojas_v2/${b.lojaId}/membros/gerente-b`).update({ ativo: false });
  await denied(terminal.call('concluirPareamentoV2', { token: invitation.token }));
  assert.equal((await db.doc(`terminais_v2/${terminal.auth.currentUser.uid}`).get()).exists, false);
});
test('retirada da claim administrativa bloqueia até token de login antigo', async () => {
  await admin.auth().setCustomUserClaims('admin-pairing', {});
  await denied(rootAdmin.call('adminCriarLojaV2', { nome: 'Não permitida', slug: 'nao-permitida', gerenteUid: 'gerente-a' }));
});

test('recuperação recusa papel divergente ou tipo humano no vínculo do terminal', async () => {
  const terminal = await client('inconsistent-terminal'), uid = terminal.auth.currentUser.uid;
  const invitation = await managerA.call('emitirPareamentoV2', { lojaId: a.lojaId, terminalUid: uid, papel: 'caixa', nome: 'Consistencia' });
  await terminal.call('concluirPareamentoV2', { token: invitation.token });
  const member = db.doc(`lojas_v2/${a.lojaId}/membros/${uid}`);
  await member.update({ papel: 'cozinha' });
  await denied(terminal.call('consultarMeuTerminalV2', {}));
  await denied(getDocFromServer(doc(terminal.store, 'lojas_v2', a.lojaId)));
  await member.update({ papel: 'caixa', tipo: 'usuario' });
  await denied(terminal.call('consultarMeuTerminalV2', {}));
  await member.update({ tipo: 'terminal' });
  assert.equal((await terminal.call('consultarMeuTerminalV2', {})).papel, 'caixa');
});

test('e-mail não verificado bloqueia emissão e invalida convite ainda não usado', async () => {
  const terminal = await client('manager-email-unverified');
  const data = { lojaId: a.lojaId, terminalUid: terminal.auth.currentUser.uid, papel: 'caixa', nome: 'Caixa' };
  const invitation = await managerA.call('emitirPareamentoV2', data);
  await admin.auth().updateUser('gerente-a', { emailVerified: false });
  try {
    await denied(managerA.call('emitirPareamentoV2', data));
    await denied(terminal.call('concluirPareamentoV2', { token: invitation.token }));
    assert.equal((await db.doc(`terminais_v2/${terminal.auth.currentUser.uid}`).get()).exists, false);
  } finally { await admin.auth().updateUser('gerente-a', { emailVerified: true }); }
});

test('conexão pela licença deriva loja e função, é idempotente e mantém operação suspensa', async () => {
 const chave='LIC-CONEXAO',deviceId='TERM-LICENCIADO',base=`lojas_v2/${a.lojaId}`;
 await db.doc(base).update({chaveLicencaLegada:chave,'migracao.acessoAdministrativo':true});
 await db.doc(`migracoes_v2/${chave}`).set({lojaId:a.lojaId});
 const lic=db.doc(`licencas/${chave}`);
 await lic.set({status:'ativa',vencimento:'2099-12-31',terminaisAtivos:[{id:deviceId,tipoTerminal:'atendimento'}]});
 const t=await client('licenciado'),uid=t.auth.currentUser.uid;
 const data={chaveLicenca:chave,deviceId,terminalUid:uid,tipoTerminal:'atendimento'};
 for (const bad of [anonymous,managerB,caixa]) await denied(bad.call('vincularTerminalLicenciadoV2',data));
 await denied(managerA.call('vincularTerminalLicenciadoV2',{...data,terminalUid:'gerente-a'}));
 await denied(managerA.call('vincularTerminalLicenciadoV2',{...data,deviceId:'outro'}));
 await denied(managerA.call('vincularTerminalLicenciadoV2',{...data,tipoTerminal:'caixa'}));
 await lic.update({status:'bloqueada'});await denied(managerA.call('vincularTerminalLicenciadoV2',data));
 await lic.update({status:'ativa',vencimento:'2000-01-01'});await denied(managerA.call('vincularTerminalLicenciadoV2',data));
 await lic.update({vencimento:'2099-12-31'});
 const results=await Promise.all([managerA.call('vincularTerminalLicenciadoV2',data),managerA.call('vincularTerminalLicenciadoV2',data)]);
 assert.ok(results.every(r=>r.papel==='atendimento'));assert.equal(results.filter(r=>r.reutilizado).length,1);
 const status=await t.call('consultarMeuTerminalV2',{});assert.equal(status.deviceId,deviceId);assert.equal(status.chaveLicenca,chave);assert.equal(status.papel,'atendimento');
 assert.equal((await db.doc(base).get()).data().ativacaoOperacionalV2.estado,'suspensa');
 await denied(t.call('emitirPareamentoV2',{lojaId:a.lojaId,terminalUid:uid,papel:'caixa'}));
 const duplicate=await client('duplicado-licenciado');await denied(managerA.call('vincularTerminalLicenciadoV2',{...data,terminalUid:duplicate.auth.currentUser.uid}));
 await lic.update({terminaisAtivos:[{id:deviceId,tipoTerminal:'caixa'}]});
 await denied(t.call('vincularTerminalLicenciadoV2',{...data,tipoTerminal:'caixa'}));
 await denied(managerB.call('vincularTerminalLicenciadoV2',{...data,tipoTerminal:'caixa'}));
 const changed=await managerA.call('vincularTerminalLicenciadoV2',{...data,tipoTerminal:'caixa'});assert.equal(changed.funcaoAtualizada,true);
 for(const ref of [`terminais_v2/${uid}`,`${base}/membros/${uid}`,`${base}/terminais_pdv/${deviceId}`]) assert.equal((await db.doc(ref).get()).data().papel,'caixa');
 assert.equal((await t.call('consultarMeuTerminalV2',{})).papel,'caixa');
 await lic.update({terminaisAtivos:[{id:deviceId,tipoTerminal:'atendimento'}]});
 await managerA.call('vincularTerminalLicenciadoV2',data);assert.equal((await t.call('consultarMeuTerminalV2',{})).papel,'atendimento');
 const c=await client('caixa-licenciado');
 await lic.update({terminaisAtivos:[{id:'TERM-CAIXA',tipoTerminal:'caixa'}]});
 assert.equal((await managerA.call('vincularTerminalLicenciadoV2',{...data,deviceId:'TERM-CAIXA',tipoTerminal:'caixa',terminalUid:c.auth.currentUser.uid})).papel,'caixa');
});
