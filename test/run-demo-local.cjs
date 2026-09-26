const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const admin = require('../functions/node_modules/firebase-admin');
(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  admin.initializeApp({ projectId: 'demo-flowpdv' });
  await admin.auth().createUser({ uid: 'gerente-ui', email: 'gerente-ui@example.test', password: 'TesteLocal-123!', emailVerified: true });
  const db = admin.firestore();
  for (const id of ['demo-loja-interface', 'demo-loja-outra']) await db.doc(`lojas_v2/${id}`).set({ nome: 'Lanchonete fictícia', ativo: true });
  await db.doc('lojas_v2/demo-loja-interface').update({ caixaV2: { exigirTurno: true }, cozinha: { impressao: true, kds: true, papelMm: 80 } });
  await db.doc('lojas_v2/demo-loja-interface/membros/gerente-ui').set({ papel: 'gerente', tipo: 'usuario', ativo: true });
  await db.doc('lojas_v2/demo-loja-interface/mesas/mesa-1').set({ ativo: true, nome: 'Mesa 1', comandaPdvId: 'MESA-1' });
  await db.doc('lojas_v2/demo-loja-interface/fichas_estoque/lanche').set({ consumos: [{ estoqueId: 'lanche', quantidadeMili: 1000 }], opcoes: [{ grupoId: 'extras', opcaoId: 'bacon', consumos: [{ estoqueId: 'bacon', quantidadeMili: 200 }] }] });
  for (const stockId of ['lanche', 'bacon']) await db.doc(`lojas_v2/demo-loja-interface/estoque/${stockId}`).set({ saldoMili: 10000 });
  await db.doc('rotas_publicas_v2/recebimento-ui').set({ lojaId: 'demo-loja-interface' });
  await db.doc('catalogos_publicos_v2/recebimento-ui').set({ publicado: true, pausado: false, versao: 1, produtos: [
    { id: 'lanche', nome: 'Lanche fictício', ativo: true, precoCentavos: 1000, grupos: [
      { id: 'extras', nome: 'Adicionais', min: 0, max: 1, opcoes: [{ id: 'bacon', nome: 'Bacon', ativo: true, precoCentavos: 250, maxQuantidade: 1 }] }
    ] }
  ] });

  await db.doc('lojas_v2/demo-loja-interface').update({slug:'recebimento-ui',modulos:{cardapio:true,mesas:true,retirada:true}});
  const {spawn} = require('node:child_process');
  const cardapio = path.resolve(__dirname, '../../../flowpdv-cardapio');
  const vite = spawn(process.execPath,[path.join(cardapio,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--strictPort','--mode','teste'],{cwd:cardapio,windowsHide:true,stdio:'inherit'});
  try {
    let ready=false;
    for(let i=0;i<100;i++){try {if((await fetch('http://127.0.0.1:5173')).ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,200));}
    if(!ready) throw Error('Cardapio indisponivel');
    const child=spawn(require('electron'),[path.join(__dirname,'demo-visible.cjs')],{stdio:'inherit'});
    await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  } finally {vite.kill(); await admin.app().delete();}
})().catch(error=>{console.error(error);process.exitCode=1;});
