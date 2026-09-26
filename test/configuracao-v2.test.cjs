const { test, before, after, beforeEach } = require('node:test');
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
async function client(role, lojaId = 'config-a') {
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
const base = 'lojas_v2/config-a';
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
  await db.doc(base).set({ ativo: true }); await db.doc('lojas_v2/config-b').set({ ativo: true });
  a = await client('caixa'); b = await client('caixa'); kitchen = await client('cozinha'); stranger = await client();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });
let manager;
before(async () => {
  manager = await client();
  await admin.auth().updateUser(manager.uid, { email: 'config-gerente@example.test', password: 'Ficticia-123!', emailVerified: true });
  await db.doc(`${base}/membros/${manager.uid}`).set({ ativo: true, tipo: 'usuario', papel: 'gerente' });
  await db.doc('rotas_publicas_v2/config-menu').set({ lojaId: 'config-a' });
  await db.doc('rotas_publicas_v2/config-outro').set({ lojaId: 'config-b' });
});
beforeEach(async () => {
  await db.doc(base).set({ ativo: true, nome: 'Loja de configuração', slug: 'config-menu', configVersao: 0, modulos: { cardapio: true, mesas: true, retirada: true }, cozinha: { impressao: false, kds: false } });
  await db.doc('catalogos_publicos_v2/config-menu').set({ publicado: true, versao: 1, produtos: [{ id: 'lanche', nome: 'Lanche', ativo: true, precoCentavos: 1000, grupos: [] }] });
});
const context = async () => ({ lojaId: 'config-a', slug: 'config-menu', versao: (await db.doc(base).get()).data().configVersao });
const save = async (name, data = {}) => manager.call(name, { ...await context(), ...data });
const settings = (print = false, kds = false) => ({ segmento: 'lanchonete', modulos: { cardapio: true, mesas: true, retirada: true }, cozinha: { impressao: print, kds, papelMm: 80, impressora: print ? 'Cozinha de teste' : '', terminalUid: print ? a.uid : '' } });

test('gerência abre configuração com mais de 200 mesas e pagina sob revisão e permissão',async()=>{
  const refs=Array.from({length:205},(_,i)=>db.doc(`${base}/mesas/paginada-${String(i).padStart(3,'0')}`));
  const batch=db.batch();refs.forEach((r,i)=>batch.set(r,{nome:'Mesa '+i,ativo:true,comandaPdvId:'MESA-'+(8000+i)}));await batch.commit();
  try{
    const contextInitial=await context(), first=await manager.call('consultarConfiguracaoV2',contextInitial), ids=first.mesas.map(m=>m.id);
    assert.equal(first.mesas.length,200);assert.ok(first.proximaMesa);
    let cursor=first.proximaMesa;
    while(cursor){const page=await manager.call('listarMesasConfiguracaoV2',{...contextInitial,apos:cursor});ids.push(...page.mesas.map(m=>m.id));cursor=page.proximaMesa;}
    assert.equal(new Set(ids).size,ids.length);for(const r of refs)assert.ok(ids.includes(r.id));
    await assert.rejects(a.call('listarMesasConfiguracaoV2',{...contextInitial,apos:first.proximaMesa}),{code:'functions/permission-denied'});
    await assert.rejects(manager.call('listarMesasConfiguracaoV2',{...contextInitial,apos:'../mesa'}),{code:'functions/invalid-argument'});
    await db.doc(base).update({configVersao:1});
    await assert.rejects(manager.call('listarMesasConfiguracaoV2',{...contextInitial,apos:first.proximaMesa}),{code:'functions/failed-precondition'});
  }finally{const cleanup=db.batch();refs.forEach(r=>cleanup.delete(r));await cleanup.commit();}
});

test('apresentação do catálogo preserva metadados, valida foto e respeita retirada de publicação',async()=>{
 const produto={produtoId:'lanche',nome:'Lanche completo',precoCentavos:1300,ativo:true,esgotado:false};
 await save('salvarProdutoCardapioV2',{...produto,categoria:'Lanches',descricao:'Pão e queijo',ordem:2,imagemUrl:'https://res.cloudinary.com/exemplo/image/upload/v1/lanche.jpg'});
 await save('salvarProdutoCardapioV2',produto);
 let catalog=(await db.doc('catalogos_publicos_v2/config-menu').get()).data();assert.equal(catalog.produtos[0].categoria,'Lanches');assert.equal(catalog.produtos[0].ordem,2);
 await assert.rejects(save('salvarProdutoCardapioV2',{...produto,imagemUrl:'javascript:alert(1)'}),{code:'functions/invalid-argument'});
 await save('publicarCatalogoV2',{publicado:false});
 await save('salvarProdutoCardapioV2',{...produto,nome:'Editado sem publicar'});
 await save('salvarModulosV2',settings());
 catalog=(await db.doc('catalogos_publicos_v2/config-menu').get()).data();assert.equal(catalog.publicado,false);
 await save('publicarCatalogoV2',{publicado:true});
 assert.equal((await db.doc('catalogos_publicos_v2/config-menu').get()).data().publicado,true);
 await save('salvarProdutoCardapioV2',{...produto,esgotado:true});
 await save('publicarCatalogoV2',{publicado:false});
 await assert.rejects(save('publicarCatalogoV2',{publicado:true}),{code:'functions/failed-precondition'});
});

test('garçom: acesso individual, mesa sem QR público, adicionais e reenvio único',async()=>{
 const waiter=await client();await admin.auth().updateUser(waiter.uid,{email:`garcom-${randomUUID()}@example.test`,emailVerified:true});
 await save('salvarGarcomV2',{uid:waiter.uid,ativo:true});
 await db.doc(`${base}/mesas/garcom-1`).set({ativo:true,nome:'Mesa garçom',comandaPdvId:'MESA-70'});
 await save('salvarOpcaoCardapioV2',{produtoId:'lanche',grupoId:'extras',nomeGrupo:'Extras',min:0,max:2,opcaoId:'bacon',nome:'Bacon',precoCentavos:200,maxQuantidade:2,ativo:true});
 await save('salvarModulosV2',{...settings(),modulos:{cardapio:false,mesas:false,retirada:false,garcom:true}});
 const config=await waiter.call('consultarAtendimentoGarcomV2',{slug:'config-menu'});
 assert.ok(config.mesas.some(m=>m.id==='garcom-1'));assert.equal(config.catalogo.produtos[0].grupos[0].opcoes[0].precoCentavos,200);
 const payload={slug:'config-menu',requestId:randomUUID(),tipo:'mesa',mesaId:'garcom-1',catalogoVersao:config.catalogo.versao,itens:[{produtoId:'lanche',quantidade:2,observacao:'Sem cebola',opcoes:[{grupoId:'extras',opcaoId:'bacon',quantidade:1}]}]};
 await assert.rejects(stranger.call('criarPedidoGarcomV2',payload),{code:'functions/permission-denied'});
 await assert.rejects(waiter.call('criarPedidoPublicoV2',payload),/recebendo|desativado/);
 const results=await Promise.all([waiter.call('criarPedidoGarcomV2',payload),waiter.call('criarPedidoGarcomV2',payload)]);
 assert.equal(results[0].pedidoId,results[1].pedidoId);assert.equal(results[0].totalCentavos,2400);
 const created=(await db.doc(`${base}/pedidos/${results[0].pedidoId}`).get()).data();assert.equal(created.origem,'garcom_v2');assert.equal(created.garcomUid,waiter.uid);assert.equal(created.itens[0].observacao,'Sem cebola');
 const received=await a.receive(results[0].pedidoId);assert.equal((await attendance(received.atendimentoId)).totalCentavos,2400);
 await assert.rejects(waiter.call('fecharAtendimentoV2',{atendimentoId:received.atendimentoId}),{code:'functions/permission-denied'});
 await save('salvarModulosV2',{...settings(),modulos:{cardapio:false,mesas:false,retirada:false,garcom:false}});
 assert.equal((await waiter.call('criarPedidoGarcomV2',payload)).reutilizado,true);
 await assert.rejects(waiter.call('criarPedidoGarcomV2',{...payload,requestId:randomUUID()}),/desativado/);
 await save('salvarGarcomV2',{uid:waiter.uid,ativo:false});
 await assert.rejects(waiter.call('criarPedidoGarcomV2',payload),{code:'functions/permission-denied'});
 await assert.rejects(waiter.call('consultarAtendimentoGarcomV2',{slug:'config-menu'}),{code:'functions/permission-denied'});
 await assert.rejects(save('salvarGarcomV2',{uid:manager.uid,ativo:true}),/outro papel/);
 await assert.rejects(save('salvarGarcomV2',{uid:a.uid,ativo:true}),/outro papel/);
});
test('delivery em loja sem catálogo cria estrutura válida e módulos preservam o canal', async () => {
 await db.doc('catalogos_publicos_v2/config-menu').delete();
 await save('salvarConfiguracaoDeliveryV2',{delivery:{ativo:true,pedidoMinimoCentavos:0,regioes:[{id:'centro',nome:'Centro',cepInicial:'01000000',cepFinal:'01999999',taxaCentavos:0,prazoMinutos:30}]}});
 const first=await save('consultarConfiguracaoV2');assert.deepEqual(first.catalogo.produtos,[]);assert.equal(first.catalogo.publicado,false);assert.equal(first.catalogo.canais.delivery,true);
 await save('salvarModulosV2',settings());assert.equal((await save('consultarConfiguracaoV2')).catalogo.canais.delivery,true);
});

test('delivery exclusivo e horário fechado são controlados pelo servidor', async () => {
 const delivery={ativo:true,pedidoMinimoCentavos:0,regioes:[{id:'centro',nome:'Centro',cepInicial:'01000000',cepFinal:'01999999',taxaCentavos:500,prazoMinutos:30}]};
 await assert.rejects(save('salvarModulosV2',{...settings(),modulos:{cardapio:true,mesas:false,retirada:false}}),/Ative/);
 await save('salvarConfiguracaoDeliveryV2',{delivery});
 await save('salvarModulosV2',{...settings(),modulos:{cardapio:true,mesas:false,retirada:false}});
 const config=await save('consultarConfiguracaoV2');assert.deepEqual(config.catalogo.canais,{mesas:false,retirada:false,delivery:true});
 const payload={slug:'config-menu',catalogoVersao:config.catalogo.versao,cep:'01000000',itens:[{produtoId:'lanche',quantidade:1,opcoes:[]}]};
 assert.equal((await stranger.call('cotarDeliveryPublicoV2',payload)).totalCentavos,1500);
 await save('salvarConfiguracaoDeliveryV2',{delivery:{...delivery,horarios:{fuso:'America/Sao_Paulo',periodos:[]}}});
 await assert.rejects(stranger.call('cotarDeliveryPublicoV2',payload),/horário/);
 const latest=await save('consultarConfiguracaoV2');assert.equal(latest.delivery.horarios.fuso,'America/Sao_Paulo');
 await assert.rejects(stranger.call('criarPedidoPublicoV2',{...payload,requestId:randomUUID(),tipo:'delivery',entrega:{nome:'Cliente teste',telefone:'11999999999',cep:'01000000',logradouro:'Rua Teste',numero:'1',bairro:'Centro',cidade:'São Paulo',uf:'SP'},cotacao:{configuracaoVersao:latest.versao,taxaEntregaCentavos:500,totalCentavos:1500}}),/horário/);
});
test('delivery: caixa consulta endereço, avança sem KDS e recupera saída sem duplicar',async()=>{
 const pedidoId=await order({tipo:'delivery'}),ref=db.doc(`${base}/pedidos/${pedidoId}`);
 await ref.update({subtotalCentavos:2500,taxaEntregaCentavos:500,totalCentavos:3000,pagamento:'pendente'});
 const entrega={nome:'Cliente fictício',telefone:'11999999999',cep:'01000000',logradouro:'Rua Teste',numero:'1',complemento:'',bairro:'Centro',cidade:'São Paulo',uf:'SP'};
 await db.doc(`${base}/dados_entrega/${pedidoId}`).set(entrega);
 for(const c of [stranger,kitchen])await assert.rejects(c.call('consultarEntregaCaixaV2',{pedidoId}),{code:'functions/permission-denied'});
 const foreign=await client('caixa','config-b');await assert.rejects(foreign.call('consultarEntregaCaixaV2',{pedidoId}),{code:'functions/not-found'});
 assert.deepEqual((await a.call('consultarEntregaCaixaV2',{pedidoId})).entrega,entrega);
 const prepare={pedidoId,de:'novo',para:'em_preparo',requestId:randomUUID()};
 await assert.rejects(a.call('avancarEntregaV2',prepare),/recebido/);
 await a.receive(pedidoId);
 await a.call('avancarEntregaV2',prepare);
 await a.call('avancarEntregaV2',{pedidoId,de:'em_preparo',para:'pronto',requestId:randomUUID()});
 await db.doc(base).update({'cozinha.kds':true});
 await assert.rejects(kitchen.call('avancarPreparoV2',{pedidoId,de:'pronto',para:'entregue'}),/caixa/);
 await assert.rejects(a.call('avancarEntregaV2',{pedidoId,de:'pronto',para:'saiu_entrega',requestId:randomUUID()}),/responsável/);
 const dispatch={pedidoId,de:'pronto',para:'saiu_entrega',responsavel:'Entregador fictício',requestId:randomUUID()};
 const results=await Promise.all([a.call('avancarEntregaV2',dispatch),b.call('avancarEntregaV2',dispatch)]);assert.equal(results.filter(r=>r.reutilizado).length,1);
 assert.equal((await a.call('consultarEntregaCaixaV2',{pedidoId})).responsavel,dispatch.responsavel);
 assert.equal((await ref.get()).data().responsavel,undefined);
 await assert.rejects(a.call('avancarEntregaV2',{...dispatch,responsavel:'Outro'}),{code:'functions/already-exists'});
 await a.call('avancarEntregaV2',{pedidoId,de:'saiu_entrega',para:'entregue',requestId:randomUUID()});
 assert.equal((await b.call('avancarEntregaV2',dispatch)).status,'entregue');
 assert.equal((await ref.get()).data().pagamento,'pendente');
 await db.doc(`terminais_v2/${foreign.uid}`).update({ativo:false});await assert.rejects(foreign.call('consultarEntregaCaixaV2',{pedidoId}),{code:'functions/permission-denied'});
});
test('delivery: gerente configura; cotação usa preço oficial sem criar pedido ou expor CEP', async () => {
 const delivery={ativo:true,pedidoMinimoCentavos:1000,regioes:[{id:'centro',nome:'Centro',cepInicial:'01000-000',cepFinal:'01999-999',taxaCentavos:500,prazoMinutos:40}]};
 const original=await context();
 await assert.rejects(stranger.call('salvarConfiguracaoDeliveryV2',{...original,delivery}));
 await manager.call('salvarConfiguracaoDeliveryV2',{...original,delivery});
 await assert.rejects(manager.call('salvarConfiguracaoDeliveryV2',{...original,delivery}),/mudou/);
 const settings=await save('consultarConfiguracaoV2'); assert.equal(settings.delivery.regioes[0].cepInicial,'01000000');
 assert.equal(settings.catalogo.canais.delivery,true);
 const data={slug:'config-menu',catalogoVersao:1,cep:'01000000',itens:[{produtoId:'lanche',quantidade:1,opcoes:[]}],totalCentavos:1,taxaEntregaCentavos:0,lojaId:'config-b'};
 const before=(await db.collection(`${base}/pedidos`).get()).size;
 const q=await stranger.call('cotarDeliveryPublicoV2',data);
 assert.equal(q.subtotalCentavos,1000);assert.equal(q.totalCentavos,1500);assert.equal(q.somenteCotacao,true);assert.equal(q.configuracaoVersao,1);assert.equal(q.cep,undefined);
 assert.equal((await db.collection(`${base}/pedidos`).get()).size,before);
 await assert.rejects(stranger.call('cotarDeliveryPublicoV2',{...data,cep:'02000000'}),/fora/);
 await assert.rejects(stranger.call('cotarDeliveryPublicoV2',{...data,catalogoVersao:2}),/mudou/);
 await save('salvarConfiguracaoDeliveryV2',{delivery:{...delivery,pedidoMinimoCentavos:1500}});
 await assert.rejects(stranger.call('cotarDeliveryPublicoV2',data),/mínimo/);
 await save('salvarConfiguracaoDeliveryV2',{delivery:{...delivery,ativo:false}});
 await assert.rejects(stranger.call('cotarDeliveryPublicoV2',data),/indisponível/);
 await assert.rejects(stranger.call('criarPedidoPublicoV2',{...data,requestId:randomUUID(),tipo:'delivery'}),/contato e endereço/);
});
test('migração converte saldo, baixa e devolve pela ficha; repetição nunca repõe consumo',async()=>{
 const produto={id:randomUUID(),nome:'Farinha',estoque:2500,unidade:'g'},payload={...await context(),produto,confirmado:true};
 const results=await Promise.all([manager.call('migrarSaldoLegadoV2',payload),manager.call('migrarSaldoLegadoV2',payload)]);
 assert.equal(results.filter(r=>r.reutilizado).length,1);const estoqueId=results[0].estoqueId,ref=db.doc(`${base}/estoque/${estoqueId}`);
 assert.equal((await ref.get()).data().saldoMili,2500);assert.equal((await ref.get()).data().unidade,'kg');
 await save('salvarFichaEstoqueV2',{produtoId:'lanche',semEstoque:false,consumos:[{estoqueId,quantidadeMili:250}]});
 const pedido=await place('retirada'),received=await a.receive(pedido.pedidoId),account=await attendance(received.atendimentoId);
 await a.call('fecharAtendimentoV2',{atendimentoId:received.atendimentoId,versao:account.versao,pagamentos:[{forma:'dinheiro',valorCentavos:1000}],recebidoDinheiroCentavos:1000,confirmado:true});
 assert.equal((await ref.get()).data().saldoMili,2250);
 await manager.call('migrarSaldoLegadoV2',payload);assert.equal((await ref.get()).data().saldoMili,2250);
 await a.call('estornarVendaV2',{vendaId:received.atendimentoId,motivo:'Devolução de teste',confirmado:true,devolverEstoque:true});
 assert.equal((await ref.get()).data().saldoMili,2500);
 await assert.rejects(save('migrarSaldoLegadoV2',{produto:{...produto,estoque:3000},confirmado:true}),{code:'functions/failed-precondition'});
 const movimentos=await db.collection(`${base}/movimentos_estoque`).where('estoqueId','==',estoqueId).get();assert.equal(movimentos.size,1);
});
test('migração exige gerente, confirmação e unidade conhecida sem gravar saldo parcial',async()=>{
 const produto={id:randomUUID(),nome:'Teste',estoque:1,unidade:'caixa'},payload={...await context(),produto,confirmado:true};
 await assert.rejects(a.call('migrarSaldoLegadoV2',payload),{code:'functions/permission-denied'});
 await assert.rejects(manager.call('migrarSaldoLegadoV2',payload),{code:'functions/invalid-argument'});
 await assert.rejects(save('migrarSaldoLegadoV2',{produto:{...produto,unidade:'kg'},confirmado:false}),{code:'functions/failed-precondition'});
 const mappings=await db.collection(`${base}/estoque`).where('legadoId','==',produto.id).get();assert.equal(mappings.size,0);
});
const place = async tipo => stranger.call('criarPedidoPublicoV2', { slug: 'config-menu', requestId: randomUUID(), tipo, mesaId: 'public-table', catalogoVersao: (await db.doc('catalogos_publicos_v2/config-menu').get()).data().versao, itens: [{ produtoId: 'lanche', quantidade: 1, opcoes: [] }] });

test('configuração exige gerência humana e não atravessa lojas ou slug', async () => {
  const payload = await context();
  for (const c of [a, kitchen, stranger]) await assert.rejects(c.call('consultarConfiguracaoV2', payload), { code: 'functions/permission-denied' });
  await assert.rejects(manager.call('consultarConfiguracaoV2', { ...payload, lojaId: 'config-b', slug: 'config-outro' }), { code: 'functions/permission-denied' });
  await assert.rejects(manager.call('consultarConfiguracaoV2', { ...payload, slug: 'config-outro' }), { code: 'functions/permission-denied' });
  assert.equal((await save('consultarConfiguracaoV2')).nome, 'Loja de configuração');
});
test('canais são verificados no servidor; replay de pedido aceito continua recuperável após pausa', async () => {
  await db.doc(`${base}/mesas/public-table`).set({ nome: 'Mesa pública', ativo: true, comandaPdvId: 'MESA-99' });
  await save('salvarModulosV2', { ...settings(), modulos: { cardapio: true, mesas: true, retirada: false } });
  await assert.rejects(place('retirada'), { code: 'functions/failed-precondition' });
  const order = await place('mesa'); assert.ok(order.pedidoId);
  await save('salvarModulosV2', { ...settings(), modulos: { cardapio: false, mesas: false, retirada: false } });
  const paused = (await db.doc('catalogos_publicos_v2/config-menu').get()).data(); assert.equal(paused.publicado, true); assert.equal(paused.pausado, true); // acompanhamento existente pode recarregar
  await assert.rejects(place('mesa'), { code: 'functions/failed-precondition' });
  assert.ok((await a.receive(order.pedidoId)).atendimentoId); // pausa não impede atender pedidos aceitos
});
test('segmentos preservam escolhas; impressão tem terminal único e KDS é independente', async () => {
  await save('salvarModulosV2', { ...settings(true, false), segmento: 'padaria' });
  const config = await save('consultarConfiguracaoV2'); assert.equal(config.segmento, 'padaria'); assert.equal(config.cozinha.kds, false);
  const id = await order(); await a.receive(id);
  await assert.rejects(kitchen.call('reservarImpressaoCozinhaV2', { jobId: id, tentativa: randomUUID() }), { code: 'functions/permission-denied' });
  assert.equal((await a.call('reservarImpressaoCozinhaV2', { jobId: id, tentativa: randomUUID() })).autorizado, true);
  await save('salvarModulosV2', { ...settings(false, true), segmento: 'adega' });
  assert.equal((await save('consultarConfiguracaoV2')).cozinha.kds, true);
  const invalid = settings(true); invalid.cozinha.terminalUid = stranger.uid;
  await assert.rejects(save('salvarModulosV2', invalid), { code: 'functions/failed-precondition' });
});
test('edições concorrentes não sobrescrevem configuração desatualizada', async () => {
  const payload = { ...await context(), ...settings() };
  const results = await Promise.allSettled([manager.call('salvarModulosV2', payload), manager.call('salvarModulosV2', { ...payload, segmento: 'roupas' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await context()).versao, 1);
});
test('mesa tem vínculo único e não pode trocar ou desativar durante atendimento', async () => {
  const mesaId = randomUUID(); await save('salvarMesaV2', { mesaId, nome: 'Mesa 33', numero: 33, ativo: true });
  await assert.rejects(save('salvarMesaV2', { mesaId: randomUUID(), nome: 'Duplicada', numero: 33, ativo: true }), { code: 'functions/already-exists' });
  await db.doc(`${base}/mesas/${mesaId}`).update({ atendimentoId: 'conta-ativa' });
  await assert.rejects(save('salvarMesaV2', { mesaId, nome: 'Mesa 33', numero: 34, ativo: true }), { code: 'functions/failed-precondition' });
  await assert.rejects(save('salvarMesaV2', { mesaId, nome: 'Mesa 33', numero: 33, ativo: false }), { code: 'functions/failed-precondition' });
});
test('produto e adicional atualizam versão, mantêm os demais produtos e preços são do catálogo', async () => {
  await save('salvarProdutoCardapioV2', { produtoId: 'suco', nome: 'Suco', precoCentavos: 500, ativo: true, esgotado: false });
  await save('salvarOpcaoCardapioV2', { produtoId: 'lanche', grupoId: 'extras', nomeGrupo: 'Extras', min: 0, max: 2, opcaoId: 'bacon', nome: 'Bacon', precoCentavos: 250, maxQuantidade: 2, ativo: true });
  await save('salvarProdutoCardapioV2', { produtoId: 'lanche', nome: 'Lanche novo', precoCentavos: 1200, ativo: true, esgotado: false });
  const catalog = (await save('consultarConfiguracaoV2')).catalogo;
  assert.equal(catalog.versao, 4); assert.equal(catalog.produtos.length, 2); assert.equal(catalog.produtos[0].grupos[0].opcoes[0].precoCentavos, 250);
  assert.equal((await place('retirada')).totalCentavos, 1200);
});
test('ajuste de estoque é idempotente, rejeita saldo negativo e mantém unidade', async () => {
  const estoqueId = randomUUID(), payload = { estoqueId, nome: 'Bacon', unidade: 'kg', deltaMili: 1000, motivo: 'Saldo inicial', requestId: randomUUID() };
  await save('ajustarEstoqueV2', payload); assert.equal((await save('ajustarEstoqueV2', payload)).reutilizado, true);
  assert.equal((await db.doc(`${base}/estoque/${estoqueId}`).get()).data().saldoMili, 1000);
  await assert.rejects(save('ajustarEstoqueV2', { ...payload, requestId: randomUUID(), deltaMili: -1001 }), { code: 'functions/invalid-argument' });
  await assert.rejects(save('ajustarEstoqueV2', { ...payload, requestId: randomUUID(), unidade: 'un' }), { code: 'functions/failed-precondition' });
});
test('fichas exigem insumos cadastrados; base e adicional preservam mapeamentos independentes', async () => {
  await assert.rejects(save('salvarFichaEstoqueV2', { produtoId: 'lanche', semEstoque: false, consumos: [{ estoqueId: 'missing', quantidadeMili: 1000 }] }), { code: 'functions/failed-precondition' });
  await save('ajustarEstoqueV2', { estoqueId: 'insumo-ficha', nome: 'Insumo', unidade: 'un', deltaMili: 10000, motivo: 'Saldo inicial', requestId: randomUUID() });
  await save('salvarFichaEstoqueV2', { produtoId: 'lanche', semEstoque: false, consumos: [{ estoqueId: 'insumo-ficha', quantidadeMili: 1000 }] });
  await save('salvarOpcaoCardapioV2', { produtoId: 'lanche', grupoId: 'ponto', nomeGrupo: 'Ponto', min: 0, max: 1, opcaoId: 'bem', nome: 'Bem passado', precoCentavos: 0, maxQuantidade: 1, ativo: true });
  await save('salvarFichaEstoqueV2', { produtoId: 'lanche', grupoId: 'ponto', opcaoId: 'bem', semEstoque: false, consumos: [] });
  const recipe = (await db.doc(`${base}/fichas_estoque/lanche`).get()).data(); assert.equal(recipe.consumos.length, 1); assert.equal(recipe.opcoes[0].consumos.length, 0);
});


const ativacaoHomologacao = { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 1 };
test('ativação operacional é negada por padrão e não aceita autorização enviada pelo cliente', async () => {
  const result = await a.call('consultarAtivacaoOperacionalV2', { lojaId: 'config-b', ativacaoOperacionalV2: ativacaoHomologacao });
  assert.equal(result.lojaId, 'config-a');
  assert.equal(result.homologacaoHabilitada, false);
  assert.equal(result.producaoHabilitada, false);
  assert.ok(Object.values(result.modulos).every(v => v === false));
  assert.equal((await db.doc(base).get()).data().ativacaoOperacionalV2, undefined);
  for (const config of [{...ativacaoHomologacao,estado:'suspensa'}, {...ativacaoHomologacao,schema:2}, {...ativacaoHomologacao,ambiente:'producao'}, {...ativacaoHomologacao,revisao:0}]) {
    await db.doc(base).update({ativacaoOperacionalV2:config});
    assert.equal((await a.call('consultarAtivacaoOperacionalV2',{})).homologacaoHabilitada,false);
  }
});
test('ativação cruza papel, módulos e impressora designada sem autorizar produção', async () => {
  await db.doc(base).update({ativacaoOperacionalV2:ativacaoHomologacao, cozinha:{kds:true,impressao:true,terminalUid:a.uid}});
  const caixa=await a.call('consultarAtivacaoOperacionalV2',{}), outro=await b.call('consultarAtivacaoOperacionalV2',{}), cozinha=await kitchen.call('consultarAtivacaoOperacionalV2',{});
  assert.equal(caixa.homologacaoHabilitada,true);assert.equal(caixa.producaoHabilitada,false);assert.equal(caixa.revisao,1);
  assert.deepEqual(caixa.modulos,{balcao:true,mesas:true,retirada:true,combos:false,kds:true,impressao:true});
  assert.equal(outro.modulos.impressao,false);assert.equal(cozinha.modulos.balcao,false);assert.equal(cozinha.modulos.mesas,false);assert.equal(cozinha.modulos.kds,true);
  await db.doc(base).update({modulos:{mesas:false,retirada:false}});
  assert.equal((await a.call('consultarAtivacaoOperacionalV2',{})).modulos.mesas,false);
  await db.doc('lojas_v2/config-b').set({ativo:true});
  const otherShop=await client('caixa','config-b');
  assert.equal((await otherShop.call('consultarAtivacaoOperacionalV2',{lojaId:'config-a'})).homologacaoHabilitada,false);
});
test('consulta de ativação recusa estranho, gerente humano e escrita direta de autorização', async () => {
  for(const c of [stranger,manager])await assert.rejects(c.call('consultarAtivacaoOperacionalV2',{}),{code:'functions/permission-denied'});
  await assert.rejects(setDoc(doc(a.store,base),{ativacaoOperacionalV2:ativacaoHomologacao},{merge:true}),{code:'permission-denied'});
});
test('consulta de ativação revalida terminal, membro, papel e loja em cada chamada', async () => {
  const terminal=await client('caixa');
  await db.doc(base).update({ativacaoOperacionalV2:ativacaoHomologacao});
  assert.equal((await terminal.call('consultarAtivacaoOperacionalV2',{})).homologacaoHabilitada,true);
  await db.doc('terminais_v2/'+terminal.uid).update({ativo:false});
  await assert.rejects(terminal.call('consultarAtivacaoOperacionalV2',{}),{code:'functions/permission-denied'});
  await db.doc('terminais_v2/'+terminal.uid).update({ativo:true});
  for(const patch of [{ativo:false},{ativo:true,tipo:'usuario'},{tipo:'terminal',papel:'cozinha'}]){
    await db.doc(base+'/membros/'+terminal.uid).update(patch);
    await assert.rejects(terminal.call('consultarAtivacaoOperacionalV2',{}),{code:'functions/permission-denied'});
  }
  await db.doc(base+'/membros/'+terminal.uid).update({ativo:true,tipo:'terminal',papel:'caixa'});
  await db.doc(base).update({ativo:false});
  await assert.rejects(terminal.call('consultarAtivacaoOperacionalV2',{}),{code:'functions/permission-denied'});
  await db.doc(base).update({ativo:true});
  await admin.auth().updateUser(terminal.uid,{disabled:true});
  await assert.rejects(terminal.call('consultarAtivacaoOperacionalV2',{}),{code:'functions/permission-denied'});
});


const changeActivation = (patch={}) => ({lojaId:'config-a',requestId:randomUUID(),estado:'habilitada',ambiente:'homologacao',revisaoEsperada:0,motivo:'Homologação controlada',confirmado:true,...patch});
test('administração da ativação exige gerente da loja, confirmação e ambiente de homologação',async()=>{
  const payload=changeActivation();
  for(const actor of [a,kitchen,stranger])await assert.rejects(actor.call('alterarAtivacaoOperacionalV2',payload),{code:'functions/permission-denied'});
  await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',{...payload,lojaId:'config-b'}),{code:'functions/permission-denied'});
  for(const patch of [{ambiente:'producao'},{revisaoEsperada:-1},{estado:'qualquer'},{motivo:'x'},{requestId:'a/b'}])await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',{...payload,...patch}),{code:'functions/invalid-argument'});
  await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',{...payload,confirmado:false}),{code:'functions/failed-precondition'});
  assert.equal((await db.doc(base).get()).data().ativacaoOperacionalV2,undefined);
});
test('ativar e suspender registram auditoria única e preservam os dados operacionais',async()=>{
  const pendingRef=db.doc(base+'/vendas/pendencia-'+randomUUID()),pending={status:'pendente',totalCentavos:1700};await pendingRef.set(pending);
  const enable=changeActivation();const first=await manager.call('alterarAtivacaoOperacionalV2',enable);
  assert.equal(first.revisao,1);assert.equal(first.producaoHabilitada,false);
  assert.equal((await a.call('consultarAtivacaoOperacionalV2',{})).homologacaoHabilitada,true);
  const suspend=changeActivation({estado:'suspensa',revisaoEsperada:1,motivo:'Pausa para revisão'});
  const results=await Promise.all([manager.call('alterarAtivacaoOperacionalV2',suspend),manager.call('alterarAtivacaoOperacionalV2',suspend)]);
  assert.equal(results.filter(r=>r.reutilizado).length,1);
  assert.equal((await a.call('consultarAtivacaoOperacionalV2',{})).homologacaoHabilitada,false);
  assert.deepEqual((await pendingRef.get()).data(),pending);
  assert.equal((await db.doc(base).get()).data().modulos.mesas,true);
  const audit=await db.collection('auditoria_ativacao_v2').where('requestId','==',suspend.requestId).get();assert.equal(audit.size,1);
  assert.equal(audit.docs[0].data().atorUid,manager.uid);assert.equal(audit.docs[0].data().anterior.estado,'habilitada');assert.equal(audit.docs[0].data().atual.estado,'suspensa');
  const replay=await manager.call('alterarAtivacaoOperacionalV2',enable);assert.equal(replay.reutilizado,true);assert.equal(replay.revisao,1);
  assert.equal((await db.doc(base).get()).data().ativacaoOperacionalV2.estado,'suspensa');
  await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',{...suspend,motivo:'Outro motivo de suspensão'}),{code:'functions/already-exists'});
});
test('alterações concorrentes com a mesma revisão não sobrescrevem a vencedora',async()=>{
  const results=await Promise.allSettled([manager.call('alterarAtivacaoOperacionalV2',changeActivation()),manager.call('alterarAtivacaoOperacionalV2',changeActivation({estado:'suspensa'}))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'functions/failed-precondition');
  assert.equal((await db.doc(base).get()).data().ativacaoOperacionalV2.revisao,1);
  await db.doc(base).update({ativacaoOperacionalV2:{schema:2,estado:'habilitada',ambiente:'homologacao',revisao:1}});
  await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',changeActivation({revisaoEsperada:1})),{code:'functions/failed-precondition'});
});
test('gerência revogada não pode repetir comando já aceito nem gravar auditoria pelo cliente',async()=>{
  const payload=changeActivation();await manager.call('alterarAtivacaoOperacionalV2',payload);
  await db.doc(base+'/membros/'+manager.uid).update({ativo:false});
  try{await assert.rejects(manager.call('alterarAtivacaoOperacionalV2',payload),{code:'functions/permission-denied'});}finally{await db.doc(base+'/membros/'+manager.uid).update({ativo:true});}
  await assert.rejects(setDoc(doc(a.store,'auditoria_ativacao_v2/falsa'),{atorUid:a.uid}),{code:'permission-denied'});
  await assert.rejects(setDoc(doc(a.store,base+'/operacoes_ativacao/falsa'),{resultado:{revisao:1}}),{code:'permission-denied'});
});

test('pedido público suspenso bloqueia envio novo mas recupera resposta perdida',async()=>{
 const payload={slug:'config-menu',requestId:randomUUID(),tipo:'retirada',catalogoVersao:1,itens:[{produtoId:'lanche',quantidade:1,opcoes:[]}]};
 const original=await stranger.call('criarPedidoPublicoV2',payload);
 await manager.call('alterarAtivacaoOperacionalV2',changeActivation({estado:'suspensa'}));
 const before=(await db.collection(base+'/pedidos').get()).size;
 const retry=await stranger.call('criarPedidoPublicoV2',payload);assert.equal(retry.pedidoId,original.pedidoId);assert.equal(retry.reutilizado,true);
 await assert.rejects(stranger.call('criarPedidoPublicoV2',{...payload,requestId:randomUUID()}),{code:'functions/failed-precondition'});
 assert.equal((await db.collection(base+'/pedidos').get()).size,before);
 await manager.call('alterarAtivacaoOperacionalV2',changeActivation({revisaoEsperada:1}));
 assert.equal((await stranger.call('criarPedidoPublicoV2',{...payload,requestId:randomUUID()})).reutilizado,false);
});
