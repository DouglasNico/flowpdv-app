const { HttpsError } = require('firebase-functions/v2/https');
const { referenciaTurno } = require('./turno-referencia-v2');
const fail = message => { throw new HttpsError('failed-precondition',message); };

// Consulta exclusivamente um recebimento já confirmado; nunca cria venda ou baixa.
module.exports = (db,operation) => ({
  consultarPagamentoAtendimentoV2: operation(async ({tx,base,uid,data:d}) => {
    const turno=referenciaTurno(d.turno,uid),valor=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
    if(!turno||typeof d.atendimentoId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(d.atendimentoId)
      ||d.confirmado!==true||!Number.isSafeInteger(d.versao)||d.versao<1||!Array.isArray(d.pagamentos)||d.pagamentos.length>5
      ||d.pagamentos.some(p=>!p||!['dinheiro','pix_manual','cartao_manual'].includes(p.forma)||!valor(p.valorCentavos)||!p.valorCentavos))fail('Tentativa de pagamento inválida.');
    const pagamentos=d.pagamentos.map(p=>({forma:p.forma,valorCentavos:p.valorCentavos}));
    const dinheiro=pagamentos.filter(p=>p.forma==='dinheiro').reduce((n,p)=>n+p.valorCentavos,0);
    const recebidoDinheiro=d.recebidoDinheiroCentavos??dinheiro,total=pagamentos.reduce((n,p)=>n+p.valorCentavos,0);
    if(!valor(total)||!valor(recebidoDinheiro)||recebidoDinheiro<dinheiro||(!dinheiro&&recebidoDinheiro))fail('Valores inválidos.');
    const fingerprint=JSON.stringify({versao:d.versao,pagamentos,recebidoDinheiro,turno});
    const sale=(await tx.get(db.doc(`${base}/vendas/${d.atendimentoId}`))).data();
    if(!sale)fail('Pagamento não localizado no servidor. Preserve a tentativa para conciliação; não receba novamente.');
    if(sale.status!=='concluida'||sale.terminalUid!==uid||sale.turno?.chave!==turno.chave||sale.fingerprint!==fingerprint
      ||sale.totalCentavos!==total||sale.trocoCentavos!==recebidoDinheiro-dinheiro)fail('Pagamento diverge da tentativa ou foi estornado. Preserve o registro para conferência.');
    const conta=(await tx.get(db.doc(`${base}/atendimentos/${d.atendimentoId}`))).data();
    const movimento=(await tx.get(db.doc(`${base}/movimentos_financeiros/${d.atendimentoId}`))).data();
    if(conta?.status!=='fechado'||conta.vendaId!==d.atendimentoId||conta.versao!==d.versao+1
      ||movimento?.tipo!=='recebimento_manual'||movimento.vendaId!==d.atendimentoId||movimento.terminalUid!==uid
      ||movimento.turno?.chave!==turno.chave||movimento.totalCentavos!==total
      ||JSON.stringify((movimento.pagamentos||[]).map(p=>({forma:p.forma,valorCentavos:p.valorCentavos})))!==JSON.stringify(pagamentos))fail('Conta ou movimento financeiro divergente. Mantenha o perfil bloqueado.');
    return {versao:1,somenteConferencia:true,lojaId:base.split('/')[1],terminalUid:uid,vendaId:d.atendimentoId,
      status:sale.status,totalCentavos:sale.totalCentavos,trocoCentavos:sale.trocoCentavos,reutilizado:true};
  })
});
