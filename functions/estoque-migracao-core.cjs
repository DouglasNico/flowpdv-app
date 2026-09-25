// Conversão compartilhada pelo painel e servidor. Nunca arredonda saldo silenciosamente.
function planejarSaldoLegado(item) {
  if(!item||!['string','number'].includes(typeof item.id)||!String(item.id)||String(item.id).length>100||typeof item.nome!=='string'||!item.nome.trim()||item.nome.length>80) throw new Error('Produto sem identificação ou nome válido.');
  if(item.controlarEstoque===false) throw new Error('Produto não controla estoque.');
  if(item.precoFardo||item.codigoBarrasFardo||item.unidadeFracionada||Number(item.fatorConversao||1)!==1) throw new Error('Produto com embalagem alternativa exige conferência manual antes de migrar.');
  const origem=String(item.unidade||'').trim().toLowerCase();
  const unidades={un:['un',1000],kg:['kg',1000],g:['kg',1],l:['litro',1000],litro:['litro',1000],ml:['litro',1]};
  if(!unidades[origem]) throw new Error('Unidade ausente ou não suportada. Confira o cadastro.');
  const raw=String(item.estoque).trim().replace(',','.');
  if(!/^\d+(\.\d{1,3})?$/.test(raw)) throw new Error('Saldo inválido: use quantidade não negativa com até três casas.');
  const [inteira,fracao='']=raw.split('.'), milesimos=Number(inteira)*1000+Number(fracao.padEnd(3,'0'));
  const [unidade,fator]=unidades[origem],saldoMili=milesimos*fator/1000;
  if(!Number.isSafeInteger(saldoMili)||saldoMili>1000000000) throw new Error('Conversão perde precisão ou excede o limite de saldo.');
  return {legadoId:String(item.id),nome:item.nome.trim(),unidadeOrigem:origem,saldoOrigem:raw,unidade,saldoMili};
}
module.exports={planejarSaldoLegado};
