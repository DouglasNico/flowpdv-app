const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const admin = require('../functions/node_modules/firebase-admin');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv'); assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cardapio-v2-')));
admin.initializeApp({ projectId: 'demo-flowpdv' }); const db = admin.firestore();
const timeout = setTimeout(() => { console.error('CARDAPIO FAIL: timeout'); app.exit(1); }, 180000);
app.whenReady().then(async () => {
  let servicesOffline=false;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const u = new URL(details.url); callback({ cancel: (servicesOffline && ['8080','9099','5001'].includes(u.port)) || (!(['http:', 'ws:'].includes(u.protocol) && u.hostname === '127.0.0.1' && ['5173','8080','9099','5001'].includes(u.port)) && !['data:','blob:','devtools:'].includes(u.protocol)) });
  });
  const win = new BrowserWindow({ show: false, width: 430, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  const js = source => win.webContents.executeJavaScript(source);
  const wait = async source => { const end = Date.now() + 25000; while (Date.now() < end) { if (await js(source)) return; await new Promise(r => setTimeout(r, 80)); } throw new Error(`Não concluiu ${source}: ${await js('document.body.innerText')}`); };
  try {
    await win.loadURL('http://127.0.0.1:5173/v2/lanchonete-ui/mesa/mesa-1');
    await wait("!!document.querySelector('[data-product]')");
    await js("document.querySelector('[data-product]').requestSubmit()");
    await wait("document.querySelector('#v2-message').dataset.error === 'true'");
    await js("document.querySelector('[data-option=bem]').value='1'; document.querySelector('[data-option=bacon]').value='1'; document.querySelector('[name=observacao]').value='Sem cebola'; document.querySelector('[data-product]').requestSubmit()");
    await wait("!document.querySelector('#v2-send').disabled");
    // Derruba só a leitura da resposta após o servidor efetivar a gravação.
    await js(`const originalJson = Response.prototype.json; Response.prototype.json = async function(...args) {
      const result = await originalJson.apply(this,args);
      if (this.url.includes('criarPedidoPublicoV2')) { Response.prototype.json = originalJson; throw new Error('Resposta perdida de propósito'); }
      return result;
    }; void 0`);
    await js("document.querySelector('#v2-send').click()");
    await wait("document.querySelector('#app').dataset.busy === 'false' && document.querySelector('#v2-send')?.textContent.includes('pendente')");
    assert.equal((await db.collection('lojas_v2/ui-store/pedidos').get()).size, 1);
    // Pausar canal após aceitar o pedido não pode impedir recuperar uma resposta perdida.
    await db.doc('catalogos_publicos_v2/lanchonete-ui').update({ canais: { mesas: false, retirada: true } });
    await db.doc('lojas_v2/ui-store').update({ modulos: { cardapio: true, mesas: false, retirada: true } });
    await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
    await wait("document.querySelector('#v2-send')?.textContent.includes('pendente')");
    await js("document.querySelector('#v2-send').click()");
    await wait("document.querySelector('#v2-confirmation')?.textContent.includes('Pedido recebido')");
    const orders = await db.collection('lojas_v2/ui-store/pedidos').get(); assert.equal(orders.size, 1);
    assert.equal(orders.docs[0].data().totalCentavos, 1250);
    assert.equal(await js("localStorage.getItem('v2:pendente:lanchonete-ui:mesa-1')"), null);
    await orders.docs[0].ref.update({ status: 'em_preparo' });
    // Janela oculta pode suspender polling por visibilidade; recarga exige confirmação atual ao voltar.
    await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
    await wait("document.querySelector('#v2-confirmation')?.textContent.includes('Em preparo')");
    await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve => setTimeout(resolve, 150));
    const output = path.resolve(__dirname, '../../output/etapa-2-cardapio'); fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'acompanhamento-mobile.png'), (await win.webContents.capturePage()).toPNG());
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true);
    await js("document.querySelector('#v2-new').click()");
    await wait("!!document.querySelector('[data-product]')");
    assert.ok(await js("document.querySelector('#v2-message').textContent.includes('pausado')"));
    assert.equal(await js("document.querySelector('[data-product] button').disabled"), true);
    assert.equal(await js("document.querySelector('#v2-send').disabled"), true);
    await db.doc('catalogos_publicos_v2/lanchonete-ui').update({ canais: { mesas: true, retirada: true } });
    await db.doc('lojas_v2/ui-store').update({ modulos: { cardapio: true, mesas: true, retirada: true } });
    await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.reload(); });
    await wait("document.querySelector('[data-product] button')?.disabled === false");
    fs.writeFileSync(path.join(output, 'cardapio-mobile.png'), (await win.webContents.capturePage()).toPNG());
    console.log('CARDAPIO PASS: opções, adicionais, resposta perdida recuperada mesmo com canal pausado, bloqueio de novos pedidos, reativação, acompanhamento e largura móvel.');
    await require('./delivery-cardapio-ui.cjs')(win,db);
    await require('./garcom-cardapio-ui.cjs')(win,db,value=>{servicesOffline=value;});
    await require('./catalogo-interface.cjs')(win,db);
    clearTimeout(timeout); await admin.app().delete(); app.exit(0);
  } catch (error) { console.error('CARDAPIO FAIL:', error); clearTimeout(timeout); app.exit(1); }
});
