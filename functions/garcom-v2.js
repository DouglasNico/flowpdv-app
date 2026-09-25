const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { exigirNovaOperacaoV2 } = require('./politica-ativacao-v2');
const { FieldPath } = require('firebase-admin/firestore');
module.exports = admin => ({
  consultarAtendimentoGarcomV2: onCall({cors:true},async request=>{
    const fail=(code,message)=>{throw new HttpsError(code,message);};
    if(!request.auth)fail('unauthenticated','Entre com sua conta de garçom.');
    const uid=request.auth.uid,actor=await admin.auth().getUser(uid),slug=request.data?.slug;
    if(actor.disabled||!actor.email||!actor.emailVerified)fail('permission-denied','Conta ativa e e-mail verificado necessários.');
    if(typeof slug!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(slug))fail('invalid-argument','Endereço de loja inválido.');
    const db=admin.firestore();
    return db.runTransaction(async tx=>{
      const route=(await tx.get(db.doc(`rotas_publicas_v2/${slug}`))).data();
      if(!route)fail('not-found','Loja não encontrada.');
      const base=`lojas_v2/${route.lojaId}`,member=(await tx.get(db.doc(`${base}/membros/${uid}`))).data();
      if(!member?.ativo||member.tipo!=='usuario'||member.papel!=='garcom'||(await tx.get(db.doc(`terminais_v2/${uid}`))).exists)fail('permission-denied','Garçom não autorizado nesta loja.');
      const shop=(await tx.get(db.doc(base))).data();
      if(!shop?.ativo)fail('failed-precondition','Loja indisponível.');
      let novosPermitidos=shop.modulos?.garcom===true;
      try{exigirNovaOperacaoV2(shop);}catch(error){if(error.code!=='failed-precondition')throw error;novosPermitidos=false;}
      const catalog=(await tx.get(db.doc(`catalogos_publicos_v2/${slug}`))).data();
      if(!catalog)fail('failed-precondition','Configure o catálogo primeiro.');
      const apos=request.data?.apos;
      if(apos!=null&&(typeof apos!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(apos)))fail('invalid-argument','Página de mesas inválida.');
      let query=db.collection(`${base}/mesas`).where('ativo','==',true).orderBy(FieldPath.documentId()).limit(201);
      if(apos)query=query.startAfter(apos);
      const tables=await tx.get(query),page=tables.docs.slice(0,200);
      return {nome:shop.nome||'',slug,novosPermitidos,catalogo:{versao:catalog.versao,produtos:catalog.produtos||[]},mesas:page.map(d=>({id:d.id,nome:d.data().nome})),proximaMesa:tables.size>200?page.at(-1).id:null};
    });
  })
});
