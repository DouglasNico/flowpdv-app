const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
test('reimpressão da auditoria não substitui turno ausente nem anuncia envio antecipado', async()=>{
  const avisos=[],impressoes=[];const ctx={StorageService:{getHistoricoTurnos:()=>[{id:'OUTRO'}],getTurnoAtual:()=>({id:'ATUAL'})},window:{App:{showToast:(...a)=>avisos.push(a)},ThermalPrintModule:{imprimirFechamentoCaixa:t=>{impressoes.push(t.id);return Promise.resolve({success:false});}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/js/gerencia.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export const ','var '),ctx);
  ctx.GerenciaModule.reimprimirFechamentoAuditoria('AUSENTE');assert.equal(impressoes.length,0);assert.equal(avisos[0][1],'warning');
  avisos.length=0;assert.equal((await ctx.GerenciaModule.reimprimirFechamentoAuditoria('OUTRO')).success,false);assert.deepEqual(impressoes,['OUTRO']);assert.equal(avisos.length,0);
});
test('PDV sem módulo de impressão não anuncia sucesso nem fecha a tentativa', () => {
  const avisos=[];
  const ctx={window:{App:{showToast:(...args)=>avisos.push(args)}},StorageService:{getVendas:()=>[{id:'V'}]}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/js/pdv.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export const ','var '),ctx);
  ctx.PdvModule.fecharModalReimpressaoCupom=()=>assert.fail('Fechou sem imprimir');
  ctx.PdvModule.fecharModalSucessoImpressao=()=>assert.fail('Fechou sem preparar documento');
  ctx.PdvModule.reimprimirCupomVendaEspecifica('V');
  ctx.PdvModule.confirmarImpressaoVendaFinalizada();
  ctx.PdvModule.confirmarImpressaoA4VendaFinalizada();
  assert.equal(avisos.length,3);
  assert.ok(avisos.every(a=>a[1]==='warning'));
});
function fixture(api, open) {
  const avisos = [];
  const ctx = { console: { error() {}, warn() {} }, setTimeout: fn => { fn(); }, window: { electronAPI: api, open, App: { showToast: (...args) => avisos.push(args) } } };
  const source = fs.readFileSync(path.join(__dirname, '../src/js/thermal-print.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace('export const ', 'var ');
  vm.runInNewContext(source, ctx);
  ctx.ThermalPrintModule.papelCupom = () => ({ papelMm: 80 });
  return { print: ctx.ThermalPrintModule, avisos };
}
test('envio térmico só é anunciado depois da resposta, sem garantir papel impresso', async () => {
  let responder;
  const f = fixture({ printThermalReceipt: () => new Promise(r => { responder = r; }) });
  const job = f.print.executarImpressao('<p>Teste</p>');
  assert.equal(f.avisos.length, 0);
  responder({ success: true });
  assert.equal((await job).success, true);
  assert.equal(f.avisos.length, 1);
  assert.equal(f.avisos[0][1], 'info');
  assert.match(f.avisos[0][0], /Confira a saída/);
});
test('cancelamento e falha retornam aviso persistente, nunca sucesso', async () => {
  for (const resposta of [undefined, { success: false, error: 'Cancelado' }]) {
    const f = fixture({ printThermalReceipt: async () => resposta });
    assert.equal((await f.print.executarImpressao('teste')).success, false);
    assert.equal(f.avisos.length, 1);
    assert.equal(f.avisos[0][1], 'warning');
    assert.equal(f.avisos[0][2].duracao, 0);
  }
});
test('TEF preserva rejeição obrigatória e não duplica avisos', async () => {
  const f = fixture({ printThermalReceipt: async () => { throw Error('Sem impressora'); } });
  await assert.rejects(f.print.executarImpressao('teste', true), /Sem impressora/);
  assert.equal(f.avisos.length, 0);
});
test('popup bloqueado no térmico e A4 é falha com orientação', async () => {
  for (const metodo of ['executarImpressao', 'executarImpressaoA4']) {
    const f = fixture(null, () => null);
    assert.equal((await f.print[metodo]('teste')).success, false);
    assert.match(f.avisos[0][0], /bloqueada/);
    assert.equal(f.avisos[0][1], 'warning');
  }
});
test('diálogo do navegador não equivale a impressão confirmada', async () => {
  let impresso = 0;
  const f = fixture(null, () => ({ document: { write() {}, close() {} }, focus() {}, print() { impresso++; }, close() {} }));
  const result = await f.print.executarImpressaoA4('teste');
  assert.equal(impresso, 1);
  assert.equal(result.dialogOpened, true);
  assert.equal(result.success, false);
  assert.equal(f.avisos[0][1], 'info');
});
test('erro tardio ao abrir diálogo é tratado e não rejeita silenciosamente', async () => {
  const f = fixture(null, () => ({ document: { write() {}, close() {} }, focus() {}, print() { throw Error('Janela encerrada'); } }));
  assert.equal((await f.print.executarImpressao('teste')).success, false);
  assert.equal(f.avisos.at(-1)[1], 'warning');
});
