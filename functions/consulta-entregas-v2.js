const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldPath } = require('firebase-admin/firestore');
const filtros = { andamento: ['novo', 'em_preparo', 'pronto', 'saiu_entrega'], finalizadas: ['entregue'], canceladas: ['cancelado'] };
module.exports = admin => ({
  listarEntregasCaixaV2: onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    const fail = (code, message) => { throw new HttpsError(code, message); };
    if (!request.auth) fail('unauthenticated', 'Autorize o caixa.');
    const uid = request.auth.uid, data = request.data || {}, filtro = data.filtro || 'andamento';
    if (!Object.hasOwn(filtros, filtro)) fail('invalid-argument', 'Filtro de entrega inválido.');
    const cursor = data.cursor;
    if (cursor != null && (!cursor || typeof cursor !== 'object' || cursor.filtro !== filtro || typeof cursor.apos !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(cursor.apos))) fail('invalid-argument', 'Reinicie a consulta de entregas.');
    if ((await admin.auth().getUser(uid)).disabled) fail('permission-denied', 'Terminal desativado.');
    const db = admin.firestore();
    return db.runTransaction(async tx => {
      const terminal = (await tx.get(db.doc(`terminais_v2/${uid}`))).data();
      if (!terminal?.ativo || terminal.papel !== 'caixa' || typeof terminal.lojaId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(terminal.lojaId)) fail('permission-denied', 'Caixa não autorizado.');
      const base = `lojas_v2/${terminal.lojaId}`;
      const shop = (await tx.get(db.doc(base))).data(), member = (await tx.get(db.doc(`${base}/membros/${uid}`))).data();
      if (!shop?.ativo || !member?.ativo || member.tipo !== 'terminal' || member.papel !== 'caixa') fail('permission-denied', 'Vínculo indisponível.');
      await require('./identidade-operacional-v2')(tx, db, base, terminal, uid);
      if (cursor != null && cursor.lojaId !== terminal.lojaId) fail('invalid-argument', 'O acesso mudou. Reinicie a consulta.');
      let query = db.collection(`${base}/pedidos`).where('tipo', '==', 'delivery').where('status', 'in', filtros[filtro]).orderBy(FieldPath.documentId()).limit(26);
      if (cursor) query = query.startAfter(cursor.apos);
      const result = await tx.get(query), page = result.docs.slice(0, 25);
      return { filtro, pedidos: page.map(doc => {
        const p = doc.data();
        return { id: doc.id, status: p.status, pagamento: p.pagamento || 'pendente', totalCentavos: p.totalCentavos, criadoEm: p.criadoEm?.toDate?.().toISOString() || null };
      }), proximo: result.size > 25 ? { lojaId: terminal.lojaId, filtro, apos: page.at(-1).id } : null };
    });
  })
});
