const { test } = require('node:test');
const assert = require('node:assert/strict');
const { linhasDeEstoque } = require('../functions/composicao-pedido-core.cjs');
const combo = () => ({ produtoId: 'lanche', nome: 'Lanche', variante: 'combo', ofertasVersao: 1,
  bebidaId: 'bebida', quantidade: 2, totalCentavos: 6180,
  opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', quantidade: 1 }],
  componentes: [{ produtoId: 'lanche', quantidade: 1 }, { produtoId: 'batata', quantidade: 2 }, { produtoId: 'bebida', quantidade: 1 }] });
test('combo expande quantidades sem duplicar o lanche ou aplicar adicionais aos acompanhamentos', () => {
  const linha = combo(), original = structuredClone(linha);
  const result = linhasDeEstoque([linha]);
  assert.deepEqual(result.map(l => [l.produtoId, l.quantidade, l.opcoes.length]), [['lanche', 2, 1], ['batata', 4, 0], ['bebida', 2, 0]]);
  assert.deepEqual(linha, original);
  const avulso = { produtoId: 'bebida', quantidade: 3 };
  assert.deepEqual(linhasDeEstoque([avulso]), [avulso]);
});
test('rejeita composição incompleta, raiz duplicada, bebida divergente e quantidade inválida', () => {
  for (const patch of [{ ofertasVersao: 2 }, { quantidade: 1.5 }, { bebidaId: 'outra' }, { componentes: [] },
    { componentes: [{ produtoId: 'lanche', quantidade: 2 }, { produtoId: 'bebida', quantidade: 1 }] },
    { componentes: [{ produtoId: 'lanche', quantidade: 1 }, { produtoId: 'lanche', quantidade: 1 }, { produtoId: 'bebida', quantidade: 1 }] }]) {
    assert.throws(() => linhasDeEstoque([{ ...combo(), ...patch }]));
  }
  assert.throws(() => linhasDeEstoque([{ ...combo(), variante: 'individual' }]), /sem identificação/);
});
