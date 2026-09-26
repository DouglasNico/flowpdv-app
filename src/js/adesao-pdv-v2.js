// Confere a cópia local antes de trocar o motor de venda. Nunca ajusta saldos
// silenciosamente nem converte um turno já aberto para o novo servidor.
export function confirmarAdesaoPdvV2({ storage, servico, resposta }) {
  if (resposta?.liberado !== true) return false;
  const licenca = servico.getLicenca();
  if (resposta.schema !== 1 || !resposta.lojaId
    || (licenca?.chaveLicenca || licenca?.clienteId) !== resposta.chaveLicenca
    || resposta.deviceId !== servico.getDeviceId() || servico.getTipoTerminal() !== 'caixa'
    || !Number.isSafeInteger(resposta.revisao) || resposta.revisao < 1) throw Error('Preparação não corresponde a este caixa.');
  if (storage.getItem('flowpdv_operacao_oficial_v2')) return true;
  servico.exigirVendaRecuperada();
  if (servico.getTurnoAtual()) throw Error('Feche o caixa atual antes de conectar o recebimento integrado.');
  if (!Array.isArray(resposta.produtos)) throw Error('Preparação de produtos incompleta.');
  const produtos = servico.getProdutos();
  if (produtos.length !== resposta.produtos.length) throw Error('O catálogo local mudou. Confira a migração antes de conectar.');
  const ids = new Set();
  const registros = resposta.produtos.map(p => {
    const local = produtos.find(x => String(x.id) === p.id);
    if (ids.has(p.id) || !local || !Number.isSafeInteger(p.precoCentavos)
      || Math.round(Number(local.precoVenda) * 100) !== p.precoCentavos
      || (local.controlarEstoque === false) !== p.semEstoque
      || (!p.semEstoque && (!Number.isSafeInteger(p.saldoMili) || Math.round(Number(local.estoque) * 1000) !== p.saldoMili))) throw Error('Preço ou estoque local diverge da preparação. A conexão não foi ativada.');
    ids.add(p.id);
    return { status:'confirmado', lojaId:resposta.lojaId, produto:local, ...(p.semEstoque ? {semEstoque:true} : {estoqueId:p.id}) };
  });
  // Primeiro bloqueia o motor legado; falha de espaço nunca causa baixa dupla.
  storage.setItem('flowpdv_migracoes_estoque_teste', JSON.stringify(registros));
  storage.setItem('flowpdv_operacao_oficial_v2', JSON.stringify({schema:1,lojaId:resposta.lojaId,chaveLicenca:resposta.chaveLicenca,deviceId:resposta.deviceId,revisao:resposta.revisao}));
  return true;
}
