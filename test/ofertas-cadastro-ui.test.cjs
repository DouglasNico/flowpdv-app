const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('cadastro de combo tem categoria de bebidas e mensagens de save', () => {
  const raw = fs.readFileSync(path.resolve(__dirname, '../src/js/ofertas-cadastro.js'), 'utf8');
  assert.match(raw, /oferta-bebidas-categoria/);
  assert.match(raw, /Selecione uma categoria/);
  assert.match(raw, /Selecione pelo menos uma bebida/);
  assert.match(raw, /Informe o valor total do combo/);
  assert.match(raw, /selecionadosBebidas/);
});
