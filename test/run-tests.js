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
  mesclarComandas,
  consolidarProdutosComMovimentos,
  dividirEmLotes,
  carimbarAlterados,
  StorageService
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
