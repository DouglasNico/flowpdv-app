const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { referenciaTurno } = require('./turno-referencia-v2');
const { detalharMovimento } = require('./detalhes-turno-v2');
const fail = message => { throw new HttpsError('failed-precondition', message); };
const number = (value, signed=false) => {
  if (!Number.isSafeInteger(value) || (!signed && value < 0) || Math.abs(value)>1000000000000) fail('Valor de caixa inválido.');
  return value;
};
async function lerTurnoOperacao(db, tx, base, uid, shop, turno) {
  if (!turno) { if (shop.caixaV2?.exigirTurno === true) fail('Abra e confirme um turno no servidor antes de registrar pagamentos.'); return null; }
  const ref=db.doc(`${base}/turnos_v2/${turno.chave}`), snap=await tx.get(ref);
  if (!snap.exists && shop.caixaV2?.exigirTurno !== true) return null;
  const slot=(await tx.get(db.doc(`${base}/caixas_v2/${uid}`))).data(), data=snap.data();
  if (!data || data.status!=='aberto' || data.terminalUid!==uid || slot?.turnoChave!==turno.chave) fail('Turno não está aberto neste terminal. Confira o caixa.');
  return {ref,data};
}
function registrarMovimentoTurno(tx, turn, pagamentos, sign) {
  if (!turn) return;
  const formas={...turn.data.formas}; let delta=0;
  for(const p of pagamentos){delta+=sign*p.valorCentavos;formas[p.forma]=number((formas[p.forma]||0)+sign*p.valorCentavos,true);}
  tx.update(turn.ref,{formas,totalCentavos:number(turn.data.totalCentavos+delta,true),movimentos:turn.data.movimentos+1,revisao:turn.data.revisao+1,atualizadoEm:FieldValue.serverTimestamp()});
}
function operacoesTurno(db,operation) {
  return {
    obterResumoFechadoTurnoV2: operation(async({tx,base,uid,data})=>{
      const turno=referenciaTurno(data.turno,uid); if(!turno) fail('Informe o turno.');
      const state=(await tx.get(db.doc(`${base}/turnos_v2/${turno.chave}`))).data();
      if(!state || state.status!=='fechado') fail('Encerre o turno do restaurante antes de consolidar no caixa.');
      const records=await tx.get(db.collection(`${base}/movimentos_financeiros`).where('turno.chave','==',turno.chave).limit(501));
      if(records.size>500) fail('Consolidação excede 500 movimentos. É necessária paginação antes de integrar.');
      const formas={dinheiro:0,pix_manual:0,cartao_manual:0};let total=0,recebimentos=0,estornos=0;
      const detalhes=[],vendas=new Map();let linhas=0;
      for(const doc of records.docs){
        const m=doc.data(),sign=m.tipo==='recebimento_manual'?1:m.tipo==='estorno_manual'?-1:0;
        if(!sign||!Array.isArray(m.pagamentos)||m.pagamentos.reduce((s,p)=>s+p.valorCentavos,0)!==sign*m.totalCentavos) fail('Movimentos inconsistentes. Confira a conciliação.');
        total+=m.totalCentavos; if(sign===1) recebimentos++;else estornos++;
        for(const p of m.pagamentos){if(!(p.forma in formas)) fail('Forma de pagamento desconhecida.');formas[p.forma]+=sign*p.valorCentavos;}
        if(typeof m.vendaId!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(m.vendaId)) fail('Referência da venda inválida.');
        if(!vendas.has(m.vendaId)) vendas.set(m.vendaId,(await tx.get(db.doc(`${base}/vendas/${m.vendaId}`))).data());
        const detalhe=detalharMovimento(doc.id,m,vendas.get(m.vendaId));
        linhas+=detalhe.itens.length;
        if(linhas>2000) fail('Detalhamento excede 2.000 linhas. É necessária paginação antes de integrar.');
        detalhes.push(detalhe);
      }
      if(total!==state.totalCentavos||records.size!==state.movimentos||Object.keys(formas).some(k=>formas[k]!==state.formas[k])) fail('Resumo difere dos movimentos. Confira antes de consolidar.');
      detalhes.sort((a,b)=>a.movimentoId.localeCompare(b.movimentoId));
      if(Buffer.byteLength(JSON.stringify(detalhes),'utf8')>750000) fail('Detalhamento muito grande para integração local.');
      return { versao:1,lojaId:base.split('/')[1],turno,status:'fechado',revisao:state.revisao,totalCentavos:total,formas,trocoInicialCentavos:state.trocoInicialCentavos,recebimentos,estornos,detalhes };
    }),
    abrirTurnoCaixaV2: operation(async({tx,base,uid,shop,data})=>{
      if(shop.caixaV2?.exigirTurno!==true) fail('Controle de turnos não habilitado nesta loja.');
      const turno=referenciaTurno(data.turno,uid);if(!turno) fail('Informe o turno local.');
      const trocoInicialCentavos=number(data.trocoInicialCentavos),ref=db.doc(`${base}/turnos_v2/${turno.chave}`),slotRef=db.doc(`${base}/caixas_v2/${uid}`);
      const old=(await tx.get(ref)).data(),slot=(await tx.get(slotRef)).data();
      if(old){
        if(old.status!=='aberto'||slot?.turnoChave!==turno.chave) fail('Turno já encerrado. Abra um novo turno.');
        if(old.trocoInicialCentavos!==trocoInicialCentavos) fail('Abertura já registrada com outro fundo de troco.');
        return {turno:old,reutilizado:true};
      }
      if(slot?.turnoChave) fail('Este terminal já possui outro turno aberto.');
      // Não adotar silenciosamente movimentos da versão anterior.
      const prior=await tx.get(db.collection(`${base}/movimentos_financeiros`).where('turno.chave','==',turno.chave).limit(1));
      if(!prior.empty) fail('Referência já possui movimentos anteriores. Concilie antes de migrar.');
      const state={...turno,status:'aberto',trocoInicialCentavos,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},movimentos:0,revisao:1};
      tx.create(ref,{...state,abertoEm:FieldValue.serverTimestamp()});tx.set(slotRef,{turnoChave:turno.chave});
      return {turno:state,reutilizado:false};
    }),
    consultarTurnoCaixaV2: operation(async({tx,base,uid,data})=>{
      const turno=referenciaTurno(data.turno,uid);if(!turno) fail('Informe o turno.');
      return {turno:(await tx.get(db.doc(`${base}/turnos_v2/${turno.chave}`))).data()||null};
    }),
    encerrarTurnoCaixaV2: operation(async({tx,base,uid,data})=>{
      const turno=referenciaTurno(data.turno,uid);if(!turno) fail('Informe o turno.');
      if(data.confirmado!==true) fail('Confira os valores antes de encerrar.');
      const contado=number(data.dinheiroContadoCentavos),ref=db.doc(`${base}/turnos_v2/${turno.chave}`),slotRef=db.doc(`${base}/caixas_v2/${uid}`);
      const saved=(await tx.get(ref)).data(),slot=(await tx.get(slotRef)).data();
      if(!saved) fail('Turno não encontrado.');
      if(saved.status==='fechado'){
        if(saved.dinheiroContadoCentavos!==contado||saved.revisaoConferida!==data.revisao) fail('Encerramento já registrado com outra conferência.');
        return {turno:saved,reutilizado:true};
      }
      if(saved.revisao!==data.revisao||slot?.turnoChave!==turno.chave) fail('O turno mudou. Atualize os valores antes de encerrar.');
      if(saved.baixasLocaisPendentes) fail('Retome as vendas ou os estornos locais pendentes antes de encerrar.');
      const esperado=number(saved.trocoInicialCentavos+(saved.formas.dinheiro||0),true);
      const closed={status:'fechado',dinheiroEsperadoCentavos:esperado,dinheiroContadoCentavos:contado,diferencaCentavos:contado-esperado,revisaoConferida:data.revisao,revisao:saved.revisao+1};
      tx.update(ref,{...closed,encerradoEm:FieldValue.serverTimestamp()});tx.set(slotRef,{turnoChave:null});
      return {turno:{...saved,...closed},reutilizado:false};
    })
  };
}
module.exports={lerTurnoOperacao,registrarMovimentoTurno,operacoesTurno};
