const { test } = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), path = require('node:path');
const result = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/conferencia-backup-v2.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
const ctx = { module: { exports: {} } }; vm.runInNewContext(result.outputFiles[0].text, ctx);
const conferir = ctx.module.exports.conferirBackupServidor;
const inventario = ctx.module.exports.conferirInventarioBackup;
const contexto = { lojaId: 'A', terminalId: 'T', terminalUid: 'UID' };
function fixture() {
  const turno = { id: 'C', terminalId: 'T', dataAbertura: '2026-09-21T10:00:00.000Z', status: 'aberto' };
  const venda = { id: 'V', turnoId: 'C', terminalId: 'T', total: 5, itens: [{ id: 'p', quantidade: 1, precoUnitario: 5 }], estoqueServidorV2: { reciboId: 'R', lojaId: 'A' } };
  const payload = { vendaId: 'V', itens: [{ legadoId: 'p', quantidade: '1', precoUnitarioCentavos: 500 }], totalCentavos: 500 };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto, dados: { flowpdv_device_id: 'T', adega_turno_atual: JSON.stringify(turno), adega_vendas: JSON.stringify([venda]) } };
  const remoto = { versao: 1, lojaId: 'A', terminalUid: 'UID', turno: { ...turno, chave: 'K', revisao: 3 }, registros: [{ vendaId: 'V', status: 'confirmado', recibo: { reciboId: 'R', turno: { chave: 'K' }, venda: payload } }] };
  return { pacote, remoto, payload, turno, run: () => conferir({ pacote, contexto, ambienteTeste: true, call: async (nome, data) => { assert.equal(nome, 'consultarRecuperacaoLocalV2'); assert.equal(data.turno.id, 'C'); return remoto; } }) };
}
test('conferência coerente é somente leitura e nunca libera operação automaticamente', async () => {
  const f = fixture(), antes = JSON.stringify(f.pacote), r = await f.run();
  assert.equal(r.semDivergencias, true); assert.equal(r.liberacaoOperacional, false); assert.equal(r.escopo, 'turno_atual');
  assert.equal(JSON.stringify(f.pacote), antes);
});
test('venda posterior ao backup é apontada; backup não substitui registro remoto', async () => {
  const f = fixture(); f.pacote.dados.adega_vendas = '[]';
  const r = await f.run(); assert.equal(r.divergencias[0].codigo, 'venda_ausente_no_backup');
});

test('comprovante de outro turno não valida venda ou tentativa mesmo com valores iguais', async () => {
  const f = fixture(); f.remoto.registros[0].recibo.turno.chave = 'OUTRO';
  assert.ok((await f.run()).divergencias.some(d => d.codigo === 'venda_divergente'));
  f.pacote.dados.adega_vendas = '[]'; f.pacote.dados.flowpdv_venda_servidor_pendente = JSON.stringify({ lojaId: 'A', payload: { ...f.payload, turno: f.turno } });
  assert.ok((await f.run()).divergencias.some(d => d.codigo === 'tentativa_divergente'));
});
test('total local adulterado, estado de turno alterado e resposta incompleta são apontados', async () => {
  const f = fixture(), vendas = JSON.parse(f.pacote.dados.adega_vendas); vendas[0].total = 4;
  f.pacote.dados.adega_vendas = JSON.stringify(vendas); assert.equal((await f.run()).divergencias[0].codigo, 'venda_divergente');
  f.remoto.turno.status = 'fechado'; assert.ok((await f.run()).divergencias.some(d => d.codigo === 'estado_turno_divergente'));
  f.remoto.registros = []; assert.ok((await f.run()).divergencias.some(d => d.codigo === 'resposta_incompleta'));
});
test('pendência preservada exige conferência mesmo com recibo idêntico', async () => {
  const f = fixture(); f.pacote.dados.adega_vendas = '[]';
  f.pacote.dados.flowpdv_venda_servidor_pendente = JSON.stringify({ lojaId: 'A', payload: { ...f.payload, turno: f.turno } });
  f.remoto.registros[0].status = 'aguardando_gravacao_local';
  const r = await f.run(); assert.equal(r.semDivergencias, true); assert.equal(r.pendencias[0].codigo, 'venda_a_conferir'); assert.equal(r.liberacaoOperacional, false);
});
test('outra identidade e registros repetidos são recusados', async () => {
  const f = fixture(); f.remoto.terminalUid = 'OUTRO'; await assert.rejects(f.run(), /identidade/);
  f.remoto.terminalUid = 'UID'; f.remoto.registros.push(f.remoto.registros[0]); await assert.rejects(f.run(), /repetidos/);
});
test('estorno posterior ao backup exige reconciliar devolução', async () => {
  const f = fixture(); f.remoto.registros[0].status = 'estornado';
  f.remoto.registros[0].estorno = { reciboId: 'E', turno: { chave: 'K' }, totalCentavos: 500 };
  assert.ok((await f.run()).divergencias.some(d => d.codigo === 'estorno_ausente_no_backup'));
});
test('devolução confirmada com resposta perdida continua pendente no diagnóstico', async () => {
  const f = fixture(); f.remoto.registros[0].status = 'estornado';
  f.remoto.registros[0].estorno = { reciboId: 'E', turno: { chave: 'K' }, totalCentavos: 500, motivo: 'Cliente devolveu', devolverEstoque: true };
  f.pacote.dados.flowpdv_estorno_local_pendente = JSON.stringify({ lojaId: 'A', totalCentavos: 500, payload: { vendaId: 'V', turno: f.turno, motivo: 'Cliente devolveu', devolverEstoque: true } });
  const r = await f.run(); assert.equal(r.semDivergencias, true); assert.equal(r.pendencias[0].codigo, 'estorno_a_conferir');
  f.remoto.registros[0].estorno.totalCentavos = 400;
  assert.ok((await f.run()).divergencias.some(d => d.codigo === 'tentativa_estorno_divergente'));
});
test('devolução local sem registro remoto e vendas repetidas não passam despercebidas', async () => {
  const f = fixture(); f.turno.estornosLocaisV2 = [{ reciboId: 'E', vendaId: 'V', lojaId: 'A' }];
  f.pacote.dados.adega_turno_atual = JSON.stringify(f.turno);
  assert.ok((await f.run()).divergencias.some(d => d.codigo === 'estorno_local_sem_confirmacao_remota'));
  const vendas = JSON.parse(f.pacote.dados.adega_vendas); f.pacote.dados.adega_vendas = JSON.stringify([...vendas, ...vendas]);
  await assert.rejects(f.run(), /venda repetida/);
});
test('inventário exige identidade e correspondência completa dos produtos solicitados', async () => {
  const f = fixture(); f.pacote.dados.flowpdv_migracoes_estoque_teste = JSON.stringify([{ lojaId: 'A', produto: { id: 'p', nome: 'Farinha', unidade: 'g', estoque: 2500 } }]);
  const resposta = { versao: 1, lojaId: 'A', terminalUid: 'UID', somenteConferencia: true, produtos: [{ legadoId: 'p', situacao: 'vinculo_conferido', saldoCorteMili: 2500, saldoAtualMili: 2250 }] };
  const run = () => inventario({ pacote: f.pacote, contexto, ambienteTeste: true, call: async (nome, payload) => { assert.equal(nome, 'conferirInventarioCorteV2'); assert.equal(payload.produtos[0].estoque, 2500); return resposta; } });
  assert.equal((await run()).liberacaoOperacional, false);
  resposta.produtos = []; await assert.rejects(run(), /incompleta/);
});
