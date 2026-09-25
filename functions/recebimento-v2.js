const { randomUUID } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
module.exports = admin => {
  const db = admin.firestore();
  const fail = (code, message) => { throw new HttpsError(code, message); };
  return {
    receberPedidoPdvV2: onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
      if (!request.auth) fail('unauthenticated', 'Ative o terminal primeiro.');
      const uid = request.auth.uid;
      if ((await admin.auth().getUser(uid)).disabled) fail('permission-denied', 'Terminal desativado.');
      const pedidoId = request.data?.pedidoId;
      if (typeof pedidoId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(pedidoId)) fail('invalid-argument', 'Pedido inválido.');
      const candidateId = randomUUID();
      return db.runTransaction(async tx => {
        const terminal = await tx.get(db.doc(`terminais_v2/${uid}`));
        if (!terminal.exists || terminal.data().ativo !== true || terminal.data().papel !== 'caixa') fail('permission-denied', 'Terminal de caixa ativo necessário.');
        const lojaId = terminal.data().lojaId, base = `lojas_v2/${lojaId}`;
        const member = await tx.get(db.doc(`${base}/membros/${uid}`));
        const loja = await tx.get(db.doc(base));
        if (!member.exists || member.data().ativo !== true || member.data().tipo !== 'terminal' || member.data().papel !== 'caixa' || !loja.exists || loja.data().ativo !== true) fail('permission-denied', 'Vínculo indisponível.');
        const orderRef = db.doc(`${base}/pedidos/${pedidoId}`), orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) fail('not-found', 'Pedido não encontrado nesta loja.');
        const order = orderSnap.data();
        if (order.recebidoPdv === true) return { pedidoId, atendimentoId: order.atendimentoId || null, reutilizado: true, ignorado: order.ignoradoPdv === true };
        if (order.status === 'cancelado') {
          if (order.contadorMesa) {
            const ref = db.doc(`${base}/mesas/${order.mesaId}`), table = await tx.get(ref);
            tx.update(ref, { pendentesRecebimento: Math.max(0, (table.data()?.pendentesRecebimento || 0) - 1) });
          }
          tx.update(orderRef, { recebidoPdv: true, ignoradoPdv: true });
          return { pedidoId, atendimentoId: null, ignorado: true, reutilizado: false };
        }
        require('./politica-ativacao-v2').exigirNovaOperacaoV2(loja.data());
        let mesaRef, mesa, atendimentoId = `retirada-${pedidoId}`, comandaPdvId = `RETIRADA-${pedidoId}`;
        if (order.tipo === 'mesa') {
          mesaRef = db.doc(`${base}/mesas/${order.mesaId}`);
          const snapshot = await tx.get(mesaRef); mesa = snapshot.data();
          if (!snapshot.exists || !mesa.ativo || typeof mesa.comandaPdvId !== 'string' || !/^MESA-[1-9][0-9]*$/.test(mesa.comandaPdvId)) fail('failed-precondition', 'Configure o vínculo desta mesa com o PDV.');
          if (order.mesaCiclo && order.mesaCiclo !== (mesa.ciclo || 1)) fail('failed-precondition', 'Pedido de outro atendimento da mesa; confira antes de receber.');
          atendimentoId = mesa.atendimentoId || candidateId; comandaPdvId = mesa.comandaPdvId;
        } else if (order.tipo === 'delivery') {
          atendimentoId = `delivery-${pedidoId}`; comandaPdvId = `DELIVERY-${pedidoId}`;
        } else if (order.tipo !== 'retirada') fail('failed-precondition', 'Tipo de atendimento não suportado.');
        const ref = db.doc(`${base}/atendimentos/${atendimentoId}`), current = await tx.get(ref);
        const previous = current.exists ? current.data() : null;
        if (previous && (previous.status !== 'aberto' || previous.mesaId !== (order.mesaId || null) || previous.comandaPdvId !== comandaPdvId)) fail('failed-precondition', 'Atendimento incompatível; revise a mesa.');
        const existing = previous?.itens || [];
        if (!Array.isArray(order.itens) || !order.itens.length || existing.length + order.itens.length > 300) fail('failed-precondition', 'Atendimento excede o limite de itens ou pedido inválido.');
        try { require('./composicao-pedido-core.cjs').linhasDeEstoque(order.itens); }
        catch (error) { fail('failed-precondition', error.message); }
        const lines = order.itens.map(line => ({ ...line, origemPedidoId: pedidoId, origemLinhaId: `${pedidoId}:${line.linhaId}` }));
        if (new Set(lines.map(line => line.origemLinhaId)).size !== lines.length) fail('failed-precondition', 'Pedido com linhas duplicadas.');
        const all = [...existing, ...lines];
        const taxaEntregaCentavos = order.tipo === 'delivery' ? order.taxaEntregaCentavos : 0;
        if (!Number.isSafeInteger(taxaEntregaCentavos) || taxaEntregaCentavos < 0 || taxaEntregaCentavos > 100000
          || (order.tipo === 'delivery' && (previous || order.mesaId || order.totalCentavos !== lines.reduce((sum,l)=>sum+l.totalCentavos,0)+taxaEntregaCentavos))) fail('failed-precondition', 'Taxa ou conta de delivery inconsistente.');
        const total = all.reduce((sum, line) => sum + line.totalCentavos, 0) + taxaEntregaCentavos;
        if (!Number.isSafeInteger(total)) fail('failed-precondition', 'Total inválido.');
        const result = { status: 'aberto', tipo: order.tipo, mesaId: order.mesaId || null, mesaNome: order.mesaNome || null, comandaPdvId, itens: all, totalCentavos: total, versao: (previous?.versao || 0) + 1, atualizadoEm: FieldValue.serverTimestamp() };
        if (order.tipo === 'delivery') result.taxaEntregaCentavos = taxaEntregaCentavos;
        if (!previous) result.criadoEm = FieldValue.serverTimestamp();
        tx.set(ref, result, { merge: true });
        if (loja.data().cozinha?.impressao === true) {
          tx.create(db.doc(`${base}/impressoes_cozinha/${pedidoId}`), {
            pedidoId, status: 'pendente', via: 1, criadoEm: FieldValue.serverTimestamp()
          });
        }
        if (mesaRef) tx.update(mesaRef, { atendimentoId, ...(order.contadorMesa ? { pendentesRecebimento: Math.max(0, (mesa.pendentesRecebimento || 0) - 1) } : {}) });
        tx.update(orderRef, { recebidoPdv: true, atendimentoId, recebidoEm: FieldValue.serverTimestamp() });
        return { pedidoId, atendimentoId, comandaPdvId, reutilizado: false };
      });
    })
  };
};
