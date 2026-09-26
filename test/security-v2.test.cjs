// Requer emuladores; jamais usa credenciais ou projeto real.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const toolsRequire = createRequire(path.resolve(__dirname, '../../output/local-tools/package.json'));
const { initializeTestEnvironment, assertSucceeds, assertFails } = toolsRequire('@firebase/rules-unit-testing');
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } = toolsRequire('firebase/firestore');
let env;
const pedido = (db, loja = 'loja-a', id = 'pedido-1') => doc(db, 'lojas_v2', loja, 'pedidos', id);
const user = (uid, claims = {}) => env.authenticatedContext(uid, { email_verified: true, ...claims }).firestore();
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  assert.ok(['127.0.0.1:8080','127.0.0.1:8180'].includes(process.env.FIRESTORE_EMULATOR_HOST));
  env = await initializeTestEnvironment({ projectId: 'demo-flowpdv', firestore: { host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]), rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const loja of ['loja-a', 'loja-b']) {
      await setDoc(doc(db, 'lojas_v2', loja), { nome: `Fictícia ${loja}`, ativo: true });
      for (const papel of ['gerente', 'caixa', 'cozinha']) await setDoc(doc(db, 'lojas_v2', loja, 'membros', `${loja}-${papel}`), { papel, tipo: 'usuario', ativo: true });
      for (const id of ['pedido-1', 'cancelar', 'preparo']) await setDoc(pedido(db, loja, id), { status: 'novo', total: 15, itens: [{ nome: 'Lanche fictício', quantidade: 1 }], atualizadoEm: serverTimestamp() });
      await setDoc(doc(db, 'lojas_v2', loja, 'dados_entrega', 'pedido-1'), { endereco: 'Endereço fictício' });
    }
    await setDoc(doc(db, 'lojas_v2/loja-a/membros/revogado'), { papel: 'gerente', ativo: false });
    await setDoc(doc(db, 'catalogos_publicos_v2/lanchonete-a'), { publicado: true, nome: 'Lanchonete fictícia', produtos: [] });
    await setDoc(doc(db, 'catalogos_publicos_v2/rascunho'), { publicado: false });
    await setDoc(doc(db, 'rotas_publicas_v2/lanchonete-a'), { lojaId: 'loja-a' });
  });
});
after(async () => { if (env) await env.cleanup(); });

test('anônimo lê catálogo publicado, mas não lista catálogos ou lê rascunho', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'catalogos_publicos_v2/lanchonete-a')));
  await assertFails(getDocs(collection(db, 'catalogos_publicos_v2')));
  await assertFails(getDoc(doc(db, 'catalogos_publicos_v2/rascunho')));
});
test('slug não dá acesso à rota privada nem ao pedido', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'rotas_publicas_v2/lanchonete-a')));
  await assertFails(getDoc(pedido(db)));
  await assertFails(setDoc(pedido(db, 'loja-a', 'injetado'), { status: 'novo' }));
});
test('cada loja lê seus pedidos e não lê/lista os da outra', async () => {
  for (const [own, other] of [['loja-a', 'loja-b'], ['loja-b', 'loja-a']]) {
    const db = user(`${own}-caixa`);
    await assertSucceeds(getDoc(pedido(db, own)));
    await assertSucceeds(getDocs(collection(db, 'lojas_v2', own, 'pedidos')));
    await assertFails(getDoc(pedido(db, other)));
    await assertFails(getDocs(collection(db, 'lojas_v2', other, 'pedidos')));
    await assertFails(updateDoc(pedido(db, other), { status: 'em_preparo', atualizadoEm: serverTimestamp() }));
  }
});
test('membro revogado, desconhecido e email legado de admin não acessam V2', async () => {
  for (const db of [user('revogado'), user('desconhecido'), user('falso-admin', { email: 'admin@flowpdv.com.br' }), user('legado', { email: 'loja_loja-a@pdv.flowpdv.com.br' })]) await assertFails(getDoc(pedido(db)));
});
test('preparo exige API; escrita direta não pula, avança ou reabre estados', async () => {
  const ref = pedido(user('loja-a-cozinha'), 'loja-a', 'preparo');
  await assertFails(updateDoc(ref, { status: 'entregue', atualizadoEm: serverTimestamp() }));
  for (const status of ['em_preparo', 'pronto', 'entregue']) await assertFails(updateDoc(ref, { status, atualizadoEm: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'novo', atualizadoEm: serverTimestamp() }));
});
test('cozinha não acessa endereço; caixa acessa só o da sua loja', async () => {
  await assertFails(getDoc(doc(user('loja-a-cozinha'), 'lojas_v2/loja-a/dados_entrega/pedido-1')));
  await assertSucceeds(getDoc(doc(user('loja-a-caixa'), 'lojas_v2/loja-a/dados_entrega/pedido-1')));
  await assertFails(getDoc(doc(user('loja-a-caixa'), 'lojas_v2/loja-b/dados_entrega/pedido-1')));
});
test('cancelamento exige API inclusive para caixa; escrita direta não reabre pedido', async () => {
  const payload = { status: 'cancelado', atualizadoEm: serverTimestamp() };
  await assertFails(updateDoc(pedido(user('loja-a-cozinha'), 'loja-a', 'cancelar'), payload));
  const ref = pedido(user('loja-a-caixa'), 'loja-a', 'cancelar');
  await assertFails(updateDoc(ref, payload));
  await assertFails(updateDoc(ref, { status: 'em_preparo', atualizadoEm: serverTimestamp() }));
});
test('operador não altera total, pagamento, itens ou identidade do pedido', async () => {
  const ref = pedido(user('loja-a-gerente'));
  for (const alteration of [{ total: 0 }, { pago: true }, { itens: [] }, { lojaId: 'loja-b' }]) await assertFails(updateDoc(ref, { ...alteration, status: 'em_preparo', atualizadoEm: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'em_preparo', atualizadoEm: 'data-inventada' }));
  await assertFails(deleteDoc(ref));
});
test('cliente não cria vínculo, eleva papel ou publica catálogo', async () => {
  const db = user('loja-a-caixa');
  await assertFails(updateDoc(doc(db, 'lojas_v2/loja-a/membros/loja-a-caixa'), { papel: 'gerente' }));
  await assertFails(setDoc(doc(db, 'lojas_v2/loja-b/membros/loja-a-caixa'), { papel: 'gerente', ativo: true }));
  await assertFails(setDoc(doc(db, 'catalogos_publicos_v2/injetado'), { publicado: true }));
});
test('admin por claim acessa lojas; claim do cliente não substitui vínculo', async () => {
  const db = user('admin-servidor', { admin: true });
  await assertSucceeds(getDoc(pedido(db, 'loja-a')));
  await assertSucceeds(getDoc(pedido(db, 'loja-b')));
  await assertFails(getDoc(pedido(user('sem-vinculo', { lojaId: 'loja-a', papel: 'gerente' }))));
});

test('loja desativada bloqueia leitura operacional mesmo com membro ativo', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'lojas_v2/suspensa'), { ativo: false });
    await setDoc(doc(db, 'lojas_v2/suspensa/membros/gerente-suspensa'), { ativo: true, papel: 'gerente', tipo: 'usuario' });
    await setDoc(doc(db, 'lojas_v2/suspensa/pedidos/p'), { status: 'novo' });
  });
  const db = user('gerente-suspensa');
  await assertFails(getDoc(doc(db, 'lojas_v2/suspensa')));
  await assertFails(getDoc(doc(db, 'lojas_v2/suspensa/membros/gerente-suspensa')));
  for (const section of ['pedidos', 'atendimentos', 'impressoes_cozinha', 'vendas', 'estoque', 'movimentos_financeiros', 'movimentos_estoque', 'avisos_cozinha', 'dados_entrega']) {
    await assertFails(getDoc(doc(db, `lojas_v2/suspensa/${section}/p`)));
    await assertFails(getDocs(collection(db, `lojas_v2/suspensa/${section}`)));
  }
  // Administração pode consultar dados desativados para auditoria e recuperação.
  await assertSucceeds(getDoc(doc(user('admin-auditoria', { admin: true }), 'lojas_v2/suspensa/pedidos/p')));
});

test('terminal exige cadastro ativo da mesma loja e papel, além do membro', async () => {
  const uid = 'terminal-consistencia', db = user(uid, { email_verified: false });
  const write = async (terminal, member = { ativo: true, tipo: 'terminal', papel: 'caixa' }) => env.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, `lojas_v2/loja-a/membros/${uid}`), member);
    if (terminal) await setDoc(doc(adminDb, `terminais_v2/${uid}`), terminal);
    else await deleteDoc(doc(adminDb, `terminais_v2/${uid}`));
  });
  const valid = { ativo: true, lojaId: 'loja-a', papel: 'caixa' };
  await write(valid); await assertSucceeds(getDoc(pedido(db)));
  for (const state of [null, { ...valid, ativo: false }, { ...valid, lojaId: 'loja-b' }, { ...valid, papel: 'cozinha' }]) {
    await write(state); await assertFails(getDoc(pedido(db))); await assertFails(getDocs(collection(db, 'lojas_v2/loja-a/pedidos')));
  }
  await write(valid, { ativo: false, tipo: 'terminal', papel: 'caixa' }); await assertFails(getDoc(pedido(db)));
  await write({ ...valid, papel: 'gerente' }, { ativo: true, tipo: 'terminal', papel: 'gerente' }); await assertFails(getDoc(pedido(db)));
  await write(valid); await assertSucceeds(getDoc(pedido(db)));
  await assertFails(getDoc(doc(db, `terminais_v2/${uid}`)));
});

test('vínculo humano exige email verificado e não pode esconder um terminal', async () => {
  await assertFails(getDoc(pedido(user('loja-a-gerente', { email_verified: false }))));
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'lojas_v2/loja-a/membros/sem-tipo'), { ativo: true, papel: 'gerente' });
    await setDoc(doc(db, 'lojas_v2/loja-a/membros/dupla-identidade'), { ativo: true, papel: 'gerente', tipo: 'usuario' });
    await setDoc(doc(db, 'terminais_v2/dupla-identidade'), { ativo: true, lojaId: 'loja-a', papel: 'caixa' });
  });
  await assertFails(getDoc(pedido(user('sem-tipo'))));
  await assertFails(getDoc(pedido(user('dupla-identidade'))));
});

test('cozinha não lê financeiro/estoque e clientes não gravam livros operacionais', async () => {
  for (const section of ['vendas', 'estoque', 'movimentos_financeiros', 'movimentos_estoque']) {
    await assertFails(getDocs(collection(user('loja-a-cozinha'), `lojas_v2/loja-a/${section}`)));
    await assertSucceeds(getDocs(collection(user('loja-a-caixa'), `lojas_v2/loja-a/${section}`)));
  }
  for (const section of ['vendas', 'estoque', 'movimentos_financeiros', 'movimentos_estoque', 'fichas_estoque', 'atendimentos', 'impressoes_cozinha', 'avisos_cozinha']) {
    await assertFails(setDoc(doc(user('loja-a-gerente'), `lojas_v2/loja-a/${section}/injetado`), { saldoMili: 999999, totalCentavos: 0 }));
  }
});

 test('corte da BURGER bloqueia gravação legada e preserva leitura e outras lojas', async()=>{
  const chave='LIC-FLOW-937278', db=user('maquina-burger',{email:'loja_lic-flow-937278@pdv.flowpdv.com.br'});
  await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'lojas_v2/legado-lic-flow-937278'),{ativo:true});});
  await assertSucceeds(setDoc(doc(db,'backups_lojas/'+chave),{totalProdutos:60}));
  await env.withSecurityRulesDisabled(async c=>{await updateDoc(doc(c.firestore(),'lojas_v2/legado-lic-flow-937278'),{corteOperacionalV2:{legadoBloqueado:true}});});
  await assertSucceeds(getDoc(doc(db,'backups_lojas/'+chave)));
  for(const target of ['backups_lojas/'+chave,'backups_lojas/'+chave+'/partes/produtos_0','backups_lojas/'+chave+'/pedidos/novo','cardapio_publico/'+chave,'cardapio_config/'+chave])await assertFails(setDoc(doc(db,target),{totalProdutos:60}));
  const other=user('outra-maquina',{email:'loja_lic-outra@pdv.flowpdv.com.br'});await assertSucceeds(setDoc(doc(other,'backups_lojas/LIC-OUTRA'),{totalProdutos:1}));
 });
