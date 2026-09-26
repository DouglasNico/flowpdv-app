const path = require('path');
const workspace = path.resolve(__dirname, '../..');
const lib = path.join(workspace, 'output/local-tools/node_modules/firebase-tools/lib');
const auth = require(path.join(lib, 'auth.js'));
const { documentData } = require('../functions/migracao-loja-core.cjs');
const { encode } = require('./preparar-burger-v2.cjs');

const LOJA = 'lojas_v2/legado-lic-flow-937278';
const LIC = 'licencas/LIC-FLOW-937278';
const CAT = 'catalogos_publicos_v2/burger-teste';
const XBURGER = 'PRD-MU60B0MM-ZGRM';
const COCA = 'PRD-MU60B0MN-AVIW';
const SUCO = 'PRD-MU60B0MN-8FHM';

async function main() {
  const mode = process.argv[2] || 'status';
  const options = { project: 'aplicativo-pdv', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(workspace) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(options, account);
  await require(path.join(lib, 'requireAuth.js')).requireAuth(options);
  const { Client } = require(path.join(lib, 'apiv2.js'));
  const api = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
  const get = async (p) => (await api.get(prefix + p)).body;

  if (mode === 'status') {
    const [lic, shop, cat] = await Promise.all([get(LIC), get(LOJA), get(CAT)]);
    const L = documentData(lic), S = documentData(shop), C = documentData(cat);
    const xb = (C.produtos || []).find((p) => p.id === XBURGER);
    console.log(JSON.stringify({
      licencaCombos: L.modulos?.combos === true,
      lojaCombos: S.modulos?.combos === true,
      xburgerCombo: xb?.combo || null,
      ofertasVersao: xb?.ofertasVersao || null,
      catalogoVersao: C.versao,
    }, null, 2));
    return;
  }

  if (mode !== 'ativar') throw new Error('Use status|ativar');

  const [licDoc, shopDoc, catDoc] = await Promise.all([get(LIC), get(LOJA), get(CAT)]);
  const lic = documentData(licDoc), shop = documentData(shopDoc), cat = documentData(catDoc);
  const { publicarOferta } = await import('../functions/ofertas-core.mjs');
  const produtosLocais = (cat.produtos || []).map((p) => ({
    id: p.id,
    nome: p.nome,
    precoVenda: (p.precoCentavos || 0) / 100,
    ativo: p.ativo !== false,
    unidade: 'un',
  }));
  const origem = {
    id: XBURGER,
    nome: 'X-BURGER',
    precoVenda: 18.9,
    ofertaCardapio: {
      combo: {
        ativo: true,
        preco: 32.9,
        fixos: [],
        bebidas: [COCA, SUCO],
      },
    },
  };
  const oferta = publicarOferta(origem, { promocao: false }, produtosLocais, { combos: true });
  const produtos = (cat.produtos || []).map((p) => {
    if (p.id !== XBURGER) return p;
    return {
      ...p,
      ofertasVersao: oferta.ofertasVersao,
      precoPromocional: oferta.precoPromocional,
      combo: oferta.combo,
      promocao: oferta.promocao,
    };
  });
  if (!produtos.some((p) => p.id === XBURGER && p.combo?.ativo)) throw new Error('Falha ao gravar combo no catálogo');

  const writes = [];
  const upd = (doc, fields) => writes.push({
    update: { name: doc.name, fields: encode(fields).mapValue.fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime: doc.updateTime },
  });

  upd(licDoc, { modulos: { ...(lic.modulos || {}), combos: true }, atualizadoEm: new Date().toISOString() });
  upd(shopDoc, { modulos: { ...(shop.modulos || {}), combos: true } });
  upd(catDoc, {
    produtos,
    versao: (cat.versao || 0) + 1,
    publicado: true,
    pausado: false,
    publicacaoManual: true,
  });

  // ficha sem estoque do lanche se faltar (bebidas já controladas)
  for (const id of [XBURGER]) {
    try {
      await get(`${LOJA}/fichas_estoque/${id}`);
    } catch {
      writes.push({
        update: {
          name: `${prefix}${LOJA}/fichas_estoque/${id}`,
          fields: encode({ semEstoque: true, consumos: [], opcoes: [] }).mapValue.fields,
        },
      });
    }
  }

  await api.post('projects/aplicativo-pdv/databases/(default)/documents:commit', { writes });
  console.log(JSON.stringify({
    ok: true,
    catalogoVersao: (cat.versao || 0) + 1,
    combo: oferta.combo,
  }, null, 2));
}

main().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
