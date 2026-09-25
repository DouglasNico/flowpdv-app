const { onCall, HttpsError } = require('firebase-functions/v2/https');
module.exports = admin => ({
  consultarPreparacaoOperacionalPdvV2: onCall({cors:true,minInstances:0,maxInstances:1,invoker:'public'}, async request => {
    if (!request.auth) throw new HttpsError('unauthenticated','Conecte este computador primeiro.');
    if ((await admin.auth().getUser(request.auth.uid)).disabled) throw new HttpsError('permission-denied','Terminal desativado.');
    const db=admin.firestore();
    return db.runTransaction(async tx=>{
      const t=(await tx.get(db.doc(`terminais_v2/${request.auth.uid}`))).data();
      if(!t?.ativo || t.papel!=='caixa' || t.chaveLicenca!=='LIC-FLOW-937278' || t.lojaId!=='legado-lic-flow-937278') throw new HttpsError('permission-denied','Caixa não autorizado para este piloto.');
      const base=`lojas_v2/${t.lojaId}`,shop=(await tx.get(db.doc(base))).data(),member=(await tx.get(db.doc(`${base}/membros/${request.auth.uid}`))).data();
      if(!shop?.ativo || !member?.ativo || member.tipo!=='terminal' || member.papel!=='caixa') throw new HttpsError('permission-denied','Vínculo indisponível.');
      await require('./identidade-operacional-v2')(tx,db,base,t,request.auth.uid);
      const c=shop.corteOperacionalV2;
      // Preparação de estoque não é corte: o legado precisa estar interrompido
      // e a rota pública migrada antes de autorizar a adesão do aplicativo.
      if(c?.schema!==1 || !['aguardando_pdv','concluido'].includes(c.estado) || c.legadoBloqueado!==true || c.rotaPublicaV2!==true) return {schema:1,liberado:false,motivo:'corte_pendente'};
      const prepared=await tx.get(db.collection(`${base}/produtos_legados`));
      const products=[];
      for(const record of prepared.docs){
        const p=record.data().produto,semEstoque=p.controlarEstoque===false;
        const saldo=semEstoque?null:(await tx.get(db.doc(`${base}/estoque/${p.id}`))).data();
        products.push({id:String(p.id),precoCentavos:Math.round(Number(p.precoVenda)*100),semEstoque,...(!semEstoque?{saldoMili:saldo?.saldoMili??null}:{})});
      }
      return {schema:1,liberado:true,lojaId:t.lojaId,chaveLicenca:t.chaveLicenca,deviceId:t.deviceId,revisao:shop.ativacaoOperacionalV2.revisao,produtos:products};
    });
  }),
  confirmarAdesaoOperacionalPdvV2: onCall({cors:true,minInstances:0,maxInstances:1,invoker:'public'}, async request=>{
    if(!request.auth || (await admin.auth().getUser(request.auth.uid)).disabled)throw new HttpsError('permission-denied','Terminal indisponível.');
    const db=admin.firestore();
    return db.runTransaction(async tx=>{
      const ref=db.doc(`terminais_v2/${request.auth.uid}`),t=(await tx.get(ref)).data();
      if(!t?.ativo||t.lojaId!=='legado-lic-flow-937278'||t.papel!=='caixa'||t.chaveLicenca!=='LIC-FLOW-937278'||t.deviceId!==request.data?.deviceId)throw new HttpsError('permission-denied','Caixa incompatível.');
      const base=`lojas_v2/${t.lojaId}`,shop=(await tx.get(db.doc(base))).data(),member=(await tx.get(db.doc(`${base}/membros/${request.auth.uid}`))).data();
      if(!shop?.ativo||!member?.ativo||member.tipo!=='terminal'||member.papel!=='caixa'||shop.corteOperacionalV2?.legadoBloqueado!==true||!['aguardando_pdv','concluido'].includes(shop.corteOperacionalV2?.estado)||request.data?.revisao!==shop.ativacaoOperacionalV2?.revisao)throw new HttpsError('failed-precondition','Preparação mudou; confira a conexão novamente.');
      await require('./identidade-operacional-v2')(tx,db,base,t,request.auth.uid);
      const adesao={schema:1,deviceId:t.deviceId,revisao:request.data.revisao,confirmada:true};
      tx.update(ref,{adesaoOperacionalV2:adesao});return adesao;
    });
  })
});
