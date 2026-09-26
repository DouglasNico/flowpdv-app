const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/js/ativacao-pendente-teste.js'),'utf8').replace('export function','function'),ctx);
const create=ctx.criarAlteracaoAtivacaoTeste;
const nova={estado:'suspensa',motivo:'Conferência administrativa',revisaoEsperada:2,confirmado:true};
function fixture(){const values=new Map();return {storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},uid:'gerente',lojaId:'loja',uuid:()=> 'pedido-1',ambienteTeste:true};}
test('perda de resposta e recarga retomam exatamente o payload persistido',async()=>{
 const f=fixture();let original;
 const first=create({...f,call:async(n,p)=>{original=JSON.stringify(p);throw Object.assign(new Error('Rede'),{code:'functions/unavailable'});}});
 await assert.rejects(first.executar(nova));assert.ok(first.pendente());
 const second=create({...f,uuid:()=>{throw Error('ID novo indevido');},call:async(n,p)=>{assert.equal(JSON.stringify(p),original);return {reutilizado:true};}});
 assert.equal((await second.executar({...nova,estado:'habilitada'})).reutilizado,true);assert.equal(second.pendente(),null);
});
test('conflito definitivo limpa tentativa para permitir nova conferência',async()=>{
 const f=fixture(),p=create({...f,call:async()=>{throw Object.assign(new Error('Revisão'),{code:'functions/failed-precondition'});}});
 await assert.rejects(p.executar(nova));assert.equal(p.pendente(),null);
});
test('tentativa não atravessa loja ou usuário; erro de permissão não a apaga',async()=>{
 const f=fixture(),p=create({...f,call:async()=>{throw Object.assign(new Error('Revogado'),{code:'functions/permission-denied'});}});
 await assert.rejects(p.executar(nova));assert.ok(p.pendente());
 assert.equal(create({...f,uid:'outro'}).pendente(),null);assert.equal(create({...f,lojaId:'outra'}).pendente(),null);
});
test('falha ao persistir impede envio e perfil normal é recusado',async()=>{
 const f=fixture();let calls=0;
 const p=create({...f,storage:{...f.storage,setItem:()=>{throw Error('Disco');}},call:async()=>calls++});
 await assert.rejects(p.executar(nova));assert.equal(calls,0);
 assert.throws(()=>create({...f,ambienteTeste:false}));
});
