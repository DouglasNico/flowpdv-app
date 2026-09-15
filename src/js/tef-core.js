/**
 * tef-core.js - Regras puras do TEF (sem DOM, sem rede, sem DLL).
 *
 * Stone Connect 2.0: pedido na API Pagar.me que a maquininha Stone recebe.
 * SiTef (CliSiTef): protocolo interativo por comandos, tratado no main.js;
 * aqui ficam só as traduções de texto/campos.
 */

export const STONE_API = 'https://api.pagar.me';
export const STONE_TIMEOUT_MS = 180 * 1000;
export const STONE_POLL_MS = 2000;

const centavos = (v) => Math.round((Number(v) || 0) * 100);

// ---------------------------------------------------------------------------
// Stone Connect
// ---------------------------------------------------------------------------

/**
 * Corpo do pedido direto para a maquininha Stone.
 * @param params { valor, tipo: 'Débito'|'Crédito'|'Pix'|'Voucher', parcelas, descricao, itens?, cliente? }
 * @param cfg    config do TEF (serialMaquininha, recipientId)
 */
export function montarPedidoStone(params, cfg = {}) {
  const valor = centavos(params.valor);
  if (valor <= 0) throw new Error('Valor inválido para o TEF.');

  const tipo = tipoStone(params.tipo);
  const parcelas = Math.max(1, parseInt(params.parcelas, 10) || 1);

  const items = (Array.isArray(params.itens) && params.itens.length > 0)
    ? params.itens.map(i => ({
        amount: Math.max(1, centavos(i.precoUnitario)),
        description: String(i.nome || 'Item').slice(0, 64),
        quantity: Math.max(1, Math.round(Number(i.quantidade) || 1))
      }))
    : [{ amount: valor, description: String(params.descricao || 'Venda FlowPDV').slice(0, 64), quantity: 1 }];

  // A Stone valida amount x quantity contra o total: quando os itens não
  // fecham (peso, desconto), manda um item único com o valor cobrado.
  const somaItens = items.reduce((a, i) => a + i.amount * i.quantity, 0);
  const itensFinais = somaItens === valor ? items : [{ amount: valor, description: String(params.descricao || 'Venda FlowPDV').slice(0, 64), quantity: 1 }];

  const payment_setup = { type: tipo, installments: tipo === 'credit' ? parcelas : 1, installment_type: 'merchant' };
  if (cfg.recipientId) {
    payment_setup.split = [{
      recipient_id: String(cfg.recipientId).trim(),
      type: 'percentage',
      amount: 100,
      options: { liable: true, charge_remainder_fee: true, charge_processing_fee: true }
    }];
  }

  const pedido = {
    closed: false,
    items: itensFinais,
    poi_payment_settings: {
      visible: true,
      print_order_receipt: cfg.imprimirNaMaquininha !== false,
      devices_serial_number: cfg.serialMaquininha ? [String(cfg.serialMaquininha).trim()] : [],
      payment_setup,
      display_name: String(params.descricao || 'FlowPDV').slice(0, 30)
    }
  };

  if (params.cliente && (params.cliente.nome || params.cliente.email)) {
    pedido.customer = {};
    if (params.cliente.nome) pedido.customer.name = String(params.cliente.nome).slice(0, 64);
    if (params.cliente.email) pedido.customer.email = params.cliente.email;
  }
  if (params.codigo) pedido.code = String(params.codigo).slice(0, 52);
  return pedido;
}

export function tipoStone(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('déb') || t.includes('deb')) return 'debit';
  if (t.includes('pix')) return 'pix';
  if (t.includes('voucher') || t.includes('vale') || t.includes('alimenta') || t.includes('refei')) return 'voucher';
  return 'credit';
}

/**
 * Lê o pedido devolvido pela Stone (criação ou consulta).
 * @returns {{estado:'aguardando'|'aprovada'|'recusada'|'cancelada', dados, mensagem}}
 */
export function interpretarPedidoStone(order, valorEsperado = null) {
  const o = order && typeof order === 'object' ? order : {};
  const charges = Array.isArray(o.charges) ? o.charges : [];
  const pagas = charges.filter(c => c && c.status === 'paid');
  const totalPago = pagas.reduce((n, c) => n + Number(c.paid_amount ?? c.amount ?? 0), 0);
  const esperado = valorEsperado == null ? Number(o.amount || totalPago) : centavos(valorEsperado);
  const paga = pagas[0];
  if (paga && totalPago === esperado && esperado > 0 && !charges.some(c => c && ['pending', 'processing'].includes(c.status))) {
    const t = paga.last_transaction || {};
    const card = t.card || {};
    return {
      estado: 'aprovada',
      mensagem: 'Pagamento aprovado.',
      dados: {
        sucesso: true,
        provedor: 'stone',
        pedidoId: o.id || '',
        chargeId: paga.id || '',
        chargeIds: pagas.map(c => c.id).filter(Boolean),
        transacaoId: t.id || '',
        nsu: String(t.acquirer_nsu || t.nsu || paga.id || ''),
        autorizacao: String(t.acquirer_auth_code || t.authorization_code || ''),
        bandeira: card.brand ? capitalizar(card.brand) : (t.brand ? capitalizar(t.brand) : ''),
        finalCartao: card.last_four_digits || '',
        tipo: t.payment_method === 'debit_card' ? 'Débito' : (t.payment_method === 'pix' ? 'Pix' : (t.payment_method === 'voucher' ? 'Voucher' : 'Crédito')),
        parcelas: t.installments || 1,
        valor: totalPago / 100,
        rede: 'Stone',
        dataHora: paga.paid_at || paga.updated_at || new Date().toISOString()
      }
    };
  }
  if (pagas.length) return { estado: 'aguardando', mensagem: 'Pagamento parcial ou divergente. Confira todas as cobranças.', dados: null };
  if (charges.some(c => !c || !['failed', 'canceled', 'voided'].includes(c.status))) return { estado: 'aguardando', mensagem: 'Há cobranças ainda pendentes.', dados: null };
  const falhou = charges.find(c => c && (c.status === 'failed' || c.status === 'canceled' || c.status === 'voided'));
  if (falhou) {
    const t = falhou.last_transaction || {};
    return {
      estado: 'recusada',
      mensagem: t.acquirer_message || t.gateway_response?.errors?.[0]?.message || 'Transação não aprovada na maquininha.',
      dados: null
    };
  }
  if (o.status === 'canceled' || o.status === 'failed') {
    return { estado: 'cancelada', mensagem: 'Pedido cancelado.', dados: null };
  }
  return { estado: 'aguardando', mensagem: 'Aguardando o cliente na maquininha...', dados: null };
}

function capitalizar(s) {
  const t = String(s || '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

// Mensagem legível para erros HTTP da API Stone/Pagar.me.
export function mensagemErroStone(status, body) {
  const b = body && typeof body === 'object' ? body : {};
  if (status === 0) return b.mensagem || 'Sem conexão com a Stone.';
  if (status === 401) return 'Chave secreta (sk_) da Stone inválida.';
  if (status === 403) return 'Conta Stone sem permissão para o Connect. Verifique o credenciamento no Programa de Parceiros.';
  if (status === 404) return 'Pedido não encontrado na Stone.';
  if (b.message) {
    const det = b.errors ? Object.values(b.errors).flat().join('; ') : '';
    return [b.message, det].filter(Boolean).join(' - ');
  }
  return `Stone respondeu HTTP ${status}.`;
}

// ---------------------------------------------------------------------------
// SiTef
// ---------------------------------------------------------------------------

// Código de função da CliSiTef para a forma escolhida no PDV.
export function funcaoSitef(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('déb') || t.includes('deb')) return 2;
  if (t.includes('cré') || t.includes('cre')) return 3;
  if (t.includes('pix') || t.includes('carteira')) return 122;
  if (t.includes('voucher') || t.includes('vale') || t.includes('alimenta') || t.includes('refei')) return 5;
  return 0; // menu genérico
}

// Valor no formato que a CliSiTef exige: "10,00".
export function valorSitef(valor) {
  return (Number(valor) || 0).toFixed(2).replace('.', ',');
}

// "1:Crédito;2:Débito;" -> [{indice:'1', texto:'Crédito'}, ...]
export function parseMenuSitef(buffer) {
  const txt = String(buffer || '');
  const semClasse = txt.includes('|') ? txt.split('|').slice(1).join('|') : txt;
  return semClasse.split(';').map(s => s.trim()).filter(Boolean).map(op => {
    const partes = op.split(':');
    return { indice: partes[0].trim(), texto: (partes[1] || partes[0]).trim() };
  });
}

// Campos devolvidos pelo comando 0 (TipoCampo -> valor) virando dados da venda.
export function interpretarCamposSitef(campos, contexto = {}) {
  const c = campos || {};
  const modalidade = String(c[100] || '');
  const dataHora = String(c[105] || '');
  const iso = dataHora.length === 14
    ? `${dataHora.slice(0, 4)}-${dataHora.slice(4, 6)}-${dataHora.slice(6, 8)}T${dataHora.slice(8, 10)}:${dataHora.slice(10, 12)}:${dataHora.slice(12, 14)}`
    : new Date().toISOString();
  return {
    sucesso: true,
    provedor: 'sitef',
    modalidade,
    descricaoModalidade: String(c[101] || c[102] || ''),
    nsu: String(c[133] || ''),
    nsuHost: String(c[134] || ''),
    autorizacao: String(c[135] || ''),
    bandeira: String(c[132] || c[131] || ''),
    bin: String(c[136] || ''),
    tipo: contexto.tipo || (modalidade.startsWith('01') ? 'Débito' : (modalidade.startsWith('02') ? 'Crédito' : '')),
    parcelas: contexto.parcelas || 1,
    valor: contexto.valor,
    rede: String(c[157] || c[158] || 'SiTef'),
    comprovanteCliente: String(c[121] || ''),
    comprovanteLoja: String(c[122] || ''),
    dataHora: iso
  };
}

// Códigos de retorno finais da CliSiTef em texto para o operador.
export function mensagemRetornoSitef(codigo) {
  const n = Number(codigo);
  const mapa = {
    0: 'Transação concluída.',
    '-1': 'CliSiTef não inicializada. Confira IP, loja e terminal.',
    '-2': 'Operação cancelada pelo operador.',
    '-3': 'Função/modalidade inválida.',
    '-4': 'Falta de memória no PDV.',
    '-5': 'Sem comunicação com o servidor SiTef.',
    '-6': 'Operação cancelada pelo cliente no pinpad.',
    '-8': 'CliSiTef desatualizada para esta função.',
    '-9': 'Fluxo interativo não iniciado.',
    '-10': 'Parâmetro obrigatório não informado.',
    '-12': 'Processo interativo anterior não foi concluído.',
    '-13': 'Documento fiscal não encontrado na CliSiTef.',
    '-15': 'Operação cancelada pela automação.',
    '-20': 'Parâmetro inválido passado à CliSiTef.',
    '-21': 'Utilização de função inválida.',
    '-25': 'Erro na leitura do cartão / pinpad.',
    '-30': 'Erro de acesso ao arquivo da CliSiTef.',
    '-40': 'Transação negada pelo SiTef.',
    '-41': 'Dados inválidos.',
    '-43': 'Problema no pinpad.',
    '-50': 'Transação não segura.',
    '-100': 'Erro interno da CliSiTef.'
  };
  if (mapa[n] != null) return mapa[n];
  if (n > 0) return `Negada pelo autorizador (código ${n}).`;
  return `Erro CliSiTef ${n}.`;
}

// Códigos de erro da ConfiguraIntSiTefInterativoEx.
export function mensagemConfiguraSitef(codigo) {
  const mapa = {
    0: 'OK',
    1: 'Endereço IP do SiTef inválido ou não resolvido.',
    2: 'Código da loja inválido (8 dígitos).',
    3: 'Código do terminal inválido (formato AA000001).',
    6: 'Erro na inicialização do TCP/IP.',
    7: 'Falta de memória.',
    8: 'Não encontrou a CliSiTef ou ela está com problemas.',
    9: 'Configuração de servidores SiTef foi excedida.',
    10: 'Erro de acesso na pasta CliSiTef (permissão de escrita).',
    11: 'Dados inválidos passados pela automação.',
    12: 'Modo seguro não ativo.',
    13: 'Caminho da DLL inválido.'
  };
  return mapa[Number(codigo)] || `Erro ${codigo} ao configurar a CliSiTef.`;
}
