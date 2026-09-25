const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

module.exports = admin => {
  const db = admin.firestore(), stamp = () => FieldValue.serverTimestamp();
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const id = value => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail('invalid-argument', 'Identificação inválida.');
    return value;
  };
  // Loja sempre obtida do terminal, nunca de um parâmetro enviado pela tela.
  const operation = action => onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    if (!request.auth) fail('unauthenticated', 'Ative o terminal.');
    const uid = request.auth.uid;
    if ((await admin.auth().getUser(uid)).disabled) fail('permission-denied', 'Terminal desativado.');
    return db.runTransaction(async tx => {
      const terminal = await tx.get(db.doc(`terminais_v2/${uid}`)), t = terminal.data();
      if (!t?.ativo || !['caixa', 'cozinha'].includes(t.papel)) fail('permission-denied', 'Terminal não autorizado.');
      const base = `lojas_v2/${t.lojaId}`;
      const [member, shop] = await Promise.all([tx.get(db.doc(`${base}/membros/${uid}`)), tx.get(db.doc(base))]);
      if (!member.data()?.ativo || member.data()?.tipo !== 'terminal' || member.data()?.papel !== t.papel || !shop.data()?.ativo) fail('permission-denied', 'Vínculo indisponível.');
      return action({ tx, uid, base, papel: t.papel, config: shop.data().cozinha || {}, data: request.data || {} });
    });
  });
  const getJob = async ({ tx, base, data }) => {
    const ref = db.doc(`${base}/impressoes_cozinha/${id(data.jobId)}`), snap = await tx.get(ref);
    if (!snap.exists) fail('not-found', 'Impressão não encontrada nesta loja.');
    return { ref, job: snap.data() };
  };
  return {
    confirmarAvisoCozinhaV2: operation(async ({ tx, base, uid, data }) => {
      const ref = db.doc(`${base}/avisos_cozinha/${id(data.avisoId)}`), snapshot = await tx.get(ref);
      if (!snapshot.exists) fail('not-found', 'Aviso não encontrado.');
      if (snapshot.data().status === 'confirmado') return { reutilizado: true };
      tx.update(ref, { status: 'confirmado', confirmadoPor: uid, confirmadoEm: stamp() });
      return { reutilizado: false };
    }),
    avancarPreparoV2: operation(async ({ tx, base, data, config, uid, papel }) => {
      if (data.origem !== undefined && data.origem !== 'caixa') fail('invalid-argument', 'Origem de preparo inválida.');
      if (data.origem === 'caixa') {
        if (papel !== 'caixa') fail('permission-denied', 'Somente o caixa autorizado pode atualizar sem KDS.');
        if (config.kds === true) fail('failed-precondition', 'KDS ativado. Atualize pelo painel de cozinha.');
      } else if (!config.kds) fail('failed-precondition', 'KDS desativado nesta loja.');
      const next = { novo: 'em_preparo', em_preparo: 'pronto', pronto: 'entregue' };
      if (!Object.hasOwn(next, data.de) || next[data.de] !== data.para) fail('invalid-argument', 'Transição inválida.');
      const ref = db.doc(`${base}/pedidos/${id(data.pedidoId)}`), snap = await tx.get(ref), order = snap.data();
      if (!order || !order.recebidoPdv || order.ignoradoPdv) fail('failed-precondition', 'Pedido ainda não recebido.');
      if (data.origem === 'caixa' && !['mesa', 'retirada'].includes(order.tipo)) fail('failed-precondition', 'Use os controles de entrega para delivery.');
      if (order.tipo === 'delivery' && data.para === 'entregue') fail('failed-precondition', 'Despache e confirme a entrega pelo caixa.');
      if (order.status === data.para) return { status: order.status, reutilizado: true };
      if (order.status !== data.de) fail('failed-precondition', 'Pedido mudou. Atualize o painel.');
      tx.update(ref, { status: data.para, atualizadoEm: stamp(), preparoTerminalUid: uid, preparoOrigem: data.origem || 'kds' });
      return { status: data.para, reutilizado: false };
    }),
    reservarImpressaoCozinhaV2: operation(async context => {
      const { tx, uid, config, data, base } = context;
      if (!config.impressao) fail('failed-precondition', 'Impressão desativada nesta loja.');
      if (config.terminalUid && config.terminalUid !== uid) fail('permission-denied', 'A impressão está atribuída a outro terminal.');
      const tentativa = id(data.tentativa), { ref, job } = await getJob(context);
      if (job.status !== 'pendente') {
        if (job.status === 'enviando' && job.expiraEm.toMillis() < Date.now()) {
          tx.update(ref, { status: 'incerto', atualizadoEm: stamp() });
          return { autorizado: false, status: 'incerto' };
        }
        return { autorizado: false, status: job.status };
      }
      const snap = await tx.get(db.doc(`${base}/pedidos/${job.pedidoId}`)), order = snap.data();
      if (!order || (order.status === 'cancelado' && job.tipo !== 'cancelamento')) {
        tx.update(ref, { status: 'cancelado', atualizadoEm: stamp() });
        return { autorizado: false, status: 'cancelado' };
      }
      tx.update(ref, { status: 'enviando', terminalUid: uid, tentativa, expiraEm: Timestamp.fromMillis(Date.now() + 120000), atualizadoEm: stamp() });
      return { autorizado: true, status: 'enviando', via: job.via, pedido: {
        pedidoId: job.pedidoId, mesaNome: order.mesaNome || 'Retirada', tipo: order.tipo,
        avisoCancelamento: job.tipo === 'cancelamento' ? job.motivo : null,
        criadoEm: order.criadoEm?.toMillis() || null,
        itens: order.itens.map(line => ({ nome: line.nome, quantidade: line.quantidade, observacao: line.observacao || '', opcoes: line.opcoes || [],
          ...(line.variante === 'combo' ? { variante: 'combo', componentes: line.componentes } : {}) }))
      } };
    }),
    concluirImpressaoCozinhaV2: operation(async context => {
      const { tx, uid, data } = context, { ref, job } = await getJob(context);
      if (!['simulado', 'enviado_driver', 'incerto'].includes(data.resultado)) fail('invalid-argument', 'Resultado inválido.');
      if (data.resultado === 'simulado' && process.env.GCLOUD_PROJECT !== 'demo-flowpdv') fail('failed-precondition', 'Simulação somente no projeto local.');
      if (job.terminalUid !== uid || job.tentativa !== data.tentativa) fail('permission-denied', 'Tentativa pertence a outro terminal.');
      if (job.status === data.resultado) return { status: job.status, reutilizado: true };
      if (job.status !== 'enviando') fail('failed-precondition', 'Tentativa já encerrada; confira a fila.');
      tx.update(ref, { status: data.resultado, atualizadoEm: stamp() });
      return { status: data.resultado, reutilizado: false };
    }),
    reimprimirCozinhaV2: operation(async context => {
      const { tx, uid, base, data, config } = context;
      if (!config.impressao) fail('failed-precondition', 'Impressão desativada.');
      const { ref, job } = await getJob(context), requestId = id(data.requestId);
      const motivo = typeof data.motivo === 'string' ? data.motivo.trim() : '';
      if (motivo.length < 5 || motivo.length > 180) fail('invalid-argument', 'Informe o motivo da segunda via (5 a 180 caracteres).');
      const key = createHash('sha256').update(`${uid}:${requestId}`).digest('hex');
      const newRef = db.doc(`${base}/impressoes_cozinha/re-${key}`), existing = await tx.get(newRef);
      if (existing.exists) {
        if (existing.data().origemJobId !== ref.id || existing.data().motivo !== motivo) fail('already-exists', 'Solicitação já utilizada.');
        return { jobId: newRef.id, reutilizado: true };
      }
      if (!['simulado', 'enviado_driver', 'incerto'].includes(job.status) && !(job.status === 'enviando' && job.expiraEm.toMillis() < Date.now())) fail('failed-precondition', 'Aguarde a tentativa atual antes de solicitar outra via.');
      const order = await tx.get(db.doc(`${base}/pedidos/${job.pedidoId}`));
      if (!order.exists || (order.data().status === 'cancelado' && job.tipo !== 'cancelamento')) fail('failed-precondition', 'Pedido cancelado ou indisponível.');
      if (job.reimpressaoId) fail('failed-precondition', 'Já existe outra via; confira a fila.');
      tx.update(ref, { reimpressaoId: newRef.id, ...(job.status === 'enviando' ? { status: 'incerto' } : {}) });
      tx.create(newRef, { pedidoId: job.pedidoId, status: 'pendente', via: job.via + 1, origemJobId: ref.id, motivo, ...(job.tipo === 'cancelamento' ? { tipo: 'cancelamento' } : {}), solicitadoPor: uid, criadoEm: stamp() });
      return { jobId: newRef.id, reutilizado: false };
    })
  };
};
