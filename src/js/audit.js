/**
 * audit.js - Módulo de Auditoria e Logs de Atividades em Tempo Real (Master Sync)
 * Registra eventos críticos como exclusão de produtos, fechamento de caixa,
 * cancelamentos e importações em massa para consulta no Painel Master.
 */

import { StorageService } from './storage.js';
import { db, doc, collection, addDoc, getDocs, query, where, orderBy, limit } from './firebase-config.js';

export const AuditModule = {
  getChaveLicencaAtual() {
    const lic = StorageService.getLicenca() || {};
    return (lic.chaveLicenca || lic.clienteId || 'LOCAL').trim().toUpperCase();
  },

  getStorageKey() {
    const chave = this.getChaveLicencaAtual();
    return `flowpdv_logs_auditoria_${chave}`;
  },

  getOperadorAtual() {
    let nome = 'Operador';
    try {
      const sessao = sessionStorage.getItem('flowpdv_usuario_logado');
      if (sessao) {
        const u = JSON.parse(sessao);
        if (u && u.nome) nome = u.nome;
      }
    } catch(e) {}
    return nome;
  },

  getLocalLogs() {
    try {
      const key = this.getStorageKey();
      const logs = JSON.parse(localStorage.getItem(key) || '[]');
      const chaveAtual = this.getChaveLicencaAtual();
      // Garantia estrita de isolamento por licença:
      return (logs || []).filter(l => !l.chaveLicenca || String(l.chaveLicenca).trim().toUpperCase() === chaveAtual);
    } catch(e) {
      return [];
    }
  },

  salvarLogLocal(log) {
    try {
      const key = this.getStorageKey();
      const logs = this.getLocalLogs();
      logs.unshift(log);
      if (logs.length > 200) logs.length = 200; // Manter últimos 200
      localStorage.setItem(key, JSON.stringify(logs));
    } catch(e) {}
  },

  removerLogLocal(logId) {
    try {
      const key = this.getStorageKey();
      let logs = this.getLocalLogs();
      logs = logs.filter(l => l.id !== logId);
      localStorage.setItem(key, JSON.stringify(logs));
    } catch(e) {}
  },

  limparCacheLogsLicenca() {
    if (window.GerenciaModule) {
      window.GerenciaModule.logsAuditoriaCache = [];
    }
  },

  async registrarLog(tipo, descricao, detalhes = {}) {
    const lic = StorageService.getLicenca() || {};
    const config = StorageService.getConfig() || {};
    const chaveLicenca = this.getChaveLicencaAtual();
    const myDevId = StorageService.getDeviceId();
    const operador = this.getOperadorAtual();
    const razaoSocial = lic.razaoSocial || config.nomeEmpresa || config.nomeLoja || 'Minha Loja';

    const payload = {
      id: 'LOG-' + Date.now().toString().slice(-6) + Math.random().toString(36).substring(2, 5),
      chaveLicenca: chaveLicenca || 'LOCAL',
      razaoSocial: razaoSocial,
      tipo: tipo || 'geral',
      descricao: String(descricao || ''),
      operador: operador,
      terminalId: myDevId,
      hostname: 'Computador',
      detalhes: detalhes || {},
      criadoEm: new Date().toISOString(),
      dataHoraFormatada: new Date().toLocaleString('pt-BR')
    };

    // 1. Salva imediatamente no storage local da licença (offline-first)
    this.salvarLogLocal(payload);

    // 2. Sincroniza com a nuvem em background
    setTimeout(async () => {
      try {
        if (!chaveLicenca || chaveLicenca === 'LOCAL') return;
        if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
          try {
            const info = await window.electronAPI.getSystemInfo();
            if (info && info.hostname) payload.hostname = info.hostname;
          } catch(e) {}
        }
        await addDoc(collection(db, "auditoria_lojas"), payload);
      } catch (err) {
        console.warn('[AuditModule] Erro ao sincronizar log na nuvem (salvo localmente):', err);
      }
    }, 0);
  },

  registrarOuAtualizarLogMesa(comanda, evento = 'atualizacao', extra = {}) {
    if (!comanda) return;
    const lic = StorageService.getLicenca() || {};
    const config = StorageService.getConfig() || {};
    const chaveLicenca = this.getChaveLicencaAtual();
    const myDevId = StorageService.getDeviceId();
    const operador = this.getOperadorAtual();
    const razaoSocial = lic.razaoSocial || config.nomeEmpresa || config.nomeLoja || 'Minha Loja';

    // Chave única para agrupar todo o atendimento da mesma mesa/comanda
    const sessaoKey = 'SESSAO_' + comanda.id + '_' + (comanda.abertaEm ? comanda.abertaEm.substring(0, 16) : 'ATUAL');
    const totalConsumo = parseFloat(comanda.total || 0);
    const qtdItens = (comanda.itens || []).length;
    const clienteStr = comanda.cliente ? ` (${comanda.cliente})` : '';

    let descricao = `Atendimento ${comanda.nome}${clienteStr} — ${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'} (R$ ${totalConsumo.toFixed(2).replace('.', ',')})`;
    
    if (evento === 'fechamento_caixa') {
      descricao = `Fechamento no Caixa: ${comanda.nome}${clienteStr} — Total: R$ ${totalConsumo.toFixed(2).replace('.', ',')}`;
    } else if (evento === 'transferencia') {
      descricao = `Transferência de Consumo: ${extra.origem || comanda.nome} ➔ ${extra.destino || comanda.nome} (R$ ${totalConsumo.toFixed(2).replace('.', ',')})`;
    } else if (evento === 'liberacao') {
      descricao = `Liberação / Zeramento: ${comanda.nome}${clienteStr} (Consumo Finalizado)`;
    }

    const detalhes = {
      comanda: comanda.nome,
      cliente: comanda.cliente || 'Não informado',
      abertaEm: comanda.abertaEm ? new Date(comanda.abertaEm).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
      total: totalConsumo,
      taxaServico: comanda.taxaServico ? (totalConsumo * 0.10) : 0,
      statusAtendimento: comanda.status,
      itens: (comanda.itens || []).map(i => ({
        nome: i.nome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        total: i.total
      })),
      ...extra
    };

    const logs = this.getLocalLogs();
    const logExistenteIdx = logs.findIndex(l => l.sessaoKey === sessaoKey);

    if (logExistenteIdx >= 0) {
      logs[logExistenteIdx].descricao = descricao;
      logs[logExistenteIdx].detalhes = detalhes;
      logs[logExistenteIdx].operador = operador;
      logs[logExistenteIdx].dataHoraFormatada = new Date().toLocaleString('pt-BR');
      logs[logExistenteIdx].criadoEm = new Date().toISOString();
      localStorage.setItem(this.getStorageKey(), JSON.stringify(logs));
    } else {
      const payload = {
        id: 'LOG-CMD-' + Date.now().toString().slice(-6) + Math.random().toString(36).substring(2, 4),
        sessaoKey: sessaoKey,
        chaveLicenca: chaveLicenca || 'LOCAL',
        razaoSocial: razaoSocial,
        tipo: 'comandas',
        descricao: descricao,
        operador: operador,
        terminalId: myDevId,
        hostname: 'Computador',
        detalhes: detalhes,
        criadoEm: new Date().toISOString(),
        dataHoraFormatada: new Date().toLocaleString('pt-BR')
      };
      this.salvarLogLocal(payload);
    }
  },

  async buscarLogsAuditoria(maxLogs = 150) {
    const chaveLicenca = this.getChaveLicencaAtual();
    const logsLocais = this.getLocalLogs();
    try {
      if (!chaveLicenca || chaveLicenca === 'LOCAL' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return logsLocais.slice(0, maxLogs);
      }

      // Consulta no Firestore filtrando estritamente por chaveLicenca
      const q = query(
        collection(db, "auditoria_lojas"),
        where("chaveLicenca", "==", chaveLicenca),
        limit(150)
      );

      // Timeout de segurança de 3.5s para NUNCA travar a tela se a rede demorar
      const fetchPromise = getDocs(q);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout de busca auditoria (3.5s)')), 3500)
      );

      const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
      const logsNuvem = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (String(data.chaveLicenca || '').trim().toUpperCase() === chaveLicenca) {
          logsNuvem.push({ id: d.id, ...data });
        }
      });

      // Mescla nuvem + local sem duplicados, isolando estritamente pela licença atual
      const mapaIds = new Set();
      const todos = [];
      [...logsNuvem, ...logsLocais].forEach(l => {
        if (!l) return;
        const licLog = String(l.chaveLicenca || '').trim().toUpperCase();
        if (licLog && licLog !== chaveLicenca) return; // BLOQUEIA REGISTRO DE OUTRA LICENÇA!

        const key = l.id || `${l.tipo}_${l.criadoEm}_${l.descricao}`;
        if (!mapaIds.has(key)) {
          mapaIds.add(key);
          todos.push(l);
        }
      });

      todos.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
      return todos.slice(0, maxLogs);
    } catch(err) {
      console.warn('[AuditModule] Erro ao buscar logs na nuvem, retornando locais:', err);
      return logsLocais.slice(0, maxLogs);
    }
  }
};
