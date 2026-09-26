const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const base=path.resolve(__dirname,'../../..');
function mobile(before=false){
 let source=fs.readFileSync(path.join(base,'flowpdv-mobile/app.js'),'utf8');
 if(before){source=source.replace(/    if \(this.unsubRealtime && this.unsubRealtimeChave === this.chaveLicenca\) \{[\s\S]*?      return;\n    \}\n/,'');
 source=source.replace(/    if \(this.unsub(?:Licenca|Auditoria)Realtime && this.unsub(?:Licenca|Auditoria)RealtimeChave === this.chaveLicenca\) return;\n/g,'');}
 const subs=[];const ctx={window:{FirebaseDB:{db:{},doc:(_, ...p)=>p.join('/'),collection:(_,p)=>p,query:(...p)=>p,where:(...p)=>p,limit:n=>n,onSnapshot:(ref,next,error)=>{const sub={ref,next,error,stopped:false};subs.push(sub);return ()=>{sub.stopped=true;};}}},document:{addEventListener(){},getElementById(){return null;}},console};
 vm.runInNewContext(source,ctx);ctx.window.MobileApp.chaveLicenca='LOJA-A';return {app:ctx.window.MobileApp,subs};
}
test('mobile: dez atualizacoes mantem 3 listeners, antes criavam 30',()=>{
 const old=mobile(true), now=mobile();
 for(let i=0;i<10;i++){old.app.iniciarListenerTempoReal();now.app.iniciarListenerTempoReal();}
 assert.equal(old.subs.length,30);assert.equal(now.subs.length,3);
 now.app.chaveLicenca='LOJA-B';now.app.iniciarListenerTempoReal();assert.equal(now.subs.length,6);assert.ok(now.subs.slice(0,3).every(s=>s.stopped));
 now.app.pararSincronizacao();assert.ok(now.subs.every(s=>s.stopped));now.app.iniciarListenerTempoReal();assert.equal(now.subs.length,9);
 console.log('MEDICAO mobile: inscricoes antes=30 depois=3 (10 chamadas; nao equivale a leituras faturadas)');
});
test('mobile: listener encerrado por erro pode ser reaberto',()=>{
 const {app,subs}=mobile();app.iniciarListenerTempoReal();subs[1].error(Error('offline'));
 app.iniciarListenerTempoReal();assert.equal(subs.length,4);app.pararSincronizacao();
});
function pdv(){
 let reads=0;const waiting=[];const store=new Map();
 let source=fs.readFileSync(path.join(__dirname,'../src/js/cloud-sync.js'),'utf8').replace(/import[\s\S]*?from '[^']+';/g,'').replace('export const CloudSyncModule =','globalThis.CloudSyncModule =');
 const ctx={console,Map,JSON,db:{},doc:(_, ...p)=>p.join('/'),localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},getDoc:ref=>{reads++;return new Promise(resolve=>waiting.push(()=>resolve({exists:()=>true,data:()=>({itens:[{id:ref}]})})));}};
 vm.runInNewContext(source,ctx);return {app:ctx.CloudSyncModule,get reads(){return reads;},finish(){waiting.splice(0).forEach(f=>f());}};
}
test('PDV: resumos simultaneos iguais compartilham partes; depois releem',async()=>{
 const f=pdv(), data={partes:{produtos:2,vendas:3}};
 const a=f.app.completarPacote('A',data),b=f.app.completarPacote('A',data);assert.equal(f.reads,5);f.finish();
 const [x,y]=await Promise.all([a,b]);assert.equal(x.produtos.length,2);assert.equal(y.vendas.length,3);assert.equal(f.app.leiturasPartesPendentes.size,0);
 const c=f.app.completarPacote('A',data);assert.equal(f.reads,10);f.finish();await c;
 console.log('MEDICAO PDV: mesmo resumo concorrente, 5 partes: antes=10 getDoc depois=5; leitura posterior preservada');
});
test('PDV: lojas ou resumos diferentes nunca compartilham resposta',async()=>{
 const f=pdv();const runs=[f.app.completarPacote('A',{partes:{produtos:1},atualizadoEm:'1'}),f.app.completarPacote('B',{partes:{produtos:1},atualizadoEm:'1'}),f.app.completarPacote('A',{partes:{produtos:1},atualizadoEm:'2'})];
 assert.equal(f.reads,3);f.finish();await Promise.all(runs);assert.equal(f.app.leiturasPartesPendentes.size,0);
});

test('Master: uma inscricao de backup por loja, sem duplicar ao repetir',()=>{
 const subs=[];const ctx={window:{FirebaseDB:{db:{},doc:(_, ...p)=>p.join('/'),onSnapshot:ref=>{subs.push(ref);return ()=>{};}}},document:{readyState:"loading",addEventListener(){}},console};
 vm.runInNewContext(fs.readFileSync(path.join(base,'flowpdv-master-admin/js/app.js'),'utf8'),ctx);
 const app=ctx.window.MasterApp;app.clientes=[{chaveLicenca:'A'},{chaveLicenca:'B'}];
 for(let i=0;i<10;i++)app.iniciarOuvinteBackupsLojasRealtime();assert.equal(subs.length,2);
 console.log('MEDICAO Master: 2 lojas, 10 inicializacoes = 2 inscricoes de backup; sem mudanca');
});
test('Gestao V2: pedidos carregam uma vez; nova leitura so ao atualizar',async()=>{
 const nodes=new Map();for(const key of ['.g-orders-list','.g-orders-status','.g-orders-refresh','.g-orders-more'])nodes.set(key,{children:[],replaceChildren(){this.children=[];}});
 const host={isConnected:true,querySelector:k=>nodes.get(k)};let reads=0;
 const source=fs.readFileSync(path.join(base,'flowpdv-cardapio/src/pages/gestao-pedidos-v2.js'),'utf8').replace('export function renderPedidosGestao','function renderPedidosGestao');
 const ctx={};vm.runInNewContext(source+';globalThis.render=renderPedidosGestao;',ctx);
 const ui=ctx.render(host,async()=>{reads++;return {pedidos:[],proximo:null};},()=>true);
 for(let i=0;i<10;i++)ui.show();await new Promise(r=>setImmediate(r));ui.show();assert.equal(reads,1);
 await nodes.get('.g-orders-refresh').onclick();assert.equal(reads,2);
 console.log('MEDICAO Gestao V2: 10 aberturas=1 chamada; atualizar adiciona 1; sem mudanca');
});
