const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/recuperacao-terminal-pendente.js'), 'utf8').replace('export function', 'function'), ctx);
function fixture() {
  const data = new Map(), calls = []; let uid = 'gerente', count = 0;
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const plano = { lojaId: 'loja', origemUid: 'antigo', destinoUid: 'novo', identidadeOperacionalUid: 'antigo', revisao: 0,
    revogaOrigem: true, copiaCredenciais: false, restauraDadosLocais: false };
  const deps = { storage, uid, lojaId: 'loja', getUid: () => uid, uuid: () => `pedido-${++count}`, ambienteTeste: true,
    call: async (name, payload) => { calls.push({ name, payload }); return { ...plano, revisao: 1 }; } };
  return { data, storage, plano, deps, calls, setUid: v => uid = v, create: () => ctx.criarRecuperacaoTerminalPendente(deps) };
}
test('resposta perdida sobrevive reinício e retoma o mesmo pedido', async () => {
  const f = fixture(); let original;
  f.deps.call = async (_,p) => { original = p; throw new Error('resposta perdida'); };
  await assert.rejects(f.create().executar(f.plano, 'Troca de equipamento', true), /resposta perdida/);
  f.deps.call = async (_,p) => { assert.deepEqual(p, original); return { ...f.plano, revisao: 1 }; };
  const novo = f.create(); await assert.rejects(novo.executar(f.plano, 'Outra troca', true), /pendente/);
  await novo.retomar(); assert.equal(f.data.size, 0);
});
test('falha de persistência impede envio; journal inválido não é descartado', async () => {
  const f = fixture(); f.storage.setItem = () => { throw new Error('disco cheio'); };
  await assert.rejects(f.create().executar(f.plano, 'Troca de equipamento', true), /disco cheio/); assert.equal(f.calls.length, 0);
  f.data.set('flowpdv_recuperacao_terminal_pendente:gerente:loja', '{}');
  await assert.rejects(f.create().retomar(), /inválido/); assert.equal(f.data.size, 1);
});
test('troca de gerente durante resposta preserva journal e não aceita resultado', async () => {
  const f = fixture(); f.deps.call = async () => { f.setUid('outro'); return { ...f.plano, revisao: 1 }; };
  await assert.rejects(f.create().executar(f.plano, 'Troca de equipamento', true), /sessão/);
  assert.equal(f.data.size, 1); await assert.rejects(f.create().retomar(), /sessão/);
});
test('retorno divergente e falha ao apagar mantêm possibilidade de replay', async () => {
  const f = fixture(); f.deps.call = async () => ({ ...f.plano, revisao: 2 });
  await assert.rejects(f.create().executar(f.plano, 'Troca de equipamento', true), /inconsistente/);
  f.deps.call = async () => ({ ...f.plano, revisao: 1 });
  f.storage.removeItem = () => { throw new Error('falha no disco'); };
  await assert.rejects(f.create().retomar(), /falha no disco/); assert.equal(f.data.size, 1);
});
test('confirmação e perfil exigidos; duplo clique não cria outra operação', async () => {
  const f = fixture(); assert.throws(() => ctx.criarRecuperacaoTerminalPendente({ ...f.deps, ambienteTeste: false }));
  const s = f.create(); await assert.rejects(s.executar(f.plano, 'Troca de equipamento', false)); assert.equal(f.calls.length, 0);
  let resolve; f.deps.call = () => new Promise(r => resolve = r);
  const atual = f.create(), p = atual.executar(f.plano, 'Troca de equipamento', true);
  await assert.rejects(atual.retomar(), /andamento/); resolve({ ...f.plano, revisao: 1 }); await p;
});
