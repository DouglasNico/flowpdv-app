const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const data = new Map(), storage = { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: { lojaId: 'loja', terminalUid: 'antigo', terminalId: 'T' }, dados: { flowpdv_device_id: 'T', adega_turno_atual: JSON.stringify({ id: 'C', terminalId: 'T', status: 'aberto' }) } };
  const binding = { vinculado: true, papel: 'caixa', lojaId: 'loja', identidadeOperacionalUid: 'antigo' };
  const sessao = { auth: { currentUser: { uid: 'novo' } }, call: async () => binding };
  const ctx = { conferirBackupServidor: async () => ({ semDivergencias: true, pendencias: [] }), conferirInventarioBackup: async () => ({ produtos: [] }), conferirHistoricoBackup: async () => ({ semDivergencias: true }) };
  vm.createContext(ctx);
  ctx.conferirFechamentosBackup = async () => ({ semDivergencias: true });
  for (const file of ['backup-homologacao.js', 'restauracao-terminal-teste.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, ''), ctx);
  const executar = () => ctx.ensaiarRestauracaoTerminal({ pacote, sessao, storageDestino: storage, ambienteTeste: true, destinoIsolado: true });
  return { data, storage, pacote, binding, sessao, ctx, executar };
}
test('destino autenticado recupera somente a identidade delegada e não libera operação', async () => {
  const f = fixture(), result = await f.executar();
  assert.equal(result.autenticadoUid, 'novo'); assert.equal(result.contexto.terminalUid, 'antigo');
  assert.equal(result.liberacaoOperacional, false); assert.equal(f.storage.getItem('flowpdv_device_id'), 'T');
});
test('arquivo de outra identidade ou loja não escreve no destino', async () => {
  for (const key of ['lojaId', 'terminalUid']) {
    const f = fixture(); f.pacote.origem[key] = 'outra'; await assert.rejects(f.executar(), /incompatível/); assert.equal(f.data.size, 0);
  }
  const f = fixture(); delete f.binding.identidadeOperacionalUid;
  await assert.rejects(f.executar(), /incompatível/); assert.equal(f.data.size, 0);
});
test('venda posterior, inventário divergente e destino ocupado impedem restauração', async () => {
  const a = fixture(); a.ctx.conferirBackupServidor = async () => ({ semDivergencias: false });
  await assert.rejects(a.executar(), /diverge/); assert.equal(a.data.size, 0);
  const b = fixture(); b.pacote.dados.flowpdv_migracoes_estoque_teste = '[{"lojaId":"loja"}]'; b.ctx.conferirInventarioBackup = async () => ({ produtos: [{ situacao: 'sem_vinculo' }] });
  await assert.rejects(b.executar(), /inventário/); assert.equal(b.data.size, 0);
  const c = fixture(); c.storage.setItem('credencial', 'preservar');
  await assert.rejects(c.executar(), /vazio/); assert.equal(c.storage.getItem('credencial'), 'preservar');
});
test('mudança de sessão ou delegação durante conferência impede a escrita', async () => {
  const a = fixture(); a.ctx.conferirBackupServidor = async () => { a.sessao.auth.currentUser = { uid: 'outro' }; return { semDivergencias: true }; };
  await assert.rejects(a.executar(), /identidade mudou/); assert.equal(a.data.size, 0);
  const b = fixture(); let n = 0;
  b.sessao.call = async () => ++n === 1 ? b.binding : { ...b.binding, identidadeOperacionalUid: 'outra' };
  await assert.rejects(b.executar(), /autorização/); assert.equal(b.data.size, 0);
});

test('aritmética divergente da gaveta impede qualquer gravação no destino', async () => {
  const f = fixture(); f.ctx.conferirFechamentosBackup = async () => ({ semDivergencias: true, gavetas: [{ divergencias: [{ codigo: 'gaveta_saldo_divergente' }] }] });
  await assert.rejects(f.executar(), /gaveta/); assert.equal(f.data.size, 0);
});
test('fechamento divergente impede qualquer gravação no destino', async () => {
  const f = fixture(); f.ctx.conferirFechamentosBackup = async () => ({ semDivergencias: false });
  await assert.rejects(f.executar(), /fechamentos/); assert.equal(f.data.size, 0);
});
