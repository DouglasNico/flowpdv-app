const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={};vm.createContext(ctx);
for(const file of ['resumo-restaurante-caixa.js','ciclo-caixa-teste.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export function /g,'function '),ctx);
const turno={id:'old',terminalId:'device',dataAbertura:'2026-09-21T10:00:00.000Z',status:'aberto',trocoInicial:0,sangrias:[]};
const snapshot={versao:1,lojaId:'loja',status:'fechado',turno:{...turno,chave:'hash'},revisao:3,recebimentos:0,estornos:0,totalCentavos:0,trocoInicialCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},detalhes:[]};
function fixture(){
 const data=new Map([['adega_turno_atual',JSON.stringify(turno)],['adega_vendas','[{"id":"sale"}]']]);let failKey;
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(k===failKey){failKey=null;throw Error('Disco cheio');}data.set(k,v);},removeItem(k){if(k===failKey){failKey=null;throw Error('Falha de escrita');}data.delete(k);}};
 const calls=[];const args={storage,ambienteTeste:true,terminalId:'device',agora:()=>new Date().toISOString(),uuid:()=> 'new-id',conferir(){},calcular:()=>({saldoEmGaveta:5,totalDinheiro:5,totalPix:0,totalDebito:0,totalCredito:0,totalFiado:0,totalCartaoNaoClassificado:0,fundoRestaurante:0,totalVendas:5,totalSangrias:0,vendasCount:1}),call:async(name,p)=>{calls.push({name,p});return name==='obterResumoFechadoTurnoV2'?snapshot:{turno:{...p.turno,status:'aberto',trocoInicialCentavos:p.trocoInicialCentavos}};}};
 return {data,storage,args,calls,create:()=>ctx.criarCicloCaixaTeste(args),fail:k=>{failKey=k;}};
}

test('venda ou histórico alterado durante fechamento impede arquivamento com base antiga',async()=>{
 for(const [key,valor] of [['adega_vendas','[{"id":"sale"},{"id":"nova"}]'],['adega_turnos_historico','[{"id":"outro"}]']]){
  const f=fixture(),call=f.args.call;
  f.args.call=async(n,p)=>{const result=await call(n,p);f.storage.setItem(key,valor);return result;};
  await assert.rejects(f.create().encerrar({dinheiroContadoCentavos:500,confirmado:true}),/recebeu alterações/);
  assert.equal(f.storage.getItem(key),valor);assert.equal(f.create().estado().atual.id,'old');
  assert.equal(f.storage.getItem('flowpdv_ciclo_teste_pendente'),null);
 }
});

test('abertura com histórico alterado preserva pendência e retoma a mesma referência',async()=>{
 const f=fixture();f.data.delete('adega_turno_atual');const call=f.args.call;
 f.args.call=async(n,p)=>{const result=await call(n,p);f.storage.setItem('adega_turnos_historico','[{"id":"preservar"}]');return result;};
 await assert.rejects(f.create().abrir({fundoCentavos:200,confirmado:true}),/recebeu alterações/);
 assert.equal(f.create().estado().atual.status,'abertura_pendente');
 f.args.call=call;await f.create().abrir({fundoCentavos:200,confirmado:true});
 assert.equal(f.create().estado().historico[0].id,'preservar');assert.deepEqual(f.calls[0].p,f.calls[1].p);
});
test('arquiva contagem e diferença; novo turno preserva vendas e histórico sem transferir saldo',async()=>{
 const f=fixture(),c=f.create();await c.encerrar({dinheiroContadoCentavos:400,confirmado:true});
 assert.equal(c.estado().atual,null);assert.equal(c.estado().historico[0].diferenca,-1);
 await c.abrir({fundoCentavos:200,confirmado:true});assert.equal(c.estado().atual.trocoInicial,0);assert.equal(c.estado().atual.fundoRestauranteCentavos,200);assert.equal(c.estado().historico.length,1);assert.equal(f.data.get('adega_vendas'),'[{"id":"sale"}]');
 await assert.rejects(c.abrir({fundoCentavos:200,confirmado:true}),/Encerre/);
});
test('recupera arquivamento interrompido entre histórico e remoção sem duplicar',async()=>{
 for(const key of ['adega_turnos_historico','adega_turno_atual']){
 const f=fixture();f.fail(key);await assert.rejects(f.create().encerrar({dinheiroContadoCentavos:500,confirmado:true}));
 const reloaded=f.create();reloaded.recuperar();reloaded.recuperar();assert.equal(reloaded.estado().historico.length,1);assert.equal(reloaded.estado().atual,null);assert.equal(f.storage.getItem('flowpdv_ciclo_teste_pendente'),null);
 }
});
test('abertura com resposta perdida retoma o mesmo ID após recarga e recusa novo fundo',async()=>{
 const f=fixture();f.data.delete('adega_turno_atual');const success=f.args.call;let lost=true;
 f.args.call=async(n,p)=>{const result=await success(n,p);if(lost){lost=false;throw Error('Resposta perdida');}return result;};
 await assert.rejects(f.create().abrir({fundoCentavos:300,confirmado:true}),/perdida/);
 assert.equal(f.create().estado().atual.status,'abertura_pendente');
 await assert.rejects(f.create().abrir({fundoCentavos:200,confirmado:true}),/mesmo fundo/);
 await f.create().abrir({fundoCentavos:300,confirmado:true});assert.deepEqual(f.calls[0].p,f.calls[1].p);assert.equal(f.create().estado().atual.status,'aberto');
});
test('bloqueia perfil real, fechamento sem confirmação, servidor aberto e estado local conflitante',async()=>{
 const f=fixture();assert.throws(()=>ctx.criarCicloCaixaTeste({...f.args,ambienteTeste:false}));
 await assert.rejects(f.create().encerrar({dinheiroContadoCentavos:500,confirmado:false}));
 f.args.call=async()=>({...snapshot,status:'aberto'});await assert.rejects(f.create().encerrar({dinheiroContadoCentavos:500,confirmado:true}));assert.equal(f.create().estado().atual.id,'old');
 const g=fixture();g.fail('adega_turno_atual');await assert.rejects(g.create().encerrar({dinheiroContadoCentavos:500,confirmado:true}));g.data.set('adega_turno_atual','{"id":"other"}');assert.throws(()=>g.create().recuperar(),/mudou/);
});
test('confirmação remota seguida de falha local recupera turno aberto sem nova chamada',async()=>{
 const f=fixture();f.data.delete('adega_turno_atual');const success=f.args.call;
 f.args.call=async(n,p)=>{const result=await success(n,p);f.fail('adega_turno_atual');return result;};
 await assert.rejects(f.create().abrir({fundoCentavos:1000,confirmado:true}));
 const reloaded=f.create();reloaded.recuperar();assert.equal(reloaded.estado().atual.status,'aberto');assert.equal(reloaded.estado().atual.fundoRestauranteCentavos,1000);assert.equal(f.calls.length,1);
});
test('encerra órfão local quando o servidor não tem turno aberto',async()=>{
 const f=fixture(),c=f.create();
 const closed=c.encerrarOrfaoLocal({dinheiroContadoCentavos:400,confirmado:true});
 assert.equal(c.estado().atual,null);assert.equal(closed.fechamentoCego,true);assert.equal(closed.diferenca,-1);
 assert.equal(f.calls.length,0);
 await assert.rejects(Promise.resolve().then(()=>c.encerrarOrfaoLocal({dinheiroContadoCentavos:400,confirmado:true})),/Confira o turno/);
});
test('retoma turno aberto do servidor mesmo com deviceId local diferente',async()=>{
 const f=fixture();
 f.data.set('adega_turno_atual',JSON.stringify({id:'fantasma',terminalId:'device',dataAbertura:'2026-09-21T10:00:00.000Z',status:'aberto',trocoInicial:0,sangrias:[]}));
 f.args.call=async(name,p)=>{
  f.calls.push({name,p});
  if(name==='consultarTurnoCaixaV2') return {turno:p.turno.id==='remoto'?{...p.turno,status:'aberto',trocoInicialCentavos:200}:null};
  if(name==='listarTurnosRecuperacaoV2') return {turnos:[{id:'remoto',terminalId:'outro-device',dataAbertura:'2026-09-21T09:00:00.000Z',status:'aberto',revisao:1}]};
  throw new Error(name);
 };
 const remoto=await f.create().retomarTurnoServidor();
 assert.equal(remoto.id,'remoto');
 assert.equal(f.create().estado().atual.id,'remoto');
 assert.equal(f.create().estado().atual.terminalId,'outro-device');
 assert.equal(f.storage.getItem('flowpdv_device_id'),'outro-device');
});
test('destrava ponteiro aberto quando o turno já está no histórico',async()=>{
 const f=fixture();
 const arquivado={id:'old',terminalId:'device',dataAbertura:'2026-09-21T10:00:00.000Z',status:'fechado',diferenca:0};
 f.data.set('adega_turnos_historico',JSON.stringify([arquivado]));
 const closed=f.create().encerrarOrfaoLocal({dinheiroContadoCentavos:500,confirmado:true});
 assert.equal(closed.id,'old');
 assert.equal(f.create().estado().atual,null);
 assert.equal(f.create().estado().historico.length,1);
 assert.equal(f.calls.length,0);
});
