const { test } = require('node:test');
const assert = require('node:assert/strict');
const configurar = require('../functions/configuracao-v2');

test('gerência preserva permissão de combos e não consegue concedê-la no payload', async () => {
  for (const allowed of [true, false, undefined]) {
    let applied;
    const records = {
      'lojas_v2/loja': { ativo: true, slug: 'loja', modulos: allowed === undefined ? {} : { combos: allowed } },
      'lojas_v2/loja/membros/gerente': { ativo: true, papel: 'gerente', tipo: 'usuario' },
      'rotas_publicas_v2/loja': { lojaId: 'loja' },
      'catalogos_publicos_v2/loja': { publicado: true, produtos: [], versao: 1 }
    };
    const tx = { get: async ref => ({ data: () => records[ref.path] }), set() {}, create() {},
      update(ref, value) { if (ref.path === 'lojas_v2/loja') applied = value; } };
    const db = { doc: path => ({ path }), collection: path => ({ doc: () => ({ path }) }), runTransaction: fn => fn(tx) };
    const api = configurar({ firestore: () => db, auth: () => ({ getUser: async () => ({ uid: 'gerente', email: 'gerente@example.test', emailVerified: true }) }) });
    await api.salvarModulosV2.run({ auth: { uid: 'gerente', token: {} }, data: {
      lojaId: 'loja', versao: 0, segmento: 'lanchonete',
      modulos: { cardapio: true, mesas: false, retirada: true, combos: !allowed },
      cozinha: { impressao: false, kds: false, papelMm: 80 }
    } });
    assert.equal(applied.modulos.combos, allowed);
  }
});
