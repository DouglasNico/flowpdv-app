/**
 * clientes.js - Gestão de Clientes, CRM, Delivery e Controle Financeiro de Fiado
 */

import { StorageService } from './storage.js';
import { ThermalPrintModule } from './thermal-print.js';
import { AuditModule } from './audit.js';

export const ClientesModule = {
  clienteEditandoId: null,
  clienteRecebendoId: null,
  clienteDetalhesId: null,
  termoBusca: '',

  init() {
    this.bindBusca();
    this.bindMascaraCpfCnpj();
    this.renderTabelaClientes();
  },

  bindMascaraCpfCnpj() {
    const inputCpf = document.getElementById('cli-cpf-cnpj');
    if (inputCpf && !inputCpf.dataset.hasMask) {
      inputCpf.dataset.hasMask = 'true';
      this.aplicarMascaraCpfCnpj(inputCpf);
    }
  },

  aplicarMascaraCpfCnpj(input) {
    if (!input) return;
    input.addEventListener('input', () => {
      let v = input.value.replace(/\D/g, '');
      if (v.length > 14) v = v.slice(0, 14);

      if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
      }
      input.value = v;
    });
  },

  bindBusca() {
    const inputBusca = document.getElementById('clientes-search-input');
    if (inputBusca) {
      inputBusca.addEventListener('input', (e) => {
        this.termoBusca = (e.target.value || '').trim().toLowerCase();
        this.renderTabelaClientes();
      });
    }
  },

  isFiadoHabilitado() {
    return StorageService.isModuloAtivo('fiadoWhatsApp');
  },

  renderTabela() {
    this.renderTabelaClientes();
  },

  renderTabelaClientes() {
    const tbody = document.getElementById('clientes-fiado-tbody');
    const thead = document.getElementById('clientes-table-header');
    const todosClientes = StorageService.getClientes() || [];
    const fiadoAtivo = this.isFiadoHabilitado();

    // 1. Filtrar clientes pela busca
    let clientes = todosClientes;
    if (this.termoBusca) {
      clientes = todosClientes.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const tel = (c.telefone || '').toLowerCase();
        const end = (c.endereco || '').toLowerCase();
        const bairro = (c.bairro || '').toLowerCase();
        const doc = (c.cpfCnpj || '').toLowerCase();
        return nome.includes(this.termoBusca) ||
               tel.includes(this.termoBusca) ||
               end.includes(this.termoBusca) ||
               bairro.includes(this.termoBusca) ||
               doc.includes(this.termoBusca);
      });
    }

    // 2. Atualizar Cards de Resumo no topo da aba Clientes
    this.renderCardsResumo(todosClientes, fiadoAtivo);

    // 3. Atualizar Cabeçalho da Tabela
    if (thead) {
      if (fiadoAtivo) {
        thead.innerHTML = `
          <tr>
            <th>Cliente / Contato</th>
            <th style="width: 190px;">WhatsApp / Tel</th>
            <th style="min-width: 180px;">Endereço / Delivery</th>
            <th style="width: 130px;">Limite Fiado</th>
            <th style="width: 140px;">Saldo Devedor</th>
            <th style="width: 110px;">Status</th>
            <th style="width: 240px; text-align: right;">Ações</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>Cliente / Razão Social</th>
            <th style="width: 180px;">WhatsApp / Tel</th>
            <th style="min-width: 220px;">Endereço Completo / Delivery</th>
            <th style="width: 140px;">Bairro / Cidade</th>
            <th style="width: 120px; text-align: center;">Cadastrado</th>
            <th style="width: 180px; text-align: right;">Ações</th>
          </tr>
        `;
      }
    }

    // 4. Rodapé e Contador
    const contadorEl = document.getElementById('clientes-fiado-contador');
    if (contadorEl) {
      const totalTxt = `${todosClientes.length} ${todosClientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`;
      const filtroTxt = this.termoBusca ? ` (filtrando ${clientes.length})` : '';
      contadorEl.innerHTML = `👥 Total: <strong>${totalTxt}${filtroTxt}</strong>`;
    }

    if (!tbody) return;

    if (clientes.length === 0) {
      const colSpan = fiadoAtivo ? 7 : 6;
      const msg = this.termoBusca
        ? `Nenhum cliente encontrado para "<strong>${this.termoBusca}</strong>".`
        : 'Nenhum cliente cadastrado ainda. Clique em "➕ Novo Cliente" acima para começar.';
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 32px; color: var(--text-dim);">${msg}</td></tr>`;
      return;
    }

    // 5. Renderizar Linhas da Tabela
    tbody.innerHTML = clientes.map(c => {
      const limite = parseFloat(c.limiteFiado) || 0;
      const saldo = parseFloat(c.saldoDevedor) || 0;
      const hasDebt = saldo > 0;
      
      // Endereço resumido
      let endResumo = '-';
      if (c.endereco) {
        endResumo = `${c.endereco}${c.numero ? ', ' + c.numero : ''}${c.bairro ? ' - ' + c.bairro : ''}`;
      }

      // Link WhatsApp Elegante
      const telClean = (c.telefone || '').replace(/\D/g, '');
      let waBtn = '';
      if (telClean.length >= 10) {
        if (hasDebt && fiadoAtivo) {
          waBtn = `
            <button type="button" class="btn-whatsapp-pill" onclick="ClientesModule.abrirWhatsAppCobranca('${telClean}', '${encodeURIComponent(c.nome)}', ${saldo})" title="Enviar lembrete de cobrança amigável pelo WhatsApp" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; background: #059669; color: #ffffff; font-size: 11px; font-weight: 700; border: none; cursor: pointer; white-space: nowrap; box-shadow: 0 1px 4px rgba(5, 150, 105, 0.3);">
              💬 Cobrar
            </button>
          `;
        } else {
          waBtn = `
            <button type="button" class="btn-whatsapp-pill" onclick="ClientesModule.abrirWhatsApp('${telClean}', '${encodeURIComponent(c.nome)}')" title="Abrir conversa no WhatsApp" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; background: #22c55e; color: #ffffff; font-size: 11px; font-weight: 700; border: none; cursor: pointer; white-space: nowrap; box-shadow: 0 1px 4px rgba(34, 197, 94, 0.3);">
              🟢 WhatsApp
            </button>
          `;
        }
      }

      if (fiadoAtivo) {
        return `
          <tr>
            <td>
              <div style="display: flex; flex-direction: column;">
                <strong style="color: var(--text-main); font-size: 14.5px;">${c.nome}</strong>
                ${c.cpfCnpj ? `<span style="font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono';">Doc: ${c.cpfCnpj}</span>` : ''}
              </div>
            </td>
            <td style="white-space: nowrap;">
              <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span style="color: var(--text-main); font-weight: 600; font-size: 12.5px; font-family: 'JetBrains Mono';">${c.telefone || '-'}</span>
                ${waBtn}
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${endResumo}">
                <span style="font-size: 12.5px; color: var(--text-main);">${endResumo}</span>
                ${c.complemento ? `<span style="background: var(--bg-surface-2, #e2e8f0); font-size: 10.5px; padding: 1px 5px; border-radius: 4px; color: var(--text-muted);">${c.complemento}</span>` : ''}
              </div>
            </td>
            <td style="font-weight: 700; color: var(--text-muted); font-size: 13.5px;">R$ ${limite.toFixed(2).replace('.', ',')}</td>
            <td>
              <strong style="font-family: 'JetBrains Mono'; font-size: 15px; color: ${hasDebt ? 'var(--accent-red, #dc2626)' : 'var(--accent-green, #059669)'};">
                R$ ${saldo.toFixed(2).replace('.', ',')}
              </strong>
            </td>
            <td>
              <span class="badge-stock ${hasDebt ? 'low' : 'ok'}">
                ${hasDebt ? 'Em Aberto' : 'Quitado'}
              </span>
            </td>
            <td style="text-align: right;">
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                ${hasDebt ? `
                  <button type="button" class="btn-receber-fiado" onclick="ClientesModule.abrirModalReceber('${c.id}')" title="Receber pagamento da conta">
                    💵 Receber
                  </button>
                ` : ''}
                <button type="button" class="btn-action-sm" onclick="ClientesModule.abrirModalDetalhes('${c.id}')" title="Ver detalhes completos / Delivery" style="font-weight: 700;">Detalhes</button>
                <button type="button" class="btn-action-sm" onclick="ClientesModule.abrirModalCliente('${c.id}')" title="Editar dados">✏️</button>
                <button type="button" class="btn-action-sm" onclick="ClientesModule.excluirCliente('${c.id}')" title="Excluir cliente" style="color: #ef4444;">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      } else {
        // Modo CRM & Delivery Limpo (Sem Módulo Financeiro de Fiado)
        return `
          <tr>
            <td>
              <div style="display: flex; flex-direction: column;">
                <strong style="color: var(--text-main); font-size: 14.5px;">${c.nome}</strong>
                ${c.cpfCnpj ? `<span style="font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono';">Doc: ${c.cpfCnpj}</span>` : ''}
              </div>
            </td>
            <td style="white-space: nowrap;">
              <div style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                <span style="color: var(--text-main); font-weight: 600; font-size: 12.5px; font-family: 'JetBrains Mono';">${c.telefone || '-'}</span>
                ${waBtn}
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;" title="${endResumo}">
                <span style="font-size: 13px; color: var(--text-main); font-weight: 500;">${c.endereco ? (c.endereco + (c.numero ? ', ' + c.numero : '')) : 'Não cadastrado'}</span>
                ${c.complemento ? `<span style="background: var(--bg-surface-2, #e2e8f0); font-size: 10.5px; padding: 1px 5px; border-radius: 4px; color: var(--text-muted);">${c.complemento}</span>` : ''}
              </div>
            </td>
            <td>
              <span style="font-size: 12.5px; color: var(--text-muted);">${c.bairro || c.cidade || '-'}</span>
            </td>
            <td style="text-align: center;">
              <span style="font-size: 11.5px; color: var(--text-dim);">${c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '--'}</span>
            </td>
            <td style="text-align: right;">
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                <button type="button" class="btn-action-sm" onclick="ClientesModule.abrirModalDetalhes('${c.id}')" title="Ver detalhes completos / Delivery" style="font-weight: 700;">Detalhes</button>
                <button type="button" class="btn-action-sm" onclick="ClientesModule.abrirModalCliente('${c.id}')" title="Editar dados">✏️</button>
                <button type="button" class="btn-action-sm" onclick="ClientesModule.excluirCliente('${c.id}')" title="Excluir cliente" style="color: #ef4444;">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }
    }).join('');
  },

  renderCardsResumo(clientes, fiadoAtivo) {
    const metricsContainer = document.getElementById('clientes-metrics-container');
    if (!metricsContainer) return;

    const totalCadastrados = clientes.length;
    const comEndereco = clientes.filter(c => c.endereco && c.endereco.trim().length > 0).length;
    const comWhats = clientes.filter(c => (c.telefone || '').replace(/\D/g, '').length >= 10).length;

    if (fiadoAtivo) {
      const emDebito = clientes.filter(c => (parseFloat(c.saldoDevedor) || 0) > 0);
      const totalAReceber = clientes.reduce((acc, c) => acc + (parseFloat(c.saldoDevedor) || 0), 0);

      metricsContainer.innerHTML = `
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;">👥 Total Cadastrados</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--text-main); font-family: 'JetBrains Mono'; margin-top: 2px;">${totalCadastrados}</div>
        </div>
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;">🛵 Com Endereço Delivery</div>
          <div style="font-size: 22px; font-weight: 900; color: #0284c7; font-family: 'JetBrains Mono'; margin-top: 2px;">${comEndereco}</div>
        </div>
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid #fecaca; border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.3px;">⚠️ Clientes em Débito</div>
          <div style="font-size: 22px; font-weight: 900; color: #dc2626; font-family: 'JetBrains Mono'; margin-top: 2px;">${emDebito.length}</div>
        </div>
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid #fde68a; border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: #d97706; text-transform: uppercase; letter-spacing: 0.3px;">💰 Total em Aberto (Fiado)</div>
          <div style="font-size: 22px; font-weight: 900; color: #d97706; font-family: 'JetBrains Mono'; margin-top: 2px;">R$ ${totalAReceber.toFixed(2).replace('.', ',')}</div>
        </div>
      `;
    } else {
      metricsContainer.innerHTML = `
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;">👥 Clientes Ativos</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--text-main); font-family: 'JetBrains Mono'; margin-top: 2px;">${totalCadastrados}</div>
        </div>
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;">📱 Contatos de WhatsApp</div>
          <div style="font-size: 22px; font-weight: 900; color: #16a34a; font-family: 'JetBrains Mono'; margin-top: 2px;">${comWhats}</div>
        </div>
        <div class="summary-metric-card" style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.3px;">🛵 Endereços de Entrega</div>
          <div style="font-size: 22px; font-weight: 900; color: #0284c7; font-family: 'JetBrains Mono'; margin-top: 2px;">${comEndereco}</div>
        </div>
      `;
    }
  },

  abrirWhatsApp(telefoneLimpo, nomeCodificado) {
    const nome = decodeURIComponent(nomeCodificado || '');
    const config = StorageService.getConfig();
    const nomeLoja = config.nomeEmpresa || 'FlowPDV';
    const msg = encodeURIComponent(`Olá ${nome}, tudo bem? Aqui é do atendimento do ${nomeLoja}.`);
    const url = `https://wa.me/55${telefoneLimpo}?text=${msg}`;
    
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
    if (window.App) window.App.showToast('🟢 Abrindo conversa no WhatsApp...', 'info');
  },

  abrirWhatsAppCobranca(telefoneLimpo, nomeCodificado, saldo) {
    const nome = decodeURIComponent(nomeCodificado || '');
    const config = StorageService.getConfig();
    const nomeLoja = config.nomeEmpresa || 'FlowPDV';
    const saldoTxt = `R$ ${parseFloat(saldo || 0).toFixed(2).replace('.', ',')}`;
    const msg = encodeURIComponent(`Olá ${nome}, tudo bem? Passando para lembrar que consta um saldo em aberto de *${saldoTxt}* referente à sua conta aqui no ${nomeLoja}. Qualquer dúvida ou para efetuar o pagamento via PIX, estamos à disposição!`);
    const url = `https://wa.me/55${telefoneLimpo}?text=${msg}`;
    
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
    if (window.App) window.App.showToast('💬 Abrindo cobrança amigável no WhatsApp...', 'info');
  },

  async buscarCep(cepValor) {
    const cepClean = (cepValor || '').replace(/\D/g, '');
    if (cepClean.length !== 8) return;

    try {
      const statusEl = document.getElementById('cli-cep-status');
      if (statusEl) statusEl.textContent = 'Buscando CEP...';

      const res = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
      const data = await res.json();

      if (data && !data.erro) {
        const inputEnd = document.getElementById('cli-endereco');
        const inputBairro = document.getElementById('cli-bairro');
        const inputCidade = document.getElementById('cli-cidade');
        const inputNum = document.getElementById('cli-numero');

        if (inputEnd) inputEnd.value = data.logradouro || '';
        if (inputBairro) inputBairro.value = data.bairro || '';
        if (inputCidade) inputCidade.value = `${data.localidade || ''} - ${data.uf || ''}`;
        if (statusEl) statusEl.textContent = '✅ CEP Localizado';
        if (inputNum) inputNum.focus();
      } else {
        if (statusEl) statusEl.textContent = '❌ CEP não encontrado';
      }
    } catch(e) {
      console.warn('[ViaCEP] Erro ao buscar CEP:', e);
    }
  },

  abrirModalCliente(id = null) {
    this.clienteEditandoId = id;
    const modal = document.getElementById('modal-novo-cliente');
    const form = document.getElementById('form-cliente');
    const titleEl = document.getElementById('modal-cliente-title');
    const secaoFiado = document.getElementById('form-cliente-secao-fiado');
    const secaoClube = document.getElementById('form-cliente-secao-clube');
    const statusCep = document.getElementById('cli-cep-status');

    if (form) form.reset();
    if (statusCep) statusCep.textContent = '';

    const fiadoAtivo = this.isFiadoHabilitado();
    const clubeAtivo = StorageService.isModuloAtivo('clubeFidelidade');
    if (secaoFiado) {
      secaoFiado.style.display = fiadoAtivo ? 'block' : 'none';
    }
    if (secaoClube) secaoClube.style.display = clubeAtivo ? 'flex' : 'none';

    if (id) {
      if (titleEl) titleEl.innerHTML = '✏️ Editar Dados do Cliente';
      const clientes = StorageService.getClientes();
      const c = clientes.find(item => item.id === id);
      if (c) {
        document.getElementById('cli-nome').value = c.nome || '';
        document.getElementById('cli-tel').value = c.telefone || '';
        document.getElementById('cli-cpf-cnpj').value = c.cpfCnpj || '';
        document.getElementById('cli-cep').value = c.cep || '';
        document.getElementById('cli-endereco').value = c.endereco || '';
        document.getElementById('cli-numero').value = c.numero || '';
        document.getElementById('cli-bairro').value = c.bairro || '';
        document.getElementById('cli-cidade').value = c.cidade || '';
        document.getElementById('cli-complemento').value = c.complemento || '';
        document.getElementById('cli-ponto-ref').value = c.pontoReferencia || '';
        document.getElementById('cli-obs').value = c.observacoes || '';
          const chkClube = document.getElementById('cli-clube-fidelidade');
          if (chkClube) chkClube.checked = c.membroClube !== false;
        document.getElementById('cli-limite').value = c.limiteFiado || 200;
      }
    } else {
      if (titleEl) titleEl.innerHTML = fiadoAtivo ? '👥 Novo Cliente & Fiado' : '👥 Novo Cliente & Delivery';
      document.getElementById('cli-limite').value = 200;
    }

    this.bindMascaraCpfCnpj();
    if (modal) modal.classList.add('active');
  },

  fecharModalCliente() {
    const modal = document.getElementById('modal-novo-cliente');
    if (modal) modal.classList.remove('active');
  },

  salvarCliente(e) {
    e.preventDefault();
    const nome = document.getElementById('cli-nome').value.trim();
    const telefone = document.getElementById('cli-tel').value.trim();
    const cpfCnpj = document.getElementById('cli-cpf-cnpj')?.value.trim() || '';
    const cep = document.getElementById('cli-cep')?.value.trim() || '';
    const endereco = document.getElementById('cli-endereco')?.value.trim() || '';
    const numero = document.getElementById('cli-numero')?.value.trim() || '';
    const bairro = document.getElementById('cli-bairro')?.value.trim() || '';
    const cidade = document.getElementById('cli-cidade')?.value.trim() || '';
    const complemento = document.getElementById('cli-complemento')?.value.trim() || '';
    const pontoReferencia = document.getElementById('cli-ponto-ref')?.value.trim() || '';
    const observacoes = document.getElementById('cli-obs')?.value.trim() || '';
    const membroClube = document.getElementById('cli-clube-fidelidade')?.checked ?? true;
    const limiteFiado = parseFloat(document.getElementById('cli-limite')?.value) || 200;

    if (!nome) {
      window.App.showToast('Informe o nome do cliente!', 'warning');
      return;
    }

    let clientes = StorageService.getClientes();
    let novoClienteId = this.clienteEditandoId;

    if (this.clienteEditandoId) {
      const index = clientes.findIndex(c => c.id === this.clienteEditandoId);
      if (index !== -1) {
        clientes[index] = {
          ...clientes[index],
          nome,
          telefone,
          cpfCnpj,
          cep,
          endereco,
          numero,
          bairro,
          cidade,
          complemento,
          pontoReferencia,
          observacoes,
          limiteFiado
        };
      }
    } else {
      const novo = {
        id: 'CLI-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        nome,
        telefone,
        cpfCnpj,
        cep,
        endereco,
        numero,
        bairro,
        cidade,
        complemento,
        pontoReferencia,
        observacoes,
        limiteFiado,
        saldoDevedor: 0.00,
        historico: [],
        criadoEm: new Date().toISOString()
      };
      clientes.push(novo);
      novoClienteId = novo.id;
    }

    StorageService.saveClientes(clientes);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('clientes');
    }

    // Registro no Módulo de Auditoria
    AuditModule.registrarLog(
      this.clienteEditandoId ? 'edicao_cliente' : 'cadastro_cliente',
      `${this.clienteEditandoId ? 'Editou dados do' : 'Cadastrou novo'} cliente "${nome}"${telefone ? ' (Tel: ' + telefone + ')' : ''}`,
      { id: novoClienteId, nome, telefone, limiteFiado }
    );

    this.fecharModalCliente();
    this.renderTabelaClientes();

    // Se o modal de pagamento estiver aberto no PDV, recarrega e seleciona o cliente na hora
    if (window.PdvModule && typeof window.PdvModule.carregarClientesFiadoSelect === 'function') {
      window.PdvModule.carregarClientesFiadoSelect(novoClienteId);
    }

    window.App.showToast('✅ Cliente salvo com sucesso!', 'success');
  },

  excluirCliente(id) {
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === id);
    if (!c) return;

    if ((parseFloat(c.saldoDevedor) || 0) > 0) {
      window.App.showToast(`Não é possível excluir ${c.nome} pois há débito de R$ ${c.saldoDevedor.toFixed(2)} em aberto!`, 'warning');
      return;
    }

    window.App.confirmarAcao({
      titulo: 'Excluir Cliente',
      mensagem: `Tem certeza que deseja excluir o cadastro do cliente <strong>"${c.nome}"</strong>?<br><br><span style="color: var(--text-dim); font-size: 12px;">O histórico deste cliente será removido do sistema.</span>`,
      icone: '👤',
      textoConfirmar: '🗑️ Sim, Excluir [ENTER]',
      textoCancelar: 'Cancelar [ESC]',
      perigo: true,
      onConfirm: () => {
        const novaLista = clientes.filter(item => item.id !== id);
        StorageService.saveClientes(novaLista);

        if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
          window.CloudSyncModule.enviarAlteracaoNuvem('clientes_exclusao');
        }

        // Registro no Módulo de Auditoria
        AuditModule.registrarLog('exclusao_cliente', `Excluiu o cadastro do cliente "${c.nome}" (ID: ${id})`, { id, nome: c.nome });

        this.renderTabelaClientes();
        window.App.showToast(`🗑️ Cliente "${c.nome}" excluído com sucesso.`, 'info');
      }
    });
  },

  abrirModalDetalhes(id) {
    this.clienteDetalhesId = id;
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === id);
    if (!c) return;

    const modal = document.getElementById('modal-detalhes-cliente');
    const corpo = document.getElementById('detalhes-cliente-corpo');
    if (!modal || !corpo) return;

    const telClean = (c.telefone || '').replace(/\D/g, '');
    const fiadoAtivo = this.isFiadoHabilitado();
    const endCompleto = `${c.endereco || ''}${c.numero ? ', ' + c.numero : ''}${c.bairro ? ' - ' + c.bairro : ''}${c.cidade ? ' (' + c.cidade + ')' : ''}${c.cep ? ' - CEP: ' + c.cep : ''}`;

    let whatsappButtonsHtml = '';
    if (telClean.length >= 10) {
      if (c.saldoDevedor > 0 && fiadoAtivo) {
        whatsappButtonsHtml = `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn-whatsapp-action" style="padding: 6px 12px; font-size: 12.5px; background: #059669;" onclick="ClientesModule.abrirWhatsAppCobranca('${telClean}', '${encodeURIComponent(c.nome)}', ${c.saldoDevedor})">
              💬 Cobrança no WhatsApp
            </button>
            <button type="button" class="btn-whatsapp-action" style="padding: 6px 10px; font-size: 12px; background: #22c55e;" onclick="ClientesModule.abrirWhatsApp('${telClean}', '${encodeURIComponent(c.nome)}')">
              🟢 Conversar
            </button>
          </div>
        `;
      } else {
        whatsappButtonsHtml = `
          <button type="button" class="btn-whatsapp-action" style="padding: 6px 12px; font-size: 13px;" onclick="ClientesModule.abrirWhatsApp('${telClean}', '${encodeURIComponent(c.nome)}')">
            🟢 Conversar no WhatsApp
          </button>
        `;
      }
    }

    corpo.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Header do Cliente -->
        <div style="background: var(--bg-surface-2, #f8fafc); border: 1px solid var(--border-card); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">${c.nome}</h3>
            <span style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono';">ID: ${c.id} ${c.cpfCnpj ? '• Doc: ' + c.cpfCnpj : ''}</span>
          </div>
          ${whatsappButtonsHtml}
        </div>

        <!-- Endereço para Delivery -->
        <div style="background: var(--bg-surface-1, #ffffff); border: 1px solid var(--border-card); border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 13px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">🛵 Endereço para Entrega / Delivery</strong>
            <button type="button" class="btn-action-sm" onclick="ClientesModule.copiarEndereco('${encodeURIComponent(endCompleto)}')" title="Copiar endereço formatado para enviar ao entregador">
              📋 Copiar Endereço
            </button>
          </div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">
            ${c.endereco ? `${c.endereco}, Nº ${c.numero || 'S/N'}` : '<span style="color: var(--text-dim);">Nenhum endereço cadastrado.</span>'}
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted);">
            ${c.bairro ? `Bairro: <strong>${c.bairro}</strong>` : ''} ${c.cidade ? `• ${c.cidade}` : ''} ${c.cep ? `• CEP: ${c.cep}` : ''}
          </div>
          ${c.complemento ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;"><strong>Complemento:</strong> ${c.complemento}</div>` : ''}
          ${c.pontoReferencia ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;"><strong>Ponto de Ref:</strong> ${c.pontoReferencia}</div>` : ''}
        </div>

        <!-- Observações de Entrega -->
        ${c.observacoes ? `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 12px;">
            <strong style="font-size: 12px; color: #d97706; display: block; margin-bottom: 4px;">📝 Notas & Preferências:</strong>
            <div style="font-size: 13px; color: var(--text-main);">${c.observacoes}</div>
          </div>
        ` : ''}

        <!-- Informações Financeiras (se Fiado Ativo) -->
        ${fiadoAtivo ? `
          <div style="background: var(--bg-surface-2, #f8fafc); border: 1px solid var(--border-card); border-radius: 12px; padding: 16px;">
            <strong style="font-size: 13px; color: var(--text-main); display: block; margin-bottom: 10px;">💳 Situação Financeira (Fiado)</strong>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: var(--bg-surface-1, #ffffff); padding: 10px; border-radius: 8px; border: 1px solid var(--border-card);">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">Limite de Crédito:</span>
                <strong style="font-size: 16px; color: var(--text-main); font-family: 'JetBrains Mono';">R$ ${(c.limiteFiado || 200).toFixed(2).replace('.', ',')}</strong>
              </div>
              <div style="background: var(--bg-surface-1, #ffffff); padding: 10px; border-radius: 8px; border: 1px solid ${c.saldoDevedor > 0 ? '#fecaca' : '#bbf7d0'};">
                <span style="font-size: 11px; color: var(--text-muted); display: block;">Saldo Devedor Atual:</span>
                <strong style="font-size: 16px; color: ${c.saldoDevedor > 0 ? '#dc2626' : '#16a34a'}; font-family: 'JetBrains Mono';">R$ ${(c.saldoDevedor || 0).toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    modal.classList.add('active');
  },

  fecharModalDetalhes() {
    const modal = document.getElementById('modal-detalhes-cliente');
    if (modal) modal.classList.remove('active');
  },

  copiarEndereco(endCodificado) {
    const end = decodeURIComponent(endCodificado || '');
    if (!end) return;
    navigator.clipboard.writeText(end).then(() => {
      if (window.App) window.App.showToast('📋 Endereço copiado para a área de transferência!', 'success');
    });
  },

  // Modal Elegante de Receber Pagamento de Fiado
  abrirModalReceber(id) {
    this.clienteRecebendoId = id;
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === id);
    if (!c || c.saldoDevedor <= 0) return;

    const modal = document.getElementById('modal-receber-fiado');
    const nomeEl = document.getElementById('rec-fiado-cliente-nome');
    const saldoEl = document.getElementById('rec-fiado-saldo-atual');
    const inputValor = document.getElementById('rec-fiado-valor-input');

    if (nomeEl) nomeEl.textContent = c.nome;
    if (saldoEl) saldoEl.textContent = `R$ ${c.saldoDevedor.toFixed(2).replace('.', ',')}`;
    if (inputValor) {
      inputValor.value = c.saldoDevedor.toFixed(2);
      inputValor.max = c.saldoDevedor;
      setTimeout(() => inputValor.select(), 150);
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalReceber() {
    const modal = document.getElementById('modal-receber-fiado');
    if (modal) modal.classList.remove('active');
  },

  preencherTotalQuitar() {
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === this.clienteRecebendoId);
    if (c) {
      document.getElementById('rec-fiado-valor-input').value = c.saldoDevedor.toFixed(2);
    }
  },

  confirmarRecebimento() {
    const clientes = StorageService.getClientes();
    const c = clientes.find(item => item.id === this.clienteRecebendoId);
    if (!c) return;

    const inputValor = document.getElementById('rec-fiado-valor-input');
    const formaPagto = document.getElementById('rec-fiado-forma-pagto')?.value || 'Dinheiro';
    const valor = parseFloat(inputValor?.value) || 0;

    if (valor <= 0) {
      window.App.showToast('Digite um valor válido maior que zero!', 'warning');
      return;
    }

    if (valor > c.saldoDevedor) {
      window.App.showToast(`O valor informado (R$ ${valor.toFixed(2)}) é maior que a dívida (R$ ${c.saldoDevedor.toFixed(2)})!`, 'warning');
      return;
    }

    // Abater do saldo devedor
    c.saldoDevedor = Math.max(0, c.saldoDevedor - valor);
    c.historico = c.historico || [];
    c.historico.unshift({
      data: new Date().toISOString(),
      valor: valor,
      tipo: 'pagamento',
      formaPagamento: formaPagto,
      descricao: `Pagamento de Fiado recebido no caixa via ${formaPagto}`
    });

    // Registrar no histórico de vendas/entradas do caixa
    const venda = {
      id: 'REC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      numeroVenda: StorageService.getProximoNumeroVenda(),
      data: new Date().toISOString(),
      itens: [{ id: 'FIADO-REC', nome: `Quitação Fiado: ${c.nome}`, quantidade: 1, precoUnitario: valor }],
      subtotal: valor,
      desconto: 0,
      total: valor,
      formaPagamento: formaPagto,
      valorPago: valor,
      troco: 0,
      operador: window.AuthModule ? window.AuthModule.getNomeOperador() : 'Caixa'
    };

    StorageService.saveVenda(venda);
    StorageService.saveClientes(clientes);

    // Registro no Módulo de Auditoria
    AuditModule.registrarLog('recebimento_fiado', `Recebeu pagamento de Fiado no valor de R$ ${valor.toFixed(2)} do cliente "${c.nome}" via ${formaPagto}`, {
      clienteId: c.id,
      clienteNome: c.nome,
      valor: valor,
      formaPagamento: formaPagto,
      saldoRestante: c.saldoDevedor
    });

    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('clientes_recebimento');
    }

    this.fecharModalReceber();
    this.renderTabelaClientes();

    // Imprimir comprovante se selecionado
    if (document.getElementById('rec-fiado-imprimir')?.checked) {
      ThermalPrintModule.imprimirCupomVenda(venda);
    }

    window.App.showToast(`🎉 Pagamento de R$ ${valor.toFixed(2)} recebido com sucesso de ${c.nome}!`, 'success');
  }
};