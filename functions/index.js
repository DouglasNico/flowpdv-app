const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = admin.firestore();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "dougnvds26@gmail.com,admin@flowpdv.com.br,contato@flowpdv.com.br")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function assertAdmin(auth) {
  const email = (auth && auth.token && auth.token.email ? auth.token.email : "").toLowerCase();
  const isAdmin = Boolean(auth && (auth.token.admin === true || ADMIN_EMAILS.includes(email)));
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Acesso restrito ao administrador.");
  }
}

function limparCnpj(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizarChave(v) {
  return String(v || "").trim().toUpperCase();
}

async function encontrarLicenca({ chave, cnpj, clienteId }) {
  const chaveN = normalizarChave(chave);
  const clienteN = normalizarChave(clienteId);
  const cnpjN = limparCnpj(cnpj);

  const tentarDoc = async (id) => {
    if (!id) return null;
    const snap = await db.collection("licencas").doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, docId: snap.id, ...snap.data() };
  };

  let found = await tentarDoc(chaveN);
  if (found) return found;
  found = await tentarDoc(clienteN);
  if (found) return found;

  if (chaveN) {
    const byField = await db.collection("licencas").where("chaveLicenca", "==", chaveN).limit(1).get();
    if (!byField.empty) {
      const d = byField.docs[0];
      return { id: d.id, docId: d.id, ...d.data() };
    }
  }

  if (cnpjN && cnpjN.length >= 11 && cnpjN !== "00000000000100") {
    const all = await db.collection("licencas").get();
    for (const d of all.docs) {
      const data = d.data() || {};
      const docCnpj = limparCnpj(data.documento || data.cnpj);
      if (docCnpj && docCnpj === cnpjN) {
        return { id: d.id, docId: d.id, ...data };
      }
    }
  }

  return null;
}

exports.buscarLicenca = onCall({ cors: true }, async (request) => {
  const chave = request.data && request.data.chave;
  const cnpj = request.data && request.data.cnpj;
  const clienteId = request.data && request.data.clienteId;
  if (!chave && !cnpj && !clienteId) {
    throw new HttpsError("invalid-argument", "Informe chave, CNPJ ou clienteId.");
  }
  const licenca = await encontrarLicenca({ chave, cnpj, clienteId });
  if (!licenca) return { ok: false, licenca: null };
  return { ok: true, licenca };
});

exports.desvincularTerminal = onCall({ cors: true }, async (request) => {
  const deviceId = String((request.data && request.data.deviceId) || "").trim();
  const chaveManter = normalizarChave(request.data && request.data.chaveManter);
  if (!deviceId || !chaveManter) {
    throw new HttpsError("invalid-argument", "deviceId e chaveManter sao obrigatorios.");
  }

  const licencaAlvo = await encontrarLicenca({ chave: chaveManter, clienteId: chaveManter });
  if (!licencaAlvo) {
    throw new HttpsError("not-found", "Licenca de destino nao encontrada.");
  }

  const idsManter = new Set(
    [licencaAlvo.id, licencaAlvo.docId, licencaAlvo.chaveLicenca, licencaAlvo.clienteId, chaveManter]
      .filter(Boolean)
      .map((s) => String(s).trim().toUpperCase())
  );

  const snap = await db.collection("licencas").get();
  const batchWrites = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const dChave = String(data.chaveLicenca || "").trim().toUpperCase();
    const dId = d.id.trim().toUpperCase();
    if (idsManter.has(dId) || idsManter.has(dChave)) return;
    const lista = Array.isArray(data.terminaisAtivos) ? data.terminaisAtivos : [];
    if (!lista.some((t) => t && t.id === deviceId)) return;
    batchWrites.push(
      d.ref.set(
        {
          terminaisAtivos: lista.filter((t) => t && t.id !== deviceId),
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      )
    );
  });
  await Promise.all(batchWrites);
  return { ok: true, removidos: batchWrites.length };
});

exports.adminListarLicencas = onCall({ cors: true }, async (request) => {
  assertAdmin(request.auth);
  const snap = await db.collection("licencas").get();
  const lista = snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      chaveLicenca: data.chaveLicenca || d.id,
      nome: data.nome || data.razaoSocial || "Loja",
      razaoSocial: data.razaoSocial || data.nome || "",
      documento: data.documento || data.cnpj || "",
      cnpj: data.cnpj || data.documento || "",
      logoUrl: data.logoUrl || "",
      whatsapp: data.whatsapp || "",
      plano: data.plano || "",
      status: data.status || "ativa",
      layoutPdv: data.layoutPdv || "moderno",
      vencimento: data.vencimento || data.dataExpiracao || "",
      dataExpiracao: data.dataExpiracao || data.vencimento || "",
      limiteTerminais: data.limiteTerminais || 1,
      terminaisAtivos: data.terminaisAtivos || [],
    };
  });
  return { ok: true, lista };
});
