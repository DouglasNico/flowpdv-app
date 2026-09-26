import {consultarPendenciasRecuperacao,aceitePendencias} from './pendencias-recuperacao.js';
import {criarBackupHomologacao} from './backup-homologacao.js';
import {conferirHistoricoBackup} from './conferencia-historico-v2.js';
import {conferirFechamentosBackup} from './conferencia-fechamento-backup-v2.js';
import {conferirInventarioBackup} from './conferencia-backup-v2.js';

const BLOQUEIO='flowpdv_recuperacao_operacao_bloqueada';
export function criarLiberacaoPerfilRecuperado({storage,sessao,gerencia,ambienteTeste}){
  if(ambienteTeste!==true)throw Error('Disponível somente na homologação.');
  let plano=null,ocupado=false;
  const uid=()=>sessao.auth.currentUser?.uid;
  const fail=m=>{throw Error(m);};
  async function conferir(preservarPendencias=false){
    const marca=storage.getItem(BLOQUEIO),identidade=JSON.parse(marca||'null');
    if(!identidade||identidade.schema!==1||identidade.autenticadoUid!==uid())fail('Perfil ou identidade de recuperação inválido.');
    for(const key of ['flowpdv_fechamento_recuperado_pendente','flowpdv_instalacao_perfil_pendente','flowpdv_pagamento_atendimento_pendente','flowpdv_commit_venda','flowpdv_venda_servidor_pendente','flowpdv_estorno_local_pendente','flowpdv_ciclo_teste_pendente'])if(storage.getItem(key)!==null)fail('Conclua as pendências antes de liberar o perfil.');
    const binding=await sessao.call('consultarMeuTerminalV2');
    if(binding.vinculado!==true||binding.papel!=='caixa'||binding.lojaId!==identidade.lojaId||binding.identidadeOperacionalUid!==identidade.terminalUid)fail('A autorização da recuperação mudou.');
    const contexto={lojaId:identidade.lojaId,terminalUid:identidade.terminalUid,terminalId:storage.getItem('flowpdv_device_id')};
    const backup=criarBackupHomologacao({storage,contexto,ambienteTeste}),pacote=backup.exportar(),snapshot=JSON.stringify(pacote);
    if(JSON.parse(pacote.dados.adega_turno_atual||'null'))fail('Encerre e confira o turno recuperado antes de liberar um novo turno.');
    const locais=JSON.parse(pacote.dados.adega_turnos_historico||'[]');
    const call=(n,d)=>sessao.call(n,d);
    const historico=await conferirHistoricoBackup({pacote,contexto,ambienteTeste,call});
    const fechamentos=await conferirFechamentosBackup({pacote,contexto,ambienteTeste,call});
    if(!historico.semDivergencias||historico.pendencias.length||!fechamentos.semDivergencias
      ||fechamentos.conferencias.some(t=>t.status!=='fechado')||fechamentos.gavetas.some(g=>g.divergencias.length||g.pendencias.length))fail('Existem diferenças ou pendências nas vendas, sangrias ou fechamentos.');
    const inventario=await conferirInventarioBackup({pacote,contexto,ambienteTeste,call});
    if(inventario.produtos.some(p=>p.situacao!=='vinculo_conferido'))fail('Confira os vínculos e o corte do estoque.');
    const pendencias=preservarPendencias?await consultarPendenciasRecuperacao(call,contexto):null;
    if(!preservarPendencias)for(const tipo of ['contas','pedidos']){
      const r=await call('listarPendenciasAtendimentoV2',{tipo});
      if(r?.versao!==1||r.lojaId!==contexto.lojaId||r.terminalUid!==contexto.terminalUid||r.tipo!==tipo||r.somenteConferencia!==true||!Array.isArray(r.registros)||r.registros.length||r.proximo)fail('Existem contas ou pedidos pendentes, ou a consulta está incompleta.');
    }
    if(uid()!==identidade.autenticadoUid||storage.getItem(BLOQUEIO)!==marca||JSON.stringify(backup.exportar())!==snapshot)fail('O perfil mudou durante a conferência.');
    return {pendencias,marca,contexto,pacote,snapshot,locais,fechamentos,inventario,autenticadoUid:uid()};
  }
  async function exclusivo(fn){if(ocupado)fail('Conferência em andamento.');ocupado=true;try{return await fn();}finally{ocupado=false;}}
  return {
    preparar:(opcoes={})=>exclusivo(async()=>{
      plano=null;plano=await conferir(opcoes.preservarPendencias===true);
      return {pendencias:plano.pendencias,turnos:plano.locais.map(t=>({id:t.id})),produtos:plano.inventario.produtos.map(p=>({id:p.legadoId,nome:p.nome,unidade:p.unidadeServidor}))};
    }),
    liberar:entrada=>exclusivo(async()=>{
      if(!plano||entrada?.confirmado!==true||typeof entrada.fonte!=='string'||entrada.fonte.trim().length<5)fail('Informe a referência dos comprovantes e confirme a conferência independente.');
      const anterior=plano,atual=await conferir(!!plano.pendencias);
      if(atual.pendencias?.digest!==anterior.pendencias?.digest)fail("As pendências mudaram. Prepare novamente.");
      const pendencias=aceitePendencias(atual.pendencias,entrada);
      if(atual.marca!==anterior.marca||atual.snapshot!==anterior.snapshot||JSON.stringify(atual.inventario.produtos)!==JSON.stringify(anterior.inventario.produtos))fail('Os dados mudaram. Prepare uma nova conferência.');
      const centavos=v=>{const n=Math.round(v*100);return typeof v==='number'&&Number.isFinite(v)&&Number.isSafeInteger(n)&&Math.abs(v*100-n)<0.000001?n:null;};
      if(!Array.isArray(entrada.turnos)||entrada.turnos.length!==atual.locais.length||new Set(entrada.turnos.map(t=>t.id)).size!==entrada.turnos.length)fail('Confira todos os turnos.');
      for(const t of atual.locais){const e=entrada.turnos.find(e=>e.id===t.id);if(!e||centavos(t.totalDinheiro)!==e.dinheiroCentavos||centavos(t.totalSangrias)!==e.sangriasCentavos||centavos(t.saldoInformado)!==e.contagemCentavos)fail('Comprovantes ou contagem divergem do fechamento. O perfil permanece bloqueado.');}
      if(!Array.isArray(entrada.produtos)||entrada.produtos.length!==atual.inventario.produtos.length||new Set(entrada.produtos.map(p=>p.id)).size!==entrada.produtos.length)fail('Conte todos os produtos conferidos.');
      for(const p of atual.inventario.produtos)if(entrada.produtos.find(e=>e.id===p.legadoId)?.saldoMili!==p.saldoAtualMili)fail('A contagem física diverge do saldo atual. Não reponha o saldo antigo.');
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({snapshot:atual.snapshot,entrada,pendencias})));
      const digest=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
      const key='flowpdv_liberacao_perfil_tentativa';let tentativa=JSON.parse(storage.getItem(key)||'null');
      if(!tentativa||tentativa.digest!==digest)tentativa={requestId:crypto.randomUUID(),digest};
      storage.setItem(key,JSON.stringify(tentativa));
      const recibo=await gerencia.call('autorizarLiberacaoPerfilV2',{...tentativa,...(pendencias?{pendencias}:{}),lojaId:atual.contexto.lojaId,destinoUid:atual.autenticadoUid,identidadeUid:atual.contexto.terminalUid,confirmado:true,
        turnos:atual.locais.map(t=>({chave:t.restauranteV2.turno.chave,revisao:t.restauranteV2.revisao})),estoque:atual.inventario.produtos.map(p=>({estoqueId:p.estoqueId,saldoMili:p.saldoAtualMili,unidade:p.unidadeServidor}))});
      if(recibo?.versao!==1||recibo.digest!==digest||recibo.requestId!==tentativa.requestId||recibo.lojaId!==atual.contexto.lojaId||recibo.destinoUid!==uid()||recibo.identidadeUid!==atual.contexto.terminalUid||!recibo.gerenteUid)fail('Autorização de liberação inválida.');
      const backup=criarBackupHomologacao({storage,contexto:atual.contexto,ambienteTeste});
      if(uid()!==atual.autenticadoUid||storage.getItem(BLOQUEIO)!==atual.marca||JSON.stringify(backup.exportar())!==atual.snapshot)fail('A sessão ou o perfil mudou. A liberação não foi aplicada.');
      storage.setItem('flowpdv_liberacao_perfil_confirmada',JSON.stringify({recibo,entrada,concluidoEm:new Date().toISOString()}));
      storage.removeItem(BLOQUEIO); // Última escrita obrigatória: falha anterior conserva o bloqueio.
      plano=null;
      return {liberado:true};
    })
  };
}
