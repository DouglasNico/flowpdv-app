const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async(win,db)=>{
  const js=code=>win.webContents.executeJavaScript(code),catalog=db.doc('catalogos_publicos_v2/lanchonete-ui'),shop=db.doc('lojas_v2/ui-store');
  const wait=async code=>{const deadline=Date.now()+25000;while(Date.now()<deadline){if(await js(code))return;await new Promise(r=>setTimeout(r,80));}throw Error(`Catálogo: ${code}: ${await js('document.body.innerText')}`);};
  const old=(await catalog.get()).data(),oldShop=(await shop.get()).data(),output=path.resolve(__dirname,'../../output/catalogo-funcional');fs.mkdirSync(output,{recursive:true});
  try{
    await catalog.set({nome:'Catálogo de teste',publicado:true,pausado:false,versao:80,canais:{retirada:true,mesas:true},produtos:[
      {id:'lanche',nome:'Lanche',ativo:true,precoCentavos:1000,grupos:[],categoria:'Lanches',ordem:2,descricao:'Pão e queijo'},
      {id:'agua',nome:'Água',ativo:true,precoCentavos:300,grupos:[],categoria:'Bebidas',ordem:1,imagemUrl:'https://res.cloudinary.com/exemplo/image/upload/v1/agua.jpg'}
    ]});
    await shop.update({modulos:{cardapio:true,retirada:true,mesas:true,garcom:true}});
    await win.loadURL('http://127.0.0.1:5173/v2/lanchonete-ui');
    await wait("document.querySelectorAll('[data-product]').length===2");
    assert.equal(await js("document.querySelector('[data-product]').dataset.product"),'agua');
    assert.match(await js("document.querySelector('[data-product=agua] img').src"),/^https:\/\/res.cloudinary.com\//);
    await js("document.querySelector('#v2-category').value='Lanches';document.querySelector('#v2-category').dispatchEvent(new Event('change'))");
    assert.equal(await js("document.querySelector('[data-product=agua]').hidden"),true);
    assert.ok(await js("document.querySelector('[data-product=lanche]').textContent.includes('Pão e queijo')"));
    for(const width of [360,1080]){
      win.setSize(width,900);await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true);
      fs.writeFileSync(path.join(output,`catalogo-${width}.png`),(await win.webContents.capturePage()).toPNG());
    }
    const before=(await db.collection('lojas_v2/ui-store/pedidos').get()).size;
    await js("document.querySelector('[data-product=lanche]').requestSubmit()");
    await js(`const catalogOriginal=Response.prototype.json;Response.prototype.json=async function(...args){const result=await catalogOriginal.apply(this,args);if(this.url.includes('criarPedidoPublicoV2')){Response.prototype.json=catalogOriginal;throw Error('Resposta perdida');}return result;};void 0`);
    await js("document.querySelector('#v2-send').click()");
    await wait("document.querySelector('#app').dataset.busy==='false' && document.querySelector('#v2-send').textContent.includes('pendente')");
    await catalog.update({publicado:false});
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await wait("document.querySelector('#v2-send')?.textContent.includes('pendente')");
    await js("document.querySelector('#v2-send').click()");
    await wait("document.querySelector('#v2-confirmation')?.textContent.includes('Pedido recebido')");
    assert.equal((await db.collection('lojas_v2/ui-store/pedidos').get()).size,before+1);
    await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});await wait("document.querySelector('#v2-confirmation')?.textContent.includes('Pedido recebido')");
    console.log('CATALOGO CONSUMIDOR UI PASS: ordem, categoria, descrição, foto com falha segura, 360/1080px e recuperação/acompanhamento com catálogo fora do ar.');
  }finally{await catalog.set(old);await shop.set(oldShop);}
};
