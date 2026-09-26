const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const admin = require('../functions/node_modules/firebase-admin');
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously, signInWithCustomToken } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
const { getFirestore, connectFirestoreEmulator, getDocFromServer, setDoc, doc, setLogLevel } = local('firebase/firestore');
const apps = []; let db, a, b, kitchen, stranger;
const isolated = process.env.FLOWPDV_COMBOS_ISOLADO === '1';
const ports = isolated ? { auth: 9199, firestore: 8180, functions: 5101 } : { auth: 9099, firestore: 8080, functions: 5001 };
async function client(role, lojaId = 'fechamento-a') {
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
const base = 'lojas_v2/fechamento-a';
async function order({ tipo = 'mesa', mapped = true, mesaId = randomUUID(), status = 'novo' } = {}) {
  const id = randomUUID();
  if (tipo === 'mesa') await db.doc(`${base}/mesas/${mesaId}`).set({ ativo: true, nome: 'Mesa 7', ...(mapped ? { comandaPdvId: 'MESA-7' } : {}) }, { merge: true });
  await db.doc(`${base}/pedidos/${id}`).set({ tipo, mesaId: tipo === 'mesa' ? mesaId : null, mesaNome: tipo === 'mesa' ? 'Mesa 7' : null, recebidoPdv: false, status, totalCentavos: 2500, itens: [
    { linhaId: randomUUID(), produtoId: 'lanche', nome: 'Lanche', quantidade: 2, precoUnitarioCentavos: 1250, totalCentavos: 2500, observacao: 'Sem cebola', opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', nome: 'Bacon', quantidade: 1, precoCentavos: 250 }] }
  ] });
  return id;
}
const attendance = async id => (await db.doc(`${base}/atendimentos/${id}`).get()).data();
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, `127.0.0.1:${ports.firestore}`);
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, `127.0.0.1:${ports.auth}`);
  admin.initializeApp({ projectId: 'demo-flowpdv' }); db = admin.firestore(); setLogLevel('silent');
  await db.doc(base).set({ ativo: true }); await db.doc('lojas_v2/fechamento-b').set({ ativo: true });
  a = await client('caixa'); b = await client('caixa'); kitchen = await client('cozinha'); stranger = await client();
});
after(async () => { await Promise.all(apps.map(deleteApp)); await admin.app().delete(); });
beforeEach(async () => {
  await db.doc(base).update({ ativacaoOperacionalV2: admin.firestore.FieldValue.delete(), caixaV2: { exigirTurno: false }, cozinha: { impressao: true, kds: true } });
  await db.doc(`${base}/fichas_estoque/lanche`).set({ consumos: [{ estoqueId: 'lanche', quantidadeMili: 1000 }], opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', consumos: [{ estoqueId: 'bacon', quantidadeMili: 200 }] }] });
  for (const stockId of ['lanche', 'bacon']) await db.doc(`${base}/estoque/${stockId}`).set({ saldoMili: 10000 });
});
const balance = async stockId => (await db.doc(`${base}/estoque/${stockId}`).get()).data().saldoMili;
async function ready(options) { const pedidoId = await order(options); const received = await a.receive(pedidoId); return { pedidoId, atendimentoId: received.atendimentoId }; }
async function payment(atendimentoId) { const account = await attendance(atendimentoId); return { atendimentoId, versao: account.versao, pagamentos: account.totalCentavos ? [{ forma: 'dinheiro', valorCentavos: account.totalCentavos }] : [], confirmado: true }; }
const close = (c, data) => c.call('fecharAtendimentoV2', data);
const cancel = (c, pedidoId) => c.call('cancelarPedidoV2', { pedidoId, motivo: 'Cliente desistiu do pedido' });
const refund = (c, vendaId, devolverEstoque = true) => c.call('estornarVendaV2', { vendaId, devolverEstoque, motivo: 'Devolução conferida no teste', confirmado: true });

async function pedidoCombo() {
  const pedidoId = await order({ tipo: 'retirada' });
  const ref = db.doc(`${base}/pedidos/${pedidoId}`), pedido = (await ref.get()).data();
  const linha = { ...pedido.itens[0], variante: 'combo', ofertasVersao: 1, bebidaId: 'bebida', componentes: [
    { produtoId: 'lanche', nome: 'Lanche', quantidade: 1 },
    { produtoId: 'batata', nome: 'Batata', quantidade: 2 },
    { produtoId: 'bebida', nome: 'Bebida', quantidade: 1 }
  ] };
  await ref.update({ itens: [linha] });
  for (const produtoId of ['batata', 'bebida']) {
    await db.doc(`${base}/fichas_estoque/${produtoId}`).set({ consumos: [{ estoqueId: produtoId, quantidadeMili: 1000 }] });
    await db.doc(`${base}/estoque/${produtoId}`).set({ saldoMili: 10000 });
  }
  return pedidoId;
}

test('combo: recebimento e fechamento concorrentes baixam componentes uma vez; estorno usa retrato da venda', async () => {
  const pedidoId = await pedidoCombo();
  const recebidos = await Promise.all([a.receive(pedidoId), b.receive(pedidoId)]);
  assert.equal(recebidos.filter(r => !r.reutilizado).length, 1);
  const atendimentoId = recebidos[0].atendimentoId, data = await payment(atendimentoId);
  const fechados = await Promise.all([close(a, data), close(b, data)]);
  assert.equal(fechados.filter(r => !r.reutilizado).length, 1);
  assert.equal(await balance('lanche'), 8000);
  assert.equal(await balance('bacon'), 9600);
  assert.equal(await balance('batata'), 6000);
  assert.equal(await balance('bebida'), 8000);
  await db.doc(`${base}/fichas_estoque/batata`).set({ consumos: [] });
  assert.equal((await refund(a, atendimentoId)).reutilizado, false);
  assert.equal((await refund(b, atendimentoId)).reutilizado, true);
  for (const produtoId of ['lanche', 'bacon', 'batata', 'bebida']) assert.equal(await balance(produtoId), 10000);
});

test('combo: falta de estoque ou ficha impede toda a venda, e cancelamento antes de pagar não movimenta estoque', async () => {
  const pedidoId = await pedidoCombo(), { atendimentoId } = await a.receive(pedidoId), data = await payment(atendimentoId);
  await db.doc(`${base}/estoque/bebida`).update({ saldoMili: 1000 });
  await assert.rejects(close(a, data), /Estoque insuficiente/);
  assert.equal(await balance('batata'), 10000);
  assert.equal((await db.doc(`${base}/vendas/${atendimentoId}`).get()).exists, false);
  await db.doc(`${base}/fichas_estoque/batata`).delete();
  await assert.rejects(close(a, data), /ficha de estoque/);
  await cancel(a, pedidoId);
  assert.equal(await balance('lanche'), 10000);
  assert.equal(await balance('bebida'), 1000);
});

test('combo: componente sem controle de estoque não elimina a baixa dos demais', async () => {
  const pedidoId = await pedidoCombo();
  await db.doc(`${base}/fichas_estoque/lanche`).set({ semEstoque: true });
  const { atendimentoId } = await a.receive(pedidoId);
  await close(a, await payment(atendimentoId));
  assert.equal(await balance('lanche'), 10000);
  assert.equal(await balance('batata'), 6000);
  assert.equal(await balance('bebida'), 8000);
});

test('combo: catálogo publicado cria pedido com promoção e adicional, imprime inclusos, fecha e estorna', async t => {
  const { publicarOferta } = await import('../functions/ofertas-core.mjs');
  const produtos = [{ id: 'lanche', nome: 'Lanche', precoVenda: 18.9, ofertaCardapio: {
    precoPromocional: 16.9, combo: { ativo: true, preco: 30.9, precoPromocional: 27.9,
      fixos: [{ produtoId: 'batata', quantidade: 2 }], bebidas: ['bebida'] }
  } }, { id: 'batata', nome: 'Batata' }, { id: 'bebida', nome: 'Refrigerante', precoVenda: 6 }];
  const oferta = publicarOferta(produtos[0], { promocao: true }, produtos, { combos: true });
  await db.doc(base).update({ modulos: { cardapio: true, retirada: true, mesas: true, combos: true } });
  t.after(() => db.doc(base).update({ modulos: admin.firestore.FieldValue.delete() }));
  await db.doc('rotas_publicas_v2/combo-fechamento').set({ lojaId: 'fechamento-a' });
  const catalogRef = db.doc('catalogos_publicos_v2/combo-fechamento');
  const product = { id: 'lanche', nome: 'Lanche', ativo: true, precoCentavos: 1890, ...oferta,
    grupos: [{ id: 'extras', nome: 'Adicionais', min: 0, max: 1, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 1 }] }] };
  await catalogRef.set({ publicado: true, pausado: false, versao: 1, produtos: [product] });
  for (const produtoId of ['batata', 'bebida']) {
    await db.doc(`${base}/fichas_estoque/${produtoId}`).set({ consumos: [{ estoqueId: produtoId, quantidadeMili: 1000 }] });
    await db.doc(`${base}/estoque/${produtoId}`).set({ saldoMili: 10000 });
  }
  const input = { slug: 'combo-fechamento', requestId: randomUUID(), tipo: 'retirada', catalogoVersao: 1,
    itens: [{ produtoId: 'lanche', quantidade: 2, variante: 'combo', bebidaId: 'bebida', precoEsperadoCentavos: 3040,
      opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', quantidade: 1 }] }] };
  const result = await stranger.call('criarPedidoPublicoV2', input);
  assert.equal(result.totalCentavos, 6080);
  assert.equal(await balance('bebida'), 10000); // Criação não infere pagamento nem baixa.
  const orderRef = db.doc(`${base}/pedidos/${result.pedidoId}`);
  const order = (await orderRef.get()).data();
  assert.equal(order.itens[0].promocaoAplicada, true);
  assert.equal(order.itens[0].componentes.at(-1).nome, 'Refrigerante');
  const { atendimentoId } = await a.receive(result.pedidoId);
  const job = await a.call('reservarImpressaoCozinhaV2', { jobId: result.pedidoId, tentativa: randomUUID() });
  assert.equal(job.pedido.itens[0].componentes.at(-1).nome, 'Refrigerante');
  await close(a, await payment(atendimentoId));
  assert.equal(await balance('batata'), 6000);
  assert.equal(await balance('bebida'), 8000);
  assert.equal(await balance('bacon'), 9600);
  await refund(a, atendimentoId);
  assert.equal(await balance('bebida'), 10000);
  // Revogar impede pedido novo, mas não transforma um reenvio em outra cobrança.
  await db.doc(base).update({ 'modulos.combos': false });
  assert.equal((await stranger.call('criarPedidoPublicoV2', input)).reutilizado, true);
  await assert.rejects(stranger.call('criarPedidoPublicoV2', { ...input, requestId: randomUUID() }), /combo/i);
  await db.doc(base).update({ 'modulos.combos': true });
  await catalogRef.update({ produtos: [{ ...product, promocao: { ativa: true, fim: '2020-01-01T00:00:00.000Z' } }] });
  await assert.rejects(stranger.call('criarPedidoPublicoV2', { ...input, requestId: randomUUID() }), /preço mudou/);
  const revised = structuredClone(input); revised.requestId = randomUUID(); revised.itens[0].precoEsperadoCentavos = 3340;
  assert.equal((await stranger.call('criarPedidoPublicoV2', revised)).totalCentavos, 6680);
});

test('delivery recebe taxa uma vez, fecha com troco e estorna sem criar estoque para frete',async()=>{
 // Pedido semeado: envio público de delivery permanece indisponível nesta etapa.
 const pedidoId=await order({tipo:'delivery'});
 await db.doc(`${base}/pedidos/${pedidoId}`).update({taxaEntregaCentavos:500,totalCentavos:3000});
 const recebidos=await Promise.all([a.receive(pedidoId),b.receive(pedidoId)]);
 assert.equal(recebidos.filter(r=>!r.reutilizado).length,1);
 const atendimentoId=recebidos[0].atendimentoId,account=await attendance(atendimentoId);
 assert.equal(account.tipo,'delivery');assert.equal(account.taxaEntregaCentavos,500);assert.equal(account.itens.length,1);assert.equal(account.totalCentavos,3000);
 const turno={id:'DELIVERY-'+randomUUID(),terminalId:'TERM-A',dataAbertura:new Date().toISOString()};
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 await a.call('abrirTurnoCaixaV2',{turno,trocoInicialCentavos:0});
 const data={...await payment(atendimentoId),turno,recebidoDinheiroCentavos:5000};
 const pago=await close(a,data);assert.equal(pago.trocoCentavos,2000);assert.equal((await close(a,data)).reutilizado,true);
 assert.equal(await balance('lanche'),8000);assert.equal(await balance('bacon'),9600);
 const venda=(await db.doc(`${base}/vendas/${atendimentoId}`).get()).data();assert.equal(venda.taxaEntregaCentavos,500);assert.equal(venda.consumos.length,2);
 const estorno={vendaId:atendimentoId,turno,devolverEstoque:true,motivo:'Devolução integral do delivery',confirmado:true};
 await a.call('estornarVendaV2',estorno);assert.equal((await a.call('estornarVendaV2',estorno)).reutilizado,true);assert.equal(await balance('lanche'),10000);
 const state=(await a.call('consultarTurnoCaixaV2',{turno})).turno;
 await a.call('encerrarTurnoCaixaV2',{turno,confirmado:true,revisao:state.revisao,dinheiroContadoCentavos:0});
 const resumo=await a.call('obterResumoFechadoTurnoV2',{turno});assert.equal(resumo.totalCentavos,0);
 assert.deepEqual(resumo.detalhes.map(d=>d.taxaEntregaCentavos).sort((x,y)=>x-y),[-500,500]);
});

test('delivery cancelado remove a taxa; taxa ausente ou divergente impede receber/fechar',async()=>{
 const pedidoId=await order({tipo:'delivery'});await assert.rejects(a.receive(pedidoId),/Taxa/);
 await db.doc(`${base}/pedidos/${pedidoId}`).update({taxaEntregaCentavos:500,totalCentavos:3000});
 const {atendimentoId}=await a.receive(pedidoId);
 await db.doc(`${base}/atendimentos/${atendimentoId}`).update({taxaEntregaCentavos:600,totalCentavos:3100});
 await assert.rejects(close(a,await payment(atendimentoId)),/diverge/);assert.equal(await balance('lanche'),10000);
 await cancel(a,pedidoId);assert.equal((await attendance(atendimentoId)).totalCentavos,0);assert.equal((await attendance(atendimentoId)).taxaEntregaCentavos,0);
});

test('dois caixas fecham uma vez: venda, pagamento, troco e estoque são atômicos', async () => {
  const r = await ready(), data = { ...await payment(r.atendimentoId), recebidoDinheiroCentavos: 3000 };
  const results = await Promise.all([close(a, data), close(b, data)]);
  assert.equal(results.filter(v => !v.reutilizado).length, 1); assert.equal(results[0].trocoCentavos, 500);
  assert.equal(await balance('lanche'), 8000); assert.equal(await balance('bacon'), 9600);
  assert.equal((await close(a, data)).reutilizado, true);
  for (const name of ['vendas', 'movimentos_financeiros', 'movimentos_estoque']) assert.ok((await db.doc(`${base}/${name}/${r.atendimentoId}`).get()).exists);
  assert.equal((await attendance(r.atendimentoId)).status, 'fechado');
  const order = (await db.doc(`${base}/pedidos/${r.pedidoId}`).get()).data(); assert.equal(order.pagamento, 'pago');
  const table = (await db.doc(`${base}/mesas/${order.mesaId}`).get()).data(); assert.equal(table.atendimentoId, undefined); assert.equal(table.ciclo, 2);
});
test('total adulterado, pagamento insuficiente ou conta alterada não geram baixa parcial', async () => {
  const mesaId = randomUUID(), r = await ready({ mesaId }), data = await payment(r.atendimentoId);
  await assert.rejects(close(a, { ...data, pagamentos: [{ forma: 'pix_manual', valorCentavos: 1 }] }), { code: 'functions/failed-precondition' });
  await assert.rejects(close(a, { ...data, confirmado: false }), { code: 'functions/failed-precondition' });
  await ready({ mesaId });
  await assert.rejects(close(a, data), { code: 'functions/failed-precondition' });
  assert.equal(await balance('lanche'), 10000); assert.equal((await db.doc(`${base}/vendas/${r.atendimentoId}`).get()).exists, false);
});
test('ficha ausente, adicional sem mapeamento e saldo insuficiente bloqueiam toda a venda', async () => {
  const r = await ready(), data = await payment(r.atendimentoId);
  await db.doc(`${base}/estoque/bacon`).update({ saldoMili: 1 });
  await assert.rejects(close(a, data), { code: 'functions/failed-precondition' });
  assert.equal(await balance('lanche'), 10000);
  await db.doc(`${base}/fichas_estoque/lanche`).update({ opcoes: [] });
  await assert.rejects(close(a, data), { code: 'functions/failed-precondition' });
  await db.doc(`${base}/fichas_estoque/lanche`).delete();
  await assert.rejects(close(a, data), { code: 'functions/failed-precondition' });
  assert.equal((await db.doc(`${base}/vendas/${r.atendimentoId}`).get()).exists, false);
});
test('duas contas disputam o último estoque sem saldo negativo', async () => {
  const one = await ready(), two = await ready(); await db.doc(`${base}/estoque/lanche`).update({ saldoMili: 3000 });
  const results = await Promise.allSettled([close(a, await payment(one.atendimentoId)), close(b, await payment(two.atendimentoId))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(await balance('lanche'), 1000);
});
test('pagamento dividido e troco usam centavos inteiros', async () => {
  const r = await ready(); const data = { ...await payment(r.atendimentoId), pagamentos: [{ forma: 'dinheiro', valorCentavos: 1000 }, { forma: 'pix_manual', valorCentavos: 1500 }], recebidoDinheiroCentavos: 2000 };
  assert.equal((await close(a, data)).trocoCentavos, 1000);
  await assert.rejects(close(a, { ...data, pagamentos: [{ forma: 'cartao_manual', valorCentavos: 2500 }], recebidoDinheiroCentavos: 0 }), { code: 'functions/already-exists' });
});
test('cancelar pedido recebido retira linhas, preserva estoque e avisa cozinha e impressão', async () => {
  const r = await ready(); await cancel(a, r.pedidoId); assert.equal((await cancel(b, r.pedidoId)).reutilizado, true);
  const account = await attendance(r.atendimentoId); assert.equal(account.itens.length, 0); assert.equal(account.totalCentavos, 0);
  assert.equal(await balance('lanche'), 10000);
  const noticeId = `cancelamento-${r.pedidoId}`;
  assert.ok((await db.doc(`${base}/avisos_cozinha/${noticeId}`).get()).exists);
  const ticket = await kitchen.call('reservarImpressaoCozinhaV2', { jobId: `cancel-${r.pedidoId}`, tentativa: randomUUID() });
  assert.equal(ticket.autorizado, true); assert.ok(ticket.pedido.avisoCancelamento);
  await kitchen.call('confirmarAvisoCozinhaV2', { avisoId: noticeId });
  assert.equal((await db.doc(`${base}/avisos_cozinha/${noticeId}`).get()).data().status, 'confirmado');
  assert.equal((await close(a, await payment(r.atendimentoId))).totalCentavos, 0);
});
test('cancelamento concorrente com fechamento mantém uma decisão financeira consistente', async () => {
  const r = await ready(); const results = await Promise.allSettled([cancel(a, r.pedidoId), close(b, await payment(r.atendimentoId))]);
  assert.equal(results.filter(v => v.status === 'fulfilled').length, 1);
  const paid = (await db.doc(`${base}/vendas/${r.atendimentoId}`).get()).exists;
  assert.equal(await balance('lanche'), paid ? 8000 : 10000);
  const p = (await db.doc(`${base}/pedidos/${r.pedidoId}`).get()).data(); assert.equal(p.status === 'cancelado', !paid);
});
test('estorno repetido devolve estoque só uma vez e não reabre mesa de outro cliente', async () => {
  const mesaId = randomUUID(), r = await ready({ mesaId }); await close(a, await payment(r.atendimentoId));
  const next = await ready({ mesaId });
  const results = await Promise.all([refund(a, r.atendimentoId), refund(b, r.atendimentoId)]);
  assert.equal(results.filter(v => !v.reutilizado).length, 1); assert.equal(await balance('lanche'), 10000); assert.equal(await balance('bacon'), 10000);
  assert.equal((await db.doc(`${base}/mesas/${mesaId}`).get()).data().atendimentoId, next.atendimentoId);
  await assert.rejects(cancel(a, r.pedidoId), { code: 'functions/failed-precondition' });
  assert.equal((await db.doc(`${base}/movimentos_financeiros/estorno-${r.atendimentoId}`).get()).data().totalCentavos, -2500);
});
test('estorno sem reposição conserva consumo e rejeita mudar a decisão em replay', async () => {
  const r = await ready(); await close(a, await payment(r.atendimentoId)); await refund(a, r.atendimentoId, false);
  assert.equal(await balance('lanche'), 8000);
  await assert.rejects(refund(a, r.atendimentoId, true), { code: 'functions/already-exists' });
});
test('delivery cancelado antes do recebimento não gera conta, venda, estoque ou impressão de preparo', async () => {
  const pedidoId=await order({tipo:'delivery'});
  await db.doc(`${base}/pedidos/${pedidoId}`).update({taxaEntregaCentavos:500,totalCentavos:3000,pagamento:'pendente'});
  const vendasAntes=(await db.collection(`${base}/vendas`).get()).size;
  assert.equal((await cancel(a,pedidoId)).reutilizado,false);
  assert.equal((await cancel(b,pedidoId)).reutilizado,true);
  await a.receive(pedidoId);
  const pedido=(await db.doc(`${base}/pedidos/${pedidoId}`).get()).data();
  assert.equal(pedido.status,'cancelado');assert.equal(pedido.ignoradoPdv,true);assert.ok(!pedido.atendimentoId);
  assert.equal(await balance('lanche'),10000);
  assert.equal((await db.collection(`${base}/vendas`).get()).size,vendasAntes);
  assert.equal((await db.collection(`${base}/impressoes_cozinha`).where('pedidoId','==',pedidoId).get()).size,0);
  assert.equal((await db.collection(`${base}/avisos_cozinha`).where('pedidoId','==',pedidoId).get()).size,1);
});

test('pedido público pendente bloqueia mesa; cancelar libera contador sem dupla baixa', async () => {
  const mesaId = randomUUID(), r = await ready({ mesaId });
  await db.doc('rotas_publicas_v2/fechamento-test').set({ lojaId: 'fechamento-a' });
  await db.doc('catalogos_publicos_v2/fechamento-test').set({ publicado: true, versao: 1, produtos: [{ id: 'lanche', nome: 'Lanche', ativo: true, precoCentavos: 1000, grupos: [] }] });
  const pending = await stranger.call('criarPedidoPublicoV2', { slug: 'fechamento-test', tipo: 'mesa', mesaId, requestId: randomUUID(), catalogoVersao: 1, itens: [{ produtoId: 'lanche', quantidade: 1, opcoes: [] }] });
  assert.equal((await db.doc(`${base}/mesas/${mesaId}`).get()).data().pendentesRecebimento, 1);
  await assert.rejects(close(a, await payment(r.atendimentoId)), { code: 'functions/failed-precondition' });
  await cancel(a, pending.pedidoId); await cancel(a, pending.pedidoId);
  assert.equal((await db.doc(`${base}/mesas/${mesaId}`).get()).data().pendentesRecebimento, 0);
  await close(a, await payment(r.atendimentoId));
});
test('papel, loja, revogação e escritas diretas protegem financeiro e estoque', async () => {
  const r = await ready(), data = await payment(r.atendimentoId), other = await client('caixa', 'fechamento-b');
  for (const c of [kitchen, stranger]) await assert.rejects(close(c, data), { code: 'functions/permission-denied' });
  await assert.rejects(close(other, data), { code: 'functions/failed-precondition' });
  await close(a, data);
  for (const p of [`vendas/${r.atendimentoId}`, `estoque/lanche`, `movimentos_financeiros/${r.atendimentoId}`]) {
    assert.ok((await getDocFromServer(doc(a.store, `${base}/${p}`))).exists());
    await assert.rejects(getDocFromServer(doc(kitchen.store, `${base}/${p}`)), { code: 'permission-denied' });
    await assert.rejects(getDocFromServer(doc(other.store, `${base}/${p}`)), { code: 'permission-denied' });
    await assert.rejects(setDoc(doc(a.store, `${base}/${p}`), { adulterado: true }, { merge: true }), { code: 'permission-denied' });
  }
  const revoked = await client('caixa'); await db.doc(`terminais_v2/${revoked.uid}`).update({ ativo: false });
  await assert.rejects(refund(revoked, r.atendimentoId), { code: 'functions/permission-denied' });
});

test('turno fica vinculado uma vez; consulta separa terminal e estorno posterior', async () => {
  const r = await ready(), turno = { id:'TRN-UM', terminalId:'TERM-UM', dataAbertura:'2026-09-21T10:00:00.000Z' };
  const data = { ...await payment(r.atendimentoId), turno };
  await close(a,data); await close(a,data);
  const one = await a.call('consultarMovimentosTurnoV2',{turno});
  assert.equal(one.movimentos.length,1); assert.equal(one.movimentos[0].totalCentavos,2500);
  assert.equal((await b.call('consultarMovimentosTurnoV2',{turno})).movimentos.length,0);
  const turnoDepois = {...turno,id:'TRN-DOIS'};
  await a.call('estornarVendaV2',{vendaId:r.atendimentoId,turno:turnoDepois,confirmado:true,devolverEstoque:true,motivo:'Devolucao em outro turno'});
  await a.call('estornarVendaV2',{vendaId:r.atendimentoId,turno:turnoDepois,confirmado:true,devolverEstoque:true,motivo:'Reenvio apos perda de resposta'});
  const before = await a.call('consultarMovimentosTurnoV2',{turno});
  const after = await a.call('consultarMovimentosTurnoV2',{turno:turnoDepois});
  assert.equal(before.movimentos.length,1); assert.equal(before.movimentos[0].totalCentavos,2500);
  assert.equal(after.movimentos.length,1); assert.equal(after.movimentos[0].totalCentavos,-2500);
  assert.deepEqual(after.movimentos[0].pagamentos,[{forma:'dinheiro',valorCentavos:2500}]);
  assert.equal(await balance('lanche'),10000);
});

test('referência inválida não fecha conta e relatório exige caixa autorizado', async () => {
  const r = await ready(), data=await payment(r.atendimentoId);
  await assert.rejects(close(a,{...data,turno:{id:'../invasao'}}),{code:'functions/invalid-argument'});
  assert.equal(await balance('lanche'),10000);
  const turno={id:'TRN-SEGURANCA',terminalId:'TERM-TESTE',dataAbertura:'2026-09-21T10:00:00Z'};
  await assert.rejects(kitchen.call('consultarMovimentosTurnoV2',{turno}),{code:'functions/permission-denied'});
  await assert.rejects(stranger.call('consultarMovimentosTurnoV2',{turno}),{code:'functions/permission-denied'});
});

test('conferência não apresenta relatório truncado acima de 500 movimentos', async () => {
  const turno={id:'TRN-LIMITE',terminalId:'TERM-LIMITE',dataAbertura:'2026-09-21T10:00:00Z'};
  const {referenciaTurno}=require('../functions/turno-referencia-v2');
  const reference=referenciaTurno(turno,a.uid);
  for(let start=0;start<501;start+=250){
    const batch=db.batch();
    for(let i=start;i<Math.min(start+250,501);i++) batch.set(db.doc(`${base}/movimentos_financeiros/limite-${i}`),{turno:reference,tipo:'recebimento_manual',totalCentavos:1,pagamentos:[{forma:'dinheiro',valorCentavos:1}]});
    await batch.commit();
  }
  await assert.rejects(a.call('consultarMovimentosTurnoV2',{turno}),{code:'functions/resource-exhausted'});
});

const turnRef = suffix => ({id:`TRN-SERVER-${suffix}`,terminalId:'TERM-SERVER',dataAbertura:'2026-09-21T10:00:00.000Z'});
async function localStock(suffix,saldoMili=2500){
 const legadoId=`local-${suffix}`,estoqueId=`stock-${suffix}`,hash=require('node:crypto').createHash('sha256').update(legadoId).digest('hex');
 await db.doc(`${base}/migracoes_estoque/${hash}`).set({estoqueId,plano:{legadoId,nome:'Farinha',unidadeOrigem:'g',unidade:'kg'}});
 await db.doc(`${base}/estoque/${estoqueId}`).set({unidade:'kg',saldoMili});return {legadoId,estoqueId};
}
test('baixa local idempotente trava encerramento até confirmar gravação e não duplica receita financeira',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});const turno=turnRef('LOCAL'),stock=await localStock('local');await openTurn(turno);
 const payload={vendaId:'VL-IDEMPOTENTE',turno,confirmado:true,itens:[{legadoId:stock.legadoId,quantidade:'250',precoUnitarioCentavos:2}],totalCentavos:500};
 const results=await Promise.all([a.call('registrarBaixaVendaLocalV2',payload),a.call('registrarBaixaVendaLocalV2',payload)]);
 assert.equal(results.filter(r=>r.reutilizado).length,1);assert.equal(await balance(stock.estoqueId),2250);
 let state=await readTurn(turno);assert.equal(state.baixasLocaisPendentes,1);assert.equal(state.totalCentavos,0);assert.equal(state.movimentos,0);
 await assert.rejects(endTurn(turno,state.revisao),{code:'functions/failed-precondition'});
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,totalCentavos:1000,itens:[{...payload.itens[0],quantidade:'500'}]}),{code:'functions/failed-precondition'});
 const ack={vendaId:payload.vendaId,reciboId:results[0].reciboId};
 await assert.rejects(b.call('confirmarGravacaoVendaLocalV2',ack),{code:'functions/failed-precondition'});
 await a.call('confirmarGravacaoVendaLocalV2',ack);assert.equal((await a.call('confirmarGravacaoVendaLocalV2',ack)).reutilizado,true);
 state=await readTurn(turno);await endTurn(turno,state.revisao);assert.equal((await a.call('registrarBaixaVendaLocalV2',payload)).reutilizado,true);
 assert.equal((await a.call('obterResumoFechadoTurnoV2',{turno})).totalCentavos,0);assert.equal(await balance(stock.estoqueId),2250);
});
test('baixa local exige caixa autorizado, mapeamento e saldo suficiente sem gravação parcial',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});const turno=turnRef('LOCAL-INVALID'),stock=await localStock('invalid',100);await openTurn(turno);
 const payload={vendaId:'VL-INVALID',turno,confirmado:true,itens:[{legadoId:stock.legadoId,quantidade:'250',precoUnitarioCentavos:2}],totalCentavos:500};
 await assert.rejects(kitchen.call('registrarBaixaVendaLocalV2',payload),{code:'functions/permission-denied'});
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',payload),{code:'functions/failed-precondition'});
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,itens:[{...payload.itens[0],legadoId:'OUTRO'}]}),{code:'functions/failed-precondition'});
 assert.equal(await balance(stock.estoqueId),100);const state=await readTurn(turno);assert.equal(state.baixasLocaisPendentes,undefined);await endTurn(turno,state.revisao);
});
test('venda local e restaurante disputam o mesmo saldo sem permitir estoque negativo',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});const turno=turnRef('LOCAL-RACE'),stock=await localStock('race',500);await openTurn(turno);
 await db.doc(`${base}/fichas_estoque/lanche`).set({consumos:[{estoqueId:stock.estoqueId,quantidadeMili:250}],opcoes:[{grupoId:'extras',opcaoId:'bacon',consumos:[]}]});
 const r=await ready(),payload={vendaId:'VL-RACE',turno,confirmado:true,itens:[{legadoId:stock.legadoId,quantidade:'250',precoUnitarioCentavos:2}],totalCentavos:500};
 const results=await Promise.allSettled([a.call('registrarBaixaVendaLocalV2',payload),close(a,{...await payment(r.atendimentoId),turno})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok([0,250].includes(await balance(stock.estoqueId)));
 if(results[0].status==='fulfilled')await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:results[0].value.reciboId});
 const state=await readTurn(turno);await endTurn(turno,state.revisao,state.totalCentavos);
});
const openTurn = (turno,trocoInicialCentavos=0) => a.call('abrirTurnoCaixaV2',{turno,trocoInicialCentavos});
const readTurn = async turno => (await a.call('consultarTurnoCaixaV2',{turno})).turno;
const endTurn = (turno,revisao,dinheiroContadoCentavos=0) => a.call('encerrarTurnoCaixaV2',{turno,revisao,dinheiroContadoCentavos,confirmado:true});

async function cancellationFixture(suffix){
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 const turno=turnRef(suffix),stock=await localStock(suffix);await openTurn(turno);
 const payload={vendaId:`VL-${suffix}`,turno,confirmado:true,itens:[{legadoId:stock.legadoId,quantidade:'250',precoUnitarioCentavos:2}],totalCentavos:500};
 return {turno,stock,payload,cancelData:{...payload,motivo:'Cliente desistiu da tentativa'}};
}
test('conferência de recuperação encontra venda posterior ao backup sem alterar estoque ou turno', async () => {
  const f = await cancellationFixture('BACKUP-AUDIT');
  const antes = await a.call('consultarRecuperacaoLocalV2', { turno: f.turno, vendaIds: [f.payload.vendaId] });
  assert.equal(antes.registros[0].status, 'ausente');
  const recibo = await a.call('registrarBaixaVendaLocalV2', f.payload);
  const estado = await readTurn(f.turno), saldo = await balance(f.stock.estoqueId);
  const auditoria = await a.call('consultarRecuperacaoLocalV2', { turno: f.turno, vendaIds: [] });
  assert.equal(auditoria.somenteConferencia, true); assert.equal(auditoria.terminalUid, a.uid);
  assert.equal(auditoria.registros.length, 1); assert.equal(auditoria.registros[0].status, 'aguardando_gravacao_local');
  assert.deepEqual(auditoria.registros[0].recibo, (({ reutilizado, ...r }) => r)(recibo));
  assert.deepEqual(await readTurn(f.turno), estado); assert.equal(await balance(f.stock.estoqueId), saldo);
  await a.call('cancelarTentativaVendaLocalV2', f.cancelData);
  assert.equal((await a.call('consultarRecuperacaoLocalV2', { turno: f.turno, vendaIds: [f.payload.vendaId] })).registros[0].status, 'cancelado');
  await endTurn(f.turno, (await readTurn(f.turno)).revisao);
});
test('inventário diferencia variação após corte de divergência no snapshot e nunca repõe saldo antigo', async () => {
  const f = await cancellationFixture('INVENTARIO-CORTE');
  const produto = { id: f.stock.legadoId, nome: 'Farinha', unidade: 'g', estoque: 2500 };
  const plano = require('../functions/estoque-migracao-core.cjs').planejarSaldoLegado(produto);
  const mappingId = require('node:crypto').createHash('sha256').update(f.stock.legadoId).digest('hex');
  await db.doc(`${base}/migracoes_estoque/${mappingId}`).update({ plano });
  await a.call('registrarBaixaVendaLocalV2', f.payload);
  const result = await a.call('conferirInventarioCorteV2', { produtos: [produto], lojaId: 'outra' });
  assert.equal(result.lojaId, 'fechamento-a'); assert.equal(result.terminalUid, a.uid);
  assert.equal(result.produtos[0].situacao, 'vinculo_conferido'); assert.equal(result.produtos[0].saldoCorteMili, 2500);
  assert.equal(result.produtos[0].saldoAtualMili, 2250); assert.equal(result.produtos[0].variacaoDesdeCorteMili, -250);
  assert.equal((await a.call('conferirInventarioCorteV2', { produtos: [{ ...produto, estoque: 3000 }] })).produtos[0].situacao, 'corte_divergente');
  assert.equal((await a.call('conferirInventarioCorteV2', { produtos: [{ ...produto, unidade: 'un' }] })).produtos[0].situacao, 'unidade_divergente');
  assert.equal((await a.call('conferirInventarioCorteV2', { produtos: [{ ...produto, id: 'inexistente' }] })).produtos[0].situacao, 'sem_vinculo');
  await assert.rejects(kitchen.call('conferirInventarioCorteV2', { produtos: [produto] }), { code: 'functions/permission-denied' });
  await assert.rejects(a.call('conferirInventarioCorteV2', { produtos: [produto, produto] }));
  assert.equal(await balance(f.stock.estoqueId), 2250);
  await a.call('cancelarTentativaVendaLocalV2', f.cancelData); await endTurn(f.turno, (await readTurn(f.turno)).revisao);
});
test('conferência de recuperação não permite trocar UID ou loja pelo payload', async () => {
  const f = await cancellationFixture('BACKUP-ISOLATION');
  const data = { turno: f.turno, vendaIds: [f.payload.vendaId], terminalUid: a.uid, lojaId: 'fechamento-a' };
  await assert.rejects(b.call('consultarRecuperacaoLocalV2', data), { code: 'functions/failed-precondition' });
  await assert.rejects(kitchen.call('consultarRecuperacaoLocalV2', data), { code: 'functions/permission-denied' });
  await assert.rejects(stranger.call('consultarRecuperacaoLocalV2', data), { code: 'functions/permission-denied' });
  await assert.rejects(a.call('consultarRecuperacaoLocalV2', { ...data, vendaIds: Array.from({ length: 51 }, (_, i) => `V-${i}`) }));
  await db.doc(`terminais_v2/${a.uid}`).update({ ativo: false });
  await assert.rejects(a.call('consultarRecuperacaoLocalV2', data), { code: 'functions/permission-denied' });
  await db.doc(`terminais_v2/${a.uid}`).update({ ativo: true });
  await endTurn(f.turno, (await readTurn(f.turno)).revisao);
});
test('armazenamento vazio e nova sessão Firebase recuperam a mesma pendência sem rebaixar estoque', async () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const backupCtx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/backup-homologacao.js'), 'utf8').replace('export function', 'function'), backupCtx);
  const memoria = () => { const map = new Map(); return { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };
  const carregar = storage => {
    const ctx = { localStorage: storage, window: { electronAPI: { ambienteTeste: true } }, console,
      core: require('../functions/venda-local-core.cjs'), estoqueCore: require('../functions/estoque-migracao-core.cjs') };
    vm.createContext(ctx);
    for (const file of ['perfil-operacional-v2.js','storage.js', 'venda-servidor-teste.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export const /g, 'var ').replace(/export function /g, 'function '), ctx);
    ctx.StorageService.getLicenca = () => null;
    return ctx;
  };
  for (const etapa of ['baixa', 'confirmacao', 'cancelamento']) {
    const f = await cancellationFixture('RESTORE-' + etapa), storage = memoria();
    const produto = { id: f.stock.legadoId, nome: 'Farinha', unidade: 'g', estoque: 2500, preco: 0.02 };
    storage.setItem('flowpdv_device_id', f.turno.terminalId);
    storage.setItem('adega_produtos', JSON.stringify([produto]));
    storage.setItem('adega_turno_atual', JSON.stringify({ ...f.turno, status: 'aberto' }));
    storage.setItem('flowpdv_migracoes_estoque_teste', JSON.stringify([{ lojaId: 'fechamento-a', status: 'confirmado', produto, estoqueId: f.stock.estoqueId }]));
    const inicial = carregar(storage); let perder = etapa === 'confirmacao' ? 'confirmarGravacaoVendaLocalV2' : 'registrarBaixaVendaLocalV2';
    const ponte = inicial.criarVendaServidorTeste({ storage, servico: inicial.StorageService, ambienteTeste: true, uuid: randomUUID, agora: () => new Date().toISOString(),
      call: async (nome, data) => { const result = await a.call(nome, data); if (nome === perder) { perder = null; throw Error('Resposta perdida no ensaio'); } return result; } });
    const plano = ponte.preparar(produto, '250', '10'); await assert.rejects(ponte.executar(plano), /Resposta perdida/);
    if (etapa === 'cancelamento') { perder = 'cancelarTentativaVendaLocalV2'; await assert.rejects(ponte.cancelar('Desistência conferida no ensaio', true), /Resposta perdida/); }
    const contexto = { lojaId: 'fechamento-a', terminalId: f.turno.terminalId, terminalUid: a.uid };
    const pacote = backupCtx.criarBackupHomologacao({ storage, contexto, ambienteTeste: true }).exportar();
    const destino = memoria(); backupCtx.criarBackupHomologacao({ storage: destino, contexto, ambienteTeste: true, destinoIsolado: true }).restaurar(pacote);
    const novo = carregar(destino);
    // Somente fixture nos emuladores: autentica novamente o UID original por token
    // emitido pelo Admin local. O token não é incluído no arquivo nem no log.
    const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-flowpdv' }, randomUUID()); apps.push(app);
    const auth = getAuth(app); connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
    await signInWithCustomToken(auth, await admin.auth().createCustomToken(a.uid));
    assert.equal(auth.currentUser.uid, a.uid);
    const fn = getFunctions(app, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', ports.functions);
    const restaurada = novo.criarVendaServidorTeste({ storage: destino, servico: novo.StorageService, ambienteTeste: true,
      call: async (nome, data) => (await httpsCallable(fn, nome)(data)).data });
    const saldo = await balance(f.stock.estoqueId);
    if (etapa === 'cancelamento') await restaurada.cancelar(); else await restaurada.executar();
    assert.equal(await balance(f.stock.estoqueId), saldo);
    assert.equal(saldo, etapa === 'cancelamento' ? 2500 : 2250);
    assert.equal(novo.StorageService.getVendas().length, etapa === 'cancelamento' ? 0 : 1);
    assert.equal(restaurada.pendente(), null); assert.equal((await readTurn(f.turno)).baixasLocaisPendentes, 0);
    if (etapa !== 'cancelamento') { assert.equal(novo.StorageService.getVendas()[0].id, plano.venda.id); assert.equal(novo.StorageService.getVendas()[0].trocoCentavos, 500); }
    await endTurn(f.turno, (await readTurn(f.turno)).revisao);
  }
});
async function refundFixture(suffix){
 const f=await cancellationFixture(suffix),receipt=await a.call('registrarBaixaVendaLocalV2',f.payload);
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:f.payload.vendaId,reciboId:receipt.reciboId});
 return {...f,refundData:{vendaId:f.payload.vendaId,turno:f.turno,motivo:'Devolução integral conferida',devolverEstoque:true,confirmado:true}};
}
test('venda local calcula troco no servidor e estorna somente o total vendido',async()=>{
 const f=await cancellationFixture('CASH-CHANGE'),payload={...f.payload,recebidoDinheiroCentavos:1000};
 const receipt=await a.call('registrarBaixaVendaLocalV2',payload);assert.equal(receipt.venda.recebidoDinheiroCentavos,1000);assert.equal(receipt.venda.trocoCentavos,500);
 assert.equal((await a.call('registrarBaixaVendaLocalV2',payload)).reutilizado,true);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,recebidoDinheiroCentavos:2000}),{code:'functions/failed-precondition'});
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:receipt.reciboId});
 const refund=await a.call('estornarVendaLocalV2',{vendaId:payload.vendaId,turno:f.turno,motivo:'Devolução com troco já entregue',devolverEstoque:true,confirmado:true});assert.equal(refund.totalCentavos,500);
 await a.call('confirmarEstornoLocalV2',{vendaId:payload.vendaId,reciboId:refund.reciboId});const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('dinheiro insuficiente, centavos inválidos ou troco forjado não geram baixa local',async()=>{
 const f=await cancellationFixture('CASH-INVALID');
 for(const patch of [{recebidoDinheiroCentavos:499},{recebidoDinheiroCentavos:1000.1},{recebidoDinheiroCentavos:'1000'},{recebidoDinheiroCentavos:1000,trocoCentavos:0},{trocoCentavos:500}])await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...f.payload,...patch}),{code:'functions/failed-precondition'});
 assert.equal(await balance(f.stock.estoqueId),2500);const state=await readTurn(f.turno);assert.equal(state.baixasLocaisPendentes||0,0);await endTurn(f.turno,state.revisao);
});
test('cancelar tentativa com troco conserva decisão original sem duplicar reposição',async()=>{
 const f=await cancellationFixture('CASH-CANCEL'),payload={...f.payload,recebidoDinheiroCentavos:1000};await a.call('registrarBaixaVendaLocalV2',payload);
 await assert.rejects(a.call('cancelarTentativaVendaLocalV2',{...f.cancelData,recebidoDinheiroCentavos:2000}),{code:'functions/failed-precondition'});
 const data={...f.cancelData,recebidoDinheiroCentavos:1000};await a.call('cancelarTentativaVendaLocalV2',data);await a.call('cancelarTentativaVendaLocalV2',data);
 assert.equal(await balance(f.stock.estoqueId),2500);const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('carrinho não baixa primeiro produto quando o segundo está sem saldo',async()=>{
 const f=await cancellationFixture('CART-ATOMIC'),second=await localStock('cart-low',100);
 const payload={...f.payload,itens:[...f.payload.itens,{legadoId:second.legadoId,quantidade:'500',precoUnitarioCentavos:2}],totalCentavos:1500};
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',payload),{code:'functions/failed-precondition'});
 assert.equal(await balance(f.stock.estoqueId),2500);assert.equal(await balance(second.estoqueId),100);
 assert.equal((await readTurn(f.turno)).baixasLocaisPendentes||0,0);
 assert.equal((await db.collection(`${base}/movimentos_estoque`).where('vendaId','==',payload.vendaId).get()).size,0);
 const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('carrinho concorrente registra uma baixa por produto e estorno repõe todos uma vez',async()=>{
 const f=await cancellationFixture('CART-SALE'),second=await localStock('cart-second');
 const payload={...f.payload,itens:[...f.payload.itens,{legadoId:second.legadoId,quantidade:'500',precoUnitarioCentavos:2}],totalCentavos:1500};
 const results=await Promise.all([a.call('registrarBaixaVendaLocalV2',payload),a.call('registrarBaixaVendaLocalV2',payload)]);
 assert.equal(results.filter(r=>r.reutilizado).length,1);assert.equal(results[0].consumos.length,2);
 assert.equal(await balance(f.stock.estoqueId),2250);assert.equal(await balance(second.estoqueId),2000);
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:results[0].reciboId});
 const data={vendaId:payload.vendaId,turno:f.turno,motivo:'Devolução integral do carrinho',devolverEstoque:true,confirmado:true};
 const refund=await a.call('estornarVendaLocalV2',data);await a.call('estornarVendaLocalV2',data);
 assert.equal(refund.totalCentavos,1500);assert.equal(await balance(f.stock.estoqueId),2500);assert.equal(await balance(second.estoqueId),2500);
 await a.call('confirmarEstornoLocalV2',{vendaId:payload.vendaId,reciboId:refund.reciboId});const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('carrinho pendente cancelado devolve os dois produtos e rejeita alteração da segunda linha',async()=>{
 const f=await cancellationFixture('CART-CANCEL'),second=await localStock('cart-cancel');
 const payload={...f.payload,itens:[...f.payload.itens,{legadoId:second.legadoId,quantidade:'500',precoUnitarioCentavos:2}],totalCentavos:1500};
 await a.call('registrarBaixaVendaLocalV2',payload);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,itens:[payload.itens[0],{...payload.itens[1],quantidade:'501'}],totalCentavos:1502}),{code:'functions/failed-precondition'});
 const data={...payload,motivo:'Cliente desistiu do carrinho'};await a.call('cancelarTentativaVendaLocalV2',data);await a.call('cancelarTentativaVendaLocalV2',data);
 assert.equal(await balance(f.stock.estoqueId),2500);assert.equal(await balance(second.estoqueId),2500);
 const state=await readTurn(f.turno);assert.equal(state.baixasLocaisPendentes,0);await endTurn(f.turno,state.revisao);
});
test('estorno local concorrente repõe uma vez e trava turno até confirmação do ajuste',async()=>{
 const f=await refundFixture('REFUND-ONCE');
 const results=await Promise.all([a.call('estornarVendaLocalV2',f.refundData),a.call('estornarVendaLocalV2',f.refundData)]);
 assert.equal(results.filter(r=>r.reutilizado).length,1);assert.equal(await balance(f.stock.estoqueId),2500);
 let state=await readTurn(f.turno);assert.equal(state.baixasLocaisPendentes,1);assert.equal(state.totalCentavos,0);
 await assert.rejects(endTurn(f.turno,state.revisao),{code:'functions/failed-precondition'});
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',f.payload),{code:'functions/failed-precondition'});
 const ack={vendaId:f.payload.vendaId,reciboId:results[0].reciboId};
 await a.call('confirmarEstornoLocalV2',ack);assert.equal((await a.call('confirmarEstornoLocalV2',ack)).reutilizado,true);
 state=await readTurn(f.turno);assert.equal(state.baixasLocaisPendentes,0);await endTurn(f.turno,state.revisao);
 assert.equal((await a.call('estornarVendaLocalV2',f.refundData)).reutilizado,true);
 assert.equal((await db.collection(`${base}/movimentos_estoque`).where('vendaId','==',f.payload.vendaId).get()).size,2);
});
test('estorno local em outro turno conserva o turno encerrado e pode não repor estoque',async()=>{
 const f=await refundFixture('REFUND-LATER');let previous=await readTurn(f.turno);await endTurn(f.turno,previous.revisao);previous=await readTurn(f.turno);
 const turno=turnRef('REFUND-LATER-NOW');await openTurn(turno,1000);
 const receipt=await a.call('estornarVendaLocalV2',{...f.refundData,turno,devolverEstoque:false});
 assert.equal(receipt.turnoVenda.id,f.turno.id);assert.equal(receipt.turno.id,turno.id);assert.equal(receipt.totalCentavos,500);
 assert.equal(await balance(f.stock.estoqueId),2250);assert.deepEqual(await readTurn(f.turno),previous);
 await a.call('confirmarEstornoLocalV2',{vendaId:f.payload.vendaId,reciboId:receipt.reciboId});const now=await readTurn(turno);await endTurn(turno,now.revisao,1000);
});
test('estorno local exige confirmação, autorização e decisão imutável',async()=>{
 const f=await refundFixture('REFUND-GUARD');
 for(const c of [kitchen,stranger])await assert.rejects(c.call('estornarVendaLocalV2',f.refundData),{code:'functions/permission-denied'});
 await assert.rejects(b.call('estornarVendaLocalV2',f.refundData),{code:'functions/failed-precondition'});
 for(const patch of [{confirmado:false},{devolverEstoque:'sim'},{motivo:'x'}])await assert.rejects(a.call('estornarVendaLocalV2',{...f.refundData,...patch}),{code:'functions/failed-precondition'});
 const r=await a.call('estornarVendaLocalV2',f.refundData);
 for(const patch of [{devolverEstoque:false},{motivo:'Mudou a decisão'},{turno:turnRef('OUTRO-REFUND')}])await assert.rejects(a.call('estornarVendaLocalV2',{...f.refundData,...patch}),{code:'functions/failed-precondition'});
 await assert.rejects(b.call('confirmarEstornoLocalV2',{vendaId:f.payload.vendaId,reciboId:r.reciboId}),{code:'functions/failed-precondition'});
 await a.call('confirmarEstornoLocalV2',{vendaId:f.payload.vendaId,reciboId:r.reciboId});const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('estorno local recusa venda pendente e cancelada sem repor duas vezes',async()=>{
 const f=await cancellationFixture('REFUND-NO-SALE'),data={vendaId:f.payload.vendaId,turno:f.turno,motivo:'Devolução integral conferida',devolverEstoque:true,confirmado:true};
 await a.call('registrarBaixaVendaLocalV2',f.payload);await assert.rejects(a.call('estornarVendaLocalV2',data),{code:'functions/failed-precondition'});
 await a.call('cancelarTentativaVendaLocalV2',f.cancelData);await assert.rejects(a.call('estornarVendaLocalV2',data),{code:'functions/failed-precondition'});
 assert.equal(await balance(f.stock.estoqueId),2500);const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('estorno local sem saldo íntegro não produz reposição parcial nem pendência financeira',async()=>{
 const f=await refundFixture('REFUND-BAD-STOCK');await db.doc(`${base}/estoque/${f.stock.estoqueId}`).update({saldoMili:1e9});
 await assert.rejects(a.call('estornarVendaLocalV2',f.refundData),{code:'functions/failed-precondition'});
 assert.equal((await readTurn(f.turno)).baixasLocaisPendentes,0);assert.equal(await balance(f.stock.estoqueId),1e9);
 await db.doc(`${base}/estoque/${f.stock.estoqueId}`).update({saldoMili:2250});const r=await a.call('estornarVendaLocalV2',f.refundData);
 await a.call('confirmarEstornoLocalV2',{vendaId:f.payload.vendaId,reciboId:r.reciboId});const state=await readTurn(f.turno);await endTurn(f.turno,state.revisao);
});
test('cancelamento concorrente devolve baixa pendente uma vez e libera encerramento',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL');const receipt=await a.call('registrarBaixaVendaLocalV2',payload);
 const results=await Promise.all([a.call('cancelarTentativaVendaLocalV2',cancelData),a.call('cancelarTentativaVendaLocalV2',cancelData)]);
 assert.equal(results.filter(r=>r.reutilizado).length,1);assert.equal(results[0].estoqueDevolvido,true);assert.equal(await balance(stock.estoqueId),2500);
 const state=await readTurn(turno);assert.equal(state.baixasLocaisPendentes,0);assert.equal(state.totalCentavos,0);
 assert.equal((await db.collection(`${base}/movimentos_estoque`).where('vendaId','==',payload.vendaId).get()).size,2);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',payload),{code:'functions/failed-precondition'});
 await assert.rejects(a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:receipt.reciboId}),{code:'functions/failed-precondition'});
 await endTurn(turno,state.revisao);assert.equal((await a.call('cancelarTentativaVendaLocalV2',cancelData)).reutilizado,true);
 await assert.rejects(a.call('cancelarTentativaVendaLocalV2',{...cancelData,motivo:'Motivo divergente'}),{code:'functions/failed-precondition'});
});
test('cancelar antes da baixa impede requisição atrasada sem aumentar o estoque',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL-EARLY');
 assert.equal((await a.call('cancelarTentativaVendaLocalV2',cancelData)).estoqueDevolvido,false);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',payload),{code:'functions/failed-precondition'});
 assert.equal(await balance(stock.estoqueId),2500);assert.equal((await db.collection(`${base}/movimentos_estoque`).where('vendaId','==',payload.vendaId).get()).size,0);
 const state=await readTurn(turno);await endTurn(turno,state.revisao);
});
test('cancelamento disputando com baixa termina cancelado e sem saldo perdido',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL-RACE');
 const results=await Promise.allSettled([a.call('registrarBaixaVendaLocalV2',payload),a.call('cancelarTentativaVendaLocalV2',cancelData)]);
 assert.equal(results[1].status,'fulfilled');assert.equal(await balance(stock.estoqueId),2500);
 const state=await readTurn(turno);assert.equal(state.baixasLocaisPendentes||0,0);await endTurn(turno,state.revisao);
});
test('cancelamento exige autorização, conteúdo original e confirmação; venda confirmada exige estorno',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL-GUARD');const receipt=await a.call('registrarBaixaVendaLocalV2',payload);
 for(const c of [kitchen,stranger])await assert.rejects(c.call('cancelarTentativaVendaLocalV2',cancelData),{code:'functions/permission-denied'});
 await assert.rejects(b.call('cancelarTentativaVendaLocalV2',cancelData),{code:'functions/failed-precondition'});
 for(const patch of [{confirmado:false},{motivo:'x'},{totalCentavos:501},{turno:turnRef('OTHER')}])await assert.rejects(a.call('cancelarTentativaVendaLocalV2',{...cancelData,...patch}),{code:'functions/failed-precondition'});
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:receipt.reciboId});
 await assert.rejects(a.call('cancelarTentativaVendaLocalV2',cancelData),{code:'functions/failed-precondition'});
 assert.equal(await balance(stock.estoqueId),2250);const state=await readTurn(turno);await endTurn(turno,state.revisao);
});
test('cancelar disputando com confirmação preserva exatamente um resultado',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL-ACK');const receipt=await a.call('registrarBaixaVendaLocalV2',payload);
 const results=await Promise.allSettled([a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:receipt.reciboId}),a.call('cancelarTentativaVendaLocalV2',cancelData)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(await balance(stock.estoqueId),results[0].status==='fulfilled'?2250:2500);
 const state=await readTurn(turno);assert.equal(state.baixasLocaisPendentes,0);await endTurn(turno,state.revisao);
});
test('estoque inconsistente recusa cancelamento sem soltar a pendência ou criar reposição parcial',async()=>{
 const {turno,stock,payload,cancelData}=await cancellationFixture('CANCEL-BAD-STOCK');await a.call('registrarBaixaVendaLocalV2',payload);
 await db.doc(`${base}/estoque/${stock.estoqueId}`).update({saldoMili:1e9});
 await assert.rejects(a.call('cancelarTentativaVendaLocalV2',cancelData),{code:'functions/failed-precondition'});
 assert.equal((await readTurn(turno)).baixasLocaisPendentes,1);assert.equal(await balance(stock.estoqueId),1e9);
 await db.doc(`${base}/estoque/${stock.estoqueId}`).update({saldoMili:2250});await a.call('cancelarTentativaVendaLocalV2',cancelData);
 const state=await readTurn(turno);await endTurn(turno,state.revisao);
});
test('turno obrigatório bloqueia pagamento sem abertura; abrir e encerrar são idempotentes',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 const r=await ready(),turno=turnRef('OPEN'),data={...await payment(r.atendimentoId),turno};
 await assert.rejects(close(a,await payment(r.atendimentoId)),{code:'functions/failed-precondition'});
 await assert.rejects(close(a,data),{code:'functions/failed-precondition'});
 await openTurn(turno,1000);assert.equal((await openTurn(turno,1000)).reutilizado,true);
 await assert.rejects(openTurn(turnRef('CONFLICT')),{code:'functions/failed-precondition'});
 await assert.rejects(openTurn(turno,2000),{code:'functions/failed-precondition'});
 await close(a,data);await close(a,data);
 const state=await readTurn(turno);assert.equal(state.totalCentavos,2500);assert.equal(state.movimentos,1);assert.equal(state.revisao,2);
 const ended=await endTurn(turno,state.revisao,3400);assert.equal(ended.turno.diferencaCentavos,-100);
 assert.equal((await endTurn(turno,state.revisao,3400)).reutilizado,true);
 await assert.rejects(openTurn(turno,1000),{code:'functions/failed-precondition'});
 const next=await ready();await assert.rejects(close(a,{...await payment(next.atendimentoId),turno}),{code:'functions/failed-precondition'});
 assert.equal((await close(a,data)).reutilizado,true);
});
test('fechamento concorrente com venda nunca omite o recebimento',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 const turno=turnRef('RACE');await openTurn(turno);const r=await ready();
 const results=await Promise.allSettled([close(a,{...await payment(r.atendimentoId),turno}),endTurn(turno,1)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const state=await readTurn(turno);
 if(state.status==='aberto'){assert.equal(state.totalCentavos,2500);await endTurn(turno,state.revisao,2500);}
 else {assert.equal(state.totalCentavos,0);assert.equal((await db.doc(`${base}/vendas/${r.atendimentoId}`).get()).exists,false);}
});
test('estorno em novo turno preserva total encerrado e grava saldo inverso uma vez',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 const old=turnRef('SALE'),current=turnRef('REFUND');await openTurn(old);
 const r=await ready();await close(a,{...await payment(r.atendimentoId),turno:old});await endTurn(old,2,2500);
 await assert.rejects(refund(a,r.atendimentoId),{code:'functions/failed-precondition'});
 await openTurn(current,3000);
 const payload={turno:current,vendaId:r.atendimentoId,motivo:'Devolucao em turno posterior',confirmado:true,devolverEstoque:true};
 await a.call('estornarVendaV2',payload);await a.call('estornarVendaV2',payload);
 assert.equal((await readTurn(old)).totalCentavos,2500);const now=await readTurn(current);assert.equal(now.totalCentavos,-2500);assert.equal(now.movimentos,1);
 await endTurn(current,now.revisao,500);
 const before=await a.call('obterResumoFechadoTurnoV2',{turno:old}),after=await a.call('obterResumoFechadoTurnoV2',{turno:current});
 assert.equal(before.detalhes[0].itens[0].quantidade,2);assert.equal(before.detalhes[0].totalCentavos,2500);
 assert.equal(after.detalhes[0].itens[0].quantidade,-2);assert.equal(after.detalhes[0].totalCentavos,-2500);
 assert.equal(after.detalhes[0].itens[0].opcoes[0].nome,'Bacon');
 assert.equal(await balance('lanche'),10000);
});
test('turno antigo com movimento declarado exige conciliação antes de adoção',async()=>{
 const turno=turnRef('OLD'),r=await ready();await close(a,{...await payment(r.atendimentoId),turno});
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 await assert.rejects(openTurn(turno),{code:'functions/failed-precondition'});
 await assert.rejects(kitchen.call('abrirTurnoCaixaV2',{turno,trocoInicialCentavos:0}),{code:'functions/permission-denied'});
});

test('resumo para integração exige turno encerrado e confere todos os movimentos',async()=>{
 await db.doc(base).update({caixaV2:{exigirTurno:true}});
 const turno=turnRef('INTEGRATION');await openTurn(turno,500);
 await assert.rejects(a.call('obterResumoFechadoTurnoV2',{turno}),{code:'functions/failed-precondition'});
 const r=await ready();await close(a,{...await payment(r.atendimentoId),turno});await endTurn(turno,2,3000);
 const snapshot=await a.call('obterResumoFechadoTurnoV2',{turno});
 assert.equal(snapshot.totalCentavos,2500);assert.equal(snapshot.trocoInicialCentavos,500);assert.equal(snapshot.recebimentos,1);assert.equal(snapshot.estornos,0);
 assert.deepEqual(await a.call('obterResumoFechadoTurnoV2',{turno}),snapshot);
 assert.equal(snapshot.detalhes[0].itens[0].precoUnitarioCentavos,1250);
 const saleRef=db.doc(`${base}/vendas/${r.atendimentoId}`),original=(await saleRef.get()).data().itens;
 await saleRef.update({itens:original.map(i=>({...i,totalCentavos:1}))});
 await assert.rejects(a.call('obterResumoFechadoTurnoV2',{turno}),{code:'functions/failed-precondition'});
 await saleRef.update({itens:original});
 await assert.rejects(b.call('obterResumoFechadoTurnoV2',{turno}),{code:'functions/failed-precondition'});
 await db.doc(`${base}/movimentos_financeiros/${r.atendimentoId}`).update({totalCentavos:2000});
 await assert.rejects(a.call('obterResumoFechadoTurnoV2',{turno}),{code:'functions/failed-precondition'});
});

test('venda local dividida calcula troco somente em dinheiro e devolve formas originais',async()=>{
 const f=await cancellationFixture('SPLIT'),pagamentos=[{forma:'Dinheiro',valorCentavos:200},{forma:'PIX',valorCentavos:100},{forma:'Débito',valorCentavos:100},{forma:'Crédito',valorCentavos:100}],payload={...f.payload,pagamentos,recebidoDinheiroCentavos:1000};
 const r=await a.call('registrarBaixaVendaLocalV2',payload);assert.equal(r.venda.trocoCentavos,800);assert.deepEqual(r.venda.pagamentos,pagamentos);
 assert.equal((await a.call('registrarBaixaVendaLocalV2',payload)).reutilizado,true);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,pagamentos:[{forma:'Dinheiro',valorCentavos:200},{forma:'PIX',valorCentavos:300}]}));
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:r.reciboId});
 const data={vendaId:payload.vendaId,turno:f.turno,motivo:'Devolução por formas originais',devolverEstoque:true,confirmado:true};
 const e=await a.call('estornarVendaLocalV2',data);assert.deepEqual(e.pagamentos,pagamentos);assert.equal(e.totalCentavos,500);assert.equal((await a.call('estornarVendaLocalV2',data)).reutilizado,true);assert.equal(await balance(f.stock.estoqueId),2500);
 await a.call('confirmarEstornoLocalV2',{vendaId:payload.vendaId,reciboId:e.reciboId});await endTurn(f.turno,(await readTurn(f.turno)).revisao);
});
test('divisão inválida não reserva estoque; Pix integral não aceita dinheiro excedente',async()=>{
 const f=await cancellationFixture('SPLIT-INVALID');
 for(const pagamentos of [[{forma:'PIX',valorCentavos:499}],[{forma:'PIX',valorCentavos:501}],[{forma:'PIX',valorCentavos:250},{forma:'PIX',valorCentavos:250}],[{forma:'Fiado',valorCentavos:500}],[{forma:'PIX',valorCentavos:500.1}],[]])await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...f.payload,pagamentos,recebidoDinheiroCentavos:0}));
 assert.equal(await balance(f.stock.estoqueId),2500);
 const payload={...f.payload,pagamentos:[{forma:'PIX',valorCentavos:500}],recebidoDinheiroCentavos:0};await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,recebidoDinheiroCentavos:100}));
 const r=await a.call('registrarBaixaVendaLocalV2',payload);assert.equal(r.venda.trocoCentavos,0);
 await a.call('cancelarTentativaVendaLocalV2',{...payload,motivo:'Cancelar Pix devolvido manualmente'});assert.equal(await balance(f.stock.estoqueId),2500);await endTurn(f.turno,(await readTurn(f.turno)).revisao);
});

test('ajuste local validado no servidor altera estorno sem alterar consumo',async()=>{
 const f=await cancellationFixture('ADJUST'),payload={...f.payload,totalCentavos:425,ajuste:{descontoCentavos:150,acrescimoCentavos:75,motivo:'Acordo comercial'},pagamentos:[{forma:'Dinheiro',valorCentavos:225},{forma:'PIX',valorCentavos:200}],recebidoDinheiroCentavos:1000};
 const r=await a.call('registrarBaixaVendaLocalV2',payload);assert.equal(r.venda.subtotalCentavos,500);assert.equal(r.venda.trocoCentavos,775);assert.equal(await balance(f.stock.estoqueId),2250);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...payload,ajuste:{...payload.ajuste,motivo:'Outro motivo'}}));assert.equal((await a.call('registrarBaixaVendaLocalV2',payload)).reutilizado,true);
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:payload.vendaId,reciboId:r.reciboId});const e=await a.call('estornarVendaLocalV2',{vendaId:payload.vendaId,turno:f.turno,motivo:'Devolução conferida',devolverEstoque:true,confirmado:true});assert.equal(e.totalCentavos,425);assert.deepEqual(e.pagamentos,payload.pagamentos);assert.equal(await balance(f.stock.estoqueId),2500);
 await a.call('confirmarEstornoLocalV2',{vendaId:payload.vendaId,reciboId:e.reciboId});await endTurn(f.turno,(await readTurn(f.turno)).revisao);
});
test('ajustes inválidos não baixam estoque; cortesia integral conserva consumo',async()=>{
 const f=await cancellationFixture('ADJUST-INVALID');
 for(const patch of [{totalCentavos:400,ajuste:{descontoCentavos:100,acrescimoCentavos:0,motivo:'curto'.slice(0,3)}},{ajuste:{descontoCentavos:501,acrescimoCentavos:501,motivo:'Motivo válido'}},{ajuste:{descontoCentavos:0.1,acrescimoCentavos:0.1,motivo:'Motivo válido'}},{totalCentavos:500,ajuste:{descontoCentavos:100,acrescimoCentavos:0,motivo:'Motivo válido'}}])await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...f.payload,...patch}));
 assert.equal(await balance(f.stock.estoqueId),2500);
 const payload={...f.payload,totalCentavos:0,ajuste:{descontoCentavos:500,acrescimoCentavos:0,motivo:'Cortesia integral'},recebidoDinheiroCentavos:0};await a.call('registrarBaixaVendaLocalV2',payload);assert.equal(await balance(f.stock.estoqueId),2250);await a.call('cancelarTentativaVendaLocalV2',{...payload,motivo:'Cancelamento da cortesia'});assert.equal(await balance(f.stock.estoqueId),2500);await endTurn(f.turno,(await readTurn(f.turno)).revisao);
});

const suspension={schema:1,estado:'suspensa',ambiente:'homologacao',revisao:2};
test('suspensão impede nova venda de restaurante e preserva reenvio, estorno e autenticação',async()=>{
 const r=await ready(),payload=await payment(r.atendimentoId);await close(a,payload);
 const another=await ready(),newPayload=await payment(another.atendimentoId);
 await db.doc(base).update({ativacaoOperacionalV2:suspension});
 const before=await balance('lanche');
 assert.equal((await close(a,payload)).reutilizado,true);
 await assert.rejects(close(a,newPayload),{code:'functions/failed-precondition'});
 assert.equal(await balance('lanche'),before);assert.equal((await db.doc(base+'/vendas/'+another.atendimentoId).get()).exists,false);
 await refund(a,r.atendimentoId);assert.equal(await balance('lanche'),10000);
 await db.doc('terminais_v2/'+a.uid).update({ativo:false});
 try{await assert.rejects(close(a,payload),{code:'functions/permission-denied'});}finally{await db.doc('terminais_v2/'+a.uid).update({ativo:true});}
});
test('baixa aceita antes da suspensão pode ser recuperada e confirmada sem nova baixa',async()=>{
 const f=await cancellationFixture('SUSP-CONFIRM'),receipt=await a.call('registrarBaixaVendaLocalV2',f.payload);
 await db.doc(base).update({ativacaoOperacionalV2:suspension});
 const before=(await db.doc(base+'/estoque/'+f.stock.estoqueId).get()).data();
 assert.equal((await a.call('registrarBaixaVendaLocalV2',f.payload)).reutilizado,true);
 await assert.rejects(a.call('registrarBaixaVendaLocalV2',{...f.payload,vendaId:'SUSP-NEW'}),{code:'functions/failed-precondition'});
 assert.deepEqual((await db.doc(base+'/estoque/'+f.stock.estoqueId).get()).data(),before);
 await a.call('confirmarGravacaoVendaLocalV2',{vendaId:f.payload.vendaId,reciboId:receipt.reciboId});
 assert.equal((await readTurn(f.turno)).baixasLocaisPendentes,0);
 await endTurn(f.turno,(await readTurn(f.turno)).revisao);
});
test('suspensão permite cancelar baixa pendente uma vez e reativar após revisão válida',async()=>{
 const f=await cancellationFixture('SUSP-CANCEL');await a.call('registrarBaixaVendaLocalV2',f.payload);
 await db.doc(base).update({ativacaoOperacionalV2:suspension});
 await a.call('cancelarTentativaVendaLocalV2',f.cancelData);
 assert.equal((await a.call('cancelarTentativaVendaLocalV2',f.cancelData)).reutilizado,true);
 assert.equal((await readTurn(f.turno)).baixasLocaisPendentes,0);
 await db.doc(base).update({ativacaoOperacionalV2:{...suspension,estado:'habilitada',revisao:3}});
 const result=await a.call('registrarBaixaVendaLocalV2',{...f.payload,vendaId:'SUSP-REACTIVATED'});assert.equal(result.reutilizado,false);
});
