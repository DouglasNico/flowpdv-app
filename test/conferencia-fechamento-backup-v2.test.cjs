const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), vm = require('node:vm');
const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/conferencia-fechamento-backup-v2.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
const ctx = { module: { exports: {} } }; vm.runInNewContext(code.outputFiles[0].text, ctx);
function fixture() {
  const contexto = { lojaId: 'A', terminalId: 'T', terminalUid: 'U' };
  const ref = { id: 'C', terminalId: 'T', terminalUid: 'U', chave: 'hash', dataAbertura: '2026-09-22T10:00:00.000Z' };
  const formas = { dinheiro: 0, pix_manual: 0, cartao_manual: 0 };
  const estado = { ...ref, status: 'fechado', revisao: 2, revisaoConferida: 1, totalCentavos: 0, movimentos: 0, formas,
    trocoInicialCentavos: 500, dinheiroEsperadoCentavos: 500, dinheiroContadoCentavos: 450, diferencaCentavos: -50 };
  const snapshot = { versao: 1, lojaId: 'A', turno: ref, status: 'fechado', revisao: 2, totalCentavos: 0, formas, trocoInicialCentavos: 500, recebimentos: 0, estornos: 0, detalhes: [] };
  const local = { ...ref, fundoRestauranteCentavos: 500, status: 'fechado', restauranteV2: snapshot };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto, dados: { flowpdv_device_id: 'T', adega_turnos_historico: JSON.stringify([local]) } };
  const f = { contexto, estado, snapshot, local, pacote, movimentos: [], onCall: () => {}, salvar: () => pacote.dados.adega_turnos_historico = JSON.stringify([local]),
    run: () => ctx.module.exports.conferirFechamentosBackup({ pacote, contexto, ambienteTeste: true, call: async name => {
      f.onCall(name);
      const result = name === 'listarTurnosRecuperacaoV2' ? { versao: 1, lojaId: 'A', terminalUid: 'U', somenteConferencia: true, turnos: [estado] }
        : name === 'consultarTurnoCaixaV2' ? { turno: estado }
        : name === 'consultarMovimentosTurnoV2' ? { turno: ref, movimentos: f.movimentos }
        : name === 'obterResumoFechadoTurnoV2' ? snapshot : assert.fail(name);
      return JSON.parse(JSON.stringify(result));
    } }) };
  return f;
}
test('confere resumo fechado sem modificar arquivo ou liberar operações', async () => {
  const f = fixture(), original = JSON.stringify(f.pacote), r = await f.run();
  assert.equal(r.semDivergencias, true); assert.equal(r.liberacaoOperacional, false); assert.equal(r.limites.length, 2); assert.equal(JSON.stringify(f.pacote), original);
  assert.equal(r.gavetas[0].pendencias[0].codigo, 'gaveta_dados_incompletos');
});
test('detecta resumo ausente, fundo diferente e resumo local desatualizado', async () => {
  const f = fixture(); delete f.local.restauranteV2; f.local.fundoRestauranteCentavos = 100; f.salvar();
  assert.equal((await f.run()).divergencias.length, 2);
  const g = fixture(); g.local.restauranteV2 = { ...g.snapshot, revisao: 1 }; g.salvar();
  assert.equal((await g.run()).divergencias[0].codigo, 'resumo_restaurante_divergente');
});
test('ordem de propriedades não acusa diferença e valores malformados são recusados', async () => {
  const f = fixture(); f.local.restauranteV2 = Object.fromEntries(Object.entries(f.snapshot).reverse()); f.salvar(); assert.equal((await f.run()).semDivergencias, true);
  f.estado.diferencaCentavos = 50; await assert.rejects(f.run(), /Contagem/);
  const g = fixture(); g.snapshot.detalhes = undefined; await assert.rejects(g.run(), /Resumo encerrado/);
});
test('recusa resumo sem movimentos correspondentes e movimentos duplicados', async () => {
  const f = fixture(); f.estado.totalCentavos = 100; await assert.rejects(f.run(), /difere dos movimentos/);
  const g = fixture(); const m = { id: 'M', vendaId: 'V', tipo: 'recebimento_manual', totalCentavos: 100, pagamentos: [{ forma: 'dinheiro', valorCentavos: 100 }] };
  g.movimentos = [m, m]; await assert.rejects(g.run(), /inconsistente/);
});
test('recusa troca de identidade e mudança concorrente do histórico', async () => {
  const f = fixture(); f.snapshot.turno = { ...f.snapshot.turno, terminalUid: 'OUTRO' }; await assert.rejects(f.run(), /Resumo encerrado/);
  const g = fixture(); let reads = 0; g.onCall = name => { if (name === 'listarTurnosRecuperacaoV2' && ++reads === 2) g.estado.revisao++; };
  await assert.rejects(g.run(), /Histórico mudou/);
});
test('turno aberto não aceita fechamento local e não solicita resumo encerrado', async () => {
  const f = fixture(); f.estado.status = 'aberto'; f.onCall = name => assert.notEqual(name, 'obterResumoFechadoTurnoV2');
  assert.equal((await f.run()).divergencias[0].codigo, 'fechamento_local_sem_encerramento_remoto');
});
