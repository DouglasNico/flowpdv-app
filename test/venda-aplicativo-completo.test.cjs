const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {precoProdutoLocalCentavos}=require('../functions/venda-local-core.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/js/perfil-operacional-v2.js'),'utf8').replace(/export /g,'')+'\n'+fs.readFileSync(path.join(__dirname,'../src/js/venda-aplicativo-completo.js'),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
const ctx=vm.createContext({precoProdutoLocalCentavos});vm.runInContext(source,ctx);
function base(){return {ponte:{pendente:()=>null,prepararCarrinho:(linhas,recebido,formas,ajustes)=>({venda:{},linhas,recebido,formas,ajustes})},servico:{exigirVendaRecuperada(){},getProdutos:()=>[{id:'p',precoVenda:10,unidade:'un'}]},usuario:{id:'u',nome:'Operador'},carrinho:[{id:'p',precoUnitario:10,quantidade:2}],totais:{subtotal:20,total:20},pagamentos:[{forma:'Dinheiro',valor:20,valorEntregue:50}],podeDesconto:true};}
test('carrinho nativo conserva preço, identidade e dinheiro entregue para calcular troco',()=>{const p=ctx.prepararVendaAplicativo(base());assert.equal(p.recebido,50);assert.equal(p.linhas[0].quantidade,2);assert.equal(p.venda.operadorId,'u');});
test('pagamento misto e desconto autorizado preservam os valores',()=>{const b=base();b.totais.total=18;b.pagamentos=[{forma:'Dinheiro',valor:8,valorEntregue:10},{forma:'PIX',valor:10}];const p=ctx.prepararVendaAplicativo(b);assert.equal(p.formas.PIX,10);assert.equal(p.recebido,10);assert.equal(p.ajustes.desconto,2);});
test('voucher manual puro e misto entram no plano da integração',()=>{
  const puro=base();puro.pagamentos=[{forma:'Voucher',valor:20}];const a=ctx.prepararVendaAplicativo(puro);assert.equal(a.formas.Voucher,20);assert.equal(a.recebido,0);
  const legado=base();legado.pagamentos=[{forma:'VR - Refeição',valor:12},{forma:'Dinheiro',valor:8,valorEntregue:8}];const b=ctx.prepararVendaAplicativo(legado);assert.equal(b.formas.Voucher,12);assert.equal(b.recebido,8);
  const misto=base();misto.totais.total=20;misto.pagamentos=[{forma:'Voucher',valor:5},{forma:'PIX',valor:5},{forma:'Débito',valor:5},{forma:'Crédito',valor:5}];const c=ctx.prepararVendaAplicativo(misto);
  assert.equal(c.formas.Voucher,5);assert.equal(c.formas.PIX,5);assert.equal(c.formas['Débito'],5);assert.equal(c.formas['Crédito'],5);
});
test('parcelas da mesma forma são somadas em centavos, tolerando somente resíduos binários',()=>{const b=base();b.totais.total=19.900000000000002;b.pagamentos=[{forma:'PIX',valor:0.1+0.2},{forma:'PIX',valor:19.6}];const p=ctx.prepararVendaAplicativo(b);assert.equal(p.formas.PIX,19.9);assert.equal(p.ajustes.desconto,0.1);b.pagamentos[0].valor=0.301;assert.throws(()=>ctx.prepararVendaAplicativo(b));});
test('não prepara venda sem operador, com pendência, preço alterado ou quantidade/total divergentes',()=>{
  for(const mudar of [b=>b.usuario=null,b=>b.ponte.pendente=()=>({}),b=>b.carrinho[0].precoUnitario=9,b=>b.carrinho[0].quantidade=3,b=>b.carrinho[0].isFardo=true,b=>b.carrinho[0].comandaOrigemId='c',b=>b.carrinho[0].id='ausente']){const b=base();mudar(b);assert.throws(()=>ctx.prepararVendaAplicativo(b));}
});
test('não transforma TEF, fiado, valor excedente ou dinheiro insuficiente em pagamento manual',()=>{
  for(const mudar of [b=>b.pagamentos[0].tefInfo={},b=>b.pagamentos[0].forma='Fiado',b=>b.pagamentos[0].valor=21,b=>b.pagamentos[0].valorEntregue=19,b=>b.pagamentos.push({forma:'Dinheiro',valor:1}),b=>{b.totais.total=18;b.podeDesconto=false;},b=>b.pagamentos=[{forma:'Voucher',valor:20,tefInfo:{}}]]){const b=base();mudar(b);assert.throws(()=>ctx.prepararVendaAplicativo(b));}
});

test('registro exige adesão explícita e não atravessa troca de operador entre consultas',async()=>{
  for(const modo of ['sem-adesao','troca-operador','perfil-normal']){
    const b=base();let usuario=b.usuario,execucoes=0,chamadas=0;
    const auth={getUsuario:()=>usuario,temPermissao:()=>true};b.servico.isModuloAtivo=()=>false;
    const testCtx=vm.createContext({precoProdutoLocalCentavos,localStorage:{},crypto:{randomUUID:()=> 'id'},window:{electronAPI:{ambienteTeste:modo!=='perfil-normal',aplicativoCompletoTeste:true}},document:{body:{classList:{contains:()=>false}}},
      criarVendaServidorTeste:()=>({...b.ponte,prepararCarrinho:()=>({venda:{},lojaId:'loja'}),executar:async()=>{execucoes++;}}),
      sessaoTerminalTeste:()=>({call:async()=>{chamadas++;if(modo==='troca-operador')usuario={id:'outro'};return {lojaId:'loja',papel:'caixa',homologacaoHabilitada:modo!=='sem-adesao',modulos:{balcao:true}};}})});
    vm.runInContext(source,testCtx);
    await assert.rejects(testCtx.registrarVendaAplicativo({...b,auth}));assert.equal(execucoes,0);assert.equal(chamadas,modo==='perfil-normal'?0:modo==='troca-operador'?1:2);
  }
});
