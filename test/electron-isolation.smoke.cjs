// Executar com electron, não node. Janela real oculta, sem licença ou loja real.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const operational = process.env.FLOWPDV_OPERATIONAL_TEST === '1';
const fullApp = process.env.FLOWPDV_FULL_APP_TEST === '1';
process.argv.push(operational ? '--flowpdv-homologacao' : '--flowpdv-test');
if(fullApp)process.argv.push('--flowpdv-app-completo');
const profileName = process.env.FLOWPDV_TEST_PROFILE_NAME;
if (profileName) process.argv.push('--flowpdv-test-profile=' + profileName);
const scratch = process.env.FLOWPDV_PROFILE_SCRATCH || fs.mkdtempSync(path.join(os.tmpdir(), 'flowpdv-electron-smoke-'));
const bundle = path.join(scratch, 'bundle.js');
require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/js/app.js')], outfile: bundle, bundle: true, platform: 'browser', format: 'iife', logLevel: 'silent' });
const fixture=fullApp?require('./fixture-aplicativo-completo.cjs')():{};
const seed=fullApp?`<script>if(!localStorage.getItem('fixture-app-completo')){for(const [k,v] of Object.entries(${JSON.stringify(fixture)}))localStorage.setItem(k,v);localStorage.setItem('fixture-app-completo','1');}</script>`:'';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<head>', `<head><base href="${pathToFileURL(root + path.sep).href}">${seed}`)
  .replace('src="src/js/bundle.js"', `src="${pathToFileURL(bundle).href}"`);
const index = path.join(scratch, 'index.html');
fs.writeFileSync(index, html);
// Perfil descartável dentro de uma pasta temporária; main acrescenta flowpdv-test.
app.setPath('appData', scratch);
const visible = process.env.FLOWPDV_VISIBLE_TEST === '1';
if (!visible) {
  BrowserWindow.prototype.show = function () {};
  BrowserWindow.prototype.maximize = function () {};
}
const loadFile = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function (file, ...args) { return loadFile.call(this, file === 'index.html' ? index : file, ...args); };
const watchdog = setTimeout(() => { console.error('SMOKE FAIL: tempo esgotado'); app.exit(1); }, visible || process.env.FLOWPDV_PAIRING_UI_TEST === '1' || process.env.FLOWPDV_INSTALL_UI_TEST === '1' || process.env.FLOWPDV_NATIVE_SALE_TEST === '1' ? 420000 : 30000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.setBackgroundThrottling(false);
  if (visible) {
    const execute = win.webContents.executeJavaScript.bind(win.webContents);
    win.webContents.executeJavaScript = async (code, ...args) => {
      // Dá tempo de acompanhar preenchimentos e ações reais do teste.
      const action = /\.click\(|\.requestSubmit\(|\.value\s*=|\.checked\s*=/.test(code);
      if (action) await new Promise(resolve => setTimeout(resolve, 1600));
      return execute(code, ...args);
    };
  }
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        let remoteBlocked = false;
        try { await fetch('https://firestore.googleapis.com/'); } catch { remoteBlocked = true; }
        return {
          test: window.electronAPI.ambienteTeste,
          banner: document.body.textContent.includes('AMBIENTE DE TESTE'),
          appLoaded: !!window.App,
          remoteBlocked,
          print: await window.electronAPI.printThermalReceipt('<p>Teste</p>', true),
          fiscal: await window.electronAPI.httpJson({url:'https://api.focusnfe.com.br/'})
        };
      })()`);
      assert.equal(app.getPath('userData'), path.join(scratch, (fullApp ? 'flowpdv-app-homologacao' : operational ? 'flowpdv-homologacao' : 'flowpdv-test') + (profileName ? '-' + profileName : '')));
      assert.equal(await win.webContents.executeJavaScript('window.electronAPI.homologacaoOperacional'), operational);
      if(!fullApp)assert.equal(await win.webContents.executeJavaScript("document.getElementById('painel-teste-local').dataset.perfil"), operational ? 'homologacao-operacional' : 'laboratorio');
      else assert.equal(await win.webContents.executeJavaScript("!document.getElementById('painel-teste-local') && window.electronAPI.aplicativoCompletoTeste && !!document.getElementById('modal-login-operador')"),true);
      if (process.env.FLOWPDV_PROFILE_EXPECT !== undefined) {
        const esperado = JSON.parse(process.env.FLOWPDV_PROFILE_EXPECT);
        assert.equal(await win.webContents.executeJavaScript("localStorage.getItem('flowpdv_profile_probe')"), esperado);
        const valor = process.env.FLOWPDV_PROFILE_WRITE;
        if (valor !== undefined) await win.webContents.executeJavaScript(`localStorage.setItem('flowpdv_profile_probe', ${JSON.stringify(valor)}); void 0`);
      }
      for (const key of ['test', 'banner', 'appLoaded', 'remoteBlocked']) assert.equal(result[key], true, key);
      assert.equal(result.print.success, false);
      assert.equal(result.fiscal.body.codigo, 'ambiente_teste');
      console.log('SMOKE PASS:', JSON.stringify(result));
      if(fullApp)await require('./aplicativo-completo-ui.cjs')(win);
      if (process.env.FLOWPDV_PAIRING_UI_TEST === '1') await require('./pairing-ui-flow.cjs')(win);
      if (process.env.FLOWPDV_INSTALL_UI_TEST === '1') await require('./instalacao-perfil-ui-flow.cjs')(win);
      clearTimeout(watchdog); app.exit(0);
    } catch (error) { console.error('SMOKE FAIL:', error); clearTimeout(watchdog); app.exit(1); }
  });
});
require('../main.js');
