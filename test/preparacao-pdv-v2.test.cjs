const {test}=require('node:test'),assert=require('node:assert/strict');
function fixture(){
  const base='lojas_v2/legado-lic-flow-937278',rows=new Map([
    ['terminais_v2/caixa',{ativo:true,papel:'caixa',lojaId:'legado-lic-flow-937278',chaveLicenca:'LIC-FLOW-937278',deviceId:'computador'}],
    [base,{ativo:true,ativacaoOperacionalV2:{schema:1,estado:'suspensa',ambiente:'homologacao',revisao:1}}],
    [base+'/membros/caixa',{ativo:true,tipo:'terminal',papel:'caixa'}]
  ]),writes=[];
  const products=Array.from({length:60},(_,id)=>({data:()=>({produto:{id:String(id),precoVenda:18.9,controlarEstoque:false}})}));
  const db={doc:path=>({path}),collection:path=>({path,query:true}),runTransaction:async action=>action({get:async r=>r.query?{docs:products}:{data:()=>rows.get(r.path)},update:(ref,value)=>writes.push({path:ref.path,value})})};
  const f=require('../functions/preparacao-pdv-v2')({firestore:()=>db,auth:()=>({getUser:async()=>({disabled:false})})});
  const req={auth:{uid:'caixa'},data:{deviceId:'computador',revisao:1}};
  const preparar=()=>rows.get(base).corteOperacionalV2={schema:1,estado:'aguardando_pdv',legadoBloqueado:true,rotaPublicaV2:true};
  return {rows,writes,req,f,preparar,base};
}
test('sem corte não libera adesão nem grava estado',async()=>{const x=fixture();assert.equal((await x.f.consultarPreparacaoOperacionalPdvV2.run(x.req)).liberado,false);assert.equal(x.writes.length,0);});
test('adesão local pode ser preparada com operação suspensa, sem liberar vendas',async()=>{const x=fixture();x.preparar();const r=await x.f.consultarPreparacaoOperacionalPdvV2.run(x.req);assert.equal(r.produtos.length,60);assert.equal(r.deviceId,'computador');assert.equal(x.rows.get(x.base).ativacaoOperacionalV2.estado,'suspensa');assert.equal(x.writes.length,0);});
test('confirma somente revisão/dispositivo atuais e vínculo ativo',async()=>{
  const x=fixture();x.preparar();await x.f.confirmarAdesaoOperacionalPdvV2.run(x.req);assert.equal(x.writes.length,1);assert.equal(x.writes[0].value.adesaoOperacionalV2.confirmada,true);
  for(const alterar of [x=>x.req.data.revisao=2,x=>x.req.data.deviceId='outro',x=>x.rows.get(x.base+'/membros/caixa').ativo=false,x=>x.rows.get('terminais_v2/caixa').lojaId='outra']){const y=fixture();y.preparar();alterar(y);await assert.rejects(y.f.confirmarAdesaoOperacionalPdvV2.run(y.req));assert.equal(y.writes.length,0);}
});
