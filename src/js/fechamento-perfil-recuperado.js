import {consultarPendenciasRecuperacao,aceitePendencias} from './pendencias-recuperacao.js';
import {criarBackupHomologacao} from './backup-homologacao.js';
import {reconstruirBackupConfirmado} from './reconstrucao-backup-v2.js';
import {conferirHistoricoBackup} from './conferencia-historico-v2.js';
import {conferirFechamentosBackup} from './conferencia-fechamento-backup-v2.js';
import {calcularResumoFinanceiroBase} from './resumo-financeiro-caixa.js';
import {validarResumoRestaurante} from './resumo-restaurante-caixa.js';
const BLOQUEIO='flowpdv_recuperacao_operacao_bloqueada',DIARIO='flowpdv_fechamento_recuperado_pendente';
const centavos=n=>{const c=Math.round(n*100);if(typeof n!=='number'||!Number.isFinite(n)||!Number.isSafeInteger(c)||Math.abs(n*100-c)>0.000001)throw Error('Valor financeiro inválido.');return c;};
export function criarFechamentoPerfilRecuperado({storage,sessao,gerencia,ambienteTeste}){
  if(ambienteTeste!==true)throw Error('Disponível somente na homologação.');
  let plano=null,ocupado=false;
  const fail=m=>{throw Error(m);},uid=()=>sessao.auth.currentUser?.uid;
  async function exclusivo(fn){if(ocupado)fail('Fechamento em andamento.');ocupado=true;try{return await fn();}finally{ocupado=false;}}
  async function identificar(){
    const raw=storage.getItem(BLOQUEIO),marca=JSON.parse(raw||'null');
    if(marca?.schema!==1||marca.autenticadoUid!==uid())fail('Perfil ou identidade de recuperação inválido.');
    const b=await sessao.call('consultarMeuTerminalV2');
    if(!b.vinculado||b.papel!=='caixa'||b.lojaId!==marca.lojaId||b.identidadeOperacionalUid!==marca.terminalUid||marca.autenticadoUid!==uid())fail('A autorização da recuperação mudou.');
    return {raw,uid:uid(),contexto:{lojaId:marca.lojaId,terminalUid:marca.terminalUid,terminalId:storage.getItem('flowpdv_device_id')}};
  }
  function backup(p){return criarBackupHomologacao({storage,contexto:p.contexto,ambienteTeste,duranteFechamentoRecuperado:true});}
  function intacto(p){if(uid()!==p.uid||storage.getItem(BLOQUEIO)!==p.raw||JSON.stringify(backup(p).exportar())!==p.original)fail('A sessão ou os dados mudaram. Preserve o perfil para conferência.');}
  function resumo(p,snapshot){
    const turno=JSON.parse(p.pacote.dados.adega_turno_atual);
    if(!Array.isArray(turno.sangrias)||turno.suprimentos?.length)fail('Sangrias ausentes ou suprimentos exigem conferência específica.');
    centavos(turno.trocoInicial);
    for(const s of turno.sangrias)if(centavos(s.valor)<=0)fail('Sangria inválida.');
    return calcularResumoFinanceiroBase({...turno,restauranteV2:snapshot},JSON.parse(p.pacote.dados.adega_vendas||'[]'),true);
  }
  async function preparar(preservarPendencias=false){
    if(storage.getItem(DIARIO)!==null)fail('Retome o fechamento pendente.');
    for(const k of ['flowpdv_instalacao_perfil_pendente','flowpdv_pagamento_atendimento_pendente','flowpdv_commit_venda','flowpdv_venda_servidor_pendente','flowpdv_estorno_local_pendente','flowpdv_ciclo_teste_pendente'])if(storage.getItem(k)!==null)fail('Existe pagamento ou recuperação pendente. Preserve a tentativa; não cobre novamente.');
    const p=await identificar();const original=backup(p).exportar();p.original=JSON.stringify(original);
    const t=JSON.parse(original.dados.adega_turno_atual||'null');if(t?.status!=='aberto')fail('Selecione um perfil recuperado com turno aberto.');
    const call=(n,d)=>sessao.call(n,d),result=await reconstruirBackupConfirmado({pacote:original,contexto:p.contexto,ambienteTeste,call});
    p.pacote=result.pacote;p.alteracoes=result.alteracoes;
    const h=await conferirHistoricoBackup({pacote:p.pacote,contexto:p.contexto,ambienteTeste,call});
    const f=await conferirFechamentosBackup({pacote:p.pacote,contexto:p.contexto,ambienteTeste,call});
    if(!h.semDivergencias||h.pendencias.length||!f.semDivergencias||f.gavetas.some(g=>g.divergencias.length||g.pendencias.some(x=>x.codigo!=='gaveta_turno_aberto')))fail('Histórico ou fechamentos exigem conferência.');
    p.estado=(await call('consultarTurnoCaixaV2',{turno:t})).turno;
    if(p.estado?.status!=='aberto'||p.estado.revisao!==result.conferencia.revisaoServidor||p.estado.baixasLocaisPendentes)fail('O turno mudou ou tem pagamentos pendentes.');
    // Apenas prévia aritmética. O resumo arquivado virá do servidor após fechar.
    p.previa={versao:1,lojaId:p.contexto.lojaId,turno:p.estado,status:'fechado',revisao:p.estado.revisao,totalCentavos:p.estado.totalCentavos,formas:p.estado.formas,trocoInicialCentavos:p.estado.trocoInicialCentavos,recebimentos:0,estornos:0};
    if(preservarPendencias)p.pendencias=await consultarPendenciasRecuperacao(call,p.contexto);
    p.resumo=resumo(p,p.previa);intacto(p);return p;
  }
  async function retomar(){
    const raw=storage.getItem(DIARIO);if(!raw)fail('Nenhum fechamento pendente.');const p=JSON.parse(raw);
    const atual=await identificar();if(p.schema!==1||atual.uid!==p.uid||atual.raw!==p.raw||JSON.stringify(atual.contexto)!==JSON.stringify(p.contexto))fail('Identidade diferente da tentativa original.');
    if(!p.escritas){
      intacto(p);
      const r=await gerencia.call('encerrarTurnoRecuperadoV2',p.request);
      if(r.versao!==1||r.digest!==p.request.digest||r.requestId!==p.request.requestId||r.destinoUid!==p.uid||r.turno?.status!=='fechado'||r.turno.revisaoConferida!==p.request.revisao)fail('Servidor não confirmou este fechamento.');
      const turno=JSON.parse(p.pacote.dados.adega_turno_atual),s=await sessao.call('obterResumoFechadoTurnoV2',{turno});
      validarResumoRestaurante(turno,s);if(s.lojaId!==p.contexto.lojaId||s.turno.terminalUid!==p.contexto.terminalUid||s.revisao!==r.turno.revisao)fail('Resumo de outra identidade ou revisão.');
      const calc=resumo(p,s);if(centavos(calc.totalDinheiro)!==p.entrada.dinheiroCentavos||centavos(calc.totalSangrias)!==p.entrada.sangriasCentavos)fail('Os comprovantes divergem do fechamento. Preserve a tentativa.');
      const hist=JSON.parse(p.pacote.dados.adega_turnos_historico||'[]');if(hist.some(t=>t.id===turno.id))fail('Turno já arquivado.');
      const fechado={...turno,status:'fechado',restauranteV2:s,dataFechamento:p.data,totalDinheiro:calc.totalDinheiro,totalPix:calc.totalPix,totalDebito:calc.totalDebito,totalCredito:calc.totalCredito,totalFiado:calc.totalFiado,totalCartaoNaoClassificado:calc.totalCartaoNaoClassificado,fundoRestaurante:calc.fundoRestaurante,totalVendasGeral:calc.totalVendas,totalSangrias:calc.totalSangrias,saldoEsperado:calc.saldoEmGaveta,dinheiroGaveta:calc.saldoEmGaveta,saldoInformado:p.entrada.contagemCentavos/100,diferenca:(p.entrada.contagemCentavos-centavos(calc.saldoEmGaveta))/100,qtdVendas:calc.vendasCount,recuperacaoFechamentoV2:{requestId:r.requestId,gerenteUid:r.gerenteUid,fonte:p.entrada.fonte}};
      intacto(p);p.escritas={adega_vendas:p.pacote.dados.adega_vendas||'[]',adega_turnos_historico:JSON.stringify([fechado,...hist]),adega_turno_atual:null};
      storage.setItem(DIARIO,JSON.stringify(p));
    }
    const antes=JSON.parse(p.original).dados;
    const corrente=backup(p).exportar().dados;
    for(const k of new Set([...Object.keys(antes),...Object.keys(corrente)]))if((corrente[k]??null)!==(antes[k]??null)&&(!Object.hasOwn(p.escritas,k)||(corrente[k]??null)!==p.escritas[k]))fail('Dados alterados durante a gravação. Preserve o perfil.');
    for(const [k,v] of Object.entries(p.escritas)){if(!['adega_vendas','adega_turnos_historico','adega_turno_atual'].includes(k))fail('Diário inválido.');v===null?storage.removeItem(k):storage.setItem(k,v);}
    storage.removeItem(DIARIO);plano=null;return {fechado:true,liberacaoOperacional:false};
  }
  return {pendente:()=>storage.getItem(DIARIO)!==null,preparar:(opcoes={})=>exclusivo(async()=>{plano=await preparar(opcoes.preservarPendencias===true);return {turnoId:JSON.parse(plano.pacote.dados.adega_turno_atual).id,pendencias:plano.pendencias,recuperados:plano.alteracoes.length};}),retomar:()=>exclusivo(retomar),
    encerrar:e=>exclusivo(async()=>{
      if(!plano||e?.confirmado!==true||typeof e.fonte!=='string'||e.fonte.trim().length<5||['dinheiroCentavos','sangriasCentavos','contagemCentavos','restauranteCentavos'].some(k=>!Number.isSafeInteger(e[k]))||e.sangriasCentavos<0||e.contagemCentavos<0||e.restauranteCentavos<0)fail('Confira os valores e a referência dos comprovantes.');
      const p=await preparar(!!plano.pendencias);if(p.pendencias?.digest!==plano.pendencias?.digest)fail("As pendências mudaram. Prepare novamente.");const pendencias=aceitePendencias(p.pendencias,e);if(p.original!==plano.original||p.estado.revisao!==plano.estado.revisao||JSON.stringify(p.pacote)!==JSON.stringify(plano.pacote))fail('Dados mudaram. Prepare novamente.');
      if(centavos(p.resumo.totalDinheiro)!==e.dinheiroCentavos||centavos(p.resumo.totalSangrias)!==e.sangriasCentavos)fail('Comprovantes divergem dos registros. Nenhum fechamento foi enviado.');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({pacote:p.pacote,e,pendencias})))),v=>v.toString(16).padStart(2,'0')).join('');
      intacto(p);p.schema=1;p.entrada=e;p.data=new Date().toISOString();p.request={...(pendencias?{pendencias}:{}),lojaId:p.contexto.lojaId,destinoUid:p.uid,identidadeUid:p.contexto.terminalUid,requestId:crypto.randomUUID(),digest,turno:JSON.parse(p.pacote.dados.adega_turno_atual),revisao:p.estado.revisao,dinheiroContadoCentavos:e.restauranteCentavos,confirmado:true};
      storage.setItem(DIARIO,JSON.stringify(p));return retomar();
    })};
}
