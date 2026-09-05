const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.join(__dirname, 'docs_assets', 'prints');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(win, filename) {
  await sleep(700);
  const image = await win.webContents.capturePage();
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, image.toPNG());
  console.log(`📸 Screenshot salvo: ${filename}`);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.maximize();
  await win.loadURL('http://127.0.0.1:8085');
  await sleep(1500);

  // 1. Configurar licença oficial válida por 1 ano sem avisos
  await win.webContents.executeJavaScript(`
    (() => {
      const dataFutura = new Date();
      dataFutura.setFullYear(dataFutura.getFullYear() + 1);

      const lic = {
        clienteId: 'CLI-884210',
        chaveLicenca: 'LIC-FLOW-884210',
        nomeCliente: 'Adega & Depósito Central',
        razaoSocial: 'Adega & Depósito Central Ltda',
        status: 'ativa',
        categorias: ['Geral', 'Alimentos', 'Bebidas', 'Não Alcoólicos', 'Cervejas', 'Destilados', 'Snacks & Tabacaria', 'Gelo & Carvão'],
        dataExpiracao: dataFutura.toISOString(),
        vencimento: dataFutura.toISOString(),
        diasTolerancia: 5,
        valorMensal: 89.90,
        pinGerente: '1234',
        chavePixSuporte: '19999997777',
        whatsappSuporte: '(19) 99999-7777'
      };
      localStorage.setItem('adega_licenca', JSON.stringify(lic));
      localStorage.setItem('flowpdv_licenca_local', JSON.stringify(lic));
      localStorage.setItem('flowpdv_licenca_ativa', 'true');
      localStorage.setItem('flowpdv_perfil_atual', 'gerente');
      localStorage.setItem('flowpdv_versao_instalada', '1.6.1');

      const configLoja = {
        nomeLoja: 'Adega & Depósito Central',
        cnpj: '45.123.789/0001-20',
        telefone: '(19) 99876-5432',
        cidade: 'Campinas / SP',
        chavePix: '45.123.789/0001-20'
      };
      localStorage.setItem('adega_config_loja', JSON.stringify(configLoja));

      // Usuário Gerente Logado
      const gerente = { id: 'USR-GERENTE', nome: 'Douglas Batista', cargo: 'gerente', pin: '1234', ativo: true };
      sessionStorage.setItem('flowpdv_usuario_logado', JSON.stringify(gerente));
      localStorage.setItem('flowpdv_usuarios', JSON.stringify([gerente]));

      // Produtos
      const prods = [
        { id: 'PROD-01', nome: 'Refrigerante Coca-Cola Lata 350ml', categoria: 'Não Alcoólicos', precoVenda: 5.50, precoCusto: 3.10, estoque: 48, estoqueMinimo: 10, codigoBarras: '7894900010015', gradeHabilitada: true, fatorConversao: 12, precoFardo: 60.00, codigoBarrasFardo: '7894900010016', unidadeFracionada: 'Pack c/ 12', controlarEstoque: true },
        { id: 'PROD-02', nome: 'Cerveja Heineken Long Neck 330ml', categoria: 'Cervejas', precoVenda: 8.50, precoCusto: 5.20, estoque: 72, estoqueMinimo: 15, codigoBarras: '7896045506873', gradeHabilitada: true, fatorConversao: 6, precoFardo: 48.00, unidadeFracionada: 'Pack c/ 6', controlarEstoque: true },
        { id: 'PROD-03', nome: 'Whisky Johnnie Walker Black Label 1L', categoria: 'Destilados', precoVenda: 169.90, precoCusto: 115.00, estoque: 14, estoqueMinimo: 4, codigoBarras: '5000267024202', controlarEstoque: true },
        { id: 'PROD-04', nome: 'Energético Red Bull Energy Drink 250ml', categoria: 'Não Alcoólicos', precoVenda: 10.00, precoCusto: 6.80, estoque: 35, estoqueMinimo: 8, codigoBarras: '9002490100070', gradeHabilitada: true, fatorConversao: 4, precoFardo: 38.00, unidadeFracionada: 'Pack c/ 4', controlarEstoque: true },
        { id: 'PROD-05', nome: 'Salgadinho Doritos Queijo Nacho 140g', categoria: 'Snacks & Tabacaria', precoVenda: 12.00, precoCusto: 7.50, estoque: 26, estoqueMinimo: 6, codigoBarras: '7892840812973', controlarEstoque: true },
        { id: 'PROD-06', nome: 'Gelo Filtrado Pacote 5kg', categoria: 'Gelo & Carvão', precoVenda: 15.00, precoCusto: 7.00, estoque: 20, estoqueMinimo: 5, codigoBarras: '2000000000001', controlarEstoque: true }
      ];
      localStorage.setItem('adega_produtos', JSON.stringify(prods));

      // Turno Aberto
      const agora = new Date();
      const turno = {
        id: 'TRN-894105',
        dataAbertura: new Date(agora.getTime() - 1000 * 60 * 180).toISOString(),
        valorAbertura: 150.00,
        trocoInicial: 150.00,
        operador: 'Douglas Batista',
        status: 'aberto',
        vendasIds: ['VND-001', 'VND-002'],
        sangrias: []
      };
      localStorage.setItem('adega_turno_atual', JSON.stringify(turno));

      const turnoPassado = {
        id: 'TRN-784102',
        dataAbertura: new Date(agora.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        dataFechamento: new Date(agora.getTime() - 1000 * 60 * 60 * 16).toISOString(),
        valorAbertura: 100.00,
        trocoInicial: 100.00,
        operador: 'Douglas Batista',
        status: 'fechado',
        vendasIds: ['VND-001', 'VND-002'],
        totalVendido: 278.00,
        totalGeralEsperado: 378.00,
        sangrias: []
      };
      localStorage.setItem('adega_turnos_historico', JSON.stringify([turnoPassado]));

      const vendas = [
        {
          id: 'VND-001',
          data: new Date(agora.getTime() - 1000 * 60 * 95).toISOString(),
          itens: [
            { id: 'PROD-02', nome: 'Cerveja Heineken Long Neck 330ml', precoUnitario: 8.50, quantidade: 4, totalItem: 34.00, tipoVenda: 'unidade' },
            { id: 'PROD-05', nome: 'Salgadinho Doritos Queijo Nacho 140g', precoUnitario: 12.00, quantidade: 2, totalItem: 24.00, tipoVenda: 'unidade' }
          ],
          subtotal: 58.00,
          desconto: 0,
          total: 58.00,
          formaPagamento: 'pix',
          status: 'concluida',
          operador: 'Douglas Batista'
        },
        {
          id: 'VND-002',
          data: new Date(agora.getTime() - 1000 * 60 * 40).toISOString(),
          itens: [
            { id: 'PROD-03', nome: 'Whisky Johnnie Walker Black Label 1L', precoUnitario: 169.90, quantidade: 1, totalItem: 169.90, tipoVenda: 'unidade' },
            { id: 'PROD-04', nome: 'Energético Red Bull 250ml', precoUnitario: 10.00, quantidade: 4, totalItem: 40.00, tipoVenda: 'unidade' },
            { id: 'PROD-06', nome: 'Gelo Filtrado Pacote 5kg', precoUnitario: 15.00, quantidade: 1, totalItem: 15.00, tipoVenda: 'unidade' }
          ],
          subtotal: 224.90,
          desconto: 4.90,
          total: 220.00,
          formaPagamento: 'cartao_credito',
          status: 'concluida',
          operador: 'Douglas Batista'
        }
      ];
      localStorage.setItem('adega_vendas', JSON.stringify(vendas));

      // Desativar todas as telas de bloqueio
      document.querySelectorAll('.lock-screen-overlay').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
      });

      const modalAtiv = document.getElementById('modal-ativacao-sistema');
      if (modalAtiv) {
        modalAtiv.style.display = 'none';
        modalAtiv.classList.remove('active');
      }

      const modalPos = document.getElementById('modal-pos-atualizacao');
      if (modalPos) {
        modalPos.style.display = 'none';
        modalPos.classList.remove('active');
      }
    })();
  `);

  // Recarregar a página com todos os dados já gravados no storage correto
  await win.reload();
  await sleep(2500);

  // Garantir usuário logado e remover avisos de expiração
  await win.webContents.executeJavaScript(`
    document.querySelectorAll('.lock-screen-overlay, #modal-ativacao-sistema, #modal-pos-atualizacao').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('active');
    });
    const bannerAviso = document.getElementById('licenca-aviso-banner') || document.querySelector('.banner-aviso-licenca');
    if (bannerAviso) bannerAviso.style.display = 'none';

    if (window.AuthModule) {
      window.AuthModule.fecharTelaLogin();
      window.AuthModule.atualizarHeaderUsuario();
    }
  `);

  await sleep(600);

  // ==========================================
  // SCREENSHOT 1: FRENTE DE CAIXA (PDV ÁGIL)
  // ==========================================
  await win.webContents.executeJavaScript(`
    window.App.trocarAba('pdv');
    const prods = window.StorageService.getProdutos();
    if (prods && prods.length > 0 && window.PdvModule) {
      window.PdvModule.carrinho = [];
      window.PdvModule.adicionarAoCarrinho(prods[0], 2, false);
      window.PdvModule.adicionarAoCarrinho(prods[1], 1, true);
      window.PdvModule.adicionarAoCarrinho(prods[4], 1, false);
      window.PdvModule.renderMiniDashboardTurno();
    }
    const banner = document.getElementById('licenca-aviso-banner');
    if (banner) banner.style.display = 'none';
  `);
  await capture(win, '01_frente_de_caixa_pdv.png');

  // ==========================================
  // SCREENSHOT 2: MODAL DE PAGAMENTO DIVIDIDO [F4]
  // ==========================================
  await win.webContents.executeJavaScript(`
    if (window.PdvModule) {
      window.PdvModule.abrirModalPagamento();
      setTimeout(() => {
        window.PdvModule.toggleDividirPagamento();
        const input1 = document.getElementById('pag-dividido-valor1');
        if (input1) {
          input1.value = '30';
          window.PdvModule.calcularDivisaoResto();
        }
      }, 250);
    }
  `);
  await sleep(900);
  await capture(win, '02_pagamento_dividido.png');

  // Fechar modal de pagamento
  await win.webContents.executeJavaScript(`
    if (window.PdvModule) window.PdvModule.fecharModalPagamento();
  `);
  await sleep(400);

  // ==========================================
  // SCREENSHOT 3: PRODUTOS & ESTOQUE (TABELA)
  // ==========================================
  await win.webContents.executeJavaScript(`
    window.App.trocarAba('estoque');
    if (window.EstoqueModule) window.EstoqueModule.renderTabelaProdutos();
    const banner = document.getElementById('licenca-aviso-banner');
    if (banner) banner.style.display = 'none';
  `);
  await capture(win, '03_gestao_produtos_estoque.png');

  // ==========================================
  // SCREENSHOT 4: MODAL NOVO PRODUTO COM EAN
  // ==========================================
  await win.webContents.executeJavaScript(`
    if (window.EstoqueModule) {
      window.EstoqueModule.abrirModalProduto();
      setTimeout(() => {
        const inputCod = document.getElementById('prod-codigo-barras');
        if (inputCod) {
          inputCod.value = '7894900010015';
          window.EstoqueModule.consultarEanOnline('7894900010015', true);
        }
      }, 300);
    }
  `);
  await sleep(1800);
  await capture(win, '04_cadastro_produto_ean.png');

  // Fechar modal de produto
  await win.webContents.executeJavaScript(`
    if (window.EstoqueModule) window.EstoqueModule.fecharModalProduto();
  `);
  await sleep(400);

  // ==========================================
  // SCREENSHOT 5: TURNO DE CAIXA (ACORDEÃO)
  // ==========================================
  await win.webContents.executeJavaScript(`
    window.App.trocarAba('caixa');
    if (window.CaixaModule) {
      window.CaixaModule.init();
      window.CaixaModule.alternarSecao('vendas');
    }
    const banner = document.getElementById('licenca-aviso-banner');
    if (banner) banner.style.display = 'none';
  `);
  await capture(win, '05_turno_caixa_acordeao.png');

  // ==========================================
  // SCREENSHOT 6: RELATÓRIO EXECUTIVO DE FECHAMENTO
  // ==========================================
  await win.webContents.executeJavaScript(`
    if (window.CaixaModule) {
      const turnos = window.StorageService.getHistoricoTurnos();
      const t = turnos && turnos.length > 0 ? turnos[0] : window.StorageService.getTurnoAtual();
      window.CaixaModule.verDetalhesTurno(t);
    }
  `);
  await sleep(700);
  await capture(win, '06_relatorio_fechamento_caixa.png');

  // Fechar modal de detalhes
  await win.webContents.executeJavaScript(`
    if (window.CaixaModule) window.CaixaModule.fecharModalDetalhes();
  `);
  await sleep(400);

  // ==========================================
  // SCREENSHOT 7: CONFIGURAÇÕES & BACKUP
  // ==========================================
  await win.webContents.executeJavaScript(`
    window.App.trocarAba('config');
    const banner = document.getElementById('licenca-aviso-banner');
    if (banner) banner.style.display = 'none';
  `);
  await capture(win, '07_configuracoes_e_backup.png');

  console.log('✅ TODAS AS TELAS FORAM CAPTURADAS COM SUCESSO!');
  app.quit();
});
