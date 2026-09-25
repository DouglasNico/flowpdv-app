const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

// Consulta preparatória: não concede acesso às operações nem ativa o aplicativo.
// A loja sempre vem do terminal autenticado, nunca do payload ou da licença.
module.exports = admin => {
  const db = admin.firestore();
  const deny = () => { throw new HttpsError('permission-denied', 'Terminal ou vínculo indisponível.'); };
  return {
    alterarAtivacaoOperacionalV2: onCall({ cors: true }, async request => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
      const actor = await admin.auth().getUser(request.auth.uid);
      if (actor.disabled || !actor.email || !actor.emailVerified) deny();
      const data = request.data || {};
      const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
      if (!validId(data.lojaId) || !validId(data.requestId)
        || !['habilitada', 'suspensa'].includes(data.estado) || data.ambiente !== 'homologacao'
        || !Number.isSafeInteger(data.revisaoEsperada) || data.revisaoEsperada < 0
        || data.revisaoEsperada >= Number.MAX_SAFE_INTEGER
        || typeof data.motivo !== 'string' || data.motivo.trim().length < 5 || data.motivo.trim().length > 180)
        throw new HttpsError('invalid-argument', 'Informe loja, operação, revisão, motivo e estado de homologação válidos.');
      if (data.confirmado !== true) throw new HttpsError('failed-precondition', 'Confirme a alteração da homologação.');
      const payload = { estado: data.estado, ambiente: 'homologacao', revisaoEsperada: data.revisaoEsperada, motivo: data.motivo.trim() };
      const base = `lojas_v2/${data.lojaId}`;
      return db.runTransaction(async tx => {
        const shopRef = db.doc(base), shop = (await tx.get(shopRef)).data();
        const member = (await tx.get(db.doc(`${base}/membros/${actor.uid}`))).data();
        const terminal = await tx.get(db.doc(`terminais_v2/${actor.uid}`));
        const isAdmin = request.auth.token.admin === true && actor.customClaims?.admin === true;
        if (terminal.exists || (!isAdmin && (member?.ativo !== true || member.tipo !== 'usuario' || member.papel !== 'gerente'))) deny();
        if (!shop || shop.ativo !== true) throw new HttpsError('failed-precondition', 'Loja indisponível.');
        const operationRef = db.doc(`${base}/operacoes_ativacao/${data.requestId}`);
        const operation = (await tx.get(operationRef)).data();
        if (operation) {
          if (operation.atorUid !== actor.uid || Object.keys(payload).some(key => operation.payload[key] !== payload[key]))
            throw new HttpsError('already-exists', 'Identificador usado em outra alteração.');
          return { ...operation.resultado, reutilizado: true };
        }
        const previous = shop.ativacaoOperacionalV2;
        if (previous != null && (previous.schema !== 1 || previous.ambiente !== 'homologacao'
          || !['habilitada', 'suspensa'].includes(previous.estado) || !Number.isSafeInteger(previous.revisao) || previous.revisao < 1))
          throw new HttpsError('failed-precondition', 'Configuração incompatível: exige revisão administrativa.');
        const revision = previous?.revisao || 0;
        if (revision !== data.revisaoEsperada) throw new HttpsError('failed-precondition', 'A ativação mudou. Recarregue antes de alterar.');
        const config = { schema: 1, estado: data.estado, ambiente: 'homologacao', revisao: revision + 1 };
        const result = { lojaId: data.lojaId, ...config, producaoHabilitada: false };
        const stamp = FieldValue.serverTimestamp();
        tx.update(shopRef, { ativacaoOperacionalV2: config });
        tx.create(operationRef, { atorUid: actor.uid, payload, resultado: result, criadoEm: stamp });
        tx.create(db.collection('auditoria_ativacao_v2').doc(), {
          lojaId: data.lojaId, atorUid: actor.uid, requestId: data.requestId,
          anterior: previous || null, atual: config, motivo: payload.motivo, criadoEm: stamp
        });
        return { ...result, reutilizado: false };
      });
    }),
    consultarAtivacaoOperacionalV2: onCall({ cors: true }, async request => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
      const uid = request.auth.uid;
      if ((await admin.auth().getUser(uid)).disabled) deny();
      return db.runTransaction(async tx => {
        const terminal = (await tx.get(db.doc(`terminais_v2/${uid}`))).data();
        if (!terminal || terminal.ativo !== true || !['caixa', 'cozinha'].includes(terminal.papel)
          || typeof terminal.lojaId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(terminal.lojaId)) deny();
        const base = `lojas_v2/${terminal.lojaId}`;
        const loja = (await tx.get(db.doc(base))).data();
        const member = (await tx.get(db.doc(`${base}/membros/${uid}`))).data();
        if (!loja || loja.ativo !== true || !member || member.ativo !== true
          || member.tipo !== 'terminal' || member.papel !== terminal.papel) deny();
        await require('./identidade-operacional-v2')(tx, db, base, terminal, uid);
        const config = loja.ativacaoOperacionalV2;
        const homologacao = config?.schema === 1 && config.estado === 'habilitada'
          && config.ambiente === 'homologacao' && Number.isSafeInteger(config.revisao) && config.revisao > 0;
        const caixa = terminal.papel === 'caixa';
        return {
          schema: 1, lojaId: terminal.lojaId, terminalUid: uid, papel: terminal.papel,
          homologacaoHabilitada: homologacao,
          compatibilidadeLegada: !Object.prototype.hasOwnProperty.call(loja, 'ativacaoOperacionalV2'),
          producaoHabilitada: false,
          motivo: homologacao ? 'homologacao_autorizada' : 'homologacao_nao_autorizada',
          revisao: homologacao ? config.revisao : null,
          modulos: {
            balcao: homologacao && caixa,
            mesas: homologacao && caixa && loja.modulos?.mesas === true,
            retirada: homologacao && caixa && loja.modulos?.retirada === true,
            combos: homologacao && caixa && loja.modulos?.combos === true,
            kds: homologacao && loja.cozinha?.kds === true,
            impressao: homologacao && loja.cozinha?.impressao === true && loja.cozinha.terminalUid === uid
          }
        };
      });
    })
  };
};
