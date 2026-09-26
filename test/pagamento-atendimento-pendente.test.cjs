const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const code=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../src/js/pagamento-atendimento-pendente.js')],bundle:true,write:false,format:'cjs',platform:'node'}).outputFiles[0].text;
const ctx={module:{exports:{}}};vm.runInNewContext(code,ctx);
function fixture(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},auth={currentUser:{uid:'U'}};
 const f={map,storage,auth,loja:'L',perder:false,envios:[],resposta:null};
 const payload={atendimentoId:'A',versao:1,turno:{id:'T',terminalId:'PC',dataAbertura:'2026-09-23T10:00:00.000Z'},pagamentos:[{forma:'dinheiro',valorCentavos:500}],recebidoDinheiroCentavos:1000,confirmado:true};
 const call=async(n,d)=>{if(n==='consultarMeuTerminalV2')return {vinculado:true,papel:'caixa',lojaId:f.loja,identidadeOperacionalUid:f.identidade};if(n==='consultarPagamentoAtendimentoV2'){if(f.perder)throw Error('Resposta perdida');return {versao:1,somenteConferencia:true,lojaId:f.loja,terminalUid:f.identidade,...(f.resposta||{vendaId:'A',status:'concluida',totalCentavos:500,trocoCentavos:500})};}assert.equal(n,'fecharAtendimentoV2');f.envios.push(JSON.stringify(d));if(f.perder)throw Error('Resposta perdida');return f.resposta||{vendaId:'A',status:'concluida',totalCentavos:500,trocoCentavos:500};};
 f.criar=()=>ctx.module.exports.criarPagamentoAtendimentoPendente({storage,sessao:{auth,call},ambienteTeste:true});f.payload=payload;return f;
}
test('perda de resposta e reinício retomam os mesmos valores e referência',async()=>{const f=fixture();f.perder=true;await assert.rejects(f.criar().executar(f.payload,500));f.payload.pagamentos[0].valorCentavos=999;f.perder=false;await f.criar().retomar();assert.equal(f.envios[0],f.envios[1]);assert.equal(f.map.size,0);});
test('outro pagamento e outra loja não sobrescrevem a tentativa',async()=>{const f=fixture();f.perder=true;await assert.rejects(f.criar().executar(f.payload,500));const antes=[...f.map];await assert.rejects(f.criar().executar(f.payload,500),/Retome/);f.loja='OUTRA';await assert.rejects(f.criar().retomar(),/outra loja/);assert.deepEqual([...f.map],antes);assert.equal(f.envios.length,1);});
test('falha ao persistir impede envio financeiro',async()=>{const f=fixture();f.storage.setItem=()=>{throw Error('Disco cheio');};await assert.rejects(f.criar().executar(f.payload,500));assert.equal(f.envios.length,0);});
test('falha ao limpar e resposta divergente mantêm tentativa recuperável',async()=>{for(const tipo of ['disco','resposta']){const f=fixture(),del=f.storage.removeItem;if(tipo==='disco')f.storage.removeItem=()=>{throw Error('Disco cheio');};else f.resposta={vendaId:'OUTRA',status:'concluida',totalCentavos:500,trocoCentavos:500};await assert.rejects(f.criar().executar(f.payload,500));assert.equal(f.map.size,1);f.storage.removeItem=del;f.resposta=null;await f.criar().retomar();assert.equal(f.map.size,0);assert.equal(f.envios[0],f.envios[1]);}});
test('valores inválidos e journal corrompido não enviam pagamento',async()=>{const f=fixture();await assert.rejects(f.criar().executar({...f.payload,confirmado:false},500));f.map.set('flowpdv_pagamento_atendimento_pendente','{');await assert.rejects(f.criar().retomar());assert.equal(f.envios.length,0);});

test('troca de sessão durante a resposta conserva a tentativa',async()=>{
 const f=fixture();Object.defineProperty(f,'resposta',{get(){f.auth.currentUser={uid:'OUTRO'};return null;}});
 await assert.rejects(f.criar().executar(f.payload,500),/Sessão/);assert.equal(f.map.size,1);
});

test('perfil transferido confere sem reenviar pagamento e conserva bloqueio',async()=>{
 const f=fixture();f.perder=true;await assert.rejects(f.criar().executar(f.payload,500));f.perder=false;
 f.auth.currentUser={uid:'NOVO'};f.identidade='U';const marca=JSON.stringify({schema:1,lojaId:'L',terminalUid:'U',autenticadoUid:'NOVO'});
 f.map.set('flowpdv_recuperacao_operacao_bloqueada',marca);await f.criar().retomar();
 assert.equal(f.envios.length,1);assert.equal(f.map.has('flowpdv_pagamento_atendimento_pendente'),false);assert.equal(f.map.get('flowpdv_recuperacao_operacao_bloqueada'),marca);assert.ok(f.map.has('flowpdv_pagamento_atendimento_conferido'));
});
test('conferência perdida, divergente e falha no recibo mantêm diário recuperado',async()=>{
 for(const falha of ['resposta','divergente','disco']){
 const f=fixture();f.perder=true;await assert.rejects(f.criar().executar(f.payload,500));f.perder= falha==='resposta';f.identidade='U';
 f.map.set('flowpdv_recuperacao_operacao_bloqueada',JSON.stringify({schema:1,lojaId:'L',terminalUid:'U',autenticadoUid:'U'}));
 if(falha==='divergente')f.resposta={vendaId:'OUTRA',status:'concluida',totalCentavos:500,trocoCentavos:500};
 if(falha==='disco')f.storage.setItem=()=>{throw Error('Disco cheio');};
 await assert.rejects(f.criar().retomar());assert.equal(f.envios.length,1);assert.ok(f.map.has('flowpdv_pagamento_atendimento_pendente'));
 }
});
