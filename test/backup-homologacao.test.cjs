const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/backup-homologacao.js'), 'utf8').replace('export function', 'function'), ctx);
const contexto = { lojaId: 'loja', terminalId: 'T', terminalUid: 'uid-original' };
function memoria(dados = {}) {
  const map = new Map(Object.entries(dados)); let falha;
  return { map, get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null,
    setItem(k, v) { if (k === falha) { falha = undefined; throw Error('Disco cheio'); } map.set(k, v); }, removeItem: k => map.delete(k), falhar: k => falha = k };
}
const create = (storage, extra = {}) => ctx.criarBackupHomologacao({ storage, ambienteTeste: true, contexto, destinoIsolado: true, ...extra });
const origem = () => memoria({ flowpdv_device_id: 'T', adega_produtos: '[{"id":"p","estoque":5}]', adega_vendas: '[{"id":"V","estoqueServidorV2":{"lojaId":"loja"}}]', adega_turno_atual: '{"id":"C","terminalId":"T","dataAbertura":"2026-09-21"}', flowpdv_migracoes_estoque_teste: '[{"lojaId":"loja","status":"confirmado"}]' });
test('ensaio copia IDs e vínculos para armazenamento vazio sem copiar credenciais ou licença', () => {
  const a = origem(); a.setItem('firebase:authUser', 'segredo'); a.setItem('adega_licenca', '{"chave":"segredo"}');
  const b = memoria(), backup = create(a).exportar(); create(b).restaurar(backup);
  assert.equal(b.getItem('firebase:authUser'), null); assert.equal(b.getItem('adega_licenca'), null);
  assert.equal(b.getItem('adega_vendas'), a.getItem('adega_vendas')); assert.equal(b.getItem('flowpdv_device_id'), 'T');
  assert.equal(b.getItem('flowpdv_migracoes_estoque_teste'), a.getItem('flowpdv_migracoes_estoque_teste'));
});
test('outra identidade, loja, destino ocupado ou runtime normal não restaura', () => {
  const backup = create(origem()).exportar();
  for (const campo of ['terminalId', 'terminalUid', 'lojaId']) {
    const b = memoria(); assert.throws(() => create(b, { contexto: { ...contexto, [campo]: 'outro' } }).restaurar(backup)); assert.equal(b.length, 0);
  }
  const ocupado = memoria({ adega_vendas: '[{"id":"posterior"}]' });
  assert.throws(() => create(ocupado).restaurar(backup), /vazio/); assert.equal(ocupado.getItem('adega_vendas'), '[{"id":"posterior"}]');
  assert.throws(() => create(memoria(), { ambienteTeste: false }));
  assert.throws(() => create(memoria(), { destinoIsolado: false }).restaurar(backup));
});
test('falha de disco retoma valores finais sem duplicar; destino alterado é preservado', () => {
  const backup = create(origem()).exportar(), b = memoria(); b.falhar('adega_vendas');
  assert.throws(() => create(b).restaurar(backup), /Disco cheio/);
  assert.ok(b.getItem('flowpdv_restauracao_v2_pendente')); assert.equal(create(b).recuperar(), true);
  assert.equal(create(b).recuperar(), false); assert.equal(JSON.parse(b.getItem('adega_vendas')).length, 1);
  const c = memoria(); c.falhar('adega_vendas'); assert.throws(() => create(c).restaurar(backup));
  c.setItem('adega_produtos', '[{"id":"posterior"}]'); assert.throws(() => create(c).recuperar(), /destino mudou/);
  assert.equal(c.getItem('adega_produtos'), '[{"id":"posterior"}]');
});
test('pacote desconhecido, dados inválidos e chaves de credenciais não são aplicados', () => {
  const backup = create(origem()).exportar();
  for (const mod of [p => p.versao = 2, p => p.dados.adega_vendas = '{', p => p.dados['firebase:authUser'] = 'token', p => p.dados.flowpdv_migracoes_estoque_teste = '[{"lojaId":"outra"}]']) {
    const p = JSON.parse(JSON.stringify(backup)); mod(p); const b = memoria(); assert.throws(() => create(b).restaurar(p)); assert.equal(b.length, 0);
  }
});
test('pendência preserva requisição exata e exige turno original; diário parcial impede exportar', () => {
  const a = origem(), p = { lojaId: 'loja', payload: { vendaId: 'V-pendente', turno: { id: 'C', terminalId: 'T', dataAbertura: '2026-09-21' } } };
  a.setItem('flowpdv_venda_servidor_pendente', JSON.stringify(p));
  const b = memoria(); create(b).restaurar(create(a).exportar()); assert.equal(b.getItem('flowpdv_venda_servidor_pendente'), JSON.stringify(p));
  p.payload.turno.id = 'outro'; a.setItem('flowpdv_venda_servidor_pendente', JSON.stringify(p)); assert.throws(() => create(a).exportar(), /turno original/);
  a.removeItem('flowpdv_venda_servidor_pendente'); a.setItem('flowpdv_commit_venda', '{}'); assert.throws(() => create(a).exportar(), /Conclua/);
  a.removeItem('flowpdv_commit_venda'); a.setItem('flowpdv_recuperacao_terminal_pendente:gerente:loja', '{}'); assert.throws(() => create(a).exportar(), /Conclua/);
});

test('backup preserva tentativa de pagamento da conta e rejeita outra loja',()=>{
 const a=origem(),key='flowpdv_pagamento_atendimento_pendente';
 const p={schema:1,lojaId:'loja',terminalUid:'uid-original',payload:{turno:{id:'C',terminalId:'T',dataAbertura:'2026-09-21'},atendimentoId:'A'}};
 a.setItem(key,JSON.stringify(p));const pacote=create(a).exportar(),b=memoria();create(b).restaurar(pacote);assert.equal(b.getItem(key),a.getItem(key));
 p.lojaId='outra';a.setItem(key,JSON.stringify(p));assert.throws(()=>create(a).exportar(),/Pendência/);
});
