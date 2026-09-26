const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const code=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'../src/js/fechamento-perfil-recuperado.js')],bundle:true,write:false,format:'cjs',platform:'node',logLevel:'silent'}).outputFiles[0].text;
const ctx={module:{exports:{}},crypto:require('node:crypto').webcrypto,TextEncoder};vm.runInNewContext(code,ctx);
function fixture(){
  const ref={id:'C',terminalId:'T',terminalUid:'U',chave:'K',dataAbertura:'2026-09-22T10:00:00.000Z'};
  const estado={...ref,status:'aberto',revisao:3,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},trocoInicialCentavos:0,movimentos:0};
  const local={...ref,status:'aberto',trocoInicial:10,sangrias:[{valor:2}]};
  const registro={vendaId:'V',status:'confirmado',criadoEm:'2026-09-22T10:01:00.000Z',recibo:{reciboId:'R',vendaId:'V',lojaId:'A',turno:ref,consumos:[{legadoId:'p',estoqueId:'p',quantidadeMili:250}],venda:{vendaId:'V',itens:[{legadoId:'p',quantidade:'250',precoUnitarioCentavos:2}],totalCentavos:500,recebidoDinheiroCentavos:500,trocoCentavos:0}}};
  const map=new Map(Object.entries({flowpdv_device_id:'T',flowpdv_recuperacao_operacao_bloqueada:JSON.stringify({schema:1,lojaId:'A',terminalUid:'U',autenticadoUid:'N'}),adega_turno_atual:JSON.stringify(local),adega_turnos_historico:'[]',adega_vendas:'[]',adega_produtos:'[{"id":"p","nome":"Farinha","unidade":"g","estoque":2500}]'}));
  const storage={get length(){return map.size;},key:i=>[...map.keys()][i],getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
  const f={map,storage,estado,registro,auth:{currentUser:{uid:'N'}},envios:[],perder:false,comando:null};
  f.pendencias={versao:1,somenteConferencia:true,lojaId:'A',terminalUid:'U',digest:'a'.repeat(64),registros:[{grupo:'contas',id:'C',tipo:'mesa',status:'aberto',totalCentavos:500}]};
  const call=async(n)=>{
    const r=n==='consultarMeuTerminalV2'?{vinculado:true,papel:'caixa',lojaId:'A',identidadeOperacionalUid:'U'}
    :n==='consultarRecuperacaoLocalV2'?{versao:1,lojaId:'A',terminalUid:'U',turno:estado,registros:[registro]}
    :n==='listarTurnosRecuperacaoV2'?{versao:1,lojaId:'A',terminalUid:'U',somenteConferencia:true,turnos:[estado]}
    :n==='conferirPendenciasRecuperacaoV2'?f.pendencias
    :n==='consultarTurnoCaixaV2'?{turno:estado}
    :n==='consultarMovimentosTurnoV2'?{turno:ref,movimentos:[]}
    :n==='obterResumoFechadoTurnoV2'?{versao:1,lojaId:'A',turno:ref,status:'fechado',revisao:estado.revisao,totalCentavos:0,formas:estado.formas,trocoInicialCentavos:0,recebimentos:0,estornos:0,detalhes:[]}:assert.fail(n);
    return JSON.parse(JSON.stringify(r));
  };
  const gerente={call:async(n,d)=>{assert.equal(n,'encerrarTurnoRecuperadoV2');f.envios.push(d);if(!f.comando){f.comando=d.requestId;estado.status='fechado';estado.revisao++;}else assert.equal(f.comando,d.requestId);
    if(f.perder)throw Error('Resposta perdida');return {...d,versao:1,gerenteUid:'G',turno:{...estado,revisaoConferida:d.revisao}};}};
  f.service=()=>ctx.module.exports.criarFechamentoPerfilRecuperado({storage,sessao:{auth:f.auth,call},gerencia:gerente,ambienteTeste:true});
  f.entrada={confirmado:true,fonte:'Comprovantes independentes',dinheiroCentavos:500,sangriasCentavos:200,restauranteCentavos:0,contagemCentavos:1300};return f;
}
test('recupera venda posterior e fecha com sangria, mantendo estoque e bloqueio final',async()=>{
  const f=fixture(),s=f.service(),estoque=f.map.get('adega_produtos');assert.equal((await s.preparar()).recuperados,1);await s.encerrar(f.entrada);
  const h=JSON.parse(f.map.get('adega_turnos_historico'));assert.equal(h.length,1);assert.equal(h[0].saldoEsperado,13);assert.equal(h[0].diferenca,0);
  assert.equal(JSON.parse(f.map.get('adega_vendas')).length,1);assert.equal(f.map.get('adega_produtos'),estoque);assert.equal(f.map.has('adega_turno_atual'),false);assert.ok(f.map.has('flowpdv_recuperacao_operacao_bloqueada'));
});
test('pagamento incerto ou comprovante divergente não fecha nem altera o perfil',async()=>{
  const f=fixture();f.registro.status='aguardando_gravacao_local';const before=JSON.stringify([...f.map]);await assert.rejects(f.service().preparar());assert.equal(JSON.stringify([...f.map]),before);
  const g=fixture(),s=g.service();await s.preparar();await assert.rejects(s.encerrar({...g.entrada,sangriasCentavos:0}),/divergem/);assert.equal(g.envios.length,0);
});
test('resposta perdida retoma mesmo fechamento após reiniciar, sem duplicar a venda',async()=>{
  const f=fixture(),s=f.service();await s.preparar();f.perder=true;await assert.rejects(s.encerrar(f.entrada));f.perder=false;await f.service().retomar();
  assert.equal(f.envios[0].requestId,f.envios[1].requestId);assert.equal(JSON.parse(f.map.get('adega_vendas')).length,1);
});
test('falha em cada escrita final retoma valores finais sem duplicação',async()=>{
  for(const key of ['adega_vendas','adega_turnos_historico','adega_turno_atual']){
    const f=fixture(),s=f.service();await s.preparar();const set=f.storage.setItem,del=f.storage.removeItem;
    f.storage.setItem=(k,v)=>{if(k===key)throw Error('Disco cheio');set(k,v);};f.storage.removeItem=k=>{if(k===key)throw Error('Disco cheio');del(k);};
    await assert.rejects(s.encerrar(f.entrada));f.storage.setItem=set;f.storage.removeItem=del;await f.service().retomar();assert.equal(JSON.parse(f.map.get('adega_turnos_historico')).length,1);assert.equal(JSON.parse(f.map.get('adega_vendas')).length,1);
  }
});
test('troca de identidade e alteração concorrente preservam tentativa',async()=>{
  const f=fixture(),s=f.service();await s.preparar();f.perder=true;await assert.rejects(s.encerrar(f.entrada));f.auth.currentUser={uid:'OUTRO'};await assert.rejects(f.service().retomar());assert.ok(f.map.has('flowpdv_fechamento_recuperado_pendente'));
  const g=fixture(),t=g.service();await t.preparar();g.map.set('adega_turno_atual',g.map.get('adega_turno_atual').replace('"valor":2','"valor":3'));await assert.rejects(t.encerrar(g.entrada));assert.equal(g.envios.length,0);
});

test('pendências exigem aceite explícito e qualquer mudança impede enviar o fechamento',async()=>{
  const f=fixture(),s=f.service();await s.preparar({preservarPendencias:true});
  await assert.rejects(s.encerrar(f.entrada),/cada conta/);assert.equal(f.envios.length,0);
  f.entrada.pendenciasConfirmadas=true;f.pendencias.digest='b'.repeat(64);
  await assert.rejects(s.encerrar(f.entrada),/mudaram/);assert.equal(f.envios.length,0);
  await s.preparar({preservarPendencias:true});await s.encerrar(f.entrada);assert.equal(f.envios[0].pendencias.digest,f.pendencias.digest);
});
