const { test } = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), vm = require('node:vm');
const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../src/js/conferencia-historico-v2.js')], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent' });
const ctx = { module: { exports: {} } }; vm.runInNewContext(code.outputFiles[0].text, ctx);
function fixture() {
  const contexto = { lojaId: 'A', terminalId: 'T', terminalUid: 'U' };
  const turnos = ['C1','C2'].map((id,i) => ({ id, terminalId: 'T', dataAbertura: `2026-09-2${i+1}T10:00:00.000Z`, status: i ? 'aberto' : 'fechado', revisao: 3 }));
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto, dados: { flowpdv_device_id: 'T', adega_turno_atual: JSON.stringify(turnos[1]), adega_turnos_historico: JSON.stringify([turnos[0]]), adega_vendas: '[]' } };
  const f = { pacote, turnos, onCall: () => {}, run: () => ctx.module.exports.conferirHistoricoBackup({ pacote, contexto, ambienteTeste: true,
    call: async (name,data) => { f.onCall(name); const base = { versao: 1, lojaId: 'A', terminalUid: 'U', somenteConferencia: true };
      if (name === 'listarTurnosRecuperacaoV2') return { ...base, turnos: JSON.parse(JSON.stringify(turnos)) };
      assert.equal(name, 'consultarRecuperacaoLocalV2'); return { ...base, turno: turnos.find(t => t.id === data.turno.id), registros: [] };
    } }) };
  return f;
}
test('confere histórico e turno atual sem modificar arquivo', async () => {
  const f = fixture(), antes = JSON.stringify(f.pacote), r = await f.run();
  assert.equal(r.semDivergencias, true); assert.equal(r.conferencias.length, 2); assert.equal(r.liberacaoOperacional, false); assert.equal(JSON.stringify(f.pacote), antes);
});
test('identifica turno posterior ausente e turno local sem registro remoto', async () => {
  const f = fixture(); f.pacote.dados.adega_turnos_historico = '[]';
  assert.equal((await f.run()).divergencias[0].codigo, 'turno_ausente_no_backup');
  const g = fixture(); g.turnos.shift(); assert.equal((await g.run()).divergencias[0].codigo, 'turno_local_sem_registro_remoto');
});
test('histórico repetido e alteração de revisão entre leituras são recusados', async () => {
  const f = fixture(); f.pacote.dados.adega_turnos_historico = JSON.stringify([f.turnos[1]]); await assert.rejects(f.run(), /repetido/);
  const g = fixture(); let vezes = 0; g.onCall = name => { if (name === 'listarTurnosRecuperacaoV2' && ++vezes === 2) g.turnos[0].revisao++; };
  await assert.rejects(g.run(), /mudou/);
});
