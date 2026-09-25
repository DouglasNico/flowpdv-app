const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail('invalid-argument', 'Identificação inválida.');
  return value;
};
module.exports = admin => {
  const db=admin.firestore(), stamp=()=>FieldValue.serverTimestamp();
  const operation=action=>onCall({cors:true},async request=>{
    if(!request.auth) fail('unauthenticated','Ative o caixa.');
    const uid=request.auth.uid;
    if((await admin.auth().getUser(uid)).disabled) fail('permission-denied','Terminal desativado.');
    return db.runTransaction(async tx=>{
      const terminal=(await tx.get(db.doc(`terminais_v2/${uid}`))).data();
      if(!terminal?.ativo || terminal.papel!=='caixa') fail('permission-denied','Somente caixa autorizado pode consultar ou operar entregas.');
      const base=`lojas_v2/${terminal.lojaId}`;
      const member=(await tx.get(db.doc(`${base}/membros/${uid}`))).data(),shop=(await tx.get(db.doc(base))).data();
      if(!shop?.ativo || !member?.ativo || member.tipo!=='terminal' || member.papel!=='caixa') fail('permission-denied','Vínculo indisponível.');
      const data=request.data||{},pedidoId=id(data.pedidoId),ref=db.doc(`${base}/pedidos/${pedidoId}`),order=(await tx.get(ref)).data();
      if(!order || order.tipo!=='delivery') fail('not-found','Entrega não encontrada nesta loja.');
      return action({tx,uid,base,data,pedidoId,ref,order});
    });
  });
  return {
    consultarEntregaCaixaV2:operation(async({tx,base,pedidoId,order})=>{
      const privateData=(await tx.get(db.doc(`${base}/dados_entrega/${pedidoId}`))).data();
      if(!privateData) fail('failed-precondition','Endereço não localizado; confira antes de despachar.');
      const entrega=require('./delivery-core.cjs').normalizarEntrega(privateData);
      return {pedidoId,status:order.status,pagamento:order.pagamento||'pendente',taxaEntregaCentavos:order.taxaEntregaCentavos,totalCentavos:order.totalCentavos,
        entrega,responsavel:privateData.responsavel||'',recebidoPdv:order.recebidoPdv===true,
        itens:order.itens.map(i=>({nome:i.nome,quantidade:i.quantidade,totalCentavos:i.totalCentavos,...(i.variante === 'combo' ? {variante:'combo',componentes:i.componentes} : {})}))};
    }),
    avancarEntregaV2:operation(async({tx,uid,base,data,pedidoId,ref,order})=>{
      const next={novo:'em_preparo',em_preparo:'pronto',pronto:'saiu_entrega',saiu_entrega:'entregue'};
      if(!Object.hasOwn(next,data.de)||next[data.de]!==data.para)fail('invalid-argument','Transição de entrega inválida.');
      const requestId=id(data.requestId),responsavel=data.para==='saiu_entrega'&&typeof data.responsavel==='string'?data.responsavel.trim():'';
      if(data.para==='saiu_entrega'&&(!responsavel||responsavel.length>80||/[\x00-\x1f\x7f]/.test(responsavel)))fail('invalid-argument','Informe o responsável pela entrega (até 80 caracteres).');
      const hash=value=>createHash('sha256').update(value).digest('hex');
      const fingerprint=hash(JSON.stringify({pedidoId,de:data.de,para:data.para,responsavel}));
      // Chave por loja permite recuperar uma confirmação em outro caixa autorizado.
      const actionRef=db.doc(`${base}/acoes_entrega/${requestId}`),previous=(await tx.get(actionRef)).data();
      if(previous){if(previous.fingerprint!==fingerprint)fail('already-exists','Tentativa já usada com outro conteúdo.');return {pedidoId,status:order.status,reutilizado:true};}
      if(!order.recebidoPdv||order.ignoradoPdv||order.status!==data.de)fail('failed-precondition','Pedido mudou ou ainda não foi recebido. Atualize a entrega.');
      const privateRef=db.doc(`${base}/dados_entrega/${pedidoId}`),privateData=(await tx.get(privateRef)).data();
      if(!privateData)fail('failed-precondition','Endereço não localizado.');
      require('./delivery-core.cjs').normalizarEntrega(privateData);
      if(data.para==='entregue'&&!privateData.responsavel)fail('failed-precondition','Entrega sem responsável registrado.');
      if(responsavel)tx.update(privateRef,{responsavel,despachadoPor:uid,despachadoEm:stamp()});
      tx.update(ref,{status:data.para,atualizadoEm:stamp(),entregaTerminalUid:uid});
      tx.create(actionRef,{pedidoId,de:data.de,para:data.para,fingerprint,atorUid:uid,criadoEm:stamp()});
      return {pedidoId,status:data.para,reutilizado:false};
    })
  };
};
