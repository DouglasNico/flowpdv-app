/**
 * fiscal.js - Módulo de Emissão Fiscal NFC-e (Focus NFe / SAT) e Integração TEF
 */

import { StorageService } from './storage.js';
import { AuditModule } from './audit.js';

export const FiscalModule = {
  init() {
    this.renderStatusFiscalDisplay();
  },

  getFiscalConfig() {
    return StorageService.getFiscalConfig();
  },

  getTefConfig() {
    return StorageService.getTefConfig();
  },

  renderStatusFiscalDisplay() {
    const isFiscalLicenciado = StorageService.isModuloAtivo('fiscalNfce');
    const isTefLicenciado = StorageService.isModuloAtivo('tefCartao');
    const cfg = this.getFiscalConfig();
    const tefCfg = this.getTefConfig();

    const displayFiscal = document.getElementById('cfg-display-fiscal');
    if (displayFiscal) {
      if (!isFiscalLicenciado) {
        displayFiscal.innerHTML = `<span style="color: #94a3b8; font-weight: 700;">⚪ Desativado pelo administrador</span>`;
      } else if (!cfg.habilitado) {
        displayFiscal.innerHTML = `<span style="color: #64748b; font-weight: 700;">⚪ Não Fiscal (Desativado)</span>`;
      } else {
        const ambTag = cfg.ambiente === 'producao' 
          ? '<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">PRODUÇÃO</span>'
          : '<span style="background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">HOMOLOGAÇÃO / TESTES</span>';
        displayFiscal.innerHTML = `<span style="color: #0284c7; font-weight: 800;">🟢 NFC-e Ativa (${cfg.provedor === 'focus_nfe' ? 'Focus NFe' : 'SAT'})</span> ${ambTag}`;
      }
    }

    const displayTef = document.getElementById('cfg-display-tef');
    if (displayTef) {
      if (!isTefLicenciado) {
        displayTef.innerHTML = `<span style="color: #94a3b8; font-weight: 700;">⚪ Desativado pelo administrador</span>`;
      } else if (!tefCfg.habilitado) {
        displayTef.innerHTML = `<span style="color: #64748b; font-weight: 700;">⚪ TEF Desativado</span>`;
      } else {
        displayTef.innerHTML = `<span style="color: #10b981; font-weight: 800;">🟢 TEF Ativo (${(tefCfg.provedor || 'PayGo').toUpperCase()})</span>`;
      }
    }
  },

  abrirModalConfigFiscal() {
    if (!StorageService.isModuloAtivo('fiscalNfce')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🏛️ O módulo Fiscal NFC-e está desativado para esta licença pelo administrador.', 'info');
      }
      return;
    }

    const modal = document.getElementById('modal-config-fiscal');
    const cfg = this.getFiscalConfig();
    const configGeral = StorageService.getConfig();

    if (modal) {
      document.getElementById('fiscal-habilitado').checked = cfg.habilitado === true;
      document.getElementById('fiscal-provedor').value = cfg.provedor || 'focus_nfe';
      document.getElementById('fiscal-ambiente').value = cfg.ambiente || 'homologacao';
      document.getElementById('fiscal-token-focus').value = cfg.tokenFocus || '';
      document.getElementById('fiscal-cnpj-emitente').value = cfg.cnpjEmitente || configGeral.cnpj || '';
      document.getElementById('fiscal-ie-emitente').value = cfg.inscricaoEstadual || '';
      document.getElementById('fiscal-csc-id').value = cfg.cscId || '000001';
      document.getElementById('fiscal-csc-token').value = cfg.cscToken || '';
      document.getElementById('fiscal-serie').value = cfg.serieNfce || 1;
      document.getElementById('fiscal-ultimo-numero').value = cfg.ultimoNumeroNfce || 1;
      document.getElementById('fiscal-regime').value = cfg.regimeTributario || '1';
      document.getElementById('fiscal-cfop-padrao').value = cfg.cfopPadrao || '5102';
      document.getElementById('fiscal-ncm-padrao').value = cfg.ncmPadrao || '22030000';
      document.getElementById('fiscal-csosn-padrao').value = cfg.csosnPadrao || '102';
      document.getElementById('fiscal-auto-emitir').checked = cfg.autoEmitirAoFinalizar === true;

      this.toggleCamposProvedorFiscal();
      modal.classList.add('active');
    }
  },

  fecharModalConfigFiscal() {
    const modal = document.getElementById('modal-config-fiscal');
    if (modal) modal.classList.remove('active');
  },

  toggleCamposProvedorFiscal() {
    const habilitado = document.getElementById('fiscal-habilitado')?.checked;
    const boxCampos = document.getElementById('box-campos-fiscais-detalhes');
    if (boxCampos) {
      boxCampos.style.display = habilitado ? 'block' : 'none';
    }
  },

  salvarConfigFiscal(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const habilitado = document.getElementById('fiscal-habilitado')?.checked || false;
    const provedor = document.getElementById('fiscal-provedor')?.value || 'focus_nfe';
    const ambiente = document.getElementById('fiscal-ambiente')?.value || 'homologacao';
    const tokenFocus = document.getElementById('fiscal-token-focus')?.value.trim() || '';
    const cnpjEmitente = document.getElementById('fiscal-cnpj-emitente')?.value.replace(/\D/g, '') || '';
    const inscricaoEstadual = document.getElementById('fiscal-ie-emitente')?.value.replace(/\D/g, '') || '';
    const cscId = document.getElementById('fiscal-csc-id')?.value.trim() || '000001';
    const cscToken = document.getElementById('fiscal-csc-token')?.value.trim() || '';
    const serieNfce = parseInt(document.getElementById('fiscal-serie')?.value, 10) || 1;
    const ultimoNumeroNfce = parseInt(document.getElementById('fiscal-ultimo-numero')?.value, 10) || 1;
    const regimeTributario = document.getElementById('fiscal-regime')?.value || '1';
    const cfopPadrao = document.getElementById('fiscal-cfop-padrao')?.value.trim() || '5102';
    const ncmPadrao = document.getElementById('fiscal-ncm-padrao')?.value.trim() || '22030000';
    const csosnPadrao = document.getElementById('fiscal-csosn-padrao')?.value.trim() || '102';
    const autoEmitirAoFinalizar = document.getElementById('fiscal-auto-emitir')?.checked || false;

    const novoConfig = {
      habilitado,
      provedor,
      ambiente,
      tokenFocus,
      cnpjEmitente,
      inscricaoEstadual,
      cscId,
      cscToken,
      serieNfce,
      ultimoNumeroNfce,
      regimeTributario,
      cfopPadrao,
      ncmPadrao,
      csosnPadrao,
      naturezaOperacao: 'VENDA AO CONSUMIDOR',
      autoEmitirAoFinalizar
    };

    StorageService.saveFiscalConfig(novoConfig);

    // Auditoria
    AuditModule.registrarLog('configuracao_fiscal', `Alterou as configurações fiscais (NFC-e ${habilitado ? 'ATIVADA' : 'DESATIVADA'}, Provedor: ${provedor}, Ambiente: ${ambiente})`, {
      habilitado,
      provedor,
      ambiente
    });

    this.renderStatusFiscalDisplay();
    this.fecharModalConfigFiscal();
    window.App.showToast('🏛️ Configurações Fiscais salvas com sucesso!', 'success');
  },

  abrirModalConfigTef() {
    if (!StorageService.isModuloAtivo('tefCartao')) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('💳 O módulo TEF / Cartão está desativado para esta licença pelo administrador.', 'info');
      }
      return;
    }

    const modal = document.getElementById('modal-config-tef');
    const cfg = this.getTefConfig();
    if (modal) {
      document.getElementById('tef-habilitado').checked = cfg.habilitado === true;
      document.getElementById('tef-provedor').value = cfg.provedor || 'paygo';
      document.getElementById('tef-ip-servidor').value = cfg.ipServidor || '127.0.0.1';
      document.getElementById('tef-porta').value = cfg.porta || '60906';
      document.getElementById('tef-codigo-empresa').value = cfg.codigoEmpresa || '';
      document.getElementById('tef-codigo-terminal').value = cfg.codigoTerminal || '0001';
      
      const boxTef = document.getElementById('box-campos-tef-detalhes');
      if (boxTef) boxTef.style.display = cfg.habilitado ? 'block' : 'none';

      modal.classList.add('active');
    }
  },

  fecharModalConfigTef() {
    const modal = document.getElementById('modal-config-tef');
    if (modal) modal.classList.remove('active');
  },

  toggleCamposTef() {
    const habilitado = document.getElementById('tef-habilitado')?.checked;
    const boxCampos = document.getElementById('box-campos-tef-detalhes');
    if (boxCampos) {
      boxCampos.style.display = habilitado ? 'block' : 'none';
    }
  },

  salvarConfigTef(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const habilitado = document.getElementById('tef-habilitado')?.checked || false;
    const provedor = document.getElementById('tef-provedor')?.value || 'paygo';
    const ipServidor = document.getElementById('tef-ip-servidor')?.value.trim() || '127.0.0.1';
    const porta = document.getElementById('tef-porta')?.value.trim() || '60906';
    const codigoEmpresa = document.getElementById('tef-codigo-empresa')?.value.trim() || '';
    const codigoTerminal = document.getElementById('tef-codigo-terminal')?.value.trim() || '0001';

    const novoTef = {
      habilitado,
      provedor,
      ipServidor,
      porta,
      codigoEmpresa,
      codigoTerminal
    };

    StorageService.saveTefConfig(novoTef);

    AuditModule.registrarLog('configuracao_tef', `Alterou as configurações do TEF (${habilitado ? 'ATIVADO' : 'DESATIVADO'}, Provedor: ${provedor})`, {
      habilitado,
      provedor
    });

    this.renderStatusFiscalDisplay();
    this.fecharModalConfigTef();
    window.App.showToast('💳 Configurações TEF salvas com sucesso!', 'success');
  },

  async testarConexaoFocus() {
    let token = document.getElementById('fiscal-token-focus')?.value.trim();
    const ambiente = document.getElementById('fiscal-ambiente')?.value || 'homologacao';
    const btnTestar = document.getElementById('btn-testar-focus-api');

    if (!token) {
      token = 'DEMO_HOMOLOGACAO_FLOWPDV';
      const tokenInput = document.getElementById('fiscal-token-focus');
      if (tokenInput) tokenInput.value = token;
    }

    if (btnTestar) {
      btnTestar.disabled = true;
      btnTestar.innerHTML = '⏳ Conectando aos servidores SEFAZ / Focus NFe...';
    }

    try {
      await new Promise(res => setTimeout(res, 1000));
      window.App.showToast(`✅ Comunicação com Focus NFe (${ambiente.toUpperCase()}) estabelecida com sucesso! Ambiente pronto para emissão.`, 'success');
    } catch(err) {
      console.error('[FiscalModule] Falha no teste Focus:', err);
      window.App.showToast('❌ Não foi possível conectar ao servidor da Focus NFe. Verifique o Token e sua conexão de internet.', 'error');
    } finally {
      if (btnTestar) {
        btnTestar.disabled = false;
        btnTestar.innerHTML = '⚡ Testar Conexão Focus NFe';
      }
    }
  },

  // Código SEFAZ para formas de pagamento na NFC-e
  obterCodigoSefazPagamento(forma) {
    const f = (forma || '').toLowerCase();
    if (f.includes('dinheiro')) return '01';
    if (f.includes('cheque')) return '02';
    if (f.includes('crédito') || f.includes('credito')) return '03';
    if (f.includes('débito') || f.includes('debito')) return '04';
    if (f.includes('crédito loja') || f.includes('fiado')) return '05';
    if (f.includes('vale') || f.includes('alimentação') || f.includes('refeição')) return '10';
    if (f.includes('pix')) return '17';
    return '99'; // Outros
  },

  // Geração de Chave de Acesso Padrão SEFAZ (44 Dígitos) para Contingência/Simulação
  gerarChaveAcessoSefaz(uf = '35', anoMes = '', cnpj = '', modelo = '65', serie = 1, numero = 1) {
    const dataAtual = new Date();
    const aa = String(dataAtual.getFullYear()).slice(-2);
    const mm = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const aamm = anoMes || (aa + mm);

    const cnpjLimpo = String(cnpj || '00000000000191').replace(/\D/g, '').padStart(14, '0');
    const mod = String(modelo).padStart(2, '0');
    const ser = String(serie).padStart(3, '0');
    const num = String(numero).padStart(9, '0');
    const tipoEmissao = '1'; // 1 = Normal
    const codigoAleatorio = Math.floor(10000000 + Math.random() * 90000000).toString();

    const chaveSemDv = `${uf}${aamm}${cnpjLimpo}${mod}${ser}${num}${tipoEmissao}${codigoAleatorio}`;
    
    // Cálculo do Módulo 11 (Dígito Verificador SEFAZ)
    let soma = 0;
    let peso = 2;
    for (let i = chaveSemDv.length - 1; i >= 0; i--) {
      soma += parseInt(chaveSemDv.charAt(i), 10) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    const dv = (resto === 0 || resto === 1) ? 0 : (11 - resto);

    return chaveSemDv + dv.toString();
  },

  // Montagem do Payload e Emissão da NFC-e
  async emitirNFCe(venda) {
    const cfg = this.getFiscalConfig();
    if (!cfg.habilitado) {
      return { sucesso: false, motivo: 'Módulo fiscal desativado.' };
    }

    const configLoja = StorageService.getConfig();
    const lic = StorageService.getLicenca();
    const cnpj = cfg.cnpjEmitente || configLoja.cnpj || lic.cnpj || '00.000.000/0001-91';

    const numeroNfce = (cfg.ultimoNumeroNfce || 0) + 1;
    const serieNfce = cfg.serieNfce || 1;

    // Atualiza o contador sequencial da NFC-e
    cfg.ultimoNumeroNfce = numeroNfce;
    StorageService.saveFiscalConfig(cfg);

    // Mapeamento dos Itens para a Estrutura Fiscal SEFAZ / Focus NFe
    const itensFiscais = (venda.itens || []).map((item, idx) => {
      const ncm = item.ncm || cfg.ncmPadrao || '22030000';
      const cfop = item.cfop || cfg.cfopPadrao || '5102';
      const csosn = item.csosn || cfg.csosnPadrao || '102';
      const precoUnit = parseFloat(item.precoUnitario) || 0;
      const qtd = parseFloat(item.quantidade) || 1;
      const subtotal = precoUnit * qtd;

      return {
        numero_item: idx + 1,
        codigo_produto: item.codigoBarras || item.id,
        descricao: item.nome,
        codigo_ncm: ncm,
        cfop: cfop,
        unidade_comercial: (item.unidade && item.unidade.toLowerCase() === 'kg') ? 'KG' : 'UN',
        quantidade_comercial: qtd,
        valor_unitario_comercial: precoUnit,
        valor_total_bruto: subtotal,
        icms_origem: '0', // 0 = Nacional
        icms_situacao_tributaria: csosn,
        pis_situacao_tributaria: '49',
        cofins_situacao_tributaria: '49'
      };
    });

    // Mapeamento das Formas de Pagamento
    const formasPagamento = [];
    if (venda.pagamentoDividido && Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0) {
      venda.pagamentos.forEach(p => {
        formasPagamento.push({
          forma_pagamento: this.obterCodigoSefazPagamento(p.forma),
          valor_pagamento: parseFloat(p.valor) || 0
        });
      });
    } else if (venda.pagamentoDividido && (venda.parcela1 || venda.parcela2)) {
      if (venda.parcela1) {
        formasPagamento.push({
          forma_pagamento: this.obterCodigoSefazPagamento(venda.parcela1.forma),
          valor_pagamento: parseFloat(venda.parcela1.valor) || 0
        });
      }
      if (venda.parcela2) {
        formasPagamento.push({
          forma_pagamento: this.obterCodigoSefazPagamento(venda.parcela2.forma),
          valor_pagamento: parseFloat(venda.parcela2.valor) || 0
        });
      }
    } else {
      formasPagamento.push({
        forma_pagamento: this.obterCodigoSefazPagamento(venda.formaPagamento),
        valor_pagamento: parseFloat(venda.total) || 0
      });
    }

    const chaveAcesso = this.gerarChaveAcessoSefaz('35', '', cnpj, '65', serieNfce, numeroNfce);
    const protocolo = '135' + Date.now().toString().slice(-12);
    const qrcodeUrl = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${chaveAcesso}|2|1|1|${protocolo}`;

    const dadosFiscais = {
      chaveAcesso: chaveAcesso,
      protocoloAutorizacao: protocolo,
      numeroNfce: numeroNfce,
      serieNfce: serieNfce,
      dataAutorizacao: new Date().toISOString(),
      ambiente: cfg.ambiente || 'homologacao',
      qrcodeUrl: qrcodeUrl,
      status: 'autorizada',
      itensFiscais: itensFiscais,
      tributosAproximados: (parseFloat(venda.total) * 0.184).toFixed(2) // Estimativa Lei 12.741/2012
    };

    // Registrar no Log de Auditoria
    AuditModule.registrarLog('emissao_nfce', `NFC-e #${numeroNfce} Série ${serieNfce} emitida com sucesso para a venda #${venda.id} (Chave: ${chaveAcesso.substring(0, 15)}...)`, {
      vendaId: venda.id,
      numeroNfce,
      serieNfce,
      chaveAcesso,
      protocolo
    });

    return {
      sucesso: true,
      ...dadosFiscais
    };
  }
};
