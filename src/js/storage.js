/**
 * storage.js - Armazenamento Local (Offline-First) para PDV Adega & Motor SaaS
 */

import { carimbarAlterados } from './merge-core.js';

export const StorageService = {
  init() {
    this.getProdutos();
    this.getConfig();
    this.getClientes();
    this.getLicenca();
    this.getDeviceId();
  },

  isGerente() {
    if (window.AuthModule && typeof window.AuthModule.isGerente === 'function') {
      return window.AuthModule.isGerente();
    }
    return false;
  },

  parseMoedaBR(valor) {
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    if (!valor) return 0;
    let str = String(valor).trim();
    if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    const limpo = str.replace(/[^\d.-]/g, '');
    return parseFloat(limpo) || 0;
  },

  formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatarNumeroTurno(id) {
    if (!id) return '000000';
    const texto = String(id);
    const trn = texto.match(/TRN-(\d+)/i);
    const digits = trn ? trn[1] : texto.replace(/\D/g, '');
    if (digits.length >= 6) return digits.slice(-6);
    if (digits.length > 0) return digits.padStart(6, '0');
    return texto.slice(-6);
  },

  formatarNumeroVenda(vendaOuId) {
    const venda = (vendaOuId && typeof vendaOuId === 'object') ? vendaOuId : { id: vendaOuId };
    const num = parseInt(venda.numeroVenda, 10);
    if (Number.isFinite(num) && num > 0) return String(num).padStart(6, '0');
    const texto = String(venda.id || '');
    const vnd = texto.match(/VND-(\d+)/i);
    if (vnd) return vnd[1].slice(-6).padStart(6, '0');
    const digits = texto.replace(/\D/g, '');
    if (digits.length > 0) return digits.slice(-6).padStart(6, '0');
    return '------';
  },

  getDeviceId() {
    let devId = localStorage.getItem('flowpdv_device_id');
    if (!devId) {
      devId = 'TERM-' + Math.random().toString(36).substr(2, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
      localStorage.setItem('flowpdv_device_id', devId);
    }
    return devId;
  },

  
  // Categorias Dinâmicas (SaaS Multi-Tenant com suporte estrito a exclusões)
  getCategorias() {
    const excluidas = (this.getCategoriasExcluidas() || []).map(c => String(c).toLowerCase().trim());
    const saved = localStorage.getItem('flowpdv_categorias_loja');
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtradas = parsed.filter(c => !excluidas.includes(String(c).toLowerCase().trim()));
          if (filtradas.length > 0) return filtradas;
          return ['Geral'];
        }
      } catch(e) {}
    }

    const lic = this.getLicenca();
    if (lic && Array.isArray(lic.categorias) && lic.categorias.length > 0) {
      const filtradasLic = lic.categorias.filter(c => !excluidas.includes(String(c).toLowerCase().trim()));
      if (filtradasLic.length > 0) return filtradasLic;
      return ['Geral'];
    }

    const defaults = ['Geral', 'Cervejas', 'Destilados', 'Vinhos', 'Não Alcoólicos', 'Petiscos', 'Tabacaria', 'Gelo & Carvão'];
    const filtradasDef = defaults.filter(c => !excluidas.includes(c.toLowerCase()));
    return filtradasDef.length > 0 ? filtradasDef : ['Geral'];
  },

  salvarCategorias(categorias) {
    const lista = Array.isArray(categorias) ? categorias : [];
    localStorage.setItem('flowpdv_categorias_loja', JSON.stringify(lista));
    const lic = this.getLicenca() || {};
    lic.categorias = lista;
    this.saveLicenca(lic);
  },

  getCategoriasExcluidas() {
    try {
      const saved = localStorage.getItem('adega_categorias_excluidas');
      return saved ? JSON.parse(saved) : [];
    } catch(e) {
      return [];
    }
  },

  adicionarCategoriaExcluida(nome) {
    if (!nome) return;
    const n = String(nome).trim();
    let excluidas = this.getCategoriasExcluidas();
    if (!excluidas.some(c => c.toLowerCase() === n.toLowerCase())) {
      excluidas.push(n);
      localStorage.setItem('adega_categorias_excluidas', JSON.stringify(excluidas));
    }
  },

  removerCategoriaExcluida(nome) {
    if (!nome) return;
    const n = String(nome).trim();
    let excluidas = this.getCategoriasExcluidas();
    excluidas = excluidas.filter(c => c.toLowerCase() !== n.toLowerCase());
    localStorage.setItem('adega_categorias_excluidas', JSON.stringify(excluidas));
  },

  // Módulos e Segmentos por Licença (SaaS Multi-Ramo)
  getModulosLicenca() {
    const lic = this.getLicenca();
    if (lic && lic.modulos && typeof lic.modulos === 'object') {
      return lic.modulos;
    }
    const saved = localStorage.getItem('flowpdv_modulos_licenca');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch(e) {}
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
    if (!modulos || typeof modulos !== 'object') return;
    localStorage.setItem('flowpdv_modulos_licenca', JSON.stringify(modulos));
    const lic = this.getLicenca() || {};
    lic.modulos = modulos;
    this.saveLicenca(lic);
  },

  isModuloAtivo(nomeModulo) {
    const modulos = this.getModulosLicenca();
    if (!modulos || typeof modulos !== 'object') return false;
    return Boolean(modulos[nomeModulo]);
  },

  getRamoLicenca() {
    const lic = this.getLicenca();
    if (lic && lic.ramoAtividade) return lic.ramoAtividade;
    return localStorage.getItem('flowpdv_ramo_licenca') || 'adega';
  },

  setRamoLicenca(ramo) {
    if (!ramo) return;
    localStorage.setItem('flowpdv_ramo_licenca', ramo);
    const lic = this.getLicenca() || {};
    lic.ramoAtividade = ramo;
    this.saveLicenca(lic);
  },

  getIconeCategoria(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('cervej') || c.includes('chopp')) return '🍺';
    if (c.includes('destil') || c.includes('whisky') || c.includes('vodka') || c.includes('gin') || c.includes('cachaça') || c.includes('rum') || c.includes('licor') || c.includes('tequila')) return '🥃';
    if (c.includes('vinh') || c.includes('espumant') || c.includes('champagne')) return '🍷';
    if (c.includes('não alc') || c.includes('nao alc') || c.includes('refrig') || c.includes('suco') || c.includes('água') || c.includes('agua') || c.includes('energet') || c.includes('energét')) return '🥤';
    if (c.includes('bebid') || c.includes('drink')) return '🍷';
    if (c.includes('gelo') && c.includes('carv')) return '🧊';
    if (c.includes('gelo')) return '🧊';
    if (c.includes('carv')) return '🔥';
    if (c.includes('tabac') || c.includes('cigar') || c.includes('essênc') || c.includes('essenc') || c.includes('seda') || c.includes('pod') || c.includes('vape') || c.includes('narguil')) return '🚬';
    if (c.includes('petisc') || c.includes('snack') || c.includes('salgad') || c.includes('amendo') || c.includes('batata') || c.includes('pringle') || c.includes('dorito') || c.includes('ruffle')) return '🥜';
    if (c.includes('bomboniere') || c.includes('chocolat') || c.includes('doce') || c.includes('bala') || c.includes('chicle')) return '🍬';
    if (c.includes('combo') || c.includes('kit') || c.includes('promo')) return '⚡';
    if (c.includes('aliment') || c.includes('arroz') || c.includes('feijão') || c.includes('massa') || c.includes('mercear')) return '🌾';
    if (c.includes('carn') || c.includes('açougu') || c.includes('acougu') || c.includes('frango') || c.includes('peix') || c.includes('churr')) return '🥩';
    if (c.includes('latic') || c.includes('queij') || c.includes('leite') || c.includes('frio') || c.includes('presunt')) return '🧀';
    if (c.includes('horti') || c.includes('frut') || c.includes('legum') || c.includes('verdur')) return '🍎';
    if (c.includes('padar') || c.includes('pão') || c.includes('pao') || c.includes('bolo')) return '🥖';
    if (c.includes('higien') || c.includes('sabon') || c.includes('shamp') || c.includes('cosmet')) return '🧴';
    if (c.includes('limpez') || c.includes('deterg') || c.includes('desinf')) return '🧹';
    if (c.includes('matina') || c.includes('café') || c.includes('cafe') || c.includes('achocolat')) return '☕';
    if (c.includes('acessór') || c.includes('acessor') || c.includes('copo') || c.includes('taça') || c.includes('taca') || c.includes('canec')) return '🏺';
    return '🏷️';
  },

  _produtosMem: null,

  // Produtos & Estoque
  getProdutos() {
    if (Array.isArray(this._produtosMem)) return this._produtosMem;

    const saved = localStorage.getItem('adega_produtos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._produtosMem = parsed;
          return parsed;
        }
      } catch(e) {}
    }
    // Tenta recuperar do backup de segurança local se existir
    const backup = localStorage.getItem('adega_produtos_backup_seguranca');
    if (backup) {
      try {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          this.saveProdutos(parsedBackup);
          return parsedBackup;
        }
      } catch(e) {}
    }
    this._produtosMem = [];
    return [];
  },

  // Produtos Excluídos (Tombstones para Multi-Terminal)
  getProdutosExcluidosIds() {
    const saved = localStorage.getItem('adega_produtos_excluidos_ids');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch(e) {}
    }
    return [];
  },

  adicionarProdutoExcluidoId(id) {
    if (!id) return;
    const excluidos = this.getProdutosExcluidosIds();
    const idStr = String(id);
    if (!excluidos.includes(idStr)) {
      excluidos.push(idStr);
      localStorage.setItem('adega_produtos_excluidos_ids', JSON.stringify(excluidos));
    }
  },

  saveProdutos(produtos) {
    if (Array.isArray(produtos) && produtos.length > 0) {
      const backupAtual = this.getProdutos();
      if (produtos.length >= backupAtual.length) {
        localStorage.setItem('adega_produtos_backup_seguranca', JSON.stringify(produtos));
      }
    }
    const excluidos = this.getProdutosExcluidosIds();
    const listaLimpa = Array.isArray(produtos) ? produtos.filter(p => p && p.id && !excluidos.includes(String(p.id))) : [];
    this._produtosMem = listaLimpa;
    localStorage.setItem('adega_produtos', JSON.stringify(listaLimpa));
  },

  // Vendas
  getVendas() {
    const saved = localStorage.getItem('adega_vendas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('⚠️ Erro ao ler vendas do localStorage:', e);
      }
    }
    return [];
  },

  getProximoNumeroVenda() {
    let ultimo = parseInt(localStorage.getItem('flowpdv_ultimo_numero_venda'), 10);
    if (isNaN(ultimo) || ultimo <= 0) {
      const vendas = this.getVendas();
      const maxExistente = vendas.reduce((max, v) => {
        const num = parseInt(v.numeroVenda, 10);
        return (!isNaN(num) && num > max) ? num : max;
      }, 0);
      ultimo = Math.max(vendas.length, maxExistente);
    }
    const proximo = ultimo + 1;
    localStorage.setItem('flowpdv_ultimo_numero_venda', String(proximo));
    return proximo;
  },

  saveVenda(venda) {
    const vendas = this.getVendas();
    vendas.unshift(venda);
    localStorage.setItem('adega_vendas', JSON.stringify(vendas));

    // Vincular venda ao turno atual (para relatórios precisos)
    const turno = this.getTurnoAtual();
    if (turno && venda.id) {
      turno.vendasIds = turno.vendasIds || [];
      turno.vendasIds.push(venda.id);
      this.salvarTurno(turno);
    }

    // Abater estoque automaticamente
    const produtos = this.getProdutos();
    (venda.itens || []).forEach(item => {
      const prod = produtos.find(p => p.id === item.id || p.codigoBarras === item.id);
      if (prod && prod.controlarEstoque !== false) {
        const fator = item.isFardo ? (prod.fatorConversao || 1) : 1;
        const delta = -((parseFloat(item.quantidade) || 0) * fator);
        prod.estoque = Math.max(0, (parseFloat(prod.estoque) || 0) + delta);
        this.registrarMovimentoEstoque({
          produtoId: prod.id,
          delta,
          origem: 'venda',
          refId: venda.id
        });
      }
    });
    this.saveProdutos(produtos);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('venda');
    }
  },

  atualizarVenda(venda) {
    if (!venda || !venda.id) return false;
    const vendas = this.getVendas();
    const index = vendas.findIndex(item => item.id === venda.id);
    if (index < 0) return false;
    vendas[index] = { ...vendas[index], ...venda };
    localStorage.setItem('adega_vendas', JSON.stringify(vendas));
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('venda_atualizada');
    }
    return true;
  },

  // Turnos Excluídos (Tombstones para Sync Multi-Terminal)
  getTurnosExcluidosIds() {
    const saved = localStorage.getItem('adega_turnos_excluidos_ids');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch(e) {}
    }
    return [];
  },

  adicionarTurnoExcluidoId(id) {
    if (!id) return;
    const excluidos = this.getTurnosExcluidosIds();
    const idStr = String(id);
    if (!excluidos.includes(idStr)) {
      excluidos.push(idStr);
      localStorage.setItem('adega_turnos_excluidos_ids', JSON.stringify(excluidos));
    }
  },

  excluirTurnoHistorico(turnoId) {
    if (!turnoId) return false;
    const idStr = String(turnoId);
    this.adicionarTurnoExcluidoId(idStr);

    let turnos = [];
    const saved = localStorage.getItem('adega_turnos_historico');
    if (saved) {
      try {
        turnos = JSON.parse(saved) || [];
      } catch(e) {}
    }
    const novosTurnos = turnos.filter(t => t && String(t.id) !== idStr);
    localStorage.setItem('adega_turnos_historico', JSON.stringify(novosTurnos));
    return true;
  },

  // Turno de Caixa
  getTurnoAtual() {
    const saved = localStorage.getItem('adega_turno_atual');
    if (!saved) return null;
    try {
      const turno = JSON.parse(saved);
      return (turno && turno.status === 'aberto') ? turno : null;
    } catch (e) {
      console.warn('⚠️ Erro ao ler turno atual do localStorage:', e);
      return null;
    }
  },

  salvarTurno(turno) {
    localStorage.setItem('adega_turno_atual', JSON.stringify(turno));
    if (window.CloudSyncModule) {
      if (typeof window.CloudSyncModule.atualizarTurnoAtivoDoTerminal === 'function') {
        const chave = window.CloudSyncModule.getChaveLicenca ? window.CloudSyncModule.getChaveLicenca() : '';
        window.CloudSyncModule.atualizarTurnoAtivoDoTerminal(chave, this.getDeviceId(), turno).catch(() => {});
      }
      if (typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('turno');
      }
    }
    if (window.LicencaModule && typeof window.LicencaModule.forcarHeartbeatTerminal === 'function') {
      window.LicencaModule.forcarHeartbeatTerminal().catch(() => {});
    }
  },

  getHistoricoTurnos() {
    const saved = localStorage.getItem('adega_turnos_historico');
    const excluidos = this.getTurnosExcluidosIds();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(t => t && t.id && !excluidos.includes(String(t.id)));
        }
      } catch(e) {}
    }
    return [];
  },

  salvarHistoricoTurnos(turnos) {
    const excluidos = this.getTurnosExcluidosIds();
    const listaLimpa = Array.isArray(turnos) ? turnos.filter(t => t && t.id && !excluidos.includes(String(t.id))) : [];
    localStorage.setItem('adega_turnos_historico', JSON.stringify(listaLimpa));
  },

  arquivarTurnoFechado(turnoFechado) {
    const historico = this.getHistoricoTurnos();
    historico.unshift(turnoFechado);
    this.salvarHistoricoTurnos(historico);
    localStorage.removeItem('adega_turno_atual');
    if (window.CloudSyncModule) {
      const fechado = turnoFechado && typeof turnoFechado === 'object'
        ? { ...turnoFechado, terminalId: turnoFechado.terminalId || this.getDeviceId(), status: 'fechado' }
        : null;
      if (typeof window.CloudSyncModule.atualizarTurnoAtivoDoTerminal === 'function') {
        const chave = window.CloudSyncModule.getChaveLicenca ? window.CloudSyncModule.getChaveLicenca() : '';
        window.CloudSyncModule.atualizarTurnoAtivoDoTerminal(chave, this.getDeviceId(), fechado).catch(() => {});
      }
      if (typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('turno');
      }
    }
    if (window.LicencaModule && typeof window.LicencaModule.forcarHeartbeatTerminal === 'function') {
      window.LicencaModule.forcarHeartbeatTerminal().catch(() => {});
    }
  },

  // Clientes & Fiado
  getClientes() {
    const saved = localStorage.getItem('adega_clientes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('⚠️ Erro ao ler clientes do localStorage:', e);
      }
    }
    const defaults = [];
    this.saveClientes(defaults);
    return defaults;
  },

  saveClientes(clientes) {
    localStorage.setItem('adega_clientes', JSON.stringify(clientes));
  },

  // Contas a Pagar (Módulo Financeiro)
  getContasPagar() {
    const saved = localStorage.getItem('flowpdv_contas_pagar');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(c => {
            if (c.categoria === 'Estoque / Fornecedores') {
              return { ...c, categoria: 'Fornecedores' };
            }
            return c;
          });
        }
      } catch(e) {}
    }
    return [];
  },

  saveContasPagar(contas) {
    let anteriores = [];
    try {
      const saved = localStorage.getItem('flowpdv_contas_pagar');
      anteriores = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(anteriores)) anteriores = [];
    } catch (e) {
      anteriores = [];
    }
    const carimbados = carimbarAlterados(Array.isArray(contas) ? contas : [], anteriores);
    localStorage.setItem('flowpdv_contas_pagar', JSON.stringify(carimbados));
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
    const saved = localStorage.getItem('adega_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.habilitarModuloFiado === undefined) {
          parsed.habilitarModuloFiado = true;
        }
        return parsed;
      } catch(e) {}
    }
    const defaults = {
      nomeLoja: '',
      cnpj: '',
      endereco: '',
      telefone: '',
      chavePix: '',
      impressoraPadrao: '58mm',
      autoImprimirCupom: true,
      habilitarModuloFiado: true
    };
    this.saveConfig(defaults);
    return defaults;
  },

  saveConfig(config, opts = {}) {
    const atual = { ...(config || {}) };
    if (atual.habilitarModuloFiado === undefined) {
      atual.habilitarModuloFiado = true;
    }
    if (opts.carimbar !== false) {
      atual.atualizadoEm = new Date().toISOString();
    }
    localStorage.setItem('adega_config', JSON.stringify(atual));
  },

  // Balança de Checkout (USB / Serial RS-232)
  getBalancaConfig() {
    const saved = localStorage.getItem('flowpdv_balanca_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {}
    }
    return {
      habilitado: true,
      modelo: 'toledo_prix3',
      porta: 'COM1',
      baudRate: 9600,
      modoSimulacao: true
    };
  },

  saveBalancaConfig(config) {
    localStorage.setItem('flowpdv_balanca_config', JSON.stringify(config));
  },

  // TEF / Máquina de Cartão Integrada
  getTefConfig() {
    const saved = localStorage.getItem('flowpdv_tef_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {}
    }
    return {
      habilitado: false,
      provedor: 'simulador',
      tempoLimiteSegundos: 45,
      imprimirComprovanteTef: true,
      confirmacaoAutomatica: true
    };
  },

  saveTefConfig(config) {
    localStorage.setItem('flowpdv_tef_config', JSON.stringify(config));
  },

  // Módulo Fiscal (NFC-e Focus NFe / SAT)
  getFiscalConfig() {
    const saved = localStorage.getItem('flowpdv_fiscal_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch(e) {}
    }
    return {
      habilitado: false,
      provedor: 'focus_nfe',
      ambiente: 'homologacao',
      tokenFocus: '',
      cnpjEmitente: '',
      inscricaoEstadual: '',
      cscId: '000001',
      cscToken: '',
      serieNfce: 1,
      ultimoNumeroNfce: 1,
      regimeTributario: '1',
      cfopPadrao: '5102',
      ncmPadrao: '22030000',
      csosnPadrao: '102',
      naturezaOperacao: 'VENDA AO CONSUMIDOR',
      autoEmitirAoFinalizar: false
    };
  },

  saveFiscalConfig(fiscalConfig) {
    localStorage.setItem('flowpdv_fiscal_config', JSON.stringify(fiscalConfig));
  },

  // Licença SaaS
  getLicenca() {
    const ler = (chave) => {
      const saved = localStorage.getItem(chave);
      if (!saved) return null;
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.chaveLicenca && String(parsed.chaveLicenca).trim().length > 0) {
          return parsed;
        }
      } catch (e) {}
      return null;
    };

    let parsed = ler('adega_licenca') || ler('adega_licenca_backup');

    // Fallback disco (Electron): sobrevive a LevelDB corrompido / wipe de Local Storage
    if (!parsed && typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.carregarLicencaArquivoSync === 'function') {
      try {
        const fromFile = window.electronAPI.carregarLicencaArquivoSync();
        if (fromFile && String(fromFile.chaveLicenca || '').trim()) {
          parsed = fromFile;
          try { localStorage.setItem('adega_licenca', JSON.stringify(parsed)); } catch (e) {}
          try { localStorage.setItem('adega_licenca_backup', JSON.stringify(parsed)); } catch (e) {}
        }
      } catch (e) {}
    }

    if (parsed) {
      let updated = false;
      if (parsed.chavePixSuporte === '19999997777' || !parsed.chavePixSuporte) {
        parsed.chavePixSuporte = '19989632127';
        updated = true;
      }
      if (parsed.whatsappSuporte === '19999997777' || parsed.whatsappSuporte === '(19) 99999-7777') {
        parsed.whatsappSuporte = '(19) 98963-2127';
        updated = true;
      }
      if (updated) {
        try { this.saveLicenca(parsed); } catch (e) {}
      }
      if (!ler('adega_licenca') && ler('adega_licenca_backup')) {
        try { localStorage.setItem('adega_licenca', JSON.stringify(parsed)); } catch (e) {}
      }
      return parsed;
    }

    const defaults = {
      clienteId: '',
      chaveLicenca: '',
      nomeCliente: '',
      razaoSocial: '',
      status: 'pendente_ativacao',
      categorias: ['Geral', 'Alimentos', 'Bebidas', 'Vestuário', 'Eletrônicos', 'Acessórios', 'Higiene & Limpeza'],
      dataExpiracao: '',
      diasTolerancia: 2,
      valorMensal: 89.90,
      chavePixSuporte: '19989632127',
      whatsappSuporte: '(19) 98963-2127'
    };
    return defaults;
  },

  saveLicenca(lic) {
    if (!lic || typeof lic !== 'object') return;
    try {
      const novaChave = String(lic.chaveLicenca || '').trim();
      if (!novaChave) {
        const atualRaw = localStorage.getItem('adega_licenca') || localStorage.getItem('adega_licenca_backup');
        if (atualRaw) {
          try {
            const atual = JSON.parse(atualRaw);
            if (atual && String(atual.chaveLicenca || '').trim()) {
              console.warn('[Storage] saveLicenca bloqueado: tentativa de gravar licença sem chave.');
              return;
            }
          } catch (e) {}
        }
      }

      const json = JSON.stringify(lic);
      localStorage.setItem('adega_licenca', json);
      try { localStorage.setItem('adega_licenca_backup', json); } catch (e) {}

      if (novaChave && typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.salvarLicencaArquivo === 'function') {
        window.electronAPI.salvarLicencaArquivo(lic).catch(() => {});
      }
    } catch (e) {
      console.error('[Storage] Falha ao salvar licença (quota/disco?):', e);
      try {
        if (lic && lic.chaveLicenca) {
          localStorage.setItem('adega_licenca_backup', JSON.stringify(lic));
          if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.salvarLicencaArquivo === 'function') {
            window.electronAPI.salvarLicencaArquivo(lic).catch(() => {});
          }
        }
      } catch (e2) {}
    }
  },

  // Gestão de Usuários & Operadores Multi-Acesso
  getUsuarios() {
    const saved = localStorage.getItem('flowpdv_usuarios');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch(e) {}
    }

    // O primeiro acesso usa exclusivamente o PIN definido no painel admin.
    // Sem PIN da licença não criamos ninguém: nenhum operador nasce com PIN fixo.
    const pinGerente = String(
      localStorage.getItem('flowpdv_pin_gerente') || this.getLicenca()?.pinGerente || ''
    ).trim();

    if (!pinGerente) return [];

    const defaults = [
      {
        id: 'USR-ADMIN',
        nome: 'Dono / Gerente',
        login: 'admin',
        pin: pinGerente,
        cargo: 'gerente',
        ativo: true,
        criadoEm: new Date().toISOString()
      }
    ];

    this.saveUsuarios(defaults);
    return defaults;
  },

  saveUsuarios(usuarios) {
    const agora = new Date().toISOString();
    const lista = (Array.isArray(usuarios) ? usuarios : []).map(u => {
      if (!u || u.atualizadoEm) return u;
      return { ...u, atualizadoEm: u.criadoEm || agora };
    });
    localStorage.setItem('flowpdv_usuarios', JSON.stringify(lista));
  },

  getMovimentosEstoque() {
    const saved = localStorage.getItem('flowpdv_estoque_movimentos');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveMovimentosEstoque(movimentos) {
    const lista = Array.isArray(movimentos) ? movimentos.slice(-8000) : [];
    try {
      localStorage.setItem('flowpdv_estoque_movimentos', JSON.stringify(lista));
    } catch (e) {
      try {
        localStorage.setItem('flowpdv_estoque_movimentos', JSON.stringify(lista.slice(-800)));
      } catch (err) {
        console.warn('[Storage] Sem espaço para movimentos de estoque.', err);
      }
    }
  },

  registrarMovimentoEstoque({ produtoId, delta, origem, refId }) {
    const qtd = parseFloat(delta);
    if (!produtoId || !qtd) return null;
    const mov = {
      id: 'MOV-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
      produtoId: String(produtoId),
      delta: qtd,
      origem: origem || 'ajuste',
      refId: refId || '',
      terminalId: this.getDeviceId(),
      at: new Date().toISOString()
    };
    const lista = this.getMovimentosEstoque();
    lista.push(mov);
    this.saveMovimentosEstoque(lista);
    return mov;
  },

  getCheckpointEstoque() {
    try {
      const raw = localStorage.getItem('flowpdv_checkpoint_estoque');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  saveCheckpointEstoque(checkpoint) {
    if (!checkpoint || typeof checkpoint !== 'object') return;
    localStorage.setItem('flowpdv_checkpoint_estoque', JSON.stringify(checkpoint));
  },

  getInventarios() {
    try {
      const raw = localStorage.getItem('flowpdv_inventarios');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  saveInventarios(lista) {
    localStorage.setItem('flowpdv_inventarios', JSON.stringify(Array.isArray(lista) ? lista : []));
  },

  // Mesas e Comandas
  getComandas() {
    const saved = localStorage.getItem('flowpdv_comandas_mesas');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  },

  saveComandas(comandas) {
    if (!Array.isArray(comandas)) return;
    // Carimbar só o que mudou: é esse horário que decide qual terminal vence
    // quando duas máquinas mexem em mesas diferentes ao mesmo tempo.
    const carimbadas = carimbarAlterados(comandas, this.getComandas());
    localStorage.setItem('flowpdv_comandas_mesas', JSON.stringify(carimbadas));
    return carimbadas;
  },

  // Produtos Padrão
  getDefaultProdutos() {
    return [];
  },

  // Exportação e Importação de Backup Completo em JSON (Offline)
  exportarBackupCompleto() {
    const backupData = {
      tipo: 'flowpdv_backup',
      versao: '1.3.5',
      dataExportacao: new Date().toISOString(),
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
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dataFmt = new Date().toISOString().split('T')[0];
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
    'adega_produtos',
    'adega_produtos_backup_seguranca',
    'adega_produtos_excluidos_ids',
    'flowpdv_estoque_movimentos',
    'adega_vendas',
    'flowpdv_ultimo_numero_venda',
    'adega_clientes',
    'flowpdv_contas_pagar',
    'adega_turno_atual',
    'adega_turnos_historico',
    'adega_turnos_excluidos_ids',
    'flowpdv_comandas_mesas',
    'flowpdv_usuarios',
    'flowpdv_categorias_loja',
    'adega_categorias_excluidas',
    'flowpdv_pin_gerente',
    'flowpdv_modulos_licenca',
    'flowpdv_ramo_licenca',
    'adega_config',
    'flowpdv_fiscal_config',
    'flowpdv_tef_config',
    'flowpdv_balanca_config',
    'flowpdv_ultimo_backup_data',
    'flowpdv_ultimo_backup_timestamp',
    'flowpdv_ultimo_backup_info',
    'flowpdv_ultimo_sync_cloud',
    'flowpdv_partes_manifesto',
    'flowpdv_partes_hash',
    'flowpdv_movimentos_enviados',
    'flowpdv_ultimo_mov_sync',
    'flowpdv_checkpoint_estoque',
    'flowpdv_checkpoint_enviado_em',
    'flowpdv_inventarios',
    'flowpdv_inventarios_enviados',
    'adega_licenca_backup',
    'flowpdv_terminal_heartbeat_ms'
  ],

  PREFIXOS_DA_LOJA: ['flowpdv_logs_auditoria_', 'flowpdv_logs_nuvem_pendentes_', 'flowpdv_logs_migrados_', 'flowpdv_logs_exclusao_', 'flowpdv_cache_', 'flowpdv_master_'],

  // Limpeza de Isolamento Multi-Tenant ao Trocar de Empresa/Licença
  limparDadosLocaisParaNovaEmpresa(novaLic) {
    this.CHAVES_DA_LOJA.forEach(chave => localStorage.removeItem(chave));

    Object.keys(localStorage)
      .filter(chave => this.PREFIXOS_DA_LOJA.some(prefixo => chave.startsWith(prefixo)))
      .forEach(chave => localStorage.removeItem(chave));

    sessionStorage.removeItem('flowpdv_usuario_logado');
    if (window.AuthModule) {
      window.AuthModule.usuarioAtual = null;
    }

    if (novaLic) {
      this.saveLicenca(novaLic);
      if (Array.isArray(novaLic.categorias) && novaLic.categorias.length > 0) {
        this.salvarCategorias(novaLic.categorias);
      }
      if (novaLic.pinGerente) {
        localStorage.setItem('flowpdv_pin_gerente', String(novaLic.pinGerente).trim());
      }
    }
  },

  importarBackupCompleto(jsonObj) {
    if (!jsonObj || (jsonObj.tipo !== 'flowpdv_backup' && !jsonObj.produtos)) {
      throw new Error('Arquivo de backup inválido ou incompatível.');
    }

    if (Array.isArray(jsonObj.produtos)) this.saveProdutos(jsonObj.produtos);
    if (Array.isArray(jsonObj.vendas)) localStorage.setItem('adega_vendas', JSON.stringify(jsonObj.vendas));
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
