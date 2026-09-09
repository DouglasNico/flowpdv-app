/**
 * licenca.js - Motor de Licenciamento SaaS & Bloqueio Remoto
 */

import { StorageService } from './storage.js';
import { db, doc, getDoc, onSnapshot, setDoc, updateDoc, buscarLicencaNuvem, desvincularTerminalNuvem, garantirSessaoLoja } from './firebase-config.js';

export const LicencaModule = {
  modalAtivacaoAbertoManualmente: false,

  // Sem essa sessão o Firestore recusa tudo: é ela que prova para as regras
  // que este computador pertence a esta loja.
  async garantirSessaoNuvem(chaveOpcional) {
    const lic = StorageService.getLicenca() || {};
    const alvo = String(chaveOpcional || lic.chaveLicenca || lic.clienteId || '').trim().toUpperCase();
    if (!alvo) return false;
    return garantirSessaoLoja(alvo, { deviceId: StorageService.getDeviceId() });
  },
  init() {
    this.sincronizarComNuvem();
    this.iniciarOuvinteNuvemEmTempoReal();
    this.verificarStatusLicenca();

    // Sincronizar em tempo real a cada 15 segundos
    setInterval(() => {
      this.sincronizarComNuvem();
    }, 15000);

    // Atualizar relógio regressivo a cada 1 segundo
    setInterval(() => {
      this.verificarStatusLicenca();
    }, 1000);
  },

  async sincronizarComNuvem() {
    try {
      let localLic = StorageService.getLicenca() || {};
      const chave = (localLic.chaveLicenca || "").trim().toUpperCase();
      const cnpj = (localLic.cnpj || "").replace(/\D/g, '');
      const clienteId = (localLic.clienteId || "").trim().toUpperCase();

      if (!chave && !cnpj && !clienteId) {
        return false;
      }

      await this.garantirSessaoNuvem(chave || clienteId);

      let cloudData = null;
      let docIdFound = null;
      let buscaConcluidaComSucesso = false;

      // 1. Tentar busca direta por Document ID usando prioritariamente a Chave da Licença
      if (chave) {
        try {
          const snap = await getDoc(doc(db, "licencas", chave));
          buscaConcluidaComSucesso = true;
          if (snap && snap.exists()) {
            cloudData = snap.data();
            docIdFound = snap.id;
          }
        } catch (e) {
          console.log('[CloudLic] Direct doc get error:', e);
        }
      }

      // 2. Se não achou o documento pelo ID, consulta a Function (sem varrer a coleção no cliente)
      if (!cloudData && (chave || cnpj || clienteId)) {
        try {
          const res = await buscarLicencaNuvem({ chave, cnpj, clienteId });
          buscaConcluidaComSucesso = true;
          if (res && res.ok && res.licenca) {
            cloudData = res.licenca;
            docIdFound = res.licenca.id || res.licenca.docId || chave || clienteId;
          }
        } catch (e) {
          console.log('[CloudLic] buscarLicenca:', e);
        }
      }

      // 4. Se a busca no Firebase funcionou (com internet ativa) e a chave NÃO existe mais no banco de dados
      if (!cloudData && buscaConcluidaComSucesso && chave && navigator.onLine) {
        console.warn('[CloudLic] Licença ativa não existe no Firebase (cancelada/excluída):', chave);
        this.tratarLicencaExcluidaNuvem(chave);
        return false;
      }

      if (cloudData) {
        // Garantir que a chaveLicenca local nunca seja corrompida por outra empresa
        localLic.clienteId = cloudData.id || cloudData.clienteId || docIdFound || clienteId;
        localLic.chaveLicenca = chave || cloudData.chaveLicenca;
        localLic.docIdNuvem = docIdFound || chave;
        const cloudStatus = cloudData.status;
        if (cloudStatus === 'bloqueada') {
          localLic.status = 'bloqueada';
        } else if (cloudStatus && cloudStatus !== 'pendente_ativacao') {
          localLic.status = cloudStatus;
        } else {
          localLic.status = 'ativa';
        }

        if (cloudData.vencimento || cloudData.dataExpiracao) {
          const dataNuvem = cloudData.vencimento || cloudData.dataExpiracao;
          localLic.dataExpiracao = dataNuvem.includes('T') ? dataNuvem : dataNuvem + 'T23:59:59.000Z';
          localLic.vencimento = cloudData.vencimento || dataNuvem.split('T')[0];
        }
        if (cloudData.valorMensal) {
          localLic.valorMensal = cloudData.valorMensal;
        }
        localLic.razaoSocial = cloudData.nome || cloudData.razaoSocial || localLic.razaoSocial;
        localLic.cnpj = cloudData.documento || cloudData.cnpj || localLic.cnpj;
        localLic.icone = cloudData.icone || localLic.icone || "🍷";
        if (cloudData.logoUrl && cloudData.logoUrl.length > 5) {
          localLic.logoUrl = cloudData.logoUrl;
        }

        // Sincronizar Categorias Excluídas
        if (Array.isArray(cloudData.categoriasExcluidas) && StorageService.adicionarCategoriaExcluida) {
          cloudData.categoriasExcluidas.forEach(c => StorageService.adicionarCategoriaExcluida(c));
        }

        // Sincronizar Categorias
        let catsNuvem = cloudData.categorias || cloudData.categoriasLoja || cloudData.categorias_loja;
        if (typeof catsNuvem === 'string') {
          catsNuvem = catsNuvem.split(',').map(c => c.trim()).filter(c => c.length > 0);
        }
        if (Array.isArray(catsNuvem) && catsNuvem.length > 0) {
          const excluidas = (StorageService.getCategoriasExcluidas() || []).map(c => String(c).toLowerCase().trim());
          const categoriasAtuais = (StorageService.getCategorias() || []).filter(c => !excluidas.includes(String(c).toLowerCase().trim()));
          const catsNuvemFiltradas = catsNuvem.filter(c => !excluidas.includes(String(c).toLowerCase().trim()));

          const categoriasConsolidadas = [...catsNuvemFiltradas, ...categoriasAtuais].filter((cat, index, lista) =>
            lista.findIndex(item => item.toLowerCase() === cat.toLowerCase()) === index
          );

          if (categoriasConsolidadas.length > 0) {
            localLic.categorias = categoriasConsolidadas;
            StorageService.salvarCategorias(categoriasConsolidadas);
            if (window.EstoqueModule && typeof window.EstoqueModule.renderBarraCategorias === 'function') {
              window.EstoqueModule.renderBarraCategorias();
            }
          }
        }

        if (cloudData.ramoAtividade) {
          localLic.ramoAtividade = cloudData.ramoAtividade;
          StorageService.setRamoLicenca(cloudData.ramoAtividade);
        }
        if (cloudData.layoutPdv === 'classico' || cloudData.layoutPdv === 'moderno') {
          localLic.layoutPdv = cloudData.layoutPdv;
          if (window.App && typeof window.App.aplicarLayoutPdv === 'function') {
            window.App.aplicarLayoutPdv(cloudData.layoutPdv);
          }
        }
        if (cloudData.moduloComandas !== undefined) {
          localLic.moduloComandas = cloudData.moduloComandas;
          StorageService.saveLicenca(localLic);
          if (window.ComandasModule && typeof window.ComandasModule.setModoAtendimento === 'function') {
            window.ComandasModule.setModoAtendimento(cloudData.moduloComandas);
          }
        }
        if (cloudData.modulos && typeof cloudData.modulos === 'object') {
          localLic.modulos = cloudData.modulos;
          StorageService.setModulosLicenca(cloudData.modulos);
          if (window.EstoqueModule && typeof window.EstoqueModule.adaptarInterfaceSegmento === 'function') {
            window.EstoqueModule.adaptarInterfaceSegmento();
          }
        }

        if (cloudData.pinGerente) {
          const novoPin = String(cloudData.pinGerente).trim();
          localLic.pinGerente = novoPin;
          localStorage.setItem('flowpdv_pin_gerente', novoPin);

          try {
            const usuarios = StorageService.getUsuarios();
            const gerente = usuarios.find(u => u.cargo === 'gerente');
            if (gerente) {
              gerente.pin = novoPin;
              StorageService.saveUsuarios(usuarios);
              if (window.AuthModule && typeof window.AuthModule.renderTabelaOperadoresConfig === 'function') {
                window.AuthModule.renderTabelaOperadoresConfig();
              }
            }
          } catch(e) {}
        }

        StorageService.saveLicenca(localLic);

        const config = StorageService.getConfig() || {};
        if (localLic.razaoSocial) config.nomeEmpresa = localLic.razaoSocial;
        if (localLic.razaoSocial) config.nomeLoja = localLic.razaoSocial;
        if (localLic.cnpj) config.cnpj = localLic.cnpj;
        if (localLic.logoUrl) config.logoUrl = localLic.logoUrl;
        StorageService.saveConfig(config);

        if (window.App && typeof window.App.carregarConfiguracoes === 'function') {
          window.App.carregarConfiguracoes();
        }

        const isAuth = this.validarTerminalDispositivo(cloudData, docIdFound);
        this.verificarStatusLicenca();

        // Se este terminal JÁ ESTIVER registrado, apenas atualiza o hostname se necessário (NÃO auto-registra silenciosamente novos slots)
        try {
          const myDevId = StorageService.getDeviceId();
          let terminais = this.limparTerminaisDuplicados(cloudData.terminaisAtivos);
          const idxTerm = terminais.findIndex(t => t.id === myDevId);

          if (idxTerm >= 0) {
            this.getDadosTerminalAtual().then(infoTerminal => {
              const termAtual = terminais[idxTerm];
              if (!termAtual.hostname || termAtual.hostname !== infoTerminal.hostname) {
                terminais[idxTerm] = infoTerminal;
                const targetDocId = docIdFound || cloudData.chaveLicenca || chave;
                if (targetDocId) {
                  setDoc(doc(db, "licencas", targetDocId), { terminaisAtivos: terminais }, { merge: true }).catch(() => {});
                }
              }
            });
          }
        } catch(e) {}

        return isAuth;
      }
      return false;
    } catch (e) {
      console.log('[CloudLic] Sincronização cloud:', e);
      return false;
    }
  },

  async getDadosTerminalAtual() {
    const myDevId = StorageService.getDeviceId();
    let hostname = 'Computador Local';
    let username = 'Operador';
    let platform = 'win32';

    // 1. Priorizar o operador autenticado no FlowPDV (ex: Douglas Batista, Nicolas Oliveira)
    try {
      const salvo = sessionStorage.getItem('flowpdv_usuario_logado');
      if (salvo) {
        const u = JSON.parse(salvo);
        if (u && u.nome) username = u.nome;
      } else if (window.AuthModule && typeof window.AuthModule.getUsuario === 'function') {
        const u = window.AuthModule.getUsuario();
        if (u && u.nome && u.nome !== 'Operador Caixa') username = u.nome;
      }
    } catch(e) {}

    // 2. Obter Hostname da máquina Windows
    if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
      try {
        const info = await window.electronAPI.getSystemInfo();
        if (info) {
          if (info.hostname) hostname = info.hostname;
          if (info.username && username === 'Operador') username = info.username;
          if (info.platform) platform = info.platform;
        }
      } catch(e) {}
    }

    return {
      id: myDevId,
      hostname: hostname,
      usuario: username,
      sistema: platform === 'win32' ? 'Windows' : platform,
      ultimoAcesso: new Date().toISOString()
    };
  },

  async atualizarOperadorTerminalNuvem(nomeOperador) {
    try {
      if (!nomeOperador) return;
      const myDevId = StorageService.getDeviceId();
      let localLic = StorageService.getLicenca() || {};
      const chave = (localLic.chaveLicenca || "").trim().toUpperCase();
      const clienteId = (localLic.clienteId || "").trim().toUpperCase();
      const docIds = Array.from(new Set([chave, clienteId].filter(Boolean)));
      if (docIds.length === 0) return;

      await this.garantirSessaoNuvem(chave || clienteId);

      for (const tId of docIds) {
        try {
          const docRef = doc(db, "licencas", tId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() || {};
            let terminais = this.limparTerminaisDuplicados(data.terminaisAtivos);
            const idx = terminais.findIndex(t => t.id === myDevId);
            if (idx >= 0) {
              const termAtual = terminais[idx];
              terminais[idx] = { 
                ...termAtual, 
                usuario: nomeOperador, 
                ultimoAcesso: new Date().toISOString() 
              };
              await setDoc(docRef, { 
                terminaisAtivos: terminais,
                atualizadoEm: new Date().toISOString()
              }, { merge: true });
              console.log('[CloudLic] Operador vinculado ao terminal:', tId, nomeOperador);
            }
          }
        } catch (e) {}
      }
    } catch(e) {}
  },

  limparTerminaisDuplicados(terminais) {
    if (!Array.isArray(terminais)) return [];
    const mapa = new Map();
    terminais.forEach(t => {
      if (!t) return;
      const id = typeof t === 'string' ? t.trim() : (t.id ? String(t.id).trim() : '');
      if (!id) return;
      const obj = typeof t === 'string' 
        ? { id: id, hostname: 'Computador', ultimoAcesso: new Date().toISOString() } 
        : t;
      mapa.set(id, obj);
    });
    return Array.from(mapa.values());
  },

  isTerminalRegistrado(terminais, myDevId) {
    const unicos = this.limparTerminaisDuplicados(terminais);
    return unicos.some(t => t.id === myDevId);
  },

  validarTerminalDispositivo(cloudData, docId, exibirOverlay = true) {
    const lockTerminais = document.getElementById('lock-screen-terminais-overlay');
    if (!cloudData) return true;

    const limite = parseInt(cloudData.limiteTerminais) || 1;
    const terminaisUnicos = this.limparTerminaisDuplicados(cloudData.terminaisAtivos);
    const myDevId = StorageService.getDeviceId();
    const jaRegistrado = this.isTerminalRegistrado(terminaisUnicos, myDevId);

    // Se este dispositivo já está registrado na nuvem = liberado
    if (jaRegistrado) {
      if (lockTerminais) lockTerminais.classList.remove('active');
      return true;
    }

    // Vaga disponível calculada exclusivamente sobre os PCs ÚNICOS reais!
    if (terminaisUnicos.length < limite) {
      if (lockTerminais) lockTerminais.classList.remove('active');
      return true;
    }

    // LIMITE ATINGIDO: todos os slots ocupados por outros dispositivos
    if (exibirOverlay && lockTerminais) {
      const maxTag = document.getElementById('lock-terminais-max-tag');
      const msgTag = document.getElementById('lock-terminais-msg');
      if (maxTag) maxTag.textContent = `${limite} computador(es)`;
      if (terminaisUnicos.length === 0) {
        if (msgTag) msgTag.innerHTML = `⚠️ <strong>Terminal Desvinculado:</strong> Este computador foi desvinculado pelo administrador. Clique em <strong>Reconectar Este Computador</strong> abaixo para registrar o acesso.`;
      } else {
        if (msgTag) msgTag.innerHTML = `Esta licença permite o uso em até <strong style="color: #0284c7;">${limite} computador(es)</strong> simultâneo(s) (já existem <strong>${terminaisUnicos.length}</strong> computador(es) ativo(s) vinculado(s)).`;
      }
      lockTerminais.classList.add('active');
    }
    return false;
  },

  unsubLicenca: null,

  pararOuvinteNuvem() {
    if (typeof this.unsubLicenca === 'function') {
      try {
        this.unsubLicenca();
        console.log('[CloudLicListener] Ouvinte anterior de licença encerrado.');
      } catch (e) {}
      this.unsubLicenca = null;
    }
  },

  async atualizarCategoriasNuvem(categorias, categoriasExcluidas = null) {
    try {
      const localLic = StorageService.getLicenca() || {};
      const chave = (localLic.chaveLicenca || "").trim().toUpperCase();
      const clienteId = (localLic.clienteId || "").trim().toUpperCase();
      const targetDocId = localLic.docIdNuvem || chave || clienteId;
      if (!targetDocId) return;

      await this.garantirSessaoNuvem(chave || clienteId);

      const excluidas = Array.isArray(categoriasExcluidas) 
        ? categoriasExcluidas 
        : (StorageService.getCategoriasExcluidas() || []);

      const payload = {
        categorias: Array.isArray(categorias) ? categorias : (StorageService.getCategorias() || []),
        categoriasExcluidas: excluidas,
        atualizadoEm: new Date().toISOString()
      };

      await setDoc(doc(db, "licencas", targetDocId), payload, { merge: true });
      if (chave && chave !== targetDocId) {
        await setDoc(doc(db, "licencas", chave), payload, { merge: true });
      }
      console.log('[CloudLic] Categorias sincronizadas com Master com sucesso:', payload);
    } catch (e) {
      console.warn('[CloudLic] Erro ao sincronizar categorias com Master:', e);
    }
  },

  async iniciarOuvinteNuvemEmTempoReal() {
    this.pararOuvinteNuvem();

    try {
      let localLic = StorageService.getLicenca() || {};
      const chaveAtual = (localLic.chaveLicenca || "").trim().toUpperCase();
      const clienteIdAtual = (localLic.clienteId || "").trim().toUpperCase();
      const docId = chaveAtual || clienteIdAtual;

      if (!docId) return;

      await this.garantirSessaoNuvem(docId);

      console.log('[CloudLicListener] Iniciando ouvinte realtime exclusivo para:', docId);

      this.unsubLicenca = onSnapshot(doc(db, "licencas", docId), (snap) => {
        if (snap && snap.exists()) {
          const cloudData = snap.data();
          if (!cloudData) return;

          // GUARDA DE SEGURANÇA: Garantir que este evento ainda pertence à licença ativa no momento
          const licAgora = StorageService.getLicenca() || {};
          const chaveAgora = (licAgora.chaveLicenca || "").trim().toUpperCase();
          const chaveRecebida = (cloudData.chaveLicenca || snap.id).trim().toUpperCase();

          if (chaveAgora && chaveRecebida && chaveAgora !== chaveRecebida) {
            console.warn('[CloudLicListener] Evento descartado: pertence a outra chave (' + chaveRecebida + ' vs ' + chaveAgora + ')');
            return;
          }

          let lic = { ...licAgora };
          lic.clienteId = cloudData.id || cloudData.clienteId || snap.id;
          lic.chaveLicenca = chaveAgora || chaveRecebida;
          lic.status = cloudData.status || lic.status || "ativa";
          lic.razaoSocial = cloudData.nome || cloudData.razaoSocial || lic.razaoSocial;
          lic.cnpj = cloudData.documento || cloudData.cnpj || lic.cnpj;
          lic.icone = cloudData.icone || lic.icone || "🍷";
          
          if (cloudData.vencimento || cloudData.dataExpiracao) {
            const dataNuvem = cloudData.vencimento || cloudData.dataExpiracao;
            lic.dataExpiracao = dataNuvem.includes('T') ? dataNuvem : dataNuvem + 'T23:59:59.000Z';
            lic.vencimento = cloudData.vencimento || dataNuvem.split('T')[0];
          }
          if (cloudData.valorMensal) {
            lic.valorMensal = cloudData.valorMensal;
          }
          if (cloudData.logoUrl && cloudData.logoUrl.length > 5) {
            lic.logoUrl = cloudData.logoUrl;
          }

          // Sincronizar Categorias em Tempo Real do Master
          if (Array.isArray(cloudData.categoriasExcluidas) && StorageService.adicionarCategoriaExcluida) {
            cloudData.categoriasExcluidas.forEach(c => StorageService.adicionarCategoriaExcluida(c));
          }

          let catsNuvemRealtime = cloudData.categorias || cloudData.categoriasLoja || cloudData.categorias_loja;
          if (typeof catsNuvemRealtime === 'string') {
            catsNuvemRealtime = catsNuvemRealtime.split(',').map(c => c.trim()).filter(c => c.length > 0);
          }
          if (Array.isArray(catsNuvemRealtime) && catsNuvemRealtime.length > 0) {
            const excluidas = (StorageService.getCategoriasExcluidas() || []).map(c => String(c).toLowerCase().trim());
            const catsFiltradas = catsNuvemRealtime
              .map(c => String(c).trim())
              .filter(c => c && !excluidas.includes(c.toLowerCase()))
              .filter((c, idx, arr) => arr.findIndex(x => x.toLowerCase() === c.toLowerCase()) === idx);

            if (catsFiltradas.length > 0) {
              const catsAtuais = StorageService.getCategorias() || [];
              const mudou = JSON.stringify(catsFiltradas) !== JSON.stringify(catsAtuais);
              if (mudou) {
                lic.categorias = catsFiltradas;
                StorageService.salvarCategorias(catsFiltradas);
                if (window.EstoqueModule && typeof window.EstoqueModule.renderBarraCategorias === 'function') {
                  window.EstoqueModule.renderBarraCategorias();
                }
                if (window.PdvModule && typeof window.PdvModule.renderBotoesCategorias === 'function') {
                  window.PdvModule.renderBotoesCategorias();
                }
                if (window.GerenciaModule && typeof window.GerenciaModule.renderGestaoCategorias === 'function') {
                  window.GerenciaModule.renderGestaoCategorias();
                }
                if (window.EstoqueModule && typeof window.EstoqueModule.preencherSelectCategorias === 'function') {
                  window.EstoqueModule.preencherSelectCategorias();
                }
              }
            }
          }

          if (cloudData.ramoAtividade) {
            lic.ramoAtividade = cloudData.ramoAtividade;
            StorageService.setRamoLicenca(cloudData.ramoAtividade);
          }
          if (cloudData.moduloComandas !== undefined) {
            lic.moduloComandas = cloudData.moduloComandas;
            StorageService.saveLicenca(lic);
            if (window.ComandasModule && typeof window.ComandasModule.setModoAtendimento === 'function') {
              window.ComandasModule.setModoAtendimento(cloudData.moduloComandas);
            }
          }
          if (cloudData.modulos && typeof cloudData.modulos === 'object') {
            lic.modulos = cloudData.modulos;
            StorageService.setModulosLicenca(cloudData.modulos);
            if (window.EstoqueModule && typeof window.EstoqueModule.adaptarInterfaceSegmento === 'function') {
              window.EstoqueModule.adaptarInterfaceSegmento();
            }
          }

          if (cloudData.pinGerente) {
            const novoPin = String(cloudData.pinGerente).trim();
            lic.pinGerente = novoPin;
            localStorage.setItem('flowpdv_pin_gerente', novoPin);

            try {
              const usuarios = StorageService.getUsuarios();
              const gerente = usuarios.find(u => u.cargo === 'gerente');
              if (gerente) {
                gerente.pin = novoPin;
                StorageService.saveUsuarios(usuarios);
              }
            } catch(e) {}
          }

          StorageService.saveLicenca(lic);
          this.validarTerminalDispositivo(cloudData, snap.id);
          this.verificarStatusLicenca();
        } else if (snap && !snap.exists()) {
          // A licença foi excluída da coleção no Firestore em tempo real!
          console.warn('[CloudLicListener] Snapshot indica licença excluída da nuvem:', docId);
          this.tratarLicencaExcluidaNuvem(docId);
        }
      }, (err) => {
        console.log("[CloudLicListener] Realtime listener error:", err);
      });
    } catch (e) {
      console.log("[CloudLicListener] Realtime setup error:", e);
    }
  },

  tratarLicencaExcluidaNuvem(chaveOuId) {
    let localLic = StorageService.getLicenca() || {};
    const chaveAtual = (localLic.chaveLicenca || "").trim().toUpperCase();
    const clienteIdAtual = (localLic.clienteId || "").trim().toUpperCase();

    if (chaveAtual && (chaveAtual === chaveOuId || clienteIdAtual === chaveOuId)) {
      console.warn('[CloudLic] A licença ativa foi cancelada/excluída no servidor:', chaveOuId);
      
      localLic.status = 'bloqueada';
      localLic.motivoBloqueio = 'excluida';
      localLic.dataExpiracao = '1970-01-01T00:00:00.000Z';
      localLic.vencimento = '1970-01-01';
      StorageService.saveLicenca(localLic);

      this.verificarStatusLicenca();

      const lockScreen = document.getElementById('lock-screen-overlay');
      if (lockScreen) {
        lockScreen.classList.add('active');
        this.renderTelaBloqueio(localLic);
      }
    }
  },

  verificarStatusLicenca() {
    const lic = StorageService.getLicenca();
    const modalAtivacao = document.getElementById('modal-ativacao-sistema');

    // Se o usuário abriu o modal manualmente para trocar a chave, NÃO fechar nem interferir!
    if (this.modalAtivacaoAbertoManualmente) {
      return;
    }

    // Só mostra o modal de boas-vindas se NÃO tiver chave de licença de forma alguma
    const semChave = !lic || !lic.chaveLicenca || lic.chaveLicenca.trim().length === 0;
    if (semChave) {
      const tituloEl = document.getElementById('ativacao-modal-titulo');
      const descEl = document.getElementById('ativacao-modal-desc');
      const btnConfirmar = document.getElementById('ativacao-btn-confirmar');
      if (tituloEl) tituloEl.textContent = 'Ativação de Licença FlowPDV';
      if (descEl) descEl.innerHTML = 'Para começar a usar seu sistema de frente de caixa e estoque, digite a <strong>Chave de Licença</strong> ou o <strong>CNPJ</strong> fornecido pelo suporte para ativar este computador:';
      if (btnConfirmar) btnConfirmar.innerHTML = '🚀 Ativar e Entrar no Sistema';
      if (modalAtivacao) modalAtivacao.classList.add('active');
      return;
    }

    // Tem chave — garante modal fechado apenas se não foi aberto manualmente
    if (modalAtivacao && !this.modalAtivacaoAbertoManualmente) {
      modalAtivacao.classList.remove('active');
    }

    const agora = new Date();
    const dataExpStr = lic.dataExpiracao || lic.vencimento || '';
    let expiraEm;
    if (dataExpStr.includes('T')) {
      expiraEm = new Date(dataExpStr);
    } else if (dataExpStr.includes('-')) {
      const parts = dataExpStr.split('-');
      expiraEm = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
    } else {
      expiraEm = new Date(dataExpStr);
    }

    if (isNaN(expiraEm.getTime())) {
      expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() - 1);
    }

    const diffMs = expiraEm.getTime() - agora.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Verificar se vence hoje (mesmo dia, mês e ano) e ainda tem tempo restante
    const isHoje = diffMs > 0 && (
      expiraEm.getDate() === agora.getDate() &&
      expiraEm.getMonth() === agora.getMonth() &&
      expiraEm.getFullYear() === agora.getFullYear()
    );

    // Formatar contador regressivo (HH:MM:SS)
    let tempoRestanteFormatado = '';
    if (diffMs > 0) {
      const totalSeg = Math.floor(diffMs / 1000);
      const horas = Math.floor(totalSeg / 3600);
      const mins = Math.floor((totalSeg % 3600) / 60);
      const segs = totalSeg % 60;
      tempoRestanteFormatado = `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    }

    const badgeEl = document.getElementById('header-license-badge');
    const lockScreen = document.getElementById('lock-screen-overlay');
    const alertBanner = document.getElementById('license-warning-banner');

    if (badgeEl) {
      if (lic.status === 'bloqueada') {
        badgeEl.className = 'license-badge danger';
        badgeEl.innerHTML = `🛑 Licença Bloqueada`;
      } else if (isHoje) {
        badgeEl.className = 'license-badge warning';
        badgeEl.innerHTML = `⏳ Vence Hoje: <strong>${tempoRestanteFormatado}</strong>`;
      } else if (diffDias > 3) {
        badgeEl.className = 'license-badge';
        badgeEl.title = `Licença ativa — vence em ${diffDias} dias`;
        badgeEl.innerHTML = `<span class="license-status-icon">🟢</span> <span class="license-status-days">${diffDias} dias</span>`;
      } else if (diffDias === 1) {
        badgeEl.className = 'license-badge warning';
        badgeEl.innerHTML = `⚠️ Vence em 1 dia`;
      } else if (diffDias > 0) {
        badgeEl.className = 'license-badge warning';
        badgeEl.innerHTML = `⚠️ Vence em ${diffDias} dias`;
      } else {
        badgeEl.className = 'license-badge danger';
        badgeEl.innerHTML = `🛑 Licença Vencida`;
      }
    }

    if (alertBanner) {
      if (isHoje) {
        alertBanner.style.display = 'flex';
        alertBanner.innerHTML = `
          <span>⚠️ <strong>Atenção:</strong> Sua licença vence <strong>HOJE</strong> às 23:59. Tempo restante: <strong style="font-family: 'JetBrains Mono'; font-size: 13px; color: #b91c1c; background: #fee2e2; padding: 2px 8px; border-radius: 4px; border: 1px solid #fca5a5;">${tempoRestanteFormatado}</strong>. Efetue o pagamento para evitar o bloqueio.</span>
          <button type="button" class="btn-primary-action" style="padding: 4px 10px; height: 28px; font-size: 11px;" onclick="LicencaModule.abrirModalPagamentoLicenca()">Ver Chave PIX</button>
        `;
      } else if (diffDias <= 3 && diffDias > 0) {
        alertBanner.style.display = 'flex';
        alertBanner.innerHTML = `
          <span>⚠️ <strong>Aviso de Mensalidade:</strong> Sua licença vence em <strong>${diffDias} dias</strong> (${expiraEm.toLocaleDateString('pt-BR')}). Efetue o pagamento para evitar o bloqueio automático.</span>
          <button type="button" class="btn-primary-action" style="padding: 4px 10px; height: 28px; font-size: 11px;" onclick="LicencaModule.abrirModalPagamentoLicenca()">Ver Chave PIX</button>
        `;
      } else {
        alertBanner.style.display = 'none';
      }
    }

    const diasTolerancia = lic.diasTolerancia || 2;
    if (lic.status === 'bloqueada' || diffDias <= -diasTolerancia) {
      if (lockScreen) {
        lockScreen.classList.add('active');
        this.renderTelaBloqueio(lic);
      }
    } else {
      if (lockScreen) {
        lockScreen.classList.remove('active');
      }
    }
  },

  renderTelaBloqueio(lic) {
    const pixKeyEl = document.getElementById('lock-pix-key');
    const whatsappLink = document.getElementById('lock-whatsapp-btn');
    const valorEl = document.getElementById('lock-valor-mensal');
    const nomeEl = document.getElementById('lock-nome-loja');
    const descEl = document.querySelector('#lock-screen-overlay .lock-desc');
    const tituloEl = document.querySelector('#lock-screen-overlay .lock-title');

    if (lic && lic.motivoBloqueio === 'excluida') {
      if (tituloEl) tituloEl.textContent = 'Licença Cancelada ou Inexistente';
      if (descEl) {
        descEl.innerHTML = `A chave de licença <strong style="color: #0284c7; font-family: 'JetBrains Mono';">${lic.chaveLicenca || ''}</strong> foi <strong style="color: #ef4444;">cancelada ou excluída</strong> no servidor. Para continuar utilizando o sistema FlowPDV, ative este terminal com uma nova Chave de Licença válida ou entre em contato com o suporte:`;
      }
    } else {
      if (tituloEl) tituloEl.textContent = 'Acesso ao Sistema Bloqueado';
      if (descEl) {
        descEl.innerHTML = `A licença do estabelecimento <strong id="lock-nome-loja" style="color: var(--text-main);">${lic ? (lic.razaoSocial || 'Empresa') : 'Empresa'}</strong> está suspensa ou com a mensalidade pendente. Para reativar o acesso de vendas e estoque, realize o pagamento via PIX ou altere sua chave:`;
      }
    }

    if (nomeEl) nomeEl.textContent = (lic && lic.razaoSocial) ? lic.razaoSocial : 'Empresa';
    if (pixKeyEl) pixKeyEl.textContent = (lic && lic.chavePixSuporte && lic.chavePixSuporte !== '19999997777') ? lic.chavePixSuporte : '19989632127';
    if (valorEl) valorEl.textContent = `R$ ${((lic && lic.valorMensal) || 89.90).toFixed(2).replace('.', ',')}`;

    if (whatsappLink) {
      const numClean = ((lic && lic.whatsappSuporte && lic.whatsappSuporte !== '19999997777' && lic.whatsappSuporte !== '(19) 99999-7777') ? lic.whatsappSuporte : '19989632127').replace(/\D/g, '');
      const msg = encodeURIComponent(`Olá Douglas, preciso de suporte para liberar meu caixa da empresa "${(lic && lic.razaoSocial) || 'Empresa'}" (Chave: ${(lic && lic.chaveLicenca) || ''}).`);
      whatsappLink.href = `https://wa.me/55${numClean}?text=${msg}`;
    }
  },

  async ativarTerminal(chaveParam) {
    const input = document.getElementById('ativacao-chave-input');
    const erroEl = document.getElementById('ativacao-erro-msg');
    const btnAtivar = document.querySelector('#modal-ativacao-sistema .btn-primary-action');
    const chave = (chaveParam || (input ? input.value : '')).trim().toUpperCase();

    if (!chave) {
      if (erroEl) {
        erroEl.textContent = '⚠️ Digite a Chave de Licença ou CNPJ para ativar!';
        erroEl.style.display = 'block';
      }
      return;
    }

    if (btnAtivar) {
      btnAtivar.disabled = true;
      btnAtivar.innerHTML = '⏳ Validando e Ativando na Nuvem...';
    }

    let licEncontrada = null;
    const chaveClean = chave.replace(/\D/g, '');

    // A chave digitada vira sessão de loja: sem isso o Firestore nem devolve
    // o documento da licença.
    await this.garantirSessaoNuvem(chave);

    try {
      let snap = await getDoc(doc(db, "licencas", chave));
      if (snap && snap.exists()) {
        licEncontrada = { id: snap.id, docId: snap.id, ...snap.data() };
      } else {
        const res = await buscarLicencaNuvem({ chave, cnpj: chaveClean, clienteId: chave });
        if (res && res.ok && res.licenca) {
          licEncontrada = res.licenca;
        }
      }
    } catch (e) {
      console.log('[CloudLic] Erro Firestore:', e);
    }

    // Se a licença não foi encontrada na nuvem, NÃO ativa e não cria mock
    if (!licEncontrada) {
      if (btnAtivar) {
        btnAtivar.disabled = false;
        btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
      }
      if (erroEl) {
        erroEl.textContent = '❌ Chave de licença inválida ou não encontrada na nuvem. Verifique com o suporte.';
        erroEl.style.display = 'block';
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('❌ Chave de licença não encontrada!', 'error');
      }
      return;
    }

    if (licEncontrada) {
      // Validar terminal SEM disparar o lock overlay por cima do modal de ativação
      const authorized = this.validarTerminalDispositivo(licEncontrada, licEncontrada.docId, false);
      if (!authorized) {
        if (btnAtivar) {
          btnAtivar.disabled = false;
          btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
        }
        const limite = licEncontrada.limiteTerminais || 1;
        if (erroEl) {
          erroEl.innerHTML = '🛑 <strong>Limite de Computadores Atingido:</strong> Esta licença já está em uso em ' + limite + ' computador(es). Peça ao administrador para desvincular um computador ou adquirir mais acessos.';
          erroEl.style.display = 'block';
        }
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('🛑 Limite de computadores atingido (' + limite + ' máx)!', 'error');
        }
        return;
      }

      // Identificar se este terminal está trocando de licença/empresa
      const licAnterior = StorageService.getLicenca() || {};
      const chaveAnterior = (licAnterior.chaveLicenca || licAnterior.clienteId || '').trim().toUpperCase();
      const novaChaveFinal = (licEncontrada.chaveLicenca || licEncontrada.docId || chave).trim().toUpperCase();
      const isTrocaDeEmpresa = Boolean(chaveAnterior && novaChaveFinal && (chaveAnterior !== novaChaveFinal));

      // Registrar este terminal na nuvem da nova licença
      const infoTerminal = await this.getDadosTerminalAtual();
      const myDevId = infoTerminal.id;
      const limite = parseInt(licEncontrada.limiteTerminais) || 1;
      let terminais = this.limparTerminaisDuplicados(licEncontrada.terminaisAtivos);
      const jaRegistrado = this.isTerminalRegistrado(terminais, myDevId);

      if (jaRegistrado) {
        // Atualiza os dados da máquina caso tenha mudado hostname/acesso
        const idx = terminais.findIndex(t => t.id === myDevId);
        if (idx >= 0) terminais[idx] = infoTerminal;
      } else if (terminais.length < limite) {
        terminais.push(infoTerminal);
      }

      // 🛡️ DESVINCULAÇÃO UNIVERSAL ABSOLUTA:
      // O computador (myDevId) só pode pertencer à nova licença ativada.
      // Em qualquer outro documento da coleção 'licencas' no Firestore que contenha este terminal (myDevId),
      // removemos ele imediatamente para liberar a vaga na nuvem
      try {
        await desvincularTerminalNuvem({ deviceId: myDevId, chaveManter: novaChaveFinal });
      } catch (e) {
        console.warn('[Desvinculação] Falha ao limpar terminal em outras licenças:', e);
      }

      await this.garantirSessaoNuvem(novaChaveFinal);

      const docIds = Array.from(new Set([licEncontrada.docId, licEncontrada.chaveLicenca, licEncontrada.id, chave].filter(Boolean)));
      for (const tId of docIds) {
        try {
          const docRef = doc(db, 'licencas', tId);
          setDoc(docRef, { 
            terminaisAtivos: terminais,
            atualizadoEm: new Date().toISOString()
          }, { merge: true }).catch(e => console.log('[Ativação] Erro ao registrar terminal:', e));
        } catch(e) {}
      }

      const dataNuvem = licEncontrada.vencimento || licEncontrada.dataExpiracao;
      let dataExpiracaoFinal = '';
      if (dataNuvem) {
        dataExpiracaoFinal = dataNuvem.includes('T') ? dataNuvem : dataNuvem + 'T23:59:59.000Z';
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        dataExpiracaoFinal = d.toISOString();
      }

      // Validar status e vencimento da licença encontrada
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      let expiraEm = new Date(dataExpiracaoFinal);
      if (isNaN(expiraEm.getTime())) {
        expiraEm = new Date();
        expiraEm.setDate(expiraEm.getDate() - 1);
      }
      const diffDias = Math.ceil((expiraEm.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const diasTolerancia = licEncontrada.diasTolerancia || 2;
      const isBloqueada = licEncontrada.status === 'bloqueada';
      const isVencida = diffDias <= -diasTolerancia;

      if (isBloqueada) {
        if (btnAtivar) {
          btnAtivar.disabled = false;
          btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
        }
        if (erroEl) {
          erroEl.innerHTML = `🛑 <strong>Licença Bloqueada:</strong> O acesso da empresa "<strong>${licEncontrada.nome || licEncontrada.razaoSocial || 'Minha Loja'}</strong>" está suspenso pelo administrador.`;
          erroEl.style.display = 'block';
        }
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('🛑 Esta licença encontra-se bloqueada / suspensa!', 'error');
        }
        return;
      }

      if (isVencida) {
        if (btnAtivar) {
          btnAtivar.disabled = false;
          btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
        }
        if (erroEl) {
          erroEl.innerHTML = `⚠️ <strong>Licença Vencida:</strong> A licença da empresa "<strong>${licEncontrada.nome || licEncontrada.razaoSocial || 'Minha Loja'}</strong>" venceu em <strong>${expiraEm.toLocaleDateString('pt-BR')}</strong>. Renove a mensalidade com o administrador para liberar.`;
          erroEl.style.display = 'block';
        }
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast(`⚠️ Licença vencida em ${expiraEm.toLocaleDateString('pt-BR')}!`, 'warning');
        }
        return;
      }

      const novaLic = {
        clienteId: licEncontrada.id || licEncontrada.clienteId || ('CLI-' + chave.slice(-4)),
        cnpj: licEncontrada.documento || licEncontrada.cnpj || '12.345.678/0001-90',
        razaoSocial: licEncontrada.nome || licEncontrada.razaoSocial || 'Minha Loja',
        icone: licEncontrada.icone || '🍷',
        logoUrl: licEncontrada.logoUrl || '',
        status: licEncontrada.status || 'ativa',
        dataExpiracao: dataExpiracaoFinal,
        vencimento: dataNuvem ? dataNuvem.split('T')[0] : '',
        valorMensal: licEncontrada.valorMensal || 89.90,
        chavePixSuporte: '19989632127',
        whatsappSuporte: '(19) 98963-2127',
        diasTolerancia: 2,
        chaveLicenca: licEncontrada.chaveLicenca || chave,
        layoutPdv: licEncontrada.layoutPdv === 'classico' ? 'classico' : 'moderno',
        modulos: licEncontrada.modulos && typeof licEncontrada.modulos === 'object'
          ? licEncontrada.modulos
          : {}
      };

      // Sincronizar Categorias
      let catsNuvem = licEncontrada.categorias || licEncontrada.categoriasLoja || licEncontrada.categorias_loja;
      if (typeof catsNuvem === 'string') {
        catsNuvem = catsNuvem.split(',').map(c => c.trim()).filter(c => c.length > 0);
      }
      if (Array.isArray(catsNuvem) && catsNuvem.length > 0) {
        novaLic.categorias = catsNuvem;
        StorageService.salvarCategorias(catsNuvem);
      }

      if (licEncontrada.pinGerente) {
        novaLic.pinGerente = String(licEncontrada.pinGerente).trim();
        localStorage.setItem('flowpdv_pin_gerente', String(licEncontrada.pinGerente).trim());
      }

      if (chaveAnterior && isTrocaDeEmpresa) {
        console.log('[Ativação] Troca de empresa detectada. Salvando snapshot de segurança da empresa anterior:', chaveAnterior);
        if (!window.CloudSyncModule || typeof window.CloudSyncModule.salvarBackupGarantidoImediato !== 'function') {
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast('❌ Sincronização indisponível. Troca cancelada para proteger os dados.', 'error');
          }
          return;
        }
        try {
          const snapshotSalvo = await window.CloudSyncModule.salvarBackupGarantidoImediato(chaveAnterior);
          if (snapshotSalvo !== true) {
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast('❌ Não foi possível confirmar o backup da empresa anterior. Troca cancelada.', 'error');
            }
            return;
          }
        } catch(e) {
          console.warn('[Ativação] Erro ao salvar snapshot:', e);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast('❌ Erro ao salvar o backup da empresa anterior. Troca cancelada.', 'error');
          }
          return;
        }
      }

      // 🛡️ ISOLAMENTO TOTAL MULTI-TENANT: Limpa a base local e baixa dados da nova licença
      console.log('[Ativação] Limpando dados locais e vinculando à licença:', novaChaveFinal);
      StorageService.limparDadosLocaisParaNovaEmpresa(novaLic);
      if (window.CloudSyncModule) {
        await window.CloudSyncModule.trocarEmpresaSincronizacao(novaChaveFinal);
      }

      const config = StorageService.getConfig() || {};
      config.nomeEmpresa = novaLic.razaoSocial;
      config.nomeLoja = novaLic.razaoSocial;
      config.cnpj = novaLic.cnpj;
      if (novaLic.logoUrl) config.logoUrl = novaLic.logoUrl;
      StorageService.saveConfig(config);

      if (window.App && typeof window.App.aplicarLayoutPdv === 'function') {
        window.App.aplicarLayoutPdv(novaLic.layoutPdv);
      }

      if (window.App && typeof window.App.carregarConfiguracoes === 'function') {
        window.App.carregarConfiguracoes();
      }

      this.modalAtivacaoAbertoManualmente = false;
      const modalAtivacao = document.getElementById('modal-ativacao-sistema');
      if (modalAtivacao) modalAtivacao.classList.remove('active');

      const lockTerminais = document.getElementById('lock-screen-terminais-overlay');
      if (lockTerminais) lockTerminais.classList.remove('active');

      const lockScreen = document.getElementById('lock-screen-overlay');
      if (lockScreen && novaLic.status !== 'bloqueada') lockScreen.classList.remove('active');

      this.verificarStatusLicenca();
      this.iniciarOuvinteNuvemEmTempoReal();

      if (window.App && typeof window.App.entrarPorPerfil === 'function' && window.AuthModule && typeof window.AuthModule.getUsuario === 'function') {
        window.App.entrarPorPerfil(window.AuthModule.getUsuario());
      }

      if (window.App && typeof window.App.showToast === 'function') {
        if (isTrocaDeEmpresa) {
          window.App.showToast(`🏢 Licença alterada para "${novaLic.razaoSocial}"! Dados da empresa sincronizados.`, 'success');
        } else {
          window.App.showToast(`🚀 Sistema ativado com sucesso para "${novaLic.razaoSocial}"!`, 'success');
        }
      }

      if (btnAtivar) {
        btnAtivar.disabled = false;
        btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
      }
    } else {
      if (btnAtivar) {
        btnAtivar.disabled = false;
        btnAtivar.innerHTML = '🚀 Ativar e Entrar no Sistema';
      }
      if (erroEl) {
        erroEl.textContent = '❌ Chave de licença ou CNPJ não encontrado no sistema ou na nuvem.';
        erroEl.style.display = 'block';
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('❌ Chave de licença não encontrada na nuvem!', 'error');
      }
    }
  },

  async rechecarTerminaisNuvem() {
    const feedbackEl = document.getElementById('lock-terminais-inline-feedback');
    if (feedbackEl) {
      feedbackEl.style.display = 'block';
      feedbackEl.style.background = '#e0f2fe';
      feedbackEl.style.color = '#0369a1';
      feedbackEl.style.border = '1px solid #bae6fd';
      feedbackEl.innerHTML = '🔄 Consultando e autorizando terminal na nuvem...';
    }
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast('🔍 Verificando autorização na nuvem...', 'info');
    }

    let localLic = StorageService.getLicenca() || {};
    const chave = (localLic.chaveLicenca || "").trim().toUpperCase();
    const cnpj = (localLic.cnpj || "").replace(/\D/g, '');
    const clienteId = (localLic.clienteId || "").trim().toUpperCase();

    if (!chave && !cnpj && !clienteId) {
      this.abrirModalTrocarLicenca();
      return;
    }

    try {
      await this.garantirSessaoNuvem(chave || clienteId);

      let cloudData = null;
      if (chave) {
        const snap = await getDoc(doc(db, "licencas", chave));
        if (snap && snap.exists()) {
          cloudData = { docId: snap.id, ...snap.data() };
        }
      }
      if (!cloudData) {
        const res = await buscarLicencaNuvem({ chave, cnpj, clienteId });
        if (res && res.ok && res.licenca) {
          cloudData = { docId: res.licenca.id || res.licenca.docId, ...res.licenca };
        }
      }

      if (!cloudData) {
        if (feedbackEl) {
          feedbackEl.style.background = '#fee2e2';
          feedbackEl.style.color = '#b91c1c';
          feedbackEl.style.border = '1px solid #fca5a5';
          feedbackEl.innerHTML = '❌ Licença não encontrada na nuvem.';
        }
        return;
      }

      const limite = parseInt(cloudData.limiteTerminais) || 1;
      const infoTerminal = await this.getDadosTerminalAtual();
      const myDevId = infoTerminal.id;
      let terminais = this.limparTerminaisDuplicados(cloudData.terminaisAtivos);
      const jaRegistrado = this.isTerminalRegistrado(terminais, myDevId);

      if (jaRegistrado || terminais.length < limite) {
        if (jaRegistrado) {
          const idx = terminais.findIndex(t => t.id === myDevId);
          if (idx >= 0) terminais[idx] = infoTerminal;
        } else {
          terminais.push(infoTerminal);
        }
        const docsToUpdate = Array.from(new Set([cloudData.docId, cloudData.chaveLicenca, cloudData.id].filter(Boolean)));
        for (const tId of docsToUpdate) {
          try {
            const docRef = doc(db, 'licencas', tId);
            await setDoc(docRef, { 
              terminaisAtivos: terminais,
              atualizadoEm: new Date().toISOString()
            }, { merge: true });
          } catch(e) {}
        }
        if (feedbackEl) {
          feedbackEl.style.background = '#dcfce7';
          feedbackEl.style.color = '#15803d';
          feedbackEl.style.border = '1px solid #86efac';
          feedbackEl.innerHTML = '🎉 Liberado com sucesso! Entrando no sistema...';
        }
        if (window.App && typeof window.App.showToast === 'function') {
          window.App.showToast('🎉 Computador liberado com sucesso!', 'success');
        }
        setTimeout(() => {
          const lockTerminais = document.getElementById('lock-screen-terminais-overlay');
          if (lockTerminais) lockTerminais.classList.remove('active');
          if (feedbackEl) feedbackEl.style.display = 'none';
        }, 500);
        await this.sincronizarComNuvem();
        if (window.CloudSyncModule && typeof window.CloudSyncModule.sincronizacaoInicialAuto === 'function') {
          window.CloudSyncModule.sincronizacaoInicialAuto();
        }
        return;
      }

      // Limite atingido
      if (feedbackEl) {
        feedbackEl.style.background = '#fee2e2';
        feedbackEl.style.color = '#b91c1c';
        feedbackEl.style.border = '1px solid #fca5a5';
        feedbackEl.innerHTML = `🛑 Limite de ${limite} computador(es) atingido! (${terminais.length} em uso).`;
      }
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('🛑 Limite atingido! Peça ao administrador para desvincular um computador.', 'error');
      }
    } catch (err) {
      console.log('Erro ao rechecar:', err);
    }
  },

  abrirModalTrocarLicenca() {
    this.modalAtivacaoAbertoManualmente = true;
    const modal = document.getElementById('modal-ativacao-sistema');
    const input = document.getElementById('ativacao-chave-input');
    const erroEl = document.getElementById('ativacao-erro-msg');
    const tituloEl = document.getElementById('ativacao-modal-titulo');
    const descEl = document.getElementById('ativacao-modal-desc');
    const btnConfirmar = document.getElementById('ativacao-btn-confirmar');
    const lockTerminais = document.getElementById('lock-screen-terminais-overlay');

    if (tituloEl) tituloEl.textContent = 'Alterar Licença do Sistema';
    if (descEl) descEl.innerHTML = 'Digite a nova <strong>Chave de Licença</strong> ou <strong>CNPJ</strong> para vincular a este computador:';
    if (btnConfirmar) btnConfirmar.innerHTML = '💾 Salvar e Ativar Licença';

    if (erroEl) erroEl.style.display = 'none';
    if (input) {
      const lic = StorageService.getLicenca();
      input.value = lic ? (lic.chaveLicenca || '') : '';
      setTimeout(() => input.focus(), 150);
    }
    if (lockTerminais) lockTerminais.classList.remove('active');
    if (modal) modal.classList.add('active');
  },

  fecharModalAtivacao() {
    this.modalAtivacaoAbertoManualmente = false;
    const modal = document.getElementById('modal-ativacao-sistema');
    if (modal) modal.classList.remove('active');
    
    // Se a licença atual está bloqueada ou inválida, reabrir o lock screen
    const lic = StorageService.getLicenca();
    if (!lic || lic.status === 'bloqueada') {
      const lockScreen = document.getElementById('lock-screen-overlay');
      if (lockScreen && lic) {
        lockScreen.classList.add('active');
        this.renderTelaBloqueio(lic);
      }
    }
  },

  abrirModalPagamentoLicenca() {
    const lic = StorageService.getLicenca() || {};
    const modal = document.getElementById('modal-pagamento-licenca');
    const pixKeyEl = document.getElementById('renovacao-pix-key');
    const valorEl = document.getElementById('renovacao-valor-mensal');
    const whatsappLink = document.getElementById('renovacao-whatsapp-btn');
    const statusTxt = document.getElementById('renovacao-status-dias');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataExpStr = lic.dataExpiracao || lic.vencimento || '';
    let expiraEm = new Date(dataExpStr);
    if (isNaN(expiraEm.getTime())) expiraEm = new Date();
    const diffDias = Math.ceil((expiraEm.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (statusTxt) {
      statusTxt.textContent = diffDias > 0 
        ? `Sua licença vence em ${diffDias} dias (${expiraEm.toLocaleDateString('pt-BR')}).`
        : `Sua licença vence hoje (${expiraEm.toLocaleDateString('pt-BR')}).`;
    }

    if (pixKeyEl) pixKeyEl.textContent = (lic && lic.chavePixSuporte && lic.chavePixSuporte !== '19999997777') ? lic.chavePixSuporte : '19989632127';
    if (valorEl) valorEl.textContent = `R$ ${(lic.valorMensal || 89.90).toFixed(2).replace('.', ',')}`;

    if (whatsappLink) {
      const numClean = ((lic && lic.whatsappSuporte && lic.whatsappSuporte !== '19999997777' && lic.whatsappSuporte !== '(19) 99999-7777') ? lic.whatsappSuporte : '19989632127').replace(/\D/g, '');
      const msg = encodeURIComponent(`Olá Douglas, segue o comprovante de pagamento da mensalidade do FlowPDV da empresa "${lic.razaoSocial || 'Minha Loja'}" (Licença: ${lic.chaveLicenca || ''}).`);
      whatsappLink.href = `https://wa.me/55${numClean}?text=${msg}`;
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalPagamentoLicenca() {
    const modal = document.getElementById('modal-pagamento-licenca');
    if (modal) modal.classList.remove('active');
  },

  copiarChavePix(elementId = 'renovacao-pix-key') {
    const el = document.getElementById(elementId) || document.getElementById('lock-pix-key');
    const text = el ? el.textContent.trim() : '19989632127';
    navigator.clipboard.writeText(text).then(() => {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast('📋 Chave PIX copiada para a área de transferência!', 'success');
      }
    }).catch(() => {
      if (window.App && typeof window.App.showToast === 'function') {
        window.App.showToast(`Chave PIX: ${text}`, 'info');
      }
    });
  }
};
