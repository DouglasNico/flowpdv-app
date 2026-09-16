var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// test/entry.js
var entry_exports = {};
__export(entry_exports, {
  FOCUS_URLS: () => FOCUS_URLS,
  JANELA_CANCELAMENTO_MS: () => JANELA_CANCELAMENTO_MS,
  STONE_API: () => STONE_API,
  STONE_POLL_MS: () => STONE_POLL_MS,
  STONE_TIMEOUT_MS: () => STONE_TIMEOUT_MS,
  StorageService: () => StorageService,
  TefLedger: () => TefLedger,
  calcularDeltasInventario: () => calcularDeltasInventario,
  carimbarAlterados: () => carimbarAlterados,
  clientesPrecisamReenviar: () => clientesPrecisamReenviar,
  codigoSefazPagamento: () => codigoSefazPagamento,
  consolidarProdutosComMovimentos: () => consolidarProdutosComMovimentos,
  contasPagarPrecisamReenviar: () => contasPagarPrecisamReenviar,
  dataEmissaoISO: () => dataEmissaoISO,
  dinheiroLiquidoVenda: () => dinheiroLiquidoVenda,
  dividirEmLotes: () => dividirEmLotes,
  documentosDoCliente: () => documentosDoCliente,
  encontrarClientePorDocumento: () => encontrarClientePorDocumento,
  funcaoSitef: () => funcaoSitef,
  idComandaPorNumero: () => idComandaPorNumero,
  interpretarCamposSitef: () => interpretarCamposSitef,
  interpretarPedidoStone: () => interpretarPedidoStone,
  interpretarRespostaFocus: () => interpretarRespostaFocus,
  juntarMovimentosPorId: () => juntarMovimentosPorId,
  logCaiuNaExclusao: () => logCaiuNaExclusao,
  mapearMovimentosPorId: () => mapearMovimentosPorId,
  mensagemConfiguraSitef: () => mensagemConfiguraSitef,
  mensagemErroStone: () => mensagemErroStone,
  mensagemRetornoSitef: () => mensagemRetornoSitef,
  mesclarClientes: () => mesclarClientes,
  mesclarComandas: () => mesclarComandas,
  mesclarConfigLoja: () => mesclarConfigLoja,
  mesclarContasPagar: () => mesclarContasPagar,
  mesclarDadosTerminal: () => mesclarDadosTerminal,
  mesclarInventarios: () => mesclarInventarios,
  mesclarItensPorId: () => mesclarItensPorId,
  mesclarSessaoInventario: () => mesclarSessaoInventario,
  montarCheckpointEstoque: () => montarCheckpointEstoque,
  montarPayloadNFCe: () => montarPayloadNFCe,
  montarPedidoStone: () => montarPedidoStone,
  nomeComandaPorId: () => nomeComandaPorId,
  normalizarMovimentos: () => normalizarMovimentos,
  normalizarTipoTerminal: () => normalizarTipoTerminal,
  pagamentosDaVenda: () => pagamentosDaVenda,
  parseMenuSitef: () => parseMenuSitef,
  podeCancelarNFCe: () => podeCancelarNFCe,
  recuarIso: () => recuarIso,
  refDaVenda: () => refDaVenda,
  somenteDigitos: () => somenteDigitos,
  tipoStone: () => tipoStone,
  tipoTerminalDe: () => tipoTerminalDe,
  totalAuditoriaVisivel: () => totalAuditoriaVisivel,
  ultimoAtMovimentos: () => ultimoAtMovimentos,
  urlConsultaPorUf: () => urlConsultaPorUf,
  validarConfigIntegracao: () => validarConfigIntegracao,
  valorSitef: () => valorSitef,
  valorTefConfere: () => valorTefConfere,
  vendaPertenceAoTurno: () => vendaPertenceAoTurno
});
module.exports = __toCommonJS(entry_exports);

// src/js/merge-core.js
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
function mesclarItensPorId(baseA = [], baseB = []) {
  const mapa = /* @__PURE__ */ new Map();
  (baseA || []).forEach((item) => {
    const key = chaveDoItem(item);
    if (key) mapa.set(key, item);
  });
  (baseB || []).forEach((item) => {
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
  if (valor === void 0 || valor === null) return true;
  return typeof valor === "string" && valor.trim() === "";
}
function mesclarRegistroPreservando(antigo, recente, chaves = []) {
  const out = { ...antigo, ...recente };
  (chaves || []).forEach((key) => {
    if (campoVazio(out[key]) && !campoVazio(antigo[key])) {
      out[key] = antigo[key];
    }
  });
  if (out.membroClube === void 0 && antigo && antigo.membroClube !== void 0) {
    out.membroClube = antigo.membroClube;
  }
  return out;
}
var CAMPOS_CLIENTE_PRESERVAR = [
  "cpfCnpj",
  "telefone",
  "email",
  "nome",
  "endereco",
  "cep",
  "numero",
  "bairro",
  "cidade",
  "complemento"
];
function mesclarClientes(nuvem = [], local = []) {
  const mapa = /* @__PURE__ */ new Map();
  (nuvem || []).forEach((item) => {
    const key = chaveDoItem(item);
    if (key) mapa.set(key, item);
  });
  (local || []).forEach((item) => {
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
function clientesPrecisamReenviar(consolidadas = [], nuvem = []) {
  const mapaNuvem = new Map((nuvem || []).map((c) => [String(c && c.id), c]));
  if ((consolidadas || []).length !== (nuvem || []).length) return true;
  return (consolidadas || []).some((c) => {
    const outro = mapaNuvem.get(String(c && c.id));
    if (!outro) return true;
    const docLocal = String(c.cpfCnpj || "").replace(/\D/g, "");
    const docNuvem = String(outro.cpfCnpj || "").replace(/\D/g, "");
    return Boolean(docLocal) && docLocal !== docNuvem;
  });
}
function documentosDoCliente(cliente) {
  if (!cliente) return [];
  const vistos = /* @__PURE__ */ new Set();
  const docs = [];
  [cliente.cpfCnpj, cliente.cpf, cliente.cnpj, cliente.documento].forEach((valor) => {
    const digitos = String(valor || "").replace(/\D/g, "");
    if (!digitos || vistos.has(digitos)) return;
    vistos.add(digitos);
    docs.push(digitos);
  });
  return docs;
}
function encontrarClientePorDocumento(clientes, documento) {
  const alvo = String(documento || "").replace(/\D/g, "");
  if (alvo.length !== 11 && alvo.length !== 14) return null;
  const lista = Array.isArray(clientes) ? clientes : [];
  return lista.find((c) => documentosDoCliente(c).some((doc) => {
    if (doc === alvo) return true;
    if (alvo.length === 11 && doc.length <= 11) {
      return doc.padStart(11, "0") === alvo.padStart(11, "0");
    }
    return false;
  })) || null;
}
function totalAuditoriaVisivel(countBruto, { temDocMeta = false } = {}) {
  const n = Number(countBruto) || 0;
  return Math.max(0, n - (temDocMeta ? 1 : 0));
}
function vendaPertenceAoTurno(venda, turno) {
  if (!venda || !turno) return false;
  if ((turno.vendasIds || []).some((id) => String(id) === String(venda.id))) return true;
  if (venda.turnoId) return String(venda.turnoId) === String(turno.id);
  const t = Date.parse(venda.data);
  if (!Number.isFinite(t)) return false;
  const inicio = Date.parse(turno.dataAbertura);
  const fim = turno.dataFechamento ? Date.parse(turno.dataFechamento) : Date.now();
  return t >= inicio && t <= fim;
}
function dinheiroLiquidoVenda(venda) {
  if (!venda) return 0;
  const troco = parseFloat(venda.troco) || 0;
  if (venda.pagamentoDividido && Array.isArray(venda.pagamentos)) {
    let dinheiro = 0;
    let jaLiquido = false;
    venda.pagamentos.forEach((p) => {
      if (!p || p.forma !== "Dinheiro") return;
      dinheiro += parseFloat(p.valor) || 0;
      if (p.valorEntregue != null) jaLiquido = true;
    });
    return Math.max(0, jaLiquido ? dinheiro : dinheiro - troco);
  }
  if (venda.pagamentoDividido && (venda.parcela1 || venda.parcela2)) {
    let dinheiro = 0;
    [venda.parcela1, venda.parcela2].forEach((p) => {
      if (p && p.forma === "Dinheiro") dinheiro += parseFloat(p.valor) || 0;
    });
    return Math.max(0, dinheiro - troco);
  }
  return venda.formaPagamento === "Dinheiro" ? parseFloat(venda.total) || 0 : 0;
}
function ehContaPaga(conta) {
  return String(conta && conta.status || "").toLowerCase() === "pago";
}
function tempoContaPagar(conta) {
  const carimbo = tempoDe(conta);
  if (carimbo) return carimbo;
  const pagamento = conta && conta.dataPagamento ? new Date(conta.dataPagamento).getTime() : 0;
  if (Number.isFinite(pagamento) && pagamento > 0) return pagamento;
  const criacao = conta && conta.criadoEm ? new Date(conta.criadoEm).getTime() : 0;
  return Number.isFinite(criacao) ? criacao : 0;
}
function mesclarContasPagar(nuvem = [], local = []) {
  const mapa = /* @__PURE__ */ new Map();
  const contaVence = (atual, candidato) => {
    const tAtual = tempoContaPagar(atual);
    const tNovo = tempoContaPagar(candidato);
    if (tNovo !== tAtual) return tNovo > tAtual;
    if (ehContaPaga(candidato) !== ehContaPaga(atual)) return ehContaPaga(candidato);
    return true;
  };
  [...nuvem || [], ...local || []].forEach((item) => {
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
function contasPagarPrecisamReenviar(consolidadas = [], nuvem = []) {
  const mapaNuvem = new Map((nuvem || []).map((c) => [String(c && c.id), c]));
  if ((consolidadas || []).length !== (nuvem || []).length) return true;
  return (consolidadas || []).some((c) => {
    const outro = mapaNuvem.get(String(c && c.id));
    if (!outro) return true;
    return String(c.status || "") !== String(outro.status || "") || String(c.dataPagamento || "") !== String(outro.dataPagamento || "");
  });
}
function mesclarComandas(nuvem = [], local = []) {
  const mapa = /* @__PURE__ */ new Map();
  [...nuvem || [], ...local || []].forEach((item) => {
    const key = chaveDoItem(item);
    if (!key) return;
    const existente = mapa.get(key);
    if (!existente || tempoDe(item) >= tempoDe(existente)) {
      mapa.set(key, item);
    }
  });
  return Array.from(mapa.values());
}
function normalizarMovimentos(raw) {
  if (!raw) return [];
  const lista = Array.isArray(raw) ? raw : typeof raw === "object" ? Object.values(raw) : [];
  return lista.filter((m) => m && m.id);
}
function mapearMovimentosPorId(lista) {
  const mapa = {};
  (lista || []).forEach((m) => {
    if (m && m.id) mapa[m.id] = m;
  });
  return mapa;
}
function recuarIso(iso, ms = 12e4) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return iso || "";
  return new Date(Math.max(0, t - ms)).toISOString();
}
function juntarMovimentosPorId(...listas) {
  const mapa = /* @__PURE__ */ new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((m) => {
      if (m && m.id) mapa.set(String(m.id), m);
    });
  });
  return Array.from(mapa.values());
}
function ultimoAtMovimentos(lista) {
  let max = "";
  (lista || []).forEach((m) => {
    if (m && m.at && String(m.at) > max) max = String(m.at);
  });
  return max;
}
function mesclarConfigLoja(nuvem, local) {
  if (!nuvem || typeof nuvem !== "object") return local && typeof local === "object" ? local : {};
  if (!local || typeof local !== "object") return nuvem;
  const tNuvem = Date.parse(nuvem.atualizadoEm || "") || 0;
  const tLocal = Date.parse(local.atualizadoEm || "") || 0;
  return tNuvem >= tLocal ? { ...local, ...nuvem } : { ...nuvem, ...local };
}
function montarCheckpointEstoque(produtos = [], movimentos = [], agora = (/* @__PURE__ */ new Date()).toISOString()) {
  const saldos = {};
  (produtos || []).forEach((p) => {
    if (!p || !p.id || p.controlarEstoque === false) return;
    saldos[String(p.id)] = parseFloat(p.estoque) || 0;
  });
  let ultimoMovAt = "";
  (movimentos || []).forEach((m) => {
    if (m && m.at && String(m.at) > ultimoMovAt) ultimoMovAt = String(m.at);
  });
  return { saldos, ultimoMovAt, geradoEm: agora };
}
function consolidarProdutosComMovimentos({
  produtosNuvem = [],
  produtosLocais = [],
  movimentosNuvem = [],
  movimentosLocais = [],
  checkpoint = null
} = {}) {
  const catalogo = mesclarItensPorId(produtosNuvem, produtosLocais);
  const mapaLocal = /* @__PURE__ */ new Map();
  (produtosLocais || []).forEach((item) => {
    if (item && item.id) mapaLocal.set(String(item.id), item);
  });
  const mapaNuvem = /* @__PURE__ */ new Map();
  (produtosNuvem || []).forEach((item) => {
    if (item && item.id) mapaNuvem.set(String(item.id), item);
  });
  const produtos = catalogo.map((merged) => {
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
  const idsConhecidos = new Set((movimentosLocais || []).map((m) => m && m.id).filter(Boolean));
  const corteCheckpoint = checkpoint && checkpoint.ultimoMovAt ? Date.parse(checkpoint.ultimoMovAt) : 0;
  const novosMovimentos = normalizarMovimentos(movimentosNuvem).filter((m) => m && m.id && !idsConhecidos.has(m.id)).slice().sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  novosMovimentos.forEach((mov) => {
    const produto = produtos.find(
      (p) => String(p.id) === String(mov.produtoId) || String(p.codigoBarras || "") === String(mov.produtoId)
    );
    if (!produto || produto.controlarEstoque === false) return;
    const eraLocal = mapaLocal.has(String(produto.id));
    if (!eraLocal) {
      const dataDoMovimento = new Date(mov.at || 0).getTime();
      if (corteCheckpoint) {
        if (!(dataDoMovimento > corteCheckpoint)) return;
      } else {
        const nuvem = mapaNuvem.get(String(produto.id));
        const saldoDoCatalogo = new Date(nuvem && nuvem.atualizadoEm || 0).getTime();
        if (!(dataDoMovimento > saldoDoCatalogo)) return;
      }
    }
    if (mov.saldoPara != null && mov.saldoPara !== "") {
      produto.estoque = Math.max(0, parseFloat(mov.saldoPara) || 0);
      return;
    }
    produto.estoque = Math.max(0, (parseFloat(produto.estoque) || 0) + (parseFloat(mov.delta) || 0));
  });
  return { produtos, novosMovimentos };
}
function mesclarSessaoInventario(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const rank = { agendado: 1, em_andamento: 2, concluido: 3, processado: 4 };
  const base = tempoDe(b) >= tempoDe(a) ? { ...a, ...b } : { ...b, ...a };
  const ra = rank[a.status] || 0;
  const rb = rank[b.status] || 0;
  if (ra !== rb) base.status = ra > rb ? a.status : b.status;
  const linhasA = a.linhas && typeof a.linhas === "object" ? a.linhas : {};
  const linhasB = b.linhas && typeof b.linhas === "object" ? b.linhas : {};
  const linhas = {};
  (/* @__PURE__ */ new Set([...Object.keys(linhasA), ...Object.keys(linhasB)])).forEach((chave) => {
    const la = linhasA[chave];
    const lb = linhasB[chave];
    if (!la) {
      linhas[chave] = lb;
      return;
    }
    if (!lb) {
      linhas[chave] = la;
      return;
    }
    const mapaLeituras = /* @__PURE__ */ new Map();
    [...la.leituras || [], ...lb.leituras || []].forEach((l) => {
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
function mesclarInventarios(nuvem = [], local = []) {
  const mapa = /* @__PURE__ */ new Map();
  [...nuvem || [], ...local || []].forEach((sessao) => {
    if (!sessao || !sessao.id) return;
    const id = String(sessao.id);
    const existente = mapa.get(id);
    mapa.set(id, existente ? mesclarSessaoInventario(existente, sessao) : sessao);
  });
  return Array.from(mapa.values());
}
function calcularDeltasInventario(sessao, produtosAtuais = []) {
  const avisos = [];
  const deltas = [];
  if (!sessao) {
    return { deltas, avisos };
  }
  const mapaProd = /* @__PURE__ */ new Map();
  (produtosAtuais || []).forEach((p) => {
    if (p && p.id) mapaProd.set(String(p.id), p);
  });
  const linhas = sessao.linhas && typeof sessao.linhas === "object" ? Object.values(sessao.linhas) : [];
  linhas.forEach((linha) => {
    if (!linha || !linha.produtoId) return;
    const prod = mapaProd.get(String(linha.produtoId));
    if (!prod || prod.controlarEstoque === false) return;
    const atual = parseFloat(prod.estoque) || 0;
    const contado = parseFloat(linha.contado) || 0;
    const saldoDe = linha.saldoDe != null ? parseFloat(linha.saldoDe) : atual;
    if (Math.abs(atual - saldoDe) > 1e-4) {
      avisos.push({
        produtoId: linha.produtoId,
        nome: linha.nome || prod.nome,
        saldoDe,
        atual,
        motivo: "venda_no_meio"
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
function dividirEmLotes(lista, tamanhoLote) {
  const itens = Array.isArray(lista) ? lista : [];
  const tamanho = Math.max(1, parseInt(tamanhoLote, 10) || 1);
  const lotes = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}
function carimbarAlterados(listaNova, listaAnterior, agora = (/* @__PURE__ */ new Date()).toISOString()) {
  const anteriores = /* @__PURE__ */ new Map();
  (listaAnterior || []).forEach((item) => {
    const key = chaveDoItem(item);
    if (key) anteriores.set(key, item);
  });
  return (listaNova || []).map((item) => {
    const key = chaveDoItem(item);
    if (!key) return item;
    const antigo = anteriores.get(key);
    if (!antigo) return { ...item, atualizadoEm: item.atualizadoEm || agora };
    const semCarimbo = (obj) => {
      const { atualizadoEm, ...resto } = obj || {};
      return JSON.stringify(resto);
    };
    if (semCarimbo(antigo) === semCarimbo(item)) {
      return { ...item, atualizadoEm: antigo.atualizadoEm || item.atualizadoEm };
    }
    return { ...item, atualizadoEm: agora };
  });
}
function logCaiuNaExclusao(log, exclusao, dataMs) {
  if (!log || !exclusao) return false;
  const id = log.id != null ? String(log.id) : "";
  if (id.startsWith("__")) return true;
  const ids = exclusao.ids || [];
  if (id && ids.includes(id)) return true;
  const emMs = Date.parse(exclusao.em || "") || 0;
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

// src/js/tipo-terminal.js
function normalizarTipoTerminal(valor) {
  const v = String(valor || "").trim().toLowerCase();
  if (v === "atendimento" || v === "comanda") return "atendimento";
  if (v === "completo") return "completo";
  return "caixa";
}
function tipoTerminalDe(obj) {
  if (!obj || obj.tipoTerminal == null || String(obj.tipoTerminal).trim() === "") return null;
  return normalizarTipoTerminal(obj.tipoTerminal);
}
function mesclarDadosTerminal(existente, info, opcoes) {
  const base = existente && typeof existente === "object" ? existente : {};
  const dados = info && typeof info === "object" ? info : {};
  const forcar = !!(opcoes && opcoes.forcarTipoTerminal);
  const tipo = forcar ? tipoTerminalDe(dados) || tipoTerminalDe(base) || "caixa" : tipoTerminalDe(base) || tipoTerminalDe(dados) || "caixa";
  return {
    ...base,
    ...dados,
    id: dados.id || base.id,
    tipoTerminal: tipo
  };
}
function idComandaPorNumero(modo, numero, tipoEscolhido) {
  const n = parseInt(String(numero == null ? "" : numero).replace(/\D/g, ""), 10);
  if (!n || n < 1) return null;
  const modoNorm = String(modo || "mesas_e_comandas");
  if (modoNorm === "desativado") return null;
  let tipo = tipoEscolhido;
  if (modoNorm === "apenas_mesas") tipo = "mesa";
  if (modoNorm === "apenas_comandas") tipo = "comanda";
  if (tipo !== "mesa" && tipo !== "comanda") {
    tipo = modoNorm === "apenas_mesas" ? "mesa" : "comanda";
  }
  return (tipo === "mesa" ? "MESA-" : "CMD-") + n;
}
function nomeComandaPorId(id, numero) {
  const n = parseInt(numero, 10) || parseInt(String(id || "").replace(/\D/g, ""), 10) || 0;
  const pad = String(n).padStart(2, "0");
  if (String(id || "").indexOf("MESA-") === 0) return "Mesa " + pad;
  return "Comanda #" + pad;
}

// src/js/storage.js
var StorageService = {
  init() {
    this.recuperarVendaPendente();
    this.getProdutos();
    this.getConfig();
    this.getClientes();
    this.getLicenca();
    this.getDeviceId();
  },
  isGerente() {
    if (window.AuthModule && typeof window.AuthModule.isGerente === "function") {
      return window.AuthModule.isGerente();
    }
    return false;
  },
  parseMoedaBR(valor) {
    if (typeof valor === "number") return isNaN(valor) ? 0 : valor;
    if (!valor) return 0;
    let str = String(valor).trim();
    if (str.includes(",") && str.includes(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else if (str.includes(",")) {
      str = str.replace(",", ".");
    }
    const limpo = str.replace(/[^\d.-]/g, "");
    return parseFloat(limpo) || 0;
  },
  formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  normalizarTextoBusca(texto) {
    return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  },
  textoCombinaBusca(campo, termo) {
    const brutoCampo = String(campo || "").toLowerCase();
    const brutoTermo = String(termo || "").toLowerCase().trim();
    if (!brutoTermo) return true;
    if (brutoCampo.includes(brutoTermo)) return true;
    const nCampo = this.normalizarTextoBusca(campo);
    const nTermo = this.normalizarTextoBusca(termo);
    if (!nTermo) return true;
    if (nCampo.includes(nTermo)) return true;
    const tokens = nTermo.split(" ").filter((t) => t.length >= 2 || /^\d/.test(t));
    return tokens.length > 0 && tokens.every((t) => nCampo.includes(t));
  },
  produtoCombinaBusca(produto, termo, campos) {
    if (!produto) return false;
    const lista = campos && campos.length ? campos : ["nome", "codigoBarras", "codigoBarrasFardo", "codigo", "id", "categoria"];
    return lista.some((campo) => this.textoCombinaBusca(produto[campo], termo));
  },
  formatarNumeroTurno(id) {
    if (!id) return "000000";
    const texto = String(id);
    const trn = texto.match(/TRN-(\d+)/i);
    const digits = trn ? trn[1] : texto.replace(/\D/g, "");
    if (digits.length >= 6) return digits.slice(-6);
    if (digits.length > 0) return digits.padStart(6, "0");
    return texto.slice(-6);
  },
  formatarNumeroVenda(vendaOuId) {
    const venda = vendaOuId && typeof vendaOuId === "object" ? vendaOuId : { id: vendaOuId };
    const num = parseInt(venda.numeroVenda, 10);
    if (Number.isFinite(num) && num > 0) return String(num).padStart(6, "0");
    const texto = String(venda.id || "");
    const vnd = texto.match(/VND-(\d+)/i);
    if (vnd) return vnd[1].slice(-6).padStart(6, "0");
    const digits = texto.replace(/\D/g, "");
    if (digits.length > 0) return digits.slice(-6).padStart(6, "0");
    return "------";
  },
  getDeviceId() {
    let devId = localStorage.getItem("flowpdv_device_id");
    if (!devId) {
      devId = "TERM-" + Math.random().toString(36).substr(2, 6).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      localStorage.setItem("flowpdv_device_id", devId);
    }
    return devId;
  },
  getTipoTerminal() {
    try {
      return normalizarTipoTerminal(localStorage.getItem("flowpdv_tipo_terminal"));
    } catch (e) {
      return "caixa";
    }
  },
  setTipoTerminal(tipo) {
    const norm = normalizarTipoTerminal(tipo);
    localStorage.setItem("flowpdv_tipo_terminal", norm);
    return norm;
  },
  // Categorias Dinâmicas (SaaS Multi-Tenant com suporte estrito a exclusões)
  getCategorias() {
    const excluidas = (this.getCategoriasExcluidas() || []).map((c) => String(c).toLowerCase().trim());
    const saved = localStorage.getItem("flowpdv_categorias_loja");
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtradas = parsed.filter((c) => !excluidas.includes(String(c).toLowerCase().trim()));
          if (filtradas.length > 0) return filtradas;
          return ["Geral"];
        }
      } catch (e) {
      }
    }
    const lic = this.getLicenca();
    if (lic && Array.isArray(lic.categorias) && lic.categorias.length > 0) {
      const filtradasLic = lic.categorias.filter((c) => !excluidas.includes(String(c).toLowerCase().trim()));
      if (filtradasLic.length > 0) return filtradasLic;
      return ["Geral"];
    }
    const defaults = ["Geral", "Cervejas", "Destilados", "Vinhos", "N\xE3o Alco\xF3licos", "Petiscos", "Tabacaria", "Gelo & Carv\xE3o"];
    const filtradasDef = defaults.filter((c) => !excluidas.includes(c.toLowerCase()));
    return filtradasDef.length > 0 ? filtradasDef : ["Geral"];
  },
  salvarCategorias(categorias) {
    const lista = Array.isArray(categorias) ? categorias : [];
    localStorage.setItem("flowpdv_categorias_loja", JSON.stringify(lista));
    const lic = this.getLicenca() || {};
    lic.categorias = lista;
    this.saveLicenca(lic);
  },
  getCategoriasExcluidas() {
    try {
      const saved = localStorage.getItem("adega_categorias_excluidas");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },
  adicionarCategoriaExcluida(nome) {
    if (!nome) return;
    const n = String(nome).trim();
    let excluidas = this.getCategoriasExcluidas();
    if (!excluidas.some((c) => c.toLowerCase() === n.toLowerCase())) {
      excluidas.push(n);
      localStorage.setItem("adega_categorias_excluidas", JSON.stringify(excluidas));
    }
  },
  removerCategoriaExcluida(nome) {
    if (!nome) return;
    const n = String(nome).trim();
    let excluidas = this.getCategoriasExcluidas();
    excluidas = excluidas.filter((c) => c.toLowerCase() !== n.toLowerCase());
    localStorage.setItem("adega_categorias_excluidas", JSON.stringify(excluidas));
  },
  // Módulos e Segmentos por Licença (SaaS Multi-Ramo)
  getModulosLicenca() {
    const lic = this.getLicenca();
    if (lic && lic.modulos && typeof lic.modulos === "object") {
      return lic.modulos;
    }
    const saved = localStorage.getItem("flowpdv_modulos_licenca");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (e) {
      }
    }
    return {
      fardosPacks: true,
      balancaPeso: false,
      validadeLotes: true,
      gradeRoupas: false,
      clubeFidelidade: false,
      fiadoWhatsApp: true,
      importadorXml: true,
      fiscalNfce: true,
      tefCartao: true
    };
  },
  setModulosLicenca(modulos) {
    if (!modulos || typeof modulos !== "object") return;
    localStorage.setItem("flowpdv_modulos_licenca", JSON.stringify(modulos));
    const lic = this.getLicenca() || {};
    lic.modulos = modulos;
    this.saveLicenca(lic);
  },
  isModuloAtivo(nomeModulo) {
    const modulos = this.getModulosLicenca();
    if (!modulos || typeof modulos !== "object") return false;
    return Boolean(modulos[nomeModulo]);
  },
  getRamoLicenca() {
    const lic = this.getLicenca();
    if (lic && lic.ramoAtividade) return lic.ramoAtividade;
    return localStorage.getItem("flowpdv_ramo_licenca") || "adega";
  },
  setRamoLicenca(ramo) {
    if (!ramo) return;
    localStorage.setItem("flowpdv_ramo_licenca", ramo);
    const lic = this.getLicenca() || {};
    lic.ramoAtividade = ramo;
    this.saveLicenca(lic);
  },
  getIconeCategoria(cat) {
    const c = (cat || "").toLowerCase();
    if (c.includes("cervej") || c.includes("chopp")) return "\u{1F37A}";
    if (c.includes("destil") || c.includes("whisky") || c.includes("vodka") || c.includes("gin") || c.includes("cacha\xE7a") || c.includes("rum") || c.includes("licor") || c.includes("tequila")) return "\u{1F943}";
    if (c.includes("vinh") || c.includes("espumant") || c.includes("champagne")) return "\u{1F377}";
    if (c.includes("n\xE3o alc") || c.includes("nao alc") || c.includes("refrig") || c.includes("suco") || c.includes("\xE1gua") || c.includes("agua") || c.includes("energet") || c.includes("energ\xE9t")) return "\u{1F964}";
    if (c.includes("bebid") || c.includes("drink")) return "\u{1F377}";
    if (c.includes("gelo") && c.includes("carv")) return "\u{1F9CA}";
    if (c.includes("gelo")) return "\u{1F9CA}";
    if (c.includes("carv")) return "\u{1F525}";
    if (c.includes("tabac") || c.includes("cigar") || c.includes("ess\xEAnc") || c.includes("essenc") || c.includes("seda") || c.includes("pod") || c.includes("vape") || c.includes("narguil")) return "\u{1F6AC}";
    if (c.includes("petisc") || c.includes("snack") || c.includes("salgad") || c.includes("amendo") || c.includes("batata") || c.includes("pringle") || c.includes("dorito") || c.includes("ruffle")) return "\u{1F95C}";
    if (c.includes("bomboniere") || c.includes("chocolat") || c.includes("doce") || c.includes("bala") || c.includes("chicle")) return "\u{1F36C}";
    if (c.includes("combo") || c.includes("kit") || c.includes("promo")) return "\u26A1";
    if (c.includes("aliment") || c.includes("arroz") || c.includes("feij\xE3o") || c.includes("massa") || c.includes("mercear")) return "\u{1F33E}";
    if (c.includes("carn") || c.includes("a\xE7ougu") || c.includes("acougu") || c.includes("frango") || c.includes("peix") || c.includes("churr")) return "\u{1F969}";
    if (c.includes("latic") || c.includes("queij") || c.includes("leite") || c.includes("frio") || c.includes("presunt")) return "\u{1F9C0}";
    if (c.includes("horti") || c.includes("frut") || c.includes("legum") || c.includes("verdur")) return "\u{1F34E}";
    if (c.includes("padar") || c.includes("p\xE3o") || c.includes("pao") || c.includes("bolo")) return "\u{1F956}";
    if (c.includes("higien") || c.includes("sabon") || c.includes("shamp") || c.includes("cosmet")) return "\u{1F9F4}";
    if (c.includes("limpez") || c.includes("deterg") || c.includes("desinf")) return "\u{1F9F9}";
    if (c.includes("matina") || c.includes("caf\xE9") || c.includes("cafe") || c.includes("achocolat")) return "\u2615";
    if (c.includes("acess\xF3r") || c.includes("acessor") || c.includes("copo") || c.includes("ta\xE7a") || c.includes("taca") || c.includes("canec")) return "\u{1F3FA}";
    return "\u{1F3F7}\uFE0F";
  },
  _produtosMem: null,
  // Produtos & Estoque
  getProdutos() {
    if (Array.isArray(this._produtosMem)) return this._produtosMem;
    const saved = localStorage.getItem("adega_produtos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._produtosMem = parsed;
          return parsed;
        }
      } catch (e) {
      }
    }
    const backup = localStorage.getItem("adega_produtos_backup_seguranca");
    if (backup) {
      try {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          this.saveProdutos(parsedBackup);
          return parsedBackup;
        }
      } catch (e) {
      }
    }
    this._produtosMem = [];
    return [];
  },
  // Produtos Excluídos (Tombstones para Multi-Terminal)
  getProdutosExcluidosIds() {
    const saved = localStorage.getItem("adega_produtos_excluidos_ids");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
      }
    }
    return [];
  },
  adicionarProdutoExcluidoId(id) {
    if (!id) return;
    const excluidos = this.getProdutosExcluidosIds();
    const idStr = String(id);
    if (!excluidos.includes(idStr)) {
      excluidos.push(idStr);
      localStorage.setItem("adega_produtos_excluidos_ids", JSON.stringify(excluidos));
    }
  },
  saveProdutos(produtos) {
    this.exigirVendaRecuperada();
    if (Array.isArray(produtos) && produtos.length > 0) {
      const backupAtual = this.getProdutos();
      if (produtos.length >= backupAtual.length) {
        localStorage.setItem("adega_produtos_backup_seguranca", JSON.stringify(produtos));
      }
    }
    const excluidos = this.getProdutosExcluidosIds();
    const listaLimpa = Array.isArray(produtos) ? produtos.filter((p) => p && p.id && !excluidos.includes(String(p.id))) : [];
    this._produtosMem = listaLimpa;
    localStorage.setItem("adega_produtos", JSON.stringify(listaLimpa));
  },
  // Vendas
  getVendas() {
    const saved = localStorage.getItem("adega_vendas");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn("\u26A0\uFE0F Erro ao ler vendas do localStorage:", e);
      }
    }
    return [];
  },
  getProximoNumeroVenda() {
    let ultimo = parseInt(localStorage.getItem("flowpdv_ultimo_numero_venda"), 10);
    if (isNaN(ultimo) || ultimo <= 0) {
      const vendas = this.getVendas();
      const maxExistente = vendas.reduce((max, v) => {
        const num = parseInt(v.numeroVenda, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      ultimo = Math.max(vendas.length, maxExistente);
    }
    const proximo = ultimo + 1;
    localStorage.setItem("flowpdv_ultimo_numero_venda", String(proximo));
    return proximo;
  },
  temVendaPendente() {
    return !!localStorage.getItem("flowpdv_commit_venda");
  },
  exigirVendaRecuperada() {
    if (this.temVendaPendente()) throw new Error("Recupere a venda pendente antes de alterar os dados do caixa.");
  },
  recuperarVendaPendente() {
    const raw = localStorage.getItem("flowpdv_commit_venda");
    if (!raw) return;
    const plano = JSON.parse(raw);
    if (plano.loja !== (this.getLicenca()?.chaveLicenca || "")) throw new Error("Existe uma venda pendente de recupera\xE7\xE3o na loja anterior.");
    const permitidas = /* @__PURE__ */ new Set(["adega_vendas", "adega_turno_atual", "adega_produtos", "adega_produtos_backup_seguranca", "flowpdv_estoque_movimentos", "adega_clientes"]);
    if (!plano.escritas || Object.keys(plano.escritas).some((k) => !permitidas.has(k))) throw new Error("Di\xE1rio de venda inv\xE1lido.");
    for (const [key, value] of Object.entries(plano.escritas)) localStorage.setItem(key, value);
    this._produtosMem = null;
    localStorage.removeItem("flowpdv_commit_venda");
  },
  saveVenda(venda, clientesAtualizados = null) {
    this.recuperarVendaPendente();
    const vendas = this.getVendas();
    if (vendas.some((v) => v.id === venda.id)) return;
    vendas.unshift(venda);
    const escritas = { adega_vendas: JSON.stringify(vendas) };
    const turno = this.getTurnoAtual();
    if (turno && venda.id) {
      if (venda.turnoId && venda.turnoId !== turno.id) throw new Error("O turno mudou durante o pagamento. Recupere a venda no turno original.");
      turno.vendasIds = turno.vendasIds || [];
      if (!turno.vendasIds.includes(venda.id)) turno.vendasIds.push(venda.id);
      escritas.adega_turno_atual = JSON.stringify(turno);
    }
    const produtos = JSON.parse(JSON.stringify(this.getProdutos()));
    const movimentos = this.getMovimentosEstoque();
    (venda.itens || []).forEach((item, index) => {
      const prod = produtos.find((p) => p.id === item.id || p.codigoBarras === item.id);
      if (prod && prod.controlarEstoque !== false) {
        const fator = item.isFardo ? prod.fatorConversao || 1 : 1;
        const delta = -((parseFloat(item.quantidade) || 0) * fator);
        prod.estoque = Math.max(0, (parseFloat(prod.estoque) || 0) + delta);
        movimentos.push({
          id: `MOV-${venda.id}-${index}`,
          at: venda.data || (/* @__PURE__ */ new Date()).toISOString(),
          terminalId: this.getDeviceId(),
          produtoId: prod.id,
          delta,
          origem: "venda",
          refId: venda.id
        });
      }
    });
    escritas.adega_produtos = JSON.stringify(produtos);
    escritas.adega_produtos_backup_seguranca = escritas.adega_produtos;
    escritas.flowpdv_estoque_movimentos = JSON.stringify(movimentos);
    if (clientesAtualizados) escritas.adega_clientes = JSON.stringify(carimbarAlterados(clientesAtualizados, this.getClientes()));
    localStorage.setItem("flowpdv_commit_venda", JSON.stringify({ loja: this.getLicenca()?.chaveLicenca || "", vendaId: venda.id, escritas }));
    this.recuperarVendaPendente();
    try {
      const cloud = window.CloudSyncModule;
      if (turno && cloud?.atualizarTurnoAtivoDoTerminal) Promise.resolve(cloud.atualizarTurnoAtivoDoTerminal(cloud.getChaveLicenca?.() || "", this.getDeviceId(), turno)).catch(() => {
      });
      if (window.LicencaModule?.forcarHeartbeatTerminal) Promise.resolve(window.LicencaModule.forcarHeartbeatTerminal()).catch(() => {
      });
    } catch (e) {
      console.warn("Venda gravada; atualiza\xE7\xE3o do terminal ser\xE1 retomada na sincroniza\xE7\xE3o.", e);
    }
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
      window.CloudSyncModule.enviarAlteracaoNuvem("venda");
    }
  },
  atualizarVenda(venda) {
    this.exigirVendaRecuperada();
    if (!venda || !venda.id) return false;
    const vendas = this.getVendas();
    const index = vendas.findIndex((item) => item.id === venda.id);
    if (index < 0) return false;
    vendas[index] = { ...vendas[index], ...venda };
    localStorage.setItem("adega_vendas", JSON.stringify(vendas));
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
      window.CloudSyncModule.enviarAlteracaoNuvem("venda_atualizada");
    }
    return true;
  },
  // Turnos Excluídos (Tombstones para Sync Multi-Terminal)
  getTurnosExcluidosIds() {
    const saved = localStorage.getItem("adega_turnos_excluidos_ids");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
      }
    }
    return [];
  },
  adicionarTurnoExcluidoId(id) {
    if (!id) return;
    const excluidos = this.getTurnosExcluidosIds();
    const idStr = String(id);
    if (!excluidos.includes(idStr)) {
      excluidos.push(idStr);
      localStorage.setItem("adega_turnos_excluidos_ids", JSON.stringify(excluidos));
    }
  },
  excluirTurnoHistorico(turnoId) {
    if (!turnoId) return false;
    const idStr = String(turnoId);
    this.adicionarTurnoExcluidoId(idStr);
    let turnos = [];
    const saved = localStorage.getItem("adega_turnos_historico");
    if (saved) {
      try {
        turnos = JSON.parse(saved) || [];
      } catch (e) {
      }
    }
    const novosTurnos = turnos.filter((t) => t && String(t.id) !== idStr);
    localStorage.setItem("adega_turnos_historico", JSON.stringify(novosTurnos));
    return true;
  },
  // Turno de Caixa
  getTurnoAtual() {
    const saved = localStorage.getItem("adega_turno_atual");
    if (!saved) return null;
    try {
      const turno = JSON.parse(saved);
      return turno && turno.status === "aberto" ? turno : null;
    } catch (e) {
      console.warn("\u26A0\uFE0F Erro ao ler turno atual do localStorage:", e);
      return null;
    }
  },
  salvarTurno(turno) {
    this.exigirVendaRecuperada();
    localStorage.setItem("adega_turno_atual", JSON.stringify(turno));
    if (window.CloudSyncModule) {
      if (typeof window.CloudSyncModule.atualizarTurnoAtivoDoTerminal === "function") {
        const chave = window.CloudSyncModule.getChaveLicenca ? window.CloudSyncModule.getChaveLicenca() : "";
        window.CloudSyncModule.atualizarTurnoAtivoDoTerminal(chave, this.getDeviceId(), turno).catch(() => {
        });
      }
      if (typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
        window.CloudSyncModule.enviarAlteracaoNuvem("turno");
      }
    }
    if (window.LicencaModule && typeof window.LicencaModule.forcarHeartbeatTerminal === "function") {
      window.LicencaModule.forcarHeartbeatTerminal().catch(() => {
      });
    }
  },
  getHistoricoTurnos() {
    const saved = localStorage.getItem("adega_turnos_historico");
    const excluidos = this.getTurnosExcluidosIds();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((t) => t && t.id && !excluidos.includes(String(t.id)));
        }
      } catch (e) {
      }
    }
    return [];
  },
  salvarHistoricoTurnos(turnos) {
    const excluidos = this.getTurnosExcluidosIds();
    const listaLimpa = Array.isArray(turnos) ? turnos.filter((t) => t && t.id && !excluidos.includes(String(t.id))) : [];
    localStorage.setItem("adega_turnos_historico", JSON.stringify(listaLimpa));
  },
  arquivarTurnoFechado(turnoFechado) {
    const historico = this.getHistoricoTurnos();
    historico.unshift(turnoFechado);
    this.salvarHistoricoTurnos(historico);
    localStorage.removeItem("adega_turno_atual");
    if (window.CloudSyncModule) {
      const fechado = turnoFechado && typeof turnoFechado === "object" ? { ...turnoFechado, terminalId: turnoFechado.terminalId || this.getDeviceId(), status: "fechado" } : null;
      if (typeof window.CloudSyncModule.atualizarTurnoAtivoDoTerminal === "function") {
        const chave = window.CloudSyncModule.getChaveLicenca ? window.CloudSyncModule.getChaveLicenca() : "";
        window.CloudSyncModule.atualizarTurnoAtivoDoTerminal(chave, this.getDeviceId(), fechado).catch(() => {
        });
      }
      if (typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
        window.CloudSyncModule.enviarAlteracaoNuvem("turno");
      }
    }
    if (window.LicencaModule && typeof window.LicencaModule.forcarHeartbeatTerminal === "function") {
      window.LicencaModule.forcarHeartbeatTerminal().catch(() => {
      });
    }
  },
  // Clientes & Fiado
  getClientes() {
    const saved = localStorage.getItem("adega_clientes");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn("\u26A0\uFE0F Erro ao ler clientes do localStorage:", e);
      }
    }
    const defaults = [];
    this.saveClientes(defaults);
    return defaults;
  },
  saveClientes(clientes) {
    this.exigirVendaRecuperada();
    let anteriores = [];
    try {
      const saved = localStorage.getItem("adega_clientes");
      anteriores = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(anteriores)) anteriores = [];
    } catch (e) {
      anteriores = [];
    }
    const carimbados = carimbarAlterados(Array.isArray(clientes) ? clientes : [], anteriores);
    localStorage.setItem("adega_clientes", JSON.stringify(carimbados));
  },
  // Contas a Pagar (Módulo Financeiro)
  // Tombstones genéricos: excluir aqui precisa continuar excluído depois do
  // merge com o outro caixa, senão a cópia antiga dele ressuscita o registro.
  _getExcluidosIds(chaveStorage) {
    try {
      const parsed = JSON.parse(localStorage.getItem(chaveStorage) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  },
  _adicionarExcluidosIds(chaveStorage, ids) {
    const atuais = new Set(this._getExcluidosIds(chaveStorage));
    (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
      if (id != null && id !== "") atuais.add(String(id));
    });
    localStorage.setItem(chaveStorage, JSON.stringify(Array.from(atuais).slice(-2e3)));
  },
  getContasExcluidasIds() {
    return this._getExcluidosIds("flowpdv_contas_excluidas_ids");
  },
  adicionarContasExcluidasIds(ids) {
    this._adicionarExcluidosIds("flowpdv_contas_excluidas_ids", ids);
  },
  getUsuariosExcluidosIds() {
    return this._getExcluidosIds("flowpdv_usuarios_excluidos_ids");
  },
  adicionarUsuariosExcluidosIds(ids) {
    this._adicionarExcluidosIds("flowpdv_usuarios_excluidos_ids", ids);
  },
  excluirContaPagar(id) {
    if (!id) return false;
    this.adicionarContasExcluidasIds(id);
    this.saveContasPagar(this.getContasPagar().filter((c) => c && String(c.id) !== String(id)));
    return true;
  },
  excluirUsuario(id) {
    if (!id) return false;
    this.adicionarUsuariosExcluidosIds(id);
    this.saveUsuarios(this.getUsuarios().filter((u) => u && String(u.id) !== String(id)));
    return true;
  },
  getContasPagar() {
    const saved = localStorage.getItem("flowpdv_contas_pagar");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const excluidas = new Set(this.getContasExcluidasIds());
          return parsed.filter((c) => c && !excluidas.has(String(c.id))).map((c) => {
            if (c.categoria === "Estoque / Fornecedores") {
              return { ...c, categoria: "Fornecedores" };
            }
            return c;
          });
        }
      } catch (e) {
      }
    }
    return [];
  },
  saveContasPagar(contas) {
    let anteriores = [];
    try {
      const saved = localStorage.getItem("flowpdv_contas_pagar");
      anteriores = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(anteriores)) anteriores = [];
    } catch (e) {
      anteriores = [];
    }
    const excluidas = new Set(this.getContasExcluidasIds());
    const vivas = (Array.isArray(contas) ? contas : []).filter((c) => c && !excluidas.has(String(c.id)));
    const carimbados = carimbarAlterados(vivas, anteriores);
    localStorage.setItem("flowpdv_contas_pagar", JSON.stringify(carimbados));
  },
  getContas() {
    return this.getContasPagar();
  },
  saveContas(contas) {
    return this.saveContasPagar(contas);
  },
  // Configurações
  getConfiguracoes() {
    return this.getConfig();
  },
  salvarConfiguracoes(config) {
    return this.saveConfig(config);
  },
  getConfig() {
    const saved = localStorage.getItem("adega_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.habilitarModuloFiado === void 0) {
          parsed.habilitarModuloFiado = true;
        }
        return parsed;
      } catch (e) {
      }
    }
    const defaults = {
      nomeLoja: "",
      cnpj: "",
      endereco: "",
      telefone: "",
      chavePix: "",
      impressoraPadrao: "58mm",
      autoImprimirCupom: true,
      habilitarModuloFiado: true
    };
    this.saveConfig(defaults);
    return defaults;
  },
  saveConfig(config, opts = {}) {
    const atual = { ...config || {} };
    if (atual.habilitarModuloFiado === void 0) {
      atual.habilitarModuloFiado = true;
    }
    if (opts.carimbar !== false) {
      atual.atualizadoEm = (/* @__PURE__ */ new Date()).toISOString();
    }
    localStorage.setItem("adega_config", JSON.stringify(atual));
  },
  // Balança de Checkout (USB / Serial RS-232)
  getBalancaConfig() {
    const saved = localStorage.getItem("flowpdv_balanca_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
      }
    }
    return {
      habilitado: true,
      modelo: "toledo_prix3",
      porta: "COM1",
      baudRate: 9600,
      modoSimulacao: true
    };
  },
  saveBalancaConfig(config) {
    localStorage.setItem("flowpdv_balanca_config", JSON.stringify(config));
  },
  // TEF / Máquina de Cartão Integrada
  getTefConfig() {
    const saved = localStorage.getItem("flowpdv_tef_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
      }
    }
    return {
      habilitado: false,
      provedor: "stone",
      stoneSecretKey: "",
      stoneSerial: "",
      stoneRecipientId: "",
      stoneServiceRefererName: "",
      stoneImprimirNaMaquininha: true,
      sitefCaminhoDll: "C:\\CliSiTef\\CliSiTefI.dll",
      sitefIp: "127.0.0.1",
      sitefLoja: "00000000",
      sitefTerminal: "FP000001",
      sitefParametros: ""
    };
  },
  saveTefConfig(config) {
    localStorage.setItem("flowpdv_tef_config", JSON.stringify(config));
  },
  // Módulo Fiscal (NFC-e Focus NFe / SAT)
  getFiscalConfig() {
    const saved = localStorage.getItem("flowpdv_fiscal_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
      }
    }
    return {
      habilitado: false,
      provedor: "focus_nfe",
      ambiente: "homologacao",
      tokenFocus: "",
      tokenFocusHomolog: "",
      cnpjEmitente: "",
      inscricaoEstadual: "",
      serieNfce: 0,
      autoEmitirAoFinalizar: true,
      regimeTributario: "1",
      cfopPadrao: "5102",
      ncmPadrao: "22030000",
      csosnPadrao: "102",
      naturezaOperacao: "VENDA AO CONSUMIDOR"
    };
  },
  saveFiscalConfig(fiscalConfig) {
    localStorage.setItem("flowpdv_fiscal_config", JSON.stringify(fiscalConfig));
  },
  // Licença SaaS
  getLicenca() {
    const ler = (chave) => {
      const saved = localStorage.getItem(chave);
      if (!saved) return null;
      try {
        const parsed2 = JSON.parse(saved);
        if (parsed2 && parsed2.chaveLicenca && String(parsed2.chaveLicenca).trim().length > 0) {
          return parsed2;
        }
      } catch (e) {
      }
      return null;
    };
    let parsed = ler("adega_licenca") || ler("adega_licenca_backup");
    if (!parsed && typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.carregarLicencaArquivoSync === "function") {
      try {
        const fromFile = window.electronAPI.carregarLicencaArquivoSync();
        if (fromFile && String(fromFile.chaveLicenca || "").trim()) {
          parsed = fromFile;
          try {
            localStorage.setItem("adega_licenca", JSON.stringify(parsed));
          } catch (e) {
          }
          try {
            localStorage.setItem("adega_licenca_backup", JSON.stringify(parsed));
          } catch (e) {
          }
        }
      } catch (e) {
      }
    }
    if (parsed) {
      let updated = false;
      if (parsed.chavePixSuporte === "19999997777" || !parsed.chavePixSuporte) {
        parsed.chavePixSuporte = "19989632127";
        updated = true;
      }
      if (parsed.whatsappSuporte === "19999997777" || parsed.whatsappSuporte === "(19) 99999-7777") {
        parsed.whatsappSuporte = "(19) 98963-2127";
        updated = true;
      }
      if (updated) {
        try {
          this.saveLicenca(parsed);
        } catch (e) {
        }
      }
      if (!ler("adega_licenca") && ler("adega_licenca_backup")) {
        try {
          localStorage.setItem("adega_licenca", JSON.stringify(parsed));
        } catch (e) {
        }
      }
      return parsed;
    }
    const defaults = {
      clienteId: "",
      chaveLicenca: "",
      nomeCliente: "",
      razaoSocial: "",
      status: "pendente_ativacao",
      categorias: ["Geral", "Alimentos", "Bebidas", "Vestu\xE1rio", "Eletr\xF4nicos", "Acess\xF3rios", "Higiene & Limpeza"],
      dataExpiracao: "",
      diasTolerancia: 2,
      valorMensal: 89.9,
      chavePixSuporte: "19989632127",
      whatsappSuporte: "(19) 98963-2127"
    };
    return defaults;
  },
  saveLicenca(lic) {
    if (!lic || typeof lic !== "object") return;
    try {
      const novaChave = String(lic.chaveLicenca || "").trim();
      if (!novaChave) {
        const atualRaw = localStorage.getItem("adega_licenca") || localStorage.getItem("adega_licenca_backup");
        if (atualRaw) {
          try {
            const atual = JSON.parse(atualRaw);
            if (atual && String(atual.chaveLicenca || "").trim()) {
              console.warn("[Storage] saveLicenca bloqueado: tentativa de gravar licen\xE7a sem chave.");
              return;
            }
          } catch (e) {
          }
        }
      }
      const json = JSON.stringify(lic);
      localStorage.setItem("adega_licenca", json);
      try {
        localStorage.setItem("adega_licenca_backup", json);
      } catch (e) {
      }
      if (novaChave && typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.salvarLicencaArquivo === "function") {
        window.electronAPI.salvarLicencaArquivo(lic).catch(() => {
        });
      }
    } catch (e) {
      console.error("[Storage] Falha ao salvar licen\xE7a (quota/disco?):", e);
      try {
        if (lic && lic.chaveLicenca) {
          localStorage.setItem("adega_licenca_backup", JSON.stringify(lic));
          if (typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.salvarLicencaArquivo === "function") {
            window.electronAPI.salvarLicencaArquivo(lic).catch(() => {
            });
          }
        }
      } catch (e2) {
      }
    }
  },
  // Gestão de Usuários & Operadores Multi-Acesso
  getUsuarios() {
    const saved = localStorage.getItem("flowpdv_usuarios");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const excluidos = new Set(this.getUsuariosExcluidosIds());
          const vivos = parsed.filter((u) => u && !excluidos.has(String(u.id)));
          if (vivos.length > 0) return vivos;
        }
      } catch (e) {
      }
    }
    const pinGerente = String(
      localStorage.getItem("flowpdv_pin_gerente") || this.getLicenca()?.pinGerente || ""
    ).trim();
    if (!pinGerente) return [];
    const defaults = [
      {
        id: "USR-ADMIN",
        nome: "Dono / Gerente",
        login: "admin",
        pin: pinGerente,
        cargo: "gerente",
        ativo: true,
        criadoEm: (/* @__PURE__ */ new Date()).toISOString()
      }
    ];
    this.saveUsuarios(defaults);
    return defaults;
  },
  saveUsuarios(usuarios) {
    const agora = (/* @__PURE__ */ new Date()).toISOString();
    const excluidos = new Set(this.getUsuariosExcluidosIds());
    const lista = (Array.isArray(usuarios) ? usuarios : []).filter((u) => u && !excluidos.has(String(u.id))).map((u) => {
      if (!u || u.atualizadoEm) return u;
      return { ...u, atualizadoEm: u.criadoEm || agora };
    });
    localStorage.setItem("flowpdv_usuarios", JSON.stringify(lista));
  },
  getMovimentosEstoque() {
    const saved = localStorage.getItem("flowpdv_estoque_movimentos");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },
  saveMovimentosEstoque(movimentos) {
    this.exigirVendaRecuperada();
    const lista = Array.isArray(movimentos) ? movimentos.slice(-8e3) : [];
    try {
      localStorage.setItem("flowpdv_estoque_movimentos", JSON.stringify(lista));
    } catch (e) {
      try {
        localStorage.setItem("flowpdv_estoque_movimentos", JSON.stringify(lista.slice(-800)));
      } catch (err) {
        console.warn("[Storage] Sem espa\xE7o para movimentos de estoque.", err);
      }
    }
  },
  registrarMovimentoEstoque({ produtoId, delta, origem, refId, saldoPara }) {
    const qtd = parseFloat(delta) || 0;
    const temSaldo = saldoPara != null && saldoPara !== "";
    if (!produtoId || !qtd && !temSaldo) return null;
    const mov = {
      id: "MOV-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
      produtoId: String(produtoId),
      delta: qtd,
      origem: origem || "ajuste",
      refId: refId || "",
      terminalId: this.getDeviceId(),
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (temSaldo) {
      mov.saldoPara = Math.max(0, parseFloat(saldoPara) || 0);
    }
    const lista = this.getMovimentosEstoque();
    lista.push(mov);
    this.saveMovimentosEstoque(lista);
    return mov;
  },
  getCheckpointEstoque() {
    try {
      const raw = localStorage.getItem("flowpdv_checkpoint_estoque");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  saveCheckpointEstoque(checkpoint) {
    if (!checkpoint || typeof checkpoint !== "object") return;
    localStorage.setItem("flowpdv_checkpoint_estoque", JSON.stringify(checkpoint));
  },
  getInventarios() {
    try {
      const raw = localStorage.getItem("flowpdv_inventarios");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },
  saveInventarios(lista) {
    localStorage.setItem("flowpdv_inventarios", JSON.stringify(Array.isArray(lista) ? lista : []));
  },
  // Mesas e Comandas
  getComandas() {
    const saved = localStorage.getItem("flowpdv_comandas_mesas");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
      }
    }
    return [];
  },
  saveComandas(comandas) {
    if (!Array.isArray(comandas)) return;
    const carimbadas = carimbarAlterados(comandas, this.getComandas());
    localStorage.setItem("flowpdv_comandas_mesas", JSON.stringify(carimbadas));
    return carimbadas;
  },
  // Produtos Padrão
  getDefaultProdutos() {
    return [];
  },
  // Exportação e Importação de Backup Completo em JSON (Offline)
  exportarBackupCompleto() {
    const backupData = {
      tipo: "flowpdv_backup",
      versao: "1.3.5",
      dataExportacao: (/* @__PURE__ */ new Date()).toISOString(),
      produtos: this.getProdutos(),
      vendas: this.getVendas(),
      clientes: this.getClientes(),
      contasPagar: this.getContasPagar(),
      usuarios: this.getUsuarios(),
      historicoTurnos: this.getHistoricoTurnos(),
      turnoAtual: this.getTurnoAtual(),
      configuracoes: this.getConfiguracoes(),
      fiscalConfig: this.getFiscalConfig(),
      tefConfig: this.getTefConfig(),
      licenca: this.getLicenca()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dataFmt = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    a.href = url;
    a.download = `Backup-FlowPDV-${dataFmt}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  },
  // Chaves do localStorage que pertencem à loja e não podem sobreviver a uma
  // troca de licença. O device id fica de fora: ele identifica o computador.
  CHAVES_DA_LOJA: [
    "adega_produtos",
    "adega_produtos_backup_seguranca",
    "adega_produtos_excluidos_ids",
    "flowpdv_estoque_movimentos",
    "adega_vendas",
    "flowpdv_ultimo_numero_venda",
    "adega_clientes",
    "flowpdv_contas_pagar",
    "adega_turno_atual",
    "adega_turnos_historico",
    "adega_turnos_excluidos_ids",
    "flowpdv_comandas_mesas",
    "flowpdv_usuarios",
    "flowpdv_categorias_loja",
    "adega_categorias_excluidas",
    "flowpdv_pin_gerente",
    "flowpdv_modulos_licenca",
    "flowpdv_ramo_licenca",
    "adega_config",
    "flowpdv_fiscal_config",
    "flowpdv_tef_config",
    "flowpdv_balanca_config",
    "flowpdv_ultimo_backup_data",
    "flowpdv_ultimo_backup_timestamp",
    "flowpdv_ultimo_backup_info",
    "flowpdv_ultimo_sync_cloud",
    "flowpdv_partes_manifesto",
    "flowpdv_partes_hash",
    "flowpdv_movimentos_enviados",
    "flowpdv_ultimo_mov_sync",
    "flowpdv_checkpoint_estoque",
    "flowpdv_checkpoint_enviado_em",
    "flowpdv_inventarios",
    "flowpdv_inventarios_enviados",
    "adega_licenca_backup",
    "flowpdv_terminal_heartbeat_ms",
    "flowpdv_tipo_terminal",
    "flowpdv_atend_tipo_chip",
    "flowpdv_notas_importadas",
    "flowpdv_contas_excluidas_ids",
    "flowpdv_usuarios_excluidos_ids"
  ],
  // NF-e já lançadas no estoque (chave de acesso): reimportar o mesmo XML
  // não pode dobrar a entrada.
  getNotasImportadas() {
    try {
      const lista = JSON.parse(localStorage.getItem("flowpdv_notas_importadas") || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  },
  notaJaImportada(chaveAcesso) {
    const chave = String(chaveAcesso || "").replace(/\D/g, "");
    if (!chave) return null;
    const local = this.getNotasImportadas().find((n) => n && String(n.chave) === chave);
    if (local) return local;
    const conta = (this.getContasPagar() || []).find((c) => c && String(c.chaveNFe || "").replace(/\D/g, "") === chave);
    return conta ? { chave, at: conta.criadoEm || null, numero: conta.numeroNota || "" } : null;
  },
  registrarNotaImportada(chaveAcesso, numero = "") {
    const chave = String(chaveAcesso || "").replace(/\D/g, "");
    if (!chave) return;
    const lista = this.getNotasImportadas().filter((n) => n && String(n.chave) !== chave);
    lista.push({ chave, numero: String(numero || ""), at: (/* @__PURE__ */ new Date()).toISOString() });
    localStorage.setItem("flowpdv_notas_importadas", JSON.stringify(lista.slice(-500)));
  },
  PREFIXOS_DA_LOJA: ["flowpdv_logs_auditoria_", "flowpdv_logs_nuvem_pendentes_", "flowpdv_logs_migrados_", "flowpdv_logs_exclusao_", "flowpdv_cache_", "flowpdv_master_"],
  // Limpeza de Isolamento Multi-Tenant ao Trocar de Empresa/Licença
  limparDadosLocaisParaNovaEmpresa(novaLic) {
    if (this.temVendaPendente() || window.TefModule?.temPendencias()) throw new Error("Resolva as vendas e pagamentos pendentes antes de trocar de loja.");
    this._produtosMem = null;
    this.CHAVES_DA_LOJA.forEach((chave) => localStorage.removeItem(chave));
    Object.keys(localStorage).filter((chave) => this.PREFIXOS_DA_LOJA.some((prefixo) => chave.startsWith(prefixo))).forEach((chave) => localStorage.removeItem(chave));
    sessionStorage.removeItem("flowpdv_usuario_logado");
    if (window.AuthModule) {
      window.AuthModule.usuarioAtual = null;
    }
    if (window.PdvModule) {
      window.PdvModule.carrinho = [];
      window.PdvModule.pagamentosLancados = [];
      window.PdvModule.clienteClubeAtivo = null;
    }
    if (novaLic) {
      this.saveLicenca(novaLic);
      if (Array.isArray(novaLic.categorias) && novaLic.categorias.length > 0) {
        this.salvarCategorias(novaLic.categorias);
      }
      if (novaLic.pinGerente) {
        localStorage.setItem("flowpdv_pin_gerente", String(novaLic.pinGerente).trim());
      }
    }
  },
  importarBackupCompleto(jsonObj) {
    if (!jsonObj || jsonObj.tipo !== "flowpdv_backup" && !jsonObj.produtos) {
      throw new Error("Arquivo de backup inv\xE1lido ou incompat\xEDvel.");
    }
    if (Array.isArray(jsonObj.produtos)) this.saveProdutos(jsonObj.produtos);
    if (Array.isArray(jsonObj.vendas)) localStorage.setItem("adega_vendas", JSON.stringify(jsonObj.vendas));
    if (Array.isArray(jsonObj.clientes)) this.saveClientes(jsonObj.clientes);
    if (Array.isArray(jsonObj.contasPagar)) this.saveContasPagar(jsonObj.contasPagar);
    if (Array.isArray(jsonObj.usuarios)) this.saveUsuarios(jsonObj.usuarios);
    if (Array.isArray(jsonObj.historicoTurnos)) this.salvarHistoricoTurnos(jsonObj.historicoTurnos);
    if (jsonObj.turnoAtual) this.salvarTurno(jsonObj.turnoAtual);
    if (jsonObj.configuracoes) this.saveConfig(jsonObj.configuracoes);
    if (jsonObj.fiscalConfig) this.saveFiscalConfig(jsonObj.fiscalConfig);
    if (jsonObj.tefConfig) this.saveTefConfig(jsonObj.tefConfig);
    if (jsonObj.licenca) this.saveLicenca(jsonObj.licenca);
    return true;
  }
};

// src/js/fiscal-core.js
var FOCUS_URLS = {
  producao: "https://api.focusnfe.com.br",
  homologacao: "https://homologacao.focusnfe.com.br"
};
var JANELA_CANCELAMENTO_MS = 30 * 60 * 1e3;
var round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
var round4 = (n) => Math.round((Number(n) || 0) * 1e4) / 1e4;
function somenteDigitos(v) {
  return String(v || "").replace(/\D/g, "");
}
function codigoSefazPagamento(forma) {
  const f = String(forma || "").toLowerCase();
  if (f.includes("dinheiro")) return "01";
  if (f.includes("cheque")) return "02";
  if (f.includes("fiado") || f.includes("cr\xE9dito loja") || f.includes("credito loja")) return "05";
  if (f.includes("cr\xE9dito") || f.includes("credito")) return "03";
  if (f.includes("d\xE9bito") || f.includes("debito")) return "04";
  if (f.includes("alimenta")) return "10";
  if (f.includes("refei")) return "11";
  if (f.includes("vale")) return "13";
  if (f.includes("pix")) return "17";
  return "99";
}
function dataEmissaoISO(agora = /* @__PURE__ */ new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const off = -agora.getTimezoneOffset();
  const sinal = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}T${pad(agora.getHours())}:${pad(agora.getMinutes())}:${pad(agora.getSeconds())}${sinal}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
function pagamentosDaVenda(venda) {
  const lista = [];
  if (venda.pagamentoDividido && Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0) {
    venda.pagamentos.forEach((p) => lista.push({ forma: p.forma, valor: round2(p.valor) }));
  } else if (venda.pagamentoDividido && (venda.parcela1 || venda.parcela2)) {
    if (venda.parcela1) lista.push({ forma: venda.parcela1.forma, valor: round2(venda.parcela1.valor) });
    if (venda.parcela2) lista.push({ forma: venda.parcela2.forma, valor: round2(venda.parcela2.valor) });
  } else {
    lista.push({ forma: venda.formaPagamento || "Dinheiro", valor: round2(venda.total) });
  }
  return lista.filter((p) => p.valor > 0);
}
function montarPayloadNFCe(venda, cfg, produtosPorId = /* @__PURE__ */ new Map(), agora = /* @__PURE__ */ new Date()) {
  const cnpj = somenteDigitos(cfg.cnpjEmitente);
  if (cnpj.length !== 14) {
    throw new Error("CNPJ do emitente inv\xE1lido na configura\xE7\xE3o fiscal.");
  }
  const total = round2(venda.total);
  if (total <= 0) {
    throw new Error("Venda sem valor (R$ 0,00) n\xE3o gera NFC-e.");
  }
  const itens = (venda.itens || []).filter((i) => (parseFloat(i.quantidade) || 0) > 0);
  if (itens.length === 0) {
    throw new Error("Venda sem itens n\xE3o gera NFC-e.");
  }
  const brutos = itens.map((i) => round2((parseFloat(i.precoUnitario) || 0) * (parseFloat(i.quantidade) || 0)));
  const somaBruta = round2(brutos.reduce((a, b) => a + b, 0));
  const descontoTotal = Math.max(0, round2(somaBruta - total));
  let descontoAcumulado = 0;
  const items = itens.map((item, idx) => {
    const prod = produtosPorId.get(item.id) || produtosPorId.get(String(item.id)) || {};
    const ncm = somenteDigitos(item.ncm || prod.ncm || cfg.ncmPadrao) || "22030000";
    const cfop = somenteDigitos(item.cfop || prod.cfop || cfg.cfopPadrao) || "5102";
    const csosn = somenteDigitos(item.csosn || prod.csosn || cfg.csosnPadrao) || "102";
    const origem = String(item.icmsOrigem ?? prod.icmsOrigem ?? "0");
    const qtd = round4(item.quantidade);
    const precoUnit = round2(item.precoUnitario);
    const bruto = brutos[idx];
    const ehKg = item.permiteFracionado === true || String(item.unidade || prod.unidade || "").toLowerCase() === "kg";
    const unidade = ehKg ? "KG" : "UN";
    let desconto = 0;
    if (descontoTotal > 0 && somaBruta > 0) {
      desconto = idx === itens.length - 1 ? round2(descontoTotal - descontoAcumulado) : round2(descontoTotal * (bruto / somaBruta));
      desconto = Math.min(desconto, bruto);
      descontoAcumulado = round2(descontoAcumulado + desconto);
    }
    const it = {
      numero_item: String(idx + 1),
      codigo_produto: String(item.codigoBarras || prod.codigoBarras || item.id || idx + 1).slice(0, 60),
      codigo_barras_comercial: somenteDigitos(item.codigoBarras || prod.codigoBarras) || "SEM GTIN",
      codigo_barras_tributavel: somenteDigitos(item.codigoBarras || prod.codigoBarras) || "SEM GTIN",
      descricao: String(item.nome || "ITEM").slice(0, 120),
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
      pis_situacao_tributaria: "49",
      cofins_situacao_tributaria: "49",
      inclui_no_total: "1"
    };
    if (desconto > 0) it.valor_desconto = desconto;
    if (prod.cest) it.cest = somenteDigitos(prod.cest);
    return it;
  });
  const formas_pagamento = pagamentosDaVenda(venda).map((p) => ({
    forma_pagamento: codigoSefazPagamento(p.forma),
    valor_pagamento: p.valor
  }));
  const somaPag = round2(formas_pagamento.reduce((a, p) => a + p.valor_pagamento, 0));
  if (formas_pagamento.length === 0 || Math.abs(somaPag - total) > 0.011) {
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
    natureza_operacao: cfg.naturezaOperacao || "VENDA AO CONSUMIDOR",
    presenca_comprador: "1",
    modalidade_frete: "9",
    local_destino: "1",
    indicador_inscricao_estadual_destinatario: "9",
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
  if (venda.numeroVenda) obs.push(`Venda #${String(venda.numeroVenda).padStart(6, "0")}`);
  if (venda.operadorNome || venda.operador) obs.push(`Operador: ${venda.operadorNome || venda.operador}`);
  if (obs.length) payload.informacoes_adicionais_contribuinte = obs.join(" | ").slice(0, 2e3);
  return payload;
}
function interpretarRespostaFocus(status, body) {
  const b = body && typeof body === "object" ? body : {};
  if (status === 0 || status == null) {
    return { estado: "erro_rede", mensagem: b.mensagem || "Sem conex\xE3o com a Focus NFe.", dados: null };
  }
  if (status === 401) {
    return { estado: "erro_config", mensagem: "Token da Focus NFe inv\xE1lido ou de outro ambiente.", dados: null };
  }
  if (status === 403 || b.codigo === "permissao_negada") {
    return { estado: "erro_config", mensagem: b.mensagem || "CNPJ n\xE3o autorizado neste token da Focus NFe.", dados: null };
  }
  if (status === 404) {
    return { estado: "nao_encontrada", mensagem: b.mensagem || "NFC-e n\xE3o encontrada.", dados: null };
  }
  if (status >= 500) {
    return { estado: "erro_rede", mensagem: `Focus NFe indispon\xEDvel (HTTP ${status}).`, dados: null };
  }
  if (b.status === "autorizado") {
    return { estado: "autorizada", mensagem: b.mensagem_sefaz || "Autorizado o uso da NFC-e", dados: dadosAutorizacao(b) };
  }
  if (b.status === "cancelado") {
    return { estado: "cancelada", mensagem: b.mensagem_sefaz || "NFC-e cancelada", dados: dadosAutorizacao(b) };
  }
  if (b.status === "processando_autorizacao") {
    return { estado: "processando", mensagem: "NFC-e em processamento na SEFAZ.", dados: null };
  }
  if (b.status === "erro_autorizacao" || b.status === "denegado") {
    return {
      estado: "rejeitada",
      mensagem: `SEFAZ ${b.status_sefaz || ""}: ${b.mensagem_sefaz || "Rejeitada"}`.trim(),
      dados: null
    };
  }
  if (b.codigo === "already_processed") {
    return { estado: "ja_processada", mensagem: b.mensagem || "Refer\xEAncia j\xE1 utilizada.", dados: null };
  }
  if (b.codigo === "pending_operation") {
    return { estado: "processando", mensagem: b.mensagem || "Em processamento.", dados: null };
  }
  if (["ambiente_nao_configurado", "empresa_nao_configurada", "erro_validacao", "erro_validacao_schema", "requisicao_invalida"].includes(b.codigo)) {
    const detalhes = Array.isArray(b.erros) ? b.erros.map((e) => e.mensagem || e).join("; ") : "";
    return { estado: "erro_config", mensagem: [b.mensagem, detalhes].filter(Boolean).join(" - "), dados: null };
  }
  return {
    estado: status >= 200 && status < 300 ? "processando" : "rejeitada",
    mensagem: b.mensagem || b.mensagem_sefaz || `Resposta inesperada (HTTP ${status}).`,
    dados: null
  };
}
function dadosAutorizacao(b) {
  const chave = String(b.chave_nfe || "").replace(/^NFe/i, "");
  return {
    chaveAcesso: chave,
    protocoloAutorizacao: b.protocolo || b.numero_protocolo || b.protocolo_nota_fiscal && b.protocolo_nota_fiscal.numero_protocolo || "",
    numeroNfce: parseInt(b.numero, 10) || null,
    serieNfce: parseInt(b.serie, 10) || null,
    qrcodeUrl: b.qrcode_url || "",
    urlConsulta: b.url_consulta_nfe || urlConsultaPorUf(chave.slice(0, 2)),
    caminhoXml: b.caminho_xml_nota_fiscal || "",
    caminhoDanfe: b.caminho_danfe || "",
    caminhoXmlCancelamento: b.caminho_xml_cancelamento || "",
    dataAutorizacao: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function urlConsultaPorUf(codigoUf) {
  const mapa = {
    "35": "www.nfce.fazenda.sp.gov.br/consulta",
    "33": "www.nfce.fazenda.rj.gov.br/consulta",
    "31": "nfce.fazenda.mg.gov.br/portalnfce",
    "41": "www.fazenda.pr.gov.br/nfce/consulta",
    "43": "www.sefaz.rs.gov.br/nfce/consulta",
    "42": "sat.sef.sc.gov.br/nfce/consulta",
    "53": "www.fazenda.df.gov.br/nfce/consulta",
    "52": "www.nfce.go.gov.br/consulta",
    "29": "www.sefaz.ba.gov.br/nfce/consulta",
    "26": "nfce.sefaz.pe.gov.br/consulta",
    "23": "nfce.sefaz.ce.gov.br/consulta",
    "32": "app.sefaz.es.gov.br/ConsultaNFCe",
    "51": "www.sefaz.mt.gov.br/nfce/consultanfce",
    "50": "www.dfe.ms.gov.br/nfce/consulta",
    "13": "sistemas.sefaz.am.gov.br/nfceweb/consulta",
    "15": "appnfc.sefa.pa.gov.br/portal/consulta",
    "21": "www.nfce.sefaz.ma.gov.br/portal/consulta",
    "25": "www.receita.pb.gov.br/nfce/consulta",
    "24": "nfce.set.rn.gov.br/consulta",
    "27": "nfce.sefaz.al.gov.br/consulta",
    "28": "www.nfce.se.gov.br/portal/consulta",
    "22": "www.sefaz.pi.gov.br/nfce/consulta",
    "17": "www.sefaz.to.gov.br/nfce/consulta",
    "11": "www.nfce.sefin.ro.gov.br/consulta",
    "12": "www.sefaznet.ac.gov.br/nfce/consulta",
    "14": "www.sefaz.rr.gov.br/nfce/consulta",
    "16": "www.sefaz.ap.gov.br/nfce/consulta"
  };
  return mapa[codigoUf] || "www.nfe.fazenda.gov.br/portal";
}
function podeCancelarNFCe(venda, agora = Date.now()) {
  if (!venda || venda.statusFiscal !== "autorizada" || !venda.chaveNfe) return false;
  const base = Date.parse(venda.dataAutorizacaoNfce || venda.data || "");
  if (!base) return false;
  return agora - base <= JANELA_CANCELAMENTO_MS;
}
function refDaVenda(venda) {
  return `fp-${String(venda.id).replace(/[^A-Za-z0-9_-]/g, "")}`;
}

// src/js/tef-core.js
var STONE_API = "https://api.pagar.me";
var STONE_TIMEOUT_MS = 180 * 1e3;
var STONE_POLL_MS = 2e3;
var centavos = (v) => Math.round((Number(v) || 0) * 100);
function montarPedidoStone(params, cfg = {}) {
  const valor = centavos(params.valor);
  if (valor <= 0) throw new Error("Valor inv\xE1lido para o TEF.");
  const tipo = tipoStone(params.tipo);
  const parcelas = Math.max(1, parseInt(params.parcelas, 10) || 1);
  const items = Array.isArray(params.itens) && params.itens.length > 0 ? params.itens.map((i) => ({
    amount: Math.max(1, centavos(i.precoUnitario)),
    description: String(i.nome || "Item").slice(0, 64),
    quantity: Math.max(1, Math.round(Number(i.quantidade) || 1))
  })) : [{ amount: valor, description: String(params.descricao || "Venda FlowPDV").slice(0, 64), quantity: 1 }];
  const somaItens = items.reduce((a, i) => a + i.amount * i.quantity, 0);
  const itensFinais = somaItens === valor ? items : [{ amount: valor, description: String(params.descricao || "Venda FlowPDV").slice(0, 64), quantity: 1 }];
  const payment_setup = { type: tipo, installments: tipo === "credit" ? parcelas : 1, installment_type: "merchant" };
  if (cfg.recipientId) {
    payment_setup.split = [{
      recipient_id: String(cfg.recipientId).trim(),
      type: "percentage",
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
      display_name: String(params.descricao || "FlowPDV").slice(0, 30)
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
function tipoStone(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("d\xE9b") || t.includes("deb")) return "debit";
  if (t.includes("pix")) return "pix";
  if (t.includes("voucher") || t.includes("vale") || t.includes("alimenta") || t.includes("refei")) return "voucher";
  return "credit";
}
function interpretarPedidoStone(order, valorEsperado = null) {
  const o = order && typeof order === "object" ? order : {};
  const charges = Array.isArray(o.charges) ? o.charges : [];
  const pagas = charges.filter((c) => c && c.status === "paid");
  const totalPago = pagas.reduce((n, c) => n + Number(c.paid_amount ?? c.amount ?? 0), 0);
  const esperado = valorEsperado == null ? Number(o.amount || totalPago) : centavos(valorEsperado);
  const paga = pagas[0];
  if (paga && totalPago === esperado && esperado > 0 && !charges.some((c) => c && ["pending", "processing"].includes(c.status))) {
    const t = paga.last_transaction || {};
    const card = t.card || {};
    return {
      estado: "aprovada",
      mensagem: "Pagamento aprovado.",
      dados: {
        sucesso: true,
        provedor: "stone",
        pedidoId: o.id || "",
        chargeId: paga.id || "",
        chargeIds: pagas.map((c) => c.id).filter(Boolean),
        transacaoId: t.id || "",
        nsu: String(t.acquirer_nsu || t.nsu || paga.id || ""),
        autorizacao: String(t.acquirer_auth_code || t.authorization_code || ""),
        bandeira: card.brand ? capitalizar(card.brand) : t.brand ? capitalizar(t.brand) : "",
        finalCartao: card.last_four_digits || "",
        tipo: t.payment_method === "debit_card" ? "D\xE9bito" : t.payment_method === "pix" ? "Pix" : t.payment_method === "voucher" ? "Voucher" : "Cr\xE9dito",
        parcelas: t.installments || 1,
        valor: totalPago / 100,
        rede: "Stone",
        dataHora: paga.paid_at || paga.updated_at || (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  if (pagas.length) return { estado: "aguardando", mensagem: "Pagamento parcial ou divergente. Confira todas as cobran\xE7as.", dados: null };
  if (charges.some((c) => !c || !["failed", "canceled", "voided"].includes(c.status))) return { estado: "aguardando", mensagem: "H\xE1 cobran\xE7as ainda pendentes.", dados: null };
  const falhou = charges.find((c) => c && (c.status === "failed" || c.status === "canceled" || c.status === "voided"));
  if (falhou) {
    const t = falhou.last_transaction || {};
    return {
      estado: "recusada",
      mensagem: t.acquirer_message || t.gateway_response?.errors?.[0]?.message || "Transa\xE7\xE3o n\xE3o aprovada na maquininha.",
      dados: null
    };
  }
  if (o.status === "canceled" || o.status === "failed") {
    return { estado: "cancelada", mensagem: "Pedido cancelado.", dados: null };
  }
  return { estado: "aguardando", mensagem: "Aguardando o cliente na maquininha...", dados: null };
}
function capitalizar(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : "";
}
function mensagemErroStone(status, body) {
  const b = body && typeof body === "object" ? body : {};
  if (status === 0) return b.mensagem || "Sem conex\xE3o com a Stone.";
  if (status === 401) return "Chave secreta (sk_) da Stone inv\xE1lida.";
  if (status === 403) return "Conta Stone sem permiss\xE3o para o Connect. Verifique o credenciamento no Programa de Parceiros.";
  if (status === 404) return "Pedido n\xE3o encontrado na Stone.";
  if (b.message) {
    const det = b.errors ? Object.values(b.errors).flat().join("; ") : "";
    return [b.message, det].filter(Boolean).join(" - ");
  }
  return `Stone respondeu HTTP ${status}.`;
}
function funcaoSitef(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("d\xE9b") || t.includes("deb")) return 2;
  if (t.includes("cr\xE9") || t.includes("cre")) return 3;
  if (t.includes("pix") || t.includes("carteira")) return 122;
  if (t.includes("voucher") || t.includes("vale") || t.includes("alimenta") || t.includes("refei")) return 5;
  return 0;
}
function valorSitef(valor) {
  return (Number(valor) || 0).toFixed(2).replace(".", ",");
}
function parseMenuSitef(buffer) {
  const txt = String(buffer || "");
  const semClasse = txt.includes("|") ? txt.split("|").slice(1).join("|") : txt;
  return semClasse.split(";").map((s) => s.trim()).filter(Boolean).map((op) => {
    const partes = op.split(":");
    return { indice: partes[0].trim(), texto: (partes[1] || partes[0]).trim() };
  });
}
function interpretarCamposSitef(campos, contexto = {}) {
  const c = campos || {};
  const modalidade = String(c[100] || "");
  const dataHora = String(c[105] || "");
  const iso = dataHora.length === 14 ? `${dataHora.slice(0, 4)}-${dataHora.slice(4, 6)}-${dataHora.slice(6, 8)}T${dataHora.slice(8, 10)}:${dataHora.slice(10, 12)}:${dataHora.slice(12, 14)}` : (/* @__PURE__ */ new Date()).toISOString();
  return {
    sucesso: true,
    provedor: "sitef",
    modalidade,
    descricaoModalidade: String(c[101] || c[102] || ""),
    nsu: String(c[133] || ""),
    nsuHost: String(c[134] || ""),
    autorizacao: String(c[135] || ""),
    bandeira: String(c[132] || c[131] || ""),
    bin: String(c[136] || ""),
    tipo: contexto.tipo || (modalidade.startsWith("01") ? "D\xE9bito" : modalidade.startsWith("02") ? "Cr\xE9dito" : ""),
    parcelas: contexto.parcelas || 1,
    valor: contexto.valor,
    rede: String(c[157] || c[158] || "SiTef"),
    comprovanteCliente: String(c[121] || ""),
    comprovanteLoja: String(c[122] || ""),
    dataHora: iso
  };
}
function mensagemRetornoSitef(codigo) {
  const n = Number(codigo);
  const mapa = {
    0: "Transa\xE7\xE3o conclu\xEDda.",
    "-1": "CliSiTef n\xE3o inicializada. Confira IP, loja e terminal.",
    "-2": "Opera\xE7\xE3o cancelada pelo operador.",
    "-3": "Fun\xE7\xE3o/modalidade inv\xE1lida.",
    "-4": "Falta de mem\xF3ria no PDV.",
    "-5": "Sem comunica\xE7\xE3o com o servidor SiTef.",
    "-6": "Opera\xE7\xE3o cancelada pelo cliente no pinpad.",
    "-8": "CliSiTef desatualizada para esta fun\xE7\xE3o.",
    "-9": "Fluxo interativo n\xE3o iniciado.",
    "-10": "Par\xE2metro obrigat\xF3rio n\xE3o informado.",
    "-12": "Processo interativo anterior n\xE3o foi conclu\xEDdo.",
    "-13": "Documento fiscal n\xE3o encontrado na CliSiTef.",
    "-15": "Opera\xE7\xE3o cancelada pela automa\xE7\xE3o.",
    "-20": "Par\xE2metro inv\xE1lido passado \xE0 CliSiTef.",
    "-21": "Utiliza\xE7\xE3o de fun\xE7\xE3o inv\xE1lida.",
    "-25": "Erro na leitura do cart\xE3o / pinpad.",
    "-30": "Erro de acesso ao arquivo da CliSiTef.",
    "-40": "Transa\xE7\xE3o negada pelo SiTef.",
    "-41": "Dados inv\xE1lidos.",
    "-43": "Problema no pinpad.",
    "-50": "Transa\xE7\xE3o n\xE3o segura.",
    "-100": "Erro interno da CliSiTef."
  };
  if (mapa[n] != null) return mapa[n];
  if (n > 0) return `Negada pelo autorizador (c\xF3digo ${n}).`;
  return `Erro CliSiTef ${n}.`;
}
function mensagemConfiguraSitef(codigo) {
  const mapa = {
    0: "OK",
    1: "Endere\xE7o IP do SiTef inv\xE1lido ou n\xE3o resolvido.",
    2: "C\xF3digo da loja inv\xE1lido (8 d\xEDgitos).",
    3: "C\xF3digo do terminal inv\xE1lido (formato AA000001).",
    6: "Erro na inicializa\xE7\xE3o do TCP/IP.",
    7: "Falta de mem\xF3ria.",
    8: "N\xE3o encontrou a CliSiTef ou ela est\xE1 com problemas.",
    9: "Configura\xE7\xE3o de servidores SiTef foi excedida.",
    10: "Erro de acesso na pasta CliSiTef (permiss\xE3o de escrita).",
    11: "Dados inv\xE1lidos passados pela automa\xE7\xE3o.",
    12: "Modo seguro n\xE3o ativo.",
    13: "Caminho da DLL inv\xE1lido."
  };
  return mapa[Number(codigo)] || `Erro ${codigo} ao configurar a CliSiTef.`;
}

// src/js/tef-ledger.js
var TefLedger = class {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
  }
  listar() {
    const raw = this.storage.getItem(this.key);
    const lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) throw new Error("Di\xE1rio TEF inv\xE1lido. Restaure o di\xE1rio antes de cobrar.");
    return lista;
  }
  pendentes() {
    return this.listar().filter((t) => !["concluida", "cancelada", "recusada"].includes(t.estado));
  }
  obter(id) {
    return this.listar().find((t) => t.id === id);
  }
  salvar(op) {
    const lista = this.listar();
    const i = lista.findIndex((t) => t.id === op.id);
    const registro = { ...i < 0 ? {} : lista[i], ...op, atualizadoEm: (/* @__PURE__ */ new Date()).toISOString() };
    if (i < 0) lista.push(registro);
    else lista[i] = registro;
    this.storage.setItem(this.key, JSON.stringify(lista));
    return registro;
  }
};
function validarConfigIntegracao(cfg) {
  if (!cfg || !cfg.habilitado) return "";
  if (cfg.provedor === "stone") {
    if (!cfg.stoneSecretKey || !cfg.stoneSerial) return "Informe a chave Stone e o serial da maquininha.";
    return "";
  }
  if (cfg.provedor === "sitef") {
    if (!cfg.sitefCaminhoDll || !cfg.sitefIp || !/^\d{8}$/.test(cfg.sitefLoja || "") || !/^[A-Z]{2}\d{6}$/.test(cfg.sitefTerminal || "")) {
      return "Confira DLL, servidor, loja de 8 d\xEDgitos e terminal SiTef (ex.: FP000001).";
    }
    return "";
  }
  return "Escolha Stone ou SiTef para integrar. O simulador n\xE3o registra pagamentos de vendas.";
}
function valorTefConfere(esperado, recebido) {
  return Number.isFinite(Number(recebido)) && Number(recebido) > 0 && Math.round(Number(esperado) * 100) === Math.round(Number(recebido) * 100);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FOCUS_URLS,
  JANELA_CANCELAMENTO_MS,
  STONE_API,
  STONE_POLL_MS,
  STONE_TIMEOUT_MS,
  StorageService,
  TefLedger,
  calcularDeltasInventario,
  carimbarAlterados,
  clientesPrecisamReenviar,
  codigoSefazPagamento,
  consolidarProdutosComMovimentos,
  contasPagarPrecisamReenviar,
  dataEmissaoISO,
  dinheiroLiquidoVenda,
  dividirEmLotes,
  documentosDoCliente,
  encontrarClientePorDocumento,
  funcaoSitef,
  idComandaPorNumero,
  interpretarCamposSitef,
  interpretarPedidoStone,
  interpretarRespostaFocus,
  juntarMovimentosPorId,
  logCaiuNaExclusao,
  mapearMovimentosPorId,
  mensagemConfiguraSitef,
  mensagemErroStone,
  mensagemRetornoSitef,
  mesclarClientes,
  mesclarComandas,
  mesclarConfigLoja,
  mesclarContasPagar,
  mesclarDadosTerminal,
  mesclarInventarios,
  mesclarItensPorId,
  mesclarSessaoInventario,
  montarCheckpointEstoque,
  montarPayloadNFCe,
  montarPedidoStone,
  nomeComandaPorId,
  normalizarMovimentos,
  normalizarTipoTerminal,
  pagamentosDaVenda,
  parseMenuSitef,
  podeCancelarNFCe,
  recuarIso,
  refDaVenda,
  somenteDigitos,
  tipoStone,
  tipoTerminalDe,
  totalAuditoriaVisivel,
  ultimoAtMovimentos,
  urlConsultaPorUf,
  validarConfigIntegracao,
  valorSitef,
  valorTefConfere,
  vendaPertenceAoTurno
});
