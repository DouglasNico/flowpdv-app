const assert=require('node:assert/strict'),admin=require('../functions/node_modules/firebase-admin');
module.exports=async win=>{
  assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  const app=admin.initializeApp({projectId:'demo-flowpdv'},'mesas-admin-ui'),db=app.firestore();
  const refs=Array.from({length:205},(_,i)=>db.doc(`lojas_v2/demo-loja-interface/mesas/zz-ui-${String(i).padStart(3,'0')}`));
  const js=c=>win.webContents.executeJavaScript(c),wait=async predicate=>{const end=Date.now()+25000;while(Date.now()<end){if(await js(predicate))return;await new Promise(r=>setTimeout(r,80));}throw Error('Paginação de mesas: '+await js("document.getElementById('admin-message').textContent"));};
  const reload=async()=>{await js("document.getElementById('admin-load').requestSubmit()");await wait("document.getElementById('admin-dialog').dataset.busy==='false'");};
  try{
    const batch=db.batch();refs.forEach((r,i)=>batch.set(r,{nome:'Mesa de teste '+i,ativo:true,comandaPdvId:'MESA-'+(8000+i)}));await batch.commit();
    await reload();assert.equal(await js("document.getElementById('admin-table-select').options.length"),201);
    assert.equal(await js("document.getElementById('admin-tables-more').hidden"),false);
    await js("document.getElementById('admin-tables-more').click()");await wait("document.getElementById('admin-dialog').dataset.busy==='false'");
    assert.equal(await js("document.getElementById('admin-tables-more').hidden"),true);
    await js("document.getElementById('admin-table-select').value='zz-ui-204';document.getElementById('admin-table-select').dispatchEvent(new Event('change'));document.getElementById('admin-table-name').value='Mesa da última página';document.getElementById('admin-table').requestSubmit()");
    await wait("document.getElementById('admin-dialog').dataset.busy==='false'");
    assert.equal((await refs[204].get()).data().nome,'Mesa da última página');
    console.log('MESAS ADMIN UI PASS: mais de 200 mesas, paginação e edição de mesa da última página.');
  }finally{const batch=db.batch();refs.forEach(r=>batch.delete(r));await batch.commit();await app.delete();await reload();}
};
