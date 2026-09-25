const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {FieldValue}=require('firebase-admin/firestore');
const {operacoesTurno}=require('./turnos-caixa-v2');
const {referenciaTurno}=require('./turno-referencia-v2');
const fail=(s,c='failed-precondition')=>{throw new HttpsError(c,s);};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
module.exports=admin=>({encerrarTurnoRecuperadoV2:onCall({cors:true},async request=>{
  if(!request.auth)fail('Entre como gerente.','unauthenticated');
  const d=request.data||{},ator=await admin.auth().getUser(request.auth.uid);
  if(ator.disabled||!ator.email||!ator.emailVerified)fail('Gerente verificado necessário.','permission-denied');
  if(![d.lojaId,d.destinoUid,d.identidadeUid,d.requestId].every(id)||!/^[a-f0-9]{64}$/.test(d.digest||'')||d.confirmado!==true
    ||!Number.isSafeInteger(d.revisao)||d.revisao<1||!Number.isSafeInteger(d.dinheiroContadoCentavos)||d.dinheiroContadoCentavos<0)fail('Conferência inválida.');
  const turno=referenciaTurno(d.turno,d.identidadeUid);if(!turno)fail('Turno inválido.');
  if((await admin.auth().getUser(d.destinoUid)).disabled)fail('Destino desativado.','permission-denied');
  const db=admin.firestore(),base=`lojas_v2/${d.lojaId}`;
  return db.runTransaction(async tx=>{
    const ler=async p=>(await tx.get(db.doc(p))).data();
    const loja=await ler(base),gerente=await ler(`${base}/membros/${ator.uid}`),terminalGerente=await ler(`terminais_v2/${ator.uid}`);
    if(!loja?.ativo||terminalGerente||gerente?.ativo!==true||gerente.tipo!=='usuario'||gerente.papel!=='gerente')fail('Gerência desta loja necessária.','permission-denied');
    if(loja.ativacaoOperacionalV2?.ambiente!=='homologacao'||loja.ativacaoOperacionalV2.estado!=='habilitada')fail('Homologação não habilitada.');
    const terminal=await ler(`terminais_v2/${d.destinoUid}`),membro=await ler(`${base}/membros/${d.destinoUid}`),identidade=await ler(`${base}/identidades_operacionais/${d.identidadeUid}`);
    if(terminal?.ativo!==true||terminal.lojaId!==d.lojaId||terminal.papel!=='caixa'||terminal.identidadeOperacionalUid!==d.identidadeUid
      ||membro?.ativo!==true||membro.tipo!=='terminal'||membro.papel!=='caixa'||identidade?.terminalUid!==d.destinoUid)fail('Identidade recuperada indisponível.','permission-denied');
    const ref=db.doc(`${base}/fechamentos_recuperados/${d.requestId}`),antigo=(await tx.get(ref)).data();
    const prova={pendenciasDigest:d.pendencias?.digest||null,digest:d.digest,gerenteUid:ator.uid,destinoUid:d.destinoUid,identidadeUid:d.identidadeUid,lojaId:d.lojaId,turnoChave:turno.chave,revisao:d.revisao,dinheiroContadoCentavos:d.dinheiroContadoCentavos};
    if(antigo){if(Object.keys(prova).some(k=>antigo.prova[k]!==prova[k]))fail('Tentativa pertence a outra conferência.');return {...antigo.resultado,reutilizado:true};}
    const pendencias = await require('./pendencias-recuperacao-v2').exigirPendenciasConferidas(db,tx,base,d.pendencias);
    const result=await operacoesTurno(db,fn=>fn).encerrarTurnoCaixaV2({tx,base,uid:d.identidadeUid,data:{turno:d.turno,revisao:d.revisao,dinheiroContadoCentavos:d.dinheiroContadoCentavos,confirmado:true}});
    const resultado={versao:1,requestId:d.requestId,...prova,turno:result.turno};
    tx.create(ref,{prova,resultado,pendencias,criadoEm:FieldValue.serverTimestamp()});
    return {...resultado,reutilizado:false};
  });
})});
