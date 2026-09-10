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

/**
 * Consolida o catálogo entre nuvem e terminal local e reaplica apenas os
 * movimentos de estoque que este terminal ainda não conhece. É o que impede um
 * caixa de desfazer a baixa feita pelo outro.
 */
export function consolidarProdutosComMovimentos({
  produtosNuvem = [],
  produtosLocais = [],
  movimentosNuvem = [],
  movimentosLocais = []
} = {}) {
  const catalogo = mesclarItensPorId(produtosNuvem, produtosLocais);

  const mapaLocal = new Map();
  (produtosLocais || []).forEach(item => {
    if (item && item.id) mapaLocal.set(String(item.id), item);
  });

  const produtos = catalogo.map(merged => {
    const local = mapaLocal.get(String(merged.id));
    if (!local) return merged;
    return { ...merged, estoque: parseFloat(local.estoque) || 0 };
  });

  const idsConhecidos = new Set((movimentosLocais || []).map(m => m && m.id).filter(Boolean));
  const novosMovimentos = normalizarMovimentos(movimentosNuvem).filter(m => !idsConhecidos.has(m.id));

  novosMovimentos.forEach(mov => {
    const produto = produtos.find(p =>
      String(p.id) === String(mov.produtoId) || String(p.codigoBarras || '') === String(mov.produtoId)
    );
    if (!produto || produto.controlarEstoque === false) return;

    // Para produto que só existe na nuvem, o saldo recebido já embute o
    // movimento; reaplicar aqui descontaria a mesma venda duas vezes.
    const eraLocal = mapaLocal.has(String(produto.id));
    if (!eraLocal) {
      const saldoDoCatalogo = new Date(produto.atualizadoEm || 0).getTime();
      const dataDoMovimento = new Date(mov.at || 0).getTime();
      if (!(dataDoMovimento > saldoDoCatalogo)) return;
    }

    produto.estoque = Math.max(0, (parseFloat(produto.estoque) || 0) + (parseFloat(mov.delta) || 0));
    if (mov.at) produto.atualizadoEm = mov.at;
  });

  return { produtos, novosMovimentos };
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
