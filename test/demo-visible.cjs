// Executar com electron, não node. Janela real oculta, sem licença ou loja real.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
process.argv.push('--flowpdv-test');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'flowpdv-electron-smoke-'));
const bundle = path.join(scratch, 'bundle.js');
require('esbuild').buildSync({ entryPoints: [path.join(root, 'src/js/app.js')], outfile: bundle, bundle: true, platform: 'browser', format: 'iife', logLevel: 'silent' });
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace('<head>', `<head><base href="${pathToFileURL(root + path.sep).href}">`)
  .replace('src="src/js/bundle.js"', `src="${pathToFileURL(bundle).href}"`);
const index = path.join(scratch, 'index.html');
fs.writeFileSync(index, html);
// Perfil descartável dentro de uma pasta temporária; main acrescenta flowpdv-test.
app.setPath('appData', scratch);

BrowserWindow.prototype.maximize = function () {
  const area=require('electron').screen.getPrimaryDisplay().workArea;
  const right=Math.min(440,Math.floor(area.width*0.36));
  this.setMinimumSize(640,500);this.setBounds({x:area.x,y:area.y,width:area.width-right,height:area.height});
};
const loadFile=BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile=function(file,...args){return loadFile.call(this,file==='index.html'?index:file,...args);};
let attached=false;
app.on('browser-window-created',(_event,win)=>{
  if(attached)return;attached=true;
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load',async()=>{
    try {
      const js=code=>win.webContents.executeJavaScript(code);
      const wait=async code=>{for(let i=0;i<200;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+code);};
      const action=async code=>{await js(code);await wait("document.querySelector('#pair-dialog').dataset.busy === 'false'");};
      await wait("!!document.getElementById('pair-open')");
      assert.equal(await js('window.electronAPI.ambienteTeste'),true);
      await require('./seed-turno-ui.cjs')(win);
      await js("document.getElementById('pair-open').click()");
      await action("document.getElementById('pair-prepare').click()");
      await js("document.getElementById('pair-email').value='gerente-ui@example.test';document.getElementById('pair-password').value='TesteLocal-123!'");
      await action("document.getElementById('pair-login-form').requestSubmit()");
      await js("document.getElementById('pair-shop').value='demo-loja-interface';document.getElementById('pair-target').value=document.getElementById('pair-uid').value;document.getElementById('pair-name').value='Balcao demonstracao'");
      await action("document.getElementById('pair-issue-form').requestSubmit()");
      await js("document.getElementById('pair-token').value=document.getElementById('pair-issued').value");
      await action("document.getElementById('pair-activate-form').requestSubmit()");
      assert.match(await js("document.getElementById('pair-terminal-state').textContent"),/Terminal ativo/);
      await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.getElementById('server-turn-open').click()");
      await wait("document.getElementById('server-turn-state').dataset.status === 'aberto'");
      await js("document.getElementById('checkout-close').click();document.getElementById('receive-open').click()");
      const area=require('electron').screen.getPrimaryDisplay().workArea;
      const width=Math.min(440,Math.floor(area.width*0.36));
      const customer=new BrowserWindow({x:area.x+area.width-width,y:area.y,width,height:area.height,title:'Cardapio LOCAL — loja ficticia',autoHideMenuBar:true,webPreferences:{partition:'demo-cardapio',nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
      customer.webContents.session.webRequest.onBeforeRequest((details,callback)=>{const u=new URL(details.url);callback({cancel:!(['http:','ws:'].includes(u.protocol)&&u.hostname==='127.0.0.1'&&['5173','8080','9099','5001'].includes(u.port))&&!['data:','blob:','devtools:'].includes(u.protocol)});});
      customer.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
      await customer.loadURL('http://127.0.0.1:5173/v2/recebimento-ui/mesa/mesa-1');
      console.log('DEMO PRONTA: PDV pareado e cardapio visiveis lado a lado. Feche ambas as janelas para encerrar.');
      const out=path.resolve(root,'../output/demo-local');fs.mkdirSync(out,{recursive:true});
      await new Promise(r=>setTimeout(r,1500));
      fs.writeFileSync(path.join(out,'pdv.png'),(await win.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(out,'cardapio.png'),(await customer.webContents.capturePage()).toPNG());
    }catch(error){console.error('DEMO FALHOU',error);app.exit(1);}
  });
});
require('../main.js');
