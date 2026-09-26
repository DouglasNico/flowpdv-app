const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),path=require('node:path');
const local=require('node:module').createRequire(path.resolve(__dirname,'../../output/local-tools/package.json'));
module.exports=async(win,{js,wait})=>{
  const admin=require('../functions/node_modules/firebase-admin');
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
  const instance=admin.initializeApp({projectId:'demo-flowpdv'},'alimentacao-nativa'),db=instance.firestore(),base='lojas_v2/loja-app-ficticia';
  const {initializeApp,deleteApp}=local('firebase/app'),{getAuth,connectAuthEmulator,signInAnonymously,signInWithEmailAndPassword}=local('firebase/auth'),{getFunctions,connectFunctionsEmulator,httpsCallable}=local('firebase/functions');
  const clients=[];
  async function client(garcom=false){const app=initializeApp({projectId:'demo-flowpdv',apiKey:'demo-key'},randomUUID());clients.push(app);const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});if(garcom)await signInWithEmailAndPassword(auth,'garcom-app@example.test','TesteLocal-123!');else await signInAnonymously(auth);const fn=getFunctions(app,'us-central1');connectFunctionsEmulator(fn,'127.0.0.1',5001);return async(n,d)=>(await httpsCallable(fn,n)(d)).data;}
  const fill=fields=>js(`for(const [id,v] of Object.entries(${JSON.stringify(fields)}))document.getElementById(id).value=v;`);
  try{
    await db.doc(base).set({configVersao:1,modulos:{balcao:true,cardapio:true,mesas:true,retirada:true,garcom:true},cozinha:{kds:false,impressao:false},delivery:{ativo:true,pedidoMinimoCentavos:0,regioes:[{id:'centro',nome:'Centro',cepInicial:'01000000',cepFinal:'01999999',taxaCentavos:500,prazoMinutos:30}]}},{merge:true});
    await db.doc(base+'/mesas/mesa-app').set({ativo:true,nome:'Mesa nativa',comandaPdvId:'MESA-1'});
    await db.doc(base+'/estoque/lanche-app').set({saldoMili:10000,unidade:'un'});
    await db.doc(base+'/fichas_estoque/lanche-app').set({consumos:[{estoqueId:'lanche-app',quantidadeMili:1000}],opcoes:[]});
    await db.doc('rotas_publicas_v2/app-nativo').set({lojaId:'loja-app-ficticia'});
    await db.doc('catalogos_publicos_v2/app-nativo').set({publicado:true,pausado:false,versao:1,canais:{mesas:true,retirada:true,delivery:true},produtos:[{id:'lanche-app',nome:'Lanche integrado fictício',ativo:true,precoCentavos:500,grupos:[]}]});
    await admin.auth(instance).createUser({uid:'garcom-app',email:'garcom-app@example.test',password:'TesteLocal-123!',emailVerified:true});
    await db.doc(base+'/membros/garcom-app').set({papel:'garcom',tipo:'usuario',ativo:true});
    const customer=await client(),waiter=await client(true);
    const comum={slug:'app-nativo',catalogoVersao:1,itens:[{produtoId:'lanche-app',quantidade:1,observacao:'Ensaio no aplicativo completo',opcoes:[]}]};
    const delivery=await customer('criarPedidoPublicoV2',{...comum,requestId:randomUUID(),tipo:'delivery',entrega:{nome:'Pessoa fictícia',telefone:'11999999999',cep:'01000000',logradouro:'Rua fictícia',numero:'10',complemento:'',bairro:'Centro',cidade:'São Paulo',uf:'SP'},cotacao:{configuracaoVersao:1,taxaEntregaCentavos:500,totalCentavos:1000}});
    const payload={...comum,requestId:randomUUID(),tipo:'mesa',mesaId:'mesa-app'};
    const mesa=await waiter('criarPedidoGarcomV2',payload);assert.equal((await waiter('criarPedidoGarcomV2',payload)).pedidoId,mesa.pedidoId);
    await js("document.getElementById('receive-open').click()");
    await wait("document.querySelectorAll('#receive-list [data-atendimento-id]').length===2");
    let deliveryVenda;
    const pagarPedidos=async()=>{
    for(const [pedido,forma,valor] of [[delivery,'pix_manual','0'],[mesa,'dinheiro','10,00']]){
      const recebido=(await db.doc(base+'/pedidos/'+pedido.pedidoId).get()).data();assert.equal(recebido.recebidoPdv,true);
      const seletor=`#receive-list [data-atendimento-id="${recebido.atendimentoId}"] [data-action="checkout"]`;
      await js(`document.querySelector(${JSON.stringify(seletor)}).click()`);
      await fill({'checkout-method':forma,'checkout-cash':valor});
      if(pedido===mesa)win.webContents.session.webRequest.onHeadersReceived({urls:['http://127.0.0.1:5001/demo-flowpdv/us-central1/fecharAtendimentoV2']},(_d,cb)=>cb({cancel:true}));
      await js("document.getElementById('checkout-confirm').checked=true;document.getElementById('checkout-form').requestSubmit()");
      if(pedido===mesa){
        await wait("document.getElementById('checkout-dialog').dataset.busy==='false' && localStorage.getItem('flowpdv_pagamento_atendimento_pendente')!==null");
        win.webContents.session.webRequest.onHeadersReceived(null);
        assert.equal((await db.doc(base+'/pedidos/'+pedido.pedidoId).get()).data().pagamento,'pago');
        assert.equal(await js("document.getElementById('checkout-resume-payment').hidden"),false);
        const out=path.resolve(__dirname,'../../output/pagamento-pendente');require('fs').mkdirSync(out,{recursive:true});await js("document.getElementById('checkout-resume-payment').scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");win.webContents.invalidate();await new Promise(r=>setTimeout(r,150));require('fs').writeFileSync(path.join(out,'retomada.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
        await js("document.getElementById('checkout-resume-payment').click()");
        await wait("document.getElementById('checkout-dialog').dataset.busy==='false' && localStorage.getItem('flowpdv_pagamento_atendimento_pendente')===null");
        console.log('PAGAMENTO PENDENTE UI PASS: resposta interrompida após confirmação remota, tentativa preservada e retomada sem nova cobrança.');
      }else await wait("document.getElementById('checkout-dialog').dataset.busy==='false' && document.getElementById('checkout-message').textContent.includes('Venda registrada')");
      const pago=(await db.doc(base+'/pedidos/'+pedido.pedidoId).get()).data();assert.equal(pago.pagamento,'pago');if(pedido===delivery)deliveryVenda=pago.vendaId;
      await js("document.getElementById('checkout-close').click();document.getElementById('receive-open').click()");
    }
    };
    const sel=`#receive-deliveries [data-delivery-id="${delivery.pedidoId}"]`;
    for(const [status,label] of [['novo','Iniciar preparo'],['em_preparo','Marcar pronto'],['pronto','Confirmar saída'],['saiu_entrega','Confirmar entrega']]){
      await wait(`document.querySelector(${JSON.stringify(sel)})?.firstElementChild?.textContent.includes(' • ${status} • ')`);
      if(status==='saiu_entrega'){
        assert.notEqual((await db.doc(base+'/pedidos/'+delivery.pedidoId).get()).data().pagamento,'pago');
        await pagarPedidos();
        assert.equal((await db.doc(base+'/pedidos/'+delivery.pedidoId).get()).data().status,'saiu_entrega');
      }
      await js(`document.querySelector(${JSON.stringify(sel)}).querySelector('button').click()`);
      await wait(`document.querySelector(${JSON.stringify(sel)})?.textContent.includes('Pessoa fictícia')`);
      if(status==='pronto')await js(`document.querySelector(${JSON.stringify(sel)}).querySelector('input').value='Entregador fictício'`);
      await js(`[...document.querySelector(${JSON.stringify(sel)}).querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
    }
    await wait(`!document.querySelector(${JSON.stringify(sel)})`);
    await js("document.getElementById('receive-close').click();document.getElementById('checkout-open').click()");
    const saleSel=`#checkout-sales [data-venda-id="${deliveryVenda}"]`;
    await wait(`!!document.querySelector(${JSON.stringify(saleSel+' button')})`);
    await js(`document.querySelector(${JSON.stringify(saleSel+' button')}).click()`);
    await fill({'checkout-reason':'Estorno fictício após conferir a entrega'});
    await js("document.getElementById('checkout-return').checked=true;document.getElementById('checkout-refund-confirm').checked=true;document.getElementById('checkout-adjust').requestSubmit()");
    await wait(`document.querySelector(${JSON.stringify(saleSel)})?.dataset.status==='estornada' && document.getElementById('checkout-dialog').dataset.busy==='false'`);
    const desistiu=await customer('criarPedidoPublicoV2',{...comum,requestId:randomUUID(),tipo:'delivery',entrega:{nome:'Cancelamento fictício',telefone:'11999999999',cep:'01000000',logradouro:'Rua fictícia',numero:'10',complemento:'',bairro:'Centro',cidade:'São Paulo',uf:'SP'},cotacao:{configuracaoVersao:1,taxaEntregaCentavos:500,totalCentavos:1000}});
    await js("document.getElementById('checkout-close').click();document.getElementById('receive-open').click()");
    const cancelSelector='#receive-list button[data-action="cancel"]';
    await wait(`[...document.querySelectorAll(${JSON.stringify(cancelSelector)})].some(b=>b.textContent.includes(${JSON.stringify(desistiu.pedidoId)}))`);
    await js(`[...document.querySelectorAll(${JSON.stringify(cancelSelector)})].find(b=>b.textContent.includes(${JSON.stringify(desistiu.pedidoId)})).click()`);
    await fill({'checkout-reason':'Cliente desistiu antes do pagamento'});
    await js("document.getElementById('checkout-adjust').requestSubmit()");
    await wait("document.getElementById('checkout-dialog').dataset.busy==='false' && document.getElementById('checkout-message').textContent.includes('Pedido cancelado')");
    const cancelado=(await db.doc(base+'/pedidos/'+desistiu.pedidoId).get()).data();
    assert.equal(cancelado.status,'cancelado');assert.notEqual(cancelado.pagamento,'pago');
    const contaCancelada=(await db.doc(base+'/atendimentos/'+cancelado.atendimentoId).get()).data();
    assert.equal(contaCancelada.totalCentavos,0);assert.equal(contaCancelada.taxaEntregaCentavos,0);assert.equal(contaCancelada.itens.length,0);
    assert.equal((await db.collection(base+'/vendas').get()).size,2);
    assert.equal((await db.doc(base+'/estoque/lanche-app').get()).data().saldoMili,9000);
    console.log('CANCELAMENTO DELIVERY UI PASS: pedido público cancelado sem pagamento, taxa ou baixa de estoque; nenhuma venda adicional.');
    await js("document.getElementById('checkout-reconcile').click()");
    await wait("document.getElementById('checkout-reconciliation').dataset.totalCentavos==='500' && document.getElementById('checkout-dialog').dataset.busy==='false'");
    assert.equal(await js('StorageService.getVendas().length'),3);
    assert.equal((await db.doc(base+'/estoque/lanche-app').get()).data().saldoMili,9000);
    await js("document.getElementById('server-turn-refresh').click()");await wait("document.getElementById('checkout-dialog').dataset.busy==='false'");
    await fill({'server-turn-count':'20,00'});await js("document.getElementById('server-turn-confirm').checked=true;document.getElementById('server-turn-close-form').requestSubmit()");
    await wait("document.getElementById('server-turn-state').dataset.status==='fechado' && document.getElementById('checkout-dialog').dataset.busy==='false'");
    await fill({'cycle-count':'20,00'});await js("document.getElementById('cycle-close-confirm').checked=true;document.getElementById('cycle-close-form').requestSubmit()");
    await wait("StorageService.getTurnoAtual()===null && document.getElementById('checkout-dialog').dataset.busy==='false'");
    assert.equal(await js('StorageService.getHistoricoTurnos()[0].diferenca'),0);assert.equal(await js('StorageService.getHistoricoTurnos()[0].totalVendasGeral'),5);
    await js("document.getElementById('checkout-close').click()");
    console.log('ALIMENTAÇÃO NATIVA UI PASS: pedido público delivery, garçom com reenvio único, recebimento, Pix/dinheiro, entrega, estorno com estoque e turno consolidado sem duplicação.');
  }finally{win.webContents.session.webRequest.onHeadersReceived(null);for(const app of clients)await deleteApp(app);await instance.delete();}
};
