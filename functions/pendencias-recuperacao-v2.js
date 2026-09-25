const { createHash } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const fail = message => { throw new HttpsError('failed-precondition', message); };
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
// A revisão de cada documento entra na prova; nenhum documento é alterado.
async function conferirPendencias(db, tx, base) {
  const provas = [], registros = [], cache = new Map();
  const guardar = doc => { provas.push([doc.ref.path, doc.updateTime?.seconds ?? null, doc.updateTime?.nanoseconds ?? null]); return doc.data(); };
  const ler = async (col, chave) => {
    if (!id(chave)) fail('Vínculo de atendimento inválido.');
    const path = `${base}/${col}/${chave}`;
    if (!cache.has(path)) cache.set(path, guardar(await tx.get(db.doc(path))));
    return cache.get(path);
  };
  let vinculados = 0;
  for (const [col, campo, valor, grupo] of [['atendimentos','status','aberto','contas'],['pedidos','recebidoPdv',false,'pedidos']]) {
    const snap = await tx.get(db.collection(`${base}/${col}`).where(campo,'==',valor).limit(101));
    if (snap.size > 100) fail('Mais de 100 pendências por grupo. Exige conferência ampliada.');
    for (const doc of snap.docs) {
      const p = guardar(doc);
      if (!['mesa','retirada','delivery'].includes(p.tipo) || !Number.isSafeInteger(p.totalCentavos) || p.totalCentavos < 0
        || !Array.isArray(p.itens) || !p.itens.length || p.itens.length > 300) fail('Pendência incompleta. Confira os itens no atendimento original.');
      const taxa = p.tipo === 'delivery' ? p.taxaEntregaCentavos : 0;
      if (!Number.isSafeInteger(taxa) || taxa < 0 || p.itens.some(i => !Number.isSafeInteger(i.totalCentavos) || i.totalCentavos < 0)
        || p.itens.reduce((n,i)=>n+i.totalCentavos,0)+taxa !== p.totalCentavos) fail('Total da pendência inconsistente.');
      if (grupo === 'contas') {
        if (!Number.isSafeInteger(p.versao) || p.versao < 1 || p.vendaId || await ler('vendas',doc.id) || await ler('movimentos_financeiros',doc.id)) fail('Conta aberta com pagamento ou registro inconsistente. Não cobre novamente.');
        const pedidos = [...new Set(p.itens.map(i=>i.origemPedidoId))];
        vinculados += pedidos.length;
        if (vinculados > 300) fail('Muitos pedidos vinculados. Exige conferência ampliada.');
        for (const chave of pedidos) {
          const pedido = await ler('pedidos',chave);
          if (!pedido || pedido.atendimentoId !== doc.id || pedido.recebidoPdv !== true || pedido.pagamento !== 'pendente'
            || pedido.vendaId || pedido.status === 'cancelado') fail('Pedido da conta possui pagamento ou vínculo divergente.');
        }
        if (p.tipo === 'mesa') {
          const mesa = await ler('mesas',p.mesaId);
          if (!mesa?.ativo || mesa.atendimentoId !== doc.id || mesa.comandaPdvId !== p.comandaPdvId) fail('Vínculo da mesa mudou.');
        }
      } else if (p.pagamento !== 'pendente' || p.vendaId || p.atendimentoId) fail('Pedido pendente com pagamento ou recebimento incerto. Não cobre novamente.');
      registros.push({grupo,id:doc.id,tipo:p.tipo,status:p.status,mesaId:p.mesaId || null,totalCentavos:p.totalCentavos});
    }
  }
  provas.sort((a,b)=>a[0].localeCompare(b[0]));
  registros.sort((a,b)=>(a.grupo+':'+a.id).localeCompare(b.grupo+':'+b.id));
  return {versao:1,lojaId:base.split('/')[1],somenteConferencia:true,registros,digest:createHash('sha256').update(JSON.stringify(provas)).digest('hex')};
}
async function exigirPendenciasConferidas(db,tx,base,entrada) {
  // Mantém o contrato antigo: sem aceite explícito, qualquer pendência bloqueia.
  if (!entrada) {
    for (const [col,campo,valor] of [['atendimentos','status','aberto'],['pedidos','recebidoPdv',false]])
      if (!(await tx.get(db.collection(`${base}/${col}`).where(campo,'==',valor).limit(1))).empty) fail('Existem contas ou pedidos pendentes. Confira antes de prosseguir.');
    return null;
  }
  if (entrada.confirmado !== true || typeof entrada.fonte !== 'string' || entrada.fonte.trim().length < 5 || entrada.fonte.length > 180) fail('Confirme as pendências e os comprovantes independentes.');
  const atual = await conferirPendencias(db,tx,base);
  if (entrada.digest !== atual.digest) fail('As pendências mudaram. Prepare uma nova conferência.');
  return {digest:atual.digest,fonte:entrada.fonte,quantidade:atual.registros.length};
}
module.exports = { conferirPendencias, exigirPendenciasConferidas };
