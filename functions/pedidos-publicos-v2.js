const { exigirNovaOperacaoV2 } = require('./politica-ativacao-v2');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message) => { throw new HttpsError(code, message); };
function identifier(value, name) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) fail('invalid-argument', `Identificação inválida: ${name}.`);
  return value;
}
function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('invalid-argument', `Valor inválido: ${name}.`);
  return value;
}
function normalize(data) {
  if (!data || !['mesa', 'retirada', 'delivery'].includes(data.tipo)) fail('invalid-argument', 'Informe mesa, retirada ou delivery.');
  const requestId = typeof data.requestId === 'string' && /^[a-zA-Z0-9_-]{20,80}$/.test(data.requestId) ? data.requestId : fail('invalid-argument', 'Identificador de envio inválido.');
  if (!Array.isArray(data.itens) || data.itens.length < 1 || data.itens.length > 30) fail('invalid-argument', 'Pedido deve conter de 1 a 30 linhas.');
  const itens = data.itens.map(item => {
    if (!item || !Array.isArray(item.opcoes) || item.opcoes.length > 20) fail('invalid-argument', 'Opções inválidas.');
    if (item.observacao != null && (typeof item.observacao !== 'string' || item.observacao.length > 180)) fail('invalid-argument', 'Observação deve ter até 180 caracteres.');
    const seen = new Set();
    const opcoes = item.opcoes.map(option => {
      if (!option) fail('invalid-argument', 'Opção inválida.');
      const grupoId = identifier(option.grupoId, 'grupo'), opcaoId = identifier(option.opcaoId, 'opção');
      const key = `${grupoId}/${opcaoId}`;
      if (seen.has(key)) fail('invalid-argument', 'Opção repetida; informe sua quantidade.');
      seen.add(key);
      return { grupoId, opcaoId, quantidade: integer(option.quantidade, 1, 10, 'quantidade da opção') };
    }).sort((a, b) => `${a.grupoId}/${a.opcaoId}`.localeCompare(`${b.grupoId}/${b.opcaoId}`));
    const variante = item.variante || 'individual';
    if (!['individual', 'combo'].includes(variante)) fail('invalid-argument', 'Variante inválida.');
    const oferta = {};
    if (item.variante != null) oferta.variante = variante;
    if (variante === 'combo') oferta.bebidaId = identifier(item.bebidaId, 'bebida');
    if (item.precoEsperadoCentavos != null) oferta.precoEsperadoCentavos = integer(item.precoEsperadoCentavos, 0, 1000000, 'preço conferido');
    return { produtoId: identifier(item.produtoId, 'produto'), quantidade: integer(item.quantidade, 1, 99, 'quantidade'), observacao: (item.observacao || '').trim(), opcoes, ...oferta };
  });
  const entrega = data.tipo === 'delivery' ? require('./delivery-core.cjs').normalizarEntrega(data.entrega) : null;
  const cotacao = entrega ? {
    configuracaoVersao: integer(data.cotacao?.configuracaoVersao, 0, 1000000000, 'versão da entrega'),
    taxaEntregaCentavos: integer(data.cotacao?.taxaEntregaCentavos, 0, 100000, 'taxa conferida'),
    totalCentavos: integer(data.cotacao?.totalCentavos, 0, 1000000, 'total conferido')
  } : null;
  return { requestId, slug: identifier(data.slug, 'loja'), tipo: data.tipo, mesaId: data.tipo === 'mesa' ? identifier(data.mesaId, 'mesa') : null, catalogoVersao: integer(data.catalogoVersao, 1, 1000000000, 'versão do catálogo'), itens,
    ...(entrega ? { entrega, cotacao } : {}) };
}
async function pricedLines(catalog, lines, modulos = {}) {
  const { precoOferta, comporCombo, centavos } = await import('./ofertas-core.mjs');
  const agora = Date.now();
  const money = amount => {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000) fail('failed-precondition', 'Catálogo com preço inválido.');
    return amount;
  };
  return lines.map(line => {
    const product = (catalog.produtos || []).find(p => p.id === line.produtoId);
    if (!product || product.ativo !== true || product.esgotado === true) fail('failed-precondition', 'Produto indisponível. Atualize o cardápio.');
    const groups = product.grupos || [];
    const opcoes = line.opcoes.map(selection => {
      const group = groups.find(g => g.id === selection.grupoId);
      const option = group?.opcoes?.find(o => o.id === selection.opcaoId);
      if (!option || option.ativo !== true || selection.quantidade > (option.maxQuantidade || 1)) fail('failed-precondition', 'Opção indisponível ou quantidade não permitida.');
      return { ...selection, nomeGrupo: group.nome, nome: option.nome, precoCentavos: money(option.precoCentavos) };
    });
    for (const group of groups) {
      if (!Number.isSafeInteger(group.min) || !Number.isSafeInteger(group.max) || group.min < 0 || group.max < group.min) fail('failed-precondition', 'Catálogo com grupo inválido.');
      const count = opcoes.filter(o => o.grupoId === group.id).reduce((sum, o) => sum + o.quantidade, 0);
      if (count < group.min || count > group.max) fail('failed-precondition', 'Selecione a quantidade permitida de opções.');
    }
    const variante = line.variante || 'individual';
    let oferta, componentes = [];
    try {
      const published = { ...product, preco: money(product.precoCentavos) / 100 };
      oferta = precoOferta(published, variante, agora);
      if (variante === 'combo') componentes = comporCombo(published, line.bebidaId, modulos.combos === true);
    } catch (error) { fail('failed-precondition', error.message); }
    const precoBaseCentavos = money(centavos(oferta.preco));
    const precoUnitarioCentavos = precoBaseCentavos + opcoes.reduce((sum, o) => sum + o.precoCentavos * o.quantidade, 0);
    if ((product.ofertasVersao === 1 || product.promocao?.ativa || variante === 'combo' || line.precoEsperadoCentavos != null)
      && line.precoEsperadoCentavos !== precoUnitarioCentavos) fail('failed-precondition', 'O preço mudou. Confira o novo total antes de confirmar o pedido.');
    const result = { linhaId: randomUUID(), produtoId: product.id, nome: product.nome, quantidade: line.quantidade, observacao: line.observacao, opcoes, precoBaseCentavos, precoUnitarioCentavos, totalCentavos: precoUnitarioCentavos * line.quantidade };
    if (product.ofertasVersao === 1 || variante === 'combo' || product.promocao?.ativa) Object.assign(result, {
      ofertasVersao: 1, variante, bebidaId: variante === 'combo' ? line.bebidaId : null,
      componentes, precoNormalCentavos: centavos(oferta.normal), promocaoAplicada: oferta.promocao
    });
    try { require('./composicao-pedido-core.cjs').linhasDeEstoque([result]); }
    catch (error) { fail('failed-precondition', error.message); }
    return result;
  });
}
function publicView(id, order) {
  return { pedidoId: id, status: order.status, pagamento: ['pago', 'estornado'].includes(order.pagamento) ? order.pagamento : 'pendente', tipo: order.tipo, mesaNome: order.mesaNome, totalCentavos: order.totalCentavos,
    ...(order.tipo === 'delivery' ? { subtotalCentavos: order.subtotalCentavos, taxaEntregaCentavos: order.taxaEntregaCentavos, prazoMinutos: order.prazoMinutos } : {}),
    itens: order.itens.map(line => ({ nome: line.nome, quantidade: line.quantidade, precoUnitarioCentavos: line.precoUnitarioCentavos, totalCentavos: line.totalCentavos,
      opcoes: line.opcoes.map(option => ({ nome: option.nome, quantidade: option.quantidade })),
      ...(line.variante === 'combo' ? { variante: 'combo', componentes: line.componentes.map(c => ({ nome: c.nome, quantidade: c.quantidade })) } : {}) })) };
}

module.exports = function pedidosPublicosV2(admin) {
  const db = admin.firestore();
  // Cotação não cria pedido, não reserva estoque e não persiste CEP ou contato.
  const cotarDeliveryPublicoV2 = onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    if (!request.auth) fail('unauthenticated', 'Inicie a sessão do cardápio antes de consultar a entrega.');
    const input = normalize({ ...request.data, tipo: 'retirada', requestId: 'cotacao-delivery-publico-v1' });
    return db.runTransaction(async tx => {
      const route = (await tx.get(db.doc(`rotas_publicas_v2/${input.slug}`))).data();
      if (!route) fail('not-found', 'Cardápio não encontrado.');
      const shop = (await tx.get(db.doc(`lojas_v2/${route.lojaId}`))).data();
      const catalog = (await tx.get(db.doc(`catalogos_publicos_v2/${input.slug}`))).data();
      if (!shop?.ativo || !catalog?.publicado || catalog.pausado === true || shop.modulos?.cardapio !== true || shop.delivery?.ativo !== true) fail('failed-precondition', 'Delivery indisponível nesta loja.');
      exigirNovaOperacaoV2(shop);
      if (catalog.versao !== input.catalogoVersao) fail('failed-precondition', 'O cardápio mudou. Revise os preços antes de consultar.');
      const subtotal = (await pricedLines(catalog, input.itens, shop.modulos)).reduce((sum,line) => sum + line.totalCentavos, 0);
      const cotacao = require('./delivery-core.cjs').cotarDelivery(shop.delivery, request.data?.cep, subtotal);
      return { ...cotacao, catalogoVersao: catalog.versao, configuracaoVersao: shop.configVersao || 0, somenteCotacao: true };
    });
  });
  const criarPedido = garcom => onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    // Sessão anônima do consumidor, sem formulário de login. Vincula reenvios ao remetente.
    if (!request.auth) fail('unauthenticated', 'Inicie a sessão do cardápio antes de pedir.');
    if (garcom) {
      const actor = await admin.auth().getUser(request.auth.uid);
      if (actor.disabled || !actor.email || !actor.emailVerified) fail('permission-denied', 'Garçom precisa de conta ativa e e-mail verificado.');
      if (request.data?.tipo !== 'mesa') fail('invalid-argument', 'Garçom só pode enviar pedidos por mesa.');
    }
    const input = normalize(request.data);
    const fingerprint = digest(JSON.stringify(input));
    const pedidoId = randomUUID(), token = randomBytes(32).toString('base64url');
    return db.runTransaction(async tx => {
      const route = await tx.get(db.doc(`rotas_publicas_v2/${input.slug}`));
      if (!route.exists) fail('not-found', 'Cardápio não encontrado.');
      const lojaId = route.data().lojaId;
      const base = `lojas_v2/${lojaId}`;
      if (garcom) {
        const member = (await tx.get(db.doc(`${base}/membros/${request.auth.uid}`))).data();
        const terminal = await tx.get(db.doc(`terminais_v2/${request.auth.uid}`));
        if (!member?.ativo || member.tipo !== 'usuario' || member.papel !== 'garcom' || terminal.exists) fail('permission-denied', 'Garçom não autorizado nesta loja.');
      }
      const idemRef = db.doc(`${base}/solicitacoes/${digest(`${garcom ? 'garcom:' : ''}${request.auth.uid}:${input.requestId}`)}`);
      const idem = await tx.get(idemRef);
      if (idem.exists) {
        if (idem.data().fingerprint !== fingerprint) fail('already-exists', 'Este envio já foi usado para outro conteúdo.');
        const previous = await tx.get(db.doc(`${base}/pedidos/${idem.data().pedidoId}`));
        if (!previous.exists) fail('internal', 'Pedido registrado não localizado.');
        return { ...publicView(previous.id, previous.data()), acompanhamentoToken: idem.data().token, reutilizado: true };
      }
      const loja = await tx.get(db.doc(base));
      const catalogSnap = await tx.get(db.doc(`catalogos_publicos_v2/${input.slug}`));
      if (!loja.exists || loja.data().ativo !== true || !catalogSnap.exists || (!garcom && (catalogSnap.data().publicado !== true || catalogSnap.data().pausado === true))) fail('failed-precondition', 'A loja não está recebendo pedidos.');
      const catalog = catalogSnap.data();
      exigirNovaOperacaoV2(loja.data());
      const modules = loja.data().modulos;
      if (garcom) {
        if (modules?.garcom !== true) fail('failed-precondition', 'Atendimento por garçom desativado nesta loja.');
      } else if (input.tipo === 'delivery') {
        if (modules?.cardapio !== true || loja.data().delivery?.ativo !== true) fail('failed-precondition', 'Delivery indisponível nesta loja.');
      } else if (modules && (modules.cardapio !== true || (input.tipo === 'mesa' ? modules.mesas !== true : modules.retirada !== true))) fail('failed-precondition', 'Este canal de pedidos está desativado pela loja.');
      if (catalog.versao !== input.catalogoVersao) fail('failed-precondition', 'O cardápio mudou. Revise os preços antes de enviar.');
      let mesaNome = null, mesaRef, mesaData;
      if (input.tipo === 'mesa') {
        mesaRef = db.doc(`${base}/mesas/${input.mesaId}`);
        const mesa = await tx.get(mesaRef);
        if (!mesa.exists || mesa.data().ativo !== true) fail('failed-precondition', 'Mesa indisponível.');
        mesaNome = mesa.data().nome;
        mesaData = mesa.data();
      }
      const itens = await pricedLines(catalog, input.itens, modules);
      const subtotalCentavos = itens.reduce((sum, line) => sum + line.totalCentavos, 0);
      let cotacao = null;
      if (input.tipo === 'delivery') {
        if (input.cotacao.configuracaoVersao !== (loja.data().configVersao || 0)) fail('failed-precondition', 'A configuração da entrega mudou. Consulte a taxa novamente.');
        cotacao = require('./delivery-core.cjs').cotarDelivery(loja.data().delivery, input.entrega.cep, subtotalCentavos);
        if (cotacao.taxaEntregaCentavos !== input.cotacao.taxaEntregaCentavos || cotacao.totalCentavos !== input.cotacao.totalCentavos) fail('failed-precondition', 'O total da entrega mudou. Confira a cotação antes de enviar.');
      }
      const totalCentavos = cotacao ? cotacao.totalCentavos : subtotalCentavos;
      if (!Number.isSafeInteger(totalCentavos) || totalCentavos > 1000000) fail('invalid-argument', 'Pedido excede o limite permitido.');
      const minute = Math.floor(Date.now() / 60000);
      const limits = [
        { ref: db.doc(`limites_pedidos_v2/${digest(`${lojaId}:${request.auth.uid}:${minute}`)}`), max: garcom ? 60 : 5 },
        { ref: db.doc(`limites_pedidos_v2/${digest(`${lojaId}:${minute}`)}`), max: 120 }
      ];
      for (const limit of limits) {
        const snap = await tx.get(limit.ref); limit.count = snap.exists ? snap.data().contagem : 0;
        if (limit.count >= limit.max) fail('resource-exhausted', 'Muitos pedidos neste momento. Aguarde e tente novamente.');
      }
      const order = { status: 'novo', recebidoPdv: false, tipo: input.tipo, mesaId: input.mesaId, mesaNome, itens, totalCentavos, catalogoVersao: catalog.versao, pagamento: 'pendente', origem: 'cardapio_v2', criadoEm: FieldValue.serverTimestamp(), atualizadoEm: FieldValue.serverTimestamp() };
      if (garcom) Object.assign(order, { origem: 'garcom_v2', garcomUid: request.auth.uid });
      if (cotacao) Object.assign(order, { subtotalCentavos, taxaEntregaCentavos: cotacao.taxaEntregaCentavos, prazoMinutos: cotacao.prazoMinutos, configuracaoVersao: input.cotacao.configuracaoVersao });
      const expires = Timestamp.fromMillis(Date.now() + 7 * 86400000);
      if (mesaRef) {
        order.mesaCiclo = mesaData.ciclo || 1;
        order.contadorMesa = true;
        tx.update(mesaRef, { pendentesRecebimento: (mesaData.pendentesRecebimento || 0) + 1 });
      }
      tx.create(db.doc(`${base}/pedidos/${pedidoId}`), order);
      if (input.entrega) tx.create(db.doc(`${base}/dados_entrega/${pedidoId}`), { ...input.entrega, criadoEm: FieldValue.serverTimestamp() });
      tx.create(db.doc(`acompanhamentos_v2/${digest(token)}`), { lojaId, pedidoId, expiraEm: expires });
      // Segredo recuperável só pelo servidor e pela mesma sessão de envio; nunca público no Firestore.
      tx.create(idemRef, { fingerprint, pedidoId, token, criadoEm: FieldValue.serverTimestamp() });
      for (const limit of limits) tx.set(limit.ref, { contagem: limit.count + 1, expiraEm: Timestamp.fromMillis(Date.now() + 86400000) });
      return { ...publicView(pedidoId, order), acompanhamentoToken: token, reutilizado: false };
    });
  });
  const acompanharPedidoPublicoV2 = onCall({ cors: true, minInstances: 0, maxInstances: 1, invoker: 'public' }, async request => {
    const token = request.data?.token;
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) fail('not-found', 'Acompanhamento indisponível.');
    return db.runTransaction(async tx => {
      const access = await tx.get(db.doc(`acompanhamentos_v2/${digest(token)}`));
      if (!access.exists || access.data().expiraEm.toMillis() <= Date.now()) fail('not-found', 'Acompanhamento indisponível.');
      const order = await tx.get(db.doc(`lojas_v2/${access.data().lojaId}/pedidos/${access.data().pedidoId}`));
      if (!order.exists) fail('not-found', 'Acompanhamento indisponível.');
      return publicView(order.id, order.data());
    });
  });
  return { criarPedidoPublicoV2: criarPedido(false), criarPedidoGarcomV2: criarPedido(true), acompanharPedidoPublicoV2, cotarDeliveryPublicoV2 };
};
