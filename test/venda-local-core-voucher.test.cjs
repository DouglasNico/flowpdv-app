const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../functions/venda-local-core.cjs');

test('validarPagamentos aceita Voucher puro, misto e rejeita forma inválida',()=>{
  assert.deepEqual(core.validarPagamentos([{forma:'Voucher',valorCentavos:500}],500),[{forma:'Voucher',valorCentavos:500}]);
  const misto=core.validarPagamentos([
    {forma:'Crédito',valorCentavos:100},
    {forma:'Voucher',valorCentavos:200},
    {forma:'Dinheiro',valorCentavos:100},
    {forma:'PIX',valorCentavos:50},
    {forma:'Débito',valorCentavos:50}
  ],500);
  assert.deepEqual(misto.map(p=>p.forma),['Dinheiro','PIX','Débito','Crédito','Voucher']);
  assert.throws(()=>core.validarPagamentos([{forma:'Fiado',valorCentavos:500}],500));
  assert.throws(()=>core.validarPagamentos([{forma:'Voucher',valorCentavos:200},{forma:'Voucher',valorCentavos:300}],500));
});
