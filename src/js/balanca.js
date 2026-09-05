/**
 * balanca.js - Módulo de Balança de Checkout (USB / Serial RS-232)
 * FlowPDV SaaS - Suporte para Toledo, Filizola, Elgin, Urano e Ramuza
 */

import { StorageService } from './storage.js';

export const BalancaModule = {
  produtoAtual: null,
  pesoAtual: 0,
  taraAtual: 0,
  portaSerialAtiva: null,
  leitorSerial: null,
  intervaloSimulacao: null,

  init() {
    this.carregarConfiguracao();
    this.renderStatusBalancaDisplay();
  },

  carregarConfiguracao() {
    return StorageService.getBalancaConfig();
  },

  salvarConfiguracao(novaConfig) {
    StorageService.saveBalancaConfig(novaConfig);
    this.renderStatusBalancaDisplay();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('✅ Configurações de Balança salvas com sucesso!', 'success');
    }
  },

  renderStatusBalancaDisplay() {
    const isBalancaLicenciada = StorageService.isModuloAtivo('balancaPeso');
    const cfg = this.carregarConfiguracao();
    const display = document.getElementById('cfg-display-balanca');
    if (!display) return;

    if (!isBalancaLicenciada) {
      display.innerHTML = `<span style="color: #94a3b8; font-weight: 700;">⚪ Desativado no Master Admin</span>`;
      return;
    }

    if (!cfg.habilitado) {
      display.innerHTML = `<span style="color: #64748b; font-weight: 700;">⚪ Balança Desativada</span>`;
    } else {
      const modeloNome = {
        'toledo_prix3': 'Toledo Prix 3',
        'toledo_prix4': 'Toledo Prix 4/5',
        'filizola_cs15': 'Filizola CS15',
        'elgin_dp30': 'Elgin DP-30',
        'urano_popz': 'Urano Pop-Z',
        'ramuza': 'Ramuza DCR'
      }[cfg.modelo] || 'Toledo';
      
      const tipo = cfg.modoSimulacao ? 'Simulador' : (cfg.porta || 'COM1');
      display.innerHTML = `<span style="color: #059669; font-weight: 800;">🟢 ${modeloNome} / ${tipo} Ativa</span>`;
    }
  },

  abrirModalConfig() {
    if (!StorageService.isModuloAtivo('balancaPeso')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚖️ O módulo Balança está desativado para esta licença no Master Admin.', 'info');
      }
      return;
    }

    const modal = document.getElementById('modal-config-balanca');
    const cfg = this.carregarConfiguracao();
    if (!modal) return;

    const checkHab = document.getElementById('balanca-habilitada');
    if (checkHab) checkHab.checked = cfg.habilitado === true;

    const selModelo = document.getElementById('balanca-modelo');
    if (selModelo) selModelo.value = cfg.modelo || 'toledo_prix3';

    const selPorta = document.getElementById('balanca-porta');
    if (selPorta) selPorta.value = cfg.porta || 'COM1';

    const selBaud = document.getElementById('balanca-baud');
    if (selBaud) selBaud.value = cfg.baudRate || 9600;

    const checkSim = document.getElementById('balanca-modo-simulacao');
    if (checkSim) checkSim.checked = cfg.modoSimulacao === true;

    this.toggleCamposBalanca();
    modal.classList.add('active');
  },

  fecharModalConfig() {
    const modal = document.getElementById('modal-config-balanca');
    if (modal) modal.classList.remove('active');
  },

  toggleCamposBalanca() {
    const hab = document.getElementById('balanca-habilitada')?.checked;
    const box = document.getElementById('box-campos-balanca-detalhes');
    if (box) box.style.display = hab ? 'block' : 'none';
  },

  salvarConfigBalanca(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const habilitado = document.getElementById('balanca-habilitada')?.checked || false;
    const modelo = document.getElementById('balanca-modelo')?.value || 'toledo_prix3';
    const porta = document.getElementById('balanca-porta')?.value || 'COM1';
    const baudRate = parseInt(document.getElementById('balanca-baud')?.value, 10) || 9600;
    const modoSimulacao = document.getElementById('balanca-modo-simulacao')?.checked || false;

    const novaCfg = {
      habilitado,
      modelo,
      porta,
      baudRate,
      modoSimulacao
    };

    StorageService.saveBalancaConfig(novaCfg);
    this.renderStatusBalancaDisplay();
    this.fecharModalConfig();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('⚖️ Configurações de Balança salvas com sucesso!', 'success');
    }
  },

  // Abrir Modal de Pesagem / Leitura de Balança
  abrirLeituraBalanca(produto, quantidadeInicial = 0) {
    this.produtoAtual = produto;
    this.taraAtual = 0;
    this.pesoAtual = quantidadeInicial > 0 ? quantidadeInicial : 0.500;

    const modal = document.getElementById('modal-leitura-balanca');
    if (!modal) return;

    // Atualizar dados do produto no modal
    const nomeEl = document.getElementById('balanca-produto-nome');
    const precoEl = document.getElementById('balanca-preco-kg');
    const codigoEl = document.getElementById('balanca-produto-codigo');

    if (nomeEl) nomeEl.textContent = produto.nome;
    if (precoEl) precoEl.textContent = `R$ ${(produto.precoVenda || 0).toFixed(2).replace('.', ',')} / kg`;
    if (codigoEl) codigoEl.textContent = `Cód: ${produto.codigoBarras || '--'}`;

    this.atualizarDisplayPeso();
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Tentar leitura serial se configurado para porta real
    const cfg = this.carregarConfiguracao();
    if (cfg.habilitar && !cfg.modoSimulacao && 'serial' in navigator) {
      this.iniciarLeituraSerialReal();
    }
  },

  fecharLeituraBalanca() {
    const modal = document.getElementById('modal-leitura-balanca');
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }

    this.pararLeituraSerial();
    this.produtoAtual = null;

    if (window.PdvModule) {
      window.PdvModule.focarInputLeitor();
    }
  },

  atualizarDisplayPeso() {
    const displayDigitos = document.getElementById('balanca-lcd-digitos');
    const totalCalculadoEl = document.getElementById('balanca-total-calculado');
    const inputManual = document.getElementById('balanca-peso-input-manual');

    const pesoLiquido = Math.max(0, this.pesoAtual - this.taraAtual);
    const precoKg = this.produtoAtual ? (this.produtoAtual.precoVenda || 0) : 0;
    const valorTotal = pesoLiquido * precoKg;

    if (displayDigitos) {
      displayDigitos.textContent = pesoLiquido.toFixed(3).replace('.', ',');
    }

    if (inputManual && document.activeElement !== inputManual) {
      inputManual.value = pesoLiquido.toFixed(3).replace('.', ',');
    }

    if (totalCalculadoEl) {
      totalCalculadoEl.textContent = `R$ ${valorTotal.toFixed(2).replace('.', ',')}`;
    }
  },

  ajustarPesoManual(valorDigitado) {
    let num = parseFloat(String(valorDigitado).replace(',', '.')) || 0;
    this.pesoAtual = Math.max(0, num);
    this.atualizarDisplayPeso();
  },

  adicionarPeso(incrementoKg) {
    this.pesoAtual = Math.max(0, Math.round((this.pesoAtual + incrementoKg) * 1000) / 1000);
    this.atualizarDisplayPeso();
  },

  definirPesoExato(pesoKg) {
    this.pesoAtual = Math.max(0, pesoKg);
    this.atualizarDisplayPeso();
  },

  zerarOuTarar() {
    if (this.taraAtual === 0 && this.pesoAtual > 0) {
      this.taraAtual = this.pesoAtual;
    } else {
      this.taraAtual = 0;
      this.pesoAtual = 0;
    }
    this.atualizarDisplayPeso();
  },

  confirmarPesoNoCarrinho() {
    if (!this.produtoAtual) return;

    const pesoLiquido = Math.max(0, this.pesoAtual - this.taraAtual);
    if (pesoLiquido <= 0.001) {
      alert('⚠️ O peso na balança precisa ser maior que zero!');
      return;
    }

    const pesoFinal = parseFloat(pesoLiquido.toFixed(3));

    if (window.PdvModule && typeof window.PdvModule.adicionarAoCarrinho === 'function') {
      window.PdvModule.adicionarAoCarrinho(this.produtoAtual, pesoFinal, false);
      window.PdvModule.tocarSomBeep(true);
    }

    const nomeProd = this.produtoAtual.nome;
    this.fecharLeituraBalanca();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`⚖️ ${pesoFinal.toFixed(3).replace('.', ',')} kg de "${nomeProd}" adicionado ao carrinho!`, 'success');
    }
  },

  // Comunicação Serial Real (Web Serial API / Electron)
  async iniciarLeituraSerialReal() {
    try {
      if (!('serial' in navigator)) return;
      const ports = await navigator.serial.getPorts();
      if (ports.length === 0) return;

      const port = ports[0];
      const cfg = this.carregarConfiguracao();
      await port.open({ baudRate: cfg.baudRate || 9600 });
      this.portaSerialAtiva = port;

      const reader = port.readable.getReader();
      this.leitorSerial = reader;

      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const texto = decoder.decode(value);
          this.processarBytesBalanca(texto);
        }
      }
    } catch (err) {
      console.warn('[Balanca] Erro na leitura serial física:', err);
    }
  },

  processarBytesBalanca(dados) {
    // Protocolo Toledo / Urano / Filizola padrão: extrai dígitos numéricos de peso (ex: STX 00650 ETX)
    const matches = dados.match(/\d{5,6}/);
    if (matches && matches[0]) {
      const valorInt = parseInt(matches[0], 10);
      const pesoKg = valorInt / 1000;
      if (pesoKg > 0 && pesoKg < 100) {
        this.pesoAtual = pesoKg;
        this.atualizarDisplayPeso();
      }
    }
  },

  async pararLeituraSerial() {
    try {
      if (this.leitorSerial) {
        await this.leitorSerial.cancel();
        this.leitorSerial.releaseLock();
        this.leitorSerial = null;
      }
      if (this.portaSerialAtiva) {
        await this.portaSerialAtiva.close();
        this.portaSerialAtiva = null;
      }
    } catch(e) {}
  },

  // Teste de Comunicação na tela de Configurações
  testarComunicacao() {
    if (!StorageService.isModuloAtivo('balancaPeso')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚖️ O módulo Balança está desativado para esta licença no Master Admin.', 'info');
      }
      return;
    }

    const cfg = this.carregarConfiguracao();
    const btn = document.getElementById('btn-testar-balanca');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Testando...';
    }

    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '⚖️ Testar Comunicação';
      }

      // Abre um teste rápido com um produto simulado
      const produtoTeste = {
        id: 'TESTE-BALANCA',
        nome: 'Item de Teste (Balança / Kg)',
        precoVenda: 39.90,
        codigoBarras: '200001000000'
      };

      this.abrirLeituraBalanca(produtoTeste, 0.750);
    }, 400);
  }
};

window.BalancaModule = BalancaModule;
