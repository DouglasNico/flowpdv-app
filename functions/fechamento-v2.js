const { exigirNovaOperacaoV2 } = require('./politica-ativacao-v2');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const { referenciaTurno } = require('./turno-referencia-v2');
const { lerTurnoOperacao, registrarMovimentoTurno, operacoesTurno } = require('./turnos-caixa-v2');
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) fail('invalid-argument', 'Identificação inválida.');
  return value;
};
const number = (value, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min || value > 1000000000) fail('failed-precondition', 'Valor ou quantidade inválida.');
  return value;
};
const reason = value => {
  if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 180) fail('invalid-argument', 'Informe um motivo de 5 a 180 caracteres.');
  return value.trim();
};

module.exports = admin => {
  const db = admin.firestore(), stamp = () => FieldValue.serverTimestamp();
  const operation = action => onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    if (!request.auth) fail('unauthenticated', 'Ative o caixa.');
    const uid = request.auth.uid;
    if ((await admin.auth().getUser(uid)).disabled) fail('permission-denied', 'Terminal desativado.');
    return db.runTransaction(async tx => {
      const terminal = (await tx.get(db.doc(`terminais_v2/${uid}`))).data();
      if (!terminal?.ativo || terminal.papel !== 'caixa') fail('permission-denied', 'Somente terminal de caixa ativo.');
      const base = `lojas_v2/${terminal.lojaId}`;
      const member = (await tx.get(db.doc(`${base}/membros/${uid}`))).data(), shop = (await tx.get(db.doc(base))).data();
      if (!shop?.ativo || !member?.ativo || member.tipo !== 'terminal' || member.papel !== 'caixa') fail('permission-denied', 'Vínculo indisponível.');
      const operacionalUid = await require('./identidade-operacional-v2')(tx, db, base, terminal, uid);
      return action({ tx, base, uid: operacionalUid, autenticadoUid: uid, shop, data: request.data || {} });
    });
  });
  const stockFor = async (tx, base, lines) => {
    const totals = new Map(), recipes = new Map();
    let expanded;
    try { expanded = require('./composicao-pedido-core.cjs').linhasDeEstoque(lines); }
    catch (error) { fail('failed-precondition', error.message); }
    for (const line of expanded) {
      const product = id(line.produtoId);
      if (!recipes.has(product)) recipes.set(product, (await tx.get(db.doc(`${base}/fichas_estoque/${product}`))).data());
      const recipe = recipes.get(product);
      if (!recipe) fail('failed-precondition', `Configure a ficha de estoque de ${line.nome}.`);
      if (recipe.semEstoque === true) continue;
      const add = (consumos, factor) => {
        if (!Array.isArray(consumos) || consumos.length > 20) fail('failed-precondition', 'Ficha de estoque inválida.');
        for (const item of consumos) {
          const key = id(item.estoqueId), qty = number(number(item.quantidadeMili, 1) * factor, 1);
          totals.set(key, number((totals.get(key) || 0) + qty, 1));
        }
      };
      const quantidade = number(line.quantidade, 1); add(recipe.consumos, quantidade);
      for (const option of line.opcoes || []) {
        const mapping = (recipe.opcoes || []).find(o => o.grupoId === option.grupoId && o.opcaoId === option.opcaoId);
        if (!mapping) fail('failed-precondition', `Configure o estoque da opção ${option.nome}.`);
        add(mapping.consumos, quantidade * number(option.quantidade, 1));
      }
    }
    if (totals.size > 100) fail('failed-precondition', 'Conta excede 100 insumos distintos.');
    const result = [];
    for (const [estoqueId, quantidadeMili] of totals) {
      const ref = db.doc(`${base}/estoque/${estoqueId}`), snapshot = await tx.get(ref);
      if (!snapshot.exists || number(snapshot.data().saldoMili) < quantidadeMili) fail('failed-precondition', `Estoque insuficiente: ${estoqueId}.`);
      result.push({ ref, estoqueId, quantidadeMili, saldo: snapshot.data().saldoMili });
    }
    return result;
  };
  return {
    ...operacoesTurno(db, operation),
    ...require('./venda-local-v2')(db,operation),
    ...require('./recuperacao-local-v2')(db,operation),
    ...require('./conferencia-pagamento-atendimento-v2')(db,operation),
    consultarMovimentosTurnoV2: operation(async ({ tx, base, uid, data }) => {
      const turno = referenciaTurno(data.turno, uid);
      if (!turno) fail('invalid-argument', 'Informe o turno para conferir.');
      const snapshot = await tx.get(db.collection(`${base}/movimentos_financeiros`).where('turno.chave', '==', turno.chave).limit(501));
      if (snapshot.size > 500) fail('resource-exhausted', 'Turno excede 500 movimentos. A conferência completa exige paginação.');
      return { turno, movimentos: snapshot.docs.map(d => ({ id: d.id, tipo: d.data().tipo, totalCentavos: d.data().totalCentavos, pagamentos: d.data().pagamentos || [], vendaId: d.data().vendaId })) };
    }),
    fecharAtendimentoV2: operation(async ({ tx, base, uid, shop, data }) => {
      const turno = referenciaTurno(data.turno, uid);
      const atendimentoId = id(data.atendimentoId), ref = db.doc(`${base}/atendimentos/${atendimentoId}`), saleRef = db.doc(`${base}/vendas/${atendimentoId}`);
      if (data.confirmado !== true) fail('failed-precondition', 'Confira o recebimento antes de fechar.');
      if (!Array.isArray(data.pagamentos) || data.pagamentos.length > 5) fail('invalid-argument', 'Pagamentos inválidos.');
      const pagamentos = data.pagamentos.map(p => {
        if (!['dinheiro', 'pix_manual', 'cartao_manual'].includes(p.forma)) fail('invalid-argument', 'Forma de pagamento inválida.');
        return { forma: p.forma, valorCentavos: number(p.valorCentavos, 1) };
      });
      const dinheiro = pagamentos.filter(p => p.forma === 'dinheiro').reduce((s, p) => s + p.valorCentavos, 0);
      const recebidoDinheiro = number(data.recebidoDinheiroCentavos ?? dinheiro);
      if (recebidoDinheiro < dinheiro || (!dinheiro && recebidoDinheiro)) fail('failed-precondition', 'Valor recebido em dinheiro inválido.');
      const fingerprint = JSON.stringify({ versao: number(data.versao, 1), pagamentos, recebidoDinheiro, ...(turno ? { turno } : {}) });
      const sale = await tx.get(saleRef);
      if (sale.exists) {
        if (sale.data().fingerprint !== fingerprint) fail('already-exists', 'Esta conta já foi fechada. Confira a venda registrada.');
        return { vendaId: sale.id, status: sale.data().status, totalCentavos: sale.data().totalCentavos, trocoCentavos: sale.data().trocoCentavos, reutilizado: true };
      }
      exigirNovaOperacaoV2(shop);
      const turnState = await lerTurnoOperacao(db, tx, base, uid, shop, turno);
      const account = (await tx.get(ref)).data();
      if (!account || account.status !== 'aberto' || account.versao !== data.versao) fail('failed-precondition', 'A conta mudou. Confira os itens e o total antes de fechar.');
      const taxaEntregaCentavos = account.tipo === 'delivery' ? number(account.taxaEntregaCentavos) : 0;
      if (taxaEntregaCentavos > 100000 || (account.tipo !== 'delivery' && account.taxaEntregaCentavos)) fail('failed-precondition', 'Taxa de entrega incompatível com a conta.');
      const total = number(account.itens.reduce((sum, line) => sum + number(line.totalCentavos), 0) + taxaEntregaCentavos);
      if (total !== account.totalCentavos || pagamentos.reduce((sum, p) => sum + p.valorCentavos, 0) !== total) fail('failed-precondition', 'Pagamentos não correspondem ao total da conta.');
      let mesaRef, mesa;
      if (account.mesaId) {
        mesaRef = db.doc(`${base}/mesas/${account.mesaId}`); mesa = (await tx.get(mesaRef)).data();
        if (!mesa || mesa.atendimentoId !== atendimentoId || (mesa.pendentesRecebimento || 0) !== 0) fail('failed-precondition', 'Mesa possui pedidos pendentes ou vínculo diferente. Aguarde o recebimento.');
        const pending = await tx.get(db.collection(`${base}/pedidos`).where('mesaId', '==', account.mesaId).where('recebidoPdv', '==', false).limit(1));
        if (!pending.empty) fail('failed-precondition', 'Receba ou cancele os pedidos pendentes antes de fechar.');
      }
      const orderIds = [...new Set(account.itens.map(line => id(line.origemPedidoId)))];
      if (orderIds.length > 100) fail('failed-precondition', 'Conta excede 100 pedidos.');
      const orders = [];
      for (const pedidoId of orderIds) {
        const orderRef = db.doc(`${base}/pedidos/${pedidoId}`), order = (await tx.get(orderRef)).data();
        if (!order || order.status === 'cancelado' || order.atendimentoId !== atendimentoId || order.pagamento === 'pago') fail('failed-precondition', 'Pedido incompatível com o fechamento.');
        if (account.tipo === 'delivery' && (order.tipo !== 'delivery' || order.taxaEntregaCentavos !== taxaEntregaCentavos || order.totalCentavos !== total)) fail('failed-precondition', 'Taxa de entrega diverge do pedido recebido.');
        orders.push(orderRef);
      }
      if (account.tipo === 'delivery' && (orderIds.length !== 1 || account.mesaId)) fail('failed-precondition', 'Delivery deve corresponder a um único pedido sem mesa.');
      const stock = await stockFor(tx, base, account.itens);
      const consumos = stock.map(({ estoqueId, quantidadeMili }) => ({ estoqueId, quantidadeMili }));
      registrarMovimentoTurno(tx, turnState, pagamentos, 1);
      const result = { status: 'concluida', atendimentoId, mesaNome: account.mesaNome, itens: account.itens, totalCentavos: total, pagamentos, recebidoDinheiroCentavos: recebidoDinheiro, trocoCentavos: recebidoDinheiro - dinheiro, consumos, fingerprint, terminalUid: uid, criadoEm: stamp() };
      if (account.tipo === 'delivery') Object.assign(result, { tipo: 'delivery', taxaEntregaCentavos });
      tx.create(saleRef, { ...result, turno });
      tx.create(db.doc(`${base}/movimentos_financeiros/${atendimentoId}`), { tipo: 'recebimento_manual', vendaId: atendimentoId, totalCentavos: total, pagamentos, turno, terminalUid: uid, criadoEm: stamp() });
      tx.create(db.doc(`${base}/movimentos_estoque/${atendimentoId}`), { tipo: 'saida_venda', vendaId: atendimentoId, consumos, criadoEm: stamp() });
      stock.forEach(item => tx.update(item.ref, { saldoMili: item.saldo - item.quantidadeMili, atualizadoEm: stamp() }));
      orders.forEach(orderRef => tx.update(orderRef, { pagamento: 'pago', vendaId: atendimentoId, atualizadoEm: stamp() }));
      tx.update(ref, { status: 'fechado', vendaId: atendimentoId, versao: account.versao + 1, atualizadoEm: stamp() });
      if (mesaRef) tx.update(mesaRef, { atendimentoId: FieldValue.delete(), ciclo: (mesa.ciclo || 1) + 1 });
      return { vendaId: atendimentoId, status: 'concluida', totalCentavos: total, trocoCentavos: result.trocoCentavos, reutilizado: false };
    }),
    cancelarPedidoV2: operation(async ({ tx, base, uid, shop, data }) => {
      const pedidoId = id(data.pedidoId), motivo = reason(data.motivo), ref = db.doc(`${base}/pedidos/${pedidoId}`), order = (await tx.get(ref)).data();
      if (!order) fail('not-found', 'Pedido não encontrado.');
      if (order.pagamento === 'pago' || order.pagamento === 'estornado') fail('failed-precondition', 'Pedido com venda registrada. Use o estorno da venda completa.');
      if (order.status === 'cancelado') return { pedidoId, reutilizado: true };
      let accountRef, account, mesaRef, mesa;
      if (order.atendimentoId) {
        accountRef = db.doc(`${base}/atendimentos/${order.atendimentoId}`); account = (await tx.get(accountRef)).data();
        if (!account || account.status !== 'aberto') fail('failed-precondition', 'Conta não está aberta.');
      }
      if (!order.recebidoPdv && order.contadorMesa) { mesaRef = db.doc(`${base}/mesas/${order.mesaId}`); mesa = (await tx.get(mesaRef)).data(); }
      const jobs = await tx.get(db.collection(`${base}/impressoes_cozinha`).where('pedidoId', '==', pedidoId).limit(101));
      if (jobs.size > 100) fail('failed-precondition', 'Muitas vias; confira a fila antes de cancelar.');
      if (accountRef) {
        const itens = account.itens.filter(line => line.origemPedidoId !== pedidoId);
        tx.update(accountRef, { itens, totalCentavos: itens.reduce((sum, line) => sum + line.totalCentavos, 0), ...(account.tipo === 'delivery' ? { taxaEntregaCentavos: 0 } : {}), versao: account.versao + 1, atualizadoEm: stamp() });
      }
      if (mesaRef) tx.update(mesaRef, { pendentesRecebimento: Math.max(0, (mesa?.pendentesRecebimento || 0) - 1) });
      jobs.docs.forEach(job => tx.update(job.ref, { pedidoCancelado: true, ...(job.data().status === 'pendente' ? { status: 'cancelado' } : {}), atualizadoEm: stamp() }));
      tx.update(ref, { status: 'cancelado', recebidoPdv: true, ignoradoPdv: !order.atendimentoId, motivoCancelamento: motivo, canceladoPor: uid, atualizadoEm: stamp() });
      tx.create(db.doc(`${base}/avisos_cozinha/cancelamento-${pedidoId}`), { pedidoId, tipo: 'cancelamento', mesaNome: order.mesaNome || 'Retirada', motivo, status: 'pendente', criadoEm: stamp() });
      if (shop.cozinha?.impressao === true && order.recebidoPdv) tx.create(db.doc(`${base}/impressoes_cozinha/cancel-${pedidoId}`), { pedidoId, tipo: 'cancelamento', motivo, status: 'pendente', via: 1, criadoEm: stamp() });
      return { pedidoId, reutilizado: false };
    }),
    estornarVendaV2: operation(async ({ tx, base, uid, shop, data }) => {
      const turno = referenciaTurno(data.turno, uid);
      const vendaId = id(data.vendaId), motivo = reason(data.motivo);
      if (data.confirmado !== true || typeof data.devolverEstoque !== 'boolean') fail('failed-precondition', 'Confira a devolução do pagamento e a reposição de estoque.');
      const ref = db.doc(`${base}/vendas/${vendaId}`), sale = (await tx.get(ref)).data();
      if (!sale) fail('not-found', 'Venda não encontrada.');
      if (sale.status === 'estornada') {
        if (sale.devolverEstoque !== data.devolverEstoque) fail('already-exists', 'Estorno já registrado com outra decisão de estoque.');
        return { vendaId, reutilizado: true };
      }
      if (sale.status !== 'concluida') fail('failed-precondition', 'Venda não pode ser estornada.');
      const turnState = await lerTurnoOperacao(db, tx, base, uid, shop, turno);
      const stock = [];
      if (data.devolverEstoque) for (const item of sale.consumos) {
        const itemRef = db.doc(`${base}/estoque/${item.estoqueId}`), value = (await tx.get(itemRef)).data();
        if (!value) fail('failed-precondition', 'Insumo não encontrado para devolução.');
        stock.push({ ref: itemRef, saldoMili: number(number(value.saldoMili) + item.quantidadeMili) });
      }
      const orders = [...new Set(sale.itens.map(line => line.origemPedidoId))];
      registrarMovimentoTurno(tx, turnState, sale.pagamentos, -1);
      stock.forEach(item => tx.update(item.ref, { saldoMili: item.saldoMili, atualizadoEm: stamp() }));
      tx.update(ref, { status: 'estornada', motivoEstorno: motivo, devolverEstoque: data.devolverEstoque, turnoEstorno: turno, estornadoPor: uid, estornadoEm: stamp() });
      tx.create(db.doc(`${base}/movimentos_financeiros/estorno-${vendaId}`), { tipo: 'estorno_manual', vendaId, totalCentavos: -sale.totalCentavos, pagamentos: sale.pagamentos, turno, motivo, terminalUid: uid, criadoEm: stamp() });
      tx.create(db.doc(`${base}/movimentos_estoque/estorno-${vendaId}`), { tipo: data.devolverEstoque ? 'devolucao_venda' : 'sem_reposicao', vendaId, consumos: data.devolverEstoque ? sale.consumos : [], criadoEm: stamp() });
      orders.forEach(pedidoId => {
        tx.update(db.doc(`${base}/pedidos/${pedidoId}`), { pagamento: 'estornado', status: 'cancelado', atualizadoEm: stamp() });
        tx.create(db.doc(`${base}/avisos_cozinha/estorno-${pedidoId}`), { pedidoId, tipo: 'estorno', mesaNome: sale.mesaNome || 'Retirada', motivo, status: 'pendente', criadoEm: stamp() });
        if (shop.cozinha?.impressao === true) tx.create(db.doc(`${base}/impressoes_cozinha/estorno-${pedidoId}`), { pedidoId, tipo: 'cancelamento', motivo: `Estorno: ${motivo}`, status: 'pendente', via: 1, criadoEm: stamp() });
      });
      // A mesa liberada não é reaberta; pode já atender outro cliente.
      return { vendaId, reutilizado: false };
    })
  };
};
