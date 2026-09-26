// Somente texto de edição: nunca restaura preço, autorização, venda ou confirmação.
export function criarRascunhoCarrinhoTeste({storage,ambienteTeste}) {
  if(ambienteTeste!==true)throw new Error('Rascunho disponível somente no teste.');
  const campos=['local-stock-product','local-stock-quantity','local-stock-cash','local-pay-pix','local-pay-debit','local-pay-credit','local-discount','local-surcharge','local-adjust-reason'];
  const chave=contexto=>{
    if(!contexto||['lojaId','terminalId','turnoId','dataAbertura'].some(k=>typeof contexto[k]!=='string'||!contexto[k]||contexto[k].length>180))throw new Error('Confirme loja, terminal e turno antes de editar o carrinho.');
    return 'flowpdv_rascunho_carrinho_v1:'+JSON.stringify([contexto.lojaId,contexto.terminalId,contexto.turnoId,contexto.dataAbertura]);
  };
  function validar(dados){
    if(!dados||dados.versao!==1||!Array.isArray(dados.itens)||dados.itens.length>30||!dados.campos||typeof dados.campos!=='object')throw new Error('Rascunho inválido. Descarte o rascunho para começar novamente.');
    const ids=new Set(),itens=dados.itens.map(i=>{
      if(!i||typeof i.id!=='string'||!i.id||i.id.length>100||ids.has(i.id)||typeof i.quantidade!=='string'||i.quantidade.length>40)throw new Error('Itens do rascunho inválidos.');
      ids.add(i.id);return {id:i.id,quantidade:i.quantidade};
    });
    const valores={};for(const campo of campos){const v=dados.campos[campo]??'';if(typeof v!=='string'||v.length>(campo==='local-adjust-reason'?180:100))throw new Error('Campos do rascunho inválidos.');valores[campo]=v;}
    return {versao:1,itens,campos:valores};
  }
  function carregar(contexto){const raw=storage.getItem(chave(contexto));if(raw===null)return null;if(raw.length>20000)throw new Error('Rascunho excede o limite.');let data;try{data=JSON.parse(raw);}catch{throw new Error('Rascunho ilegível. Descarte o rascunho para começar novamente.');}return validar(data);}
  function salvar(contexto,dados){storage.setItem(chave(contexto),JSON.stringify(validar({...dados,versao:1})));}
  function remover(contexto){storage.removeItem(chave(contexto));}
  return {campos,chave,carregar,salvar,remover};
}
