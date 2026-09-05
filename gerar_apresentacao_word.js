const { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  ImageRun, 
  ShadingType,
  PageBreak,
  Header,
  Footer,
  PageNumber
} = require('docx');
const fs = require('fs');
const path = require('path');

const PRINTS_DIR = path.join(__dirname, 'docs_assets', 'prints');
const OUTPUT_FILE = path.join(__dirname, 'Apresentacao_Comercial_FlowPDV.docx');

function getImageBuffer(filename) {
  const p = path.join(PRINTS_DIR, filename);
  if (fs.existsSync(p)) {
    return fs.readFileSync(p);
  }
  return null;
}

// Cores Oficiais da Identidade Visual FlowPDV
const COLOR_PRIMARY = '0F172A'; // Navy Blue Escuro
const COLOR_ACCENT = '2563EB';  // Azul Real Moderno
const COLOR_GREEN = '059669';   // Verde Sucesso
const COLOR_PURPLE = '7C3AED';  // Roxo Executivo
const COLOR_BG_LIGHT = 'F8FAFC'; // Cinza Fundo Suave
const COLOR_BORDER = 'CBD5E1';  // Borda Neutra
const COLOR_TEXT = '334155';    // Texto Grafite Escuro
const COLOR_MUTED = '64748B';   // Texto Secundário

function criarTituloSecao(numero, titulo, subtitulo) {
  return [
    new Paragraph({
      spacing: { before: 360, after: 80 },
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: `${numero}. ${titulo}`,
          bold: true,
          size: 32, // 16pt
          color: COLOR_ACCENT,
          font: 'Segoe UI'
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: subtitulo,
          italic: true,
          size: 22, // 11pt
          color: COLOR_MUTED,
          font: 'Segoe UI'
        })
      ]
    })
  ];
}

function criarParagrafo(texto, bold = false) {
  return new Paragraph({
    spacing: { before: 80, after: 120, line: 276 },
    alignment: AlignmentType.JUSTIFY,
    children: [
      new TextRun({
        text: texto,
        bold,
        size: 22, // 11pt
        color: COLOR_TEXT,
        font: 'Segoe UI'
      })
    ]
  });
}

function criarTopico(icone, titulo, descricao) {
  return new Paragraph({
    spacing: { before: 60, after: 80, line: 260 },
    children: [
      new TextRun({
        text: `${icone} ${titulo}: `,
        bold: true,
        size: 22,
        color: COLOR_PRIMARY,
        font: 'Segoe UI'
      }),
      new TextRun({
        text: descricao,
        size: 22,
        color: COLOR_TEXT,
        font: 'Segoe UI'
      })
    ]
  });
}

function criarImagemComLegenda(filename, legenda) {
  const buf = getImageBuffer(filename);
  if (!buf) return [];

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 80 },
      children: [
        new ImageRun({
          data: buf,
          transformation: {
            width: 580,
            height: 326
          }
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: `📸 Figura: ${legenda}`,
          italic: true,
          size: 18, // 9pt
          color: COLOR_MUTED,
          font: 'Segoe UI'
        })
      ]
    })
  ];
}

async function gerarDocumento() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Segoe UI',
            size: 22,
            color: COLOR_TEXT
          }
        }
      }
    },
    sections: [
      // ==========================================
      // PÁGINA 1: CAPA EXECUTIVA
      // ==========================================
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: [
          new Paragraph({ spacing: { before: 1200 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: '⚡ FLOWPDV',
                bold: true,
                size: 64, // 32pt
                color: COLOR_ACCENT,
                font: 'Segoe UI'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 400 },
            children: [
              new TextRun({
                text: 'Sistema de Frente de Caixa (PDV Ágil) & Gestão Comercial Completa',
                size: 28, // 14pt
                bold: true,
                color: COLOR_PRIMARY,
                font: 'Segoe UI'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 800 },
            children: [
              new TextRun({
                text: 'Apresentação Comercial, Recursos Técnicos e Manual de Soluções',
                italic: true,
                size: 24,
                color: COLOR_MUTED,
                font: 'Segoe UI'
              })
            ]
          }),

          // Box Destaque de Capa
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'EFF6FF' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_ACCENT },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_ACCENT },
                      left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_ACCENT },
                      right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_ACCENT }
                    },
                    margins: { top: 200, bottom: 200, left: 300, right: 300 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 80 },
                        children: [
                          new TextRun({
                            text: '🚀 Projetado para Adegas, Mercados, Conveniências, Tabacarias, Salgaderias e Comércio Geral',
                            bold: true,
                            size: 22,
                            color: COLOR_ACCENT,
                            font: 'Segoe UI'
                          })
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: 'Tecnologia Local-First (100% Offline-First) • Auto-Preenchimento por Código de Barras (EAN Nacional) • Grade de Fardos • Backup em Nuvem',
                            size: 20,
                            color: COLOR_TEXT,
                            font: 'Segoe UI'
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 1600 } }),

          // Rodapé da Capa
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'Desenvolvido por: ',
                size: 20,
                color: COLOR_MUTED,
                font: 'Segoe UI'
              }),
              new TextRun({
                text: 'Douglas Batista (batistadev)',
                bold: true,
                size: 22,
                color: COLOR_PRIMARY,
                font: 'Segoe UI'
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 0 },
            children: [
              new TextRun({
                text: 'Versão do Sistema: v1.6.1 Pro • Plataforma Windows (10 e 11)',
                size: 18,
                color: COLOR_MUTED,
                font: 'Segoe UI'
              })
            ]
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 2: VISÃO GERAL & DIFERENCIAIS
          // ==========================================
          ...criarTituloSecao(1, 'Visão Geral & Proposta de Valor', 'Por que o FlowPDV é a melhor escolha para o seu comércio?'),
          criarParagrafo('O FlowPDV é uma solução de última geração desenvolvida para atender as reais necessidades do comércio varejista moderno. Ele combina velocidade extrema no balcão, facilidade operacional e segurança total dos dados financeiros.'),
          criarParagrafo('Diferente dos sistemas convencionais lentos e travados na internet, o FlowPDV opera sob a arquitetura Local-First: todo o processamento de vendas, leitura de código de barras e controle de estoque acontece localmente na sua máquina em milissegundos, garantindo que o seu estabelecimento nunca pare de vender mesmo se a internet cair.'),

          new Paragraph({ spacing: { before: 160, after: 80 } }),
          criarTopico('⚡', 'Velocidade Sem Espera', 'Bipou o produto, registrou. Finalização de venda em menos de 3 segundos no balcão com teclado ou leitor.'),
          criarTopico('🌐', '100% Offline-First', 'Independência total de internet para operar o caixa, imprimir cupons térmicos e lançar itens.'),
          criarTopico('🪄', 'Cadastro Inteligente EAN', 'Ao bipar um código de barras de fábrica, o FlowPDV consulta o catálogo oficial nacional e preenche o nome, volume e categoria em meio segundo.'),
          criarTopico('📦', 'Controle Flexível de Estoque', 'Venda itens físicos com controle rígido de quantidade e itens de serviço/lanches sem trava de estoque.'),
          criarTopico('✂️', 'Pagamento Dividido no PDV', 'Receba vendas divididas em duas formas (ex: Dinheiro + PIX, Cartão + Dinheiro) com cálculo automático do troco e saldo restante.'),
          criarTopico('☁️', 'Backup Automático em Nuvem', 'Seus dados sincronizados em nuvem (Firebase Firestore) com total segurança e criptografia.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 3: MÓDULO 1 - FRENTE DE CAIXA (PDV)
          // ==========================================
          ...criarTituloSecao(2, 'Frente de Caixa Ágil (PDV)', 'Interface limpa, moderna e com foco em alta produtividade'),
          criarParagrafo('A tela principal do PDV foi projetada para eliminar cliques desnecessários e agilizar o atendimento em horários de pico. O operador visualiza com clareza o total acumulado, a lista de itens, os atalhos de teclado e o status do turno em tempo real.'),
          criarTopico('🟢', 'Total a Pagar em Destaque Gigante', 'Visibilidade impecável para o operador e o cliente conferirem o valor da compra instantaneamente.'),
          criarTopico('⌨️', 'Atalhos de Teclado Completos', 'Opere 100% pelo teclado: [F1] Buscar Produto, [F4] Finalizar Venda, [F5] Cancelar Venda, [F7] Cortesia, [F9] Sangria e [F10] Bloquear Tela.'),
          criarTopico('📊', 'Mini Dashboard Lateral', 'Acompanhe as vendas do turno, troco inicial e faturamento sem sair da tela de vendas.'),
          ...criarImagemComLegenda('01_frente_de_caixa_pdv.png', 'Tela de Frente de Caixa com itens no carrinho, total em destaque e atalhos rápidos.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 4: MÓDULO 2 - PAGAMENTO DIVIDIDO
          // ==========================================
          ...criarTituloSecao(3, 'Formas de Pagamento & Pagamento Dividido', 'Flexibilidade total para receber como o seu cliente preferir'),
          criarParagrafo('Receba pagamentos com dinheiro (com cálculo automático de troco), PIX com QR Code dinâmico, Cartão de Débito, Cartão de Crédito ou Fiado/Crediário com controle por cliente.'),
          criarParagrafo('Com a inovadora função de Pagamento Dividido [F4], o lojista registra facilmente vendas em que o cliente paga uma parte em dinheiro e o restante no PIX ou Cartão. O sistema calcula o saldo em tempo real e detalha cada parcela no cupom térmico e no fechamento do caixa.'),
          criarTopico('✂️', 'Divisão Instantânea', 'Basta digitar quanto o cliente deu na 1ª forma e o sistema já calcula o restante da 2ª forma.'),
          criarTopico('🖨️', 'Cupom Fiscal Térmico (58mm e 80mm)', 'Impressão rápida com discriminação clara de cada valor pago.'),
          ...criarImagemComLegenda('02_pagamento_dividido.png', 'Modal de Pagamento com divisão entre Dinheiro e PIX.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 5: MÓDULO 3 - GESTÃO DE ESTOQUE & FARDOS
          // ==========================================
          ...criarTituloSecao(4, 'Produtos, Estoque & Grade de Fardos', 'Controle completo de unidades, fardos/packs e serviços'),
          criarParagrafo('O módulo de Gestão de Produtos oferece controle minucioso do catálogo da loja, com filtros rápidos por categoria, badges visuais de estoque (OK, Baixo, Crítico ou Sem Limite) e histórico de movimentações.'),
          criarTopico('🍺', 'Grade Fracionada (Unidade vs Fardo/Pack)', 'Cadastre o produto por unidade (ex: Heineken R$ 8,50) e configure o Pack com 6 unidades por R$ 48,00. O sistema calcula automaticamente o percentual de desconto e dá baixa precisa no estoque unitário.'),
          criarTopico('⚡', 'Controle Opcional (Serviços e Lanches)', 'Permite vender itens artesanais (salgados, cafés, corte de cabelo, mão de obra) sem travar por falta de estoque.'),
          criarTopico('📊', 'Exportação para Excel (.xlsx)', 'Exporte o inventário completo da loja formatado e colorido em planilha Excel com apenas 1 clique.'),
          ...criarImagemComLegenda('03_gestao_produtos_estoque.png', 'Tabela completa de gestão de produtos, estoque e grade fracionada.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 6: MÓDULO 4 - AUTO-PREENCHIMENTO EAN
          // ==========================================
          ...criarTituloSecao(5, 'Cadastro Mágico com EAN Nacional', 'Cadastre centenas de produtos em minutos sem digitação manual'),
          criarParagrafo('O grande diferencial do FlowPDV v1.6.1 é a integração direta com bases de dados de produtos do Brasil (EAN/GTIN). Ao abrir a tela de Novo Produto e bipar qualquer item industrializado com o leitor de código de barras:'),
          criarTopico('🔎', 'Identificação Automática', 'O FlowPDV consulta o catálogo oficial em 0.4s e preenche o Nome Completo e Volume (ex: Coca Cola LT 350ml).'),
          criarTopico('🧠', 'Categorização Semântica', 'O sistema analisa o produto e já seleciona a Categoria correspondente no seu catálogo.'),
          criarTopico('⏩', 'Fluxo Ultrarrápido', 'O cursor pula direto para o campo Preço de Venda. O lojista só digita o preço e salva!'),
          ...criarImagemComLegenda('04_cadastro_produto_ean.png', 'Auto-preenchimento instantâneo ao bipar o código de barras da Coca-Cola.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 7: MÓDULO 5 - TURNO DE CAIXA (ACORDEÃO)
          // ==========================================
          ...criarTituloSecao(6, 'Turno de Caixa Inteligente', 'Controle financeiro com acordeão expansivo em tela cheia'),
          criarParagrafo('O fechamento de caixa do FlowPDV foi aprimorado com um sistema de Acordeão Inteligente: tanto no computador desktop quanto em notebooks, clicar no título da seção expande a tabela em tela cheia, permitindo conferir dezenas de vendas sem aperto visual.'),
          criarTopico('🔒', 'Modo Operador Protegido', 'O operador visualiza apenas as vendas do seu próprio turno, sem acesso a dados confidenciais ou histórico de outros dias.'),
          criarTopico('👔', 'Modo Gerente com Histórico Completo', 'O gerente acessa todo o histórico de turnos anteriores, relatórios de conferência e métricas consolidadas.'),
          criarTopico('💸', 'Controle de Sangrias & Troco', 'Registro detalhado de troco de abertura e retiradas de dinheiro com operador e justificativa.'),
          ...criarImagemComLegenda('05_turno_caixa_acordeao.png', 'Aba de Turno de Caixa com acordeão inteligente e auditoria em tempo real.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 8: MÓDULO 6 - RELATÓRIOS & EXCEL
          // ==========================================
          ...criarTituloSecao(7, 'Relatório Executivo & Exportação Excel', 'Auditoria financeira completa e fechamentos transparentes'),
          criarParagrafo('Ao fechar ou consultar qualquer turno, o FlowPDV gera um Relatório Executivo completo com resumo financeiro, total faturado, saldo esperado na gaveta e quebra por forma de pagamento.'),
          criarTopico('📑', 'Planilhas Excel Formatadas e Coloridas (.xlsx)', 'Geração automática de planilhas com 4 abas profissionais: Resumo Executivo, Detalhamento de Vendas, Itens Vendidos e Sangrias.'),
          criarTopico('🔒', 'Segurança Blindada', 'Funções de exportação protegidas por senha e exclusivas para o perfil Gerente.'),
          ...criarImagemComLegenda('06_relatorio_fechamento_caixa.png', 'Modal de Relatório Executivo com resumo detalhado de fechamento de caixa.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 9: MÓDULO 7 - CONFIGURAÇÕES & NUVEM
          // ==========================================
          ...criarTituloSecao(8, 'Configurações, Backup em Nuvem & Licença', 'Personalização total e segurança que protege o seu negócio'),
          criarParagrafo('A aba de Configurações centraliza a personalização do estabelecimento (nome da empresa, CNPJ, telefone, logotipo no cupom) e os serviços de sincronização em nuvem e atualização com 1 clique.'),
          criarTopico('☁️', 'Sincronização Contínua em Nuvem', 'Backup seguro no Firebase Firestore com criptografia e status de conexão em tempo real.'),
          criarTopico('🚀', 'Atualizações Automáticas com 1 Clique', 'Receba melhorias e novos recursos sem necessidade de reinstalação manual.'),
          ...criarImagemComLegenda('07_configuracoes_e_backup.png', 'Tela de Configurações, Licenciamento SaaS e Status do Backup em Nuvem.'),

          new Paragraph({ children: [new PageBreak()] }),

          // ==========================================
          // PÁGINA 10: TABELA COMPARATIVA & CONTATO
          // ==========================================
          ...criarTituloSecao(9, 'Comparativo de Vantagens do FlowPDV', 'Veja como o FlowPDV supera os softwares antigos de mercado'),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '1E293B' },
                    borders: { top: { style: BorderStyle.SINGLE, color: COLOR_BORDER }, bottom: { style: BorderStyle.SINGLE, color: COLOR_BORDER } },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Recurso / Funcionalidade', bold: true, color: 'FFFFFF', size: 20 })] })]
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '047857' },
                    borders: { top: { style: BorderStyle.SINGLE, color: COLOR_BORDER }, bottom: { style: BorderStyle.SINGLE, color: COLOR_BORDER } },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'FlowPDV Pro ⚡', bold: true, color: 'FFFFFF', size: 20 })] })]
                  }),
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: '64748B' },
                    borders: { top: { style: BorderStyle.SINGLE, color: COLOR_BORDER }, bottom: { style: BorderStyle.SINGLE, color: COLOR_BORDER } },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Sistemas Tradicionais 🛑', bold: true, color: 'FFFFFF', size: 20 })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Funcionamento sem Internet', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ 100% Local-First (Nunca Trava)', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Trava se a internet cair' })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cadastro por Código de Barras', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ Auto-Preenchimento EAN Nacional', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Digitação manual de cada item' })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Venda de Fardo e Unidade no mesmo item', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ Grade Integrada com desconto', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Precisa duplicar o cadastro' })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Pagamento Dividido no Balcão', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ Dinheiro + PIX / Cartão [F4]', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Rígido ou complexo de usar' })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Exportação Completa em Excel', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ Planilhas coloridas automáticas', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Apenas relatórios em PDF/TXT' })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Backup em Nuvem e Multi-Terminal', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✅ Incluso com sincronização realtime', color: COLOR_GREEN, bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '❌ Cobrado à parte com taxas extras' })] })] })
                ]
              })
            ]
          }),

          new Paragraph({ spacing: { before: 400, after: 100 } }),
          ...criarTituloSecao(10, 'Requisitos Técnicos & Contato Comercial', 'Pronto para instalar e começar a faturar'),
          criarTopico('💻', 'Requisitos Mínimos', 'Computador ou Notebook com Windows 10 ou Windows 11 (64-bit), 4GB de memória RAM e 300MB de espaço livre em disco.'),
          criarTopico('🖨️', 'Periféricos Compatíveis', 'Leitores de código de barras USB / Sem Fio, Gavetas de dinheiro automáticas e Impressoras Térmicas de cupom (58mm e 80mm - Bematech, Elgin, Epson, Daruma, POS, etc.).'),
          
          new Paragraph({ spacing: { before: 200 } }),

          // Box de Contato Final
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_PRIMARY },
                      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_PRIMARY },
                      left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_PRIMARY },
                      right: { style: BorderStyle.SINGLE, size: 8, color: COLOR_PRIMARY }
                    },
                    margins: { top: 200, bottom: 200, left: 300, right: 300 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: '📞 Solicite uma Demonstração ou Adquira sua Licença',
                            bold: true,
                            size: 26,
                            color: COLOR_PRIMARY,
                            font: 'Segoe UI'
                          })
                        ]
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 100, after: 0 },
                        children: [
                          new TextRun({
                            text: 'Desenvolvedor Responsável: Douglas Batista • FlowPDV Brasil\nWhatsApp & Suporte Técnico: Entre em contato para ativação imediata!',
                            size: 22,
                            color: COLOR_MUTED,
                            font: 'Segoe UI'
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_FILE, buffer);
  console.log(`🎉 DOCUMENTO WORD GERADO COM SUCESSO EM: ${OUTPUT_FILE}`);
}

gerarDocumento().catch(err => console.error('Erro ao gerar Word:', err));
