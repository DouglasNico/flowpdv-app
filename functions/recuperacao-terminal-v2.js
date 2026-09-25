const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('invalid-argument', 'Identificação inválida.'); return value; };

module.exports = admin => {
  const db = admin.firestore();
  const executar = aplicar => onCall({ cors: true }, async request => {
    if (!request.auth) fail('unauthenticated', 'Entre como gerente para recuperar o terminal.');
    const ator = await admin.auth().getUser(request.auth.uid), data = request.data || {};
    if (ator.disabled || !ator.email || !ator.emailVerified) fail('permission-denied', 'Gerente com conta verificada necessário.');
    const lojaId = id(data.lojaId), origemUid = id(data.origemUid), destinoUid = id(data.destinoUid), base = `lojas_v2/${lojaId}`;
    if (origemUid === destinoUid) fail('invalid-argument', 'Informe terminais diferentes.');
    const destinoConta = await admin.auth().getUser(destinoUid);
    if (destinoConta.disabled) fail('permission-denied', 'Conta do destino indisponível.');
    let payload;
    if (aplicar) {
      id(data.requestId);
      if (data.confirmado !== true || !Number.isSafeInteger(data.revisaoEsperada) || data.revisaoEsperada < 0
        || data.revisaoEsperada >= Number.MAX_SAFE_INTEGER || typeof data.motivo !== 'string'
        || data.motivo.trim().length < 5 || data.motivo.trim().length > 180) fail('invalid-argument', 'Confirme o plano, revisão e motivo da recuperação.');
      payload = { origemUid, destinoUid, revisaoEsperada: data.revisaoEsperada, motivo: data.motivo.trim() };
    }
    return db.runTransaction(async tx => {
      const loja = (await tx.get(db.doc(base))).data(), membro = (await tx.get(db.doc(`${base}/membros/${ator.uid}`))).data();
      const terminalAtor = await tx.get(db.doc(`terminais_v2/${ator.uid}`));
      const administrador = request.auth.token.admin === true && ator.customClaims?.admin === true;
      if (!loja?.ativo || terminalAtor.exists || (!administrador && (membro?.ativo !== true || membro.tipo !== 'usuario' || membro.papel !== 'gerente'))) fail('permission-denied', 'Gerência desta loja necessária.');
      // Recuperação do fluxo novo ainda restrita à homologação explicitamente aderida.
      const ativacao = loja.ativacaoOperacionalV2;
      if (ativacao?.schema !== 1 || ativacao.ambiente !== 'homologacao'
        || !['suspensa', 'habilitada'].includes(ativacao.estado) || !Number.isSafeInteger(ativacao.revisao) || ativacao.revisao < 1) fail('failed-precondition', 'A loja precisa aderir à homologação antes de recuperar equipamentos.');
      const operacaoRef = aplicar ? db.doc(`${base}/recuperacoes_terminais/${data.requestId}`) : null;
      const anterior = aplicar ? (await tx.get(operacaoRef)).data() : null;
      if (anterior) {
        if (anterior.atorUid !== ator.uid || !anterior.payload || Object.keys(payload).some(k => anterior.payload[k] !== payload[k])) fail('already-exists', 'Identificador usado em outra recuperação.');
        return { ...anterior.resultado, reutilizado: true };
      }
      const origemRef = db.doc(`terminais_v2/${origemUid}`), destinoRef = db.doc(`terminais_v2/${destinoUid}`);
      const origem = (await tx.get(origemRef)).data(), destino = (await tx.get(destinoRef)).data();
      const origemMembroRef = db.doc(`${base}/membros/${origemUid}`);
      const origemMembro = (await tx.get(origemMembroRef)).data(), destinoMembro = (await tx.get(db.doc(`${base}/membros/${destinoUid}`))).data();
      if (!origem || origem.lojaId !== lojaId || origem.papel !== 'caixa' || origem.substituidoPor
        || origemMembro?.tipo !== 'terminal' || origemMembro.papel !== 'caixa'
        || destino?.lojaId !== lojaId || destino.ativo !== true || destino.papel !== 'caixa'
        || destinoMembro?.ativo !== true || destinoMembro.tipo !== 'terminal' || destinoMembro.papel !== 'caixa'
        || Object.hasOwn(destino, 'identidadeOperacionalUid') || destino.substituidoPor) fail('failed-precondition', 'Origem ou destino incompatível. Use um caixa novo autorizado nesta loja.');
      const identidadeUid = Object.hasOwn(origem, 'identidadeOperacionalUid') ? id(origem.identidadeOperacionalUid) : origemUid;
      if (Object.hasOwn(origem, 'identidadeOperacionalUid') && identidadeUid === origemUid) fail('failed-precondition', 'Delegação de origem inconsistente.');
      const identidadeRef = db.doc(`${base}/identidades_operacionais/${identidadeUid}`), identidade = (await tx.get(identidadeRef)).data();
      if (identidade && (identidade.terminalUid !== origemUid || !Number.isSafeInteger(identidade.revisao) || identidade.revisao < 1)) fail('failed-precondition', 'A identidade já foi transferida ou está inconsistente.');
      if (identidadeUid !== origemUid && !identidade) fail('failed-precondition', 'Delegação de origem indisponível.');
      for (const [colecao, campo] of [['turnos_v2', 'terminalUid'], ['vendas', 'terminalUid'], ['movimentos_financeiros', 'terminalUid']]) {
        const historico = await tx.get(db.collection(`${base}/${colecao}`).where(campo, '==', destinoUid).limit(1));
        if (!historico.empty) fail('failed-precondition', 'O destino já possui operações. Use um terminal novo para não misturar históricos.');
      }
      const slotDestino = (await tx.get(db.doc(`${base}/caixas_v2/${destinoUid}`))).data();
      if (slotDestino?.turnoChave) fail('failed-precondition', 'O destino possui turno aberto.');
      const revisao = identidade?.revisao || 0;
      const plano = { lojaId, origemUid, destinoUid, identidadeOperacionalUid: identidadeUid, revisao,
        revogaOrigem: true, copiaCredenciais: false, restauraDadosLocais: false };
      if (!aplicar) return plano;
      if (revisao !== data.revisaoEsperada) fail('failed-precondition', 'A recuperação mudou. Consulte o plano novamente.');
      const resultado = { ...plano, revisao: revisao + 1 }, stamp = FieldValue.serverTimestamp();
      tx.update(origemRef, { ativo: false, substituidoPor: destinoUid, revogadoEm: stamp });
      tx.update(origemMembroRef, { ativo: false, revogadoEm: stamp });
      tx.update(destinoRef, { identidadeOperacionalUid: identidadeUid, recuperadoDe: origemUid, recuperadoEm: stamp });
      tx.set(identidadeRef, { terminalUid: destinoUid, revisao: revisao + 1, atualizadoEm: stamp });
      tx.create(operacaoRef, { atorUid: ator.uid, payload, resultado, criadoEm: stamp });
      tx.create(db.collection('auditoria_acesso_v2').doc(), { atorUid: ator.uid, lojaId, acao: 'terminal_recuperado',
        alvoUid: destinoUid, origemUid, identidadeOperacionalUid: identidadeUid, motivo: payload.motivo, requestId: data.requestId, criadoEm: stamp });
      return { ...resultado, reutilizado: false };
    });
  });
  return { consultarPlanoRecuperacaoTerminalV2: executar(false), recuperarOperacaoTerminalV2: executar(true) };
};
