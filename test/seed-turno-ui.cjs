// Loja fictícia: cria somente estado local de demonstração, sem sincronizar legado.
module.exports = async win => win.webContents.executeJavaScript(`(() => {
  const terminalId = window.StorageService.getDeviceId();
  localStorage.setItem('adega_produtos',JSON.stringify([{id:'farinha-legado-teste',nome:'Farinha local fictícia',estoque:2500,unidade:'g',controlarEstoque:true,precoVenda:0.02},{id:'acucar-legado-teste',nome:'Açúcar local fictício',estoque:1,unidade:'kg',controlarEstoque:true,preco:8}]));window.StorageService._produtosMem=null;
  localStorage.setItem('adega_turno_atual', JSON.stringify({ id:'TRN-DEMO-ATUAL', terminalId, dataAbertura:new Date().toISOString(), status:'aberto', trocoInicial:0, sangrias:[] }));
  localStorage.setItem('adega_vendas', JSON.stringify([{id:'VENDA-LOCAL-DEMO', turnoId:'TRN-DEMO-ATUAL', terminalId, total:5, formaPagamento:'Dinheiro', itens:[], data:new Date().toISOString()}]));
})()`);
