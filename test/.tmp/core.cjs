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
  StorageService: () => StorageService,
  carimbarAlterados: () => carimbarAlterados,
  consolidarProdutosComMovimentos: () => consolidarProdutosComMovimentos,
  dividirEmLotes: () => dividirEmLotes,
  mapearMovimentosPorId: () => mapearMovimentosPorId,
  mesclarComandas: () => mesclarComandas,
  mesclarItensPorId: () => mesclarItensPorId,
  normalizarMovimentos: () => normalizarMovimentos
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
function consolidarProdutosComMovimentos({
  produtosNuvem = [],
  produtosLocais = [],
  movimentosNuvem = [],
  movimentosLocais = []
} = {}) {
  const catalogo = mesclarItensPorId(produtosNuvem, produtosLocais);
  const mapaLocal = /* @__PURE__ */ new Map();
  (produtosLocais || []).forEach((item) => {
    if (item && item.id) mapaLocal.set(String(item.id), item);
  });
  const produtos = catalogo.map((merged) => {
    const local = mapaLocal.get(String(merged.id));
    if (!local) return merged;
    return { ...merged, estoque: parseFloat(local.estoque) || 0 };
  });
  const idsConhecidos = new Set((movimentosLocais || []).map((m) => m && m.id).filter(Boolean));
  const novosMovimentos = normalizarMovimentos(movimentosNuvem).filter((m) => !idsConhecidos.has(m.id));
  novosMovimentos.forEach((mov) => {
    const produto = produtos.find(
      (p) => String(p.id) === String(mov.produtoId) || String(p.codigoBarras || "") === String(mov.produtoId)
    );
    if (!produto || produto.controlarEstoque === false) return;
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

// src/js/storage.js
var StorageService = {
  init() {
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
  getDeviceId() {
    let devId = localStorage.getItem("flowpdv_device_id");
    if (!devId) {
      devId = "TERM-" + Math.random().toString(36).substr(2, 6).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      localStorage.setItem("flowpdv_device_id", devId);
    }
    return devId;
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
  // Produtos & Estoque
  getProdutos() {
    const saved = localStorage.getItem("adega_produtos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    if (Array.isArray(produtos) && produtos.length > 0) {
      const backupAtual = this.getProdutos();
      if (produtos.length >= backupAtual.length) {
        localStorage.setItem("adega_produtos_backup_seguranca", JSON.stringify(produtos));
      }
    }
    const excluidos = this.getProdutosExcluidosIds();
    const listaLimpa = Array.isArray(produtos) ? produtos.filter((p) => p && p.id && !excluidos.includes(String(p.id))) : [];
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
  saveVenda(venda) {
    const vendas = this.getVendas();
    vendas.unshift(venda);
    localStorage.setItem("adega_vendas", JSON.stringify(vendas));
    const turno = this.getTurnoAtual();
    if (turno && venda.id) {
      turno.vendasIds = turno.vendasIds || [];
      turno.vendasIds.push(venda.id);
      this.salvarTurno(turno);
    }
    const produtos = this.getProdutos();
    (venda.itens || []).forEach((item) => {
      const prod = produtos.find((p) => p.id === item.id || p.codigoBarras === item.id);
      if (prod && prod.controlarEstoque !== false) {
        const fator = item.isFardo ? prod.fatorConversao || 1 : 1;
        const delta = -((parseFloat(item.quantidade) || 0) * fator);
        prod.estoque = Math.max(0, (parseFloat(prod.estoque) || 0) + delta);
        prod.atualizadoEm = (/* @__PURE__ */ new Date()).toISOString();
        this.registrarMovimentoEstoque({
          produtoId: prod.id,
          delta,
          origem: "venda",
          refId: venda.id
        });
      }
    });
    this.saveProdutos(produtos);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
      window.CloudSyncModule.enviarAlteracaoNuvem("venda");
    }
  },
  atualizarVenda(venda) {
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
    localStorage.setItem("adega_turno_atual", JSON.stringify(turno));
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
      window.CloudSyncModule.enviarAlteracaoNuvem("turno");
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
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === "function") {
      window.CloudSyncModule.enviarAlteracaoNuvem("turno");
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
    localStorage.setItem("adega_clientes", JSON.stringify(clientes));
  },
  // Contas a Pagar (Módulo Financeiro)
  getContasPagar() {
    const saved = localStorage.getItem("flowpdv_contas_pagar");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => {
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
    localStorage.setItem("flowpdv_contas_pagar", JSON.stringify(contas));
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
  saveConfig(config) {
    if (config && config.habilitarModuloFiado === void 0) {
      config.habilitarModuloFiado = true;
    }
    localStorage.setItem("adega_config", JSON.stringify(config));
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
      provedor: "simulador",
      tempoLimiteSegundos: 45,
      imprimirComprovanteTef: true,
      confirmacaoAutomatica: true
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
      cnpjEmitente: "",
      inscricaoEstadual: "",
      cscId: "000001",
      cscToken: "",
      serieNfce: 1,
      ultimoNumeroNfce: 1,
      regimeTributario: "1",
      cfopPadrao: "5102",
      ncmPadrao: "22030000",
      csosnPadrao: "102",
      naturezaOperacao: "VENDA AO CONSUMIDOR",
      autoEmitirAoFinalizar: false
    };
  },
  saveFiscalConfig(fiscalConfig) {
    localStorage.setItem("flowpdv_fiscal_config", JSON.stringify(fiscalConfig));
  },
  // Licença SaaS
  getLicenca() {
    const saved = localStorage.getItem("adega_licenca");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.chaveLicenca && parsed.chaveLicenca.trim().length > 0) {
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
              localStorage.setItem("adega_licenca", JSON.stringify(parsed));
            } catch (e) {
            }
          }
          return parsed;
        }
      } catch (e) {
      }
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
    localStorage.setItem("adega_licenca", JSON.stringify(lic));
  },
  // Gestão de Usuários & Operadores Multi-Acesso
  getUsuarios() {
    const saved = localStorage.getItem("flowpdv_usuarios");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    localStorage.setItem("flowpdv_usuarios", JSON.stringify(usuarios));
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
    const lista = Array.isArray(movimentos) ? movimentos.slice(-2500) : [];
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
  registrarMovimentoEstoque({ produtoId, delta, origem, refId }) {
    const qtd = parseFloat(delta);
    if (!produtoId || !qtd) return null;
    const mov = {
      id: "MOV-" + Date.now() + "-" + Math.random().toString(36).substring(2, 8),
      produtoId: String(produtoId),
      delta: qtd,
      origem: origem || "ajuste",
      refId: refId || "",
      terminalId: this.getDeviceId(),
      at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const lista = this.getMovimentosEstoque();
    lista.push(mov);
    this.saveMovimentosEstoque(lista);
    return mov;
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
    "flowpdv_ultimo_mov_sync"
  ],
  PREFIXOS_DA_LOJA: ["flowpdv_logs_auditoria_", "flowpdv_cache_", "flowpdv_master_"],
  // Limpeza de Isolamento Multi-Tenant ao Trocar de Empresa/Licença
  limparDadosLocaisParaNovaEmpresa(novaLic) {
    this.CHAVES_DA_LOJA.forEach((chave) => localStorage.removeItem(chave));
    Object.keys(localStorage).filter((chave) => this.PREFIXOS_DA_LOJA.some((prefixo) => chave.startsWith(prefixo))).forEach((chave) => localStorage.removeItem(chave));
    sessionStorage.removeItem("flowpdv_usuario_logado");
    if (window.AuthModule) {
      window.AuthModule.usuarioAtual = null;
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StorageService,
  carimbarAlterados,
  consolidarProdutosComMovimentos,
  dividirEmLotes,
  mapearMovimentosPorId,
  mesclarComandas,
  mesclarItensPorId,
  normalizarMovimentos
});
