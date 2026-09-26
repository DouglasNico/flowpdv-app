const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/js/cartao-entrega.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export function','function');
function setup(call,{fromCache=false,atual=()=>true}={}){
  const node=tag=>({tag,children:[],dataset:{},value:'',textContent:'',disabled:false,isConnected:true,append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){}});
  let ids=0;const ctx={document:{createElement:node},crypto:{randomUUID:()=>`tentativa-${++ids}`},gerarCupomEntrega:()=>''};
  vm.runInNewContext(source,ctx);const aviso=node('p');
  const section=ctx.criarCartaoEntrega({record:{id:'P',data:()=>({status:'pronto',totalCentavos:1000})},fromCache,call,atual,aviso});
  return {section,aviso,open:section.children[1],detail:section.children[2]};
}
const entrega=()=>({status:'pronto',recebidoPdv:true,totalCentavos:1000,taxaEntregaCentavos:500,entrega:{nome:'Pessoa fictícia',telefone:'',logradouro:'Rua',numero:'1',complemento:'',bairro:'Centro',cidade:'Cidade',uf:'SP',cep:'00000000'}});
test('resposta perdida na saída conserva requestId e responsável ao retomar',async()=>{
  const chamadas=[];const f=setup(async(nome,dados)=>{
    if(nome==='consultarEntregaCaixaV2')return entrega();
    chamadas.push(JSON.parse(JSON.stringify(dados)));
    if(chamadas.length===1)throw Error('Resposta perdida');
    return {reutilizado:true};
  });
  await f.open.onclick();const input=f.detail.children.find(n=>n.tag==='input'),button=f.detail.children.at(-1);
  await button.onclick();assert.equal(chamadas.length,0);
  input.value='Entregador A';await button.onclick();
  assert.equal(button.disabled,false);assert.match(button.textContent,/retomar/);assert.equal(input.disabled,true);
  input.value='Alteração posterior';await button.onclick();
  assert.equal(chamadas.length,2);assert.deepEqual(chamadas[1],chamadas[0]);assert.equal(chamadas[1].responsavel,'Entregador A');
  assert.match(f.aviso.textContent,/confirmado/);
});
test('consulta indisponível libera nova tentativa e não avança a entrega',async()=>{
  let calls=0;const f=setup(async name=>{assert.equal(name,'consultarEntregaCaixaV2');if(++calls===1)throw Error('Sem conexão');return entrega();});
  await f.open.onclick();assert.equal(f.open.disabled,false);assert.equal(f.detail.children.length,0);assert.equal(f.aviso.textContent,'Sem conexão');
  await f.open.onclick();assert.equal(calls,2);assert.ok(f.detail.children.length>0);
});
test('consulta atrasada não expõe endereço após trocar de contexto',async()=>{
  let atual=true,resolve;const f=setup(()=>new Promise(r=>resolve=r),{atual:()=>atual});
  const consulta=f.open.onclick();atual=false;resolve(entrega());await consulta;
  assert.equal(f.detail.children.length,0);
  assert.equal(setup(()=>assert.fail('Não deveria consultar'),{fromCache:true}).open.disabled,true);
});
