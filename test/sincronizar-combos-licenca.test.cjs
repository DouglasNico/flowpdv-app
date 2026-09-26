const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  chaveDeLicenca,
  combosDaLicenca,
  lojaIdConvencao,
  espelharCombosLicenca,
} = require('../functions/sincronizar-combos-licenca-core.cjs');

test('chave e combos da licença', () => {
  assert.equal(chaveDeLicenca({ chaveLicenca: 'lic-flow-937278' }, 'x'), 'LIC-FLOW-937278');
  assert.equal(chaveDeLicenca({}, 'LIC-FLOW-937278'), 'LIC-FLOW-937278');
  assert.equal(chaveDeLicenca({}, 'bad'), null);
  assert.equal(combosDaLicenca({}), null);
  assert.equal(combosDaLicenca({ modulos: {} }), false);
  assert.equal(combosDaLicenca({ modulos: { combos: true } }), true);
  assert.equal(lojaIdConvencao('LIC-FLOW-937278'), 'legado-lic-flow-937278');
});

test('espelha combos sem sobrescrever outros módulos', async () => {
  const updates = [];
  const shop = {
    id: 'legado-lic-flow-937278',
    data: () => ({
      chaveLicencaLegada: 'LIC-FLOW-937278',
      modulos: { cardapio: true, mesas: true, retirada: true, combos: false },
    }),
    get exists() { return true; },
    ref: { path: 'lojas_v2/legado-lic-flow-937278' },
  };
  const db = {
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({ docs: [shop] }),
        }),
      }),
    }),
    doc: () => ({
      get: async () => shop,
    }),
    batch: () => ({
      update: (ref, data) => updates.push({ ref, data }),
      commit: async () => {},
    }),
  };
  const r = await espelharCombosLicenca(db, { chave: 'LIC-FLOW-937278', combos: true });
  assert.equal(r.atualizadas, 1);
  assert.deepEqual(updates[0].data, { 'modulos.combos': true });
  const noop = await espelharCombosLicenca({
    ...db,
    collection: () => ({
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: [{
              ...shop,
              data: () => ({
                chaveLicencaLegada: 'LIC-FLOW-937278',
                modulos: { cardapio: true, combos: true },
              }),
            }],
          }),
        }),
      }),
    }),
  }, { chave: 'LIC-FLOW-937278', combos: true });
  assert.equal(noop.atualizadas, 0);
});
