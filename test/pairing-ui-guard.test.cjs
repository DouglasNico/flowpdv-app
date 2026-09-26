const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('serviços de sessão recusam perfil normal antes de acessar Firebase', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/sessoes-homologacao.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  for (const api of [undefined, { ambienteTeste: false }]) {
    const ctx = { window: { electronAPI: api }, getApps() { throw new Error('SDK acessado'); } };
    vm.runInNewContext(source, ctx);
    assert.throws(() => ctx.sessaoTerminalTeste(), /somente no teste local/);
    assert.throws(() => ctx.sessaoGerenciaTeste(), /somente no teste local/);
    ctx.iniciarObservacaoTerminalHomologacao();
  }
});
test('aplicativo completo exige operador local e gerente antes das chamadas de configuração',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/js/sessoes-homologacao.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export function /g,'function ');
  let opts,usuario=null,loginAberto=false;
  const ctx={window:{electronAPI:{ambienteTeste:true,aplicativoCompletoTeste:true},AuthModule:{getUsuario:()=>usuario,isGerente:()=>usuario?.cargo==='gerente',temPermissao:p=>usuario?.cargo==='gerente'||usuario?.permissoes?.[p]===true}},document:{body:{classList:{contains:()=>loginAberto}}},criarServicosAcessoLocal:o=>{opts=o;return {terminal:()=>({})};}};
  vm.runInNewContext(source,ctx);ctx.sessaoTerminalTeste();
  assert.throws(()=>opts.exigirOperador('terminal'),/Entre como operador/);
  usuario={id:'operador',cargo:'caixa'};assert.doesNotThrow(()=>opts.exigirOperador('terminal'));
  for(const op of ['cancelarPedidoV2','estornarVendaV2','estornarVendaLocalV2','cancelarTentativaVendaLocalV2','reimprimirCozinhaV2'])assert.throws(()=>opts.exigirOperador('terminal',op),/não tem permissão/);
  assert.throws(()=>opts.exigirOperador('terminal','registrarBaixaVendaLocalV2',{ajuste:{descontoCentavos:1}}),/desconto/);
  assert.doesNotThrow(()=>opts.exigirOperador('terminal','registrarBaixaVendaLocalV2',{}));
  assert.throws(()=>opts.exigirOperador('gerencia'),/gerente autenticado/);
  usuario={id:'gerente',cargo:'gerente'};assert.doesNotThrow(()=>opts.exigirOperador('gerencia'));assert.equal(opts.obterContextoLocal(),usuario);
  loginAberto=true;assert.throws(()=>opts.exigirOperador('terminal'),/Entre como operador/);
});

test('mudança de identidade revalida consumidores sem transportar autorização e encerra observação', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/sessoes-homologacao.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  let mudou, encerrar, observado = 0, encerrado = 0;
  const eventos = [];
  const ctx = { window: { electronAPI: { ambienteTeste: true }, dispatchEvent: e => eventos.push(e), addEventListener: (nome, fn) => { assert.equal(nome, 'beforeunload'); encerrar = fn; } },
    CustomEvent: class { constructor(nome, opts) { this.nome = nome; this.detail = opts.detail; } },
    criarServicosAcessoLocal: () => ({ terminal: () => ({ auth: {} }) }),
    onAuthStateChanged: (_auth, fn) => { observado++; mudou = fn; return () => encerrado++; } };
  vm.runInNewContext(source, ctx);
  ctx.iniciarObservacaoTerminalHomologacao(); ctx.iniciarObservacaoTerminalHomologacao();
  assert.equal(observado, 1); mudou(null); mudou({ uid: 'outro' });
  assert.equal(eventos.length, 1); assert.equal(eventos[0].nome, 'flowpdv-terminal-v2');
  mudou({ uid: 'outro' }); assert.equal(eventos.length, 1);
  mudou(null); assert.equal(eventos.length, 2);
  assert.equal(JSON.stringify(eventos[0].detail), '{"revalidar":true}');
  encerrar(); assert.equal(encerrado, 1);
});
test('configuração administrativa não inicializa sessão nem DOM em produção', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/configuracao-teste.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  vm.runInNewContext(source + '\ninstalarConfiguracaoTeste();', { window: {}, document: { getElementById() { throw new Error('DOM acessado'); } } });
});

test('fechamento não inicializa SDK nem DOM no modo normal', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/fechamento-teste.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  vm.runInNewContext(source + '\ninstalarFechamentoTeste();', { window: {}, document: { getElementById() { throw new Error('DOM acessado'); } } });
});

test('interface de pareamento não inicializa SDK nem altera DOM no modo normal', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/pareamento-teste.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  for (const api of [undefined, { ambienteTeste: false }]) {
    let mutations = 0;
    const context = { window: { electronAPI: api }, document: { getElementById() { mutations++; throw new Error('DOM acessado'); } } };
    vm.runInNewContext(source + '\ninstalarPareamentoTeste();', context);
    assert.equal(mutations, 0);
  }
});

test('recebimento não acessa sessão nem DOM fora do modo de teste', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/recebimento-teste.js'), 'utf8')
    .replace(/^import .*;\r?$/gm, '').replace(/export function /g, 'function ');
  for (const api of [undefined, { ambienteTeste: false }]) {
    vm.runInNewContext(source + '\ninstalarRecebimentoTeste();', {
      window: { electronAPI: api }, document: { getElementById() { throw new Error('DOM acessado'); } },
      sessaoTerminalTeste() { throw new Error('SDK acessado'); }
    });
  }
});

test('painel de teste não altera DOM quando o perfil está desativado', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/js/painel-teste.js'), 'utf8').replace('export function', 'function');
  for (const api of [undefined, {ambienteTeste:false}]) vm.runInNewContext(source+'; iniciarPainelTeste();',{window:{electronAPI:api},document:{get body(){throw Error('DOM normal alterado');}}});
});

test('balcão operacional não acessa DOM nem callbacks em produção',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/js/pdv-operacional-teste.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export function','function');for(const api of [undefined,{ambienteTeste:false}])vm.runInNewContext(source+';instalarPdvOperacionalTeste({});',{window:{electronAPI:api},document:{getElementById(){throw Error('DOM real acessado');}}});
});
