const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {FieldValue}=require('firebase-admin/firestore');
const fail=(message,code='failed-precondition')=>{throw new HttpsError(code,message);};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
// Autoriza somente um reinício em turno novo. Não modifica caixa, estoque ou vendas.
module.exports=admin=>({autorizarLiberacaoPerfilV2:onCall({cors:true},async request=>{
  if(!request.auth)fail('Entre como gerente.','unauthenticated');
  const ator=await admin.auth().getUser(request.auth.uid),d=request.data||{};
  if(ator.disabled||!ator.emailVerified||!ator.email)fail('Gerente com conta verificada necessário.','permission-denied');
  if(![d.lojaId,d.destinoUid,d.identidadeUid,d.requestId].every(id)||!/^[a-f0-9]{64}$/.test(d.digest||'')||d.confirmado!==true
    ||!Array.isArray(d.turnos)||d.turnos.length>50||!Array.isArray(d.estoque)||!d.estoque.length||d.estoque.length>100
    ||d.turnos.some(t=>!id(t.chave)||!Number.isSafeInteger(t.revisao))
    ||d.estoque.some(p=>!id(p.estoqueId)||!Number.isSafeInteger(p.saldoMili)||p.saldoMili<0||typeof p.unidade!=='string')
    ||new Set(d.turnos.map(t=>t.chave)).size!==d.turnos.length||new Set(d.estoque.map(p=>p.estoqueId)).size!==d.estoque.length)fail('Conferência inválida.');
  if((await admin.auth().getUser(d.destinoUid)).disabled)fail('Destino desativado.','permission-denied');
  const db=admin.firestore(),base=`lojas_v2/${d.lojaId}`;
  return db.runTransaction(async tx=>{
    const ler=async path=>(await tx.get(db.doc(path))).data();
    const loja=await ler(base),membro=await ler(`${base}/membros/${ator.uid}`),terminalAtor=await ler(`terminais_v2/${ator.uid}`);
    if(!loja?.ativo||terminalAtor||membro?.ativo!==true||membro.tipo!=='usuario'||membro.papel!=='gerente')fail('Gerência desta loja necessária.','permission-denied');
    if(loja.ativacaoOperacionalV2?.ambiente!=='homologacao'||loja.ativacaoOperacionalV2.estado!=='habilitada')fail('Homologação não habilitada.');
    const destino=await ler(`terminais_v2/${d.destinoUid}`),acesso=await ler(`${base}/membros/${d.destinoUid}`),identidade=await ler(`${base}/identidades_operacionais/${d.identidadeUid}`);
    if(destino?.ativo!==true||destino.lojaId!==d.lojaId||destino.papel!=='caixa'||destino.identidadeOperacionalUid!==d.identidadeUid
      ||acesso?.ativo!==true||acesso.papel!=='caixa'||acesso.tipo!=='terminal'||identidade?.terminalUid!==d.destinoUid)fail('A identidade recuperada mudou.','permission-denied');
    const turnos=await tx.get(db.collection(`${base}/turnos_v2`).where('terminalUid','==',d.identidadeUid).limit(51));
    if(turnos.size!==d.turnos.length||turnos.docs.some(doc=>{const t=doc.data();return t.status!=='fechado'||(t.baixasLocaisPendentes||0)!==0||!d.turnos.some(r=>r.chave===doc.id&&r.revisao===t.revisao);}))fail('Turnos abertos, pendentes ou alterados. Confira novamente.');
    const pendencias = await require('./pendencias-recuperacao-v2').exigirPendenciasConferidas(db,tx,base,d.pendencias);
    for(const p of d.estoque){const atual=await ler(`${base}/estoque/${p.estoqueId}`);if(atual?.saldoMili!==p.saldoMili||atual.unidade!==p.unidade)fail('Estoque mudou após a contagem. Confira novamente.');}
    const ref=db.doc(`${base}/liberacoes_perfis/${d.requestId}`),anterior=(await tx.get(ref)).data();
    const recibo={pendenciasDigest:d.pendencias?.digest||null,versao:1,lojaId:d.lojaId,destinoUid:d.destinoUid,identidadeUid:d.identidadeUid,gerenteUid:ator.uid,digest:d.digest,requestId:d.requestId};
    if(anterior){if(Object.keys(recibo).some(k=>anterior[k]!==recibo[k]))fail('Tentativa pertence a outra conferência.','already-exists');return {...recibo,reutilizado:true};}
    tx.create(ref,{...recibo,pendencias,turnos:d.turnos,estoque:d.estoque,criadoEm:FieldValue.serverTimestamp()});
    return {...recibo,reutilizado:false};
  });
})});
