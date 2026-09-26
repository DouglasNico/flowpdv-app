const assert=require('node:assert/strict');
module.exports=async win=>{
  const js=async c=>{
    const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (0,eval)(${JSON.stringify(c)})};}catch(e){return {ok:false,message:e.stack||e.message};}})()`);
    if(!r.ok)throw Error(r.message+' | '+c.slice(0,160));return r.value;
  };
  const wait=async c=>{const end=Date.now()+20000;while(Date.now()<end){if(await js(c))return;await new Promise(r=>setTimeout(r,80));}throw Error('Aplicativo completo: '+c+'; '+await js("['receive-state','checkout-message','pair-message'].map(id=>document.getElementById(id)?.textContent).join(' | ')"));};
  await wait("document.getElementById('modal-login-operador').classList.contains('active')");
  assert.equal(await js("document.getElementById('checkout-open').hidden && document.getElementById('admin-open').hidden"),true);
  await js("document.getElementById('login-operador-select').value='operador-ficticio';document.getElementById('login-operador-select').dispatchEvent(new Event('change'));document.getElementById('login-pin-input').value='000000';document.getElementById('login-submit-btn').click()");
  await wait("document.getElementById('login-erro-msg').style.display!=='none'");assert.equal(await js('AuthModule.getUsuario()'),null);
  await js("document.getElementById('login-pin-input').value='876543';document.getElementById('login-submit-btn').click()");
  await wait("AuthModule.getUsuario()?.id==='operador-ficticio' && !document.getElementById('modal-login-operador').classList.contains('active')");
  assert.equal(await js("!document.getElementById('checkout-open').hidden && !document.getElementById('admin-open').hidden"),true);
  for(const layout of ['classico','moderno']){
    await js(`App.trocarAba('pdv');App.aplicarLayoutPdv(${JSON.stringify(layout)});PdvModule.carrinho=[];PdvModule.adicionarAoCarrinho(StorageService.getProdutos()[0],1);`);
    assert.equal(await js("document.body.classList.contains('pdv-layout-classico')"),layout==='classico');
    assert.equal(await js('PdvModule.carrinho.length'),1);
    await js("PdvModule.executarGravacaoVenda('Dinheiro',null,10,0)");
    assert.equal(await js('StorageService.getVendas().length'),0);
    assert.equal(await js('StorageService.getProdutos()[0].estoque'),20);
    assert.equal(await js('PdvModule.carrinho.length'),1);
  }
  if(process.env.FLOWPDV_NATIVE_SALE_TEST==='1') await require('./venda-aplicativo-completo-ui.cjs')(win,{js,wait});
  if(process.env.FLOWPDV_NATIVE_SALE_TEST==='1') await require('./backup-protecao-integrada.cjs')(win,{js,wait});
  if(process.env.FLOWPDV_NOTIFICATIONS_TEST==='1') await require('./notificacoes-aplicativo-completo.cjs')(win,{js,wait});
  const protectedResult=await js(`(()=>{localStorage.setItem('flowpdv_recuperacao_operacao_bloqueada','{}');const antes=localStorage.getItem('adega_turno_atual');let bloqueado=false;try{CaixaModule.confirmarAberturaCaixa();}catch(e){bloqueado=/recuperação/.test(e.message);}return {bloqueado,intacto:antes===localStorage.getItem('adega_turno_atual')};})()`);
  assert.equal(protectedResult.bloqueado,true);assert.equal(protectedResult.intacto,true);
  assert.equal(await js("!!document.getElementById('checkout-open') && !!document.getElementById('admin-open')"),true);
  await js("document.getElementById('checkout-open').click();AuthModule.logout()");
  assert.equal(await js("document.getElementById('checkout-open').hidden && document.getElementById('admin-open').hidden && !document.getElementById('checkout-dialog').open"),true);
  console.log('APLICATIVO COMPLETO UI PASS: login nativo, clássico/moderno, venda migrada recusada no caminho antigo e caixa bloqueado em recuperação.');
};
