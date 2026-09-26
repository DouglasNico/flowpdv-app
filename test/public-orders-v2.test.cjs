const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { Timestamp } = createRequire(path.resolve(__dirname, '../functions/package.json'))('firebase-admin/firestore');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously, signOut, signInWithEmailAndPassword } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const { getFirestore, connectFirestoreEmulator, getDocFromServer, setDoc, doc, setLogLevel } = local('firebase/firestore');
const apps = []; let db, customer;
const ports = process.env.FLOWPDV_COMBOS_ISOLADO === '1' ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
const hash = value => createHash('sha256').update(value).digest('hex');
async function client() {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
  const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true }); await signInAnonymously(auth);
  const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
  const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', ports.firestore);
  return { auth, store, call: async (name, data) => (await httpsCallable(fn, name)(data)).data };
}
function payload() {
  return { slug: 'lanchonete-a', requestId: randomUUID(), tipo: 'mesa', mesaId: 'mesa-1', catalogoVersao: 1,
    itens: [{ produtoId: 'lanche', quantidade: 2, observacao: 'Sem cebola', opcoes: [{ grupoId: 'ponto', opcaoId: 'bem', quantidade: 1 }, { grupoId: 'extras', opcaoId: 'bacon', quantidade: 1 }] }] };
}
const create = data => customer.call('criarPedidoPublicoV2', data);
const denied = (promise, code) => assert.rejects(promise, error => error.code === `functions/${code}`);
async function deliveryPayload() {
  await db.doc('lojas_v2/loja-a').set({ configVersao: 1, modulos: { cardapio: true, mesas: true, retirada: true },
    delivery: { ativo: true, pedidoMinimoCentavos: 1000, regioes: [{id:'centro',nome:'Centro',cepInicial:'01000000',cepFinal:'01999999',taxaCentavos:500,prazoMinutos:40}] } }, {merge:true});
  return { ...payload(), tipo:'delivery', entrega:{nome:'Pessoa Ficticia',telefone:'(11) 99999-9999',cep:'01000-000',logradouro:'Rua de Teste',numero:'10',complemento:'Sala 2',bairro:'Centro',cidade:'São Paulo',uf:'sp'},
    cotacao:{configuracaoVersao:1,taxaEntregaCentavos:500,totalCentavos:3000} };
}
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore(); setLogLevel('silent');
  await admin.auth().createUser({ uid: 'caixa-orders', email: 'caixa-orders@example.test', password: 'Ficticia-123!', emailVerified: true });
  for (const loja of ['a', 'b']) {
    await db.doc(`lojas_v2/loja-${loja}`).set({ ativo: true, nome: `Fictícia ${loja}` });
    await db.doc(`lojas_v2/loja-${loja}/mesas/mesa-1`).set({ ativo: true, nome: 'Mesa 1' });
    await db.doc(`rotas_publicas_v2/lanchonete-${loja}`).set({ lojaId: `loja-${loja}` });
    await db.doc(`catalogos_publicos_v2/lanchonete-${loja}`).set({ publicado: true, pausado: false, versao: 1, produtos: [
      { id: 'lanche', nome: 'Lanche fictício', ativo: true, precoCentavos: loja === 'a' ? 1000 : 2000, grupos: [
        { id: 'ponto', nome: 'Ponto', min: 1, max: 1, opcoes: [{ id: 'bem', nome: 'Bem passado', ativo: true, precoCentavos: 0, maxQuantidade: 1 }] },
        { id: 'extras', nome: 'Adicionais', min: 0, max: 2, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 2 }] }
      ] },
      { id: 'esgotado', nome: 'Esgotado', ativo: true, esgotado: true, precoCentavos: 100, grupos: [] }
    ] });
  }
  await db.doc('lojas_v2/loja-a/membros/caixa-orders').set({ papel: 'caixa', ativo: true, tipo: 'usuario' });
});
beforeEach(async () => { customer = await client(); });
after(async () => { await Promise.all(apps.map(deleteApp)); if (admin.apps.length) await admin.app().delete(); });

test('preço vem do catálogo; pedido privado, acompanhamento e recibo são atômicos', async () => {
  const data = payload(); data.totalCentavos = 1; data.lojaId = 'loja-b'; data.itens[0].precoCentavos = 0;
  const result = await create(data); assert.equal(result.totalCentavos, 2500); assert.equal(result.status, 'novo');
  const saved = (await db.doc(`lojas_v2/loja-a/pedidos/${result.pedidoId}`).get()).data();
  assert.equal(saved.totalCentavos, 2500); assert.equal(saved.itens[0].observacao, 'Sem cebola'); assert.equal(saved.pagamento, 'pendente');
  assert.equal((await db.doc(`lojas_v2/loja-b/pedidos/${result.pedidoId}`).get()).exists, false);
  assert.equal((await db.doc(`acompanhamentos_v2/${hash(result.acompanhamentoToken)}`).get()).exists, true);
  assert.equal((await db.doc(`lojas_v2/loja-a/solicitacoes/${hash(`${customer.auth.currentUser.uid}:${data.requestId}`)}`).get()).exists, true);
  await assert.rejects(getDocFromServer(doc(customer.store, 'lojas_v2/loja-a/pedidos', result.pedidoId)), error => error.code === 'permission-denied');
  const staff = await client(); await signInWithEmailAndPassword(staff.auth, 'caixa-orders@example.test', 'Ficticia-123!');
  assert.equal((await getDocFromServer(doc(staff.store, 'lojas_v2/loja-a/pedidos', result.pedidoId))).exists(), true);
});
test('reenvio simultâneo retorna o mesmo pedido e token; conteúdo diferente é recusado', async () => {
  const data = payload(); const results = await Promise.all([create(data), create(data)]);
  assert.equal(results[0].pedidoId, results[1].pedidoId); assert.equal(results[0].acompanhamentoToken, results[1].acompanhamentoToken);
  assert.equal(results.filter(r => r.reutilizado === false).length, 1);
  data.itens[0].quantidade = 3; await denied(create(data), 'already-exists');
});
test('mesma chave de envio em outra sessão não recupera o pedido alheio', async () => {
  const data = payload(); const a = await create(data); const stranger = await client();
  const b = await stranger.call('criarPedidoPublicoV2', data);
  assert.notEqual(a.pedidoId, b.pedidoId); assert.notEqual(a.acompanhamentoToken, b.acompanhamentoToken);
});
test('mantém linhas com adicionais diferentes e calcula quantidade das opções', async () => {
  const data = payload(); data.itens.push({ ...data.itens[0], quantidade: 1, opcoes: [{ grupoId: 'ponto', opcaoId: 'bem', quantidade: 1 }] });
  data.itens[0].opcoes[1].quantidade = 2;
  const result = await create(data); assert.equal(result.totalCentavos, 4000); assert.equal(result.itens.length, 2);
  const order = (await db.doc(`lojas_v2/loja-a/pedidos/${result.pedidoId}`).get()).data();
  assert.notEqual(order.itens[0].linhaId, order.itens[1].linhaId);
});
test('recusa quantidade negativa/fracionada, opção repetida, excesso e grupo obrigatório ausente', async () => {
  for (const quantidade of [-1, 0, 1.5, 100]) { const data = payload(); data.itens[0].quantidade = quantidade; await denied(create(data), 'invalid-argument'); }
  const duplicate = payload(); duplicate.itens[0].opcoes.push(duplicate.itens[0].opcoes[0]); await denied(create(duplicate), 'invalid-argument');
  const missing = payload(); missing.itens[0].opcoes = []; await denied(create(missing), 'failed-precondition');
  const excess = payload(); excess.itens[0].opcoes[1].quantidade = 3; await denied(create(excess), 'failed-precondition');
});
test('recusa produto/opção inexistente, esgotado e mesa inexistente sem gravar pedido parcial', async () => {
  const count = (await db.collection('lojas_v2/loja-a/pedidos').get()).size;
  for (const produtoId of ['inexistente', 'esgotado']) { const data = payload(); data.itens[0].produtoId = produtoId; await denied(create(data), 'failed-precondition'); }
  const option = payload(); option.itens[0].opcoes[0].opcaoId = 'inexistente'; await denied(create(option), 'failed-precondition');
  const table = payload(); table.mesaId = 'inexistente'; await denied(create(table), 'failed-precondition');
  assert.equal((await db.collection('lojas_v2/loja-a/pedidos').get()).size, count);
});
test('mudança de catálogo exige revisão; reenvio de pedido confirmado ainda recupera o original', async () => {
  const data = payload(), original = await create(data);
  await db.doc('catalogos_publicos_v2/lanchonete-a').update({ versao: 2 });
  try {
    assert.equal((await create(data)).pedidoId, original.pedidoId);
    await denied(create(payload()), 'failed-precondition');
  } finally { await db.doc('catalogos_publicos_v2/lanchonete-a').update({ versao: 1 }); }
});
test('loja pausada não recebe pedido; retirada não exige mesa e delivery sem endereço é recusado', async () => {
  await db.doc('catalogos_publicos_v2/lanchonete-a').update({ pausado: true });
  try { await denied(create(payload()), 'failed-precondition'); }
  finally { await db.doc('catalogos_publicos_v2/lanchonete-a').update({ pausado: false }); }
  const pickup = payload(); pickup.tipo = 'retirada'; delete pickup.mesaId;
  assert.equal((await create(pickup)).mesaNome, null);
  pickup.tipo = 'delivery'; await denied(create(pickup), 'invalid-argument');
});
test('limite de frequência bloqueia novos pedidos, mas não a recuperação do confirmado', async () => {
  const data = payload(), result = await create(data), minute = Math.floor(Date.now() / 60000);
  for (const bucket of [minute, minute + 1]) await db.doc(`limites_pedidos_v2/${hash(`loja-a:${customer.auth.currentUser.uid}:${bucket}`)}`).set({ contagem: 5 });
  assert.equal((await create(data)).pedidoId, result.pedidoId);
  await denied(create(payload()), 'resource-exhausted');
});
test('acompanhamento reflete estado atual, omite dados privados e expira', async () => {
  const result = await create(payload());
  await db.doc(`lojas_v2/loja-a/pedidos/${result.pedidoId}`).update({ status: 'em_preparo', documento: 'segredo-ficticio' });
  await signOut(customer.auth);
  const view = await customer.call('acompanharPedidoPublicoV2', { token: result.acompanhamentoToken });
  assert.equal(view.status, 'em_preparo');
  assert.equal(view.pagamento, 'pendente'); // Só o estado público; sem dados da transação.
  for (const key of ['lojaId', 'documento', 'chaveLicenca', 'pagamentos', 'terminalUid', 'vendaId', 'acompanhamentoToken']) assert.equal(view[key], undefined);
  assert.equal(view.itens[0].observacao, undefined);
  await denied(customer.call('acompanharPedidoPublicoV2', { token: 'x'.repeat(43) }), 'not-found');
  await db.doc(`acompanhamentos_v2/${hash(result.acompanhamentoToken)}`).update({ expiraEm: Timestamp.fromMillis(0) });
  await denied(customer.call('acompanharPedidoPublicoV2', { token: result.acompanhamentoToken }), 'not-found');
  await denied(create(payload()), 'unauthenticated');
});

test('delivery público grava contato separado, protege acesso e chega ao pagamento com taxa', async () => {
  const data=await deliveryPayload(), results=await Promise.all([create(data),create(data)]), result=results[0];
  assert.equal(results.filter(r=>!r.reutilizado).length,1); assert.equal(results[1].pedidoId,result.pedidoId);
  assert.equal(result.totalCentavos,3000);assert.equal(result.subtotalCentavos,2500);assert.equal(result.taxaEntregaCentavos,500);
  const base='lojas_v2/loja-a', privatePath=`${base}/dados_entrega/${result.pedidoId}`;
  const delivery=(await db.doc(privatePath).get()).data();assert.equal(delivery.telefone,'11999999999');assert.equal(delivery.cep,'01000000');
  const order=(await db.doc(`${base}/pedidos/${result.pedidoId}`).get()).data();
  const view=await customer.call('acompanharPedidoPublicoV2',{token:result.acompanhamentoToken});
  for(const value of [result,view,order,(await db.doc(`${base}/solicitacoes/${hash(`${customer.auth.currentUser.uid}:${data.requestId}`)}`).get()).data()])
    assert.doesNotMatch(JSON.stringify(value),/Pessoa Ficticia|Rua de Teste|11999999999|01000000/);
  async function staff(papel,lojaId='loja-a') {
    const c=await client(),uid=c.auth.currentUser.uid;
    await db.doc(`terminais_v2/${uid}`).set({ativo:true,papel,lojaId});
    await db.doc(`lojas_v2/${lojaId}/membros/${uid}`).set({ativo:true,papel,tipo:'terminal'});return c;
  }
  const caixa=await staff('caixa'),cozinha=await staff('cozinha'),outro=await staff('caixa','loja-b');
  for(const c of [customer,cozinha,outro]) await assert.rejects(getDocFromServer(doc(c.store,privatePath)),{code:'permission-denied'});
  assert.equal((await getDocFromServer(doc(caixa.store,privatePath))).data().nome,'Pessoa Ficticia');
  await assert.rejects(setDoc(doc(caixa.store,privatePath),{telefone:'alterado'},{merge:true}),{code:'permission-denied'});
  await db.doc(`${base}/fichas_estoque/lanche`).set({semEstoque:true});
  const received=await caixa.call('receberPedidoPdvV2',{pedidoId:result.pedidoId});
  const account=(await db.doc(`${base}/atendimentos/${received.atendimentoId}`).get()).data();
  assert.equal(account.totalCentavos,3000);assert.doesNotMatch(JSON.stringify(account),/Rua de Teste|11999999999/);
  await caixa.call('fecharAtendimentoV2',{atendimentoId:received.atendimentoId,versao:account.versao,pagamentos:[{forma:'dinheiro',valorCentavos:3000}],recebidoDinheiroCentavos:4000,confirmado:true});
  const paid=await customer.call('acompanharPedidoPublicoV2',{token:result.acompanhamentoToken});assert.equal(paid.pagamento,'pago');assert.equal(paid.taxaEntregaCentavos,500);
});

test('delivery exige cotação atual e reenvio confirmado preserva pedido após pausa',async()=>{
  const data=await deliveryPayload();
  const before=(await db.collection('lojas_v2/loja-a/dados_entrega').get()).size;
  await denied(create({...data,cotacao:{...data.cotacao,taxaEntregaCentavos:0}}),'failed-precondition');
  await db.doc('lojas_v2/loja-a').update({configVersao:2});await denied(create(data),'failed-precondition');
  assert.equal((await db.collection('lojas_v2/loja-a/dados_entrega').get()).size,before);
  data.cotacao.configuracaoVersao=2;const original=await create(data);
  await db.doc('lojas_v2/loja-a').update({'delivery.ativo':false});
  assert.equal((await create(data)).pedidoId,original.pedidoId);
  await denied(create({...data,entrega:{...data.entrega,numero:'11'}}),'already-exists');
  await denied(create({...data,requestId:randomUUID()}),'failed-precondition');
});

test('delivery recusa endereço incompleto e CEP fora da área sem gravar parcialmente',async()=>{
  const data=await deliveryPayload(),base='lojas_v2/loja-a';
  const before=await Promise.all(['pedidos','dados_entrega'].map(async c=>(await db.collection(`${base}/${c}`).get()).size));
  for(const patch of [{nome:''},{telefone:'123'},{cep:'123'},{uf:'XX'},{logradouro:''},{numero:''},{cidade:''},{complemento:'x'.repeat(121)}])
    await denied(create({...data,entrega:{...data.entrega,...patch}}),'invalid-argument');
  await denied(create({...data,entrega:{...data.entrega,cep:'02000000'}}),'failed-precondition');
  assert.deepEqual(await Promise.all(['pedidos','dados_entrega'].map(async c=>(await db.collection(`${base}/${c}`).get()).size)),before);
});
