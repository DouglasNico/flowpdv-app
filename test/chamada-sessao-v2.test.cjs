const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/chamada-sessao-v2.js'), 'utf8').replace('export function', 'function'), ctx);
const criar = ctx.criarChamadaSessaoV2;

test('resposta tardia após troca de conta não confirma nem apaga a tentativa local', async () => {
  const auth = { currentUser: { uid: 'origem' } };
  let resolver, enviadas = 0, gravadas = 0, pendente = true;
  const call = criar({ auth, executar: () => { enviadas++; return new Promise(resolve => { resolver = resolve; }); } });
  const venda = (async () => {
    await call('registrarBaixaVendaLocalV2', { vendaId: 'VL-1' });
    gravadas++;
    pendente = false;
  })();
  auth.currentUser = { uid: 'destino' };
  resolver({ reciboId: 'recibo-servidor' });
  await assert.rejects(venda, { code: 'flowpdv/sessao-alterada' });
  assert.equal(enviadas, 1); assert.equal(gravadas, 0); assert.equal(pendente, true);
});

test('ponte de venda mantém seu journal real ao descartar recibo de outra sessão', async () => {
  const bridge = {
    core: require('../functions/venda-local-core.cjs'),
    estoqueCore: require('../functions/estoque-migracao-core.cjs')
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/venda-servidor-teste.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function/g, 'function'), bridge);
  const map = new Map(), storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const auth = { currentUser: { uid: 'origem' } }, calls = [];
  let gravadas = 0;
  const plano = { lojaId: 'loja', payload: { vendaId: 'VL-1' }, venda: { id: 'VL-1', turnoId: 'turno', terminalId: 'equipamento' } };
  const call = criar({ auth, executar: async nome => {
    calls.push(nome);
    if (nome === 'consultarMeuTerminalV2') return { vinculado: true, lojaId: 'loja', papel: 'caixa' };
    auth.currentUser = { uid: 'substituto' };
    return { reciboId: 'recibo-remoto' };
  } });
  const ponte = bridge.criarVendaServidorTeste({ ambienteTeste: true, storage, call, servico: {
    getTurnoAtual: () => ({ id: 'turno', terminalId: 'equipamento' }),
    saveVendaComEstoqueServidorTeste: () => { gravadas++; }
  } });
  await assert.rejects(ponte.executar(plano), { code: 'flowpdv/sessao-alterada' });
  assert.deepEqual(JSON.parse(storage.getItem('flowpdv_venda_servidor_pendente')), plano);
  assert.equal(gravadas, 0);
  assert.deepEqual(calls, ['consultarMeuTerminalV2', 'registrarBaixaVendaLocalV2']);
});

test('logout e nova sessão com mesmo UID invalidam a resposta da sessão anterior', async () => {
  for (const proximo of [null, { uid: 'original' }]) {
    const auth = { currentUser: { uid: 'original' } };
    const call = criar({ auth, executar: async () => { auth.currentUser = proximo; return { confirmado: true }; } });
    await assert.rejects(call('confirmarGravacaoVendaLocalV2'), { code: 'flowpdv/sessao-alterada' });
  }
});

test('sem sessão ou com perfil bloqueado não envia operação', async () => {
  let enviadas = 0;
  const executar = async () => { enviadas++; };
  await assert.rejects(criar({ auth: { currentUser: null }, executar })('vender'), { code: 'flowpdv/sessao-alterada' });
  await assert.rejects(criar({ auth: { currentUser: { uid: 'caixa' } }, executar, exigirOperacao: () => { throw Error('Perfil bloqueado'); } })('vender'), /Perfil bloqueado/);
  assert.equal(enviadas, 0);
});

test('recarga aguarda restauração da autenticação antes de verificar o usuário', async () => {
  const auth = { currentUser: null, authStateReady: async () => { auth.currentUser = { uid: 'persistido' }; } };
  let chamadas = 0;
  const call = criar({ auth, executar: async () => { chamadas++; return 'ok'; } });
  assert.equal(await call('consultarMeuTerminalV2'), 'ok');
  assert.equal(chamadas, 1);
});

test('bloqueio de recuperação iniciado durante chamada impede aplicação local da resposta', async () => {
  let bloqueado = false;
  const call = criar({ auth: { currentUser: { uid: 'caixa' } },
    exigirOperacao: () => { if (bloqueado) throw Error('Perfil em recuperação'); },
    executar: async () => { bloqueado = true; return { confirmado: true }; }
  });
  await assert.rejects(call('confirmarGravacaoVendaLocalV2'), /Perfil em recuperação/);
});

test('sessão estável preserva dados, resposta e erro original sem repetir envio', async () => {
  const auth = { currentUser: { uid: 'caixa' } }, data = { vendaId: 'VL-1' }, resposta = { reutilizado: true };
  let chamadas = 0;
  const call = criar({ auth, executar: async (nome, payload) => {
    chamadas++; assert.equal(nome, 'registrarBaixaVendaLocalV2'); assert.equal(payload, data); return resposta;
  } });
  assert.equal(await call('registrarBaixaVendaLocalV2', data), resposta);
  assert.equal(chamadas, 1);
  const erro = Object.assign(new Error('Resposta perdida'), { code: 'functions/unavailable' });
  await assert.rejects(criar({ auth, executar: async () => { throw erro; } })('vender'), e => e === erro);
});

test('troca de operador local descarta resposta mesmo mantendo o terminal Firebase',async()=>{
 const auth={currentUser:{uid:'terminal'}},antigo={id:'operador-a'};let operador=antigo,resolve;
 const call=criar({auth,obterContextoLocal:()=>operador,executar:()=>new Promise(r=>resolve=r)});
 const pendente=call('registrarBaixaVendaLocalV2');operador={id:'operador-b'};resolve({confirmado:true});
 await assert.rejects(pendente,{code:'flowpdv/sessao-alterada'});
});
