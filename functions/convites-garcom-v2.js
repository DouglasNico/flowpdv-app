const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message) => { throw new HttpsError(code, message); };
const emailValido = value => {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) fail('invalid-argument', 'Informe um e-mail válido.');
  return value.trim().toLowerCase();
};
module.exports = admin => {
  const db = admin.firestore();
  const authenticated = action => onCall({ cors: true }, async request => {
    if (!request.auth) fail('unauthenticated', 'Entre com sua conta.');
    const actor = await admin.auth().getUser(request.auth.uid);
    if (actor.disabled || !actor.emailVerified || !actor.email) fail('permission-denied', 'Confirme seu e-mail antes de continuar.');
    const data = request.data || {}, slug = data.slug;
    if (typeof slug !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(slug)) fail('invalid-argument', 'Loja inválida.');
    return db.runTransaction(async tx => {
      const route = (await tx.get(db.doc(`rotas_publicas_v2/${slug}`))).data();
      if (!route) fail('not-found', 'Loja não encontrada.');
      const base = `lojas_v2/${route.lojaId}`, shop = (await tx.get(db.doc(base))).data();
      const member = (await tx.get(db.doc(`${base}/membros/${actor.uid}`))).data();
      if (!shop?.ativo || (await tx.get(db.doc(`terminais_v2/${actor.uid}`))).exists) fail('permission-denied', 'Acesso indisponível.');
      return action({ tx, actor, data, slug, base, member, lojaId: route.lojaId });
    });
  });
  const gerencia = ctx => {
    if (!ctx.member?.ativo || ctx.member.tipo !== 'usuario' || ctx.member.papel !== 'gerente' || ctx.data.lojaId !== ctx.lojaId) fail('permission-denied', 'Gerência desta loja necessária.');
  };
  const audit = (tx, base, uid, acao, alvo) => tx.create(db.collection(`${base}/auditoria_convites`).doc(), { atorUid: uid, acao, alvo, criadoEm: FieldValue.serverTimestamp() });
  return {
    emitirConviteGarcomV2: authenticated(async ctx => {
      gerencia(ctx);
      const email = emailValido(ctx.data.email), chave = hash(email), secret = randomBytes(32).toString('base64url');
      const expiraEmMs = Date.now() + 24 * 60 * 60 * 1000;
      ctx.tx.set(db.doc(`${ctx.base}/convites_garcom/${chave}`), { email, hash: hash(secret), ativo: true, expiraEmMs, usadoPor: null, criadoPor: ctx.actor.uid });
      audit(ctx.tx, ctx.base, ctx.actor.uid, 'emitir', chave);
      return { token: `${chave}.${secret}`, expiraEmMs, slug: ctx.slug };
    }),
    revogarConviteGarcomV2: authenticated(async ctx => {
      gerencia(ctx);
      const chave = hash(emailValido(ctx.data.email));
      ctx.tx.set(db.doc(`${ctx.base}/convites_garcom/${chave}`), { ativo: false }, { merge: true });
      audit(ctx.tx, ctx.base, ctx.actor.uid, 'revogar', chave);
      return { revogado: true };
    }),
    aceitarConviteGarcomV2: authenticated(async ctx => {
      const token = ctx.data.token;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(token)) fail('invalid-argument', 'Convite inválido.');
      const [chave, secret] = token.split('.'), ref = db.doc(`${ctx.base}/convites_garcom/${chave}`), convite = (await ctx.tx.get(ref)).data();
      if (!convite?.ativo || typeof convite.hash !== 'string' || !/^[a-f0-9]{64}$/.test(convite.hash) || !timingSafeEqual(Buffer.from(convite.hash, 'hex'), Buffer.from(hash(secret), 'hex')) || convite.email !== ctx.actor.email.toLowerCase()) fail('permission-denied', 'Convite indisponível para esta conta.');
      if (convite.usadoPor) {
        if (convite.usadoPor !== ctx.actor.uid || !ctx.member?.ativo || ctx.member.papel !== 'garcom' || ctx.member.tipo !== 'usuario') fail('permission-denied', 'O acesso mudou. Consulte a gerência.');
        return { autorizado: true, reutilizado: true };
      }
      if (!Number.isSafeInteger(convite.expiraEmMs) || convite.expiraEmMs <= Date.now()) fail('failed-precondition', 'Convite expirou. Peça outro à gerência.');
      if (ctx.member && (ctx.member.papel !== 'garcom' || ctx.member.tipo !== 'usuario')) fail('failed-precondition', 'Conta já possui outro papel nesta loja.');
      ctx.tx.set(db.doc(`${ctx.base}/membros/${ctx.actor.uid}`), { papel: 'garcom', tipo: 'usuario', ativo: true, atualizadoEm: FieldValue.serverTimestamp() });
      ctx.tx.update(ref, { usadoPor: ctx.actor.uid, usadoEm: FieldValue.serverTimestamp() });
      audit(ctx.tx, ctx.base, ctx.actor.uid, 'aceitar', chave);
      return { autorizado: true, reutilizado: false };
    })
  };
};
