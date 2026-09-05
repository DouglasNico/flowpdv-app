/**
 * caixa.js - Gestão de Turnos de Caixa, Sangrias, Fechamento Diário e Relatórios Históricos
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { ThermalPrintModule } from './thermal-print.js';
import { AuditModule } from './audit.js';
import ExcelJS from 'exceljs';

export const CaixaModule = {
  turnoDetalheSelecionado: null,
  vendaDetalheSelecionada: null,
  secaoAtiva: 'vendas', // 'vendas' ou 'historico'

  init() {
    this.renderStatusTurno();
    this.renderHistoricoVendasTurno();
    this.renderHistoricoTurnosFechados();
    this.aplicarEstadoSecoes();
    if (window.PdvModule) window.PdvModule.renderMiniDashboardTurno();
  },

  alternarSecao(secao) {
    if (!AuthModule.isGerente()) {
      this.secaoAtiva = 'vendas';
      this.aplicarEstadoSecoes();
      return;
    }

    // Se clicar na que já está aberta, não recolhe (mantém sempre 1 aberta em tela cheia)
    this.secaoAtiva = secao;
    this.aplicarEstadoSecoes();
  },

  aplicarEstadoSecoes() {
    const isGerente = AuthModule.isGerente();
    const cardVendas = document.getElementById('card-vendas-turno-atual');
    const cardHistorico = document.getElementById('card-historico-turnos-fechados');

    const iconVendas = document.getElementById('icon-vendas-turno');
    const btnToggleVendas = document.getElementById('btn-toggle-vendas');
    const iconHistorico = document.getElementById('icon-historico-turnos');
    const btnToggleHistorico = document.getElementById('btn-toggle-historico');

    const btnExportarTodos = document.getElementById('btn-exportar-todos-turnos-excel');

    if (!isGerente) {
      if (cardHistorico) cardHistorico.style.display = 'none';
      if (btnExportarTodos) btnExportarTodos.style.display = 'none';
      if (cardVendas) {
        cardVendas.classList.remove('secao-recolhida');
        cardVendas.classList.add('secao-expandida');
      }
      if (iconVendas) iconVendas.textContent = '⚡';
      if (btnToggleVendas) btnToggleVendas.style.display = 'none';
      return;
    }

    // Modo Gerente
    if (cardHistorico) cardHistorico.style.display = 'flex';
    if (btnExportarTodos) btnExportarTodos.style.display = 'inline-block';
    if (btnToggleVendas) btnToggleVendas.style.display = 'inline-block';
    if (btnToggleHistorico) btnToggleHistorico.style.display = 'inline-block';

    if (this.secaoAtiva === 'vendas') {
      if (cardVendas) {
        cardVendas.classList.remove('secao-recolhida');
        cardVendas.classList.add('secao-expandida');
      }
      if (iconVendas) iconVendas.textContent = '▼';
      if (btnToggleVendas) {
        btnToggleVendas.textContent = '⛶ Expandido';
        btnToggleVendas.style.background = '#e0f2fe';
        btnToggleVendas.style.color = '#0369a1';
      }

      if (cardHistorico) {
        cardHistorico.classList.remove('secao-expandida');
        cardHistorico.classList.add('secao-recolhida');
      }
      if (iconHistorico) iconHistorico.textContent = '▶';
      if (btnToggleHistorico) {
        btnToggleHistorico.textContent = '➕ Clique p/ Expandir';
        btnToggleHistorico.style.background = '#f1f5f9';
        btnToggleHistorico.style.color = '#64748b';
      }
    } else {
      if (cardVendas) {
        cardVendas.classList.remove('secao-expandida');
        cardVendas.classList.add('secao-recolhida');
      }
      if (iconVendas) iconVendas.textContent = '▶';
      if (btnToggleVendas) {
        btnToggleVendas.textContent = '➕ Clique p/ Expandir';
        btnToggleVendas.style.background = '#f1f5f9';
        btnToggleVendas.style.color = '#64748b';
      }

      if (cardHistorico) {
        cardHistorico.classList.remove('secao-recolhida');
        cardHistorico.classList.add('secao-expandida');
      }
      if (iconHistorico) iconHistorico.textContent = '▼';
      if (btnToggleHistorico) {
        btnToggleHistorico.textContent = '⛶ Expandido';
        btnToggleHistorico.style.background = '#e0e7ff';
        btnToggleHistorico.style.color = '#4338ca';
      }
    }
  },

  calcularResumoFinanceiro(turno) {
    if (!turno) return {
      vendasCount: 0, totalVendas: 0, totalDinheiro: 0, totalPix: 0,
      totalDebito: 0, totalCredito: 0, totalFiado: 0, totalSangrias: 0, saldoEmGaveta: 0
    };

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

      if (v.pagamentoDividido && v.parcela1 && v.parcela2) {
        const addParcela = (forma, valor) => {
          const val = parseFloat(valor) || 0;
          if (forma === 'Dinheiro') totalDinheiro += val;
          else if (forma === 'PIX') totalPix += val;
          else if (forma === 'Débito') totalDebito += val;
          else if (forma === 'Crédito') totalCredito += val;
          else if (forma === 'Fiado') totalFiado += val;
        };
        addParcela(v.parcela1.forma, v.parcela1.valor);
        addParcela(v.parcela2.forma, v.parcela2.valor);
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
      totalDebito,
      totalCredito,
      totalFiado,
      totalSangrias,
      saldoEmGaveta
    };
  },

  renderStatusTurno() {
    const turno = StorageService.getTurnoAtual();
    const statusBox = document.getElementById('caixa-status-card');
    const btnAbrir = document.getElementById('btn-abrir-caixa-action');
    const btnFechar = document.getElementById('btn-fechar-caixa-action');
    const btnSangria = document.getElementById('btn-sangria-action');

    if (turno) {
      if (statusBox) {
        statusBox.className = 'caixa-banner open';
        statusBox.innerHTML = `
          <div>
            <div style="font-size: 13px; font-weight: 800; color: var(--accent-green); text-transform: uppercase;">🟢 Turno de Caixa Aberto</div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-main); margin-top: 4px;">Operador: ${turno.operador}</div>
            <div style="font-size: 13px; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
              Aberto em: ${new Date(turno.dataAbertura).toLocaleString('pt-BR')} | Troco Inicial: <strong>R$ ${turno.trocoInicial.toFixed(2).replace('.', ',')}</strong>
            </div>
          </div>
          <div style="text-align: right; ${(window.AuthModule && typeof window.AuthModule.isGerente === 'function' && !window.AuthModule.isGerente()) ? 'display: none;' : ''}">
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Dinheiro Estimado na Gaveta:</span>
            <div style="font-size: 28px; font-weight: 800; font-family: 'JetBrains Mono'; color: var(--accent-green);">
              R$ ${this.calcularDinheiroGaveta(turno).toFixed(2).replace('.', ',')}
            </div>
          </div>
        `;
      }
      if (btnAbrir) btnAbrir.style.display = 'none';
      if (btnFechar) btnFechar.style.display = 'inline-flex';
      if (btnSangria) btnSangria.style.display = 'inline-flex';
    } else {
      if (statusBox) {
        statusBox.className = 'caixa-banner closed';
        statusBox.innerHTML = `
          <div>
            <div style="font-size: 13px; font-weight: 800; color: var(--accent-amber); text-transform: uppercase;">🔒 Nenhum Turno de Caixa Aberto</div>
            <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-top: 4px;">
              Abra o caixa informando o valor do troco inicial para iniciar o registro de vendas.
            </div>
          </div>
        `;
      }
      if (btnAbrir) btnAbrir.style.display = 'inline-flex';
      if (btnFechar) btnFechar.style.display = 'none';
      if (btnSangria) btnSangria.style.display = 'none';
    }
  },

  calcularDinheiroGaveta(turno) {
    if (!turno) return 0;
    const r = this.calcularResumoFinanceiro(turno);
    return r.saldoEmGaveta || 0;
  },

  // 1. Abertura de Turno (Modal Interativo)
  abrirTurnoCaixa() {
    const modal = document.getElementById('modal-abrir-caixa');
    const input = document.getElementById('abertura-troco-input');
    if (modal) {
      if (input) {
        input.value = '50.00';
        setTimeout(() => input.select(), 150);
      }
      modal.classList.add('active');
    }
  },

  fecharModalAbertura() {
    const modal = document.getElementById('modal-abrir-caixa');
    if (modal) modal.classList.remove('active');
  },

  confirmarAberturaCaixa() {
    const input = document.getElementById('abertura-troco-input');
    const valorTroco = parseFloat(input?.value) || 0;
    const usuario = AuthModule.getUsuario();

    const novoTurno = {
      id: 'TRN-' + Date.now().toString().slice(-6),
      operador: usuario.nome,
      dataAbertura: new Date().toISOString(),
      trocoInicial: valorTroco,
      saldoDinheiroGaveta: valorTroco,
      saldoEsperado: valorTroco,
      status: 'aberto',
      sangrias: []
    };

    StorageService.salvarTurno(novoTurno);
    
    // Força sincronização imediata na nuvem
    if (window.BackupModule && typeof window.BackupModule.fazerBackupNuvem === 'function') {
      window.BackupModule.fazerBackupNuvem({ silencioso: true });
    }

    // Log de Auditoria
    AuditModule.registrarLog('abertura_caixa', `Abriu o caixa com R$ ${valorTroco.toFixed(2)} de troco inicial`, {
      turnoId: novoTurno.id,
      trocoInicial: valorTroco
    });

    this.fecharModalAbertura();
    this.renderStatusTurno();
    this.renderHistoricoVendasTurno();
    this.renderHistoricoTurnosFechados();
    if (window.PdvModule) window.PdvModule.renderMiniDashboardTurno();
    window.App.showToast(`🎉 Caixa aberto com R$ ${valorTroco.toFixed(2)} de troco inicial!`, 'success');
  },

  // 2. Sangria / Retirada de Caixa (Modal Interativo)
  realizarSangria() {
    const turno = StorageService.getTurnoAtual();
    if (!turno) {
      window.App.showToast('Abra um turno de caixa primeiro para poder realizar sangrias!', 'warning');
      this.abrirTurnoCaixa();
      return;
    }

    AuthModule.executarComPermissaoOuPin('realizarSangria', () => {
      const modal = document.getElementById('modal-sangria-caixa');
      const saldoEl = document.getElementById('sangria-saldo-gaveta-display');
      const inputValor = document.getElementById('sangria-valor-input');
      const inputMotivo = document.getElementById('sangria-motivo-input');

      if (saldoEl) saldoEl.textContent = `R$ ${this.calcularDinheiroGaveta(turno).toFixed(2).replace('.', ',')}`;
      if (inputValor) {
        inputValor.value = '';
        setTimeout(() => inputValor.focus(), 150);
      }
      if (inputMotivo) inputMotivo.value = '';

      if (modal) modal.classList.add('active');
    }, 'Autorização: Realizar Sangria [F9]');
  },

  fecharModalSangria() {
    const modal = document.getElementById('modal-sangria-caixa');
    if (modal) modal.classList.remove('active');
  },

  confirmarSangria() {
    const turno = StorageService.getTurnoAtual();
    if (!turno) return;

    const inputValor = document.getElementById('sangria-valor-input');
    const inputMotivo = document.getElementById('sangria-motivo-input');

    const valor = parseFloat(inputValor?.value) || 0;
    const motivo = inputMotivo?.value.trim() || 'Retirada para cofre / despesa';

    if (valor <= 0) {
      window.App.showToast('Informe um valor válido maior que zero!', 'warning');
      return;
    }

    const saldoAtual = this.calcularDinheiroGaveta(turno);
    if (valor > saldoAtual) {
      window.App.showToast(`Valor da sangria (R$ ${valor.toFixed(2)}) é maior que o dinheiro na gaveta (R$ ${saldoAtual.toFixed(2)})!`, 'warning');
      return;
    }

    turno.sangrias = turno.sangrias || [];
    turno.sangrias.push({
      data: new Date().toISOString(),
      valor: valor,
      motivo: motivo,
      operador: AuthModule.getUsuario().nome
    });

    StorageService.salvarTurno(turno);

    // Força sincronização imediata na nuvem
    if (window.BackupModule && typeof window.BackupModule.fazerBackupNuvem === 'function') {
      window.BackupModule.fazerBackupNuvem({ silencioso: true });
    }

    // Log de Auditoria
    AuditModule.registrarLog('sangria_caixa', `Registrou sangria de R$ ${valor.toFixed(2)}. Motivo: ${motivo || 'Não informado'}`, {
      valor: valor,
      motivo: motivo
    });

    this.fecharModalSangria();
    this.renderStatusTurno();
    window.App.showToast(`💸 Sangria de R$ ${valor.toFixed(2)} registrada com sucesso!`, 'info');
  },

  parseMoedaBR(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    const limpo = String(valor).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(limpo) || 0;
  },

  // 3. Fechamento de Caixa (Conferência Cega & Auditoria)
  fecharTurnoCaixa() {
    const turno = StorageService.getTurnoAtual();
    if (!turno) {
      window.App.showToast('Nenhum turno aberto no momento.', 'warning');
      return;
    }

    const modal = document.getElementById('modal-fechar-caixa');
    const form = document.getElementById('form-fechamento-caixa');
    const inputDinheiro = document.getElementById('fechamento-dinheiro-fisico-input');
    const inputPix = document.getElementById('fechamento-pix-input');
    const inputCartao = document.getElementById('fechamento-cartao-input');
    const inputObs = document.getElementById('fechamento-obs-input');

    if (form) form.reset();

    const aplicarMascara = (input) => {
      if (!input || input.dataset.hasMoneyMask) return;
      input.dataset.hasMoneyMask = 'true';
      input.addEventListener('input', () => {
        let v = input.value.replace(/\D/g, '');
        if (!v) { input.value = ''; return; }
        const num = parseInt(v, 10) / 100;
        input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    };

    aplicarMascara(inputDinheiro);
    aplicarMascara(inputPix);
    aplicarMascara(inputCartao);

    if (modal) modal.classList.add('active');
    setTimeout(() => { if (inputDinheiro) inputDinheiro.focus(); }, 150);
  },

  fecharModalFechamento() {
    const modal = document.getElementById('modal-fechar-caixa');
    if (modal) modal.classList.remove('active');
  },

  confirmarFechamentoCaixa(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const turno = StorageService.getTurnoAtual();
    if (!turno) return;

    const r = this.calcularResumoFinanceiro(turno);

    const dinheiroInformado = this.parseMoedaBR(document.getElementById('fechamento-dinheiro-fisico-input')?.value);
    const pixInformado = this.parseMoedaBR(document.getElementById('fechamento-pix-input')?.value);
    const cartaoInformado = this.parseMoedaBR(document.getElementById('fechamento-cartao-input')?.value);
    const obs = document.getElementById('fechamento-obs-input')?.value.trim() || '';

    const saldoEsperado = r.saldoEmGaveta || 0;
    const diferenca = dinheiroInformado - saldoEsperado;

    const turnoFechado = {
      ...turno,
      status: 'fechado',
      dataFechamento: new Date().toISOString(),
      totalDinheiro: r.totalDinheiro || 0,
      totalPix: r.totalPix || 0,
      totalDebito: r.totalDebito || 0,
      totalCredito: r.totalCredito || 0,
      totalFiado: r.totalFiado || 0,
      totalVendasGeral: r.totalVendas || 0,
      totalSangrias: r.totalSangrias || 0,
      dinheiroGaveta: saldoEsperado,
      saldoEsperado: saldoEsperado,
      saldoInformado: dinheiroInformado,
      diferenca: diferenca,
      pixInformado: pixInformado > 0 ? pixInformado : null,
      cartaoInformado: cartaoInformado > 0 ? cartaoInformado : null,
      observacoesFechamento: obs,
      fechamentoCego: true,
      qtdVendas: r.vendasCount || 0
    };

    StorageService.arquivarTurnoFechado(turnoFechado);

    // Registrar no Log de Auditoria no Master
    const statusDiferenca = diferenca === 0 ? 'exato (sem quebra)' : (diferenca > 0 ? `sobra de +R$ ${diferenca.toFixed(2)}` : `falta de -R$ ${Math.abs(diferenca).toFixed(2)}`);
    AuditModule.registrarLog('fechamento_caixa', `Fechamento Cego de Caixa efetuado por ${turno.operador}: Esperado R$ ${saldoEsperado.toFixed(2)}, Informado R$ ${dinheiroInformado.toFixed(2)} (${statusDiferenca})`, {
      turnoId: turno.id,
      operador: turno.operador,
      saldoEsperado,
      saldoInformado: dinheiroInformado,
      diferenca,
      qtdVendas: r.vendasCount,
      totalVendas: r.totalVendas
    });

    // Impressão Térmica Automática do Fechamento
    ThermalPrintModule.imprimirFechamentoCaixa(turnoFechado);

    if (window.BackupModule && typeof window.BackupModule.fazerBackupNuvem === 'function') {
      window.BackupModule.fazerBackupNuvem({ silencioso: true });
    }

    this.fecharModalFechamento();
    this.renderStatusTurno();
    this.renderHistoricoVendasTurno();
    this.renderHistoricoTurnosFechados();
    if (window.PdvModule) window.PdvModule.renderMiniDashboardTurno();

    const isGerenteOuAdmin = window.AuthModule && (window.AuthModule.isGerente() || window.AuthModule.isSuperAdmin());
    let msgAlerta = `🎉 Turno #${turno.id} encerrado com sucesso!`;
    let toastTipo = 'success';

    // Apenas Gerentes e Administradores visualizam notificação de Sobra ou Falta/Quebra de Caixa
    if (isGerenteOuAdmin) {
      if (diferenca > 0) {
        msgAlerta = `🟢 Turno #${turno.id} encerrado com Sobra de Caixa de R$ ${diferenca.toFixed(2).replace('.', ',')}!`;
      } else if (diferenca < 0) {
        msgAlerta = `🔴 Turno #${turno.id} encerrado com Quebra/Falta de Caixa de R$ ${Math.abs(diferenca).toFixed(2).replace('.', ',')}!`;
        toastTipo = 'warning';
      }
    }

    window.App.showToast(msgAlerta, toastTipo);
  },

  // 4. Histórico de Turnos Fechados
  renderHistoricoTurnosFechados() {
    this.aplicarEstadoSecoes();

    const turnos = StorageService.getHistoricoTurnos();
    const badgeQtd = document.getElementById('badge-historico-qtd');
    if (badgeQtd) {
      badgeQtd.textContent = `${turnos.length} ${turnos.length === 1 ? 'turno' : 'turnos'}`;
    }

    const contadorEl = document.getElementById('historico-turnos-contador');
    if (contadorEl) {
      contadorEl.innerHTML = `📊 Total: <strong>${turnos.length} ${turnos.length === 1 ? 'turno arquivado' : 'turnos arquivados'}</strong>`;
    }

    const tbody = document.getElementById('historico-turnos-tbody');
    if (!tbody) return;

    if (turnos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 28px; color: var(--text-dim); font-size: 14px;">Nenhum turno anterior arquivado ainda.</td></tr>`;
      return;
    }

    tbody.innerHTML = turnos.map(t => {
      const dataAberturaStr = new Date(t.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const dataFechamentoStr = t.dataFechamento ? new Date(t.dataFechamento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Em Aberto';
      const r = this.calcularResumoFinanceiro(t);
      const operadorNome = t.operador || 'Operador';
      const trocoInicial = parseFloat(t.trocoInicial || t.valorAbertura) || 0;
      const totalVendas = r.totalVendas || 0;
      const dinheiroGaveta = r.saldoEmGaveta || (trocoInicial + (r.totalDinheiro || 0) - (r.totalSangrias || 0));

      return `
        <tr>
          <td>
            <strong style="color: var(--text-main); font-family: 'JetBrains Mono'; font-size: 13px;">#${t.id ? t.id.slice(-6) : 'TURNO'}</strong>
          </td>
          <td>
            <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${dataAberturaStr}</div>
            <div style="font-size: 11px; color: var(--text-muted);">até ${dataFechamentoStr}</div>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">👤 ${operadorNome}</div>
          </td>
          <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-muted);">
            R$ ${trocoInicial.toFixed(2).replace('.', ',')}
          </td>
          <td style="text-align: center;">
            <strong style="color: var(--accent-green); font-family: 'JetBrains Mono'; font-size: 13px;">R$ ${totalVendas.toFixed(2).replace('.', ',')}</strong>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${r.vendasCount} ${r.vendasCount === 1 ? 'venda' : 'vendas'}</div>
          </td>
          <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 800; color: #0284c7;">
            R$ ${dinheiroGaveta.toFixed(2).replace('.', ',')}
            ${t.diferenca !== undefined && t.diferenca !== null ? `
              ${t.diferenca === 0 
                ? '<div style="font-size: 10px; color: #16a34a; font-weight: 800; margin-top: 2px;">✅ Bateu</div>' 
                : (t.diferenca > 0 
                  ? `<div style="font-size: 10px; color: #15803d; font-weight: 800; margin-top: 2px;">🟢 Sobra +R$ ${t.diferenca.toFixed(2).replace('.', ',')}</div>`
                  : `<div style="font-size: 10px; color: #dc2626; font-weight: 800; margin-top: 2px;">🔴 Falta -R$ ${Math.abs(t.diferenca).toFixed(2).replace('.', ',')}</div>`
                )}
            ` : ''}
          </td>
          <td style="text-align: center;">
            <span class="user-role-tag ${t.status === 'fechado' ? 'operador' : 'gerente'}" style="font-size: 10px; font-weight: 800; padding: 2px 8px;">
              ${t.status === 'fechado' ? 'FECHADO' : 'ABERTO'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button type="button" class="btn-primary-action" style="padding: 0 10px; height: 32px; font-size: 12px; font-weight: 700; background: #f1f5f9; color: var(--text-main); border: 1px solid var(--border-card); cursor: pointer;" onclick="CaixaModule.verDetalhesTurno('${t.id}')" title="Visualizar detalhes e conferência completa do turno">
                🔍 Detalhes
              </button>
              <button type="button" class="btn-primary-action" style="padding: 0 10px; height: 32px; font-size: 12px; font-weight: 700; background: #0284c7; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);" onclick="CaixaModule.imprimirComprovanteTurnoFechado('${t.id}')" title="Reimprimir cupom fiscal/gerencial de fechamento na impressora térmica">
                🧾 Cupom
              </button>
              <button type="button" class="btn-primary-action" style="padding: 0 10px; height: 32px; font-size: 12px; font-weight: 700; background: #059669; color: #ffffff; border: none; cursor: pointer; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);" onclick="CaixaModule.exportarTurnoExcel('${t.id}')" title="Baixar relatório completo em planilha Excel (.xlsx)">
                📊 Excel
              </button>
              <button type="button" class="btn-primary-action" style="padding: 0 8px; height: 32px; font-size: 13px; font-weight: 700; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='#fecaca'; this.style.borderColor='#ef4444';" onmouseout="this.style.background='#fee2e2'; this.style.borderColor='#fca5a5';" onclick="CaixaModule.solicitarExcluirTurno('${t.id}')" title="Excluir este turno do histórico">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  solicitarExcluirTurno(turnoId) {
    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') 
      ? window.AuthModule.isGerente() 
      : true;

    if (isGerente) {
      this.abrirModalConfirmacaoExcluir(turnoId);
    } else {
      if (window.AuthModule && typeof window.AuthModule.solicitarAutorizacaoGerente === 'function') {
        window.AuthModule.solicitarAutorizacaoGerente('excluir_turno', () => {
          this.abrirModalConfirmacaoExcluir(turnoId);
        });
      } else {
        this.abrirModalConfirmacaoExcluir(turnoId);
      }
    }
  },

  abrirModalConfirmacaoExcluir(turnoId) {
    const modal = document.getElementById('modal-confirmacao-excluir-turno');
    const turnos = StorageService.getHistoricoTurnos();
    const turno = turnos.find(t => t.id === turnoId);
    const turnoNome = turno ? `#${(turno.id || '').slice(-6)}` : 'este turno';

    const tituloEl = document.getElementById('modal-confirm-turno-titulo');
    const msgEl = document.getElementById('modal-confirm-turno-msg');
    const btnConfirmar = document.getElementById('btn-confirmar-exclusao-turno');

    if (tituloEl) tituloEl.textContent = `Excluir Turno ${turnoNome}`;
    if (msgEl) msgEl.textContent = `Deseja realmente remover permanentemente o registro do turno ${turnoNome} do histórico de caixa? Esta ação sincronizará a exclusão em todos os computadores da loja.`;

    if (btnConfirmar) {
      btnConfirmar.onclick = () => {
        this.executarExclusaoTurno(turnoId, turnoNome);
      };
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  },

  fecharModalConfirmacaoExcluir() {
    const modal = document.getElementById('modal-confirmacao-excluir-turno');
    if (modal) modal.style.display = 'none';
  },

  renderHistoricoTurnos() {
    return this.renderHistoricoTurnosFechados();
  },

  executarExclusaoTurno(turnoId, turnoNome) {
    this.fecharModalConfirmacaoExcluir();

    try {
      StorageService.excluirTurnoHistorico(turnoId);
      this.renderHistoricoTurnosFechados();

      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('turno_excluido');
      }

      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🗑️ Turno ${turnoNome} excluído com sucesso!`, 'success');
      }
    } catch (err) {
      console.error('Erro ao excluir turno:', err);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('❌ Erro ao excluir turno do histórico.', 'error');
      }
    }
  },

  async salvarArquivoExcel(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  imprimirComprovanteTurnoFechado(turnoId) {
    const turnos = StorageService.getHistoricoTurnos() || [];
    const turno = (turnoId ? turnos.find(t => String(t.id) === String(turnoId)) : null) || this.turnoDetalheSelecionado || StorageService.getTurnoAtual();
    if (!turno) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Turno não encontrado para impressão!', 'error');
      }
      return;
    }
    if (window.ThermalPrintModule && typeof window.ThermalPrintModule.imprimirFechamentoCaixa === 'function') {
      window.ThermalPrintModule.imprimirFechamentoCaixa(turno);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🖨️ Imprimindo cupom de fechamento do turno #${(turno.id || '').slice(-6)}...`, 'success');
      }
    }
  },

  exportarTurnoFechadoExcel(turnoId) {
    return this.exportarTurnoExcel(turnoId);
  },

  async exportarTurnoExcel(turnoId) {
    if (!AuthModule.isGerente()) {
      window.App.showToast('🔒 Acesso restrito: Apenas o Gerente pode exportar relatórios financeiros de caixa!', 'warning');
      return;
    }

    const turnos = StorageService.getHistoricoTurnos();
    const turno = (turnoId ? turnos.find(t => t.id === turnoId) : null) || this.turnoDetalheSelecionado || StorageService.getTurnoAtual();
    if (!turno) {
      window.App.showToast('Turno não encontrado para exportação!', 'warning');
      return;
    }

    const r = this.calcularResumoFinanceiro(turno);
    const vendas = StorageService.getVendas();
    const dataInicio = new Date(turno.dataAbertura);
    const dataFim = turno.dataFechamento ? new Date(turno.dataFechamento) : new Date();

    const vendasTurno = vendas.filter(v => {
      if ((turno.vendasIds || []).includes(v.id)) return true;
      const d = new Date(v.data);
      return d >= dataInicio && d <= dataFim;
    });

    const dataAb = new Date(turno.dataAbertura).toLocaleString('pt-BR');
    const dataFc = turno.dataFechamento ? new Date(turno.dataFechamento).toLocaleString('pt-BR') : 'Em Aberto';
    const trocoInicial = parseFloat(turno.trocoInicial || turno.valorAbertura) || 0;
    const totalVendas = r.totalVendas || 0;
    const calcPct = (val) => totalVendas > 0 ? `${((val / totalVendas) * 100).toFixed(1)}%` : '0.0%';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FlowPDV';
    workbook.created = new Date();

    // Estilos padrão de design
    const fontTitle = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontSubtitle = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
    const fontCardHeader = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontColHeader = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontBold = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    const fontRegular = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // ==========================================
    // ABA 1: RESUMO DO CAIXA (DASHBOARD EXECUTIVO)
    // ==========================================
    const wsResumo = workbook.addWorksheet('Resumo do Caixa', { views: [{ showGridLines: true }] });
    wsResumo.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 22 },
      { key: 'C', width: 18 },
      { key: 'D', width: 28 },
      { key: 'E', width: 22 }
    ];

    // Banner Principal
    wsResumo.mergeCells('A1:E1');
    const t1 = wsResumo.getCell('A1');
    t1.value = 'FLOWPDV — RELATÓRIO EXECUTIVO DE FECHAMENTO DE CAIXA';
    t1.font = fontTitle;
    t1.alignment = { vertical: 'middle', horizontal: 'center' };
    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    wsResumo.getRow(1).height = 36;

    const cfg = StorageService.getConfig() || {};
    const nomeLojaRelatorio = cfg.nomeEmpresa || 'Comércio & Frente de Caixa';

    wsResumo.mergeCells('A2:E2');
    const t2 = wsResumo.getCell('A2');
    t2.value = `${nomeLojaRelatorio} | Auditoria Financeira de Turno | Emitido em: ${new Date().toLocaleString('pt-BR')}`;
    t2.font = fontSubtitle;
    t2.alignment = { vertical: 'middle', horizontal: 'center' };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    wsResumo.getRow(2).height = 22;

    // Cabeçalhos dos Cards Lado a Lado
    wsResumo.mergeCells('A4:B4');
    const card1 = wsResumo.getCell('A4');
    card1.value = '📋 INFORMAÇÕES DO TURNO';
    card1.font = fontCardHeader;
    card1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    card1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    wsResumo.mergeCells('D4:E4');
    const card2 = wsResumo.getCell('D4');
    card2.value = '📈 INDICADORES FINANCEIROS (KPIS)';
    card2.font = fontCardHeader;
    card2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    card2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    wsResumo.getRow(4).height = 26;

    // Dados dos Cards
    const cardData = [
      ['ID do Turno:', `#${turno.id ? turno.id.slice(-6) : 'TURNO'}`, 'Total Faturado:', totalVendas, true],
      ['Operador Responsável:', turno.operador || 'Operador', 'Quantidade de Vendas:', `${r.vendasCount} ${r.vendasCount === 1 ? 'venda' : 'vendas'}`, false],
      ['Data de Abertura:', dataAb, 'Saldo Final em Dinheiro:', r.saldoEmGaveta, true],
      ['Data de Fechamento:', dataFc, 'Total de Sangrias / Retiradas:', -(r.totalSangrias || 0), true],
      ['Status do Turno:', (turno.status || 'aberto').toUpperCase(), 'Troco Inicial da Gaveta:', trocoInicial, true]
    ];

    cardData.forEach((rowVals, idx) => {
      const rIdx = 5 + idx;
      wsResumo.getRow(rIdx).height = 22;

      const cA = wsResumo.getCell(`A${rIdx}`);
      const cB = wsResumo.getCell(`B${rIdx}`);
      cA.value = rowVals[0];
      cA.font = fontBold;
      cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cA.border = borderThin;

      cB.value = rowVals[1];
      cB.font = fontRegular;
      cB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cB.border = borderThin;

      const cD = wsResumo.getCell(`D${rIdx}`);
      const cE = wsResumo.getCell(`E${rIdx}`);
      cD.value = rowVals[2];
      cD.font = fontBold;
      cD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      cD.border = borderThin;

      cE.value = rowVals[3];
      cE.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: rowVals[4] ? 'FF059669' : 'FF0F172A' } };
      cE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cE.border = borderThin;
      cE.alignment = { horizontal: 'right' };
      if (rowVals[4]) cE.numFmt = '"R$" #,##0.00';
    });

    // Cabeçalhos das Tabelas Inferiores
    const hCols = [
      { pos: 'A11', text: 'FORMA DE PAGAMENTO', color: 'FF1E293B' },
      { pos: 'B11', text: 'TOTAL (R$)', color: 'FF1E293B', align: 'right' },
      { pos: 'C11', text: '% PARTICIPAÇÃO', color: 'FF1E293B', align: 'center' },
      { pos: 'D11', text: 'CONFERÊNCIA DA GAVETA', color: 'FF047857' },
      { pos: 'E11', text: 'VALOR (R$)', color: 'FF047857', align: 'right' }
    ];

    hCols.forEach(h => {
      const c = wsResumo.getCell(h.pos);
      c.value = h.text;
      c.font = fontColHeader;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: h.color } };
      c.alignment = { vertical: 'middle', horizontal: h.align || 'left' };
      c.border = borderThin;
    });
    wsResumo.getRow(11).height = 26;

    // Linhas Formas de Pagamento & Gaveta
    const breakdownRows = [
      ['💵 Dinheiro', (r.totalDinheiro || 0), calcPct(r.totalDinheiro || 0), '(+) Troco Inicial', trocoInicial],
      ['📱 PIX / QR Code', (r.totalPix || 0), calcPct(r.totalPix || 0), '(+) Entradas em Dinheiro', (r.totalDinheiro || 0)],
      ['💳 Cartão de Débito', (r.totalDebito || 0), calcPct(r.totalDebito || 0), '(-) Sangrias Realizadas', -(r.totalSangrias || 0)],
      ['💳 Cartão de Crédito', (r.totalCredito || 0), calcPct(r.totalCredito || 0), '(=) Saldo Estimado Gaveta', (r.saldoEmGaveta || 0)],
      ['📋 Fiado / Caderneta', (r.totalFiado || 0), calcPct(r.totalFiado || 0), 'Status da Gaveta', 'CONFERIDO / OK']
    ];

    breakdownRows.forEach((tr, idx) => {
      const rIdx = 12 + idx;
      wsResumo.getRow(rIdx).height = 22;
      const isEven = idx % 2 === 0;
      const bgLeft = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      const bgRight = isEven ? 'FFFFFFFF' : 'FFF0FDF4';

      const cA = wsResumo.getCell(`A${rIdx}`);
      cA.value = tr[0];
      cA.font = fontRegular;
      cA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgLeft } };
      cA.border = borderThin;

      const cB = wsResumo.getCell(`B${rIdx}`);
      cB.value = tr[1];
      cB.font = fontBold;
      cB.numFmt = '"R$" #,##0.00';
      cB.alignment = { horizontal: 'right' };
      cB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgLeft } };
      cB.border = borderThin;

      const cC = wsResumo.getCell(`C${rIdx}`);
      cC.value = tr[2];
      cC.font = fontRegular;
      cC.alignment = { horizontal: 'center' };
      cC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgLeft } };
      cC.border = borderThin;

      const cD = wsResumo.getCell(`D${rIdx}`);
      cD.value = tr[3];
      cD.font = fontRegular;
      cD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRight } };
      cD.border = borderThin;

      const cE = wsResumo.getCell(`E${rIdx}`);
      cE.value = tr[4];
      cE.font = typeof tr[4] === 'number' ? fontBold : { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } };
      if (typeof tr[4] === 'number') cE.numFmt = '"R$" #,##0.00';
      cE.alignment = { horizontal: typeof tr[4] === 'number' ? 'right' : 'center' };
      cE.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRight } };
      cE.border = borderThin;
    });

    // Linha Total Consolidado
    wsResumo.getRow(17).height = 26;
    const c17A = wsResumo.getCell('A17');
    c17A.value = 'TOTAL CONSOLIDADO';
    c17A.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c17A.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    c17A.border = borderThin;

    const c17B = wsResumo.getCell('B17');
    c17B.value = totalVendas;
    c17B.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c17B.numFmt = '"R$" #,##0.00';
    c17B.alignment = { horizontal: 'right' };
    c17B.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    c17B.border = borderThin;

    const c17C = wsResumo.getCell('C17');
    c17C.value = '100.0%';
    c17C.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c17C.alignment = { horizontal: 'center' };
    c17C.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    c17C.border = borderThin;

    // ==========================================
    // ABA 2: VENDAS DO TURNO
    // ==========================================
    const wsVendas = workbook.addWorksheet('Vendas', { views: [{ showGridLines: true }] });
    wsVendas.columns = [
      { key: 'A', width: 16 },
      { key: 'B', width: 22 },
      { key: 'C', width: 20 },
      { key: 'D', width: 20 },
      { key: 'E', width: 16 },
      { key: 'F', width: 16 },
      { key: 'G', width: 18 },
      { key: 'H', width: 16 },
      { key: 'I', width: 14 },
      { key: 'J', width: 12 }
    ];

    wsVendas.mergeCells('A1:J1');
    const v1 = wsVendas.getCell('A1');
    v1.value = 'FLOWPDV — RELATÓRIO DETALHADO DE VENDAS DO TURNO';
    v1.font = fontTitle;
    v1.alignment = { vertical: 'middle', horizontal: 'center' };
    v1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    wsVendas.getRow(1).height = 34;

    wsVendas.mergeCells('A2:J2');
    const v2 = wsVendas.getCell('A2');
    v2.value = `Turno #${turno.id ? turno.id.slice(-6) : 'TURNO'} | Período: ${dataAb} até ${dataFc} | Total de Vendas: ${vendasTurno.length}`;
    v2.font = fontSubtitle;
    v2.alignment = { vertical: 'middle', horizontal: 'center' };
    v2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    wsVendas.getRow(2).height = 22;

    const vendasHeaders = ['ID da Venda', 'Data / Hora', 'Operador', 'Forma de Pagamento', 'Subtotal (R$)', 'Desconto (R$)', 'Total da Venda (R$)', 'Valor Pago (R$)', 'Troco (R$)', 'Qtd Itens'];
    const vHeadRow = wsVendas.getRow(4);
    vHeadRow.height = 26;
    vendasHeaders.forEach((vh, i) => {
      const cell = vHeadRow.getCell(i + 1);
      cell.value = vh;
      cell.font = fontColHeader;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: i >= 4 && i <= 8 ? 'right' : (i === 9 ? 'center' : 'left') };
      cell.border = borderThin;
    });

    vendasTurno.forEach((v, idx) => {
      const rIdx = 5 + idx;
      const row = wsVendas.getRow(rIdx);
      row.height = 22;
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      const vals = [
        v.id || '',
        new Date(v.data).toLocaleString('pt-BR'),
        v.operador || turno.operador || '',
        v.formaPagamento || '',
        v.subtotal || v.total || 0,
        v.desconto || 0,
        v.total || 0,
        v.valorPago || v.total || 0,
        v.troco || 0,
        (v.itens || []).length
      ];

      vals.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = borderThin;
        if (colIdx >= 4 && colIdx <= 8) {
          cell.font = colIdx === 6 ? fontBold : fontRegular;
          cell.numFmt = '"R$" #,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (colIdx === 9) {
          cell.font = fontRegular;
          cell.alignment = { horizontal: 'center' };
        } else {
          cell.font = colIdx === 0 ? fontBold : fontRegular;
          cell.alignment = { horizontal: 'left' };
        }
      });
    });

    // ==========================================
    // ABA 3: ITENS VENDIDOS
    // ==========================================
    const wsItens = workbook.addWorksheet('Itens Vendidos', { views: [{ showGridLines: true }] });
    wsItens.columns = [
      { key: 'A', width: 16 },
      { key: 'B', width: 22 },
      { key: 'C', width: 36 },
      { key: 'D', width: 20 },
      { key: 'E', width: 18 },
      { key: 'F', width: 14 },
      { key: 'G', width: 18 },
      { key: 'H', width: 20 },
      { key: 'I', width: 20 }
    ];

    const itensRows = [];
    vendasTurno.forEach(v => {
      (v.itens || []).forEach(item => {
        itensRows.push([
          v.id || '',
          new Date(v.data).toLocaleString('pt-BR'),
          item.nome || 'Produto',
          item.codigoBarras || '',
          item.categoria || '',
          item.quantidade || 1,
          item.isFardo ? (item.unidadeFracionada || 'Fardo') : 'Unidade',
          item.precoUnitario || item.precoVenda || 0,
          (item.precoUnitario || item.precoVenda || 0) * (item.quantidade || 1)
        ]);
      });
    });

    wsItens.mergeCells('A1:I1');
    const i1 = wsItens.getCell('A1');
    i1.value = 'FLOWPDV — RELATÓRIO DE ITENS E PRODUTOS VENDIDOS';
    i1.font = fontTitle;
    i1.alignment = { vertical: 'middle', horizontal: 'center' };
    i1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    wsItens.getRow(1).height = 34;

    wsItens.mergeCells('A2:I2');
    const i2 = wsItens.getCell('A2');
    i2.value = `Turno #${turno.id ? turno.id.slice(-6) : 'TURNO'} | Total de Itens Vendidos: ${itensRows.length} produtos`;
    i2.font = fontSubtitle;
    i2.alignment = { vertical: 'middle', horizontal: 'center' };
    i2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    wsItens.getRow(2).height = 22;

    const itensHeaders = ['ID da Venda', 'Data / Hora', 'Produto', 'Código de Barras', 'Categoria', 'Quantidade', 'Embalagem / Tipo', 'Preço Unitário (R$)', 'Subtotal (R$)'];
    const iHeadRow = wsItens.getRow(4);
    iHeadRow.height = 26;
    itensHeaders.forEach((ih, i) => {
      const cell = iHeadRow.getCell(i + 1);
      cell.value = ih;
      cell.font = fontColHeader;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: i >= 7 ? 'right' : (i === 5 || i === 6 ? 'center' : 'left') };
      cell.border = borderThin;
    });

    itensRows.forEach((iRow, idx) => {
      const rIdx = 5 + idx;
      const row = wsItens.getRow(rIdx);
      row.height = 22;
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      iRow.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = borderThin;
        if (colIdx >= 7) {
          cell.font = colIdx === 8 ? fontBold : fontRegular;
          cell.numFmt = '"R$" #,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (colIdx === 5 || colIdx === 6) {
          cell.font = fontRegular;
          cell.alignment = { horizontal: 'center' };
        } else if (colIdx === 2) {
          cell.font = fontBold;
          cell.alignment = { horizontal: 'left' };
        } else {
          cell.font = fontRegular;
          cell.alignment = { horizontal: 'left' };
        }
      });
    });

    // ==========================================
    // ABA 4: SANGRIAS E RETIRADAS
    // ==========================================
    if ((turno.sangrias || []).length > 0) {
      const wsSangrias = workbook.addWorksheet('Sangrias', { views: [{ showGridLines: true }] });
      wsSangrias.columns = [
        { key: 'A', width: 22 },
        { key: 'B', width: 24 },
        { key: 'C', width: 40 },
        { key: 'D', width: 22 }
      ];

      wsSangrias.mergeCells('A1:D1');
      const s1 = wsSangrias.getCell('A1');
      s1.value = 'FLOWPDV — AUDITORIA DE SANGRIA E RETIRADAS DE DINHEIRO';
      s1.font = fontTitle;
      s1.alignment = { vertical: 'middle', horizontal: 'center' };
      s1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
      wsSangrias.getRow(1).height = 34;

      wsSangrias.mergeCells('A2:D2');
      const s2 = wsSangrias.getCell('A2');
      s2.value = `Turno #${turno.id ? turno.id.slice(-6) : 'TURNO'} | Total de Retiradas: R$ ${(r.totalSangrias || 0).toFixed(2)}`;
      s2.font = fontSubtitle;
      s2.alignment = { vertical: 'middle', horizontal: 'center' };
      s2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
      wsSangrias.getRow(2).height = 22;

      const sHeaders = ['Data / Hora', 'Operador Responsável', 'Motivo / Justificativa', 'Valor Retirado (R$)'];
      const sHeadRow = wsSangrias.getRow(4);
      sHeadRow.height = 26;
      sHeaders.forEach((sh, i) => {
        const cell = sHeadRow.getCell(i + 1);
        cell.value = sh;
        cell.font = fontColHeader;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
        cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
        cell.border = borderThin;
      });

      (turno.sangrias || []).forEach((sg, idx) => {
        const rIdx = 5 + idx;
        const row = wsSangrias.getRow(rIdx);
        row.height = 22;
        const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFFDF2F2';

        const sVals = [
          new Date(sg.data).toLocaleString('pt-BR'),
          sg.operador || turno.operador || '',
          sg.motivo || '',
          sg.valor || 0
        ];

        sVals.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderThin;
          if (colIdx === 3) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } };
            cell.numFmt = '"R$" #,##0.00';
            cell.alignment = { horizontal: 'right' };
          } else {
            cell.font = fontRegular;
            cell.alignment = { horizontal: 'left' };
          }
        });
      });
    }

    const cleanId = turno.id ? String(turno.id).replace('TRN-', '') : 'Fechamento';
    const filename = `Relatorio_Caixa_Turno_${cleanId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await this.salvarArquivoExcel(workbook, filename);

    window.App.showToast(`📊 Planilha Excel colorida e formatada gerada com sucesso!`, 'success');
  },

  async exportarTodosTurnosExcel() {
    if (!AuthModule.isGerente()) {
      window.App.showToast('🔒 Acesso restrito: Apenas o Gerente pode exportar relatórios financeiros de caixa!', 'warning');
      return;
    }

    const turnos = StorageService.getHistoricoTurnos();
    if (turnos.length === 0) {
      window.App.showToast('Nenhum turno fechado encontrado para exportar!', 'warning');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FlowPDV';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Histórico de Turnos', { views: [{ showGridLines: true }] });
    ws.columns = [
      { key: 'A', width: 14 },
      { key: 'B', width: 22 },
      { key: 'C', width: 20 },
      { key: 'D', width: 20 },
      { key: 'E', width: 18 },
      { key: 'F', width: 18 },
      { key: 'G', width: 14 },
      { key: 'H', width: 16 },
      { key: 'I', width: 16 },
      { key: 'J', width: 16 },
      { key: 'K', width: 16 },
      { key: 'L', width: 16 },
      { key: 'M', width: 16 },
      { key: 'N', width: 18 },
      { key: 'O', width: 14 }
    ];

    const fontTitle = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontSubtitle = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
    const fontColHeader = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontBold = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    const fontRegular = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    ws.mergeCells('A1:O1');
    const h1 = ws.getCell('A1');
    h1.value = 'FLOWPDV — HISTÓRICO GERAL DE TURNOS DE CAIXA';
    h1.font = fontTitle;
    h1.alignment = { vertical: 'middle', horizontal: 'center' };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    ws.getRow(1).height = 34;

    ws.mergeCells('A2:O2');
    const h2 = ws.getCell('A2');
    h2.value = `Auditoria Consolidada de Caixas | Total de Turnos: ${turnos.length} | Emitido em: ${new Date().toLocaleString('pt-BR')}`;
    h2.font = fontSubtitle;
    h2.alignment = { vertical: 'middle', horizontal: 'center' };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    ws.getRow(2).height = 22;

    const headers = [
      'ID Turno', 'Operador', 'Abertura', 'Fechamento', 'Troco Inicial (R$)',
      'Total Vendas (R$)', 'Qtd Vendas', 'Dinheiro (R$)', 'PIX (R$)',
      'Débito (R$)', 'Crédito (R$)', 'Fiado (R$)', 'Sangrias (R$)',
      'Saldo Gaveta (R$)', 'Status'
    ];

    const hRow = ws.getRow(4);
    hRow.height = 26;
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = fontColHeader;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: (i >= 4 && i <= 13) ? 'right' : (i === 14 || i === 6 ? 'center' : 'left') };
      cell.border = borderThin;
    });

    turnos.forEach((t, idx) => {
      const r = this.calcularResumoFinanceiro(t);
      const rIdx = 5 + idx;
      const row = ws.getRow(rIdx);
      row.height = 22;
      const bg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      const rowVals = [
        `#${t.id ? t.id.slice(-6) : 'TURNO'}`,
        t.operador || 'Operador',
        new Date(t.dataAbertura).toLocaleString('pt-BR'),
        t.dataFechamento ? new Date(t.dataFechamento).toLocaleString('pt-BR') : 'Em Aberto',
        parseFloat(t.trocoInicial || t.valorAbertura) || 0,
        r.totalVendas || 0,
        r.vendasCount || 0,
        r.totalDinheiro || 0,
        r.totalPix || 0,
        r.totalDebito || 0,
        r.totalCredito || 0,
        r.totalFiado || 0,
        r.totalSangrias || 0,
        r.saldoEmGaveta || 0,
        (t.status || 'fechado').toUpperCase()
      ];

      rowVals.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = borderThin;
        if (colIdx >= 4 && colIdx <= 13 && colIdx !== 6) {
          cell.font = (colIdx === 5 || colIdx === 13) ? fontBold : fontRegular;
          cell.numFmt = '"R$" #,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (colIdx === 6 || colIdx === 14) {
          cell.font = fontBold;
          cell.alignment = { horizontal: 'center' };
        } else {
          cell.font = colIdx === 0 ? fontBold : fontRegular;
          cell.alignment = { horizontal: 'left' };
        }
      });
    });

    const filename = `Historico_Geral_Caixas_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await this.salvarArquivoExcel(workbook, filename);
    window.App.showToast(`📊 Histórico geral exportado em Excel colorido com sucesso!`, 'success');
  },

  renderHistoricoVendasTurno() {
    const tbody = document.getElementById('caixa-vendas-tbody');
    const contadorEl = document.getElementById('caixa-vendas-contador');
    const badgeQtd = document.getElementById('badge-vendas-qtd');

    this.aplicarEstadoSecoes();

    if (!tbody) return;

    const turno = StorageService.getTurnoAtual();
    if (!turno) {
      if (badgeQtd) badgeQtd.textContent = '0 vendas';
      if (contadorEl) contadorEl.innerHTML = `⚡ Total: <strong>0 vendas no turno</strong>`;
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">Turno fechado. Abra o caixa para registrar vendas.</td></tr>`;
      return;
    }

    const vendas = StorageService.getVendas();
    const dataInicio = new Date(turno.dataAbertura);
    const dataFim = turno.dataFechamento ? new Date(turno.dataFechamento) : new Date();

    const vendasTurno = vendas.filter(v => {
      if ((turno.vendasIds || []).includes(v.id)) return true;
      const d = new Date(v.data);
      return d >= dataInicio && d <= dataFim;
    });

    if (badgeQtd) {
      badgeQtd.textContent = `${vendasTurno.length} ${vendasTurno.length === 1 ? 'venda' : 'vendas'}`;
    }

    if (contadorEl) {
      contadorEl.innerHTML = `⚡ Total: <strong>${vendasTurno.length} ${vendasTurno.length === 1 ? 'venda no turno atual' : 'vendas no turno atual'}</strong>`;
    }

    if (vendasTurno.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhuma venda realizada neste turno até o momento.</td></tr>`;
      return;
    }

    const isGerente = window.AuthModule ? window.AuthModule.isGerente() : true;

    tbody.innerHTML = vendasTurno.map(v => {
      const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const formaPgtoDisplay = isGerente ? v.formaPagamento : '***';
      const totalDisplay = isGerente ? `R$ ${(v.total || 0).toFixed(2).replace('.', ',')}` : '<span style="filter: blur(4px); user-select: none;">R$ 0,00</span>';

      return `
        <tr>
          <td><strong style="color: var(--text-main);">#${v.id ? v.id.slice(-6) : '-'}</strong></td>
          <td>${hora}</td>
          <td>${v.itens ? v.itens.length : 0} itens</td>
          <td style="text-transform: capitalize; text-align: center;">${formaPgtoDisplay}</td>
          <td style="font-weight: 800; color: var(--text-main); text-align: right;">${totalDisplay}</td>
          <td style="text-align: center;">${v.operador || 'Operador'}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-primary-action" style="padding: 3px 12px; font-size: 11px; height: 26px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 700; margin: 0; box-shadow: none; border-radius: 4px;" onclick="CaixaModule.abrirDetalhesVenda('${v.id}')">
              Detalhes
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },


  verDetalhesTurno(turnoId) {
    const turnos = StorageService.getHistoricoTurnos() || [];
    const turnoAtual = StorageService.getTurnoAtual();

    let turno = null;
    if (typeof turnoId === 'object' && turnoId !== null) {
      turno = turnoId;
    } else {
      const idStr = String(turnoId || '').trim();
      turno = turnos.find(t => t && (t.id === idStr || (t.id || '').includes(idStr)));
      if (!turno && turnoAtual) turno = turnoAtual;
      if (!turno && turnos.length > 0) turno = turnos[0];
    }

    if (!turno) {
      turno = {
        id: 'TURNO-' + Date.now().toString().slice(-6),
        dataAbertura: new Date().toISOString(),
        dataFechamento: new Date().toISOString(),
        status: 'fechado',
        valorAbertura: 0,
        operador: 'Operador'
      };
    }

    this.turnoDetalheSelecionado = turno;
    const r = this.calcularResumoFinanceiro(turno);
    const corpo = document.getElementById('detalhes-turno-corpo');

    if (corpo) {
      const dataAb = turno.dataAbertura ? new Date(turno.dataAbertura).toLocaleString('pt-BR') : 'Data N/D';
      const dataFc = turno.dataFechamento ? new Date(turno.dataFechamento).toLocaleString('pt-BR') : 'Aberto (Em andamento)';

      corpo.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 16px; font-weight: 800; color: var(--text-main);">Turno #${turno.id ? turno.id.slice(-6) : 'TURNO'}</span>
            <span class="user-role-tag ${turno.status === 'fechado' ? 'operador' : 'gerente'}">${(turno.status || 'aberto').toUpperCase()}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div><span style="color: var(--text-muted);">Abertura:</span> <strong>${dataAb}</strong></div>
            <div><span style="color: var(--text-muted);">Fechamento:</span> <strong>${dataFc}</strong></div>
            <div><span style="color: var(--text-muted);">Operador:</span> <strong>${turno.operador || 'Operador'}</strong></div>
            <div><span style="color: var(--text-muted);">Troco Inicial:</span> <strong>R$ ${(turno.valorAbertura || 0).toFixed(2).replace('.', ',')}</strong></div>
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <h4 style="font-size: 14px; font-weight: 800; color: var(--text-main); margin-bottom: 12px;">📊 Resumo do Faturamento por Forma de Pagamento</h4>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span>💵 Dinheiro:</span>
              <strong style="color: var(--accent-green);">R$ ${(r.totalDinheiro || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>📱 PIX / QR Code:</span>
              <strong style="color: var(--accent-blue);">R$ ${(r.totalPix || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>💳 Cartão de Débito:</span>
              <strong>R$ ${(r.totalDebito || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>💳 Cartão de Crédito:</span>
              <strong>R$ ${(r.totalCredito || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>👥 Fiado / Prazo:</span>
              <strong style="color: var(--accent-amber);">R$ ${(r.totalFiado || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--border-card); padding-top: 8px; margin-top: 4px;">
              <span>💸 Total de Sangrias:</span>
              <strong style="color: var(--accent-red);">- R$ ${(r.totalSangrias || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border-card); padding-top: 8px; margin-top: 4px; font-size: 15px;">
              <strong>💰 Saldo Final Gaveta:</strong>
              <strong style="color: var(--accent-green);">R$ ${(r.saldoEmGaveta || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 4px;">
              <strong>🎉 Total Faturamento:</strong>
              <strong style="color: #7c3aed;">R$ ${(r.totalVendas || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
          </div>
        </div>

        ${(turno.saldoInformado !== undefined || turno.diferenca !== undefined) ? `
          <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <h4 style="font-size: 13px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">🔒 Conferência Física de Caixa (Fechamento Cego)</h4>
            ${(window.AuthModule && (window.AuthModule.isGerente() || window.AuthModule.isSuperAdmin())) ? `
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 8px;">
                <div>
                  <span style="color: var(--text-muted); display: block; font-size: 11px;">Esperado no Caixa:</span>
                  <strong style="font-family: 'JetBrains Mono'; font-size: 13px;">R$ ${(turno.saldoEsperado || turno.dinheiroGaveta || 0).toFixed(2).replace('.', ',')}</strong>
                </div>
                <div>
                  <span style="color: var(--text-muted); display: block; font-size: 11px;">Contado na Gaveta:</span>
                  <strong style="font-family: 'JetBrains Mono'; font-size: 13px;">R$ ${(turno.saldoInformado || 0).toFixed(2).replace('.', ',')}</strong>
                </div>
                <div>
                  <span style="color: var(--text-muted); display: block; font-size: 11px;">Diferença / Status:</span>
                  <strong style="font-family: 'JetBrains Mono'; font-size: 13px; color: ${turno.diferenca === 0 ? '#16a34a' : (turno.diferenca > 0 ? '#15803d' : '#dc2626')};">
                    ${turno.diferenca === 0 ? '✅ Bateu Perfeito' : (turno.diferenca > 0 ? `+ R$ ${turno.diferenca.toFixed(2).replace('.', ',')} (Sobra)` : `- R$ ${Math.abs(turno.diferenca).toFixed(2).replace('.', ',')} (Quebra)`)}
                  </strong>
                </div>
              </div>
            ` : `
              <div style="font-size: 12px; margin-bottom: 8px;">
                <span style="color: var(--text-muted); display: block; font-size: 11px;">Valor Declarado / Contado na Gaveta:</span>
                <strong style="font-family: 'JetBrains Mono'; font-size: 14px; color: var(--text-main);">R$ ${(turno.saldoInformado || 0).toFixed(2).replace('.', ',')}</strong>
                <span style="display: block; font-size: 11px; color: var(--text-dim); margin-top: 4px;">🔒 Conferência Cega registrada para auditoria gerencial.</span>
              </div>
            `}
            ${turno.observacoesFechamento ? `<div style="font-size: 11.5px; color: var(--text-muted); background: #fff; padding: 6px 10px; border-radius: 4px; border: 1px dashed #cbd5e1;"><strong>Obs:</strong> ${turno.observacoesFechamento}</div>` : ''}
          </div>
        ` : ''}
      `;
    }

    const modal = document.getElementById('modal-detalhes-turno');
    const btnExcelModal = document.getElementById('btn-detalhes-turno-exportar-excel');
    const rodapeBotoes = document.getElementById('botoes-rodape-modal-detalhes-turno');
    const isGerente = AuthModule.isGerente();

    if (btnExcelModal) {
      btnExcelModal.style.display = isGerente ? 'inline-flex' : 'none';
    }
    if (rodapeBotoes) {
      rodapeBotoes.style.gridTemplateColumns = isGerente ? '1fr 1fr 100px' : '1fr 100px';
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalDetalhes() {
    const modal = document.getElementById('modal-detalhes-turno');
    if (modal) modal.classList.remove('active');
  },

  imprimirCupomTurnoVisualizado() {
    if (this.turnoDetalheSelecionado) {
      ThermalPrintModule.imprimirFechamentoCaixa(this.turnoDetalheSelecionado);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🖨️ Enviando relatório de fechamento para a impressora térmica...', 'info');
      }
    }
  },

  abrirDetalhesVenda(vendaId) {
    const vendas = StorageService.getVendas();
    const venda = vendas.find(v => v.id === vendaId || (v.id && v.id.slice(-6) === String(vendaId).replace('#', '')));
    if (!venda) {
      if (window.App) window.App.showToast('Venda não encontrada no histórico.', 'warning');
      return;
    }

    this.vendaDetalheSelecionada = venda;

    const modal = document.getElementById('modal-detalhes-venda');
    const title = document.getElementById('detalhes-venda-title');
    const corpo = document.getElementById('detalhes-venda-corpo');

    if (title) title.innerHTML = `🧾 Detalhes da Venda <strong>#${venda.id}</strong>`;

    if (corpo) {
      const dataStr = new Date(venda.data).toLocaleString('pt-BR');
      corpo.innerHTML = `
        <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 14px; margin-bottom: 14px;">
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; font-size: 13px;">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px; font-weight: 700;">DATA & HORÁRIO:</span>
              <strong style="color: var(--text-main);">${dataStr}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px; font-weight: 700;">OPERADOR DO CAIXA:</span>
              <strong style="color: var(--text-main);">${venda.operador || 'Operador'}</strong>
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px; font-weight: 700;">FORMA DE PAGAMENTO:</span>
              ${venda.pagamentoDividido && venda.parcela1 && venda.parcela2 ? `
                <div style="margin-top: 2px;">
                  <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px;">✂️ DIVIDIDO</span>
                  <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
                    • ${venda.parcela1.forma}: R$ ${(venda.parcela1.valor || 0).toFixed(2).replace('.', ',')}<br>
                    • ${venda.parcela2.forma}: R$ ${(venda.parcela2.valor || 0).toFixed(2).replace('.', ',')}
                  </div>
                </div>
              ` : `
                <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">${venda.formaPagamento || 'Dinheiro'}</span>
              `}
            </div>
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 11px; font-weight: 700;">STATUS:</span>
              <span style="display: inline-block; background: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 4px;">✅ CONCLUÍDA</span>
            </div>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">📦 Itens Comprados (${(venda.itens || []).length}):</h4>
        
        <div style="border: 1px solid var(--border-card); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 14px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left; color: var(--text-muted); font-size: 11px; font-weight: 700;">
                <th style="padding: 8px 10px;">Item / Produto</th>
                <th style="padding: 8px 10px; text-align: center; width: 60px;">Qtd</th>
                <th style="padding: 8px 10px; text-align: right; width: 85px;">Preço Un.</th>
                <th style="padding: 8px 10px; text-align: right; width: 85px;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(venda.itens || []).map((item, idx) => `
                <tr style="border-top: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#fff' : '#f8fafc'};">
                  <td style="padding: 8px 10px; font-weight: 700; color: var(--text-main);">${item.nome}</td>
                  <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #0284c7;">${item.quantidade}x</td>
                  <td style="padding: 8px 10px; text-align: right; font-family: 'JetBrains Mono';">R$ ${(item.precoUnitario || 0).toFixed(2).replace('.', ',')}</td>
                  <td style="padding: 8px 10px; text-align: right; font-weight: 800; font-family: 'JetBrains Mono'; color: var(--text-main);">R$ ${((item.precoUnitario || 0) * (item.quantidade || 1)).toFixed(2).replace('.', ',')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border-card); border-radius: var(--radius-md); padding: 12px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Subtotal:</span>
            <strong style="font-family: 'JetBrains Mono';">R$ ${(venda.subtotal || venda.total || 0).toFixed(2).replace('.', ',')}</strong>
          </div>
          ${venda.desconto > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #dc2626;">
              <span>Desconto:</span>
              <strong style="font-family: 'JetBrains Mono';">- R$ ${(venda.desconto).toFixed(2).replace('.', ',')}</strong>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; border-top: 2px solid var(--border-card); padding-top: 6px; margin-top: 4px; font-size: 16px;">
            <strong style="color: var(--text-main);">VALOR TOTAL:</strong>
            <strong style="color: #059669; font-family: 'JetBrains Mono'; font-size: 18px;">R$ ${(venda.total || 0).toFixed(2).replace('.', ',')}</strong>
          </div>
          ${venda.valorPago > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-dim); border-top: 1px dashed var(--border-card); padding-top: 6px;">
              <span>Valor Recebido: R$ ${(venda.valorPago || 0).toFixed(2).replace('.', ',')}</span>
              ${venda.troco > 0 ? `<span style="font-weight: 700; color: var(--accent-amber);">Troco: R$ ${(venda.troco || 0).toFixed(2).replace('.', ',')}</span>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalDetalhesVenda() {
    const modal = document.getElementById('modal-detalhes-venda');
    if (modal) modal.classList.remove('active');
  },

  imprimirCupomVendaSelecionada() {
    if (this.vendaDetalheSelecionada) {
      ThermalPrintModule.imprimirCupomVenda(this.vendaDetalheSelecionada);
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🖨️ Enviando cupom da venda #${this.vendaDetalheSelecionada.id} para a impressora...`, 'info');
      }
    }
  }
};
