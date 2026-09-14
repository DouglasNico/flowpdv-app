/**
 * Testes das regras que sustentam o multi-terminal e o multi-loja.
 * Rode com: npm test
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const raiz = path.join(__dirname, '..');
const saida = path.join(__dirname, '.tmp', 'core.cjs');

fs.mkdirSync(path.dirname(saida), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'entry.js')],
  bundle: true,
  outfile: saida,
  format: 'cjs',
  platform: 'node',
  logLevel: 'silent'
});

// A storage.js fala com o navegador; damos o mínimo para ela rodar aqui.
class MemoriaLocal {
  constructor() { this.dados = new Map(); }
  getItem(k) { return this.dados.has(k) ? this.dados.get(k) : null; }
  setItem(k, v) { this.dados.set(k, String(v)); }
  removeItem(k) { this.dados.delete(k); }
  clear() { this.dados.clear(); }
  get length() { return this.dados.size; }
  key(i) { return Array.from(this.dados.keys())[i]; }
}

function instalarAmbienteNavegador() {
  const local = new MemoriaLocal();
  global.localStorage = local;
  global.sessionStorage = new MemoriaLocal();
  global.window = {};
  // Object.keys(localStorage) precisa enxergar as chaves guardadas.
  return new Proxy(local, {
    ownKeys: (alvo) => Array.from(alvo.dados.keys()),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
  });
}

global.localStorage = instalarAmbienteNavegador();
global.sessionStorage = new MemoriaLocal();
global.window = {};

const core = require(saida);
const {
  mesclarItensPorId,
  mesclarClientes,
  clientesPrecisamReenviar,
  encontrarClientePorDocumento,
  totalAuditoriaVisivel,
  recuarIso,
  juntarMovimentosPorId,
  ultimoAtMovimentos,
  mesclarContasPagar,
  contasPagarPrecisamReenviar,
  mesclarComandas,
  consolidarProdutosComMovimentos,
  mesclarConfigLoja,
  montarCheckpointEstoque,
  calcularDeltasInventario,
  mesclarSessaoInventario,
  dividirEmLotes,
  carimbarAlterados,
  logCaiuNaExclusao,
  vendaPertenceAoTurno,
  dinheiroLiquidoVenda,
  StorageService,
  montarPayloadNFCe,
  interpretarRespostaFocus,
  podeCancelarNFCe,
  codigoSefazPagamento,
  refDaVenda
} = core;

const testes = [];
function teste(nome, fn) { testes.push({ nome, fn }); }

const agora = Date.now();
const emMinutos = (m) => new Date(agora + m * 60000).toISOString();

// ---------------------------------------------------------------------------
// Merge por id
// ---------------------------------------------------------------------------

teste('registro mais recente vence no merge por id', () => {
  const nuvem = [{ id: 'P1', nome: 'Cerveja', preco: 8, atualizadoEm: emMinutos(0) }];
  const local = [{ id: 'P1', nome: 'Cerveja Lata', preco: 9, atualizadoEm: emMinutos(5) }];

  const [item] = mesclarItensPorId(nuvem, local);
  assert.strictEqual(item.nome, 'Cerveja Lata');
  assert.strictEqual(item.preco, 9);
});

teste('produto novo de um caixa não some por causa do outro', () => {
  const nuvem = [{ id: 'P1', nome: 'Cerveja', atualizadoEm: emMinutos(0) }];
  const local = [{ id: 'P2', nome: 'Vinho', atualizadoEm: emMinutos(1) }];

  const ids = mesclarItensPorId(nuvem, local).map(p => p.id).sort();
  assert.deepStrictEqual(ids, ['P1', 'P2']);
});

teste('CPF do cliente na nuvem nao some no notebook sem documento', () => {
  const nuvem = [{ id: 'CLI-1', nome: 'Maria', cpfCnpj: '123.456.789-09', atualizadoEm: emMinutos(0) }];
  const local = [{ id: 'CLI-1', nome: 'Maria', cpfCnpj: '', telefone: '11999999999' }];
  const [item] = mesclarClientes(nuvem, local);
  assert.strictEqual(String(item.cpfCnpj).replace(/\D/g, ''), '12345678909');
  assert.strictEqual(item.telefone, '11999999999');
});

teste('clube acha cliente pelo CPF mesmo com pontuacao', () => {
  const clientes = [{ id: 'CLI-1', nome: 'Maria', cpfCnpj: '123.456.789-09' }];
  const achado = encontrarClientePorDocumento(clientes, '12345678909');
  assert.ok(achado);
  assert.strictEqual(achado.nome, 'Maria');
  assert.strictEqual(encontrarClientePorDocumento(clientes, '000'), null);
});

teste('cliente com CPF recuperado precisa voltar para a nuvem', () => {
  const nuvem = [{ id: 'CLI-1', nome: 'Maria', cpfCnpj: '' }];
  const local = [{ id: 'CLI-1', nome: 'Maria', cpfCnpj: '123.456.789-09' }];
  assert.strictEqual(clientesPrecisamReenviar(local, nuvem), true);
  assert.strictEqual(clientesPrecisamReenviar(nuvem, nuvem), false);
});

teste('contador de auditoria ignora o documento fantasma de exclusao', () => {
  assert.strictEqual(totalAuditoriaVisivel(20, { temDocMeta: true }), 19);
  assert.strictEqual(totalAuditoriaVisivel(19, { temDocMeta: false }), 19);
  assert.strictEqual(totalAuditoriaVisivel(0, { temDocMeta: true }), 0);
});

teste('conta paga na nuvem não volta a vencida no outro caixa', () => {
  const nuvem = [{ id: 'C1', descricao: 'Aluguel', status: 'pago', dataPagamento: '2026-09-10' }];
  const local = [{ id: 'C1', descricao: 'Aluguel', status: 'pendente', dataPagamento: null }];
  const [item] = mesclarContasPagar(nuvem, local);
  assert.strictEqual(item.status, 'pago');
  assert.strictEqual(item.dataPagamento, '2026-09-10');
});

teste('baixa local mais nova vence a cópia vencida da nuvem', () => {
  const nuvem = [{ id: 'C1', status: 'pendente', atualizadoEm: emMinutos(0) }];
  const local = [{ id: 'C1', status: 'pago', dataPagamento: '2026-09-10', atualizadoEm: emMinutos(5) }];
  const [item] = mesclarContasPagar(nuvem, local);
  assert.strictEqual(item.status, 'pago');
  assert.ok(contasPagarPrecisamReenviar([item], nuvem));
});

// ---------------------------------------------------------------------------
// Estoque entre dois caixas
// ---------------------------------------------------------------------------

teste('venda no caixa 2 baixa o estoque do caixa 1 uma única vez', () => {
  const produtosNuvem = [{ id: 'P1', nome: 'Cerveja', estoque: 10, atualizadoEm: emMinutos(0) }];
  const produtosLocais = [{ id: 'P1', nome: 'Cerveja', estoque: 10, atualizadoEm: emMinutos(0) }];
  const movimento = { id: 'MOV-1', produtoId: 'P1', delta: -3, at: emMinutos(1), terminalId: 'CAIXA-2' };

  const primeira = consolidarProdutosComMovimentos({
    produtosNuvem, produtosLocais, movimentosNuvem: [movimento], movimentosLocais: []
  });
  assert.strictEqual(primeira.produtos[0].estoque, 7);
  assert.strictEqual(primeira.novosMovimentos.length, 1);

  // O mesmo movimento chegando de novo não pode descontar outra vez.
  const segunda = consolidarProdutosComMovimentos({
    produtosNuvem, produtosLocais: primeira.produtos, movimentosNuvem: [movimento], movimentosLocais: [movimento]
  });
  assert.strictEqual(segunda.produtos[0].estoque, 7);
  assert.strictEqual(segunda.novosMovimentos.length, 0);
});

teste('terminal recém-instalado não desconta movimento já embutido no saldo', () => {
  const produtosNuvem = [{ id: 'P1', nome: 'Cerveja', estoque: 7, atualizadoEm: emMinutos(2) }];
  const movimento = { id: 'MOV-1', produtoId: 'P1', delta: -3, at: emMinutos(1), terminalId: 'CAIXA-2' };

  const { produtos } = consolidarProdutosComMovimentos({
    produtosNuvem, produtosLocais: [], movimentosNuvem: [movimento], movimentosLocais: []
  });
  assert.strictEqual(produtos[0].estoque, 7);
});

teste('estoque nunca fica negativo', () => {
  const produtosNuvem = [{ id: 'P1', estoque: 1, atualizadoEm: emMinutos(0) }];
  const produtosLocais = [{ id: 'P1', estoque: 1, atualizadoEm: emMinutos(0) }];
  const movimento = { id: 'MOV-9', produtoId: 'P1', delta: -5, at: emMinutos(1) };

  const { produtos } = consolidarProdutosComMovimentos({
    produtosNuvem, produtosLocais, movimentosNuvem: [movimento], movimentosLocais: []
  });
  assert.strictEqual(produtos[0].estoque, 0);
});

function coca(estoque, extra = {}) {
  return [{ id: 'COCA', nome: extra.nome || 'Coca', preco: extra.preco || 8, estoque, controlarEstoque: true, atualizadoEm: extra.atualizadoEm || emMinutos(0) }];
}

teste('3 PDVs Coca 10 cada um vende 1 ficam 7', () => {
  const movA = { id: 'MA', produtoId: 'COCA', delta: -1, at: emMinutos(1), terminalId: 'A' };
  const movB = { id: 'MB', produtoId: 'COCA', delta: -1, at: emMinutos(2), terminalId: 'B' };
  const movC = { id: 'MC', produtoId: 'COCA', delta: -1, at: emMinutos(3), terminalId: 'C' };

  const a = consolidarProdutosComMovimentos({
    produtosNuvem: coca(9),
    produtosLocais: coca(9),
    movimentosNuvem: [movB, movC],
    movimentosLocais: [movA]
  });
  const b = consolidarProdutosComMovimentos({
    produtosNuvem: coca(9),
    produtosLocais: coca(9),
    movimentosNuvem: [movA, movC],
    movimentosLocais: [movB]
  });
  const c = consolidarProdutosComMovimentos({
    produtosNuvem: coca(9),
    produtosLocais: coca(9),
    movimentosNuvem: [movA, movB],
    movimentosLocais: [movC]
  });
  assert.strictEqual(a.produtos[0].estoque, 7);
  assert.strictEqual(b.produtos[0].estoque, 7);
  assert.strictEqual(c.produtos[0].estoque, 7);
});

teste('dois caixas vendem offline e ao juntar os movimentos ficam 10', () => {
  const movA = { id: 'MA', produtoId: 'P1', delta: -3, at: emMinutos(1), terminalId: 'A' };
  const movB = { id: 'MB', produtoId: 'P1', delta: -2, at: emMinutos(2), terminalId: 'B' };
  const prod = (estoque) => [{ id: 'P1', nome: 'Teste', estoque, controlarEstoque: true }];

  const a = consolidarProdutosComMovimentos({
    produtosNuvem: prod(15),
    produtosLocais: prod(12),
    movimentosNuvem: [movA, movB],
    movimentosLocais: [movA]
  });
  const b = consolidarProdutosComMovimentos({
    produtosNuvem: prod(15),
    produtosLocais: prod(13),
    movimentosNuvem: [movA, movB],
    movimentosLocais: [movB]
  });
  assert.strictEqual(a.produtos[0].estoque, 10);
  assert.strictEqual(b.produtos[0].estoque, 10);
});

teste('definir saldo 15 nos dois caixas nao vira 18', () => {
  const vendaA = { id: 'VA', produtoId: 'P1', delta: -3, at: emMinutos(1) };
  const vendaB = { id: 'VB', produtoId: 'P1', delta: -2, at: emMinutos(2) };
  const set15 = { id: 'SET', produtoId: 'P1', delta: 5, saldoPara: 15, at: emMinutos(10), origem: 'definir' };
  const prod = (estoque) => [{ id: 'P1', nome: 'Teste', estoque, controlarEstoque: true }];

  const b = consolidarProdutosComMovimentos({
    produtosNuvem: prod(10),
    produtosLocais: prod(13),
    movimentosNuvem: [vendaA, set15],
    movimentosLocais: [vendaB]
  });
  assert.strictEqual(b.produtos[0].estoque, 15);

  const a = consolidarProdutosComMovimentos({
    produtosNuvem: prod(13),
    produtosLocais: prod(10),
    movimentosNuvem: [vendaB, set15],
    movimentosLocais: [vendaA, vendaB]
  });
  assert.strictEqual(a.produtos[0].estoque, 15);
});

teste('definir o mesmo saldo de novo ainda gera movimento absoluto', () => {
  localStorage.clear();
  const mov = StorageService.registrarMovimentoEstoque({ produtoId: 'P1', delta: 0, origem: 'definir', saldoPara: 15 });
  assert.ok(mov, 'movimento com delta 0 e saldoPara precisa existir');
  assert.strictEqual(mov.saldoPara, 15);
  assert.strictEqual(StorageService.registrarMovimentoEstoque({ produtoId: 'P1', delta: 0, origem: 'venda' }), null);
});

teste('despesa e funcionario excluidos nao voltam com a copia antiga do outro caixa', () => {
  localStorage.clear();
  StorageService.saveContasPagar([{ id: 'C1', descricao: 'Luz', valor: 100 }, { id: 'C2', descricao: 'Agua', valor: 50 }]);
  StorageService.excluirContaPagar('C1');
  assert.deepStrictEqual(StorageService.getContasPagar().map(c => c.id), ['C2']);
  // Merge com a nuvem que ainda tem a C1
  StorageService.saveContasPagar(mesclarContasPagar([{ id: 'C1', descricao: 'Luz', valor: 100 }, { id: 'C2', valor: 50 }], StorageService.getContasPagar()));
  assert.deepStrictEqual(StorageService.getContasPagar().map(c => c.id), ['C2']);
  assert.deepStrictEqual(StorageService.getContasExcluidasIds(), ['C1']);

  StorageService.saveUsuarios([{ id: 'U1', nome: 'Ana', cargo: 'gerente', pin: '1' }, { id: 'U2', nome: 'Bia', cargo: 'operador', pin: '2' }]);
  StorageService.excluirUsuario('U2');
  StorageService.saveUsuarios(mesclarItensPorId([{ id: 'U2', nome: 'Bia', cargo: 'operador', pin: '2' }], StorageService.getUsuarios()));
  assert.deepStrictEqual(StorageService.getUsuarios().map(u => u.id), ['U1']);
});

teste('mesmo XML importado duas vezes e detectado pela chave de acesso', () => {
  localStorage.clear();
  const chave = '35240912345678000190550010000012341000012345';
  assert.strictEqual(StorageService.notaJaImportada(chave), null);
  StorageService.registrarNotaImportada(chave, '1234');
  assert.strictEqual(StorageService.notaJaImportada(chave).numero, '1234');
  // Outro caixa importou: só a conta a pagar chegou pela nuvem
  localStorage.clear();
  StorageService.saveContasPagar([{ id: 'CTA-1', chaveNFe: chave, numeroNota: '1234', criadoEm: emMinutos(-1) }]);
  assert.ok(StorageService.notaJaImportada(chave));
});

teste('troca de licenca esvazia o cache de produtos em memoria', () => {
  localStorage.clear();
  StorageService.saveProdutos([{ id: 'P1', nome: 'Loja A' }]);
  assert.strictEqual(StorageService.getProdutos().length, 1);
  StorageService.limparDadosLocaisParaNovaEmpresa({ chaveLicenca: 'LOJA-B' });
  assert.deepStrictEqual(StorageService.getProdutos(), []);
});

// ---------------------------------------------------------------------------
// Fechamento de caixa
// ---------------------------------------------------------------------------

teste('fechamento nao soma venda do outro caixa aberto no mesmo horario', () => {
  const turnoA = { id: 'T-A', dataAbertura: emMinutos(-10), vendasIds: [] };
  const turnoB = { id: 'T-B', dataAbertura: emMinutos(-10), vendasIds: [] };
  const vendaDoB = { id: 'V1', turnoId: 'T-B', data: emMinutos(-5), total: 80, formaPagamento: 'Dinheiro' };
  const vendaAntiga = { id: 'V0', data: emMinutos(-7), total: 10, formaPagamento: 'PIX' };

  assert.strictEqual(vendaPertenceAoTurno(vendaDoB, turnoA), false);
  assert.strictEqual(vendaPertenceAoTurno(vendaDoB, turnoB), true);
  assert.strictEqual(vendaPertenceAoTurno(vendaAntiga, turnoA), true, 'venda sem turnoId cai na faixa de horario');
  assert.strictEqual(vendaPertenceAoTurno({ id: 'V9', turnoId: 'T-X', data: emMinutos(1) }, { ...turnoA, vendasIds: ['V9'] }), true);
});

teste('troco nao e descontado duas vezes no dinheiro do fechamento', () => {
  const pixMaisDinheiro = {
    total: 100, troco: 10, pagamentoDividido: true,
    pagamentos: [
      { forma: 'PIX', valor: 60 },
      { forma: 'Dinheiro', valor: 40, valorEntregue: 50, troco: 10 }
    ]
  };
  assert.strictEqual(dinheiroLiquidoVenda(pixMaisDinheiro), 40);

  const legadoBruto = { total: 100, troco: 10, pagamentoDividido: true, pagamentos: [{ forma: 'Dinheiro', valor: 110 }] };
  assert.strictEqual(dinheiroLiquidoVenda(legadoBruto), 100);

  assert.strictEqual(dinheiroLiquidoVenda({ total: 25, formaPagamento: 'Dinheiro', troco: 5 }), 25);
  assert.strictEqual(dinheiroLiquidoVenda({ total: 25, formaPagamento: 'PIX' }), 0);
});

teste('consulta de movimento recua a marca d agua para nao perder venda do outro caixa', () => {
  const marca = emMinutos(5);
  const desde = recuarIso(marca, 120000);
  assert.ok(Date.parse(desde) < Date.parse(marca));
  const juntos = juntarMovimentosPorId(
    [{ id: 'MA', delta: -3 }],
    [{ id: 'MB', delta: -2 }, { id: 'MA', delta: -3 }]
  );
  assert.strictEqual(juntos.length, 2);
  assert.strictEqual(ultimoAtMovimentos([{ at: emMinutos(1) }, { at: emMinutos(3) }]), emMinutos(3));
});

teste('3 PDVs Coca offline depois trocam movimentos ficam 7', () => {
  const movA = { id: 'MA', produtoId: 'COCA', delta: -1, at: emMinutos(1), terminalId: 'A' };
  const movB = { id: 'MB', produtoId: 'COCA', delta: -1, at: emMinutos(2), terminalId: 'B' };
  const movC = { id: 'MC', produtoId: 'COCA', delta: -1, at: emMinutos(3), terminalId: 'C' };

  const a = consolidarProdutosComMovimentos({
    produtosNuvem: coca(99, { atualizadoEm: emMinutos(10) }),
    produtosLocais: coca(9),
    movimentosNuvem: [movB, movC],
    movimentosLocais: [movA]
  });
  assert.strictEqual(a.produtos[0].estoque, 7);
});

teste('catalogo mais novo da nuvem nao leva estoque junto', () => {
  const r = consolidarProdutosComMovimentos({
    produtosNuvem: coca(99, { nome: 'Coca 2L', preco: 9, atualizadoEm: emMinutos(10) }),
    produtosLocais: coca(10, { nome: 'Coca', preco: 8, atualizadoEm: emMinutos(0) }),
    movimentosNuvem: [],
    movimentosLocais: []
  });
  assert.strictEqual(r.produtos[0].estoque, 10);
  assert.strictEqual(r.produtos[0].nome, 'Coca 2L');
  assert.strictEqual(r.produtos[0].preco, 9);
});

teste('PC novo usa checkpoint e aplica so movimentos posteriores', () => {
  const checkpoint = montarCheckpointEstoque(coca(10), [{ id: 'OLD', at: emMinutos(1) }], emMinutos(1));
  const r = consolidarProdutosComMovimentos({
    produtosNuvem: coca(50, { atualizadoEm: emMinutos(0) }),
    produtosLocais: [],
    movimentosNuvem: [
      { id: 'OLD', produtoId: 'COCA', delta: -3, at: emMinutos(1) },
      { id: 'M1', produtoId: 'COCA', delta: -1, at: emMinutos(2) },
      { id: 'M2', produtoId: 'COCA', delta: -1, at: emMinutos(3) },
      { id: 'M3', produtoId: 'COCA', delta: -1, at: emMinutos(4) }
    ],
    movimentosLocais: [],
    checkpoint
  });
  assert.strictEqual(r.produtos[0].estoque, 7);
});

teste('config da loja o mais recente vence', () => {
  const r = mesclarConfigLoja(
    { nomeLoja: 'A', atualizadoEm: emMinutos(0) },
    { nomeLoja: 'B', atualizadoEm: emMinutos(5) }
  );
  assert.strictEqual(r.nomeLoja, 'B');
});

teste('inventario so ajusta produto lido', () => {
  const sessao = {
    tipo: 'somente_lidos',
    linhas: {
      COCA: { produtoId: 'COCA', nome: 'Coca', saldoDe: 10, contado: 7, leituras: [{ id: 'L1', qtd: 7 }] }
    }
  };
  const produtos = [
    { id: 'COCA', nome: 'Coca', estoque: 10, controlarEstoque: true },
    { id: 'FANTA', nome: 'Fanta', estoque: 5, controlarEstoque: true }
  ];
  const { deltas, avisos } = calcularDeltasInventario(sessao, produtos);
  assert.strictEqual(avisos.length, 0);
  assert.strictEqual(deltas.length, 1);
  assert.strictEqual(deltas[0].produtoId, 'COCA');
  assert.strictEqual(deltas[0].delta, -3);
});

teste('inventario avisa venda no meio', () => {
  const sessao = {
    linhas: {
      COCA: { produtoId: 'COCA', nome: 'Coca', saldoDe: 10, contado: 9, leituras: [{ id: 'L1', qtd: 9 }] }
    }
  };
  const { avisos } = calcularDeltasInventario(sessao, [{ id: 'COCA', estoque: 8, controlarEstoque: true }]);
  assert.strictEqual(avisos.length, 1);
  assert.strictEqual(avisos[0].motivo, 'venda_no_meio');
});

teste('dois PDVs somam leituras do mesmo SKU no inventario', () => {
  const a = {
    id: 'INV-1',
    status: 'em_andamento',
    atualizadoEm: emMinutos(1),
    linhas: {
      COCA: { produtoId: 'COCA', saldoDe: 10, leituras: [{ id: 'L-A', qtd: 3 }] }
    }
  };
  const b = {
    id: 'INV-1',
    status: 'em_andamento',
    atualizadoEm: emMinutos(2),
    linhas: {
      COCA: { produtoId: 'COCA', saldoDe: 10, leituras: [{ id: 'L-B', qtd: 4 }] }
    }
  };
  const m = mesclarSessaoInventario(a, b);
  assert.strictEqual(m.linhas.COCA.contado, 7);
  assert.strictEqual(m.linhas.COCA.leituras.length, 2);
});

// ---------------------------------------------------------------------------
// Mesas e comandas
// ---------------------------------------------------------------------------

teste('caixa 1 não apaga o pedido feito no caixa 2 em outra mesa', () => {
  const nuvem = [
    { id: 'MESA-1', status: 'ocupada', itens: [{ nome: 'Cerveja' }], atualizadoEm: emMinutos(2) },
    { id: 'MESA-2', status: 'livre', itens: [], atualizadoEm: emMinutos(0) }
  ];
  const local = [
    { id: 'MESA-1', status: 'livre', itens: [], atualizadoEm: emMinutos(0) },
    { id: 'MESA-2', status: 'ocupada', itens: [{ nome: 'Vinho' }], atualizadoEm: emMinutos(3) }
  ];

  const mescladas = mesclarComandas(nuvem, local);
  const mesa1 = mescladas.find(m => m.id === 'MESA-1');
  const mesa2 = mescladas.find(m => m.id === 'MESA-2');

  assert.strictEqual(mesa1.itens.length, 1);
  assert.strictEqual(mesa2.itens.length, 1);
  assert.strictEqual(mescladas.length, 2);
});

teste('mesa fechada não ressuscita itens antigos', () => {
  const nuvem = [{ id: 'MESA-1', status: 'ocupada', itens: [{ nome: 'Cerveja' }], atualizadoEm: emMinutos(0) }];
  const local = [{ id: 'MESA-1', status: 'livre', itens: [], atualizadoEm: emMinutos(5) }];

  const [mesa] = mesclarComandas(nuvem, local);
  assert.strictEqual(mesa.status, 'livre');
  assert.strictEqual(mesa.itens.length, 0);
});

teste('carimbo só muda em quem foi alterado', () => {
  const antes = [
    { id: 'MESA-1', status: 'livre', atualizadoEm: emMinutos(-10) },
    { id: 'MESA-2', status: 'livre', atualizadoEm: emMinutos(-10) }
  ];
  const depois = [
    { id: 'MESA-1', status: 'ocupada', atualizadoEm: emMinutos(-10) },
    { id: 'MESA-2', status: 'livre', atualizadoEm: emMinutos(-10) }
  ];

  const carimbadas = carimbarAlterados(depois, antes, emMinutos(0));
  assert.strictEqual(carimbadas[0].atualizadoEm, emMinutos(0));
  assert.strictEqual(carimbadas[1].atualizadoEm, emMinutos(-10));
});

// ---------------------------------------------------------------------------
// Limite de 1 MiB por documento
// ---------------------------------------------------------------------------

teste('lista grande é quebrada em lotes', () => {
  const lista = Array.from({ length: 1000 }, (_, i) => ({ id: 'P' + i }));
  const lotes = dividirEmLotes(lista, 300);

  assert.strictEqual(lotes.length, 4);
  assert.strictEqual(lotes[0].length, 300);
  assert.strictEqual(lotes[3].length, 100);
  assert.strictEqual(lotes.flat().length, 1000);
});

teste('lista vazia não gera lote', () => {
  assert.deepStrictEqual(dividirEmLotes([], 300), []);
});

// ---------------------------------------------------------------------------
// Isolamento entre licenças
// ---------------------------------------------------------------------------

teste('trocar de licença apaga todo dado da loja anterior', () => {
  localStorage.clear();

  const dadosDaLojaA = {
    adega_produtos: '[{"id":"P1"}]',
    adega_vendas: '[{"id":"V1"}]',
    adega_clientes: '[{"id":"C1"}]',
    adega_config: '{"nomeEmpresa":"Loja A"}',
    flowpdv_estoque_movimentos: '[{"id":"MOV-1"}]',
    flowpdv_comandas_mesas: '[{"id":"MESA-1"}]',
    flowpdv_fiscal_config: '{"cnpj":"111"}',
    flowpdv_tef_config: '{"ativo":true}',
    flowpdv_balanca_config: '{"porta":"COM3"}',
    flowpdv_usuarios: '[{"id":"USR-ADMIN"}]',
    flowpdv_pin_gerente: '4321',
    flowpdv_modulos_licenca: '{"moduloNfce":true}',
    flowpdv_ultimo_numero_venda: '187',
    flowpdv_partes_manifesto: '{"LOJA-A":{"produtos":3}}',
    flowpdv_movimentos_enviados: '["MOV-1"]',
    flowpdv_ultimo_mov_sync: '2026-01-01T00:00:00.000Z',
    'flowpdv_logs_auditoria_LOJA-A': '[{"id":"LOG-1"}]',
    'flowpdv_cache_LOJA-A': '{"produtos":[]}',
    flowpdv_device_id: 'DEV-FIXO-123'
  };
  Object.entries(dadosDaLojaA).forEach(([k, v]) => localStorage.setItem(k, v));

  StorageService.limparDadosLocaisParaNovaEmpresa({ chaveLicenca: 'LOJA-B', razaoSocial: 'Loja B' });

  Object.keys(dadosDaLojaA)
    .filter(chave => chave !== 'flowpdv_device_id')
    .forEach(chave => {
      assert.strictEqual(
        localStorage.getItem(chave),
        null,
        `sobrou dado da loja anterior em "${chave}"`
      );
    });

  // O identificador do computador precisa sobreviver: é ele que conta terminal.
  assert.strictEqual(localStorage.getItem('flowpdv_device_id'), 'DEV-FIXO-123');
});

teste('nenhum operador nasce com PIN de fábrica', () => {
  localStorage.clear();
  assert.deepStrictEqual(StorageService.getUsuarios(), []);

  localStorage.setItem('flowpdv_pin_gerente', '7391');
  const usuarios = StorageService.getUsuarios();

  assert.strictEqual(usuarios.length, 1);
  assert.strictEqual(usuarios[0].cargo, 'gerente');
  assert.strictEqual(usuarios[0].pin, '7391');
  assert.ok(!usuarios.some(u => u.pin === '1234'), 'existe usuário com PIN 1234');
});

teste('exclusao total esconde log antigo e libera log novo', () => {
  const em = '2026-09-10T12:00:00.000Z';
  const exclusao = { apagarTudo: true, em, ids: [] };
  const antigo = { id: 'LOG-1' };
  const novo = { id: 'LOG-2' };
  assert.strictEqual(logCaiuNaExclusao(antigo, exclusao, Date.parse('2026-09-09T12:00:00.000Z')), true);
  assert.strictEqual(logCaiuNaExclusao(novo, exclusao, Date.parse('2026-09-10T13:00:00.000Z')), false);
});

teste('busca acha produto mesmo sem hifen ou com acento', () => {
  const p = { id: 'P1', nome: 'COCA-COLA', codigoBarras: '7891000' };
  assert.strictEqual(StorageService.textoCombinaBusca(p.nome, 'COCA COLA'), true);
  assert.strictEqual(StorageService.produtoCombinaBusca(p, 'coca cola'), true);
  assert.strictEqual(StorageService.produtoCombinaBusca(p, 'coca-cola'), true);
  assert.strictEqual(StorageService.textoCombinaBusca('GUARANÁ ANTARCTICA', 'guarana'), true);
  assert.strictEqual(StorageService.produtoCombinaBusca(p, 'pepsi'), false);
});

teste('fila de pendentes nao ressuscita log ja apagado por id', () => {
  const exclusao = { apagarTudo: false, em: '2026-09-10T12:00:00.000Z', ids: ['LOG-X'], corteMs: 0 };
  assert.strictEqual(logCaiuNaExclusao({ id: 'LOG-X' }, exclusao, Date.parse('2026-09-10T11:00:00.000Z')), true);
  assert.strictEqual(logCaiuNaExclusao({ id: 'LOG-Y' }, exclusao, Date.parse('2026-09-10T11:00:00.000Z')), false);
});

// ---------------------------------------------------------------------------
// NFC-e (Focus NFe)
// ---------------------------------------------------------------------------

const cfgFiscal = { cnpjEmitente: '12.345.678/0001-23', cfopPadrao: '5102', ncmPadrao: '22030000', csosnPadrao: '102', serieNfce: 1 };

teste('payload da NFC-e fecha itens, desconto e pagamentos com o total da venda', () => {
  const venda = {
    id: 'V-1', numeroVenda: 12, total: 27.5, desconto: 2.5, formaPagamento: 'Dinheiro', cpfCliente: '123.456.789-09',
    itens: [
      { id: 'P1', nome: 'Cerveja', codigoBarras: '7891000100', precoUnitario: 10, quantidade: 2 },
      { id: 'P2', nome: 'Queijo', precoUnitario: 40, quantidade: 0.25, permiteFracionado: true, unidade: 'kg' }
    ]
  };
  const produtos = new Map([['P2', { id: 'P2', ncm: '04061010', cfop: '5405', csosn: '500' }]]);
  const p = montarPayloadNFCe(venda, cfgFiscal, produtos, new Date('2026-09-14T12:00:00'));

  assert.strictEqual(p.cnpj_emitente, '12345678000123');
  assert.strictEqual(p.cpf_destinatario, '12345678909');
  assert.strictEqual(p.serie, '1');
  assert.strictEqual(p.items.length, 2);
  assert.strictEqual(p.items[0].valor_bruto, 20);
  assert.strictEqual(p.items[0].codigo_ncm, '22030000');
  assert.strictEqual(p.items[1].codigo_ncm, '04061010');
  assert.strictEqual(p.items[1].cfop, '5405');
  assert.strictEqual(p.items[1].icms_situacao_tributaria, '500');
  assert.strictEqual(p.items[1].unidade_comercial, 'KG');
  assert.strictEqual(p.items[1].valor_bruto, 10);
  const desc = p.items.reduce((a, i) => a + (i.valor_desconto || 0), 0);
  assert.strictEqual(Math.round(desc * 100) / 100, 2.5);
  assert.strictEqual(p.formas_pagamento.length, 1);
  assert.strictEqual(p.formas_pagamento[0].forma_pagamento, '01');
  assert.strictEqual(p.formas_pagamento[0].valor_pagamento, 27.5);
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(p.data_emissao));
});

teste('payload da NFC-e usa os pagamentos liquidos da venda dividida', () => {
  const venda = {
    id: 'V-2', total: 50, pagamentoDividido: true,
    pagamentos: [{ forma: 'Dinheiro', valor: 20, valorEntregue: 50 }, { forma: 'Cartão de Crédito', valor: 30 }],
    itens: [{ id: 'P1', nome: 'X', precoUnitario: 50, quantidade: 1 }]
  };
  const p = montarPayloadNFCe(venda, cfgFiscal, new Map());
  assert.deepStrictEqual(p.formas_pagamento.map(f => f.forma_pagamento), ['01', '03']);
  assert.strictEqual(p.formas_pagamento.reduce((a, f) => a + f.valor_pagamento, 0), 50);
  assert.strictEqual(codigoSefazPagamento('PIX'), '17');
  assert.strictEqual(codigoSefazPagamento('Fiado'), '05');
  assert.strictEqual(codigoSefazPagamento('Cartão de Débito'), '04');
});

teste('venda sem valor ou CNPJ invalido nao vira NFC-e', () => {
  assert.throws(() => montarPayloadNFCe({ id: 'V', total: 0, itens: [{ precoUnitario: 0, quantidade: 1 }] }, cfgFiscal), /sem valor/i);
  assert.throws(() => montarPayloadNFCe({ id: 'V', total: 10, itens: [{ precoUnitario: 10, quantidade: 1 }] }, { ...cfgFiscal, cnpjEmitente: '123' }), /CNPJ/);
});

teste('resposta da Focus e traduzida para o status da venda', () => {
  const ok = interpretarRespostaFocus(201, {
    status: 'autorizado', chave_nfe: 'NFe35260912345678000123650010000000121743484310', numero: '12', serie: '1',
    protocolo: '135260000000001', qrcode_url: 'https://www.fazenda.sp.gov.br/nfce/qrcode?p=x', caminho_danfe: '/d.html'
  });
  assert.strictEqual(ok.estado, 'autorizada');
  assert.strictEqual(ok.dados.chaveAcesso, '35260912345678000123650010000000121743484310');
  assert.strictEqual(ok.dados.numeroNfce, 12);
  assert.strictEqual(ok.dados.urlConsulta, 'www.nfce.fazenda.sp.gov.br/consulta');

  assert.strictEqual(interpretarRespostaFocus(201, { status: 'erro_autorizacao', status_sefaz: '704', mensagem_sefaz: 'Rejeição: atrasada' }).estado, 'rejeitada');
  assert.strictEqual(interpretarRespostaFocus(422, { codigo: 'already_processed' }).estado, 'ja_processada');
  assert.strictEqual(interpretarRespostaFocus(401, null).estado, 'erro_config');
  assert.strictEqual(interpretarRespostaFocus(0, { codigo: 'erro_rede' }).estado, 'erro_rede');
  assert.strictEqual(interpretarRespostaFocus(503, null).estado, 'erro_rede');
  assert.strictEqual(interpretarRespostaFocus(422, { codigo: 'empresa_nao_configurada', mensagem: 'x' }).estado, 'erro_config');
});

teste('NFC-e so cancela dentro de 30 minutos da autorizacao', () => {
  const base = Date.parse('2026-09-14T12:00:00.000Z');
  const v = { statusFiscal: 'autorizada', chaveNfe: '1'.repeat(44), dataAutorizacaoNfce: '2026-09-14T12:00:00.000Z' };
  assert.strictEqual(podeCancelarNFCe(v, base + 29 * 60000), true);
  assert.strictEqual(podeCancelarNFCe(v, base + 31 * 60000), false);
  assert.strictEqual(podeCancelarNFCe({ ...v, statusFiscal: 'cancelada' }, base), false);
  assert.strictEqual(podeCancelarNFCe({ ...v, statusFiscal: 'pendente', chaveNfe: '' }, base), false);
  assert.strictEqual(refDaVenda({ id: 'V-abc.1' }), 'fp-V-abc1');
});

// ---------------------------------------------------------------------------

let falhas = 0;
testes.forEach(({ nome, fn }) => {
  try {
    fn();
    console.log(`  ok  ${nome}`);
  } catch (e) {
    falhas++;
    console.error(`  FALHOU  ${nome}`);
    console.error(`          ${e.message}`);
  }
});

console.log(`\n${testes.length - falhas}/${testes.length} testes passaram.`);
process.exit(falhas > 0 ? 1 : 0);
