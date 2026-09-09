/**
 * pdv.js - Frente de Caixa (PDV Ágil & Leitor de Código de Barras)
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { ThermalPrintModule } from './thermal-print.js';
import { AuditModule } from './audit.js';

export const PdvModule = {
  carrinho: [],
  clubePerguntaExibida: false,
  desconto: 0,
  audioCtx: null,

  init() {
    this.bindBarcodeListener();
    this.renderCarrinho();
    this.renderMiniDashboardTurno();
    this.focarInputLeitor();
  },

  // Bip artificial desativado (o leitor físico já emite o som nativo)
  tocarSomBeep(sucesso = true) {
    // Desativado por padrão para não duplicar o bipe do leitor de código de barras físico
  },

  parseMoedaBR(valor) {
    return StorageService.parseMoedaBR(valor);
  },

  getInputLeitorAtivo() {
    const tabPdv = document.getElementById('tab-pdv');
    const isClassic = document.body.classList.contains('pdv-layout-classico') || 
                      (tabPdv && tabPdv.classList.contains('pdv-layout-classico'));
    const classicInput = document.getElementById('classic-pdv-barcode-input');
    const modernInput = document.getElementById('pdv-barcode-input');
    
    if (isClassic && classicInput) return classicInput;
    if (!isClassic && modernInput) return modernInput;
    return classicInput || modernInput;
  },

  focarInputLeitor() {
    // 1. Se a tela de login estiver aberta, focar no PIN e jamais no leitor
    const modalLogin = document.getElementById('modal-login-operador');
    if (modalLogin && modalLogin.classList.contains('active')) {
      const pinInput = document.getElementById('login-pin-input');
      if (pinInput && document.activeElement !== pinInput) {
        pinInput.focus();
      }
      return;
    }

    // 2. Se qualquer outro modal ou tela de bloqueio estiver ativa, não roubar o foco
    const modalAtivo = document.querySelector('.modal-overlay.active, .lock-screen-overlay.active');
    if (modalAtivo) {
      return;
    }

    const tabPdv = document.getElementById('tab-pdv');
    if (tabPdv && !tabPdv.classList.contains('active')) {
      return;
    }

    const input = this.getInputLeitorAtivo();
    if (input) {
      try {
        input.focus({ preventScroll: true });
      } catch (e) {
        input.focus();
      }
    }
  },

  bindBarcodeListener() {
    const inputs = [
      document.getElementById('pdv-barcode-input'),
      document.getElementById('classic-pdv-barcode-input')
    ];
    
    inputs.forEach(input => {
      if (!input) return;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const valor = input.value.trim();
          if (!valor) return;

          this.ignorarProximoEnterGlobal = true;
          this.processarEntradaCodigo(valor);
          input.value = '';
          this.focarInputLeitor();
        }
      });

      // Se o campo do leitor perder o foco, mas nenhum outro input foi focado e nenhum modal está ativo,
      // restaura o foco automaticamente (proteção vital para mercados e adegas sem mouse)
      input.addEventListener('blur', () => {
        setTimeout(() => {
          const activeTab = document.querySelector('.tab-panel.active');
          const algumModalAberto = document.querySelector('.modal-overlay.active, .lock-screen-overlay.active');
          if (activeTab && activeTab.id === 'tab-pdv' && !algumModalAberto) {
            const currentTag = document.activeElement ? document.activeElement.tagName : '';
            if (currentTag !== 'INPUT' && currentTag !== 'TEXTAREA' && currentTag !== 'SELECT') {
              this.focarInputLeitor();
            }
          }
        }, 80);
      });
    });

    // 1. Manter o foco no leitor ao clicar fora (somente se nenhum modal estiver ativo)
    document.addEventListener('click', (e) => {
      const activeTab = document.querySelector('.tab-panel.active');
      const algumModalAberto = document.querySelector('.modal-overlay.active, .lock-screen-overlay.active');
      if (activeTab && activeTab.id === 'tab-pdv' && !algumModalAberto && !e.target.closest('.modal-content-box') && !e.target.closest('input') && !e.target.closest('select') && !e.target.closest('textarea')) {
        this.focarInputLeitor();
      }
    });

    // 2. Proteção para ambiente sem mouse: rediciona digitação de código ou bipe do leitor de barras diretamente para o campo
    document.addEventListener('keydown', (e) => {
      const activeTab = document.querySelector('.tab-panel.active');
      if (!activeTab || activeTab.id !== 'tab-pdv') return;

      const algumModalAberto = document.querySelector('.modal-overlay.active, .lock-screen-overlay.active');
      if (algumModalAberto) return;

      const tag = document.activeElement ? document.activeElement.tagName : '';
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Impede que o Tab no PDV tire o operador do fluxo de caixa
      if (e.key === 'Tab') {
        e.preventDefault();
        this.focarInputLeitor();
        return;
      }

      if (!isInput) {
        // Se for um caractere imprimível (leitor de código de barras ou teclado digitando código/número)
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const input = this.getInputLeitorAtivo();
          if (input) {
            input.focus();
          }
        }
      }
    });

    // 3. Ao restaurar foco na janela do sistema (Alt+Tab ou clique no aplicativo)
    window.addEventListener('focus', () => {
      const activeTab = document.querySelector('.tab-panel.active');
      const algumModalAberto = document.querySelector('.modal-overlay.active, .lock-screen-overlay.active');
      if (activeTab && activeTab.id === 'tab-pdv' && !algumModalAberto) {
        this.focarInputLeitor();
      }
    });
  },

  // Suporte a multiplicador de quantidade: ex: "5*7891991000833" ou apenas "7891991000833"
  // Validação de Caixa Aberto Obrigatório
  validarCaixaAberto() {
    const turno = StorageService.getTurnoAtual();
    if (!turno) {
      window.App.showToast('🔒 Caixa Fechado! É obrigatório abrir o Turno de Caixa antes de passar produtos e vender.', 'error');
      this.tocarSomErro();
      if (window.CaixaModule) {
        window.CaixaModule.abrirTurnoCaixa();
      }
      return false;
    }
    return true;
  },

  tocarSomErro() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  },

  // Status centralizado do layout clássico (Bug 1 e 2)
  atualizarStatusClassico() {
    const statusEl = document.getElementById('classic-status-text');
    if (!statusEl) return;
    const turnoAberto = StorageService.getTurnoAtual();
    if (!turnoAberto) {
      statusEl.textContent = 'CAIXA FECHADO';
      statusEl.style.color = '#dc2626';
    } else if (this.carrinho.length > 0) {
      statusEl.textContent = 'VENDA EM ANDAMENTO';
      statusEl.style.color = '#0284c7';
    } else {
      statusEl.textContent = 'CAIXA LIVRE';
      statusEl.style.color = '#16a34a';
    }
  },

  calcularResumoTurnoLocal(turno) {
    if (!turno) return null;
    const vendas = StorageService.getVendas();
    const dataInicio = new Date(turno.dataAbertura);
    const dataFim = turno.dataFechamento ? new Date(turno.dataFechamento) : new Date();

    const vendasTurno = vendas.filter(v => {
      if ((turno.vendasIds || []).includes(v.id)) return true;
      const d = new Date(v.data);
      return d >= dataInicio && d <= dataFim;
    });

    let totalDinheiro = 0;
    let totalPix = 0;
    let totalDebito = 0;
    let totalCredito = 0;
    let totalFiado = 0;
    let totalVendas = 0;

    vendasTurno.forEach(v => {
      const tot = v.total || 0;
      totalVendas += tot;

      if (v.pagamentoDividido && Array.isArray(v.pagamentos)) {
        let dinheiroVenda = 0;
        v.pagamentos.forEach(p => {
          const val = parseFloat(p.valor) || 0;
          if (p.forma === 'Dinheiro') dinheiroVenda += val;
          else if (p.forma === 'PIX') totalPix += val;
          else if (p.forma === 'Débito') totalDebito += val;
          else if (p.forma === 'Crédito') totalCredito += val;
          else if (p.forma === 'Fiado') totalFiado += val;
        });
        const trocoVenda = parseFloat(v.troco) || 0;
        totalDinheiro += Math.max(0, dinheiroVenda - trocoVenda);
      } else if (v.pagamentoDividido && (v.parcela1 || v.parcela2)) {
        const addParcela = (forma, valor) => {
          const val = parseFloat(valor) || 0;
          if (forma === 'Dinheiro') totalDinheiro += val;
          else if (forma === 'PIX') totalPix += val;
          else if (forma === 'Débito') totalDebito += val;
          else if (forma === 'Crédito') totalCredito += val;
          else if (forma === 'Fiado') totalFiado += val;
        };
        if (v.parcela1) addParcela(v.parcela1.forma, v.parcela1.valor);
        if (v.parcela2) addParcela(v.parcela2.forma, v.parcela2.valor);
      } else {
        if (v.formaPagamento === 'Dinheiro') totalDinheiro += tot;
        else if (v.formaPagamento === 'PIX') totalPix += tot;
        else if (v.formaPagamento === 'Débito') totalDebito += tot;
        else if (v.formaPagamento === 'Crédito') totalCredito += tot;
        else if (v.formaPagamento === 'Fiado') totalFiado += tot;
      }
    });

    const totalSangrias = (turno.sangrias || []).reduce((acc, s) => acc + (s.valor || 0), 0);
    const saldoEmGaveta = Math.max(0, (turno.trocoInicial || 0) + totalDinheiro - totalSangrias);

    return {
      vendasCount: vendasTurno.length,
      totalVendas,
      totalDinheiro,
      totalPix,
      totalCartao: totalDebito + totalCredito,
      totalFiado,
      totalSangrias,
      saldoEmGaveta
    };
  },

  renderMiniDashboardTurno() {
    const el = document.getElementById('pdv-mini-dashboard');
    if (!el) return;

    const turno = StorageService.getTurnoAtual();

    if (!turno) {
      el.innerHTML = `
        <div class="pdv-caixa-fechado-box">
          <div class="caixa-fechado-icon">🔒</div>
          <div class="caixa-fechado-title">Caixa Fechado</div>
          <p class="caixa-fechado-desc">É necessário abrir o turno para passar produtos.</p>
          <button type="button" class="btn-abrir-turno-dash" onclick="CaixaModule.abrirTurnoCaixa()">
            🟢 Abrir Turno de Caixa [F10]
          </button>
        </div>
      `;
      return;
    }

    const totais = this.calcularResumoTurnoLocal(turno);
    const horaAbertura = new Date(turno.dataAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nomeOperador = turno.operador || turno.operadorAbertura || 'Operador Caixa';
    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') ? window.AuthModule.isGerente() : false;

    if (isGerente) {
      el.innerHTML = `
        <div class="mini-dash-header">
          <div class="mini-dash-status-badge">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); display: inline-block;"></span>
            Turno Ativo (${horaAbertura})
          </div>
          <span style="font-size: 11px; color: var(--text-dim); font-weight: 700;">#${StorageService.formatarNumeroTurno(turno.id)} • ${nomeOperador}</span>
        </div>

        <div class="mini-dash-grid">
          <div class="mini-dash-box">
            <span class="mini-dash-box-label">💵 Dinheiro em Gaveta</span>
            <span class="mini-dash-box-value" style="color: var(--accent-green);">
              R$ ${StorageService.formatarMoeda(totais.saldoEmGaveta)}
            </span>
            <span style="font-size: 10px; color: var(--text-dim); font-weight: 600;">Troco Inicial: R$ ${StorageService.formatarMoeda(turno.trocoInicial)}</span>
          </div>

          <div class="mini-dash-box">
            <span class="mini-dash-box-label">⚡ Faturamento do Turno</span>
            <span class="mini-dash-box-value" style="color: var(--accent-blue);">
              R$ ${StorageService.formatarMoeda(totais.totalVendas)}
            </span>
            <span style="font-size: 10px; color: var(--text-dim); font-weight: 600;">${totais.vendasCount} vendas realizadas</span>
          </div>
        </div>

        <div class="mini-dash-breakdown-row">
          <span class="mini-dash-pill">💵 Dinheiro: R$ ${StorageService.formatarMoeda(totais.totalDinheiro)}</span>
          <span class="mini-dash-pill">📱 PIX: R$ ${StorageService.formatarMoeda(totais.totalPix)}</span>
          <span class="mini-dash-pill">💳 Cartão: R$ ${StorageService.formatarMoeda(totais.totalCartao)}</span>
          ${totais.totalFiado > 0 ? `<span class="mini-dash-pill" style="color: var(--accent-amber); border-color: #fde68a;">👤 Fiado: R$ ${StorageService.formatarMoeda(totais.totalFiado)}</span>` : ''}
          ${totais.totalSangrias > 0 ? `<span class="mini-dash-pill" style="color: var(--accent-red); border-color: #fecaca;">💸 Sangrias: -R$ ${StorageService.formatarMoeda(totais.totalSangrias)}</span>` : ''}
        </div>
      `;
    } else {
      // Modo Operador Caixa (Fechamento Cego Seguro - Oculta os totais em dinheiro para exigir contagem física)
      el.innerHTML = `
        <div class="mini-dash-header">
          <div class="mini-dash-status-badge">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); display: inline-block;"></span>
            Turno de Caixa Aberto (${horaAbertura})
          </div>
          <span style="font-size: 11px; color: var(--text-dim); font-weight: 700;">#${StorageService.formatarNumeroTurno(turno.id)} • ${nomeOperador}</span>
        </div>

        <div class="mini-dash-grid">
          <div class="mini-dash-box" style="background: #f8fafc; border: 1px dashed #cbd5e1;">
            <span class="mini-dash-box-label">🔒 Dinheiro em Gaveta</span>
            <span class="mini-dash-box-value" style="color: #64748b; font-size: 17px; font-weight: 800;">
              ••••••
            </span>
            <span style="font-size: 10px; color: var(--text-muted); font-weight: 600;">Conferência cega no fechamento</span>
          </div>

          <div class="mini-dash-box">
            <span class="mini-dash-box-label">⚡ Vendas Registradas</span>
            <span class="mini-dash-box-value" style="color: var(--accent-blue);">
              ${totais.vendasCount} ${totais.vendasCount === 1 ? 'venda' : 'vendas'}
            </span>
            <span style="font-size: 10px; color: var(--text-dim); font-weight: 600;">Caixa Operando</span>
          </div>
        </div>

        <div class="mini-dash-breakdown-row">
          <span class="mini-dash-pill" style="color: #059669; font-weight: 700;">🟢 Turno em Andamento</span>
          <span class="mini-dash-pill">👤 Operador: ${nomeOperador}</span>
        </div>
      `;
    }
  },

  processarEntradaCodigo(entrada) {
    if (!this.validarCaixaAberto()) return;
    const trimEntrada = String(entrada || '').trim();
    if (!trimEntrada) return;

    const produtos = StorageService.getProdutos() || [];

    // 1. ATALHO EXCLUSIVO PARA ITEM AVULSO / DIVERSO (Começa obrigatoriamente com '*')
    // Exemplos suportados: "*15" (1x R$ 15,00), "*15.50" (1x R$ 15,50), "*15*3" (3x R$ 15,00)
    if (trimEntrada.startsWith('*')) {
      const semPrefixo = trimEntrada.substring(1).trim();
      let valor = 0;
      let qtd = 1;

      if (semPrefixo.includes('*') || semPrefixo.toLowerCase().includes('x')) {
        const divisor = semPrefixo.includes('*') ? '*' : 'x';
        const partes = semPrefixo.toLowerCase().split(divisor);
        valor = parseFloat(partes[0].replace(',', '.')) || 0;
        qtd = parseFloat(partes[1].replace(',', '.')) || 1;
      } else {
        valor = parseFloat(semPrefixo.replace(',', '.')) || 0;
      }

      if (valor > 0) {
        const itemAvulso = {
          id: 'AVULSO-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          nome: 'Item Diverso / Avulso',
          codigoBarras: 'AVULSO',
          precoVenda: valor,
          precoCusto: 0,
          controlarEstoque: false,
          categoria: 'Geral'
        };
        this.adicionarAoCarrinho(itemAvulso, qtd, false, 'scanner');
        this.tocarSomBeep(true);
        window.App.showToast(`⚡ Item Avulso (${qtd}x R$ ${valor.toFixed(2).replace('.', ',')}) adicionado ao carrinho!`, 'success');
        return;
      }
    }

    // 2. MULTIPLICADOR DE QUANTIDADE PARA PRODUTOS CADASTRADOS (Ex: "3*7891991000833")
    let quantidade = 1;
    let codigo = trimEntrada;

    if (trimEntrada.includes('*')) {
      const partes = trimEntrada.split('*');
      quantidade = parseFloat(partes[0].replace(',', '.')) || 1;
      codigo = partes[1].trim();
    }

    const codNormalizado = String(codigo || '').trim().toUpperCase();

    // 3. BUSCA DIRETA E EXATA NO CADASTRO (Prioridade Absoluta!)
    // 3.1 Verifica se o código lido pertence a Fardo / Kit
    const produtoFardo = produtos.find(p => p.codigoBarrasFardo && String(p.codigoBarrasFardo).trim().toUpperCase() === codNormalizado);
    if (produtoFardo) {
      const res = this.adicionarAoCarrinho(produtoFardo, quantidade, true, 'scanner');
      if (res !== false) this.tocarSomBeep(true);
      return;
    }

    // 3.2 Verifica Unidade ou ID exato (inclusive códigos que iniciam com '2', EAN-13, EAN-8 ou internos)
    const produtoExato = produtos.find(p => 
      String(p.codigoBarras || '').trim().toUpperCase() === codNormalizado || 
      String(p.id || '').trim().toUpperCase() === codNormalizado
    );

    if (produtoExato) {
      const res = this.adicionarAoCarrinho(produtoExato, quantidade, false, 'scanner');
      if (res !== false) this.tocarSomBeep(true);
      return;
    }

    // 4. SE NÃO ENCONTROU PRODUTO COM ESSE CÓDIGO EXATO:
    // Decodifica Etiqueta de Balança (EAN-13 começando com '2')
    // Padrão Nacional: 2 [4 ou 5 dígitos de código/PLU] [6 dígitos de preço ou peso] [1 dígito verificador]
    const digitsOnly = codNormalizado.replace(/\D/g, '');
    if (digitsOnly.length === 13 && digitsOnly.startsWith('2')) {
      const codCurto5 = digitsOnly.substring(1, 6); // ex: '00123'
      const codCurto4 = digitsOnly.substring(1, 5); // ex: '0123'
      const codNum = parseInt(codCurto5, 10).toString(); // ex: '123'

      // Busca produto de balança com correspondência estrita de PLU
      // NUNCA fazer .includes(codNum) em IDs para evitar falsos positivos
      const produtoBalanca = produtos.find(p => {
        const pCod = String(p.codigoBarras || '').trim();
        const pId = String(p.id || '').trim();
        const matchPlu = (pCod === codCurto5 || pCod === codCurto4 || pCod === codNum || pId === codCurto5 || pId === codCurto4 || pId === codNum);
        if (!matchPlu) return false;
        return p.permiteFracionado === true || (p.unidade && p.unidade.toLowerCase() === 'kg') || StorageService.isModuloAtivo('balancaPeso');
      });

      if (produtoBalanca) {
        const valorOuPesoStr = digitsOnly.substring(6, 12);
        const valorCentavos = parseInt(valorOuPesoStr, 10);
        const isPorPeso = (produtoBalanca.unidade && produtoBalanca.unidade.toLowerCase() === 'kg') || produtoBalanca.permiteFracionado;

        let qtdCalculada = 1;
        if (isPorPeso) {
          qtdCalculada = parseFloat((valorCentavos / 1000).toFixed(3));
        } else {
          const totalEtiqueta = valorCentavos / 100;
          const precoUnit = parseFloat(produtoBalanca.precoVenda) || 1;
          qtdCalculada = parseFloat((totalEtiqueta / precoUnit).toFixed(3));
        }

        const res = this.adicionarAoCarrinho(produtoBalanca, qtdCalculada, false, 'scanner');
        if (res !== false) {
          this.tocarSomBeep(true);
          window.App.showToast(`⚖️ Balança: "${produtoBalanca.nome}" (${qtdCalculada} un) adicionado!`, 'success');
        }
        return;
      }
    }

    // 5. Se não encontrou por nenhuma das formas
    this.tocarSomBeep(false);
    window.App.showToast(`Produto não encontrado para o código: ${codigo}`, 'error');
  },

  adicionarAoCarrinho(produto, quantidade = 1, isFardo = false, origem = 'busca') {
    const turnoAtual = StorageService.getTurnoAtual();
    if (!turnoAtual) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🔒 Caixa Fechado! É necessário abrir o turno de caixa para adicionar produtos ao carrinho.', 'warning');
      }
      this.tocarSomBeep(false);

      const modalCaixa = document.getElementById('modal-abrir-caixa');
      if (modalCaixa) {
        modalCaixa.classList.add('active');
      } else if (window.App && typeof window.App.trocarAba === 'function') {
        window.App.trocarAba('caixa');
      }
      return false;
    }

    // 1. Validação de Venda Fracionada / Decimal
    const isDecimal = !Number.isInteger(quantidade);
    const permiteFracionado = produto.permiteFracionado === true || (produto.unidade && produto.unidade.toLowerCase() === 'kg');
    if (isDecimal && !permiteFracionado && !isFardo) {
      window.App.showToast(`⚠️ "${produto.nome}" não aceita venda fracionada. Digite uma quantidade inteira (1, 2, 3...)!`, 'warning');
      this.tocarSomBeep(false);
      return false;
    }

    // 2. Validação Rigorosa de Validade Vencida (Bloqueio Sanitário & PROCON)
    if (produto.dataValidade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataVal = new Date(produto.dataValidade + 'T00:00:00');
      const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));

      if (diffDias < 0) {
        this.tocarSomBeep(false);
        const dataFormatada = dataVal.toLocaleDateString('pt-BR');
        const diasVencido = Math.abs(diffDias);

        if (window.App && typeof window.App.confirmarAcao === 'function') {
          window.App.confirmarAcao({
            titulo: '🚨 PRODUTO COM VALIDADE VENCIDA!',
            mensagem: `O item <strong>"${produto.nome}"</strong> está vencido desde <strong>${dataFormatada}</strong> (há ${diasVencido} ${diasVencido === 1 ? 'dia' : 'dias'}).<br><br><span style="font-size: 13px; color: #dc2626; background: #fef2f2; border: 1px solid #fca5a5; padding: 10px 14px; border-radius: 8px; display: block; font-weight: 700; line-height: 1.4;">⛔ Venda Bloqueada no PDV: Por normas do PROCON e da Vigilância Sanitária (Art. 18 do CDC), é estritamente proibida a comercialização de produtos fora do prazo de validade.</span>`,
            icone: '🚨',
            corIcone: '#dc2626',
            bgIcone: '#fee2e2',
            textoConfirmar: 'Entendido [ENTER]',
            textoCancelar: '',
            perigo: true,
            onConfirm: () => {
              this.focarInputLeitor();
            }
          });
        } else {
          alert(`🚨 PRODUTO COM VALIDADE VENCIDA!\n\n"${produto.nome}" venceu em ${dataFormatada} (há ${diasVencido} dias).\nVenda bloqueada no PDV!`);
          this.focarInputLeitor();
        }
        return;
      }
    }

    const itemExistente = this.carrinho.find(i => i.id === produto.id && i.isFardo === isFardo);

    // Validação Rigorosa de Estoque para produtos com controle ativo
    const controlaEstoque = produto.controlarEstoque !== false;
    if (controlaEstoque) {
      const fator = isFardo ? (parseInt(produto.fatorConversao, 10) || 1) : 1;
      const qtdAtualNoCarrinho = itemExistente ? itemExistente.quantidade : 0;
      const qtdTotalNecessaria = (qtdAtualNoCarrinho + quantidade) * fator;
      const estoqueDisponivel = parseFloat(produto.estoque) || 0;

      if (estoqueDisponivel <= 0) {
        window.App.showToast(`⚠️ Produto esgotado! "${produto.nome}" está com estoque zerado.`, 'warning');
        this.tocarSomBeep(false);
        return false;
      }

      if (qtdTotalNecessaria > estoqueDisponivel) {
        window.App.showToast(`⚠️ Estoque insuficiente! "${produto.nome}" possui apenas ${estoqueDisponivel} un em estoque.`, 'warning');
        this.tocarSomBeep(false);
        return false;
      }
    }

    const precoUnitario = isFardo && produto.precoFardo ? produto.precoFardo : produto.precoVenda;

    if (itemExistente) {
      itemExistente.quantidade += quantidade;
    } else {
      this.carrinho.push({
        id: produto.id,
        nome: produto.nome + (isFardo ? ` [${produto.unidadeFracionada || 'Fardo'}]` : ''),
        codigoBarras: produto.codigoBarras,
        categoria: produto.categoria || 'Geral',
        precoUnitario: precoUnitario,
        quantidade: quantidade,
        isFardo: isFardo
      });
    }

    const classicCodigo = document.getElementById('classic-codigo-barras');
    const classicUnit = document.getElementById('classic-valor-unitario');
    const classicTotalItem = document.getElementById('classic-total-item');
    if (classicCodigo) classicCodigo.textContent = produto.codigoBarras || produto.id || '';
    if (classicUnit) classicUnit.textContent = precoUnitario.toFixed(2).replace('.', ',');
    if (classicTotalItem) classicTotalItem.textContent = (precoUnitario * quantidade).toFixed(2).replace('.', ',');

    this.renderCarrinho();
    if (this.carrinho.length === 1 && !this.clubePerguntaExibida && StorageService.isModuloAtivo('clubeFidelidade')) {
      this.clubePerguntaExibida = true;
      this.abrirPerguntaClubeFidelidade();
    }
    return true;
  },

  abrirPerguntaClubeFidelidade() {
    this._aberturaPerguntaClubeTimestamp = Date.now();
    const modal = document.getElementById('modal-pergunta-clube');
    if (modal) modal.classList.add('active');
  },

  responderPerguntaClube(aceitou) {
    const modal = document.getElementById('modal-pergunta-clube');
    if (modal) modal.classList.remove('active');
    if (aceitou) {
      this.abrirModalClubeFidelidade();
    } else {
      this.focarInputLeitor();
    }
  },

  alterarQuantidade(index, delta) {
    const item = this.carrinho[index];
    if (!item) return;

    if (delta > 0) {
      const produtos = StorageService.getProdutos();
      const prod = produtos.find(p => p.id === item.id);
      if (prod && prod.controlarEstoque !== false) {
        const fator = item.isFardo ? (parseInt(prod.fatorConversao, 10) || 1) : 1;
        const novaQtdTotal = (item.quantidade + delta) * fator;
        const estoqueDisponivel = parseFloat(prod.estoque) || 0;

        if (novaQtdTotal > estoqueDisponivel) {
          window.App.showToast(`⚠️ Limite de estoque atingido! "${prod.nome}" possui apenas ${estoqueDisponivel} un em estoque.`, 'warning');
          this.tocarSomBeep(false);
          return;
        }
      }
    }

    item.quantidade += delta;
    if (item.quantidade <= 0) {
      this.removerItem(index);
    } else {
      this.renderCarrinho();
    }
  },

  removerItem(index) {
    AuthModule.executarComPermissaoOuPin('cancelarItem', () => {
      this.carrinho.splice(index, 1);
      this.renderCarrinho();
      this.tocarSomBeep(false);
    }, 'Autorização: Cancelar Item');
  },

  solicitarCancelarCarrinho() {
    if (this.carrinho.length === 0) {
      window.App.showToast('O carrinho já está vazio!', 'info');
      return;
    }

    AuthModule.executarComPermissaoOuPin('cancelarVenda', () => {
      const msgEl = document.getElementById('cancelar-carrinho-msg');
      const totalItens = this.carrinho.reduce((acc, i) => acc + i.quantidade, 0);
      const totais = this.calcularTotais();

      if (msgEl) {
        msgEl.innerHTML = `Tem certeza que deseja cancelar e remover <strong>${totalItens} item(ns)</strong> (Total: <strong>R$ ${totais.total.toFixed(2).replace('.', ',')}</strong>) do carrinho?`;
      }

      const modal = document.getElementById('modal-confirmar-cancelar-carrinho');
      if (modal) modal.classList.add('active');
    }, 'Autorização: Cancelar Venda [ESC]');
  },

  fecharModalCancelarCarrinho() {
    const modal = document.getElementById('modal-confirmar-cancelar-carrinho');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  confirmarCancelamentoCarrinho() {
    const totalItens = this.carrinho.reduce((acc, i) => acc + i.quantidade, 0);
    const totais = this.calcularTotais();
    const itensNomes = this.carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ');

    // Log de Auditoria
    AuditModule.registrarLog('cancelamento_venda', `Cancelou venda em andamento no PDV (${totalItens} itens, Total R$ ${totais.total.toFixed(2)}): ${itensNomes}`, {
      totalItens: totalItens,
      valorTotal: totais.total,
      itens: this.carrinho
    });

    this.limparCarrinho();
    this.fecharModalCancelarCarrinho();
    window.App.showToast('Venda cancelada e carrinho limpo com sucesso!', 'info');
  },
  
  abrirModalDesconto() {
    const totais = this.calcularTotais();
    if (totais.subtotal <= 0) {
      window.App.showToast('Adicione produtos ao carrinho antes de conceder desconto!', 'warning');
      return;
    }

    AuthModule.executarComPermissaoOuPin('darDesconto', () => {
      const modal = document.getElementById('modal-desconto-pdv');
      const displaySub = document.getElementById('desconto-subtotal-display');
      const inputVal = document.getElementById('input-desconto-valor');

      if (displaySub) displaySub.textContent = `R$ ${totais.subtotal.toFixed(2).replace('.', ',')}`;
      if (inputVal) {
        inputVal.value = this.desconto > 0 ? this.desconto : '';
        setTimeout(() => { inputVal.focus(); inputVal.select(); }, 60);
      }
      if (modal) modal.classList.add('active');
    }, 'Autorização: Conceder Desconto');
  },

  fecharModalDesconto() {
    const modal = document.getElementById('modal-desconto-pdv');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  setTipoDesconto(tipo) {
    this.tipoDescontoAtual = tipo;
    const btnReal = document.getElementById('btn-tipo-desc-real');
    const btnPorc = document.getElementById('btn-tipo-desc-porc');
    if (btnReal) btnReal.classList.toggle('active', tipo === 'real');
    if (btnPorc) btnPorc.classList.toggle('active', tipo === 'porc');
    const inputVal = document.getElementById('input-desconto-valor');
    if (inputVal) inputVal.focus();
  },

  confirmarDesconto() {
    const inputVal = document.getElementById('input-desconto-valor');
    const rawVal = parseFloat(inputVal ? inputVal.value : 0) || 0;
    const totais = this.calcularTotais();
    let descFinal = 0;

    if (this.tipoDescontoAtual === 'porc') {
      descFinal = parseFloat(((totais.subtotal * rawVal) / 100).toFixed(2));
    } else {
      descFinal = rawVal;
    }

    if (descFinal < 0) descFinal = 0;
    if (descFinal > totais.subtotal) {
      window.App.showToast('O desconto não pode ser maior que o valor total dos produtos!', 'error');
      return;
    }

    this.desconto = descFinal;
    this.renderCarrinho();
    this.fecharModalDesconto();

    if (descFinal > 0) {
      window.App.showToast(`🏷️ Desconto de R$ ${descFinal.toFixed(2).replace('.', ',')} aplicado com sucesso!`, 'success');
      AuditModule.registrarLog('desconto_concedido', `Concedeu desconto de R$ ${descFinal.toFixed(2)} no carrinho (Subtotal: R$ ${totais.subtotal.toFixed(2)})`, {
        desconto: descFinal,
        subtotal: totais.subtotal
      });
    } else {
      window.App.showToast('Desconto removido.', 'info');
    }
  },

  abrirModalReimpressaoCupom() {
    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('reimprimirCupons', () => {
        this.executarAberturaModalReimpressaoCupom();
      }, 'Autorização: Reimprimir Cupons');
    } else {
      this.executarAberturaModalReimpressaoCupom();
    }
  },

  reimpressaoHighlightedIndex: 0,
  reimpressaoFiltradas: [],

  executarAberturaModalReimpressaoCupom() {
    const modal = document.getElementById('modal-reimpressao-cupom-pdv');
    const inputBusca = document.getElementById('reimpressao-busca-input');
    if (inputBusca) {
      inputBusca.value = '';
      if (!inputBusca.dataset.hasKeyNav) {
        inputBusca.dataset.hasKeyNav = 'true';
        inputBusca.addEventListener('keydown', (e) => this.handleReimpressaoKeydown(e));
      }
    }

    this.reimpressaoHighlightedIndex = 0;
    this.renderListaReimpressaoCupons();

    if (modal) {
      modal.classList.add('active');
      if (inputBusca) {
        setTimeout(() => inputBusca.focus(), 80);
      }
    }
  },

  handleReimpressaoKeydown(e) {
    if (!this.reimpressaoFiltradas || this.reimpressaoFiltradas.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.reimpressaoHighlightedIndex < this.reimpressaoFiltradas.length - 1) {
        this.reimpressaoHighlightedIndex++;
        this.atualizarHighlightReimpressao();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.reimpressaoHighlightedIndex > 0) {
        this.reimpressaoHighlightedIndex--;
        this.atualizarHighlightReimpressao();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const v = this.reimpressaoFiltradas[this.reimpressaoHighlightedIndex];
      if (v) {
        this.reimprimirCupomVendaEspecifica(v.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      this.fecharModalReimpressaoCupom();
    }
  },

  atualizarHighlightReimpressao() {
    const lista = document.getElementById('reimpressao-ultimas-vendas-lista');
    if (!lista) return;
    const cards = lista.querySelectorAll('.reimpressao-venda-card');
    cards.forEach((card, idx) => {
      const btn = card.querySelector('.btn-reimprimir-cupom-action');
      if (idx === this.reimpressaoHighlightedIndex) {
        card.classList.add('selected');
        if (btn) btn.classList.add('btn-focused');
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        card.classList.remove('selected');
        if (btn) btn.classList.remove('btn-focused');
      }
    });
  },

  fecharModalReimpressaoCupom() {
    const modal = document.getElementById('modal-reimpressao-cupom-pdv');
    if (modal) modal.classList.remove('active');
    window._ultimoModalFechadoTimestamp = Date.now();
    this.focarInputLeitor();
  },

  filtrarReimpressaoCupons(termo) {
    this.reimpressaoHighlightedIndex = 0;
    this.renderListaReimpressaoCupons(termo);
  },

  renderListaReimpressaoCupons(filtro = '') {
    const lista = document.getElementById('reimpressao-ultimas-vendas-lista');
    const contadorEl = document.getElementById('reimpressao-total-contador');
    if (!lista) return;

    const vendas = StorageService.getVendas() || [];
    const termo = String(filtro || '').toLowerCase().trim();

    let filtradas = vendas;
    if (termo) {
      filtradas = vendas.filter(v => {
        const id = String(v.id || '').toLowerCase();
        const forma = String(v.formaPagamento || '').toLowerCase();
        const operador = String(v.operador || '').toLowerCase();
        const total = (parseFloat(v.total) || 0).toFixed(2).replace('.', ',');
        const itensNomes = (v.itens || []).map(i => (i.nome || '').toLowerCase()).join(' ');
        return id.includes(termo) || forma.includes(termo) || operador.includes(termo) || total.includes(termo) || itensNomes.includes(termo);
      });
    }

    if (contadorEl) {
      contadorEl.textContent = `Exibindo ${Math.min(filtradas.length, 25)} de ${vendas.length} vendas registradas`;
    }

    if (filtradas.length === 0) {
      this.reimpressaoFiltradas = [];
      lista.innerHTML = `
        <div style="text-align: center; padding: 36px 20px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
          <div style="font-size: 40px; margin-bottom: 8px;">🧾</div>
          <strong style="font-size: 15px; color: var(--text-main); display: block;">Nenhuma venda encontrada</strong>
          <span style="font-size: 12px; color: var(--text-muted); display: block; margin-top: 4px;">Tente pesquisar por outro termo ou número de venda.</span>
        </div>
      `;
      return;
    }

    const ultimas = filtradas.slice(0, 25);
    this.reimpressaoFiltradas = ultimas;
    lista.innerHTML = ultimas.map((v) => {
      const dataObj = new Date(v.data);
      const dataFmt = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const horaFmt = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const totalItens = (v.itens || []).reduce((acc, i) => acc + (i.quantidade || 1), 0);
      const resumoItens = (v.itens || []).map(i => `${i.quantidade}x ${i.nome}`).slice(0, 3).join(', ') + ((v.itens || []).length > 3 ? '...' : '');

      let badgePag = '<span class="reimpressao-card-badge" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;">💵 Dinheiro</span>';
      if (v.formaPagamento === 'PIX') {
        badgePag = '<span class="reimpressao-card-badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">📱 PIX</span>';
      } else if (v.formaPagamento === 'Débito' || v.formaPagamento === 'Crédito') {
        badgePag = `<span class="reimpressao-card-badge" style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe;">💳 ${v.formaPagamento}</span>`;
      } else if (v.formaPagamento === 'Voucher') {
        badgePag = '<span class="reimpressao-card-badge" style="background: #fdf4ff; color: #86198f; border: 1px solid #f0abfc;">🎫 Voucher</span>';
      } else if (v.formaPagamento === 'Fiado') {
        badgePag = '<span class="reimpressao-card-badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">📋 Fiado</span>';
      } else if (v.pagamentoDividido || String(v.formaPagamento).includes('Multi')) {
        badgePag = '<span class="reimpressao-card-badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">⚡ Multi-Pagto</span>';
      }

      return `
        <div class="reimpressao-venda-card">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              <span class="reimpressao-card-id">#${(v.id || '').slice(-6)}</span>
              <span style="font-size: 11.5px; color: #64748b; font-weight: 700;">📅 ${dataFmt} às ${horaFmt}</span>
              ${badgePag}
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">👤 ${v.operador || 'Caixa'}</span>
            </div>
            <div style="font-size: 12px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${resumoItens}">
              🛒 <strong>${totalItens} ${totalItens === 1 ? 'item' : 'itens'}:</strong> ${resumoItens || 'Venda sem itens detalhados'}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
            <div style="text-align: right;">
              <span style="font-size: 10px; color: #64748b; font-weight: 700; display: block; text-transform: uppercase;">Total</span>
              <strong style="font-size: 17px; font-weight: 900; font-family: 'JetBrains Mono'; color: #059669;">
                R$ ${(parseFloat(v.total) || 0).toFixed(2).replace('.', ',')}
              </strong>
            </div>
            <button type="button" class="btn-reimprimir-cupom-action" onclick="PdvModule.reimprimirCupomVendaEspecifica('${v.id}')" title="Reimprimir comprovante térmico desta venda">
              <span>🖨️</span>
              <span>Reimprimir</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.atualizarHighlightReimpressao();
  },

  reimprimirCupomVendaEspecifica(vendaId) {
    const vendas = StorageService.getVendas() || [];
    const v = vendas.find(item => item.id === vendaId);
    if (!v) {
      window.App.showToast('Venda não encontrada!', 'error');
      return;
    }
    if (window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirCupomVenda === 'function') {
      window.ThermalPrintModule.imprimirCupomVenda(v);
      window.App.showToast(`🖨️ Imprimindo 2ª via da venda #${(v.id || '').slice(-6)}...`, 'success');
      this.fecharModalReimpressaoCupom();
    } else {
      window.App.showToast(`🖨️ Comprovante da venda #${(v.id || '').slice(-6)} impresso com sucesso!`, 'info');
      this.fecharModalReimpressaoCupom();
    }
  },

  limparCarrinho() {
    this.carrinho = [];
    this.clubePerguntaExibida = false;
    this.clienteClubeAtivo = null;
    this.desconto = 0;
    this.renderCarrinho();
    this.focarInputLeitor();

    // Resetar campos visuais do layout clássico
    const resetIds = [
      ['classic-codigo-barras', ''],
      ['classic-valor-unitario', '0,00'],
      ['classic-total-item', '0,00']
    ];
    resetIds.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  },

  calcularTotais() {
    let subtotal = 0;
    let descontoClube = 0;
    const produtosDb = StorageService.getProdutos() || [];
    const clubeAtivo = StorageService.isModuloAtivo('clubeFidelidade');

    this.carrinho.forEach((item) => {
      subtotal += (item.precoUnitario * item.quantidade);
      
      if (clubeAtivo && this.clienteClubeAtivo) {
         const p = produtosDb.find(prod => prod.id === item.id);
         if (p && p.precoClube && parseFloat(p.precoClube) > 0 && parseFloat(p.precoClube) < item.precoUnitario) {
            descontoClube += ((item.precoUnitario - parseFloat(p.precoClube)) * item.quantidade);
         }
      }
    });

    const totalItens = this.carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    const totalDescontos = this.desconto + descontoClube;
    const total = Math.max(0, subtotal - totalDescontos);

    return { subtotal, totalItens, total, desconto: this.desconto, descontoClube };
  },

  renderCarrinho() {
    const tbody = document.getElementById('pdv-itens-tbody');
    const totalEl = document.getElementById('pdv-total-display');
    const subtotalEl = document.getElementById('pdv-subtotal-display');
    const countEl = document.getElementById('pdv-items-count-badge');
    const totalItensBox = document.getElementById('pdv-total-itens-box');

    const totais = this.calcularTotais();

    if (totalEl) totalEl.textContent = `R$ ${totais.total.toFixed(2).replace('.', ',')}`;
    if (subtotalEl) subtotalEl.textContent = `R$ ${totais.subtotal.toFixed(2).replace('.', ',')}`;
    if (countEl) countEl.textContent = `${totais.totalItens} ${totais.totalItens === 1 ? 'item' : 'itens'}`;
    if (totalItensBox) totalItensBox.textContent = totais.totalItens;

    const classicSubtotalEl = document.getElementById('classic-subtotal');
    if (classicSubtotalEl) classicSubtotalEl.textContent = totais.subtotal.toFixed(2).replace('.', ',');
    const classicQtdItensEl = document.getElementById('classic-qtd-itens');
    if (classicQtdItensEl) classicQtdItensEl.textContent = totais.totalItens;
    const classicTotalVendaEl = document.getElementById('classic-total-venda');
    if (classicTotalVendaEl) classicTotalVendaEl.textContent = totais.total.toFixed(2).replace('.', ',');

    const descontoBox = document.getElementById('pdv-desconto-box');
    const descontoDisplay = document.getElementById('pdv-desconto-display');
    if (descontoBox && descontoDisplay) {
      const totalDescontos = totais.desconto + (totais.descontoClube || 0);
      if (totalDescontos > 0) {
        descontoBox.style.display = 'block';
        let htmlDesc = `- R$ ${totalDescontos.toFixed(2).replace('.', ',')}`;
        if (totais.descontoClube > 0) {
           htmlDesc += `<br><span style="font-size: 11px; color: #b45309;">(Clube: R$ ${totais.descontoClube.toFixed(2).replace('.', ',')})</span>`;
        }
        descontoDisplay.innerHTML = htmlDesc;
      } else {
        descontoBox.style.display = 'none';
      }
    }

    if (!tbody) return;

    if (this.carrinho.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-dim);">
            <div style="font-size: 36px; margin-bottom: 8px;">🛒</div>
            <strong>Caixa Pronto para Nova Venda</strong>
            <p style="font-size: 12px; margin-top: 4px;">Passe o código de barras no leitor ou tecle <strong>[F2]</strong> para buscar.</p>
          </td>
        </tr>
      `;
    } else {
      let linhasHTML = this.carrinho.map((item, idx) => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; font-family: 'JetBrains Mono'; font-weight: 800; font-size: 11px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">#${idx + 1}</span>
              <div>
                <span class="item-code-tag">${item.codigoBarras || item.id}</span>
                <span class="item-name-bold">${item.nome}</span>
              </div>
            </div>
          </td>
          <td>R$ ${item.precoUnitario.toFixed(2).replace('.', ',')}</td>
          <td>
            <div class="item-qty-control">
              <button type="button" class="btn-qty" onclick="PdvModule.alterarQuantidade(${idx}, -1)">-</button>
              <strong style="min-width: 24px; text-align: center; font-family: 'JetBrains Mono';">${Number.isInteger(item.quantidade) ? item.quantidade : item.quantidade.toFixed(3).replace(/\.?0+$/, '')}</strong>
              <button type="button" class="btn-qty" onclick="PdvModule.alterarQuantidade(${idx}, 1)">+</button>
            </div>
          </td>
          <td style="font-weight: 800; font-family: 'JetBrains Mono'; color: var(--accent-green);">
            R$ ${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn-remove-item" onclick="PdvModule.excluirItemPorIndice(${idx})" title="Remover item #${idx + 1}">🗑️</button>
          </td>
        </tr>
      `).join('');

      const totalDesc = totais.desconto + (totais.descontoClube || 0);
      if (totalDesc > 0) {
        let descLabel = totais.descontoClube > 0 ? (totais.desconto > 0 ? '🎁 Desconto + Clube' : '🎁 Desconto Clube') : '🎁 Desconto Aplicado';
        linhasHTML += `
          <tr style="background: #fef2f2;">
            <td colspan="3" style="text-align: right; font-weight: 800; color: #dc2626; padding-right: 16px; border-bottom: none;">
              ${descLabel}
            </td>
            <td colspan="2" style="font-weight: 800; color: #dc2626; font-family: 'JetBrains Mono'; border-bottom: none;">
              - R$ ${totalDesc.toFixed(2).replace('.', ',')}
            </td>
          </tr>
        `;
      }
      tbody.innerHTML = linhasHTML;
    }

    // Atualiza tabela clássica
    const classicTbody = document.getElementById('classic-pdv-itens-tbody');
    if (classicTbody) {
      if (this.carrinho.length === 0) {
        classicTbody.innerHTML = '';
      } else {
        let classicLinhasHTML = this.carrinho.map((item, idx) => `
          <tr>
            <td style="font-weight: bold;">${String(idx + 1).padStart(3, '0')}</td>
            <td>${item.codigoBarras || item.id}</td>
            <td style="font-weight: bold;">${item.nome}</td>
            <td style="text-align: center;">${Number.isInteger(item.quantidade) ? item.quantidade : item.quantidade.toFixed(3).replace(/\.?0+$/, '')}</td>
            <td style="text-align: right;">${item.precoUnitario.toFixed(2).replace('.', ',')}</td>
            <td style="text-align: right; font-weight: bold;">${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}</td>
          </tr>
        `).join('');
        
        const totalDescClassic = totais.desconto + (totais.descontoClube || 0);
        if (totalDescClassic > 0) {
           let descLabel = totais.descontoClube > 0 ? (totais.desconto > 0 ? 'Desconto + Clube' : 'Desconto Clube') : 'Desconto Aplicado';
           classicLinhasHTML += `
             <tr class="classic-tr-desconto" style="background: rgba(220, 38, 38, 0.08);">
               <td colspan="5" class="classic-desconto-label" style="grid-column: 1 / 6; text-align: right; font-weight: 800; color: #dc2626; padding-right: 12px; white-space: nowrap;">${descLabel}</td>
               <td class="classic-desconto-valor" style="grid-column: 6 / 7; font-weight: 800; color: #dc2626; text-align: right; white-space: nowrap;">- R$ ${totalDescClassic.toFixed(2).replace('.', ',')}</td>
             </tr>
           `;
        }
        
        classicTbody.innerHTML = classicLinhasHTML;
        const classicTableContainer = classicTbody.closest('.classic-table-container');
        if (classicTableContainer) classicTableContainer.scrollTop = classicTableContainer.scrollHeight;
      }
    }

    // Atualiza status do layout clássico de forma centralizada
    this.atualizarStatusClassico();
  },

  // Modal: Cancelar Item Específico do Carrinho [F8 / DEL]
  atualizarQtdMaximaCancelamento() {
    const inputNum = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    const detalhe = document.getElementById('cancelar-item-detalhe-selecionado');
    const num = parseInt(inputNum ? inputNum.value : '', 10);

    if (!isNaN(num) && num >= 1 && num <= this.carrinho.length) {
      const item = this.carrinho[num - 1];
      if (inputQtd) {
        inputQtd.max = item.quantidade;
        if (parseFloat(inputQtd.value) > item.quantidade || !inputQtd.value || parseFloat(inputQtd.value) <= 0) {
          inputQtd.value = 1;
        }
      }
      if (detalhe) {
        detalhe.style.display = 'block';
        detalhe.innerHTML = `📌 Item #${num}: <strong>${item.nome}</strong> (Qtd total no carrinho: <strong>${item.quantidade} un</strong> - Total: <strong>R$ ${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}</strong>)`;
      }
    } else {
      if (detalhe) detalhe.style.display = 'none';
    }
  },

  abrirModalCancelarItem() {
    if (!this.carrinho || this.carrinho.length === 0) {
      window.App.showToast('O carrinho está vazio! Não há itens para cancelar.', 'warning');
      return;
    }

    const modal = document.getElementById('modal-cancelar-item-carrinho');
    if (modal && modal.classList.contains('active')) {
      this.executarAberturaModalCancelarItem();
      return;
    }

    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('cancelarItem', () => {
        this.executarAberturaModalCancelarItem();
      }, 'Autorização: Cancelar Item');
    } else {
      this.executarAberturaModalCancelarItem();
    }
  },

  executarAberturaModalCancelarItem() {
    const modal = document.getElementById('modal-cancelar-item-carrinho');
    const lista = document.getElementById('cancelar-item-lista-tbody');
    const countBadge = document.getElementById('cancelar-item-total-badge');
    const input = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');

    if (countBadge) countBadge.textContent = `${this.carrinho.length} item(ns)`;

    if (lista) {
      lista.innerHTML = this.carrinho.map((item, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; cursor: pointer; transition: all 0.15s ease;" onclick="PdvModule.selecionarItemParaCancelar(${idx})" onmouseover="this.style.borderColor='#f87171'; this.style.background='#fef2f2';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#ffffff';">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; padding-right: 12px;">
            <span style="background: #0f172a; color: #38bdf8; font-family: 'JetBrains Mono'; font-weight: 900; font-size: 12px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0;">#${idx + 1}</span>
            <div style="min-width: 0;">
              <strong style="font-size: 13.5px; color: var(--text-main); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nome}</strong>
              <span style="font-size: 11.5px; color: var(--text-muted);">Qtd no carrinho: <strong style="color: #0f172a;">${item.quantidade} un</strong> × R$ ${item.precoUnitario.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
            <div style="text-align: right; min-width: 85px;">
              <strong style="font-size: 14.5px; font-family: 'JetBrains Mono'; color: #059669; display: block;">R$ ${(item.precoUnitario * item.quantidade).toFixed(2).replace('.', ',')}</strong>
              <span style="font-size: 11px; color: var(--text-muted);">${item.quantidade > 1 ? item.quantidade + ' un' : '1 un'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${item.quantidade > 1 ? `
                <button type="button" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; height: 32px; padding: 0 10px; font-size: 11.5px; font-weight: 800; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; transition: all 0.15s ease;" onclick="event.stopPropagation(); PdvModule.excluirItemPorIndice(${idx}, 1);" title="Remover apenas 1 unidade deste item">
                  -1 Un.
                </button>
              ` : ''}
              <button type="button" style="background: #ef4444; color: #ffffff; border: none; height: 32px; padding: 0 10px; font-size: 11.5px; font-weight: 800; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25); transition: all 0.15s ease;" onclick="event.stopPropagation(); PdvModule.excluirItemPorIndice(${idx});" title="Remover item #${idx + 1} do carrinho">
                🗑️ Remover
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (modal) modal.classList.add('active');
    if (input) {
      input.value = this.carrinho.length;
      if (inputQtd) inputQtd.value = 1;
      this.atualizarQtdMaximaCancelamento();
      setTimeout(() => {
        input.focus();
        input.select();
      }, 80);
    }
  },

  selecionarItemParaCancelar(idx) {
    const input = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    if (input) input.value = idx + 1;
    if (inputQtd) inputQtd.value = 1;
    this.atualizarQtdMaximaCancelamento();
    if (inputQtd) {
      inputQtd.focus();
      inputQtd.select();
    }
  },

  fecharModalCancelarItem() {
    const modal = document.getElementById('modal-cancelar-item-carrinho');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  confirmarExclusaoItemPorNumero() {
    const inputNum = document.getElementById('input-cancelar-item-num');
    const inputQtd = document.getElementById('input-cancelar-item-qtd');
    const num = parseInt(inputNum ? inputNum.value : '', 10);
    const qtd = parseFloat(inputQtd ? inputQtd.value : '1') || 1;

    if (isNaN(num) || num < 1 || num > this.carrinho.length) {
      window.App.showToast(`Digite um número válido de item (entre 1 e ${this.carrinho.length})!`, 'warning');
      if (inputNum) { inputNum.focus(); inputNum.select(); }
      return;
    }

    if (isNaN(qtd) || qtd <= 0) {
      window.App.showToast('Digite uma quantidade válida para remover!', 'warning');
      if (inputQtd) { inputQtd.focus(); inputQtd.select(); }
      return;
    }

    this.excluirItemPorIndice(num - 1, qtd);
  },

  excluirItemPorIndice(idx, qtd = null) {
    if (idx < 0 || idx >= this.carrinho.length) return;
    const item = this.carrinho[idx];
    if (!item) return;

    const qtdRemover = qtd !== null ? Math.min(parseFloat(qtd) || 1, item.quantidade) : item.quantidade;

    const acaoRemover = () => {
      const nomeItem = item.nome;
      const qtdAnterior = item.quantidade;
      const valorRemovido = item.precoUnitario * qtdRemover;

      if (qtdRemover >= item.quantidade) {
        // Remove o item inteiro
        this.carrinho.splice(idx, 1);
        window.App.showToast(`Item #${idx + 1} (${nomeItem}) removido do carrinho!`, 'info');
      } else {
        // Reduz a quantidade mantendo o restante
        item.quantidade = parseFloat((item.quantidade - qtdRemover).toFixed(3));
        window.App.showToast(`Removido ${qtdRemover} un de "${nomeItem}" (Restam ${item.quantidade} un)!`, 'info');
      }

      this.renderCarrinho();

      const modal = document.getElementById('modal-cancelar-item-carrinho');
      if (modal && modal.classList.contains('active')) {
        this.fecharModalCancelarItem();
      }

      // Log de auditoria detalhado
      if (window.AuditModule && typeof window.AuditModule.registrarLog === 'function') {
        AuditModule.registrarLog('cancelamento_item', `Cancelou ${qtdRemover} un do item #${idx + 1} "${nomeItem}" (R$ ${valorRemovido.toFixed(2)}). Qtd anterior: ${qtdAnterior}, Restante: ${qtdRemover >= qtdAnterior ? 0 : item.quantidade}`, {
          itemNome: nomeItem,
          qtdRemovida: qtdRemover,
          valorRemovido: valorRemovido,
          indice: idx + 1
        });
      }
    };

    const modalAberto = document.getElementById('modal-cancelar-item-carrinho');
    const jaAutorizadoNestaTela = modalAberto && modalAberto.classList.contains('active');
    if (jaAutorizadoNestaTela) {
      acaoRemover();
      return;
    }

    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('cancelarItem', acaoRemover, `Autorização: Cancelar ${qtdRemover} un de "${item.nome}"`);
    } else {
      acaoRemover();
    }
  },

  filtroCategoriaBusca: 'todos',

  f2HighlightedIndex: 0,
  f2ModoFardo: false,
  f2ProdutosFiltrados: [],

  // Modal de Busca Rápida [F2]
  abrirBuscaProdutos() {
    const modal = document.getElementById('modal-busca-produtos');
    const input = document.getElementById('busca-rapida-input');
    if (modal) {
      modal.classList.add('active');
      this.filtroCategoriaBusca = 'todos';
      this.renderChipsCategoriasBusca();
      this.f2HighlightedIndex = 0;
      this.f2ModoFardo = false;
      if (input) {
        input.value = '';
        if (!input.dataset.hasKeyNav) {
          input.dataset.hasKeyNav = 'true';
          input.addEventListener('keydown', (e) => this.handleBuscaRapidaKeydown(e));
        }
        setTimeout(() => input.focus(), 80);
      }
      this.renderResultadosBusca('');
    }
  },

  handleBuscaRapidaKeydown(e) {
    if (!this.f2ProdutosFiltrados || this.f2ProdutosFiltrados.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.f2HighlightedIndex < this.f2ProdutosFiltrados.length - 1) {
        this.f2HighlightedIndex++;
        const p = this.f2ProdutosFiltrados[this.f2HighlightedIndex];
        if (!p || !p.precoFardo) this.f2ModoFardo = false;
        this.atualizarHighlightBuscaRapida();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.f2HighlightedIndex > 0) {
        this.f2HighlightedIndex--;
        const p = this.f2ProdutosFiltrados[this.f2HighlightedIndex];
        if (!p || !p.precoFardo) this.f2ModoFardo = false;
        this.atualizarHighlightBuscaRapida();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const p = this.f2ProdutosFiltrados[this.f2HighlightedIndex];
      if (p && p.precoFardo) {
        this.f2ModoFardo = true;
        this.atualizarHighlightBuscaRapida();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.f2ModoFardo = false;
      this.atualizarHighlightBuscaRapida();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const p = this.f2ProdutosFiltrados[this.f2HighlightedIndex];
      if (p) {
        this.selecionarProdutoBusca(p.id, this.f2ModoFardo);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      this.fecharBuscaProdutos();
    }
  },

  atualizarHighlightBuscaRapida() {
    const lista = document.getElementById('busca-produtos-lista');
    if (!lista) return;
    const rows = lista.querySelectorAll('.f2-product-row');
    rows.forEach((row, idx) => {
      const btnUnit = row.querySelector('.f2-btn-unit');
      const btnPack = row.querySelector('.f2-btn-pack');

      if (idx === this.f2HighlightedIndex) {
        row.classList.add('selected');
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

        if (this.f2ModoFardo && btnPack) {
          btnPack.classList.add('f2-btn-focused');
          if (btnUnit) btnUnit.classList.remove('f2-btn-focused');
        } else {
          if (btnUnit) btnUnit.classList.add('f2-btn-focused');
          if (btnPack) btnPack.classList.remove('f2-btn-focused');
        }
      } else {
        row.classList.remove('selected');
        if (btnUnit) btnUnit.classList.remove('f2-btn-focused');
        if (btnPack) btnPack.classList.remove('f2-btn-focused');
      }
    });
  },

  fecharBuscaProdutos() {
    const modal = document.getElementById('modal-busca-produtos');
    if (modal) modal.classList.remove('active');
    window._ultimoModalFechadoTimestamp = Date.now();
    this.focarInputLeitor();
  },

  renderChipsCategoriasBusca() {
    const container = document.getElementById('f2-chips-container');
    if (!container) return;

    const produtos = StorageService.getProdutos() || [];
    const categoriasBase = StorageService.getCategorias() || [];
    
    // Identifica todas as categorias presentes nos produtos cadastrados
    const mapCategorias = new Map();
    
    produtos.forEach(p => {
      const cat = (p.categoria || 'Geral').trim();
      mapCategorias.set(cat, (mapCategorias.get(cat) || 0) + 1);
    });

    categoriasBase.forEach(c => {
      const cat = c.trim();
      if (!mapCategorias.has(cat)) {
        mapCategorias.set(cat, 0);
      }
    });

    let html = `
      <button type="button" class="f2-cat-chip ${this.filtroCategoriaBusca === 'todos' ? 'active' : ''}" onclick="PdvModule.selecionarCategoriaBusca('todos', this)">
        <span>⭐ Todos</span> <small style="opacity: 0.85; font-weight: 800;">(${produtos.length})</small>
      </button>
    `;

    Array.from(mapCategorias.entries()).forEach(([cat, qtd]) => {
      const icone = StorageService.getIconeCategoria ? StorageService.getIconeCategoria(cat) : '🏷️';
      const isActive = this.filtroCategoriaBusca.toLowerCase() === cat.toLowerCase();

      html += `
        <button type="button" class="f2-cat-chip ${isActive ? 'active' : ''}" onclick="PdvModule.selecionarCategoriaBusca('${cat.replace(/'/g, "\\'")}', this)">
          <span>${icone} ${cat}</span> <small style="opacity: 0.85; font-weight: 800;">(${qtd})</small>
        </button>
      `;
    });

    container.innerHTML = html;
  },

  rolarChipsF2(direcao) {
    const container = document.getElementById('f2-chips-container');
    if (!container) return;
    const scrollAmount = 180;
    if (direcao === 'esquerda') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  },

  selecionarCategoriaBusca(cat, btn) {
    this.filtroCategoriaBusca = cat;
    document.querySelectorAll('.f2-cat-chip').forEach(b => b.classList.remove('active'));
    if (btn) {
      btn.classList.add('active');
      // Rola suavemente o menu junto para trazer o item clicado para o centro
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    const input = document.getElementById('busca-rapida-input');
    this.renderResultadosBusca(input ? input.value : '');
  },

  renderResultadosBusca(termo) {
    const lista = document.getElementById('busca-produtos-lista');
    if (!lista) return;

    const produtos = StorageService.getProdutos() || [];
    const termoLower = (termo || '').toLowerCase().trim();

    let filtrados = produtos.filter(p => {
      // Filtro por Categoria inclusivo
      if (this.filtroCategoriaBusca !== 'todos') {
        const catProd = (p.categoria || 'Geral').trim().toLowerCase();
        const filtro = this.filtroCategoriaBusca.trim().toLowerCase();
        const matchCat = catProd === filtro || catProd.includes(filtro) || filtro.includes(catProd);
        if (!matchCat) return false;
      }

      if (!termoLower) return true;

      const nome = (p.nome || '').toLowerCase();
      const cod = String(p.codigoBarras || '').toLowerCase();
      const codFardo = String(p.codigoBarrasFardo || '').toLowerCase();
      const cat = (p.categoria || 'Geral').toLowerCase();
      const id = String(p.id || '').toLowerCase();

      return nome.includes(termoLower) || cod.includes(termoLower) || codFardo.includes(termoLower) || cat.includes(termoLower) || id.includes(termoLower);
    });

    // Ordenação inteligente: correspondência de início de nome e ordem alfabética
    filtrados.sort((a, b) => {
      if (termoLower) {
        const aNameStarts = (a.nome || '').toLowerCase().startsWith(termoLower);
        const bNameStarts = (b.nome || '').toLowerCase().startsWith(termoLower);
        if (aNameStarts && !bNameStarts) return -1;
        if (!aNameStarts && bNameStarts) return 1;
      }
      return (a.nome || '').localeCompare(b.nome || '');
    });

    this.f2ProdutosFiltrados = filtrados;
    if (this.f2HighlightedIndex >= filtrados.length) {
      this.f2HighlightedIndex = 0;
    }

    if (filtrados.length === 0) {
      const msgCat = this.filtroCategoriaBusca !== 'todos' ? ` na categoria <strong>${this.filtroCategoriaBusca}</strong>` : '';
      lista.innerHTML = `<div style="text-align: center; padding: 36px 20px; color: #64748b; font-size: 14px; font-weight: 600;">Nenhum produto encontrado${termoLower ? ` para "<strong>${termo}</strong>"` : ''}${msgCat}.</div>`;
      return;
    }

    // Renderiza a lista completa sem cortes
    lista.innerHTML = filtrados.map((p, idx) => {
      const controlaEstoque = p.controlarEstoque !== false && p.controlaEstoque !== false;
      const estoqueNum = parseFloat(p.estoque) || 0;
      const minNum = parseFloat(p.estoqueMinimo) || 5;
      const isEstoqueOk = controlaEstoque ? (estoqueNum > minNum) : true;
      const stockBadge = controlaEstoque
        ? `<span class="f2-col-stock ${isEstoqueOk ? 'ok' : 'low'}">📦 Estoque: <strong>${estoqueNum} un</strong></span>`
        : `<span class="f2-col-stock ok" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">♾️ Serviço / Fixo</span>`;

      const isPromo = Boolean(p.emPromocao || (p.precoPromocional && p.precoPromocional < p.precoVenda));
      const precoOriginalExibir = p.precoOriginal || (isPromo ? (p.precoVenda * 1.25) : p.precoVenda);

      let validadeBadgeF2 = '';
      if (StorageService.isModuloAtivo('validadeLotes') && p.dataValidade) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVal = new Date(p.dataValidade + 'T00:00:00');
        const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          validadeBadgeF2 = `<span style="font-size: 10.5px; color: #dc2626; font-weight: 800;">🚨 Vencido (${dataVal.toLocaleDateString('pt-BR')})</span>`;
        } else if (diffDias <= 30) {
          validadeBadgeF2 = `<span style="font-size: 10.5px; color: #d97706; font-weight: 800;">⏳ Val: ${dataVal.toLocaleDateString('pt-BR')} (${diffDias}d)</span>`;
        }
      }

      return `
        <div class="f2-product-row" data-f2-index="${idx}">
          <div class="f2-item-info">
            <div class="f2-item-title" style="display: flex; align-items: center; gap: 6px;">
              <span>${p.nome}</span>
              ${isPromo ? `<span style="background: #ea580c; color: #ffffff; font-size: 10px; font-weight: 900; padding: 1px 6px; border-radius: 4px;">🔥 PROMO</span>` : ''}
            </div>
            <div class="f2-item-sub">
              <span class="f2-col-code">Cód: <strong class="f2-code">${p.codigoBarras || '--'}</strong></span>
              <span class="f2-col-cat">🏷️ ${p.categoria || 'Geral'}</span>
              ${stockBadge}
              ${validadeBadgeF2}
            </div>
          </div>
          <div class="f2-item-actions">
            <button type="button" class="f2-btn-unit" onclick="PdvModule.selecionarProdutoBusca('${p.id}', false)" title="Adicionar 1 unidade ao carrinho [Enter]">
              <span class="f2-btn-tag">${isPromo ? '🔥 Promoção' : '+ Unidade'}</span>
              ${isPromo ? `<span style="font-size: 10.5px; text-decoration: line-through; opacity: 0.7; line-height: 1;">R$ ${precoOriginalExibir.toFixed(2).replace('.', ',')}</span>` : ''}
              <strong class="f2-price" style="${isPromo ? 'color: #ea580c; font-size: 15px;' : ''}">R$ ${(parseFloat(p.precoVenda) || 0).toFixed(2).replace('.', ',')}</strong>
            </button>
            ${p.precoFardo ? `
              <button type="button" class="f2-btn-pack" onclick="PdvModule.selecionarProdutoBusca('${p.id}', true)" title="Adicionar pacote/fardo ao carrinho [→ Enter]">
                <span class="f2-btn-tag">+ ${p.unidadeFracionada || 'Fardo / Kit'}</span>
                <strong class="f2-price">R$ ${(parseFloat(p.precoFardo) || 0).toFixed(2).replace('.', ',')}</strong>
              </button>
            ` : `<div class="f2-empty-slot"></div>`}
          </div>
        </div>
      `;
    }).join('');

    this.atualizarHighlightBuscaRapida();
  },

  selecionarProdutoBusca(id, isFardo = false) {
    if (!this.validarCaixaAberto()) return;
    const produtos = StorageService.getProdutos();
    const p = produtos.find(item => item.id === id);
    if (p) {
      this.fecharBuscaProdutos();
      // Se for item pesável e a balança estiver ativa, abre o leitor de balança
      if (!isFardo && (p.permiteFracionado || (p.unidade && p.unidade.toLowerCase() === 'kg')) && window.BalancaModule && StorageService.getBalancaConfig().habilitado) {
        window.BalancaModule.abrirLeituraBalanca(p);
        return;
      }
      this.adicionarAoCarrinho(p, 1, isFardo, 'busca');
      this.tocarSomBeep(true);
    }
  },

  formaPagamentoSelecionada: 'Dinheiro',
  pagamentosLancados: [],
  trocoDinheiroTotal: 0,
  pagamentoDividido: false,

  // Modal de Pagamento [F4]
  abrirModalPagamento() {
    if (this.carrinho.length === 0) {
      window.App.showToast('Adicione produtos ao carrinho antes de finalizar!', 'warning');
      this.tocarSomBeep(false);
      return;
    }

    const turnoAtual = StorageService.getTurnoAtual();
    if (!turnoAtual) {
      window.App.showToast('🔒 Caixa Fechado! Abra o turno de caixa para finalizar a venda.', 'warning');
      this.tocarSomBeep(false);
      if (window.CaixaModule && typeof window.CaixaModule.abrirTurnoCaixa === 'function') {
        window.CaixaModule.abrirTurnoCaixa();
      } else {
        const modalCaixa = document.getElementById('modal-abrir-caixa');
        if (modalCaixa) modalCaixa.classList.add('active');
      }
      return;
    }

    const totais = this.calcularTotais();
    const modal = document.getElementById('modal-pagamento');
    const totalEl = document.getElementById('pag-total-modal');
    const itemsBadge = document.getElementById('pag-items-badge-modal');

    if (totalEl) totalEl.textContent = `R$ ${totais.total.toFixed(2).replace('.', ',')}`;
    if (itemsBadge) {
      const qtdTotal = this.carrinho.reduce((acc, i) => acc + i.quantidade, 0);
      itemsBadge.textContent = `🛒 ${qtdTotal} ${qtdTotal === 1 ? 'item' : 'itens'}`;
    }

    // Configurações Fiscais & CPF na Nota (Solicitado na finalização via TEF ou modal dedicado)
    const secFiscal = document.getElementById('pag-secao-fiscal-opcoes');
    if (secFiscal) {
      secFiscal.style.display = 'none';
    }

    // Resetar estado de pagamentos acumulados
    this.pagamentosLancados = [];
    this.trocoDinheiroTotal = 0;
    this.cpfNotaFinalizacao = '';

    // Desfocar qualquer elemento anterior
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    const barcodeInput = document.getElementById('pdv-barcode-input');
    const classicBarcodeInput = document.getElementById('classic-pdv-barcode-input');
    if (barcodeInput) barcodeInput.blur();
    if (classicBarcodeInput) classicBarcodeInput.blur();

    // Selecionar Dinheiro por padrão (F1)
    this.selecionarFormaPagamento('Dinheiro');
    this.atualizarFormasPagamentoLicenca();

    if (modal) {
      modal.classList.add('active');
      const inputValor = document.getElementById('pag-valor-pago-input');
      if (inputValor) {
        setTimeout(() => {
          inputValor.focus();
          inputValor.select();
        }, 80);
      }
    }
  },

  getConfiguracaoPagamentos() {
    const licenca = StorageService.getLicenca() || {};
    const pagamentos = licenca.modulos && typeof licenca.modulos.pagamentos === 'object'
      ? licenca.modulos.pagamentos
      : {};
    return {
      vouchers: pagamentos.vouchers === true,
      voucherMarcaVr: pagamentos.voucherMarcaVr === true || pagamentos.voucherVr === true,
      voucherMarcaAlelo: pagamentos.voucherMarcaAlelo === true || pagamentos.voucherAlelo === true,
      voucherMarcaPluxee: pagamentos.voucherMarcaPluxee === true || pagamentos.voucherSodexo === true,
      voucherMarcaTicket: pagamentos.voucherMarcaTicket === true || pagamentos.voucherTicket === true,
      voucherOutros: pagamentos.voucherOutros === true
    };
  },

  getOpcoesVoucher() {
    const config = this.getConfiguracaoPagamentos();
    return [
      ['voucherMarcaVr', 'VR'],
      ['voucherMarcaAlelo', 'Alelo'],
      ['voucherMarcaPluxee', 'Pluxee'],
      ['voucherMarcaTicket', 'Ticket'],
      ['voucherOutros', 'Outros']
    ].filter(([chave]) => config[chave]).map(([, nome]) => nome);
  },

  abrirModalSelecaoVoucher(valor) {
    const opcoes = this.getOpcoesVoucher();
    if (opcoes.length === 0) {
      window.App.showToast('Nenhuma bandeira de voucher está liberada para esta licença.', 'warning');
      return;
    }
    this.voucherValorPendente = Math.min(valor, this.calcularTotais().total - this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0));
    this.voucherOpcoesAtuais = opcoes;
    this.voucherOpcaoIndex = Math.max(0, opcoes.indexOf(this.voucherSelecionado));
    if (this.voucherOpcaoIndex < 0) this.voucherOpcaoIndex = 0;
    const modal = document.getElementById('modal-selecao-voucher');
    if (!modal) return;
    const valorEl = document.getElementById('voucher-selecao-valor');
    if (valorEl) valorEl.textContent = `R$ ${this.voucherValorPendente.toFixed(2).replace('.', ',')}`;
    this.renderOpcoesVoucher();
    modal.classList.add('active');
  },

  renderOpcoesVoucher() {
    const lista = document.getElementById('voucher-opcoes-lista');
    if (!lista) return;
    lista.innerHTML = (this.voucherOpcoesAtuais || []).map((nome, index) => `
      <button type="button" class="voucher-opcao-teclado${index === this.voucherOpcaoIndex ? ' active' : ''}" data-voucher-index="${index}" onclick="PdvModule.confirmarVoucherSelecionado(${index})">
        <span>${index + 1}</span><strong>${nome}</strong>
      </button>
    `).join('');
  },

  moverSelecaoVoucher(delta) {
    const total = (this.voucherOpcoesAtuais || []).length;
    if (!total) return;
    this.voucherOpcaoIndex = (this.voucherOpcaoIndex + delta + total) % total;
    this.renderOpcoesVoucher();
  },

  fecharModalSelecaoVoucher() {
    const modal = document.getElementById('modal-selecao-voucher');
    if (modal) modal.classList.remove('active');
    this.voucherValorPendente = 0;
  },

  confirmarVoucherSelecionado(index = this.voucherOpcaoIndex) {
    const nome = (this.voucherOpcoesAtuais || [])[index];
    if (!nome || this.voucherValorPendente <= 0) return;
    this.voucherMarcaSelecionada = nome;
    const modal = document.getElementById('modal-selecao-voucher');
    if (modal) modal.classList.remove('active');
    this.abrirModalTipoVoucher();
  },

  abrirModalTipoVoucher() {
    const modal = document.getElementById('modal-tipo-voucher');
    if (!modal) return;
    this.voucherTipoOpcoes = ['Refeição', 'Alimentação'];
    this.voucherTipoIndex = 0;
    const marcaEl = document.getElementById('voucher-tipo-marca');
    if (marcaEl) marcaEl.textContent = this.voucherMarcaSelecionada || 'Voucher';
    this.renderOpcoesTipoVoucher();
    modal.classList.add('active');
  },

  renderOpcoesTipoVoucher() {
    const lista = document.getElementById('voucher-tipo-opcoes-lista');
    if (!lista) return;
    lista.innerHTML = (this.voucherTipoOpcoes || []).map((nome, index) => `
      <button type="button" class="voucher-opcao-teclado${index === this.voucherTipoIndex ? ' active' : ''}" onclick="PdvModule.confirmarTipoVoucherSelecionado(${index})">
        <span>${index + 1}</span><strong>${nome}</strong>
      </button>
    `).join('');
  },

  moverSelecaoTipoVoucher(delta) {
    const total = (this.voucherTipoOpcoes || []).length;
    if (!total) return;
    this.voucherTipoIndex = (this.voucherTipoIndex + delta + total) % total;
    this.renderOpcoesTipoVoucher();
  },

  fecharModalTipoVoucher() {
    const modal = document.getElementById('modal-tipo-voucher');
    if (modal) modal.classList.remove('active');
    this.voucherValorPendente = 0;
    this.voucherMarcaSelecionada = null;
  },

  confirmarTipoVoucherSelecionado(index = this.voucherTipoIndex) {
    const tipo = (this.voucherTipoOpcoes || [])[index];
    if (!tipo || this.voucherValorPendente <= 0) return;
    const marca = this.voucherMarcaSelecionada || 'Outros';
    const valor = this.voucherValorPendente;
    this.fecharModalTipoVoucher();
    this.pagamentosLancados.push({
      id: 'PAG-' + Date.now(),
      forma: `${marca} - ${tipo}`,
      valor
    });
    const totais = this.calcularTotais();
    const novoLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    if (novoLancado >= (totais.total - 0.005)) {
      this.atualizarInterfacePagamentoNovo(true);
      this.solicitarFinalizacaoVenda();
    } else {
      this.atualizarInterfacePagamentoNovo(true);
      const restante = Math.max(0, totais.total - novoLancado);
      window.App.showToast(`${marca} - ${tipo} lançado. Falta R$ ${restante.toFixed(2).replace('.', ',')}.`, 'info');
    }
  },

  atualizarFormasPagamentoLicenca() {
    const config = this.getConfiguracaoPagamentos();
    const btnVoucher = document.getElementById('btn-forma-voucher');
    const voucherAtivo = config.vouchers && Object.keys(config).some(chave => chave !== 'vouchers' && config[chave]);
    if (btnVoucher) btnVoucher.style.display = voucherAtivo ? 'flex' : 'none';
    if (!voucherAtivo && this.formaPagamentoSelecionada === 'Voucher') {
      this.selecionarFormaPagamento('Dinheiro');
    }
  },

  fecharModalPagamento() {
    const modal = document.getElementById('modal-pagamento');
    if (modal) modal.classList.remove('active');
    this.pagamentosLancados = [];
    this.trocoDinheiroTotal = 0;
    this.focarInputLeitor();
  },

  selecionarFormaPagamento(forma) {
    if (forma === 'Voucher') {
      const config = this.getConfiguracaoPagamentos();
      const voucherAtivo = config.vouchers && Object.keys(config).some(chave => chave !== 'vouchers' && config[chave]);
      if (!voucherAtivo) {
        window.App.showToast('🎫 Nenhum voucher está liberado para esta licença.', 'warning');
        return;
      }
    }
    this.formaPagamentoSelecionada = forma;

    // Atualizar visual dos cards [F1..F6]
    document.querySelectorAll('.forma-pag-card').forEach(card => {
      card.classList.toggle('active', card.dataset.forma === forma);
    });

    const titulos = {
      'Dinheiro': '💵 Pagamento em Dinheiro [F1]',
      'PIX': '📱 Pagamento via PIX [F2]',
      'Débito': '💳 Pagamento em Cartão de Débito [F3]',
      'Crédito': '💳 Pagamento em Cartão de Crédito [F4]',
      'Voucher': '🎫 Pagamento em Voucher / Alimentação [F5]',
      'Fiado': '📋 Pagamento em Caderneta (Fiado) [F6]'
    };

    const tituloEl = document.getElementById('pag-forma-ativa-titulo');
    if (tituloEl) tituloEl.textContent = titulos[forma] || `${forma}`;

    // Checagem de TEF para Cartões
    const isTefLicenciado = StorageService.isModuloAtivo('tefCartao');
    const cfgTef = StorageService.getTefConfig();
    const isTefAtivo = isTefLicenciado && cfgTef && cfgTef.habilitado && window.TefModule;
    const tefBadge = document.getElementById('pag-status-tef-badge');
    if (tefBadge) {
      tefBadge.style.display = (isTefAtivo && (forma === 'Débito' || forma === 'Crédito')) ? 'inline-flex' : 'none';
    }

    // Renderizar Detalhe Contextual
    const contextoEl = document.getElementById('pag-contexto-detalhe');
    if (contextoEl) {
      if (forma === 'Dinheiro') {
        contextoEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="cash-pill-btn exact" onclick="PdvModule.preencherValorExatoRestante()" title="Preencher valor exato [E]">✨ Valor Exato [E]</button>
            <button type="button" class="cash-pill-btn" onclick="PdvModule.adicionarValorAoInput(10)">+R$ 10</button>
            <button type="button" class="cash-pill-btn" onclick="PdvModule.adicionarValorAoInput(20)">+R$ 20</button>
            <button type="button" class="cash-pill-btn" onclick="PdvModule.adicionarValorAoInput(50)">+R$ 50</button>
            <button type="button" class="cash-pill-btn" onclick="PdvModule.adicionarValorAoInput(100)">+R$ 100</button>
          </div>
        `;
      } else if (forma === 'PIX') {
        const lic = StorageService.getLicenca() || {};
        const chavePix = lic.chavePix || 'Não cadastrada';
        contextoEl.innerHTML = `
          <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; background: #e0f2fe; padding: 6px 12px; border-radius: 8px; border: 1px dashed #38bdf8;">
            <span>📱 Chave PIX: <strong style="color: #0369a1; font-family: 'JetBrains Mono';">${chavePix}</strong></span>
            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">Aponte o QR Code ou confirme o comprovante</span>
          </div>
        `;
      } else if (forma === 'Fiado') {
        contextoEl.innerHTML = `
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="pag-fiado-cliente-select" class="form-input-custom" style="height: 38px; font-size: 13px; font-weight: 700; flex: 1;">
              <!-- Preenchido dinamicamente -->
            </select>
            <button type="button" class="btn-primary-action" style="height: 38px; padding: 0 12px; font-size: 11.5px; font-weight: 800; background: #d97706;" onclick="PdvModule.abrirModalNovoClienteRapido()">
              ➕ Novo
            </button>
          </div>
        `;
        this.carregarClientesFiadoSelect();
      } else if (forma === 'Débito' || forma === 'Crédito') {
        if (isTefAtivo) {
          contextoEl.innerHTML = `
            <div style="font-size: 12px; color: #0369a1; background: #e0f2fe; padding: 6px 12px; border-radius: 8px; border: 1px solid #bae6fd;">
              📟 <strong>TEF Integrado:</strong> Ao teclar [ENTER], o valor será enviado diretamente ao Pinpad para leitura do cartão.
            </div>
          `;
        } else {
          contextoEl.innerHTML = `
            <div style="font-size: 12px; color: var(--text-muted); background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              💳 <strong>Maquininha Externa:</strong> Passe o cartão de ${forma} do cliente na maquininha e tecle [ENTER] para confirmar.
            </div>
          `;
        }
      } else if (forma === 'Voucher') {
        const opcoes = this.getOpcoesVoucher();
        const voucherAtual = this.voucherSelecionado || (opcoes[0] || 'Voucher');
        this.voucherSelecionado = voucherAtual;
        contextoEl.innerHTML = `
          <div style="font-size: 12px; color: #86198f; background: #fdf4ff; padding: 8px 12px; border-radius: 8px; border: 1px solid #f0abfc;">
            🎫 <strong>Após informar o valor, tecle ENTER.</strong> Escolha a bandeira com as setas e confirme com ENTER.
          </div>
        `;
      }
    }

    // Atualiza interface sem apagar valor se o operador já tiver digitado um valor parcial
    this.atualizarInterfacePagamentoNovo(false);

    const inputValor = document.getElementById('pag-valor-pago-input');
    if (inputValor) {
      setTimeout(() => {
        inputValor.focus();
        inputValor.select();
      }, 50);
    }
  },

  toggleCpfNfceInput() {
    const check = document.getElementById('pag-emitir-nfce-check');
    const boxCpf = document.getElementById('pag-box-cpf-nota');
    if (boxCpf) {
      boxCpf.style.display = (check && check.checked) ? 'block' : 'none';
      if (check && check.checked) {
        const inputCpf = document.getElementById('pag-cpf-nota-input');
        if (inputCpf) {
          setTimeout(() => inputCpf.focus(), 50);
        }
      }
    }
  },

  pedirCpfNoPinpad() {
    if (window.TefModule && typeof window.TefModule.solicitarCpfPinpad === 'function') {
      window.TefModule.solicitarCpfPinpad();
    } else {
      window.App.showToast('Conecte e configure o PINPad em Configurações para coletar CPF.', 'warning');
    }
  },

  carregarClientesFiadoSelect() {
    const select = document.getElementById('pag-fiado-cliente-select');
    if (!select) return;
    const clientes = StorageService.getClientes() || [];
    if (clientes.length === 0) {
      select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
      return;
    }
    select.innerHTML = clientes.map(c => `<option value="${c.id}">👤 ${c.nome} (Saldo: R$ ${(parseFloat(c.saldoDevedor) || 0).toFixed(2)})</option>`).join('');
  },

  atualizarInterfacePagamentoNovo(shouldResetInput = true) {
    const totais = this.calcularTotais();
    const totalVenda = totais.total;
    const totalLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const faltaPagar = Math.max(0, parseFloat((totalVenda - totalLancado).toFixed(2)));
    const troco = this.trocoDinheiroTotal;

    const totalPagoEl = document.getElementById('pag-total-pago-display');
    if (totalPagoEl) totalPagoEl.textContent = `R$ ${totalLancado.toFixed(2).replace('.', ',')}`;

    // Lista de Pagamentos Lançados (Chips)
    const chipsContainer = document.getElementById('pag-chips-lancados-container');
    if (chipsContainer) {
      if (this.pagamentosLancados.length > 0) {
        chipsContainer.style.display = 'flex';
        chipsContainer.innerHTML = this.pagamentosLancados.map((p, idx) => {
          const icon = p.forma === 'Dinheiro' ? '💵' : p.forma === 'PIX' ? '📱' : p.forma === 'Fiado' ? '📋' : p.forma === 'Voucher' ? '🎫' : '💳';
          return `
            <span class="pag-parcela-chip">
              ${icon} ${p.forma}: <strong>R$ ${p.valor.toFixed(2).replace('.', ',')}</strong>
              <button type="button" class="pag-parcela-chip-del" onclick="PdvModule.removerPagamentoLancado(${idx})" title="Remover este pagamento">✕</button>
            </span>
          `;
        }).join('');
      } else {
        chipsContainer.style.display = 'none';
        chipsContainer.innerHTML = '';
      }
    }

    // Banner Dinâmico de Status
    const bannerBox = document.getElementById('pag-status-banner-box');
    if (bannerBox) {
      if (faltaPagar > 0.005) {
        bannerBox.innerHTML = `
          <div class="pag-status-banner-danger">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">🔴</span>
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Aguardando Pagamento</span>
                <div style="font-size: 22px; font-weight: 900; font-family: 'JetBrains Mono'; line-height: 1.1;">FALTA PAGAR: R$ ${faltaPagar.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>
          </div>
        `;
      } else if (troco > 0.005) {
        bannerBox.innerHTML = `
          <div class="pag-status-banner-troco">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">💵</span>
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Troco do Cliente</span>
                <div style="font-size: 22px; font-weight: 900; font-family: 'JetBrains Mono'; line-height: 1.1;">TROCO: R$ ${troco.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        bannerBox.innerHTML = `
          <div class="pag-status-banner-success">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 22px;">✅</span>
              <div>
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Pagamento Integral</span>
                <div style="font-size: 22px; font-weight: 900; font-family: 'JetBrains Mono'; line-height: 1.1;">VALOR TOTAL QUITADO!</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Atualizar input de valor
    // Atualizar texto do botão principal do modal de acordo com o saldo
    const btnConcluirModal = document.getElementById('btn-confirmar-pagamento-modal');
    if (btnConcluirModal) {
      if (faltaPagar > 0.005) {
        btnConcluirModal.innerHTML = '➕ Lançar Parcela [ENTER]';
        btnConcluirModal.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      } else {
        btnConcluirModal.innerHTML = '✅ Concluir Venda [ENTER]';
        btnConcluirModal.style.background = 'linear-gradient(135deg, var(--accent-green), #047857)';
      }
    }

    const inputVal = document.getElementById('pag-valor-pago-input');
    if (inputVal) {
      if (faltaPagar > 0.005) {
        const valAtual = parseFloat(String(inputVal.value || '').replace(',', '.')) || 0;
        // Se reset for solicitado ou se o campo estiver zerado ou com valor maior que o restante
        if (shouldResetInput || valAtual <= 0 || valAtual > faltaPagar) {
          inputVal.value = faltaPagar.toFixed(2);
        }
        setTimeout(() => {
          inputVal.focus();
          inputVal.select();
        }, 30);
      } else {
        inputVal.value = '';
      }
    }
  },

  onInputValorPagamento() {
    // Permite digitação livre do operador
  },

  preencherValorExatoRestante() {
    const totais = this.calcularTotais();
    const totalLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const falta = Math.max(0, parseFloat((totais.total - totalLancado).toFixed(2)));
    const input = document.getElementById('pag-valor-pago-input');
    if (input) {
      input.value = falta.toFixed(2);
      input.focus();
      input.select();
    }
  },

  adicionarValorAoInput(extra) {
    const input = document.getElementById('pag-valor-pago-input');
    const atual = parseFloat(input?.value) || 0;
    if (input) {
      input.value = (atual + extra).toFixed(2);
      input.focus();
      input.select();
    }
  },

  removerPagamentoLancado(index) {
    if (index >= 0 && index < this.pagamentosLancados.length) {
      const removido = this.pagamentosLancados.splice(index, 1)[0];
      if (removido && removido.troco) {
        this.trocoDinheiroTotal = Math.max(0, this.trocoDinheiroTotal - removido.troco);
      }
      this.atualizarInterfacePagamentoNovo();
      window.App.showToast('Pagamento removido.', 'info');
    }
  },

  removerUltimoPagamento() {
    if (this.pagamentosLancados.length > 0) {
      this.removerPagamentoLancado(this.pagamentosLancados.length - 1);
    } else {
      window.App.showToast('Nenhum pagamento lançado para desfazer.', 'info');
    }
  },

  _bloqueioLancarPagamento: false,
  _finalizandoVenda: false,

  lancarValorPagamento() {
    // Evita acionamentos múltiplos/duplos no mesmo milissegundo (Enter duplo ou clique duplo)
    if (this._bloqueioLancarPagamento) {
      console.warn('⚠️ Debounce: Pagamento repetido ignorado.');
      return;
    }
    this._bloqueioLancarPagamento = true;
    setTimeout(() => {
      this._bloqueioLancarPagamento = false;
    }, 350);

    const totais = this.calcularTotais();
    const totalVenda = totais.total;
    const totalLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const faltaPagar = Math.max(0, parseFloat((totalVenda - totalLancado).toFixed(2)));

    // Se já foi totalmente pago, conclui a venda imediatamente
    if (faltaPagar <= 0.005) {
      this.solicitarFinalizacaoVenda();
      return;
    }

    const inputVal = document.getElementById('pag-valor-pago-input');
    const valorDigitado = parseFloat(String(inputVal?.value || '').replace(',', '.')) || 0;

    if (valorDigitado <= 0) {
      window.App.showToast('Digite um valor maior que zero!', 'warning');
      if (inputVal) inputVal.focus();
      return;
    }

    const forma = this.formaPagamentoSelecionada || 'Dinheiro';

    if (forma === 'Voucher') {
      const config = this.getConfiguracaoPagamentos();
      const voucherAtivo = config.vouchers && Object.keys(config).some(chave => chave !== 'vouchers' && config[chave]);
      if (!voucherAtivo) {
        window.App.showToast('🎫 Nenhum voucher está liberado para esta licença.', 'warning');
        return;
      }
    }

    // 1. FORMA: DINHEIRO (Aceita troco se for maior que o saldo)
    if (forma === 'Dinheiro') {
      if (valorDigitado > faltaPagar) {
        const troco = parseFloat((valorDigitado - faltaPagar).toFixed(2));
        const saldoGaveta = this.calcularSaldoEmGaveta(StorageService.getTurnoAtual());

        if (troco > (saldoGaveta + 0.005)) {
          const trocoFmt = `R$ ${troco.toFixed(2).replace('.', ',')}`;
          const gavetaFmt = `R$ ${saldoGaveta.toFixed(2).replace('.', ',')}`;

          if (window.App && typeof window.App.confirmarAcao === 'function') {
            window.App.confirmarAcao({
              icone: '⚠️',
              titulo: 'Troco Maior que a Gaveta',
              mensagem: `O troco de <strong>${trocoFmt}</strong> é maior que o dinheiro disponível na gaveta (<strong>${gavetaFmt}</strong>). Deseja continuar?`,
              textoConfirmar: 'Confirmar Mesmo Assim [ENTER]',
              textoCancelar: 'Corrigir [ESC]',
              perigo: true,
              onConfirm: () => {
                this.trocoDinheiroTotal += troco;
                this.pagamentosLancados.push({
                  id: 'PAG-' + Date.now(),
                  forma: 'Dinheiro',
                  valor: faltaPagar,
                  valorEntregue: valorDigitado,
                  troco: troco
                });
                this.atualizarInterfacePagamentoNovo();
                this.solicitarFinalizacaoVenda();
              }
            });
            return;
          }
        }

        this.trocoDinheiroTotal += troco;
        this.pagamentosLancados.push({
          id: 'PAG-' + Date.now(),
          forma: 'Dinheiro',
          valor: faltaPagar,
          valorEntregue: valorDigitado,
          troco: troco
        });
        this.atualizarInterfacePagamentoNovo();
        this.solicitarFinalizacaoVenda();
        return;
      } else {
        // Dinheiro parcial ou exato
        this.pagamentosLancados.push({
          id: 'PAG-' + Date.now(),
          forma: 'Dinheiro',
          valor: valorDigitado,
          valorEntregue: valorDigitado,
          troco: 0
        });
        const novoLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
        if (novoLancado >= (totalVenda - 0.005)) {
          this.atualizarInterfacePagamentoNovo(true);
          this.solicitarFinalizacaoVenda();
        } else {
          this.atualizarInterfacePagamentoNovo(true);
          const restante = Math.max(0, totalVenda - novoLancado);
          window.App.showToast(`💵 Lançado R$ ${valorDigitado.toFixed(2).replace('.', ',')} em Dinheiro. Falta R$ ${restante.toFixed(2).replace('.', ',')}.`, 'info');
        }
        return;
      }
    }

    // 2. FORMAS DIGITAIS / CARTÕES / VOUCHER / FIADO (Não geram troco)
    const valorAplicado = Math.min(valorDigitado, faltaPagar);

    // Integração TEF para Débito e Crédito
    if (forma === 'Débito' || forma === 'Crédito') {
      const isTefLicenciado = StorageService.isModuloAtivo('tefCartao');
      const cfgTef = StorageService.getTefConfig();
      const isTefAtivo = isTefLicenciado && cfgTef && cfgTef.habilitado && window.TefModule;

      if (isTefAtivo) {
        window.App.showToast(`📟 Enviando R$ ${valorAplicado.toFixed(2).replace('.', ',')} ao Pinpad...`, 'info');
        window.TefModule.iniciarTransacao({
          valor: valorAplicado,
          tipo: forma
        }).then(resTef => {
          this.pagamentosLancados.push({
            id: 'PAG-' + Date.now(),
            forma: forma,
            valor: valorAplicado,
            tefInfo: resTef
          });
          this.atualizarInterfacePagamentoNovo();
          const novoLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
          if (novoLancado >= (totalVenda - 0.005)) {
            this.solicitarFinalizacaoVenda();
          }
        }).catch(err => {
          window.App.showToast('❌ Pagamento no Pinpad cancelado ou recusado.', 'warning');
        });
        return;
      }
    }

    // Fiado
    if (forma === 'Fiado') {
      const select = document.getElementById('pag-fiado-cliente-select');
      const clienteId = select ? select.value : null;
      const clientes = StorageService.getClientes() || [];
      const cliente = clientes.find(c => c.id === clienteId);

      if (!cliente) {
        window.App.showToast('Selecione um cliente para a venda fiado!', 'warning');
        return;
      }

      this.pagamentosLancados.push({
        id: 'PAG-' + Date.now(),
        forma: 'Fiado',
        valor: valorAplicado,
        clienteId: cliente.id,
        clienteNome: cliente.nome
      });
      this.atualizarInterfacePagamentoNovo();
      const novoLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
      if (novoLancado >= (totalVenda - 0.005)) {
        this.solicitarFinalizacaoVenda();
      }
      return;
    }

    // PIX e cartões manuais. Voucher abre uma seleção própria para teclado.
    if (forma === 'Voucher') {
      this.abrirModalSelecaoVoucher(valorAplicado);
      return;
    }
    const formaGravada = forma;
    this.pagamentosLancados.push({
      id: 'PAG-' + Date.now(),
      forma: formaGravada,
      valor: valorAplicado
    });
    const novoLancado = this.pagamentosLancados.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    if (novoLancado >= (totalVenda - 0.005)) {
      this.atualizarInterfacePagamentoNovo(true);
      this.solicitarFinalizacaoVenda();
    } else {
      this.atualizarInterfacePagamentoNovo(true);
      const restante = Math.max(0, totalVenda - novoLancado);
      window.App.showToast(`💳 Lançado R$ ${valorAplicado.toFixed(2).replace('.', ',')} em ${forma}. Falta R$ ${restante.toFixed(2).replace('.', ',')}.`, 'info');
    }
  },

  solicitarFinalizacaoVenda() {
    if (this._finalizandoVenda) return;

    const cfgFiscal = StorageService.getFiscalConfig();
    const isFiscalHabilitado = StorageService.isModuloAtivo('fiscalNfce') && cfgFiscal && cfgFiscal.habilitado === true;

    // Se NFC-e NÃO estiver habilitada nas configurações, conclui direto sem pedir CPF
    if (!isFiscalHabilitado) {
      this.cpfNotaFinalizacao = '';
      this.executarFinalizacaoVendaCompleta();
      return;
    }

    // Se o cliente já tiver CPF registrado (ex: Clube Fidelidade previamente identificado):
    if (this.clienteClubeAtivo && this.clienteClubeAtivo.cpfCnpj) {
      this.cpfNotaFinalizacao = this.clienteClubeAtivo.cpfCnpj;
      this.executarFinalizacaoVendaCompleta();
      return;
    }

    // Se NFC-e estiver habilitada:
    // Se TEF / PINPad estiver ativo nas configurações e licenciado, solicita na maquininha / PINPad
    const tefConfig = StorageService.getTefConfig();
    const isTefAtivo = StorageService.isModuloAtivo('tefCartao') && tefConfig && tefConfig.habilitado === true;

    if (isTefAtivo && window.TefModule && typeof window.TefModule.solicitarCpfPinpad === 'function') {
      this._finalizandoVenda = true;
      window.TefModule.solicitarCpfPinpad().then(res => {
        this.cpfNotaFinalizacao = (res && res.sucesso && res.cpf) ? res.cpf : '';
        this.executarFinalizacaoVendaCompleta({ jaTravado: true });
      }).catch(() => {
        this.cpfNotaFinalizacao = '';
        this.executarFinalizacaoVendaCompleta({ jaTravado: true });
      });
    } else {
      // Se TEF estiver desativado, solicita na tela do vendedor (modal interativo)
      this.abrirModalPerguntaCpfNota();
    }
  },

  abrirModalPerguntaCpfNota() {
    const modal = document.getElementById('modal-pergunta-cpf-nota');
    const fasePergunta = document.getElementById('cpf-nota-fase-pergunta');
    const faseDigitacao = document.getElementById('cpf-nota-fase-digitacao');
    const input = document.getElementById('cpf-nota-modal-input');

    if (fasePergunta) fasePergunta.style.display = 'block';
    if (faseDigitacao) faseDigitacao.style.display = 'none';
    if (input) input.value = '';

    if (modal) {
      modal.classList.add('active');
      const btnSim = document.getElementById('btn-cpf-nota-sim');
      if (btnSim) setTimeout(() => btnSim.focus(), 60);
    }
  },

  fecharModalPerguntaCpfNota() {
    const modal = document.getElementById('modal-pergunta-cpf-nota');
    if (modal) modal.classList.remove('active');
    window._ultimoModalFechadoTimestamp = Date.now();
  },

  responderPerguntaCpfNota(querCpf) {
    if (!querCpf) {
      // NÃO [ESC]: Fecha o modal e conclui a venda gerando a NF sem CPF!
      this.fecharModalPerguntaCpfNota();
      this.cpfNotaFinalizacao = '';
      this.executarFinalizacaoVendaCompleta();
      return;
    }

    // SIM [ENTER]: Abre o campo para digitação do CPF na tela do vendedor
    const fasePergunta = document.getElementById('cpf-nota-fase-pergunta');
    const faseDigitacao = document.getElementById('cpf-nota-fase-digitacao');
    const input = document.getElementById('cpf-nota-modal-input');

    if (fasePergunta) fasePergunta.style.display = 'none';
    if (faseDigitacao) faseDigitacao.style.display = 'block';

    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 60);
    }
  },

  confirmarCpfNotaDigitado() {
    const input = document.getElementById('cpf-nota-modal-input');
    const valor = input ? input.value.trim() : '';

    this.cpfNotaFinalizacao = valor;
    this.fecharModalPerguntaCpfNota();
    this.executarFinalizacaoVendaCompleta();
  },

  cancelarDigitacaoCpfNota() {
    this.cpfNotaFinalizacao = '';
    this.fecharModalPerguntaCpfNota();
    this.executarFinalizacaoVendaCompleta();
  },

  pedirCpfNoPinpadModal() {
    if (window.TefModule && typeof window.TefModule.solicitarCpfPinpad === 'function') {
      if (this._finalizandoVenda) return;
      this._finalizandoVenda = true;
      this.fecharModalPerguntaCpfNota();
      window.TefModule.solicitarCpfPinpad().then(res => {
        this.cpfNotaFinalizacao = (res && res.sucesso && res.cpf) ? res.cpf : '';
        this.executarFinalizacaoVendaCompleta({ jaTravado: true });
      }).catch(() => {
        this.cpfNotaFinalizacao = '';
        this.executarFinalizacaoVendaCompleta({ jaTravado: true });
      });
    } else {
      window.App.showToast('Maquininha TEF não conectada ou sem suporte a PINPad.', 'warning');
    }
  },

  formatarCpfCnpj(v) {
    v = String(v || '').replace(/\D/g, '');
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d)/, '$1.$2');
      v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      v = v.substring(0, 14);
      v = v.replace(/^(\d{2})(\d)/, '$1.$2');
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
    }
    return v;
  },

  executarFinalizacaoVendaCompleta(opts = {}) {
    if (this._finalizandoVenda && !opts.jaTravado) return;
    this._finalizandoVenda = true;

    try {
      const totais = this.calcularTotais();
      const totalVenda = totais.total;
      const pagamentos = this.pagamentosLancados.filter(p => p.valor > 0);

      if (pagamentos.length === 0) {
        window.App.showToast('Nenhum valor lançado!', 'warning');
        return;
      }

      const totalLancado = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
      if (totalLancado < (totalVenda - 0.005)) {
        const falta = Math.max(0, totalVenda - totalLancado);
        window.App.showToast(`Ainda falta pagar R$ ${falta.toFixed(2).replace('.', ',')}!`, 'warning');
        return;
      }

      const usuario = AuthModule.getUsuario();
      if (!usuario) {
        window.App.showToast('Faça login para finalizar a venda.', 'warning');
        return;
      }
      const isMultiplo = pagamentos.length > 1;
      const formasDescricao = pagamentos.map(p => `${p.forma}: R$ ${p.valor.toFixed(2).replace('.', ',')}`).join(' + ');

      const proximoNumero = StorageService.getProximoNumeroVenda();

      const venda = {
        id: 'VND-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        numeroVenda: proximoNumero,
        turnoId: StorageService.getTurnoAtual()?.id || null,
        data: new Date().toISOString(),
        itens: [...this.carrinho],
        subtotal: totais.subtotal,
        desconto: totais.desconto,
        total: totalVenda,
        formaPagamento: isMultiplo ? `Multi-Pagamento (${pagamentos.map(p => p.forma).join(', ')})` : pagamentos[0].forma,
        pagamentoDividido: isMultiplo,
        pagamentos: pagamentos,
        detalhesPagamento: formasDescricao,
        valorPago: totalLancado,
        troco: this.trocoDinheiroTotal || 0,
        operador: usuario.nome,
        operadorId: usuario.id || null
      };

      // Atualizar clientes se houver parcela em Fiado
      const parcelasFiado = pagamentos.filter(p => p.forma === 'Fiado');
      if (parcelasFiado.length > 0) {
        const clientes = StorageService.getClientes() || [];
        parcelasFiado.forEach(pf => {
          const c = clientes.find(item => item.id === pf.clienteId);
          if (c) {
            c.saldoDevedor = (parseFloat(c.saldoDevedor) || 0) + pf.valor;
            c.historico = c.historico || [];
            c.historico.push({
              data: new Date().toISOString(),
              tipo: 'venda',
              valor: pf.valor,
              vendaId: venda.id,
              descricao: `Compra a prazo no PDV (${venda.itens.length} itens)`
            });
          }
        });
        StorageService.saveClientes(clientes);
        if (window.ClientesModule) window.ClientesModule.renderTabelaClientes();
      }

      const cfgFiscal = StorageService.getFiscalConfig();
      const deveEmitirFiscal = StorageService.isModuloAtivo('fiscalNfce') && cfgFiscal && cfgFiscal.habilitado === true;
      const cpfFinal = this.cpfNotaFinalizacao || (document.getElementById('pag-cpf-nota-input')?.value || '').trim() || (this.clienteClubeAtivo ? this.clienteClubeAtivo.cpfCnpj : '') || '';
      if (cpfFinal) {
        venda.cpfCliente = cpfFinal;
      }

      if (deveEmitirFiscal) {
        venda.statusFiscal = 'pendente';
      }

      StorageService.saveVenda(venda);
      this.agendarEmissaoFiscal(venda, deveEmitirFiscal && cfgFiscal);

      if (venda.itens && venda.itens.length > 0 && venda.itens[0].comandaOrigemId && window.ComandasModule) {
        window.ComandasModule.liberarComandaAposVenda(venda.itens[0].comandaOrigemId);
      }

      this.fecharModalPagamento();
      this.limparCarrinho();
      this.renderMiniDashboardTurno();
      this.tocarSomBeep(true);
      this.cpfNotaFinalizacao = '';
      window.App.showToast(`Venda finalizada com sucesso (${isMultiplo ? formasDescricao : venda.formaPagamento})!`, 'success');
      this.abrirModalSucessoImpressao(venda);
    } catch (err) {
      console.error('[PDV] Falha ao finalizar venda:', err);
      window.App.showToast('Não foi possível finalizar a venda. Tente novamente.', 'error');
    } finally {
      this._finalizandoVenda = false;
    }
  },

  agendarEmissaoFiscal(venda, deveEmitir) {
    if (!deveEmitir || !window.FiscalModule || typeof window.FiscalModule.emitirNFCe !== 'function') return;

    window.FiscalModule.emitirNFCe(venda).then(resFiscal => {
      if (resFiscal && resFiscal.sucesso) {
        venda.chaveNfe = resFiscal.chaveAcesso;
        venda.protocoloNfe = resFiscal.protocoloAutorizacao;
        venda.numeroNfce = resFiscal.numeroNfce;
        venda.serieNfce = resFiscal.serieNfce;
        venda.ambiente = resFiscal.ambiente;
        venda.qrcodeUrl = resFiscal.qrcodeUrl;
        venda.statusFiscal = resFiscal.status || 'autorizada';
        venda.tributosAproximados = resFiscal.tributosAproximados;
        venda.fiscalErro = '';
        StorageService.atualizarVenda(venda);
      } else {
        venda.statusFiscal = 'erro';
        venda.fiscalErro = (resFiscal && (resFiscal.mensagem || resFiscal.erro)) || 'Falha na emissão da NFC-e';
        StorageService.atualizarVenda(venda);
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('Venda gravada. NFC-e pendente: ' + venda.fiscalErro, 'warning');
        }
      }
    }).catch(err => {
      venda.statusFiscal = 'erro';
      venda.fiscalErro = err?.message || String(err);
      StorageService.atualizarVenda(venda);
      console.warn('[Fiscal] Erro na emissão NFC-e:', err);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Venda gravada, mas a NFC-e não foi autorizada. Reemita depois.', 'warning');
      }
    });
  },

  confirmarPagamento() {
    this.lancarValorPagamento();
  },

  
  calcularSaldoEmGaveta(turno) {
    if (!turno) return 0;
    const trocoInicial = parseFloat(turno.trocoInicial || turno.valorAbertura || 0);
    const sangrias = (turno.sangrias || []).reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0);
    const suprimentos = (turno.suprimentos || []).reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0);

    const vendas = StorageService.getVendas() || [];
    let vendasDinheiro = 0;
    vendas.forEach(v => {
      if (v && (v.turnoId === turno.id || (!v.turnoId && new Date(v.data) >= new Date(turno.dataAbertura)))) {
        if (v.formaPagamento === 'Dinheiro') {
          vendasDinheiro += (parseFloat(v.total) || 0);
        } else if (v.pagamentoDividido && Array.isArray(v.pagamentos)) {
          let dinheiroLancado = 0;
          v.pagamentos.forEach(p => {
            if (p.forma === 'Dinheiro') dinheiroLancado += (parseFloat(p.valor) || 0);
          });
          const trocoDinheiro = (parseFloat(v.troco) || 0);
          vendasDinheiro += Math.max(0, dinheiroLancado - trocoDinheiro);
        } else if (v.pagamentoDividido && (v.parcela1 || v.parcela2)) {
          let dinheiroLancado = 0;
          if (v.parcela1?.forma === 'Dinheiro') dinheiroLancado += (parseFloat(v.parcela1.valor) || 0);
          if (v.parcela2?.forma === 'Dinheiro') dinheiroLancado += (parseFloat(v.parcela2.valor) || 0);
          const trocoDinheiro = (parseFloat(v.troco) || 0);
          vendasDinheiro += Math.max(0, dinheiroLancado - trocoDinheiro);
        }
      }
    });

    return Math.max(0, trocoInicial + suprimentos + vendasDinheiro - sangrias);
  },

  finalizarVenda(formaPagamento, dadosTef = null) {
    if (this._finalizandoVenda) return;
    const totais = this.calcularTotais();
    const inputPago = document.getElementById('pag-valor-pago-input');
    const valorPago = formaPagamento === 'Dinheiro' ? (this.parseMoedaBR(inputPago?.value) || totais.total) : totais.total;
    const troco = Math.max(0, parseFloat((valorPago - totais.total).toFixed(2)));

    // Validação de Troco vs Saldo em Gaveta (Item 4)
    if (formaPagamento === 'Dinheiro' && troco > 0) {
      const turno = StorageService.getTurnoAtual();
      const saldoGaveta = this.calcularSaldoEmGaveta(turno);

      if (troco > (saldoGaveta + 0.005)) {
        const trocoFmt = `R$ ${troco.toFixed(2).replace('.', ',')}`;
        const gavetaFmt = `R$ ${saldoGaveta.toFixed(2).replace('.', ',')}`;

        if (window.App && typeof window.App.confirmarAcao === 'function') {
          window.App.confirmarAcao({
            icone: '⚠️',
            titulo: 'Aviso: Troco Maior que Gaveta',
            mensagem: `O troco necessário de <strong>${trocoFmt}</strong> é maior que o saldo em dinheiro disponível na gaveta (<strong>${gavetaFmt}</strong>).<br><br>Verifique se você possui troco físico trocado antes de concluir a venda.`,
            textoConfirmar: 'Confirmar Venda Mesmo Assim [ENTER]',
            textoCancelar: 'Corrigir Valor [ESC]',
            perigo: true,
            onConfirm: () => {
              this.executarGravacaoVenda(formaPagamento, dadosTef, valorPago, troco);
            }
          });
          return;
        }
      }
    }

    this.executarGravacaoVenda(formaPagamento, dadosTef, valorPago, troco);
  },

  executarGravacaoVenda(formaPagamento, dadosTef, valorPago, troco) {
    if (this._finalizandoVenda) return;
    this._finalizandoVenda = true;
    try {
      const totais = this.calcularTotais();
      const usuario = AuthModule.getUsuario();
      if (!usuario) {
        window.App.showToast('Faça login para finalizar a venda.', 'warning');
        return;
      }

      const proximoNumero = StorageService.getProximoNumeroVenda();

      const venda = {
        id: 'VND-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        numeroVenda: proximoNumero,
        turnoId: StorageService.getTurnoAtual()?.id || null,
        data: new Date().toISOString(),
        itens: [...this.carrinho],
        subtotal: totais.subtotal,
        desconto: totais.desconto,
        total: totais.total,
        formaPagamento: formaPagamento,
        valorPago: valorPago,
        troco: troco,
        operador: usuario.nome,
        operadorId: usuario.id || null
      };

      if (dadosTef) {
        venda.dadosTef = dadosTef;
        venda.nsuTef = dadosTef.nsu;
        venda.autorizacaoTef = dadosTef.autorizacao;
        venda.bandeiraCartao = dadosTef.bandeira;
      }

      const cfgFiscal = StorageService.getFiscalConfig();
      const deveEmitirFiscal = StorageService.isModuloAtivo('fiscalNfce') && cfgFiscal && cfgFiscal.habilitado === true;
      const cpfFinal = this.cpfNotaFinalizacao || (document.getElementById('pag-cpf-nota-input')?.value || '').trim() || (this.clienteClubeAtivo ? this.clienteClubeAtivo.cpfCnpj : '') || '';
      if (cpfFinal) {
        venda.cpfCliente = cpfFinal;
      }
      if (deveEmitirFiscal) venda.statusFiscal = 'pendente';

      StorageService.saveVenda(venda);
      this.agendarEmissaoFiscal(venda, deveEmitirFiscal && cfgFiscal);

      if (venda.itens && venda.itens.length > 0 && venda.itens[0].comandaOrigemId && window.ComandasModule) {
        window.ComandasModule.liberarComandaAposVenda(venda.itens[0].comandaOrigemId);
      }

      this.fecharModalPagamento();
      this.limparCarrinho();
      this.renderMiniDashboardTurno();
      this.tocarSomBeep(true);
      this.cpfNotaFinalizacao = '';
      const numVendaFormat = venda.numeroVenda ? `#${String(venda.numeroVenda).padStart(6, '0')}` : `#${venda.id}`;
      window.App.showToast(`Venda ${numVendaFormat} finalizada com sucesso (${formaPagamento})!`, 'success');
      this.abrirModalSucessoImpressao(venda);
    } catch (err) {
      console.error('[PDV] Falha ao gravar venda:', err);
      window.App.showToast('Não foi possível gravar a venda. Tente novamente.', 'error');
    } finally {
      this._finalizandoVenda = false;
    }
  },

  abrirModalSucessoImpressao(venda) {
    this.ultimaVendaFinalizada = venda;
    const modal = document.getElementById('modal-sucesso-venda-impressao');
    if (!modal) return;

    const idEl = document.getElementById('modal-sucesso-venda-id');
    const valorEl = document.getElementById('modal-sucesso-venda-valor');
    const detalheEl = document.getElementById('modal-sucesso-venda-detalhe');
    const fiscalBadge = document.getElementById('modal-sucesso-fiscal-badge');

    const numVenda = venda.numeroVenda || (StorageService.getVendas() || []).length;
    if (idEl) idEl.textContent = `Venda #${numVenda} Concluída!`;
    if (valorEl) valorEl.textContent = `R$ ${(venda.total || 0).toFixed(2).replace('.', ',')}`;
    
    if (detalheEl) {
      if (venda.formaPagamento === 'Dinheiro' && venda.troco > 0) {
        detalheEl.textContent = `Dinheiro (Entregue: R$ ${(venda.valorPago || 0).toFixed(2).replace('.', ',')} • Troco: R$ ${(venda.troco || 0).toFixed(2).replace('.', ',')})`;
        
        const classicTotalRec = document.getElementById('classic-total-recebido');
        const classicTroco = document.getElementById('classic-troco');
        if (classicTotalRec) classicTotalRec.textContent = (venda.valorPago || 0).toFixed(2).replace('.', ',');
        if (classicTroco) classicTroco.textContent = (venda.troco || 0).toFixed(2).replace('.', ',');
      } else {
        detalheEl.textContent = `Pagamento via ${venda.formaPagamento || 'À Vista'}`;
        const classicTotalRec = document.getElementById('classic-total-recebido');
        const classicTroco = document.getElementById('classic-troco');
        if (classicTotalRec) classicTotalRec.textContent = (venda.valorPago || 0).toFixed(2).replace('.', ',');
        if (classicTroco) classicTroco.textContent = '0,00';
      }
    }

    if (fiscalBadge) {
      const isNfce = Boolean(venda.chaveNfe || venda.statusFiscal === 'autorizada');
      if (isNfce) {
        const amb = venda.ambiente === 'homologacao' ? '🧪 Homologação' : '🟢 Produção';
        fiscalBadge.innerHTML = `🏛️ NFC-e Nº ${venda.numeroNfce || 1} Emitida (${amb})`;
        fiscalBadge.style.background = '#dcfce7';
        fiscalBadge.style.color = '#15803d';
      } else {
        fiscalBadge.innerHTML = `📄 Comprovante Não Fiscal`;
        fiscalBadge.style.background = '#f1f5f9';
        fiscalBadge.style.color = '#475569';
      }
    }

    modal.style.display = 'flex';
    const btnImprimir = document.getElementById('btn-confirmar-imprimir-venda');
    if (btnImprimir) {
      setTimeout(() => btnImprimir.focus(), 80);
    }
  },

  fecharModalSucessoImpressao() {
    const modal = document.getElementById('modal-sucesso-venda-impressao');
    if (modal) modal.style.display = 'none';
    this.ultimaVendaFinalizada = null;
    this.focarInputLeitor();
  },

  confirmarImpressaoVendaFinalizada() {
    if (this.ultimaVendaFinalizada && window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirCupomVenda === 'function') {
      window.ThermalPrintModule.imprimirCupomVenda(this.ultimaVendaFinalizada);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🖨️ Cupom térmico enviado para impressão!', 'info');
      }
    }
    this.fecharModalSucessoImpressao();
  },

  confirmarImpressaoA4VendaFinalizada() {
    if (this.ultimaVendaFinalizada && window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirA4Venda === 'function') {
      window.ThermalPrintModule.imprimirA4Venda(this.ultimaVendaFinalizada);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('📄 Documento A4 gerado para impressão/PDF!', 'info');
      }
    }
    this.fecharModalSucessoImpressao();
  },

  // Fiado / Caderneta
  abrirModalEscolherClienteFiado() {
    if (window.AuthModule && typeof window.AuthModule.executarComPermissaoOuPin === 'function') {
      window.AuthModule.executarComPermissaoOuPin('venderFiado', () => {
        this._abrirModalEscolherClienteFiadoAcao();
      }, 'Autorização: Venda Fiado (A Prazo)');
    } else {
      this._abrirModalEscolherClienteFiadoAcao();
    }
  },

  _abrirModalEscolherClienteFiadoAcao() {
    if (this.carrinho.length === 0) {
      window.App.showToast('Adicione ao menos um item no carrinho!', 'warning');
      return;
    }

    const clientes = StorageService.getClientes();
    if (clientes.length === 0) {
      window.App.showToast('Nenhum cliente cadastrado no sistema! Cadastre um cliente na aba Fiado/Clientes.', 'warning');
      return;
    }

    const select = document.getElementById('fiado-cliente-select');
    const totalEl = document.getElementById('fiado-total-venda-display');
    const totais = this.calcularTotais();

    if (totalEl) totalEl.textContent = `R$ ${totais.total.toFixed(2).replace('.', ',')}`;

    if (select) {
      select.innerHTML = clientes.map(c => `
        <option value="${c.id}">${c.nome} (Saldo devedor: R$ ${c.saldoDevedor.toFixed(2)})</option>
      `).join('');
    }

    this.fecharModalPagamento();
    this.atualizarInfoClienteFiado();

    const modal = document.getElementById('modal-selecionar-cliente-fiado');
    if (modal) modal.classList.add('active');
  },

  fecharModalEscolherClienteFiado() {
    const modal = document.getElementById('modal-selecionar-cliente-fiado');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  atualizarInfoClienteFiado() {
    const select = document.getElementById('fiado-cliente-select');
    const infoBox = document.getElementById('fiado-cliente-info-box');
    if (!select || !infoBox) return;

    const clienteId = select.value;
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === clienteId);
    if (!c) return;

    const totais = this.calcularTotais();
    const novoSaldo = c.saldoDevedor + totais.total;
    const isLimiteEstourado = novoSaldo > c.limiteFiado;

    infoBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: var(--text-muted);">Saldo Devedor Atual:</span>
        <strong style="font-family: 'JetBrains Mono'; color: ${c.saldoDevedor > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">R$ ${c.saldoDevedor.toFixed(2).replace('.', ',')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: var(--text-muted);">Limite Autorizado:</span>
        <strong style="font-family: 'JetBrains Mono'; color: var(--text-main);">R$ ${c.limiteFiado.toFixed(2).replace('.', ',')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; padding-top: 6px; border-top: 1px solid #fde68a; margin-top: 4px;">
        <span style="font-weight: 700; color: #92400e;">Novo Saldo Devedor:</span>
        <strong style="font-family: 'JetBrains Mono'; font-size: 15px; color: ${isLimiteEstourado ? 'var(--accent-red)' : '#b45309'};">
          R$ ${novoSaldo.toFixed(2).replace('.', ',')}
        </strong>
      </div>
      ${isLimiteEstourado ? `<div style="margin-top: 6px; font-size: 11px; color: var(--accent-red); font-weight: 800;">⚠️ Atenção: Esta compra ultrapassará o limite estipulado!</div>` : ''}
    `;
  },

  confirmarVendaFiado() {
    const select = document.getElementById('fiado-cliente-select');
    if (!select || !select.value) {
      window.App.showToast('Selecione um cliente válido!', 'warning');
      return;
    }

    const clienteId = select.value;
    let clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === clienteId);
    if (!c) return;

    const totais = this.calcularTotais();
    const usuario = AuthModule.getUsuario();
    if (!usuario) {
      window.App.showToast('Faça login para finalizar a venda.', 'warning');
      return;
    }

    // 1. Atualizar dívida do cliente
    c.saldoDevedor += totais.total;
    c.historico = c.historico || [];
    c.historico.unshift({
      data: new Date().toISOString(),
      valor: totais.total,
      tipo: 'debito',
      descricao: `Compra fiada no PDV (${this.carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ')})`
    });

    StorageService.saveClientes(clientes);

    // 2. Gravar a venda no sistema
    const proximoNumero = StorageService.getProximoNumeroVenda();
    const venda = {
      id: 'VND-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      numeroVenda: proximoNumero,
      turnoId: StorageService.getTurnoAtual()?.id || null,
      data: new Date().toISOString(),
      itens: [...this.carrinho],
      subtotal: totais.subtotal,
      desconto: totais.desconto,
      total: totais.total,
      formaPagamento: 'Fiado',
      clienteId: c.id,
      clienteNome: c.nome,
      valorPago: 0.00,
      troco: 0.00,
      operador: usuario.nome
    };

    StorageService.saveVenda(venda);

    this.fecharModalEscolherClienteFiado();

    // Imprimir cupom
    const imprimir = document.getElementById('pag-check-imprimir')?.checked;
    if (imprimir) {
      ThermalPrintModule.imprimirCupomVenda(venda);
    }

    this.limparCarrinho();
    this.renderMiniDashboardTurno();
    if (window.ClientesModule) {
      window.ClientesModule.renderTabelaClientes();
    }
    window.App.showToast(`🎉 Venda fiada de R$ ${totais.total.toFixed(2)} marcada para ${c.nome}!`, 'success');
  },
  // Cortesia / Bonificação [F7] (Exige Senha/PIN do Gerente)
  abrirModalCortesia() {
    if (this.carrinho.length === 0) {
      window.App.showToast('Adicione os itens da cortesia no carrinho!', 'warning');
      return;
    }

    // 🔐 SEGURANÇA: Bloqueado para exigir Senha / PIN do Gerente
    AuthModule.solicitarAutorizacaoGerente(() => {
      const modal = document.getElementById('modal-cortesia');
      if (modal) {
        const motivoInput = document.getElementById('cortesia-motivo-input');
        if (motivoInput) {
          motivoInput.value = 'Degustação / Bonificação de Cliente';
          setTimeout(() => {
            motivoInput.focus();
            motivoInput.select();
          }, 150);
        }
        modal.classList.add('active');
      }
    });
  },

  fecharModalCortesia() {
    const modal = document.getElementById('modal-cortesia');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  confirmarCortesia() {
    const motivo = document.getElementById('cortesia-motivo-input')?.value.trim() || 'Degustação / Bonificação';
    const totais = this.calcularTotais();
    const usuario = AuthModule.getUsuario();
    if (!usuario) {
      window.App.showToast('Faça login para registrar a cortesia.', 'warning');
      return;
    }

    const proximoNumero = StorageService.getProximoNumeroVenda();
    const venda = {
      id: 'CRT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      numeroVenda: proximoNumero,
      turnoId: StorageService.getTurnoAtual()?.id || null,
      data: new Date().toISOString(),
      itens: [...this.carrinho],
      subtotal: totais.subtotal,
      desconto: totais.subtotal,
      total: 0.00,
      formaPagamento: 'Cortesia',
      motivoCortesia: motivo,
      operador: usuario.nome
    };

    // 🛡️ Registrar Log Oficial de Cortesia na Auditoria em Tempo Real
    const itensResumo = this.carrinho.map(i => `${i.quantidade}x ${i.nome}`).join(', ');
    AuditModule.registrarLog('cortesia', `Registrou Cortesia no valor de R$ ${totais.subtotal.toFixed(2)} (${this.carrinho.length} item(ns): ${itensResumo}). Motivo: ${motivo}`, {
      motivo: motivo,
      valorOriginal: totais.subtotal,
      itens: this.carrinho,
      operador: usuario.nome,
      vendaId: venda.id
    });

    StorageService.saveVenda(venda);
    this.fecharModalCortesia();
    this.limparCarrinho();
    this.renderMiniDashboardTurno();
    this.tocarSomBeep(true);
    window.App.showToast(`🎁 Cortesia registrada com sucesso (R$ ${totais.subtotal.toFixed(2)})!`, 'success');
  },
  abrirModalClubeFidelidade() {
    if (!StorageService.isModuloAtivo('clubeFidelidade')) return;
    const modal = document.getElementById('modal-clube-fidelidade');
    if (modal) {
      modal.classList.add('active');
      const cpfInput = document.getElementById('clube-cpf-input');
      if (cpfInput) {
        cpfInput.value = this.formatarCpfClube(this.clienteClubeAtivo ? (this.clienteClubeAtivo.cpfCnpj || '') : '');
        if (!cpfInput.dataset.hasMask) {
          cpfInput.dataset.hasMask = 'true';
          cpfInput.addEventListener('input', () => {
            cpfInput.value = this.formatarCpfClube(cpfInput.value);
          });
        }
      }
      
      const infoBox = document.getElementById('clube-fidelidade-info');
      const infoNome = document.getElementById('clube-fidelidade-nome');
      const infoStatus = document.getElementById('clube-fidelidade-status');

      if (this.clienteClubeAtivo) {
        infoBox.style.display = 'block';
        infoBox.style.background = '#fef3c7';
        infoBox.style.borderColor = '#fde68a';
        infoNome.style.color = '#b45309';
        infoNome.textContent = this.clienteClubeAtivo.nome;
        infoStatus.style.color = '#d97706';
        infoStatus.textContent = 'Membro do Clube';
      } else {
        infoBox.style.display = 'none';
      }

      document.getElementById('btn-remover-clube').style.display = this.clienteClubeAtivo ? 'flex' : 'none';
      setTimeout(() => document.getElementById('clube-cpf-input').focus(), 150);
    }
  },

  formatarCpfClube(valor) {
    let numeros = String(valor || '').replace(/\D/g, '').slice(0, 11);
    numeros = numeros.replace(/(\d{3})(\d)/, '$1.$2');
    numeros = numeros.replace(/(\d{3})(\d)/, '$1.$2');
    numeros = numeros.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return numeros;
  },

  fecharModalClubeFidelidade() {
    const modal = document.getElementById('modal-clube-fidelidade');
    if (modal) modal.classList.remove('active');
    this.focarInputLeitor();
  },

  aplicarClubeFidelidade(e) {
    e.preventDefault();
    const cpfRaw = document.getElementById('clube-cpf-input').value;
    const cpf = cpfRaw.replace(/\D/g, '');
    
    if (cpf.length < 11) {
      window.App.showToast('CPF/CNPJ invalido!', 'warning');
      return;
    }

    const clientes = StorageService.getClientes() || [];
    const cliente = clientes.find(c => (c.cpfCnpj || '').replace(/\D/g, '') === cpf);

    const infoBox = document.getElementById('clube-fidelidade-info');
    const infoNome = document.getElementById('clube-fidelidade-nome');
    const infoStatus = document.getElementById('clube-fidelidade-status');

    if (!cliente) {
      infoBox.style.display = 'block';
      infoBox.style.background = '#fef2f2';
      infoBox.style.borderColor = '#fca5a5';
      infoNome.style.color = '#dc2626';
      infoNome.textContent = 'Cliente nao encontrado!';
      infoStatus.style.color = '#ef4444';
      infoStatus.textContent = 'CPF nao cadastrado.';
      return;
    }

    if (cliente.membroClube === false) {
      infoBox.style.display = 'block';
      infoBox.style.background = '#fef2f2';
      infoBox.style.borderColor = '#fca5a5';
      infoNome.style.color = '#dc2626';
      infoNome.textContent = cliente.nome;
      infoStatus.style.color = '#ef4444';
      infoStatus.textContent = 'Nao e membro do clube.';
      return;
    }

    // Success
    this.clienteClubeAtivo = cliente;
    window.App.showToast(`Clube Fidelidade ativado para ${cliente.nome}!`, 'success');
    this.fecharModalClubeFidelidade();
    this.renderCarrinho();
  },

  removerClubeFidelidade() {
    this.clienteClubeAtivo = null;
    window.App.showToast('Clube Fidelidade removido.', 'info');
    this.fecharModalClubeFidelidade();
    this.renderCarrinho();
  }
};
