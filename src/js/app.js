import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { PdvModule } from './pdv.js';
import { EstoqueModule } from './estoque.js';
import { CaixaModule } from './caixa.js';
import { ClientesModule } from './clientes.js';
import { LicencaModule } from './licenca.js';
import { ThermalPrintModule } from './thermal-print.js';
import { BackupModule } from './backup.js';
import { CloudSyncModule } from './cloud-sync.js';
import { AuditModule } from './audit.js';
import { GerenciaModule } from './gerencia.js';
import { FiscalModule } from './fiscal.js';
import { XmlImporterModule } from './xml-importer.js';
import { BalancaModule } from './balanca.js';
import { TefModule } from './tef.js';
import { EtiquetasModule } from './etiquetas.js';
import { ComandasModule } from './comandas.js';

export const App = {
  abaAtiva: 'pdv',

  init() {
    window.StorageService = StorageService;
    window.AuthModule = AuthModule;
    window.PdvModule = PdvModule;
    window.EstoqueModule = EstoqueModule;
    window.CaixaModule = CaixaModule;
    window.ClientesModule = ClientesModule;
    window.LicencaModule = LicencaModule;
    window.BackupModule = BackupModule;
    window.CloudSyncModule = CloudSyncModule;
    window.ThermalPrintModule = ThermalPrintModule;
    window.AuditModule = AuditModule;
    window.GerenciaModule = GerenciaModule;
    window.FiscalModule = FiscalModule;
    window.XmlImporterModule = XmlImporterModule;
    window.BalancaModule = BalancaModule;
    window.TefModule = TefModule;
    window.EtiquetasModule = EtiquetasModule;
    window.ComandasModule = ComandasModule;
    window.App = this;

    StorageService.init();
    AuthModule.init();
    PdvModule.init();
    EstoqueModule.init();
    CaixaModule.init();
    ClientesModule.init();
    GerenciaModule.init();
    FiscalModule.init();
    XmlImporterModule.init();
    BalancaModule.init();
    TefModule.init();
    EtiquetasModule.init();
    ComandasModule.init();
    LicencaModule.init();
    this.aplicarLayoutPdv(StorageService.getLicenca()?.layoutPdv);
    BackupModule.init();
    CloudSyncModule.init();

    this.bindNavegacao();
    this.bindAtalhosTeclado();
    this.bindMascarasTelefone();
    this.iniciarRelogioAoVivo();
    this.carregarConfiguracoes();
    this.iniciarAutoUpdaterListeners();
    this.verificarBoasVindasPosAtualizacao();
    this.atualizarPermissoesUsuario();
    this.verificarValidadesAoIniciar();
    this.sincronizarTelaSemBloqueio();

    if (window.electronAPI && typeof window.electronAPI.onSolicitarFechamento === 'function') {
      window.electronAPI.onSolicitarFechamento(() => {
        this.solicitarFechamentoApp();
      });
    }
    if (window.electronAPI && typeof window.electronAPI.onForcarOfflineESair === 'function') {
      window.electronAPI.onForcarOfflineESair(() => {
        this.confirmarFechamentoApp();
      });
    }
    window.addEventListener('pagehide', () => {
      if (window.LicencaModule && typeof window.LicencaModule.marcarTerminalOffline === 'function') {
        window.LicencaModule.marcarTerminalOffline();
      }
    });
  },

  aplicarLayoutPdv(layout) {
    const tabPdv = document.getElementById('tab-pdv');
    if (!tabPdv) return;
    const classico = layout === 'classico';
    tabPdv.classList.toggle('pdv-layout-classico', classico);
    document.body.classList.toggle('pdv-layout-classico', classico);
    
    const moderno = tabPdv.querySelector('.pdv-layout');
    const shell = document.getElementById('classic-pdv-shell');
    if (!moderno || !shell) return;

    if (classico) {
      moderno.style.display = 'none';
      shell.classList.add('active');
    } else {
      shell.classList.remove('active');
      moderno.style.display = '';
    }
  },

  entrarPorPerfil(usuario) {
    const ehGerente = usuario && (usuario.cargo === 'gerente' || usuario.cargo === 'superadmin' || usuario.cargo === 'admin');
    const licenca = StorageService.getLicenca() || {};
    if (!licenca.chaveLicenca || licenca.status === 'pendente_ativacao' || licenca.status === 'bloqueada') {
      return;
    }
    if (window.electronAPI && typeof window.electronAPI.definirTelaCheiaOperador === 'function') {
      window.electronAPI.definirTelaCheiaOperador(!ehGerente);
    } else if (!ehGerente && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (ehGerente && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    document.body.classList.toggle('pdv-operador-restrito', !ehGerente);

    // No modo Clássico: Gerente abre na Gerência ('gerencia') e Operador abre no PDV ('pdv')
    // No modo Moderno: Tanto Gerente quanto Operador abrem no Frente de Caixa F1 ('pdv')
    const isClassico = (licenca.layoutPdv === 'classico');
    const abaDestino = (isClassico && ehGerente) ? 'gerencia' : 'pdv';
    this.trocarAba(abaDestino);
  },

  verificarValidadesAoIniciar() {
    if (window.EstoqueModule && typeof window.EstoqueModule.verificarAlertasValidade === 'function') {
      window.EstoqueModule.verificarAlertasValidade(false);
    }
  },

  bindNavegacao() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        this.trocarAba(targetTab);
      });
    });
  },

  trocarAba(nomeAba) {
    if (window.AuthModule && typeof window.AuthModule.isGerente === 'function' && !window.AuthModule.isGerente() && nomeAba !== 'pdv') {
      return;
    }
    // Sempre que sair das abas protegidas, re-bloquear o acesso do operador
    if (this.abaAtiva === 'config' && nomeAba !== 'config') {
      this.configDesbloqueadaTemp = false;
    }
    if (this.abaAtiva === 'gerencia' && nomeAba !== 'gerencia') {
      this.gerenciaDesbloqueadaTemp = false;
    }

    const abaAnterior = this.abaAtiva;
    this.abaAtiva = nomeAba;
    this.sincronizarTelaSemBloqueio();

    // Atualizar botões do menu
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === nomeAba);
    });

    // Atualizar painéis
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${nomeAba}`);
    });

    if (abaAnterior === 'estoque' && nomeAba !== 'estoque' && window.EstoqueModule && typeof window.EstoqueModule.resetarFiltrosEstoque === 'function') {
      window.EstoqueModule.resetarFiltrosEstoque();
    }
    if (abaAnterior === 'gerencia' && nomeAba !== 'gerencia' && window.GerenciaModule && typeof window.GerenciaModule.resetarFiltrosGerencia === 'function') {
      window.GerenciaModule.resetarFiltrosGerencia();
    }

    // Refresh específico por tela
    if (nomeAba === 'pdv') {
      setTimeout(() => {
        PdvModule.focarInputLeitor();
      }, 50);
      setTimeout(() => {
        PdvModule.focarInputLeitor();
      }, 200);
    } else if (nomeAba === 'estoque') {
      const manterValidade = this._manterFiltroValidadeEstoque;
      this._manterFiltroValidadeEstoque = null;
      if (window.EstoqueModule && typeof window.EstoqueModule.resetarFiltrosEstoque === 'function') {
        window.EstoqueModule.resetarFiltrosEstoque();
      }
      if (manterValidade && manterValidade !== 'todos' && typeof EstoqueModule.setFiltroValidade === 'function') {
        EstoqueModule.setFiltroValidade(manterValidade);
      }
    } else if (nomeAba === 'caixa') {
      CaixaModule.renderStatusTurno();
      CaixaModule.renderHistoricoVendasTurno();
      CaixaModule.renderHistoricoTurnosFechados();
    } else if (nomeAba === 'clientes') {
      ClientesModule.renderTabelaClientes();
    } else if (nomeAba === 'comandas') {
      ComandasModule.abrirAba();
    } else if (nomeAba === 'gerencia') {
      if (abaAnterior !== 'gerencia' && window.GerenciaModule && typeof window.GerenciaModule.resetarFiltrosGerencia === 'function') {
        window.GerenciaModule.resetarFiltrosGerencia();
      }
      this.verificarAcessoGerencia();
    } else if (nomeAba === 'config') {
      this.verificarAcessoConfiguracoes();
    }
  },

  sincronizarTelaSemBloqueio() {
    const pdvNaTela = this.abaAtiva === 'pdv';
    if (window.electronAPI && typeof window.electronAPI.manterTelaAcordada === 'function') {
      window.electronAPI.manterTelaAcordada(pdvNaTela).catch(() => {});
    }
  },

  atualizarPermissoesUsuario() {
    const isGerente = !!(window.AuthModule && typeof window.AuthModule.isGerente === 'function' && window.AuthModule.isGerente());

    const navGerenciaBtn = document.getElementById('nav-btn-gerencia');
    if (navGerenciaBtn) {
      navGerenciaBtn.style.display = isGerente ? 'flex' : 'none';
    }

    const classicBtnAdmin = document.getElementById('classic-btn-painel-gerente');
    if (classicBtnAdmin) {
      classicBtnAdmin.style.display = isGerente ? 'inline-flex' : 'none';
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.dataset.tab === 'pdv') return;
      if (!isGerente) {
        btn.style.display = 'none';
      } else if (btn.id !== 'nav-btn-gerencia') {
        btn.style.display = 'flex';
      }
    });

    if (!isGerente && this.abaAtiva === 'gerencia') {
      this.trocarAba('pdv');
    }
  },

  bindAtalhosTeclado() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && window.PdvModule && window.PdvModule.ignorarProximoEnterGlobal) {
        window.PdvModule.ignorarProximoEnterGlobal = false;
        return;
      }

      // Bloquear atalhos globais se telas de bloqueio de segurança/ativação estiverem ativas
      const lockOverlay = document.getElementById('lock-screen-overlay');
      const lockTerminais = document.getElementById('lock-screen-terminais-overlay');
      const modalAtivacao = document.getElementById('modal-ativacao-sistema');
      const isBloqueado = (lockOverlay && lockOverlay.classList.contains('active')) ||
                          (lockTerminais && lockTerminais.classList.contains('active')) ||
                          (modalAtivacao && modalAtivacao.classList.contains('active'));

      if (isBloqueado) {
        if (e.key === 'Escape') {
          e.preventDefault();
          return;
        }
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) {
          if (e.key === 'Enter' && e.target.id === 'ativacao-chave-input') {
            e.preventDefault();
            LicencaModule.ativarTerminal();
          }
          return;
        }
        e.preventDefault();
        return;
      }

      // 0. Se o modal de PINPad / Coleta de CPF estiver ativo
      const modalPinpadCpf = document.getElementById('modal-tef-coleta-cpf');
      if (modalPinpadCpf && (modalPinpadCpf.style.display === 'flex' || modalPinpadCpf.classList.contains('active'))) {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          TefModule.digitarDigitoCpfPinpad(e.key);
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          TefModule.apagarDigitoCpfPinpad();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          TefModule.confirmarCpfPinpad();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          TefModule.recusarCpfPinpad();
          return;
        }
      }

      // 1. Se o modal de sucesso/impressão de venda estiver ativo
      const modalSucessoImpressao = document.getElementById('modal-sucesso-venda-impressao');
      if (modalSucessoImpressao && modalSucessoImpressao.style.display === 'flex') {
        if (e.key === 'Enter') {
          e.preventDefault();
          PdvModule.confirmarImpressaoVendaFinalizada();
          return;
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          PdvModule.confirmarImpressaoA4VendaFinalizada();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.fecharModalSucessoImpressao();
          return;
        }
      }

      // 2. Se o modal de confirmação custom estiver ativo
      const modalConfirmacaoCustom = document.getElementById('modal-confirmacao-custom');
      if (modalConfirmacaoCustom && modalConfirmacaoCustom.style.display === 'flex') {
        if (e.key === 'Enter') {
          e.preventDefault();
          const btnAcao = document.getElementById('modal-confirm-btn-acao');
          if (btnAcao) btnAcao.click();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          const btnCanc = document.getElementById('modal-confirm-btn-cancelar');
          if (btnCanc) btnCanc.click();
          return;
        }
      }

      // 2.5 Se o modal de confirmação de cancelamento de carrinho estiver ativo
      const modalCancelCarrinho = document.getElementById('modal-confirmar-cancelar-carrinho');
      if (modalCancelCarrinho && modalCancelCarrinho.classList.contains('active')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.confirmarCancelamentoCarrinho();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.fecharModalCancelarCarrinho();
          return;
        }
      }

      const modalPerguntaClube = document.getElementById('modal-pergunta-clube');
      if (modalPerguntaClube && modalPerguntaClube.classList.contains('active')) {
        // Ignora qualquer Enter imediato vindo da seleção do produto no F2 (< 350ms)
        if (Date.now() - (PdvModule._aberturaPerguntaClubeTimestamp || 0) < 350) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.responderPerguntaClube(true);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.responderPerguntaClube(false);
          return;
        }
      }

      // 2.8 Se o modal de pergunta de CPF na Nota estiver ativo:
      const modalPerguntaCpf = document.getElementById('modal-pergunta-cpf-nota');
      if (modalPerguntaCpf && modalPerguntaCpf.classList.contains('active')) {
        const fasePergunta = document.getElementById('cpf-nota-fase-pergunta');
        const isFasePergunta = fasePergunta && fasePergunta.style.display !== 'none';

        if (isFasePergunta) {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.responderPerguntaCpfNota(true);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.responderPerguntaCpfNota(false);
            return;
          }
        } else {
          // Fase 2: Digitação do CPF
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.confirmarCpfNotaDigitado();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.cancelarDigitacaoCpfNota();
            return;
          }
        }
      }

      // 2.9 Se modal de busca rápida [F2] estiver ativo, repassa teclado mesmo se input perder foco
      const modalBuscaF2 = document.getElementById('modal-busca-produtos');
      if (modalBuscaF2 && modalBuscaF2.classList.contains('active')) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Escape') {
          if (document.activeElement?.id !== 'busca-rapida-input') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.handleBuscaRapidaKeydown(e);
            return;
          }
        }
      }

      // 2.10 Se modal de reimpressão de cupons [F12] estiver ativo, repassa teclado mesmo se input perder foco
      const modalReimpressaoF12 = document.getElementById('modal-reimpressao-cupom-pdv');
      if (modalReimpressaoF12 && modalReimpressaoF12.classList.contains('active')) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
          if (document.activeElement?.id !== 'reimpressao-busca-input') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.handleReimpressaoKeydown(e);
            return;
          }
        }
      }

      // 3. ESC fecha o modal mais à frente (maior z-index / último aberto) ou cancela carrinho se nenhum modal aberto
      if (e.key === 'Escape') {
        const modaisAbertos = Array.from(document.querySelectorAll('.modal-overlay.active'));
        if (modaisAbertos.length > 0) {
          // Ordena pelo maior z-index para fechar SEMPRE o modal da frente primeiro!
          modaisAbertos.sort((a, b) => {
            const zA = parseInt(window.getComputedStyle(a).zIndex) || parseInt(a.style.zIndex) || 0;
            const zB = parseInt(window.getComputedStyle(b).zIndex) || parseInt(b.style.zIndex) || 0;
            return zB - zA;
          });

          const modalAberto = modaisAbertos[0];

          // Não fechar modais de segurança e login via ESC
          if (modalAberto.id === 'lock-screen-overlay' || 
              modalAberto.id === 'lock-screen-terminais-overlay' || 
              modalAberto.id === 'modal-ativacao-sistema' ||
              modalAberto.id === 'modal-login-operador') {
            e.preventDefault();
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          // Se for o modal de categoria rápida do XML, fecha através do módulo para resetar o estado
          if (modalAberto.id === 'modal-criar-categoria-rapida-xml' && window.XmlImporterModule) {
            window.XmlImporterModule.fecharModalCriarCategoriaRapida();
            window._ultimoModalFechadoTimestamp = Date.now();
            return;
          }

          // Se for o modal de busca rápida [F2], fecha através do método do PDV
          if (modalAberto.id === 'modal-busca-produtos' && window.PdvModule) {
            window.PdvModule.fecharBuscaProdutos();
            window._ultimoModalFechadoTimestamp = Date.now();
            return;
          }

          // Se for o modal de reimpressão de cupons [F12], fecha através do método do PDV
          if (modalAberto.id === 'modal-reimpressao-cupom-pdv' && window.PdvModule) {
            window.PdvModule.fecharModalReimpressaoCupom();
            window._ultimoModalFechadoTimestamp = Date.now();
            return;
          }

          modalAberto.classList.remove('active');
          window._ultimoModalFechadoTimestamp = Date.now();
          if (this.abaAtiva === 'pdv') {
            setTimeout(() => {
              PdvModule.focarInputLeitor();
            }, 50);
          }
          return;
        }

        if (this.abaAtiva === 'pdv') {
          // BLINDAGEM: se qualquer modal acabou de ser fechado nos últimos 400ms, jamais cancela o carrinho
          if (window._ultimoModalFechadoTimestamp && (Date.now() - window._ultimoModalFechadoTimestamp < 400)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          PdvModule.solicitarCancelarCarrinho();
          return;
        }
      }

      // 4. Se o modal de pagamento estiver ativo (100% TECLADO ISOLADO F1..F6)
      const modalPagamento = document.getElementById('modal-pagamento');
      if (modalPagamento && modalPagamento.classList.contains('active')) {
        const modalTipoVoucher = document.getElementById('modal-tipo-voucher');
        if (modalTipoVoucher && modalTipoVoucher.classList.contains('active')) {
          // Teclas numéricas 1 ou 2 (Refeição / Alimentação)
          const numKey = (e.code && e.code.startsWith('Digit')) ? parseInt(e.code.replace('Digit', ''), 10) :
                         (e.code && e.code.startsWith('Numpad')) ? parseInt(e.code.replace('Numpad', ''), 10) :
                         !isNaN(parseInt(e.key, 10)) ? parseInt(e.key, 10) : null;

          if (numKey !== null && numKey >= 1) {
            const index = numKey - 1;
            const opcoes = PdvModule.voucherTipoOpcoes || [];
            if (index < opcoes.length) {
              e.preventDefault();
              e.stopPropagation();
              PdvModule.confirmarTipoVoucherSelecionado(index);
              return;
            }
          }

          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.moverSelecaoTipoVoucher(-1);
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.moverSelecaoTipoVoucher(1);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.confirmarTipoVoucherSelecionado();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.fecharModalTipoVoucher();
            return;
          }
        }
        const modalVoucher = document.getElementById('modal-selecao-voucher');
        if (modalVoucher && modalVoucher.classList.contains('active')) {
          // Teclas numéricas 1..9 (VR, Alelo, Pluxee, Ticket, Outros)
          const numKey = (e.code && e.code.startsWith('Digit')) ? parseInt(e.code.replace('Digit', ''), 10) :
                         (e.code && e.code.startsWith('Numpad')) ? parseInt(e.code.replace('Numpad', ''), 10) :
                         !isNaN(parseInt(e.key, 10)) ? parseInt(e.key, 10) : null;

          if (numKey !== null && numKey >= 1) {
            const index = numKey - 1;
            const opcoes = PdvModule.voucherOpcoesAtuais || [];
            if (index < opcoes.length) {
              e.preventDefault();
              e.stopPropagation();
              PdvModule.confirmarVoucherSelecionado(index);
              return;
            }
          }

          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.moverSelecaoVoucher(-1);
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.moverSelecaoVoucher(1);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.confirmarVoucherSelecionado();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.fecharModalSelecaoVoucher();
            return;
          }
        }
        // Bloqueia qualquer vazamento para o leitor de código de barras
        const barcodeInput = document.getElementById('pdv-barcode-input');
        if (barcodeInput && document.activeElement === barcodeInput) {
          barcodeInput.blur();
        }
        const classicBarcodeInput = document.getElementById('classic-pdv-barcode-input');
        if (classicBarcodeInput && document.activeElement === classicBarcodeInput) {
          classicBarcodeInput.blur();
        }

        // ATALHOS DEDICADOS F1..F6 (Exclusivos desta tela de finalizar venda!)
        if (e.key === 'F1') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.selecionarFormaPagamento('Dinheiro');
          return;
        }
        if (e.key === 'F2') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.selecionarFormaPagamento('PIX');
          return;
        }
        if (e.key === 'F3') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.selecionarFormaPagamento('Débito');
          return;
        }
        if (e.key === 'F4') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.selecionarFormaPagamento('Crédito');
          return;
        }
        if (e.key === 'F5') {
          e.preventDefault();
          e.stopPropagation();
          if (document.getElementById('btn-forma-voucher')?.style.display !== 'none') {
            PdvModule.selecionarFormaPagamento('Voucher');
          }
          return;
        }
        if (e.key === 'F6') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.selecionarFormaPagamento('Fiado');
          return;
        }

        // ENTER: Lança o valor ou finaliza a venda
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.lancarValorPagamento();
          return;
        }

        // ESC: Cancela e volta ao carrinho sem perder os itens
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.fecharModalPagamento();
          return;
        }

        // DEL: Remove o último pagamento lançado
        if (e.key === 'Delete' || e.key === 'Del') {
          e.preventDefault();
          e.stopPropagation();
          PdvModule.removerUltimoPagamento();
          return;
        }

        // BACKSPACE: Se o campo de valor estiver vazio, desfaz o último pagamento
        if (e.key === 'Backspace') {
          const inputVal = document.getElementById('pag-valor-pago-input');
          if (document.activeElement === inputVal && (!inputVal.value || inputVal.value === '')) {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.removerUltimoPagamento();
            return;
          }
        }

        // Atalho 'E' para Valor Exato Restante
        if (e.key === 'e' || e.key === 'E') {
          const inputVal = document.getElementById('pag-valor-pago-input');
          if (document.activeElement !== inputVal) {
            e.preventDefault();
            e.stopPropagation();
            PdvModule.preencherValorExatoRestante();
            return;
          }
        }

        // Bloqueia qualquer outra tecla de função F1..F12 de acionar atalhos de fundo
        if (/^F[1-9]|F1[0-2]$/.test(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Se modal de abertura de caixa estiver ativo
      const modalAbrirCaixa = document.getElementById('modal-abrir-caixa');
      if (modalAbrirCaixa && modalAbrirCaixa.classList.contains('active')) {
        if (e.key === 'Enter') {
          e.preventDefault();
          CaixaModule.confirmarAberturaCaixa();
          return;
        }
      }

      // Se houver qualquer modal aberto, bloqueia atalhos F1 a F10 globais
      const algumModalAberto = document.querySelector('.modal-overlay.active');
      if (algumModalAberto) {
        if (/^F[1-9]|F1[0-2]$/.test(e.key)) {
          e.preventDefault();
          return;
        }
      }

      // Atalhos de função F1 a F11 globais (somente se nenhum modal estiver aberto)
      if (e.key === 'F1') {
        e.preventDefault();
        this.trocarAba('pdv');
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (this.abaAtiva !== 'pdv') this.trocarAba('pdv');
        PdvModule.abrirBuscaProdutos();
      } else if (e.key === 'F3') {
        e.preventDefault();
        this.trocarAba('estoque');
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (this.abaAtiva === 'comandas') {
          if (ComandasModule && ComandasModule.comandaAtivaId) {
            ComandasModule.transferirParaPdvCaixa(ComandasModule.comandaAtivaId);
          } else {
            this.showToast('Selecione uma mesa ou comanda primeiro!', 'warning');
          }
        } else {
          if (this.abaAtiva !== 'pdv') this.trocarAba('pdv');
          PdvModule.abrirModalPagamento();
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        this.trocarAba('caixa');
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (this.abaAtiva === 'pdv' && window.PdvModule && StorageService.isModuloAtivo('clubeFidelidade')) {
          window.PdvModule.abrirModalClubeFidelidade();
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (this.abaAtiva === 'pdv') {
          PdvModule.abrirModalCortesia();
        }
      } else if (e.key === 'Delete') {
        if (this.abaAtiva === 'pdv') {
          e.preventDefault();
          PdvModule.abrirModalCancelarItem();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (this.abaAtiva === 'pdv') {
          PdvModule.abrirModalDesconto();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        CaixaModule.realizarSangria();
      } else if (e.key === 'F10') {
        e.preventDefault();
        const turno = StorageService.getTurnoAtual();
        if (!turno) CaixaModule.abrirTurnoCaixa();
        else CaixaModule.fecharTurnoCaixa();
      } else if (e.key === 'F11') {
        // F11 nativo de Tela Cheia
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (this.abaAtiva === 'pdv') {
          PdvModule.abrirModalReimpressaoCupom();
        }
      } else if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        ThermalPrintModule.abrirGavetaDinheiro();
      }
    });
  },

  bindMascarasTelefone() {
    const formatar = (val) => {
      if (!val) return '';
      const digits = String(val).replace(/\D/g, '').slice(0, 11);
      if (digits.length === 0) return '';
      if (digits.length <= 2) return `(${digits}`;
      if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };

    const aplicar = (input) => {
      if (!input || input.dataset.hasPhoneMask) return;
      input.dataset.hasPhoneMask = 'true';
      input.setAttribute('maxlength', '15');
      input.addEventListener('input', (e) => {
        e.target.value = formatar(e.target.value);
      });
      if (input.value) input.value = formatar(input.value);
    };

    document.querySelectorAll('input[type="tel"], input[id*="tel"], input[id*="telefone"], input[id*="whatsapp"]').forEach(aplicar);
    const observer = new MutationObserver(() => {
      document.querySelectorAll('input[type="tel"], input[id*="tel"], input[id*="telefone"], input[id*="whatsapp"]').forEach(aplicar);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },


  configDesbloqueadaTemp: false,

  verificarAcessoConfiguracoes() {
    const overlay = document.getElementById('config-gerente-lock-overlay');
    const erroMsg = document.getElementById('config-gerente-erro-msg');
    const pinInput = document.getElementById('config-gerente-pin-input');

    if (erroMsg) erroMsg.style.display = 'none';

    if (AuthModule.isGerente() || this.configDesbloqueadaTemp) {
      if (overlay) overlay.style.display = 'none';
    } else {
      if (overlay) {
        overlay.style.display = 'flex';
        if (pinInput) {
          pinInput.value = '';
          setTimeout(() => pinInput.focus(), 150);
        }
      }
    }
  },

  desbloquearConfiguracoes() {
    const pinInput = document.getElementById('config-gerente-pin-input');
    const erroMsg = document.getElementById('config-gerente-erro-msg');
    const overlay = document.getElementById('config-gerente-lock-overlay');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (AuthModule.validarPinGerente(pin)) {
      this.configDesbloqueadaTemp = true;
      if (overlay) overlay.style.display = 'none';
      this.showToast('Configurações liberadas pelo Gerente!', 'success');
    } else {
      if (erroMsg) erroMsg.style.display = 'block';
      if (pinInput) {
        pinInput.select();
        pinInput.focus();
      }
    }
  },
    iniciarRelogioAoVivo() {
    const update = () => {
      const clocks = document.querySelectorAll('#header-live-clock, #pdv-live-clock, #footer-live-clock, #classic-clock, .live-clock');
      const timeStr = new Date().toLocaleTimeString('pt-BR');
      clocks.forEach(c => { c.textContent = timeStr; });
    };
    update();
    setInterval(update, 1000);
  },
  carregarConfiguracoes() {
    const cfg = StorageService.getConfig() || {};
    const lic = StorageService.getLicenca() || {};

    const nomeEmpresa = (lic && lic.razaoSocial) ? lic.razaoSocial : (cfg.nomeEmpresa || cfg.nomeLoja || 'FlowPDV');
    const cnpjEmpresa = (lic && lic.cnpj) ? lic.cnpj : (cfg.cnpj || '');

    // 1. Atualizar o Card de Identidade da Loja no PDV
    const brandNome = document.getElementById('pdv-brand-nome');
    const brandCnpj = document.getElementById('pdv-brand-cnpj');
    const brandIcon = document.getElementById('pdv-brand-icon');

    if (brandNome) brandNome.textContent = nomeEmpresa;
    if (brandCnpj) brandCnpj.textContent = cnpjEmpresa ? ('CNPJ: ' + cnpjEmpresa) : '';

    if (brandIcon) {
      const logo = (lic && lic.logoUrl) ? lic.logoUrl : ((cfg && cfg.logoUrl ? cfg.logoUrl : ''));
      if (logo && (logo.startsWith('http') || logo.startsWith('data:image'))) {
        brandIcon.innerHTML = `<img src="${logo}" alt="Logo da Empresa" class="pdv-brand-logo-img" style="max-width: 250px; max-height: 175px; width: auto; height: auto; object-fit: contain; border-radius: 14px; display: block; margin: auto; pointer-events: none; user-select: none;">`;
        const classicLogo = document.getElementById('classic-client-logo');
        if (classicLogo) {
          classicLogo.src = logo;
          classicLogo.style.display = 'block';
        }
      } else {
        brandIcon.innerHTML = `<span style="font-size: 56px; pointer-events: none; user-select: none; display: block; margin: 0 auto;">${(lic && lic.icone) ? lic.icone : ((cfg && cfg.icone ? cfg.icone : "🏪"))}</span>`;
        const classicLogo = document.getElementById('classic-client-logo');
        if (classicLogo) {
          classicLogo.src = 'src/assets/FlowPDV-Logo.png';
        }
      }
    }

    // 2. Atualizar os cards de Visualização Protegida na aba Configurações
    const dispNome = document.getElementById('cfg-display-nome');
    const dispCnpj = document.getElementById('cfg-display-cnpj');
    const dispTel = document.getElementById('cfg-display-telefone');
    const dispPix = document.getElementById('cfg-display-pix');
    const dispCidade = document.getElementById('cfg-display-cidade');
    const dispImp = document.getElementById('cfg-display-impressora');

    if (dispNome) dispNome.textContent = nomeEmpresa || 'Minha Loja';
    if (dispCnpj) dispCnpj.textContent = cnpjEmpresa || 'Não informado';
    if (dispTel) dispTel.textContent = cfg.telefone || 'Não informado';
    if (dispPix) dispPix.textContent = cfg.chavePix || 'Não informado';
    if (dispCidade) dispCidade.textContent = cfg.cidade || 'Não informado';
    if (dispImp) {
      const imp = cfg.impressora || 'Nenhuma';
      if (imp === '80mm') dispImp.textContent = '🖨️ Bobina 80mm';
      else if (imp === '58mm') dispImp.textContent = '🖨️ Bobina 58mm';
      else dispImp.textContent = '🚫 Sem Impressão';
    }



    // Atualizar rótulo da aba de Clientes na navegação superior
    const navClientesBtn = document.getElementById('nav-btn-clientes');
    if (navClientesBtn) {
      const span = navClientesBtn.querySelector('span');
      if (span) {
        span.textContent = '👥 Clientes';
      }
    }

    // 3. Atualizar inputs do modal (se existirem)
    const modalNome = document.getElementById('cfg-modal-nome-empresa');
    const modalCnpj = document.getElementById('cfg-modal-cnpj');
    const modalTel = document.getElementById('cfg-modal-telefone');
    const modalPix = document.getElementById('cfg-modal-chave-pix');
    const modalCidade = document.getElementById('cfg-modal-cidade');
    const modalImp = document.getElementById('cfg-modal-impressora');

    if (modalNome) modalNome.value = nomeEmpresa;
    if (modalCnpj) modalCnpj.value = cnpjEmpresa;
    if (modalTel) modalTel.value = cfg.telefone || '';
    if (modalPix) modalPix.value = cfg.chavePix || '';
    if (modalCidade) modalCidade.value = cfg.cidade || '';
    if (modalImp) modalImp.value = cfg.impressora || 'Nenhuma';

    const licBadgeEl = document.getElementById('cfg-license-key-badge');
    const licStatusEl = document.getElementById('cfg-license-status-text');

    // Atualizar badge de versão dinâmica
    const badgeEl = document.getElementById('cfg-current-version-badge');
    if (badgeEl && window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
      window.electronAPI.getAppVersion().then(ver => {
        if (ver) badgeEl.textContent = `v${ver}`;
      }).catch(() => {});
    }

    // Atualizar badge de Licença na tela de Configurações
    if (licBadgeEl) {
      licBadgeEl.textContent = (lic && lic.chaveLicenca && lic.chaveLicenca.trim().length > 0) ? lic.chaveLicenca : 'NÃO ATIVADO';
    }
    if (licStatusEl) {
      if (!lic || !lic.chaveLicenca || lic.chaveLicenca.trim().length === 0 || lic.status === 'pendente_ativacao') {
        licStatusEl.innerHTML = `Status: <strong style="color: #d97706;">Aguardando Ativação do Sistema</strong>`;
      } else {
        const hoje = new Date();
        let expiraEm = lic.dataExpiracao ? new Date(lic.dataExpiracao) : new Date(Date.now() + 30 * 86400000);
        const diffDias = Math.max(0, Math.ceil((expiraEm - hoje) / (1000 * 60 * 60 * 24)));
        const statusHtml = (lic.status === 'bloqueada')
          ? '<strong style="color: var(--accent-red, #dc2626);">Bloqueada</strong>'
          : `<strong style="color: #059669;">Ativa (${diffDias} dias)</strong>`;

        licStatusEl.innerHTML = `Empresa: <strong style="color: var(--text-main);">${nomeEmpresa}</strong> • Status: ${statusHtml}`;
      }
    }

    // Exibir dados deste terminal nas configurações
    const myDevId = StorageService.getDeviceId();
    const devIdEl = document.getElementById('cfg-device-id');
    const devHostEl = document.getElementById('cfg-device-hostname');
    if (devIdEl) devIdEl.textContent = myDevId;
    if (devHostEl) {
      if (window.electronAPI && typeof window.electronAPI.getSystemInfo === 'function') {
        window.electronAPI.getSystemInfo().then(info => {
          if (info && info.hostname) devHostEl.textContent = info.hostname;
        }).catch(() => {
          devHostEl.textContent = 'Computador Local';
        });
      } else {
        devHostEl.textContent = 'Computador Local';
      }
    }

    if (BackupModule && typeof BackupModule.atualizarStatusBackupUI === 'function') {
      BackupModule.atualizarStatusBackupUI();
    }

    if (window.FiscalModule && typeof window.FiscalModule.renderStatusFiscalDisplay === 'function') {
      window.FiscalModule.renderStatusFiscalDisplay();
    }
    if (window.BalancaModule && typeof window.BalancaModule.renderStatusBalancaDisplay === 'function') {
      window.BalancaModule.renderStatusBalancaDisplay();
    }
  },

  versaoDisponivelDownload: null,

  iniciarAutoUpdaterListeners() {
    if (!window.electronAPI) return;

    if (typeof window.electronAPI.onUpdaterMessage === 'function') {
      window.electronAPI.onUpdaterMessage((data) => {
        if (data && data.tipo === 'disponivel') {
          this.abrirModalNovaAtualizacao(data.versao);
        }
      });
    }

    if (typeof window.electronAPI.onDownloadProgress === 'function') {
      window.electronAPI.onDownloadProgress((prog) => {
        const percent = prog?.percent || 0;
        const bar = document.getElementById('modal-update-progress-bar');
        const percentEl = document.getElementById('modal-update-progress-percent');
        const titleEl = document.getElementById('modal-update-status-title');

        if (bar) bar.style.width = `${percent}%`;
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (titleEl) titleEl.textContent = `⏳ Baixando atualização (${percent}%)...`;
      });
    }

    if (typeof window.electronAPI.onUpdateDownloaded === 'function') {
      window.electronAPI.onUpdateDownloaded((data) => {
        const titleEl = document.getElementById('modal-update-status-title');
        const bar = document.getElementById('modal-update-progress-bar');
        const percentEl = document.getElementById('modal-update-progress-percent');
        const actionsGrid = document.getElementById('modal-update-actions-grid');

        if (bar) bar.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (titleEl) {
          titleEl.textContent = '🔄 Reiniciando o aplicativo...';
          titleEl.style.color = 'var(--accent-green)';
        }

        if (actionsGrid) {
          actionsGrid.style.display = 'none';
        }

        setTimeout(() => {
          if (window.electronAPI && typeof window.electronAPI.aplicarAtualizacaoAgora === 'function') {
            window.electronAPI.aplicarAtualizacaoAgora();
          } else {
            location.reload();
          }
        }, 800);
      });
    }
  },

  async verificarBoasVindasPosAtualizacao() {
    try {
      let currentVer = '1.0.1';
      if (window.electronAPI && typeof window.electronAPI.getAppVersion === 'function') {
        currentVer = await window.electronAPI.getAppVersion();
      }

      // Atualizar badge da tela de configurações
      const badge = document.getElementById('cfg-current-version-badge');
      if (badge) badge.textContent = `v${currentVer}`;

      const ultimaVersao = localStorage.getItem('flowpdv_versao_instalada');
      if (ultimaVersao && ultimaVersao !== currentVer) {
        // O app acabou de ser atualizado de uma versão anterior!
        const modalPos = document.getElementById('modal-pos-atualizacao');
        const tagPos = document.getElementById('pos-atualizacao-badge-versao');
        if (tagPos) tagPos.textContent = `v${currentVer} Oficial`;
        if (modalPos) modalPos.classList.add('active');
      }

      localStorage.setItem('flowpdv_versao_instalada', currentVer);
    } catch(e) {
      console.log('[BoasVindasUpdate]', e);
    }
  },

  fecharModalPosAtualizacao() {
    const modalPos = document.getElementById('modal-pos-atualizacao');
    if (modalPos) modalPos.classList.remove('active');
  },

  abrirModalNovaAtualizacao(versao) {
    this.versaoDisponivelDownload = versao;
    const modal = document.getElementById('modal-nova-atualizacao');
    const tag = document.getElementById('modal-update-tag-version');
    const progBox = document.getElementById('modal-update-progress-box');
    const bar = document.getElementById('modal-update-progress-bar');
    const percent = document.getElementById('modal-update-progress-percent');
    const actionsGrid = document.getElementById('modal-update-actions-grid');

    if (tag) tag.textContent = `v${versao} (Disponível)`;
    if (progBox) progBox.style.display = 'none';
    if (bar) bar.style.width = '0%';
    if (percent) percent.textContent = '0%';
    
    if (actionsGrid) {
      actionsGrid.style.display = 'grid';
      actionsGrid.innerHTML = `
        <button type="button" id="btn-modal-update-cancelar" class="btn-primary-action" style="background: #f1f5f9; color: var(--text-main); justify-content: center; height: 46px; font-size: 14px; font-weight: 700; border: 1px solid var(--border-card);" onclick="App.fecharModalNovaAtualizacao()">
          Lembrar Mais Tarde
        </button>
        <button type="button" id="btn-modal-acao-atualizar" class="btn-primary-action" style="background: #0284c7; color: #fff; justify-content: center; height: 46px; font-size: 14px; font-weight: 800; border: none; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);" onclick="App.iniciarDownloadAtualizacao()">
          ⬇️ Baixar e Atualizar
        </button>
      `;
    }

    if (modal) modal.classList.add('active');
  },

  fecharModalNovaAtualizacao() {
    const modal = document.getElementById('modal-nova-atualizacao');
    if (modal) modal.classList.remove('active');
  },

  async iniciarDownloadAtualizacao() {
    const progBox = document.getElementById('modal-update-progress-box');
    const statusTitle = document.getElementById('modal-update-status-title');
    const actionsGrid = document.getElementById('modal-update-actions-grid');
    const versao = this.versaoDisponivelDownload || '';

    if (progBox) progBox.style.display = 'block';
    if (actionsGrid) actionsGrid.style.display = 'none';
    if (statusTitle) {
      statusTitle.textContent = '⏳ Conectando e baixando arquivos...';
      statusTitle.style.color = 'var(--text-main)';
    }

    // Função para mostrar link de download manual
    const mostrarBaixarManual = (motivo) => {
      if (statusTitle) {
        statusTitle.textContent = motivo || '⚠️ Download automático indisponível.';
        statusTitle.style.color = '#d97706';
      }
      if (actionsGrid) {
        actionsGrid.style.display = 'grid';
        actionsGrid.innerHTML = `
          <div style="grid-column: span 2; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px 16px; font-size: 13px; color: #78350f; line-height: 1.7; text-align: center;">
            <div style="font-size: 22px; margin-bottom: 4px;">⬇️</div>
            <strong>Baixe a atualização manualmente:</strong><br>
            Instale por cima da versão atual e seus dados serão mantidos intactos.
            <br><br>
            <button type="button"
              style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; font-size: 13px; font-weight: 800; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(2,132,199,0.4);"
              onclick="if(window.electronAPI && window.electronAPI.openExternal){ window.electronAPI.openExternal('https://github.com/DouglasNico/flowpdv/releases/download/v${versao}/FlowPDV-Setup.exe'); } else { window.open('https://github.com/DouglasNico/flowpdv/releases/download/v${versao}/FlowPDV-Setup.exe'); }">
              ⬇️ Baixar FlowPDV v${versao}
            </button>
          </div>
        `;
      }
    };

    // Timeout de 15s — se nenhum evento download-progress disparar, o download travou
    let progressoRecebido = false;
    const timeoutTravar = setTimeout(() => {
      if (!progressoRecebido) {
        mostrarBaixarManual('⚠️ Download travado em 0%. Use o botão abaixo:');
      }
    }, 15000);

    // Listener de progresso — cancela o timeout assim que o primeiro evento chegar
    if (window.electronAPI && typeof window.electronAPI.onDownloadProgress === 'function') {
      window.electronAPI.onDownloadProgress((prog) => {
        if (!progressoRecebido && (prog?.percent || 0) > 0) {
          progressoRecebido = true;
          clearTimeout(timeoutTravar);
        }
      });
    }

    // Listener de erro de download
    if (window.electronAPI && typeof window.electronAPI.onUpdaterMessage === 'function') {
      window.electronAPI.onUpdaterMessage((data) => {
        if (data && data.tipo === 'erro') {
          clearTimeout(timeoutTravar);
          mostrarBaixarManual('❌ Erro no download automático. Use o botão abaixo:');
        }
      });
    }

    // Iniciar o download
    if (window.electronAPI && typeof window.electronAPI.iniciarDownloadAtualizacao === 'function') {
      const res = await window.electronAPI.iniciarDownloadAtualizacao();
      if (!res.success) {
        clearTimeout(timeoutTravar);
        mostrarBaixarManual('❌ Não foi possível iniciar o download. Use o botão abaixo:');
      } else {
        if (statusTitle) statusTitle.textContent = '⏳ Baixando... (aguarde)';
      }
    }
  },

  async verificarAtualizacoesManual() {
    const btn = document.getElementById('btn-checar-atualizacao');
    const statusEl = document.getElementById('cfg-update-status');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Verificando...';
    }
    if (statusEl) {
      statusEl.textContent = 'Consultando servidores de atualização...';
      statusEl.style.color = 'var(--text-muted)';
    }

    try {
      if (window.electronAPI && typeof window.electronAPI.checkForUpdates === 'function') {
        const res = await window.electronAPI.checkForUpdates();
        let currentVer = '1.0.1';
        if (typeof window.electronAPI.getAppVersion === 'function') {
          currentVer = await window.electronAPI.getAppVersion();
        }

        if (res && res.updateAvailable) {
          this.showToast(`🚀 Nova versão v${res.version} encontrada!`, 'success');
          if (statusEl) {
            statusEl.textContent = `🚀 Versão v${res.version} disponível para atualização!`;
            statusEl.style.color = 'var(--accent-green)';
          }
          this.abrirModalNovaAtualizacao(res.version);
        } else {
          const msg = res?.msg || `🟢 Você já está na versão mais recente (v${currentVer})!`;
          this.showToast(msg, 'success');
          if (statusEl) {
            statusEl.textContent = msg;
            statusEl.style.color = 'var(--accent-green)';
          }
        }
      } else {
        this.showToast('🟢 Modo de desenvolvimento ativo.', 'success');
      }
    } catch(err) {
      this.showToast('Não foi possível verificar atualizações agora.', 'warning');
      if (statusEl) {
        statusEl.textContent = 'Não foi possível verificar atualizações agora.';
        statusEl.style.color = 'var(--accent-amber)';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 Verificar Atualização';
      }
    }
  },

  confirmarAcao({ 
    titulo, 
    title,
    mensagem, 
    message,
    icone = '🗑️', 
    icon,
    textoConfirmar, 
    confirmText,
    textoCancelar, 
    cancelText,
    perigo = true, 
    corConfirmar,
    confirmColor,
    corIcone,
    bgIcone,
    onConfirm 
  }) {
    const titFinal = titulo || title || 'Confirmação';
    const msgFinal = mensagem || message || '';
    const iconeFinal = icon || icone;
    const txtConfirmarFinal = textoConfirmar || confirmText || (perigo ? '🗑️ Sim, Excluir [ENTER]' : '✅ Confirmar [ENTER]');
    const txtCancelarFinal = textoCancelar || cancelText || 'Cancelar [ESC]';
    const corBtn = corConfirmar || confirmColor;

    const modal = document.getElementById('modal-confirmacao-custom');
    const iconeEl = document.getElementById('modal-confirm-icone');
    const tituloEl = document.getElementById('modal-confirm-titulo');
    const msgEl = document.getElementById('modal-confirm-mensagem');
    const btnAcao = document.getElementById('modal-confirm-btn-acao');
    const btnCancelar = document.getElementById('modal-confirm-btn-cancelar');

    if (!modal) {
      if (window.confirm(msgFinal.replace(/<[^>]*>?/gm, ''))) {
        if (typeof onConfirm === 'function') onConfirm();
      }
      return;
    }

    if (iconeEl) {
      iconeEl.textContent = iconeFinal;
      if (bgIcone && corIcone) {
        iconeEl.style.background = bgIcone;
        iconeEl.style.color = corIcone;
        iconeEl.style.borderColor = corIcone;
        iconeEl.style.boxShadow = `0 4px 12px ${corIcone}33`;
      } else {
        iconeEl.style.background = perigo ? '#fef2f2' : '#f0fdf4';
        iconeEl.style.color = perigo ? '#ef4444' : '#16a34a';
        iconeEl.style.borderColor = perigo ? '#fee2e2' : '#bbf7d0';
        iconeEl.style.boxShadow = perigo ? '0 4px 12px rgba(239, 68, 68, 0.2)' : '0 4px 12px rgba(22, 163, 74, 0.2)';
      }
    }
    if (tituloEl) tituloEl.textContent = titFinal;
    if (msgEl) msgEl.innerHTML = msgFinal;
    if (btnCancelar) btnCancelar.textContent = txtCancelarFinal;

    if (btnAcao) {
      btnAcao.textContent = txtConfirmarFinal;
      if (corBtn) {
        btnAcao.style.background = corBtn.includes('gradient') ? corBtn : `linear-gradient(135deg, ${corBtn}, ${corBtn})`;
        btnAcao.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
      } else {
        btnAcao.style.background = perigo ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #0284c7, #0369a1)';
        btnAcao.style.boxShadow = perigo ? '0 4px 14px rgba(239, 68, 68, 0.35)' : '0 4px 14px rgba(2, 132, 199, 0.35)';
      }
      
      btnAcao.onclick = () => {
        this.fecharModalConfirmacao();
        if (typeof onConfirm === 'function') onConfirm();
      };
    }

    modal.style.display = 'flex';

    // Handler de teclado Enter e Esc para extrema agilidade
    const handleKeyConfirm = (e) => {
      if (modal.style.display !== 'flex') {
        window.removeEventListener('keydown', handleKeyConfirm);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('keydown', handleKeyConfirm);
        this.fecharModalConfirmacao();
        if (typeof onConfirm === 'function') onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('keydown', handleKeyConfirm);
        this.fecharModalConfirmacao();
      }
    };

    window.addEventListener('keydown', handleKeyConfirm);
  },

  confirmModal(opts) {
    return this.confirmarAcao(opts);
  },

  fecharModalConfirmacao() {
    const modal = document.getElementById('modal-confirmacao-custom');
    if (modal) modal.style.display = 'none';
  },

  solicitarFechamentoApp() {
    const modal = document.getElementById('modal-confirmar-sair');
    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    } else {
      if (confirm('🚪 Deseja realmente fechar o sistema FlowPDV?')) {
        this.confirmarFechamentoApp();
      }
    }
  },

  cancelarFechamentoApp() {
    const modal = document.getElementById('modal-confirmar-sair');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  },

  async confirmarFechamentoApp() {
    const modal = document.getElementById('modal-confirmar-sair');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }

    if (window.LicencaModule) window.LicencaModule.encerrandoApp = true;

    // Fechar automaticamente o turno de caixa ativo para manter conformidade contábil
    let turnoFechadoAoSair = null;
    try {
      const turnoAtual = StorageService.getTurnoAtual();
      if (turnoAtual && turnoAtual.status === 'aberto') {
        const resumo = CaixaModule.calcularResumoFinanceiro(turnoAtual) || {};
        turnoFechadoAoSair = {
          ...turnoAtual,
          ...resumo,
          dataFechamento: new Date().toISOString(),
          status: 'fechado',
          fechamentoAutomatico: true
        };
        StorageService.arquivarTurnoFechado(turnoFechadoAoSair);
      }
    } catch(err) {
      console.log('Fechamento de caixa no encerramento:', err);
    }

    try {
      const waits = [];
      if (turnoFechadoAoSair && window.CloudSyncModule && typeof window.CloudSyncModule.atualizarTurnoAtivoDoTerminal === 'function') {
        const chave = window.CloudSyncModule.getChaveLicenca ? window.CloudSyncModule.getChaveLicenca() : '';
        waits.push(window.CloudSyncModule.atualizarTurnoAtivoDoTerminal(
          chave,
          StorageService.getDeviceId(),
          turnoFechadoAoSair
        ));
      }
      if (window.LicencaModule && typeof window.LicencaModule.marcarTerminalOffline === 'function') {
        waits.push(window.LicencaModule.marcarTerminalOffline());
      }
      if (waits.length) await Promise.allSettled(waits);
    } catch (err) {
      console.log('Offline ao sair:', err);
    }

    if (window.electronAPI && typeof window.electronAPI.fecharAppConfirmado === 'function') {
      window.electronAPI.fecharAppConfirmado();
    } else {
      window.close();
    }
  },

  perfilPendenteTroca: 'gerente',

  abrirModalTrocarUsuario() {
    const modal = document.getElementById('modal-trocar-usuario');
    const erroMsg = document.getElementById('pin-login-erro-msg');
    const pinInput = document.getElementById('pin-login-input');

    if (erroMsg) erroMsg.style.display = 'none';
    if (pinInput) pinInput.value = '';
    
    this.selecionarPerfilTroca('gerente');
    if (modal) modal.classList.add('active');
  },

  fecharModalTrocarUsuario() {
    const modal = document.getElementById('modal-trocar-usuario');
    if (modal) modal.classList.remove('active');
  },

  selecionarPerfilTroca(cargo) {
    this.perfilPendenteTroca = cargo;
    const label = document.getElementById('pin-login-label');
    const pinInput = document.getElementById('pin-login-input');
    const erroMsg = document.getElementById('pin-login-erro-msg');

    if (erroMsg) erroMsg.style.display = 'none';
    if (label) {
      label.textContent = cargo === 'operador'
        ? 'Digite o PIN do Operador de Caixa:'
        : 'Digite o PIN de Acesso do Gerente:';
    }
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 100);
    }
  },

  confirmarPinLogin() {
    const pinInput = document.getElementById('pin-login-input');
    const erroMsg = document.getElementById('pin-login-erro-msg');
    const pin = pinInput ? pinInput.value.trim() : '';
    const cargoAlvo = this.perfilPendenteTroca || 'gerente';

    if (!pin) {
      if (erroMsg) {
        erroMsg.textContent = 'Digite o PIN de acesso.';
        erroMsg.style.display = 'block';
      }
      return;
    }

    const res = AuthModule.trocarUsuario(pin, cargoAlvo);
    if (res.success) {
      if (erroMsg) erroMsg.style.display = 'none';
      this.fecharModalTrocarUsuario();
      this.showToast('Perfil alterado com sucesso!', 'success');
    } else {
      if (erroMsg) {
        erroMsg.textContent = res.erro || 'PIN de acesso incorreto.';
        erroMsg.style.display = 'block';
      }
      if (pinInput) {
        pinInput.select();
        pinInput.focus();
      }
    }
  },

  confirmarZerarBancoDados() {
    this.confirmarAcao({
      titulo: '⚠️ ZERAR BANCO DE DADOS COMPLETO',
      mensagem: 'Deseja realmente zerar e limpar <strong>TODOS os produtos, clientes, vendas e históricos</strong> deste computador?<br><br><span style="color: #dc2626; font-weight: 700;">Esta ação deixará o sistema completamente vazio (0 produtos).</span>',
      icone: '⚠️',
      textoConfirmar: '💣 Sim, Zerar Tudo [ENTER]',
      textoCancelar: 'Cancelar [ESC]',
      perigo: true,
      onConfirm: () => {
        AuthModule.solicitarAutorizacaoGerente(() => {
          StorageService.saveProdutos([]);
          StorageService.saveClientes([]);
          StorageService.salvarHistoricoTurnos([]);
          localStorage.setItem('adega_vendas', JSON.stringify([]));
          localStorage.removeItem('adega_turno_atual');
          localStorage.removeItem('flowpdv_ultimo_backup_data');
          localStorage.removeItem('flowpdv_ultimo_backup_timestamp');

          if (window.CloudSyncModule) window.CloudSyncModule.enviarAlteracaoNuvem('zerar_banco');

          window.App.showToast('💣 Banco de dados local zerado com sucesso!', 'info');
          setTimeout(() => window.location.reload(), 1000);
        }, 'Zerar Banco de Dados Completo');
      }
    });
  },

  showToast(mensagem, tipo = 'info') {
    // Blindagem: não exibir nenhuma notificação toast apenas se o modal de login estiver visível na tela
    const loginModal = document.getElementById('modal-login-operador');
    if (loginModal && loginModal.classList.contains('active')) {
      return;
    }

    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    const bg = tipo === 'success' ? '#10b981' : (tipo === 'error' ? '#ef4444' : (tipo === 'warning' ? '#f59e0b' : '#3b82f6'));
    toast.style.cssText = 'background: ' + bg + '; color: #ffffff; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.25); pointer-events: auto;';
    toast.textContent = mensagem;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },
  gerenciaDesbloqueadaTemp: false,

  verificarAcessoGerencia() {
    const overlay = document.getElementById('gerencia-gerente-lock-overlay');
    const pinInput = document.getElementById('gerencia-gerente-pin-input');
    const erroMsg = document.getElementById('gerencia-gerente-erro-msg');

    if (erroMsg) erroMsg.style.display = 'none';

    if (AuthModule.isGerente() || this.gerenciaDesbloqueadaTemp) {
      if (overlay) overlay.style.display = 'none';
      if (window.GerenciaModule) GerenciaModule.renderSubAbaAtual();
    } else {
      if (overlay) overlay.style.display = 'flex';
      if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 150);
      }
    }
  },

  desbloquearGerencia() {
    const pinInput = document.getElementById('gerencia-gerente-pin-input');
    const erroMsg = document.getElementById('gerencia-gerente-erro-msg');
    const overlay = document.getElementById('gerencia-gerente-lock-overlay');
    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin) {
      if (erroMsg) {
        erroMsg.textContent = '⚠️ Digite o PIN de Acesso!';
        erroMsg.style.display = 'block';
      }
      return;
    }

    const pinGerente = String(
      localStorage.getItem('flowpdv_pin_gerente') || StorageService.getLicenca()?.pinGerente || ''
    ).trim();
    const usuarios = StorageService.getUsuarios() || [];
    const gerenteObj = usuarios.find(u => u.cargo === 'gerente' && String(u.pin).trim() === pin);

    if ((pinGerente && pin === pinGerente) || gerenteObj) {
      this.gerenciaDesbloqueadaTemp = true;
      if (overlay) overlay.style.display = 'none';
      if (erroMsg) erroMsg.style.display = 'none';
      if (window.GerenciaModule) GerenciaModule.renderSubAbaAtual();
      this.showToast('👑 Acesso à Gerência liberado com sucesso!', 'success');
    } else {
      if (erroMsg) {
        erroMsg.textContent = '❌ PIN de acesso incorreto!';
        erroMsg.style.display = 'block';
      }
      if (pinInput) {
        pinInput.select();
        pinInput.focus();
      }
    }
  },

  abrirModalEditarConfigLoja() {
    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') 
      ? window.AuthModule.isGerente() 
      : true;

    if (!isGerente) {
      if (window.AuthModule && typeof window.AuthModule.solicitarAutorizacaoGerente === 'function') {
        window.AuthModule.solicitarAutorizacaoGerente('editar_config', () => {
          this._exibirModalConfigLoja();
        });
        return;
      }
    }

    this._exibirModalConfigLoja();
  },

  _exibirModalConfigLoja() {
    this.carregarConfiguracoes();
    const modal = document.getElementById('modal-editar-config-loja');
    if (modal) {
      modal.style.display = 'flex';



      const inputNome = document.getElementById('cfg-modal-nome-empresa');
      if (inputNome) {
        setTimeout(() => {
          inputNome.focus();
          inputNome.select();
        }, 100);
      }
    }
  },

  fecharModalEditarConfigLoja() {
    const modal = document.getElementById('modal-editar-config-loja');
    if (modal) modal.style.display = 'none';
  },

  salvarConfiguracoesModal(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const nomeEmpresa = document.getElementById('cfg-modal-nome-empresa')?.value.trim() || 'Minha Loja';
    const cnpj = document.getElementById('cfg-modal-cnpj')?.value.trim() || '';
    const telefone = document.getElementById('cfg-modal-telefone')?.value.trim() || '';
    const chavePix = document.getElementById('cfg-modal-chave-pix')?.value.trim() || '';
    const cidade = document.getElementById('cfg-modal-cidade')?.value.trim() || '';
    const impressora = document.getElementById('cfg-modal-impressora')?.value || 'Nenhuma';

    const cfg = StorageService.getConfig() || {};
    cfg.nomeLoja = nomeEmpresa;
    cfg.nomeEmpresa = nomeEmpresa;
    cfg.cnpj = cnpj;
    cfg.telefone = telefone;
    cfg.chavePix = chavePix;
    cfg.cidade = cidade;
    cfg.impressora = impressora;

    StorageService.saveConfig(cfg);

    const lic = StorageService.getLicenca() || {};
    lic.razaoSocial = nomeEmpresa;
    lic.cnpj = cnpj;
    StorageService.saveLicenca(lic);

    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('configuracoes');
    }

    if (window.ClientesModule && typeof window.ClientesModule.renderTabelaClientes === 'function') {
      window.ClientesModule.renderTabelaClientes();
    }

    this.fecharModalEditarConfigLoja();
    this.carregarConfiguracoes();
    this.showToast('💾 Dados da empresa atualizados com sucesso!', 'success');
  },

  // ==========================================
  // CENTRAL DE NOTIFICAÇÕES & ALERTAS DO GERENTE
  // ==========================================
  verificarAlertasGerenteLogin() {
    // Apenas se o usuário logado for Gerente ou Administrador
    if (!window.AuthModule || !window.AuthModule.isGerente()) return;

    // Se o modal de login ainda estiver visível, aguarda
    const modalLogin = document.getElementById('modal-login-operador');
    if (modalLogin && modalLogin.classList.contains('active')) return;

    const produtos = StorageService.getProdutos() || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().split('T')[0];

    const prodVencidos = [];
    const prodVence15d = [];
    const prodVence30d = [];

    const isValidadeAtivo = StorageService.isModuloAtivo('validadeLotes');
    if (isValidadeAtivo) {
      produtos.forEach(p => {
        if (p && p.dataValidade) {
          const dVal = new Date(p.dataValidade + 'T00:00:00');
          const diffDias = Math.ceil((dVal - hoje) / (1000 * 60 * 60 * 24));
          if (diffDias < 0) {
            prodVencidos.push({ ...p, diffDias });
          } else if (diffDias <= 15) {
            prodVence15d.push({ ...p, diffDias });
          } else if (diffDias <= 30) {
            prodVence30d.push({ ...p, diffDias });
          }
        }
      });
    }

    const contas = StorageService.getContasPagar() || [];
    const contasVencidas = [];
    const contasVenceProximo = [];
    let totalValorVencido = 0;
    let totalValorProximo = 0;

    contas.forEach(c => {
      if (c && c.status !== 'pago' && c.vencimento) {
        const val = parseFloat(c.valor) || 0;
        if (c.vencimento < hojeStr) {
          contasVencidas.push(c);
          totalValorVencido += val;
        } else {
          const dVenc = new Date(c.vencimento + 'T00:00:00');
          const diffDias = Math.ceil((dVenc - hoje) / (1000 * 60 * 60 * 24));
          if (diffDias <= 15) {
            contasVenceProximo.push({ ...c, diffDias });
            totalValorProximo += val;
          }
        }
      }
    });

    const totalAlertas = prodVencidos.length + prodVence15d.length + prodVence30d.length + contasVencidas.length + contasVenceProximo.length;

    // Se tudo estiver em dia, não interrompe o gerente
    if (totalAlertas === 0) return;

    this.renderModalAlertaGerencial({
      prodVencidos,
      prodVence15d,
      prodVence30d,
      contasVencidas,
      contasVenceProximo,
      totalValorVencido,
      totalValorProximo
    });
  },

  renderModalAlertaGerencial(dados) {
    const modal = document.getElementById('modal-alerta-gerencial-login');
    const container = document.getElementById('alerta-gerencial-conteudo');
    if (!modal || !container) return;

    const formatarMoeda = (val) => {
      return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatarData = (dataStr) => {
      if (!dataStr) return '';
      const [ano, mes, dia] = dataStr.split('-');
      return dia + '/' + mes + '/' + ano;
    };

    let html = '';

    // 1. SEÇÃO ESTOQUE & VALIDADES
    const totalEstoque = dados.prodVencidos.length + dados.prodVence15d.length + dados.prodVence30d.length;
    if (totalEstoque > 0) {
      html += `
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            <span style="font-size: 18px;">📦</span>
            <strong style="font-size: 14.5px; font-weight: 800; color: var(--text-main);">Validade de Produtos no Estoque</strong>
          </div>
      `;

      if (dados.prodVencidos.length > 0) {
        html += `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
            <div style="color: #b91c1c; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              🚨 <span>${dados.prodVencidos.length} produto(s) JÁ VENCIDO(S)!</span>
            </div>
            <div style="font-size: 12px; color: #991b1b; margin-top: 4px; line-height: 1.4;">
              ${dados.prodVencidos.slice(0, 3).map(p => '• <strong>' + p.nome + '</strong> (Venceu em ' + formatarData(p.dataValidade) + ' - Saldo: ' + (p.estoque || 0) + ')').join('<br>')}
              ${dados.prodVencidos.length > 3 ? '<span style="font-weight: 700; color: #7f1d1d; display: block; margin-top: 2px;">+ mais ' + (dados.prodVencidos.length - 3) + ' produto(s) vencido(s)</span>' : ''}
            </div>
          </div>
        `;
      }

      if (dados.prodVence15d.length > 0) {
        html += `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
            <div style="color: #b45309; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              ⏳ <span>${dados.prodVence15d.length} produto(s) vencem nos próximos 15 dias!</span>
            </div>
            <div style="font-size: 12px; color: #92400e; margin-top: 4px; line-height: 1.4;">
              ${dados.prodVence15d.slice(0, 3).map(p => '• <strong>' + p.nome + '</strong> (Vence em ' + formatarData(p.dataValidade) + ' - em ' + p.diffDias + ' dia(s))').join('<br>')}
              ${dados.prodVence15d.length > 3 ? '<span style="font-weight: 700; color: #78350f; display: block; margin-top: 2px;">+ mais ' + (dados.prodVence15d.length - 3) + ' produto(s)</span>' : ''}
            </div>
          </div>
        `;
      }

      if (dados.prodVence30d.length > 0) {
        html += `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px 12px;">
            <div style="color: #1d4ed8; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              📅 <span>${dados.prodVence30d.length} produto(s) vencem entre 16 e 30 dias.</span>
            </div>
          </div>
        `;
      }

      html += `
          <div style="margin-top: auto; padding-top: 6px;">
            <button type="button" class="btn-secondary-action" style="width: 100%; justify-content: center; height: 36px; font-size: 12px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;" onclick="App.irParaEstoqueComFiltro('${dados.prodVencidos.length > 0 ? 'vencidos' : 'vence15d'}')">
              📦 Ver Produtos no Estoque [F3] →
            </button>
          </div>
        </div>`;
    }

    // 2. SEÇÃO CONTAS A PAGAR
    const totalContas = dados.contasVencidas.length + dados.contasVenceProximo.length;
    if (totalContas > 0) {
      html += `
        <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            <span style="font-size: 18px;">💳</span>
            <strong style="font-size: 14.5px; font-weight: 800; color: var(--text-main);">Contas a Pagar & Despesas</strong>
          </div>
      `;

      if (dados.contasVencidas.length > 0) {
        html += `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
            <div style="color: #b91c1c; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
              <span>🚨 ${dados.contasVencidas.length} conta(s) VENCIDA(S) em atraso!</span>
              <span style="font-family: 'JetBrains Mono'; font-weight: 900;">R$ ${formatarMoeda(dados.totalValorVencido)}</span>
            </div>
            <div style="font-size: 12px; color: #991b1b; margin-top: 4px; line-height: 1.4;">
              ${dados.contasVencidas.slice(0, 3).map(c => '• <strong>' + (c.descricao || 'Despesa') + '</strong> (R$ ' + formatarMoeda(c.valor) + ' - Venceu em ' + formatarData(c.vencimento) + ')').join('<br>')}
              ${dados.contasVencidas.length > 3 ? '<span style="font-weight: 700; color: #7f1d1d; display: block; margin-top: 2px;">+ mais ' + (dados.contasVencidas.length - 3) + ' conta(s)</span>' : ''}
            </div>
          </div>
        `;
      }

      if (dados.contasVenceProximo.length > 0) {
        html += `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px;">
            <div style="color: #b45309; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
              <span>⏳ ${dados.contasVenceProximo.length} conta(s) a vencer nos próximos 15 dias</span>
              <span style="font-family: 'JetBrains Mono'; font-weight: 900;">R$ ${formatarMoeda(dados.totalValorProximo)}</span>
            </div>
            <div style="font-size: 12px; color: #92400e; margin-top: 4px; line-height: 1.4;">
              ${dados.contasVenceProximo.slice(0, 3).map(c => '• <strong>' + (c.descricao || 'Despesa') + '</strong> (R$ ' + formatarMoeda(c.valor) + ' - Vence em ' + formatarData(c.vencimento) + ')').join('<br>')}
              ${dados.contasVenceProximo.length > 3 ? '<span style="font-weight: 700; color: #78350f; display: block; margin-top: 2px;">+ mais ' + (dados.contasVenceProximo.length - 3) + ' conta(s)</span>' : ''}
            </div>
          </div>
        `;
      }

      html += `
          <div style="margin-top: auto; padding-top: 6px;">
            <button type="button" class="btn-secondary-action" style="width: 100%; justify-content: center; height: 36px; font-size: 12px; font-weight: 700; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;" onclick="App.irParaContasPagar('${dados.contasVencidas.length > 0 ? 'vencidas' : 'pendentes'}')">
              💳 Ver Painel de Contas a Pagar →
            </button>
          </div>
        </div>`;
    }

    container.className = (totalEstoque > 0 && totalContas > 0) ? 'alerta-gerencial-grid' : 'alerta-gerencial-grid single-column';
    container.innerHTML = html;
    modal.classList.add('active');

    const listenerTeclado = (e) => {
      if (modal.classList.contains('active') && (e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        App.fecharModalAlertaGerencial();
        window.removeEventListener('keydown', listenerTeclado);
      }
    };
    window.addEventListener('keydown', listenerTeclado);
  },

  fecharModalAlertaGerencial() {
    const modal = document.getElementById('modal-alerta-gerencial-login');
    if (modal) modal.classList.remove('active');

    setTimeout(() => {
      const barcodeInput = document.getElementById('pdv-barcode-input');
      if (barcodeInput) barcodeInput.focus();
    }, 100);
  },

  irParaEstoqueComFiltro(filtro = 'todos') {
    this._manterFiltroValidadeEstoque = filtro || 'todos';
    this.fecharModalAlertaGerencial();
    this.trocarAba('estoque');
  },

  irParaContasPagar(filtro = 'todos') {
    this.fecharModalAlertaGerencial();
    this.trocarAba('gerencia');
    if (window.GerenciaModule) {
      if (typeof window.GerenciaModule.trocarSubAba === 'function') {
        window.GerenciaModule.trocarSubAba('financeiro');
      }
      if (filtro && typeof window.GerenciaModule.filtrarContas === 'function') {
        setTimeout(() => window.GerenciaModule.filtrarContas(filtro), 150);
      }
    }
  },

  salvarConfiguracoes(e) {
    return this.salvarConfiguracoesModal(e);
  },
};

window.App = App;
window.StorageService = StorageService;
window.AuthModule = AuthModule;
window.PdvModule = PdvModule;
window.EstoqueModule = EstoqueModule;
window.CaixaModule = CaixaModule;
window.ClientesModule = ClientesModule;
window.LicencaModule = LicencaModule;
window.ThermalPrintModule = ThermalPrintModule;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
