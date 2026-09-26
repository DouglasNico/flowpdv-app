/**
 * Sincronização automática entre licencas e lojas_v2 no Firestore.
 * Espelha status, nome e módulos (combos, cardápio, mesas, comandas, delivery).
 */

function chaveDeLicenca(data, licencaId) {
  const raw = data?.chaveLicenca || licencaId || '';
  const chave = String(raw).trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{3,40}$/.test(chave) ? chave : null;
}

function lojaIdConvencao(chave) {
  return `legado-${String(chave).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
}

function extrairModulosLicenca(data) {
  if (!data || typeof data !== 'object') return null;
  const mod = data.modulos || {};
  const cmd = data.moduloComandas || 'mesas_e_comandas';
  const isWeb = data.tipoContratacao === 'web_only' || data.tipoContratacao === 'apenas_web' || data.tipoContratacao === 'cardapio_web' || data.tipoLicenca === 'web';
  const cardapio = isWeb || data.cardapioOnline === true || mod.cardapioOnline === true || mod.cardapio === true;
  const combos = mod.combos === true || data.combos === true;
  const mesas = cmd !== 'desativado' && mod.mesas !== false;
  const comandas = (cmd === 'mesas_e_comandas' || cmd === 'apenas_comandas') && mod.comandas !== false;
  const delivery = mod.delivery !== false && data.delivery !== false;
  const retirada = mod.retirada !== false && data.retirada !== false;
  const garcom = mod.garcom !== false && data.garcom !== false;
  return {
    cardapio,
    combos,
    mesas,
    comandas,
    delivery,
    retirada,
    garcom
  };
}

async function espelharCombosLicenca(db, { chave, combos, data, limit = 20 }) {
  if (!chave) return { atualizadas: 0, chave: null, combos: null };
  const refs = new Map();
  const porCampo = await db.collection('lojas_v2').where('chaveLicencaLegada', '==', chave).limit(limit).get();
  for (const doc of porCampo.docs) refs.set(doc.id, doc);

  const legadoId = lojaIdConvencao(chave);
  if (!refs.has(legadoId)) {
    const legado = await db.doc(`lojas_v2/${legadoId}`).get();
    if (legado.exists) refs.set(legado.id, legado);
  }

  const modulos = data ? extrairModulosLicenca(data) : (typeof combos === 'boolean' ? { combos } : null);
  const nome = data?.nomeCliente || data?.nome || data?.razaoSocial || null;
  const ativo = data ? (data.status === 'ativa') : null;

  let atualizadas = 0;
  const batch = db.batch();

  for (const doc of refs.values()) {
    const shop = doc.data() || {};
    if (shop.chaveLicencaLegada && shop.chaveLicencaLegada !== chave) continue;

    const updates = {};
    if (modulos) {
      for (const [k, v] of Object.entries(modulos)) {
        if (shop.modulos?.[k] !== v) updates[`modulos.${k}`] = v;
      }
      const canais = {
        mesas: modulos.mesas !== false,
        retirada: modulos.retirada !== false,
        delivery: modulos.delivery !== false
      };
      updates['canais'] = canais;
    }
    if (nome && shop.nome !== nome) updates['nome'] = nome;
    if (typeof ativo === 'boolean' && shop.ativo !== ativo) updates['ativo'] = ativo;

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      atualizadas += 1;
    }

    if (shop.slug) {
      const catRef = db.doc(`catalogos_publicos_v2/${shop.slug}`);
      const catSnap = await catRef.get();
      if (catSnap.exists) {
        const catUpdates = {};
        if (modulos) {
          catUpdates['canais'] = {
            mesas: modulos.mesas !== false,
            retirada: modulos.retirada !== false,
            delivery: modulos.delivery !== false
          };
          catUpdates['pausado'] = !modulos.cardapio;
        }
        if (nome && catSnap.data()?.nome !== nome) catUpdates['nome'] = nome;
        if (Object.keys(catUpdates).length > 0) {
          batch.update(catRef, catUpdates);
          atualizadas += 1;
        }
      }
    }
  }

  if (atualizadas) await batch.commit();
  return { atualizadas, chave, combos: modulos?.combos ?? combos };
}

module.exports = {
  chaveDeLicenca,
  combosDaLicenca: data => data?.modulos?.combos === true,
  lojaIdConvencao,
  espelharCombosLicenca,
  extrairModulosLicenca
};
