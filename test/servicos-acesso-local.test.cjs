const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const apps = [], conexoes = [], chamadas = [], persistencias = [], values = new Map();
  const storage = { getItem: k => values.get(k) ?? null };
  const ctx = {
    getApps: () => apps,
    initializeApp(options, name) { const app = { options, name, auth: { currentUser: null, authStateReady: async () => {} } }; apps.push(app); return app; },
    getAuth: app => app.auth, getFunctions: app => app, getFirestore: app => app,
    connectAuthEmulator: (_auth, url) => conexoes.push(url),
    connectFunctionsEmulator: (_fn, host, port) => conexoes.push(`${host}:${port}`),
    connectFirestoreEmulator: (_db, host, port) => conexoes.push(`${host}:${port}`),
    httpsCallable: (app, operacao) => async data => { chamadas.push({ name: app.name, operacao, data }); return { data: { vinculado: true } }; },
    setPersistence: async (auth, mode) => persistencias.push({ auth, mode }),
    browserLocalPersistence: 'local', inMemoryPersistence: 'memory',
    signInAnonymously: async auth => { auth.currentUser = { uid: 'terminal' }; },
    signInWithEmailAndPassword: async (auth, email) => { auth.currentUser = { uid: 'gerente', email }; },
    signOut: async auth => { auth.currentUser = null; }
  };
  vm.createContext(ctx);
  for (const file of ['operacoes-pdv-v2.js', 'bloqueio-recuperacao-perfil.js', 'chamada-sessao-v2.js', 'acesso-homologacao.js', 'servicos-acesso-local.js', 'servicos-acesso-hospedado.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js', file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ').replace(/export const /g, 'const '), ctx);
  }
  const create = () => ctx.criarServicosAcessoLocal({ ambienteTeste: true, storage });
  return { ctx, apps, conexoes, chamadas, persistencias, values, storage, create };
}

test('sem adesão ao teste ou sem armazenamento não inicializa infraestrutura', () => {
  const f = fixture();
  for (const ambienteTeste of [undefined, false, 'true']) assert.throws(() => f.ctx.criarServicosAcessoLocal({ ambienteTeste, storage: f.storage }), /teste local/);
  assert.throws(() => f.ctx.criarServicosAcessoLocal({ ambienteTeste: true }), /Armazenamento/);
  assert.equal(f.apps.length, 0); assert.equal(f.conexoes.length, 0);
});

test('piloto remoto é explícito, não conecta emuladores e separa contas e persistência', async () => {
  const f = fixture();
  assert.throws(() => f.ctx.criarServicosAcessoHospedado({ storage: f.storage }), /explícita/);
  assert.equal(f.apps.length, 0);
  const s = f.ctx.criarServicosAcessoHospedado({ pilotoHospedado: true, storage: f.storage });
  await s.criarAcesso().prepararTerminal();
  await s.criarAcesso().entrarGerencia('gerente@example.test', 'senha-ficticia');
  assert.ok(f.apps.every(a => a.options.projectId === 'aplicativo-pdv'));
  assert.deepEqual(f.apps.map(a => a.name), ['flowpdv-terminal-piloto-v2', 'flowpdv-gerencia-piloto-v2']);
  assert.equal(f.conexoes.length, 0);
  assert.deepEqual(f.persistencias.map(p => p.mode), ['local', 'memory']);
  await s.criarAcesso().sairGerencia();
  assert.equal(s.terminal().auth.currentUser.uid, 'terminal');
  assert.equal(s.gerencia().auth.currentUser, null);
  const beforeOperation = f.chamadas.length;
  await assert.rejects(s.terminal().call('receberPedidoPdvV2'), /apenas o acesso/);
  assert.equal(f.chamadas.length, beforeOperation);
  f.values.set('flowpdv_recuperacao_operacao_bloqueada', '1');
  const before = f.chamadas.length;
  await assert.rejects(s.terminal().call('registrarBaixaVendaLocalV2'), /Perfil em recuperação/);
  assert.equal(f.chamadas.length, before);
});

test('piloto rejeita sessão desconhecida e não reutiliza a identidade do emulador', async () => {
  const f = fixture();
  await f.create().criarAcesso().prepararTerminal();
  const remote = f.ctx.criarServicosAcessoHospedado({ pilotoHospedado: true, storage: f.storage });
  assert.notEqual(remote.terminal().auth, f.create().terminal().auth);
  assert.equal(remote.terminal().auth.currentUser, null);
  const g = fixture(); g.apps.push({ name: 'flowpdv-terminal-piloto-v2', options: { projectId: 'aplicativo-pdv' } });
  assert.throws(() => g.ctx.criarServicosAcessoHospedado({ pilotoHospedado: true, storage: g.storage }).terminal(), /incompatível/);
});

test('terminal e gerente preservam identidades separadas, persistência e logout independente', async () => {
  const f = fixture(), s = f.create(), acesso = s.criarAcesso();
  await acesso.prepararTerminal();
  await acesso.entrarGerencia('gerente@example.test', 'senha-ficticia');
  assert.equal(s.terminal().auth.currentUser.uid, 'terminal');
  assert.equal(s.gerencia().auth.currentUser.uid, 'gerente');
  assert.deepEqual(f.persistencias.map(p => p.mode), ['local', 'memory']);
  await acesso.sairGerencia();
  assert.equal(s.gerencia().auth.currentUser, null);
  assert.equal(s.terminal().auth.currentUser.uid, 'terminal');
  assert.deepEqual(f.apps.map(a => a.name), ['flowpdv-terminal-teste-v2', 'flowpdv-gerencia-teste-v2']);
  assert.ok(f.apps.every(a => a.options.projectId === 'demo-flowpdv'));
  assert.deepEqual(f.conexoes, ['http://127.0.0.1:9099', '127.0.0.1:5001', '127.0.0.1:8080', 'http://127.0.0.1:9099', '127.0.0.1:5001', '127.0.0.1:8080']);
});

test('reutilização não recria usuário, nem reconfigura SDK ou acessa conta legada', async () => {
  const f = fixture();
  f.apps.push({ name: '[DEFAULT]', options: { projectId: 'legado' } });
  const s = f.create(); await s.criarAcesso().prepararTerminal();
  const uid = s.terminal().auth.currentUser.uid;
  await f.create().criarAcesso().prepararTerminal();
  assert.equal(s.terminal().auth.currentUser.uid, uid);
  assert.equal(f.apps.length, 2); assert.equal(f.conexoes.length, 3);
  assert.ok(f.chamadas.every(c => c.name === 'flowpdv-terminal-teste-v2'));
});

test('perfil em recuperação permite consulta mas bloqueia escrita antes do transporte', async () => {
  const f = fixture(), s = f.create(); await s.criarAcesso().prepararTerminal();
  f.values.set('flowpdv_recuperacao_operacao_bloqueada', '1');
  const antes = f.chamadas.length;
  await assert.rejects(s.terminal().call('registrarBaixaVendaLocalV2'), /Perfil em recuperação/);
  assert.equal(f.chamadas.length, antes);
  await s.terminal().call('consultarTurnoCaixaV2');
  assert.equal(f.chamadas.length, antes + 1);
});

test('sessão preexistente desconhecida e conexão parcial falham sem usar endpoint remoto', () => {
  const f = fixture();
  f.apps.push({ name: 'flowpdv-terminal-teste-v2', options: { projectId: 'demo-flowpdv', apiKey: 'demo-flowpdv-key' } });
  assert.throws(() => f.create().terminal(), /incompatível/);
  assert.equal(f.chamadas.length, 0);
  const g = fixture(); g.ctx.connectFirestoreEmulator = () => { throw Error('Conexão falhou'); };
  assert.throws(() => g.create().terminal(), /Conexão falhou/);
  assert.throws(() => g.create().terminal(), /incompatível/);
  assert.equal(g.chamadas.length, 0);
});

test('PDV normal isola credenciais do piloto e limita as chamadas à conexão', async () => {
 const f=fixture();
 assert.throws(()=>f.ctx.criarServicosAcessoHospedado({pilotoHospedado:true,integracaoPdv:true,storage:f.storage}),/único/);
 const s=f.ctx.criarServicosAcessoHospedado({integracaoPdv:true,storage:f.storage});
 await s.criarAcesso().prepararTerminal();await s.criarAcesso().entrarGerencia('a@example.test','ficticia');
 assert.deepEqual(f.apps.map(a=>a.name),['flowpdv-terminal-pdv-v2','flowpdv-gerencia-pdv-v2']);
 await s.gerencia().call('vincularTerminalLicenciadoV2',{});
 await assert.rejects(s.gerencia().call('emitirPareamentoV2',{}),/apenas o acesso/);
 await assert.rejects(s.terminal().call('receberPedidoPdvV2',{}),/apenas o acesso/);
});
