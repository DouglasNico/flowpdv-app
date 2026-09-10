/**
 * estoque.js - Gestão de Produtos, Estoque e Grade Fracionada com RBAC
 */

import { StorageService } from './storage.js';
import { AuthModule } from './auth.js';
import { AuditModule } from './audit.js';
import ExcelJS from 'exceljs';

export const EstoqueModule = {
  categoriaFiltro: 'todas',
  filtroEstoqueBaixo: false,
  filtroListaCompras: false,
  filtroValidade: 'todos',
  produtoEditandoId: null,
  produtoAjustandoId: null,
  produtoValidadeBipado: null,
  historicoValidadesBipadas: [],
  produtosParaImportar: [],
  ordenacaoAtual: {
    coluna: '', // '', 'codigo', 'nome', 'categoria', 'precoCusto', 'precoVenda', 'estoque'
    direcao: 'asc'
  },
  
  padronizarProdutosExistentes() {
    try {
      const produtos = StorageService.getProdutos() || [];
      let alterou = false;
      produtos.forEach(p => {
        if (p && p.nome && p.nome !== p.nome.toUpperCase()) {
          p.nome = p.nome.toUpperCase();
          alterou = true;
        }
      });
      if (alterou) {
        StorageService.saveProdutos(produtos);
      }
    } catch(e) {}
  },

  resetarFiltrosEstoque() {
    this.categoriaFiltro = 'todas';
    this.filtroValidade = 'todos';
    this.filtroEstoqueBaixo = false;
    this.filtroListaCompras = false;
    this.ordenacaoAtual = { coluna: '', direcao: 'asc' };
    try {
      const inputBusca = document.getElementById('estoque-busca-input');
      if (inputBusca) inputBusca.value = '';
      document.querySelectorAll('.estoque-filtro-validade-btn').forEach(b => {
        b.classList.toggle('active', (b.getAttribute('data-filtro-val') || '') === 'todos');
      });
      const btnEstoqueBaixo = document.getElementById('btn-filtro-estoque-baixo');
      if (btnEstoqueBaixo) {
        btnEstoqueBaixo.classList.remove('active');
        btnEstoqueBaixo.style.background = '';
        btnEstoqueBaixo.style.color = '';
        btnEstoqueBaixo.style.borderColor = '';
      }
      const btnLista = document.getElementById('btn-lista-compras-excel');
      if (btnLista) {
        btnLista.classList.remove('active');
        btnLista.style.background = '';
        btnLista.style.color = '';
        btnLista.style.borderColor = '';
        btnLista.style.boxShadow = '';
      }
      this.fecharMenuAcoesEstoque();
      this.atualizarBannerListaCompras();
      this.atualizarChipsFiltrosAcoes();
      this.renderBarraCategorias();
      this.atualizarIconesOrdenacao();
      this.renderTabelaProdutos();
    } catch (e) {
      this.atualizarChipsFiltrosAcoes();
    }
  },

  init() {
    this.padronizarProdutosExistentes();
    this.renderBarraCategorias();
    this.atualizarIconesOrdenacao();
    this.renderTabelaProdutos();
    this.atualizarBotoesPermissaoGerente();
    this.bindBusca();
    this.bindGlobalDropdownListener();
    this.bindMascarasMonetarias();
    this.bindCalculoInteligenteGrade();
    this.bindValidacaoCodigoBarrasDuplicado();
    this.bindAutoLookupEan();
    this.bindDragDropPlanilha();
    this.adaptarInterfaceSegmento();
    this.verificarAlertasValidade();
    this.bindResetAoSairDaAba();
  },

  bindResetAoSairDaAba() {
    const panel = document.getElementById('tab-estoque');
    if (!panel || panel.dataset.resetBound === '1') return;
    panel.dataset.resetBound = '1';
    const observer = new MutationObserver(() => {
      if (!panel.classList.contains('active')) this.resetarFiltrosEstoque();
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  },

  adaptarInterfaceSegmento() {
    const isFardosAtivo = StorageService.isModuloAtivo('fardosPacks');
    const isGradeRoupasAtivo = StorageService.isModuloAtivo('gradeRoupas');
    const isBalancaAtivo = StorageService.isModuloAtivo('balancaPeso');
    const isValidadeAtivo = StorageService.isModuloAtivo('validadeLotes');
    const isXmlAtivo = StorageService.isModuloAtivo('importadorXml');
    const isClubeAtivo = StorageService.isModuloAtivo('clubeFidelidade');

    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') 
      ? window.AuthModule.isGerente() 
      : StorageService.isGerente();

    const boxFardos = document.getElementById('box-modulo-fardos');
    const titleFardos = document.getElementById('titulo-modulo-fardos');
    const labelEmbalagem = document.getElementById('label-nome-embalagem-grade');
    const inputEmbalagem = document.getElementById('prod-unidade-fracionada');
    const boxBalanca = document.getElementById('box-modulo-balanca');
    const boxValidade = document.getElementById('box-modulo-validade');
    const btnXml = document.getElementById('btn-importar-xml-nfe');
    const btnBiparValidade = document.getElementById('btn-bipar-validade-express');
    const btnQueimaEstoque = document.getElementById('btn-queima-estoque-promo');
    const btnPrecosClube = document.getElementById('btn-precos-clube-lote');
    const barFiltrosValidade = document.getElementById('estoque-filtros-validade-bar');
    const boxPrecoClube = document.getElementById('box-preco-clube');

    if (boxFardos) {
      const showGradeOuFardo = isFardosAtivo || isGradeRoupasAtivo;
      boxFardos.style.display = showGradeOuFardo ? 'block' : 'none';

      if (showGradeOuFardo && titleFardos) {
        if (isGradeRoupasAtivo && !isFardosAtivo) {
          titleFardos.innerHTML = `
            <span style="font-size: 16px;">👗</span>
            <div>
              <strong style="font-size: 13px; color: var(--text-main); display: block;">Grade de Tamanhos & Cores (Opcional)</strong>
              <span style="font-size: 11px; color: var(--text-muted);">Defina variações de tamanho (P, M, G, 38, 40) ou cor do produto.</span>
            </div>
          `;
          if (labelEmbalagem) labelEmbalagem.textContent = 'Tamanho / Cor / Variação:';
          if (inputEmbalagem) inputEmbalagem.placeholder = 'Ex: Tamanho M / Cor Azul';
        } else if (isGradeRoupasAtivo && isFardosAtivo) {
          titleFardos.innerHTML = `
            <span style="font-size: 16px;">📦</span>
            <div>
              <strong style="font-size: 13px; color: var(--text-main); display: block;">Grade & Fardo (Opcional)</strong>
              <span style="font-size: 11px; color: var(--text-muted);">Tamanho, cor ou embalagem com preço diferenciado.</span>
            </div>
          `;
          if (labelEmbalagem) labelEmbalagem.textContent = 'Grade / Embalagem:';
          if (inputEmbalagem) inputEmbalagem.placeholder = 'Ex: Tam G, Fardo c/ 12';
        } else {
          titleFardos.innerHTML = `
            <span style="font-size: 16px;">📦</span>
            <div>
              <strong style="font-size: 13px; color: var(--text-main); display: block;">Fardo & Embalagem (Opcional)</strong>
              <span style="font-size: 11px; color: var(--text-muted);">Preço com desconto para fardos, caixas ou kits.</span>
            </div>
          `;
          if (labelEmbalagem) labelEmbalagem.textContent = 'Nome da Embalagem:';
          if (inputEmbalagem) inputEmbalagem.placeholder = 'Ex: Fardo c/ 12, Kit c/ 3';
        }
      }
    }

    if (boxBalanca) boxBalanca.style.display = isBalancaAtivo ? 'flex' : 'none';
    if (boxValidade) boxValidade.style.display = isValidadeAtivo ? 'block' : 'none';
    if (btnBiparValidade) btnBiparValidade.style.display = isValidadeAtivo ? 'flex' : 'none';
    if (btnQueimaEstoque) btnQueimaEstoque.style.display = isValidadeAtivo ? 'flex' : 'none';
    if (btnPrecosClube) btnPrecosClube.style.display = isClubeAtivo ? 'flex' : 'none';
    if (barFiltrosValidade) barFiltrosValidade.style.display = isValidadeAtivo ? 'flex' : 'none';
    if (btnXml) btnXml.style.display = (isXmlAtivo && isGerente) ? 'flex' : 'none';
    if (boxPrecoClube) boxPrecoClube.style.display = isClubeAtivo ? 'block' : 'none';
  },

  toggleFiltroEstoqueBaixo() {
    this.filtroEstoqueBaixo = !this.filtroEstoqueBaixo;
    if (this.filtroEstoqueBaixo && this.filtroListaCompras) {
      this.toggleFiltroListaCompras(false);
    }
    const btn = document.getElementById('btn-filtro-estoque-baixo');
    if (btn) {
      if (this.filtroEstoqueBaixo) {
        btn.style.background = '#dc2626';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#dc2626';
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    }
    this.renderTabelaProdutos();
    this.atualizarChipsFiltrosAcoes();
  },

  limparFiltroEstoqueBaixo() {
    if (!this.filtroEstoqueBaixo) return;
    this.toggleFiltroEstoqueBaixo();
  },

  limparFiltroListaCompras() {
    if (!this.filtroListaCompras) return;
    this.toggleFiltroListaCompras(false);
  },

  atualizarChipsFiltrosAcoes() {
    const btnAcoes = document.getElementById('btn-estoque-acoes');
    const chip = document.getElementById('estoque-chip-filtro-acoes');
    if (!chip) return;

    if (!this.filtroEstoqueBaixo && !this.filtroListaCompras) {
      chip.style.display = 'none';
      chip.innerHTML = '';
      if (btnAcoes) btnAcoes.style.display = '';
      return;
    }

    const baixo = this.filtroEstoqueBaixo;
    if (btnAcoes) btnAcoes.style.display = 'none';
    chip.className = `estoque-chip-filtro ${baixo ? 'alerta' : 'lista'}`;
    chip.style.display = 'inline-flex';
    chip.innerHTML = `
      <span onclick="EstoqueModule.toggleMenuAcoesEstoque(event)" style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
        ${baixo ? '⚠️ Estoque Baixo' : '📋 Lista Compras'} ▾
      </span>
      <button type="button" class="estoque-chip-x" title="Limpar filtro" onclick="event.stopPropagation(); ${baixo ? 'EstoqueModule.limparFiltroEstoqueBaixo()' : 'EstoqueModule.limparFiltroListaCompras()'}">✕</button>
    `;
  },

  toggleFiltroListaCompras(forcar = null) {
    if (forcar !== null) {
      this.filtroListaCompras = forcar;
    } else {
      this.filtroListaCompras = !this.filtroListaCompras;
    }

    if (this.filtroListaCompras && this.filtroEstoqueBaixo) {
      this.filtroEstoqueBaixo = false;
      const btnBaixo = document.getElementById('btn-filtro-estoque-baixo');
      if (btnBaixo) {
        btnBaixo.style.background = '';
        btnBaixo.style.color = '';
        btnBaixo.style.borderColor = '';
      }
    }

    const btn = document.getElementById('btn-lista-compras-excel');
    if (btn) {
      if (this.filtroListaCompras) {
        btn.classList.add('active');
        btn.style.background = '#0f766e';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#0d9488';
        btn.style.boxShadow = '0 2px 8px rgba(15, 118, 110, 0.35)';
      } else {
        btn.classList.remove('active');
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.style.boxShadow = '';
      }
    }

    this.renderTabelaProdutos();
    this.atualizarBannerListaCompras();
    this.atualizarChipsFiltrosAcoes();
  },

  atualizarBannerListaCompras() {
    const banner = document.getElementById('banner-filtro-lista-compras');
    if (!banner) return;

    if (!this.filtroListaCompras) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';

    const produtos = StorageService.getProdutos() || [];
    const produtosRepor = produtos.filter(p => {
      if (p.controlarEstoque === false) return false;
      const est = parseFloat(p.estoque) || 0;
      const estMin = parseFloat(p.estoqueMinimo) || 5;
      return est <= estMin;
    });

    let somaInvestimento = 0;
    produtosRepor.forEach(p => {
      const est = parseFloat(p.estoque) || 0;
      const estMin = parseFloat(p.estoqueMinimo) || 5;
      const sugerido = Math.max(1, (estMin * 2) - Math.max(0, est));
      const custo = parseFloat(p.precoCusto) || 0;
      somaInvestimento += sugerido * custo;
    });

    const badgeCount = document.getElementById('lista-compras-count-badge');
    const resumoTexto = document.getElementById('lista-compras-resumo-texto');

    if (badgeCount) {
      badgeCount.textContent = `${produtosRepor.length} produto(s)`;
    }
    if (resumoTexto) {
      if (produtosRepor.length > 0) {
        resumoTexto.innerHTML = `Mostrando <strong>${produtosRepor.length} produto(s)</strong> para reposição no estoque. Investimento estimado sugerido: <strong style="color: #059669; font-family: 'JetBrains Mono';">R$ ${somaInvestimento.toFixed(2).replace('.', ',')}</strong>`;
      } else {
        resumoTexto.innerHTML = `🎉 <strong>Tudo certo!</strong> Todos os produtos do estoque estão com quantidade suficiente (acima do estoque mínimo).`;
      }
    }
  },

  setFiltroValidade(filtro, btnElement) {
    this.filtroValidade = filtro || 'todos';
    document.querySelectorAll('.estoque-filtro-validade-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) {
      btnElement.classList.add('active');
    } else {
      const el = document.querySelector(`.estoque-filtro-validade-btn[data-filtro-val="${filtro}"]`);
      if (el) el.classList.add('active');
    }
    this.renderTabelaProdutos();
  },

  verificarAlertasValidade(aoIniciar = false) {
    const btnVencidos = document.querySelector('.estoque-filtro-validade-btn[data-filtro-val="vencidos"]');
    const btnVence15d = document.querySelector('.estoque-filtro-validade-btn[data-filtro-val="vence15d"]');
    const navBadge = document.getElementById('nav-badge-vencidos');

    const isValidadeAtivo = StorageService.isModuloAtivo('validadeLotes');
    if (!isValidadeAtivo) {
      if (btnVencidos) btnVencidos.innerHTML = '🚨 Vencidos';
      if (btnVence15d) btnVence15d.innerHTML = '🚨 Vence em 15 dias';
      if (navBadge) navBadge.style.display = 'none';
      return;
    }

    const produtos = StorageService.getProdutos() || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let vencidos = 0;
    let vence15d = 0;

    produtos.forEach(p => {
      if (p && p.dataValidade) {
        const dataVal = new Date(p.dataValidade + 'T00:00:00');
        const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));
        if (diffDias < 0) {
          vencidos++;
        } else if (diffDias <= 15) {
          vence15d++;
        }
      }
    });

    // Atualizar contadores nos botões de filtro de validade da tela de estoque
    if (btnVencidos) {
      btnVencidos.innerHTML = `🚨 Vencidos ${vencidos > 0 ? `(${vencidos})` : ''}`;
    }
    if (btnVence15d) {
      btnVence15d.innerHTML = `🚨 Vence em 15 dias ${vence15d > 0 ? `(${vence15d})` : ''}`;
    }

    if (navBadge) {
      navBadge.style.display = 'none';
    }

    // 3. Notificação Toast de início removida: agora exibida exclusivamente no modal do Gerente após login
  },

  bindMascarasMonetarias() {
    const aplicarMascara = (input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        let v = input.value.replace(/\D/g, '');
        if (!v) {
          input.value = '';
          return;
        }
        const num = parseInt(v, 10) / 100;
        input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    };

    aplicarMascara(document.getElementById('prod-preco-custo'));
    aplicarMascara(document.getElementById('prod-preco-venda'));
    aplicarMascara(document.getElementById('prod-preco-clube'));
    aplicarMascara(document.getElementById('prod-preco-fardo'));
  },

  bindCalculoInteligenteGrade() {
    const inputPrecoVenda = document.getElementById('prod-preco-venda');
    const inputQtdFardo = document.getElementById('prod-fator-conversao');
    const inputPrecoFardo = document.getElementById('prod-preco-fardo');

    const recalcular = (origem) => {
      const precoUnit = this.parseMoedaBR(inputPrecoVenda?.value);
      const qtd = parseInt(inputQtdFardo?.value, 10) || 0;

      // Se mudou a quantidade ou o preço unitário
      if (origem === 'qtd' || origem === 'unit') {
        if (precoUnit > 0 && qtd > 0) {
          // Se o preço do fardo estava vazio ou foi auto-calculado anteriormente, recalcula
          if (!inputPrecoFardo.value || inputPrecoFardo.dataset.autoCalculado === 'true') {
            const totalSugerido = precoUnit * qtd;
            inputPrecoFardo.value = this.formatarMoedaParaExibir(totalSugerido);
            inputPrecoFardo.dataset.autoCalculado = 'true';
          }
        }
      } else if (origem === 'fardo') {
        // Se o lojista alterou manualmente o preço do fardo, desmarca o auto-calculado
        if (inputPrecoFardo) inputPrecoFardo.dataset.autoCalculado = 'false';
      }

      this.atualizarFeedbackDescontoGrade();
    };

    if (inputPrecoVenda) inputPrecoVenda.addEventListener('input', () => recalcular('unit'));
    if (inputQtdFardo) inputQtdFardo.addEventListener('input', () => recalcular('qtd'));
    if (inputPrecoFardo) inputPrecoFardo.addEventListener('input', () => recalcular('fardo'));
  },

  bindValidacaoCodigoBarrasDuplicado() {
    const inputCod = document.getElementById('prod-codigo-barras');
    const inputCodFardo = document.getElementById('prod-codigo-barras-fardo');

    const validar = (input) => {
      if (!input) return;
      input.addEventListener('blur', () => {
        const val = input.value.trim().toUpperCase();
        if (!val) {
          input.style.borderColor = '';
          return;
        }

        const produtos = StorageService.getProdutos();
        const duplicado = produtos.find(p => {
          if (this.produtoEditandoId && p.id === this.produtoEditandoId) return false;
          const codP = String(p.codigoBarras || '').trim().toUpperCase();
          const codF = String(p.codigoBarrasFardo || '').trim().toUpperCase();
          return (codP && codP === val) || (codF && codF === val);
        });

        if (duplicado) {
          this.preencherDadosProdutoExistente(duplicado);
          window.App.showToast(`⚠️ Atenção: O código de barras "${val}" já está cadastrado no produto "${duplicado.nome}"!`, 'warning');
          input.style.borderColor = '#ef4444';
        } else {
          input.style.borderColor = '';
        }
      });

      input.addEventListener('input', () => {
        input.style.borderColor = '';
      });
    };

    validar(inputCod);
    validar(inputCodFardo);
  },

  preencherDadosProdutoExistente(produto) {
    if (!produto || this.produtoEditandoId) return;

    const inputNome = document.getElementById('prod-nome');
    const inputCusto = document.getElementById('prod-preco-custo');
    const inputVenda = document.getElementById('prod-preco-venda');
    const selectCategoria = document.getElementById('prod-categoria');

    if (inputNome && !inputNome.value.trim()) inputNome.value = produto.nome || '';
    if (inputCusto && !inputCusto.value.trim()) inputCusto.value = this.formatarMoedaParaExibir(produto.precoCusto);
    if (inputVenda && !inputVenda.value.trim()) inputVenda.value = this.formatarMoedaParaExibir(produto.precoVenda);
    if (selectCategoria && produto.categoria) {
      const categoria = Array.from(selectCategoria.options).find(option =>
        option.value.toLowerCase() === String(produto.categoria).trim().toLowerCase()
      );
      if (categoria) selectCategoria.value = categoria.value;
    }
  },

  bindAutoLookupEan() {
    const inputCod = document.getElementById('prod-codigo-barras');
    if (!inputCod) return;

    let timeoutEan = null;

    inputCod.addEventListener('input', () => {
      clearTimeout(timeoutEan);
      const val = inputCod.value.trim().replace(/\D/g, '');
      // Se tem entre 8 e 14 dígitos (EAN-8, EAN-13, EAN-14)
      if (val.length >= 8 && val.length <= 14) {
        timeoutEan = setTimeout(() => {
          this.consultarEanOnline(val, false);
        }, 450);
      }
    });

    inputCod.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputCod.value.trim().replace(/\D/g, '');
        if (val.length >= 8) {
          this.consultarEanOnline(val, true);
        }
      }
    });
  },

  consultarEanManual() {
    const inputCod = document.getElementById('prod-codigo-barras');
    const val = inputCod?.value.trim().replace(/\D/g, '') || '';
    if (!val) {
      window.App.showToast('Digite ou bipe um código de barras primeiro!', 'warning');
      inputCod?.focus();
      return;
    }
    this.consultarEanOnline(val, true);
  },

  async consultarEanOnline(codigo, forcarBusca = false) {
    const cleanCod = String(codigo || '').trim().replace(/\D/g, '');
    if (!cleanCod || cleanCod.length < 8) return;

    // Se o código começa com 2000 (código interno gerado), não busca na internet
    if (cleanCod.startsWith('2000') && cleanCod.length === 13) return;

    const inputNome = document.getElementById('prod-nome');
    const produtoLocal = (StorageService.getProdutos() || []).find(produto => {
      const codigoPrincipal = String(produto.codigoBarras || '').trim().replace(/\D/g, '');
      const codigoFardo = String(produto.codigoBarrasFardo || '').trim().replace(/\D/g, '');
      return codigoPrincipal === cleanCod || codigoFardo === cleanCod;
    });
    if (produtoLocal) {
      this.preencherDadosProdutoExistente(produtoLocal);
      return;
    }
    // Se já tiver nome preenchido e não foi clique manual, não sobrescreve
    if (inputNome && inputNome.value.trim() && !forcarBusca) return;

    const statusEl = document.getElementById('ean-lookup-status');
    const btnBuscar = document.getElementById('btn-buscar-ean-online');
    
    if (statusEl) {
      statusEl.style.display = 'inline-block';
      statusEl.textContent = '🔍 Consultando catálogo nacional...';
      statusEl.style.color = '#0284c7';
    }
    if (btnBuscar) btnBuscar.disabled = true;

    try {
      const endpoints = [
        `https://world.openfoodfacts.org/api/v0/product/${cleanCod}.json`,
        `https://br.openfoodfacts.org/api/v0/product/${cleanCod}.json`,
        `https://world.openproductsfacts.org/api/v0/product/${cleanCod}.json`,
        `https://world.openbeautyfacts.org/api/v0/product/${cleanCod}.json`
      ];

      let produtoEncontrado = null;

      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2200);
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'FlowPDV-Desktop/1.6.0 (contato@flowpdv.com.br)' }
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            if (data && data.status === 1 && data.product) {
              const p = data.product;
              let nome = (p.product_name_pt || p.product_name || p.generic_name_pt || p.generic_name || '').trim();
              const marca = (p.brands || '').trim();
              const qtd = (p.quantity || '').trim();

              if (!nome && marca) nome = marca;
              if (nome) {
                const nomeLower = nome.toLowerCase().replace(/[^a-z0-9]/g, '');
                const marcaLower = marca.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                // Se a marca não está no nome, anexa de forma limpa
                if (marca && !nomeLower.includes(marcaLower) && !marcaLower.includes(nomeLower)) {
                  nome = `${nome} - ${marca}`;
                }

                // Se o volume/peso não está no nome, anexa
                const qtdClean = qtd.toLowerCase().replace(/\s+/g, '');
                if (qtd && !nome.toLowerCase().includes(qtdClean) && !nome.toLowerCase().includes(qtd.toLowerCase())) {
                  nome = `${nome} ${qtd}`;
                }

                nome = nome.replace(/\s+/g, ' ').trim();

                produtoEncontrado = {
                  nome,
                  marca,
                  qtd,
                  categorias: `${p.categories || ''} ${(p.categories_tags || []).join(' ')}`
                };
                break;
              }
            }
          }
        } catch(e) {}
      }

      if (produtoEncontrado) {
        if (inputNome) {
          inputNome.value = produtoEncontrado.nome;
          inputNome.style.borderColor = '#10b981';
          setTimeout(() => { if (inputNome) inputNome.style.borderColor = ''; }, 2500);
        }

        // Selecionar categoria sugerida com inteligência semântica
        const catSugerida = this.identificarCategoriaSugerida(produtoEncontrado.nome, produtoEncontrado.marca, produtoEncontrado.categorias);
        if (catSugerida) {
          const catSelect = document.getElementById('prod-categoria');
          if (catSelect) catSelect.value = catSugerida;
        }

        if (statusEl) {
          statusEl.textContent = '✨ Produto identificado com sucesso!';
          statusEl.style.color = '#059669';
          setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
        }
        window.App.showToast(`✨ Produto identificado: ${produtoEncontrado.nome}`, 'success');

        // Pula o cursor para o preço de venda para agilizar o fluxo
        const inputPrecoVenda = document.getElementById('prod-preco-venda');
        if (inputPrecoVenda) {
          setTimeout(() => inputPrecoVenda.focus(), 150);
        }
      } else {
        if (statusEl) {
          if (forcarBusca) {
            statusEl.textContent = 'ℹ️ Não encontrado no catálogo nacional.';
            statusEl.style.color = 'var(--text-muted)';
            setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
            window.App.showToast('Código não localizado no catálogo nacional. Digite o nome manualmente.', 'info');
          } else {
            statusEl.style.display = 'none';
          }
        }
      }
    } catch(err) {
      if (statusEl) statusEl.style.display = 'none';
    } finally {
      if (btnBuscar) btnBuscar.disabled = false;
    }
  },

  identificarCategoriaSugerida(nome, marca, categoriasTexto) {
    const catSelect = document.getElementById('prod-categoria');
    if (!catSelect) return null;

    const options = Array.from(catSelect.options).map(o => o.value);
    if (options.length === 0) return null;

    const textoCompleto = `${nome} ${marca} ${categoriasTexto}`.toLowerCase();

    const regras = [
      {
        termos: ['refrigerante', 'coca', 'pepsi', 'guaraná', 'guarana', 'fanta', 'sprite', 'soda', 'schweppes', 'cola', 'colas', 'carbonated'],
        alvos: ['refrigerante', 'refrigerantes', 'não alcoólico', 'nao alcoolico', 'não alcoólicos', 'nao alcoolicos', 'bebidas', 'bebida']
      },
      {
        termos: ['cerveja', 'cervejas', 'chopp', 'pilsen', 'ipa', 'heineken', 'brahma', 'skol', 'amstel', 'budweiser', 'stella', 'corona', 'itaipava', 'eisenbahn', 'antarctica', 'beer', 'beers'],
        alvos: ['cerveja', 'cervejas', 'chopp', 'bebidas', 'bebida']
      },
      {
        termos: ['whisky', 'whiskey', 'vodka', 'gin', 'cachaça', 'cachaca', 'rum', 'tequila', 'licor', 'conhaque', 'campari', 'aperol', 'destilado', 'destilados'],
        alvos: ['destilado', 'destilados', 'whisky', 'bebidas', 'bebida']
      },
      {
        termos: ['vinho', 'vinhos', 'espumante', 'espumantes', 'champagne', 'prosecco', 'wine'],
        alvos: ['vinho', 'vinhos', 'espumante', 'bebidas', 'bebida']
      },
      {
        termos: ['energético', 'energetico', 'red bull', 'monster', 'fusion', 'energy drink', 'energy'],
        alvos: ['energético', 'energeticos', 'não alcoólico', 'nao alcoolico', 'não alcoólicos', 'nao alcoolicos', 'bebidas', 'bebida']
      },
      {
        termos: ['suco', 'sucos', 'néctar', 'del valle', 'água', 'agua', 'mineral', 'chá', 'cha', 'mate', 'gatorade', 'isotônico'],
        alvos: ['não alcoólico', 'nao alcoolico', 'não alcoólicos', 'nao alcoolicos', 'suco', 'sucos', 'bebidas', 'bebida']
      },
      {
        termos: ['salgadinho', 'doritos', 'ruffles', 'cheetos', 'lays', 'chips', 'fandangos', 'torcida', 'amendoim', 'snack', 'snacks', 'petisco'],
        alvos: ['snack', 'snacks', 'salgadinho', 'salgadinhos', 'snacks & tabacaria', 'petiscos', 'alimentos', 'mercearia']
      },
      {
        termos: ['chocolate', 'bombom', 'bis', 'lacta', 'nestle', 'nestlé', 'garoto', 'barra de chocolate', 'bala', 'chiclete', 'trident', 'halls', 'doce', 'doces'],
        alvos: ['doce', 'doces', 'bomboniere', 'chocolate', 'chocolates', 'snacks', 'alimentos']
      },
      {
        termos: ['gelo', 'carvão', 'carvao', 'acendedor', 'gelo saborizado'],
        alvos: ['gelo', 'carvão', 'carvao', 'gelo & carvão', 'gelo e carvao']
      },
      {
        termos: ['cigarro', 'cigarros', 'palheiro', 'fumo', 'narguile', 'essência', 'essencia', 'carvão de coco', 'seda', 'tabaco', 'isqueiro', 'cliper'],
        alvos: ['tabacaria', 'cigarro', 'fumo', 'narguile', 'headshop', 'snacks & tabacaria']
      },
      {
        termos: ['higiene', 'sabonete', 'shampoo', 'condicionador', 'desodorante', 'dental', 'papel higiênico', 'limpeza', 'detergente'],
        alvos: ['higiene', 'limpeza', 'higiene & limpeza', 'perfumaria']
      }
    ];

    for (const regra of regras) {
      const temTermo = regra.termos.some(t => textoCompleto.includes(t));
      if (temTermo) {
        for (const alvo of regra.alvos) {
          const match = options.find(c => c.toLowerCase().includes(alvo) || alvo.includes(c.toLowerCase()));
          if (match) return match;
        }
      }
    }

    for (const cat of options) {
      const catLower = cat.toLowerCase();
      if (catLower !== 'geral' && catLower !== 'outros') {
        if (textoCompleto.includes(catLower)) return cat;
      }
    }

    return null;
  },

  atualizarFeedbackDescontoGrade() {
    const inputPrecoVenda = document.getElementById('prod-preco-venda');
    const inputQtdFardo = document.getElementById('prod-fator-conversao');
    const inputPrecoFardo = document.getElementById('prod-preco-fardo');
    const badge = document.getElementById('prod-fardo-economia-badge');
    if (!badge) return;

    const precoUnit = this.parseMoedaBR(inputPrecoVenda?.value);
    const qtd = parseInt(inputQtdFardo?.value, 10) || 0;
    const valorFardo = this.parseMoedaBR(inputPrecoFardo?.value);

    if (precoUnit > 0 && qtd > 0 && valorFardo > 0) {
      const totalSemDesconto = precoUnit * qtd;
      const economia = totalSemDesconto - valorFardo;
      if (economia > 0.009) {
        const pct = ((economia / totalSemDesconto) * 100).toFixed(0);
        badge.style.display = 'block';
        badge.innerHTML = `🟢 <strong>${pct}% OFF:</strong> Economia de R$ ${economia.toFixed(2).replace('.', ',')}`;
      } else {
        badge.style.display = 'none';
      }
    } else {
      badge.style.display = 'none';
    }
  },

  formatarMoedaParaExibir(valor) {
    if (valor === null || valor === undefined || valor === '') return '';
    const num = typeof valor === 'number' ? valor : (parseFloat(String(valor).replace(',', '.')) || 0);
    return num > 0 ? num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  },

  parseMoedaBR(valor) {
    return StorageService.parseMoedaBR(valor);
  },

  toggleGradeFracionada(forcarAberto = null) {
    const campos = document.getElementById('grade-fracionada-campos');
    const icon = document.getElementById('grade-toggle-icon');
    if (!campos) return;

    const abrir = (forcarAberto !== null) ? forcarAberto : (campos.style.display === 'none' || !campos.style.display);
    if (abrir) {
      campos.style.display = 'block';
      if (icon) {
        icon.innerHTML = '➖ Ocultar';
        icon.style.background = '#fee2e2';
        icon.style.color = '#b91c1c';
      }
    } else {
      campos.style.display = 'none';
      if (icon) {
        icon.innerHTML = '➕ Configurar';
        icon.style.background = '#e0e7ff';
        icon.style.color = '#6366f1';
      }
    }
  },

  toggleDadosFiscais(forcarAberto = null) {
    const campos = document.getElementById('dados-fiscais-campos');
    const icon = document.getElementById('fiscal-toggle-icon');
    if (!campos) return;

    const abrir = (forcarAberto !== null) ? forcarAberto : (campos.style.display === 'none' || !campos.style.display);
    if (abrir) {
      campos.style.display = 'block';
      if (icon) {
        icon.innerHTML = '➖ Ocultar';
        icon.style.background = '#fee2e2';
        icon.style.color = '#b91c1c';
      }
    } else {
      campos.style.display = 'none';
      if (icon) {
        icon.innerHTML = '➕ Configurar';
        icon.style.background = '#e0e7ff';
        icon.style.color = '#6366f1';
      }
    }
  },

  toggleControleEstoque(forcarAtivo = null) {
    const checkbox = document.getElementById('prod-controlar-estoque');
    const boxCampos = document.getElementById('box-campos-estoque');
    const hint = document.getElementById('prod-controlar-estoque-hint');
    if (!checkbox) return;

    if (forcarAtivo !== null) {
      checkbox.checked = forcarAtivo;
    }

    const ativo = checkbox.checked;
    if (boxCampos) {
      boxCampos.style.display = ativo ? 'grid' : 'none';
    }
    if (hint) {
      hint.textContent = ativo 
        ? 'Controle de quantidade física com bloqueio quando zerado.' 
        : '♾️ Item de Serviço / Fixo sem controle de estoque (venda livre no PDV).';
      hint.style.color = ativo ? 'var(--text-muted)' : '#0284c7';
    }
  },

  bindGlobalDropdownListener() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.category-dropdown-wrapper')) {
        this.fecharDropdownCategorias();
        this.fecharMenuAcoesEstoque();
      }
    });
  },

  renderBarraCategorias() {
    const container = document.getElementById('estoque-category-bar');
    if (!container) return;

    const categorias = StorageService.getCategorias();
    const isSmallScreen = window.innerWidth < 1400;
    const LIMITE_BOTOES_VISIVEIS = isSmallScreen ? 5 : 6;
    const principais = categorias.slice(0, LIMITE_BOTOES_VISIVEIS);
    const extras = categorias.slice(LIMITE_BOTOES_VISIVEIS);

    const isTodasAtiva = this.categoriaFiltro === 'todas';
    const isExtraAtiva = extras.some(c => c.toLowerCase() === this.categoriaFiltro.toLowerCase());
    const extraAtivaNome = isExtraAtiva ? extras.find(c => c.toLowerCase() === this.categoriaFiltro.toLowerCase()) : null;

    let html = `
      <button type="button" class="cat-filter-btn ${isTodasAtiva ? 'active' : ''}" data-cat="todas" onclick="EstoqueModule.filtrarCategoria('todas')">
        Todas
      </button>
    `;

    principais.forEach(cat => {
      const active = (this.categoriaFiltro.toLowerCase() === cat.toLowerCase()) ? 'active' : '';
      const icone = StorageService.getIconeCategoria(cat);
      html += `
        <button type="button" class="cat-filter-btn ${active}" data-cat="${cat}" onclick="EstoqueModule.filtrarCategoria('${cat}')">
          ${icone} ${cat}
        </button>
      `;
    });

    if (extras.length > 0) {
      if (isExtraAtiva && extraAtivaNome) {
        const iconeExtra = StorageService.getIconeCategoria(extraAtivaNome);
        html += `
          <div class="category-dropdown-wrapper" style="position: relative; display: inline-block;">
            <div class="cat-filter-btn active" style="background: var(--accent-orange, #d97706); color: #ffffff; border: 1px solid var(--accent-orange, #d97706); font-weight: 800; display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.3);">
              <span onclick="EstoqueModule.toggleDropdownCategorias(event)" style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
                📂 ${iconeExtra} ${extraAtivaNome} ▾
              </span>
              <span onclick="event.stopPropagation(); EstoqueModule.filtrarCategoria('todas');" title="Voltar para Todas" style="background: rgba(0,0,0,0.25); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; cursor: pointer; margin-left: 2px;">
                ✕
              </span>
            </div>
            <div id="dropdown-mais-categorias" class="category-dropdown-menu" style="display: none;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; padding: 6px 10px 4px 10px; text-transform: uppercase; letter-spacing: 0.5px;">Outras Categorias:</div>
              ${extras.map(cat => {
                const isItemActive = (this.categoriaFiltro.toLowerCase() === cat.toLowerCase());
                const icone = StorageService.getIconeCategoria(cat);
                return `
                  <button type="button" class="category-dropdown-item ${isItemActive ? 'active' : ''}" onclick="EstoqueModule.filtrarCategoria('${cat}'); EstoqueModule.fecharDropdownCategorias();">
                    <span style="font-size: 15px;">${icone}</span>
                    <span style="flex: 1;">${cat}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="category-dropdown-wrapper" style="position: relative; display: inline-block;">
            <button type="button" id="btn-mais-categorias" class="cat-filter-btn" style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; font-weight: 800; display: flex; align-items: center; gap: 5px;" onclick="EstoqueModule.toggleDropdownCategorias(event)">
              📂 Mais Categorias (${extras.length}) ▾
            </button>
            <div id="dropdown-mais-categorias" class="category-dropdown-menu" style="display: none;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; padding: 6px 10px 4px 10px; text-transform: uppercase; letter-spacing: 0.5px;">Outras Categorias:</div>
              ${extras.map(cat => {
                const icone = StorageService.getIconeCategoria(cat);
                return `
                  <button type="button" class="category-dropdown-item" onclick="EstoqueModule.filtrarCategoria('${cat}'); EstoqueModule.fecharDropdownCategorias();">
                    <span style="font-size: 15px;">${icone}</span>
                    <span style="flex: 1;">${cat}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  },

  toggleDropdownCategorias(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('dropdown-mais-categorias');
    if (!dropdown) return;
    const isVis = dropdown.style.display === 'block';
    dropdown.style.display = isVis ? 'none' : 'block';
  },

  fecharDropdownCategorias() {
    const dropdown = document.getElementById('dropdown-mais-categorias');
    if (dropdown) dropdown.style.display = 'none';
  },

  toggleMenuAcoesEstoque(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('dropdown-estoque-acoes');
    if (!dropdown) return;
    const abrir = dropdown.style.display !== 'block';
    this.fecharDropdownCategorias();
    dropdown.style.display = abrir ? 'block' : 'none';
  },

  fecharMenuAcoesEstoque() {
    const dropdown = document.getElementById('dropdown-estoque-acoes');
    if (dropdown) dropdown.style.display = 'none';
  },

  bindBusca() {
    const input = document.getElementById('estoque-busca-input');
    if (input) {
      input.addEventListener('input', () => this.renderTabelaProdutos());
    }
  },

  filtrarCategoria(cat) {
    this.categoriaFiltro = cat;
    this.renderBarraCategorias();
    this.renderTabelaProdutos();
  },

  ordenarPor(coluna) {
    if (this.ordenacaoAtual.coluna === coluna) {
      this.ordenacaoAtual.direcao = this.ordenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenacaoAtual.coluna = coluna;
      // Para preços e estoque, o primeiro clique geralmente prefere maior -> menor
      this.ordenacaoAtual.direcao = (coluna === 'precoVenda' || coluna === 'precoCusto' || coluna === 'estoque') ? 'desc' : 'asc';
    }
    this.atualizarIconesOrdenacao();
    this.renderTabelaProdutos();
  },

  atualizarIconesOrdenacao() {
    const colunas = ['codigo', 'nome', 'categoria', 'precoCusto', 'precoVenda', 'estoque'];
    colunas.forEach(col => {
      const iconEl = document.getElementById(`sort-icon-${col}`);
      const thEl = iconEl?.closest('th');
      if (iconEl) {
        if (this.ordenacaoAtual.coluna === col) {
          iconEl.textContent = this.ordenacaoAtual.direcao === 'asc' ? '▲' : '▼';
          if (thEl) thEl.classList.add('active-sort');
        } else {
          iconEl.textContent = '↕';
          if (thEl) thEl.classList.remove('active-sort');
        }
      }
    });
  },

  limiteExibicaoAtual: 80,
  produtosFiltradosAtual: [],
  scrollInfinitoAtivo: false,

  bindScrollInfinito() {
    const area = document.querySelector('#tab-estoque .table-scroll-area');
    if (!area || this.scrollInfinitoAtivo) return;
    this.scrollInfinitoAtivo = true;
    area.addEventListener('scroll', () => {
      if (area.scrollTop + area.clientHeight >= area.scrollHeight - 150) {
        if (this.produtosFiltradosAtual && this.limiteExibicaoAtual < this.produtosFiltradosAtual.length) {
          this.limiteExibicaoAtual += 60;
          this.renderTabelaProdutos(false);
        }
      }
    });
  },

  renderTabelaProdutos(resetLimite = true) {
    if (resetLimite) this.limiteExibicaoAtual = 80;
    this.bindScrollInfinito();

    const tbody = document.getElementById('estoque-produtos-tbody');
    const busca = document.getElementById('estoque-busca-input')?.value.toLowerCase().trim() || '';
    if (!tbody) return;

    let produtos = StorageService.getProdutos();

    if (this.categoriaFiltro !== 'todas') {
      produtos = produtos.filter(p => p.categoria.toLowerCase() === this.categoriaFiltro.toLowerCase());
    }

    if (this.filtroEstoqueBaixo) {
      produtos = produtos.filter(p => p.controlarEstoque !== false && ((parseFloat(p.estoque) || 0) <= (parseFloat(p.estoqueMinimo) || 5)));
    }

    if (this.filtroListaCompras) {
      produtos = produtos.filter(p => {
        if (p.controlarEstoque === false) return false;
        const est = parseFloat(p.estoque) || 0;
        const estMin = parseFloat(p.estoqueMinimo) || 5;
        return est <= estMin;
      });
    }

    if (this.filtroValidade && this.filtroValidade !== 'todos') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      produtos = produtos.filter(p => {
        if (this.filtroValidade === 'promocao') {
          const precoClube = parseFloat(p.precoClube) || 0;
          return p.emPromocao === true
            || (p.precoPromocional && p.precoPromocional < p.precoVenda)
            || (p.precoOriginal && p.precoVenda < p.precoOriginal)
            || precoClube > 0;
        }
        if (!p.dataValidade) return false;
        const dataVal = new Date(p.dataValidade + 'T00:00:00');
        const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));
        if (this.filtroValidade === 'vencidos') return diffDias < 0;
        if (this.filtroValidade === 'vence15d') return diffDias >= 0 && diffDias <= 15;
        if (this.filtroValidade === 'vence30d') return diffDias >= 0 && diffDias <= 30;
        if (this.filtroValidade === 'vence60d') return diffDias >= 0 && diffDias <= 60;
        return true;
      });
    }

    if (busca) {
      produtos = produtos.filter(p => 
        p.nome.toLowerCase().includes(busca) || 
        p.codigoBarras.includes(busca) ||
        p.id.toLowerCase().includes(busca)
      );
    }

    // Aplicar Ordenação Clicável
    if (this.ordenacaoAtual.coluna) {
      const { coluna, direcao } = this.ordenacaoAtual;
      produtos.sort((a, b) => {
        let valA, valB;
        if (coluna === 'nome') {
          valA = (a.nome || '').toLowerCase();
          valB = (b.nome || '').toLowerCase();
          return direcao === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
        } else if (coluna === 'categoria') {
          valA = (a.categoria || '').toLowerCase();
          valB = (b.categoria || '').toLowerCase();
          return direcao === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
        } else if (coluna === 'precoCusto') {
          valA = parseFloat(a.precoCusto) || 0;
          valB = parseFloat(b.precoCusto) || 0;
          return direcao === 'asc' ? valA - valB : valB - valA;
        } else if (coluna === 'precoVenda') {
          valA = parseFloat(a.precoVenda) || 0;
          valB = parseFloat(b.precoVenda) || 0;
          return direcao === 'asc' ? valA - valB : valB - valA;
        } else if (coluna === 'precoPromocional') {
          const precoEspecial = (p) => {
            if (p.emPromocao) return parseFloat(p.precoPromocional || p.precoVenda) || 0;
            const clube = parseFloat(p.precoClube) || 0;
            return clube > 0 ? clube : 999999;
          };
          valA = precoEspecial(a);
          valB = precoEspecial(b);
          return direcao === 'asc' ? valA - valB : valB - valA;
        } else if (coluna === 'estoque') {
          valA = a.controlarEstoque === false ? 999999 : (parseFloat(a.estoque) || 0);
          valB = b.controlarEstoque === false ? 999999 : (parseFloat(b.estoque) || 0);
          return direcao === 'asc' ? valA - valB : valB - valA;
        } else if (coluna === 'codigo') {
          valA = (a.codigoBarras || '').toLowerCase();
          valB = (b.codigoBarras || '').toLowerCase();
          return direcao === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
        }
        return 0;
      });
    }

    this.produtosFiltradosAtual = produtos;
    const contadorEl = document.getElementById('estoque-produtos-contador');
    if (contadorEl) {
      if (this.filtroListaCompras) {
        contadorEl.innerHTML = `📋 Lista de Compras: <strong>${produtos.length} ${produtos.length === 1 ? 'produto para reposição' : 'produtos para reposição'}</strong>`;
      } else {
        contadorEl.innerHTML = `📦 Total: <strong>${produtos.length} ${produtos.length === 1 ? 'produto listado' : 'produtos listados'}</strong>`;
      }
    }

    if (produtos.length === 0) {
      if (this.filtroListaCompras) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 36px 16px; color: #0f766e; font-size: 14px; font-weight: 700;">🎉 Parabéns! Nenhum produto precisa de compras ou reposição no momento (todos estão acima do estoque mínimo).</td></tr>`;
      } else {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-dim);">Nenhum produto cadastrado nesta categoria.</td></tr>`;
      }
      return;
    }

    const prodsExibir = produtos.slice(0, this.limiteExibicaoAtual);
    const podeVerCustos = (window.AuthModule && typeof window.AuthModule.temPermissao === 'function') 
      ? window.AuthModule.temPermissao('verCustos') 
      : true;
    const clubeAtivo = StorageService.isModuloAtivo('clubeFidelidade');

    tbody.innerHTML = prodsExibir.map(p => {
      const controlaEstoque = p.controlarEstoque !== false;
      let statusClass = 'ok';
      let statusTexto = 'Estoque Normal';
      if (controlaEstoque) {
        if (p.estoque <= 0) {
          statusClass = 'zero';
          statusTexto = 'Esgotado';
        } else if (p.estoque <= p.estoqueMinimo) {
          statusClass = 'low';
          statusTexto = 'Estoque Baixo';
        }
      }

      // Validação visual de Validade (se ativo na licença)
      const isValidadeAtivo = StorageService.isModuloAtivo('validadeLotes');
      let validadeHtml = '';
      if (isValidadeAtivo && p.dataValidade) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVal = new Date(p.dataValidade + 'T00:00:00');
        const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));

        if (diffDias < 0) {
          validadeHtml = `<div style="margin-top: 3px;"><span class="badge-stock zero" style="font-size: 10px; padding: 2px 7px; display: inline-flex; width: fit-content; max-width: max-content; border-radius: 4px;">🚨 Vencido (${dataVal.toLocaleDateString('pt-BR')})</span></div>`;
        } else if (diffDias <= 15) {
          const textoDias = diffDias === 0 ? 'Vence Hoje!' : `Vence em ${diffDias}d`;
          validadeHtml = `<div style="margin-top: 3px;"><span class="badge-stock zero" style="font-size: 10px; padding: 2px 7px; display: inline-flex; width: fit-content; max-width: max-content; border-radius: 4px;">🚨 ${textoDias} (${dataVal.toLocaleDateString('pt-BR')})</span></div>`;
        } else if (diffDias <= 30) {
          validadeHtml = `<div style="margin-top: 3px;"><span class="badge-stock low" style="font-size: 10px; padding: 2px 7px; display: inline-flex; width: fit-content; max-width: max-content; border-radius: 4px;">⏳ Vence em ${diffDias}d (${dataVal.toLocaleDateString('pt-BR')})</span></div>`;
        } else {
          validadeHtml = `<div style="margin-top: 3px;"><span style="font-size: 10.5px; color: var(--text-dim); display: inline-flex; width: fit-content; max-width: max-content;">Val: ${dataVal.toLocaleDateString('pt-BR')}</span></div>`;
        }
      }

      let stockHtml = '';
      if (!controlaEstoque) {
        stockHtml = `
          <span class="badge-stock ok" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
            ♾️ Serviço / Fixo
          </span>
        `;
      } else {
        stockHtml = `
          <span class="badge-stock ${statusClass}">
            ${p.estoque} ${p.unidade || 'un'} (${statusTexto})
          </span>
        `;
      }

      const custoFormatado = podeVerCustos ? `R$ ${(p.precoCusto || 0).toFixed(2).replace('.', ',')}` : '***';
      const precoClube = clubeAtivo && parseFloat(p.precoClube) > 0 ? parseFloat(p.precoClube) : 0;
      const precosEspeciaisHtml = (p.emPromocao || precoClube > 0) ? `
        <div class="precos-especiais-cell">
          ${p.emPromocao ? `<span class="preco-especial promo"><small>PROMO</small>R$ ${(p.precoPromocional || p.precoVenda || 0).toFixed(2).replace('.', ',')}</span>` : ''}
          ${precoClube > 0 ? `<span class="preco-especial clube"><small>CLUBE</small>R$ ${precoClube.toFixed(2).replace('.', ',')}</span>` : ''}
        </div>
      ` : '<span class="preco-especial-vazio">-</span>';

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono'; font-weight: 700; color: var(--text-main);">
            <div>${p.codigoBarras || '-'}</div>
            ${p.codigoBarrasFardo ? `<div style="font-size: 10.5px; color: #6366f1; font-weight: 600; margin-top: 2px;">📦 Fardo: ${p.codigoBarrasFardo}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <strong style="color: var(--text-main); font-size: 14px;">${p.nome}</strong>
              ${p.precoFardo ? `<span style="font-size: 11px; color: #4338ca; font-weight: 700;">📦 ${p.unidadeFracionada || 'Fardo'}: R$ ${p.precoFardo.toFixed(2).replace('.', ',')} (c/ ${p.fatorConversao || 1} un)</span>` : ''}
              ${p.permiteFracionado ? `<span style="font-size: 10.5px; color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 4px; padding: 1px 5px; font-weight: 700;">⚖️ Venda Fracionada (Decimais)</span>` : ''}
              ${validadeHtml}
            </div>
          </td>
          <td style="text-align: center; white-space: nowrap;"><span class="category-tag">${p.categoria}</span></td>
          <td style="text-align: center; font-weight: 700; color: var(--text-muted); font-family: 'JetBrains Mono';">${custoFormatado}</td>
          <td style="text-align: center;">
            ${p.emPromocao ? `
              <div style="display: flex; flex-direction: column; align-items: center; gap: 1px;">
                <span style="text-decoration: line-through; color: var(--text-dim); font-size: 12px; font-family: 'JetBrains Mono'; font-weight: 700;">R$ ${(p.precoOriginal || p.precoVenda).toFixed(2).replace('.', ',')}</span>
              </div>
            ` : `
              <strong style="color: var(--accent-green); font-size: 14.5px; font-family: 'JetBrains Mono';">R$ ${(p.precoVenda || 0).toFixed(2).replace('.', ',')}</strong>
            `}
          </td>
          <td style="text-align: center;">
            ${precosEspeciaisHtml}
          </td>
          <td style="text-align: center;">
            ${stockHtml}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button type="button" class="btn-action-sm" onclick="EstoqueModule.abrirModalProduto('${p.id}')" title="Editar Produto">✏️</button>
              <button type="button" class="btn-action-sm" onclick="EstoqueModule.abrirModalAjuste('${p.id}')" title="Entrada de Mercadoria / Registro de Quebras">📦</button>
              <button type="button" class="btn-action-sm danger" onclick="EstoqueModule.excluirProduto('${p.id}')" title="Excluir do Estoque">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.verificarAlertasValidade();
  },

  abrirModalProduto(id = null) {
    this.executarAberturaModalProduto(id);
  },

  executarAberturaModalProduto(id = null) {
    this.produtoEditandoId = id;
    const modal = document.getElementById('modal-novo-produto');
    const form = document.getElementById('form-produto');
    const title = document.getElementById('modal-produto-title');
    const catSelect = document.getElementById('prod-categoria');
    const categorias = StorageService.getCategorias();

    const erroCatAntigo = document.getElementById('prod-categoria-erro-hint');
    if (erroCatAntigo) erroCatAntigo.remove();

    if (catSelect) {
      catSelect.style.border = '';
      catSelect.style.background = '';
      catSelect.innerHTML = `
        <option value="" disabled selected style="color: #94a3b8;">-- Selecione uma Categoria --</option>
        ${categorias.map(c => `<option value="${c}">${StorageService.getIconeCategoria(c)} ${c}</option>`).join('')}
      `;
      catSelect.onchange = () => {
        catSelect.style.border = '';
        catSelect.style.background = '';
        const err = document.getElementById('prod-categoria-erro-hint');
        if (err) err.remove();
      };
    }

    this.adaptarInterfaceSegmento();

    if (form) form.reset();

    const scrollBody = document.getElementById('modal-produto-scroll-body') || (modal ? modal.querySelector('.modal-body-content') : null);
    if (scrollBody) scrollBody.scrollTop = 0;

    if (id) {
      if (title) title.textContent = '✏️ Editar Produto';
      const produtos = StorageService.getProdutos();
      const p = produtos.find(item => item.id === id);
      if (p) {
        document.getElementById('prod-codigo-barras').value = p.codigoBarras || '';
        document.getElementById('prod-nome').value = p.nome || '';
        
        const catValida = p.categoria && categorias.some(c => c.toLowerCase() === p.categoria.toLowerCase());
        if (catValida && catSelect) {
          catSelect.value = p.categoria;
        } else if (catSelect) {
          catSelect.value = '';
          catSelect.style.border = '2px solid #dc2626';
          catSelect.style.background = '#fef2f2';
          const erroSpan = document.createElement('span');
          erroSpan.id = 'prod-categoria-erro-hint';
          erroSpan.style.cssText = 'font-size: 11px; color: #dc2626; font-weight: 800; display: block; margin-top: 4px;';
          erroSpan.innerHTML = `⚠️ Categoria "${p.categoria || 'não definida'}" não existe na loja! Selecione uma opção válida acima.`;
          catSelect.parentNode.appendChild(erroSpan);
        }

        document.getElementById('prod-preco-custo').value = this.formatarMoedaParaExibir(p.precoCusto);
        document.getElementById('prod-preco-venda').value = this.formatarMoedaParaExibir(p.precoVenda);
        const precoClubeEl = document.getElementById('prod-preco-clube');
        if (precoClubeEl) precoClubeEl.value = this.formatarMoedaParaExibir(p.precoClube);
        
        const controlaEstoque = p.controlarEstoque !== false;
        this.toggleControleEstoque(controlaEstoque);

        document.getElementById('prod-estoque-atual').value = (p.estoque !== undefined && p.estoque !== null) ? p.estoque : 0;
        document.getElementById('prod-estoque-minimo').value = p.estoqueMinimo || 5;
        document.getElementById('prod-unidade-fracionada').value = p.unidadeFracionada || '';
        document.getElementById('prod-fator-conversao').value = p.fatorConversao || '';
        document.getElementById('prod-preco-fardo').value = this.formatarMoedaParaExibir(p.precoFardo);
        document.getElementById('prod-codigo-barras-fardo').value = p.codigoBarrasFardo || '';
        
        const fracionadoCheck = document.getElementById('prod-permite-fracionado');
        if (fracionadoCheck) fracionadoCheck.checked = p.permiteFracionado === true;

        const valInput = document.getElementById('prod-data-validade');
        if (valInput) valInput.value = p.dataValidade || '';

        // Campos Fiscais
        const ncmEl = document.getElementById('prod-ncm');
        if (ncmEl) ncmEl.value = p.ncm || '';
        const cestEl = document.getElementById('prod-cest');
        if (cestEl) cestEl.value = p.cest || '';
        const cfopEl = document.getElementById('prod-cfop');
        if (cfopEl) cfopEl.value = p.cfop || '5102';
        const csosnEl = document.getElementById('prod-csosn');
        if (csosnEl) csosnEl.value = p.csosn || '102';
        const origemEl = document.getElementById('prod-origem');
        if (origemEl) origemEl.value = p.origem || '0';

        const temFiscal = Boolean(p.ncm || p.cest || (p.cfop && p.cfop !== '5102') || (p.csosn && p.csosn !== '102'));
        this.toggleDadosFiscais(temFiscal);

        // Se tem grade cadastrada, abre expandido; senão, recolhido
        const temGrade = Boolean(p.unidadeFracionada || p.precoFardo || p.codigoBarrasFardo);
        this.toggleGradeFracionada(temGrade);
      }
    } else {
      if (title) title.textContent = '➕ Cadastrar Novo Produto';
      const fracionadoCheck = document.getElementById('prod-permite-fracionado');
      if (fracionadoCheck) fracionadoCheck.checked = false;
      const valInput = document.getElementById('prod-data-validade');
      if (valInput) valInput.value = '';

      const ncmEl = document.getElementById('prod-ncm');
      if (ncmEl) ncmEl.value = '';
      const cestEl = document.getElementById('prod-cest');
      if (cestEl) cestEl.value = '';
      const cfopEl = document.getElementById('prod-cfop');
      if (cfopEl) cfopEl.value = '5102';
      const csosnEl = document.getElementById('prod-csosn');
      if (csosnEl) csosnEl.value = '102';
      const origemEl = document.getElementById('prod-origem');
      if (origemEl) origemEl.value = '0';
      this.toggleDadosFiscais(false);
      document.getElementById('prod-codigo-barras').value = '';
      document.getElementById('prod-nome').value = '';
      document.getElementById('prod-categoria').value = categorias[0] || 'Geral';
      document.getElementById('prod-preco-custo').value = '';
      document.getElementById('prod-preco-venda').value = '';
      this.toggleControleEstoque(true);
      document.getElementById('prod-estoque-atual').value = '';
      document.getElementById('prod-estoque-minimo').value = '5';
      document.getElementById('prod-unidade-fracionada').value = '';
      document.getElementById('prod-fator-conversao').value = '';
      document.getElementById('prod-preco-fardo').value = '';
      document.getElementById('prod-codigo-barras-fardo').value = '';
      this.toggleGradeFracionada(false);
      setTimeout(() => document.getElementById('prod-codigo-barras')?.focus(), 150);
    }

    const inputPrecoFardo = document.getElementById('prod-preco-fardo');
    if (inputPrecoFardo) inputPrecoFardo.dataset.autoCalculado = id ? 'false' : 'true';
    this.atualizarFeedbackDescontoGrade();

    if (modal) modal.classList.add('active');
  },

  gerarCodigoInternoAutomatico() {
    const input = document.getElementById('prod-codigo-barras');
    if (!input) return;

    const produtos = StorageService.getProdutos();
    const codigosExistentes = new Set();
    produtos.forEach(p => {
      if (p.codigoBarras) codigosExistentes.add(String(p.codigoBarras).trim().toUpperCase());
      if (p.codigoBarrasFardo) codigosExistentes.add(String(p.codigoBarrasFardo).trim().toUpperCase());
    });

    // Gerar código de 13 dígitos iniciado em '2000' (Padrão GS1 de código interno para lojas)
    let novoCodigo = '';
    do {
      const rand = Math.floor(100000000 + Math.random() * 900000000);
      novoCodigo = '2000' + rand;
    } while (codigosExistentes.has(novoCodigo));

    input.value = novoCodigo;
    input.style.borderColor = '';
    if (window.App && typeof window.App.showToast === 'function') {
      window.App.showToast(`🎲 Código de barras gerado: ${novoCodigo}`, 'info');
    }
  },

  fecharModalProduto() {
    const modal = document.getElementById('modal-novo-produto');
    if (modal) modal.classList.remove('active');
    const inputCod = document.getElementById('prod-codigo-barras');
    if (inputCod) inputCod.style.borderColor = '';
    const inputCodFardo = document.getElementById('prod-codigo-barras-fardo');
    if (inputCodFardo) inputCodFardo.style.borderColor = '';
  },

  salvarProduto(e) {
    e.preventDefault();

    const codigoBarras = document.getElementById('prod-codigo-barras').value.trim().toUpperCase();
    const nome = (document.getElementById('prod-nome').value.trim() || '').toUpperCase();
    const precoCusto = this.parseMoedaBR(document.getElementById('prod-preco-custo').value);
    const precoVenda = this.parseMoedaBR(document.getElementById('prod-preco-venda').value);
    const precoClube = this.parseMoedaBR(document.getElementById('prod-preco-clube')?.value || '');
    const controlarEstoque = document.getElementById('prod-controlar-estoque')?.checked ?? true;
    const estoque = controlarEstoque ? (parseInt(document.getElementById('prod-estoque-atual').value, 10) || 0) : 0;
    const estoqueMinimo = controlarEstoque ? (parseInt(document.getElementById('prod-estoque-minimo').value, 10) || 5) : 0;
    
    const camposGrade = document.getElementById('grade-fracionada-campos');
    const isGradeAberta = camposGrade && camposGrade.style.display !== 'none';

    const unidadeFracionada = isGradeAberta ? document.getElementById('prod-unidade-fracionada').value.trim() : '';
    const fatorConversao = isGradeAberta ? (parseInt(document.getElementById('prod-fator-conversao').value, 10) || null) : null;
    const precoFardo = isGradeAberta ? (this.parseMoedaBR(document.getElementById('prod-preco-fardo').value) || null) : null;
    const codigoBarrasFardo = isGradeAberta ? document.getElementById('prod-codigo-barras-fardo').value.trim().toUpperCase() : '';

    const catSelect = document.getElementById('prod-categoria');
    const categoria = (catSelect?.value || '').trim();
    const categorias = StorageService.getCategorias();
    const isCatValida = Boolean(categoria && categorias.some(c => c.toLowerCase() === categoria.toLowerCase()));

    if (!isCatValida) {
      if (catSelect) {
        catSelect.style.border = '2px solid #dc2626';
        catSelect.style.background = '#fef2f2';
        catSelect.focus();
        let errHint = document.getElementById('prod-categoria-erro-hint');
        if (!errHint) {
          errHint = document.createElement('span');
          errHint.id = 'prod-categoria-erro-hint';
          errHint.style.cssText = 'font-size: 11px; color: #dc2626; font-weight: 800; display: block; margin-top: 4px;';
          catSelect.parentNode.appendChild(errHint);
        }
        errHint.innerHTML = '⚠️ Categoria obrigatória! Por favor, selecione uma categoria válida para o produto.';
      }
      window.App.showToast('⚠️ Categoria obrigatória! Selecione uma categoria válida da lista.', 'error');
      return;
    }

    if (!nome || precoVenda <= 0) {
      window.App.showToast('Informe ao menos o nome e o preço de venda válido!', 'warning');
      return;
    }

    let produtos = StorageService.getProdutos();

    // 1. BLOQUEIO DE CÓDIGO DE BARRAS DUPLICADO (CÓDIGO PRINCIPAL / UNITÁRIO)
    if (codigoBarras) {
      const duplicado = produtos.find(p => {
        if (this.produtoEditandoId && p.id === this.produtoEditandoId) return false;
        const codP = String(p.codigoBarras || '').trim().toUpperCase();
        const codFardo = String(p.codigoBarrasFardo || '').trim().toUpperCase();
        return (codP && codP === codigoBarras) || (codFardo && codFardo === codigoBarras);
      });

      if (duplicado) {
        window.App.showToast(`⚠️ O código de barras "${codigoBarras}" já está cadastrado no produto "${duplicado.nome}"!`, 'warning');
        const inputCod = document.getElementById('prod-codigo-barras');
        if (inputCod) {
          inputCod.style.borderColor = '#ef4444';
          inputCod.focus();
          inputCod.select();
        }
        return;
      }
    }

    // 2. BLOQUEIO DE CÓDIGO DE BARRAS DUPLICADO (FARDO / KIT)
    if (codigoBarrasFardo) {
      if (codigoBarras && codigoBarrasFardo === codigoBarras) {
        window.App.showToast('⚠️ O código de barras do Fardo/Kit não pode ser igual ao código unitário do próprio produto!', 'warning');
        const inputCodFardo = document.getElementById('prod-codigo-barras-fardo');
        if (inputCodFardo) {
          inputCodFardo.style.borderColor = '#ef4444';
          inputCodFardo.focus();
          inputCodFardo.select();
        }
        return;
      }

      const duplicadoFardo = produtos.find(p => {
        if (this.produtoEditandoId && p.id === this.produtoEditandoId) return false;
        const codP = String(p.codigoBarras || '').trim().toUpperCase();
        const codF = String(p.codigoBarrasFardo || '').trim().toUpperCase();
        return (codP && codP === codigoBarrasFardo) || (codF && codF === codigoBarrasFardo);
      });

      if (duplicadoFardo) {
        window.App.showToast(`⚠️ O código do Fardo "${codigoBarrasFardo}" já está cadastrado no produto "${duplicadoFardo.nome}"!`, 'warning');
        const inputCodFardo = document.getElementById('prod-codigo-barras-fardo');
        if (inputCodFardo) {
          inputCodFardo.style.borderColor = '#ef4444';
          inputCodFardo.focus();
          inputCodFardo.select();
        }
        return;
      }
    }

    if (this.produtoEditandoId) {
      const index = produtos.findIndex(p => p.id === this.produtoEditandoId);
      if (index !== -1) {
        produtos[index] = {
          ...produtos[index],
          codigoBarras,
          nome: nome.toUpperCase(),
          atualizadoEm: new Date().toISOString(),
          categoria,
          precoCusto,
          precoVenda,
        precoClube,
          controlarEstoque,
          estoque,
          estoqueMinimo,
          unidadeFracionada: unidadeFracionada || null,
          fatorConversao: fatorConversao || null,
          precoFardo: precoFardo || null,
          codigoBarrasFardo: codigoBarrasFardo || null,
          permiteFracionado: document.getElementById('prod-permite-fracionado')?.checked || false,
          dataValidade: document.getElementById('prod-data-validade')?.value || '',
          ncm: document.getElementById('prod-ncm')?.value.trim() || null,
          cest: document.getElementById('prod-cest')?.value.trim() || null,
          cfop: document.getElementById('prod-cfop')?.value.trim() || '5102',
          csosn: document.getElementById('prod-csosn')?.value.trim() || '102',
          origem: document.getElementById('prod-origem')?.value || '0'
        };

        // Log de Auditoria de Edição
        AuditModule.registrarLog('edicao_produto', `Editou o produto "${nome}" (Código: ${codigoBarras || '-'}, Venda: R$ ${precoVenda.toFixed(2)}, Estoque: ${estoque} un)`, {
          produtoId: this.produtoEditandoId,
          nome: nome,
          codigoBarras: codigoBarras,
          precoVenda: precoVenda,
        precoClube,
          estoque: estoque
        });
      }
    } else {
      // Se não informou código de barras, gera um código automático garantindo unicidade
      let codFinal = codigoBarras;
      if (!codFinal) {
        const codigosExistentes = new Set();
        produtos.forEach(p => {
          if (p.codigoBarras) codigosExistentes.add(String(p.codigoBarras).trim().toUpperCase());
          if (p.codigoBarrasFardo) codigosExistentes.add(String(p.codigoBarrasFardo).trim().toUpperCase());
        });
        do {
          const rand = Math.floor(100000000 + Math.random() * 900000000);
          codFinal = '2000' + rand;
        } while (codigosExistentes.has(codFinal));
      }

      const novoProduto = {
        id: 'PRD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        codigoBarras: codFinal,
        nome: nome.toUpperCase(),
        atualizadoEm: new Date().toISOString(),
        categoria,
        precoCusto,
        precoVenda,
        precoClube,
        controlarEstoque,
        estoque,
        estoqueMinimo,
        unidadeFracionada: unidadeFracionada || null,
        fatorConversao: fatorConversao || null,
        precoFardo: precoFardo || null,
        codigoBarrasFardo: codigoBarrasFardo || null,
        permiteFracionado: document.getElementById('prod-permite-fracionado')?.checked || false,
        dataValidade: document.getElementById('prod-data-validade')?.value || '',
        ncm: document.getElementById('prod-ncm')?.value.trim() || null,
        cest: document.getElementById('prod-cest')?.value.trim() || null,
        cfop: document.getElementById('prod-cfop')?.value.trim() || '5102',
        csosn: document.getElementById('prod-csosn')?.value.trim() || '102',
        origem: document.getElementById('prod-origem')?.value || '0'
      };
      produtos.push(novoProduto);

      // Log de Auditoria de Cadastro
      AuditModule.registrarLog('cadastro_produto', `Cadastrou o novo produto "${novoProduto.nome}" (Código: ${novoProduto.codigoBarras}, Venda: R$ ${novoProduto.precoVenda.toFixed(2)}, Estoque: ${novoProduto.estoque} un)`, {
        produtoId: novoProduto.id,
        nome: novoProduto.nome,
        codigoBarras: novoProduto.codigoBarras,
        precoVenda: novoProduto.precoVenda,
        precoClube,
        estoque: novoProduto.estoque
      });
    }

    StorageService.saveProdutos(produtos);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('produtos');
    }
    this.fecharModalProduto();
    this.renderTabelaProdutos();
    window.App.showToast('Produto salvo com sucesso!', 'success');
  },

  excluirProduto(id) {
    AuthModule.solicitarAutorizacaoGerente(() => {
      const produtos = StorageService.getProdutos() || [];
      const p = produtos.find(item => item.id === id);
      const nomeProd = p ? p.nome : id;
      const codBarras = p ? p.codigoBarras : '';

      window.App.confirmarAcao({
        icone: '🗑️',
        titulo: 'Excluir Produto',
        mensagem: `Tem certeza que deseja excluir o produto:<br><strong style="color: #0f172a; font-size: 15px; display: inline-block; margin: 6px 0;">"${nomeProd}"</strong><br><span style="font-size: 12px; color: #64748b; font-family: 'JetBrains Mono';">Código EAN: ${codBarras || 'Sem Código'}</span>`,
        textoConfirmar: '🗑️ Sim, Excluir [ENTER]',
        textoCancelar: 'Cancelar [ESC]',
        perigo: true,
        onConfirm: () => {
          StorageService.adicionarProdutoExcluidoId(id);
          const novaLista = produtos.filter(p => p.id !== id);
          StorageService.saveProdutos(novaLista);
          if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
            window.CloudSyncModule.enviarAlteracaoNuvem('produtos');
          }

          // Registrar Log de Auditoria no Master
          AuditModule.registrarLog('exclusao_produto', `Excluiu o produto "${nomeProd}" (Código: ${codBarras || 'S/N'})`, {
            produtoId: id,
            nome: nomeProd,
            codigoBarras: codBarras
          });

          this.renderTabelaProdutos();
          window.App.showToast('Produto excluído com sucesso!', 'info');
        }
      });
    });
  },

  // Modal de Ajuste de Estoque & Entrada de Mercadorias (Ícone da Caixa 📦)
  abrirModalAjuste(id) {
    AuthModule.solicitarAutorizacaoGerente(() => {
      this.executarAberturaModalAjuste(id);
    });
  },

  executarAberturaModalAjuste(id) {
    this.produtoAjustandoId = id;
    const produtos = StorageService.getProdutos();
    const p = produtos.find(item => item.id === id);
    if (!p) return;

    if (p.controlarEstoque === false) {
      if (confirm(`ℹ️ O item "${p.nome}" está cadastrado como Serviço / Fixo sem controle de quantidade.\n\nDeseja editar este produto e ativar o controle de estoque?`)) {
        this.abrirModalProduto(p.id);
      }
      return;
    }

    const modal = document.getElementById('modal-ajuste-estoque');
    const nomeEl = document.getElementById('ajuste-prod-nome');
    const estoqueEl = document.getElementById('ajuste-prod-estoque-atual');
    const inputQtd = document.getElementById('ajuste-qtd-input');
    const inputMotivo = document.getElementById('ajuste-motivo-input');

    if (nomeEl) nomeEl.textContent = p.nome;
    if (estoqueEl) estoqueEl.textContent = `${p.estoque} unidades`;
    if (inputQtd) {
      inputQtd.value = '';
      setTimeout(() => inputQtd.focus(), 150);
    }
    if (inputMotivo) inputMotivo.value = '';

    this.atualizarLabelAjuste();
    if (modal) modal.classList.add('active');
  },

  fecharModalAjuste() {
    const modal = document.getElementById('modal-ajuste-estoque');
    if (modal) modal.classList.remove('active');
  },

  atualizarLabelAjuste() {
    const tipo = document.getElementById('ajuste-tipo-mov')?.value || 'entrada';
    const label = document.getElementById('ajuste-qtd-label');
    if (label) {
      if (tipo === 'entrada') label.textContent = 'Quantidade a Adicionar (+):';
      else if (tipo === 'perda') label.textContent = 'Quantidade a Retirar (-):';
      else if (tipo === 'balanco') label.textContent = 'Nova Quantidade Real Contada (=):';
    }
  },

  confirmarAjusteEstoque(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!this.produtoAjustandoId) return;

    const produtos = StorageService.getProdutos();
    const p = produtos.find(item => item.id === this.produtoAjustandoId);
    if (!p) return;

    const tipo = document.getElementById('ajuste-tipo-mov')?.value || 'entrada';
    const qtd = parseInt(document.getElementById('ajuste-qtd-input')?.value, 10);
    const motivo = document.getElementById('ajuste-motivo-input')?.value.trim() || 'Ajuste Manual';

    if (isNaN(qtd) || qtd < 0) {
      window.App.showToast('Informe uma quantidade válida!', 'warning');
      return;
    }

    const estoqueAtual = Number(p.estoque) || 0;
    let delta = 0;
    if (tipo === 'entrada') {
      delta = qtd;
      p.estoque = estoqueAtual + qtd;
    } else if (tipo === 'perda') {
      delta = -Math.min(estoqueAtual, qtd);
      p.estoque = Math.max(0, estoqueAtual - qtd);
    } else if (tipo === 'balanco') {
      delta = qtd - estoqueAtual;
      p.estoque = qtd;
    }
    p.atualizadoEm = new Date().toISOString();
    StorageService.registrarMovimentoEstoque({
      produtoId: p.id,
      delta,
      origem: 'ajuste',
      refId: tipo
    });

    StorageService.saveProdutos(produtos);
    if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
      window.CloudSyncModule.enviarAlteracaoNuvem('produtos');
    }

    // Log de Auditoria de Ajuste de Estoque
    const sinal = tipo === 'entrada' ? '+' : (tipo === 'perda' ? '-' : '=');
    AuditModule.registrarLog('ajuste_estoque', `Ajuste manual de estoque no item "${p.nome}": ${sinal}${qtd} un. Motivo: ${motivo} (Novo Estoque: ${p.estoque} un)`, {
      produtoId: p.id,
      nome: p.nome,
      tipo: tipo,
      quantidade: qtd,
      novoEstoque: p.estoque,
      motivo: motivo
    });

    this.fecharModalAjuste();
    this.renderTabelaProdutos();
    window.App.showToast(`🎉 Estoque de ${p.nome} atualizado para ${p.estoque} un! (${motivo})`, 'success');
  },

  async exportarEstoqueExcel() {
    const produtos = StorageService.getProdutos();
    if (!produtos || produtos.length === 0) {
      window.App.showToast('Nenhum produto cadastrado para exportar!', 'warning');
      return;
    }

    const cfg = StorageService.getConfig() || {};
    const nomeEmpresa = cfg.nomeEmpresa || 'FlowPDV';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FlowPDV';
    workbook.created = new Date();

    // Estilos
    const fontTitle = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontSubtitle = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
    const fontColHeader = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const fontBold = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    const fontRegular = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
    const fontGreen = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } };
    const fontRed = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } };
    const fontAmber = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD97706' } };

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // ========== ABA 1: ESTOQUE COMPLETO ==========
    const ws = workbook.addWorksheet('Estoque Completo', { views: [{ showGridLines: true }] });

    ws.columns = [
      { key: 'A', width: 6 },
      { key: 'B', width: 18 },
      { key: 'C', width: 36 },
      { key: 'D', width: 16 },
      { key: 'E', width: 14 },
      { key: 'F', width: 14 },
      { key: 'G', width: 12 },
      { key: 'H', width: 12 },
      { key: 'I', width: 16 },
      { key: 'J', width: 14 }
    ];

    // Banner
    ws.mergeCells('A1:J1');
    const t1 = ws.getCell('A1');
    t1.value = `${nomeEmpresa.toUpperCase()} — RELATÓRIO GERAL DE PRODUTOS & ESTOQUE`;
    t1.font = fontTitle;
    t1.alignment = { vertical: 'middle', horizontal: 'center' };
    t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    ws.getRow(1).height = 36;

    ws.mergeCells('A2:J2');
    const t2 = ws.getCell('A2');
    t2.value = `Gerado em: ${new Date().toLocaleString('pt-BR')} | Total de Itens: ${produtos.length} | Sistema FlowPDV`;
    t2.font = fontSubtitle;
    t2.alignment = { vertical: 'middle', horizontal: 'center' };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    ws.getRow(2).height = 22;

    // Cabeçalhos
    const headers = ['#', 'Código Barras', 'Nome do Produto', 'Categoria', 'Preço Custo', 'Preço Venda', 'Estoque', 'Margem %', 'Valor Estoque', 'Status'];
    headers.forEach((h, i) => {
      const col = String.fromCharCode(65 + i);
      const cell = ws.getCell(`${col}4`);
      cell.value = h;
      cell.font = fontColHeader;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'right' : (i === 0 ? 'center' : 'left') };
      cell.border = borderThin;
    });
    ws.getRow(4).height = 26;

    // Ordenar por categoria e nome
    const produtosOrdenados = [...produtos].sort((a, b) => {
      const catA = (a.categoria || 'Sem Categoria').toLowerCase();
      const catB = (b.categoria || 'Sem Categoria').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      return (a.nome || '').toLowerCase().localeCompare((b.nome || '').toLowerCase());
    });

    let totalCustoEstoque = 0;
    let totalVendaEstoque = 0;
    let produtosZerados = 0;
    let produtosBaixos = 0;

    produtosOrdenados.forEach((p, idx) => {
      const row = 5 + idx;
      ws.getRow(row).height = 20;

      const controlaEstoque = p.controlarEstoque !== false;
      const precoCusto = parseFloat(p.precoCusto) || 0;
      const precoVenda = parseFloat(p.precoVenda) || 0;
      const estoque = controlaEstoque ? (parseInt(p.estoque) || 0) : 0;
      const margem = precoCusto > 0 ? (((precoVenda - precoCusto) / precoCusto) * 100) : 0;
      const valorEstoque = controlaEstoque ? (precoVenda * estoque) : 0;

      if (controlaEstoque) {
        totalCustoEstoque += precoCusto * estoque;
        totalVendaEstoque += valorEstoque;
        if (estoque === 0) produtosZerados++;
        if (estoque > 0 && estoque <= 5) produtosBaixos++;
      }

      let status = 'OK';
      let statusFont = fontGreen;
      if (!controlaEstoque) {
        status = 'SERVIÇO/FIXO';
        statusFont = fontAmber;
      } else if (estoque === 0) {
        status = 'ZERADO';
        statusFont = fontRed;
      } else if (estoque <= 5) {
        status = 'BAIXO';
        statusFont = fontAmber;
      }

      const isEven = idx % 2 === 0;
      const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      const estoqueDisplay = controlaEstoque ? estoque : 'Infinito';
      const vals = [idx + 1, p.codigoBarras || '-', p.nome || 'Sem Nome', p.categoria || 'Sem Categoria', precoCusto, precoVenda,
        precoClube, estoqueDisplay, margem, valorEstoque, status];
      vals.forEach((v, i) => {
        const col = String.fromCharCode(65 + i);
        const cell = ws.getCell(`${col}${row}`);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = borderThin;

        if (i === 0) {
          cell.font = fontRegular;
          cell.alignment = { horizontal: 'center' };
        } else if (i === 4 || i === 5 || i === 8) {
          cell.font = i === 8 ? fontBold : fontRegular;
          cell.numFmt = '"R$" #,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (i === 6) {
          cell.font = estoque === 0 ? fontRed : (estoque <= 5 ? fontAmber : fontBold);
          cell.alignment = { horizontal: 'right' };
        } else if (i === 7) {
          cell.font = margem >= 30 ? fontGreen : (margem >= 15 ? fontAmber : fontRed);
          cell.numFmt = '0.0"%"';
          cell.alignment = { horizontal: 'right' };
        } else if (i === 9) {
          cell.font = statusFont;
          cell.alignment = { horizontal: 'center' };
        } else {
          cell.font = i === 2 ? fontBold : fontRegular;
          cell.alignment = { horizontal: 'left' };
        }
      });
    });

    // Linha de Total
    const totalRow = 5 + produtosOrdenados.length + 1;
    ws.mergeCells(`A${totalRow}:F${totalRow}`);
    const cTotal = ws.getCell(`A${totalRow}`);
    cTotal.value = `TOTAL GERAL (${produtosOrdenados.length} produtos)`;
    cTotal.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cTotal.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    cTotal.border = borderThin;

    const totalEstoqueQtd = produtosOrdenados.reduce((s, p) => s + (parseInt(p.estoque) || 0), 0);
    ws.getCell(`G${totalRow}`).value = totalEstoqueQtd;
    ws.getCell(`G${totalRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`G${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    ws.getCell(`G${totalRow}`).alignment = { horizontal: 'right' };
    ws.getCell(`G${totalRow}`).border = borderThin;

    ws.getCell(`H${totalRow}`).value = '';
    ws.getCell(`H${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    ws.getCell(`H${totalRow}`).border = borderThin;

    ws.getCell(`I${totalRow}`).value = totalVendaEstoque;
    ws.getCell(`I${totalRow}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF10B981' } };
    ws.getCell(`I${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    ws.getCell(`I${totalRow}`).numFmt = '"R$" #,##0.00';
    ws.getCell(`I${totalRow}`).alignment = { horizontal: 'right' };
    ws.getCell(`I${totalRow}`).border = borderThin;

    ws.getCell(`J${totalRow}`).value = `${produtosZerados} zerados`;
    ws.getCell(`J${totalRow}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell(`J${totalRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    ws.getCell(`J${totalRow}`).alignment = { horizontal: 'center' };
    ws.getCell(`J${totalRow}`).border = borderThin;

    ws.getRow(totalRow).height = 28;

    // ========== ABA 2: RESUMO POR CATEGORIA ==========
    const wsRes = workbook.addWorksheet('Resumo por Categoria', { views: [{ showGridLines: true }] });
    wsRes.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 16 },
      { key: 'C', width: 18 },
      { key: 'D', width: 20 },
      { key: 'E', width: 16 }
    ];

    wsRes.mergeCells('A1:E1');
    const rt1 = wsRes.getCell('A1');
    rt1.value = '📊 RESUMO DE ESTOQUE POR CATEGORIA';
    rt1.font = fontTitle;
    rt1.alignment = { vertical: 'middle', horizontal: 'center' };
    rt1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    wsRes.getRow(1).height = 36;

    wsRes.mergeCells('A2:E2');
    const rt2 = wsRes.getCell('A2');
    rt2.value = `${nomeEmpresa} | Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    rt2.font = fontSubtitle;
    rt2.alignment = { vertical: 'middle', horizontal: 'center' };
    rt2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    wsRes.getRow(2).height = 22;

    const rHeaders = ['Categoria', 'Qtd Produtos', 'Estoque Total', 'Valor em Estoque', 'Prod. Zerados'];
    rHeaders.forEach((h, i) => {
      const col = String.fromCharCode(65 + i);
      const cell = wsRes.getCell(`${col}4`);
      cell.value = h;
      cell.font = fontColHeader;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: i >= 1 ? 'right' : 'left' };
      cell.border = borderThin;
    });
    wsRes.getRow(4).height = 26;

    // Agrupar por categoria
    const cats = {};
    produtosOrdenados.forEach(p => {
      const cat = p.categoria || 'Sem Categoria';
      if (!cats[cat]) cats[cat] = { qtd: 0, estoque: 0, valor: 0, zerados: 0 };
      cats[cat].qtd++;
      cats[cat].estoque += parseInt(p.estoque) || 0;
      cats[cat].valor += (parseFloat(p.precoVenda) || 0) * (parseInt(p.estoque) || 0);
      if ((parseInt(p.estoque) || 0) === 0) cats[cat].zerados++;
    });

    const catEntries = Object.entries(cats).sort((a, b) => b[1].valor - a[1].valor);
    catEntries.forEach(([cat, data], idx) => {
      const row = 5 + idx;
      const isEven = idx % 2 === 0;
      const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      const vals = [cat, data.qtd, data.estoque, data.valor, data.zerados];
      vals.forEach((v, i) => {
        const col = String.fromCharCode(65 + i);
        const cell = wsRes.getCell(`${col}${row}`);
        cell.value = v;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = borderThin;
        cell.alignment = { horizontal: i >= 1 ? 'right' : 'left' };
        if (i === 3) {
          cell.numFmt = '"R$" #,##0.00';
          cell.font = fontGreen;
        } else if (i === 4) {
          cell.font = v > 0 ? fontRed : fontGreen;
        } else {
          cell.font = i === 0 ? fontBold : fontRegular;
        }
      });
      wsRes.getRow(row).height = 22;
    });

    // Exportar
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `Estoque_${nomeEmpresa.replace(/\s+/g, '_')}_${dataStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.App.showToast(`📊 Planilha de estoque exportada com sucesso! (${produtos.length} produtos)`, 'success');
    } catch (err) {
      console.error('Erro ao exportar estoque Excel:', err);
      window.App.showToast('Erro ao gerar planilha de estoque!', 'error');
    }
  },

  // ==========================================
  // IMPORTAÇÃO DE PRODUTOS EM MASSA (EXCEL / CSV)
  // ==========================================
  atualizarBotoesPermissaoGerente() {
    const isGerente = (window.AuthModule && typeof window.AuthModule.isGerente === 'function') 
      ? window.AuthModule.isGerente() 
      : StorageService.isGerente();

    const isXmlAtivo = StorageService.isModuloAtivo('importadorXml');

    const idsBotoes = [
      'btn-filtro-estoque-baixo',
      'btn-lista-compras-excel',
      'btn-importar-estoque-excel',
      'btn-exportar-estoque-excel'
    ];

    idsBotoes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = isGerente ? 'flex' : 'none';
      }
    });

    const btnXml = document.getElementById('btn-importar-xml-nfe');
    if (btnXml) {
      btnXml.style.display = (isXmlAtivo && isGerente) ? 'flex' : 'none';
    }
  },

  bindDragDropPlanilha() {
    const dropZone = document.getElementById('drop-zone-planilha');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#0284c7';
        dropZone.style.background = '#e0f2fe';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#94a3b8';
        dropZone.style.background = '#f8fafc';
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        this.processarArquivoPlanilha(files[0]);
      }
    }, false);
  },

  async baixarModeloPlanilhaExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'FlowPDV SaaS';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Produtos_Modelo', { views: [{ showGridLines: true }] });

      ws.columns = [
        { key: 'codigo', width: 20 },
        { key: 'categoria', width: 20 },
        { key: 'nome', width: 40 },
        { key: 'precoCusto', width: 16 },
        { key: 'precoVenda', width: 16 },
        { key: 'estoque', width: 15 },
        { key: 'estoqueMinimo', width: 15 },
        { key: 'unidadeFracionada', width: 22 },
        { key: 'fatorConversao', width: 18 },
        { key: 'precoFardo', width: 20 },
        { key: 'codigoBarrasFardo', width: 24 }
      ];

      // Cabeçalho estilizado: Colunas 1-7 (Padrão Escuro) e Colunas 8-11 (Destaque Fardo / Grade)
      const headers = [
        'Código de Barras',
        'Categoria',
        'Nome / Descrição',
        'Preço de Custo',
        'Preço de Venda',
        'Estoque Atual',
        'Estoque Mínimo',
        'Nome Fardo (Opcional)',
        'Qtd por Fardo (Opcional)',
        'Preço Venda Fardo (Opcional)',
        'Código Barras Fardo (Opcional)'
      ];

      const headerRow = ws.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell, colNum) => {
        const isFardoCol = colNum >= 8;
        cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: isFardoCol ? 'FF0284C7' : 'FF0F172A' } 
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      // Linhas de exemplo reais com e sem Fardos
      const exemplos = [
        ['7891991001014', 'Bebidas', 'Cerveja Skol Pilsen Lata 350ml', 2.70, 4.29, 144, 24, 'Fardo c/ 12', 12, 47.90, '7891991001915'],
        ['7896045506019', 'Bebidas', 'Cerveja Heineken Long Neck 330ml', 5.20, 8.99, 120, 24, 'Pack c/ 6', 6, 49.90, '7896045506910'],
        ['7894900010039', 'Bebidas', 'Refrigerante Coca-Cola Lata 350ml', 2.90, 4.99, 120, 24, 'Pack c/ 6', 6, 26.90, '7894900010916'],
        ['7896006700018', 'Alimentos', 'Arroz Branco Tipo 1 Camil 5kg', 24.50, 33.90, 85, 20, '', '', '', ''],
        ['7896014400018', 'Alimentos', 'Açúcar Refinado União 1kg', 3.40, 4.99, 110, 30, '', '', '', ''],
        ['5000267014005', 'Bebidas', 'Whisky Johnnie Walker Red Label 1L', 74.00, 109.90, 15, 4, '', '', '', '']
      ];

      exemplos.forEach((ex, idx) => {
        const row = ws.addRow(ex);
        row.height = 22;
        const isEven = idx % 2 === 0;
        const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNum === 4 || colNum === 5 || colNum === 10) {
            if (cell.value && typeof cell.value === 'number') {
              cell.numFmt = '"R$" #,##0.00';
            }
            cell.alignment = { horizontal: 'right' };
          } else if (colNum === 6 || colNum === 7 || colNum === 9) {
            cell.alignment = { horizontal: 'right' };
          } else {
            cell.alignment = { horizontal: 'left' };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Modelo_Importacao_Produtos_FlowPDV.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.App.showToast('📥 Planilha modelo baixada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao gerar modelo Excel:', err);
      window.App.showToast('Erro ao baixar modelo de planilha!', 'error');
    }
  },

  abrirModalImportarProdutos() {
    AuthModule.solicitarAutorizacaoGerente(() => {
      this.produtosParaImportar = [];
      const input = document.getElementById('input-file-planilha');
      if (input) input.value = '';

      const container = document.getElementById('import-preview-container');
      if (container) container.style.display = 'none';

      const btnConfirmar = document.getElementById('btn-confirmar-importacao-massa');
      if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '🚀 Confirmar Importação';
      }

      const dropTitulo = document.getElementById('drop-zone-titulo');
      if (dropTitulo) dropTitulo.textContent = 'Clique para selecionar ou arraste o arquivo da planilha aqui';

      const modal = document.getElementById('modal-importar-produtos');
      if (modal) modal.classList.add('active');
    });
  },

  fecharModalImportarProdutos() {
    const modal = document.getElementById('modal-importar-produtos');
    if (modal) modal.classList.remove('active');
    this.produtosParaImportar = [];
  },

  onFileSelected(event) {
    const file = event.target.files[0];
    if (file) {
      this.processarArquivoPlanilha(file);
    }
  },

  parseValorMonetario(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Math.max(0, val);
    const str = String(val).replace(/R\$/gi, '').replace(/\s+/g, '').trim();
    if (!str) return 0;
    if (str.includes(',') && str.includes('.')) {
      if (str.indexOf('.') < str.indexOf(',')) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        return parseFloat(str.replace(/,/g, '')) || 0;
      }
    }
    if (str.includes(',')) {
      return parseFloat(str.replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
  },

  async processarArquivoPlanilha(file) {
    const dropTitulo = document.getElementById('drop-zone-titulo');
    const dropSub = document.getElementById('drop-zone-sub');
    if (dropTitulo) dropTitulo.textContent = `⏳ Lendo arquivo "${file.name}"...`;

    try {
      let linhasBrutas = [];

      if (file.name.endsWith('.csv')) {
        const texto = await file.text();
        const linhas = texto.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
        if (linhas.length <= 1) {
          throw new Error('O arquivo CSV está vazio ou contém apenas o cabeçalho.');
        }
        const separador = linhas[0].includes(';') ? ';' : ',';
        for (let i = 1; i < linhas.length; i++) {
          const colunas = linhas[i].split(separador).map(c => c.replace(/^["']|["']$/g, '').trim());
          if (colunas.some(c => c !== '')) {
            linhasBrutas.push(colunas);
          }
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet || worksheet.rowCount <= 1) {
          throw new Error('A planilha está vazia ou sem linhas de produtos.');
        }

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) { // Pular cabeçalho
            const valores = [];
            for (let i = 1; i <= 11; i++) {
              const cellVal = row.getCell(i).value;
              let cleanVal = cellVal;
              if (cellVal && typeof cellVal === 'object') {
                cleanVal = cellVal.result !== undefined ? cellVal.result : (cellVal.text || '');
              }
              valores.push(cleanVal !== null && cleanVal !== undefined ? String(cleanVal).trim() : '');
            }
            if (valores.some(v => v !== '')) {
              linhasBrutas.push(valores);
            }
          }
        });
      }

      if (linhasBrutas.length === 0) {
        throw new Error('Nenhum dado válido de produto foi identificado na planilha.');
      }

      const produtosExistentes = StorageService.getProdutos() || [];
      const mapaExistentesPorEan = new Map();
      const mapaExistentesPorNome = new Map();
      produtosExistentes.forEach(p => {
        if (p.codigoBarras) mapaExistentesPorEan.set(p.codigoBarras.trim().toUpperCase(), p);
        if (p.nome) mapaExistentesPorNome.set(p.nome.trim().toLowerCase(), p);
      });

      const listaFinal = [];

      for (let i = 0; i < linhasBrutas.length; i++) {
        const cols = linhasBrutas[i];
        let [
          codBarras, 
          categoria, 
          nome, 
          precoCusto, 
          precoVenda,
        precoClube, 
          estoque, 
          estoqueMinimo,
          unidadeFracionada,
          fatorConversao,
          precoFardo,
          codigoBarrasFardo
        ] = cols;

        nome = (nome || '').trim();
        if (!nome) continue;

        categoria = (categoria || 'Geral').trim();
        codBarras = (codBarras || '').trim().toUpperCase();

        const custoNum = this.parseValorMonetario(precoCusto);
        const vendaNum = this.parseValorMonetario(precoVenda);
        const estNum = parseInt(estoque, 10);
        const estValido = isNaN(estNum) ? 0 : estNum;
        const minNum = parseInt(estoqueMinimo, 10);
        const minValido = isNaN(minNum) ? 5 : minNum;

        // Tratar Grade / Fardo Opcional (Colunas 8 a 11)
        const nomeFardo = (unidadeFracionada || '').trim();
        const fatorNum = parseInt(fatorConversao, 10);
        const fatorValido = (!isNaN(fatorNum) && fatorNum >= 2) ? fatorNum : null;
        const precoFardoNum = this.parseValorMonetario(precoFardo);
        const precoFardoValido = precoFardoNum > 0 ? precoFardoNum : null;
        const codFardoLimpo = (codigoBarrasFardo || '').trim().toUpperCase();
        const codFardoValido = codFardoLimpo.length > 0 ? codFardoLimpo : null;

        const temGrade = Boolean(nomeFardo || fatorValido || precoFardoValido || codFardoValido);

        if (!codBarras) {
          codBarras = 'INT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        }

        const existente = (codBarras && mapaExistentesPorEan.get(codBarras)) || mapaExistentesPorNome.get(nome.toLowerCase());
        const isNovo = !existente;

        const prodObj = {
          id: existente ? existente.id : ('PRD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4)).toUpperCase(),
          codigoBarras: codBarras,
          categoria: categoria || 'Geral',
          nome: nome,
          precoCusto: custoNum,
          precoVenda: vendaNum,
          estoque: estValido,
          estoqueMinimo: minValido,
          controlarEstoque: true,
          unidadeMedida: 'UN',
          tipoProduto: 'unidade',
          unidadeFracionada: temGrade ? (nomeFardo || (fatorValido ? `Fardo c/ ${fatorValido}` : 'Fardo')) : (existente?.unidadeFracionada || null),
          fatorConversao: temGrade ? (fatorValido || (precoFardoValido && vendaNum > 0 ? Math.round(precoFardoValido / vendaNum) : 12)) : (existente?.fatorConversao || null),
          precoFardo: temGrade ? precoFardoValido : (existente?.precoFardo || null),
          codigoBarrasFardo: temGrade ? codFardoValido : (existente?.codigoBarrasFardo || null),
          isNovo: isNovo,
          originalId: existente ? existente.id : null,
          criadoEm: existente ? (existente.criadoEm || new Date().toISOString()) : new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };

        listaFinal.push(prodObj);
      }

      if (listaFinal.length === 0) {
        throw new Error('Nenhum produto com nome válido foi encontrado na planilha.');
      }

      this.produtosParaImportar = listaFinal;
      this.renderPreviewImportacao(file.name);

    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      if (dropTitulo) dropTitulo.textContent = '❌ Erro ao ler planilha';
      if (dropSub) dropSub.textContent = err.message || 'Verifique se o arquivo segue o modelo solicitado.';
      window.App.showToast(err.message || 'Erro ao processar planilha!', 'error');
    }
  },

  renderPreviewImportacao(nomeArquivo) {
    const container = document.getElementById('import-preview-container');
    const tbody = document.getElementById('import-preview-tbody');
    const countTotal = document.getElementById('import-count-total');
    const countNovos = document.getElementById('import-count-novos');
    const countAtualizados = document.getElementById('import-count-atualizados');
    const btnConfirmar = document.getElementById('btn-confirmar-importacao-massa');
    const dropTitulo = document.getElementById('drop-zone-titulo');
    const dropSub = document.getElementById('drop-zone-sub');

    const total = this.produtosParaImportar.length;
    const novos = this.produtosParaImportar.filter(p => p.isNovo).length;
    const atualizados = total - novos;

    if (countTotal) countTotal.textContent = total;
    if (countNovos) countNovos.textContent = novos;
    if (countAtualizados) countAtualizados.textContent = atualizados;

    if (dropTitulo) dropTitulo.textContent = `✅ Arquivo carregado: ${nomeArquivo}`;
    if (dropSub) dropSub.textContent = `${total} produtos identificados e prontos para importação.`;

    if (tbody) {
      const primeiras = this.produtosParaImportar.slice(0, 30);
      tbody.innerHTML = primeiras.map(p => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${p.isNovo ? '#f0fdf4' : '#fffbeb'};">
          <td style="padding: 6px 10px; font-family: 'JetBrains Mono'; font-weight: 700;">${p.codigoBarras}</td>
          <td style="padding: 6px 10px; white-space: nowrap;"><span class="category-tag">${p.categoria}</span></td>
          <td style="padding: 6px 10px; font-weight: 700; color: var(--text-main);">
            ${p.nome}
            ${p.unidadeFracionada ? `<span style="display: block; font-size: 11px; color: #0284c7; font-weight: 700; margin-top: 2px;">📦 Grade: ${p.unidadeFracionada} (x${p.fatorConversao} - R$ ${(p.precoFardo || 0).toFixed(2).replace('.', ',')})</span>` : ''}
          </td>
          <td style="padding: 6px 10px; text-align: right; color: var(--text-muted);">R$ ${p.precoCusto.toFixed(2).replace('.', ',')}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 700; color: #16a34a;">R$ ${p.precoVenda.toFixed(2).replace('.', ',')}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 700;">${p.estoque}</td>
          <td style="padding: 6px 10px; text-align: right; color: var(--text-muted);">${p.estoqueMinimo}</td>
          <td style="padding: 6px 10px; text-align: center;">
            <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${p.isNovo ? 'background: #dcfce7; color: #15803d;' : 'background: #fef3c7; color: #b45309;'}">
              ${p.isNovo ? 'NOVO' : 'ATUALIZAR'}
            </span>
          </td>
        </tr>
      `).join('');

      if (total > 30) {
        tbody.innerHTML += `
          <tr>
            <td colspan="8" style="text-align: center; padding: 10px; color: var(--text-muted); font-weight: 700; background: #f8fafc;">
              ➕ E mais ${total - 30} produtos adicionais prontos para importação...
            </td>
          </tr>
        `;
      }
    }

    if (container) container.style.display = 'block';
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML = `🚀 Confirmar e Importar (${total} Itens)`;
    }
  },

  async confirmarImportacaoMassa() {
    if (!this.produtosParaImportar || this.produtosParaImportar.length === 0) return;

    const btnConfirmar = document.getElementById('btn-confirmar-importacao-massa');
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = '⏳ Importando e sincronizando...';
    }

    try {
      const produtosAtuais = StorageService.getProdutos() || [];
      const mapaProdutos = new Map();
      produtosAtuais.forEach(p => mapaProdutos.set(p.id, p));

      const categoriasExistentes = StorageService.getCategorias() || [];
      const novasCategoriasSet = new Set(categoriasExistentes);

      let novosQtd = 0;
      let atualizadosQtd = 0;

      this.produtosParaImportar.forEach(p => {
        if (p.categoria && !novasCategoriasSet.has(p.categoria)) {
          novasCategoriasSet.add(p.categoria);
        }

        if (mapaProdutos.has(p.id)) {
          const anterior = mapaProdutos.get(p.id);
          mapaProdutos.set(p.id, {
            ...anterior,
            ...p,
            estoque: p.estoque,
            precoCusto: p.precoCusto,
            precoVenda: p.precoVenda,
        precoClube,
            estoqueMinimo: p.estoqueMinimo,
            categoria: p.categoria,
            unidadeFracionada: p.unidadeFracionada !== null ? p.unidadeFracionada : (anterior.unidadeFracionada || null),
            fatorConversao: p.fatorConversao !== null ? p.fatorConversao : (anterior.fatorConversao || null),
            precoFardo: p.precoFardo !== null ? p.precoFardo : (anterior.precoFardo || null),
            codigoBarrasFardo: p.codigoBarrasFardo !== null ? p.codigoBarrasFardo : (anterior.codigoBarrasFardo || null)
          });
          atualizadosQtd++;
        } else {
          mapaProdutos.set(p.id, p);
          novosQtd++;
        }
      });

      const listaFinal = Array.from(mapaProdutos.values());

      // 1. Salvar Categorias
      StorageService.salvarCategorias(Array.from(novasCategoriasSet));

      // 2. Salvar Produtos
      StorageService.saveProdutos(listaFinal);

      // 3. Sincronizar com a Nuvem Multi-Terminal
      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('importacao_planilha');
      }

      // 4. Registrar Log de Auditoria no Master
      AuditModule.registrarLog('importacao_planilha', `Importação em massa de ${this.produtosParaImportar.length} produtos via planilha (${novosQtd} novos, ${atualizadosQtd} atualizados)`, {
        totalImportados: this.produtosParaImportar.length,
        novos: novosQtd,
        atualizados: atualizadosQtd
      });

      this.fecharModalImportarProdutos();
      this.renderBarraCategorias();
      this.renderTabelaProdutos();

      window.App.showToast(`🎉 ${this.produtosParaImportar.length} produtos importados com sucesso no estoque!`, 'success');
    } catch (err) {
      console.error('Erro na importação em massa:', err);
      window.App.showToast('Erro ao importar produtos!', 'error');
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '🚀 Tentar Novamente';
      }
    }
  },

  async exportarListaComprasExcel() {
    const produtos = StorageService.getProdutos() || [];
    const config = StorageService.getConfig() || {};
    const lic = StorageService.getLicenca() || {};
    const nomeLoja = lic.razaoSocial || config.nomeEmpresa || 'Minha Loja';

    // Filtrar produtos com estoque baixo ou zerado (apenas itens que controlam estoque)
    const produtosRepor = produtos.filter(p => {
      if (p.controlarEstoque === false) return false;
      const est = parseFloat(p.estoque) || 0;
      const estMin = parseFloat(p.estoqueMinimo) || 5;
      return est <= estMin;
    });

    const listaFinal = produtosRepor.length > 0 ? produtosRepor : produtos.filter(p => p.controlarEstoque !== false);

    if (listaFinal.length === 0) {
      window.App.showToast('Nenhum produto cadastrado com controle de estoque para exportação!', 'warning');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'FlowPDV Gestão Comercial';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Lista de Compras');

      // Título da Planilha
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `📋 LISTA DE COMPRAS & REPOSIÇÃO DE ESTOQUE — ${nomeLoja.toUpperCase()}`;
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 36;

      // Subtítulo com Data
      worksheet.mergeCells('A2:H2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')} | Total de Itens: ${listaFinal.length} produtos`;
      subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 20;

      // Cabeçalho das Colunas
      const headers = [
        'EAN / Cód. Barras',
        'Descrição do Produto',
        'Categoria',
        'Estoque Atual',
        'Estoque Mínimo',
        'Sugestão Reposição',
        'Custo Unitário (R$)',
        'Total Estimado (R$)'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0D9488' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Largura das Colunas
      worksheet.columns = [
        { key: 'codigo', width: 18 },
        { key: 'nome', width: 38 },
        { key: 'categoria', width: 20 },
        { key: 'estoque', width: 15 },
        { key: 'estoqueMinimo', width: 16 },
        { key: 'sugestao', width: 20 },
        { key: 'custo', width: 18 },
        { key: 'total', width: 20 }
      ];

      let somaTotalEstimado = 0;

      // Inserir Linhas de Produtos
      listaFinal.forEach(p => {
        const est = parseFloat(p.estoque) || 0;
        const estMin = parseFloat(p.estoqueMinimo) || 5;
        const sugestao = Math.max(1, (estMin * 2) - est);
        const custo = parseFloat(p.precoCusto) || 0;
        const totalEstimado = sugestao * custo;
        somaTotalEstimado += totalEstimado;

        const row = worksheet.addRow([
          p.codigoBarras || '-',
          p.nome,
          p.categoria || 'Geral',
          est,
          estMin,
          sugestao,
          custo,
          totalEstimado
        ]);

        row.height = 22;

        // Formatação das Células
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'left' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(5).alignment = { horizontal: 'center' };
        row.getCell(6).alignment = { horizontal: 'center' };
        row.getCell(7).numFmt = '"R$ "#,##0.00';
        row.getCell(8).numFmt = '"R$ "#,##0.00';

        // Destacar Estoque Zerado ou Crítico
        if (est <= 0) {
          row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          row.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true };
        } else if (est <= estMin) {
          row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          row.getCell(4).font = { color: { argb: 'FFD97706' }, bold: true };
        }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Linha de Total Geral
      const totalRow = worksheet.addRow([
        'TOTAL GERAL',
        '',
        '',
        '',
        '',
        '',
        'Investimento:',
        somaTotalEstimado
      ]);
      totalRow.height = 26;
      worksheet.mergeCells(`A${totalRow.number}:F${totalRow.number}`);
      totalRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
      totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      totalRow.getCell(7).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
      totalRow.getCell(8).font = { bold: true, size: 12, color: { argb: 'FF059669' } };
      totalRow.getCell(8).numFmt = '"R$ "#,##0.00';
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }
        };
      });

      // Gerar arquivo Excel (.xlsx) e disparar download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataFmt = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `Lista-Compras-FlowPDV-${dataFmt}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.App.showToast(`📊 Planilha de compras gerada com sucesso (${listaFinal.length} itens)!`, 'success');
    } catch(err) {
      console.error('[EstoqueModule] Erro ao exportar lista de compras Excel:', err);
      window.App.showToast('Erro ao gerar arquivo Excel de compras.', 'error');
    }
  },

  // =========================================================================
  // MÓDULO 1: BIPAGEM RÁPIDA EXPRESS DE VALIDADES
  // =========================================================================
  abrirModalBipagemValidade() {
    this.produtoValidadeBipado = null;
    this.historicoValidadesBipadas = [];
    const modal = document.getElementById('modal-bipagem-validade');
    const inputCodigo = document.getElementById('input-bipar-codigo-validade');
    const cardProd = document.getElementById('bipagem-validade-prod-card');
    const boxData = document.getElementById('bipagem-validade-data-box');
    const inputData = document.getElementById('input-bipar-data-validade');

    if (cardProd) cardProd.style.display = 'none';
    if (boxData) boxData.style.display = 'none';
    if (inputCodigo) inputCodigo.value = '';
    if (inputData) inputData.value = '';

    if (modal) modal.classList.add('active');
    document.body.classList.add('modal-open');
    this.renderHistoricoBipagemValidade();

    setTimeout(() => {
      if (inputCodigo) inputCodigo.focus();
    }, 150);
  },

  fecharModalBipagemValidade() {
    this.produtoValidadeBipado = null;
    this.historicoValidadesBipadas = [];
    const modal = document.getElementById('modal-bipagem-validade');
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
    this.renderTabelaProdutos();
  },

  biparCodigoValidade(codigoRaw) {
    const codigo = (codigoRaw || '').trim().toUpperCase();
    const inputCodigo = document.getElementById('input-bipar-codigo-validade');
    if (!codigo) {
      if (inputCodigo) inputCodigo.focus();
      return;
    }

    const produtos = StorageService.getProdutos() || [];
    const p = produtos.find(item => 
      (item.codigoBarras && item.codigoBarras.toUpperCase() === codigo) ||
      (item.codigoBarrasFardo && item.codigoBarrasFardo.toUpperCase() === codigo) ||
      (item.id && item.id.toUpperCase() === codigo) ||
      (item.nome && item.nome.toUpperCase() === codigo)
    );

    if (!p) {
      window.App.showToast(`⚠️ Produto com código "${codigo}" não encontrado!`, 'warning');
      if (inputCodigo) {
        inputCodigo.select();
        inputCodigo.focus();
      }
      return;
    }

    this.produtoValidadeBipado = p;

    // Renderizar Card do Produto Bipado
    const cardProd = document.getElementById('bipagem-validade-prod-card');
    const boxData = document.getElementById('bipagem-validade-data-box');
    const inputData = document.getElementById('input-bipar-data-validade');

    let validadeAtualStr = 'Sem validade cadastrada';
    let validadeStatusColor = 'var(--text-dim)';
    if (p.dataValidade) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataVal = new Date(p.dataValidade + 'T00:00:00');
      const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) {
        validadeAtualStr = `🚨 Vencido em ${dataVal.toLocaleDateString('pt-BR')}`;
        validadeStatusColor = '#dc2626';
      } else {
        validadeAtualStr = `📅 Vence em ${dataVal.toLocaleDateString('pt-BR')} (${diffDias} dias)`;
        validadeStatusColor = diffDias <= 30 ? '#d97706' : '#059669';
      }
    }

    if (cardProd) {
      cardProd.style.display = 'block';
      cardProd.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">Produto Localizado</div>
            <strong style="font-size: 16px; color: var(--text-main); display: block; margin-top: 2px;">${p.nome}</strong>
            <div style="font-size: 12px; color: var(--text-muted); font-family: 'JetBrains Mono'; margin-top: 2px;">EAN: ${p.codigoBarras || '-'} | Categoria: ${p.categoria || 'Geral'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-dim);">Preço / Estoque</div>
            <div style="font-size: 15px; font-weight: 900; color: var(--accent-green); font-family: 'JetBrains Mono';">R$ ${(p.precoVenda || 0).toFixed(2).replace('.', ',')}</div>
            <span class="badge-stock ${p.estoque > 0 ? 'ok' : 'zero'}" style="font-size: 10.5px; padding: 1px 6px; margin-top: 2px;">${p.estoque || 0} ${p.unidade || 'un'}</span>
          </div>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 12px; font-weight: 700; color: ${validadeStatusColor};">
          Validade Atual: ${validadeAtualStr}
        </div>
      `;
    }

    if (boxData) boxData.style.display = 'block';
    if (inputData) {
      inputData.value = p.dataValidade || '';
      setTimeout(() => {
        inputData.focus();
        if (inputData.showPicker) {
          try { inputData.showPicker(); } catch(e){}
        }
      }, 80);
    }
  },

  aplicarDataRapidaValidade(dias) {
    if (!this.produtoValidadeBipado) {
      window.App.showToast('Bipe um produto primeiro!', 'warning');
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const inputData = document.getElementById('input-bipar-data-validade');
    if (inputData) {
      inputData.value = d.toISOString().split('T')[0];
    }
    this.salvarValidadeExpress();
  },

  salvarValidadeExpress() {
    if (!this.produtoValidadeBipado) return;
    const inputData = document.getElementById('input-bipar-data-validade');
    const dataVal = inputData?.value?.trim() || '';

    if (!dataVal) {
      window.App.showToast('⚠️ Selecione ou digite uma data de validade!', 'warning');
      if (inputData) inputData.focus();
      return;
    }

    const produtos = StorageService.getProdutos() || [];
    const idx = produtos.findIndex(p => p.id === this.produtoValidadeBipado.id);
    if (idx >= 0) {
      produtos[idx].dataValidade = dataVal;
      StorageService.saveProdutos(produtos);

      const dValObj = new Date(dataVal + 'T00:00:00');
      const dataFormatada = dValObj.toLocaleDateString('pt-BR');

      this.historicoValidadesBipadas.unshift({
        id: this.produtoValidadeBipado.id,
        nome: this.produtoValidadeBipado.nome,
        codigo: this.produtoValidadeBipado.codigoBarras || '-',
        dataValidade: dataVal,
        dataFormatada: dataFormatada,
        hora: new Date().toLocaleTimeString('pt-BR')
      });

      window.App.showToast(`✅ Validade de "${this.produtoValidadeBipado.nome}" atualizada para ${dataFormatada}!`, 'success');

      AuditModule.registrarLog(
        'AUDITORIA_VALIDADE',
        `Atualizada validade de "${this.produtoValidadeBipado.nome}" (${this.produtoValidadeBipado.codigoBarras}) para ${dataFormatada}.`
      );

      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('ajuste_validade');
      }
    }

    // Reset para próximo bip imediato
    this.produtoValidadeBipado = null;
    const cardProd = document.getElementById('bipagem-validade-prod-card');
    const boxData = document.getElementById('bipagem-validade-data-box');
    const inputCodigo = document.getElementById('input-bipar-codigo-validade');

    if (cardProd) cardProd.style.display = 'none';
    if (boxData) boxData.style.display = 'none';
    if (inputCodigo) {
      inputCodigo.value = '';
      inputCodigo.focus();
    }

    this.renderHistoricoBipagemValidade();
  },

  renderHistoricoBipagemValidade() {
    const container = document.getElementById('bipagem-validade-historico');
    const countEl = document.getElementById('bipagem-validade-count');
    if (countEl) countEl.textContent = `${this.historicoValidadesBipadas.length} ${this.historicoValidadesBipadas.length === 1 ? 'item' : 'itens'}`;

    if (!container) return;
    if (this.historicoValidadesBipadas.length === 0) {
      container.innerHTML = `<div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 18px;">Nenhum produto auditado ainda nesta sessão.</div>`;
      return;
    }

    container.innerHTML = this.historicoValidadesBipadas.map(h => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="color: #059669; font-weight: 800;">✅</span>
          <strong style="color: var(--text-main);">${h.nome}</strong>
          <span style="color: var(--text-muted); font-size: 11px;">(${h.codigo})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge-stock ok" style="font-size: 11px; padding: 1px 6px; font-weight: 800;">Val: ${h.dataFormatada}</span>
          <span style="color: var(--text-dim); font-size: 10.5px;">${h.hora}</span>
        </div>
      </div>
    `).join('');
  },

  // =========================================================================
  // MÓDULO 2: QUEIMA DE ESTOQUE & PROMOÇÃO WHATSAPP
  // =========================================================================
  itensQueimaEstoqueCalculados: [],

  abrirModalQueimaEstoque() {
    const modal = document.getElementById('modal-queima-estoque');
    if (modal) modal.classList.add('active');
    document.body.classList.add('modal-open');
    this.recalcularTabelaQueimaEstoque();
  },

  fecharModalQueimaEstoque() {
    const modal = document.getElementById('modal-queima-estoque');
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  },

  setDescontoQueima(percentual, btnElement) {
    const inputCustom = document.getElementById('queima-custom-desconto');
    if (inputCustom) inputCustom.value = percentual;
    if (btnElement) {
      btnElement.parentElement.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btnElement.classList.add('active');
    }
    this.recalcularTabelaQueimaEstoque();
  },

  recalcularTabelaQueimaEstoque() {
    const filtroDias = document.getElementById('queima-filtro-dias')?.value || '30';
    const descontoPercent = parseFloat(document.getElementById('queima-custom-desconto')?.value) || 20;
    const fatorDesconto = (100 - descontoPercent) / 100;

    const produtos = StorageService.getProdutos() || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const itensElegiveis = [];

    produtos.forEach(p => {
      if (!p.dataValidade || p.controlarEstoque === false || (parseFloat(p.estoque) || 0) <= 0) return;
      const dataVal = new Date(p.dataValidade + 'T00:00:00');
      const diffDias = Math.ceil((dataVal - hoje) / (1000 * 60 * 60 * 24));

      let match = false;
      if (filtroDias === 'vencidos' && diffDias < 0) match = true;
      else if (filtroDias === '15' && diffDias >= 0 && diffDias <= 15) match = true;
      else if (filtroDias === '30' && diffDias >= 0 && diffDias <= 30) match = true;
      else if (filtroDias === '60' && diffDias >= 0 && diffDias <= 60) match = true;

      if (match) {
        const precoDe = parseFloat(p.precoVenda) || 0;
        const precoPor = Math.max(0.10, Math.floor(precoDe * fatorDesconto * 10) / 10);
        itensElegiveis.push({
          id: p.id,
          nome: p.nome,
          codigo: p.codigoBarras || '-',
          categoria: p.categoria || 'Geral',
          estoque: p.estoque || 0,
          unidade: p.unidade || 'un',
          dataValidade: p.dataValidade,
          dataValidadeFmt: dataVal.toLocaleDateString('pt-BR'),
          diffDias: diffDias,
          precoDe: precoDe,
          precoPor: precoPor,
          descontoPercent: descontoPercent,
          selecionado: true
        });
      }
    });

    this.itensQueimaEstoqueCalculados = itensElegiveis;

    // Renderizar Tabela
    const tbody = document.getElementById('queima-produtos-tbody');
    const totalBadge = document.getElementById('queima-total-itens-badge');
    if (totalBadge) totalBadge.textContent = `${itensElegiveis.length} ${itensElegiveis.length === 1 ? 'produto' : 'produtos'}`;

    if (tbody) {
      if (itensElegiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhum produto com vencimento para o filtro selecionado (${filtroDias === 'vencidos' ? 'já vencidos' : `próximos ${filtroDias} dias`}).</td></tr>`;
      } else {
        tbody.innerHTML = itensElegiveis.map((it, idx) => `
          <tr style="${it.selecionado ? '' : 'opacity: 0.4;'}">
            <td style="text-align: center;">
              <input type="checkbox" ${it.selecionado ? 'checked' : ''} onchange="EstoqueModule.toggleItemQueima(${idx}, this.checked)" style="width: 15px; height: 15px; cursor: pointer;">
            </td>
            <td>
              <strong style="color: var(--text-main); font-size: 13px;">${it.nome}</strong>
              <span style="display: block; font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono';">${it.codigo}</span>
            </td>
            <td style="text-align: center; white-space: nowrap;">
              <span class="badge-stock ${it.diffDias < 0 ? 'zero' : 'low'}" style="font-size: 10px; padding: 2px 6px;">
                ${it.diffDias < 0 ? '🚨 Vencido' : `⏳ ${it.diffDias}d`} (${it.dataValidadeFmt})
              </span>
            </td>
            <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 700;">
              ${it.estoque} ${it.unidade}
            </td>
            <td style="text-align: right; text-decoration: line-through; color: var(--text-dim); font-family: 'JetBrains Mono';">
              R$ ${it.precoDe.toFixed(2).replace('.', ',')}
            </td>
            <td style="text-align: right; font-weight: 900; color: #ea580c; font-size: 14px; font-family: 'JetBrains Mono';">
              R$ ${it.precoPor.toFixed(2).replace('.', ',')}
            </td>
          </tr>
        `).join('');
      }
    }

    this.gerarMensagemWhatsAppQueima();
  },

  toggleItemQueima(index, checked) {
    if (this.itensQueimaEstoqueCalculados[index]) {
      this.itensQueimaEstoqueCalculados[index].selecionado = checked;
      this.gerarMensagemWhatsAppQueima();
    }
  },

  toggleCheckAllQueima(checked) {
    this.itensQueimaEstoqueCalculados.forEach(it => it.selecionado = checked);
    const tbody = document.getElementById('queima-produtos-tbody');
    if (tbody) {
      tbody.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = checked);
    }
    this.gerarMensagemWhatsAppQueima();
  },

  gerarMensagemWhatsAppQueima() {
    const textarea = document.getElementById('queima-whatsapp-texto');
    if (!textarea) return;

    const selecionados = this.itensQueimaEstoqueCalculados.filter(it => it.selecionado);
    if (selecionados.length === 0) {
      textarea.value = 'Selecione ao menos um produto acima para gerar a mensagem de oferta.';
      return;
    }

    const config = StorageService.getConfig() || {};
    const nomeLoja = (config.nomeEmpresa || config.nomeLoja || 'Nossa Loja').trim();

    let msg = `🔥 *OFERTAS RELÂMPAGO NA ${nomeLoja.toUpperCase()}!* 🔥\n`;
    msg += `Aproveite nossos descontos especiais por tempo limitado:\n\n`;

    selecionados.forEach(it => {
      msg += `🏷️ *${it.nome}*\n`;
      msg += `   De ~R$ ${it.precoDe.toFixed(2).replace('.', ',')}~ por *R$ ${it.precoPor.toFixed(2).replace('.', ',')}* (${it.descontoPercent}% OFF)\n\n`;
    });

    msg += `📍 *Oferta válida enquanto durarem os estoques!*\n`;
    msg += `👉 Responda esta mensagem para reservar o seu ou venha até a loja!`;

    textarea.value = msg;
  },

  aplicarDescontosQueimaNoPDV() {
    const selecionados = this.itensQueimaEstoqueCalculados.filter(it => it.selecionado);
    if (selecionados.length === 0) {
      window.App.showToast('Nenhum produto selecionado para atualizar o preço!', 'warning');
      return;
    }

    const executarAplicacao = () => {
      const produtos = StorageService.getProdutos() || [];
      let atualizados = 0;

      selecionados.forEach(it => {
        const idx = produtos.findIndex(p => p.id === it.id);
        if (idx >= 0) {
          produtos[idx].emPromocao = true;
          produtos[idx].precoOriginal = produtos[idx].precoOriginal || parseFloat(produtos[idx].precoVenda) || it.precoDe;
          produtos[idx].precoPromocional = it.precoPor;
          produtos[idx].precoVenda = it.precoPor;
          atualizados++;
        }
      });

      StorageService.saveProdutos(produtos);
      AuditModule.registrarLog(
        'PROMOCAO_QUEIMA_ESTOQUE',
        `Aplicado desconto promocional de queima de estoque em ${atualizados} produtos.`
      );

      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('promocao_queima');
      }

      this.renderTabelaProdutos();
      this.fecharModalQueimaEstoque();
      window.App.showToast(`🔥 Preços promocionais de ${atualizados} produtos aplicados no PDV com sucesso!`, 'success');
    };

    if (window.App && typeof window.App.confirmarAcao === 'function') {
      window.App.confirmarAcao({
        titulo: '🔥 Aplicar Preços de Queima no PDV?',
        mensagem: `Deseja realmente aplicar o preço promocional para os <strong>${selecionados.length} produto(s) selecionado(s)</strong> no PDV?<br><br><span style="font-size: 12.5px; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; padding: 6px 12px; border-radius: 8px; display: inline-block;">🏷️ Os produtos entrarão em oferta com desconto imediatamente no caixa.</span>`,
        icone: '🔥',
        corIcone: '#ea580c',
        bgIcone: '#fff7ed',
        textoConfirmar: '🔥 Sim, Aplicar Preços [ENTER]',
        textoCancelar: 'Cancelar [ESC]',
        perigo: false,
        corConfirmar: 'linear-gradient(135deg, #f97316, #ea580c)',
        onConfirm: executarAplicacao
      });
    } else {
      executarAplicacao();
    }
  },

  compartilharQueimaWhatsApp() {
    const textarea = document.getElementById('queima-whatsapp-texto');
    const texto = textarea?.value || '';
    if (!texto || texto.includes('Selecione ao menos um produto')) {
      window.App.showToast('Selecione produtos para gerar a mensagem de oferta!', 'warning');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        window.App.showToast('📋 Mensagem promocional copiada com sucesso! Pronta para colar no WhatsApp.', 'success');
      }).catch(() => {
        window.App.showToast('📋 Mensagem de oferta pronta!', 'success');
      });
    } else {
      window.App.showToast('📋 Mensagem pronta no campo de prévia!', 'success');
    }
  },

  // =========================================================================
  // MÓDULO 3: PREÇOS DO CLUBE EM LOTE & OFERTA WHATSAPP
  // =========================================================================
  itensPrecoClubeCalculados: [],
  clubeMsgEditadaManualmente: false,
  clubeTelefonesEnviados: {},
  clubeClientesEnvio: [],

  escHtmlClube(valor) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  formatarMoedaClube(valor) {
    const num = parseFloat(valor) || 0;
    return num.toFixed(2).replace('.', ',');
  },

  normalizarTelefoneWhatsAppClube(tel) {
    let d = String(tel || '').replace(/\D/g, '');
    if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
    return d;
  },

  abrirUrlExternaClube(url) {
    if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  },

  abrirModalPrecosClube() {
    if (!StorageService.isModuloAtivo('clubeFidelidade')) {
      window.App.showToast('O módulo Clube Fidelidade não está ativo nesta loja.', 'warning');
      return;
    }
    this.clubeMsgEditadaManualmente = false;
    this.clubeTelefonesEnviados = {};
    const modal = document.getElementById('modal-precos-clube');
    if (modal) modal.classList.add('active');
    document.body.classList.add('modal-open');
    this.preencherFiltroCategoriasClube();
    const busca = document.getElementById('clube-busca-produto');
    if (busca) busca.value = '';
    const buscaCli = document.getElementById('clube-busca-cliente');
    if (buscaCli) buscaCli.value = '';
    const checkAll = document.getElementById('clube-check-all');
    if (checkAll) checkAll.checked = false;
    this.recalcularTabelaPrecosClube();
    this.renderClientesClubeWhatsApp();
  },

  fecharModalPrecosClube() {
    const modal = document.getElementById('modal-precos-clube');
    if (modal) modal.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) {
      document.body.classList.remove('modal-open');
    }
  },

  preencherFiltroCategoriasClube() {
    const sel = document.getElementById('clube-filtro-categoria');
    if (!sel) return;
    const atual = sel.value || 'todas';
    const cats = StorageService.getCategorias() || [];
    sel.innerHTML = `<option value="todas">Todas as categorias</option>` +
      cats.map(c => `<option value="${this.escHtmlClube(c)}">${this.escHtmlClube(c)}</option>`).join('');
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
  },

  marcarChipAtivoClube(btnElement) {
    const box = document.getElementById('clube-chips-desconto');
    if (!box) return;
    box.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
  },

  setDescontoClube(percentual, btnElement) {
    const modo = document.getElementById('clube-modo-preco');
    if (modo) modo.value = 'desconto';
    const inputCustom = document.getElementById('clube-custom-desconto');
    if (inputCustom) inputCustom.value = percentual;
    this.marcarChipAtivoClube(btnElement);
    this.recalcularTabelaPrecosClube();
  },

  setModoPrecoClube(modoValor, btnElement) {
    const modo = document.getElementById('clube-modo-preco');
    if (modo) modo.value = modoValor || 'atual';
    this.marcarChipAtivoClube(btnElement);
    this.recalcularTabelaPrecosClube();
  },

  onInputDescontoClube() {
    const modo = document.getElementById('clube-modo-preco');
    if (modo) modo.value = 'desconto';
    this.marcarChipAtivoClube(null);
    this.recalcularTabelaPrecosClube();
  },

  calcularPrecoClubeDesconto(precoDe, descontoPercent) {
    const fator = (100 - (parseFloat(descontoPercent) || 0)) / 100;
    return Math.max(0.01, Math.round(precoDe * fator * 100) / 100);
  },

  recalcularTabelaPrecosClube() {
    const modo = document.getElementById('clube-modo-preco')?.value || 'desconto';
    const descontoPercent = parseFloat(document.getElementById('clube-custom-desconto')?.value) || 15;
    const produtos = StorageService.getProdutos() || [];
    const prevById = {};
    (this.itensPrecoClubeCalculados || []).forEach(it => {
      prevById[it.id] = {
        selecionado: !!it.selecionado,
        precoManual: !!it.precoManual,
        precoPor: parseFloat(it.precoPor) || 0
      };
    });

    const itens = [];
    produtos.forEach(p => {
      if (!p || !p.id) return;
      const precoDe = parseFloat(p.precoVenda) || 0;
      if (precoDe <= 0) return;
      const precoClubeAtual = parseFloat(p.precoClube) || 0;
      if (modo === 'atual' && precoClubeAtual <= 0) return;

      const prev = prevById[p.id];
      let precoPor;
      let precoManual = !!(prev && prev.precoManual);
      if (precoManual && prev.precoPor > 0) {
        precoPor = prev.precoPor;
      } else if (modo === 'atual') {
        precoPor = precoClubeAtual;
        precoManual = false;
      } else {
        precoPor = this.calcularPrecoClubeDesconto(precoDe, descontoPercent);
        precoManual = false;
      }

      const offCalc = precoDe > 0 ? Math.round((1 - (precoPor / precoDe)) * 100) : 0;
      itens.push({
        id: p.id,
        nome: p.nome || '',
        codigo: p.codigoBarras || '-',
        categoria: p.categoria || 'Geral',
        estoque: parseFloat(p.estoque) || 0,
        unidade: p.unidade || 'un',
        controlarEstoque: p.controlarEstoque !== false,
        precoDe,
        precoClubeAtual,
        precoPor,
        descontoPercent: offCalc > 0 ? offCalc : descontoPercent,
        precoManual,
        selecionado: !!(prev && prev.selecionado)
      });
    });

    itens.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    this.itensPrecoClubeCalculados = itens;
    this.renderTabelaPrecosClube();
  },

  obterItensClubeVisiveis() {
    const termo = (document.getElementById('clube-busca-produto')?.value || '').trim().toLowerCase();
    const categoria = document.getElementById('clube-filtro-categoria')?.value || 'todas';
    const status = document.getElementById('clube-filtro-status')?.value || 'todos';

    return this.itensPrecoClubeCalculados
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => {
        if (categoria !== 'todas' && String(it.categoria || '').toLowerCase() !== String(categoria).toLowerCase()) return false;
        if (status === 'sem-clube' && it.precoClubeAtual > 0) return false;
        if (status === 'com-clube' && it.precoClubeAtual <= 0) return false;
        if (status === 'com-estoque' && (!it.controlarEstoque || it.estoque <= 0)) return false;
        if (termo) {
          const blob = `${it.nome} ${it.codigo} ${it.categoria}`.toLowerCase();
          if (!blob.includes(termo)) return false;
        }
        return true;
      });
  },

  renderTabelaPrecosClube() {
    const tbody = document.getElementById('clube-produtos-tbody');
    const visiveis = this.obterItensClubeVisiveis();
    this.atualizarBadgePrecosClube(visiveis);

    const LIMITE = 200;
    const lista = visiveis.slice(0, LIMITE);

    if (tbody) {
      if (visiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhum produto encontrado. Ajuste a busca ou o filtro.</td></tr>`;
      } else {
        tbody.innerHTML = lista.map(({ it, idx }) => `
          <tr data-idx="${idx}" style="${it.selecionado ? '' : 'opacity: 0.55;'}">
            <td style="text-align: center;">
              <input type="checkbox" ${it.selecionado ? 'checked' : ''} onchange="EstoqueModule.toggleItemPrecoClube(${idx}, this.checked)" style="width: 15px; height: 15px; cursor: pointer;">
            </td>
            <td>
              <strong style="color: var(--text-main); font-size: 13px;">${this.escHtmlClube(it.nome)}</strong>
              <span style="display: block; font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono';">${this.escHtmlClube(it.codigo)}</span>
            </td>
            <td style="text-align: center; font-family: 'JetBrains Mono'; font-weight: 700;">
              ${it.controlarEstoque === false ? '—' : `${it.estoque} ${this.escHtmlClube(it.unidade)}`}
            </td>
            <td style="text-align: right; color: var(--text-dim); font-family: 'JetBrains Mono';">
              R$ ${this.formatarMoedaClube(it.precoDe)}
            </td>
            <td style="text-align: right; font-family: 'JetBrains Mono'; color: ${it.precoClubeAtual > 0 ? '#c2410c' : 'var(--text-dim)'};">
              ${it.precoClubeAtual > 0 ? `R$ ${this.formatarMoedaClube(it.precoClubeAtual)}` : '—'}
            </td>
            <td style="text-align: right;">
              <input type="text" value="${this.formatarMoedaClube(it.precoPor)}" onchange="EstoqueModule.atualizarPrecoManualClube(${idx}, this.value)" style="width: 92px; height: 32px; text-align: right; font-weight: 800; font-family: 'JetBrains Mono'; border-radius: 6px; border: 1px solid #fed7aa; color: #ea580c; padding: 0 8px;">
            </td>
          </tr>
        `).join('') + (visiveis.length > LIMITE
          ? `<tr><td colspan="6" style="text-align: center; padding: 12px; color: #c2410c; font-size: 12px; font-weight: 700;">Mostrando os primeiros ${LIMITE} de ${visiveis.length}. Refine a busca para achar o item.</td></tr>`
          : '');
      }
    }

    this.gerarMensagemWhatsAppClube(false);
  },

  atualizarBadgePrecosClube(visiveis = null) {
    const totalBadge = document.getElementById('clube-total-itens-badge');
    const lista = visiveis || this.obterItensClubeVisiveis();
    const visiveisTela = lista.slice(0, 200);
    const selecionados = this.itensPrecoClubeCalculados.filter(it => it.selecionado).length;
    if (totalBadge) {
      totalBadge.textContent = `${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}` +
        (selecionados ? ` · ${selecionados} marcado${selecionados === 1 ? '' : 's'}` : '');
    }
    const checkAll = document.getElementById('clube-check-all');
    if (checkAll) {
      checkAll.checked = visiveisTela.length > 0 && visiveisTela.every(({ it }) => it.selecionado);
    }
  },

  toggleItemPrecoClube(index, checked) {
    if (this.itensPrecoClubeCalculados[index]) {
      this.itensPrecoClubeCalculados[index].selecionado = checked;
      const row = document.querySelector(`#clube-produtos-tbody tr[data-idx="${index}"]`);
      if (row) row.style.opacity = checked ? '' : '0.55';
      this.atualizarBadgePrecosClube();
      this.gerarMensagemWhatsAppClube(false);
    }
  },

  toggleCheckAllClube(checked) {
    this.obterItensClubeVisiveis().slice(0, 200).forEach(({ idx }) => {
      if (this.itensPrecoClubeCalculados[idx]) {
        this.itensPrecoClubeCalculados[idx].selecionado = checked;
      }
    });
    const tbody = document.getElementById('clube-produtos-tbody');
    if (tbody) {
      tbody.querySelectorAll('tr[data-idx]').forEach(tr => {
        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = checked;
        tr.style.opacity = checked ? '' : '0.55';
      });
    }
    this.atualizarBadgePrecosClube();
    this.gerarMensagemWhatsAppClube(false);
  },

  atualizarPrecoManualClube(index, valorDigitado) {
    const item = this.itensPrecoClubeCalculados[index];
    if (!item) return;
    const precoPor = this.parseMoedaBR(valorDigitado);
    if (precoPor <= 0) {
      window.App.showToast('Informe um preço de clube válido.', 'warning');
      this.renderTabelaPrecosClube();
      return;
    }
    item.precoPor = Math.round(precoPor * 100) / 100;
    item.precoManual = true;
    item.selecionado = true;
    item.descontoPercent = item.precoDe > 0 ? Math.round((1 - (item.precoPor / item.precoDe)) * 100) : 0;
    this.clubeMsgEditadaManualmente = false;
    this.renderTabelaPrecosClube();
  },

  marcarMensagemClubeEditada() {
    this.clubeMsgEditadaManualmente = true;
  },

  gerarMensagemWhatsAppClube(forcar = false) {
    const textarea = document.getElementById('clube-whatsapp-texto');
    if (!textarea) return;
    if (this.clubeMsgEditadaManualmente && !forcar) return;
    if (forcar) this.clubeMsgEditadaManualmente = false;

    const selecionados = this.itensPrecoClubeCalculados.filter(it => it.selecionado);
    if (selecionados.length === 0) {
      textarea.value = 'Selecione ao menos um produto acima para gerar a mensagem da oferta do clube.';
      return;
    }

    const config = StorageService.getConfig() || {};
    const nomeLoja = (config.nomeEmpresa || config.nomeLoja || 'Nossa Loja').trim();

    let msg = `🏅 *OFERTAS EXCLUSIVAS DO CLUBE — ${nomeLoja.toUpperCase()}* 🏅\n`;
    msg += `Só para membros do Clube Fidelidade:\n\n`;

    selecionados.forEach(it => {
      msg += `🏷️ *${it.nome}*\n`;
      if (it.precoPor < it.precoDe && it.descontoPercent > 0) {
        msg += `   De ~R$ ${this.formatarMoedaClube(it.precoDe)}~ por *R$ ${this.formatarMoedaClube(it.precoPor)}* (${it.descontoPercent}% OFF)\n\n`;
      } else {
        msg += `   Preço clube: *R$ ${this.formatarMoedaClube(it.precoPor)}*\n\n`;
      }
    });

    msg += `📍 Mostre seu CPF no caixa para garantir o desconto.\n`;
    msg += `Oferta válida para membros do clube, enquanto durarem os estoques.`;

    textarea.value = msg;
  },

  aplicarPrecosClubeNoPDV() {
    const selecionados = this.itensPrecoClubeCalculados.filter(it => it.selecionado);
    if (selecionados.length === 0) {
      window.App.showToast('Nenhum produto selecionado para atualizar o preço de clube!', 'warning');
      return;
    }

    const executarAplicacao = () => {
      const produtos = StorageService.getProdutos() || [];
      let atualizados = 0;

      selecionados.forEach(it => {
        const idx = produtos.findIndex(p => p.id === it.id);
        if (idx >= 0 && it.precoPor > 0) {
          produtos[idx].precoClube = it.precoPor;
          atualizados++;
        }
      });

      StorageService.saveProdutos(produtos);
      AuditModule.registrarLog(
        'PRECO_CLUBE_LOTE',
        `Atualizado preço de clube em ${atualizados} produto(s).`
      );

      if (window.CloudSyncModule && typeof window.CloudSyncModule.enviarAlteracaoNuvem === 'function') {
        window.CloudSyncModule.enviarAlteracaoNuvem('precos_clube');
      }

      this.renderTabelaProdutos();
      this.recalcularTabelaPrecosClube();
      window.App.showToast(`🏅 Preço de clube aplicado em ${atualizados} produto(s). O preço normal do PDV não foi alterado.`, 'success');
    };

    if (window.App && typeof window.App.confirmarAcao === 'function') {
      window.App.confirmarAcao({
        titulo: '🏅 Aplicar preços do Clube?',
        mensagem: `Deseja gravar o <strong>preço de clube</strong> nos <strong>${selecionados.length} produto(s) selecionado(s)</strong>?<br><br><span style="font-size: 12.5px; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; padding: 6px 12px; border-radius: 8px; display: inline-block;">O preço de venda do caixa continua o mesmo. Só o membro do clube (CPF no PDV) paga o valor especial.</span>`,
        icone: '🏅',
        corIcone: '#ea580c',
        bgIcone: '#fff7ed',
        textoConfirmar: '🏅 Sim, aplicar no clube [ENTER]',
        textoCancelar: 'Cancelar [ESC]',
        perigo: false,
        corConfirmar: 'linear-gradient(135deg, #f97316, #ea580c)',
        onConfirm: executarAplicacao
      });
    } else {
      executarAplicacao();
    }
  },

  obterTextoOfertaClube() {
    const textarea = document.getElementById('clube-whatsapp-texto');
    const texto = (textarea?.value || '').trim();
    if (!texto || texto.includes('Selecione ao menos um produto')) return '';
    return texto;
  },

  compartilharClubeWhatsApp() {
    const texto = this.obterTextoOfertaClube();
    if (!texto) {
      window.App.showToast('Selecione produtos para gerar a mensagem da oferta!', 'warning');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        window.App.showToast('📋 Mensagem do clube copiada! Pode colar no WhatsApp ou usar Enviar em cada cliente.', 'success');
      }).catch(() => {
        window.App.showToast('📋 Mensagem pronta no campo de prévia!', 'success');
      });
    } else {
      window.App.showToast('📋 Mensagem pronta no campo de prévia!', 'success');
    }
  },

  obterClientesClubeWhatsApp() {
    const termo = (document.getElementById('clube-busca-cliente')?.value || '').trim().toLowerCase();
    const soMembros = document.getElementById('clube-somente-membros')?.checked !== false;
    const clientes = StorageService.getClientes() || [];

    return clientes
      .map(c => {
        const tel = this.normalizarTelefoneWhatsAppClube(c.telefone);
        return { ...c, telClean: tel };
      })
      .filter(c => {
        if (c.telClean.length < 10) return false;
        if (soMembros && c.membroClube === false) return false;
        if (termo) {
          const blob = `${c.nome || ''} ${c.telefone || ''} ${c.cpfCnpj || ''}`.toLowerCase();
          if (!blob.includes(termo)) return false;
        }
        return true;
      })
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
  },

  renderClientesClubeWhatsApp() {
    const box = document.getElementById('clube-clientes-lista');
    const badge = document.getElementById('clube-total-clientes-badge');
    const lista = this.obterClientesClubeWhatsApp();
    this.clubeClientesEnvio = lista;
    if (badge) {
      badge.textContent = `${lista.length} ${lista.length === 1 ? 'cliente' : 'clientes'}`;
    }
    if (!box) return;

    if (lista.length === 0) {
      box.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 13px;">Nenhum cliente com WhatsApp encontrado. Cadastre o telefone na aba Clientes.</div>`;
      return;
    }

    box.innerHTML = `<table class="pdv-table"><tbody>${lista.map((c, idx) => {
      const enviado = !!this.clubeTelefonesEnviados[c.telClean];
      const nomeEnc = encodeURIComponent(c.nome || '');
      return `
        <tr style="${enviado ? 'background: #f0fdf4;' : ''}">
          <td>
            <strong style="font-size: 13px; color: var(--text-main);">${this.escHtmlClube(c.nome || 'Cliente')}</strong>
            <span style="display: block; font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono';">${this.escHtmlClube(c.telefone || c.telClean)}</span>
          </td>
          <td style="width: 140px; text-align: right; white-space: nowrap;">
            <button type="button" class="chip-btn" style="height: 32px; font-size: 12px; font-weight: 800; padding: 0 12px; background: ${enviado ? '#15803d' : '#22c55e'}; color: #ffffff; border-color: ${enviado ? '#15803d' : '#22c55e'};" onclick="EstoqueModule.enviarOfertaClubeWhatsApp('${c.telClean}', '${nomeEnc}', ${idx})">
              ${enviado ? '✓ Enviado' : '🟢 Enviar'}
            </button>
          </td>
        </tr>
      `;
    }).join('')}</tbody></table>`;
  },

  montarMensagemClienteClube(nome) {
    const base = this.obterTextoOfertaClube();
    if (!base) return '';
    const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'tudo bem';
    if (/^ol[aá]\b/i.test(base)) return base;
    return `Olá ${primeiro}! 👋\n\n${base}`;
  },

  enviarOfertaClubeWhatsApp(telefoneLimpo, nomeCodificado) {
    const nome = decodeURIComponent(nomeCodificado || '');
    const texto = this.montarMensagemClienteClube(nome);
    if (!texto) {
      window.App.showToast('Selecione produtos e gere a mensagem antes de enviar.', 'warning');
      return;
    }
    const tel = this.normalizarTelefoneWhatsAppClube(telefoneLimpo);
    if (tel.length < 10) {
      window.App.showToast('Telefone do cliente inválido para WhatsApp.', 'warning');
      return;
    }
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`;
    this.abrirUrlExternaClube(url);
    this.clubeTelefonesEnviados[tel] = true;
    this.renderClientesClubeWhatsApp();
    if (window.App) window.App.showToast(`🟢 Abrindo WhatsApp de ${nome || 'cliente'}...`, 'info');
  },

  enviarProximoClienteClubeWhatsApp() {
    const texto = this.obterTextoOfertaClube();
    if (!texto) {
      window.App.showToast('Selecione produtos para gerar a mensagem antes de enviar.', 'warning');
      return;
    }
    const lista = this.obterClientesClubeWhatsApp();
    const proximo = lista.find(c => !this.clubeTelefonesEnviados[c.telClean]);
    if (!proximo) {
      window.App.showToast(lista.length === 0
        ? 'Nenhum cliente com WhatsApp para enviar.'
        : 'Todos os clientes visíveis já foram abertos no WhatsApp nesta sessão.', 'info');
      return;
    }
    this.enviarOfertaClubeWhatsApp(proximo.telClean, encodeURIComponent(proximo.nome || ''));
  }
};
