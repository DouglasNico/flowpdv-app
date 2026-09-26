const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const core=require('../functions/estoque-migracao-core.cjs');
const produto={id:'p1',nome:'Farinha',estoque:2500,unidade:'g',controlarEstoque:true};
function fixture(){const map=new Map([['adega_produtos',JSON.stringify([produto])]]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const ctx={core,localStorage:storage,window:{electronAPI:{ambienteTeste:true}},console};vm.createContext(ctx);
 for(const file of ['migracao-estoque-teste.js','storage.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export async function /g,'async function '),ctx);
 return {ctx,map,storage,run:call=>ctx.migrarEstoqueTeste({storage,ambienteTeste:true,contexto:{lojaId:'loja',versao:0},produto,call})};}
test('conversão exata de unidades, gramas e mililitros sem arredondamento',()=>{
 assert.equal(core.planejarSaldoLegado(produto).saldoMili,2500);
 assert.equal(core.planejarSaldoLegado({...produto,unidade:'kg',estoque:'2,500'}).saldoMili,2500);
 assert.equal(core.planejarSaldoLegado({...produto,unidade:'ml',estoque:750}).unidade,'litro');
 assert.equal(core.planejarSaldoLegado({...produto,unidade:'un',estoque:6}).saldoMili,6000);
 for(const patch of [{unidade:''},{unidade:'caixa'},{estoque:-1},{estoque:0.001},{precoFardo:20},{controlarEstoque:false},{estoque:Infinity}]) assert.throws(()=>core.planejarSaldoLegado({...produto,...patch}));
});
test('resposta perdida mantém bloqueio; retomada confirma sem alterar produtos locais',async()=>{
 const f=fixture(),original=f.map.get('adega_produtos');
 await assert.rejects(f.run(async()=>{throw Error('Sem conexão');}));
 assert.equal(JSON.parse(f.map.get('flowpdv_migracoes_estoque_teste'))[0].status,'pendente');
 assert.throws(()=>f.ctx.StorageService.saveVenda({id:'v',itens:[{id:'p1',quantidade:1}]}),/bloqueada/);
 assert.equal(f.map.has('adega_vendas'),false);
 await f.run(async()=>({estoqueId:'destino',plano:core.planejarSaldoLegado(produto)}));
 assert.equal(JSON.parse(f.map.get('flowpdv_migracoes_estoque_teste'))[0].status,'confirmado');assert.equal(f.map.get('adega_produtos'),original);
});
test('guarda real do armazenamento bloqueia edição, exclusão e movimento apenas no teste',async()=>{
 const f=fixture();await f.run(async()=>({estoqueId:'destino',plano:core.planejarSaldoLegado(produto)}));
 assert.throws(()=>f.ctx.StorageService.saveProdutos([{...produto,estoque:10}]),/bloqueada/);
 assert.doesNotThrow(()=>f.ctx.StorageService.saveProdutos([{...produto,nome:'Farinha Especial',ofertaCardapio:{versao:1,combo:{ativo:true,preco:30.9,fixos:[],bebidas:['coca']}}}]));
 assert.equal(JSON.parse(f.map.get('adega_produtos'))[0].nome,'Farinha Especial');
 assert.throws(()=>f.ctx.StorageService.adicionarProdutoExcluidoId('p1'),/bloqueada/);
 assert.throws(()=>f.ctx.StorageService.registrarMovimentoEstoque({produtoId:'p1',delta:-1}),/bloqueada/);
 // Fora do ambiente de teste o saldo migrado continua protegido; só metadados (ex.: combo) podem mudar.
 f.ctx.window.electronAPI.ambienteTeste=false;
 assert.throws(()=>f.ctx.StorageService.saveProdutos([{...JSON.parse(f.map.get('adega_produtos'))[0],estoque:10}]),/bloqueada/);
 assert.equal(JSON.parse(f.map.get('adega_produtos'))[0].estoque,2500);
});
test('falha ao gravar trava impede chamada remota; troca de loja não remapeia produto',async()=>{
 const f=fixture();let calls=0;const call=async()=>{calls++;return {estoqueId:'destino'};};
 await assert.rejects(f.ctx.migrarEstoqueTeste({storage:{getItem:()=>null,setItem(){throw Error('Disco cheio');}},ambienteTeste:true,contexto:{lojaId:'loja'},produto,call}));assert.equal(calls,0);
 await f.run(call);await assert.rejects(f.ctx.migrarEstoqueTeste({storage:f.storage,ambienteTeste:true,contexto:{lojaId:'outra'},produto,call}),/outra migração/);assert.equal(calls,1);
});
