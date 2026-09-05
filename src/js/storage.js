/**
 * storage.js - Armazenamento Local (Offline-First) para PDV Adega & Motor SaaS
 */

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
    return true;
  },

  formatarMoeda(valor) {
    const num = parseFloat(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Produtos & Estoque
  getProdutos() {
    const saved = localStorage.getItem('adega_produtos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    localStorage.setItem('adega_produtos', JSON.stringify(listaLimpa));
  },

  // Vendas
  getVendas() {
    const saved = localStorage.getItem('adega_vendas');
    return saved ? JSON.parse(saved) : [];
  },

  saveVenda(venda) {
    const vendas = this.getVendas();
    vendas.unshift(venda);
    localStorage.setItem('adega_vendas', JSON.stringify(vendas));

    // Abater estoque automaticamente
    const produtos = this.getProdutos();
    venda.itens.forEach(item => {
      const prod = produtos.find(p => p.id === item.id || p.codigoBarras === item.id);
      if (prod && prod.controlarEstoque !== false) {
        const fator = item.isFardo ? (prod.fatorConversao || 1) : 1;
        prod.estoque = Math.max(0, (parseInt(prod.estoque, 10) || 0) - (item.quantidade * fator));
        prod.atualizadoEm = new Date().toISOString();
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
    const turno = JSON.parse(saved);
    return turno.status === 'aberto' ? turno : null;
  },

  salvarTurno(turno) {
    localStorage.setItem('adega_turno_atual', JSON.stringify(turno));
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('turno');
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
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('turno');
    }
  },

  // Clientes & Fiado
  getClientes() {
    const saved = localStorage.getItem('adega_clientes');
    if (saved) return JSON.parse(saved);
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
    localStorage.setItem('flowpdv_contas_pagar', JSON.stringify(contas));
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

  saveConfig(config) {
    if (config && config.habilitarModuloFiado === undefined) {
      config.habilitarModuloFiado = true;
    }
    localStorage.setItem('adega_config', JSON.stringify(config));
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
      habilitado: true,
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
    const saved = localStorage.getItem('adega_licenca');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.chaveLicenca && parsed.chaveLicenca.trim().length > 0) {
          return parsed;
        }
      } catch(e) {}
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
      chavePixSuporte: '19999997777',
      whatsappSuporte: '(19) 98963-2127'
    };
    return defaults;
  },

  saveLicenca(lic) {
    localStorage.setItem('adega_licenca', JSON.stringify(lic));
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

    const pinGerente = localStorage.getItem('flowpdv_pin_gerente') || this.getLicenca()?.pinGerente || '1234';
    const defaults = [
      {
        id: 'USR-ADMIN',
        nome: 'Dono / Gerente',
        login: 'admin',
        pin: String(pinGerente).trim(),
        cargo: 'gerente',
        ativo: true,
        criadoEm: new Date().toISOString()
      },
      {
        id: 'USR-CAIXA1',
        nome: 'Operador Caixa',
        login: 'caixa',
        pin: '1234',
        cargo: 'operador',
        ativo: true,
        criadoEm: new Date().toISOString()
      }
    ];

    this.saveUsuarios(defaults);
    return defaults;
  },

  saveUsuarios(usuarios) {
    localStorage.setItem('flowpdv_usuarios', JSON.stringify(usuarios));
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
    localStorage.setItem('flowpdv_comandas_mesas', JSON.stringify(comandas));
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

  // Limpeza de Isolamento Multi-Tenant ao Trocar de Empresa/Licença
  limparDadosLocaisParaNovaEmpresa(novaLic) {
    // 1. Limpar produtos, estoque e backups locais da loja antiga
    localStorage.removeItem('adega_produtos');
    localStorage.removeItem('adega_produtos_backup_seguranca');
    localStorage.removeItem('adega_produtos_excluidos_ids');

    // 2. Limpar histórico de vendas, fiados e despesas da loja antiga
    localStorage.removeItem('adega_vendas');
    localStorage.removeItem('adega_clientes');
    localStorage.removeItem('flowpdv_contas_pagar');

    // 3. Limpar turnos e caixas da loja antiga
    localStorage.removeItem('adega_turno_atual');
    localStorage.removeItem('adega_turnos_historico');
    localStorage.removeItem('adega_turnos_excluidos_ids');

    // 4. Limpar operadores, PIN e sessão da loja antiga
    localStorage.removeItem('flowpdv_usuarios');
    localStorage.removeItem('flowpdv_categorias_loja');
    localStorage.removeItem('flowpdv_pin_gerente');
    sessionStorage.removeItem('flowpdv_usuario_logado');
    if (window.AuthModule) {
      window.AuthModule.usuarioAtual = null;
    }

    // 5. Limpar dados do card de backup da loja antiga
    localStorage.removeItem('flowpdv_ultimo_backup_data');
    localStorage.removeItem('flowpdv_ultimo_backup_timestamp');
    localStorage.removeItem('flowpdv_ultimo_backup_info');

    // 6. Limpar configurações locais para assumir as da nova licença
    localStorage.removeItem('flowpdv_config');

    // 7. Salvar nova licença e novas categorias da empresa
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
