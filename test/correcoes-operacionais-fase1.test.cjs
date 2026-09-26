const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('sangria limpa saldo ao trocar gerente por operador e erro não revela valor', () => {
  const f = fixture(), c = f.ctx.CaixaModule;
  f.ctx.StorageService.getTurnoAtual = () => ({ id: 'T' });
  c.calcularDinheiroGaveta = () => 123.45;
  const saldo = f.elementos['sangria-saldo-gaveta-display'] = { textContent: '', parentElement: {} };
  f.elementos['sangria-valor-input'] = { value: '' };
  f.ctx.AuthModule.isGerente = () => true;
  c.realizarSangria();
  assert.equal(saldo.parentElement.hidden, false);
  assert.match(saldo.textContent, /123,45/);
  f.ctx.AuthModule.isGerente = () => false;
  c.realizarSangria();
  assert.equal(saldo.parentElement.hidden, true);
  assert.equal(saldo.textContent, '');
  f.elementos['sangria-valor-input'].value = '200';
  c.confirmarSangria();
  assert.equal(f.logs.length, 0);
  assert.doesNotMatch(f.mensagens[0], /123|saldo|gaveta/);
});

function fixture() {
  const dados = new Map();
  const logs = [], mensagens = [], elementos = {};
  const ctx = {
    console, setTimeout: () => {},
    localStorage: { getItem: k => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), removeItem: k => dados.delete(k) },
    window: { App: { showToast: m => mensagens.push(m) } },
    document: { getElementById: id => elementos[id] || null },
    AuditModule: { registrarLog: (...args) => logs.push(args) },
    AuthModule: { isGerente: () => false, executarComPermissaoOuPin: (_, fn) => fn() }
  };
  ctx.window.AuditModule = ctx.AuditModule;
  for (const name of ['storage', 'estoque', 'caixa']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js', name + '.js'), 'utf8')
      .replace(/^import .*;\r?$/gm, '').replace('export const ', 'var '), ctx);
  }
  return { ctx, dados, logs, mensagens, elementos };
}

test('60 produtos: total correto após fechar modal; categoria nova, recriada e sem duplicação', async () => {
  const f = fixture(), s = f.ctx.StorageService, e = f.ctx.EstoqueModule;
  s.salvarCategorias(['Geral', 'Bebidas']);
  s.adicionarCategoriaExcluida('Petiscos');
  s.saveProdutos = produtos => { f.produtos = produtos; };
  s.getProdutos = () => [];
  s.registrarMovimentoEstoque = () => {};
  let sincronizadas;
  f.ctx.window.LicencaModule = { atualizarCategoriasNuvem: categorias => { sincronizadas = categorias; } };
  e.produtosParaImportar = Array.from({ length: 60 }, (_, i) => ({ id: String(i), categoria: ['Petiscos', ' bebidas ', 'Novidades'][i % 3], estoque: 1 }));
  e.fecharModalImportarProdutos = () => { e.produtosParaImportar = []; };
  e.renderBarraCategorias = e.renderTabelaProdutos = () => {};
  await e.confirmarImportacaoMassa();
  assert.equal(f.produtos.length, 60);
  assert.match(f.mensagens[0], /60 produtos importados/);
  assert.deepEqual(Array.from(s.getCategorias()), ['Geral', 'Bebidas', 'Petiscos', 'Novidades']);
  assert.equal(s.getCategoriasExcluidas().length, 0);
  assert.equal(f.produtos[1].categoria, 'Bebidas');
  assert.equal(sincronizadas.length, 4);
});

test('venda gravada gera auditoria uma vez; falha de gravação não gera sucesso', () => {
  const f = fixture(), s = f.ctx.StorageService;
  s.getProdutos = s.getMovimentosEstoque = () => [];
  s.getDeviceId = () => 'T1';
  s.getLicenca = () => ({ chaveLicenca: 'TESTE' });
  s.saveVenda({ id: 'V1', total: 12, itens: [], formaPagamento: 'Pix' });
  s.saveVenda({ id: 'V1', total: 12, itens: [], formaPagamento: 'Pix' });
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0][0], 'venda_realizada');
  assert.equal(f.logs[0][2].vendaId, 'V1');
  f.ctx.localStorage.setItem = () => { throw Error('disco cheio'); };
  assert.throws(() => s.saveVenda({ id: 'V2', total: 5, itens: [] }), /disco cheio/);
  assert.equal(f.logs.length, 1);
});
