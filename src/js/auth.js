/**
 * auth.js - Autenticação Multi-Operador, Controle de Sessão e Perfis (RBAC)
 */

import { StorageService } from './storage.js';

export const AuthModule = {
  usuarioAtual: null,
  usuarioSelecionadoLoginId: null,
  acaoPendenteCallback: null,
  operadorEditandoId: null,

  init() {
    const usuarios = StorageService.getUsuarios();
    const saved = sessionStorage.getItem('flowpdv_usuario_logado');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Garantir que o usuário ainda existe e está ativo
        const u = usuarios.find(item => item.id === parsed.id && item.ativo !== false);
        if (u) {
          this.usuarioAtual = u;
        }
      } catch (e) {}
    }

    if (this.usuarioAtual) {
      this.atualizarHeaderUsuario();
      this.fecharTelaLogin();
      if (window.App && typeof window.App.entrarPorPerfil === 'function') {
        setTimeout(() => window.App.entrarPorPerfil(this.usuarioAtual), 0);
      }
    } else {
      // Limpar campo de código de barras imediatamente
      const barcodeInput = document.getElementById('pdv-barcode-input');
      if (barcodeInput) barcodeInput.value = '';
      const classicBarcodeInput = document.getElementById('classic-pdv-barcode-input');
      if (classicBarcodeInput) classicBarcodeInput.value = '';
      this.abrirTelaLogin();
    }

    this.bindListenerTecladoLogin();
    this.renderTabelaOperadoresConfig();
  },

  bindListenerTecladoLogin() {
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('modal-login-operador');
      if (!modal || !modal.classList.contains('active')) return;

      const select = document.getElementById('login-operador-select');
      if (document.activeElement === select) {
        if (e.key === 'Enter') {
          const pinInput = document.getElementById('login-pin-input');
          if (pinInput) pinInput.focus();
        }
        return;
      }

      const pinInput = document.getElementById('login-pin-input');
      if (!pinInput) return;

      // Se já está focado no PIN, deixa digitar normalmente
      if (document.activeElement === pinInput) return;

      // Se o usuário apertar qualquer dígito, foca no PIN imediatamente
      if (/^[0-9]$/.test(e.key) || /^Numpad[0-9]$/.test(e.code)) {
        pinInput.focus();
      }
    });
  },

  getUsuario() {
    return this.usuarioAtual || null;
  },

  getNomeOperador() {
    const u = this.getUsuario();
    return (u && u.nome) ? u.nome : 'Sem operador';
  },

  isGerente() {
    if (!this.usuarioAtual) return false;
    const cargo = this.usuarioAtual.cargo;
    return cargo === 'gerente' || cargo === 'superadmin' || cargo === 'admin';
  },

  isSuperAdmin() {
    return this.usuarioAtual && this.usuarioAtual.cargo === 'superadmin';
  },

  temPermissao(permissaoKey) {
    if (!this.usuarioAtual) return false;
    if (this.isGerente() || this.isSuperAdmin()) return true;

    const padrao = {
      cancelarItem: true,
      cancelarVenda: true,
      darDesconto: true,
      realizarSangria: true,
      verCustoEstoque: false,
      reimprimirCupons: true,
      venderFiado: false
    };

    const perms = { ...padrao, ...(this.usuarioAtual.permissoes || {}) };
    return perms[permissaoKey] !== false;
  },

  executarComPermissaoOuPin(permissaoKey, callbackSucesso, tituloAcao = 'Ação Restrita') {
    if (this.temPermissao(permissaoKey)) {
      if (typeof callbackSucesso === 'function') callbackSucesso();
      return;
    }

    this.solicitarAutorizacaoGerente(callbackSucesso, tituloAcao);
  },

  getPinGerente() {
    const usuarios = StorageService.getUsuarios();
    const gerente = usuarios.find(u => u.cargo === 'gerente' && u.ativo !== false);
    if (gerente && gerente.pin) return String(gerente.pin).trim();
    return localStorage.getItem('flowpdv_pin_gerente') || '';
  },

  validarPinGerente(pin) {
    const pinStr = String(pin || '').trim();
    if (!pinStr) return false;
    const pinMaster = localStorage.getItem('flowpdv_pin_gerente') || StorageService.getLicenca()?.pinGerente;
    if (pinMaster && pinStr === String(pinMaster).trim()) return true;

    const usuarios = StorageService.getUsuarios();
    // Qualquer usuário com cargo gerente e o PIN digitado pode autorizar
    return usuarios.some(u => u.cargo === 'gerente' && u.ativo !== false && String(u.pin).trim() === pinStr);
  },

  // -------------------------------------------------------------
  // TELA DE LOGIN & SELEÇÃO DE OPERADOR
  // -------------------------------------------------------------
  abrirTelaLogin() {
    const modal = document.getElementById('modal-login-operador');
    if (!modal) return;

    this.usuarioSelecionadoLoginId = null;
    document.body.classList.add('tela-login-ativa');
    modal.classList.add('active');
    this.renderCardsLogin();
    this.atualizarNomeLojaLogin();
    this.limparPinLogin();

    // Limpar qualquer caractere que possa ter ido para o leitor de código de barras
    const barcodeInput = document.getElementById('pdv-barcode-input');
    if (barcodeInput) barcodeInput.value = '';
    const classicBarcodeInput = document.getElementById('classic-pdv-barcode-input');
    if (classicBarcodeInput) classicBarcodeInput.value = '';

    // Garantir foco imediato e persistente no campo de PIN
    this.focarPinLogin();
  },

  focarPinLogin() {
    const tentarFoco = () => {
      const modal = document.getElementById('modal-login-operador');
      if (!modal || !modal.classList.contains('active')) return;
      const pinInput = document.getElementById('login-pin-input');
      if (pinInput) {
        pinInput.focus();
        pinInput.select();
      }
    };
    tentarFoco();
    setTimeout(tentarFoco, 50);
    setTimeout(tentarFoco, 150);
    setTimeout(tentarFoco, 300);
  },

  fecharTelaLogin() {
    const modal = document.getElementById('modal-login-operador');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('tela-login-ativa');
  },

  atualizarNomeLojaLogin() {
    const el = document.getElementById('login-screen-loja-nome');
    if (!el) return;
    const cfg = StorageService.getConfig() || {};
    const lic = StorageService.getLicenca() || {};
    el.textContent = cfg.nomeLoja || cfg.nomeEmpresa || lic.razaoSocial || 'FlowPDV';
  },

  renderCardsLogin() {
    const select = document.getElementById('login-operador-select');
    const badgeEl = document.getElementById('login-operador-badge-preview');
    const container = document.getElementById('login-operadores-grid');

    const usuarios = StorageService.getUsuarios().filter(u => u.ativo !== false);

    if (select) {
      if (usuarios.length === 0) {
        select.innerHTML = '<option value="">Nenhum operador ativo cadastrado</option>';
        this.usuarioSelecionadoLoginId = null;
        if (badgeEl) badgeEl.innerHTML = '';
        return;
      }

      select.innerHTML = usuarios.map(u => {
        const isGer = u.cargo === 'gerente' || u.cargo === 'superadmin';
        const prefix = isGer ? '👑 ' : '👤 ';
        const roleLabel = isGer ? 'Gerente' : 'Operador Caixa';
        return `<option value="${u.id}">${prefix}${u.nome} (${roleLabel})</option>`;
      }).join('');

      // Se o selecionado atual for válido, mantém ele; caso contrário, seleciona o primeiro
      const userValido = usuarios.find(u => u.id === this.usuarioSelecionadoLoginId);
      if (userValido) {
        select.value = userValido.id;
      } else {
        select.value = usuarios[0].id;
        this.usuarioSelecionadoLoginId = usuarios[0].id;
      }

      const usuarioAtivo = usuarios.find(u => u.id === select.value);
      this.atualizarBadgeOperadorSelecionado(usuarioAtivo);
    }

    if (container) {
      container.style.display = 'none';
    }
  },

  atualizarBadgeOperadorSelecionado(u) {
    const badgeEl = document.getElementById('login-operador-badge-preview');
    if (!badgeEl) return;
    if (!u) {
      badgeEl.innerHTML = '';
      return;
    }
    const isGer = u.cargo === 'gerente' || u.cargo === 'superadmin';
    if (isGer) {
      badgeEl.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid #fde68a;">👑 Perfil: Gerente</span>`;
    } else {
      badgeEl.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid #bae6fd;">👤 Perfil: Caixa</span>`;
    }
  },

  selecionarUsuarioLogin(id) {
    this.usuarioSelecionadoLoginId = id;
    const select = document.getElementById('login-operador-select');
    if (select && select.value !== id) {
      select.value = id;
    }

    const usuarios = StorageService.getUsuarios();
    const u = usuarios.find(item => item.id === id);
    this.atualizarBadgeOperadorSelecionado(u);

    const pinInput = document.getElementById('login-pin-input');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
    const erroEl = document.getElementById('login-erro-msg');
    if (erroEl) erroEl.style.display = 'none';
  },

  limparPinLogin() {
    const pinInput = document.getElementById('login-pin-input');
    if (pinInput) pinInput.value = '';
    const erroEl = document.getElementById('login-erro-msg');
    if (erroEl) erroEl.style.display = 'none';
  },

  executarLogin() {
    const pinInput = document.getElementById('login-pin-input');
    const erroEl = document.getElementById('login-erro-msg');
    const pin = pinInput ? pinInput.value.trim() : '';
    if (!pin) {
      if (erroEl) {
        erroEl.textContent = 'Digite o PIN para entrar.';
        erroEl.style.display = 'block';
      }
      return;
    }

    const usuarios = StorageService.getUsuarios();
    const u = usuarios.find(item => item.id === this.usuarioSelecionadoLoginId);

    if (!u) {
      if (erroEl) {
        erroEl.textContent = 'Selecione um operador acima para entrar.';
        erroEl.style.display = 'block';
      }
      return;
    }

    const pinMaster = localStorage.getItem('flowpdv_pin_gerente') || StorageService.getLicenca()?.pinGerente;
    const isPinValido = String(u.pin).trim() === pin || (u.cargo === 'gerente' && pinMaster && pin === String(pinMaster).trim());

    if (isPinValido) {
      if (u.cargo === 'gerente' && pinMaster && String(u.pin).trim() !== String(pinMaster).trim()) {
        u.pin = String(pinMaster).trim();
        StorageService.saveUsuarios(usuarios);
      }

      this.usuarioAtual = u;
      sessionStorage.setItem('flowpdv_usuario_logado', JSON.stringify(u));
      this.fecharTelaLogin();
      this.atualizarHeaderUsuario();
      if (window.App && typeof window.App.entrarPorPerfil === 'function') {
        window.App.entrarPorPerfil(u);
      }

      // Atualizar mini dashboard do PDV e permissões da UI imediatamente com base no novo usuário logado
      if (window.PdvModule && typeof window.PdvModule.renderMiniDashboardTurno === 'function') {
        window.PdvModule.renderMiniDashboardTurno();
      }
      if (window.EstoqueModule && typeof window.EstoqueModule.atualizarBotoesPermissaoGerente === 'function') {
        window.EstoqueModule.atualizarBotoesPermissaoGerente();
      }
      if (window.App && typeof window.App.atualizarPermissoesUsuario === 'function') {
        window.App.atualizarPermissoesUsuario();
      }
      if (window.GerenciaModule && typeof window.GerenciaModule.renderSubAbaAtual === 'function') {
        window.GerenciaModule.renderSubAbaAtual();
      }

      // LIMPAR TOTALMENTE O CAMPO DE CÓDIGO DE BARRAS AO LOGAR
      const barcodeInput = document.getElementById('pdv-barcode-input');
      if (barcodeInput) barcodeInput.value = '';
      const classicBarcodeInput = document.getElementById('classic-pdv-barcode-input');
      if (classicBarcodeInput) classicBarcodeInput.value = '';

      if (window.LicencaModule && typeof window.LicencaModule.atualizarOperadorTerminalNuvem === 'function') {
        window.LicencaModule.atualizarOperadorTerminalNuvem(u.nome);
      }

      setTimeout(() => {
        const bInput = document.getElementById('pdv-barcode-input');
        if (bInput) bInput.value = '';
        const cInput = document.getElementById('classic-pdv-barcode-input');
        if (cInput) cInput.value = '';
        if (window.PdvModule) window.PdvModule.focarInputLeitor();
      }, 60);
      setTimeout(() => {
        if (window.PdvModule) window.PdvModule.focarInputLeitor();
      }, 200);

      if (window.CaixaModule) window.CaixaModule.renderHistoricoVendasTurno();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`🟢 Bem-vindo(a), ${u.nome}!`, 'success');
      }
    } else {
      if (erroEl) {
        erroEl.textContent = 'Senha / PIN incorreto para este operador!';
        erroEl.style.display = 'block';
      }
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  },

  logout() {
    sessionStorage.removeItem('flowpdv_usuario_logado');
    this.usuarioAtual = null;
    if (window.electronAPI && typeof window.electronAPI.definirTelaCheiaOperador === 'function') {
      window.electronAPI.definirTelaCheiaOperador(false);
    }
    this.abrirTelaLogin();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('🔒 Sessão encerrada.', 'info');
    }
  },

  trocarOperador() {
    this.abrirTelaLogin();
  },

  aplicarSessao(usuario) {
    this.usuarioAtual = usuario;
    sessionStorage.setItem('flowpdv_usuario_logado', JSON.stringify(usuario));
    sessionStorage.removeItem('adega_usuario_logado');
    this.atualizarHeaderUsuario();
    if (window.App && typeof window.App.entrarPorPerfil === 'function') {
      window.App.entrarPorPerfil(usuario);
    }
    if (window.PdvModule && typeof window.PdvModule.renderMiniDashboardTurno === 'function') {
      window.PdvModule.renderMiniDashboardTurno();
    }
    if (window.EstoqueModule && typeof window.EstoqueModule.atualizarBotoesPermissaoGerente === 'function') {
      window.EstoqueModule.atualizarBotoesPermissaoGerente();
    }
    if (window.App && typeof window.App.atualizarPermissoesUsuario === 'function') {
      window.App.atualizarPermissoesUsuario();
    }
    if (window.CaixaModule) {
      if (typeof window.CaixaModule.renderHistoricoTurnosFechados === 'function') {
        window.CaixaModule.renderHistoricoTurnosFechados();
      }
      if (typeof window.CaixaModule.renderHistoricoVendasTurno === 'function') {
        window.CaixaModule.renderHistoricoVendasTurno();
      }
    }
    if (window.LicencaModule && typeof window.LicencaModule.atualizarOperadorTerminalNuvem === 'function') {
      window.LicencaModule.atualizarOperadorTerminalNuvem(usuario.nome);
    }
  },

  trocarUsuario(pin, cargoAlvo = 'gerente') {
    const pinStr = String(pin || '').trim();
    if (!pinStr) return { success: false, erro: 'Digite o PIN de acesso.' };

    const usuarios = StorageService.getUsuarios();
    const pinMaster = localStorage.getItem('flowpdv_pin_gerente') || StorageService.getLicenca()?.pinGerente;
    const alvoGerente = cargoAlvo === 'gerente';

    const candidatos = usuarios.filter(u => {
      if (!u || u.ativo === false) return false;
      if (alvoGerente) return u.cargo === 'gerente' || u.cargo === 'superadmin' || u.cargo === 'admin';
      return u.cargo === 'operador';
    });

    const encontrado = candidatos.find(item => {
      const pinUser = String(item.pin || '').trim();
      if (pinUser && pinUser === pinStr) return true;
      if (alvoGerente && pinMaster && pinStr === String(pinMaster).trim()) return true;
      return false;
    });

    if (!encontrado) return { success: false, erro: 'PIN de acesso incorreto.' };

    this.aplicarSessao(encontrado);
    return { success: true, usuario: encontrado };
  },

  atualizarHeaderUsuario() {
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const classicOperator = document.getElementById('classic-operator-name');

    const u = this.getUsuario();
    if (nameEl) nameEl.textContent = u ? u.nome : '—';
    if (classicOperator) classicOperator.textContent = u ? `Operador: ${u.nome}` : 'Operador: —';
    if (roleEl) {
      const cargo = u ? u.cargo : 'operador';
      roleEl.textContent = this.isGerente() ? 'Gerente' : 'Operador';
      roleEl.className = `user-role-tag ${cargo}`;
    }

    const classicBtnAdmin = document.getElementById('classic-btn-painel-gerente');
    if (classicBtnAdmin) {
      classicBtnAdmin.style.display = this.isGerente() ? 'inline-flex' : 'none';
    }

    // Atualizar telas que dependem de permissão
    if (window.CaixaModule && typeof window.CaixaModule.renderHistoricoVendasTurno === 'function') {
      window.CaixaModule.renderHistoricoVendasTurno();
    }
    if (window.EstoqueModule && typeof window.EstoqueModule.atualizarBotoesPermissaoGerente === 'function') {
      window.EstoqueModule.atualizarBotoesPermissaoGerente();
    }
    if (window.App && typeof window.App.atualizarPermissoesUsuario === 'function') {
      window.App.atualizarPermissoesUsuario();
    }
  },

  // -------------------------------------------------------------
  // AUTORIZAÇÃO RÁPIDA DE GERENTE (PARA CANCELAMENTOS / DESCONTOS)
  // -------------------------------------------------------------
  solicitarAutorizacaoGerente(arg1, arg2) {
    const callbackSucesso = (typeof arg1 === 'function') ? arg1 : (typeof arg2 === 'function' ? arg2 : null);

    if (this.isGerente()) {
      if (typeof callbackSucesso === 'function') callbackSucesso();
      return;
    }

    this.acaoPendenteCallback = callbackSucesso;
    const modal = document.getElementById('modal-auth-gerente');
    const pinInput = document.getElementById('auth-gerente-pin-input');
    const erroMsg = document.getElementById('auth-gerente-erro-msg');

    if (erroMsg) erroMsg.style.display = 'none';
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 150);
    }
    if (modal) modal.classList.add('active');
  },

  fecharModalAutorizacao() {
    const modal = document.getElementById('modal-auth-gerente');
    if (modal) modal.classList.remove('active');
    this.acaoPendenteCallback = null;
  },

  confirmarAutorizacaoGerente() {
    const pinInput = document.getElementById('auth-gerente-pin-input');
    const erroMsg = document.getElementById('auth-gerente-erro-msg');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (this.validarPinGerente(pin)) {
      const acao = this.acaoPendenteCallback;
      this.acaoPendenteCallback = null;

      const modal = document.getElementById('modal-auth-gerente');
      if (modal) modal.classList.remove('active');

      if (typeof acao === 'function') {
        setTimeout(() => acao(), 60);
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('Operação autorizada pelo Gerente!', 'success');
      }
    } else {
      if (erroMsg) erroMsg.style.display = 'block';
      if (pinInput) {
        pinInput.select();
        pinInput.focus();
      }
    }
  },

  // -------------------------------------------------------------
  // GESTÃO DE FUNCIONÁRIOS (GERÊNCIA & CONFIGURAÇÕES)
  // -------------------------------------------------------------
  renderTabelaOperadoresConfig() {
    const tbodies = [
      document.getElementById('gerencia-usuarios-tbody'),
      document.getElementById('config-operadores-tbody')
    ].filter(Boolean);

    if (tbodies.length === 0) return;

    const usuarios = StorageService.getUsuarios();
    const html = usuarios.map(u => {
      const isGer = u.cargo === 'gerente';
      return `
        <tr>
          <td style="padding: 10px 12px;"><strong style="color: var(--text-main); font-size: 13.5px;">${isGer ? '👑' : '👤'} ${u.nome}</strong></td>
          <td style="padding: 10px 12px;"><code>${u.login || '-'}</code></td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; height: 26px; padding: 0 10px; border-radius: 6px; font-size: 11.5px; font-weight: 800; background: ${isGer ? '#fef3c7; color: #b45309; border: 1px solid #fde68a;' : '#e0f2fe; color: #0369a1; border: 1px solid #bae6fd;'}">
              ${isGer ? '👑 Gerente' : '👤 Operador de Caixa'}
            </span>
          </td>
          <td style="padding: 10px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-dim); text-align: center;">••••</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-flex; align-items: center; justify-content: center; height: 24px; padding: 0 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; background: ${u.ativo !== false ? '#dcfce7; color: #15803d; border: 1px solid #bbf7d0;' : '#fee2e2; color: #b91c1c; border: 1px solid #fecaca;'}">
              ${u.ativo !== false ? '● Ativo' : '○ Desativado'}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
            <button type="button" class="btn-op-action btn-op-edit" onclick="AuthModule.abrirModalOperador('${u.id}')" title="Editar funcionário">
              ✏️ Editar
            </button>
            ${usuarios.length > 1 ? `
              <button type="button" class="btn-op-action btn-op-delete" onclick="AuthModule.excluirOperador('${u.id}')" title="Excluir funcionário">
                🗑️ Excluir
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbodies.forEach(tb => { tb.innerHTML = html; });

    const contadorEl = document.getElementById('gerencia-usuarios-contador');
    if (contadorEl) {
      contadorEl.innerHTML = `👥 Total: <strong>${usuarios.length} ${usuarios.length === 1 ? 'funcionário' : 'funcionários'}</strong>`;
    }
  },

  toggleVisualizarPinModal() {
    const input = document.getElementById('op-pin');
    const btn = document.getElementById('btn-toggle-pin-op');
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      if (btn) btn.innerHTML = '🔒';
    } else {
      input.type = 'password';
      if (btn) btn.innerHTML = '👁️';
    }
  },

  abrirModalOperador(id = null) {
    this.operadorEditandoId = id;
    const modal = document.getElementById('modal-novo-operador');
    const title = document.getElementById('modal-operador-title');
    const form = document.getElementById('form-operador');
    const pinInput = document.getElementById('op-pin');
    const btnPin = document.getElementById('btn-toggle-pin-op');
    const secaoPerm = document.getElementById('op-secao-permissoes');

    if (form) form.reset();
    if (pinInput) pinInput.type = 'password';
    if (btnPin) btnPin.innerHTML = '👁️';

    if (id) {
      if (title) title.textContent = '✏️ Editar Funcionário';
      const usuarios = StorageService.getUsuarios();
      const u = usuarios.find(item => item.id === id);
      if (u) {
        document.getElementById('op-nome').value = u.nome || '';
        document.getElementById('op-login').value = u.login || '';
        document.getElementById('op-pin').value = u.pin || '';
        document.getElementById('op-cargo').value = u.cargo || 'operador';
        document.getElementById('op-ativo').checked = u.ativo !== false;

        const p = u.permissoes || {};
        const setCheck = (idEl, val) => { const el = document.getElementById(idEl); if (el) el.checked = val; };
        setCheck('perm-cancelar-item', p.cancelarItem !== false);
        setCheck('perm-cancelar-venda', p.cancelarVenda === true);
        setCheck('perm-dar-desconto', p.darDesconto !== false);
        setCheck('perm-realizar-sangria', p.realizarSangria !== false);
        setCheck('perm-vender-fiado', p.venderFiado === true);
        setCheck('perm-ver-custo', p.verCustoEstoque === true);
        setCheck('perm-reimprimir-cupons', p.reimprimirCupons !== false);

        if (secaoPerm) secaoPerm.style.display = u.cargo === 'gerente' ? 'none' : 'block';
      }
    } else {
      if (title) title.textContent = '➕ Cadastrar Novo Funcionário';
      document.getElementById('op-nome').value = '';
      document.getElementById('op-login').value = '';
      document.getElementById('op-pin').value = '';
      document.getElementById('op-cargo').value = 'operador';
      document.getElementById('op-ativo').checked = true;

      const setCheck = (idEl, val) => { const el = document.getElementById(idEl); if (el) el.checked = val; };
      setCheck('perm-cancelar-item', true);
      setCheck('perm-cancelar-venda', false);
      setCheck('perm-dar-desconto', true);
      setCheck('perm-realizar-sangria', true);
      setCheck('perm-vender-fiado', false);
      setCheck('perm-ver-custo', false);
      setCheck('perm-reimprimir-cupons', true);

      if (secaoPerm) secaoPerm.style.display = 'block';
    }

    if (modal) modal.classList.add('active');
    setTimeout(() => document.getElementById('op-nome')?.focus(), 150);
  },

  fecharModalOperador() {
    const modal = document.getElementById('modal-novo-operador');
    if (modal) modal.classList.remove('active');
  },

  salvarOperador(e) {
    e.preventDefault();

    const nome = document.getElementById('op-nome').value.trim();
    const login = document.getElementById('op-login').value.trim().toLowerCase();
    const pin = document.getElementById('op-pin').value.trim();
    const cargo = document.getElementById('op-cargo').value;
    const ativo = document.getElementById('op-ativo').checked;

    const permissoes = {
      cancelarItem: document.getElementById('perm-cancelar-item')?.checked ?? true,
      cancelarVenda: document.getElementById('perm-cancelar-venda')?.checked ?? false,
      darDesconto: document.getElementById('perm-dar-desconto')?.checked ?? true,
      realizarSangria: document.getElementById('perm-realizar-sangria')?.checked ?? true,
      venderFiado: document.getElementById('perm-vender-fiado')?.checked ?? false,
      verCustoEstoque: document.getElementById('perm-ver-custo')?.checked ?? false,
      reimprimirCupons: document.getElementById('perm-reimprimir-cupons')?.checked ?? true
    };

    if (!nome || !pin) {
      if (window.App) window.App.showToast('Informe o nome e o PIN/Senha de acesso!', 'warning');
      return;
    }

    let usuarios = StorageService.getUsuarios();

    if (this.operadorEditandoId) {
      const index = usuarios.findIndex(u => u.id === this.operadorEditandoId);
      if (index !== -1) {
        usuarios[index] = {
          ...usuarios[index],
          nome,
          login: login || nome.toLowerCase().replace(/\s+/g, ''),
          pin,
          cargo,
          ativo,
          permissoes,
          atualizadoEm: new Date().toISOString()
        };
      }
    } else {
      const novo = {
        id: 'USR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        nome,
        login: login || nome.toLowerCase().replace(/\s+/g, ''),
        pin,
        cargo,
        ativo,
        permissoes,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      usuarios.push(novo);
    }

    StorageService.saveUsuarios(usuarios);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('operadores');
    }
    this.fecharModalOperador();
    this.renderTabelaOperadoresConfig();
    this.renderCardsLogin();

    if (window.App) window.App.showToast('Funcionário salvo com sucesso!', 'success');
  },

  excluirOperador(id) {
    let usuarios = StorageService.getUsuarios();
    const u = usuarios.find(item => item.id === id);
    if (!u) return;

    if (u.cargo === 'gerente') {
      const gerentes = usuarios.filter(item => item.cargo === 'gerente');
      if (gerentes.length <= 1) {
        alert('⚠️ Não é possível excluir o único Gerente do sistema!');
        return;
      }
    }

    window.App.confirmarAcao({
      icone: '👥',
      titulo: 'Excluir Funcionário',
      mensagem: `Tem certeza que deseja excluir o acesso de:<br><strong style="color: #0f172a; font-size: 15px; display: inline-block; margin: 6px 0;">"${u.nome}"</strong><br><span style="font-size: 12px; color: #64748b;">Login: ${u.login || '-'} (${u.cargo ? (u.cargo.charAt(0).toUpperCase() + u.cargo.slice(1)) : 'Operador'})</span>`,
      textoConfirmar: '🗑️ Sim, Excluir [ENTER]',
      textoCancelar: 'Cancelar [ESC]',
      perigo: true,
      onConfirm: () => {
        usuarios = usuarios.filter(item => item.id !== id);
        StorageService.saveUsuarios(usuarios);
        if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
          window.CloudSyncModule.enviarAlteracaoNuvem('operadores');
        }
        this.renderTabelaOperadoresConfig();
        this.renderCardsLogin();
        if (window.App) window.App.showToast('Funcionário excluído.', 'info');
      }
    });
  }
};