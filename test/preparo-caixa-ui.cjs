const assert=require('node:assert/strict'),admin=require('../functions/node_modules/firebase-admin');
module.exports=async win=>{
  assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  const app=admin.initializeApp({projectId:'demo-flowpdv'},'preparo-caixa-ui'),db=app.firestore(),base='lojas_v2/demo-loja-interface';
  const shop=db.doc(base),cozinha=(await shop.get()).data().cozinha;
  const js=c=>win.webContents.executeJavaScript(c),wait=async c=>{const end=Date.now()+25000;while(Date.now()<end){if(await js(c))return;await new Promise(r=>setTimeout(r,80));}throw Error('Preparo caixa: '+c+' '+await js("document.getElementById('receive-preparo-state').textContent"));};
  const refs=['mesa','retirada'].map(tipo=>db.doc(`${base}/pedidos/sem-kds-ui-${tipo}`));
  try{
    await shop.update({cozinha:{...cozinha,kds:false}});
    for(const [i,tipo] of ['mesa','retirada'].entries())await refs[i].set({tipo,mesaNome:tipo==='mesa'?'Mesa teste sem KDS':null,status:'novo',recebidoPdv:true,totalCentavos:1000,itens:[{nome:'Lanche fictício',quantidade:1,totalCentavos:1000}]});
    await js("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById('receive-open').click()");
    await wait("document.getElementById('receive-preparo').hidden===false");
    for(const ref of refs){
      const selector=`#receive-preparo-list [data-pedido-id="${ref.id}"]`;
      for(const estado of ['novo','em_preparo','pronto']){
        await wait(`document.querySelector(${JSON.stringify(selector)})?.textContent.includes(' • ${estado} ') && !document.querySelector(${JSON.stringify(selector)}).querySelector('button').disabled`);
        await js(`document.querySelector(${JSON.stringify(selector)}).querySelector('button').click()`);
      }
      await wait(`document.querySelector(${JSON.stringify(selector)})===null`);
      const pedido=(await ref.get()).data();assert.equal(pedido.status,'entregue');assert.equal(pedido.preparoOrigem,'caixa');
      assert.equal((await db.doc(`${base}/impressoes_cozinha/${ref.id}`).get()).exists,false);
    }
    await shop.update({cozinha:{...cozinha,kds:true}});await wait("document.getElementById('receive-preparo').hidden===true");
    console.log('PREPARO CAIXA UI PASS: mesa e retirada até entregue sem KDS/garçom; reativar KDS retira os controles do caixa.');
  }finally{await shop.update({cozinha});for(const ref of refs)await ref.delete();await app.delete();await js("document.getElementById('receive-close').click();document.getElementById('pair-open').click()");}
};
