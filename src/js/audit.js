/**
 * audit.js - Módulo de Auditoria e Logs de Atividades em Tempo Real (Master Sync)
 * Registra eventos críticos como exclusão de produtos, fechamento de caixa,
 * cancelamentos e importações em massa para consulta no Painel Master.
 */

import { StorageService } from './storage.js';
import { db, doc, collection, addDoc, setDoc, getDocs, query, where, orderBy, limit, garantirSessaoLoja } from './firebase-config.js';

export const AuditModule = {
  ultimoErroNuvem: '',

  getChaveLicencaAtual() {
    const lic = StorageService.getLicenca() || {};
    return (lic.chaveLicenca || lic.clienteId || 'LOCAL').trim().toUpperCase();
  },

  getChavesConsulta() {
    const lic = StorageService.getLicenca() || {};
    const chaves = [
      this.getChaveLicencaAtual(),
      String(lic.chaveLicenca || '').trim(),
      String(lic.clienteId || '').trim()
    ].filter(Boolean);
    return [...new Set(chaves)];
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

    this.salvarLogLocal(payload);
    this.enviarLogNuvem(payload, chaveLicenca, myDevId);
  },

  limparParaFirestore(valor) {
    if (valor === undefined || typeof valor === 'function') return undefined;
    if (valor === null) return null;
    if (typeof valor === 'number' && !Number.isFinite(valor)) return null;
    if (Array.isArray(valor)) {
      return valor.map((item) => this.limparParaFirestore(item)).filter((item) => item !== undefined);
    }
    if (valor && typeof valor === 'object') {
      const out = {};
      Object.keys(valor).forEach((chave) => {
        const limpo = this.limparParaFirestore(valor[chave]);
        if (limpo !== undefined) out[chave] = limpo;
      });
      return out;
    }
    return valor;
  },

  getPendentesKey() {
    return `flowpdv_logs_nuvem_pendentes_${this.getChaveLicencaAtual()}`;
  },

  getPendentes() {
    try {
      const lista = JSON.parse(localStorage.getItem(this.getPendentesKey()) || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  },

  salvarPendentes(lista) {
    try {
      localStorage.setItem(this.getPendentesKey(), JSON.stringify((lista || []).slice(0, 200)));
    } catch (e) {}
  },

  enfileirarPendente(payload) {
    const lista = this.getPendentes();
    if (lista.some((item) => item && item.id === payload.id)) return;
    lista.unshift(payload);
    this.salvarPendentes(lista);
  },

  enviarLogNuvem(payload, chaveLicenca, deviceId) {
    const copia = this.limparParaFirestore({ ...(payload || {}), chaveLicenca });
    if (!copia || !copia.id) return;
    this.enfileirarPendente(copia);
    setTimeout(() => {
      this.descarregarPendentes(chaveLicenca, deviceId);
    }, 0);
  },

  descarregando: false,

  async descarregarPendentes(chaveLicenca, deviceId) {
    const chave = String(chaveLicenca || this.getChaveLicencaAtual() || '').trim().toUpperCase();
    if (!chave || chave === 'LOCAL' || this.descarregando) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

    if (!localStorage.getItem(`flowpdv_logs_migrados_${chave}`)) {
      this.getLocalLogs().forEach((log) => {
        const limpo = this.limparParaFirestore(log);
        if (limpo && limpo.id) this.enfileirarPendente(limpo);
      });
      try { localStorage.setItem(`flowpdv_logs_migrados_${chave}`, '1'); } catch (e) {}
    }

    const pendentes = this.getPendentes();
    if (!pendentes.length) return true;

    this.descarregando = true;
    try {
      const autenticou = await garantirSessaoLoja(chave, { deviceId: deviceId || StorageService.getDeviceId() });
      if (!autenticou) {
        this.ultimoErroNuvem = 'Este terminal não autenticou na nuvem; o log ficou só neste computador.';
        return false;
      }

      if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
        try {
          const info = await window.electronAPI.getSystemInfo();
          if (info && info.hostname) {
            pendentes.forEach((item) => { item.hostname = info.hostname; });
          }
        } catch (e) {}
      }

      const restantes = [];
      for (const item of pendentes) {
        const limpo = this.limparParaFirestore(item);
        if (!limpo || !limpo.id) continue;
        try {
          await setDoc(doc(db, 'backups_lojas', chave, 'auditoria', String(limpo.id)), limpo);
          try {
            await addDoc(collection(db, 'auditoria_lojas'), limpo);
          } catch (eAdmin) {
            // Painel admin é secundário: o outro caixa já lê pela subcoleção da loja.
          }
        } catch (err) {
          console.warn('[AuditModule] Falha ao subir log, fica na fila:', err);
          this.ultimoErroNuvem = 'Não foi possível enviar o log para a nuvem.';
          restantes.push(limpo);
        }
      }
      this.salvarPendentes(restantes);
      if (!restantes.length) this.ultimoErroNuvem = '';
      return restantes.length === 0;
    } catch (err) {
      console.warn('[AuditModule] Erro ao descarregar logs pendentes:', err);
      this.ultimoErroNuvem = 'Não foi possível enviar o log para a nuvem.';
      return false;
    } finally {
      this.descarregando = false;
    }
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
      const eventosNuvem = ['fechamento_caixa', 'transferencia', 'liberacao'];
      if (eventosNuvem.includes(evento)) {
        this.enviarLogNuvem({ ...logs[logExistenteIdx] }, chaveLicenca, myDevId);
      }
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
      this.enviarLogNuvem(payload, chaveLicenca, myDevId);
    }
  },

  async consultarSubcolecaoLoja(chave) {
    const col = collection(db, 'backups_lojas', chave, 'auditoria');
    try {
      return await getDocs(query(col, orderBy('criadoEm', 'desc'), limit(150)));
    } catch (err) {
      console.warn('[AuditModule] Consulta da subcoleção sem orderBy:', err && (err.message || err));
      return getDocs(query(col, limit(150)));
    }
  },

  async consultarNuvemPorChave(chave) {
    const col = collection(db, "auditoria_lojas");
    try {
      return await getDocs(query(
        col,
        where("chaveLicenca", "==", chave),
        orderBy("criadoEm", "desc"),
        limit(150)
      ));
    } catch (err) {
      console.warn('[AuditModule] Consulta ordenada indisponível, tentando sem orderBy:', err && (err.message || err));
      return getDocs(query(
        col,
        where("chaveLicenca", "==", chave),
        limit(150)
      ));
    }
  },

  persistirLogsMesclados(logs) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify((logs || []).slice(0, 200)));
    } catch (e) {}
  },

  async buscarLogsAuditoria(maxLogs = 150) {
    const chaveLicenca = this.getChaveLicencaAtual();
    const logsLocais = this.getLocalLogs();
    this.ultimoErroNuvem = '';
    try {
      if (!chaveLicenca || chaveLicenca === 'LOCAL' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.ultimoErroNuvem = 'Este computador está offline; mostrando só os logs locais.';
        }
        return logsLocais.slice(0, maxLogs);
      }

      const autenticou = await garantirSessaoLoja(chaveLicenca, { deviceId: StorageService.getDeviceId() });
      if (!autenticou) {
        this.ultimoErroNuvem = 'Este terminal não autenticou na nuvem, então só vê os logs que ele mesmo gerou.';
        return logsLocais.slice(0, maxLogs);
      }

      await this.descarregarPendentes(chaveLicenca);

      const fetchPromise = (async () => {
        const snapshots = [];
        try {
          snapshots.push(await this.consultarSubcolecaoLoja(chaveLicenca));
        } catch (err) {
          console.warn('[AuditModule] Subcoleção de auditoria indisponível:', err && (err.message || err));
        }
        for (const chave of this.getChavesConsulta()) {
          try {
            snapshots.push(await this.consultarNuvemPorChave(chave));
          } catch (err) {
            console.warn('[AuditModule] Consulta ignorada para chave', chave, err && (err.message || err));
          }
        }
        return snapshots;
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de busca auditoria (8s)')), 8000)
      );

      const snapshots = await Promise.race([fetchPromise, timeoutPromise]);
      const logsNuvem = [];
      (snapshots || []).forEach((snapshot) => {
        snapshot.forEach((d) => {
          const data = d.data();
          logsNuvem.push({ id: d.id, ...data });
        });
      });

      const mapaIds = new Set();
      const todos = [];
      [...logsNuvem, ...logsLocais].forEach(l => {
        if (!l) return;
        const licLog = String(l.chaveLicenca || '').trim().toUpperCase();
        if (licLog && licLog !== chaveLicenca) return;

        const key = l.id || l.sessaoKey || `${l.tipo}_${l.criadoEm}_${l.descricao}`;
        if (!mapaIds.has(key)) {
          mapaIds.add(key);
          todos.push(l);
        }
      });

      todos.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
      const resultado = todos.slice(0, maxLogs);
      this.persistirLogsMesclados(resultado);
      return resultado;
    } catch(err) {
      console.warn('[AuditModule] Erro ao buscar logs na nuvem, retornando locais:', err);
      this.ultimoErroNuvem = 'Não foi possível ler os logs da nuvem neste computador.';
      return logsLocais.slice(0, maxLogs);
    }
  }
};
