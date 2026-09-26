const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},license={chaveLicenca:'LIC-FLOW-937278'};
  const produtos=Array.from({length:60},(_,n)=>({id:String(n),precoVenda:10,estoque:50,controlarEstoque:n%2===0}));
  storage.setItem('adega_licenca',JSON.stringify(license));storage.setItem('flowpdv_device_id','caixa');
  const ctx={window:{electronAPI:{ambienteTeste:false}},localStorage:storage};vm.createContext(ctx);
  for(const f of ['perfil-operacional-v2.js','adesao-pdv-v2.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',f),'utf8').replace(/export function /g,'function '),ctx);
  const servico={getLicenca:()=>license,getDeviceId:()=>'caixa',getTipoTerminal:()=>'caixa',exigirVendaRecuperada(){},getTurnoAtual:()=>null,getProdutos:()=>produtos};
  const resposta={schema:1,liberado:true,lojaId:'legado-lic-flow-937278',chaveLicenca:license.chaveLicenca,deviceId:'caixa',revisao:2,produtos:produtos.map(p=>({id:p.id,precoCentavos:1000,semEstoque:!p.controlarEstoque,...(p.controlarEstoque?{saldoMili:50000}:{})}))};
  return {ctx,data,storage,servico,resposta,produtos,adotar:()=>ctx.confirmarAdesaoPdvV2({storage,servico,resposta})};
}
test('PDV normal exige corte confirmado, catálogo igual e caixa fechado; preserva vendas e produtos',()=>{
  const f=fixture();assert.equal(f.ctx.usarFluxoOperacionalV2(),false);f.resposta.liberado=false;assert.equal(f.adotar(),false);
  assert.equal(f.storage.getItem('flowpdv_migracoes_estoque_teste'),null);
  f.resposta.liberado=true;const antes=JSON.stringify(f.produtos);assert.equal(f.adotar(),true);
  assert.equal(f.ctx.usarAplicativoIntegradoV2(),true);assert.equal(JSON.stringify(f.produtos),antes);
  assert.equal(JSON.parse(f.storage.getItem('flowpdv_migracoes_estoque_teste')).filter(p=>p.semEstoque).length,30);
});
test('divergência de preço, estoque, dispositivo, duplicata, quantidade e turno bloqueia adesão antes da gravação',()=>{
  for(const mudar of [f=>f.produtos[0].precoVenda++,f=>f.produtos[0].estoque--,f=>f.resposta.deviceId='outro',f=>f.resposta.produtos[1].id='0',f=>f.resposta.produtos.pop(),f=>f.servico.getTurnoAtual=()=>({status:'aberto'}),f=>f.resposta.revisao=0]){
    const f=fixture();mudar(f);assert.throws(f.adotar);assert.equal(f.storage.getItem('flowpdv_migracoes_estoque_teste'),null);
  }
});
test('falha na escrita da adesão deixa estoque protegido e não libera motor oficial',()=>{
  const f=fixture(),save=f.storage.setItem;f.storage.setItem=(k,v)=>{if(k==='flowpdv_operacao_oficial_v2')throw Error('disco cheio');save(k,v);};
  assert.throws(f.adotar,/disco cheio/);assert.ok(f.storage.getItem('flowpdv_migracoes_estoque_teste'));assert.equal(f.ctx.usarAplicativoIntegradoV2(),false);
});
test('outra licença ou dispositivo não herda adesão, e perfil local de teste continua separado',()=>{
  const f=fixture();f.adotar();f.storage.setItem('flowpdv_device_id','outro');assert.equal(f.ctx.usarPdvOficialV2(),false);
  f.storage.setItem('flowpdv_device_id','caixa');f.storage.setItem('adega_licenca',JSON.stringify({chaveLicenca:'OUTRA'}));assert.equal(f.ctx.usarFluxoOperacionalV2(),false);
  f.ctx.window.electronAPI={ambienteTeste:true,aplicativoCompletoTeste:true};assert.equal(f.ctx.usarAplicativoIntegradoV2(),true);assert.equal(f.ctx.usarPdvOficialV2(),false);
});
