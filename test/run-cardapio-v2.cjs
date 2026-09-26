const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
async function main() {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv'); assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080'); assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  admin.initializeApp({ projectId: 'demo-flowpdv' }); const db = admin.firestore();
  await db.doc('lojas_v2/ui-store').set({ nome: 'Lanchonete de teste', ativo: true });
  await db.doc('lojas_v2/ui-store/mesas/mesa-1').set({ nome: 'Mesa 1', ativo: true });
  await db.doc('rotas_publicas_v2/lanchonete-ui').set({ lojaId: 'ui-store' });
  await db.doc('catalogos_publicos_v2/lanchonete-ui').set({ nome: 'Lanchonete de teste', publicado: true, pausado: false, versao: 1, produtos: [{ id: 'lanche', nome: 'X-burger', ativo: true, precoCentavos: 1000, grupos: [
    { id: 'ponto', nome: 'Ponto da carne', min: 1, max: 1, opcoes: [{ id: 'bem', nome: 'Bem passado', ativo: true, precoCentavos: 0, maxQuantidade: 1 }] },
    { id: 'extras', nome: 'Adicionais', min: 0, max: 2, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 2 }] }
  ] }] });
  const cardapio = path.resolve(__dirname, '../../../flowpdv-cardapio');
  const vite = spawn(process.execPath, [path.join(cardapio, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--strictPort', '--mode', 'teste'], { cwd: cardapio, windowsHide: true, stdio: 'pipe' });
  let viteExit = false; vite.on('exit', () => { viteExit = true; });
  vite.stderr.on('data', chunk => process.stderr.write(chunk));
  try {
    const deadline = Date.now() + 15000;
    let ready = false;
    while (Date.now() < deadline && !viteExit) { try { ready = (await fetch('http://127.0.0.1:5173')).ok; if (ready) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    if (!ready || viteExit) throw new Error('Servidor local do cardápio indisponível');
    const code = await new Promise((resolve, reject) => {
      const electron = spawn(require('electron'), [path.join(__dirname, 'cardapio-v2-browser.cjs')], { windowsHide: true, stdio: 'inherit' });
      electron.on('error', reject); electron.on('exit', resolve);
    });
    if (code !== 0) throw new Error('Falha no teste do cardápio');
  } finally { vite.kill(); await admin.app().delete(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
