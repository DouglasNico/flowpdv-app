const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
module.exports = admin => {
  const db = admin.firestore();
  const fail = (code, message) => { throw new HttpsError(code, message); };
  const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('invalid-argument', 'Identificação inválida.'); return value; };
  return {
    vincularTerminalLicenciadoV2: onCall({ cors: true, invoker: 'public', minInstances: 0, maxInstances: 1 }, async request => {
      if (!request.auth) fail('unauthenticated', 'Entre com a conta de gerente.');
      const actor = await admin.auth().getUser(request.auth.uid);
      if (actor.disabled || !actor.email || !actor.emailVerified) fail('permission-denied', 'Gerência com e-mail verificado necessária.');
      const data = request.data || {}, chave = id(data.chaveLicenca), deviceId = id(data.deviceId), uid = id(data.terminalUid);
      if (!['caixa', 'atendimento'].includes(data.tipoTerminal)) fail('invalid-argument', 'Escolha Caixa ou Atendimento nas configurações do PDV.');
      const target = await admin.auth().getUser(uid);
      if (target.disabled || target.email || target.providerData.length || target.customClaims?.admin) fail('failed-precondition', 'Identidade do computador incompatível.');
      return db.runTransaction(async tx => {
        const [migrationDoc, licenseDoc] = await Promise.all([
          tx.get(db.doc(`migracoes_v2/${chave}`)),
          tx.get(db.doc(`licencas/${chave}`))
        ]);
        const migration = migrationDoc.exists ? migrationDoc.data() : null;
        const license = licenseDoc.exists ? licenseDoc.data() : null;
        if (!license || license.status !== 'ativa') fail('failed-precondition', 'Confira a licença no PDV antes de conectar.');

        let lojaId = migration?.lojaId || license.lojaId || license.slug || `legado-${chave.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
        lojaId = id(lojaId);
        const base = `lojas_v2/${lojaId}`;
        const refs = [db.doc(base), db.doc(`${base}/membros/${actor.uid}`), db.doc(`terminais_v2/${uid}`), db.doc(`${base}/membros/${uid}`), db.doc(`${base}/terminais_pdv/${deviceId}`)];
        const [shopDoc, managerDoc, terminalDoc, memberDoc, deviceDoc] = await Promise.all(refs.map(ref => tx.get(ref)));
        const shop = shopDoc.data(), manager = managerDoc.data();
        if (!shop?.ativo) fail('failed-precondition', 'Conexão indisponível para esta loja.');
        if (shop.chaveLicencaLegada && shop.chaveLicencaLegada !== chave) fail('failed-precondition', 'Licença não corresponde a esta loja.');
        const isAdmin = actor.customClaims?.admin === true && request.auth.token.admin === true;
        if (!isAdmin && (!manager?.ativo || manager.tipo !== 'usuario' || manager.papel !== 'gerente')) fail('permission-denied', 'Esta conta não administra a loja da licença.');
        if (!license || license.status !== 'ativa') fail('failed-precondition', 'Confira a licença no PDV antes de conectar.');
        const date = license.dataExpiracao || (typeof license.vencimento === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(license.vencimento) ? license.vencimento + 'T23:59:59-03:00' : license.vencimento) : '');
        const expiry = Date.parse(date);
        if (!Number.isFinite(expiry) || expiry < Date.now()) fail('failed-precondition', 'Licença vencida ou validade indisponível.');
        const registered = (license.terminaisAtivos || []).find(t => t.id === deviceId);
        if (!registered) fail('failed-precondition', 'Ative este computador com a licença no PDV antes de conectar.');
        const papel = registered.tipoTerminal === 'atendimento' || registered.tipoTerminal === 'comanda' ? 'atendimento' : (!registered.tipoTerminal || ['caixa', 'completo'].includes(registered.tipoTerminal)) ? 'caixa' : null;
        if (papel !== data.tipoTerminal) fail('failed-precondition', 'A função deste computador ainda não foi sincronizada. Salve Caixa/Atendimento e tente novamente.');
        const result = { vinculado: true, lojaId, papel, chaveLicenca: chave, deviceId };
        if (terminalDoc.exists || memberDoc.exists || deviceDoc.exists) {
          const terminal = terminalDoc.data(), member = memberDoc.data(), device = deviceDoc.data();
          if (terminal?.ativo && terminal.lojaId === lojaId && terminal.deviceId === deviceId && terminal.chaveLicenca === chave
            && terminal.papel === papel && member?.ativo && member.tipo === 'terminal' && member.papel === papel && device?.terminalUid === uid && device.papel === papel)
            return { ...result, reutilizado: true };
          if (terminal?.ativo && terminal.lojaId === lojaId && terminal.deviceId === deviceId && terminal.chaveLicenca === chave
            && ['caixa', 'atendimento'].includes(terminal.papel) && member?.ativo && member.tipo === 'terminal'
            && member.papel === terminal.papel && device?.terminalUid === uid && device.papel === terminal.papel) {
            if (shop.ativacaoOperacionalV2?.estado !== 'suspensa') fail('failed-precondition', 'A troca de função com operação ativa precisa de conferência de pendências.');
            const stamp = FieldValue.serverTimestamp();
            for (const ref of refs.slice(3)) tx.update(ref, { papel, atualizadoEm: stamp });
            tx.create(db.collection('auditoria_acesso_v2').doc(), { lojaId, atorUid: actor.uid, alvoUid: uid, deviceId, acao: 'funcao_terminal_atualizada', papelAnterior: terminal.papel, papel, criadoEm: stamp });
            return { ...result, funcaoAtualizada: true };
          }
          fail('failed-precondition', 'Este computador já possui um vínculo diferente. Preserve o acesso e solicite a revisão do vínculo.');
        }
        const stamp = FieldValue.serverTimestamp();
        tx.create(refs[3], { lojaId, papel, deviceId, chaveLicenca: chave, nome: String(registered.hostname || 'Computador do PDV').slice(0, 80), ativo: true, criadoEm: stamp });
        tx.create(refs[4], { tipo: 'terminal', papel, ativo: true, criadoEm: stamp });
        tx.create(refs[5], { terminalUid: uid, papel, criadoEm: stamp });
        tx.create(db.collection('auditoria_acesso_v2').doc(), { lojaId, atorUid: actor.uid, alvoUid: uid, deviceId, acao: 'terminal_vinculado_pela_licenca', criadoEm: stamp });
        return result;
      });
    })
  };
};
