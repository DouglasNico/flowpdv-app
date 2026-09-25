const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const { planejarSaldoLegado } = require('./estoque-migracao-core.cjs');
const { normalizarApresentacao, validarTamanhoCatalogo } = require('./catalogo-apresentacao-core.cjs');
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) fail('invalid-argument', 'Identificação inválida.');
  return value;
};
const name = value => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) fail('invalid-argument', 'Informe um nome de até 80 caracteres.');
  return value.trim();
};
const integer = (value, min = 0, max = 1000000000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('invalid-argument', 'Valor inválido.');
  return value;
};
const bool = value => { if (typeof value !== 'boolean') fail('invalid-argument', 'Selecione ativado ou desativado.'); return value; };
module.exports = admin => {
  const db = admin.firestore(), stamp = () => FieldValue.serverTimestamp();
  const call = (action, options = {}) => onCall({ cors: true, ...options }, async request => {
    if (!request.auth) fail('unauthenticated', 'Entre como gerente no painel de acesso.');
    const actor = await admin.auth().getUser(request.auth.uid);
    if (actor.disabled || !actor.email || !actor.emailVerified) fail('permission-denied', 'Gerência com e-mail verificado necessária.');
    const isAdmin = actor.customClaims?.admin === true && request.auth.token.admin === true;
    const data = request.data || {}, entradaId = id(data.lojaId);
    return db.runTransaction(async tx => {
      let lojaId = entradaId, base = `lojas_v2/${lojaId}`, shopRef = db.doc(base);
      let shopSnap = await tx.get(shopRef);
      if (!shopSnap.exists) {
        const rota = (await tx.get(db.doc(`rotas_publicas_v2/${entradaId}`))).data();
        if (rota?.lojaId) {
          lojaId = rota.lojaId;
          base = `lojas_v2/${lojaId}`;
          shopRef = db.doc(base);
          shopSnap = await tx.get(shopRef);
        }
      }
      const shop = shopSnap.data();
      const member = (await tx.get(db.doc(`${base}/membros/${actor.uid}`))).data();
      if (!isAdmin && (!member?.ativo || member.papel !== 'gerente' || member.tipo !== 'usuario')) fail('permission-denied', 'Você não administra esta loja.');
      if (!shop?.ativo) fail('failed-precondition', 'Loja indisponível.');
      const slug = id(data.slug || shop.slug);
      if ((await tx.get(db.doc(`rotas_publicas_v2/${slug}`))).data()?.lojaId !== lojaId) fail('permission-denied', 'Endereço público não pertence à loja.');
      const catalogRef = db.doc(`catalogos_publicos_v2/${slug}`), catalog = (await tx.get(catalogRef)).data() || { produtos: [], versao: 0, publicado: false };
      const version = shop.configVersao || 0;
      const finish = (acao, alvo, shopPatch = {}) => {
        tx.update(shopRef, { ...shopPatch, slug, configVersao: version + 1, configuradoEm: stamp() });
        tx.create(db.collection('auditoria_configuracao_v2').doc(), { lojaId, atorUid: actor.uid, acao, alvo, criadoEm: stamp() });
        return { versao: version + 1, lojaId, slug };
      };
      const fresh = () => { if (data.versao !== version) fail('failed-precondition', 'A configuração mudou. Recarregue antes de salvar.'); };
      return action({ tx, data, shop, base, lojaId, slug, catalogRef, catalog, finish, fresh, uid: actor.uid, version });
    });
  });
  const rows = snapshot => snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
  return {
    assinarFotoCardapioV2: call(async ({ data, base, catalog, fresh }) => {
      fresh(); const produtoId = id(data.produtoId);
      if (!catalog.produtos.some(p => p.id === produtoId)) fail('not-found', 'Salve o produto antes de enviar uma foto.');
      try {
        return require('./upload-cardapio-v2-core.cjs').assinaturaUploadV2({ lojaId: base.split('/')[1], produtoId, cloudName: process.env.CLOUDINARY_V2_CLOUD_NAME, apiKey: process.env.CLOUDINARY_V2_API_KEY, secret: process.env.CLOUDINARY_V2_API_SECRET });
      } catch { fail('failed-precondition', 'Upload V2 não configurado no servidor. Use uma foto já hospedada enquanto a integração é preparada.'); }
    }, { secrets: ['CLOUDINARY_V2_API_SECRET'] }),
    salvarContatoLojaV2: call(async ({ tx, data, catalogRef, catalog, fresh, finish }) => {
      fresh();
      const contato = data.contato;
      if (!contato || typeof contato.telefone !== 'string' || typeof contato.endereco !== 'string') fail('invalid-argument', 'Informe telefone e endereço comercial.');
      if (contato.telefone.length > 25 || !/^[+\d\s().-]*$/.test(contato.telefone)) fail('invalid-argument', 'Telefone inválido.');
      const telefone = contato.telefone.replace(/\D/g, ''), endereco = contato.endereco.trim();
      if (telefone && !/^\d{10,15}$/.test(telefone)) fail('invalid-argument', 'Informe o telefone com DDD, entre 10 e 15 dígitos.');
      if (endereco.length > 200 || /[\x00-\x1f\x7f]/.test(endereco)) fail('invalid-argument', 'Endereço comercial deve ter até 200 caracteres, sem quebras de linha.');
      const value = { telefone, endereco };
      tx.set(catalogRef, { ...catalog, contato: value, versao: (catalog.versao || 0) + 1 });
      return finish('contato', 'loja', { contato: value });
    }),
    listarPedidosGestaoV2: call(async ({ tx, data, base }) => {
      let query = db.collection(`${base}/pedidos`).orderBy('criadoEm', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(26);
      if (data.apos != null) {
        const cursor = await tx.get(db.doc(`${base}/pedidos/${id(data.apos)}`));
        if (!cursor.exists || !cursor.data().criadoEm) fail('failed-precondition', 'O pedido de referência mudou. Atualize a lista.');
        query = query.startAfter(cursor);
      }
      const snapshot = await tx.get(query), page = snapshot.docs.slice(0, 25);
      return { pedidos: page.map(doc => {
        const p = doc.data();
        return {
          id: doc.id,
          tipo: p.tipo || '',
          mesaNome: p.mesaNome || '',
          status: p.status || '',
          pagamento: p.pagamento || 'pendente',
          recebidoPdv: p.recebidoPdv === true,
          totalCentavos: p.totalCentavos,
          subtotalCentavos: p.subtotalCentavos || p.totalCentavos,
          taxaEntregaCentavos: p.taxaEntregaCentavos || 0,
          contato: p.contato || null,
          criadoEm: p.criadoEm?.toDate?.().toISOString() || null,
          itens: (Array.isArray(p.itens) ? p.itens : []).map(item => ({
            nome: item.nome || '',
            quantidade: item.quantidade,
            totalCentavos: item.totalCentavos,
            observacao: item.observacao || '',
            opcoes: item.opcoes || []
          }))
        };
      }), proximo: snapshot.size > 25 ? page.at(-1).id : null };
    }),
    atualizarStatusPedidoGestaoV2: call(async ({ tx, data, base }) => {
      const pedidoId = id(data.pedidoId);
      const novoStatus = String(data.status || '').trim();
      const estadosValidos = ['novo', 'em_preparo', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'];
      if (!estadosValidos.includes(novoStatus)) fail('invalid-argument', 'Status de pedido inválido.');
      const ref = db.doc(`${base}/pedidos/${pedidoId}`);
      const order = await tx.get(ref);
      if (!order.exists) fail('not-found', 'Pedido não encontrado.');
      const atual = order.data();
      if (atual.status === 'cancelado' && novoStatus !== 'cancelado') {
        fail('failed-precondition', 'Pedido cancelado não pode ser reativado.');
      }
      const patch = { status: novoStatus, atualizadoEm: FieldValue.serverTimestamp() };
      if (data.pagamento && ['pago', 'pendente', 'estornado'].includes(data.pagamento)) {
        patch.pagamento = data.pagamento;
      }
      tx.update(ref, patch);
      return { ok: true, pedidoId, status: novoStatus };
    }),
    listarMesasConfiguracaoV2: call(async ({tx,data,base,version,fresh}) => {
      fresh();
      const apos=id(data.apos);
      const snapshot=await tx.get(db.collection(`${base}/mesas`).orderBy(FieldPath.documentId()).startAfter(apos).limit(201));
      return {versao:version,mesas:rows(snapshot).slice(0,200),proximaMesa:snapshot.size>200?snapshot.docs[199].id:null};
    }),
    publicarCatalogoV2: call(async ({tx,data,shop,catalog,catalogRef,fresh,finish}) => {
      fresh(); const publicado=bool(data.publicado);
      if(publicado && (shop.modulos?.cardapio!==true || !catalog.produtos.some(p=>p.ativo&&!p.esgotado))) fail('failed-precondition','Ative o cardápio e tenha pelo menos um produto disponível antes de publicar.');
      try{validarTamanhoCatalogo(catalog);}catch(e){fail('resource-exhausted',e.message);}
      tx.update(catalogRef,{publicado,publicacaoManual:true,versao:(catalog.versao||0)+1});
      return finish('publicacao_catalogo',publicado?'publicar':'retirar');
    }),
    salvarGarcomV2: call(async ({ tx, data, base, fresh, finish }) => {
      fresh(); const uid = id(data.uid), ativo = bool(data.ativo);
      const memberRef = db.doc(`${base}/membros/${uid}`), previous = (await tx.get(memberRef)).data();
      if ((await tx.get(db.doc(`terminais_v2/${uid}`))).exists || (previous && (previous.tipo !== 'usuario' || previous.papel !== 'garcom'))) fail('failed-precondition', 'Identidade já possui outro papel.');
      if (ativo) {
        const account = await admin.auth().getUser(uid);
        if (account.disabled || !account.email || !account.emailVerified) fail('failed-precondition', 'Garçom precisa de conta ativa e e-mail verificado.');
      } else if (!previous) fail('not-found', 'Garçom não cadastrado nesta loja.');
      tx.set(memberRef, { papel: 'garcom', tipo: 'usuario', ativo, atualizadoEm: stamp() });
      return finish('garcom', uid);
    }),
    salvarConfiguracaoDeliveryV2: call(async ({ tx, data, shop, catalogRef, catalog, fresh, finish }) => {
      fresh();
      const delivery = require('./delivery-core.cjs').normalizarDelivery(data.delivery);
      tx.set(catalogRef, { ...catalog, canais: { mesas: shop.modulos?.mesas ?? true, retirada: shop.modulos?.retirada ?? true, delivery: delivery.ativo } }, { merge: true });
      return finish('delivery', 'regioes', { delivery });
    }),
    migrarSaldoLegadoV2: call(async ({tx,data,base,uid,fresh,finish,version})=>{
      if(data.confirmado!==true) fail('failed-precondition','Confira o saldo e a unidade antes de migrar.');
      let plano;try{plano=planejarSaldoLegado(data.produto);}catch(e){fail('invalid-argument',e.message);}
      const hash=createHash('sha256').update(plano.legadoId).digest('hex'),estoqueId=`legado-${hash.slice(0,32)}`;
      const ref=db.doc(`${base}/migracoes_estoque/${hash}`),stockRef=db.doc(`${base}/estoque/${estoqueId}`),movRef=db.doc(`${base}/movimentos_estoque/migracao-${hash}`);
      const old=(await tx.get(ref)).data(),stock=(await tx.get(stockRef)).data(),mov=await tx.get(movRef);
      const fingerprint=JSON.stringify(plano);
      if(old){if(old.fingerprint!==fingerprint||!stock||!mov.exists) fail('failed-precondition','Migração existente diverge do saldo solicitado. Não reaplique o saldo inicial.');return {versao:version,estoqueId,plano:old.plano,reutilizado:true};}
      fresh();if(stock||mov.exists) fail('failed-precondition','Destino já possui estoque ou movimento. Confira antes de migrar.');
      const count=await tx.get(db.collection(`${base}/estoque`).limit(200));if(count.size>=200) fail('resource-exhausted','Limite de 200 insumos atingido.');
      tx.create(stockRef,{nome:plano.nome,unidade:plano.unidade,saldoMili:plano.saldoMili,legadoId:plano.legadoId,atualizadoEm:stamp()});
      tx.create(ref,{plano,fingerprint,estoqueId,atorUid:uid,criadoEm:stamp()});
      tx.create(movRef,{tipo:'saldo_inicial_legado',estoqueId,deltaMili:plano.saldoMili,atorUid:uid,criadoEm:stamp()});
      return {...finish('migracao_estoque',estoqueId),estoqueId,plano,reutilizado:false};
    }),
    consultarConfiguracaoV2: call(async ({ tx, base, shop, catalog, slug, version, lojaId }) => {
      const snapshots = await Promise.all(['mesas', 'estoque', 'fichas_estoque', 'membros'].map(c => tx.get(db.collection(`${base}/${c}`).orderBy(FieldPath.documentId()).limit(201))));
      if (snapshots.slice(1).some(s => s.size > 200)) fail('resource-exhausted', 'Este painel atende até 200 insumos, fichas ou membros por seção.');
      return { lojaId: lojaId || base.split('/')[1], ativacaoOperacionalV2: shop.ativacaoOperacionalV2 ?? null, ativacaoDefinida: Object.prototype.hasOwnProperty.call(shop, 'ativacaoOperacionalV2'), versao: version, slug, nome: shop.nome, contato: shop.contato || { telefone: '', endereco: '' }, segmento: shop.segmento || 'lanchonete', modulos: shop.modulos || { cardapio: catalog.publicado === true, mesas: true, retirada: true }, cozinha: shop.cozinha || { impressao: false, kds: false, papelMm: 80 }, catalogo: catalog,
        delivery: shop.delivery || { ativo: false, pedidoMinimoCentavos: 0, regioes: [] },
        garcons: rows(snapshots[3]).filter(m => m.tipo === 'usuario' && m.papel === 'garcom').map(m => ({ uid: m.id, ativo: m.ativo === true })),
        mesas: rows(snapshots[0]).slice(0,200), proximaMesa:snapshots[0].size>200?snapshots[0].docs[199].id:null, estoque: rows(snapshots[1]), fichas: rows(snapshots[2]), terminais: rows(snapshots[3]).filter(m => m.tipo === 'terminal' && m.ativo).map(m => ({ uid: m.id, papel: m.papel })) };
    }),
    salvarModulosV2: call(async ({ tx, data, shop, base, catalog, catalogRef, fresh, finish }) => {
      fresh();
      if (!['lanchonete', 'restaurante', 'adega', 'mercado', 'padaria', 'roupas', 'outro'].includes(data.segmento)) fail('invalid-argument', 'Segmento inválido.');
      const modulos = { cardapio: bool(data.modulos?.cardapio), mesas: bool(data.modulos?.mesas), retirada: bool(data.modulos?.retirada) };
      // A gerência preserva a concessão administrativa; não habilita Combos pelo payload.
      if (Object.hasOwn(shop.modulos || {}, 'combos')) modulos.combos = shop.modulos.combos === true;
      modulos.garcom = data.modulos?.garcom === undefined ? shop.modulos?.garcom === true : bool(data.modulos.garcom);
      const cozinha = { impressao: bool(data.cozinha?.impressao), kds: bool(data.cozinha?.kds), papelMm: integer(data.cozinha?.papelMm, 58, 80), impressora: typeof data.cozinha?.impressora === 'string' ? data.cozinha.impressora.trim() : '', terminalUid: data.cozinha?.terminalUid || '' };
      if (![58, 80].includes(cozinha.papelMm) || cozinha.impressora.length > 160) fail('invalid-argument', 'Configuração da impressora inválida.');
      if (modulos.cardapio && !modulos.mesas && !modulos.retirada && !shop.delivery?.ativo) fail('failed-precondition', 'Ative mesas, retirada ou delivery para receber pelo cardápio.');
      if (cozinha.impressao) {
        if (!cozinha.impressora || !cozinha.terminalUid) fail('failed-precondition', 'Escolha a impressora e o terminal responsável.');
        const terminal = (await tx.get(db.doc(`terminais_v2/${id(cozinha.terminalUid)}`))).data();
        const member = (await tx.get(db.doc(`${base}/membros/${cozinha.terminalUid}`))).data();
        if (!terminal?.ativo || terminal.lojaId !== base.split('/')[1] || !member?.ativo || member.tipo !== 'terminal' || !['caixa', 'cozinha'].includes(member.papel)) fail('failed-precondition', 'Terminal de impressão não está autorizado nesta loja.');
      }
      // Pausar entrada nunca impede o caixa de liquidar pedidos já aceitos.
      tx.set(catalogRef, { ...catalog, publicado: catalog.publicado === true, publicacaoManual: true, pausado: !modulos.cardapio, canais: { mesas: modulos.mesas, retirada: modulos.retirada, delivery: shop.delivery?.ativo === true }, versao: (catalog.versao || 0) + 1 }, { merge: true });
      return finish('modulos', data.segmento, { segmento: data.segmento, modulos, cozinha });
    }),
    salvarMesaV2: call(async ({ tx, data, base, fresh, finish }) => {
      fresh(); const mesaId = id(data.mesaId), ref = db.doc(`${base}/mesas/${mesaId}`), old = (await tx.get(ref)).data();
      const nome = name(data.nome), ativo = bool(data.ativo), comandaPdvId = `MESA-${integer(data.numero, 1, 9999)}`;
      const duplicates = await tx.get(db.collection(`${base}/mesas`).where('comandaPdvId', '==', comandaPdvId).limit(2));
      if (duplicates.docs.some(d => d.id !== mesaId)) fail('already-exists', 'Essa mesa do PDV já está vinculada a outro QR Code.');
      if (old && (old.comandaPdvId !== comandaPdvId || !ativo)) {
        const pending = await tx.get(db.collection(`${base}/pedidos`).where('mesaId', '==', mesaId).where('recebidoPdv', '==', false).limit(1));
        if (old.atendimentoId || old.pendentesRecebimento || !pending.empty) fail('failed-precondition', 'Encerre a conta e resolva os pedidos pendentes antes de mudar o vínculo ou desativar a mesa.');
      }
      tx.set(ref, { nome, ativo, comandaPdvId }, { merge: true });
      return finish('mesa', mesaId);
    }),
    salvarProdutoCardapioV2: call(async ({ tx, data, shop, catalogRef, catalog, fresh, finish }) => {
      fresh(); const productId = id(data.produtoId), products = [...catalog.produtos], index = products.findIndex(p => p.id === productId), old = products[index];
      if (index < 0 && products.length >= 200) fail('resource-exhausted', 'Limite de 200 produtos no piloto.');
      const product = { ...(old || { id: productId, grupos: [] }), nome: name(data.nome), precoCentavos: integer(data.precoCentavos, 0, 1000000), ativo: bool(data.ativo), esgotado: bool(data.esgotado) };
      try{Object.assign(product,normalizarApresentacao(data,old));}catch(e){fail('invalid-argument',e.message);}
      if (index < 0) products.push(product); else products[index] = product;
      const enabled = shop.modulos?.cardapio ?? catalog.publicado;
      const updated={ ...catalog, produtos: products, versao: (catalog.versao || 0) + 1, publicado: catalog.publicado === true, publicacaoManual: true, pausado: enabled !== true };
      try{validarTamanhoCatalogo(updated);}catch(e){fail('resource-exhausted',e.message);}
      tx.set(catalogRef,updated);
      return finish('produto', productId);
    }),
    salvarOpcaoCardapioV2: call(async ({ tx, data, catalog, catalogRef, fresh, finish }) => {
      fresh(); const produtoId = id(data.produtoId), grupoId = id(data.grupoId), opcaoId = id(data.opcaoId);
      const products = structuredClone(catalog.produtos), product = products.find(p => p.id === produtoId);
      if (!product) fail('not-found', 'Cadastre o produto primeiro.');
      let group = product.grupos.find(g => g.id === grupoId);
      if (!group) { if (product.grupos.length >= 10) fail('resource-exhausted', 'Limite de grupos atingido.'); group = { id: grupoId, opcoes: [] }; product.grupos.push(group); }
      Object.assign(group, { nome: name(data.nomeGrupo), min: integer(data.min, 0, 20), max: integer(data.max, 1, 20) });
      if (group.min > group.max) fail('invalid-argument', 'Mínimo não pode ultrapassar o máximo.');
      const option = { id: opcaoId, nome: name(data.nome), ativo: bool(data.ativo), precoCentavos: integer(data.precoCentavos, 0, 1000000), maxQuantidade: integer(data.maxQuantidade, 1, 10) };
      const index = group.opcoes.findIndex(o => o.id === opcaoId);
      if (index < 0) { if (group.opcoes.length >= 20) fail('resource-exhausted', 'Limite de opções atingido.'); group.opcoes.push(option); } else group.opcoes[index] = option;
      try{validarTamanhoCatalogo({...catalog,produtos:products});}catch(e){fail('resource-exhausted',e.message);}
      tx.update(catalogRef, { produtos: products, versao: catalog.versao + 1 }); return finish('opcao', `${produtoId}/${grupoId}/${opcaoId}`);
    }),
    salvarFichaEstoqueV2: call(async ({ tx, data, base, catalog, fresh, finish }) => {
      fresh(); const produtoId = id(data.produtoId), product = catalog.produtos.find(p => p.id === produtoId);
      if (!product) fail('not-found', 'Produto do cardápio não encontrado.');
      const semEstoque = bool(data.semEstoque), ref = db.doc(`${base}/fichas_estoque/${produtoId}`), old = (await tx.get(ref)).data() || { consumos: [], opcoes: [] };
      const consumos = data.consumos;
      if (!Array.isArray(consumos) || consumos.length > 20) fail('invalid-argument', 'Consumos inválidos.');
      for (const item of consumos) {
        id(item.estoqueId); integer(item.quantidadeMili, 1);
        if (!(await tx.get(db.doc(`${base}/estoque/${item.estoqueId}`))).exists) fail('failed-precondition', 'Cadastre o insumo antes de vincular.');
      }
      const values = consumos.map(i => ({ estoqueId: i.estoqueId, quantidadeMili: i.quantidadeMili }));
      if (new Set(values.map(i => i.estoqueId)).size !== values.length) fail('invalid-argument', 'Insumo repetido na ficha.');
      const ficha = { ...old, semEstoque };
      if (data.grupoId || data.opcaoId) {
        const grupoId = id(data.grupoId), opcaoId = id(data.opcaoId);
        if (semEstoque || !product.grupos.find(g => g.id === grupoId)?.opcoes.some(o => o.id === opcaoId)) fail('failed-precondition', 'Opção inválida para esta ficha.');
        ficha.opcoes = [...(old.opcoes || []).filter(o => o.grupoId !== grupoId || o.opcaoId !== opcaoId), { grupoId, opcaoId, consumos: values }];
      } else ficha.consumos = values;
      tx.set(ref, ficha); return finish('ficha_estoque', produtoId);
    }),
    ajustarEstoqueV2: call(async ({ tx, data, base, uid, fresh, finish }) => {
      const estoqueId = id(data.estoqueId), requestId = id(data.requestId), deltaMili = integer(data.deltaMili, -1000000000), motivo = name(data.motivo), nome = name(data.nome);
      if (!['un', 'kg', 'litro'].includes(data.unidade)) fail('invalid-argument', 'Unidade inválida.');
      const fingerprint = JSON.stringify({ estoqueId, deltaMili, motivo, nome, unidade: data.unidade });
      const adjustmentRef = db.doc(`${base}/movimentos_estoque/ajuste-${createHash('sha256').update(`${uid}:${requestId}`).digest('hex')}`), previous = await tx.get(adjustmentRef);
      if (previous.exists) { if (previous.data().fingerprint !== fingerprint) fail('already-exists', 'Identificador já utilizado para outro ajuste.'); return { reutilizado: true }; }
      fresh(); const ref = db.doc(`${base}/estoque/${estoqueId}`), old = (await tx.get(ref)).data();
      if (old && old.unidade !== data.unidade) fail('failed-precondition', 'Não altere a unidade de um insumo existente.');
      const saldoMili = integer((old?.saldoMili || 0) + deltaMili);
      tx.set(ref, { nome, unidade: data.unidade, saldoMili, atualizadoEm: stamp() });
      tx.create(adjustmentRef, { tipo: 'ajuste_manual', estoqueId, deltaMili, motivo, fingerprint, atorUid: uid, criadoEm: stamp() });
      return { ...finish('estoque', estoqueId), reutilizado: false };
    })
  };
};
