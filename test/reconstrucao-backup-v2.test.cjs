const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), vm = require('node:vm');
const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/reconstrucao-backup-v2.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
const ctx = { module: { exports: {} } }; vm.runInNewContext(code.outputFiles[0].text, ctx);
function fixture() {
  const contexto = { lojaId: 'A', terminalId: 'T', terminalUid: 'U' }, turno = { id: 'C', terminalId: 'T', terminalUid: 'U', chave: 'K', dataAbertura: '2026-09-22T10:00:00.000Z', status: 'aberto', revisao: 3 };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto, dados: { flowpdv_device_id: 'T', adega_turno_atual: JSON.stringify(turno), adega_vendas: '[]', adega_produtos: '[{"id":"p","nome":"Farinha","unidade":"g"}]' } };
  const registro = { vendaId: 'V', status: 'confirmado', criadoEm: '2026-09-22T10:01:00.000Z', recibo: { reciboId: 'R', vendaId: 'V', lojaId: 'A', turno,
    consumos: [{ legadoId: 'p', estoqueId: 'p', quantidadeMili: 1000 }], venda: { vendaId: 'V', itens: [{ legadoId: 'p', quantidade: '1', precoUnitarioCentavos: 500 }], totalCentavos: 500, recebidoDinheiroCentavos: 1000, trocoCentavos: 500 } } };
  const remoto = { versao: 1, lojaId: 'A', terminalUid: 'U', turno, registros: [registro] };
  let chamadas = 0;
  const f = { pacote, contexto, registro, remoto, turno, onCall: () => {}, run: () => ctx.module.exports.reconstruirBackupConfirmado({ pacote, contexto, ambienteTeste: true,
    call: async (nome) => { assert.equal(nome, 'consultarRecuperacaoLocalV2'); f.onCall(++chamadas); return remoto; } }) };
  return f;
}
test('reconstrói cópia, preserva valores e troco, não envia comando e não duplica no replay', async () => {
  const f = fixture(), antes = JSON.stringify(f.pacote), result = await f.run(), vendas = JSON.parse(result.pacote.dados.adega_vendas);
  assert.equal(JSON.stringify(f.pacote), antes); assert.equal(vendas.length, 1); assert.equal(vendas[0].trocoCentavos, 500);
  assert.equal(vendas[0].data, f.registro.criadoEm); assert.equal(vendas[0].recuperacaoV2.nomesOrigem, 'cadastro_backup');
  assert.equal(result.liberacaoOperacional, false); Object.assign(f.pacote, result.pacote);
  assert.equal((await f.run()).alteracoes.length, 0);
});
test('pagamento dividido e ajuste são reconstruídos a partir dos valores remotos', async () => {
  const f = fixture(); Object.assign(f.registro.recibo.venda, { totalCentavos: 600, ajuste: { descontoCentavos: 100, acrescimoCentavos: 200, motivo: 'Ajuste conferido' },
    pagamentos: [{ forma: 'Dinheiro', valorCentavos: 200 }, { forma: 'PIX', valorCentavos: 400 }], recebidoDinheiroCentavos: 1000, trocoCentavos: 800 });
  const v = JSON.parse((await f.run()).pacote.dados.adega_vendas)[0];
  assert.equal(v.total, 6); assert.equal(v.subtotal, 5); assert.equal(v.valorPago, 14); assert.equal(v.pagamentosCentavos[1].valorCentavos, 400);
});
test('recupera estorno confirmado sem devolver estoque outra vez', async () => {
  const f = fixture(); f.registro.status = 'estornado';
  f.registro.estorno = { reciboId: 'E', vendaId: 'V', lojaId: 'A', turno: f.turno, totalCentavos: 500, motivo: 'Cliente devolveu', devolverEstoque: true };
  const r = await f.run(); assert.equal(r.alteracoes.length, 2); assert.equal(JSON.parse(r.pacote.dados.adega_turno_atual).estornosLocaisV2.length, 1);
});

test('reconstrução preserva item sem estoque e recusa cobertura duplicada ou ausente', async () => {
  const f = fixture(); f.registro.recibo.consumos = []; f.registro.recibo.itensSemEstoque = ['p'];
  const v = JSON.parse((await f.run()).pacote.dados.adega_vendas)[0];
  assert.deepEqual(v.estoqueServidorV2.itensSemEstoque, ['p']);
  for (const invalid of [[], ['p', 'p'], ['outro']]) {
    f.registro.recibo.itensSemEstoque = invalid;
    await assert.rejects(f.run(), /Consumos/);
  }
});
test('pendência, dado ausente e mudança de revisão não produzem arquivo recuperado', async () => {
  for (const alterar of [f => f.registro.status = 'aguardando_gravacao_local', f => f.registro.criadoEm = null,
    f => f.pacote.dados.adega_produtos = '[]', f => f.registro.recibo.lojaId = 'outra',
    f => f.onCall = n => { if (n === 2) f.turno.revisao++; }]) {
    const f = fixture(); alterar(f); const antes = JSON.stringify(f.pacote); await assert.rejects(f.run()); assert.equal(JSON.stringify(f.pacote), antes);
  }
});
