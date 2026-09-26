const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const map = new Map([['flowpdv_device_id','NOVO']]); let falha = null;
  const storage = { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null,
    setItem: (k,v) => { if(k === falha) { falha = null; throw new Error('Disco cheio'); } map.set(k,v); }, removeItem: k => map.delete(k) };
  const contexto = { lojaId: 'A', terminalId: 'T', terminalUid: 'antigo' }, pacote = { tipo: 'flowpdv_homologacao_v2', versao: 1, origem: contexto,
    dados: { flowpdv_device_id: 'T', adega_vendas: '[]', adega_turno_atual: '{"id":"C","terminalId":"T"}' } };
  const sessao = { auth: { currentUser: { uid: 'novo' } }, call: async () => ({ vinculado: true, papel: 'caixa', lojaId: 'A', identidadeOperacionalUid: 'antigo' }) };
  const ctx = { ensaiarRestauracaoTerminal: async ({ storageDestino }) => { for (const [k,v] of Object.entries(pacote.dados)) storageDestino.setItem(k,v); return { contexto }; } };
  vm.createContext(ctx);
  for (const file of ['backup-homologacao.js','instalacao-perfil-teste.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export /g,''),ctx);
  const deps = { storage, sessao, ambienteTeste: true, perfilNomeado: true };
  return { map, storage, pacote, sessao, ctx, deps, falhar: k => falha=k, create: () => ctx.criarInstalacaoPerfilTeste(deps) };
}
test('instala em perfil novo com bloqueio persistente e sem liberar operação', async () => {
  const f=fixture(), r=await f.create().instalar(f.pacote);
  assert.equal(r.liberacaoOperacional,false); assert.equal(r.exigeReinicio,true); assert.equal(f.storage.getItem('flowpdv_device_id'),'T');
  assert.ok(f.storage.getItem('flowpdv_recuperacao_operacao_bloqueada')); assert.equal(f.create().pendente(),false);
});
test('falha de disco retoma após reconstruir serviço sem remover bloqueio', async () => {
  const f=fixture(); f.falhar('adega_vendas'); await assert.rejects(f.create().instalar(f.pacote),/Disco cheio/);
  assert.equal(f.create().pendente(),true); assert.ok(f.storage.getItem('flowpdv_recuperacao_operacao_bloqueada'));
  await f.create().retomar(); assert.equal(f.create().pendente(),false); assert.equal(f.storage.getItem('adega_vendas'),'[]');
});
test('perfil com dados/credenciais e mudança durante retomada são preservados', async () => {
  const f=fixture(); f.storage.setItem('firebase:authUser','preservar'); await assert.rejects(f.create().instalar(f.pacote),/possui dados/);
  assert.equal(f.storage.getItem('firebase:authUser'),'preservar');
  const g=fixture(); g.falhar('adega_vendas'); await assert.rejects(g.create().instalar(g.pacote)); g.storage.setItem('adega_vendas','[{"id":"nova"}]');
  await assert.rejects(g.create().retomar(),/recebeu dados/); assert.equal(g.storage.getItem('adega_vendas'),'[{"id":"nova"}]');
});
test('perfil normal, sessão trocada e autorização revogada não instalam', async () => {
  const f=fixture(); assert.throws(()=>f.ctx.criarInstalacaoPerfilTeste({...f.deps,perfilNomeado:false}));
  f.sessao.call=async()=>({vinculado:false}); await assert.rejects(f.create().instalar(f.pacote),/autorização/); assert.equal(f.storage.getItem('flowpdv_device_id'),'NOVO');
  f.sessao.auth.currentUser={uid:'outro'}; await assert.rejects(f.create().retomar(),/identidade/);
});

test('padrões vazios são aceitos e autenticação local fica fora do journal e do arquivo', async () => {
  const f=fixture(), chave='firebase:authUser:demo-flowpdv-key:flowpdv-terminal-teste-v2';
  f.storage.setItem(chave,'segredo-do-proprio-terminal');f.storage.setItem('adega_clientes','[]');
  f.storage.setItem('adega_config',JSON.stringify({nomeLoja:'',cnpj:'',endereco:'',telefone:'',chavePix:'',impressoraPadrao:'58mm',autoImprimirCupom:true,habilitarModuloFiado:true,atualizadoEm:'2026-09-22T10:00:00.000Z'}));
  f.falhar('adega_vendas');await assert.rejects(f.create().instalar(f.pacote),/Disco cheio/);
  assert.doesNotMatch(f.storage.getItem('flowpdv_instalacao_perfil_pendente'),/segredo|firebase:authUser/);
  await f.create().retomar();assert.equal(f.storage.getItem(chave),'segredo-do-proprio-terminal');
  const g=fixture();g.storage.setItem('adega_clientes','[{"nome":"Cliente existente"}]');await assert.rejects(g.create().instalar(g.pacote),/possui dados/);
});
