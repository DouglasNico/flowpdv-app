const path = require('path');
const { randomUUID } = require('crypto');
const { createRequire } = require('module');
const local = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const { initializeApp } = local('firebase/app');
const { getAuth, signInAnonymously } = local('firebase/auth');
const { getFunctions, httpsCallable } = local('firebase/functions');

const app = initializeApp({
  apiKey: 'AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg',
  authDomain: 'aplicativo-pdv.firebaseapp.com',
  projectId: 'aplicativo-pdv',
  storageBucket: 'aplicativo-pdv.firebasestorage.app',
  appId: '1:892832112899:web:combo-smoke',
});

(async () => {
  const auth = getAuth(app);
  await signInAnonymously(auth);
  const call = (name, data) => httpsCallable(getFunctions(app, 'us-central1'), name)(data).then((r) => r.data);
  const requestId = (`combo${randomUUID()}${randomUUID()}`).replace(/-/g, '').slice(0, 40);
  const payload = {
    slug: 'burger-teste',
    requestId,
    tipo: 'retirada',
    catalogoVersao: 2,
    itens: [{
      produtoId: 'PRD-MU60B0MM-ZGRM',
      quantidade: 1,
      opcoes: [],
      variante: 'combo',
      bebidaId: 'PRD-MU60B0MN-AVIW',
      precoEsperadoCentavos: 3290,
    }],
  };
  const pedido = await call('criarPedidoPublicoV2', payload);
  console.log(JSON.stringify({ ok: true, pedido }, null, 2));
})().catch((e) => {
  console.error(JSON.stringify({
    ok: false,
    erro: e.message || String(e),
    code: e.code,
    details: e.customData || e.details,
  }, null, 2));
  process.exit(1);
});
