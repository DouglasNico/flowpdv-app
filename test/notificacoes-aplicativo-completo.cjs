const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

module.exports = async (win, { js, wait }) => {
  // Licença fictícia não existe no emulador; a reação à exclusão remota fica fora deste ensaio.
  await js("LicencaModule.tratarLicencaExcluidaNuvem=()=>{};void 0");
  const out = path.resolve(__dirname, '../../output/notificacoes-integradas');
  fs.mkdirSync(out, { recursive: true });
  let tamanho;
  const limpar = () => js("document.querySelectorAll('.flow-notice__close').forEach(b=>b.click());void 0");
  const capturar = async nome => {
    win.setFullScreen(false);
    win.setSize(...tamanho);
    // A janela oculta precisa de um frame novo após navegação/troca de layout.
    win.webContents.invalidate();
    await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
    await new Promise(r=>setTimeout(r,180));
    fs.writeFileSync(path.join(out,nome+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    const bounds = await js(`Array.from(document.querySelectorAll('.flow-notice')).map(e=>{const r=e.getBoundingClientRect(),z=Number(getComputedStyle(document.body).zoom)||1;return {l:r.left*z,r:r.right*z,b:r.bottom*z,w:innerWidth,h:innerHeight,overflow:e.scrollWidth>e.clientWidth}})`);
    assert.ok(bounds.length>0 && bounds.every(r=>r.l>=0&&r.r<=r.w+1&&r.b<=r.h+1&&!r.overflow),nome+': enquadramento');
  };
  for (const [w,h] of [[1366,768],[1024,768]]) {
    tamanho = [w,h];
    win.setSize(w,h);
    for (const layout of ['classico','moderno']) {
      await limpar();
      await js(`App.trocarAba('pdv');App.aplicarLayoutPdv('${layout}');PdvModule.carrinho=[];PdvModule.renderCarrinho();PdvModule.focarInputLeitor();void 0`);
      await new Promise(r=>setTimeout(r,200));
      const foco = await js('document.activeElement.id');
      await js('PdvModule.abrirModalCortesia();PdvModule.abrirModalCortesia();void 0');
      assert.equal(await js("document.body.classList.contains('pdv-layout-classico')"),layout==='classico');
      assert.equal(await js('document.activeElement.id'),foco);
      assert.equal(await js("document.querySelectorAll('.flow-notice--warning').length"),1);
      assert.match(await js("document.querySelector('.flow-notice--warning').textContent"),/Carrinho vazio/);
      await capturar(`pdv-${layout}-${w}`);
    }
    await limpar();
    await js(`App.trocarAba('comandas');ComandasModule.abrirModalNovaComanda();document.getElementById('nova-comanda-nome-input').value='Mesa teste ${w}';document.getElementById('nova-comanda-tipo-select').value='mesa';ComandasModule.salvarNovaComanda();void 0`);
    const id = await js('ComandasModule.comandaAtivaId');
    assert.equal(await js("document.getElementById('tab-comandas').classList.contains('active')"),true);
    await limpar();
    await js(`for(let i=0;i<20;i++)ComandasModule.adicionarItem(${JSON.stringify(id)},StorageService.getProdutos()[0],1);void 0`);
    assert.equal(await js(`ComandasModule.getComandas().find(c=>c.id===${JSON.stringify(id)}).itens[0].quantidade`),20);
    assert.equal(await js("document.querySelectorAll('.flow-notice--success').length"),1);
    await capturar(`mesas-${w}`);
    await limpar();
    await js(`window.gerenteTeste=AuthModule.getUsuario();StorageService.setTipoTerminal('atendimento');AuthModule.aplicarSessao({...gerenteTeste,cargo:'operador'});App.aplicarModoTerminal();AtendimentoPdvModule.setChip('mesa');document.getElementById('atend-numero-input').value=String(ComandasModule.getComandas().find(c=>c.id===${JSON.stringify(id)}).numero);document.getElementById('atend-btn-abrir').click();void 0`);
    assert.equal(await js("document.body.classList.contains('pdv-atendimento-ativo')"),true);
    await js("document.getElementById('atend-barcode-input').value=StorageService.getProdutos()[0].id;document.getElementById('atend-barcode-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));void 0");
    assert.equal(await js(`ComandasModule.getComandas().find(c=>c.id===${JSON.stringify(id)}).itens[0].quantidade`),21);
    await wait("document.activeElement.id==='atend-barcode-input'");
    assert.equal(await js("document.querySelectorAll('.flow-notice--success').length"),1);
    await capturar(`atendimento-${w}`);
    await js("StorageService.setTipoTerminal('caixa');AuthModule.aplicarSessao(gerenteTeste);App.aplicarModoTerminal();void 0");
  }
  // A troca de operador deve impedir a exposição de avisos da sessão anterior.
  await limpar();
  await js("for(let i=0;i<5;i++)App.showToast('Erro reservado ao operador anterior '+i,'error');AuthModule.logout();void 0");
  await wait("document.getElementById('modal-login-operador').classList.contains('active')");
  assert.equal(await js("Array.from(document.querySelectorAll('.flow-notice')).some(e=>e.getBoundingClientRect().width>0)"),false,'login não deve exibir aviso de sessão anterior');
  await js("document.getElementById('login-operador-select').value='operador-ficticio';document.getElementById('login-operador-select').dispatchEvent(new Event('change'));document.getElementById('login-pin-input').value='876543';document.getElementById('login-submit-btn').click();void 0");
  await wait("!document.getElementById('modal-login-operador').classList.contains('active')");
  assert.equal(await js("document.getElementById('toast-container').textContent.includes('Erro reservado')"),false,'aviso antigo não deve voltar após login');
  console.log('NOTIFICACOES INTEGRADAS PASS: login real, dois PDVs, mesas persistidas, 20 lançamentos, duas resoluções e troca de operador.');
};
