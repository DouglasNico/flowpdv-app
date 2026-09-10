/**
 * audit.js - Módulo de Auditoria e Logs de Atividades em Tempo Real (Master Sync)
 * Registra eventos críticos como exclusão de produtos, fechamento de caixa,
 * cancelamentos e importações em massa para consulta no Painel Master.
 */

import { StorageService } from './storage.js';
import { db, doc, collection, addDoc, setDoc, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, deleteDoc, garantirSessaoLoja } from './firebase-config.js';

export const AuditModule = {
  ultimoErroNuvem: '',
  ultimoCursorSub: null,
  temMaisNuvem: false,
  totalNuvem: 0,
  TAMANHO_PAGINA: 100,

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

  async consultarSubcolecaoLoja(chave, { pageSize = 100, cursor = null } = {}) {
    const col = collection(db, 'backups_lojas', chave, 'auditoria');
    try {
      const q = cursor
        ? query(col, orderBy('criadoEm', 'desc'), startAfter(cursor), limit(pageSize))
        : query(col, orderBy('criadoEm', 'desc'), limit(pageSize));
      return await getDocs(q);
    } catch (err) {
      console.warn('[AuditModule] Consulta da subcoleção sem orderBy:', err && (err.message || err));
      return getDocs(query(col, limit(pageSize)));
    }
  },

  async consultarNuvemPorChave(chave, pageSize = 100) {
    const col = collection(db, "auditoria_lojas");
    try {
      return await getDocs(query(
        col,
        where("chaveLicenca", "==", chave),
        orderBy("criadoEm", "desc"),
        limit(pageSize)
      ));
    } catch (err) {
      console.warn('[AuditModule] Consulta ordenada indisponível, tentando sem orderBy:', err && (err.message || err));
      return getDocs(query(
        col,
        where("chaveLicenca", "==", chave),
        limit(pageSize)
      ));
    }
  },

  async contarLogsNuvem(chave) {
    let total = 0;
    try {
      const sub = await getCountFromServer(collection(db, 'backups_lojas', chave, 'auditoria'));
      total = Math.max(total, (sub.data() && sub.data().count) || 0);
    } catch (e) {}
    try {
      const leg = await getCountFromServer(query(collection(db, 'auditoria_lojas'), where('chaveLicenca', '==', chave)));
      if (!total) total = (leg.data() && leg.data().count) || 0;
    } catch (e) {}
    return total;
  },

  persistirLogsMesclados(logs) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify((logs || []).slice(0, 300)));
    } catch (e) {}
  },

  mesclarLogsUnicos(listas, chaveLicenca) {
    const mapaIds = new Set();
    const todos = [];
    listas.flat().forEach(l => {
      if (!l) return;
      const licLog = String(l.chaveLicenca || '').trim().toUpperCase();
      if (licLog && chaveLicenca && licLog !== chaveLicenca) return;
      const key = l.id || l.sessaoKey || `${l.tipo}_${l.criadoEm}_${l.descricao}`;
      if (!mapaIds.has(key)) {
        mapaIds.add(key);
        todos.push(l);
      }
    });
    todos.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
    return todos;
  },

  async buscarLogsAuditoria(maxLogs = 100, { cursor = null } = {}) {
    const pageSize = this.TAMANHO_PAGINA || 100;
    const chaveLicenca = this.getChaveLicencaAtual();
    const logsLocais = this.getLocalLogs();
    this.ultimoErroNuvem = '';
    if (!cursor) {
      this.ultimoCursorSub = null;
      this.temMaisNuvem = false;
    }

    try {
      if (!chaveLicenca || chaveLicenca === 'LOCAL' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          this.ultimoErroNuvem = 'Este computador está offline; mostrando só os logs locais.';
        }
        this.totalNuvem = logsLocais.length;
        this.temMaisNuvem = false;
        return logsLocais;
      }

      const autenticou = await garantirSessaoLoja(chaveLicenca, { deviceId: StorageService.getDeviceId() });
      if (!autenticou) {
        this.ultimoErroNuvem = 'Este terminal não autenticou na nuvem, então só vê os logs que ele mesmo gerou.';
        this.totalNuvem = logsLocais.length;
        this.temMaisNuvem = false;
        return logsLocais;
      }

      if (!cursor) await this.descarregarPendentes(chaveLicenca);

      const fetchPromise = (async () => {
        const snapshots = [];
        try {
          snapshots.push(await this.consultarSubcolecaoLoja(chaveLicenca, { pageSize, cursor }));
        } catch (err) {
          console.warn('[AuditModule] Subcoleção de auditoria indisponível:', err && (err.message || err));
        }
        if (!cursor) {
          for (const chave of this.getChavesConsulta()) {
            try {
              snapshots.push(await this.consultarNuvemPorChave(chave, pageSize));
            } catch (err) {
              console.warn('[AuditModule] Consulta ignorada para chave', chave, err && (err.message || err));
            }
          }
        }
        return snapshots;
      })();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de busca auditoria (12s)')), 12000)
      );

      const snapshots = await Promise.race([fetchPromise, timeoutPromise]);
      const logsNuvem = [];
      let snapSub = null;
      (snapshots || []).forEach((snapshot, idx) => {
        if (idx === 0) snapSub = snapshot;
        snapshot.forEach((d) => {
          logsNuvem.push({ id: d.id, ...d.data() });
        });
      });

      if (snapSub && snapSub.docs && snapSub.docs.length) {
        this.ultimoCursorSub = snapSub.docs[snapSub.docs.length - 1];
        this.temMaisNuvem = snapSub.size >= pageSize;
      } else {
        this.temMaisNuvem = false;
      }

      if (!cursor) {
        this.contarLogsNuvem(chaveLicenca).then((n) => {
          this.totalNuvem = Math.max(n || 0, logsNuvem.length, logsLocais.length);
          if (window.GerenciaModule && window.GerenciaModule.subAbaAtiva === 'auditoria') {
            window.GerenciaModule.renderAuditoriaFiltrada();
          }
        }).catch(() => {});
      }

      const todos = this.mesclarLogsUnicos(cursor ? [logsNuvem] : [logsNuvem, logsLocais], chaveLicenca);
      if (!cursor) this.persistirLogsMesclados(todos);
      if (!this.totalNuvem) this.totalNuvem = Math.max(todos.length, logsNuvem.length);
      return todos;
    } catch (err) {
      console.warn('[AuditModule] Erro ao buscar logs na nuvem, retornando locais:', err);
      this.ultimoErroNuvem = 'Não foi possível ler os logs da nuvem neste computador.';
      this.temMaisNuvem = false;
      this.totalNuvem = logsLocais.length;
      return logsLocais.slice(0, maxLogs);
    }
  },

  logEstaNoPeriodo(log, dias) {
    if (!dias) return true;
    const ms = new Date(log && (log.criadoEm || log.dataHoraFormatada) || 0).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return false;
    const corte = Date.now() - (dias * 24 * 60 * 60 * 1000);
    return ms >= corte;
  },

  async excluirLogsPorPeriodo(dias) {
    const chave = this.getChaveLicencaAtual();
    const soPeriodo = (log) => this.logEstaNoPeriodo(log, dias);

    const locaisAntes = this.getLocalLogs();
    const locaisNovos = locaisAntes.filter(l => !soPeriodo(l));
    const removidosLocal = locaisAntes.length - locaisNovos.length;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(locaisNovos));
    } catch (e) {}
    this.salvarPendentes(this.getPendentes().filter(l => !soPeriodo(l)));

    let apagadosNuvem = 0;
    if (!chave || chave === 'LOCAL' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { local: removidosLocal, nuvem: 0 };
    }

    try {
      await garantirSessaoLoja(chave, { deviceId: StorageService.getDeviceId() });
    } catch (e) {}

    const col = collection(db, 'backups_lojas', chave, 'auditoria');
    let cursor = null;
    let guard = 0;
    const corte = dias ? (Date.now() - dias * 24 * 60 * 60 * 1000) : 0;
    while (guard++ < 80) {
      let snap;
      try {
        snap = cursor
          ? await getDocs(query(col, orderBy('criadoEm', 'desc'), startAfter(cursor), limit(100)))
          : await getDocs(query(col, orderBy('criadoEm', 'desc'), limit(100)));
      } catch (e) {
        snap = await getDocs(query(col, limit(200)));
      }
      if (!snap || snap.empty) break;

      const docs = snap.docs || [];
      for (const d of docs) {
        if (soPeriodo({ id: d.id, ...d.data() })) {
          try {
            await deleteDoc(d.ref);
            apagadosNuvem++;
          } catch (err) {}
        }
      }

      const last = docs[docs.length - 1];
      if (!last) break;
      const lastMs = new Date((last.data() && last.data().criadoEm) || 0).getTime();
      cursor = last;
      if (dias && Number.isFinite(lastMs) && lastMs < corte) break;
      if (docs.length < 100) break;
    }

    try {
      const snapLeg = await getDocs(query(
        collection(db, 'auditoria_lojas'),
        where('chaveLicenca', '==', chave),
        limit(400)
      ));
      for (const d of snapLeg.docs) {
        if (soPeriodo({ id: d.id, ...d.data() })) {
          try {
            await deleteDoc(d.ref);
            apagadosNuvem++;
          } catch (err) {}
        }
      }
    } catch (e) {}

    this.ultimoCursorSub = null;
    this.temMaisNuvem = false;
    return { local: removidosLocal, nuvem: apagadosNuvem };
  }
};
