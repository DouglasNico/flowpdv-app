// Sem rede, DLL, impressora ou dados da loja. Exercita os módulos reais com adaptadores falsos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const target = path.join(__dirname, '.tmp', 'tef-core.cjs');
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'entry.js')], outfile: target, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
const core = require(target);
const S = core.StorageService;
class Memory {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { if (k === this.failKey) throw new Error('disco cheio'); this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i]; }
}
function reset() {
  global.localStorage = new Memory(); global.sessionStorage = new Memory();
  global.window = { App: { showToast() {} }, AuthModule: { isGerente: () => true } };
  global.navigator = { onLine: false };
  S._produtosMem = null;
  S.isModuloAtivo = () => true;
  localStorage.setItem('adega_turno_atual', JSON.stringify({ id: 'T1', status: 'aberto', vendasIds: [] }));
  localStorage.setItem('adega_produtos', JSON.stringify([{ id: 'P1', estoque: 10 }]));
  S.saveTefConfig({ habilitado: true, provedor: 'stone', stoneSecretKey: 'fake', stoneSerial: '123' });
}
function load(file, name) {
  const source = fs.readFileSync(path.join(root, 'src/js', file), 'utf8').replace(/^import\s[\s\S]*?;\s*/gm, '').replace(/export const /g, 'const ');
  const ctx = { ...core, console, crypto, localStorage, sessionStorage, window, navigator, AbortSignal,
    document: { getElementById: () => null, querySelector: () => null },
    AuditModule: { registrarLog() {} }, AuthModule: { getUsuario: () => ({ id: 'U1', nome: 'Teste' }) },
    setTimeout: cb => { queueMicrotask(cb); return 1; }, clearTimeout() {}, setInterval() {}, clearInterval() {}
  };
  vm.createContext(ctx); vm.runInContext(source + `\nglobalThis.result = ${name};`, ctx);
  return ctx.result;
}
function tef() {
  const t = load('tef.js', 'TefModule'); window.TefModule = t;
  t._status = () => {}; t._abrirModal = () => {}; t.fecharModalTef = () => {}; t.abrirPendencias = () => {};
  t._sitefConfigurado = true;
  return t;
}
const items = () => [{ id: 'P1', quantidade: 1, precoUnitario: 10 }];
const sale = () => ({ id: 'V1', turnoId: 'T1', data: new Date().toISOString(), itens: items(), total: 10, pagamentos: [{ forma: 'Crédito', valor: 10, tefInfo: { operacaoId: 'OP1' } }] });
function authorized(t, provider = 'sitef') {
  t.diario().salvar({ id: 'OP1', vendaId: 'V1', provedor: provider, valor: 10, tipo: 'Crédito', estado: 'autorizada', checkout: { carrinho: items(), turnoId: 'T1' }, dados: { valor: 10, operacaoId: 'OP1', vendaId: 'V1' }, sitef: { cupomFiscal: '123', dataFiscal: '20260914', horaFiscal: '120000' } });
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
test('modo manual não chama o provedor', async () => {
  const t = tef(); S.saveTefConfig({ habilitado: false }); let calls = 0; t._executarStone = () => calls++;
  await assert.rejects(t.iniciarTransacao({ valor: 10 }), /desativado/); assert.equal(calls, 0); assert.equal(t.diario().listar().length, 0);
});
test('simulador não autoriza venda real', async () => {
  const t = tef(); S.saveTefConfig({ habilitado: true, provedor: 'simulador' });
  await assert.rejects(t.iniciarTransacao({ valor: 10 }), /simulador/);
});
test('Stone exige serial; SiTef exige identificação válida', () => {
  assert.ok(core.validarConfigIntegracao({ habilitado: true, provedor: 'stone', stoneSecretKey: 'x' }));
  assert.ok(core.validarConfigIntegracao({ habilitado: true, provedor: 'sitef', sitefCaminhoDll: 'x', sitefIp: 'x', sitefLoja: '1', sitefTerminal: 'FP000001' }));
});
test('pagamento parcial ou excedente não quita o valor solicitado', () => {
  for (const amount of [500, 1500]) assert.equal(core.interpretarPedidoStone({ charges: [{ status: 'paid', amount }] }, 10).estado, 'aguardando');
});
test('recusa antiga não oculta nova cobrança pendente', () => {
  assert.equal(core.interpretarPedidoStone({ charges: [{ status: 'failed' }, { status: 'pending' }] }, 10).estado, 'aguardando');
});
test('soma de cobranças pagas precisa coincidir em centavos', () => {
  const r = core.interpretarPedidoStone({ charges: [{ id: 'A', status: 'paid', amount: 400 }, { id: 'B', status: 'paid', amount: 600 }] }, 10);
  assert.equal(r.estado, 'aprovada'); assert.equal(r.dados.valor, 10); assert.deepEqual(r.dados.chargeIds, ['A', 'B']);
});
test('disco cheio no diário impede envio de cobrança', async () => {
  const t = tef(); let calls = 0; t._executarStone = () => calls++; localStorage.failKey = t.diario().key;
  await assert.rejects(t.iniciarTransacao({ valor: 10, vendaId: 'V1', checkout: {} }), /disco cheio/); assert.equal(calls, 0); assert.equal(t.transacaoAtiva, null);
});
test('pagamento incerto bloqueia outra cobrança', async () => {
  const t = tef(); t.diario().salvar({ id: 'X', estado: 'incerta' });
  await assert.rejects(t.iniciarTransacao({ valor: 10, vendaId: 'V1', checkout: {} }), /pendente/);
});
test('diário corrompido bloqueia integração', async () => {
  const t = tef(); localStorage.setItem(t.diario().key, '{');
  await assert.rejects(t.iniciarTransacao({ valor: 10, vendaId: 'V1', checkout: {} }));
});
test('confirmação SiTef nunca precede gravação da venda', async () => {
  const t = tef(); authorized(t); let calls = 0; window.electronAPI = { sitefFinalizar: async () => { calls++; return true; } };
  await assert.rejects(t.confirmarVenda(sale()), /Grave/); assert.equal(calls, 0);
});
test('falha no meio da gravação recupera venda e estoque uma única vez', () => {
  localStorage.failKey = 'adega_produtos'; assert.throws(() => S.saveVenda(sale()), /disco cheio/); assert.equal(S.temVendaPendente(), true);
  localStorage.failKey = null; S.recuperarVendaPendente(); S.saveVenda(sale());
  assert.equal(S.getVendas().length, 1); assert.equal(S.getProdutos()[0].estoque, 9); assert.equal(S.getMovimentosEstoque().length, 1); assert.equal(S.temVendaPendente(), false);
});
test('falha antes de criar diário não altera venda nem estoque', () => {
  localStorage.failKey = 'flowpdv_commit_venda'; assert.throws(() => S.saveVenda(sale()));
  assert.equal(S.getVendas().length, 0); assert.equal(S.getProdutos()[0].estoque, 10);
});
test('retorno falso da DLL mantém confirmação recuperável', async () => {
  const t = tef(); authorized(t); S.saveVenda(sale()); window.electronAPI = { sitefFinalizar: async () => false };
  await assert.rejects(t.confirmarVenda(sale()), /pendente/); assert.equal(t.diario().obter('OP1').estado, 'confirmando');
  window.electronAPI.sitefFinalizar = async () => true; await t.consultarOperacao('OP1'); assert.equal(t.diario().pendentes().length, 0);
});
test('confirmação concluída não repete chamada nativa', async () => {
  const t = tef(); authorized(t); S.saveVenda(sale()); let calls = 0; window.electronAPI = { sitefFinalizar: async () => { calls++; return true; } };
  await t.confirmarVenda(sale()); await t.confirmarVenda(sale()); assert.equal(calls, 1);
});
test('lançamento TEF duplicado ou carrinho alterado é rejeitado', () => {
  const t = tef(); authorized(t); const v = sale(); v.pagamentos.push(v.pagamentos[0]); assert.throws(() => t.validarPagamentos(v), /duplicado/);
  v.pagamentos.pop(); v.itens[0].quantidade = 2; assert.throws(() => t.validarPagamentos(v), /Carrinho/);
});
test('falha ao estornar conserva pendência', async () => {
  const t = tef(); authorized(t); window.electronAPI = { sitefFinalizar: async () => false };
  await assert.rejects(t.cancelarOperacao('OP1'), /Estorno/); assert.equal(t.diario().pendentes().length, 1);
});
test('recuperação Stone reutiliza payload e chave; após prazo não cria pedido', async () => {
  const t = tef(); const op = { id: 'X', vendaId: 'V1', provedor: 'stone', valor: 10, estado: 'incerta', criadoEm: new Date().toISOString(), pedido: { code: 'X' } }; t.diario().salvar(op);
  let calls = 0; t._httpStone = async (method, url, body, key) => { calls++; assert.equal(method, 'POST'); assert.equal(key, 'X'); assert.equal(body.code, 'X'); return { status: 200, body: { id: 'order_X', charges: [{ status: 'paid', amount: 1000 }] } }; };
  await t.consultarOperacao('X'); assert.equal(t.diario().obter('X').estado, 'autorizada');
  t.diario().salvar({ ...op, pedidoId: null, criadoEm: new Date(Date.now() - 300000).toISOString() }); await assert.rejects(t.consultarOperacao('X'), /Prazo/); assert.equal(calls, 1);
});
test('operações concorrentes de recuperação são bloqueadas', async () => {
  const t = tef(); authorized(t); S.saveVenda(sale()); let done; window.electronAPI = { sitefFinalizar: () => new Promise(r => { done = r; }) };
  const first = t.confirmarVenda(sale()); await assert.rejects(t.consultarOperacao('OP1'), /Aguarde/); done(true); await first;
});
test('fechar/limpar o caixa preserva pagamento autorizado', () => {
  const t = tef(); authorized(t); const p = load('pdv.js', 'PdvModule'); window.PdvModule = p; p.tefVendaId = 'V1'; p.carrinho = items(); p.pagamentosLancados = sale().pagamentos;
  p.fecharModalPagamento(); p.limparCarrinho(); assert.equal(p.carrinho.length, 1); assert.equal(p.pagamentosLancados.length, 1);
});
test('falha na impressora SiTef não confirma a transação', async () => {
  const t = tef(); t.transacaoAtiva = { id: 'OP1', vendaId: 'V1', valor: 10, tipo: 'Crédito', parcelas: 1 }; t.diario().salvar({ id: 'OP1', estado: 'iniciada' });
  const flags = []; window.electronAPI = { sitefExecutar: async () => ({ retorno: 0, campos: { 121: 'via' } }), sitefFinalizar: async p => { flags.push(p.confirma); return true; } };
  window.ThermalPrintModule = { imprimirComprovanteTef: async () => { throw new Error('impressora offline'); } };
  await t._executarSitef({ valor: 10 }); assert.deepEqual(flags, [false]); assert.equal(t.diario().obter('OP1').estado, 'recusada');
});
function checkout() {
  const p = load('pdv.js', 'PdvModule'); window.PdvModule = p;
  p.tefVendaId = 'V1'; p.carrinho = items(); p.pagamentosLancados = sale().pagamentos;
  p.calcularTotais = () => ({ total: 10, subtotal: 10, desconto: 0 });
  for (const m of ['renderCarrinho', 'renderMiniDashboardTurno', 'tocarSomBeep', 'abrirModalSucessoImpressao', 'focarInputLeitor', 'agendarEmissaoFiscal']) p[m] = () => {};
  return p;
}
test('caixa conclui venda manual sem comunicação TEF', async () => {
  const t = tef(); t._httpStone = () => { throw new Error('não deve comunicar'); };
  const p = checkout(); p.pagamentosLancados = [{ forma: 'Crédito', valor: 10 }];
  await p.executarFinalizacaoVendaCompleta();
  assert.equal(S.getVendas().length, 1); assert.equal(S.getProdutos()[0].estoque, 9); assert.equal(p.carrinho.length, 0);
});
test('caixa grava antes de confirmar e mantém pendência se a DLL falhar', async () => {
  const t = tef(); authorized(t); const p = checkout();
  window.electronAPI = { sitefFinalizar: async () => { assert.equal(S.getVendas().length, 1); assert.equal(S.temVendaPendente(), false); return false; } };
  await p.executarFinalizacaoVendaCompleta();
  assert.equal(S.getVendas().length, 1); assert.equal(t.diario().obter('OP1').estado, 'confirmando'); assert.equal(p.carrinho.length, 0);
});
test('caixa não confirma TEF quando a gravação falha', async () => {
  const t = tef(); authorized(t); const p = checkout(); let calls = 0;
  window.electronAPI = { sitefFinalizar: async () => { calls++; return true; } }; localStorage.failKey = 'adega_produtos';
  await p.executarFinalizacaoVendaCompleta(); assert.equal(calls, 0); assert.equal(p.carrinho.length, 1); assert.equal(S.temVendaPendente(), true);
  localStorage.failKey = null; await p.executarFinalizacaoVendaCompleta();
  assert.equal(calls, 1); assert.equal(S.getVendas().length, 1); assert.equal(S.getProdutos()[0].estoque, 9);
});
test('recuperação por ID Stone rejeita pedido de outra venda', async () => {
  const t = tef(); t.diario().salvar({ id: 'X', provedor: 'stone', valor: 10, estado: 'incerta' });
  t._httpStone = async () => ({ status: 200, body: { id: 'O', code: 'outra', amount: 1000 } });
  await assert.rejects(t.vincularPedidoStone('X', 'O'), /não correspondem/); assert.equal(t.diario().obter('X').pedidoId, undefined);
});
test('ponte SiTef atende cancelamento enquanto aguarda chamada nativa', async () => {
  const handlers = new Map(); let continuarCb; let continuationCalls = 0;
  const fakeKoffi = { load: () => ({ func: signature => ({ async: (...args) => {
    const cb = args.pop();
    if (signature.includes('ConfiguraInt')) { assert.equal(args[0].at(-1), 0); queueMicrotask(() => cb(null, 0)); }
    else if (signature.includes('IniciaFuncao')) queueMicrotask(() => cb(null, 10000));
    else if (signature.includes('ContinuaFuncao')) {
      continuationCalls++;
      if (continuationCalls === 1) { args[0][0] = 23; continuarCb = () => cb(null, 10000); }
      else { assert.equal(args[6], -1); queueMicrotask(() => cb(null, -2)); }
    } else queueMicrotask(() => cb(null, 1));
  } }) }) };
  const ctx = { Buffer, console, setTimeout, clearTimeout, module: { exports: {} },
    process: { cwd: () => root, chdir() {} },
    require: name => name === 'koffi' ? fakeKoffi : name === 'fs' ? { existsSync: () => true } : require(name)
  };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'sitef-bridge.js'), 'utf8'), ctx);
  const wc = { mainFrame: {}, send() {} }; const win = { webContents: wc, isDestroyed: () => false };
  ctx.module.exports.registrar({ handle: (name, fn) => handlers.set(name, fn) }, () => win);
  const event = { sender: wc, senderFrame: wc.mainFrame };
  const call = (name, data) => handlers.get(name)(event, data);
  assert.equal((await call('sitef-configurar', { caminhoDll: 'fake.dll', ipServidor: '127.0.0.1', codigoLoja: '00000001', codigoTerminal: 'FP000001' })).ok, true);
  const running = call('sitef-executar', { funcao: 3, valor: '10,00' });
  while (!continuarCb) await new Promise(r => setImmediate(r));
  assert.equal(await call('sitef-cancelar'), true); assert.equal(await call('sitef-pinpad-presente'), false);
  continuarCb(); const result = await running; assert.equal(result.retorno, -2); assert.equal(result.cancelado, true);
  assert.throws(() => handlers.get('sitef-executar')({ sender: {} }, {}), /Origem/);
});
test('Stone envia chave idempotente e só encerra após venda gravada', async () => {
  const t = tef(); const calls = [];
  window.electronAPI = { httpJson: async req => {
    calls.push(req);
    if (req.method === 'POST') {
      assert.equal(req.headers['Idempotency-key'], req.body.code);
      assert.equal(t.diario().obter(req.body.code).estado, 'iniciada');
      return { status: 200, body: { id: 'order_X', charges: [{ id: 'ch_X', status: 'paid', amount: 1000 }] } };
    }
    assert.equal(req.method, 'PATCH'); assert.equal(S.getVendas().length, 1); return { status: 200, body: {} };
  } };
  const dados = await t.iniciarTransacao({ valor: 10, tipo: 'Crédito', vendaId: 'V1', checkout: { carrinho: items(), total: 10 }, itens: items() });
  assert.equal(calls.length, 1); const v = sale(); v.pagamentos[0].tefInfo = dados;
  S.saveVenda(v); await t.confirmarVenda(v); assert.equal(calls.length, 2); assert.equal(t.diario().pendentes().length, 0);
});
(async () => {
  let passed = 0;
  for (const [name, fn] of tests) {
    reset(); try { await fn(); passed++; console.log('  ok ', name); } catch (e) { console.error(' FALHOU ', name, e); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${tests.length} testes TEF passaram.`);
})();
