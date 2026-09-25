/** Espelha licencas.modulos.combos → lojas_v2.modulos.combos (chaveLicencaLegada). */
function chaveDeLicenca(data, licencaId) {
  const raw = data?.chaveLicenca || licencaId || '';
  const chave = String(raw).trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{3,40}$/.test(chave) ? chave : null;
}

function combosDaLicenca(data) {
  if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'modulos')) return null;
  return data.modulos?.combos === true;
}

function lojaIdConvencao(chave) {
  return `legado-${String(chave).trim().toLowerCase()}`;
}

async function espelharCombosLicenca(db, { chave, combos, limit = 20 }) {
  if (!chave || typeof combos !== 'boolean') return { atualizadas: 0, chave: chave || null, combos: null };
  const refs = new Map();
  const porCampo = await db.collection('lojas_v2').where('chaveLicencaLegada', '==', chave).limit(limit).get();
  for (const doc of porCampo.docs) refs.set(doc.id, doc);
  const legadoId = lojaIdConvencao(chave);
  if (!refs.has(legadoId)) {
    const legado = await db.doc(`lojas_v2/${legadoId}`).get();
    if (legado.exists) refs.set(legado.id, legado);
  }
  let atualizadas = 0;
  const batch = db.batch();
  for (const doc of refs.values()) {
    const shop = doc.data() || {};
    if (shop.chaveLicencaLegada && shop.chaveLicencaLegada !== chave) continue;
    if (shop.modulos?.combos === combos) continue;
    batch.update(doc.ref, { 'modulos.combos': combos });
    atualizadas += 1;
  }
  if (atualizadas) await batch.commit();
  return { atualizadas, chave, combos };
}

module.exports = { chaveDeLicenca, combosDaLicenca, lojaIdConvencao, espelharCombosLicenca };
