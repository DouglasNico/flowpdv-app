const assert=require('node:assert/strict');
module.exports=async(win,{js,wait})=>{
  const fill=fields=>js(`for(const [id,v] of Object.entries(${JSON.stringify(fields)}))document.getElementById(id).value=v;`);
  const action=async code=>{await js(code);await wait("document.getElementById('pair-dialog').dataset.busy==='false'");};
  await js("document.getElementById('pair-open').click()");
  await action("document.getElementById('pair-prepare').click()");
  const uid=await js("document.getElementById('pair-uid').value");assert.ok(uid);
  await fill({'pair-email':'gerente-app@example.test','pair-password':'TesteLocal-123!'});
  await action("document.getElementById('pair-login-form').requestSubmit()");
  await fill({'pair-shop':'loja-app-ficticia','pair-target':uid,'pair-name':'Caixa nativo fictício'});
  await action("document.getElementById('pair-issue-form').requestSubmit()");
  const token=await js("document.getElementById('pair-issued').value");assert.equal(token.length,43);
  await fill({'pair-token':token});await action("document.getElementById('pair-activate-form').requestSubmit()");
  await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.getElementById('server-turn-open').click()");
  await wait("document.getElementById('server-turn-state').dataset.status==='aberto' && document.getElementById('checkout-dialog').dataset.busy==='false'");
  await js("document.getElementById('checkout-close').click()");
  for(const [index,layout] of ['classico','moderno'].entries()){
    await js(`App.aplicarLayoutPdv('${layout}');PdvModule.carrinho=[];PdvModule.desconto=0;PdvModule.adicionarAoCarrinho(StorageService.getProdutos()[0],1);`);
    if(index===0) await js("PdvModule.executarGravacaoVenda('Dinheiro',null,20,10)");
    else await js("PdvModule.pagamentosLancados=[{forma:'Dinheiro',valor:4,valorEntregue:5},{forma:'PIX',valor:6}];PdvModule.trocoDinheiroTotal=1;PdvModule.executarFinalizacaoVendaCompleta()");
    assert.equal(await js('StorageService.getVendas().length'),index+1);
    assert.equal(await js('PdvModule.carrinho.length'),0);
    assert.equal(await js("localStorage.getItem('flowpdv_venda_servidor_pendente')"),null);
    assert.equal(await js(`StorageService.getVendas()[${index}].operadorId`),'operador-ficticio');
    await js('PdvModule.fecharModalSucessoImpressao()');
  }
  assert.equal(await js('StorageService.getProdutos()[0].estoque'),20);
  const resumo=await js('CaixaModule.calcularResumoFinanceiro(StorageService.getTurnoAtual())');
  assert.equal(resumo.totalVendas,20);
  win.webContents.session.webRequest.onBeforeSendHeaders({urls:['http://127.0.0.1:5001/demo-flowpdv/us-central1/confirmarGravacaoVendaLocalV2']},(_details,callback)=>callback({cancel:true}));
  try {
    await js("PdvModule.adicionarAoCarrinho(StorageService.getProdutos()[0],1);PdvModule.executarGravacaoVenda('Dinheiro',null,10,0)");
    assert.equal(await js('StorageService.getVendas().length'),3);
    assert.equal(await js('PdvModule.carrinho.length'),1);
    const pendente=await js("JSON.parse(localStorage.getItem('flowpdv_venda_servidor_pendente'))");assert.ok(pendente.venda.id);
    await js("PdvModule.executarGravacaoVenda('Dinheiro',null,10,0)");
    assert.equal(await js('StorageService.getVendas().length'),3);
    assert.equal(await js("JSON.parse(localStorage.getItem('flowpdv_venda_servidor_pendente')).venda.id"),pendente.venda.id);
    await win.webContents.reload();
    await wait("!!window.AuthModule && !!document.getElementById('checkout-open')");
    if(await js("document.body.classList.contains('tela-login-ativa')")){
      await js("document.getElementById('login-operador-select').value='operador-ficticio';document.getElementById('login-pin-input').value='876543';document.getElementById('login-submit-btn').click()");
      await wait("!document.body.classList.contains('tela-login-ativa')");
    }
    assert.equal(await js("JSON.parse(localStorage.getItem('flowpdv_venda_servidor_pendente')).venda.id"),pendente.venda.id);
  } finally { win.webContents.session.webRequest.onBeforeSendHeaders(null); }
  if(process.env.FLOWPDV_REVOKED_SALE_TEST==='1') await require('./revogacao-venda-pendente-ui.cjs')(win,{js,wait,uid});
  await js("document.getElementById('checkout-open').click()");
  await wait("!document.getElementById('local-stock-resume').hidden && document.getElementById('checkout-dialog').dataset.busy==='false'");
  await js("document.getElementById('local-stock-resume').click()");
  await wait("localStorage.getItem('flowpdv_venda_servidor_pendente')===null && document.getElementById('checkout-dialog').dataset.busy==='false'");
  assert.equal(await js('StorageService.getVendas().length'),3);
  assert.equal(await js('CaixaModule.calcularResumoFinanceiro(StorageService.getTurnoAtual()).totalVendas'),30);
  await js("document.getElementById('checkout-close').click()");
  console.log('VENDA NATIVA RECUPERAÇÃO PASS: confirmação HTTP interrompida, nova tentativa bloqueada, reinício e retomada sem cobrar/baixar novamente.');
  await js("CaixaModule.confirmarFechamentoCaixa();document.getElementById('server-turn-refresh').click()");
  await wait("document.getElementById('server-turn-state').dataset.status==='aberto' && document.getElementById('checkout-dialog').dataset.busy==='false'");
  await fill({'server-turn-count':'0,00'});
  await js("document.getElementById('server-turn-confirm').checked=true;document.getElementById('server-turn-close-form').requestSubmit()");
  await wait("document.getElementById('server-turn-state').dataset.status==='fechado' && document.getElementById('checkout-dialog').dataset.busy==='false'");
  await fill({'cycle-count':'24,00'});
  await js("document.getElementById('cycle-close-confirm').checked=true;document.getElementById('cycle-close-form').requestSubmit()");
  await wait("StorageService.getTurnoAtual()===null && document.getElementById('checkout-dialog').dataset.busy==='false'");
  assert.equal(await js('StorageService.getHistoricoTurnos()[0].diferenca'),0);
  assert.equal(await js('StorageService.getHistoricoTurnos()[0].totalVendasGeral'),30);
  await js("document.getElementById('checkout-close').click();CaixaModule.confirmarAberturaCaixa()");
  assert.equal(await js("document.getElementById('checkout-dialog').open"),true);
  await fill({'cycle-fund':'15,00'});
  await js("document.getElementById('cycle-open-confirm').checked=true;document.getElementById('cycle-open-form').requestSubmit()");
  await wait("StorageService.getTurnoAtual()?.status==='aberto' && document.getElementById('checkout-dialog').dataset.busy==='false'");
  assert.equal(await js('CaixaModule.calcularResumoFinanceiro(StorageService.getTurnoAtual()).totalVendas'),0);
  assert.equal(await js('PdvModule.calcularSaldoEmGaveta(StorageService.getTurnoAtual())'),15);
  await js("document.getElementById('checkout-close').click()");
  console.log('CAIXA NATIVO UI PASS: comandos nativos usam ciclo integrado, caixa arquivado com R$24 em dinheiro/R$6 Pix e novo turno com R$15 de fundo sem duplicação.');
  await require('./alimentacao-aplicativo-completo-ui.cjs')(win,{js,wait});
  console.log('VENDA NATIVA UI PASS: login real, vínculo, turno, clássico em dinheiro e moderno misto, caixa sem dupla baixa local.');
};
