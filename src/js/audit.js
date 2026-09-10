/**
 * audit.js - Módulo de Auditoria e Logs de Atividades em Tempo Real (Master Sync)
 * Registra eventos críticos como exclusão de produtos, fechamento de caixa,
 * cancelamentos e importações em massa para consulta no Painel Master.
 */

import { StorageService } from './storage.js';
import { db, doc, collection, addDoc, setDoc, getDoc, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, deleteDoc, writeBatch, garantirSessaoLoja } from './firebase-config.js';

export const AuditModule = {
  ultimoErroNuvem: '',
  consultaNuvemOk: false,
  ultimoCursorSub: null,
  temMaisNuvem: false,
  totalNuvem: 0,
  TAMANHO_PAGINA: 100,
  DOC_EXCLUSAO: '__exclusao',

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

      const exclusao = await this.lerExclusaoNuvem(chave);
      this.purgarPendentesExcluidos(exclusao);
      const restantes = [];
      for (const item of pendentes) {
        const limpo = this.limparParaFirestore(item);
        if (!limpo || !limpo.id) continue;
        if (this.logFoiExcluidoNaNuvem(limpo, exclusao)) continue;
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

  ehDocMeta(id) {
    return String(id || '').startsWith('__');
  },

  async lerExclusaoNuvem(chave) {
    const c = String(chave || this.getChaveLicencaAtual() || '').trim();
    if (!c || c === 'LOCAL') return null;
    try {
      const snap = await getDoc(doc(db, 'backups_lojas', c, 'auditoria', this.DOC_EXCLUSAO));
      if (!snap || !snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (e) {
      return null;
    }
  },

  async registrarExclusaoNuvem(chave, patch = {}) {
    const c = String(chave || '').trim();
    if (!c || c === 'LOCAL') return;
    const agora = new Date().toISOString();
    const prev = await this.lerExclusaoNuvem(c) || {};
    const soIds = Array.isArray(patch.ids) && patch.dias == null && !patch.apagarTudo;
    const payload = {
      id: this.DOC_EXCLUSAO,
      tipo: '__meta',
      chaveLicenca: c,
      criadoEm: '1970-01-01T00:00:00.000Z',
      em: soIds ? (prev.em || agora) : agora,
      dias: patch.dias != null ? patch.dias : (prev.dias || 0),
      corteMs: patch.corteMs != null ? patch.corteMs : (Number(prev.corteMs) || 0),
      apagarTudo: patch.apagarTudo != null ? Boolean(patch.apagarTudo) : Boolean(prev.apagarTudo),
      ids: [...new Set([...(prev.ids || []), ...(patch.ids || [])].filter(Boolean))].slice(-400)
    };
    try {
      await setDoc(doc(db, 'backups_lojas', c, 'auditoria', this.DOC_EXCLUSAO), payload);
    } catch (e) {
      console.warn('[AuditModule] Não gravou o recado de exclusão para os outros caixas:', e);
    }
  },

  logFoiExcluidoNaNuvem(log, exclusao) {
    if (!log || !exclusao) return false;
    if (this.ehDocMeta(log.id)) return true;
    const ids = exclusao.ids || [];
    if (log.id && ids.includes(log.id)) return true;
    const emMs = Date.parse(exclusao.em || '') || 0;
    const ms = this.dataDoLogMs(log);
    if (exclusao.apagarTudo) {
      if (!emMs) return true;
      if (!Number.isFinite(ms) || ms <= 0) return true;
      return ms <= emMs;
    }
    const corte = Number(exclusao.corteMs) || 0;
    if (!Number.isFinite(ms) || ms <= 0) return false;
    return corte > 0 && emMs > 0 && ms >= corte && ms <= emMs;
  },

  purgarPendentesExcluidos(exclusao) {
    if (!exclusao) return;
    const restantes = this.getPendentes().filter((item) => !this.logFoiExcluidoNaNuvem(item, exclusao));
    this.salvarPendentes(restantes);
  },

  reconciliarLocaisComNuvem(logsNuvem, logsLocais, exclusao) {
    const idsNuvem = new Set((logsNuvem || []).map((l) => l && l.id).filter(Boolean));
    const idsPendentes = new Set(this.getPendentes().map((p) => p && p.id).filter(Boolean));
    const maisAntigoNuvem = (logsNuvem || []).reduce((min, l) => {
      const ms = this.dataDoLogMs(l);
      if (!ms) return min;
      return min === null ? ms : Math.min(min, ms);
    }, null);

    return (logsLocais || []).filter((l) => {
      if (!l) return false;
      if (this.logFoiExcluidoNaNuvem(l, exclusao)) return false;
      if (idsPendentes.has(l.id)) return true;
      if (idsNuvem.has(l.id)) return true;
      if (!(logsNuvem || []).length) return false;
      const ms = this.dataDoLogMs(l);
      if (maisAntigoNuvem && ms >= maisAntigoNuvem) return false;
      return true;
    });
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
      this.consultaNuvemOk = false;
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
      const logsSub = [];
      const logsLegado = [];
      let snapSub = null;
      (snapshots || []).forEach((snapshot, idx) => {
        if (idx === 0) snapSub = snapshot;
        (snapshot || { forEach() {} }).forEach((d) => {
          if (!d || String(d.id || '').startsWith('__')) return;
          const item = { id: d.id, ...d.data() };
          if (idx === 0) logsSub.push(item);
          else logsLegado.push(item);
        });
      });

      if (snapSub && snapSub.docs && snapSub.docs.length) {
        this.ultimoCursorSub = snapSub.docs[snapSub.docs.length - 1];
        this.temMaisNuvem = snapSub.size >= pageSize;
      } else {
        this.temMaisNuvem = false;
      }

      this.consultaNuvemOk = true;
      const exclusao = cursor ? null : await this.lerExclusaoNuvem(chaveLicenca);
      if (exclusao) this.purgarPendentesExcluidos(exclusao);
      const subOk = Boolean(snapSub);
      const logsNuvem = (subOk ? logsSub : [...logsSub, ...logsLegado])
        .filter((l) => !this.logFoiExcluidoNaNuvem(l, exclusao));

      if (!cursor) {
        this.contarLogsNuvem(chaveLicenca).then((n) => {
          this.totalNuvem = Math.max(n || 0, logsNuvem.length);
          if (window.GerenciaModule && window.GerenciaModule.subAbaAtiva === 'auditoria') {
            window.GerenciaModule.renderAuditoriaFiltrada();
          }
        }).catch(() => {});
      }

      const locaisVivos = cursor
        ? []
        : this.reconciliarLocaisComNuvem(logsNuvem, logsLocais, exclusao);
      const todos = this.mesclarLogsUnicos(cursor ? [logsNuvem] : [logsNuvem, locaisVivos], chaveLicenca);
      if (!cursor) this.persistirLogsMesclados(todos);
      if (!this.totalNuvem) this.totalNuvem = Math.max(todos.length, logsNuvem.length);
      return todos;
    } catch (err) {
      console.warn('[AuditModule] Erro ao buscar logs na nuvem, retornando locais:', err);
      const timeout = String(err && err.message || '').includes('Timeout');
      this.consultaNuvemOk = false;
      this.ultimoErroNuvem = timeout
        ? ''
        : 'Não foi possível ler os logs da nuvem neste computador.';
      this.temMaisNuvem = false;
      if (!this.totalNuvem) this.totalNuvem = logsLocais.length;
      return logsLocais.slice(0, maxLogs);
    }
  },

  dataDoLogMs(log) {
    if (!log) return 0;
    const raw = log.criadoEm || log.dataHoraFormatada || 0;
    if (!raw) return 0;
    if (typeof raw === 'object') {
      if (typeof raw.toDate === 'function') {
        const d = raw.toDate();
        return d instanceof Date ? d.getTime() : 0;
      }
      if (typeof raw.seconds === 'number') return raw.seconds * 1000;
    }
    const s = String(raw).trim();
    const iso = Date.parse(s);
    if (Number.isFinite(iso) && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) return iso;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    return Number.isFinite(iso) ? iso : 0;
  },

  logEstaNoPeriodo(log, dias) {
    if (!dias) return true;
    const ms = this.dataDoLogMs(log);
    if (!Number.isFinite(ms) || ms <= 0) return false;
    const corte = Date.now() - (dias * 24 * 60 * 60 * 1000);
    return ms >= corte;
  },

  aplicarExclusaoLocal(soPeriodo) {
    const locaisAntes = this.getLocalLogs();
    const locaisNovos = locaisAntes.filter((l) => !soPeriodo(l));
    const removidosLocal = locaisAntes.length - locaisNovos.length;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(locaisNovos));
    } catch (e) {}
    this.salvarPendentes(this.getPendentes().filter((l) => !soPeriodo(l)));
    if (window.GerenciaModule && Array.isArray(window.GerenciaModule.logsAuditoriaCache)) {
      window.GerenciaModule.logsAuditoriaCache = window.GerenciaModule.logsAuditoriaCache.filter((l) => !soPeriodo(l));
    }
    return { locaisNovos, removidosLocal };
  },

  async apagarRefsEmLote(refs) {
    const lista = (refs || []).filter(Boolean);
    let apagados = 0;
    let falhas = 0;
    let ultimoErro = '';
    for (let i = 0; i < lista.length; i += 400) {
      const fatia = lista.slice(i, i + 400);
      try {
        const batch = writeBatch(db);
        fatia.forEach((ref) => batch.delete(ref));
        await batch.commit();
        apagados += fatia.length;
      } catch (err) {
        ultimoErro = (err && (err.code || err.message)) || String(err);
        for (const ref of fatia) {
          try {
            await deleteDoc(ref);
            apagados++;
          } catch (e2) {
            falhas++;
            ultimoErro = (e2 && (e2.code || e2.message)) || ultimoErro;
          }
        }
      }
    }
    return { apagados, falhas, ultimoErro };
  },

  async coletarRefsSubcolecao(chave, soPeriodo, dias) {
    const col = collection(db, 'backups_lojas', chave, 'auditoria');
    const refs = [];
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
      docs.forEach((d) => {
        if (this.ehDocMeta(d.id)) return;
        if (soPeriodo({ id: d.id, ...d.data() })) refs.push(d.ref);
      });
      const last = docs[docs.length - 1];
      if (!last) break;
      cursor = last;
      const lastMs = this.dataDoLogMs(last.data() || {});
      if (dias && Number.isFinite(lastMs) && lastMs > 0 && lastMs < corte) break;
      if (docs.length < 100) break;
    }
    return refs;
  },

  async coletarRefsLegado(chave, soPeriodo) {
    const refs = [];
    const chaves = [...new Set([chave, ...(this.getChavesConsulta ? this.getChavesConsulta() : [])].filter(Boolean))];
    for (const c of chaves) {
      try {
        const snapLeg = await getDocs(query(
          collection(db, 'auditoria_lojas'),
          where('chaveLicenca', '==', c),
          limit(400)
        ));
        (snapLeg.docs || []).forEach((d) => {
          if (soPeriodo({ id: d.id, ...d.data() })) refs.push(d.ref);
        });
      } catch (e) {
        console.warn('[AuditModule] Falha ao listar auditoria legado:', e);
      }
    }
    return refs;
  },

  async excluirLogNuvem(logId) {
    const chave = this.getChaveLicencaAtual();
    const id = String(logId || '').trim();
    if (!id || !chave || chave === 'LOCAL') return { ok: true, nuvem: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { ok: true, nuvem: 0 };
    }
    try {
      await garantirSessaoLoja(chave, { deviceId: StorageService.getDeviceId() });
    } catch (e) {}
    const refs = [];
    refs.push(doc(db, 'backups_lojas', chave, 'auditoria', id));
    try {
      const snapLeg = await getDocs(query(
        collection(db, 'auditoria_lojas'),
        where('chaveLicenca', '==', chave),
        where('id', '==', id),
        limit(20)
      ));
      (snapLeg.docs || []).forEach((d) => refs.push(d.ref));
    } catch (e) {}
    const res = await this.apagarRefsEmLote(refs);
    if (res.falhas === 0) {
      await this.registrarExclusaoNuvem(chave, { ids: [id] });
    }
    return {
      ok: res.falhas === 0,
      nuvem: res.apagados,
      falhas: res.falhas,
      erro: res.ultimoErro
    };
  },

  async excluirLogsPorPeriodo(dias) {
    const chave = this.getChaveLicencaAtual();
    const soPeriodo = (log) => this.logEstaNoPeriodo(log, dias);
    const offline = !chave || chave === 'LOCAL' || (typeof navigator !== 'undefined' && !navigator.onLine);

    if (offline) {
      const local = this.aplicarExclusaoLocal(soPeriodo);
      this.ultimoCursorSub = null;
      this.temMaisNuvem = false;
      return { local: local.removidosLocal, nuvem: 0, falhas: 0, erro: '' };
    }

    let autenticou = false;
    try {
      autenticou = await garantirSessaoLoja(chave, { deviceId: StorageService.getDeviceId() });
    } catch (e) {}
    if (!autenticou) {
      return {
        local: 0,
        nuvem: 0,
        falhas: 1,
        erro: 'Este terminal não autenticou na nuvem; os logs não foram apagados.'
      };
    }

    const refsSub = await this.coletarRefsSubcolecao(chave, soPeriodo, dias);
    const refsLeg = await this.coletarRefsLegado(chave, soPeriodo);
    const idsTela = ((window.GerenciaModule && window.GerenciaModule.logsAuditoriaCache) || [])
      .filter(soPeriodo)
      .map((l) => l && l.id)
      .filter(Boolean);
    idsTela.forEach((id) => refsSub.push(doc(db, 'backups_lojas', chave, 'auditoria', String(id))));
    const vistos = new Set();
    const refs = [...refsSub, ...refsLeg].filter((ref) => {
      const path = ref && ref.path;
      if (!path || vistos.has(path)) return false;
      vistos.add(path);
      return true;
    });
    const resNuvem = await this.apagarRefsEmLote(refs);

    if (resNuvem.falhas > 0 && resNuvem.apagados === 0) {
      return {
        local: 0,
        nuvem: 0,
        falhas: resNuvem.falhas,
        erro: 'A nuvem recusou a exclusão dos logs. Atualize o FlowPDV e tente de novo.'
      };
    }

    const local = this.aplicarExclusaoLocal(soPeriodo);
    await this.registrarExclusaoNuvem(chave, {
      dias: dias || 0,
      corteMs: dias ? (Date.now() - dias * 24 * 60 * 60 * 1000) : 0,
      apagarTudo: !dias,
      ids: idsTela.concat(refsSub.map((r) => r && r.id).filter(Boolean))
    });
    this.ultimoCursorSub = null;
    this.temMaisNuvem = false;
    this.ultimoErroNuvem = '';
    if (this.totalNuvem) {
      this.totalNuvem = Math.max(0, this.totalNuvem - (resNuvem.apagados || 0));
    }
    return {
      local: local.removidosLocal,
      nuvem: resNuvem.apagados,
      falhas: resNuvem.falhas,
      erro: resNuvem.ultimoErro
    };
  }
};
