// Expande somente para cálculo de estoque. A linha comercial e seu preço são preservados.
function linhasDeEstoque(linhas) {
  if (!Array.isArray(linhas) || linhas.length > 300) throw new Error('Itens do atendimento inválidos.');
  const id = valor => typeof valor === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(valor);
  const quantidade = valor => Number.isSafeInteger(valor) && valor > 0 && valor <= 99;
  return linhas.flatMap(linha => {
    if (linha.variante !== 'combo') {
      if (linha.componentes?.length) throw new Error('Composição sem identificação de combo.');
      return [linha];
    }
    const componentes = linha.componentes;
    if (linha.ofertasVersao !== 1 || !quantidade(linha.quantidade) || !id(linha.produtoId)
      || !Array.isArray(componentes) || componentes.length < 2 || componentes.length > 22
      || !id(linha.bebidaId) || linha.bebidaId === linha.produtoId) throw new Error('Composição do combo inválida.');
    if (componentes.some(c => !c || !id(c.produtoId) || !quantidade(c.quantidade))) throw new Error('Componente do combo inválido.');
    if (componentes[0].produtoId !== linha.produtoId || componentes[0].quantidade !== 1
      || componentes.slice(1).some(c => c.produtoId === linha.produtoId)
      || componentes.at(-1).produtoId !== linha.bebidaId || componentes.at(-1).quantidade !== 1) throw new Error('Lanche ou bebida não corresponde ao combo recebido.');
    // A mesma bebida pode também constar como acompanhamento fixo: as quantidades se somam.
    return componentes.map((componente, index) => ({
      produtoId: componente.produtoId,
      nome: componente.nome || componente.produtoId,
      quantidade: linha.quantidade * componente.quantidade,
      opcoes: index === 0 ? linha.opcoes || [] : []
    }));
  });
}

module.exports = { linhasDeEstoque };
