/**
 * comandas.js - Módulo de Gestão de Comandas e Mesas
 * Layout Limpo, Divisão de Conta em Tempo Real, Busca Inteligente e Atalho F4/F12.
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { ThermalPrintModule } from './thermal-print.js';
import { AuditModule } from './audit.js';

export const ComandasModule = {
  comandaAtivaId: null,
  abaFiltro: 'todas', // 'todas', 'mesas', 'comandas', 'ocupadas'
  filtroTexto: '',
  produtoSelecionadoId: null,
  numPessoasDivisao: 1,
  sugestoesAtuais: [],
  sugestaoSelecionadaIdx: -1,

  init() {
    this.garantirInicializacaoStorage();
    this.adaptarModoAtendimento();
    this.bindEventosGlobais();
  },

  bindEventosGlobais() {
    // Fechar dropdown de sugestões ao clicar fora
    document.addEventListener('click', (e) => {
      const box = document.getElementById('comanda-sugestoes-box');
      const input = document.getElementById('comanda-busca-produto-input');
      if (box && input && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
      }
    });
  },

  garantirInicializacaoStorage() {
    const existentes = StorageService.getComandas ? StorageService.getComandas() : null;
    if (!existentes || existentes.length === 0) {
      const listaPadrao = [];
      // 15 Mesas padrão
      for (let i = 1; i <= 15; i++) {
        listaPadrao.push({
          id: 'MESA-' + i,
          tipo: 'mesa',
          numero: i,
          nome: `Mesa ${String(i).padStart(2, '0')}`,
          cliente: '',
          status: 'livre',
          itens: [],
          taxaServico: false,
          total: 0,
          abertaEm: null,
          operador: ''
        });
      }
      // 20 Comandas padrão
      for (let i = 1; i <= 20; i++) {
        listaPadrao.push({
          id: 'CMD-' + i,
          tipo: 'comanda',
          numero: i,
          nome: `Comanda #${String(i).padStart(2, '0')}`,
          cliente: '',
          status: 'livre',
          itens: [],
          taxaServico: false,
          total: 0,
          abertaEm: null,
          operador: ''
        });
      }
      this.salvarComandas(listaPadrao);
    }
  },

  getComandas() {
    const raw = localStorage.getItem('flowpdv_comandas_mesas');
    if (!raw) {
      this.garantirInicializacaoStorage();
      return JSON.parse(localStorage.getItem('flowpdv_comandas_mesas') || '[]');
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  },

  salvarComandas(lista) {
    StorageService.saveComandas(Array.isArray(lista) ? lista : []);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('comandas');
    }
  },

  getModoAtendimento() {
    const lic = StorageService.getLicenca() || {};
    const modulos = StorageService.getModulosLicenca() || {};
    return lic.moduloComandas || modulos.moduloComandas || 'mesas_e_comandas';
  },

  setModoAtendimento(modo) {
    const lic = StorageService.getLicenca() || {};
    const modulos = StorageService.getModulosLicenca() || {};
    lic.moduloComandas = modo;
    modulos.moduloComandas = modo;
    StorageService.saveLicenca(lic);
    StorageService.setModulosLicenca(modulos);
    this.adaptarModoAtendimento();
  },

  adaptarModoAtendimento() {
    const modo = this.getModoAtendimento();
    const header = document.querySelector('.app-header');
    const navBtn = document.getElementById('nav-btn-comandas');
    const navLabel = document.getElementById('nav-comandas-label');
    const tituloEl = document.getElementById('comandas-header-titulo');
    const iconeEl = document.getElementById('comandas-header-icone');
    const btnMesas = document.getElementById('btn-filtro-tab-mesas');
    const btnComandas = document.getElementById('btn-filtro-tab-comandas');

    if (modo === 'desativado') {
      if (header) header.classList.remove('header-comandas-compact');
      if (navBtn) navBtn.style.display = 'none';
      if (window.App && window.App.abaAtiva === 'comandas') {
        window.App.trocarAba('pdv');
      }
      return;
    }

    if (header) header.classList.add('header-comandas-compact');
    if (navBtn) navBtn.style.display = 'flex';

    if (modo === 'apenas_mesas') {
      if (navLabel) navLabel.textContent = '🪑 Mesas';
      if (tituloEl) tituloEl.textContent = 'Gestão de Mesas';
      if (iconeEl) iconeEl.textContent = '🪑';
      if (btnMesas) btnMesas.style.display = 'inline-block';
      if (btnComandas) btnComandas.style.display = 'none';
      if (this.abaFiltro === 'comandas') this.abaFiltro = 'mesas';
    } else if (modo === 'apenas_comandas') {
      if (navLabel) navLabel.textContent = '🏷️ Comandas';
      if (tituloEl) tituloEl.textContent = 'Gestão de Comandas';
      if (iconeEl) iconeEl.textContent = '🏷️';
      if (btnMesas) btnMesas.style.display = 'none';
      if (btnComandas) btnComandas.style.display = 'inline-block';
      if (this.abaFiltro === 'mesas') this.abaFiltro = 'comandas';
    } else {
      // mesas_e_comandas
      if (navLabel) navLabel.textContent = '🍽️ Comandas & Mesas';
      if (tituloEl) tituloEl.textContent = 'Gestão de Comandas & Mesas';
      if (iconeEl) iconeEl.textContent = '🍽️';
      if (btnMesas) btnMesas.style.display = 'inline-block';
      if (btnComandas) btnComandas.style.display = 'inline-block';
    }
  },

  abrirAba() {
    this.adaptarModoAtendimento();
    this.renderGridComandas();
    this.renderPainelDetalhes();
  },

  filtrarAba(aba) {
    this.abaFiltro = aba;
    document.querySelectorAll('.comanda-filtro-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filtro === aba);
    });
    this.renderGridComandas();
  },

  filtrarBuscaMesa(termo) {
    this.filtroTexto = (termo || '').toLowerCase().trim();
    this.renderGridComandas();
  },

  getComandasDoModo() {
    const todas = this.getComandas();
    const modo = this.getModoAtendimento();
    if (modo === 'apenas_mesas') {
      return todas.filter(c => c.tipo === 'mesa');
    }
    if (modo === 'apenas_comandas') {
      return todas.filter(c => c.tipo === 'comanda');
    }
    return todas;
  },

  renderGridComandas() {
    const grid = document.getElementById('comandas-grid-container');
    if (!grid) return;

    const comandas = this.getComandasDoModo();
    const filtro = this.abaFiltro;
    const busca = this.filtroTexto;

    let filtradas = comandas.filter(c => {
      if (filtro === 'mesas') return c.tipo === 'mesa';
      if (filtro === 'comandas') return c.tipo === 'comanda';
      if (filtro === 'ocupadas') return c.status !== 'livre';
      return true;
    });

    if (busca) {
      filtradas = filtradas.filter(c => 
        (c.nome || '').toLowerCase().includes(busca) ||
        (c.cliente || '').toLowerCase().includes(busca) ||
        String(c.numero || '').includes(busca)
      );
    }

    // Atualizar Contadores e Totais dos Cards de Resumo (Padrão Gerência)
    const totalLivres = comandas.filter(c => c.status === 'livre').length;
    const totalOcupadas = comandas.filter(c => c.status === 'ocupada').length;
    const totalFechando = comandas.filter(c => c.status === 'fechando').length;
    const totalConsumoGeral = comandas.reduce((acc, c) => acc + (parseFloat(c.total) || 0), 0);

    const kpiLivres = document.getElementById('comandas-kpi-livres');
    const kpiOcupadas = document.getElementById('comandas-kpi-ocupadas');
    const kpiFechando = document.getElementById('comandas-kpi-fechando');
    const kpiTotal = document.getElementById('comandas-kpi-total');

    if (kpiLivres) kpiLivres.textContent = `${totalLivres} Livres`;
    if (kpiOcupadas) kpiOcupadas.textContent = `${totalOcupadas} Ocupadas`;
    if (kpiFechando) kpiFechando.textContent = `${totalFechando} Conferindo`;
    if (kpiTotal) kpiTotal.textContent = `R$ ${totalConsumoGeral.toFixed(2).replace('.', ',')}`;

    if (filtradas.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🔍</span>
          <strong style="font-size: 14px; color: var(--text-main);">Nenhuma mesa ou comanda encontrada</strong>
          <p style="font-size: 12px; margin-top: 4px;">Tente alterar os filtros ou o termo pesquisado.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtradas.map(c => {
      const isOcupada = c.status === 'ocupada';
      const isFechando = c.status === 'fechando';
      const isLivre = c.status === 'livre';
      const isSelected = this.comandaAtivaId === c.id;

      let borderCor = '#e2e8f0';
      let bgCor = '#ffffff';
      let statusDot = '<span style="font-size: 9.5px; font-weight: 800; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px;">LIVRE</span>';

      // Calcular tempo aberta
      let tempoAbertaStr = 'Disponível';
      if (c.abertaEm && !isLivre) {
        const diffMs = Date.now() - new Date(c.abertaEm).getTime();
        const diffMin = Math.max(1, Math.floor(diffMs / 60000));
        if (diffMin < 60) {
          tempoAbertaStr = `⏱️ ${diffMin}m`;
        } else {
          const h = Math.floor(diffMin / 60);
          const m = diffMin % 60;
          tempoAbertaStr = `⏱️ ${h}h${m > 0 ? m + 'm' : ''}`;
        }
      }

      if (isOcupada) {
        borderCor = '#38bdf8';
        bgCor = '#f0f9ff';
        statusDot = `<span style="font-size: 9.5px; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">${c.itens?.length || 0} itens</span>`;
      } else if (isFechando) {
        borderCor = '#fbbf24';
        bgCor = '#fffbeb';
        statusDot = '<span style="font-size: 9.5px; font-weight: 800; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">CONTA</span>';
      }

      if (isSelected) {
        borderCor = '#10b981';
        bgCor = '#f0fdf4';
      }

      const icone = c.tipo === 'mesa' ? '🪑' : '🏷️';
      const total = parseFloat(c.total || 0).toFixed(2).replace('.', ',');

      // Formatação concisa para garantir que o nome nunca corte no card
      let nomeExibicao = c.nome || '';
      if (c.tipo === 'comanda' && nomeExibicao.toLowerCase().startsWith('comanda')) {
        nomeExibicao = nomeExibicao.replace(/comanda\s*#?/i, 'Cmd ').trim();
      }

      return `
        <div class="comanda-card-item" onclick="ComandasModule.selecionarComanda('${c.id}')" 
             style="border: 2px solid ${borderCor}; background: ${bgCor}; border-radius: 10px; padding: 10px 11px; cursor: pointer; transition: transform 0.12s ease, box-shadow 0.12s ease; box-shadow: ${isSelected ? '0 0 0 2px rgba(16, 185, 129, 0.25), 0 3px 10px rgba(16, 185, 129, 0.12)' : '0 1px 2px rgba(0,0,0,0.04)'}; display: flex; flex-direction: column; justify-content: space-between; min-height: 86px; box-sizing: border-box; overflow: hidden;">
          
          <!-- Linha 1: Título e Status Badge -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; min-width: 0;">
            <strong style="font-size: 13px; color: #1e293b; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; min-width: 0;">
              <span>${icone}</span> <span style="overflow: hidden; text-overflow: ellipsis;">${nomeExibicao}</span>
            </strong>
            ${statusDot}
          </div>

          <!-- Linha 2: Cliente se houver -->
          <div style="font-size: 11px; margin: 2px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${c.cliente ? `👤 <strong style="color: #334155;">${c.cliente}</strong>` : `<span style="color: #94a3b8; font-size: 11px;">${isLivre ? '⚪ Livre para uso' : 'Sem cliente'}</span>`}
          </div>

          <!-- Linha 3: Rodapé com Tempo e Preço -->
          <div style="display: flex; align-items: flex-end; justify-content: space-between; margin-top: 2px; padding-top: 4px; border-top: 1px dashed rgba(0,0,0,0.06);">
            <span style="font-size: 10.5px; color: var(--text-dim); white-space: nowrap;">${isLivre ? '-' : tempoAbertaStr}</span>
            <strong style="font-size: 13.5px; font-family: 'JetBrains Mono'; color: ${isLivre ? '#94a3b8' : '#059669'}; font-weight: 900; white-space: nowrap;">R$ ${total}</strong>
          </div>
        </div>
      `;
    }).join('');
  },

  selecionarComanda(id) {
    this.comandaAtivaId = id;
    this.produtoSelecionadoId = null;
    this.renderGridComandas();
    this.renderPainelDetalhes();
  },

  setDivisaoPessoas(qtd) {
    this.numPessoasDivisao = Math.max(1, parseInt(qtd, 10) || 1);
    this.renderPainelDetalhes();
  },

  renderPainelDetalhes() {
    const container = document.getElementById('comanda-detalhes-painel');
    if (!container) return;

    const comandas = this.getComandasDoModo();
    let c = comandas.find(item => item.id === this.comandaAtivaId);

    // Se o item selecionado não pertence ao modo ativo, seleciona o primeiro do modo
    if (!c && this.comandaAtivaId && comandas.length > 0) {
      this.comandaAtivaId = comandas[0].id;
      c = comandas[0];
    }

    if (!c) {
      const modo = this.getModoAtendimento();
      const labelItem = modo === 'apenas_comandas' ? 'Comanda' : (modo === 'apenas_mesas' ? 'Mesa' : 'Mesa ou Comanda');
      const primeiroId = comandas[0]?.id || (modo === 'apenas_comandas' ? 'CMD-1' : 'MESA-1');
      const labelBtn = modo === 'apenas_comandas' ? '🏷️ Abrir Comanda 01' : '🪑 Abrir Mesa 01';

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 380px; color: var(--text-muted); text-align: center; padding: 24px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 12px;">
            ${modo === 'apenas_comandas' ? '🏷️' : '🪑'}
          </div>
          <strong style="font-size: 16px; color: var(--text-main); margin-bottom: 4px;">Selecione uma ${labelItem}</strong>
          <p style="font-size: 12.5px; max-width: 280px; line-height: 1.4; color: var(--text-muted); margin: 0 0 16px 0;">
            Clique em qualquer cartão ao lado para lançar produtos, conferir a conta ou fechar no caixa.
          </p>
          <button type="button" class="btn-primary-action" style="font-size: 12px; padding: 0 16px; height: 36px; background: #10b981; color: #fff;" onclick="ComandasModule.selecionarComanda('${primeiroId}')">
            ${labelBtn}
          </button>
        </div>
      `;
      return;
    }

    const isLivre = c.status === 'livre';
    const totalItensConsumo = parseFloat(c.total || 0);
    const taxaServicoValor = c.taxaServico ? (totalItensConsumo * 0.10) : 0;
    const totalFinalGeral = totalItensConsumo + taxaServicoValor;

    // Divisão de conta
    const qtdPessoas = this.numPessoasDivisao || 1;
    const valorPorPessoa = totalFinalGeral / qtdPessoas;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between; overflow: hidden;">
        
        <!-- 1. CABEÇALHO DO ATENDIMENTO (Visual Limpo e Elegante) -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">${c.tipo === 'mesa' ? '🪑' : '🏷️'}</span>
              <div>
                <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--text-main);">${c.nome}</h3>
                <span style="font-size: 11px; color: var(--text-muted);">${c.tipo === 'mesa' ? 'Mesa de Atendimento' : 'Comanda de Consumo'}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: ${isLivre ? '#dcfce7' : '#fee2e2'}; color: ${isLivre ? '#15803d' : '#b91c1c'}; border: 1px solid ${isLivre ? '#bbf7d0' : '#fecaca'}; text-transform: uppercase;">
                ${isLivre ? '🟢 LIVRE' : '🔴 EM USO'}
              </span>
              ${!isLivre ? `
                <button type="button" class="btn-action-sm danger" style="padding: 0 8px; height: 26px; font-size: 11px;" onclick="ComandasModule.cancelarOuLiberarComanda('${c.id}')" title="Liberar / Cancelar mesa">
                  🗑️ Liberar
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Detalhes de Cliente e Tempo -->
          <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 8px; align-items: center; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <input type="text" id="comanda-cliente-input" class="form-input-custom" value="${c.cliente || ''}" 
                   placeholder="👤 Nome do Cliente / Identificação..." 
                   style="height: 32px; font-size: 11.5px; background: #ffffff;" 
                   onchange="ComandasModule.atualizarClienteComanda('${c.id}', this.value)">
            <span style="font-size: 11px; color: var(--text-dim); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${c.abertaEm ? `⏱️ Aberta às ${new Date(c.abertaEm).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` : '⚪ Aguardando pedidos'}
            </span>
          </div>
        </div>

        <!-- 2. LANÇADOR INTELIGENTE DE PRODUTOS -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin-bottom: 10px; flex-shrink: 0;">
          <div style="font-size: 11px; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>Lançamento Rápido de Produtos:</span>
            <span style="font-size: 10px; color: #0284c7; text-transform: none; font-weight: 700;">Tecle Enter ou passe o leitor</span>
          </div>

          <!-- Linha de Busca & Quantidade -->
          <div style="display: flex; gap: 6px; position: relative;">
            <div style="flex: 1; position: relative;">
              <input type="text" id="comanda-busca-produto-input" class="form-input-custom" 
                     placeholder="🔍 Digite nome, código ou passe leitor de barras..." 
                     autocomplete="off"
                     style="height: 36px; font-size: 12px; width: 100%; border-radius: 6px;"
                     oninput="ComandasModule.onBuscaProdutoInput(this.value)"
                     onkeydown="ComandasModule.onBuscaProdutoKeyDown(event, '${c.id}')">
              
              <!-- Dropdown Flutuante de Auto-Complete -->
              <div id="comanda-sugestoes-box" style="display: none; position: absolute; left: 0; right: 0; top: 38px; z-index: 1000; background: #ffffff; border: 1.5px solid #10b981; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto;">
                <!-- Preenchido dinamicamente via JS -->
              </div>
            </div>

            <!-- Stepper de Quantidade -->
            <div style="display: flex; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; height: 36px; padding: 0 2px;">
              <button type="button" style="border: none; background: transparent; width: 22px; height: 100%; font-weight: 900; font-size: 14px; cursor: pointer; color: var(--text-muted);" onclick="ComandasModule.ajustarQtdInput(-1)">-</button>
              <input type="number" id="comanda-qtd-input" value="1" min="1" max="999" style="width: 38px; border: none; text-align: center; font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono'; outline: none;">
              <button type="button" style="border: none; background: transparent; width: 22px; height: 100%; font-weight: 900; font-size: 14px; cursor: pointer; color: var(--text-muted);" onclick="ComandasModule.ajustarQtdInput(1)">+</button>
            </div>

            <!-- Botão de Lançar (Sem +, hover verde normal sem glow) -->
            <button type="button" id="btn-comanda-lancar-item" 
                    style="height: 36px; font-size: 12.5px; font-weight: 800; background: #10b981; color: #ffffff; border: none; border-radius: 6px; padding: 0 14px; flex-shrink: 0; cursor: pointer; transition: background 0.15s ease;"
                    onmouseover="this.style.background='#059669'"
                    onmouseout="this.style.background='#10b981'"
                    onclick="ComandasModule.lancarProdutoSelecionadoOuBipado('${c.id}')">
              Lançar
            </button>
          </div>
        </div>

        <!-- 3. TABELA DE ITENS CONSUMIDOS -->
        <div style="flex: 1; min-height: 120px; max-height: calc(100vh - 460px); overflow-y: auto; background: #ffffff; border: 1px solid var(--border-card); border-radius: 8px; margin-bottom: 10px;">
          ${(!c.itens || c.itens.length === 0) ? `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 140px; color: var(--text-muted); text-align: center; padding: 20px;">
              <span style="font-size: 28px; margin-bottom: 6px;">📋</span>
              <strong style="font-size: 13px; color: var(--text-main);">Nenhum item lançado ainda</strong>
              <span style="font-size: 11px; margin-top: 2px;">Utilize o buscador acima para lançar pedidos nesta mesa.</span>
            </div>
          ` : `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc; color: var(--text-dim); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; position: sticky; top: 0;">
                  <th style="padding: 6px 8px; text-align: left;">Item</th>
                  <th style="padding: 6px 4px; text-align: center; width: 75px;">Qtd</th>
                  <th style="padding: 6px 8px; text-align: right; width: 80px;">Total</th>
                  <th style="padding: 6px 4px; text-align: center; width: 28px;"></th>
                </tr>
              </thead>
              <tbody>
                ${c.itens.map((it, idx) => `
                  <tr style="border-bottom: 1px dashed #f1f5f9;">
                    <td style="padding: 6px 8px;">
                      <strong style="font-size: 12px; color: var(--text-main); display: block;">${it.nome}</strong>
                      <span style="font-size: 10.5px; color: var(--text-muted);">R$ ${parseFloat(it.precoUnitario || 0).toFixed(2).replace('.', ',')} un</span>
                    </td>
                    <td style="padding: 6px 4px; text-align: center;">
                      <div style="display: inline-flex; align-items: center; gap: 2px;">
                        <button type="button" style="border: 1px solid #cbd5e1; background: #f8fafc; width: 18px; height: 18px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 800; line-height: 1;" onclick="ComandasModule.alterarQtdItem('${c.id}', ${idx}, -1)">-</button>
                        <strong style="font-size: 12px; font-family: 'JetBrains Mono'; min-width: 18px; text-align: center;">${it.quantidade}</strong>
                        <button type="button" style="border: 1px solid #cbd5e1; background: #f8fafc; width: 18px; height: 18px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 800; line-height: 1;" onclick="ComandasModule.alterarQtdItem('${c.id}', ${idx}, 1)">+</button>
                      </div>
                    </td>
                    <td style="padding: 6px 8px; text-align: right; font-family: 'JetBrains Mono'; font-weight: 800; color: #059669; font-size: 12.5px;">
                      R$ ${parseFloat(it.total || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td style="padding: 6px 4px; text-align: center;">
                      <button type="button" class="btn-del-item-cmd" 
                              style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 13px; padding: 2px 6px; border-radius: 4px; transition: all 0.15s ease;" 
                              onmouseover="this.style.background='#fee2e2'; this.style.color='#ef4444';" 
                              onmouseout="this.style.background='transparent'; this.style.color='#94a3b8';" 
                              onclick="ComandasModule.removerItemComanda('${c.id}', ${idx})" 
                              title="Remover item">✕</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- 4. RESUMO FINANCEIRO, DIVISÃO DE CONTA & AÇÕES -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; flex-shrink: 0;">
          
          <!-- Subtotal e Taxa de Serviço -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted); margin-bottom: 4px;">
            <span>Subtotal de Itens:</span>
            <span style="font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-main);">R$ ${totalItensConsumo.toFixed(2).replace('.', ',')}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted); margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" style="width: 14px; height: 14px; cursor: pointer;" ${c.taxaServico ? 'checked' : ''} onchange="ComandasModule.toggleTaxaServico('${c.id}', this.checked)">
              <span>Taxa de Atendimento / Serviço (10%)</span>
            </label>
            <span style="font-family: 'JetBrains Mono'; font-weight: 700; color: ${c.taxaServico ? '#0284c7' : '#94a3b8'};">+ R$ ${taxaServicoValor.toFixed(2).replace('.', ',')}</span>
          </div>

          <!-- DIVISOR DE CONTA INTELIGENTE (1, 2, 3, 4, 5, 6 PESSOAS) -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; padding: 7px 10px; border-radius: 8px; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">👥 Dividir Conta:</span>
              <select style="height: 28px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; cursor: pointer; padding: 0 8px; min-width: 140px;" onchange="ComandasModule.setDivisaoPessoas(this.value)">
                <option value="1" ${qtdPessoas === 1 ? 'selected' : ''}>1 pessoa (Total)</option>
                <option value="2" ${qtdPessoas === 2 ? 'selected' : ''}>2 pessoas (1/2)</option>
                <option value="3" ${qtdPessoas === 3 ? 'selected' : ''}>3 pessoas (1/3)</option>
                <option value="4" ${qtdPessoas === 4 ? 'selected' : ''}>4 pessoas (1/4)</option>
                <option value="5" ${qtdPessoas === 5 ? 'selected' : ''}>5 pessoas (1/5)</option>
                <option value="6" ${qtdPessoas === 6 ? 'selected' : ''}>6 pessoas (1/6)</option>
              </select>
            </div>
            <strong style="font-size: 13.5px; font-family: 'JetBrains Mono'; color: #0284c7; font-weight: 800;">
              👉 R$ ${valorPorPessoa.toFixed(2).replace('.', ',')} <span style="font-size: 11px; font-weight: 500; color: #64748b;">/ pessoa</span>
            </strong>
          </div>

          <!-- Total Geral em Verde Destacado -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #cbd5e1; margin-bottom: 10px;">
            <strong style="font-size: 13px; color: var(--text-main);">TOTAL CONSUMIDO:</strong>
            <strong style="font-size: 20px; font-family: 'JetBrains Mono'; color: #059669; font-weight: 900;">R$ ${totalFinalGeral.toFixed(2).replace('.', ',')}</strong>
          </div>

          <!-- Botões de Ação (Sem hover glow) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1.6fr; gap: 8px;">
            <button type="button" class="btn-primary-action" style="justify-content: center; height: 38px; font-size: 12px; font-weight: 700; background: #0284c7; color: #ffffff; border: none; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);" onmouseover="this.style.background='#0369a1'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onmouseout="this.style.background='#0284c7'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onclick="ComandasModule.imprimirPreConta('${c.id}')" ${(!c.itens || c.itens.length === 0) ? 'disabled style="opacity:0.5"' : ''}>
              🖨️ Pré-Conta
            </button>
            <button type="button" class="btn-primary-action" style="justify-content: center; height: 38px; font-size: 12px; font-weight: 700; background: #475569; color: #ffffff; border: none; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);" onmouseover="this.style.background='#334155'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onmouseout="this.style.background='#475569'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onclick="ComandasModule.abrirModalTransferir('${c.id}')" ${(!c.itens || c.itens.length === 0) ? 'disabled style="opacity:0.5"' : ''}>
              🔄 Transferir
            </button>
            <button type="button" class="btn-primary-action" style="justify-content: center; height: 38px; font-size: 13px; font-weight: 800; background: #10b981; color: #ffffff; border: none; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);" onmouseover="this.style.background='#059669'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onmouseout="this.style.background='#10b981'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';" onclick="ComandasModule.transferirParaPdvCaixa('${c.id}')" ${(!c.itens || c.itens.length === 0) ? 'disabled style="opacity:0.5"' : ''}>
              💰 Caixa [F4]
            </button>
          </div>

        </div>

      </div>
    `;
  },

  ajustarQtdInput(delta) {
    const input = document.getElementById('comanda-qtd-input');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    val = Math.max(1, Math.min(999, val + delta));
    input.value = val;
  },

  onBuscaProdutoInput(termo) {
    const box = document.getElementById('comanda-sugestoes-box');
    if (!box) return;

    const texto = (termo || '').toLowerCase().trim();
    if (!texto || texto.length < 1) {
      box.style.display = 'none';
      this.sugestoesAtuais = [];
      this.sugestaoSelecionadaIdx = -1;
      return;
    }

    const todosProdutos = StorageService.getProdutos().filter(p => p.ativo !== false);
    const filtrados = todosProdutos.filter(p =>
      StorageService.produtoCombinaBusca(p, texto, ['nome', 'codigo', 'codigoBarras'])
    ).slice(0, 8);

    this.sugestoesAtuais = filtrados;
    this.sugestaoSelecionadaIdx = -1;

    if (filtrados.length === 0) {
      box.innerHTML = `
        <div style="padding: 10px; font-size: 11.5px; color: var(--text-muted); text-align: center;">
          Nenhum produto correspondente.
        </div>
      `;
      box.style.display = 'block';
      return;
    }

    box.innerHTML = filtrados.map((p, idx) => {
      const preco = parseFloat(p.precoVenda || p.preco || 0).toFixed(2).replace('.', ',');
      const cod = p.codigoBarras || p.codigo || p.id;
      return `
        <div id="sugestao-cmd-item-${idx}" class="comanda-sugestao-row" 
             style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.1s;"
             onmouseover="ComandasModule.destacarSugestaoIndice(${idx})" 
             onmouseout="this.style.background='#ffffff'"
             onclick="ComandasModule.selecionarSugestao('${p.id}')">
          <div>
            <strong style="font-size: 12px; color: var(--text-main); display: block;">${p.nome}</strong>
            <span style="font-size: 10.5px; color: var(--text-muted); font-family: 'JetBrains Mono';">Cód: ${cod}</span>
          </div>
          <strong style="font-size: 13px; font-family: 'JetBrains Mono'; color: #059669; font-weight: 800;">R$ ${preco}</strong>
        </div>
      `;
    }).join('');

    box.style.display = 'block';
  },

  destacarSugestaoIndice(idx) {
    this.sugestaoSelecionadaIdx = idx;
    const box = document.getElementById('comanda-sugestoes-box');
    if (!box) return;
    const items = box.querySelectorAll('.comanda-sugestao-row');
    items.forEach((it, i) => {
      if (i === idx) {
        it.style.background = '#dcfce7';
      } else {
        it.style.background = '#ffffff';
      }
    });
  },

  destacarSugestaoTeclado() {
    const box = document.getElementById('comanda-sugestoes-box');
    if (!box) return;
    const items = box.querySelectorAll('.comanda-sugestao-row');
    items.forEach((it, idx) => {
      if (idx === this.sugestaoSelecionadaIdx) {
        it.style.background = '#dcfce7';
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.style.background = '#ffffff';
      }
    });
  },

  onBuscaProdutoKeyDown(event, comandaId) {
    const box = document.getElementById('comanda-sugestoes-box');
    const hasSugestoes = this.sugestoesAtuais && this.sugestoesAtuais.length > 0 && box && box.style.display !== 'none';

    if (event.key === 'ArrowDown') {
      if (hasSugestoes) {
        event.preventDefault();
        this.sugestaoSelecionadaIdx = (this.sugestaoSelecionadaIdx + 1) % this.sugestoesAtuais.length;
        this.destacarSugestaoTeclado();
      }
    } else if (event.key === 'ArrowUp') {
      if (hasSugestoes) {
        event.preventDefault();
        this.sugestaoSelecionadaIdx = (this.sugestaoSelecionadaIdx - 1 + this.sugestoesAtuais.length) % this.sugestoesAtuais.length;
        this.destacarSugestaoTeclado();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      
      // 1. Se tem sugestão selecionada com seta, lança diretamente!
      if (hasSugestoes && this.sugestaoSelecionadaIdx >= 0 && this.sugestoesAtuais[this.sugestaoSelecionadaIdx]) {
        const prod = this.sugestoesAtuais[this.sugestaoSelecionadaIdx];
        const qtdInput = document.getElementById('comanda-qtd-input');
        const qtd = parseInt(qtdInput?.value, 10) || 1;
        this.adicionarItem(comandaId, prod, qtd);
        
        const input = document.getElementById('comanda-busca-produto-input');
        if (input) {
          input.value = '';
          input.focus();
        }
        if (qtdInput) qtdInput.value = '1';
        this.sugestoesAtuais = [];
        this.sugestaoSelecionadaIdx = -1;
        box.style.display = 'none';
        return;
      }

      // 2. Se digitou código de barras exato ou termo
      const input = document.getElementById('comanda-busca-produto-input');
      const val = input ? input.value.trim() : '';
      if (!val) return;

      const todosProdutos = StorageService.getProdutos().filter(p => p.ativo !== false);
      let produto = todosProdutos.find(p => p.codigoBarras === val || p.codigo === val);
      
      if (!produto) {
        produto = todosProdutos.find(p => StorageService.textoCombinaBusca(p.nome, val));
      }

      if (produto) {
        const qtdInput = document.getElementById('comanda-qtd-input');
        const qtd = parseInt(qtdInput?.value, 10) || 1;
        this.adicionarItem(comandaId, produto, qtd);
        if (input) {
          input.value = '';
          input.focus();
        }
        if (qtdInput) qtdInput.value = '1';
        this.sugestoesAtuais = [];
        this.sugestaoSelecionadaIdx = -1;
        if (box) box.style.display = 'none';
      } else {
        if (window.App) window.App.showToast('Produto não localizado!', 'warning');
      }
    } else if (event.key === 'Escape') {
      if (box) box.style.display = 'none';
      this.sugestoesAtuais = [];
      this.sugestaoSelecionadaIdx = -1;
    }
  },

  selecionarSugestao(produtoId) {
    const todosProdutos = StorageService.getProdutos();
    const p = todosProdutos.find(item => item.id === produtoId);
    if (!p) return;

    const input = document.getElementById('comanda-busca-produto-input');
    if (input) input.value = p.nome;
    this.produtoSelecionadoId = produtoId;

    const box = document.getElementById('comanda-sugestoes-box');
    if (box) box.style.display = 'none';

    // Foco para lançar
    const btnLancar = document.getElementById('btn-comanda-lancar-item');
    if (btnLancar) btnLancar.focus();
  },

  lancarProdutoSelecionadoOuBipado(comandaId) {
    const input = document.getElementById('comanda-busca-produto-input');
    const qtdInput = document.getElementById('comanda-qtd-input');
    const val = input ? input.value.trim() : '';
    const qtd = parseInt(qtdInput?.value, 10) || 1;

    const todosProdutos = StorageService.getProdutos().filter(p => p.ativo !== false);
    let produto = null;

    if (this.produtoSelecionadoId) {
      produto = todosProdutos.find(p => p.id === this.produtoSelecionadoId);
    }
    if (!produto && val) {
      produto = todosProdutos.find(p => p.codigoBarras === val || p.codigo === val || StorageService.textoCombinaBusca(p.nome, val));
    }

    if (!produto) {
      if (window.App) window.App.showToast('Digite ou selecione um produto para lançar!', 'warning');
      return;
    }

    this.adicionarItem(comandaId, produto, qtd);

    if (input) {
      input.value = '';
      input.focus();
    }
    if (qtdInput) qtdInput.value = '1';
    this.produtoSelecionadoId = null;

    const box = document.getElementById('comanda-sugestoes-box');
    if (box) box.style.display = 'none';
  },

  adicionarItem(comandaId, produto, quantidade = 1) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (!c) return;

    if (!c.itens) c.itens = [];
    const preco = parseFloat(produto.precoVenda || produto.preco || 0);

    const itemExistente = c.itens.find(i => i.id === produto.id);
    if (itemExistente) {
      itemExistente.quantidade += quantidade;
      itemExistente.total = itemExistente.quantidade * itemExistente.precoUnitario;
    } else {
      c.itens.push({
        id: produto.id,
        codigo: produto.codigoBarras || produto.codigo || produto.id,
        nome: produto.nome,
        precoUnitario: preco,
        quantidade: quantidade,
        total: preco * quantidade,
        horaAdicionado: new Date().toISOString()
      });
    }

    c.status = 'ocupada';
    if (!c.abertaEm) c.abertaEm = new Date().toISOString();
    c.operador = AuthModule.getNomeOperador();
    c.total = c.itens.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    this.salvarComandas(comandas);
    this.renderGridComandas();
    this.renderPainelDetalhes();

    // Agrupa e consolida todo o atendimento da mesa em 1 único registro de auditoria
    AuditModule.registrarOuAtualizarLogMesa(c, 'atualizacao');

    if (window.App) window.App.showToast(`➕ ${quantidade}x ${produto.nome} lançado na ${c.nome}!`, 'success');
  },

  alterarQtdItem(comandaId, index, delta) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (!c || !c.itens || !c.itens[index]) return;

    const it = c.itens[index];
    const nomeItem = it.nome;
    it.quantidade += delta;
    if (it.quantidade <= 0) {
      c.itens.splice(index, 1);
    } else {
      it.total = it.quantidade * it.precoUnitario;
    }

    if (c.itens.length === 0) {
      c.status = 'livre';
      c.abertaEm = null;
      c.cliente = '';
      c.total = 0;
      c.taxaServico = false;
      AuditModule.registrarOuAtualizarLogMesa(c, 'liberacao');
    } else {
      c.total = c.itens.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
      AuditModule.registrarOuAtualizarLogMesa(c, 'atualizacao');
    }

    this.salvarComandas(comandas);
    this.renderGridComandas();
    this.renderPainelDetalhes();
  },

  removerItemComanda(comandaId, index) {
    this.alterarQtdItem(comandaId, index, -9999);
  },

  toggleTaxaServico(comandaId, checked) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (c) {
      c.taxaServico = !!checked;
      this.salvarComandas(comandas);
      this.renderPainelDetalhes();
    }
  },

  atualizarClienteComanda(id, nome) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === id);
    if (c) {
      c.cliente = nome.trim();
      this.salvarComandas(comandas);
      this.renderGridComandas();
    }
  },

  cancelarOuLiberarComanda(comandaId) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (!c) return;

    window.App.confirmarAcao({
      icone: '🍽️',
      titulo: `Liberar ${c.nome}`,
      mensagem: `Deseja realmente zerar e liberar a <strong>${c.nome}</strong>? Todos os itens lançados serão descartados.`,
      textoConfirmar: 'Sim, Liberar',
      perigo: true,
      onConfirm: () => {
        const totalAnterior = Math.round((parseFloat(c.total) || 0) * 100) / 100;
        c.status = 'livre';
        c.itens = [];
        c.total = 0;
        c.cliente = '';
        c.abertaEm = null;
        c.taxaServico = false;
        this.salvarComandas(comandas);
        this.renderGridComandas();
        this.renderPainelDetalhes();

        AuditModule.registrarLog('comandas', `${c.nome} liberada e zerada`, {
          comanda: c.nome,
          totalAnterior: totalAnterior
        });

        if (window.App) window.App.showToast(`${c.nome} liberada com sucesso!`, 'info');
      }
    });
  },

  // Modal e Ação de Transferir Mesa
  abrirModalTransferir(origemId) {
    const comandas = this.getComandas();
    const cOrigem = comandas.find(item => item.id === origemId);
    if (!cOrigem || !cOrigem.itens || cOrigem.itens.length === 0) {
      if (window.App) window.App.showToast('Esta mesa não possui itens para transferir!', 'warning');
      return;
    }

    const modal = document.getElementById('modal-transferir-comanda');
    const origemNomeEl = document.getElementById('transferir-origem-nome');
    const selectDestino = document.getElementById('transferir-destino-select');

    if (origemNomeEl) origemNomeEl.textContent = cOrigem.nome;

    if (selectDestino) {
      const outras = this.getComandasDoModo().filter(item => item.id !== origemId);
      selectDestino.innerHTML = outras.map(item => `
        <option value="${item.id}">
          ${item.tipo === 'mesa' ? '🪑' : '🏷️'} ${item.nome} ${item.status === 'livre' ? '(Livre)' : `(Ocupada - R$ ${parseFloat(item.total||0).toFixed(2).replace('.', ',')})`}
        </option>
      `).join('');
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalTransferir() {
    const modal = document.getElementById('modal-transferir-comanda');
    if (modal) modal.classList.remove('active');
  },

  confirmarTransferencia() {
    const comandas = this.getComandas();
    const cOrigem = comandas.find(item => item.id === this.comandaAtivaId);
    const selectDestino = document.getElementById('transferir-destino-select');
    const destinoId = selectDestino ? selectDestino.value : null;
    const cDestino = comandas.find(item => item.id === destinoId);

    if (!cOrigem || !cDestino) return;

    if (!cDestino.itens) cDestino.itens = [];

    // Transferir itens mesclando
    cOrigem.itens.forEach(itOrigem => {
      const itExistente = cDestino.itens.find(i => i.id === itOrigem.id);
      if (itExistente) {
        itExistente.quantidade += itOrigem.quantidade;
        itExistente.total = itExistente.quantidade * itExistente.precoUnitario;
      } else {
        cDestino.itens.push({ ...itOrigem });
      }
    });

    cDestino.status = 'ocupada';
    if (!cDestino.abertaEm) cDestino.abertaEm = cOrigem.abertaEm || new Date().toISOString();
    if (!cDestino.cliente && cOrigem.cliente) cDestino.cliente = cOrigem.cliente;
    cDestino.total = cDestino.itens.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);

    // Zerar origem
    cOrigem.status = 'livre';
    cOrigem.itens = [];
    cOrigem.total = 0;
    cOrigem.cliente = '';
    cOrigem.abertaEm = null;
    cOrigem.taxaServico = false;

    this.salvarComandas(comandas);
    this.fecharModalTransferir();
    this.selecionarComanda(cDestino.id);

    AuditModule.registrarOuAtualizarLogMesa(cDestino, 'transferencia', { origem: cOrigem.nome, destino: cDestino.nome });

    if (window.App) {
      window.App.showToast(`🔄 Consumo transferido com sucesso para ${cDestino.nome}!`, 'success');
    }
  },

  // Modal e Ação de Nova Mesa / Comanda Personalizada
  abrirModalNovaComanda() {
    const modal = document.getElementById('modal-nova-comanda-personalizada');
    const inputNome = document.getElementById('nova-comanda-nome-input');
    const selectTipo = document.getElementById('nova-comanda-tipo-select');
    const modo = this.getModoAtendimento();

    if (inputNome) inputNome.value = '';
    if (selectTipo) {
      if (modo === 'apenas_mesas') {
        selectTipo.innerHTML = '<option value="mesa">🪑 Mesa</option>';
        selectTipo.value = 'mesa';
      } else if (modo === 'apenas_comandas') {
        selectTipo.innerHTML = '<option value="comanda">🏷️ Comanda</option>';
        selectTipo.value = 'comanda';
      } else {
        selectTipo.innerHTML = `
          <option value="mesa">🪑 Mesa</option>
          <option value="comanda">🏷️ Comanda</option>
        `;
        selectTipo.value = 'mesa';
      }
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalNovaComanda() {
    const modal = document.getElementById('modal-nova-comanda-personalizada');
    if (modal) modal.classList.remove('active');
  },

  salvarNovaComanda() {
    const inputNome = document.getElementById('nova-comanda-nome-input');
    const selectTipo = document.getElementById('nova-comanda-tipo-select');
    const nome = inputNome ? inputNome.value.trim() : '';
    const tipo = selectTipo ? selectTipo.value : 'mesa';

    if (!nome) return;

    const comandas = this.getComandas();
    const novoId = (tipo === 'mesa' ? 'MESA-CUSTOM-' : 'CMD-CUSTOM-') + Date.now();

    comandas.push({
      id: novoId,
      tipo: tipo,
      numero: comandas.length + 1,
      nome: nome,
      cliente: '',
      status: 'livre',
      itens: [],
      taxaServico: false,
      total: 0,
      abertaEm: null,
      operador: ''
    });

    this.salvarComandas(comandas);
    this.fecharModalNovaComanda();
    this.renderGridComandas();
    this.selecionarComanda(novoId);

    if (window.App) window.App.showToast(`🎉 ${nome} criada com sucesso!`, 'success');
  },

  imprimirPreConta(comandaId) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (!c || !c.itens || c.itens.length === 0) return;

    c.status = 'fechando';
    this.salvarComandas(comandas);
    this.renderGridComandas();
    this.renderPainelDetalhes();

    const papel = ThermalPrintModule.papelCupom();
    const config = papel.config || StorageService.getConfig() || {};
    const largura = papel.largura;
    const pageSize = papel.pageSize;
    const fonte = papel.fonte;
    const nomeLoja = config.nomeEmpresa || config.nomeLoja || 'FlowPDV';
    const totalConsumo = parseFloat(c.total || 0);
    const taxaServicoOpcional = c.taxaServico ? (totalConsumo * 0.10) : 0;
    const totalComServico = totalConsumo + taxaServicoOpcional;
    const qtdPessoas = this.numPessoasDivisao || 1;
    const valorPorPessoa = totalComServico / qtdPessoas;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pré-Conta ${c.nome}</title>
        <style>
          @page { margin: 0; size: ${pageSize}; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${largura};
            margin: 0 auto;
            padding: 8px 4px;
            font-size: ${fonte};
            line-height: 1.25;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row-flex { display: flex; justify-content: space-between; align-items: flex-start; margin: 2px 0; }
          .table-items { width: 100%; border-collapse: collapse; font-size: 11px; }
          .table-items td { padding: 2px 0; vertical-align: top; }
          .nowrap { white-space: nowrap; }
        </style>
      </head>
      <body>
        <div class="text-center bold" style="font-size: 13px;">${nomeLoja}</div>
        <div class="text-center" style="font-size: 10px; margin-top: 1px;">CONFERÊNCIA DE MESA</div>
        <div class="divider"></div>
        <div class="row-flex bold">
          <span>${c.nome}</span>
          <span class="nowrap">${c.abertaEm ? new Date(c.abertaEm).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR')}</span>
        </div>
        ${c.cliente ? `<div>Cliente: <strong>${c.cliente}</strong></div>` : ''}
        <div>Operador: ${c.operador || 'Atendimento'}</div>
        <div class="divider"></div>
        
        <table class="table-items">
          <thead>
            <tr class="bold" style="border-bottom: 1px dashed #000;">
              <td style="text-align: left; padding-bottom: 3px;">ITEM</td>
              <td style="text-align: center; width: 34px; padding-bottom: 3px;" class="nowrap">QTD</td>
              <td style="text-align: right; width: 72px; padding-bottom: 3px;" class="nowrap">TOTAL</td>
            </tr>
          </thead>
          <tbody>
            ${c.itens.map(it => `
              <tr>
                <td style="text-align: left; padding-right: 4px;">${it.nome}</td>
                <td style="text-align: center;" class="nowrap">${it.quantidade}x</td>
                <td style="text-align: right; font-weight: bold;" class="nowrap">R$ ${parseFloat(it.total).toFixed(2).replace('.', ',')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="row-flex">
          <span>Subtotal Itens:</span>
          <span class="nowrap bold">R$ ${totalConsumo.toFixed(2).replace('.', ',')}</span>
        </div>
        ${c.taxaServico ? `
          <div class="row-flex" style="font-size: 10.5px;">
            <span>Taxa Serviço (10%):</span>
            <span class="nowrap">+ R$ ${taxaServicoOpcional.toFixed(2).replace('.', ',')}</span>
          </div>
          <div class="row-flex bold" style="font-size: 12px; margin-top: 3px;">
            <span>TOTAL C/ SERVIÇO:</span>
            <span class="nowrap">R$ ${totalComServico.toFixed(2).replace('.', ',')}</span>
          </div>
        ` : `
          <div class="row-flex bold" style="font-size: 12px; margin-top: 3px;">
            <span>TOTAL:</span>
            <span class="nowrap">R$ ${totalConsumo.toFixed(2).replace('.', ',')}</span>
          </div>
        `}
        ${qtdPessoas > 1 ? `
          <div class="divider"></div>
          <div class="row-flex bold" style="font-size: 11px;">
            <span>P/ ${qtdPessoas} Pessoas:</span>
            <span class="nowrap">R$ ${valorPorPessoa.toFixed(2).replace('.', ',')} cd</span>
          </div>
        ` : ''}
        <div class="divider"></div>
        <div class="text-center" style="font-size: 9.5px; line-height: 1.3;">
          * Documento não fiscal para conferência de mesa *<br>
          Agradecemos a preferência!
        </div>
      </body>
      </html>
    `;

    ThermalPrintModule.executarImpressao(html);
    if (window.App) window.App.showToast(`🖨️ Pré-conta da ${c.nome} enviada para a impressora!`, 'info');
  },

  transferirParaPdvCaixa(comandaId) {
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (!c || !c.itens || c.itens.length === 0) {
      if (window.App) window.App.showToast('Esta mesa não possui itens lançados para cobrar no caixa!', 'warning');
      return;
    }

    if (!window.PdvModule) return;

    // 1. Carrega itens no carrinho do PDV
    const taxaServicoValor = c.taxaServico ? (parseFloat(c.total || 0) * 0.10) : 0;

    window.PdvModule.carrinho = c.itens.map(it => ({
      id: it.id,
      codigo: it.codigo,
      nome: it.nome,
      precoUnitario: it.precoUnitario,
      quantidade: it.quantidade,
      unidade: 'UN',
      comandaOrigemId: c.id
    }));

    // Se tiver taxa de serviço de 10%, adiciona como item de acréscimo de serviço
    if (taxaServicoValor > 0) {
      window.PdvModule.carrinho.push({
        id: 'TAXA-SERVICO-10',
        codigo: 'SERV10',
        nome: `Taxa de Serviço 10% (${c.nome})`,
        precoUnitario: taxaServicoValor,
        quantidade: 1,
        unidade: 'UN',
        comandaOrigemId: c.id
      });
    }

    window.PdvModule.desconto = 0;
    window.PdvModule.renderCarrinho();

    // 2. Vai para a aba do PDV
    if (window.App) window.App.trocarAba('pdv');

    AuditModule.registrarOuAtualizarLogMesa(c, 'fechamento_caixa');

    // 3. Abre o modal de pagamento [F4] automaticamente
    setTimeout(() => {
      window.PdvModule.abrirModalPagamento();
      if (window.App) window.App.showToast(`💰 Itens da ${c.nome} transferidos para o caixa!`, 'success');
    }, 150);
  },

  liberarComandaAposVenda(comandaId) {
    if (!comandaId) return;
    const comandas = this.getComandas();
    const c = comandas.find(item => item.id === comandaId);
    if (c) {
      c.status = 'livre';
      c.itens = [];
      c.total = 0;
      c.cliente = '';
      c.abertaEm = null;
      c.taxaServico = false;
      this.salvarComandas(comandas);
    }
  }
};
