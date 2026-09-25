function normalizarVendaLocal(data) {
  const fail=()=>{throw new Error('Venda local inválida. Confira itens migrados, ajustes e pagamentos manuais.');};
  if(!data||typeof data.vendaId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(data.vendaId)||!Array.isArray(data.itens)||!data.itens.length||data.itens.length>30) fail();
  const ids=new Set();let totalCentavos=0;
  const itens=data.itens.map(i=>{
    if(typeof i.legadoId!=='string'||!i.legadoId||i.legadoId.length>100||ids.has(i.legadoId)||!/^\d+(\.\d{1,3})?$/.test(String(i.quantidade))||Number(i.quantidade)<=0||!Number.isSafeInteger(i.precoUnitarioCentavos)||i.precoUnitarioCentavos<0||i.precoUnitarioCentavos>1e9) fail();
    ids.add(i.legadoId);const quantidade=String(Number(i.quantidade)),total=Math.round(Number(quantidade)*i.precoUnitarioCentavos);
    if(!Number.isSafeInteger(total)||total>1e9) fail();totalCentavos+=total;
    return {legadoId:i.legadoId,quantidade,precoUnitarioCentavos:i.precoUnitarioCentavos,totalCentavos:total};
  });
  if(totalCentavos>1e9)fail();
  const subtotalCentavos=totalCentavos,ajuste=data.ajuste===undefined?undefined:validarAjuste(data.ajuste,subtotalCentavos);
  if(ajuste)totalCentavos=subtotalCentavos-ajuste.descontoCentavos+ajuste.acrescimoCentavos;
  if(!Number.isSafeInteger(data.totalCentavos)||data.totalCentavos!==totalCentavos||totalCentavos>1e9) fail();
  const venda={vendaId:data.vendaId,itens,totalCentavos,...(ajuste?{subtotalCentavos,ajuste}:{})};
  if(data.subtotalCentavos!==undefined&&data.subtotalCentavos!==subtotalCentavos)fail();
  if(data.pagamentos!==undefined){
    const pagamentos=validarPagamentos(data.pagamentos,totalCentavos);
    const dinheiro=pagamentos.find(p=>p.forma==='Dinheiro')?.valorCentavos||0;
    const recebido=data.recebidoDinheiroCentavos;
    if(!Number.isSafeInteger(recebido)||recebido<dinheiro||recebido>1e9||(!dinheiro&&recebido!==0))throw new Error('Dinheiro recebido inválido para a parcela em dinheiro.');
    const trocoCentavos=recebido-dinheiro;
    if(data.trocoCentavos!==undefined&&data.trocoCentavos!==trocoCentavos)throw new Error('Troco diverge da parcela em dinheiro.');
    return {...venda,pagamentos,recebidoDinheiroCentavos:recebido,trocoCentavos};
  }
  // O formato anterior permanece idêntico para recuperar tentativas já registradas.
  if(data.recebidoDinheiroCentavos===undefined){if(data.trocoCentavos!==undefined)fail();return venda;}
  const recebido=data.recebidoDinheiroCentavos;
  if(!Number.isSafeInteger(recebido)||recebido<totalCentavos||recebido>1e9)throw new Error('Dinheiro recebido inválido ou menor que o total da venda.');
  const trocoCentavos=recebido-totalCentavos;
  if(data.trocoCentavos!==undefined&&data.trocoCentavos!==trocoCentavos)throw new Error('Troco diverge do valor recebido e do total.');
  return {...venda,recebidoDinheiroCentavos:recebido,trocoCentavos};
}
function dinheiroRecebidoCentavos(texto,totalCentavos){
  const raw=String(texto??'').trim().replace(',','.');
  if(!raw)return totalCentavos;
  if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new Error('Informe o dinheiro recebido com até duas casas decimais, sem separador de milhar.');
  const valor=Math.round(Number(raw)*100);
  if(!Number.isSafeInteger(valor)||valor<totalCentavos||valor>1e9)throw new Error('Dinheiro recebido inválido ou menor que o total da venda.');
  return valor;
}
function validarPagamentos(pagamentos,totalCentavos){
  const formas=['Dinheiro','PIX','Débito','Crédito','Voucher'],ids=new Set();
  if(!Array.isArray(pagamentos)||pagamentos.length>5||(!pagamentos.length&&totalCentavos!==0))throw new Error('Informe as formas de pagamento.');
  const result=pagamentos.map(p=>{
    if(!p||!formas.includes(p.forma)||ids.has(p.forma)||!Number.isSafeInteger(p.valorCentavos)||p.valorCentavos<=0||p.valorCentavos>1e9)throw new Error('Forma ou valor de pagamento inválido.');
    ids.add(p.forma);return {forma:p.forma,valorCentavos:p.valorCentavos};
  }).sort((a,b)=>formas.indexOf(a.forma)-formas.indexOf(b.forma));
  if(result.reduce((s,p)=>s+p.valorCentavos,0)!==totalCentavos)throw new Error('A soma dos pagamentos deve corresponder ao total da venda.');
  return result;
}
function validarAjuste(ajuste,subtotalCentavos){
  if(!ajuste||!Number.isSafeInteger(ajuste.descontoCentavos)||ajuste.descontoCentavos<0||ajuste.descontoCentavos>subtotalCentavos||!Number.isSafeInteger(ajuste.acrescimoCentavos)||ajuste.acrescimoCentavos<0||ajuste.acrescimoCentavos>1e9||subtotalCentavos-ajuste.descontoCentavos+ajuste.acrescimoCentavos>1e9)throw new Error('Desconto ou acréscimo inválido. O desconto não pode superar o subtotal.');
  const motivo=typeof ajuste.motivo==='string'?ajuste.motivo.trim():'';
  if(motivo.length<5||motivo.length>180)throw new Error('Informe o motivo do ajuste entre 5 e 180 caracteres.');
  return {descontoCentavos:ajuste.descontoCentavos,acrescimoCentavos:ajuste.acrescimoCentavos,motivo};
}
function precoProdutoLocalCentavos(produto){
  const valor=produto&&Object.hasOwn(produto,'precoVenda')?produto.precoVenda:produto?.preco;
  if(typeof valor!=='number'&&(typeof valor!=='string'||!/^\d+(\.\d{1,2})?$/.test(valor)))throw new Error('Preço local inválido. Confira o cadastro do produto.');
  const numero=Number(valor),centavos=Math.round(numero*100);
  if(!Number.isFinite(numero)||numero<0||!Number.isSafeInteger(centavos)||centavos>1e9||Math.abs(numero*100-centavos)>1e-7)throw new Error('Preço local inválido. Confira o cadastro do produto.');
  return centavos;
}
module.exports={normalizarVendaLocal,dinheiroRecebidoCentavos,validarPagamentos,validarAjuste,precoProdutoLocalCentavos};
