const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');

module.exports = function acessoV2(admin) {
  const db = admin.firestore();
  const stamp = () => FieldValue.serverTimestamp();
  const hash = token => createHash('sha256').update(token).digest('hex');
  const fail = (code, message) => { throw new HttpsError(code, message); };
  function text(value, field, pattern) {
    if (typeof value !== 'string' || !pattern.test(value)) fail('invalid-argument', `Campo inválido: ${field}.`);
    return value;
  }
  const id = (value, field) => text(value, field, /^[A-Za-z0-9_-]{1,128}$/);
  const nome = value => text(value, 'nome', /^\S[^\r\n]{0,79}$/u);
  async function identity(request) {
    if (!request.auth) fail('unauthenticated', 'Autenticação necessária.');
    const account = await admin.auth().getUser(request.auth.uid);
    if (account.disabled) fail('permission-denied', 'Conta desativada.');
    return { uid: account.uid, humanoVerificado: !!account.email && account.emailVerified === true, admin: request.auth.token.admin === true && account.customClaims?.admin === true };
  }
  async function human(uid) {
    const account = await admin.auth().getUser(uid);
    if (account.disabled || !account.email || !account.emailVerified) fail('failed-precondition', 'Usuário precisa de e-mail verificado e conta ativa.');
    return account;
  }
  async function manager(tx, actor, lojaId) {
    if (actor.humanoVerificado !== true) fail('permission-denied', 'Gerência com e-mail verificado necessária.');
    const loja = await tx.get(db.doc(`lojas_v2/${lojaId}`));
    if (!loja.exists || loja.data().ativo !== true) fail('failed-precondition', 'Loja indisponível.');
    if (!actor.admin) {
      const member = await tx.get(db.doc(`lojas_v2/${lojaId}/membros/${actor.uid}`));
      if (!member.exists || member.data().ativo !== true || member.data().papel !== 'gerente' || member.data().tipo !== 'usuario') fail('permission-denied', 'Gerência da loja necessária.');
    }
  }
  function audit(tx, actor, lojaId, acao, alvoUid) {
    tx.create(db.collection('auditoria_acesso_v2').doc(), { atorUid: actor.uid, lojaId, acao, alvoUid, criadoEm: stamp() });
  }
  // O SDK envia token Firebase, não credencial IAM do Cloud Run. A autorização
  // da loja continua em identity/manager; o endpoint precisa aceitar o transporte.
  const callable = fn => onCall({ cors: true, invoker: 'public', minInstances: 0, maxInstances: 1 }, fn);

  const adminCriarLojaV2 = callable(async request => {
    const actor = await identity(request);
    if (!actor.admin) fail('permission-denied', 'Administrador necessário.');
    const data = request.data || {};
    const slug = text(data.slug, 'slug', /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/);
    const name = nome(data.nome);
    const uid = id(data.gerenteUid, 'gerenteUid');
    await human(uid);
    const lojaId = randomUUID();
    await db.runTransaction(async tx => {
      const route = db.doc(`rotas_publicas_v2/${slug}`);
      if ((await tx.get(route)).exists) fail('already-exists', 'Endereço público já reservado.');
      if ((await tx.get(db.doc(`terminais_v2/${uid}`))).exists) fail('failed-precondition', 'Terminal não pode ser gerente.');
      tx.create(db.doc(`lojas_v2/${lojaId}`), {
        nome: name,
        slug,
        ativo: true,
        ativacaoOperacionalV2: { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 1 },
        modulos: { cardapio: true, mesas: true, retirada: true, delivery: true },
        configVersao: 1,
        criadoEm: stamp()
      });
      tx.create(route, { lojaId, criadoEm: stamp() });
      tx.create(db.doc(`catalogos_publicos_v2/${slug}`), {
        nome: name,
        produtos: [],
        versao: 1,
        publicado: true,
        pausado: false,
        criadoEm: stamp()
      });
      tx.create(db.doc(`lojas_v2/${lojaId}/membros/${uid}`), { papel: 'gerente', tipo: 'usuario', ativo: true, criadoEm: stamp() });
      tx.set(db.doc(`usuarios_v2/${uid}/lojas/${lojaId}`), { lojaId, slug, nome: name, criadoEm: stamp() });
      audit(tx, actor, lojaId, 'loja_criada', uid);
    });
    return { lojaId, slug };
  });

  const criarLojaIndependenteV2 = callable(async request => {
    if (!request.auth) fail('unauthenticated', 'Faça login para criar sua loja.');
    const actor = await admin.auth().getUser(request.auth.uid);
    if (actor.disabled || !actor.email) fail('permission-denied', 'Conta de e-mail necessária.');
    const data = request.data || {};
    const slug = text(data.slug, 'slug', /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/);
    const name = nome(data.nome);
    const uid = actor.uid;
    const lojaId = randomUUID();
    await db.runTransaction(async tx => {
      const route = db.doc(`rotas_publicas_v2/${slug}`);
      if ((await tx.get(route)).exists) fail('already-exists', 'Este link/endereço já está reservado.');
      tx.create(db.doc(`lojas_v2/${lojaId}`), {
        nome: name,
        slug,
        ativo: true,
        tipoContratacao: 'cardapio_independente',
        ativacaoOperacionalV2: { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 1 },
        modulos: { cardapio: true, mesas: true, retirada: true, delivery: true },
        configVersao: 1,
        criadoEm: stamp()
      });
      tx.create(route, { lojaId, criadoEm: stamp() });
      tx.create(db.doc(`catalogos_publicos_v2/${slug}`), {
        nome: name,
        produtos: [],
        versao: 1,
        publicado: true,
        pausado: false,
        criadoEm: stamp()
      });
      tx.create(db.doc(`lojas_v2/${lojaId}/membros/${uid}`), { papel: 'gerente', tipo: 'usuario', ativo: true, criadoEm: stamp() });
      tx.set(db.doc(`usuarios_v2/${uid}/lojas/${lojaId}`), { lojaId, slug, nome: name, criadoEm: stamp() });
      audit(tx, actor, lojaId, 'loja_independente_criada', uid);
    });
    return { lojaId, slug, ok: true };
  });

  const listarMinhasLojasV2 = callable(async request => {
    const actor = await identity(request);
    const snap = await db.collection(`usuarios_v2/${actor.uid}/lojas`).get();
    return { lojas: snap.docs.map(d => d.data()) };
  });

  const adminCadastrarMembroV2 = callable(async request => {
    const actor = await identity(request);
    if (!actor.admin) fail('permission-denied', 'Administrador necessário.');
    const data = request.data || {};
    const lojaId = id(data.lojaId, 'lojaId'), uid = id(data.uid, 'uid');
    const papel = text(data.papel, 'papel', /^(gerente|caixa|cozinha)$/);
    await human(uid);
    await db.runTransaction(async tx => {
      await manager(tx, actor, lojaId);
      const ref = db.doc(`lojas_v2/${lojaId}/membros/${uid}`);
      if ((await tx.get(ref)).exists || (await tx.get(db.doc(`terminais_v2/${uid}`))).exists) fail('already-exists', 'Identidade já vinculada; alteração de papel exige fluxo próprio.');
      tx.create(ref, { papel, tipo: 'usuario', ativo: true, criadoEm: stamp() });
      audit(tx, actor, lojaId, 'membro_criado', uid);
    });
    return { ok: true };
  });

  const emitirPareamentoV2 = callable(async request => {
    const actor = await identity(request);
    const data = request.data || {};
    const lojaId = id(data.lojaId, 'lojaId'), uid = id(data.terminalUid, 'terminalUid');
    const papel = text(data.papel, 'papel', /^(caixa|cozinha)$/);
    const name = nome(data.nome);
    const target = await admin.auth().getUser(uid);
    // Identidade anônima nova criada pelo terminal; não converte conta humana em dispositivo.
    if (target.disabled || target.providerData.length || target.email || target.customClaims?.admin) fail('failed-precondition', 'Use uma identidade de terminal nova.');
    const token = randomBytes(32).toString('base64url');
    const expires = Date.now() + 10 * 60 * 1000;
    await db.runTransaction(async tx => {
      await manager(tx, actor, lojaId);
      const existing = await tx.get(db.doc(`terminais_v2/${uid}`));
      const member = await tx.get(db.doc(`lojas_v2/${lojaId}/membros/${uid}`));
      if (existing.exists || member.exists) fail('already-exists', 'Identidade já vinculada.');
      tx.create(db.doc(`pareamentos_v2/${hash(token)}`), { lojaId, terminalUid: uid, papel, nome: name, emitidoPor: actor.uid, emissorAdmin: actor.admin, expiraEm: Timestamp.fromMillis(expires), usado: false, criadoEm: stamp() });
      audit(tx, actor, lojaId, 'pareamento_emitido', uid);
    });
    return { token, expiraEm: new Date(expires).toISOString() };
  });

  const concluirPareamentoV2 = callable(async request => {
    const actor = await identity(request);
    const token = text(request.data?.token, 'token', /^[A-Za-z0-9_-]{43}$/);
    return db.runTransaction(async tx => {
      const ref = db.doc(`pareamentos_v2/${hash(token)}`);
      const snap = await tx.get(ref);
      if (!snap.exists) fail('permission-denied', 'Pareamento inválido.');
      const pairing = snap.data();
      if (pairing.terminalUid !== actor.uid) fail('permission-denied', 'Pareamento pertence a outro terminal.');
      if (pairing.usado || pairing.expiraEm.toMillis() <= Date.now()) fail('failed-precondition', 'Pareamento usado ou expirado.');
      // Revalida emissor: retirar a gerência também invalida convites pendentes.
      const issuer = await admin.auth().getUser(pairing.emitidoPor);
      if (issuer.disabled) fail('permission-denied', 'Emissor desativado.');
      await manager(tx, { uid: issuer.uid, humanoVerificado: !!issuer.email && issuer.emailVerified === true, admin: pairing.emissorAdmin && issuer.customClaims?.admin === true }, pairing.lojaId);
      const terminalRef = db.doc(`terminais_v2/${actor.uid}`);
      const memberRef = db.doc(`lojas_v2/${pairing.lojaId}/membros/${actor.uid}`);
      if ((await tx.get(terminalRef)).exists || (await tx.get(memberRef)).exists) fail('already-exists', 'Identidade já vinculada.');
      tx.create(terminalRef, { lojaId: pairing.lojaId, papel: pairing.papel, nome: pairing.nome, ativo: true, criadoEm: stamp() });
      tx.create(memberRef, { papel: pairing.papel, tipo: 'terminal', ativo: true, criadoEm: stamp() });
      tx.update(ref, { usado: true, usadoEm: stamp() });
      audit(tx, actor, pairing.lojaId, 'terminal_pareado', actor.uid);
      return { lojaId: pairing.lojaId, papel: pairing.papel };
    });
  });

  const revogarTerminalV2 = callable(async request => {
    const actor = await identity(request);
    const lojaId = id(request.data?.lojaId, 'lojaId'), uid = id(request.data?.terminalUid, 'terminalUid');
    await db.runTransaction(async tx => {
      await manager(tx, actor, lojaId);
      const ref = db.doc(`terminais_v2/${uid}`);
      const terminal = await tx.get(ref);
      if (!terminal.exists || terminal.data().lojaId !== lojaId) fail('permission-denied', 'Terminal não pertence à loja.');
      tx.update(ref, { ativo: false, revogadoEm: stamp() });
      tx.update(db.doc(`lojas_v2/${lojaId}/membros/${uid}`), { ativo: false, revogadoEm: stamp() });
      audit(tx, actor, lojaId, 'terminal_revogado', uid);
    });
    return { ok: true };
  });
  // Recupera a confirmação se a conexão caiu depois do commit do pareamento.
  // O UID vem do login validado, nunca de um campo enviado pelo cliente.
  const consultarMeuTerminalV2 = callable(async request => {
    const actor = await identity(request);
    return db.runTransaction(async tx => {
      const terminal = await tx.get(db.doc(`terminais_v2/${actor.uid}`));
      if (!terminal.exists) return { vinculado: false };
      const data = terminal.data();
      const member = await tx.get(db.doc(`lojas_v2/${data.lojaId}/membros/${actor.uid}`));
      const loja = await tx.get(db.doc(`lojas_v2/${data.lojaId}`));
      if (!data.ativo || !member.exists || !member.data().ativo || !loja.exists || !loja.data().ativo
        || member.data().tipo !== 'terminal' || !['caixa', 'cozinha', 'atendimento'].includes(data.papel)
        || member.data().papel !== data.papel) fail('permission-denied', 'Terminal revogado ou vínculo indisponível.');
      const operacionalUid = await require('./identidade-operacional-v2')(tx, db, `lojas_v2/${data.lojaId}`, data, actor.uid);
      return { vinculado: true, lojaId: data.lojaId, papel: member.data().papel,
        ...(data.chaveLicenca && data.deviceId ? { chaveLicenca: data.chaveLicenca, deviceId: data.deviceId } : {}),
        ...(operacionalUid !== actor.uid ? { identidadeOperacionalUid: operacionalUid } : {}) };
    });
  });
  return { adminCriarLojaV2, adminCadastrarMembroV2, emitirPareamentoV2, concluirPareamentoV2, revogarTerminalV2, consultarMeuTerminalV2, criarLojaIndependenteV2, listarMinhasLojasV2 };
};
