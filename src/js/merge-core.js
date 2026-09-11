/**
 * merge-core.js - Regras puras de fusão multi-terminal (sem Firebase, sem DOM).
 * Mantido isolado para poder ser testado com `npm test`.
 */

function chaveDoItem(item) {
  if (!item) return null;
  const id = item.id || item.codigoBarras;
  return id ? String(id) : null;
}

function tempoDe(item) {
  const raw = item && item.atualizadoEm;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Une duas listas pelo id. Quando o mesmo id existe nos dois lados, os campos do
 * registro mais recente (atualizadoEm) prevalecem sobre os do mais antigo.
 */
export function mesclarItensPorId(baseA = [], baseB = []) {
  const mapa = new Map();

  (baseA || []).forEach(item => {
    const key = chaveDoItem(item);
    if (key) mapa.set(key, item);
  });

  (baseB || []).forEach(item => {
    const key = chaveDoItem(item);
    if (!key) return;

    const existente = mapa.get(key);
    if (!existente) {
      mapa.set(key, item);
      return;
    }

    const tExistente = tempoDe(existente);
    const tNovo = tempoDe(item);

    if (tNovo >= tExistente) {
      mapa.set(key, { ...existente, ...item });
    } else {
      mapa.set(key, { ...item, ...existente });
    }
  });

  return Array.from(mapa.values());
}

function campoVazio(valor) {
  if (valor === undefined || valor === null) return true;
  return typeof valor === 'string' && valor.trim() === '';
}

function mesclarRegistroPreservando(antigo, recente, chaves = []) {
  const out = { ...antigo, ...recente };
  (chaves || []).forEach(key => {
    if (campoVazio(out[key]) && !campoVazio(antigo[key])) {
      out[key] = antigo[key];
    }
  });
  if (out.membroClube === undefined && antigo && antigo.membroClube !== undefined) {
    out.membroClube = antigo.membroClube;
  }
  return out;
}

const CAMPOS_CLIENTE_PRESERVAR = [
  'cpfCnpj', 'telefone', 'email', 'nome', 'endereco',
  'cep', 'numero', 'bairro', 'cidade', 'complemento'
];

/**
 * Mesma regra do merge por id, mas um CPF/telefone vazio no notebook
 * não pode apagar o documento que o outro caixa acabou de cadastrar.
 */
export function mesclarClientes(nuvem = [], local = []) {
  const mapa = new Map();

  (nuvem || []).forEach(item => {
    const key = chaveDoItem(item);
    if (key) mapa.set(key, item);
  });

  (local || []).forEach(item => {
    const key = chaveDoItem(item);
    if (!key) return;

    const existente = mapa.get(key);
    if (!existente) {
      mapa.set(key, item);
      return;
    }

    const tExistente = tempoDe(existente);
    const tNovo = tempoDe(item);

    if (tNovo >= tExistente) {
      mapa.set(key, mesclarRegistroPreservando(existente, item, CAMPOS_CLIENTE_PRESERVAR));
    } else {
      mapa.set(key, mesclarRegistroPreservando(item, existente, CAMPOS_CLIENTE_PRESERVAR));
    }
  });

  return Array.from(mapa.values());
}

export function clientesPrecisamReenviar(consolidadas = [], nuvem = []) {
  const mapaNuvem = new Map((nuvem || []).map(c => [String(c && c.id), c]));
  if ((consolidadas || []).length !== (nuvem || []).length) return true;
  return (consolidadas || []).some(c => {
    const outro = mapaNuvem.get(String(c && c.id));
    if (!outro) return true;
    const docLocal = String(c.cpfCnpj || '').replace(/\D/g, '');
    const docNuvem = String(outro.cpfCnpj || '').replace(/\D/g, '');
    return Boolean(docLocal) && docLocal !== docNuvem;
  });
}

export function documentosDoCliente(cliente) {
  if (!cliente) return [];
  const vistos = new Set();
  const docs = [];
  [cliente.cpfCnpj, cliente.cpf, cliente.cnpj, cliente.documento].forEach(valor => {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!digitos || vistos.has(digitos)) return;
    vistos.add(digitos);
    docs.push(digitos);
  });
  return docs;
}

export function encontrarClientePorDocumento(clientes, documento) {
  const alvo = String(documento || '').replace(/\D/g, '');
  if (alvo.length !== 11 && alvo.length !== 14) return null;
  const lista = Array.isArray(clientes) ? clientes : [];
  return lista.find(c => documentosDoCliente(c).some(doc => {
    if (doc === alvo) return true;
    if (alvo.length === 11 && doc.length <= 11) {
      return doc.padStart(11, '0') === alvo.padStart(11, '0');
    }
    return false;
  })) || null;
}

/**
 * O total do Firestore conta o documento __exclusao (recado entre caixas).
 * A tela não mostra esse doc — sem esse ajuste aparece "19 de 20".
 */
export function totalAuditoriaVisivel(countBruto, { temDocMeta = false } = {}) {
  const n = Number(countBruto) || 0;
  return Math.max(0, n - (temDocMeta ? 1 : 0));
}

function ehContaPaga(conta) {
  return String(conta && conta.status || '').toLowerCase() === 'pago';
}

function tempoContaPagar(conta) {
  const carimbo = tempoDe(conta);
  if (carimbo) return carimbo;
  const pagamento = conta && conta.dataPagamento ? new Date(conta.dataPagamento).getTime() : 0;
  if (Number.isFinite(pagamento) && pagamento > 0) return pagamento;
  const criacao = conta && conta.criadoEm ? new Date(conta.criadoEm).getTime() : 0;
  return Number.isFinite(criacao) ? criacao : 0;
}

/**
 * Contas a pagar: o registro mais recente vence. Sem data, baixa (pago)
 * não pode voltar a vencido só porque o outro PC ainda tem a cópia antiga.
 */
export function mesclarContasPagar(nuvem = [], local = []) {
  const mapa = new Map();

  const contaVence = (atual, candidato) => {
    const tAtual = tempoContaPagar(atual);
    const tNovo = tempoContaPagar(candidato);
    if (tNovo !== tAtual) return tNovo > tAtual;
    if (ehContaPaga(candidato) !== ehContaPaga(atual)) return ehContaPaga(candidato);
    return true;
  };

  [...(nuvem || []), ...(local || [])].forEach(item => {
    const key = chaveDoItem(item);
    if (!key) return;
    const existente = mapa.get(key);
    if (!existente) {
      mapa.set(key, item);
      return;
    }
    if (contaVence(existente, item)) {
      mapa.set(key, { ...existente, ...item });
    } else {
      mapa.set(key, { ...item, ...existente });
    }
  });

  return Array.from(mapa.values());
}

export function contasPagarPrecisamReenviar(consolidadas = [], nuvem = []) {
  const mapaNuvem = new Map((nuvem || []).map(c => [String(c && c.id), c]));
  if ((consolidadas || []).length !== (nuvem || []).length) return true;
  return (consolidadas || []).some(c => {
    const outro = mapaNuvem.get(String(c && c.id));
    if (!outro) return true;
    return String(c.status || '') !== String(outro.status || '')
      || String(c.dataPagamento || '') !== String(outro.dataPagamento || '');
  });
}

/**
 * Mesas e comandas não podem ser mescladas campo a campo: um `itens: []` antigo
 * misturado com um novo recriaria itens já faturados. Aqui a versão mais recente
 * de cada mesa vence por inteiro.
 */
export function mesclarComandas(nuvem = [], local = []) {
  const mapa = new Map();

  [...(nuvem || []), ...(local || [])].forEach(item => {
    const key = chaveDoItem(item);
    if (!key) return;

    const existente = mapa.get(key);
    if (!existente || tempoDe(item) >= tempoDe(existente)) {
      mapa.set(key, item);
    }
  });

  return Array.from(mapa.values());
}

export function normalizarMovimentos(raw) {
  if (!raw) return [];
  const lista = Array.isArray(raw) ? raw : (typeof raw === 'object' ? Object.values(raw) : []);
  return lista.filter(m => m && m.id);
}

export function mapearMovimentosPorId(lista) {
  const mapa = {};
  (lista || []).forEach(m => {
    if (m && m.id) mapa[m.id] = m;
  });
  return mapa;
}

export function recuarIso(iso, ms = 120000) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return iso || '';
  return new Date(Math.max(0, t - ms)).toISOString();
}

export function juntarMovimentosPorId(...listas) {
  const mapa = new Map();
  listas.forEach(lista => {
    (lista || []).forEach(m => {
      if (m && m.id) mapa.set(String(m.id), m);
    });
  });
  return Array.from(mapa.values());
}

export function ultimoAtMovimentos(lista) {
  let max = '';
  (lista || []).forEach(m => {
    if (m && m.at && String(m.at) > max) max = String(m.at);
  });
  return max;
}

/**
 * Consolida o catálogo entre nuvem e terminal local e reaplica apenas os
 * movimentos de estoque que este terminal ainda não conhece. É o que impede um
 * caixa de desfazer a baixa feita pelo outro.
 */
export function mesclarConfigLoja(nuvem, local) {
  if (!nuvem || typeof nuvem !== 'object') return local && typeof local === 'object' ? local : {};
  if (!local || typeof local !== 'object') return nuvem;
  const tNuvem = Date.parse(nuvem.atualizadoEm || '') || 0;
  const tLocal = Date.parse(local.atualizadoEm || '') || 0;
  return tNuvem >= tLocal ? { ...local, ...nuvem } : { ...nuvem, ...local };
}

export function montarCheckpointEstoque(produtos = [], movimentos = [], agora = new Date().toISOString()) {
  const saldos = {};
  (produtos || []).forEach(p => {
    if (!p || !p.id || p.controlarEstoque === false) return;
    saldos[String(p.id)] = parseFloat(p.estoque) || 0;
  });
  let ultimoMovAt = '';
  (movimentos || []).forEach(m => {
    if (m && m.at && String(m.at) > ultimoMovAt) ultimoMovAt = String(m.at);
  });
  return { saldos, ultimoMovAt, geradoEm: agora };
}

export function consolidarProdutosComMovimentos({
  produtosNuvem = [],
  produtosLocais = [],
  movimentosNuvem = [],
  movimentosLocais = [],
  checkpoint = null
} = {}) {
  const catalogo = mesclarItensPorId(produtosNuvem, produtosLocais);

  const mapaLocal = new Map();
  (produtosLocais || []).forEach(item => {
    if (item && item.id) mapaLocal.set(String(item.id), item);
  });
  const mapaNuvem = new Map();
  (produtosNuvem || []).forEach(item => {
    if (item && item.id) mapaNuvem.set(String(item.id), item);
  });

  const produtos = catalogo.map(merged => {
    const local = mapaLocal.get(String(merged.id));
    const nuvem = mapaNuvem.get(String(merged.id));
    const { estoque: _estoqueIgnorado, ...catalogoSemEstoque } = merged;
    if (local) {
      return { ...catalogoSemEstoque, estoque: parseFloat(local.estoque) || 0 };
    }
    let partida = 0;
    const chave = String(merged.id);
    if (checkpoint && checkpoint.saldos && checkpoint.saldos[chave] != null) {
      partida = parseFloat(checkpoint.saldos[chave]) || 0;
    } else if (nuvem) {
      partida = parseFloat(nuvem.estoque) || 0;
    }
    return { ...catalogoSemEstoque, estoque: partida };
  });

  const idsConhecidos = new Set((movimentosLocais || []).map(m => m && m.id).filter(Boolean));
  const corteCheckpoint = checkpoint && checkpoint.ultimoMovAt ? Date.parse(checkpoint.ultimoMovAt) : 0;
  const novosMovimentos = normalizarMovimentos(movimentosNuvem)
    .filter(m => m && m.id && !idsConhecidos.has(m.id))
    .slice()
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  novosMovimentos.forEach(mov => {
    const produto = produtos.find(p =>
      String(p.id) === String(mov.produtoId) || String(p.codigoBarras || '') === String(mov.produtoId)
    );
    if (!produto || produto.controlarEstoque === false) return;

    const eraLocal = mapaLocal.has(String(produto.id));
    if (!eraLocal) {
      const dataDoMovimento = new Date(mov.at || 0).getTime();
      if (corteCheckpoint) {
        if (!(dataDoMovimento > corteCheckpoint)) return;
      } else {
        const nuvem = mapaNuvem.get(String(produto.id));
        const saldoDoCatalogo = new Date((nuvem && nuvem.atualizadoEm) || 0).getTime();
        if (!(dataDoMovimento > saldoDoCatalogo)) return;
      }
    }

    if (mov.saldoPara != null && mov.saldoPara !== '') {
      produto.estoque = Math.max(0, parseFloat(mov.saldoPara) || 0);
      return;
    }
    produto.estoque = Math.max(0, (parseFloat(produto.estoque) || 0) + (parseFloat(mov.delta) || 0));
  });

  return { produtos, novosMovimentos };
}

export function mesclarSessaoInventario(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const rank = { agendado: 1, em_andamento: 2, concluido: 3, processado: 4 };
  const base = tempoDe(b) >= tempoDe(a) ? { ...a, ...b } : { ...b, ...a };
  const ra = rank[a.status] || 0;
  const rb = rank[b.status] || 0;
  if (ra !== rb) base.status = ra > rb ? a.status : b.status;

  const linhasA = a.linhas && typeof a.linhas === 'object' ? a.linhas : {};
  const linhasB = b.linhas && typeof b.linhas === 'object' ? b.linhas : {};
  const linhas = {};
  new Set([...Object.keys(linhasA), ...Object.keys(linhasB)]).forEach(chave => {
    const la = linhasA[chave];
    const lb = linhasB[chave];
    if (!la) { linhas[chave] = lb; return; }
    if (!lb) { linhas[chave] = la; return; }
    const mapaLeituras = new Map();
    [...(la.leituras || []), ...(lb.leituras || [])].forEach(l => {
      if (l && l.id) mapaLeituras.set(String(l.id), l);
    });
    const leituras = Array.from(mapaLeituras.values());
    const contado = leituras.reduce((soma, l) => soma + (parseFloat(l.qtd) || 0), 0);
    linhas[chave] = {
      ...la,
      ...lb,
      saldoDe: la.saldoDe != null ? la.saldoDe : lb.saldoDe,
      leituras,
      contado
    };
  });
  base.linhas = linhas;
  return base;
}

export function mesclarInventarios(nuvem = [], local = []) {
  const mapa = new Map();
  [...(nuvem || []), ...(local || [])].forEach(sessao => {
    if (!sessao || !sessao.id) return;
    const id = String(sessao.id);
    const existente = mapa.get(id);
    mapa.set(id, existente ? mesclarSessaoInventario(existente, sessao) : sessao);
  });
  return Array.from(mapa.values());
}

export function calcularDeltasInventario(sessao, produtosAtuais = []) {
  const avisos = [];
  const deltas = [];
  if (!sessao) {
    return { deltas, avisos };
  }
  const mapaProd = new Map();
  (produtosAtuais || []).forEach(p => {
    if (p && p.id) mapaProd.set(String(p.id), p);
  });
  const linhas = sessao.linhas && typeof sessao.linhas === 'object' ? Object.values(sessao.linhas) : [];
  linhas.forEach(linha => {
    if (!linha || !linha.produtoId) return;
    const prod = mapaProd.get(String(linha.produtoId));
    if (!prod || prod.controlarEstoque === false) return;
    const atual = parseFloat(prod.estoque) || 0;
    const contado = parseFloat(linha.contado) || 0;
    const saldoDe = linha.saldoDe != null ? parseFloat(linha.saldoDe) : atual;
    if (Math.abs(atual - saldoDe) > 0.0001) {
      avisos.push({
        produtoId: linha.produtoId,
        nome: linha.nome || prod.nome,
        saldoDe,
        atual,
        motivo: 'venda_no_meio'
      });
    }
    const delta = contado - atual;
    if (delta === 0) return;
    deltas.push({
      produtoId: linha.produtoId,
      nome: linha.nome || prod.nome,
      delta,
      contado,
      atual,
      saldoDe
    });
  });
  return { deltas, avisos };
}

/** Divide uma lista em lotes para caber no limite de 1 MiB por documento. */
export function dividirEmLotes(lista, tamanhoLote) {
  const itens = Array.isArray(lista) ? lista : [];
  const tamanho = Math.max(1, parseInt(tamanhoLote, 10) || 1);
  const lotes = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/** Marca com `atualizadoEm` somente os registros que realmente mudaram. */
export function carimbarAlterados(listaNova, listaAnterior, agora = new Date().toISOString()) {
  const anteriores = new Map();
  (listaAnterior || []).forEach(item => {
    const key = chaveDoItem(item);
    if (key) anteriores.set(key, item);
  });

  return (listaNova || []).map(item => {
    const key = chaveDoItem(item);
    if (!key) return item;

    const antigo = anteriores.get(key);
    if (!antigo) return { ...item, atualizadoEm: item.atualizadoEm || agora };

    const semCarimbo = obj => {
      const { atualizadoEm, ...resto } = obj || {};
      return JSON.stringify(resto);
    };

    if (semCarimbo(antigo) === semCarimbo(item)) {
      return { ...item, atualizadoEm: antigo.atualizadoEm || item.atualizadoEm };
    }
    return { ...item, atualizadoEm: agora };
  });
}

/**
 * Recado de exclusão de logs: o outro caixa não pode reenviar o que já foi apagado.
 * apagarTudo vale até o horário do recado; logs novos (depois de `em`) passam.
 */
export function logCaiuNaExclusao(log, exclusao, dataMs) {
  if (!log || !exclusao) return false;
  const id = log.id != null ? String(log.id) : '';
  if (id.startsWith('__')) return true;
  const ids = exclusao.ids || [];
  if (id && ids.includes(id)) return true;
  const emMs = Date.parse(exclusao.em || '') || 0;
  const ms = Number(dataMs) || 0;
  if (exclusao.apagarTudo) {
    if (!emMs) return true;
    if (!ms) return true;
    return ms <= emMs;
  }
  const corte = Number(exclusao.corteMs) || 0;
  if (!ms) return false;
  return corte > 0 && emMs > 0 && ms >= corte && ms <= emMs;
}
