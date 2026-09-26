const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async win=>{
  const js=c=>win.webContents.executeJavaScript(c), pacote=JSON.parse(fs.readFileSync(process.env.FLOWPDV_INSTALL_BACKUP,'utf8'));
  const wait=async c=>{const until=Date.now()+30000;while(Date.now()<until){if(await js(c))return;await new Promise(r=>setTimeout(r,100));}throw new Error(`Espera expirou: ${c}; ${await js("JSON.stringify({mensagem:document.getElementById('recovery-install-state')?.textContent,estado:document.getElementById('checkout-dialog')?.dataset,bloqueio:localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada'),journal:localStorage.getItem('flowpdv_instalacao_perfil_pendente')!==null})")}`);};
  const action=async c=>{await js(c);await wait("document.getElementById('pair-dialog').dataset.busy==='false'");};
  const fill=async values=>js(`for(const [k,v] of Object.entries(${JSON.stringify(values)}))document.getElementById(k).value=v;`);
  assert.equal(await js('window.electronAPI.perfilTesteNomeado'),true);
  await js("document.getElementById('pair-open').click()");await action("document.getElementById('pair-prepare').click()");
  const uid=await js("document.getElementById('pair-uid').value");assert.notEqual(uid,pacote.origem.terminalUid);
  await fill({'pair-email':'gerente-instalacao@example.test','pair-password':'TesteInstalacao-123!'});await action("document.getElementById('pair-login-form').requestSubmit()");
  await fill({'pair-shop':pacote.origem.lojaId,'pair-target':uid,'pair-name':'Caixa novo de teste'});await action("document.getElementById('pair-issue-form').requestSubmit()");
  await fill({'pair-token':await js("document.getElementById('pair-issued').value")});await action("document.getElementById('pair-activate-form').requestSubmit()");
  await fill({'pair-transfer-source':pacote.origem.terminalUid,'pair-transfer-target':uid,'pair-transfer-reason':'Troca de computador no ensaio'});
  await action("document.getElementById('pair-transfer-plan').click()");
  await js('window.confirm=()=>true;void 0');await action("document.getElementById('pair-transfer-apply').click()");
  assert.match(await js("document.getElementById('pair-transfer-state').textContent"),/Transferência concluída/);
  await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click()");
  await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
  await js(`const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(pacote))}],'backup.json',{type:'application/json'}));document.getElementById('recovery-file').files=dt.files;document.getElementById('recovery-file').dispatchEvent(new Event('change',{bubbles:true}));void 0`);
  console.log('CHAVES PERFIL NOVO:',await js('Object.keys(localStorage)'));
  await js("document.getElementById('recovery-install').click()");
  await wait("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')!==null && document.getElementById('checkout-dialog')?.dataset.novasPermitidas==='false' && localStorage.getItem('flowpdv_instalacao_perfil_pendente')===null");
  await wait("document.getElementById('pair-prepare')!==null");
  assert.equal(await js("localStorage.getItem('flowpdv_device_id')"),pacote.origem.terminalId);
  assert.equal(await js("window.StorageService.getProdutos().length"),1);
  await js("document.getElementById('pair-open').click()");await action("document.getElementById('pair-recover').click()");
  assert.equal(await js("document.getElementById('pair-uid').value"),uid);
  await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.getElementById('recovery-install-section').scrollIntoView({block:'center'})");
  assert.equal(await js("document.getElementById('op-add').disabled"),true);
  const bloqueios=await js(`(() => {
    const antes=JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
    const resultados=[
      ()=>StorageService.saveVenda({id:'VENDA-INDEVIDA',total:10,itens:[]}),
      ()=>StorageService.excluirTurnoHistorico('TRN-ORIGINAL'),
      ()=>StorageService.arquivarTurnoFechado({id:'TRN-ORIGINAL',status:'fechado'}),
      ()=>StorageService.registrarMovimentoEstoque({produtoId:'farinha',delta:1}),
      ()=>StorageService.recuperarVendaPendente()
    ].map(acao=>{try{acao();return false;}catch(e){return /Perfil em recuperação/.test(e.message);}});
    StorageService.init();
    return {resultados, intacto:antes===JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))};
  })()`);
  assert.equal(bloqueios.resultados.every(Boolean),true); assert.equal(bloqueios.intacto,true);
  console.log('ROTINAS LEGADAS UI PASS: venda, fechamento, histórico e estoque recusados no perfil recuperado sem escrita.');
  if(process.env.FLOWPDV_RECOVER_PAYMENT_TEST==='1'){
    assert.ok(await js("localStorage.getItem('flowpdv_pagamento_atendimento_pendente')"));
    assert.equal(await js("document.getElementById('checkout-resume-payment').hidden"),false);
    await js("document.getElementById('checkout-resume-payment').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false' && localStorage.getItem('flowpdv_pagamento_atendimento_pendente')===null");
    assert.ok(await js("localStorage.getItem('flowpdv_pagamento_atendimento_conferido')"));
    assert.ok(await js("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')"));
    assert.equal(await js("document.getElementById('op-add').disabled"),true);
    console.log('PAGAMENTO RECUPERADO UI PASS: backup instalado, consulta confirma pagamento original, tentativa removida e bloqueio operacional preservado.');
    return;
  }
  if(process.env.FLOWPDV_CLOSE_PROFILE_TEST==='1'){
    await js("document.getElementById('recovery-close-prepare').click()");
    await wait("!document.getElementById('recovery-close-form').hidden");
    await js("const f=document.getElementById('recovery-close-form');for(const [k,v] of Object.entries({dinheiroCentavos:'0',sangriasCentavos:'1',restauranteCentavos:'0',contagemCentavos:'8',fonte:'Comprovantes fictícios conferidos'}))f.elements[k].value=v;f.elements.confirmado.checked=true;if(f.elements.pendenciasConfirmadas)f.elements.pendenciasConfirmadas.checked=true;f.requestSubmit();void 0");
    await wait("document.getElementById('recovery-close-state').textContent.includes('divergem')");
    assert.equal(await js("localStorage.getItem('flowpdv_fechamento_recuperado_pendente')"),null);
    await js("document.getElementById('checkout-close').click();document.getElementById('pair-open').click()");
    await fill({'pair-email':'gerente-instalacao@example.test','pair-password':'TesteInstalacao-123!'});await action("document.getElementById('pair-login-form').requestSubmit()");
    await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.getElementById('recovery-close-form').elements.sangriasCentavos.value='2';document.getElementById('recovery-close-form').requestSubmit();document.getElementById('recovery-close-form').requestSubmit()");
    await wait("localStorage.getItem('adega_turno_atual')===null && localStorage.getItem('flowpdv_fechamento_recuperado_pendente')===null");
    await wait("!!document.getElementById('checkout-dialog')");
    assert.equal(await js('StorageService.getHistoricoTurnos().length'),1);
    assert.equal(await js('StorageService.getHistoricoTurnos()[0].saldoEsperado'),8);
    assert.equal(await js('StorageService.getHistoricoTurnos()[0].diferenca'),0);
    assert.ok(await js("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')"));
    if(process.env.FLOWPDV_PENDING_RECOVERY_TEST==='1'){
      await js("document.getElementById('pair-open').click()");await fill({'pair-email':'gerente-instalacao@example.test','pair-password':'TesteInstalacao-123!'});await action("document.getElementById('pair-login-form').requestSubmit()");
      await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.getElementById('recovery-release-prepare').click()");
      await wait("!document.getElementById('recovery-release-form').hidden");
      assert.match(await js("document.getElementById('recovery-release-form').textContent"),/Conta C1/);
      const out=path.resolve(__dirname,'../../output/etapa-13');fs.mkdirSync(out,{recursive:true});
      for(const width of [1366,1024]){win.setSize(width,768);await js("document.getElementById('recovery-release-form').scrollIntoView({block:'start'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");fs.writeFileSync(path.join(out,'pendencias-'+width+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
      await js("const f=document.getElementById('recovery-release-form');const inputs=[...f.querySelectorAll('input[type=text],input:not([type])')];['0','2','8','2.500','Comprovantes e contas conferidos'].forEach((v,i)=>inputs[i].value=v);f.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true);f.requestSubmit();void 0");
      await wait("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')===null");
      console.log('PENDENCIAS PRESERVADAS UI PASS: contas de mesa e retirada exibidas, aceite independente, fechamento e liberação sem pagamento automático.');
    }
    console.log('FECHAMENTO RECUPERADO UI PASS: sangria divergente recusada, gerente fecha uma vez, histórico preservado e perfil permanece bloqueado para liberação final.');
    return;
  }
  if(process.env.FLOWPDV_RELEASE_PROFILE_TEST==='1'){
    await js("document.getElementById('recovery-release-prepare').click()");
    await wait("!document.getElementById('recovery-release-form').hidden");
    await js("const f=document.getElementById('recovery-release-form');const i=f.querySelectorAll('input');i[0].value='2,5';i[1].value='Contagem independente fictícia';i[2].checked=true;f.requestSubmit();void 0");
    await wait("document.getElementById('recovery-release-state').textContent.includes('diverge')");
    assert.ok(await js("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')"));
    await js("document.getElementById('checkout-close').click();document.getElementById('pair-open').click()");
    await fill({'pair-email':'gerente-instalacao@example.test','pair-password':'TesteInstalacao-123!'});await action("document.getElementById('pair-login-form').requestSubmit()");
    await js("document.getElementById('pair-close').click();document.getElementById('checkout-open').click();document.querySelector('#recovery-release-form input').value='2,25';document.getElementById('recovery-release-form').requestSubmit()");
    await wait("localStorage.getItem('flowpdv_recuperacao_operacao_bloqueada')===null");
    await wait("!!document.getElementById('checkout-dialog') && !document.getElementById('recovery-release-prepare')");
    assert.ok(await js("localStorage.getItem('flowpdv_liberacao_perfil_confirmada')"));
    assert.equal(await js('StorageService.getProdutos()[0].estoque'),2500);
    await js("document.getElementById('checkout-open').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    await js("document.getElementById('cycle-fund').value='10,00';document.getElementById('cycle-open-confirm').checked=true;document.getElementById('cycle-open-form').requestSubmit()");
    await wait("StorageService.getTurnoAtual()?.fundoRestauranteCentavos===1000 && document.getElementById('checkout-dialog').dataset.busy==='false'");
    await wait("!document.getElementById('local-cart-add').disabled");
    await js("document.getElementById('local-stock-product').value='farinha';document.getElementById('local-stock-quantity').value='250';document.getElementById('local-cart-add').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    await js("document.getElementById('local-stock-preview').click()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    await js("document.getElementById('local-stock-confirm').checked=true;document.getElementById('local-stock-form').requestSubmit();document.getElementById('local-stock-form').requestSubmit()");
    await wait("StorageService.getVendas().length===1 && localStorage.getItem('flowpdv_venda_servidor_pendente')===null && document.getElementById('checkout-dialog').dataset.busy==='false'");
    console.log('LIBERACAO PERFIL UI PASS: contagem antiga rejeitada; gerente autoriza saldo atual, perfil recarrega, abre novo turno e vende uma vez após dois envios.');
    return;
  }
  await js("document.getElementById('recovery-accounts-refresh').click()");
  await wait("!document.getElementById('recovery-accounts-refresh').disabled && document.getElementById('recovery-accounts-list').children.length===50");
  await js("document.getElementById('recovery-accounts-next').click()");
  await wait("!document.getElementById('recovery-accounts-refresh').disabled && document.getElementById('recovery-accounts-list').children.length===5");
  assert.equal(await js("document.getElementById('recovery-accounts-next').disabled"),true);
  await js("document.getElementById('recovery-accounts-prev').click()");
  await wait("document.getElementById('recovery-accounts-list').children.length===50");
  await js("document.getElementById('recovery-accounts-filter').value='pedidos';document.getElementById('recovery-accounts-filter').dispatchEvent(new Event('change'));document.getElementById('recovery-accounts-refresh').click()");
  await wait("!document.getElementById('recovery-accounts-refresh').disabled && document.getElementById('recovery-accounts-list').children.length===1");
  assert.match(await js("document.getElementById('recovery-accounts-list').textContent"),/aguarda-caixa/);
  assert.equal(await js("document.getElementById('op-add').disabled"),true);
  await js("window.dispatchEvent(new Event('offline'))");
  assert.equal(await js("document.getElementById('recovery-accounts-list').children.length"),0);
  console.log('PENDENCIAS RECUPERACAO UI PASS: contas 50/5, retorno e pedido pendente consultados no perfil bloqueado; perda de conexão limpa a lista.');
  const out=path.resolve(__dirname,'../../output/etapa-8q');fs.mkdirSync(out,{recursive:true});
  for(const width of [1366,1024]){win.setSize(width,768);await js("document.getElementById('recovery-install-section').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");fs.writeFileSync(path.join(out,`perfil-${width}.png`),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
};
