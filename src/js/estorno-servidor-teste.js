export function criarEstornoServidorTeste({storage,servico,ambienteTeste,call}) {
  if(ambienteTeste!==true)throw new Error('Estorno disponível somente no teste.');
  const key='flowpdv_estorno_local_pendente',pendente=()=>JSON.parse(storage.getItem(key)||'null');
  function preparar(vendaId,motivo,devolverEstoque,confirmado){
    motivo=typeof motivo==='string'?motivo.trim():'';
    if(!confirmado||typeof devolverEstoque!=='boolean'||motivo.length<5||motivo.length>180)throw new Error('Confirme a devolução manual e informe um motivo entre 5 e 180 caracteres.');
    const existente=pendente();
    if(existente){
      if(existente.payload?.vendaId!==vendaId)servico.exigirVendaRecuperada();
      return existente;
    }
    servico.exigirVendaRecuperada();
    const venda=servico.getVendas().find(v=>v.id===vendaId),turno=servico.getTurnoAtual();
    if(!venda?.estoqueServidorV2||(!venda.pagamentosCentavos&&venda.formaPagamento!=='Dinheiro')||venda.terminalId!==servico.getDeviceId())throw new Error('Selecione uma venda desta ponte e deste terminal.');
    if(!turno||turno.terminalId!==servico.getDeviceId())throw new Error('Abra um turno neste terminal.');
    if([turno,...servico.getHistoricoTurnos()].some(t=>(t.estornosLocaisV2||[]).some(e=>e.vendaId===vendaId)))throw new Error('Esta venda já foi estornada.');
    return {...(venda.pagamentosCentavos?{pagamentos:venda.pagamentosCentavos}:{}),lojaId:venda.estoqueServidorV2.lojaId,totalCentavos:Math.round(venda.total*100),payload:{vendaId,motivo,devolverEstoque,confirmado:true,turno:{id:turno.id,terminalId:turno.terminalId,dataAbertura:turno.dataAbertura}}};
  }
  async function executar(plano){
    let p=pendente();if(p&&plano&&JSON.stringify(p)!==JSON.stringify(plano))throw new Error('Retome o estorno original.');
    p=p||plano;if(!p)throw new Error('Nenhum estorno pendente.');
    if(!pendente())servico.exigirVendaRecuperada();
    const turno=servico.getTurnoAtual(),ref=p.payload.turno;
    if(!turno||turno.id!==ref.id||turno.terminalId!==ref.terminalId||turno.dataAbertura!==ref.dataAbertura)throw new Error('Recupere o turno original do estorno.');
    const binding=await call('consultarMeuTerminalV2',{});
    if(!binding.vinculado||binding.lojaId!==p.lojaId||binding.papel!=='caixa')throw new Error('Terminal não vinculado à loja desta venda.');
    if(!pendente())storage.setItem(key,JSON.stringify(p));
    const receipt=await call('estornarVendaLocalV2',p.payload);
    if(JSON.stringify(receipt.pagamentos)!==JSON.stringify(p.pagamentos)||!receipt.reciboId||receipt.vendaId!==p.payload.vendaId||receipt.lojaId!==p.lojaId||receipt.totalCentavos!==p.totalCentavos||receipt.motivo!==p.payload.motivo||receipt.devolverEstoque!==p.payload.devolverEstoque||receipt.turno?.id!==ref.id||receipt.turno.terminalId!==ref.terminalId||receipt.turno.dataAbertura!==ref.dataAbertura)throw new Error('Comprovante de estorno divergente.');
    const current=servico.getTurnoAtual();if(JSON.stringify(current)!==JSON.stringify(turno))throw new Error('Turno mudou durante o estorno. Retome para conferir.');
    const {reutilizado,...ajuste}=receipt,ajustes=current.estornosLocaisV2||[],old=ajustes.find(e=>e.reciboId===receipt.reciboId);
    if(old){if(JSON.stringify(old.pagamentos)!==JSON.stringify(ajuste.pagamentos))throw new Error('Formas da devolução divergentes.');for(const campo of ['vendaId','lojaId','totalCentavos','motivo','devolverEstoque'])if(old[campo]!==ajuste[campo])throw new Error('Ajuste local difere do servidor.');}
    else storage.setItem('adega_turno_atual',JSON.stringify({...current,estornosLocaisV2:[...ajustes,ajuste]}));
    const ack=await call('confirmarEstornoLocalV2',{vendaId:receipt.vendaId,reciboId:receipt.reciboId});
    if(ack.confirmado!==true)throw new Error('Confirmação do estorno pendente.');
    storage.removeItem(key);
    if(typeof servico.espelharEstoqueVitrineServidor==='function')servico.espelharEstoqueVitrineServidor();
    return ajuste;
  }
  return {preparar,executar,pendente};
}
