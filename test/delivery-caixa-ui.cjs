const assert=require('node:assert/strict');
const admin=require('../functions/node_modules/firebase-admin');
module.exports=async win=>{
 assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
 const instance=admin.initializeApp({projectId:'demo-flowpdv'},'delivery-caixa-ui'),db=instance.firestore();
 const base='lojas_v2/demo-loja-interface',id='delivery-interface-isolado',ref=db.doc(`${base}/pedidos/${id}`),privateRef=db.doc(`${base}/dados_entrega/${id}`);
 const js=code=>win.webContents.executeJavaScript(code),selector=`#receive-deliveries [data-delivery-id="${id}"]`;
 const wait=async code=>{const deadline=Date.now()+25000;while(Date.now()<deadline){if(await js(code))return;await new Promise(r=>setTimeout(r,80));}throw new Error(`Delivery caixa: ${code}: ${await js("document.querySelector('#receive-state').textContent")}`);};
 try{
  await privateRef.set({nome:'Destinatário fictício',telefone:'11999999999',cep:'01000000',logradouro:'Rua de teste',numero:'8',complemento:'',bairro:'Centro',cidade:'São Paulo',uf:'SP'});
  await ref.set({tipo:'delivery',status:'novo',recebidoPdv:true,pagamento:'pendente',taxaEntregaCentavos:500,totalCentavos:1500,itens:[{nome:'Lanche fictício',quantidade:1,totalCentavos:1000,opcoes:[]}]});
  await js("document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#receive-open').click()");
  for(const [status,label] of [['novo','Iniciar preparo'],['em_preparo','Marcar pronto'],['pronto','Confirmar saída'],['saiu_entrega','Confirmar entrega']]){
   await wait(`document.querySelector(${JSON.stringify(selector)})?.firstElementChild?.textContent.includes(' • ${status} • ')`);
   await js(`document.querySelector(${JSON.stringify(selector)}).querySelector('button').click()`);
   await wait(`document.querySelector(${JSON.stringify(selector)})?.textContent.includes('Destinatário fictício')`);
   if(status==='pronto'){
    await js(`document.querySelector(${JSON.stringify(selector)}).querySelector('input').value='Entregador UI';[...document.querySelector(${JSON.stringify(selector)}).querySelectorAll('button')].find(b=>b.textContent.includes('cupom')).click()`);
    assert.ok(await js(`document.querySelector(${JSON.stringify(selector)}).querySelector('iframe').srcdoc.includes('Rua de teste')`));
    assert.ok(await js(`document.querySelector(${JSON.stringify(selector)}).querySelector('iframe').srcdoc.includes('SEM IMPRESSÃO FÍSICA')`));
   }
   await js(`[...document.querySelector(${JSON.stringify(selector)}).querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  }
  await wait(`!document.querySelector(${JSON.stringify(selector)})`);
  assert.equal((await ref.get()).data().status,'entregue');assert.equal((await ref.get()).data().pagamento,'pendente');
  assert.equal((await privateRef.get()).data().responsavel,'Entregador UI');
  const extras=[];const batch=db.batch();for(let i=0;i<52;i++){const extra=db.doc(`${base}/pedidos/zz-history-${String(i).padStart(3,'0')}`);extras.push(extra);batch.set(extra,{tipo:'delivery',status:'entregue',recebidoPdv:true,totalCentavos:1000,itens:[]});}await batch.commit();
  try{
   await js("document.querySelector('#delivery-history-filter').value='finalizadas';document.querySelector('#delivery-history-filter').dispatchEvent(new Event('change'));document.querySelector('#delivery-history-refresh').click()");
   await wait("document.querySelectorAll('#delivery-history-list section').length===25 && !document.querySelector('#delivery-history-next').disabled");
   await js("document.querySelector('#delivery-history-next').click()");
   await wait("document.querySelector('#delivery-history-state').textContent.includes('Página 2')");
   await js("document.querySelector('#delivery-history-next').click()");
   await wait("document.querySelector('#delivery-history-state').textContent.includes('Página 3')");
   assert.equal(await js("document.querySelectorAll('#delivery-history-list section').length"),3);
   assert.equal(await js("document.querySelector('#delivery-history-next').disabled"),true);
   await js("document.querySelector('#delivery-history-prev').click()");
   await wait("document.querySelector('#delivery-history-state').textContent.includes('Página 2')");
   console.log('DELIVERY HISTORICO UI PASS: 53 entregas em três páginas, retorno e limite correto.');
  }finally{const cleanup=db.batch();for(const extra of extras)cleanup.delete(extra);await cleanup.commit();}
  await js("document.querySelector('#receive-close').click();document.querySelector('#pair-open').click()");
  console.log('DELIVERY CAIXA UI PASS: endereço restrito, preparo, saída, responsável, prévia sem driver e entrega sem alterar pagamento.');
 }finally{await ref.delete();await privateRef.delete();await instance.delete();}
};
