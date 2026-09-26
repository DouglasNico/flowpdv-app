const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/acesso-homologacao.js'), 'utf8').replace('export function', 'function'), ctx);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function fixture() {
  const calls = [], t = { auth: { currentUser: { uid: 'terminal' } } }, g = { auth: { currentUser: { uid: 'gerente', email: 'teste@example.test' } } };
  t.call = g.call = async (n, p) => { calls.push({ n, p }); return { vinculado: true }; };
  const deps = { ambienteTeste: true, terminal: async () => t, gerencia: async () => g,
    autenticarAnonimo: async auth => auth.currentUser = { uid: 'novo' },
    autenticarGerencia: async auth => auth.currentUser = { uid: 'gerente', email: 'teste@example.test' },
    sairGerencia: async auth => auth.currentUser = null };
  return { t, g, calls, deps, create: () => ctx.criarAcessoHomologacao(deps) };
}
test('preparação preserva identidade; consulta sem sessão não cria outra', async () => {
  const f = fixture(), s = f.create();
  assert.equal((await s.prepararTerminal()).uid, 'terminal');
  f.t.auth.currentUser = null; await assert.rejects(s.consultarTerminal(), /Prepare/);
  assert.equal((await s.prepararTerminal()).uid, 'novo');
});
test('resultado do vínculo não atravessa troca de identidade', async () => {
  const f = fixture(), resposta = deferred(); f.t.call = () => resposta.promise;
  const s = f.create(), p = s.consultarTerminal(); await tick();
  f.t.auth.currentUser = { uid: 'outro' }; resposta.resolve({ vinculado: true });
  await assert.rejects(p, /sessão mudou/);
});
test('revogação descarta consulta de vínculo em curso', async () => {
  const f = fixture(), resposta = deferred(); f.t.call = () => resposta.promise;
  const s = f.create(), p = s.consultarTerminal(); await tick();
  await s.revogar({ lojaId: 'A', terminalUid: 'terminal' });
  resposta.resolve({ vinculado: true }); await assert.rejects(p, /sessão mudou/);
});
test('logout descarta emissão em curso e preserva identidade do terminal', async () => {
  const f = fixture(), resposta = deferred(); f.g.call = () => resposta.promise;
  const s = f.create(), p = s.emitir({ lojaId: 'A' }); await tick();
  await s.sairGerencia(); resposta.resolve({ token: 'nao-exibir' });
  await assert.rejects(p, /sessão mudou/); assert.equal(f.t.auth.currentUser.uid, 'terminal');
});
test('logout durante login termina desconectado, sem resultado de login obsoleto', async () => {
  const f = fixture(), resposta = deferred();
  f.deps.autenticarGerencia = async auth => { await resposta.promise; auth.currentUser = { uid: 'gerente' }; };
  const s = f.create(), p = s.entrarGerencia('teste@example.test', 'ficticia'); await tick();
  const rejeicao = assert.rejects(p, /sessão mudou/), saida = s.sairGerencia();
  resposta.resolve(); await rejeicao; await saida;
  assert.equal(f.g.auth.currentUser, null); assert.equal(f.t.auth.currentUser.uid, 'terminal');
});
test('perfil normal bloqueado e gerência desconectada não envia comando', async () => {
  const f = fixture(); assert.throws(() => ctx.criarAcessoHomologacao({ ...f.deps, ambienteTeste: false }));
  f.g.auth.currentUser = null; await assert.rejects(f.create().emitir({}), /Entre como gerente/);
  assert.equal(f.calls.length, 0);
});

test('recuperação usa gerência e invalida consulta antiga do terminal', async () => {
  const f = fixture(), resposta = deferred(); f.t.call = () => resposta.promise;
  const s = f.create(), p = s.consultarTerminal(); await tick();
  await s.consultarPlanoRecuperacao({ lojaId: 'A' });
  await s.recuperarTerminal({ lojaId: 'A', requestId: 'recuperacao' });
  resposta.resolve({ vinculado: true }); await assert.rejects(p, /sessão mudou/);
  assert.deepEqual(f.calls.map(c => c.n), ['consultarPlanoRecuperacaoTerminalV2', 'recuperarOperacaoTerminalV2']);
});
