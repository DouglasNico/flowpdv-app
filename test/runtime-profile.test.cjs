const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { runtimeProfile, testUrlAllowed, hostedUrlAllowed, protectTestSession } = require('../runtime-profile.cjs');
const root = path.join(__dirname, '..');

test('piloto V2 separa armazenamento, recusa combinação local e não entra no instalador', () => {
  const base = { isPackaged: false, appData: '/fake/appdata', argv: ['--flowpdv-piloto-v2'] };
  const profile = runtimeProfile(base);
  assert.equal(profile.hosted, true); assert.equal(profile.test, true); assert.equal(profile.fullApp, false);
  assert.equal(profile.userData, path.join(base.appData, 'flowpdv-piloto-v2'));
  for (const flag of ['--flowpdv-test', '--flowpdv-homologacao', '--flowpdv-app-completo', '--flowpdv-test-profile=a']) assert.throws(() => runtimeProfile({ ...base, argv: [...base.argv, flag] }), /combinado/);
  assert.throws(() => runtimeProfile({ ...base, isPackaged: true }), /desenvolvimento/);
});

test('rede do piloto aceita Firebase V2 e rejeita emuladores, legado, pagamentos e outros hosts', () => {
  for (const url of ['https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword', 'https://securetoken.googleapis.com/v1/token', 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel', 'https://us-central1-aplicativo-pdv.cloudfunctions.net/consultarMeuTerminalV2']) assert.equal(hostedUrlAllowed(url), true, url);
  for (const url of ['http://127.0.0.1:5001/test', 'https://api.pagar.me', 'https://us-central1-aplicativo-pdv.cloudfunctions.net/buscarLicenca', 'https://us-central1-outro.cloudfunctions.net/consultarMeuTerminalV2', 'https://user@firestore.googleapis.com/', 'https://firestore.googleapis.com:444/', 'https://firestore.googleapis.com.evil/']) assert.equal(hostedUrlAllowed(url), false, url);
});

test('perfil normal preserva pasta; teste tem pasta distinta; instalador recusa teste', () => {
  const base = { isPackaged: false, argv: [], appData: '/fake/appdata' };
  assert.equal(runtimeProfile(base).userData, path.join(base.appData, 'flowpdv'));
  assert.equal(runtimeProfile({ ...base, argv: ['--flowpdv-test'] }).userData, path.join(base.appData, 'flowpdv-test'));
  assert.throws(() => runtimeProfile({ ...base, isPackaged: true, argv: ['--flowpdv-test'] }), /desenvolvimento/);
});

test('rede permite somente as portas dos emuladores e recursos locais', () => {
  for (const url of ['file:///app/index.html', 'data:text/plain,ok', 'http://127.0.0.1:9099/a', 'http://127.0.0.1:8080/a', 'http://127.0.0.1:5001/a']) assert.equal(testUrlAllowed(url), true, url);
  for (const url of ['https://firestore.googleapis.com', 'https://api.pagar.me', 'https://res.cloudinary.com/x', 'http://192.168.0.2:8080', 'http://127.0.0.1:3000', 'http://127.0.0.1.evil:8080', 'http://user@127.0.0.1:8080', 'wss://example.com', 'invalid']) assert.equal(testUrlAllowed(url), false, url);
});
test('ensaio do aplicativo completo exige perfil explícito e tem armazenamento próprio',()=>{
  const base={isPackaged:false,appData:'/fake/appdata'},argv=['--flowpdv-homologacao','--flowpdv-app-completo'];
  const p=runtimeProfile({...base,argv});assert.equal(p.test,true);assert.equal(p.operational,true);assert.equal(p.fullApp,true);
  assert.equal(p.userData,path.join(base.appData,'flowpdv-app-homologacao'));
  assert.throws(()=>runtimeProfile({...base,argv:['--flowpdv-app-completo']}),/exige homologação/);
  assert.throws(()=>runtimeProfile({...base,argv,isPackaged:true}),/desenvolvimento/);
});

test('homologação operacional é explícita, separada do laboratório e proibida no instalador', () => {
  const base = { isPackaged: false, appData: '/fake/appdata' };
  const perfil = runtimeProfile({ ...base, argv: ['--flowpdv-homologacao'] });
  assert.equal(perfil.test, true); assert.equal(perfil.operational, true);
  assert.equal(perfil.userData, path.join(base.appData, 'flowpdv-homologacao'));
  assert.notEqual(perfil.userData, runtimeProfile({ ...base, argv: ['--flowpdv-test'] }).userData);
  assert.equal(runtimeProfile({ ...base, argv: ['--flowpdv-homologacao', '--flowpdv-test-profile=destino'] }).userData, path.join(base.appData, 'flowpdv-homologacao-destino'));
  assert.throws(() => runtimeProfile({ ...base, argv: ['--flowpdv-homologacao', '--flowpdv-test'] }), /não os dois/);
  assert.throws(() => runtimeProfile({ ...base, isPackaged: true, argv: ['--flowpdv-homologacao'] }), /desenvolvimento/);
});

test('perfis nomeados separam equipamentos e rejeitam caminho ou argumento ambíguo', () => {
  const base = { isPackaged: false, appData: '/fake/appdata' };
  const perfil = (...args) => runtimeProfile({ ...base, argv: args });
  assert.equal(perfil('--flowpdv-test', '--flowpdv-test-profile=origem').userData, path.join(base.appData, 'flowpdv-test-origem'));
  assert.notEqual(perfil('--flowpdv-test', '--flowpdv-test-profile=origem').userData, perfil('--flowpdv-test', '--flowpdv-test-profile=destino').userData);
  for (const nome of ['', '../flowpdv', '..\\flowpdv', '/absolute', 'C:\\dados', 'com espaço', 'A', 'x'.repeat(33)])
    assert.throws(() => perfil('--flowpdv-test', '--flowpdv-test-profile=' + nome));
  assert.throws(() => perfil('--flowpdv-test-profile=origem'));
  assert.throws(() => perfil('--flowpdv-test', '--flowpdv-test-profile=a', '--flowpdv-test-profile=b'));
  assert.throws(() => runtimeProfile({ ...base, isPackaged: true, argv: ['--flowpdv-test', '--flowpdv-test-profile=a'] }));
});

test('session cancela rede real e recusa dispositivos', () => {
  let before, permission, check, device;
  protectTestSession({ webRequest: { onBeforeRequest(fn) { before = fn; } }, setPermissionRequestHandler(fn) { permission = fn; }, setPermissionCheckHandler(fn) { check = fn; }, setDevicePermissionHandler(fn) { device = fn; } });
  before({ url: 'https://firestore.googleapis.com' }, result => assert.equal(result.cancel, true));
  before({ url: 'http://127.0.0.1:8080' }, result => assert.equal(result.cancel, false));
  permission(null, 'serial', allowed => assert.equal(allowed, false));
  assert.equal(check(), false); assert.equal(device(), false);
});

function loadMain({ failPath = false } = {}) {
  const handlers = new Map(), paths = {}, loaded = [];
  const electron = {
    app: { isPackaged: false, getPath: key => paths[key] || '/fake/appdata', setPath(key, value) { if (failPath) throw new Error('path denied'); paths[key] = value; }, setAppUserModelId() {}, requestSingleInstanceLock: () => true, on() {}, whenReady: () => ({ then() {} }), getVersion: () => 'test' },
    ipcMain: { handle(key, fn) { handlers.set(key, fn); }, on() {} },
    BrowserWindow: class { constructor() { throw new Error('Não deve abrir janela neste teste'); } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), {
    require(name) { loaded.push(name); if (name === 'electron') return electron; if (name === './runtime-profile.cjs') return require('../runtime-profile.cjs'); if (name === 'path') return path; if (name === 'fs') return { mkdirSync() {} }; throw new Error(`Acesso inesperado: ${name}`); },
    process: { argv: ['electron', '.', '--flowpdv-test'], platform: 'win32', on() {} }, console, __dirname: root
  });
  return { handlers, paths, loaded };
}

test('main bloqueia impressora, HTTP financeiro e SiTef antes de usar adaptadores', async () => {
  const { handlers, loaded, paths } = loadMain();
  assert.equal(paths.userData, path.join('/fake/appdata', 'flowpdv-test'));
  assert.equal((await handlers.get('print-thermal-receipt')({}, '<html/>')).success, false);
  assert.equal(handlers.get('http-json')({}, { url: 'https://api.pagar.me' }).body.codigo, 'ambiente_teste');
  assert.throws(() => handlers.get('sitef-executar')({}, {}), /desativado/);
  assert.ok(!loaded.includes('electron-updater'));
  assert.ok(!loaded.includes('./sitef-bridge.js'));
  assert.ok(!loaded.includes('https'));
});

test('main não continua quando não consegue separar os dados', () => {
  assert.throws(() => loadMain({ failPath: true }), /path denied/);
});

test('Firebase teste usa projeto fictício e os três emuladores; normal mantém produção', () => {
  const source = fs.readFileSync(path.join(root, 'src/js/firebase-config.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^export \{.*;\r?$/gm, '').replace(/export (const|async function|function) /g, '$1 ');
  for (const testMode of [false, true]) {
    let config; const connections = [];
    const sdk = { window: { electronAPI: { ambienteTeste: testMode } }, initializeApp(c) { config = c; return {}; }, getFirestore: () => ({}), getFunctions: () => ({}), getAuth: () => ({}) };
    for (const name of ['connectFirestoreEmulator', 'connectAuthEmulator', 'connectFunctionsEmulator']) sdk[name] = (...args) => connections.push([name, ...args.slice(1)]);
    vm.runInNewContext(source, sdk);
    assert.equal(config.projectId, testMode ? 'demo-flowpdv' : 'aplicativo-pdv');
    assert.equal(connections.length, testMode ? 3 : 0);
    if (testMode) assert.deepEqual(connections.map(c => c.slice(1)), [['127.0.0.1', 8080], ['http://127.0.0.1:9099'], ['127.0.0.1', 5001]]);
  }
});

test('preload expõe modo de teste e não abre navegador externo', async () => {
  let exposed, opened = false;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld(_key, api) { exposed = api; } }, ipcRenderer: {}, shell: { openExternal() { opened = true; } } }),
    process: { argv: ['--flowpdv-test-renderer'] }, window: { addEventListener() {} }
  });
  assert.equal(exposed.ambienteTeste, true);
  await assert.rejects(exposed.openExternal('https://example.com'), /desativados/);
  assert.equal(opened, false);
});
