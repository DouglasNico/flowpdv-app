/**
 * admin-master.js - Painel do Super Administrador (Controle SaaS & Sincronização Cloud Firestore)
 */

import { StorageService } from './storage.js';
import { db, doc, setDoc, getDocs, collection } from './firebase-config.js';

export const AdminMasterModule = {
  adegasCadastradas: [],

  init() {
    this.carregarAdegasDaNuvem();
  },

  async carregarAdegasDaNuvem() {
    try {
      const querySnapshot = await getDocs(collection(db, "licencas"));
      const lista = [];
      querySnapshot.forEach(d => {
        const data = d.data();
        if (data) {
          lista.push({
            id: d.id,
            chaveLicenca: data.chaveLicenca || d.id,
            nome: data.nome || data.razaoSocial || 'Adega Sem Nome',
            documento: data.documento || data.cnpj || '00.000.000/0001-00',
            logoUrl: data.logoUrl || '',
            whatsapp: data.whatsapp || '(19) 98963-2127',
            plano: data.plano || 'Mensal Pro (R$ 89,90/mês)',
            status: data.status || 'ativa',
            layoutPdv: data.layoutPdv || 'moderno',
            dataVencimento: (data.vencimento || data.dataExpiracao) ? ((data.vencimento || data.dataExpiracao).includes('T') ? (data.vencimento || data.dataExpiracao).split('T')[0] : (data.vencimento || data.dataExpiracao)) : ''
          });
        }
      });

      if (lista.length > 0) {
        this.adegasCadastradas = lista;
        localStorage.setItem('flowpdv_master_clientes', JSON.stringify(lista));
      } else {
        const saved = localStorage.getItem('flowpdv_master_clientes');
        if (saved) {
          this.adegasCadastradas = JSON.parse(saved);
        }
      }
    } catch (e) {
      console.log('[MasterCloud] Erro ao buscar licencas:', e);
      const saved = localStorage.getItem('flowpdv_master_clientes');
      if (saved) {
        this.adegasCadastradas = JSON.parse(saved);
      }
    }

    this.renderListaAdegas();
  },

  renderListaAdegas() {
    const tbody = document.getElementById('admin-adegas-tbody');
    const faturamentoEl = document.getElementById('admin-total-faturamento-mrr');
    const totalClientesEl = document.getElementById('admin-total-clientes-count');

    if (totalClientesEl) totalClientesEl.textContent = this.adegasCadastradas.length;

    const ativas = this.adegasCadastradas.filter(a => a.status === 'ativa');
    const totalMRR = ativas.length * 89.90;

    if (faturamentoEl) faturamentoEl.textContent = `R$ ${totalMRR.toFixed(2).replace('.', ',')} / mês`;

    if (!tbody) return;

    if (this.adegasCadastradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhuma adega cadastrada na nuvem. Clique em "+ Novo Cliente Master" para cadastrar.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.adegasCadastradas.map(a => {
      const isAtiva = a.status === 'ativa';
      const logoHtml = a.logoUrl && a.logoUrl.length > 5
        ? `<img src="${a.logoUrl}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 6px; background: #fff; border: 1px solid var(--border-card);">`
        : `<div style="width: 36px; height: 36px; border-radius: 6px; background: rgba(124, 58, 237, 0.1); color: #7c3aed; display: flex; align-items: center; justify-content: center; font-weight: 800;">🍷</div>`;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const partes = (a.dataVencimento || '').split('-');
      let diffDias = 30;
      if (partes.length === 3) {
        const venc = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 0, 0, 0);
        diffDias = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      }

      let statusBadgeHtml = '';
      if (!isAtiva) {
        statusBadgeHtml = '<span class="badge-stock zero">🛑 Bloqueada</span>';
      } else if (diffDias < 0) {
        statusBadgeHtml = '<span class="badge-stock low" style="background: #fee2e2; color: #b91c1c; font-weight: 800;">⚠️ Vencida</span>';
      } else if (diffDias === 0) {
        statusBadgeHtml = '<span class="badge-stock low" style="background: #fee2e2; color: #b91c1c; font-weight: 800;">⏳ Vence Hoje</span>';
      } else if (diffDias === 1) {
        statusBadgeHtml = '<span class="badge-stock low" style="background: #fef3c7; color: #b45309; font-weight: 800;">⏳ Vence Amanhã</span>';
      } else if (diffDias <= 5) {
        statusBadgeHtml = `<span class="badge-stock low">⏳ Vence em ${diffDias}d</span>`;
      } else {
        statusBadgeHtml = `<span class="badge-stock ok">🟢 Ativa (${diffDias}d)</span>`;
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              ${logoHtml}
              <div>
                <strong style="color: var(--text-main); font-size: 14px; display: block;">${a.nome}</strong>
                <span style="font-size: 11px; color: var(--text-muted);">${a.documento} • <code style="color: #7c3aed;">${a.chaveLicenca || a.id}</code></span>
              </div>
            </div>
          </td>
          <td>${a.whatsapp || '-'}</td>
          <td><span style="font-size: 12px; color: var(--accent-amber); font-weight: 700;">${a.plano}</span></td>
          <td><strong style="font-family: 'JetBrains Mono';">${new Date(a.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</strong></td>
          <td>
            ${statusBadgeHtml}
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn-primary-action" style="padding: 4px 8px; height: 30px; font-size: 11px; display: inline-flex; background: #0284c7; color: #fff; margin-right: 4px;" onclick="AdminMasterModule.usarNesteTerminal('${a.id}')" title="Ativar esta Adega neste terminal PDV">
              💻 Usar Aqui
            </button>
            <button type="button" class="btn-primary-action" style="padding: 4px 10px; height: 30px; font-size: 11px; display: inline-flex;" onclick="AdminMasterModule.abrirModalEditar('${a.id}')">
              ✏️ Editar Logo / Dados
            </button>
            <button type="button" class="btn-primary-action" style="padding: 4px 10px; height: 30px; font-size: 11px; display: inline-flex; background: var(--accent-green); color: #fff; margin-left: 4px;" onclick="AdminMasterModule.adicionar30Dias('${a.id}')">
              ➕ +30d
            </button>
            <button type="button" class="btn-action-sm ${isAtiva ? 'danger' : ''}" style="margin-left: 4px;" onclick="AdminMasterModule.toggleBloqueio('${a.id}')" title="${isAtiva ? 'Bloquear' : 'Desbloquear'}">
              ${isAtiva ? '🔒' : '🔓'}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async usarNesteTerminal(chaveOuId) {
    const adega = this.adegasCadastradas.find(a => a.id === chaveOuId || a.chaveLicenca === chaveOuId);
    if (!adega) return;

    const chave = adega.chaveLicenca || adega.id;
    await LicencaModule.ativarTerminal(chave);
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`💻 Terminal alternado para ${adega.nome}!`, 'success');
    }
  },

  abrirModalNovoCliente() {
    const modal = document.getElementById('modal-master-cliente');
    const chaveEl = document.getElementById('master-chave-input');
    const nomeEl = document.getElementById('master-nome-input');
    const cnpjEl = document.getElementById('master-cnpj-input');
    const logoEl = document.getElementById('master-logo-input');
    const whatsEl = document.getElementById('master-whats-input');
    const planoEl = document.getElementById('master-plano-input');
    const vencEl = document.getElementById('master-venc-input');
    const statusEl = document.getElementById('master-status-input');
    const comandasEl = document.getElementById('master-comandas-select');
    const layoutPdvEl = document.getElementById('master-layoutpdv-select');

    if (chaveEl) chaveEl.value = 'LIC-FLOW-' + Math.floor(100000 + Math.random() * 900000);
    if (nomeEl) nomeEl.value = '';
    if (cnpjEl) cnpjEl.value = '';
    if (logoEl) logoEl.value = '';
    if (whatsEl) whatsEl.value = '(19) 98963-2127';
    if (planoEl) planoEl.value = 'Mensal Pro (R$ 89,90/mês)';
    if (comandasEl) comandasEl.value = 'mesas_e_comandas';
    if (vencEl) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      vencEl.value = d.toISOString().split('T')[0];
    }
    if (statusEl) statusEl.value = 'ativa';
    if (layoutPdvEl) layoutPdvEl.value = 'moderno';

    if (modal) modal.classList.add('active');
  },

  abrirModalEditar(id) {
    const adega = this.adegasCadastradas.find(a => a.id === id || a.chaveLicenca === id);
    if (!adega) return;

    const modal = document.getElementById('modal-master-cliente');
    const chaveEl = document.getElementById('master-chave-input');
    const nomeEl = document.getElementById('master-nome-input');
    const cnpjEl = document.getElementById('master-cnpj-input');
    const logoEl = document.getElementById('master-logo-input');
    const whatsEl = document.getElementById('master-whats-input');
    const planoEl = document.getElementById('master-plano-input');
    const vencEl = document.getElementById('master-venc-input');
    const statusEl = document.getElementById('master-status-input');
    const comandasEl = document.getElementById('master-comandas-select');
    const layoutPdvEl = document.getElementById('master-layoutpdv-select');

    if (chaveEl) chaveEl.value = adega.chaveLicenca || adega.id;
    if (nomeEl) nomeEl.value = adega.nome || '';
    if (cnpjEl) cnpjEl.value = adega.documento || '';
    if (logoEl) logoEl.value = adega.logoUrl || '';
    if (whatsEl) whatsEl.value = adega.whatsapp || '';
    if (planoEl) planoEl.value = adega.plano || 'Mensal Pro (R$ 89,90/mês)';
    if (vencEl) vencEl.value = adega.dataVencimento || new Date().toISOString().split('T')[0];
    if (statusEl) statusEl.value = adega.status || 'ativa';
    if (comandasEl) comandasEl.value = adega.moduloComandas || 'mesas_e_comandas';
    if (layoutPdvEl) layoutPdvEl.value = adega.layoutPdv || 'moderno';

    if (modal) modal.classList.add('active');
  },

  fecharModal() {
    const modal = document.getElementById('modal-master-cliente');
    if (modal) modal.classList.remove('active');
  },

  async salvarClienteMaster() {
    const chaveEl = document.getElementById('master-chave-input');
    const nomeEl = document.getElementById('master-nome-input');
    const cnpjEl = document.getElementById('master-cnpj-input');
    const logoEl = document.getElementById('master-logo-input');
    const whatsEl = document.getElementById('master-whats-input');
    const planoEl = document.getElementById('master-plano-input');
    const vencEl = document.getElementById('master-venc-input');
    const statusEl = document.getElementById('master-status-input');
    const comandasEl = document.getElementById('master-comandas-select');
    const layoutPdvEl = document.getElementById('master-layoutpdv-select');

    const chave = chaveEl ? chaveEl.value.trim().toUpperCase() : '';
    const nome = nomeEl ? nomeEl.value.trim() : '';
    const cnpj = cnpjEl ? cnpjEl.value.trim() : '';
    const logoUrl = logoEl ? logoEl.value.trim() : '';
    const whatsapp = whatsEl ? whatsEl.value.trim() : '';
    const plano = planoEl ? planoEl.value : 'Mensal Pro (R$ 89,90/mês)';
    const vencimento = vencEl ? vencEl.value : '';
    const status = statusEl ? statusEl.value : 'ativa';
    const moduloComandas = comandasEl ? comandasEl.value : 'mesas_e_comandas';
    const layoutPdv = layoutPdvEl ? layoutPdvEl.value : 'moderno';

    if (!chave || !nome) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚠️ Preencha a Chave de Licença e o Nome da Adega!', 'warning');
      }
      return;
    }

    const clienteData = {
      id: chave,
      chaveLicenca: chave,
      nome: nome,
      razaoSocial: nome,
      documento: cnpj,
      cnpj: cnpj,
      logoUrl: logoUrl,
      whatsapp: whatsapp,
      plano: plano,
      vencimento: vencimento,
      status: status,
      moduloComandas: moduloComandas,
      layoutPdv: layoutPdv,
      atualizadoEm: new Date().toISOString()
    };

    // 1. Salvar no Firestore Cloud
    try {
      await setDoc(doc(db, "licencas", chave), clienteData, { merge: true });
      console.log('[MasterCloud] Salvo no Firestore Cloud:', chave);
    } catch (e) {
      console.log('[MasterCloud] Erro ao salvar no Firestore:', e);
    }

    // 2. Salvar na lista local do Master
    const idx = this.adegasCadastradas.findIndex(a => a.id === chave || a.chaveLicenca === chave);
    if (idx >= 0) {
      this.adegasCadastradas[idx] = { ...this.adegasCadastradas[idx], ...clienteData, dataVencimento: vencimento };
    } else {
      this.adegasCadastradas.push({ ...clienteData, dataVencimento: vencimento });
    }
    localStorage.setItem('flowpdv_master_clientes', JSON.stringify(this.adegasCadastradas));

    // 3. Se for a licença ativa deste terminal, atualizar localmente na hora
    const localLic = StorageService.getLicenca() || {};
    if ((localLic.chaveLicenca || '').toUpperCase() === chave) {
      localLic.razaoSocial = nome;
      localLic.cnpj = cnpj;
      localLic.logoUrl = logoUrl;
      localLic.status = status;
      localLic.moduloComandas = moduloComandas;
      localLic.layoutPdv = layoutPdv;
      localLic.dataExpiracao = vencimento + 'T23:59:59.000Z';
      StorageService.saveLicenca(localLic);

      if (window.App && typeof window.App.aplicarLayoutPdv === 'function') {
        window.App.aplicarLayoutPdv(layoutPdv);
      }

      if (window.ComandasModule && typeof window.ComandasModule.setModoAtendimento === 'function') {
        window.ComandasModule.setModoAtendimento(moduloComandas);
      }

      const config = StorageService.getConfig() || {};
      config.nomeEmpresa = nome;
      config.nomeLoja = nome;
      config.cnpj = cnpj;
      if (logoUrl) config.logoUrl = logoUrl;
      StorageService.saveConfig(config);

      if (window.App && typeof window.App.carregarConfiguracoes === 'function') {
        window.App.carregarConfiguracoes();
      }
    }

    this.fecharModal();
    this.renderListaAdegas();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`🎉 Cliente e Logo da adega "${nome}" sincronizados na Nuvem Cloud Firestore!`, 'success');
    }
  },

  async adicionar30Dias(id) {
    const adega = this.adegasCadastradas.find(a => a.id === id || a.chaveLicenca === id);
    if (!adega) return;

    const dataAtual = new Date(adega.dataVencimento > new Date().toISOString().split('T')[0] ? adega.dataVencimento : new Date());
    dataAtual.setDate(dataAtual.getDate() + 30);
    adega.dataVencimento = dataAtual.toISOString().split('T')[0];
    adega.status = 'ativa';

    try {
      await setDoc(doc(db, "licencas", adega.chaveLicenca || adega.id), {
        vencimento: adega.dataVencimento,
        status: 'ativa'
      }, { merge: true });
    } catch (e) {
      console.log('[MasterCloud] Erro +30d:', e);
    }

    localStorage.setItem('flowpdv_master_clientes', JSON.stringify(this.adegasCadastradas));
    this.renderListaAdegas();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`🎉 +30 Dias concedidos para ${adega.nome}! Vencimento: ${dataAtual.toLocaleDateString('pt-BR')}`, 'success');
    }
  },

  async toggleBloqueio(id) {
    const adega = this.adegasCadastradas.find(a => a.id === id || a.chaveLicenca === id);
    if (!adega) return;

    adega.status = adega.status === 'ativa' ? 'bloqueada' : 'ativa';

    try {
      await setDoc(doc(db, "licencas", adega.chaveLicenca || adega.id), {
        status: adega.status
      }, { merge: true });
    } catch (e) {
      console.log('[MasterCloud] Erro toggleBloqueio:', e);
    }

    localStorage.setItem('flowpdv_master_clientes', JSON.stringify(this.adegasCadastradas));
    this.renderListaAdegas();

    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`Status de ${adega.nome} alterado na nuvem para: ${adega.status.toUpperCase()}`, 'info');
    }
  }


,

  usarLicencaTerminalAtual() {
    const lic = StorageService.getLicenca() || {};
    const chaveEl = document.getElementById('master-chave-input');
    const nomeEl = document.getElementById('master-nome-input');
    const cnpjEl = document.getElementById('master-cnpj-input');
    const logoEl = document.getElementById('master-logo-input');

    if (chaveEl) chaveEl.value = lic.chaveLicenca || '';
    if (nomeEl) nomeEl.value = lic.razaoSocial || '';
    if (cnpjEl) cnpjEl.value = lic.cnpj || '';
    if (logoEl) logoEl.value = lic.logoUrl || '';

    this.atualizarPreviewLogo();
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('🎯 Dados da licença ativa desta máquina preenchidos no formulário!', 'info');
    }
  },

  selecionarFotoArquivo(event) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('⚠️ Escolha uma imagem de até 2MB!', 'warning');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target.result;
      const logoEl = document.getElementById('master-logo-input');
      if (logoEl) logoEl.value = base64Url;
      this.atualizarPreviewLogo();
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('📸 Foto de capa carregada com sucesso!', 'success');
      }
    };
    reader.readAsDataURL(file);
  },

  atualizarPreviewLogo() {
    const logoEl = document.getElementById('master-logo-input');
    const boxEl = document.getElementById('master-logo-preview-box');
    const imgEl = document.getElementById('master-preview-img');

    const url = logoEl ? logoEl.value.trim() : '';
    if (url && (url.startsWith('http') || url.startsWith('data:image') || url.startsWith('file://'))) {
      if (imgEl) imgEl.src = url;
      if (boxEl) boxEl.style.display = 'block';
    } else {
      if (boxEl) boxEl.style.display = 'none';
    }
  },
};

