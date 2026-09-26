export const CHAVE_PAGAMENTO_ATENDIMENTO = 'flowpdv_pagamento_atendimento_pendente';

export function criarPagamentoAtendimentoPendente({storage,sessao,ambienteTeste}) {
  if(ambienteTeste!==true)throw Error('Disponível somente na homologação.');
  const key=CHAVE_PAGAMENTO_ATENDIMENTO;
  let ocupado=false;
  const fail=m=>{throw Error(m);};
  const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
  const valor=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
  function validar(p){
    const d=p?.payload,t=d?.turno;
    if(p?.schema!==1||!id(p.lojaId)||!id(p.terminalUid)||!id(d?.atendimentoId)||!id(t?.id)||!id(t?.terminalId)
      ||typeof t.dataAbertura!=='string'||!Number.isFinite(Date.parse(t.dataAbertura))||!Number.isSafeInteger(d.versao)||d.versao<1
      ||d.confirmado!==true||!valor(p.totalCentavos)||!valor(d.recebidoDinheiroCentavos)||!Array.isArray(d.pagamentos)||d.pagamentos.length>5
      ||d.pagamentos.some(v=>!['dinheiro','pix_manual','cartao_manual'].includes(v.forma)||!valor(v.valorCentavos)||v.valorCentavos===0)
      ||d.pagamentos.reduce((n,v)=>n+v.valorCentavos,0)!==p.totalCentavos)fail('Tentativa de pagamento inválida. Preserve os dados para conferência.');
    const dinheiro=d.pagamentos.filter(v=>v.forma==='dinheiro').reduce((n,v)=>n+v.valorCentavos,0);
    if(d.recebidoDinheiroCentavos<dinheiro||(!dinheiro&&d.recebidoDinheiroCentavos))fail('Dinheiro recebido inválido.');
    return p;
  }
  const pendente=()=>{const raw=storage.getItem(key);return raw===null?null:validar(JSON.parse(raw));};
  async function contexto(){
    const uid=sessao.auth.currentUser?.uid;if(!uid)fail('Confirme o acesso deste caixa.');
    const b=await sessao.call('consultarMeuTerminalV2');
    if(uid!==sessao.auth.currentUser?.uid||!b.vinculado||b.papel!=='caixa'||!id(b.lojaId))fail('O acesso do caixa mudou.');
    return {uid,lojaId:b.lojaId,terminalUid:b.identidadeOperacionalUid||uid};
  }
  async function enviar(p,c){
    if(p.lojaId!==c.lojaId||p.terminalUid!==c.terminalUid)fail('Pagamento pertence a outra loja ou identidade.');
    const raw=storage.getItem(key);
    if(JSON.stringify(pendente())!==JSON.stringify(p))fail('A tentativa mudou. Preserve o registro original.');
    const marcaRaw=storage.getItem('flowpdv_recuperacao_operacao_bloqueada');
    if(storage.getItem('flowpdv_instalacao_perfil_pendente')!==null)fail('Conclua a instalação do perfil antes de conferir o pagamento.');
    if(marcaRaw!==null){
      const marca=JSON.parse(marcaRaw);
      if(marca?.schema!==1||marca.autenticadoUid!==c.uid||marca.terminalUid!==p.terminalUid||marca.lojaId!==p.lojaId)fail('Identidade do perfil recuperado divergente.');
    }
    const r=await sessao.call(marcaRaw===null?'fecharAtendimentoV2':'consultarPagamentoAtendimentoV2',JSON.parse(JSON.stringify(p.payload)));
    if(marcaRaw!==null&&(r?.versao!==1||r.somenteConferencia!==true||r.lojaId!==p.lojaId||r.terminalUid!==p.terminalUid))fail('Conferência do pagamento inválida.');
    const dinheiro=p.payload.pagamentos.filter(v=>v.forma==='dinheiro').reduce((n,v)=>n+v.valorCentavos,0);
    if(r?.vendaId!==p.payload.atendimentoId||r.status!=='concluida'||r.totalCentavos!==p.totalCentavos||r.trocoCentavos!==p.payload.recebidoDinheiroCentavos-dinheiro)fail('Resposta de pagamento divergente. Confira a venda antes de repetir.');
    if(sessao.auth.currentUser?.uid!==c.uid||storage.getItem(key)!==raw)fail('Sessão ou tentativa mudou. A confirmação foi preservada.');
    if(storage.getItem('flowpdv_recuperacao_operacao_bloqueada')!==marcaRaw)fail('O estado da recuperação mudou. Preserve a tentativa.');
    if(marcaRaw!==null)storage.setItem('flowpdv_pagamento_atendimento_conferido',JSON.stringify({schema:1,payload:p.payload,recibo:r}));
    storage.removeItem(key);return r;
  }
  async function exclusivo(fn){if(ocupado)fail('Pagamento em andamento.');ocupado=true;try{return await fn();}finally{ocupado=false;}}
  return {pendente,
    executar:(payload,totalCentavos)=>exclusivo(async()=>{
      if(storage.getItem(key)!==null)fail('Retome o pagamento pendente antes de registrar outro.');
      const c=await contexto();
      const p=validar({schema:1,lojaId:c.lojaId,terminalUid:c.terminalUid,payload:JSON.parse(JSON.stringify(payload)),totalCentavos});
      if(storage.getItem(key)!==null)fail('Outra tentativa foi criada. Retome o pagamento pendente.');
      storage.setItem(key,JSON.stringify(p));return enviar(p,c);
    }),
    retomar:()=>exclusivo(async()=>{const p=pendente();if(!p)fail('Nenhum pagamento pendente.');return enviar(p,await contexto());})
  };
}
