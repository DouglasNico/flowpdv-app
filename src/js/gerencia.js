/**
 * gerencia.js - Central do Dono / Gerência (Gestão Financeira, Indicadores Curva ABC, Auditoria e Categorias)
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { AuditModule } from './audit.js';
import { ThermalPrintModule } from './thermal-print.js';

export const GerenciaModule = {
  subAbaAtiva: 'inicio',
  _inicioItensHoje: [],
  contaEditandoId: null,
  contaBaixandoId: null,
  ajusteProdutoSelecionadoId: null,
  filtroContasStatus: 'todos',
  logsAuditoriaCache: [],
  auditoriaExibidos: 100,
  auditoriaCarregandoMais: false,

  init() {
    this.bindSubNavegacao();
    this.bindScrollAuditoria();
    this.bindFiltrosAuditoriaOverflow();
    this.renderSubAbaAtual();
  },

  bindSubNavegacao() {
    document.querySelectorAll('.gerencia-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.subtab;
        this.trocarSubAba(target);
      });
    });
  },

  trocarSubAba(nomeSubAba) {
    if (this.subAbaAtiva === 'indicadores' && nomeSubAba !== 'indicadores') {
      this.ordenacaoAbc = { coluna: 'faturamento', direcao: 'desc' };
    }

    this.subAbaAtiva = nomeSubAba;

    // Atualizar botões de sub-navegação
    document.querySelectorAll('.gerencia-subnav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === nomeSubAba);
    });

    // Atualizar painéis: forçar display flex no painel ativo e none em todos os outros!
    document.querySelectorAll('.gerencia-subpanel').forEach(panel => {
      const isTarget = panel.id === `gerencia-subpanel-${nomeSubAba}`;
      panel.classList.toggle('active', isTarget);
      panel.style.display = isTarget ? 'flex' : 'none';
    });

    this.renderSubAbaAtual();
  },

  resetarFiltrosGerencia() {
    this.ordenacaoAbc = { coluna: 'faturamento', direcao: 'desc' };
    this.filtroContasStatus = 'todos';
    document.querySelectorAll('.gerencia-contas-filtro-btn').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.status || '') === 'todos');
    });
    this.filtroAuditoria = 'todos';
    this.filtroOperadorAuditoria = 'todos';
    this.filtroDataAuditoria = '';
    this.filtroDataHistorico = '';
    const opSel = document.getElementById('gerencia-auditoria-operador-select');
    if (opSel) opSel.value = 'todos';
    const dataLog = document.getElementById('gerencia-auditoria-filtro-data');
    if (dataLog) dataLog.value = '';
    const dataCx = document.getElementById('gerencia-historico-filtro-data');
    if (dataCx) dataCx.value = '';
    if (typeof this.atualizarLabelFiltroData === 'function') {
      this.atualizarLabelFiltroData('gerencia-auditoria-filtro-data', 'gerencia-auditoria-filtro-data-label', 'Filtrar Log');
      this.atualizarLabelFiltroData('gerencia-historico-filtro-data', 'gerencia-historico-filtro-data-label', 'Filtrar Caixa');
    }
    document.querySelectorAll('.gerencia-audit-filtro-btn').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.tipo || '') === 'todos');
    });
  },

  renderSubAbaAtual() {
    if (this.subAbaAtiva === 'inicio') {
      this.renderDashboardInicio();
    } else if (this.subAbaAtiva === 'indicadores') {
      this.renderIndicadoresCurvaABC();
    } else if (this.subAbaAtiva === 'financeiro') {
      this.renderContasPagar();
    } else if (this.subAbaAtiva === 'usuarios') {
      this.renderGestaoUsuarios();
    } else if (this.subAbaAtiva === 'categorias') {
      this.renderGestaoCategorias();
    } else if (this.subAbaAtiva === 'historico' || this.subAbaAtiva === 'historico-caixas') {
      this.renderHistoricoCaixas();
    } else if (this.subAbaAtiva === 'auditoria') {
      this.renderAuditoriaAjustes();
      this.layoutFiltrosAuditoria();
    }
  },

  _escHtml(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _dataLocalISO(valor) {
    const d = valor instanceof Date ? valor : new Date(valor);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _formatarDataBR(dataStr) {
    if (!dataStr) return '';
    const [ano, mes, dia] = String(dataStr).split('-');
    if (!dia) return dataStr;
    return `${dia}/${mes}/${ano}`;
  },

  coletarDadosInicio() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = this._dataLocalISO(hoje);

    const turno = StorageService.getTurnoAtual();
    let caixaAberto = false;
    let caixaFaturado = 0;
    let caixaVendas = 0;
    let caixaOperador = '';
    if (turno) {
      caixaAberto = true;
      caixaOperador = turno.operador || '';
      if (window.CaixaModule && typeof window.CaixaModule.calcularResumoFinanceiro === 'function') {
        const r = window.CaixaModule.calcularResumoFinanceiro(turno);
        caixaFaturado = r.totalVendas || 0;
        caixaVendas = r.vendasCount || 0;
      }
    }

    const vendas = StorageService.getVendas() || [];
    const vendasHoje = vendas.filter(v => v && v.data && this._dataLocalISO(v.data) === hojeStr);
    let faturamentoDia = 0;
    vendasHoje.forEach(v => { faturamentoDia += parseFloat(v.total) || 0; });
    const ticketDia = vendasHoje.length > 0 ? (faturamentoDia / vendasHoje.length) : 0;

    const produtos = StorageService.getProdutos() || [];
    const estoqueBaixo = produtos.filter(p => {
      if (!p || p.controlarEstoque === false) return false;
      return (parseFloat(p.estoque) || 0) <= (parseFloat(p.estoqueMinimo) || 5);
    });
    const estoqueZerado = estoqueBaixo.filter(p => (parseFloat(p.estoque) || 0) <= 0);

    const prodVencidos = [];
    const prodVence15d = [];
    if (StorageService.isModuloAtivo('validadeLotes')) {
      produtos.forEach(p => {
        if (!p || !p.dataValidade) return;
        const dVal = new Date(p.dataValidade + 'T00:00:00');
        const diffDias = Math.ceil((dVal - hoje) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) prodVencidos.push({ ...p, diffDias });
        else if (diffDias <= 15) prodVence15d.push({ ...p, diffDias });
      });
    }

    const contas = StorageService.getContasPagar() || [];
    const contasVencidas = [];
    const contasPendentes = [];
    let valorVencido = 0;
    contas.forEach(c => {
      if (!c || c.status === 'pago') return;
      contasPendentes.push(c);
      if (c.vencimento && c.vencimento < hojeStr) {
        contasVencidas.push(c);
        valorVencido += parseFloat(c.valor) || 0;
      }
    });

    const lic = StorageService.getLicenca() || {};
    const cfg = StorageService.getConfig() || {};
    const nomeLoja = lic.razaoSocial || cfg.nomeEmpresa || cfg.nomeLoja || 'Minha Loja';
    const statusEl = document.getElementById('header-status-conexao');
    const statusTxt = (statusEl && statusEl.textContent) ? statusEl.textContent.trim() : '';
    const lojaOffline = /offline/i.test(statusTxt);
    const lojaSync = /sincroniz/i.test(statusTxt);

    const totalAtencao = contasVencidas.length + estoqueBaixo.length + prodVencidos.length + prodVence15d.length;

    return {
      caixaAberto,
      caixaFaturado,
      caixaVendas,
      caixaOperador,
      faturamentoDia,
      ticketDia,
      vendasHojeCount: vendasHoje.length,
      estoqueBaixo,
      estoqueZerado,
      prodVencidos,
      prodVence15d,
      contasVencidas,
      contasPendentes,
      valorVencido,
      nomeLoja,
      lojaOffline,
      lojaSync,
      totalAtencao
    };
  },

  montarItensInicioHoje(dados) {
    const itens = [];
    const fmt = (v) => StorageService.formatarMoeda(v);

    [...dados.contasVencidas]
      .sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')))
      .forEach(c => {
        itens.push({
          tipo: 'conta',
          ico: '💸',
          titulo: c.descricao || c.fornecedor || 'Conta a pagar',
          detalhe: `Venceu em ${this._formatarDataBR(c.vencimento)} · R$ ${fmt(c.valor)}`
        });
      });

    dados.prodVencidos.forEach(p => {
      itens.push({
        tipo: 'validade',
        filtro: 'vencidos',
        ico: '🚨',
        titulo: p.nome || 'Produto',
        detalhe: `Venceu em ${this._formatarDataBR(p.dataValidade)} · saldo ${parseFloat(p.estoque) || 0}`
      });
    });

    dados.prodVence15d.forEach(p => {
      itens.push({
        tipo: 'validade',
        filtro: 'vence15d',
        ico: '⏳',
        titulo: p.nome || 'Produto',
        detalhe: `Vence em ${this._formatarDataBR(p.dataValidade)} · ${p.diffDias} dia(s)`
      });
    });

    dados.estoqueZerado.forEach(p => {
      itens.push({
        tipo: 'estoque',
        ico: '📦',
        titulo: p.nome || 'Produto',
        detalhe: 'Estoque zerado'
      });
    });

    dados.estoqueBaixo.forEach(p => {
      if ((parseFloat(p.estoque) || 0) <= 0) return;
      itens.push({
        tipo: 'estoque',
        ico: '⚠️',
        titulo: p.nome || 'Produto',
        detalhe: `Saldo ${parseFloat(p.estoque) || 0} · mínimo ${parseFloat(p.estoqueMinimo) || 5}`
      });
    });

    return itens.slice(0, 5);
  },

  renderDashboardInicio() {
    const dados = this.coletarDadosInicio();
    const cards = document.getElementById('gerencia-inicio-cards');
    const lista = document.getElementById('gerencia-inicio-hoje-lista');
    if (!cards || !lista) return;

    const fmt = (v) => StorageService.formatarMoeda(v);
    const caixaValor = dados.caixaAberto ? `R$ ${fmt(dados.caixaFaturado)}` : 'Fechado';
    const caixaSub = dados.caixaAberto
      ? `${dados.caixaVendas} venda(s)${dados.caixaOperador ? ' · ' + dados.caixaOperador : ''}`
      : 'Nenhum turno aberto neste terminal';

    let atencaoValor = 'Tudo em dia';
    let atencaoSub = 'Sem contas vencidas, validade crítica ou estoque baixo';
    let atencaoClasse = 'ok';
    if (dados.totalAtencao > 0) {
      atencaoValor = String(dados.totalAtencao);
      const partes = [];
      if (dados.contasVencidas.length) partes.push(`${dados.contasVencidas.length} conta(s)`);
      if (dados.estoqueBaixo.length) partes.push(`${dados.estoqueBaixo.length} estoque baixo`);
      if (dados.prodVencidos.length + dados.prodVence15d.length) {
        partes.push(`${dados.prodVencidos.length + dados.prodVence15d.length} validade`);
      }
      atencaoSub = partes.join(' · ');
      atencaoClasse = 'alerta';
    }

    const lojaValor = dados.lojaOffline ? 'Offline' : (dados.lojaSync ? 'Sync' : 'Online');
    const lojaSub = this._escHtml(dados.nomeLoja);

    let pagarValor = 'Em dia';
    let pagarSub = 'Nenhuma conta atrasada';
    let pagarClasse = 'ok';
    let pagarCor = '#15803d';
    if (dados.valorVencido > 0) {
      pagarValor = `R$ ${fmt(dados.valorVencido)}`;
      pagarSub = `${dados.contasVencidas.length} vencida(s)`;
      pagarClasse = 'alerta';
      pagarCor = '#dc2626';
    } else if ((dados.contasPendentes || []).length) {
      pagarValor = String(dados.contasPendentes.length);
      pagarSub = 'conta(s) em aberto';
      pagarClasse = '';
      pagarCor = '#d97706';
    }

    cards.innerHTML = `
      <button type="button" class="gerencia-inicio-card ${dados.caixaAberto ? 'ok' : ''}" onclick="GerenciaModule.abrirDestinoInicio('caixa')">
        <span class="gerencia-inicio-kicker">Caixa agora</span>
        <span class="gerencia-inicio-valor" style="color: ${dados.caixaAberto ? '#059669' : '#dc2626'};">${caixaValor}</span>
        <span class="gerencia-inicio-sub">${this._escHtml(caixaSub)}</span>
      </button>
      <button type="button" class="gerencia-inicio-card" onclick="GerenciaModule.abrirDestinoInicio('vendas')">
        <span class="gerencia-inicio-kicker">Vendas do dia</span>
        <span class="gerencia-inicio-valor" style="color: #2563eb;">R$ ${fmt(dados.faturamentoDia)}</span>
        <span class="gerencia-inicio-sub">${dados.vendasHojeCount} venda(s) · ticket R$ ${fmt(dados.ticketDia)}</span>
      </button>
      <button type="button" class="gerencia-inicio-card ${atencaoClasse}" onclick="GerenciaModule.abrirDestinoInicio('atencao')">
        <span class="gerencia-inicio-kicker">Atenção</span>
        <span class="gerencia-inicio-valor" style="color: ${dados.totalAtencao ? '#dc2626' : '#15803d'};">${atencaoValor}</span>
        <span class="gerencia-inicio-sub">${this._escHtml(atencaoSub)}</span>
      </button>
      <button type="button" class="gerencia-inicio-card ${pagarClasse}" onclick="GerenciaModule.abrirDestinoInicio('pagar')">
        <span class="gerencia-inicio-kicker">A pagar</span>
        <span class="gerencia-inicio-valor" style="color: ${pagarCor};">${pagarValor}</span>
        <span class="gerencia-inicio-sub">${this._escHtml(pagarSub)}</span>
      </button>
    `;

    const itens = this.montarItensInicioHoje(dados);
    this._inicioItensHoje = itens;

    if (!itens.length) {
      lista.innerHTML = `<div class="gerencia-inicio-vazio">Nada urgente hoje.</div>`;
      return;
    }

    lista.innerHTML = itens.map((it, i) => `
      <button type="button" class="gerencia-inicio-item" onclick="GerenciaModule.abrirItemInicio(${i})">
        <span class="gerencia-inicio-item-ico">${it.ico}</span>
        <span class="gerencia-inicio-item-txt">
          <strong>${this._escHtml(it.titulo)}</strong>
          <span>${this._escHtml(it.detalhe)}</span>
        </span>
      </button>
    `).join('');
  },

  abrirDestinoInicio(destino) {
    const dados = this.coletarDadosInicio();
    if (destino === 'caixa') {
      this.trocarSubAba('historico-caixas');
      return;
    }
    if (destino === 'vendas') {
      this.trocarSubAba('indicadores');
      return;
    }
    if (destino === 'pagar') {
      this.trocarSubAba('financeiro');
      if (typeof this.filtrarContas === 'function') {
        this.filtrarContas(dados.contasVencidas.length ? 'vencidas' : 'pendentes');
      }
      return;
    }
    if (destino === 'atencao') {
      if (dados.contasVencidas.length) {
        this.trocarSubAba('financeiro');
        if (typeof this.filtrarContas === 'function') this.filtrarContas('vencidas');
        return;
      }
      if (dados.prodVencidos.length && window.App) {
        window.App.irParaEstoqueComFiltro('vencidos');
        return;
      }
      if (dados.prodVence15d.length && window.App) {
        window.App.irParaEstoqueComFiltro('vence15d');
        return;
      }
      if (dados.estoqueBaixo.length && window.App) {
        window.App.irParaEstoqueBaixo();
        return;
      }
    }
  },

  abrirItemInicio(indice) {
    const item = (this._inicioItensHoje || [])[indice];
    if (!item) return;
    if (item.tipo === 'conta') {
      this.trocarSubAba('financeiro');
      if (typeof this.filtrarContas === 'function') this.filtrarContas('vencidas');
      return;
    }
    if (item.tipo === 'validade' && window.App) {
      window.App.irParaEstoqueComFiltro(item.filtro || 'vencidos');
      return;
    }
    if (item.tipo === 'estoque' && window.App) {
      window.App.irParaEstoqueBaixo();
    }
  },

  // =========================================================================
  // 1. INDICADORES GERENCIAIS & CURVA ABC
  // =========================================================================
  ordenacaoAbc: { coluna: 'faturamento', direcao: 'desc' },

  ordenarCurvaAbc(coluna) {
    if (this.ordenacaoAbc.coluna === coluna) {
      this.ordenacaoAbc.direcao = this.ordenacaoAbc.direcao === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenacaoAbc.coluna = coluna;
      const numericas = ['quantidade', 'faturamento', 'percItem', 'ranking'];
      this.ordenacaoAbc.direcao = numericas.includes(coluna) ? 'desc' : 'asc';
    }
    this.renderIndicadoresCurvaABC();
  },

  atualizarIconesOrdenacaoAbc() {
    const colunas = ['ranking', 'nome', 'categoria', 'quantidade', 'faturamento', 'percItem', 'classe'];
    colunas.forEach((col) => {
      const iconEl = document.getElementById(`abc-sort-${col}`);
      const thEl = iconEl && iconEl.closest('th');
      if (!iconEl) return;
      if (this.ordenacaoAbc.coluna === col) {
        iconEl.textContent = this.ordenacaoAbc.direcao === 'asc' ? '▲' : '▼';
        if (thEl) thEl.classList.add('active-sort');
      } else {
        iconEl.textContent = '↕';
        if (thEl) thEl.classList.remove('active-sort');
      }
    });
  },

  ordenarListaAbc(lista) {
    const col = this.ordenacaoAbc.coluna || 'faturamento';
    const dir = this.ordenacaoAbc.direcao === 'asc' ? 1 : -1;
    const classeOrdem = { A: 1, B: 2, C: 3 };
    return [...(lista || [])].sort((a, b) => {
      let cmp = 0;
      if (col === 'nome' || col === 'categoria') {
        cmp = String(a[col] || '').localeCompare(String(b[col] || ''), 'pt-BR', { sensitivity: 'base' });
      } else if (col === 'classe') {
        cmp = (classeOrdem[a.classe] || 9) - (classeOrdem[b.classe] || 9);
      } else {
        cmp = (Number(a[col]) || 0) - (Number(b[col]) || 0);
      }
      if (cmp === 0) return (a.ranking || 0) - (b.ranking || 0);
      return cmp * dir;
    });
  },
  calcularCurvaABC() {
    const vendas = StorageService.getVendas() || [];
    const produtosEstoque = StorageService.getProdutos() || [];

    // Mapeamento rápido de produtos cadastrados para obter a categoria atualizada
    const catMapById = {};
    const catMapByEan = {};
    const catMapByName = {};
    produtosEstoque.forEach(p => {
      if (p.id) catMapById[p.id] = p.categoria;
      if (p.codigoBarras) catMapByEan[p.codigoBarras] = p.categoria;
      if (p.nome) catMapByName[p.nome.toLowerCase().trim()] = p.categoria;
    });

    const mapaProdutos = {};
    let faturamentoTotal = 0;
    let totalItensVendidos = 0;

    // 1. Acumular vendas por produto
    vendas.forEach(v => {
      if (Array.isArray(v.itens)) {
        v.itens.forEach(item => {
          const nome = item.nome || 'Produto Sem Nome';
          const nomeLimpo = nome.replace(/\s*\[.*?\]\s*$/, '').toLowerCase().trim();
          const qtd = parseFloat(item.quantidade) || 1;
          const preco = parseFloat(item.precoUnitario) || 0;
          const subtotal = qtd * preco;

          const categoriaReal = (item.categoria && item.categoria.toLowerCase() !== 'geral' ? item.categoria : null) || 
                                (item.id && catMapById[item.id]) || 
                                (item.codigoBarras && catMapByEan[item.codigoBarras]) || 
                                catMapByName[nomeLimpo] || 
                                catMapByName[nome.toLowerCase().trim()] || 
                                item.categoria || 
                                'Geral';

          if (!mapaProdutos[nome]) {
            mapaProdutos[nome] = {
              id: item.id || item.codigoBarras || nome,
              nome: nome,
              categoria: categoriaReal,
              quantidade: 0,
              faturamento: 0
            };
          }

          mapaProdutos[nome].quantidade += qtd;
          mapaProdutos[nome].faturamento += subtotal;
          faturamentoTotal += subtotal;
          totalItensVendidos += qtd;
        });
      }
    });

    // 2. Converter para lista e ordenar decrescente por faturamento
    const lista = Object.values(mapaProdutos).sort((a, b) => b.faturamento - a.faturamento);

    // 3. Calcular percentual acumulado e classificação ABC
    let acumulado = 0;
    const ranking = lista.map((p, index) => {
      acumulado += p.faturamento;
      const percItem = faturamentoTotal > 0 ? (p.faturamento / faturamentoTotal) * 100 : 0;
      const percAcumulado = faturamentoTotal > 0 ? (acumulado / faturamentoTotal) * 100 : 0;

      let classe = 'C';
      if (percAcumulado <= 80 || index === 0) {
        classe = 'A';
      } else if (percAcumulado <= 95) {
        classe = 'B';
      }

      return {
        ...p,
        ranking: index + 1,
        percItem,
        percAcumulado,
        classe
      };
    });

    return {
      ranking,
      faturamentoTotal,
      totalItensVendidos,
      totalVendas: vendas.length,
      ticketMedio: vendas.length > 0 ? (faturamentoTotal / vendas.length) : 0
    };
  },

  renderIndicadoresCurvaABC() {
    const dados = this.calcularCurvaABC();
    const metricsContainer = document.getElementById('gerencia-abc-metrics');
    const tbody = document.getElementById('gerencia-abc-tbody');

    if (metricsContainer) {
      const top1 = dados.ranking.length > 0 ? dados.ranking[0].nome : 'Nenhum';
      const itensClasseA = dados.ranking.filter(r => r.classe === 'A').length;

      metricsContainer.innerHTML = `
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">💰 Faturamento Analisado</span>
          <strong style="font-size: 22px; font-weight: 900; color: #059669; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">R$ ${StorageService.formatarMoeda(dados.faturamentoTotal)}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${dados.totalVendas} vendas registradas</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">🧾 Ticket Médio</span>
          <strong style="font-size: 22px; font-weight: 900; color: #2563eb; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">R$ ${StorageService.formatarMoeda(dados.ticketMedio)}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${dados.totalItensVendidos} unidades vendidas</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #ea580c; text-transform: uppercase;">🏆 Produto Líder (Top 1)</span>
          <strong style="font-size: 16px; font-weight: 800; color: var(--text-main); display: block; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${top1}">${top1}</strong>
          <span style="font-size: 11px; color: #ea580c; font-weight: 600;">Maior gerador de receita</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase;">🅰️ Curva A (80% Faturamento)</span>
          <strong style="font-size: 22px; font-weight: 900; color: #7c3aed; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">${itensClasseA} ${itensClasseA === 1 ? 'produto' : 'produtos'}</strong>
          <span style="font-size: 11px; color: #7c3aed; font-weight: 600;">Itens vitais para o negócio</span>
        </div>
      `;
    }

    if (!tbody) return;

    if (dados.ranking.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">Nenhuma venda registrada no histórico para gerar a Curva ABC. Realize vendas no PDV para calcular os indicadores.</td></tr>`;
      this.atualizarIconesOrdenacaoAbc();
      return;
    }

    const rankingExibido = this.ordenarListaAbc(dados.ranking);

    tbody.innerHTML = rankingExibido.map(item => {
      let badgeClass = 'classe-c';
      let badgeLabel = '🅲 Classe C';
      let badgeStyle = 'background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;';

      if (item.classe === 'A') {
        badgeLabel = '🅰️ Classe A (Top 80%)';
        badgeStyle = 'background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 800;';
      } else if (item.classe === 'B') {
        badgeLabel = '🅱️ Classe B (15%)';
        badgeStyle = 'background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 800;';
      }

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono'; font-weight: 800; color: var(--text-muted); width: 60px; text-align: center;">#${item.ranking}</td>
          <td>
            <strong style="color: var(--text-main); font-size: 14px;">${item.nome}</strong>
          </td>
          <td>
            <span class="category-tag" style="white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 6px; color: var(--text-muted);">
              ${StorageService.getIconeCategoria(item.categoria)} ${item.categoria || 'Geral'}
            </span>
          </td>
          <td style="font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-main); text-align: center;">${item.quantidade} un</td>
          <td style="font-family: 'JetBrains Mono'; font-weight: 800; color: #059669; font-size: 14.5px;">R$ ${StorageService.formatarMoeda(item.faturamento)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="flex: 1; background: #e2e8f0; height: 6px; border-radius: 3px; overflow: hidden; min-width: 50px;">
                <div style="background: ${item.classe === 'A' ? '#10b981' : (item.classe === 'B' ? '#f59e0b' : '#94a3b8')}; width: ${Math.min(100, item.percItem * 3)}%; height: 100%;"></div>
              </div>
              <span style="font-family: 'JetBrains Mono'; font-size: 12px; font-weight: 700; color: var(--text-muted); min-width: 44px;">${item.percItem.toFixed(1)}%</span>
            </div>
          </td>
          <td style="text-align: right;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; ${badgeStyle}">${badgeLabel}</span>
          </td>
        </tr>
      `;
    }).join('');
    this.atualizarIconesOrdenacaoAbc();
  },

  // =========================================================================
  // 2. CONTAS A PAGAR (MÓDULO FINANCEIRO DE DESPESAS)
  // =========================================================================
  renderContasPagar() {
    const contas = StorageService.getContasPagar() || [];
    const tbody = document.getElementById('gerencia-contas-tbody');
    const metricsContainer = document.getElementById('gerencia-contas-metrics');

    // Métricas Financeiras
    let totalPendente = 0;
    let totalPago = 0;
    let totalVencido = 0;
    const hojeStr = new Date().toISOString().split('T')[0];

    contas.forEach(c => {
      const val = parseFloat(c.valor) || 0;
      if (c.status === 'pago') {
        totalPago += val;
      } else {
        if (c.vencimento && c.vencimento < hojeStr) {
          totalVencido += val;
        } else {
          totalPendente += val;
        }
      }
    });

    const formatarMoedaBR = (v) => {
      const n = parseFloat(v) || 0;
      return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Calcular próximo vencimento (somente contas A VENCER a partir de hoje!)
    const proximasPendentes = contas
      .filter(c => c.status !== 'pago' && c.vencimento && c.vencimento >= hojeStr)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const proxVenc = proximasPendentes.length > 0 ? proximasPendentes[0] : null;
    let proxVencLabel = 'Nenhum a vencer';
    let proxVencDesc = 'Sem contas futuras pendentes 🎉';
    if (proxVenc) {
      const partes = proxVenc.vencimento.split('-');
      proxVencLabel = (proxVenc.vencimento === hojeStr)
        ? `Hoje (${partes[2]}/${partes[1]})`
        : `${partes[2]}/${partes[1]}/${partes[0]}`;
      proxVencDesc = (proxVenc.descricao || 'Despesa').substring(0, 30);
    }

    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #d97706; text-transform: uppercase;">⏳ Total a Pagar Pendente</span>
          <strong style="font-size: 22px; font-weight: 900; color: #d97706; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">R$ ${formatarMoedaBR(totalPendente)}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">Boletos & despesas a vencer</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase;">🚨 Contas Vencidas (Atraso)</span>
          <strong style="font-size: 22px; font-weight: 900; color: #dc2626; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">R$ ${formatarMoedaBR(totalVencido)}</strong>
          <span style="font-size: 11px; color: #dc2626; font-weight: 600;">Necessitam quitação imediata</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase;">✅ Total Pago</span>
          <strong style="font-size: 22px; font-weight: 900; color: #059669; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">R$ ${formatarMoedaBR(totalPago)}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">Despesas quitadas</span>
        </div>
        <div class="summary-metric-card" style="background: #ffffff; border: 1px solid #c7d2fe; border-radius: 12px; padding: 14px 18px; box-shadow: var(--shadow-sm);">
          <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase;">📅 Próximo Vencimento</span>
          <strong style="font-size: 22px; font-weight: 900; color: #4f46e5; font-family: 'JetBrains Mono'; display: block; margin-top: 4px;">${proxVencLabel}</strong>
          <span style="font-size: 11px; color: var(--text-muted);">${proxVencDesc}</span>
        </div>
      `;
    }

    if (!tbody) return;

    // Filtrar contas conforme o seletor
    let listaFiltrada = contas;
    if (this.filtroContasStatus === 'pendentes') {
      listaFiltrada = contas.filter(c => c.status !== 'pago' && (!c.vencimento || c.vencimento >= hojeStr));
    } else if (this.filtroContasStatus === 'vencidas') {
      listaFiltrada = contas.filter(c => c.status !== 'pago' && c.vencimento && c.vencimento < hojeStr);
    } else if (this.filtroContasStatus === 'pagas') {
      listaFiltrada = contas.filter(c => c.status === 'pago');
    }

    // Ordenação Inteligente por Vencimento (mais antigas / vencidas / urgentes primeiro)
    listaFiltrada.sort((a, b) => {
      // 1. Contas pendentes/vencidas vêm antes de contas já pagas
      if (a.status === 'pago' && b.status !== 'pago') return 1;
      if (a.status !== 'pago' && b.status === 'pago') return -1;

      // 2. Ordem cronológica de vencimento crescente (vencimento mais próximo primeiro)
      const dataA = a.vencimento || '9999-12-31';
      const dataB = b.vencimento || '9999-12-31';
      return dataA.localeCompare(dataB);
    });

    if (listaFiltrada.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 32px; color: var(--text-dim);">Nenhuma conta a pagar encontrada neste filtro. Clique em "➕ Nova Despesa" para cadastrar boletos e despesas.</td></tr>`;
      return;
    }

    tbody.innerHTML = listaFiltrada.map(c => {
      const val = parseFloat(c.valor) || 0;
      const isPaga = c.status === 'pago';
      const isVencida = !isPaga && c.vencimento && c.vencimento < hojeStr;

      let statusBadge = '<span style="background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">⏳ Pendente</span>';
      if (isPaga) {
        statusBadge = '<span style="background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">✅ Paga</span>';
      } else if (isVencida) {
        statusBadge = '<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">🚨 Vencida</span>';
      }

      const vctoFmt = c.vencimento ? new Date(c.vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '--';

      return `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="color: var(--text-main); font-size: 14px;">${c.descricao}</strong>
                ${c.recorrente ? `<span style="background: #e0f2fe; color: #0284c7; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; border: 1px solid #bae6fd;">🔄 Mensal</span>` : ''}
              </div>
              ${c.fornecedor ? `<span style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Fornecedor: ${c.fornecedor}</span>` : ''}
            </div>
          </td>
          <td>
            <span style="background: #f8fafc; border: 1px solid var(--border-card); font-size: 11.5px; padding: 2px 8px; border-radius: 6px; color: var(--text-muted);">${c.categoria || 'Geral'}</span>
          </td>
          <td style="font-family: 'JetBrains Mono'; font-size: 13px; font-weight: 700; color: ${isVencida ? '#dc2626' : 'var(--text-main)'};">
            ${vctoFmt}
          </td>
          <td>
            <strong style="font-family: 'JetBrains Mono'; font-size: 15px; color: ${isPaga ? '#059669' : '#d97706'};">
              R$ ${formatarMoedaBR(val)}
            </strong>
          </td>
          <td style="white-space: nowrap;">${statusBadge}</td>
          <td>
            ${isPaga ? `
              <span style="font-size: 11.5px; color: var(--text-muted);">
                ${c.dataPagamento ? new Date(c.dataPagamento).toLocaleDateString('pt-BR') : ''} (${c.formaPagamento || 'PIX'})
              </span>
            ` : `<span style="font-size: 11.5px; color: var(--text-dim);">-</span>`}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              ${!isPaga ? `
                <button type="button" class="btn-pagar-conta-table" onclick="GerenciaModule.abrirModalBaixaConta('${c.id}')" title="Dar baixa / Registrar pagamento">
                  💵 Pagar
                </button>
              ` : ''}
              <button type="button" class="btn-action-sm" style="width: 32px; height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0;" onclick="GerenciaModule.abrirModalConta('${c.id}')" title="Editar conta">✏️</button>
              <button type="button" class="btn-action-sm danger" style="width: 32px; height: 30px; display: inline-flex; align-items: center; justify-content: center; padding: 0;" onclick="GerenciaModule.excluirConta('${c.id}')" title="Excluir despesa">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filtrarContas(status) {
    this.filtroContasStatus = status;
    document.querySelectorAll('.gerencia-contas-filtro-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === status);
    });
    this.renderContasPagar();
  },

  mascaraMoeda(input) {
    let v = input.value.replace(/\D/g, '');
    if (!v) {
      input.value = '';
      return;
    }
    const num = (parseInt(v, 10) / 100).toFixed(2);
    input.value = num.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },

  converterMoedaParaFloat(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const limpo = str.toString().replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  },

  abrirModalConta(id = null) {
    this.contaEditandoId = id;
    const modal = document.getElementById('modal-gerencia-conta');
    const form = document.getElementById('form-gerencia-conta');
    const title = document.getElementById('modal-gerencia-conta-title');

    if (form) form.reset();

    if (id) {
      if (title) title.textContent = '✏️ Editar Conta a Pagar';
      const contas = StorageService.getContasPagar();
      const c = contas.find(item => item.id === id);
      if (c) {
        document.getElementById('conta-descricao').value = c.descricao || '';
        document.getElementById('conta-fornecedor').value = c.fornecedor || '';
        document.getElementById('conta-categoria').value = c.categoria || 'Fornecedores';
        const valNum = parseFloat(c.valor) || 0;
        document.getElementById('conta-valor').value = valNum > 0 ? valNum.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
        document.getElementById('conta-vencimento').value = c.vencimento || '';
        document.getElementById('conta-obs').value = c.observacoes || '';
        const chkRecorrente = document.getElementById('conta-recorrente');
        if (chkRecorrente) chkRecorrente.checked = !!c.recorrente;
      }
    } else {
      if (title) title.textContent = '➕ Nova Despesa / Conta a Pagar';
      const hoje = new Date().toISOString().split('T')[0];
      document.getElementById('conta-vencimento').value = hoje;
      document.getElementById('conta-valor').value = '';
      const chkRecorrente = document.getElementById('conta-recorrente');
      if (chkRecorrente) chkRecorrente.checked = false;
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalConta() {
    const modal = document.getElementById('modal-gerencia-conta');
    if (modal) modal.classList.remove('active');
  },

  salvarConta(e) {
    e.preventDefault();
    const descricao = document.getElementById('conta-descricao')?.value.trim();
    const fornecedor = document.getElementById('conta-fornecedor')?.value.trim() || '';
    const categoria = document.getElementById('conta-categoria')?.value || 'Fornecedores';
    const valorInput = document.getElementById('conta-valor')?.value || '';
    const valor = this.converterMoedaParaFloat(valorInput);
    const vencimento = document.getElementById('conta-vencimento')?.value || '';
    const observacoes = document.getElementById('conta-obs')?.value.trim() || '';
    const recorrente = !!document.getElementById('conta-recorrente')?.checked;

    if (!descricao || valor <= 0) {
      window.App.showToast('Informe a descrição e um valor válido para a despesa!', 'warning');
      return;
    }

    let contas = StorageService.getContasPagar();

    if (this.contaEditandoId) {
      const index = contas.findIndex(item => item.id === this.contaEditandoId);
      if (index !== -1) {
        contas[index] = {
          ...contas[index],
          descricao,
          fornecedor,
          categoria,
          valor,
          vencimento,
          observacoes,
          recorrente
        };
      }
    } else {
      const nova = {
        id: 'DESP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        descricao,
        fornecedor,
        categoria,
        valor,
        vencimento,
        status: 'pendente',
        dataPagamento: null,
        formaPagamento: '',
        observacoes,
        recorrente,
        criadoEm: new Date().toISOString()
      };
      contas.push(nova);
    }

    StorageService.saveContasPagar(contas);
    if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('contas_pagar');

    this.fecharModalConta();
    this.renderContasPagar();
    window.App.showToast('✅ Despesa salva com sucesso!', 'success');
  },

  abrirModalBaixaConta(id) {
    this.contaBaixandoId = id;
    const contas = StorageService.getContasPagar();
    const c = contas.find(item => item.id === id);
    if (!c) return;

    const modal = document.getElementById('modal-baixa-conta');
    const descEl = document.getElementById('baixa-conta-descricao');
    const valorEl = document.getElementById('baixa-conta-valor');
    const dataInput = document.getElementById('baixa-conta-data');

    if (descEl) descEl.textContent = c.descricao;
    if (valorEl) valorEl.textContent = `R$ ${parseFloat(c.valor || 0).toFixed(2).replace('.', ',')}`;
    if (dataInput) dataInput.value = new Date().toISOString().split('T')[0];

    if (modal) modal.classList.add('active');
  },

  fecharModalBaixaConta() {
    const modal = document.getElementById('modal-baixa-conta');
    if (modal) modal.classList.remove('active');
  },

  confirmarBaixaConta() {
    const contas = StorageService.getContasPagar();
    const c = contas.find(item => item.id === this.contaBaixandoId);
    if (!c) return;

    const dataPagto = document.getElementById('baixa-conta-data')?.value || new Date().toISOString().split('T')[0];
    const formaPagto = document.getElementById('baixa-conta-forma')?.value || 'PIX';

    c.status = 'pago';
    c.dataPagamento = dataPagto;
    c.formaPagamento = formaPagto;

    // Se for despesa recorrente mensal, agenda automaticamente a próxima parcela para o mês seguinte!
    if (c.recorrente) {
      let proximoVenc = '';
      try {
        const baseVenc = c.vencimento || dataPagto;
        const partes = baseVenc.split('-');
        let ano = parseInt(partes[0], 10);
        let mes = parseInt(partes[1], 10);
        let dia = parseInt(partes[2], 10);
        mes += 1;
        if (mes > 12) {
          mes = 1;
          ano += 1;
        }
        const diasNoMes = new Date(ano, mes, 0).getDate();
        if (dia > diasNoMes) dia = diasNoMes;
        proximoVenc = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      } catch (err) {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        proximoVenc = d.toISOString().split('T')[0];
      }

      const novaRecorrente = {
        id: 'DESP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        descricao: c.descricao,
        fornecedor: c.fornecedor || '',
        categoria: c.categoria || 'Geral',
        valor: c.valor,
        vencimento: proximoVenc,
        status: 'pendente',
        dataPagamento: null,
        formaPagamento: '',
        observacoes: c.observacoes || '',
        recorrente: true,
        criadoEm: new Date().toISOString()
      };
      contas.push(novaRecorrente);
    }

    StorageService.saveContasPagar(contas);
    if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('contas_pagar_baixa');

    this.fecharModalBaixaConta();
    this.renderContasPagar();

    if (c.recorrente) {
      window.App.showToast(`🎉 Pagamento registrado! Próxima conta de ${c.descricao} gerada para o próximo mês.`, 'success');
    } else {
      window.App.showToast(`🎉 Pagamento de R$ ${parseFloat(c.valor).toFixed(2)} registrado com sucesso!`, 'success');
    }
  },

  excluirConta(id) {
    const contas = StorageService.getContasPagar();
    const c = contas.find(item => item.id === id);
    if (!c) return;

    window.App.confirmarAcao({
      titulo: 'Excluir Despesa',
      mensagem: `Deseja realmente excluir a despesa <strong>"${c.descricao}"</strong> no valor de <strong>R$ ${StorageService.formatarMoeda(c.valor)}</strong>?<br><br><span style="color: var(--text-dim); font-size: 12px;">Esta ação removerá a conta do seu financeiro.</span>`,
      icone: '🗑️',
      textoConfirmar: '🗑️ Sim, Excluir [ENTER]',
      textoCancelar: 'Cancelar [ESC]',
      perigo: true,
      onConfirm: () => {
        const novaLista = contas.filter(item => item.id !== id);
        StorageService.saveContasPagar(novaLista);
        if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('contas_pagar_exclusao');

        this.renderContasPagar();
        window.App.showToast('🗑️ Despesa excluída com sucesso.', 'info');
      }
    });
  },

  // =========================================================================
  // 3. GESTÃO AUTÔNOMA DE CATEGORIAS
  // =========================================================================
  renderGestaoCategorias() {
    const categorias = StorageService.getCategorias() || [];
    const produtos = StorageService.getProdutos() || [];
    const grid = document.getElementById('gerencia-categorias-grid');

    if (!grid) return;

    grid.innerHTML = categorias.map(cat => {
      const icone = StorageService.getIconeCategoria(cat);
      const totalProds = produtos.filter(p => (p.categoria || '').toLowerCase() === cat.toLowerCase()).length;

      return `
        <div class="gerencia-categoria-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 28px;">${icone}</span>
              <div>
                <strong style="font-size: 15px; color: var(--text-main); display: block;">${cat}</strong>
                <span style="font-size: 12px; color: var(--text-muted);">${totalProds} ${totalProds === 1 ? 'produto cadastrado' : 'produtos cadastrados'}</span>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 4px;">
            <button type="button" class="btn-categoria-acao renomear" onclick="GerenciaModule.abrirModalRenomearCategoria('${encodeURIComponent(cat)}')" title="Renomear categoria">
              ✏️ Renomear
            </button>
            <button type="button" class="btn-categoria-acao excluir" onclick="GerenciaModule.excluirCategoria('${encodeURIComponent(cat)}')" title="Excluir categoria">
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  categoriaEditandoNome: null,
  categoriaExcluindoNome: null,

  abrirModalNovaCategoria() {
    this.categoriaEditandoNome = null;
    const modal = document.getElementById('modal-gerenciar-categoria');
    const title = document.getElementById('modal-categoria-title');
    const input = document.getElementById('categoria-nome-input');

    if (title) title.textContent = '🏷️ Nova Categoria';
    if (input) {
      input.value = '';
      setTimeout(() => {
        input.focus();
      }, 100);
    }
    if (modal) modal.classList.add('active');
  },

  abrirModalRenomearCategoria(catCodificada) {
    const nomeAtual = decodeURIComponent(catCodificada || '');
    this.categoriaEditandoNome = nomeAtual;
    const modal = document.getElementById('modal-gerenciar-categoria');
    const title = document.getElementById('modal-categoria-title');
    const input = document.getElementById('categoria-nome-input');

    if (title) title.textContent = `✏️ Renomear Categoria: ${nomeAtual}`;
    if (input) {
      input.value = nomeAtual;
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
    }
    if (modal) modal.classList.add('active');
  },

  fecharModalCategoria() {
    const modal = document.getElementById('modal-gerenciar-categoria');
    if (modal) modal.classList.remove('active');
    this.categoriaEditandoNome = null;
  },

  salvarCategoria(e) {
    e.preventDefault();
    const input = document.getElementById('categoria-nome-input');
    const nomeFormatado = input ? input.value.trim() : '';

    if (!nomeFormatado) {
      window.App.showToast('Informe o nome da categoria!', 'warning');
      return;
    }

    let categorias = StorageService.getCategorias() || [];

    if (this.categoriaEditandoNome) {
      // Renomeação
      const nomeAntigo = this.categoriaEditandoNome;
      if (nomeAntigo.toLowerCase() !== nomeFormatado.toLowerCase() && categorias.some(c => c.toLowerCase() === nomeFormatado.toLowerCase())) {
        window.App.showToast('Já existe outra categoria com este nome!', 'warning');
        return;
      }

      const index = categorias.findIndex(c => c.toLowerCase() === nomeAntigo.toLowerCase());
      if (index !== -1) {
        categorias[index] = nomeFormatado;
        StorageService.salvarCategorias(categorias);

        // Atualizar produtos existentes
        let produtos = StorageService.getProdutos() || [];
        let alterouProds = false;
        produtos.forEach(p => {
          if ((p.categoria || '').toLowerCase() === nomeAntigo.toLowerCase()) {
            p.categoria = nomeFormatado;
            alterouProds = true;
          }
        });
        if (alterouProds) StorageService.saveProdutos(produtos);

        if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('categorias_renomear');
        if (window.LicencaModule && typeof window.LicencaModule.atualizarCategoriasNuvem === 'function') {
          window.LicencaModule.atualizarCategoriasNuvem(categorias, StorageService.getCategoriasExcluidas());
        }
        if (window.EstoqueModule) {
          window.EstoqueModule.renderBarraCategorias();
          window.EstoqueModule.renderTabelaProdutos();
        }

        window.App.showToast(`✅ Categoria renomeada para "${nomeFormatado}"!`, 'success');
      }
    } else {
      // Nova Categoria
      if (categorias.some(c => c.toLowerCase() === nomeFormatado.toLowerCase())) {
        window.App.showToast('Esta categoria já existe no catálogo!', 'warning');
        return;
      }

      StorageService.removerCategoriaExcluida(nomeFormatado);
      categorias.push(nomeFormatado);
      StorageService.salvarCategorias(categorias);

      if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('categorias');
      if (window.LicencaModule && typeof window.LicencaModule.atualizarCategoriasNuvem === 'function') {
        window.LicencaModule.atualizarCategoriasNuvem(categorias, StorageService.getCategoriasExcluidas());
      }
      if (window.EstoqueModule) window.EstoqueModule.renderBarraCategorias();

      window.App.showToast(`✅ Categoria "${nomeFormatado}" criada com sucesso!`, 'success');
    }

    this.fecharModalCategoria();
    this.renderGestaoCategorias();
  },

  excluirCategoria(catCodificada) {
    const nome = decodeURIComponent(catCodificada || '');
    this.categoriaExcluindoNome = nome;

    const produtos = StorageService.getProdutos() || [];
    const prodsVinculados = produtos.filter(p => (p.categoria || '').toLowerCase() === nome.toLowerCase());

    const modal = document.getElementById('modal-confirmar-exclusao-categoria');
    const msgEl = document.getElementById('modal-excluir-categoria-msg');

    if (msgEl) {
      if (prodsVinculados.length > 0) {
        msgEl.innerHTML = `Existem <strong>${prodsVinculados.length} produto(s)</strong> vinculados à categoria "<strong>${nome}</strong>".<br><br>Ao excluir, esses produtos serão automaticamente movidos para a categoria "<strong>Geral</strong>".`;
      } else {
        msgEl.innerHTML = `Deseja realmente remover a categoria "<strong>${nome}</strong>" do catálogo da loja?`;
      }
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalExcluirCategoria() {
    const modal = document.getElementById('modal-confirmar-exclusao-categoria');
    if (modal) modal.classList.remove('active');
    this.categoriaExcluindoNome = null;
  },

  confirmarExclusaoCategoriaExecutar() {
    const nome = this.categoriaExcluindoNome;
    if (!nome) return;

    let produtos = StorageService.getProdutos() || [];
    const prodsVinculados = produtos.filter(p => (p.categoria || '').toLowerCase() === nome.toLowerCase());

    if (prodsVinculados.length > 0) {
      prodsVinculados.forEach(p => { p.categoria = 'Geral'; });
      StorageService.saveProdutos(produtos);
    }

    // Marcar como excluída para evitar ressuscitação pelo CloudSync
    StorageService.adicionarCategoriaExcluida(nome);

    let categorias = StorageService.getCategorias() || [];
    categorias = categorias.filter(c => c.toLowerCase() !== nome.toLowerCase());
    if (categorias.length === 0) categorias = ['Geral'];

    StorageService.salvarCategorias(categorias);

    if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('categorias_exclusao');
    if (window.LicencaModule && typeof window.LicencaModule.atualizarCategoriasNuvem === 'function') {
      window.LicencaModule.atualizarCategoriasNuvem(categorias, StorageService.getCategoriasExcluidas());
    }
    if (window.EstoqueModule) {
      window.EstoqueModule.renderBarraCategorias();
      window.EstoqueModule.renderTabelaProdutos();
    }

    this.fecharModalExcluirCategoria();
    this.renderGestaoCategorias();
    window.App.showToast(`🗑️ Categoria "${nome}" excluída com sucesso.`, 'info');
  },

  filtroAuditoria: 'todos',
  filtroOperadorAuditoria: 'todos',
  filtroDataAuditoria: '',
  filtroDataHistorico: '',
  bindScrollAuditoria() {
    const area = document.getElementById('gerencia-auditoria-scroll');
    if (!area || area.dataset.scrollBound === '1') return;
    area.dataset.scrollBound = '1';
    area.addEventListener('scroll', () => {
      if (this.subAbaAtiva !== 'auditoria') return;
      if (this.auditoriaCarregandoMais) return;
      if (area.scrollTop + area.clientHeight < area.scrollHeight - 90) return;
      this.carregarMaisAuditoria();
    });
  },

  // =========================================================================
  // 4. AUDITORIA EM TEMPO REAL & AJUSTE MANUAL DE ESTOQUE
  // =========================================================================
  renderSkeletonAuditoria(tbody) {
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: 6 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-shimmer" style="width: 120px; height: 16px;"></div></td>
        <td><div class="skeleton-shimmer" style="width: 95px; height: 22px; border-radius: 6px;"></div></td>
        <td><div class="skeleton-shimmer" style="width: 85%; height: 16px;"></div></td>
        <td><div class="skeleton-shimmer" style="width: 85px; height: 16px;"></div></td>
        <td><div class="skeleton-shimmer" style="width: 75px; height: 16px;"></div></td>
        <td style="text-align: right;"><div class="skeleton-shimmer" style="width: 65px; height: 26px; border-radius: 6px; margin-left: auto;"></div></td>
      </tr>
    `).join('');
  },

  preencherSelectOperadoresAuditoria() {
    const select = document.getElementById('gerencia-auditoria-operador-select');
    if (!select) return;

    const operadoresSet = new Set();
    // Operadores cadastrados no sistema
    const usuarios = StorageService.getUsuarios() || [];
    usuarios.forEach(u => {
      if (u && u.nome) operadoresSet.add(u.nome.trim());
    });

    // Operadores encontrados nos logs
    (this.logsAuditoriaCache || []).forEach(l => {
      if (l && l.operador) operadoresSet.add(l.operador.trim());
    });

    const valorAtual = this.filtroOperadorAuditoria || 'todos';
    let html = '<option value="todos">👤 Todos os Operadores</option>';
    Array.from(operadoresSet).sort().forEach(op => {
      html += `<option value="${op}" ${op.toLowerCase() === valorAtual.toLowerCase() ? 'selected' : ''}>👤 ${op}</option>`;
    });
    select.innerHTML = html;
  },

  filtrarAuditoriaOperador(operador) {
    this.filtroOperadorAuditoria = operador || 'todos';
    this.auditoriaExibidos = 100;
    this.renderAuditoriaFiltrada();
  },

  ymdLocal(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    if (!Number.isFinite(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  msDoLogAuditoria(log) {
    if (window.AuditModule && typeof AuditModule.dataDoLogMs === 'function') {
      return AuditModule.dataDoLogMs(log);
    }
    const raw = log && (log.criadoEm || log.dataHoraFormatada);
    const n = Date.parse(raw || 0);
    return Number.isFinite(n) ? n : 0;
  },

  logBateDataFiltro(log, ymd) {
    if (!ymd) return true;
    return this.ymdLocal(this.msDoLogAuditoria(log)) === ymd;
  },

  filtrarAuditoriaData(valor) {
    this.filtroDataAuditoria = String(valor || '').trim();
    this.atualizarLabelFiltroData('gerencia-auditoria-filtro-data', 'gerencia-auditoria-filtro-data-label', 'Filtrar Log');
    this.auditoriaExibidos = 100;
    this.renderAuditoriaFiltrada();
  },

  filtrarHistoricoData(valor) {
    this.filtroDataHistorico = String(valor || '').trim();
    this.atualizarLabelFiltroData('gerencia-historico-filtro-data', 'gerencia-historico-filtro-data-label', 'Filtrar Caixa');
    this.renderHistoricoCaixas();
  },

  atualizarLabelFiltroData(inputId, labelId, placeholder) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);
    const wrap = input && input.closest('.filtro-data-wrap');
    const ymd = String((input && input.value) || '').trim();
    if (label) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        const [ano, mes, dia] = ymd.split('-');
        label.textContent = `${dia}/${mes}/${ano}`;
      } else {
        label.textContent = placeholder;
      }
    }
    if (wrap) wrap.classList.toggle('has-value', Boolean(ymd));
  },

  abrirCalendarioFiltro(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.picking) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.dataset.picking = '1';
        input.showPicker();
      } catch (e) {}
      setTimeout(() => { delete input.dataset.picking; }, 400);
    }
  },

  async renderAuditoriaAjustes() {
    const tbody = document.getElementById('gerencia-auditoria-tbody');
    if (!tbody) return;
    this.bindScrollAuditoria();
    this.auditoriaExibidos = 100;

    const btnAtualizar = document.getElementById('btn-atualizar-logs-auditoria');
    if (btnAtualizar) {
      btnAtualizar.disabled = true;
      btnAtualizar.innerHTML = '<span class="spin-icon">🔄</span> Atualizando...';
    }

    // 1. CARREGAMENTO INSTANTÂNEO (Stale-While-Revalidate):
    // Se já temos logs em cache ou locais, renderiza imediatamente (0ms de espera!)
    const logsLocais = AuditModule && typeof AuditModule.getLocalLogs === 'function' ? AuditModule.getLocalLogs() : [];
    const logsIniciais = (this.logsAuditoriaCache && this.logsAuditoriaCache.length > 0)
      ? this.logsAuditoriaCache
      : logsLocais;
    const exclusaoLocal = AuditModule && typeof AuditModule.lerExclusaoLocal === 'function'
      ? AuditModule.lerExclusaoLocal()
      : null;
    const logsVisiveis = exclusaoLocal && AuditModule.logFoiExcluidoNaNuvem
      ? (logsIniciais || []).filter((l) => !AuditModule.logFoiExcluidoNaNuvem(l, exclusaoLocal))
      : logsIniciais;

    if (logsVisiveis && logsVisiveis.length > 0) {
      this.logsAuditoriaCache = logsVisiveis;
      this.preencherSelectOperadoresAuditoria();
      this.renderAuditoriaFiltrada();
    } else {
      // Se não houver nenhum log ainda, exibe o Skeleton animado
      this.renderSkeletonAuditoria(tbody);
    }

    // 2. BUSCA ATUALIZAÇÃO NA NUVEM EM BACKGROUND COM TIMEOUT DE 3.5s
    try {
      const logs = await AuditModule.buscarLogsAuditoria(100);
      if (AuditModule.consultaNuvemOk) {
        this.logsAuditoriaCache = logs || [];
      } else if (logs && logs.length) {
        this.logsAuditoriaCache = logs;
      } else if (!this.logsAuditoriaCache || !this.logsAuditoriaCache.length) {
        this.logsAuditoriaCache = logs || logsLocais || [];
      }
      this.preencherSelectOperadoresAuditoria();
      this.renderAuditoriaFiltrada();
    } catch (err) {
      console.warn('[GerenciaModule] Erro ao sincronizar logs da nuvem, mantendo logs locais:', err);
      // Garante renderização dos dados locais se a nuvem falhar
      if (!this.logsAuditoriaCache || this.logsAuditoriaCache.length === 0) {
        this.logsAuditoriaCache = logsLocais;
        this.renderAuditoriaFiltrada();
      }
    } finally {
      if (btnAtualizar) {
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = '🔄 Atualizar';
      }
      this.layoutFiltrosAuditoria();
    }
  },

  filtrarAuditoria(tipo) {
    this.filtroAuditoria = tipo;
    this.auditoriaExibidos = 100;
    document.querySelectorAll('.gerencia-audit-filtro-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tipo') === tipo);
    });
    this.layoutFiltrosAuditoria();
    this.renderAuditoriaFiltrada();
  },

  bindFiltrosAuditoriaOverflow() {
    if (this._filtrosAuditBound) return;
    this._filtrosAuditBound = true;
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('gerencia-auditoria-mais-wrap');
      if (wrap && !wrap.contains(e.target)) this.fecharDropdownFiltrosAuditoria();
    });
    window.addEventListener('resize', () => {
      if (this.subAbaAtiva === 'auditoria') this.layoutFiltrosAuditoria();
    });
  },

  toggleDropdownFiltrosAuditoria(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('dropdown-mais-filtros-auditoria');
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  },

  fecharDropdownFiltrosAuditoria() {
    const dropdown = document.getElementById('dropdown-mais-filtros-auditoria');
    if (dropdown) dropdown.style.display = 'none';
  },

  layoutFiltrosAuditoria() {
    const bar = document.getElementById('gerencia-auditoria-filtros-bar');
    const wrap = document.getElementById('gerencia-auditoria-mais-wrap');
    const menu = document.getElementById('dropdown-mais-filtros-auditoria');
    const btnMais = document.getElementById('btn-mais-filtros-auditoria');
    if (!bar || !wrap || !menu || !btnMais) return;

    const pills = Array.from(bar.querySelectorAll('.gerencia-audit-filtro-btn'));
    pills.forEach((p) => { p.style.display = ''; });
    wrap.classList.remove('is-visible');
    wrap.style.setProperty('display', 'none', 'important');
    menu.style.display = 'none';
    btnMais.classList.remove('active');
    btnMais.textContent = '📂 Mais ▾';

    const gap = 4;
    const available = bar.clientWidth;
    if (available <= 0) {
      requestAnimationFrame(() => this.layoutFiltrosAuditoria());
      return;
    }

    const widths = pills.map((p) => p.offsetWidth);
    const total = widths.reduce((acc, w) => acc + w, 0) + gap * Math.max(0, pills.length - 1);
    if (total <= available + 1) return;

    wrap.classList.add('is-visible');
    wrap.style.setProperty('display', 'inline-block', 'important');
    const maisW = wrap.offsetWidth + gap;
    let budget = Math.max(0, available - maisW);
    let used = 0;
    const extras = [];

    pills.forEach((pill, i) => {
      const w = widths[i] + (used > 0 ? gap : 0);
      const isTodos = pill.getAttribute('data-tipo') === 'todos';
      if (isTodos || (extras.length === 0 && used + w <= budget)) {
        pill.style.display = '';
        used += w;
      } else {
        pill.style.display = 'none';
        extras.push(pill);
      }
    });

    if (!extras.length) {
      wrap.classList.remove('is-visible');
      wrap.style.setProperty('display', 'none', 'important');
      return;
    }

    const ativo = extras.find((p) => p.classList.contains('active'));
    if (ativo) {
      btnMais.classList.add('active');
      btnMais.textContent = `${ativo.textContent.trim()} ▾`;
    } else {
      btnMais.classList.remove('active');
      btnMais.textContent = `📂 Mais (${extras.length}) ▾`;
    }

    menu.innerHTML = `
      <div style="font-size: 11px; font-weight: 800; color: #64748b; padding: 6px 10px 4px 10px; text-transform: uppercase; letter-spacing: 0.5px;">Outros filtros</div>
      ${extras.map((p) => {
        const tipo = p.getAttribute('data-tipo');
        const label = p.textContent.trim();
        const active = p.classList.contains('active') ? 'active' : '';
        return `<button type="button" class="category-dropdown-item ${active}" onclick="GerenciaModule.filtrarAuditoria('${tipo}')">${label}</button>`;
      }).join('')}
    `;
  },

  renderAuditoriaFiltrada() {
    const tbody = document.getElementById('gerencia-auditoria-tbody');
    if (!tbody) return;
    const inputData = document.getElementById('gerencia-auditoria-filtro-data');
    if (inputData && inputData.value !== (this.filtroDataAuditoria || '')) {
      inputData.value = this.filtroDataAuditoria || '';
    }
    this.atualizarLabelFiltroData('gerencia-auditoria-filtro-data', 'gerencia-auditoria-filtro-data-label', 'Filtrar Log');
    const todosLogs = this.logsAuditoriaCache || [];
    const tipo = (this.filtroAuditoria || 'todos').toLowerCase();
    const opFiltro = (this.filtroOperadorAuditoria || 'todos').toLowerCase();

    let logsFiltrados = todosLogs;
    if (opFiltro !== 'todos') {
      logsFiltrados = logsFiltrados.filter(l => (l.operador || '').toLowerCase() === opFiltro);
    }
    if (this.filtroDataAuditoria) {
      logsFiltrados = logsFiltrados.filter(l => this.logBateDataFiltro(l, this.filtroDataAuditoria));
    }

    const logsCompletos = tipo === 'todos' 
      ? logsFiltrados 
      : logsFiltrados.filter(l => {
          const t = (l.tipo || '').toLowerCase();
          const desc = (l.descricao || '').toLowerCase();

          if (tipo === 'caixas' || tipo === 'fechamento_caixa') {
            return t === 'fechamento_caixa' || t === 'abertura_caixa' || t === 'sangria_caixa' || t === 'suprimento_caixa' || t.includes('caixa');
          }
          if (tipo === 'comandas') {
            return t === 'comandas' || desc.includes('mesa') || desc.includes('comanda');
          }
          if (tipo === 'estoque' || tipo === 'ajuste_estoque') {
            return t === 'ajuste_estoque' || t === 'cadastro_produto' || t === 'edicao_produto' || t === 'exclusao_produto' || t === 'importacao_planilha' || t === 'importacao_xml';
          }
          if (tipo === 'cortesia') {
            return t === 'cortesia';
          }
          if (tipo === 'sangria' || tipo === 'sangria_caixa') {
            return t === 'sangria_caixa' || t === 'sangria';
          }
          if (tipo === 'cancelamento' || tipo === 'cancelamento_venda') {
            return t === 'cancelamento_venda' || t === 'cancelamento';
          }
          if (tipo === 'clientes') {
            return t === 'cadastro_cliente' || t === 'edicao_cliente' || t === 'exclusao_cliente' || t === 'recebimento_fiado';
          }
          if (tipo === 'vendas' || tipo === 'operacao') {
            return t === 'cancelamento_venda' || t === 'cancelamento_item' || t === 'desconto_concedido' || t === 'cortesia';
          }
          if (tipo === 'fiscal') {
            return t === 'emissao_nfce' || t === 'configuracao_fiscal' || t === 'configuracao_tef';
          }
          return t === tipo;
        });

    const PAGE = 100;
    if (!this.auditoriaExibidos || this.auditoriaExibidos < PAGE) this.auditoriaExibidos = PAGE;
    const visiveis = logsCompletos.slice(0, this.auditoriaExibidos);
    const totalNuvem = (AuditModule && AuditModule.totalNuvem) || 0;
    const filtrandoData = Boolean(this.filtroDataAuditoria);
    const totalRef = filtrandoData
      ? logsCompletos.length
      : Math.max(totalNuvem, todosLogs.length, logsCompletos.length);
    const temMais = visiveis.length < logsCompletos.length || (!filtrandoData && Boolean(AuditModule && AuditModule.temMaisNuvem));

    const contadorEl = document.getElementById('gerencia-auditoria-contador');
    if (contadorEl) {
      const dica = temMais ? ' · role para ver os mais antigos' : '';
      contadorEl.innerHTML = `⚡ Últimas <strong>${visiveis.length}</strong> de <strong>${totalRef}</strong> registros${dica}`;
    }

    if (logsCompletos.length === 0) {
      const avisoNuvem = (!todosLogs.length && AuditModule.ultimoErroNuvem)
        ? `<div style="margin-top: 8px; font-size: 12px; color: #b45309;">${AuditModule.ultimoErroNuvem}</div>`
        : '';
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-dim);">Nenhum registro encontrado para este filtro.${avisoNuvem}</td></tr>`;
      return;
    }

    tbody.innerHTML = visiveis.map(l => {
      let badgeTipo = `<span style="background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">📌 ${(l.tipo || 'Evento').replace(/_/g, ' ')}</span>`;
      
      if (l.tipo === 'abertura_caixa') {
        badgeTipo = '<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🟢 Abertura Caixa</span>';
      } else if (l.tipo === 'fechamento_caixa') {
        badgeTipo = '<span style="background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">💰 Fech. Caixa</span>';
      } else if (l.tipo === 'sangria_caixa') {
        badgeTipo = '<span style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">💸 Sangria</span>';
      } else if (l.tipo === 'suprimento_caixa') {
        badgeTipo = '<span style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">💵 Suprimento</span>';
      } else if (l.tipo === 'emissao_nfce') {
        badgeTipo = '<span style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🏛️ NFC-e Emitida</span>';
      } else if (l.tipo === 'configuracao_fiscal') {
        badgeTipo = '<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">⚙️ Config Fiscal</span>';
      } else if (l.tipo === 'configuracao_tef') {
        badgeTipo = '<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">📟 Config TEF</span>';
      } else if (l.tipo === 'ajuste_estoque') {
        badgeTipo = '<span style="background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">📦 Ajuste Estoque</span>';
      } else if (l.tipo === 'cadastro_produto') {
        badgeTipo = '<span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">➕ Novo Produto</span>';
      } else if (l.tipo === 'edicao_produto') {
        badgeTipo = '<span style="background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">✏️ Edição Prod.</span>';
      } else if (l.tipo === 'exclusao_produto') {
        badgeTipo = '<span style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🗑️ Prod. Excluído</span>';
      } else if (l.tipo === 'importacao_planilha' || l.tipo === 'importacao_xml') {
        badgeTipo = '<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">📥 Importação</span>';
      } else if (l.tipo === 'cadastro_cliente') {
        badgeTipo = '<span style="background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">➕ Cliente Novo</span>';
      } else if (l.tipo === 'edicao_cliente') {
        badgeTipo = '<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">✏️ Edição Cliente</span>';
      } else if (l.tipo === 'exclusao_cliente') {
        badgeTipo = '<span style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🗑️ Cliente Excluído</span>';
      } else if (l.tipo === 'recebimento_fiado') {
        badgeTipo = '<span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">💰 Receb. Fiado</span>';
      } else if (l.tipo === 'cancelamento_item') {
        badgeTipo = '<span style="background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🛑 Item Cancelado</span>';
      } else if (l.tipo === 'desconto_concedido') {
        badgeTipo = '<span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🏷️ Desconto</span>';
      } else if (l.tipo === 'cortesia') {
        badgeTipo = '<span style="background: #ede9fe; color: #7c3aed; border: 1px solid #ddd6fe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🎁 Cortesia</span>';
      } else if (l.tipo === 'cancelamento_venda') {
        badgeTipo = '<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🛑 Cancelamento</span>';
      } else if (l.tipo === 'comandas') {
        badgeTipo = '<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🍽️ Mesas/Cmd</span>';
      }

      const temDetalhes = l.detalhes && Object.keys(l.detalhes).length > 0;

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono'; font-size: 12px; color: var(--text-muted); white-space: nowrap;">${l.dataHoraFormatada || '--'}</td>
          <td style="white-space: nowrap; width: 140px;">${badgeTipo}</td>
          <td><strong style="color: var(--text-main); font-size: 13.5px;">${l.descricao}</strong></td>
          <td><span style="font-weight: 600; font-size: 12.5px; color: var(--text-main);">${l.operador || 'Caixa'}</span></td>
          <td><span style="font-family: 'JetBrains Mono'; font-size: 11.5px; color: var(--text-dim);">${l.hostname || l.terminalId || '-'}</span></td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              ${temDetalhes ? `
                <button type="button" class="btn-action-sm" onclick="GerenciaModule.verDetalhesAuditoria('${l.id}')" title="Ver detalhes completos">Detalhes</button>
              ` : ''}
              <button type="button" class="btn-action-sm danger" onclick="GerenciaModule.excluirLogAuditoria('${l.id}')" title="Excluir este registro">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async carregarMaisAuditoria() {
    const filtradosLen = (this.logsAuditoriaCache || []).length;
    if (this.auditoriaExibidos < filtradosLen) {
      this.auditoriaExibidos += 100;
      this.renderAuditoriaFiltrada();
      return;
    }
    if (!AuditModule || !AuditModule.temMaisNuvem || !AuditModule.ultimoCursorSub) return;
    if (this.auditoriaCarregandoMais) return;
    this.auditoriaCarregandoMais = true;
    try {
      const novos = await AuditModule.buscarLogsAuditoria(100, { cursor: AuditModule.ultimoCursorSub });
      const ids = new Set((this.logsAuditoriaCache || []).map(l => l.id));
      (novos || []).forEach(l => {
        if (l && l.id && !ids.has(l.id)) {
          this.logsAuditoriaCache.push(l);
          ids.add(l.id);
        }
      });
      this.logsAuditoriaCache.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
      this.auditoriaExibidos += 100;
      this.renderAuditoriaFiltrada();
    } catch (e) {
      console.warn('[GerenciaModule] Falha ao carregar mais logs:', e);
    } finally {
      this.auditoriaCarregandoMais = false;
    }
  },

  pedirExclusaoLogsPeriodo() {
    const select = document.getElementById('gerencia-auditoria-excluir-periodo');
    const valor = select ? String(select.value || '').trim() : '';
    if (!valor) {
      if (window.App) window.App.showToast('Escolha o período que deseja excluir.', 'warning');
      return;
    }

    const rotulos = {
      '7': 'os últimos 7 dias',
      '15': 'os últimos 15 dias',
      '30': 'os últimos 30 dias',
      '60': 'os últimos 60 dias',
      '90': 'os últimos 90 dias',
      'all': 'TODOS os logs'
    };
    const label = rotulos[valor] || valor;
    const dias = valor === 'all' ? 0 : parseInt(valor, 10);

    const modal = document.getElementById('modal-confirmacao-custom');
    const icone = document.getElementById('modal-confirm-icone');
    const titulo = document.getElementById('modal-confirm-titulo');
    const msg = document.getElementById('modal-confirm-mensagem');
    const btnAcao = document.getElementById('modal-confirm-btn-acao');

    if (icone) icone.textContent = '🗑️';
    if (titulo) titulo.textContent = 'Excluir logs de auditoria';
    if (msg) msg.textContent = `Isso apaga ${label} do histórico (neste computador e na nuvem). Não dá para desfazer.`;
    if (btnAcao) {
      btnAcao.textContent = '🗑️ Sim, excluir';
      btnAcao.onclick = () => {
        GerenciaModule.confirmarExclusaoLogsPeriodo(dias);
      };
    }
    if (modal) modal.style.display = 'flex';
  },

  async confirmarExclusaoLogsPeriodo(dias) {
    const modal = document.getElementById('modal-confirmacao-custom');
    if (modal) modal.style.display = 'none';

    if (window.App) window.App.showToast('🗑️ Excluindo logs do período...', 'info');
    try {
      const res = await AuditModule.excluirLogsPorPeriodo(dias);
      this.auditoriaExibidos = 100;
      this.preencherSelectOperadoresAuditoria();
      this.renderAuditoriaFiltrada();
      const sel = document.getElementById('gerencia-auditoria-excluir-periodo');
      if (sel) sel.value = '';

      if (res.falhas && !res.nuvem && !res.local) {
        if (window.App) window.App.showToast(res.erro || 'Não foi possível excluir os logs agora.', 'error');
        await this.renderAuditoriaAjustes();
        return;
      }

      const total = Math.max(res.nuvem || 0, res.local || 0);
      const extra = res.falhas ? ` (${res.falhas} não saíram da nuvem)` : '';
      if (window.App) window.App.showToast(`🗑️ ${total} registro(s) excluído(s).${extra}`, res.falhas ? 'warning' : 'success');
    } catch (e) {
      console.warn('[GerenciaModule] Exclusão por período falhou:', e);
      if (window.App) window.App.showToast('Não foi possível excluir os logs agora.', 'error');
    }
  },

  verDetalhesAuditoria(logId) {
    const log = (this.logsAuditoriaCache || []).find(item => item.id === logId);
    if (!log) return;

    const modal = document.getElementById('modal-detalhes-auditoria');
    const body = document.getElementById('modal-auditoria-body');
    const title = document.getElementById('modal-auditoria-title');

    if (title) title.textContent = '🛡️ Detalhes da Auditoria';

    let badgeTipo = `<span style="background: #f1f5f9; color: #475569; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">📌 ${(log.tipo || 'Evento').replace(/_/g, ' ')}</span>`;
    if (log.tipo === 'abertura_caixa') {
      badgeTipo = '<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🟢 Abertura de Caixa</span>';
    } else if (log.tipo === 'fechamento_caixa') {
      badgeTipo = '<span style="background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">💰 Fechamento de Caixa</span>';
    } else if (log.tipo === 'sangria_caixa') {
      badgeTipo = '<span style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">💸 Sangria de Caixa</span>';
    } else if (log.tipo === 'emissao_nfce') {
      badgeTipo = '<span style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🏛️ Emissão de NFC-e</span>';
    } else if (log.tipo === 'configuracao_fiscal' || log.tipo === 'configuracao_tef') {
      badgeTipo = '<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">⚙️ Configuração</span>';
    } else if (log.tipo === 'ajuste_estoque') {
      badgeTipo = '<span style="background: #fef3c7; color: #d97706; border: 1px solid #fde68a; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">📦 Ajuste de Estoque</span>';
    } else if (log.tipo === 'cortesia') {
      badgeTipo = '<span style="background: #ede9fe; color: #7c3aed; border: 1px solid #ddd6fe; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🎁 Cortesia</span>';
    } else if (log.tipo === 'cancelamento_venda') {
      badgeTipo = '<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🛑 Cancelamento</span>';
    } else if (log.tipo === 'comandas') {
      badgeTipo = '<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 800;">🍽️ Mesas & Comandas</span>';
    }

    const formatarMoedaLocal = (v) => {
      const num = parseFloat(v);
      if (isNaN(num)) return v;
      return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    let cardEspecialHtml = '';

    if (log.tipo === 'fechamento_caixa' && log.detalhes && (log.detalhes.saldoEsperado !== undefined || log.detalhes.saldoInformado !== undefined)) {
      const esp = parseFloat(log.detalhes.saldoEsperado) || 0;
      const inf = parseFloat(log.detalhes.saldoInformado) || 0;
      const dif = parseFloat(log.detalhes.diferenca) || (inf - esp);
      const isFalta = dif < -0.01;
      const isSobra = dif > 0.01;
      const turnoIdAlvo = log.detalhes.turnoId || '';

      cardEspecialHtml = `
        <div style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 8px; padding: 12px; margin-bottom: 12px; box-shadow: var(--shadow-sm);">
          <strong style="font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Conferência de Fechamento de Caixa</strong>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 4px;">
              <span style="font-size: 10.5px; color: var(--text-dim); display: block;">Esperado</span>
              <strong style="font-size: 13.5px; font-family: 'JetBrains Mono'; color: #0284c7;">${formatarMoedaLocal(esp)}</strong>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 4px;">
              <span style="font-size: 10.5px; color: var(--text-dim); display: block;">Informado</span>
              <strong style="font-size: 13.5px; font-family: 'JetBrains Mono'; color: var(--text-main);">${formatarMoedaLocal(inf)}</strong>
            </div>
            <div style="background: ${isFalta ? '#fef2f2' : (isSobra ? '#f0fdf4' : '#f8fafc')}; border: 1px solid ${isFalta ? '#fecaca' : (isSobra ? '#bbf7d0' : '#cbd5e1')}; border-radius: 6px; padding: 8px 4px;">
              <span style="font-size: 10.5px; color: ${isFalta ? '#dc2626' : (isSobra ? '#16a34a' : 'var(--text-dim)')}; display: block;">${isFalta ? 'Falta' : (isSobra ? 'Sobra' : 'Diferença')}</span>
              <strong style="font-size: 13.5px; font-family: 'JetBrains Mono'; color: ${isFalta ? '#dc2626' : (isSobra ? '#16a34a' : '#059669')};">
                ${dif > 0 ? '+' : ''}${formatarMoedaLocal(dif)}
              </strong>
            </div>
          </div>
          <div style="margin-top: 10px;">
            <button type="button" class="btn-primary-action" style="width: 100%; justify-content: center; height: 38px; font-size: 12.5px; font-weight: 800; background: #0284c7; color: #ffffff;" onclick="GerenciaModule.reimprimirFechamentoAuditoria('${turnoIdAlvo}')">
              🖨️ Re-imprimir Fechamento de Caixa (Térmica)
            </button>
          </div>
        </div>
      `;
    }

    const mapaLabelsChaves = {
      turnoId: 'ID do Turno',
      numeroNfce: 'Número NFC-e',
      serieNfce: 'Série NFC-e',
      chaveAcesso: 'Chave de Acesso',
      chaveNfe: 'Chave de Acesso',
      chaveNFe: 'Chave de Acesso',
      protocolo: 'Protocolo',
      idDaVenda: 'ID da Venda',
      vendaId: 'ID da Venda',
      qtdVendas: 'Qtd de Vendas',
      totalVendas: 'Total em Vendas',
      saldoEsperado: 'Saldo Esperado',
      saldoInformado: 'Saldo Informado',
      diferenca: 'Diferença',
      valorOriginal: 'Valor Original',
      totalAnterior: 'Total Anterior',
      comanda: 'Mesa / Comanda',
      motivo: 'Motivo',
      operador: 'Operador'
    };

    let detalhesFormatados = '';
    if (log.detalhes && Object.keys(log.detalhes).length > 0) {
      const camposMonetarios = ['valorOriginal', 'valor', 'total', 'saldoInformado', 'saldoEsperado', 'diferenca', 'totalVendas', 'precoUnitario', 'totalAnterior', 'totalConsumo', 'taxaServicoValor', 'subtotal'];

      const itensHtml = Object.entries(log.detalhes).map(([chave, valor]) => {
        // Se for cortesia e a chave for motivo, já está em destaque no card principal
        if (log.tipo === 'cortesia' && chave.toLowerCase() === 'motivo') return '';

        // Se for a lista de itens/produtos
        if ((chave === 'itens' || chave === 'produtos') && Array.isArray(valor)) {
          return `
            <div style="padding: 10px 0; border-bottom: 1px dashed #e2e8f0;">
              <span style="color: var(--text-muted); font-weight: 800; font-size: 11.5px; text-transform: uppercase; display: block; margin-bottom: 6px;">📦 Itens da Movimentação:</span>
              <div style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px;">
                ${valor.map(it => {
                  const qtd = it.quantidade || 1;
                  const preco = parseFloat(it.precoUnitario) || 0;
                  const totalItem = preco * qtd;
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                      <span style="font-weight: 700; color: var(--text-main);">${qtd}x ${it.nome || 'Item'}</span>
                      <span style="font-family: 'JetBrains Mono'; font-weight: 800; color: #059669;">${formatarMoedaLocal(totalItem)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        let valFormatado = valor;
        const chaveLower = chave.toLowerCase();
        const isChaveAcesso = chaveLower.includes('chave');
        const isCampoMonetario = !isChaveAcesso && (camposMonetarios.includes(chave) ||
                               chaveLower.includes('total') ||
                               chaveLower.includes('valor') ||
                               chaveLower.includes('saldo') ||
                               chaveLower.includes('preco') ||
                               chaveLower.includes('diferenca'));

        if (isChaveAcesso && valor != null) {
          const digits = String(valor).replace(/\s/g, '');
          valFormatado = /^\d{44}$/.test(digits)
            ? digits.replace(/(.{4})/g, '$1 ').trim()
            : String(valor);
        } else if (typeof valor === 'number') {
          if (isCampoMonetario) {
            valFormatado = formatarMoedaLocal(valor);
          } else {
            valFormatado = Number.isInteger(valor) ? valor : Number(valor.toFixed(2));
          }
        } else if (typeof valor === 'string' && isCampoMonetario && !isNaN(parseFloat(valor))) {
          valFormatado = formatarMoedaLocal(parseFloat(valor));
        } else if (typeof valor === 'object' && valor !== null) {
          valFormatado = JSON.stringify(valor, null, 2);
        }

        const labelExibicao = mapaLabelsChaves[chave] || chave.replace(/([A-Z])/g, ' $1');
        const textoValor = String(valFormatado ?? '');
        const valorLongo = isChaveAcesso || textoValor.length > 28 || chaveLower.includes('id');

        if (valorLongo) {
          return `
            <div style="padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12.5px;">
              <span style="color: var(--text-muted); font-weight: 700; text-transform: capitalize; display: block; margin-bottom: 4px;">${labelExibicao}:</span>
              <span style="color: var(--text-main); font-weight: 700; font-family: 'JetBrains Mono'; font-size: 11.5px; line-height: 1.45; display: block; overflow-wrap: anywhere; word-break: break-word;">${textoValor}</span>
            </div>
          `;
        }

        return `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12.5px;">
            <span style="color: var(--text-muted); font-weight: 700; text-transform: capitalize; flex-shrink: 0;">${labelExibicao}:</span>
            <span style="color: var(--text-main); font-weight: 700; font-family: 'JetBrains Mono'; text-align: right; min-width: 0; flex: 1; overflow-wrap: anywhere; word-break: break-word;">${textoValor}</span>
          </div>
        `;
      }).filter(Boolean).join('');

      detalhesFormatados = `
        <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: 8px; padding: 12px 16px; margin-top: 10px; overflow: hidden;">
          <strong style="font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Dados Complementares</strong>
          ${itensHtml}
        </div>
      `;
    }

    let tituloDescricao = 'Descrição do Evento';
    let textoDescricao = (log.descricao || '-').replace(/R\$\s*([0-9]+)\.([0-9]{2})/g, 'R$ $1,$2');

    if (log.tipo === 'cortesia') {
      tituloDescricao = 'Motivo da Cortesia';
      textoDescricao = log.detalhes?.motivo || log.descricao;
    } else if (log.tipo === 'sangria_caixa') {
      tituloDescricao = 'Motivo da Sangria';
      textoDescricao = log.detalhes?.motivo || log.descricao;
    } else if (log.tipo === 'cancelamento_venda') {
      tituloDescricao = 'Motivo do Cancelamento';
      textoDescricao = log.detalhes?.motivo || log.descricao;
    }

    if (body) {
      body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          ${badgeTipo}
          <span style="font-family: 'JetBrains Mono'; font-size: 12px; color: var(--text-muted);">📅 ${log.dataHoraFormatada || '--'}</span>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-card); border-radius: 8px; padding: 14px; margin-bottom: 12px; box-shadow: var(--shadow-sm);">
          <strong style="font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">${tituloDescricao}</strong>
          <p style="font-size: 14.5px; font-weight: 800; color: ${log.tipo === 'cortesia' ? '#7c3aed' : 'var(--text-main)'}; margin: 0; line-height: 1.4; overflow-wrap: anywhere; word-break: break-word;">${textoDescricao}</p>
        </div>

        ${cardEspecialHtml}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: 8px; padding: 10px 12px;">
            <span style="font-size: 11px; color: var(--text-dim); display: block;">👤 Operador Responsável</span>
            <strong style="font-size: 13px; color: var(--text-main);">${log.operador || 'Caixa'}</strong>
          </div>
          <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: 8px; padding: 10px 12px;">
            <span style="font-size: 11px; color: var(--text-dim); display: block;">🖥️ Terminal / Host</span>
            <strong style="font-size: 12.5px; font-family: 'JetBrains Mono'; color: var(--text-main);">${log.hostname || log.terminalId || 'Local'}</strong>
          </div>
        </div>

        ${detalhesFormatados}
      `;
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalDetalhesAuditoria() {
    const modal = document.getElementById('modal-detalhes-auditoria');
    if (modal) modal.classList.remove('active');
  },

  reimprimirFechamentoAuditoria(turnoId) {
    const turnos = StorageService.getHistoricoTurnos();
    const turno = (turnoId ? turnos.find(t => t.id === turnoId) : null) || turnos[0] || StorageService.getTurnoAtual();
    if (turno && window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirFechamentoCaixa === 'function') {
      window.ThermalPrintModule.imprimirFechamentoCaixa(turno);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🖨️ Fechamento de Caixa enviado para impressão térmica!', 'info');
      }
    } else {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Turno não localizado para re-impressão.', 'warning');
      }
    }
  },

  logExcluindoId: null,

  excluirLogAuditoria(logId) {
    this.logExcluindoId = logId;
    const modal = document.getElementById('modal-confirmacao-custom');
    const icone = document.getElementById('modal-confirm-icone');
    const titulo = document.getElementById('modal-confirm-titulo');
    const msg = document.getElementById('modal-confirm-mensagem');
    const btnAcao = document.getElementById('modal-confirm-btn-acao');

    if (icone) icone.textContent = '🗑️';
    if (titulo) titulo.textContent = 'Excluir Log de Auditoria';
    if (msg) msg.textContent = 'Tem certeza que deseja excluir este registro de auditoria do histórico? Esta ação não poderá ser desfeita.';
    
    if (btnAcao) {
      btnAcao.textContent = '🗑️ Sim, Excluir';
      btnAcao.onclick = () => {
        GerenciaModule.confirmarExclusaoLogExecutar();
      };
    }

    if (modal) modal.style.display = 'flex';
  },

  async confirmarExclusaoLogExecutar() {
    const logId = this.logExcluindoId;
    const modal = document.getElementById('modal-confirmacao-custom');
    if (modal) modal.style.display = 'none';
    if (!logId) return;

    if (window.AuditModule && typeof window.AuditModule.removerLogLocal === 'function') {
      window.AuditModule.removerLogLocal(logId);
    }
    this.logsAuditoriaCache = (this.logsAuditoriaCache || []).filter(l => l.id !== logId);
    this.renderAuditoriaFiltrada();
    this.logExcluindoId = null;

    if (window.AuditModule && typeof window.AuditModule.excluirLogNuvem === 'function') {
      try {
        const res = await window.AuditModule.excluirLogNuvem(logId);
        if (res && res.falhas) {
          if (window.App) window.App.showToast(res.erro || 'O log saiu desta tela, mas a nuvem recusou apagar.', 'warning');
          return;
        }
      } catch (e) {
        console.warn('[GerenciaModule] Falha ao excluir log na nuvem:', e);
      }
    }
    if (window.App) window.App.showToast('🗑️ Registro de auditoria removido.', 'info');
  },

  // Modal de Ajuste Manual de Estoque (Quebra, Perda, Avaria, Inventário)
  abrirModalAjusteEstoque(produtoId = null) {
    const modal = document.getElementById('modal-ajuste-estoque');
    const selectProd = document.getElementById('ajuste-produto-select');
    const produtos = StorageService.getProdutos() || [];

    if (selectProd) {
      selectProd.innerHTML = `<option value="">-- Selecione o Produto --</option>` +
        produtos.map(p => `<option value="${p.id}" ${p.id === produtoId ? 'selected' : ''}>${p.nome} (Estoque Atual: ${p.estoque || 0})</option>`).join('');
    }

    this.atualizarInfoProdutoAjuste();
    if (modal) modal.classList.add('active');
  },

  fecharModalAjusteEstoque() {
    const modal = document.getElementById('modal-ajuste-estoque');
    if (modal) modal.classList.remove('active');
  },

  atualizarInfoProdutoAjuste() {
    const selectProd = document.getElementById('ajuste-produto-select');
    const infoBox = document.getElementById('ajuste-produto-info-box');
    const inputQtd = document.getElementById('ajuste-quantidade-input');
    const id = selectProd ? selectProd.value : null;

    if (!id) {
      if (infoBox) infoBox.innerHTML = '<span style="color: var(--text-dim);">Selecione um produto para visualizar o saldo atual.</span>';
      return;
    }

    const produtos = StorageService.getProdutos() || [];
    const p = produtos.find(item => item.id === id);
    if (!p) return;

    const estAtual = parseFloat(p.estoque) || 0;
    if (infoBox) {
      infoBox.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Estoque Atual no Sistema:</span>
          <strong style="font-size: 16px; font-family: 'JetBrains Mono'; color: #0284c7;">${estAtual} ${p.unidade || 'un'}</strong>
        </div>
      `;
    }
  },

  salvarAjusteEstoque(e) {
    e.preventDefault();
    const selectProd = document.getElementById('ajuste-produto-select');
    const prodId = selectProd ? selectProd.value : null;
    const tipoAjuste = document.getElementById('ajuste-tipo-motivo')?.value || 'Quebra / Avaria';
    const tipoOperacao = document.getElementById('ajuste-tipo-operacao')?.value || 'subtrair'; // 'subtrair', 'adicionar', 'definir'
    const qtd = parseFloat(document.getElementById('ajuste-quantidade-input')?.value) || 0;
    const motivo = document.getElementById('ajuste-motivo-texto')?.value.trim() || '';

    if (!prodId) {
      window.App.showToast('Selecione o produto a ser ajustado!', 'warning');
      return;
    }

    if (qtd <= 0) {
      window.App.showToast('Informe uma quantidade válida maior que zero!', 'warning');
      return;
    }

    let produtos = StorageService.getProdutos() || [];
    const index = produtos.findIndex(p => p.id === prodId);
    if (index === -1) return;

    const p = produtos[index];
    const estoqueAnterior = parseFloat(p.estoque) || 0;
    let novoEstoque = estoqueAnterior;

    if (tipoOperacao === 'subtrair') {
      novoEstoque = Math.max(0, estoqueAnterior - qtd);
    } else if (tipoOperacao === 'adicionar') {
      novoEstoque = estoqueAnterior + qtd;
    } else if (tipoOperacao === 'definir') {
      novoEstoque = qtd;
    }

    produtos[index].estoque = novoEstoque;
    produtos[index].atualizadoEm = new Date().toISOString();
    StorageService.saveProdutos(produtos);
    StorageService.registrarMovimentoEstoque({
      produtoId: p.id,
      delta: novoEstoque - estoqueAnterior,
      origem: 'ajuste_gerencia',
      refId: tipoOperacao
    });

    // Registrar evento oficial na auditoria
    AuditModule.registrarLog('ajuste_estoque', `Ajuste manual de estoque no item "${p.nome}": ${estoqueAnterior} ➔ ${novoEstoque} (${tipoAjuste})`, {
      produtoId: p.id,
      produtoNome: p.nome,
      estoqueAnterior,
      novoEstoque,
      diferenca: novoEstoque - estoqueAnterior,
      tipoAjuste,
      tipoOperacao,
      motivo
    });

    if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('ajuste_estoque');
    if (window.EstoqueModule) window.EstoqueModule.renderTabelaProdutos();

    this.fecharModalAjusteEstoque();
    this.renderAuditoriaAjustes();
    window.App.showToast(`✅ Estoque de "${p.nome}" ajustado para ${novoEstoque} un!`, 'success');
  },

  // =========================================================================
  // 5. GESTÃO DE USUÁRIOS (MIGRADO DA CONFIGURAÇÃO)
  // =========================================================================
  renderGestaoUsuarios() {
    if (window.AuthModule && typeof window.AuthModule.renderTabelaOperadoresConfig === 'function') {
      window.AuthModule.renderTabelaOperadoresConfig();
    }
  },

  // =========================================================================
  // 6. HISTÓRICO DE TURNOS DE CAIXA FECHADOS
  // =========================================================================
  renderHistoricoCaixas() {
    const tbody = document.getElementById('gerencia-historico-turnos-tbody');
    const footerCount = document.getElementById('gerencia-historico-turnos-contador');
    const badgeQtd = document.getElementById('gerencia-badge-historico-qtd');
    const inputData = document.getElementById('gerencia-historico-filtro-data');
    if (inputData && inputData.value !== (this.filtroDataHistorico || '')) {
      inputData.value = this.filtroDataHistorico || '';
    }
    this.atualizarLabelFiltroData('gerencia-historico-filtro-data', 'gerencia-historico-filtro-data-label', 'Filtrar Caixa');
    const todosTurnos = StorageService.getHistoricoTurnos() || [];
    const ymd = this.filtroDataHistorico || '';
    const turnos = ymd
      ? todosTurnos.filter((t) => {
          const ab = t.dataAbertura ? this.ymdLocal(new Date(t.dataAbertura).getTime()) : '';
          const fc = t.dataFechamento ? this.ymdLocal(new Date(t.dataFechamento).getTime()) : '';
          return ab === ymd || fc === ymd;
        })
      : todosTurnos;

    if (badgeQtd) {
      badgeQtd.textContent = ymd
        ? `${turnos.length} de ${todosTurnos.length} ${todosTurnos.length === 1 ? 'turno' : 'turnos'}`
        : `${turnos.length} ${turnos.length === 1 ? 'turno' : 'turnos'}`;
    }
    if (footerCount) {
      footerCount.textContent = ymd
        ? `📊 ${turnos.length} turno(s) em ${ymd.split('-').reverse().join('/')}`
        : `📊 Total: ${turnos.length} turnos arquivados`;
    }

    if (!tbody) return;

    if (turnos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-dim);">${ymd ? 'Nenhum turno nesta data.' : 'Nenhum turno de caixa finalizado no histórico ainda.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = turnos.map(t => {
      const dataAberturaFmt = t.dataAbertura ? new Date(t.dataAbertura).toLocaleString('pt-BR') : '--';
      const dataFechamentoFmt = t.dataFechamento ? new Date(t.dataFechamento).toLocaleString('pt-BR') : '--';
      const totalVendas = parseFloat(t.totalVendasGeral || t.totalVendas || 0);
      const saldoEsperado = parseFloat(t.saldoEsperado || t.dinheiroGaveta || 0);
      const diferenca = parseFloat(t.diferenca || 0);

      let badgeDif = '';
      if (t.fechamentoCego) {
        if (Math.abs(diferenca) < 0.01) {
          badgeDif = '<span style="background: #dcfce7; color: #16a34a; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 800;">✅ Bateu</span>';
        } else if (diferenca > 0) {
          badgeDif = `<span style="background: #dbeafe; color: #1e40af; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 800;">🟢 Sobra +R$ ${diferenca.toFixed(2).replace('.', ',')}</span>`;
        } else {
          badgeDif = `<span style="background: #fee2e2; color: #dc2626; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 800;">🔴 Quebra -R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')}</span>`;
        }
      }

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono'; font-weight: 800; color: var(--text-muted);">#${StorageService.formatarNumeroTurno(t.id)}</td>
          <td style="font-size: 12px; line-height: 1.4;">
            <div>🟢 ${dataAberturaFmt}</div>
            <div style="color: var(--text-dim);">🔴 ${dataFechamentoFmt}</div>
          </td>
          <td><strong style="color: var(--text-main); font-size: 13.5px;">${t.operador || 'Caixa'}</strong></td>
          <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 600;">R$ ${StorageService.formatarMoeda(t.trocoInicial || 0)}</td>
          <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 800; color: #0284c7;">R$ ${StorageService.formatarMoeda(totalVendas)}</td>
          <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 800; color: #059669;">
            R$ ${StorageService.formatarMoeda(saldoEsperado)}
            <div style="margin-top: 2px;">${badgeDif}</div>
          </td>
          <td style="text-align: center;"><span class="badge-stock ok">Fechado</span></td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button type="button" class="btn-action-sm" onclick="CaixaModule.verDetalhesTurno('${t.id}')" title="Visualizar conferência e detalhes completos do turno">🔍 Detalhes</button>
              <button type="button" class="btn-action-sm" onclick="CaixaModule.imprimirComprovanteTurnoFechado('${t.id}')" title="Reimprimir Cupom de Fechamento">🧾 Cupom</button>
              <button type="button" class="btn-action-sm" onclick="CaixaModule.exportarTurnoFechadoExcel('${t.id}')" title="Exportar este turno para Excel (.xlsx)">📊 Excel</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderHistoricoGeral() {
    this.renderHistoricoCaixas();
  }
};
