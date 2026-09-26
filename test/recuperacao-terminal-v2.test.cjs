const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs'), vm = require('node:vm');
const local = require('node:module').createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously, signInWithEmailAndPassword } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const { getFirestore, connectFirestoreEmulator, setDoc, doc, setLogLevel } = local('firebase/firestore');
const apps = []; let db, gerente, estrangeiro, lojaId, base, origem, destino, terceiro, turno, payload, recibo;
const isolated = process.env.FLOWPDV_COMBOS_ISOLADO === '1';
const ports = isolated ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
async function client(email) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
  if (email) await signInWithEmailAndPassword(auth, email, 'TesteRecuperacao-123!'); else await signInAnonymously(auth);
  const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
  const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', ports.firestore);
  return { uid: auth.currentUser.uid, store, call: async (name, data) => (await httpsCallable(fn, name)(data)).data };
}
async function terminal() {
  const c = await client();
  await db.doc(`terminais_v2/${c.uid}`).set({ lojaId, papel: 'caixa', ativo: true });
  await db.doc(`${base}/membros/${c.uid}`).set({ papel: 'caixa', tipo: 'terminal', ativo: true });
  return c;
}
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore(); setLogLevel('silent');
  for (const uid of ['gerente-recuperacao', 'estrangeiro-recuperacao']) await admin.auth().createUser({ uid, email: `${uid}@example.test`, emailVerified: true, password: 'TesteRecuperacao-123!' });
  gerente = await client('gerente-recuperacao@example.test'); estrangeiro = await client('estrangeiro-recuperacao@example.test');
});
beforeEach(async () => {
  lojaId = randomUUID(); base = `lojas_v2/${lojaId}`;
  await db.doc(base).set({ ativo: true, caixaV2: { exigirTurno: true }, ativacaoOperacionalV2: { schema: 1, ambiente: 'homologacao', estado: 'habilitada', revisao: 1 } });
  await db.doc(`${base}/membros/${gerente.uid}`).set({ ativo: true, tipo: 'usuario', papel: 'gerente' });
  origem = await terminal(); destino = await terminal(); terceiro = await terminal();
  turno = { id: 'TRN-ORIGINAL', terminalId: 'TERM-ORIGINAL', dataAbertura: '2026-09-21T10:00:00.000Z' };
  await origem.call('abrirTurnoCaixaV2', { turno, trocoInicialCentavos: 0 });
  const hash = createHash('sha256').update('farinha').digest('hex');
  await db.doc(`${base}/migracoes_estoque/${hash}`).set({ estoqueId: 'farinha', plano: { legadoId: 'farinha', nome: 'Farinha', unidadeOrigem: 'g', unidade: 'kg', saldoMili: 2500 } });
  await db.doc(`${base}/estoque/farinha`).set({ saldoMili: 2500, unidade: 'kg' });
  payload = { vendaId: 'VL-PENDENTE', turno, confirmado: true, itens: [{ legadoId: 'farinha', quantidade: '250', precoUnitarioCentavos: 2 }], totalCentavos: 500, recebidoDinheiroCentavos: 500 };
  recibo = await origem.call('registrarBaixaVendaLocalV2', payload);
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });
const dados = () => ({ lojaId, origemUid: origem.uid, destinoUid: destino.uid, requestId: randomUUID(), revisaoEsperada: 0, motivo: 'Equipamento original indisponível', confirmado: true });
const saldo = async () => (await db.doc(`${base}/estoque/farinha`).get()).data().saldoMili;

test('gerente encerra turno recuperado uma vez, recusando pagamento pendente e outra loja',async()=>{
  await gerente.call('recuperarOperacaoTerminalV2',dados());
  let estado=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;
  const req={lojaId,destinoUid:destino.uid,identidadeUid:origem.uid,requestId:randomUUID(),digest:'b'.repeat(64),turno,revisao:estado.revisao,dinheiroContadoCentavos:0,confirmado:true};
  await assert.rejects(gerente.call('encerrarTurnoRecuperadoV2',req),{code:'functions/failed-precondition'});
  await destino.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:recibo.reciboId});
  estado=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;req.revisao=estado.revisao;
  await assert.rejects(estrangeiro.call('encerrarTurnoRecuperadoV2',req),{code:'functions/permission-denied'});
  const pendente=db.doc(`${base}/pedidos/aguardando`);await pendente.set({recebidoPdv:false});
  await assert.rejects(gerente.call('encerrarTurnoRecuperadoV2',req),{code:'functions/failed-precondition'});await pendente.delete();
  assert.equal((await gerente.call('encerrarTurnoRecuperadoV2',req)).turno.status,'fechado');
  assert.equal((await gerente.call('encerrarTurnoRecuperadoV2',req)).reutilizado,true);
  await assert.rejects(gerente.call('encerrarTurnoRecuperadoV2',{...req,dinheiroContadoCentavos:100}));
  assert.equal((await db.collection(`${base}/fechamentos_recuperados`).get()).size,1);assert.equal(await saldo(),2250);
});

test('liberação exige gerente, turno fechado, estoque atual e nenhuma pendência; repetição não duplica recibo',async()=>{
  await gerente.call('recuperarOperacaoTerminalV2',dados());
  let state=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;
  const req={lojaId,destinoUid:destino.uid,identidadeUid:origem.uid,requestId:randomUUID(),digest:'a'.repeat(64),confirmado:true,turnos:[{chave:state.chave,revisao:state.revisao}],estoque:[{estoqueId:'farinha',unidade:'kg',saldoMili:2250}]};
  await assert.rejects(gerente.call('autorizarLiberacaoPerfilV2',req),{code:'functions/failed-precondition'});
  await destino.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:recibo.reciboId});
  state=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;
  await destino.call('encerrarTurnoCaixaV2',{turno,revisao:state.revisao,dinheiroContadoCentavos:0,confirmado:true});
  state=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;req.turnos[0].revisao=state.revisao;
  await assert.rejects(estrangeiro.call('autorizarLiberacaoPerfilV2',req),{code:'functions/permission-denied'});
  await assert.rejects(gerente.call('autorizarLiberacaoPerfilV2',{...req,estoque:[{estoqueId:'farinha',unidade:'kg',saldoMili:2500}]}),{code:'functions/failed-precondition'});
  const pendente=db.doc(`${base}/pedidos/bloqueio-liberacao`);await pendente.set({recebidoPdv:false});
  await assert.rejects(gerente.call('autorizarLiberacaoPerfilV2',req),{code:'functions/failed-precondition'});await pendente.delete();
  assert.equal((await gerente.call('autorizarLiberacaoPerfilV2',req)).reutilizado,false);
  assert.equal((await gerente.call('autorizarLiberacaoPerfilV2',req)).reutilizado,true);
  assert.equal((await db.collection(`${base}/liberacoes_perfis`).get()).size,1);assert.equal(await saldo(),2250);
  await db.doc(`terminais_v2/${destino.uid}`).update({ativo:false});
  await assert.rejects(gerente.call('autorizarLiberacaoPerfilV2',req),{code:'functions/permission-denied'});
});

test('gerente transfere identidade financeira, revoga origem e recupera a baixa uma única vez', async () => {
  const d = dados(), plano = await gerente.call('consultarPlanoRecuperacaoTerminalV2', d);
  assert.equal(plano.revisao, 0); assert.equal(plano.copiaCredenciais, false); assert.equal(plano.restauraDadosLocais, false);
  await gerente.call('revogarTerminalV2', { lojaId, terminalUid: origem.uid });
  const result = await gerente.call('recuperarOperacaoTerminalV2', d);
  assert.equal(result.identidadeOperacionalUid, origem.uid);
  assert.equal((await destino.call('consultarMeuTerminalV2')).identidadeOperacionalUid, origem.uid);
  const recuperado = await destino.call('registrarBaixaVendaLocalV2', payload);
  assert.equal(recuperado.reutilizado, true); assert.equal(recuperado.reciboId, recibo.reciboId); assert.equal(await saldo(), 2250);
  await destino.call('confirmarGravacaoVendaLocalV2', { vendaId: payload.vendaId, reciboId: recibo.reciboId });
  assert.equal((await destino.call('consultarTurnoCaixaV2', { turno })).turno.baixasLocaisPendentes, 0);
  await assert.rejects(origem.call('consultarMeuTerminalV2'), { code: 'functions/permission-denied' });
  await assert.rejects(origem.call('registrarBaixaVendaLocalV2', payload), { code: 'functions/permission-denied' });
  assert.equal((await gerente.call('recuperarOperacaoTerminalV2', d)).reutilizado, true);
  assert.equal((await db.collection(`${base}/vendas_locais_v2`).get()).size, 1);
  assert.equal((await db.collection(`${base}/recuperacoes_terminais`).get()).size, 1);
});
test('caixa substituto resolve pendência durante suspensão sem permitir venda nova nem acesso da origem', async () => {
  await gerente.call('revogarTerminalV2', { lojaId, terminalUid: origem.uid });
  const confirmacao = { vendaId: payload.vendaId, reciboId: recibo.reciboId };
  const cancelamento = { ...payload, motivo: 'Venda não gravada no equipamento' };
  for (const [nome, data] of [['registrarBaixaVendaLocalV2', payload], ['confirmarGravacaoVendaLocalV2', confirmacao], ['cancelarTentativaVendaLocalV2', cancelamento]]) {
    await assert.rejects(origem.call(nome, data), { code: 'functions/permission-denied' });
  }
  await db.doc(base).update({ 'ativacaoOperacionalV2.estado': 'suspensa' });
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  assert.equal((await destino.call('registrarBaixaVendaLocalV2', payload)).reciboId, recibo.reciboId);
  await assert.rejects(destino.call('registrarBaixaVendaLocalV2', { ...payload, vendaId: 'VL-NOVA-SUSPENSA' }), { code: 'functions/failed-precondition' });
  await destino.call('confirmarGravacaoVendaLocalV2', confirmacao);
  await destino.call('confirmarGravacaoVendaLocalV2', confirmacao);
  assert.equal((await destino.call('consultarTurnoCaixaV2', { turno })).turno.baixasLocaisPendentes, 0);
  assert.equal(await saldo(), 2250);
  assert.equal((await db.collection(`${base}/vendas_locais_v2`).get()).size, 1);
});

test('cancelamento recuperado devolve estoque uma vez e impede reaparecimento da tentativa', async () => {
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  await db.doc(base).update({ 'ativacaoOperacionalV2.estado': 'suspensa' });
  const cancelamento = { ...payload, motivo: 'Venda não gravada no equipamento' };
  await destino.call('cancelarTentativaVendaLocalV2', cancelamento);
  await destino.call('cancelarTentativaVendaLocalV2', cancelamento);
  await assert.rejects(destino.call('confirmarGravacaoVendaLocalV2', { vendaId: payload.vendaId, reciboId: recibo.reciboId }), { code: 'functions/failed-precondition' });
  await db.doc(base).update({ 'ativacaoOperacionalV2.estado': 'habilitada' });
  await assert.rejects(destino.call('registrarBaixaVendaLocalV2', payload), { code: 'functions/failed-precondition' });
  await assert.rejects(origem.call('registrarBaixaVendaLocalV2', payload), { code: 'functions/permission-denied' });
  assert.equal(await saldo(), 2500);
  assert.equal((await destino.call('consultarTurnoCaixaV2', { turno })).turno.baixasLocaisPendentes, 0);
  assert.equal((await db.collection(`${base}/movimentos_estoque`).where('tipo', '==', 'cancelamento_tentativa_local').get()).size, 1);
});

test('confirmação e cancelamento simultâneos após transferência deixam um único resultado financeiro', async () => {
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  const results = await Promise.allSettled([
    destino.call('confirmarGravacaoVendaLocalV2', { vendaId: payload.vendaId, reciboId: recibo.reciboId }),
    destino.call('cancelarTentativaVendaLocalV2', { ...payload, motivo: 'Operador desistiu da tentativa' })
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'functions/failed-precondition');
  const vendas = await db.collection(`${base}/vendas_locais_v2`).get();
  assert.equal(vendas.size, 1);
  const status = vendas.docs[0].data().status;
  assert.ok(['confirmado', 'cancelado'].includes(status));
  assert.equal(await saldo(), status === 'confirmado' ? 2250 : 2500);
  assert.equal((await destino.call('consultarTurnoCaixaV2', { turno })).turno.baixasLocaisPendentes, 0);
});

test('payload e escrita direta não delegam identidade; gerente de outra loja não recupera', async () => {
  await assert.rejects(destino.call('registrarBaixaVendaLocalV2', { ...payload, terminalUid: origem.uid, identidadeOperacionalUid: origem.uid }));
  await assert.rejects(origem.call('recuperarOperacaoTerminalV2', dados()), { code: 'functions/permission-denied' });
  await assert.rejects(estrangeiro.call('recuperarOperacaoTerminalV2', dados()), { code: 'functions/permission-denied' });
  await assert.rejects(setDoc(doc(destino.store, `terminais_v2/${destino.uid}`), { identidadeOperacionalUid: origem.uid }, { merge: true }), { code: 'permission-denied' });
  await assert.rejects(setDoc(doc(destino.store, `${base}/identidades_operacionais/${origem.uid}`), { terminalUid: destino.uid, revisao: 1 }), { code: 'permission-denied' });
  assert.equal(await saldo(), 2250);
});
test('destino com histórico, loja diferente, confirmação ausente ou revisão incorreta é recusado', async () => {
  await destino.call('abrirTurnoCaixaV2', { turno: { ...turno, id: 'TRN-DESTINO' }, trocoInicialCentavos: 0 });
  await assert.rejects(gerente.call('recuperarOperacaoTerminalV2', dados()), { code: 'functions/failed-precondition' });
  const d = { ...dados(), destinoUid: terceiro.uid };
  await assert.rejects(gerente.call('recuperarOperacaoTerminalV2', { ...d, confirmado: false }));
  await assert.rejects(gerente.call('recuperarOperacaoTerminalV2', { ...d, revisaoEsperada: 2 }));
  await db.doc(`terminais_v2/${terceiro.uid}`).update({ lojaId: 'outra' });
  await assert.rejects(gerente.call('recuperarOperacaoTerminalV2', d));
  assert.equal((await db.doc(`terminais_v2/${origem.uid}`).get()).data().ativo, true);
});
test('duas recuperações concorrentes possuem um único destino vencedor', async () => {
  const a = dados(), b = { ...dados(), destinoUid: terceiro.uid };
  const resultados = await Promise.allSettled([gerente.call('recuperarOperacaoTerminalV2', a), gerente.call('recuperarOperacaoTerminalV2', b)]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  const owner = (await db.doc(`${base}/identidades_operacionais/${origem.uid}`).get()).data();
  assert.ok([destino.uid, terceiro.uid].includes(owner.terminalUid)); assert.equal(owner.revisao, 1);
  assert.equal(await saldo(), 2250);
});
test('segunda transferência preserva origem financeira e replay antigo não reativa equipamento anterior', async () => {
  const primeira = dados(); await gerente.call('recuperarOperacaoTerminalV2', primeira);
  await gerente.call('recuperarOperacaoTerminalV2', { ...dados(), origemUid: destino.uid, destinoUid: terceiro.uid, revisaoEsperada: 1 });
  assert.equal((await terceiro.call('consultarMeuTerminalV2')).identidadeOperacionalUid, origem.uid);
  assert.equal((await terceiro.call('registrarBaixaVendaLocalV2', payload)).reciboId, recibo.reciboId);
  assert.equal((await gerente.call('recuperarOperacaoTerminalV2', primeira)).reutilizado, true);
  await assert.rejects(destino.call('consultarMeuTerminalV2'), { code: 'functions/permission-denied' });
  assert.equal((await db.doc(`${base}/identidades_operacionais/${origem.uid}`).get()).data().terminalUid, terceiro.uid);
  await assert.rejects(gerente.call('recuperarOperacaoTerminalV2', { ...primeira, motivo: 'Outro motivo posterior' }), { code: 'functions/already-exists' });
});
test('delegação revogada ou adulterada não concede acesso financeiro', async () => {
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  await db.doc(`${base}/identidades_operacionais/${origem.uid}`).update({ terminalUid: terceiro.uid });
  await assert.rejects(destino.call('consultarMeuTerminalV2'), { code: 'functions/permission-denied' });
  await assert.rejects(destino.call('consultarAtivacaoOperacionalV2'), { code: 'functions/permission-denied' });
  await assert.rejects(destino.call('registrarBaixaVendaLocalV2', payload), { code: 'functions/permission-denied' });
  assert.equal(await saldo(), 2250);
});

test('journal retoma transferência confirmada no servidor após perder resposta e reiniciar', async () => {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/recuperacao-terminal-pendente.js'), 'utf8').replace('export function', 'function'), ctx);
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const plano = await gerente.call('consultarPlanoRecuperacaoTerminalV2', dados()); let perder = true;
  const deps = { storage, uid: gerente.uid, lojaId, getUid: () => gerente.uid, uuid: randomUUID, ambienteTeste: true,
    call: async (name,payload) => { const result = await gerente.call(name,payload); if (perder) { perder = false; throw new Error('Resposta perdida'); } return result; } };
  await assert.rejects(ctx.criarRecuperacaoTerminalPendente(deps).executar(plano, 'Equipamento indisponível', true), /Resposta perdida/);
  assert.equal(data.size, 1);
  // Firestore não promete ordem das propriedades de um mapa.
  const operation = (await db.collection(`${base}/recuperacoes_terminais`).get()).docs[0];
  const p = operation.data().payload;
  await operation.ref.update({ payload: { motivo: p.motivo, revisaoEsperada: p.revisaoEsperada, destinoUid: p.destinoUid, origemUid: p.origemUid } });
  const result = await ctx.criarRecuperacaoTerminalPendente(deps).retomar();
  assert.equal(result.reutilizado, true); assert.equal(data.size, 0);
  assert.equal((await db.collection(`${base}/recuperacoes_terminais`).get()).size, 1);
  assert.equal((await destino.call('registrarBaixaVendaLocalV2', payload)).reciboId, recibo.reciboId);
  assert.equal(await saldo(), 2250);
});

test('origem com delegação para si mesma não pode ser transferida', async () => {
  await db.doc(`terminais_v2/${origem.uid}`).update({ identidadeOperacionalUid: origem.uid });
  await assert.rejects(gerente.call('consultarPlanoRecuperacaoTerminalV2', dados()), { code: 'functions/failed-precondition' });
  assert.equal((await db.doc(`terminais_v2/${destino.uid}`).get()).data().identidadeOperacionalUid, undefined);
});

test('backup com baixa pendente restaura em armazenamento vazio usando credenciais próprias do novo caixa', async () => {
  const memoria = () => { const map = new Map(); return { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k) }; };
  const carregar = storage => {
    const ctx = { localStorage: storage, window: { electronAPI: { ambienteTeste: true } }, console,
      core: require('../functions/venda-local-core.cjs'), estoqueCore: require('../functions/estoque-migracao-core.cjs') };
    vm.createContext(ctx);
    for (const file of ['perfil-operacional-v2.js','storage.js', 'venda-servidor-teste.js', 'backup-homologacao.js', 'conferencia-backup-v2.js', 'conferencia-historico-v2.js', 'resumo-restaurante-caixa.js', 'conferencia-gaveta-backup.js', 'conferencia-fechamento-backup-v2.js', 'restauracao-terminal-teste.js'])
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export const /g, 'var ').replace(/export /g, ''), ctx);
    ctx.StorageService.getLicenca = () => null;
    return ctx;
  };
  const storage = memoria(), produto = { id: 'farinha', nome: 'Farinha', unidade: 'g', estoque: 2500, preco: 0.02 };
  storage.setItem('flowpdv_device_id', turno.terminalId);
  storage.setItem('adega_produtos', JSON.stringify([produto]));
  storage.setItem('adega_turno_atual', JSON.stringify({ ...turno, status: 'aberto' }));
  storage.setItem('flowpdv_migracoes_estoque_teste', JSON.stringify([{ lojaId, status: 'confirmado', produto, estoqueId: 'farinha' }]));
  const inicial = carregar(storage);
  const ponte = inicial.criarVendaServidorTeste({ storage, servico: inicial.StorageService, ambienteTeste: true, uuid: () => 'PENDENTE', agora: () => turno.dataAbertura,
    call: async (name,data) => { const result = await origem.call(name,data); if (name === 'registrarBaixaVendaLocalV2') throw new Error('Resposta perdida'); return result; } });
  await assert.rejects(ponte.executar(ponte.preparar(produto, '250', '5')), /Resposta perdida/);
  const contexto = { lojaId, terminalId: turno.terminalId, terminalUid: origem.uid };
  const pacote = inicial.criarBackupHomologacao({ storage, contexto, ambienteTeste: true }).exportar();
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  const novaStorage = memoria(), novo = carregar(novaStorage);
  const resultado = await novo.ensaiarRestauracaoTerminal({ pacote, sessao: { auth: { currentUser: { uid: destino.uid } }, call: destino.call }, storageDestino: novaStorage, ambienteTeste: true, destinoIsolado: true });
  assert.notEqual(resultado.autenticadoUid, resultado.contexto.terminalUid);
  assert.equal(resultado.contexto.terminalUid, origem.uid); assert.equal(resultado.liberacaoOperacional, false);
  const retomada = novo.criarVendaServidorTeste({ storage: novaStorage, servico: novo.StorageService, ambienteTeste: true, call: destino.call });
  await retomada.executar();
  assert.equal(retomada.pendente(), null); assert.equal(novo.StorageService.getVendas().length, 1);
  assert.equal(novo.StorageService.getVendas()[0].id, payload.vendaId); assert.equal(await saldo(), 2250);
  assert.equal((await destino.call('consultarTurnoCaixaV2', { turno })).turno.baixasLocaisPendentes, 0);
  const conferido = await novo.conferirBackupServidor({ pacote: novo.criarBackupHomologacao({ storage: novaStorage, contexto, ambienteTeste: true }).exportar(), contexto, ambienteTeste: true, call: destino.call });
  assert.equal(conferido.semDivergencias, true); assert.equal(conferido.pendencias.length, 0);
  await assert.rejects(origem.call('consultarMeuTerminalV2'), { code: 'functions/permission-denied' });
});

test('backup antigo recupera venda e estorno posteriores confirmados sem alterar saldo remoto', async () => {
  const codigo = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/restauracao-terminal-teste.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
  const ctx = { module: { exports: {} } }; vm.runInNewContext(codigo.outputFiles[0].text, ctx);
  const produto = { id: 'farinha', nome: 'Farinha', unidade: 'g', estoque: 2500, preco: 0.02 };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: { lojaId, terminalId: turno.terminalId, terminalUid: origem.uid }, dados: {
    flowpdv_device_id: turno.terminalId, adega_turno_atual: JSON.stringify({ ...turno, status: 'aberto' }), adega_vendas: '[]', adega_produtos: JSON.stringify([produto]),
    flowpdv_migracoes_estoque_teste: JSON.stringify([{ lojaId, status: 'confirmado', produto, estoqueId: 'farinha' }]) } };
  const original = JSON.stringify(pacote);
  await origem.call('confirmarGravacaoVendaLocalV2', { vendaId: payload.vendaId, reciboId: recibo.reciboId });
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  const sessao = { auth: { currentUser: { uid: destino.uid } }, call: async (name,data) => {
    assert.ok(['consultarMeuTerminalV2', 'consultarRecuperacaoLocalV2', 'conferirInventarioCorteV2', 'listarTurnosRecuperacaoV2', 'consultarTurnoCaixaV2', 'consultarMovimentosTurnoV2', 'obterResumoFechadoTurnoV2'].includes(name)); return destino.call(name,data);
  } };
  for (const devolver of [false, true]) {
    if (devolver) {
      const e = await destino.call('estornarVendaLocalV2', { vendaId: payload.vendaId, turno, motivo: 'Cliente devolveu após backup', devolverEstoque: true, confirmado: true });
      await destino.call('confirmarEstornoLocalV2', { vendaId: payload.vendaId, reciboId: e.reciboId });
    }
    const map = new Map(), storageDestino = { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) };
    const saldoAntes = await saldo();
    const result = await ctx.module.exports.ensaiarRestauracaoTerminal({ pacote, sessao, storageDestino, ambienteTeste: true, destinoIsolado: true, reconstruirConfirmadas: true });
    const vendas = JSON.parse(storageDestino.getItem('adega_vendas')), turnoLocal = JSON.parse(storageDestino.getItem('adega_turno_atual'));
    assert.equal(vendas.length, 1); assert.equal(vendas[0].id, payload.vendaId); assert.equal(vendas[0].total, 5);
    assert.equal((turnoLocal.estornosLocaisV2 || []).length, devolver ? 1 : 0);
    assert.equal(result.conferencia.semDivergencias, true); assert.equal(result.conferencia.pendencias.length, 0);
    assert.equal(result.reconstrucao.length, devolver ? 2 : 1); assert.equal(await saldo(), saldoAntes);
    assert.equal(await saldo(), devolver ? 2500 : 2250); assert.equal(JSON.stringify(pacote), original);
  }
  assert.equal((await db.collection(`${base}/vendas_locais_v2`).get()).size, 1);
});

test('inventário de turnos separa identidades, acompanha transferência e recusa truncamento', async () => {
  assert.equal((await destino.call('listarTurnosRecuperacaoV2')).turnos.length, 0);
  assert.equal((await origem.call('listarTurnosRecuperacaoV2')).turnos.length, 1);
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  const list = await destino.call('listarTurnosRecuperacaoV2');
  assert.equal(list.terminalUid, origem.uid); assert.equal(list.turnos[0].id, turno.id);
  await assert.rejects(origem.call('listarTurnosRecuperacaoV2'), { code: 'functions/permission-denied' });
  const { referenciaTurno } = require('../functions/turno-referencia-v2');
  const batch = db.batch();
  for (let i = 0; i < 50; i++) { const ref = referenciaTurno({ ...turno, id: `EXTRA-${i}` }, origem.uid); batch.set(db.doc(`${base}/turnos_v2/${ref.chave}`), { ...ref, status: 'fechado', revisao: 2 }); }
  await batch.commit();
  await assert.rejects(destino.call('listarTurnosRecuperacaoV2'), { code: 'functions/failed-precondition' });
});

test('recuperação confere fechamento com pagamentos divididos e estorno sem alterar os saldos', async () => {
  const codigo = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/conferencia-fechamento-backup-v2.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
  const ctx = { module: { exports: {} } }; vm.runInNewContext(codigo.outputFiles[0].text, ctx);
  await origem.call('confirmarGravacaoVendaLocalV2', { vendaId: payload.vendaId, reciboId: recibo.reciboId });
  const state = (await origem.call('consultarTurnoCaixaV2', { turno })).turno;
  const itens = valor => [{ origemLinhaId: 'L', origemPedidoId: 'P', produtoId: 'lanche', nome: 'Lanche', quantidade: 1, precoUnitarioCentavos: valor, totalCentavos: valor, opcoes: [] }];
  const pagos = [{ forma: 'dinheiro', valorCentavos: 700 }, { forma: 'pix_manual', valorCentavos: 500 }];
  // Fixture de movimentos já registrados: esta suíte testa leitura/recuperação, não fechamento de pedidos.
  await db.doc(`${base}/vendas/CONTA-A`).set({ totalCentavos: 1200, itens: itens(1200) });
  await db.doc(`${base}/vendas/CONTA-B`).set({ totalCentavos: 200, itens: itens(200) });
  for (const [id, tipo, vendaId, totalCentavos, pagamentos] of [
    ['A', 'recebimento_manual', 'CONTA-A', 1200, pagos],
    ['B', 'recebimento_manual', 'CONTA-B', 200, [{ forma: 'dinheiro', valorCentavos: 200 }]],
    ['E', 'estorno_manual', 'CONTA-B', -200, [{ forma: 'dinheiro', valorCentavos: 200 }]]
  ]) await db.doc(`${base}/movimentos_financeiros/${id}`).set({ tipo, vendaId, totalCentavos, pagamentos, turno: state, terminalUid: origem.uid });
  await db.doc(`${base}/turnos_v2/${state.chave}`).update({ totalCentavos: 1200, formas: { dinheiro: 700, pix_manual: 500, cartao_manual: 0 }, movimentos: 3, revisao: state.revisao + 3 });
  await origem.call('encerrarTurnoCaixaV2', { turno, confirmado: true, revisao: state.revisao + 3, dinheiroContadoCentavos: 650 });
  const snapshot = await origem.call('obterResumoFechadoTurnoV2', { turno });
  await gerente.call('recuperarOperacaoTerminalV2', dados());
  const contexto = { lojaId, terminalUid: origem.uid, terminalId: turno.terminalId };
  const local = { ...turno, status: 'fechado', fundoRestauranteCentavos: 0, restauranteV2: snapshot };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto, dados: { flowpdv_device_id: turno.terminalId, adega_turnos_historico: JSON.stringify([local]) } };
  const run = () => ctx.module.exports.conferirFechamentosBackup({ pacote, contexto, ambienteTeste: true, call: async (name,data) => {
    assert.ok(['listarTurnosRecuperacaoV2','consultarTurnoCaixaV2','consultarMovimentosTurnoV2','obterResumoFechadoTurnoV2'].includes(name)); return destino.call(name,data);
  } });
  const antes = await saldo(), result = await run();
  assert.equal(result.semDivergencias, true); assert.equal(result.conferencias[0].movimentos, 3); assert.equal(result.conferencias[0].totalRestauranteCentavos, 1200);
  assert.equal(result.liberacaoOperacional, false); assert.equal(await saldo(), antes);
  delete local.restauranteV2; pacote.dados.adega_turnos_historico = JSON.stringify([local]);
  assert.equal((await run()).divergencias[0].codigo, 'resumo_restaurante_ausente');
  local.restauranteV2 = snapshot; snapshot.detalhes[0].itens[0].nome = 'Nome alterado no arquivo'; pacote.dados.adega_turnos_historico = JSON.stringify([local]);
  assert.equal((await run()).divergencias[0].codigo, 'resumo_restaurante_divergente');
  await db.doc(`${base}/turnos_v2/${state.chave}`).update({ totalCentavos: 1199 });
  await assert.rejects(run(), /difere dos movimentos/);
  assert.equal(await saldo(), antes);
});

test('recuperação preserva contas e pedidos conferidos e recebe uma vez no próximo turno',async()=>{
  await origem.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:recibo.reciboId});
  await gerente.call('recuperarOperacaoTerminalV2',dados());
  const item={linhaId:'L',produtoId:'lanche',nome:'Lanche',quantidade:1,precoUnitarioCentavos:500,totalCentavos:500,opcoes:[]};
  await db.doc(`${base}/mesas/M1`).set({ativo:true,comandaPdvId:'MESA-1',ciclo:1,pendentesRecebimento:0});
  for(const pid of ['P1','P2'])await db.doc(`${base}/pedidos/${pid}`).set({tipo:'mesa',mesaId:'M1',mesaCiclo:1,status:'novo',recebidoPdv:false,pagamento:'pendente',itens:[item],totalCentavos:500});
  const recebido=await destino.call('receberPedidoPdvV2',{pedidoId:'P1'});
  const consultar=()=>destino.call('conferirPendenciasRecuperacaoV2');
  const plano=await consultar();assert.equal(plano.registros.length,2);assert.equal(plano.terminalUid,origem.uid);
  await assert.rejects(origem.call('conferirPendenciasRecuperacaoV2'));
  const estado=(await destino.call('consultarTurnoCaixaV2',{turno})).turno;
  const req={lojaId,destinoUid:destino.uid,identidadeUid:origem.uid,requestId:randomUUID(),digest:'c'.repeat(64),turno,revisao:estado.revisao,dinheiroContadoCentavos:0,confirmado:true,pendencias:{digest:plano.digest,confirmado:true,fonte:'Contas e comprovantes conferidos'}};
  await assert.rejects(estrangeiro.call('encerrarTurnoRecuperadoV2',req));
  await db.doc(`${base}/pedidos/P2`).update({status:'aceito'});
  await assert.rejects(gerente.call('encerrarTurnoRecuperadoV2',req),/mudaram/);
  // Pagamento já registrado em uma conta aberta impede a liberação, inclusive inconsistência administrativa.
  await db.doc(`${base}/vendas/${recebido.atendimentoId}`).set({status:'concluida'});await assert.rejects(consultar(),/pagamento/);await db.doc(`${base}/vendas/${recebido.atendimentoId}`).delete();
  await db.doc(`${base}/pedidos/P2`).update({pagamento:'pago'});await assert.rejects(consultar(),/pagamento/);await db.doc(`${base}/pedidos/P2`).update({pagamento:'pendente'});
  req.pendencias.digest=(await consultar()).digest;
  const antes=(await db.doc(`${base}/atendimentos/${recebido.atendimentoId}`).get()).data();
  const fechado=await gerente.call('encerrarTurnoRecuperadoV2',req);assert.equal((await gerente.call('encerrarTurnoRecuperadoV2',req)).reutilizado,true);
  const liberar={lojaId,destinoUid:destino.uid,identidadeUid:origem.uid,requestId:randomUUID(),digest:'d'.repeat(64),confirmado:true,turnos:[{chave:estado.chave,revisao:fechado.turno.revisao}],estoque:[{estoqueId:'farinha',saldoMili:2250,unidade:'kg'}],pendencias:req.pendencias};
  await assert.rejects(gerente.call('autorizarLiberacaoPerfilV2',{...liberar,pendencias:undefined}));
  await gerente.call('autorizarLiberacaoPerfilV2',liberar);
  assert.deepEqual((await db.doc(`${base}/atendimentos/${recebido.atendimentoId}`).get()).data(),antes);assert.equal(await saldo(),2250);
  assert.equal((await db.doc(`${base}/pedidos/P2`).get()).data().recebidoPdv,false);
  const novo={...turno,id:'TRN-NOVO',dataAbertura:'2026-09-23T10:00:00.000Z'};await destino.call('abrirTurnoCaixaV2',{turno:novo,trocoInicialCentavos:0});
  const p2=await destino.call('receberPedidoPdvV2',{pedidoId:'P2'});assert.equal(p2.atendimentoId,recebido.atendimentoId);
  await destino.call('receberPedidoPdvV2',{pedidoId:'P2'});
  await db.doc(`${base}/fichas_estoque/lanche`).set({consumos:[{estoqueId:'farinha',quantidadeMili:250}]});
  const conta=(await db.doc(`${base}/atendimentos/${p2.atendimentoId}`).get()).data();assert.equal(conta.itens.length,2);
  const pagamento={atendimentoId:p2.atendimentoId,versao:conta.versao,turno:novo,confirmado:true,pagamentos:[{forma:'dinheiro',valorCentavos:1000}],recebidoDinheiroCentavos:1000};
  await destino.call('fecharAtendimentoV2',pagamento);assert.equal((await destino.call('fecharAtendimentoV2',pagamento)).reutilizado,true);
  assert.equal(await saldo(),1750);assert.equal((await db.collection(`${base}/vendas`).get()).size,1);assert.equal((await consultar()).registros.length,0);
});

test('pagamento de atendimento transferido é conferido sem executar nova venda',async()=>{
 await origem.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:recibo.reciboId});
 const item={linhaId:'L',produtoId:'lanche',nome:'Lanche',quantidade:1,precoUnitarioCentavos:500,totalCentavos:500,opcoes:[]};
 await db.doc(`${base}/pedidos/P`).set({tipo:'retirada',status:'novo',recebidoPdv:false,pagamento:'pendente',itens:[item],totalCentavos:500});
 await db.doc(`${base}/fichas_estoque/lanche`).set({consumos:[{estoqueId:'farinha',quantidadeMili:250}]});
 const conta=await origem.call('receberPedidoPdvV2',{pedidoId:'P'});
 const pg={atendimentoId:conta.atendimentoId,versao:1,turno,confirmado:true,pagamentos:[{forma:'dinheiro',valorCentavos:500}],recebidoDinheiroCentavos:1000};
 await origem.call('fecharAtendimentoV2',pg);await gerente.call('recuperarOperacaoTerminalV2',dados());
 const antes=await saldo();assert.equal(antes,2000);
 await assert.rejects(origem.call('consultarPagamentoAtendimentoV2',pg),{code:'functions/permission-denied'});
 await assert.rejects(terceiro.call('consultarPagamentoAtendimentoV2',pg));
 await assert.rejects(destino.call('consultarPagamentoAtendimentoV2',{...pg,recebidoDinheiroCentavos:900}));
 await assert.rejects(destino.call('consultarPagamentoAtendimentoV2',{...pg,atendimentoId:'ausente'}));
 const codigo=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../src/js/pagamento-atendimento-pendente.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
 const contexto={module:{exports:{}}};vm.runInNewContext(codigo,contexto);
 const guard={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/js/bloqueio-recuperacao-perfil.js'),'utf8').replace(/export /g,''),guard);
 const key='flowpdv_pagamento_atendimento_pendente',marca='flowpdv_recuperacao_operacao_bloqueada';
 const map=new Map([[key,JSON.stringify({schema:1,lojaId,terminalUid:origem.uid,payload:pg,totalCentavos:500})],[marca,JSON.stringify({schema:1,lojaId,terminalUid:origem.uid,autenticadoUid:destino.uid})]]);
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let perder=true;const criar=()=>contexto.module.exports.criarPagamentoAtendimentoPendente({storage,ambienteTeste:true,sessao:{auth:{currentUser:{uid:destino.uid}},call:async(n,d)=>{guard.exigirConsultaDuranteRecuperacao(storage,n);const r=await destino.call(n,d);if(n==='consultarPagamentoAtendimentoV2'&&perder)throw Error('Resposta perdida');return r;}}});
 await assert.rejects(criar().retomar(),/perdida/);assert.ok(map.has(key));perder=false;await criar().retomar();assert.equal(map.has(key),false);assert.ok(map.has(marca));
 assert.equal(await saldo(),antes);assert.equal((await db.collection(`${base}/vendas`).get()).size,1);assert.equal((await db.collection(`${base}/movimentos_financeiros`).get()).size,1);
 await db.doc(`${base}/vendas/${conta.atendimentoId}`).update({status:'estornada'});await assert.rejects(destino.call('consultarPagamentoAtendimentoV2',pg),/estornado/);
});
