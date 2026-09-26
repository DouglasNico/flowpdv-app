const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

test('restauração revalida a loja na confirmação antes de gravar', async () => {
  const f=fixture(), b=f.BackupModule;let confirmar,gravacoes=0,chave='A';
  b.getChaveLicenca=()=>chave;
  f.CloudSyncModule.lerPacote=async()=>({chaveLicenca:'A',produtos:[]});
  f.CloudSyncModule.pacotePertenceALicenca=p=>p.chaveLicenca===chave;
  f.window.App.confirmarAcao=o=>{confirmar=o.onConfirm;};
  f.StorageService.saveProdutos=()=>{gravacoes++;};
  await b.restaurarBackupNuvem();assert.equal(typeof confirmar,'function');
  chave='B';confirmar();assert.equal(gravacoes,0);assert.match(f.avisos.at(-1),/loja ativa mudou/);
});

test('falha tardia de gravação no callback da restauração gera aviso sem sucesso', async () => {
  const f=fixture(), b=f.BackupModule;let confirmar;
  b.getChaveLicenca=()=> 'A';
  f.CloudSyncModule.lerPacote=async()=>({chaveLicenca:'A',produtos:[]});
  f.CloudSyncModule.pacotePertenceALicenca=()=>true;
  f.window.App.confirmarAcao=o=>{confirmar=o.onConfirm;};
  f.StorageService.saveProdutos=()=>{throw Error('Sem espaço');};
  await b.restaurarBackupNuvem();assert.doesNotThrow(()=>confirmar());
  assert.match(f.avisos.at(-1),/restauração não foi concluída/);
  assert.ok(!f.avisos.some(m=>m.includes('restaurado com sucesso')));
});
function fixture(inicial = {}) {
  const dados = new Map(Object.entries(inicial)), avisos = [];
  const storage = { getItem: k => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), removeItem: k => dados.delete(k) };
  const ctx = { localStorage: storage, sessionStorage: storage, window: { App: { showToast: m => avisos.push(m) } }, console: { warn() {}, error() {} } };
  vm.createContext(ctx);
  for (const file of ['storage.js', 'cloud-sync.js', 'backup.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/js', file), 'utf8')
      .replace(/^import[\s\S]*?;\r?$/gm, '').replace(/export const /g, 'var ');
    // Os dois módulos possuem constantes com o mesmo nome; escopo próprio como em ESM.
    const nome = { 'storage.js': 'StorageService', 'cloud-sync.js': 'CloudSyncModule', 'backup.js': 'BackupModule' }[file];
    vm.runInContext(`this.${nome} = (() => { ${source}; return ${nome}; })();`, ctx);
  }
  return { ...ctx, dados, avisos };
}
test('restauração de arquivo e troca de loja preservam integralmente base migrada', () => {
  const f = fixture({ flowpdv_migracoes_estoque_teste: '[{"status":"confirmado"}]', adega_vendas: '[{"id":"original"}]' });
  const antes = [...f.dados];
  assert.throws(() => f.StorageService.importarBackupCompleto({ produtos: [], vendas: [] }), /recuperação específica/);
  assert.throws(() => f.StorageService.limparDadosLocaisParaNovaEmpresa({}), /recuperação específica/);
  assert.deepEqual([...f.dados], antes);
});
test('pendências e recibos V2 bloqueiam mesmo sem marcador de migração', () => {
  for (const [key, raw] of [
    ['flowpdv_venda_servidor_pendente', '{}'], ['flowpdv_estorno_local_pendente', '{}'],
    ['flowpdv_instalacao_perfil_pendente', '{}'], ['flowpdv_recuperacao_operacao_bloqueada', '{}'],
    ['flowpdv_instalacao_perfil_pendente', 'null'], ['flowpdv_recuperacao_operacao_bloqueada', ''],
    ['flowpdv_commit_venda', '{}'], ['adega_vendas', '[{"estoqueServidorV2":{}}]'],
    ['adega_turno_atual', '{"restauranteV2":{}}'], ['adega_turnos_historico', '[{"estornosLocaisV2":[]}]'],
    ['flowpdv_migracoes_estoque_teste', '{invalido'], ['adega_vendas', '{invalido']
  ]) assert.throws(() => fixture({ [key]: raw }).StorageService.exigirBaseLegadaPermitida(), /recuperação específica/, key);
});
test('pacote V2 não entra pelo importador legado mesmo em base vazia', () => {
  for (const pacote of [{ produtos: [], vendas: [{ estoqueServidorV2: {} }] }, { produtos: [], turnoAtual: { restauranteV2: {} } }, { tipo: 'flowpdv_homologacao_v2' }]) {
    const f = fixture(); assert.throws(() => f.StorageService.importarBackupCompleto(pacote), /recuperação específica/); assert.equal(f.dados.size, 0);
  }
});
test('base legada comum conserva importação e verificação sem gravar por antecipação', () => {
  const f = fixture(); f.StorageService.exigirBaseLegadaPermitida({ vendas: [{ id: 'antiga' }] });
  assert.equal(f.dados.size, 0);
  assert.equal(f.StorageService.importarBackupCompleto({ tipo: 'flowpdv_backup', vendas: [{ id: 'antiga' }] }), true);
  assert.equal(f.dados.get('adega_vendas'), '[{"id":"antiga"}]');
});
test('nuvem não restaura, mescla, publica ou limpa a base V2', async () => {
  const f = fixture({ flowpdv_migracoes_estoque_teste: '[{}]' }), antes = [...f.dados];
  assert.throws(() => f.CloudSyncModule.carregarBaseCompletaNovaEmpresa({ produtos: [], vendas: [] }), /recuperação específica/);
  assert.throws(() => f.CloudSyncModule.mesclarProdutosComEstoque([], []), /recuperação específica/);
  await assert.rejects(f.CloudSyncModule.gravarPacote('teste', {}), /recuperação específica/);
  await f.CloudSyncModule.trocarEmpresaSincronizacao('teste');
  await f.BackupModule.restaurarBackupNuvem();
  assert.match(f.avisos[0], /recuperação específica/);
  assert.deepEqual([...f.dados], antes);
});
