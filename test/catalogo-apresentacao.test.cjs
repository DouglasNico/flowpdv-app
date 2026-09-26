const { test } = require('node:test'), assert = require('node:assert/strict');
const { normalizarApresentacao, validarTamanhoCatalogo } = require('../functions/catalogo-apresentacao-core.cjs');
test('edição antiga preserva apresentação e atualização explícita pode limpar foto', () => {
  const old = { categoria: 'Lanches', descricao: 'Pão e queijo', ordem: 2, imagemUrl: 'https://res.cloudinary.com/exemplo/image/upload/v1/lanche.jpg' };
  assert.deepEqual(normalizarApresentacao({}, old), old);
  assert.equal(normalizarApresentacao({ imagemUrl: '' }, old).imagemUrl, '');
  assert.equal(normalizarApresentacao({ categoria: ' Bebidas ', ordem: 0 }).categoria, 'Bebidas');
});
test('foto recusa scripts, host enganoso, credenciais e conteúdo externo não suportado', () => {
  for (const imagemUrl of ['javascript:alert(1)', 'https://res.cloudinary.com.evil/x', 'http://res.cloudinary.com/demo/image/upload/a.jpg', 'https://user:senha@res.cloudinary.com/demo/image/upload/a.jpg', 'https://res.cloudinary.com/demo/image/fetch/https://example.com/a', 'https://res.cloudinary.com/demo/image/upload/a.jpg?key=segredo']) assert.throws(() => normalizarApresentacao({ imagemUrl }));
});
test('validação limita texto, ordem e tamanho total antes da escrita no banco', () => {
  for (const data of [{ categoria: 'a'.repeat(61) }, { descricao: 'a'.repeat(301) }, { ordem: -1 }, { ordem: 1.2 }, { descricao: 'texto\nquebra' }]) assert.throws(() => normalizarApresentacao(data));
  validarTamanhoCatalogo({ produtos: [{ nome: 'Lanche' }] });
  assert.throws(() => validarTamanhoCatalogo({ produtos: ['ç'.repeat(400000)] }), /limite/);
});
