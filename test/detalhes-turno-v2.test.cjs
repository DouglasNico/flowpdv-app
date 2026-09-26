const {test}=require('node:test'),assert=require('node:assert/strict');
const {detalharMovimento}=require('../functions/detalhes-turno-v2');
const item={origemLinhaId:'pedido:linha',origemPedidoId:'pedido',produtoId:'lanche',nome:'Lanche',quantidade:2,precoUnitarioCentavos:1250,totalCentavos:2500,opcoes:[{nome:'Bacon',quantidade:1,precoCentavos:250}]};
const sale={totalCentavos:2500,status:'estornada',itens:[item]},movement={vendaId:'venda',tipo:'recebimento_manual',totalCentavos:2500};

test('taxa de delivery é separada dos itens e devolvida com sinal negativo',()=>{
 const delivery={...sale,tipo:'delivery',taxaEntregaCentavos:500,totalCentavos:3000};
 const r=detalharMovimento('d',{...movement,totalCentavos:3000},delivery);
 assert.equal(r.itens.length,1);assert.equal(r.itens[0].totalCentavos,2500);assert.equal(r.taxaEntregaCentavos,500);
 const e=detalharMovimento('e',{...movement,tipo:'estorno_manual',totalCentavos:-3000},delivery);assert.equal(e.taxaEntregaCentavos,-500);
 for(const taxaEntregaCentavos of [-1,0.5,100001,undefined])assert.throws(()=>detalharMovimento('d',{...movement,totalCentavos:3000},{...delivery,taxaEntregaCentavos}));
});
test('histórico usa retrato da venda, preserva recebimento e inverte somente estorno',()=>{
 const original=JSON.stringify(sale),received=detalharMovimento('m',movement,sale);
 assert.equal(received.itens[0].quantidade,2);assert.equal(received.totalCentavos,2500);
 const refund=detalharMovimento('r',{...movement,tipo:'estorno_manual',totalCentavos:-2500},sale);
 assert.equal(refund.itens[0].quantidade,-2);assert.equal(refund.itens[0].totalCentavos,-2500);assert.equal(refund.itens[0].opcoes[0].precoCentavos,250);
 assert.equal(JSON.stringify(sale),original);
});
test('recusa venda ausente, linha duplicada, adicionais inválidos e quantidade fracionada',()=>{
 for(const invalid of [null,{...sale,itens:[item,item]},{...sale,itens:[{...item,quantidade:1.5}]},{...sale,itens:[{...item,opcoes:[{nome:'Bacon',quantidade:1,precoCentavos:2500}]}]},{...sale,itens:Array(301).fill(item)}]) assert.throws(()=>detalharMovimento('m',movement,invalid));
});
