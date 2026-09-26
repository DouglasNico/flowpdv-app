const path = require('path');
const workspace = 'D:/Desenvolvimento-PDV/flowpdv-sistema';
const lib = path.join(workspace, 'output/local-tools/node_modules/firebase-tools/lib');
const auth = require(path.join(lib, 'auth.js'));
const { documentData } = require('../functions/migracao-loja-core.cjs');
const { encode } = require('./preparar-burger-v2.cjs');

const LOJA = 'lojas_v2/legado-lic-flow-937278';
const CAT = 'catalogos_publicos_v2/burger-teste';
const XBURGER = 'PRD-MU60B0MM-ZGRM';
const BATATA = 'PRD-MU60B0MM-OU05';

const BEBIDAS_IDS = [
  'PRD-MU60B0MN-AVIW', // Coca lata
  'PRD-MU60B0MN-BRSA', // Coca 600ml
  'PRD-MU60B0MN-J7UQ', // Guaraná lata
  'PRD-MU60B0MN-P0QN', // Fanta Laranja lata
  'PRD-MU60B0MN-N5WH', // Água mineral 500ml
  'PRD-MU60B0MN-8FHM', // Suco de laranja
  'PRD-MU60B0MN-3T1O', // Suco de maracujá
  'PRD-MU60B0MN-ZK56'  // Suco de abacaxi
];

async function main() {
  const options = { project: 'aplicativo-pdv', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(workspace) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(options, account);
  await require(path.join(lib, 'requireAuth.js')).requireAuth(options);
  const { Client } = require(path.join(lib, 'apiv2.js'));
  const api = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
  const get = async (p) => (await api.get(prefix + p)).body;

  const [shopDoc, catDoc] = await Promise.all([get(LOJA), get(CAT)]);
  const shop = documentData(shopDoc);
  const cat = documentData(catDoc);

  const { publicarOferta } = await import('../functions/ofertas-core.mjs');
  
  const idsParaAtivar = new Set([XBURGER, BATATA, ...BEBIDAS_IDS]);

  const produtosLocais = (cat.produtos || []).map((p) => {
    const ativar = idsParaAtivar.has(p.id);
    return {
      id: p.id,
      nome: p.nome,
      precoVenda: (p.precoCentavos || 0) / 100,
      ativo: ativar ? true : (p.ativo !== false),
      unidade: 'un',
    };
  });

  const batataProd = produtosLocais.find(p => p.id === BATATA);
  const fixos = [
    { produtoId: BATATA, nome: batataProd ? batataProd.nome : 'BATATA FRITA', quantidade: 1 }
  ];

  const origem = {
    id: XBURGER,
    nome: 'X-BURGER',
    precoVenda: 18.9,
    ofertaCardapio: {
      combo: {
        ativo: true,
        preco: 35.9,
        fixos: fixos,
        bebidas: BEBIDAS_IDS,
      },
    },
  };

  const oferta = publicarOferta(origem, { promocao: false }, produtosLocais, { combos: true });

  const produtos = (cat.produtos || []).map((p) => {
    if (p.id === XBURGER) {
      return {
        ...p,
        ativo: true,
        ofertasVersao: oferta.ofertasVersao,
        precoPromocional: oferta.precoPromocional,
        combo: oferta.combo,
        promocao: oferta.promocao,
      };
    }
    if (idsParaAtivar.has(p.id)) {
      return { ...p, ativo: true };
    }
    return p;
  });

  const canais = {
    delivery: true,
    retirada: true,
    mesas: true
  };

  const writes = [];
  const upd = (doc, fields) => writes.push({
    update: { name: doc.name, fields: encode(fields).mapValue.fields },
    updateMask: { fieldPaths: Object.keys(fields) },
    currentDocument: { updateTime: doc.updateTime },
  });

  upd(shopDoc, { canais, modulos: { ...(shop.modulos || {}), combos: true } });
  upd(catDoc, {
    canais,
    produtos,
    versao: (cat.versao || 0) + 1,
    publicado: true,
    pausado: false,
    publicacaoManual: true,
  });

  await api.post('projects/aplicativo-pdv/databases/(default)/documents:commit', { writes });
  console.log('BURGER TESTE ATUALIZADO COM SUCESSO NO FIRESTORE!');
  const finalXb = produtos.find(p => p.id === XBURGER);
  console.log(JSON.stringify({
    canais,
    xburgerCombo: finalXb?.combo,
    versao: (cat.versao || 0) + 1
  }, null, 2));
}

main().catch(err => {
  console.error('Erro:', err.stack || err);
  process.exit(1);
});
