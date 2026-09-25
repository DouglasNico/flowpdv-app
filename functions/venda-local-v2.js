const { exigirNovaOperacaoV2 } = require('./politica-ativacao-v2');
const {createHash}=require('node:crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const {FieldValue}=require('firebase-admin/firestore');
const {referenciaTurno}=require('./turno-referencia-v2');
const {lerTurnoOperacao}=require('./turnos-caixa-v2');
const {planejarSaldoLegado}=require('./estoque-migracao-core.cjs');
const {normalizarVendaLocal}=require('./venda-local-core.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=message=>{throw new HttpsError('failed-precondition',message);};
module.exports=(db,operation)=>({
  ...require('./estorno-local-v2')(db,operation),
  registrarBaixaVendaLocalV2:operation(async({tx,base,uid,shop,data})=>{
    if(data.confirmado!==true) fail('Confirme a venda manual.');
    let venda;try{venda=normalizarVendaLocal(data);}catch(e){fail(e.message);}
    const turno=referenciaTurno(data.turno,uid);if(!turno) fail('Abra um turno no servidor.');
    const fingerprint=JSON.stringify({venda,turno}),key=hash(`${uid}:${venda.vendaId}`),ref=db.doc(`${base}/vendas_locais_v2/${key}`);
    const old=(await tx.get(ref)).data();
    if(old?.estorno)fail('Esta venda possui estorno. Retome o estorno pendente.');
    if(old){if(old.status==='cancelado') fail('Esta tentativa foi cancelada. Inicie outra venda.');if(old.fingerprint!==fingerprint) fail('Esta venda já foi enviada com outros valores. Retome a original.');return {...old.recibo,reutilizado:true};}
    exigirNovaOperacaoV2(shop);
    const turn=await lerTurnoOperacao(db,tx,base,uid,{...shop,caixaV2:{exigirTurno:true}},turno),stocks=[],itensSemEstoque=[];
    for(const item of venda.itens){
      const mapping=(await tx.get(db.doc(`${base}/migracoes_estoque/${hash(item.legadoId)}`))).data();
      if(!mapping||mapping.plano?.legadoId!==item.legadoId) fail('Produto ainda não migrado nesta loja.');
      if(mapping.semEstoque===true){
        const ficha=(await tx.get(db.doc(`${base}/fichas_estoque/${item.legadoId}`))).data();
        if(mapping.estoqueId || ficha?.semEstoque!==true || mapping.plano.unidade!=='un' || !Number.isSafeInteger(Number(item.quantidade))) fail('Produto sem estoque exige cadastro e quantidade coerentes.');
        itensSemEstoque.push(item.legadoId);
        continue;
      }
      let quantidadeMili;try{quantidadeMili=planejarSaldoLegado({id:item.legadoId,nome:mapping.plano.nome,unidade:mapping.plano.unidadeOrigem,estoque:item.quantidade}).saldoMili;}catch(e){fail(e.message);}
      if(quantidadeMili<=0) fail('Quantidade de estoque inválida.');
      const stockRef=db.doc(`${base}/estoque/${mapping.estoqueId}`),stock=(await tx.get(stockRef)).data();
      if(!stock||stock.unidade!==mapping.plano.unidade||!Number.isSafeInteger(stock.saldoMili)||stock.saldoMili<quantidadeMili) fail('Estoque insuficiente ou unidade divergente.');
      if(stocks.some(s=>s.estoqueId===mapping.estoqueId)) fail('Vínculos de estoque sobrepostos. Confira a migração.');
      stocks.push({ref:stockRef,saldo:stock.saldoMili,legadoId:item.legadoId,estoqueId:mapping.estoqueId,quantidadeMili});
    }
    const consumos=stocks.map(({legadoId,estoqueId,quantidadeMili})=>({legadoId,estoqueId,quantidadeMili}));
    const recibo={reciboId:key,vendaId:venda.vendaId,lojaId:base.split('/')[1],turno,consumos,venda,...(itensSemEstoque.length?{itensSemEstoque}:{})};
    tx.create(ref,{fingerprint,recibo,status:'aguardando_gravacao_local',criadoEm:FieldValue.serverTimestamp()});
    tx.create(db.doc(`${base}/movimentos_estoque/local-${key}`),{tipo:'saida_venda_local',vendaId:venda.vendaId,terminalUid:uid,turno,consumos,criadoEm:FieldValue.serverTimestamp()});
    for(const s of stocks)tx.update(s.ref,{saldoMili:s.saldo-s.quantidadeMili,atualizadoEm:FieldValue.serverTimestamp()});
    tx.update(turn.ref,{baixasLocaisPendentes:(turn.data.baixasLocaisPendentes||0)+1,revisao:turn.data.revisao+1});
    return {...recibo,reutilizado:false};
  }),
  cancelarTentativaVendaLocalV2:operation(async({tx,base,uid,shop,data})=>{
    if(data.confirmado!==true) fail('Confirme que a tentativa não gerou uma venda local e que o dinheiro foi devolvido, se recebido.');
    const motivo=typeof data.motivo==='string'?data.motivo.trim():'';
    if(motivo.length<5||motivo.length>180) fail('Informe um motivo entre 5 e 180 caracteres.');
    let venda;try{venda=normalizarVendaLocal(data);}catch(e){fail(e.message);}
    const turno=referenciaTurno(data.turno,uid);if(!turno) fail('Informe o turno original da tentativa.');
    const fingerprint=JSON.stringify({venda,turno}),key=hash(`${uid}:${venda.vendaId}`),ref=db.doc(`${base}/vendas_locais_v2/${key}`);
    const old=(await tx.get(ref)).data();
    if(old&&old.fingerprint!==fingerprint) fail('A tentativa diverge do registro original.');
    if(old?.status==='cancelado'){
      if(old.cancelamento.motivo!==motivo) fail('Retome o cancelamento com o motivo original.');
      return {...old.cancelamento,reutilizado:true};
    }
    if(old&&old.status!=='aguardando_gravacao_local') fail('Venda já confirmada. É necessário registrar um estorno.');
    const turn=await lerTurnoOperacao(db,tx,base,uid,{...shop,caixaV2:{exigirTurno:true}},turno),stocks=[];
    if(old){
      if(!Number.isSafeInteger(turn.data.baixasLocaisPendentes)||turn.data.baixasLocaisPendentes<1) fail('Conferência de turno inconsistente.');
      for(const consumo of old.recibo.consumos){
        const stockRef=db.doc(`${base}/estoque/${consumo.estoqueId}`),stock=(await tx.get(stockRef)).data();
        const saldo=stock?.saldoMili,quantidade=consumo.quantidadeMili;
        if(!Number.isSafeInteger(saldo)||saldo<0||!Number.isSafeInteger(quantidade)||quantidade<=0||saldo+quantidade>1e9) fail('Saldo inválido para devolver o estoque.');
        stocks.push({ref:stockRef,saldo:saldo+quantidade});
      }
    }
    const cancelamento={cancelado:true,reciboId:key,vendaId:venda.vendaId,lojaId:base.split('/')[1],motivo,estoqueDevolvido:!!old};
    // A marca permanece mesmo quando a baixa não chegou: uma requisição atrasada não pode recriar a venda.
    tx.set(ref,{fingerprint,status:'cancelado',cancelamento,canceladoEm:FieldValue.serverTimestamp()},{merge:true});
    if(old){
      for(const stock of stocks)tx.update(stock.ref,{saldoMili:stock.saldo,atualizadoEm:FieldValue.serverTimestamp()});
      tx.create(db.doc(`${base}/movimentos_estoque/cancel-local-${key}`),{tipo:'cancelamento_tentativa_local',vendaId:venda.vendaId,terminalUid:uid,turno,consumos:old.recibo.consumos,motivo,criadoEm:FieldValue.serverTimestamp()});
      tx.update(turn.ref,{baixasLocaisPendentes:turn.data.baixasLocaisPendentes-1,revisao:turn.data.revisao+1});
    }
    return {...cancelamento,reutilizado:false};
  }),
  confirmarGravacaoVendaLocalV2:operation(async({tx,base,uid,data})=>{
    if(typeof data.vendaId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(data.vendaId)) fail('Venda inválida.');
    const key=hash(`${uid}:${data.vendaId}`),ref=db.doc(`${base}/vendas_locais_v2/${key}`),record=(await tx.get(ref)).data();
    if(!record||data.reciboId!==key) fail('Baixa da venda não encontrada neste terminal.');
    if(record.status==='confirmado') return {confirmado:true,reutilizado:true};
    if(record.status!=='aguardando_gravacao_local') fail('Venda não aguarda confirmação. Confira o cancelamento ou estorno.');
    const turnRef=db.doc(`${base}/turnos_v2/${record.recibo.turno.chave}`),turn=(await tx.get(turnRef)).data();
    if(!turn||turn.status!=='aberto'||!Number.isSafeInteger(turn.baixasLocaisPendentes)||turn.baixasLocaisPendentes<1) fail('Conferência de turno inconsistente.');
    tx.update(ref,{status:'confirmado',confirmadoEm:FieldValue.serverTimestamp()});
    tx.update(turnRef,{baixasLocaisPendentes:turn.baixasLocaisPendentes-1,revisao:turn.revisao+1});
    return {confirmado:true,reutilizado:false};
  })
});
