// Counts document operations in real business handlers against emulators.
// Not a billing meter: excludes network, rules/index reads, listeners and CPU.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-flowpdv' });
const db = admin.firestore(), id = 'medicao-' + randomUUID(), base = `lojas_v2/${id}`;
const accounts = [], extraRefs = new Set(), rows = []; let current;
const measured = new Proxy(db, { get(target, key) {
  if (key === 'runTransaction') return async callback => {
    let committed;
    const result = await target.runTransaction(async tx => {
      current.attempts++; const writes = new Map(); committed = writes;
      const proxy = new Proxy(tx, { get(t, k) {
        if (k === 'get') return async ref => {
          const snap = await t.get(ref);
          current.reads += Array.isArray(snap.docs) ? Math.max(1, snap.size) : 1;
          return snap;
        };
        if (['set', 'create', 'update', 'delete'].includes(k)) return (ref, ...args) => {
          writes.set(ref.path, k === 'delete' ? 'deletes' : 'writes');
          if (!ref.path.startsWith(base + '/')) extraRefs.add(ref.path);
          t[k](ref, ...args); return proxy;
        };
        return typeof t[k] === 'function' ? t[k].bind(t) : t[k];
      } });
      return callback(proxy);
    });
    for (const type of committed.values()) current[type]++;
    return result;
  };
  return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
} });
const instrumented = { firestore: () => measured, auth: () => admin.auth() };
const handlers = Object.assign({}, ...['pedidos-publicos-v2', 'recebimento-v2', 'cozinha-v2', 'fechamento-v2'].map(m => require('../functions/' + m)(instrumented)));
async function call(name, uid, data, label = name) {
  current = { step: label, reads: 0, writes: 0, deletes: 0, attempts: 0 };
  const result = await handlers[name].run({ auth: uid ? { uid, token: {} } : null, data });
  rows.push(current); return result;
}
async function user(role) {
  const u = await admin.auth().createUser({}); accounts.push(u.uid);
  if (role) {
    await db.doc(`terminais_v2/${u.uid}`).set({ ativo: true, lojaId: id, papel: role });
    await db.doc(`${base}/membros/${u.uid}`).set({ ativo: true, tipo: 'terminal', papel: role });
  }
  return u.uid;
}
(async () => {
  try {
    await db.doc(base).set({ nome: 'Medição fictícia', ativo: true, slug: id, modulos: { cardapio: true, mesas: true, retirada: true }, cozinha: { kds: true, impressao: false }, caixaV2: { exigirTurno: true }, ativacaoOperacionalV2: { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 1 } });
    await db.doc(`rotas_publicas_v2/${id}`).set({ lojaId: id });
    await db.doc(`catalogos_publicos_v2/${id}`).set({ publicado: true, pausado: false, versao: 1, produtos: [{ id: 'lanche', nome: 'Lanche', ativo: true, precoCentavos: 1000, grupos: [{ id: 'extras', nome: 'Extras', min: 0, max: 1, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 1 }] }] }] });
    await db.doc(`${base}/mesas/mesa-1`).set({ nome: 'Mesa 1', ativo: true, comandaPdvId: 'MESA-1' });
    for (const stock of ['lanche', 'bacon']) await db.doc(`${base}/estoque/${stock}`).set({ saldoMili: 10000 });
    await db.doc(`${base}/fichas_estoque/lanche`).set({ consumos: [{ estoqueId: 'lanche', quantidadeMili: 1000 }], opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', consumos: [{ estoqueId: 'bacon', quantidadeMili: 200 }] }] });
    const customer = await user(), cashier = await user('caixa'), kitchen = await user('cozinha');
    const turno = { id: randomUUID(), terminalId: 'MEDICAO', dataAbertura: new Date().toISOString() };
    await call('abrirTurnoCaixaV2', cashier, { turno, trocoInicialCentavos: 0 });
    const request = { slug: id, tipo: 'mesa', mesaId: 'mesa-1', requestId: randomUUID(), catalogoVersao: 1, itens: [{ produtoId: 'lanche', quantidade: 1, observacao: 'Sem cebola', opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', quantidade: 1 }] }] };
    const order = await call('criarPedidoPublicoV2', customer, request);
    assert.equal(order.totalCentavos, 1250);
    await call('criarPedidoPublicoV2', customer, request, 'reenvio_pedido');
    await call('acompanharPedidoPublicoV2', null, { token: order.acompanhamentoToken });
    const received = await call('receberPedidoPdvV2', cashier, { pedidoId: order.pedidoId });
    for (const [de, para] of [['novo', 'em_preparo'], ['em_preparo', 'pronto'], ['pronto', 'entregue']]) await call('avancarPreparoV2', kitchen, { pedidoId: order.pedidoId, de, para }, para);
    const account = (await db.doc(`${base}/atendimentos/${received.atendimentoId}`).get()).data();
    const payment = { atendimentoId: received.atendimentoId, versao: account.versao, turno, pagamentos: [{ forma: 'dinheiro', valorCentavos: 1250 }], recebidoDinheiroCentavos: 2000, confirmado: true };
    await call('fecharAtendimentoV2', cashier, payment);
    await call('fecharAtendimentoV2', cashier, payment, 'reenvio_pagamento');
    assert.equal((await db.collection(`${base}/vendas`).get()).size, 1);
    const normal = rows.filter(r => !['abrirTurnoCaixaV2', 'acompanharPedidoPublicoV2', 'reenvio_pedido', 'reenvio_pagamento'].includes(r.step));
    const sum = key => normal.reduce((total, row) => total + row[key], 0);
    const { INTERVALO_ACOMPANHAMENTO_MS } = await import(require('node:url').pathToFileURL(path.resolve(__dirname, '../../../flowpdv-cardapio/src/lib/acompanhamento-v2.js')).href);
    const intervalSeconds = INTERVALO_ACOMPANHAMENTO_MS / 1000;
    const report = { date: new Date().toISOString(), scenario: '1 mesa, 1 produto + 1 adicional, 2 insumos, KDS, pagamento manual com turno', method: 'handlers .run reais; transações no emulador; documentos lidos e escritas confirmadas; setup/assertions/cleanup excluídos', rows,
      perOrder: { reads: sum('reads'), writes: sum('writes') },
      tracking: { readsPerPoll: rows.find(r => r.step === 'acompanharPedidoPublicoV2').reads, intervalSeconds, visibleOnly: true },
      excluded: ['leituras do frontend/PDV/gestor e regras', 'índices faturáveis', 'reconexões/listeners', 'CPU/memória/rede/Auth/armazenamento/build', 'delivery, impressão e demais fluxos', 'efeito de contenção real'],
      projections: [] };
    for (const orders of [30, 50, 100, 200]) for (const minutes of [0, 20, 40]) report.projections.push({ orders, trackingMinutesPerOrder: minutes, reads: orders * (sum('reads') + minutes * 60 / intervalSeconds * report.tracking.readsPerPoll), writes: orders * sum('writes') });
    const output = path.resolve(__dirname, '../../output/medicao-consumo-v2'); fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'resultado-otimizado.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.recursiveDelete(db.doc(base));
    for (const p of [...extraRefs, `rotas_publicas_v2/${id}`, `catalogos_publicos_v2/${id}`]) await db.doc(p).delete();
    for (const uid of accounts) { await db.doc(`terminais_v2/${uid}`).delete(); await admin.auth().deleteUser(uid); }
    await admin.app().delete();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
