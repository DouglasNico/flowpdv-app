const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const crypto=require('node:crypto').webcrypto;
const code=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../src/js/liberacao-perfil-recuperado.js')],bundle:true,write:false,format:'cjs',platform:'node',logLevel:'silent'}).outputFiles[0].text;
const ctx={module:{exports:{}},crypto,TextEncoder};vm.runInNewContext(code,ctx);
function fixture(){
  const ref={id:'T',terminalId:'PC',terminalUid:'ORIGINAL',chave:'chave',dataAbertura:'2026-09-22T10:00:00.000Z'};
  const formas={dinheiro:0,pix_manual:0,cartao_manual:0};
  const estado={...ref,status:'fechado',revisao:2,revisaoConferida:1,totalCentavos:0,movimentos:0,formas,trocoInicialCentavos:0,dinheiroEsperadoCentavos:0,dinheiroContadoCentavos:0,diferencaCentavos:0};
  const snapshot={versao:1,lojaId:'LOJA',turno:ref,status:'fechado',revisao:2,totalCentavos:0,formas,trocoInicialCentavos:0,recebimentos:0,estornos:0,detalhes:[]};
  const local={...ref,status:'fechado',trocoInicial:0,totalDinheiro:5,totalSangrias:1,saldoEsperado:4,saldoInformado:4,diferenca:0,sangrias:[{valor:1}],restauranteV2:snapshot};
  const dados=new Map(Object.entries({flowpdv_recuperacao_operacao_bloqueada:JSON.stringify({schema:1,lojaId:'LOJA',terminalUid:'ORIGINAL',autenticadoUid:'NOVO'}),flowpdv_device_id:'PC',adega_turnos_historico:JSON.stringify([local]),adega_vendas:'[]',flowpdv_migracoes_estoque_teste:JSON.stringify([{lojaId:'LOJA',produto:{id:'P',nome:'Produto',unidade:'g',estoque:2500}}])}));
  const storage={get length(){return dados.size;},key:i=>[...dados.keys()][i],getItem:k=>dados.get(k)??null,setItem:(k,v)=>dados.set(k,String(v)),removeItem:k=>dados.delete(k)};
  const f={dados,storage,estado,local,saldo:2250,pedidos:[],envios:[],aposAutorizar:()=>{},auth:{currentUser:{uid:'NOVO'}}};
  f.pendencias={versao:1,somenteConferencia:true,lojaId:'LOJA',terminalUid:'ORIGINAL',digest:'a'.repeat(64),registros:[{grupo:'contas',id:'C',tipo:'mesa',status:'aberto',totalCentavos:500}]};
  const call=async(n,d)=>{
    const result=n==='consultarMeuTerminalV2'?{vinculado:true,papel:'caixa',lojaId:'LOJA',identidadeOperacionalUid:'ORIGINAL'}
    :n==='listarTurnosRecuperacaoV2'?{versao:1,lojaId:'LOJA',terminalUid:'ORIGINAL',somenteConferencia:true,turnos:[estado]}
    :n==='consultarRecuperacaoLocalV2'?{versao:1,lojaId:'LOJA',terminalUid:'ORIGINAL',turno:estado,registros:[]}
    :n==='conferirPendenciasRecuperacaoV2'?f.pendencias
    :n==='consultarTurnoCaixaV2'?{turno:estado}
    :n==='consultarMovimentosTurnoV2'?{turno:ref,movimentos:[]}
    :n==='obterResumoFechadoTurnoV2'?snapshot
    :n==='listarPendenciasAtendimentoV2'?{versao:1,lojaId:'LOJA',terminalUid:'ORIGINAL',somenteConferencia:true,tipo:d.tipo,registros:f.pedidos,proximo:null}
    :n==='conferirInventarioCorteV2'?{versao:1,lojaId:'LOJA',terminalUid:'ORIGINAL',somenteConferencia:true,produtos:[{legadoId:'P',nome:'Produto',estoqueId:'E',situacao:'vinculo_conferido',saldoAtualMili:f.saldo,unidadeServidor:'kg'}]}:assert.fail(n);
    return JSON.parse(JSON.stringify(result));
  };
  f.service=ctx.module.exports.criarLiberacaoPerfilRecuperado({storage,ambienteTeste:true,sessao:{auth:f.auth,call},gerencia:{call:async(n,d)=>{assert.equal(n,'autorizarLiberacaoPerfilV2');f.envios.push(d);await f.aposAutorizar();return {...d,versao:1,gerenteUid:'GERENTE'};}}});
  f.entrada={confirmado:true,fonte:'Comprovantes independentes',turnos:[{id:'T',dinheiroCentavos:500,sangriasCentavos:100,contagemCentavos:400}],produtos:[{id:'P',saldoMili:2250}]};
  return f;
}
test('libera após conferência independente sem regravar dinheiro, vendas ou estoque',async()=>{
  const f=fixture(),antes=f.dados.get('adega_turnos_historico');await f.service.preparar();await f.service.liberar(f.entrada);
  assert.equal(f.dados.has('flowpdv_recuperacao_operacao_bloqueada'),false);assert.equal(f.dados.get('adega_turnos_historico'),antes);assert.equal(f.envios[0].estoque[0].saldoMili,2250);
  assert.ok(f.dados.has('flowpdv_liberacao_perfil_confirmada'));
});
test('diferenças de dinheiro, sangria, contagem ou estoque mantêm bloqueio',async()=>{
  for(const campo of ['dinheiroCentavos','sangriasCentavos','contagemCentavos','estoque']){
    const f=fixture();await f.service.preparar();if(campo==='estoque')f.entrada.produtos[0].saldoMili=2500;else f.entrada.turnos[0][campo]++;
    await assert.rejects(f.service.liberar(f.entrada),/diverge/);assert.equal(f.envios.length,0);assert.ok(f.dados.has('flowpdv_recuperacao_operacao_bloqueada'));
  }
});
test('mudanças concorrentes, contas pendentes e turno aberto impedem liberação',async()=>{
  for(const change of [f=>{f.saldo=2249;},f=>{f.pedidos=[{id:'aberta'}];},f=>f.dados.set('adega_turno_atual',JSON.stringify(f.local))]){
    const f=fixture();await f.service.preparar();change(f);await assert.rejects(f.service.liberar(f.entrada));assert.equal(f.envios.length,0);
  }
});
test('falha de disco e resposta perdida conservam bloqueio e reutilizam tentativa',async()=>{
  for(const falha of ['resposta','disco']){
    const f=fixture();await f.service.preparar();const set=f.storage.setItem;
    if(falha==='disco')f.storage.setItem=(k,v)=>{if(k==='flowpdv_liberacao_perfil_confirmada')throw Error('Disco cheio');set(k,v);};
    else f.aposAutorizar=()=>{throw Error('Resposta perdida');};
    await assert.rejects(f.service.liberar(f.entrada));assert.ok(f.dados.has('flowpdv_recuperacao_operacao_bloqueada'));
    f.storage.setItem=set;f.aposAutorizar=()=>{};await f.service.liberar(f.entrada);assert.equal(f.envios[0].requestId,f.envios[1].requestId);
  }
});
test('troca de identidade após autorização não remove bloqueio',async()=>{
  const f=fixture();await f.service.preparar();f.aposAutorizar=()=>{f.auth.currentUser={uid:'OUTRO'};};
  await assert.rejects(f.service.liberar(f.entrada));assert.ok(f.dados.has('flowpdv_recuperacao_operacao_bloqueada'));
});

test('liberação preserva pendências somente após aceite e revalidação',async()=>{
  const f=fixture();await f.service.preparar({preservarPendencias:true});
  await assert.rejects(f.service.liberar(f.entrada),/cada conta/);assert.equal(f.envios.length,0);
  f.entrada.pendenciasConfirmadas=true;f.pendencias.digest='b'.repeat(64);
  await assert.rejects(f.service.liberar(f.entrada),/mudaram/);assert.equal(f.envios.length,0);
  await f.service.preparar({preservarPendencias:true});await f.service.liberar(f.entrada);assert.equal(f.envios[0].pendencias.digest,f.pendencias.digest);
});
