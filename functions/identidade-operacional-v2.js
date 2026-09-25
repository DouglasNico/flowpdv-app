const { HttpsError } = require('firebase-functions/v2/https');
const deny = () => { throw new HttpsError('permission-denied', 'Identidade operacional indisponível. Consulte a recuperação do terminal.'); };

// A identidade financeira é estável; autenticação continua pertencendo ao aparelho atual.
// A delegação só existe se foi criada por recuperação administrativa auditada.
module.exports = async function identidadeOperacional(tx, db, base, terminal, autenticadoUid) {
  if (terminal.substituidoPor) deny();
  if (!Object.hasOwn(terminal, 'identidadeOperacionalUid')) return autenticadoUid;
  const uid = terminal.identidadeOperacionalUid;
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || uid === autenticadoUid || terminal.papel !== 'caixa') deny();
  const registro = (await tx.get(db.doc(`${base}/identidades_operacionais/${uid}`))).data();
  if (!registro || registro.terminalUid !== autenticadoUid || !Number.isSafeInteger(registro.revisao) || registro.revisao < 1) deny();
  return uid;
};
