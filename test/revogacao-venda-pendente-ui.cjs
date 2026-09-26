const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
module.exports=async(win,{js,wait,uid})=>{
  assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  const admin=require('../functions/node_modules/firebase-admin');
  const app=admin.initializeApp({projectId:'demo-flowpdv'},'revogacao-pendente');
  const db=app.firestore(),base='lojas_v2/loja-app-ficticia';
  const ref=db.doc(`${base}/membros/${uid}`),original=(await ref.get()).data();
  assert.ok(original?.ativo);
  const raw=await js("localStorage.getItem('flowpdv_venda_servidor_pendente')");
  const venda=JSON.parse(raw).venda;
  const vendaRef=db.doc(`${base}/vendas_locais_v2/${createHash('sha256').update(uid+':'+venda.id).digest('hex')}`);
  const estoqueAntes=(await db.doc(base+'/estoque/estoque-ficticio').get()).data().saldoMili;
  try {
    await ref.update({ativo:false});
    await js("document.getElementById('checkout-open').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    // Executa também a tentativa pelo controle, mesmo se a autorização visual já o desabilitou.
    await js("document.getElementById('local-stock-resume').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    assert.equal(await js("localStorage.getItem('flowpdv_venda_servidor_pendente')"),raw);
    assert.equal(await js('StorageService.getVendas().length'),3);
    assert.equal((await vendaRef.get()).data().status,'aguardando_gravacao_local');
    assert.equal((await db.doc(base+'/estoque/estoque-ficticio').get()).data().saldoMili,estoqueAntes);
    await js("document.getElementById('checkout-close').click()");
    await wait("document.getElementById('receive-state').textContent.includes('Recebimento interrompido')");
  } finally {
    await ref.set(original);
    await app.delete();
  }
  await js("document.getElementById('receive-retry').click()");
  await wait("document.getElementById('receive-state').textContent.includes('Recebimento conectado')");
  await js("document.getElementById('checkout-open').click();document.getElementById('checkout-reconnect').click()");
  await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
  await js("document.getElementById('checkout-close').click()");
  console.log('REVOGACAO PENDENTE UI PASS: membro desativado não confirma nem duplica venda/estoque; diário preservado para identidade reautorizada.');
};
