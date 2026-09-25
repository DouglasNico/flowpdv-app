const { createHash } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const { FieldPath } = require('firebase-admin/firestore');
const { referenciaTurno } = require('./turno-referencia-v2');
const { planejarSaldoLegado } = require('./estoque-migracao-core.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new HttpsError('failed-precondition', message); };

// Consulta somente leitura, sob o mesmo controle de caixa ativo das operações financeiras.
module.exports = (db, operation) => ({
  conferirPendenciasRecuperacaoV2: operation(async ({tx,base,uid}) => ({...await require('./pendencias-recuperacao-v2').conferirPendencias(db,tx,base),terminalUid:uid})),
  listarPendenciasAtendimentoV2: operation(async ({ tx, base, uid, data }) => {
    const tipo = data.tipo || 'contas', cursor = data.cursor;
    if (!['contas', 'pedidos'].includes(tipo)) fail('Tipo de consulta inválido.');
    const lojaId = base.split('/')[1];
    if (cursor != null && (cursor.lojaId !== lojaId || cursor.terminalUid !== uid || cursor.tipo !== tipo
      || typeof cursor.apos !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(cursor.apos))) fail('O acesso ou filtro mudou. Reinicie a consulta.');
    let query = tipo === 'contas' ? db.collection(`${base}/atendimentos`).where('status', '==', 'aberto')
      : db.collection(`${base}/pedidos`).where('recebidoPdv', '==', false);
    query = query.orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor.apos);
    const snapshot = await tx.get(query), docs = snapshot.docs.slice(0, 50);
    const registros = docs.map(doc => {
      const p = doc.data();
      if (!['mesa', 'retirada', 'delivery'].includes(p.tipo) || !Number.isSafeInteger(p.totalCentavos) || p.totalCentavos < 0) fail('Registro de atendimento inconsistente. Exige conferência administrativa.');
      return { id: doc.id, tipo: p.tipo, status: p.status, totalCentavos: p.totalCentavos,
        mesaId: typeof p.mesaId === 'string' ? p.mesaId : null,
        versao: Number.isSafeInteger(p.versao) ? p.versao : null };
    });
    return { versao: 1, lojaId, terminalUid: uid, tipo, somenteConferencia: true, registros,
      proximo: snapshot.size > 50 ? { lojaId, terminalUid: uid, tipo, apos: docs.at(-1).id } : null };
  }),
  listarTurnosRecuperacaoV2: operation(async ({ tx, base, uid }) => {
    const snapshots = await tx.get(db.collection(`${base}/turnos_v2`).where('terminalUid', '==', uid).limit(51));
    if (snapshots.size > 50) fail('Histórico excede 50 turnos. Exige recuperação paginada.');
    const turnos = snapshots.docs.map(doc => {
      const t = doc.data(), referencia = referenciaTurno(t, uid);
      if (!referencia || referencia.chave !== doc.id || t.chave !== doc.id
        || !Number.isSafeInteger(t.revisao) || t.revisao < 1 || !['aberto', 'fechado'].includes(t.status)) fail('Histórico de turnos inconsistente.');
      return { ...referencia, status: t.status, revisao: t.revisao };
    });
    return { versao: 1, lojaId: base.split('/')[1], terminalUid: uid, somenteConferencia: true, turnos };
  }),
  conferirInventarioCorteV2: operation(async ({ tx, base, uid, data }) => {
    if (!Array.isArray(data.produtos) || !data.produtos.length || data.produtos.length > 100) fail('Informe entre 1 e 100 produtos migrados para conferir.');
    let planos;
    try { planos = data.produtos.map(planejarSaldoLegado); } catch (e) { fail(e.message); }
    if (new Set(planos.map(p => p.legadoId)).size !== planos.length) fail('Produto repetido na conferência.');
    const produtos = [];
    for (const plano of planos) {
      const mapping = (await tx.get(db.doc(`${base}/migracoes_estoque/${hash(plano.legadoId)}`))).data();
      if (!mapping) { produtos.push({ legadoId: plano.legadoId, nome: plano.nome, situacao: 'sem_vinculo' }); continue; }
      if (typeof mapping.estoqueId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(mapping.estoqueId)) fail('Vínculo de estoque inválido.');
      const stock = (await tx.get(db.doc(`${base}/estoque/${mapping.estoqueId}`))).data();
      const corte = mapping.plano;
      if (!stock || !corte || !Number.isSafeInteger(corte.saldoMili) || corte.saldoMili < 0
        || !Number.isSafeInteger(stock.saldoMili) || stock.saldoMili < 0) fail('Saldo de corte ou saldo atual indisponível. Exige conferência administrativa.');
      const compativel = corte.legadoId === plano.legadoId && corte.unidadeOrigem === plano.unidadeOrigem
        && corte.unidade === plano.unidade && stock.unidade === plano.unidade;
      produtos.push({ legadoId: plano.legadoId, nome: plano.nome, estoqueId: mapping.estoqueId,
        situacao: !compativel ? 'unidade_divergente' : plano.saldoMili !== corte.saldoMili ? 'corte_divergente' : 'vinculo_conferido',
        unidadeSnapshot: plano.unidade, unidadeCorte: corte.unidade, unidadeServidor: stock.unidade,
        saldoSnapshotMili: plano.saldoMili, saldoCorteMili: corte.saldoMili, saldoAtualMili: stock.saldoMili,
        variacaoDesdeCorteMili: compativel ? stock.saldoMili - corte.saldoMili : null });
    }
    return { versao: 1, lojaId: base.split('/')[1], terminalUid: uid, somenteConferencia: true, produtos };
  }),
  consultarRecuperacaoLocalV2: operation(async ({ tx, base, uid, data }) => {
    if (!Array.isArray(data.vendaIds) || data.vendaIds.length > 50
      || data.vendaIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id))
      || new Set(data.vendaIds).size !== data.vendaIds.length) fail('Informe até 50 vendas distintas para conferir.');
    const turno = referenciaTurno(data.turno, uid);
    if (!turno) fail('Informe o turno original.');
    const estado = (await tx.get(db.doc(`${base}/turnos_v2/${turno.chave}`))).data();
    if (!estado) fail('Turno não encontrado para esta identidade. Não transfira a identidade pelo backup.');
    const vendas = new Map();
    const resumir = (vendaId, record) => ({ vendaId, status: record?.status || 'ausente',
      criadoEm: record?.criadoEm?.toDate ? record.criadoEm.toDate().toISOString() : null,
      recibo: record?.recibo || null, estorno: record?.estorno?.recibo || null, cancelamento: record?.cancelamento || null });
    for (const vendaId of data.vendaIds) {
      const record = (await tx.get(db.doc(`${base}/vendas_locais_v2/${hash(`${uid}:${vendaId}`)}`))).data();
      vendas.set(vendaId, resumir(vendaId, record));
    }
    // Detecta operações do turno que não constavam no arquivo, inclusive estornos
    // neste turno de vendas realizadas em turnos anteriores.
    for (const field of ['recibo.turno.chave', 'estorno.recibo.turno.chave']) {
      const registros = await tx.get(db.collection(`${base}/vendas_locais_v2`).where(field, '==', turno.chave).limit(101));
      if (registros.size > 100) fail('Turno excede o limite de conferência. Exige recuperação paginada.');
      for (const snapshot of registros.docs) {
        const record = snapshot.data(), vendaId = record.recibo?.vendaId || record.estorno?.recibo?.vendaId;
        if (!vendaId || snapshot.id !== hash(`${uid}:${vendaId}`)) fail('Registro de recuperação inconsistente.');
        vendas.set(vendaId, resumir(vendaId, record));
      }
    }
    return { versao: 1, lojaId: base.split('/')[1], terminalUid: uid, turno: estado,
      somenteConferencia: true, registros: [...vendas.values()] };
  })
});
