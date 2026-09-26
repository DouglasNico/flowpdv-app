const { test } = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), path = require('node:path');
const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/conferencia-gaveta-backup.js')], bundle: true, write: false, platform: 'node', format: 'cjs' });
const ctx = { module: { exports: {} } }; vm.runInNewContext(code.outputFiles[0].text, ctx);
const conferir = ctx.module.exports.conferirGavetaBackup;
const fixture = () => ({ id: 'T', status: 'fechado', trocoInicial: 10, fundoRestauranteCentavos: 500, totalDinheiro: 20.30,
  sangrias: [{ valor: 5 }, { valor: 0.10 }], totalSangrias: 5.10, saldoEsperado: 30.20, saldoInformado: 30, diferenca: -0.20 });
test('soma fundo e dinheiro consolidado apenas uma vez e preserva arquivo', () => {
  const t = fixture(); t.restauranteV2 = { trocoInicialCentavos: 500, formas: { dinheiro: 9999 } };
  const antes = JSON.stringify(t), r = conferir(t);
  assert.equal(r.divergencias.length, 0); assert.equal(r.pendencias.length, 0);
  assert.equal(r.saldoCalculadoCentavos, 3020); assert.equal(r.liberacaoOperacional, false); assert.equal(JSON.stringify(t), antes);
});
test('detecta retirada removida, saldo adulterado e diferença incorreta', () => {
  const t = fixture(); t.sangrias.pop(); t.diferenca = 0;
  const codes = conferir(t).divergencias.map(d => d.codigo);
  for (const code of ['gaveta_sangrias_divergentes', 'gaveta_saldo_divergente', 'gaveta_contagem_divergente']) assert.ok(codes.includes(code));
});
test('não converte valores inválidos ou frações de centavo em zero', () => {
  for (const valor of [null, '5', NaN, Infinity, -1, 0, 0.001]) {
    const t = fixture(); t.sangrias = [{ valor }]; assert.equal(conferir(t).divergencias[0].codigo, 'gaveta_sangria_invalida');
  }
  const t = fixture(); t.saldoInformado = Number.MAX_VALUE; assert.equal(conferir(t).divergencias[0].codigo, 'gaveta_valores_invalidos');
});
test('turno aberto, legado incompleto e suprimentos permanecem pendências', () => {
  assert.equal(conferir({ id: 'T', status: 'aberto' }).pendencias[0].codigo, 'gaveta_turno_aberto');
  assert.equal(conferir({ id: 'T', status: 'fechado' }).pendencias[0].codigo, 'gaveta_dados_incompletos');
  const t = fixture(); t.suprimentos = [{ valor: 10 }]; assert.equal(conferir(t).pendencias[0].codigo, 'gaveta_suprimentos_nao_conferidos');
});
