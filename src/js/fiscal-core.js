/**
 * fiscal-core.js - Regras puras da NFC-e (sem DOM, sem rede).
 *
 * Monta o payload no formato da API Focus NFe e interpreta a resposta.
 * Documentação: https://doc.focusnfe.com.br/reference/emitir_nfce
 */

export const FOCUS_URLS = {
  producao: 'https://api.focusnfe.com.br',
  homologacao: 'https://homologacao.focusnfe.com.br'
};

// SEFAZ permite cancelar NFC-e em até 30 minutos após a autorização.
export const JANELA_CANCELAMENTO_MS = 30 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

export function somenteDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

// Código SEFAZ (tPag) para a forma de pagamento como o PDV grava.
export function codigoSefazPagamento(forma) {
  const f = String(forma || '').toLowerCase();
  if (f.includes('dinheiro')) return '01';
  if (f.includes('cheque')) return '02';
  if (f.includes('fiado') || f.includes('crédito loja') || f.includes('credito loja')) return '05';
  if (f.includes('crédito') || f.includes('credito')) return '03';
  if (f.includes('débito') || f.includes('debito')) return '04';
  if (f.includes('alimenta')) return '10';
  if (f.includes('refei')) return '11';
  if (f.includes('vale')) return '13';
  if (f.includes('pix')) return '17';
  return '99';
}

// Data no formato que a Focus exige: ISO com fuso (ex.: 2026-09-14T12:00:00-03:00).
export function dataEmissaoISO(agora = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const off = -agora.getTimezoneOffset();
  const sinal = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}` +
    `T${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}` +
    `${sinal}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// Pagamentos líquidos da venda (sem troco), na ordem em que o PDV gravou.
export function pagamentosDaVenda(venda) {
  const lista = [];
  if (venda.pagamentoDividido && Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0) {
    venda.pagamentos.forEach(p => lista.push({ forma: p.forma, valor: round2(p.valor) }));
  } else if (venda.pagamentoDividido && (venda.parcela1 || venda.parcela2)) {
    if (venda.parcela1) lista.push({ forma: venda.parcela1.forma, valor: round2(venda.parcela1.valor) });
    if (venda.parcela2) lista.push({ forma: venda.parcela2.forma, valor: round2(venda.parcela2.valor) });
  } else {
    lista.push({ forma: venda.formaPagamento || 'Dinheiro', valor: round2(venda.total) });
  }
  return lista.filter(p => p.valor > 0);
}

/**
 * Monta o corpo da requisição da NFC-e.
 * @param venda   venda gravada pelo PDV
 * @param cfg     StorageService.getFiscalConfig()
 * @param produtosPorId  Map id -> produto (para NCM/CFOP/CSOSN/origem cadastrados)
 * @param agora   Date (injetável para teste)
 */
export function montarPayloadNFCe(venda, cfg, produtosPorId = new Map(), agora = new Date()) {
  const cnpj = somenteDigitos(cfg.cnpjEmitente);
  if (cnpj.length !== 14) {
    throw new Error('CNPJ do emitente inválido na configuração fiscal.');
  }

  const total = round2(venda.total);
  if (total <= 0) {
    throw new Error('Venda sem valor (R$ 0,00) não gera NFC-e.');
  }

  const itens = (venda.itens || []).filter(i => (parseFloat(i.quantidade) || 0) > 0);
  if (itens.length === 0) {
    throw new Error('Venda sem itens não gera NFC-e.');
  }

  // Bruto por item; o desconto total da venda (manual + clube) é rateado
  // proporcionalmente e o último item absorve a diferença de centavos.
  const brutos = itens.map(i => round2((parseFloat(i.precoUnitario) || 0) * (parseFloat(i.quantidade) || 0)));
  const somaBruta = round2(brutos.reduce((a, b) => a + b, 0));
  const descontoTotal = Math.max(0, round2(somaBruta - total));
  let descontoAcumulado = 0;

  const items = itens.map((item, idx) => {
    const prod = produtosPorId.get(item.id) || produtosPorId.get(String(item.id)) || {};
    const ncm = somenteDigitos(item.ncm || prod.ncm || cfg.ncmPadrao) || '22030000';
    const cfop = somenteDigitos(item.cfop || prod.cfop || cfg.cfopPadrao) || '5102';
    const csosn = somenteDigitos(item.csosn || prod.csosn || cfg.csosnPadrao) || '102';
    const origem = String(item.icmsOrigem ?? prod.icmsOrigem ?? '0');
    const qtd = round4(item.quantidade);
    const precoUnit = round2(item.precoUnitario);
    const bruto = brutos[idx];
    const ehKg = item.permiteFracionado === true || String(item.unidade || prod.unidade || '').toLowerCase() === 'kg';
    const unidade = ehKg ? 'KG' : 'UN';

    let desconto = 0;
    if (descontoTotal > 0 && somaBruta > 0) {
      desconto = idx === itens.length - 1
        ? round2(descontoTotal - descontoAcumulado)
        : round2(descontoTotal * (bruto / somaBruta));
      desconto = Math.min(desconto, bruto);
      descontoAcumulado = round2(descontoAcumulado + desconto);
    }

    const it = {
      numero_item: String(idx + 1),
      codigo_produto: String(item.codigoBarras || prod.codigoBarras || item.id || idx + 1).slice(0, 60),
      codigo_barras_comercial: somenteDigitos(item.codigoBarras || prod.codigoBarras) || 'SEM GTIN',
      codigo_barras_tributavel: somenteDigitos(item.codigoBarras || prod.codigoBarras) || 'SEM GTIN',
      descricao: String(item.nome || 'ITEM').slice(0, 120),
      codigo_ncm: ncm,
      cfop,
      unidade_comercial: unidade,
      quantidade_comercial: qtd,
      valor_unitario_comercial: precoUnit,
      unidade_tributavel: unidade,
      quantidade_tributavel: qtd,
      valor_unitario_tributavel: precoUnit,
      valor_bruto: bruto,
      icms_origem: origem,
      icms_situacao_tributaria: csosn,
      pis_situacao_tributaria: '49',
      cofins_situacao_tributaria: '49',
      inclui_no_total: '1'
    };
    if (desconto > 0) it.valor_desconto = desconto;
    if (prod.cest) it.cest = somenteDigitos(prod.cest);
    return it;
  });

  const formas_pagamento = pagamentosDaVenda(venda).map(p => ({
    forma_pagamento: codigoSefazPagamento(p.forma),
    valor_pagamento: p.valor
  }));
  const somaPag = round2(formas_pagamento.reduce((a, p) => a + p.valor_pagamento, 0));
  if (formas_pagamento.length === 0 || Math.abs(somaPag - total) > 0.011) {
    // Última defesa: SEFAZ rejeita se pagamentos != total. Ajusta o último.
    if (formas_pagamento.length === 0) {
      formas_pagamento.push({ forma_pagamento: codigoSefazPagamento(venda.formaPagamento), valor_pagamento: total });
    } else {
      const ultimo = formas_pagamento[formas_pagamento.length - 1];
      ultimo.valor_pagamento = round2(ultimo.valor_pagamento + (total - somaPag));
    }
  }

  const payload = {
    cnpj_emitente: cnpj,
    data_emissao: dataEmissaoISO(agora),
    natureza_operacao: cfg.naturezaOperacao || 'VENDA AO CONSUMIDOR',
    presenca_comprador: '1',
    modalidade_frete: '9',
    local_destino: '1',
    indicador_inscricao_estadual_destinatario: '9',
    items,
    formas_pagamento
  };

  const serie = parseInt(cfg.serieNfce, 10);
  if (serie > 0) payload.serie = String(serie);

  const doc = somenteDigitos(venda.cpfCliente);
  if (doc.length === 11) payload.cpf_destinatario = doc;
  else if (doc.length === 14) payload.cnpj_destinatario = doc;
  if (venda.nomeCliente && doc) payload.nome_destinatario = String(venda.nomeCliente).slice(0, 60);

  const obs = [];
  if (venda.numeroVenda) obs.push(`Venda #${String(venda.numeroVenda).padStart(6, '0')}`);
  if (venda.operadorNome || venda.operador) obs.push(`Operador: ${venda.operadorNome || venda.operador}`);
  if (obs.length) payload.informacoes_adicionais_contribuinte = obs.join(' | ').slice(0, 2000);

  return payload;
}

/**
 * Normaliza a resposta HTTP da Focus para o que o PDV grava na venda.
 * @returns {{estado: 'autorizada'|'rejeitada'|'processando'|'cancelada'|'erro_config'|'erro_rede'|'nao_encontrada', mensagem, dados}}
 */
export function interpretarRespostaFocus(status, body) {
  const b = body && typeof body === 'object' ? body : {};

  if (status === 0 || status == null) {
    return { estado: 'erro_rede', mensagem: b.mensagem || 'Sem conexão com a Focus NFe.', dados: null };
  }
  if (status === 401) {
    return { estado: 'erro_config', mensagem: 'Token da Focus NFe inválido ou de outro ambiente.', dados: null };
  }
  if (status === 403 || b.codigo === 'permissao_negada') {
    return { estado: 'erro_config', mensagem: b.mensagem || 'CNPJ não autorizado neste token da Focus NFe.', dados: null };
  }
  if (status === 404) {
    return { estado: 'nao_encontrada', mensagem: b.mensagem || 'NFC-e não encontrada.', dados: null };
  }
  if (status >= 500) {
    return { estado: 'erro_rede', mensagem: `Focus NFe indisponível (HTTP ${status}).`, dados: null };
  }

  if (b.status === 'autorizado') {
    return { estado: 'autorizada', mensagem: b.mensagem_sefaz || 'Autorizado o uso da NFC-e', dados: dadosAutorizacao(b) };
  }
  if (b.status === 'cancelado') {
    return { estado: 'cancelada', mensagem: b.mensagem_sefaz || 'NFC-e cancelada', dados: dadosAutorizacao(b) };
  }
  if (b.status === 'processando_autorizacao') {
    return { estado: 'processando', mensagem: 'NFC-e em processamento na SEFAZ.', dados: null };
  }
  if (b.status === 'erro_autorizacao' || b.status === 'denegado') {
    return {
      estado: 'rejeitada',
      mensagem: `SEFAZ ${b.status_sefaz || ''}: ${b.mensagem_sefaz || 'Rejeitada'}`.trim(),
      dados: null
    };
  }

  if (b.codigo === 'already_processed') {
    // A ref já foi autorizada antes (reenvio duplicado). Quem chamou deve consultar.
    return { estado: 'ja_processada', mensagem: b.mensagem || 'Referência já utilizada.', dados: null };
  }
  if (b.codigo === 'pending_operation') {
    return { estado: 'processando', mensagem: b.mensagem || 'Em processamento.', dados: null };
  }
  if (['ambiente_nao_configurado', 'empresa_nao_configurada', 'erro_validacao', 'erro_validacao_schema', 'requisicao_invalida'].includes(b.codigo)) {
    const detalhes = Array.isArray(b.erros) ? b.erros.map(e => e.mensagem || e).join('; ') : '';
    return { estado: 'erro_config', mensagem: [b.mensagem, detalhes].filter(Boolean).join(' - '), dados: null };
  }

  return {
    estado: status >= 200 && status < 300 ? 'processando' : 'rejeitada',
    mensagem: b.mensagem || b.mensagem_sefaz || `Resposta inesperada (HTTP ${status}).`,
    dados: null
  };
}

function dadosAutorizacao(b) {
  const chave = String(b.chave_nfe || '').replace(/^NFe/i, '');
  return {
    chaveAcesso: chave,
    protocoloAutorizacao: b.protocolo || b.numero_protocolo || (b.protocolo_nota_fiscal && b.protocolo_nota_fiscal.numero_protocolo) || '',
    numeroNfce: parseInt(b.numero, 10) || null,
    serieNfce: parseInt(b.serie, 10) || null,
    qrcodeUrl: b.qrcode_url || '',
    urlConsulta: b.url_consulta_nfe || urlConsultaPorUf(chave.slice(0, 2)),
    caminhoXml: b.caminho_xml_nota_fiscal || '',
    caminhoDanfe: b.caminho_danfe || '',
    caminhoXmlCancelamento: b.caminho_xml_cancelamento || '',
    dataAutorizacao: new Date().toISOString()
  };
}

// Endereços públicos de consulta da NFC-e por UF (impressos no DANFE).
export function urlConsultaPorUf(codigoUf) {
  const mapa = {
    '35': 'www.nfce.fazenda.sp.gov.br/consulta',
    '33': 'www.nfce.fazenda.rj.gov.br/consulta',
    '31': 'nfce.fazenda.mg.gov.br/portalnfce',
    '41': 'www.fazenda.pr.gov.br/nfce/consulta',
    '43': 'www.sefaz.rs.gov.br/nfce/consulta',
    '42': 'sat.sef.sc.gov.br/nfce/consulta',
    '53': 'www.fazenda.df.gov.br/nfce/consulta',
    '52': 'www.nfce.go.gov.br/consulta',
    '29': 'www.sefaz.ba.gov.br/nfce/consulta',
    '26': 'nfce.sefaz.pe.gov.br/consulta',
    '23': 'nfce.sefaz.ce.gov.br/consulta',
    '32': 'app.sefaz.es.gov.br/ConsultaNFCe',
    '51': 'www.sefaz.mt.gov.br/nfce/consultanfce',
    '50': 'www.dfe.ms.gov.br/nfce/consulta',
    '13': 'sistemas.sefaz.am.gov.br/nfceweb/consulta',
    '15': 'appnfc.sefa.pa.gov.br/portal/consulta',
    '21': 'www.nfce.sefaz.ma.gov.br/portal/consulta',
    '25': 'www.receita.pb.gov.br/nfce/consulta',
    '24': 'nfce.set.rn.gov.br/consulta',
    '27': 'nfce.sefaz.al.gov.br/consulta',
    '28': 'www.nfce.se.gov.br/portal/consulta',
    '22': 'www.sefaz.pi.gov.br/nfce/consulta',
    '17': 'www.sefaz.to.gov.br/nfce/consulta',
    '11': 'www.nfce.sefin.ro.gov.br/consulta',
    '12': 'www.sefaznet.ac.gov.br/nfce/consulta',
    '14': 'www.sefaz.rr.gov.br/nfce/consulta',
    '16': 'www.sefaz.ap.gov.br/nfce/consulta'
  };
  return mapa[codigoUf] || 'www.nfe.fazenda.gov.br/portal';
}

// NFC-e autorizada pode ser cancelada em até 30 min da autorização.
export function podeCancelarNFCe(venda, agora = Date.now()) {
  if (!venda || venda.statusFiscal !== 'autorizada' || !venda.chaveNfe) return false;
  const base = Date.parse(venda.dataAutorizacaoNfce || venda.data || '');
  if (!base) return false;
  return (agora - base) <= JANELA_CANCELAMENTO_MS;
}

// Referência única e estável na Focus: mesma venda nunca vira duas notas.
export function refDaVenda(venda) {
  return `fp-${String(venda.id).replace(/[^A-Za-z0-9_-]/g, '')}`;
}
