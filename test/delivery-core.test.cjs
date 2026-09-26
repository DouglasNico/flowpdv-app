const { test } = require('node:test'), assert = require('node:assert/strict');
const { normalizarDelivery, cotarDelivery } = require('../functions/delivery-core.cjs');
const config = () => ({ ativo: true, pedidoMinimoCentavos: 2000, regioes: [{ id: 'centro', nome: 'Centro', cepInicial: '01000-000', cepFinal: '01999-999', taxaCentavos: 500, prazoMinutos: 40 }] });
test('horários usam fuso da loja e limites inclusivo/exclusivo, inclusive madrugada', () => {
 const c={...config(),horarios:{fuso:'America/Sao_Paulo',periodos:[{dia:1,inicio:1080,fim:1440},{dia:2,inicio:0,fim:120}]}};
 for(const instant of ['2026-09-21T21:00:00Z','2026-09-22T02:59:59Z','2026-09-22T03:00:00Z','2026-09-22T04:59:59Z']) assert.equal(cotarDelivery(c,'01000000',2000,new Date(instant)).totalCentavos,2500);
 for(const instant of ['2026-09-21T20:59:59Z','2026-09-22T05:00:00Z','2026-09-23T03:00:00Z']) assert.throws(()=>cotarDelivery(c,'01000000',2000,new Date(instant)),/horário/);
 assert.throws(()=>cotarDelivery({...c,horarios:{...c.horarios,periodos:[]}},'01000000',2000),/horário/);
});
test('horários recusam fuso inválido, períodos invertidos, sobreposição e valores fracionados',()=>{
 for(const horarios of [{fuso:'inexistente',periodos:[]},{fuso:'UTC',periodos:[{dia:7,inicio:0,fim:60}]},{fuso:'UTC',periodos:[{dia:1,inicio:60,fim:60}]},{fuso:'UTC',periodos:[{dia:1,inicio:0.5,fim:60}]},{fuso:'UTC',periodos:[{dia:1,inicio:0,fim:120},{dia:1,inicio:60,fim:180}]}]) assert.throws(()=>normalizarDelivery({...config(),horarios}));
});
test('normaliza CEP e calcula taxa separada sem modificar configuração', () => {
  const c = config(), before = JSON.stringify(c), q = cotarDelivery(c, '01000-000', 2500);
  assert.equal(q.totalCentavos, 3000); assert.equal(q.taxaEntregaCentavos, 500); assert.equal(q.prazoMinutos, 40); assert.equal(JSON.stringify(c), before);
  assert.equal(cotarDelivery(c, '01999999', 2000).totalCentavos, 2500);
});
test('mínimo considera produtos; CEP fora da área, canal inativo e total excessivo são recusados', () => {
  assert.throws(() => cotarDelivery(config(), '01000000', 1900), /mínimo/);
  assert.throws(() => cotarDelivery(config(), '02000000', 2500), /fora/);
  assert.throws(() => cotarDelivery({...config(), ativo:false}, '01000000', 2500), /indisponível/);
  assert.throws(() => cotarDelivery(config(), '01000000', 1000000), /excede/);
  assert.throws(() => cotarDelivery(config(), '123', 2500), /CEP/);
});
test('recusa taxas inválidas, faixas sobrepostas, invertidas e região repetida', () => {
  for (const taxaCentavos of [-1, 0.5, '500', 100001]) { const c=config(); c.regioes[0].taxaCentavos=taxaCentavos; assert.throws(()=>normalizarDelivery(c)); }
  const c=config(); c.regioes.push({...c.regioes[0],id:'outra'}); assert.throws(()=>normalizarDelivery(c),/sobrepor/);
  c.regioes[1].id='centro'; assert.throws(()=>normalizarDelivery(c),/repetida/);
  const d=config(); d.regioes[0].cepFinal='00000000'; assert.throws(()=>normalizarDelivery(d),/invertida/);
  assert.throws(()=>normalizarDelivery({...config(),regioes:[]}),/Cadastre/);
});
