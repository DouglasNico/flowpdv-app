const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const {FieldValue}=require('firebase-admin/firestore');
const {referenciaTurno}=require('./turno-referencia-v2');
const {lerTurnoOperacao}=require('./turnos-caixa-v2');
const fail=message=>{throw new HttpsError('failed-precondition',message);};
const chave=(uid,id)=>{
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))fail('Venda inválida.');
  return createHash('sha256').update(`${uid}:${id}`).digest('hex');
};
module.exports=(db,operation)=>({
  estornarVendaLocalV2:operation(async({tx,base,uid,shop,data})=>{
    const key=chave(uid,data.vendaId),ref=db.doc(`${base}/vendas_locais_v2/${key}`);
    const motivo=typeof data.motivo==='string'?data.motivo.trim():'';
    if(data.confirmado!==true||typeof data.devolverEstoque!=='boolean'||motivo.length<5||motivo.length>180)fail('Confirme a devolução manual, o destino do estoque e um motivo entre 5 e 180 caracteres.');
    const turno=referenciaTurno(data.turno,uid);if(!turno)fail('Abra um turno para registrar a devolução.');
    const fingerprint=JSON.stringify({turno,motivo,devolverEstoque:data.devolverEstoque});
    const sale=(await tx.get(ref)).data();if(!sale)fail('Venda não encontrada neste terminal.');
    if(sale.estorno){
      if(sale.estorno.fingerprint!==fingerprint)fail('Esta venda já possui um estorno. Retome a operação original.');
      return {...sale.estorno.recibo,reutilizado:true};
    }
    if(sale.status!=='confirmado')fail('Conclua a gravação da venda antes de estornar.');
    const turn=await lerTurnoOperacao(db,tx,base,uid,{...shop,caixaV2:{exigirTurno:true}},turno),stocks=[];
    if(data.devolverEstoque)for(const c of sale.recibo.consumos){
      const stockRef=db.doc(`${base}/estoque/${c.estoqueId}`),stock=(await tx.get(stockRef)).data();
      if(!Number.isSafeInteger(stock?.saldoMili)||stock.saldoMili<0||!Number.isSafeInteger(c.quantidadeMili)||c.quantidadeMili<=0||stock.saldoMili+c.quantidadeMili>1e9)fail('Estoque inconsistente para reposição.');
      stocks.push({ref:stockRef,saldo:stock.saldoMili+c.quantidadeMili});
    }
    const totalCentavos=sale.recibo.venda.totalCentavos;
    const recibo={reciboId:`estorno-${key}`,vendaId:data.vendaId,lojaId:base.split('/')[1],turno,turnoVenda:sale.recibo.turno,totalCentavos,motivo,devolverEstoque:data.devolverEstoque,...(sale.recibo.venda.pagamentos?{pagamentos:sale.recibo.venda.pagamentos}:{})};
    tx.update(ref,{status:'estorno_pendente',estorno:{fingerprint,recibo},estornadoEm:FieldValue.serverTimestamp()});
    if(data.devolverEstoque){
      for(const s of stocks)tx.update(s.ref,{saldoMili:s.saldo,atualizadoEm:FieldValue.serverTimestamp()});
      tx.create(db.doc(`${base}/movimentos_estoque/estorno-local-${key}`),{tipo:'estorno_venda_local',vendaId:data.vendaId,terminalUid:uid,turno,consumos:sale.recibo.consumos,motivo,criadoEm:FieldValue.serverTimestamp()});
    }
    tx.update(turn.ref,{baixasLocaisPendentes:(turn.data.baixasLocaisPendentes||0)+1,revisao:turn.data.revisao+1});
    return {...recibo,reutilizado:false};
  }),
  confirmarEstornoLocalV2:operation(async({tx,base,uid,data})=>{
    const key=chave(uid,data.vendaId),ref=db.doc(`${base}/vendas_locais_v2/${key}`),sale=(await tx.get(ref)).data();
    if(!sale?.estorno||data.reciboId!==sale.estorno.recibo.reciboId)fail('Estorno não encontrado neste terminal.');
    if(sale.status==='estornado')return {confirmado:true,reutilizado:true};
    if(sale.status!=='estorno_pendente')fail('Situação do estorno inconsistente.');
    const turnRef=db.doc(`${base}/turnos_v2/${sale.estorno.recibo.turno.chave}`),turn=(await tx.get(turnRef)).data();
    if(!turn||turn.status!=='aberto'||!Number.isSafeInteger(turn.baixasLocaisPendentes)||turn.baixasLocaisPendentes<1)fail('Conferência do turno inconsistente.');
    tx.update(ref,{status:'estornado',estornoConfirmadoEm:FieldValue.serverTimestamp()});
    tx.update(turnRef,{baixasLocaisPendentes:turn.baixasLocaisPendentes-1,revisao:turn.revisao+1});
    return {confirmado:true,reutilizado:false};
  })
});
