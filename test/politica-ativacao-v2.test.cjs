const { test } = require('node:test');
const assert = require('node:assert/strict');
const { exigirNovaOperacaoV2 } = require('../functions/politica-ativacao-v2');

test('política preserva apenas ausência legada e recusa configuração inválida ou suspensa', () => {
  assert.doesNotThrow(() => exigirNovaOperacaoV2({}));
  const valid = { schema: 1, estado: 'habilitada', ambiente: 'homologacao', revisao: 1 };
  assert.doesNotThrow(() => exigirNovaOperacaoV2({ ativacaoOperacionalV2: valid }));
  for (const config of [null, {}, {...valid, estado:'suspensa'}, {...valid, ambiente:'producao'}, {...valid,schema:2}, {...valid,revisao:0}, {...valid,revisao:1.5}]) {
    assert.throws(() => exigirNovaOperacaoV2({ ativacaoOperacionalV2: config }), { code:'failed-precondition' });
  }
});
