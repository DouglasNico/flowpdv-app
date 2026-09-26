import { usarFluxoOperacionalV2, usarAplicativoIntegradoV2, usarPdvOficialV2 } from './perfil-operacional-v2.js';
import { criarVendaServidorTeste, precoProdutoLocalCentavos } from './venda-servidor-teste.js';
import { sessaoTerminalTeste } from './sessoes-homologacao.js';

// Ativação restrita ao perfil descartável de homologação do aplicativo completo.
export function usarVendaAplicativoCompleto() {
  return usarFluxoOperacionalV2() && usarAplicativoIntegradoV2();
}

export function prepararVendaAplicativo({ ponte, servico, usuario, carrinho, totais, pagamentos, podeDesconto }) {
  if (!usuario) throw new Error('Entre como operador antes de vender.');
  if (ponte.pendente()) throw new Error('Retome a venda pendente no painel de caixa. Não cobre novamente.');
  servico.exigirVendaRecuperada();
  if (!Array.isArray(carrinho) || !carrinho.length) throw new Error('Adicione produtos ao carrinho.');
  const produtos = servico.getProdutos();
  const linhas = carrinho.map(item => {
    const produto = produtos.find(p => String(p.id) === String(item.id));
    if (!produto || item.isFardo || item.comandaOrigemId) throw new Error('Produto, embalagem ou comanda não suportado nesta venda integrada.');
    if (precoProdutoLocalCentavos({ precoVenda: item.precoUnitario }) !== precoProdutoLocalCentavos(produto)) throw new Error('O preço mudou. Confira o carrinho antes de receber.');
    return { produto, quantidade: item.quantidade };
  });
  const centavos = valor => {
    // Tolera apenas o resíduo binário da soma feita pelo PDV, nunca fração de centavo.
    if (typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001) valor = Math.round(valor * 100) / 100;
    return precoProdutoLocalCentavos({ precoVenda: valor });
  };
  const subtotal = linhas.reduce((s, l) => s + Math.round(Number(l.quantidade) * precoProdutoLocalCentavos(l.produto)), 0);
  const total = centavos(totais.total), desconto = subtotal - total;
  if (centavos(totais.subtotal) !== subtotal || desconto < 0) throw new Error('Totais divergentes. Confira os produtos e quantidades.');
  if (desconto && !podeDesconto) throw new Error('Este operador não tem permissão para dar desconto.');
  if (!Array.isArray(pagamentos) || !pagamentos.length) throw new Error('Informe o pagamento manual.');
  const formasManuais = ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Voucher'];
  const formaCanon = forma => {
    if (formasManuais.includes(forma)) return forma;
    // Lançamentos legados do PDV usavam "VR - Refeição", "Alelo - Alimentação", etc.
    if (typeof forma === 'string' && (/^(VR|Alelo|Pluxee|Ticket|Outros)\s*-/i.test(forma) || /voucher/i.test(forma))) return 'Voucher';
    return forma;
  };
  const outrasCentavos = {}; let dinheiro = 0, recebido = 0, pago = 0;
  for (const p of pagamentos) {
    const forma = formaCanon(p.forma);
    if (!formasManuais.includes(forma) || p.tefInfo || p.dadosTef || p.tef || p.nsuTef || p.transacaoId) throw new Error('Use apenas dinheiro, Pix, cartão ou voucher manual nesta integração.');
    const valor = centavos(p.valor); if (!valor) throw new Error('O pagamento precisa ser positivo.');
    pago += valor;
    if (forma === 'Dinheiro') {
      const entregue = centavos(p.valorEntregue ?? p.valor);
      if (entregue < valor) throw new Error('Dinheiro entregue insuficiente.');
      dinheiro += valor; recebido += entregue;
    } else outrasCentavos[forma] = (outrasCentavos[forma] || 0) + valor;
  }
  if (pago !== total || recebido < dinheiro) throw new Error('Os pagamentos precisam corresponder ao total, com o troco separado.');
  const outras = Object.keys(outrasCentavos).length
    ? Object.fromEntries(Object.entries(outrasCentavos).map(([forma, valor]) => [forma, valor / 100]))
    : undefined;
  const plano = ponte.prepararCarrinho(linhas, recebido / 100, outras, desconto ? { desconto: desconto / 100, acrescimo: 0, motivo: 'Desconto autorizado no caixa do aplicativo' } : undefined);
  plano.venda.operador = usuario.nome;
  plano.venda.operadorId = usuario.id || null;
  plano.venda.origemAplicativoCompleto = true;
  return plano;
}

function prepararChamada({ servico, auth }) {
  if (!usarVendaAplicativoCompleto()) throw new Error('Integração disponível apenas na homologação.');
  if (document.body.classList.contains('tela-login-ativa')) throw new Error('Entre como operador antes de vender.');
  if (servico.isModuloAtivo('fiscalNfce') && servico.getFiscalConfig()?.habilitado) throw new Error('A emissão fiscal ainda precisa ser integrada ao novo registro de venda.');
  const sessao = sessaoTerminalTeste();
  const usuario = auth.getUsuario();
  const conferirOperador = () => {
    if (!usuario || auth.getUsuario() !== usuario || document.body.classList.contains('tela-login-ativa')) throw new Error('Operador alterado. Confira as pendências antes de continuar.');
  };
  const call = async (nome, dados) => { conferirOperador(); const resposta = await sessao.call(nome, dados); conferirOperador(); return resposta; };
  const ponte = criarVendaServidorTeste({ storage: localStorage, servico, ambienteTeste: true, call, uuid: () => crypto.randomUUID(), agora: () => new Date().toISOString() });
  return { usuario, call, ponte };
}

async function conferirCaixa(call, lojaId) {
  const agora = Date.now();
  const cache = registrarVendaAplicativo.conferencia;
  let acesso, binding;
  if (cache && cache.lojaId === lojaId && agora - cache.em < 120000) {
    acesso = cache.acesso;
    binding = cache.binding;
  } else {
    [acesso, binding] = await Promise.all([
      call('consultarAtivacaoOperacionalV2', {}),
      call('consultarMeuTerminalV2', {})
    ]);
  }
  if (acesso.lojaId !== lojaId || acesso.papel !== 'caixa' || acesso.homologacaoHabilitada !== true || acesso.modulos?.balcao !== true || !binding?.vinculado || binding.lojaId !== lojaId || binding.papel !== 'caixa') {
    registrarVendaAplicativo.conferencia = null;
    throw new Error('Ative explicitamente o balcão desta loja na homologação antes de vender.');
  }
  registrarVendaAplicativo.conferencia = { lojaId, acesso, binding, em: agora };
  return binding;
}

export async function registrarVendaAplicativo({ servico, auth, carrinho, totais, pagamentos }) {
  const { usuario, call, ponte } = prepararChamada({ servico, auth });
  const plano = prepararVendaAplicativo({ ponte, servico, usuario, carrinho, totais, pagamentos, podeDesconto: auth.temPermissao('darDesconto') });
  const binding = await conferirCaixa(call, plano.lojaId);
  try {
    return await ponte.executar(plano, binding);
  } catch (error) {
    registrarVendaAplicativo.conferencia = null;
    throw error;
  }
}

export async function retomarVendaAplicativo({ servico, auth }) {
  const { call, ponte } = prepararChamada({ servico, auth });
  const pendente = ponte.pendente();
  if (!pendente) return null;
  const binding = await conferirCaixa(call, pendente.lojaId);
  try {
    return await ponte.executar(undefined, binding);
  } catch (error) {
    registrarVendaAplicativo.conferencia = null;
    throw error;
  }
}
