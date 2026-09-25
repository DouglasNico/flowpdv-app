const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { chaveDeLicenca, combosDaLicenca, espelharCombosLicenca } = require('./sincronizar-combos-licenca-core.cjs');

module.exports = admin => {
  const db = admin.firestore();
  const deny = () => { throw new HttpsError('permission-denied', 'Acesso restrito.'); };

  return {
    sincronizarCombosLicencaV2: onDocumentWritten('licencas/{licencaId}', async event => {
      const after = event.data?.after;
      if (!after?.exists) return null;
      const data = after.data();
      const chave = chaveDeLicenca(data, event.params.licencaId);
      const combos = combosDaLicenca(data);
      if (!chave || combos === null) return null;
      return espelharCombosLicenca(db, { chave, combos });
    }),

    // Backfill manual (admin): útil antes do trigger existir ou após script pontual.
    espelharCombosLicencaV2: onCall({ cors: true }, async request => {
      if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
      const isAdmin = request.auth.token.admin === true
        || (await admin.auth().getUser(request.auth.uid)).customClaims?.admin === true;
      if (!isAdmin) deny();
      const data = request.data || {};
      const chave = chaveDeLicenca({ chaveLicenca: data.chaveLicenca }, data.chaveLicenca);
      if (!chave) throw new HttpsError('invalid-argument', 'Informe a chave da licença.');
      let combos = typeof data.combos === 'boolean' ? data.combos : null;
      if (combos === null) {
        const lic = (await db.doc(`licencas/${chave}`).get()).data()
          || (await db.collection('licencas').where('chaveLicenca', '==', chave).limit(1).get()).docs[0]?.data();
        combos = combosDaLicenca(lic || {});
        if (combos === null) throw new HttpsError('failed-precondition', 'Licença sem módulo combos definido.');
      }
      return espelharCombosLicenca(db, { chave, combos });
    })
  };
};
