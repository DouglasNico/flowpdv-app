const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture(inicial = {}, teste = false) {
  const dados = new Map(Object.entries(inicial));
  const localStorage = { getItem: k => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, String(v)), removeItem: k => dados.delete(k) };
  const ctx = { localStorage, window: { electronAPI: { ambienteTeste: teste } }, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/storage.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace('export const ', 'var '), ctx);
  return { dados, service: ctx.StorageService };
}
const mutacoes = [
  ['saveVenda', { id: 'nova', total: 10, itens: [] }],
  ['getProximoNumeroVenda'], ['recuperarVendaPendente'],
  ['adicionarProdutoExcluidoId', 'P'], ['adicionarTurnoExcluidoId', 'T'], ['excluirTurnoHistorico', 'T'],
  ['salvarHistoricoTurnos', []], ['arquivarTurnoFechado', { id: 'T' }], ['salvarTurno', { id: 'T' }],
  ['_adicionarExcluidosIds', 'flowpdv_contas_excluidas_ids', ['C']], ['saveContasPagar', []],
  ['saveMovimentosEstoque', []], ['registrarMovimentoEstoque', { produtoId: 'P', delta: 1 }],
  ['saveCheckpointEstoque', {}], ['saveInventarios', []], ['saveComandas', []], ['registrarNotaImportada', 'chave'],
  ['saveProdutos', []], ['saveClientes', []], ['atualizarVenda', { id: 'antiga', total: 0 }]
];
test('rotinas do aplicativo preservam dados e diário durante recuperação, inclusive marcadores vazios', () => {
  for (const teste of [false, true]) for (const key of ['flowpdv_fechamento_recuperado_pendente','flowpdv_instalacao_perfil_pendente', 'flowpdv_recuperacao_operacao_bloqueada']) {
    for (const valor of ['', 'null', '{}']) for (const [method, ...args] of mutacoes) {
      const f = fixture({ [key]: valor, adega_vendas: '[{"id":"antiga"}]', flowpdv_commit_venda: '{"escritas":{"adega_vendas":"[]"}}' }, teste);
      const antes = [...f.dados];
      assert.throws(() => f.service[method](...args), /Perfil em recuperação/, method);
      assert.deepEqual([...f.dados], antes, method);
    }
  }
});
test('inicialização e leitura de clientes não impedem abrir recuperação nem criam dados', () => {
  const f = fixture({ flowpdv_recuperacao_operacao_bloqueada: '' }), antes = [...f.dados];
  f.service.init(); assert.equal(f.service.getClientes().length, 0); assert.equal(f.service.getVendas().length, 0);
  assert.deepEqual([...f.dados], antes);
});
test('pendência de venda impede exclusão e arquivamento de turno antes de qualquer escrita', () => {
  for (const key of ['flowpdv_pagamento_atendimento_pendente','flowpdv_commit_venda', 'flowpdv_venda_servidor_pendente', 'flowpdv_estorno_local_pendente']) {
    for (const [method, arg] of [['excluirTurnoHistorico', 'T'], ['arquivarTurnoFechado', { id: 'T' }], ['getProximoNumeroVenda']]) {
      const f = fixture({ [key]: '{}', adega_turno_atual: '{"id":"T","status":"aberto"}' }, true), antes = [...f.dados];
      assert.throws(() => f.service[method](arg), /Retome|Recupere/); assert.deepEqual([...f.dados], antes);
    }
  }
});
test('histórico e numeração legados continuam disponíveis sem marcadores de recuperação', () => {
  const f = fixture({ adega_vendas: '[{"id":"V","numeroVenda":4}]' });
  assert.equal(f.service.getProximoNumeroVenda(), 5);
  f.service.salvarHistoricoTurnos([{ id: 'T', status: 'fechado' }]);
  assert.equal(f.service.getHistoricoTurnos().length, 1);
  assert.equal(f.service.excluirTurnoHistorico('T'), true); assert.equal(f.service.getHistoricoTurnos().length, 0);
});
test('estoque migrado não volta ao caminho legado em nenhum perfil, inclusive ao recriar produto ausente', () => {
  for (const teste of [false, true]) for (const existe of [false, true]) {
    const produto={id:'P',codigoBarras:'789',nome:'Produto migrado',estoque:10};
    const f=fixture({adega_produtos:JSON.stringify(existe?[produto]:[]),flowpdv_migracoes_estoque_teste:JSON.stringify([{status:'confirmado',produto}])},teste);
    const antes=[...f.dados];
    for(const acao of [()=>f.service.saveVenda({id:'V',itens:[{id:'P',quantidade:1}]}),()=>f.service.adicionarProdutoExcluidoId('P'),()=>f.service.registrarMovimentoEstoque({produtoId:'789',delta:-1}),()=>f.service.saveProdutos([{...produto,estoque:1}])]) {
      assert.throws(acao,/migração|controlado pelo restaurante/);assert.deepEqual([...f.dados],antes);
    }
  }
});
test('pendência V2 não pode ser ignorada pelo aplicativo normal ou por valor vazio', () => {
  for(const teste of [false,true])for(const key of ['flowpdv_venda_servidor_pendente','flowpdv_estorno_local_pendente'])for(const valor of ['', 'null', '{}']){
    const f=fixture({[key]:valor},teste),antes=[...f.dados];
    assert.throws(()=>f.service.saveVenda({id:'V',itens:[]}),/Retome/);
    assert.throws(()=>f.service.salvarTurno({id:'T'}),/Retome/);
    assert.deepEqual([...f.dados],antes);
  }
});

test('atualização legada não altera venda confirmada nem introduz recibo sem passar pela ponte',()=>{
  for(const teste of [false,true])for(const recibo of [null,{}, {reciboId:'recibo'}]){
    const f=fixture({adega_vendas:JSON.stringify([{id:'V',total:10,estoqueServidorV2:recibo}])},teste),antes=[...f.dados];
    assert.throws(()=>f.service.atualizarVenda({id:'V',total:0}),/Venda confirmada no servidor/);assert.deepEqual([...f.dados],antes);
  }
  const f=fixture({adega_vendas:'[{"id":"legada","total":10}]'});
  assert.throws(()=>f.service.atualizarVenda({id:'legada',estoqueServidorV2:{}}),/Venda confirmada/);
  assert.equal(f.service.atualizarVenda({id:'legada',statusFiscal:'pendente'}),true);
  assert.equal(f.service.getVendas()[0].total,10);
});
