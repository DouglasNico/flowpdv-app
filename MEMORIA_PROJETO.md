# 🧠 MEMÓRIA DO PROJETO — FLOWPDV

> **Documentação Técnica, Histórico de Versões, Regras de Negócio e Arquitetura**  
> *Última atualização:* 31 de Agosto de 2026  
> *Versão Atual:* **v1.9.9**  
> *Desenvolvedor:* Douglas Batista / batistadev  

---

## 📌 1. Visão Geral da Arquitetura

O **FlowPDV** é um sistema completo de **Frente de Caixa (PDV Ágil) e Gestão Comercial** projetado sob o paradigma **Local-First (Offline-First)**:

* **Processamento Local:** Toda operação de caixa (leitura de código de barras, cálculo de troco, movimentação de estoque, sangrias e impressão térmica) ocorre 100% no hardware do cliente em milissegundos, sem depender de conexão com a internet.
* **Persistência Segura:** Dados gravados em `localStorage` e arquivos JSON isolados na pasta imutável do sistema (`%APPDATA%\flowpdv`).
* **Nuvem (Firebase Firestore):** Utilizada exclusivamente para:
  1. Validação e sincronização de **Licenças SaaS** em tempo real.
  2. **Backup e Restauração em Nuvem** dos dados da loja.
  3. Gestão remota de bloqueios, limites de terminais e recuperação de PIN via **Painel Master Admin** (`flowpdv-master-admin`).
  4. **Auditoria Centralizada de Lojas em Tempo Real (`auditoria_lojas`):** Registro de eventos operacionais críticos (cortesias, cancelamentos, sangrias, fechamentos de caixa, movimentações de estoque) visíveis instantaneamente pelo administrador no Painel Master.
  5. **FlowPDV Gestor Mobile (Companion App PWA — `cliente-flowpdv`):** Aplicativo web progressivo (PWA) leve e responsivo para smartphones (`cliente.flowpdv.com.br`), permitindo ao dono da loja acompanhar faturamento do dia, saldo de gaveta, estoque baixo, sugestão de reposição, contas a pagar, clientes no fiado (com botão de cobrança no WhatsApp) e auditoria de qualquer lugar via Chave de Licença + PIN do Gerente.
  6. **FlowPDV Site Oficial & Landing Page (`flowpdv-site`):** Site institucional e comercial de alta conversão (`www.flowpdv.com.br`) para apresentação dos recursos, planos de assinatura, comparativo técnico, FAQ e captação de clientes via WhatsApp.
* **Distribuição e Atualizações Automáticas:** Servidas via CDN global do **GitHub Releases** (`DouglasNico/flowpdv`), permitindo atualização silenciosa com 1 clique para todos os clientes sem custo de servidor.

---

## 🚀 2. Histórico de Versões & Melhorias (Changelog)

### **v1.9.9** *(Versão Atual)*
* **Escala Visual 100% Nítida & Otimização Final de Layout:**
  1. *Restauração da Escala Nativa:* Remoção do zoom forçado para manter a Frente de Caixa (PDV), totalizador em verde (`R$ 0,00`), leitor de código de barras e botões com máxima legibilidade, tamanho e nitidez.
  2. *Toolbar de Estoque Proporcional:* Botões de ação do estoque organizados em linha horizontal contínua sem quebras.
  3. *Smart Merge Anti-Perda & Detecção Dinâmica de Categorias no XML:* Garantia de sincronização imediata em múltiplos computadores e mapeamento automático de categorias ativas da loja.
  4. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.9.

### **v1.9.8**
* **Alinhamento Perfeito de Layout para Notebooks & Mapeamento Inteligente de Categorias XML:**
  1. *Correção de Cascata CSS Responsiva:* Regras de compensação de escala de DPI (Windows 125%/150%) e resoluções de notebooks (1366x768 / 1080p) realocadas para o final da folha de estilos com precedência máxima (`!important`), garantindo aplicação imediata e uniforme.
  2. *Toolbar de Estoque em Linha Única:* Redesign dos botões de ação do estoque (`⚠️ Estoque Baixo`, `📋 Lista Compras`, `📥 Importar XML`, `📥 Importar Excel`, `📊 Exportar Excel`, `➕ Novo Produto`) para caberem em uma única linha harmônica e elegante sem quebras ou desalinhamentos.
  3. *Mapeamento Dinâmico de Categorias no XML:* Algoritmo do importador de NF-e agora consulta em tempo real as categorias ativas cadastradas na loja (ex: `Bebidas`, `Cervejas`, `Não Alcoólicos`, `Alimentos`), associando com 100% de precisão.
  4. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.8.

### **v1.9.7**
* **Sincronização Multi-Terminal Anti-Perda (Smart Merge) & Otimizações de Layout para Notebooks:**
  1. *Sincronização em Nuvem na Entrada de XML:* Ao confirmar a entrada de notas fiscais XML, o sistema agora envia imediatamente a nova base de produtos e contas a pagar para a nuvem (`enviarAlteracaoNuvem('importacao_xml')`), evitando que o login por outro computador desfaça as alterações.
  2. *Mesclagem Inteligente Anti-Perda (Smart Merge):* Ao iniciar o sistema em outro computador, o `CloudSyncModule` agora consolida os produtos, clientes e contas a pagar locais com a nuvem sem apagar nenhum item novo criado em terminais diferentes.
  3. *Padronização da Categoria do XML:* Ao importar despesas da NF-e, as parcelas são sempre registradas com a categoria padrão `Fornecedores`.
  4. *Ajustes de Layout para Telas Pequenas e Notebooks:* Otimização do header superior, quebra de linha suave na toolbar de estoque, menu e botões para telas compactas e notebooks com escala de DPI do Windows (125%/150%).
  5. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.7.

### **v1.9.6**
* **Padronização Global de Moeda (pt-BR) e Modais de Confirmação Modernos:**
  1. *Formatação de Moeda com Separadores de Milhar:* Todos os indicadores de Faturamento, Ticket Médio, Curva ABC, Mini Dashboard do Turno e Contas a Pagar agora utilizam o padrão financeiro brasileiro com ponto no milhar e vírgula nos centavos (ex: `R$ 2.870,99`, `R$ 11.850,00`, `R$ 1.630,00`).
  2. *Substituição de Popups Nativos por Modais Customizados:* Confirmações de exclusão de despesas no Contas a Pagar, exclusão de clientes e restauração de backup agora utilizam o modal moderno e estilizado (`App.confirmarAcao`) no lugar das caixas de diálogo padrão do navegador.
  3. *Manual do Sistema em HTML para PDF:* Criação do manual completo ilustrado com prints reais, tabelas de atalhos e suporte a exportação direta em PDF A4 (`MANUAL_DO_SISTEMA_FLOWPDV.html`).
  4. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.6.

### **v1.9.5**
* **Formatação Inteligente Title Case no Importador de XML, Correção de Persistência no Contas a Pagar e Permissão Restrita:**
  1. *Formatação de Nomes de Produtos (Title Case):* Os nomes extraídos das notas fiscais XML (que chegam em letras maiúsculas brutas da SEFAZ) agora são automaticamente convertidos para um formato elegante e padronizado (ex: `Cerveja Corona Extra 330ml`, `Cerveja Heineken Lager Long Neck 330ml`, `Refrigerante Coca-Cola Original Lata 350ml`).
  2. *Correção de Persistência de Boletos no Financeiro:* Corrigida chamada de método `saveContasPagar()` durante a confirmação de entrada do XML, garantindo que todos os boletos sejam agendados instantaneamente no Contas a Pagar sem erro de runtime.
  3. *Botão de Importar XML Restrito ao Gerente:* O botão de importação de XML no estoque fica visível apenas para usuários com perfil de Gerente/Administrador (e exige autenticação com PIN caso um operador tente acessar).
  4. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.5.

### **v1.9.4**
* **Ordenação Inteligente por Vencimento e Formatação Monetária no Contas a Pagar:**
  1. *Organização Cronológica das Despesas:* Contas a pagar agora são listadas ordenadas por data de vencimento (as contas mais antigas, vencidas ou que vencem hoje aparecem primeiro no topo). Contas já pagas ficam no final.
  2. *Formatação com Separadores de Milhar (pt-BR):* Os cards de métricas no topo (`Total a Pagar Pendente`, `Contas Vencidas`, `Total Pago`) e a tabela agora exibem os números com separador de milhar e vírgula nos centavos (ex: `R$ 11.850,00`, `R$ 1.630,00`, `R$ 1.256,53`).
  3. *Padronização do Botão de XML:* Botão no toolbar de estoque ajustado para o estilo elegante padrão.
  4. *Integração Demonstrativa de Balança e TEF:* Visor digital em tempo real para balança de checkout e processamento interativo de cartão integrado (TEF/Smart POS).
  5. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.4.

### **v1.9.3**
* **Segmentação Modular por Licença (Master Admin) & Importador Automático de XML de Notas de Entrada (NF-e):**
  1. *Controle Total de Segmentos no Master Admin:* Seletor completo de ramos de comércio (Adega, Supermercado, Açougue, Hortifrúti, Padaria, Conveniência, Tabacaria, Vestuário, Lanchonete, Comércio Geral) com presets automáticos de categorias e módulos.
  2. *Módulos Habilitados por Licença (Feature Flags):* O administrador controla pelo Master Admin se o PDV exibe ou oculta Fardos & Packs, Venda por Balança/Kg, Controle de Validade, Grade de Roupas, Fiado no WhatsApp e Importador de XML.
  3. *Adaptação Dinâmica de Interface do PDV:* O cadastro de produtos e a toolbar do estoque mostram/escondem campos automaticamente baseados nos módulos da licença do cliente.
  4. *Importador de XML de Notas Fiscais de Entrada (NF-e):* Drag & drop de arquivos `.xml` de compras com leitura automática de fornecedor, itens, NCM, quantidades, conversão de caixas/fardos, de-para com estoque atual e margem de lucro sugerida.
  5. *Integração Automática com o Contas a Pagar:* Agendamento automático das duplicatas/boletos da NF-e no financeiro com data de vencimento e valor exatos.
  6. *Auditoria de Entrada de Estoque:* Registro detalhado de cada XML importado no histórico de auditoria sincronizado na nuvem.

### **v1.9.2**
* **Melhorias em Contas a Pagar, Máscara de Moeda, Calendário e Correção de Teclado no Caixa:**
  1. *Contas a Pagar com Status Alinhado:* Tags de status (`⏳ Pendente`, `✅ Paga`, `🚨 Vencida`) ajustadas com `white-space: nowrap` e `display: inline-flex` para evitar quebras em duas linhas.
  2. *Botão "💵 Pagar" Moderno e Quadrado:* Formato limpo com bordas arredondadas e efeito de hover elevado com brilho e transição suave.
  3. *Auto-Preenchimento e Máscara de Moeda no Cadastro de Despesa:* Campo de valor com máscara dinâmica em tempo real (ex: `222550` -> `2.225,50`).
  4. *Abertura de Calendário no Campo Todo:* Clicar em qualquer área do campo de data de vencimento abre o calendário nativo instantaneamente via `showPicker()`.
  5. *Correção do Atalho [ESC] no Pós-Venda do Caixa:* Pressionar [ESC] na tela de conclusão de venda fecha o modal diretamente sem disparar a rotina de cancelamento do carrinho vazio ao fundo.
  6. *Build de Produção Oficial:* Gerado novo instalador `FlowPDV-Setup.exe` v1.9.2.

### **v1.9.1**
* **Padronização Global de Contato (Douglas Batista — WhatsApp 19 98963-2127), Otimização de Performance no Mobile e Título Profissional:**
  1. *Contato Oficial Unificado:* Todos os canais de contato, links diretos de WhatsApp (`wa.me/5519989632127`) e chaves PIX de renovação de licença foram padronizados para **Douglas Batista / (19) 98963-2127** no sistema desktop, no site oficial e no companion app.
  2. *Título Profissional no App Mobile:* O app móvel foi renomeado de *"FlowPDV Gestor - Painel do Dono"* para **`FlowPDV — Central de Gestão Comercial`**, com apresentação refinada para o comerciante.
  3. *Performance Móvel 0ms:* Implementado carregamento instantâneo via Cache-First, consultas Firestore 100% paralelas e Service Worker Stale-While-Revalidate no PWA móvel.
  4. *Build de Produção Oficial:* Gerado novo instalador assinado `FlowPDV-Setup.exe` v1.9.1.

### **v1.9.0**
* **Carrossel Inteligente com Setas & Auto-Scroll no [F2] e Fluxo Direto de Auto-Update:**
  1. *Chips de Categoria com Navegação Suave [F2]:* Adicionadas setas de navegação lateral (`‹` e `›`) com auto-scroll suave. Ao clicar em qualquer categoria no canto direito, o carrossel se move automaticamente centralizando o chip selecionado.
  2. *Scrollbar Nativa Ocultada:* Eliminada a barra de rolagem cinza sob os chips, tornando o design do modal F2 limpo e minimalista.
  3. *Fluxo de Atualização Automática sem Atrito:* Ao concluir o download de uma nova versão (100%), a tela exibe diretamente a mensagem de status `"🔄 Reiniciando o aplicativo..."` e reinicia o aplicativo automaticamente em 800ms, sem botões intermediários dispensáveis.
  4. *Build de Produção Assinada:* Gerado instalador oficial `FlowPDV-Setup.exe` v1.9.0.

### **v1.8.9**
* **Listagem Universal Completa no Busca Rápida [F2], Categorias Inteligentes e Estabilidade Geral:**
  1. *F2 com Catálogo 100% Exibido:* Eliminado o corte arbitrário de produtos. Toda a base de produtos cadastrados agora é renderizada de ponta a ponta com busca instantânea por nome, código unitário, código de fardo, categoria e ID.
  2. *Contagem Dinâmica de Categorias:* Cada chip de categoria no topo do modal F2 agora calcula e exibe em tempo real a quantidade exata de produtos vinculados (`⭐ Todos (X)`, `🍺 Bebidas (Y)`, `🌾 Alimentos (Z)`).
  3. *Filtragem Inclusiva e Tolerante a Espaços:* Ajustada a comparação de categorias para suportar produtos sem categoria definida (padronizados para `Geral`) e busca aproximada.
  4. *Compilação Oficial de Produção:* Gerado novo executável assinado `FlowPDV-Setup.exe` v1.8.9.

### **v1.8.8**
* **Refinamento de Dados Fiscais, Busca [F2] com Chips de Categorias, Ações de Histórico de Caixa e Sync Realtime no Mobile:**
  1. *Campos Fiscais CSOSN & Origem sem Sobreposição:* Reestruturado o layout do formulário na aba Dados Fiscais & NFC-e com a classe `.form-select-custom` e contêineres dedicados, garantindo altura uniforme (42px), visual limpo e sem sobreposição de campos.
  2. *Ações do Histórico de Caixas 100% Funcionais:* Implementados os métodos `CaixaModule.imprimirComprovanteTurnoFechado` (reimpressão térmica direta do comprovante de fechamento) e `CaixaModule.exportarTurnoFechadoExcel` (geração de planilha .xlsx completa com resumo financeiro e lista de vendas).
  3. *Busca Rápida de Produtos [F2] com Chips de Categorias:* Adicionada barra dinâmica com chips de categorias (`Todos`, `Bebidas`, `Alimentos`, `Destilados`, etc.) com contagem de itens em tempo real, permitindo filtrar por categoria ou pesquisar por texto em todas as categorias com ordenação inteligente.
  4. *Sincronização em Tempo Real no Companion App Mobile (`cliente.flowpdv.com.br`):*
     - Corrigido o filtro de datas das vendas do dia para interpretar `v.data`, `v.dataHora` e `v.criadoEm` de forma unificada.
     - Implementado listener `onSnapshot` do Firestore no mobile para atualizar métricas de faturamento, gaveta e últimas vendas em tempo real (0ms delay) assim que uma venda for concluída no PDV.
     - Desativado o zoom indesejado por duplo clique no smartphone (`touch-action: manipulation` e listener de toque preventivo).
  5. *Decodificador de Balança Integrado e Validado:* Confirmada a leitura nativa de código de barras de balança (EAN-13 iniciado com `2`) com suporte automático a pesagem em kg ou valor total em reais.

### **v1.8.7**
* **Padronização Global de Botões de Ação, Remoção de Saltos Visuais no Hover e Alinhamento Preciso de Tabelas:**
  1. *Botões Principais Padronizados em Laranja:* Todas as ações de criação do sistema (`Novo Produto`, `Abrir Turno de Caixa`, `Novo Cliente`, `Nova Despesa`, `Nova Categoria`, `Novo Funcionário`) unificadas no estilo gradiente laranja (`#f97316` ➔ `#ea580c`) com alta visibilidade.
  2. *Remoção de Efeitos de Salto no Hover (`translateY`):* Eliminado o movimento vertical dos botões e cards ao passar o cursor, mantendo transições suaves apenas de cor e contraste.
  3. *Subnavegação da Gerência Estável:* Redesenhadas as abas da Central do Dono para formato clean, sem destaque roxo invasivo e sem saltos de tamanho na seleção.
  4. *Sem Quebra de Linha em Badges de Tabelas:*
     - *Curva ABC:* Coluna e badges de Categoria com `white-space: nowrap` e ícones oficiais.
     - *Estoque:* Coluna `Estoque Atual` com largura de 170px e badges alinhados sem quebrar palavras.
     - *Funcionários:* Badges de Cargo (`👑 Gerente`, `👤 Operador de Caixa`) com largura uniforme e centralização.
  5. *Conferência de Caixa Estruturada na Auditoria:* Log de Fechamento de Caixa com mini dashboard de conferência (Esperado, Informado e Diferença com destaque para Falta ou Sobra) e formatação de moeda brasileira (`R$ XX,XX`).

### **v1.8.6**
* **Harmonização Visual do Estoque, Categorização Precisa na Curva ABC e Refinamento de Auditoria:**
  1. *Curva ABC com Categorização Real:* Corrigido o lookup de categorias dos produtos vendidos para cruzar diretamente com a base de estoque ativa (por ID, EAN e nome limpo), eliminando a classificação genérica como "Geral".
  2. *Toolbar de Estoque Padronizada:* Todos os botões superiores da aba Estoque (`Estoque Baixo`, `Lista de Compras`, `Importar`, `Exportar Excel` e `Novo Produto`) receberam padrão visual uniforme e harmonioso.
  3. *Cards de Categoria com Ações Centralizadas:* Botões `✏️ Renomear` e `🗑️ Excluir` centralizados e equilibrados na base do card com visual moderno.
  4. *Modal de Auditoria & Cortesia Aprimorado:* Destaque do **Motivo da Cortesia**, formatação limpa de itens movimentados (quantidade e valor) e formatação de todos os valores monetários em formato `R$ XX,XX`.
  5. *Confirmação Segura na Exclusão de Logs:* Implementado modal de confirmação visual para evitar exclusões acidentais na tabela de auditoria.

### **v1.8.5**
* **Refinamento Visual da Auditoria, Exclusão de Logs e Modal Estruturado de Detalhes:**
  1. *Modal Próprio de Detalhes de Auditoria:* Substituído o pop-up nativo de texto cru por uma janela moderna em cards com dados estruturados de operador, terminal, horário, motivo e payload formatado.
  2. *Ações por Linha e Exclusão de Logs:* Adicionado botão de lixeira (`🗑️`) para remoção de registros individuais de auditoria com atualização local e contador em tempo real.
  3. *Rodapé e Cabeçalho Padronizados:* Inclusão do rodapé com totalizador de logs e badge "Tempo Real", e alinhamento dos botões de ação sem títulos duplicados.

### **v1.8.4**
* **Sincronização Dinâmica de Permissões da Gerência & Fechamento de Segurança:**
  1. *Exibição Imediata da Aba Gerência:* Validação de perfil reativa conectada diretamente à sessão do operador (`admin` / `gerente`), garantindo que o Dono tenha acesso instantâneo ao menu sem precisar reiniciar o sistema.
  2. *Proteção RBAC Completa:* Acesso restrito com ocultação automática da Gerência e botões avançados de estoque para operadores padrão.

### **v1.8.3**
* **Ajustes de Performance, Gestão de Categorias, Auditoria Offline-First e Otimização do Modal de Produtos:**
  1. *Abertura Instantânea da Aba Estoque (0ms):* Implementada renderização paginada em blocos de 80 produtos com carregamento sob demanda no scroll infinito, eliminando qualquer travamento ao trocar de tela.
  2. *Gerenciador Elegante de Categorias:* Modais próprios de criação, renomeação e exclusão segura (com migração automática de produtos vinculados para "Geral") substituindo prompts nativos do navegador.
  3. *Auditoria Local-First & Nuvem:* Logs de auditoria salvos em armazenamento local persistente com fallback automático, garantindo exibição instantânea mesmo sem internet ou índices compostos no Firestore.
  4. *Modal de Cadastro/Edição de Produtos Otimizado:* Rodapé fixo com botões "Salvar Produto" e "Cancelar", abertura sempre no topo do scroll e campo de Data de Validade 100% clicável com cursor pointer para acionar o calendário nativo.
  5. *Segurança e Permissões da Gerência:* O botão da Gerência agora é exibido exclusivamente quando o usuário logado possui cargo de Administrador/Gerente, com visual e cores padronizados.
  6. *Atalho F7 Dedicado:* Desvinculado da navegação de abas e mantido exclusivamente para abertura rápida da janela de Cortesia [F7] no PDV.
  7. *Bloqueio Inviolável da Tela de Login:* O atalho ESC foi desabilitado na tela de login/seleção de operador, exigindo autenticação obrigatória por PIN para entrar no sistema.

### **v1.8.2**
* **Correções Críticas de Troco, Layout Gerencial e Atualização Imediata de Sessão:**
  1. *Cálculo de Troco no PDV:* Sanitizador monetário `parseMoedaBR` reformulado para preservar separadores decimais de ponto e vírgula sem multiplicar valores (eliminado o erro de troco indevido).
  2. *Layout da Central do Dono & Gerência:* Corrigida a sobreposição e estrangulamento dos cards de métricas (Curva ABC e Contas a Pagar) com `flex-direction: column !important` e grid responsivo.
  3. *Atualização Dinâmica de Sessão:* Ao trocar de operador/login (Gerente ↔ Caixa), o mini dashboard e os botões restritos de estoque são recalculados e re-renderizados imediatamente sem necessidade de reiniciar o sistema.
  4. *Otimização do Atalho F2 (Busca Rápida):* Paginação em 60 itens no carregamento inicial para abertura instantânea (0ms de atraso).
  5. *Nome Fixo da Aba Clientes:* Padronizado para `👥 Clientes` permanentemente.

### **v1.8.1**
* **Polimento de UI/UX, Correções de Ponto Flutuante e Reorganização Gerencial:**
  1. *Frente de Caixa (PDV):* Correção no cálculo de troco e validação de valor em dinheiro com tolerância de centavos (`parseMoedaBR`) para eliminar falso aviso de valor insuficiente; remoção de timeouts artificiais em atalhos F2/F4; ocultação segura do total em gaveta para operadores (fechamento cego).
  2. *Gerência (Central do Dono):* Correção de sobreposição na troca de sub-abas da Gerência; integração completa de Histórico de Caixas e Funcionários com controle de PIN; logs de auditoria em tempo real.
  3. *Estoque & Permissões:* Botões de gestão avançada (`Estoque Baixo`, `Lista de Compras`, `Importar` e `Exportar Excel`) visíveis exclusivamente para perfil Gerente.
  4. *Clientes:* Simplificação do nome da aba para `Clientes`, alinhamento responsivo da coluna de WhatsApp com botão pílula verde e remoção de emojis desnecessários em botões de ação.

### **v1.8.0**
* **Roadmap Completo — Gestão Estratégica, Curva ABC, Fiscal NFC-e (Focus NFe) e Automação de Caixa:**
  1. *Fase 1 (Base, Neutralidade & CRM/Delivery):* Neutralização de nichos, sincronização na nuvem com `backups_lojas`, aba CRM & Delivery com busca automática de CEP (ViaCEP) e WhatsApp direto (`wa.me`), chave seletora para habilitar/desabilitar módulo Fiado.
  2. *Fase 2 (Nova Aba Gerência & Curva ABC):* Aba `👔 Gerência [F7]` com bloqueio por PIN do Gerente. Relatório matemático de Curva ABC (80/15/5), painel financeiro de Contas a Pagar com baixa de boletos, catálogo autônomo de Categorias, auditoria ao vivo e ajuste manual de estoque com justificativa.
  3. *Fase 3 (Estoque Inteligente & Reposição):* Botão de filtro `⚠️ Estoque Baixo` com 1 clique, exportação de Lista de Compras em Excel via `ExcelJS` com cálculo automático de sugestão, trava de venda fracionada por item e badges visuais de controle de validade (`🚨 Vencido`, `⏳ Vence em Xd`).
  4. *Fase 4 (Frente de Caixa & Segurança):* Atalho de Item Avulso / Diverso (`*15` ou `*15.50`), decodificador de balança nacional EAN-13 iniciado em `2`, pulso ESC/POS para gaveta de dinheiro e Fechamento Cego de Caixa com apuração de quebra/sobra e auditoria.
  5. *Fase 5 (Fiscal NFC-e & TEF):* Emissão de NFC-e com Focus NFe / SAT, gerador de Chave de Acesso SEFAZ de 44 dígitos, tributação completa por produto (NCM, CEST, CFOP, CSOSN, Origem), layout de DANFE NFC-e térmico e módulo TEF (PayGo, SiTef, Stone, Cielo).

### **v1.7.9**
* **Módulo de Auditoria Centralizada em Tempo Real, Segurança Gerencial em Cortesias e Painel Master SaaS:**
  1. *Bloqueio por PIN Gerencial na Cortesia [F7]:* O botão Cortesia e a liberação de itens 100% bonificados agora exigem autenticação prévia de PIN do Gerente (ou PIN Mestre da nuvem), impedindo concessões indevidas por operadores não autorizados.
  2. *Módulo de Auditoria Contínua (`audit.js`):* Registra eventos em tempo real na coleção `auditoria_lojas` do Firestore de forma não-bloqueante (`fire-and-forget`). Eventos auditados: `cortesia`, `cancelamento_venda`, `fechamento_caixa`, `abertura_caixa`, `sangria_caixa`, `exclusao_produto`, `edicao_produto`, `cadastro_produto`, `ajuste_estoque` e `importacao_planilha`. Cada registro armazena: `chaveLicenca`, `razaoSocial`, `operador`, `terminalId`, `hostname` real da máquina Windows (`os.hostname()`), `tipo`, `descricao`, `detalhes` (itens com quantidade, preço unitário, motivo e valor original), `criadoEm` e `dataHoraFormatada`.
  3. *Painel Master Admin (`flowpdv-master-admin`):*
     - **Painel de Auditoria ao Vivo:** Filtros dinâmicos por Loja/Licença e Tipo de Ação com contagem de registros em tempo real.
     - **Badges Estilizados:** Badges temáticos para cada evento (`🎁 Cortesia PDV`, `🎁 Cortesia Licença`, `🔄 Renovação`, `🔒 Status`, `🗑️ Exclusão`, `💰 Fech. Caixa`, etc.).
     - **Botão Exclusivo `🔍 Ver detalhes` para Cortesias:** A coluna de descrição mantém o layout limpo e exibe o botão `🔍 Ver detalhes` apenas nas linhas de cortesia; outros tipos mostram a descrição textual direta.
     - **Modal de Detalhes Responsivo sem Espaço Vazio:** Altura automática (`height: auto; max-height: 85vh;`), cards com Estabelecimento, Operador, Licença, Computador (`hostname` real resolvido inclusive para logs legados), caixa destacada com o Motivo da cortesia, tabela detalhada de itens (Nome, Qtd, Preço Unitário) e valor total destacado.
     - **Controle de Fechamento em Pilha (ESC):** Ao pressionar a tecla `ESC` dentro do modal de detalhes, apenas este é fechado, mantendo a lista de auditoria aberta.
     - **Lixeira Individual e Faxina em Massa:** Botão 🗑️ em cada linha para excluir registros específicos do Firestore e botão `🧹 Limpar Logs Antigos` para purgar registros com mais de 30 dias.
     - **Deploy e Versionamento:** Repositório do Master Admin sincronizado no GitHub Pages (`https://github.com/DouglasNico/flowpdv.git`).

### **v1.6.1**
* **Auto-Preenchimento por Código de Barras com Categorização Semântica, Ajuste de Layout e Blindagem de Excel no Caixa:**
  1. *Categorização Semântica Automática de EAN:* Algoritmo de mapeamento inteligente que identifica e seleciona a categoria correta no catálogo da loja (ex: Coca-Cola ➔ "Não Alcoólicos" / "Bebidas", Skol ➔ "Cervejas", Red Bull ➔ "Não Alcoólicos", Doritos ➔ "Snacks / Alimentos").
  2. *Layout Amplo e Ergonômico de Código de Barras:* O campo de código de barras agora ocupa 100% da largura da coluna sem cortes. Os botões `Buscar` e `Gerar` foram posicionados abaixo do campo de forma limpa e sem ícones.
  3. *Blindagem de Segurança no Histórico de Caixa:* Apenas o **Gerente** tem permissão de exportar relatórios de caixa e turnos em Excel. O operador fica com o botão e as funções de exportação 100% bloqueados.

### **v1.6.0**
* **Acordeão Inteligente no Caixa, Controle de Itens/Serviços, Bloqueio de Estoque Zerado e Neutralidade Comercial:**
  1. *Acordeão Interativo no Turno de Caixa:* Em telas compactas (notebooks), clicar no cabeçalho de "Vendas Realizadas no Turno" ou "Histórico de Turnos" expande a seção selecionada em tela cheia (`flex: 1`), recolhendo a outra para uma barra limpa. Isso permite ver dezenas de vendas ou turnos sem scroll apertado.
  2. *Suporte a Itens de Serviço & Salgados (Sem Controle de Estoque):* Chave seletora `📊 Controlar Estoque deste Item` no cadastro. Permite cadastrar serviços (ex: Corte de Cabelo, Coxinha, Mão de Obra) com venda livre no PDV sem travas de quantidade.
  3. *Bloqueio de Venda para Produtos Esgotados no PDV:* Produtos com controle de estoque ativo agora são bloqueados no caixa com aviso sonoro e toast caso o saldo esteja zerado ou insuficiente.
  4. *Bloqueio de Código de Barras Duplicado:* Validação em tempo real no cadastro impedindo duplicidade de códigos unitários e fardos.
  5. *Neutralidade Comercial do Sistema:* Nome da aba alterado para `⚙️ Configurações` e `📦 Produtos & Estoque`, com relatórios e status parametrizados pelo nome real da empresa.
  6. *Auditoria Financeira de Vendas Divididas:* Contabilização exata de frações em dinheiro na gaveta e no Excel.
  7. *Auto-Preenchimento por Código de Barras (EAN/GTIN Nacional):* Ao bipar ou digitar um código no cadastro de produtos, o FlowPDV consulta o catálogo oficial nacional via internet e preenche automaticamente o Nome, Marca, Volume e Categoria do produto em meio segundo.

### **v1.5.9**
* **Liberada Digitação Total de 1 a 5 no Pagamento Dividido e Exportação Excel de Estoque Conectada:**
  1. *Digitação de 1 a 5 Liberada no PDV:* Os atalhos numéricos foram isolados para não interceptar campos de input, permitindo digitar livremente qualquer valor numérico durante a divisão de pagamentos.
  2. *Exportação de Estoque em Excel Conectada:* Importação do módulo `ExcelJS` vinculada ao Estoque, gerando a planilha `.xlsx` com formatação e duas abas detalhadas.
  3. *Cupom Térmico com Detalhamento de Parcelas:* Exibição de cada forma e valor pago nas vendas divididas.

### **v1.5.8**
* **Pagamento Dividido no PDV [F4], Exportação do Estoque em Excel (.xlsx) & Refinamentos Visuais:**
  1. *Dividir Pagamento / Pagamento Parcial:* Opção `✂️ Dividir` no modal de pagamento [F4] para registrar vendas pagas em 2 formas (ex: Dinheiro + PIX, Cartão + Dinheiro) com cálculo automático do saldo restante em tempo real.
  2. *Exportação Completa de Estoque:* Botão `📊 Exportar Excel` gerando relatório em planilha formatada com 2 abas (Estoque Completo e Resumo por Categoria).
  3. *Refinamento dos Botões e Tabelas:* Botão de detalhes na tabela de vendas alinhado sem quebra; efeitos hover universais com elevação suave em todos os botões da aplicação; quebra fluida de texto no status de backup sem corte.

### **v1.5.7**
* **Blindagem de Edição em Nuvem, Configurações Protegidas em Modal & Pergunta Ágil de Impressão pós-Venda:**
  1. *Blindagem Inteligente de Edição:* A sincronização contínua do Firebase agora detecta modais abertos e foco de digitação, nunca mais sobrescrevendo ou apagando campos enquanto o usuário digita.
  2. *Card de Dados da Empresa Protegido:* A aba Configurações exibe os dados da loja em modo de leitura protegido contra alterações acidentais, com botão `✏️ Alterar Configurações` que abre um modal limpo e seguro.
  3. *Pergunta de Impressão Rápida no PDV:* Removido o checkbox estático do modal de pagamento. Ao concluir a venda, abre-se um modal moderno perguntando se deseja imprimir o comprovante, permitindo teclar `[Enter]` para imprimir ou `[ESC]` para concluir instantaneamente.

### **v1.5.6**
* **Destaque Marcante no Total a Pagar, Botões Ampliados e Adega Integrada ao Dashboard:** O valor de `TOTAL A PAGAR` no notebook foi ampliado para `50px` e os 4 botões de ação (`Finalizar`, `Cancelar`, `Cortesia`, `Sangria`) ganharam dimensões confortáveis (`44px` / `38px`). O bloco inferior (Adega e Dashboard) foi aproximado de forma elegante, preenchendo todos os espaços e deixando a frente de caixa rápida, moderna e sem áreas vazias.

### **v1.5.5**
* **Proporções Generosas da Adega & Dashboard no PDV e Correção Definitiva da Renderização no Histórico:** O card da Adega (`Adega do Douglas`) e o Dashboard do Caixa foram expandidos com proporções generosas preenchendo com perfeição os espaços laterais tanto no Desktop quanto no Notebook. Corrigido o método de renderização da tabela de histórico (`renderHistoricoTurnosFechados`) ao excluir turnos, permitindo que a linha seja removida instantaneamente na hora com toast de sucesso, sem erros no console e sincronizada para toda a rede da loja.

### **v1.5.4**
* **Harmonia Visual Perfeita com Centralização Vertical, Adega & Dashboard Expandidos e Exclusão Blindada:** Eliminação completa dos espaços em branco no Desktop e Notebook com distribuição vertical fluida e centralizada dos blocos do PDV. Card da Adega ampliado (Logo 76px/58px, Nome 21px/17px em destaque) e Dashboard do Caixa robusto e sem achatamento. Função dedicada de exclusão permanente de turnos no armazenamento local e nuvem com feedback visual e sincronização garantida.

### **v1.5.3**
* **Alinhamento do Painel Lateral com Bloco Inferior, Exclusão Definitiva Multi-Terminal & Modal Moderno:** Os botões de ação agora ficam posicionados no topo e o bloco (Card da Adega + Mini Dashboard + Créditos + Atalhos) fica perfeitamente colado e alinhado na parte inferior tanto em telas grandes quanto em notebooks sem quebras nem cortes. Novo modal de confirmação moderno e elegante para exclusão de turnos do histórico. Sistema de exclusão definitiva com Tombstones (`turnosExcluidos`) que propaga a remoção instantaneamente para todos os computadores da loja sem reaparecer ao reabrir/fechar caixas.

### **v1.5.2**
* **Redimensionamento Nobre da Adega, Dashboard Compacto sem Vazio & Correção na Exclusão de Turnos:** O card da logomarca e nome da empresa foram ampliados com grande destaque visual ocupando o espaço lateral superior de forma imponente. O mini-dashboard do caixa agora possui altura natural ajustada estritamente ao conteúdo (eliminando o espaço vazio e a borda esticada). A linha de créditos "batistadev" foi colada na base acima dos atalhos. Corrigida a exclusão de turnos no histórico (`AuthModule.isGerente`) com sincronização da remoção na nuvem em tempo real.

### **v1.5.1**
* **Harmonização Visual dos Botões de Ação & Mini Dashboard Compacto no PDV:** Os botões Cortesia [F7] e Sangria [F9] agora seguem o mesmo padrão sólido e premium de Finalizar Venda e Cancelar (com gradientes modernos, sombras e badges KBD). O mini dashboard do caixa fechado foi compactado com elegância para telas de notebook, garantindo espaçamento fluido e atalhos 100% visíveis no rodapé. Sincronização em nuvem 100% silenciosa em segundo plano.

### **v1.5.0**
* **Sincronização Completa de Histórico de Turnos e Vendas, Proteção de Produtos & Enquadramento de Atalhos:** Sincronização em tempo real de histórico de turnos fechados (`adega_turnos_historico`) e vendas entre todos os terminais da loja. Blindagem com backup local de segurança e proteção anti-apagar de produtos na nuvem. Enquadramento responsivo perfeito no Caixa PDV F1 para telas de notebook, mantendo os atalhos `[F1]...` 100% visíveis no rodapé.

### **v1.4.9**
* **Scroll Interno com Botão Salvar Fixo em Configurações & Refinamento Visual do PDV:** A aba de configurações agora possui rolagem interna isolada mantendo o botão "Salvar Configurações" travado e acessível no rodapé com título centralizado. No Caixa PDV F1, o logo e nome da adega foram ampliados com destaque marcante, descolando dos botões superiores e preenchendo harmonicamente o espaço vertical do caixa fechado.

### **v1.4.8**
* **Sincronização Bidirecional Inteligente & Refinamento Visual de Terminais:** Auto-upgrade do cadastro de terminais antigos para objetos ricos com Hostname do Windows (`os.hostname()`), correção de overflow e alinhamento da tela de configurações e eliminação completa de scrollbars no PDV.

### **v1.4.7**
* **Sincronização Automática em Tempo Real (Cloud Sync Multi-Terminal):** Operadores de caixa, catálogo de produtos, categorias e clientes são sincronizados automaticamente entre todos os computadores da mesma licença via Firestore em tempo real. Novos computadores ativados realizam auto-download instantâneo dos dados da loja.

### **v1.4.6**
* **Identificação de Hostname dos Computadores & Desvinculação Individual:** O FlowPDV agora envia o nome do computador Windows (`os.hostname()`), usuário e timestamp de acesso. O Master Admin lista cada máquina com opção de desvincular um PC específico ou todos de uma vez.

### **v1.4.5**
* **Identificação de "Vence Hoje" e "Vence Amanhã" no Master Admin:** A tabela de clientes e métricas do Master Admin agora reconhece com precisão quando o vencimento é hoje (`⏳ Vence Hoje`) ou amanhã (`⏳ Vence Amanhã`), eliminando arredondamentos imprecisos.

### **v1.4.4**
* **Relógio Regressivo em Tempo Real no Dia de Vencimento:** Quando a licença expira no próprio dia (HOJE), o FlowPDV agora exibe um cronômetro regressivo dinâmico `HH:mm:ss` no topo e no banner de aviso, atualizado ao vivo a cada segundo.

### **v1.4.3**
* **Feedback de Erro Aprimorado na Ativação:** Ao tentar ativar uma licença que esteja bloqueada ou vencida, o sistema agora exibe um alerta vermelho detalhado no próprio modal e dispara um aviso de erro/warning, eliminando toasts falsos de sucesso.

### **v1.4.2**
* **Eliminação de Fallbacks Ocultos:** Removida qualquer atribuição automática de dias (como `+30 dias` em caso de data inválida). Se a licença estiver vencida ou sem pagamento na nuvem, o sistema bloqueia e exige renovação no Master Admin.
* **Segurança Anti-Fraude:** Tentar alterar ou redigitar a mesma chave de licença vencida mantém o bloqueio de vencimento ativo.

### **v1.4.1**
* **Fim do Fallback de 130 Dias:** Removido o valor fixo antigo de `31/12/2026`. A validade do PDV agora reflete rigorosamente a data real gravada no Firebase pelo Master Admin.

### **v1.4.0**
* **Modal Amigável de Pagamento/Renovação (`#modal-pagamento-licenca`):** Clicar em *"Ver Chave PIX"* no aviso de vencimento agora abre um modal com botão de fechar "✕", botão *"Copiar PIX"*, botão WhatsApp e botão *"Continuar Usando o PDV"*, sem travar indevidamente na Tela de Bloqueio Total.
* **Sincronização em Tempo Real Direta (`doc` ao invés de `collection`):** O listener do Firestore agora escuta o documento direto da chave (`doc(db, "licencas", chave)`), funcionando em harmonia com as Regras de Segurança do Firebase (`allow list: if request.auth != null;`).

### **v1.3.9**
* **Chave Mestra Remota para PIN do Gerente:** Caso o gerente da loja esqueça seu PIN local, o administrador pode redefinir o PIN no Master Admin (`flowpdv-master-admin`). O PDV sincroniza na hora e aceita o novo PIN mestre com prioridade máxima.

### **v1.3.8**
* **Refinamento Visual da Aba Configurações (F8):** Espaçamentos amplos e confortáveis entre cards.
* **Padronização de Botões:** Botão `➕ Novo Funcionário` padronizado com o estilo, cor e hover do botão `+ Novo Produto`.
* **Ações da Tabela de Funcionários:** Botões `[ ✏️ Editar ]` e `[ 🗑️ Excluir ]` posicionados lado a lado, com animação hover e diálogo de confirmação antes de excluir.
* **Visualizador de PIN:** Adicionado botão com olhinho (`👁️`) no cadastro de operador para alternar entre mostrar/ocultar senha.
* **Identificação do Operador:** Inserido o logo oficial `FlowPDV` centralizado e removido o teclado numérico virtual, permitindo digitação direta e rápida no teclado físico com `[Enter]`.
* **Cargo Simplificado:** Atualizado de *"Gerente / Dono"* para apenas **"👑 Gerente"**.

### **v1.3.7**
* **Blindagem do Auto-Updater:** Criado o helper seguro `enviarParaJanela()` com verificação de `!mainWindow.isDestroyed()` e interceptador `process.on('uncaughtException')` no `main.js`, eliminando popups de erro do Windows ao reiniciar para aplicar atualizações.
* **Correção do Repositório GitHub:** FeedURL do `autoUpdater` apontado com precisão para `DouglasNico/flowpdv`.

### **v1.3.6**
* **Sistema Multi-Operadores & Sessões:** Criação de perfis de funcionários com PIN numérico de 4 a 8 dígitos.
* **Auditoria de Vendas & Caixa:** Cada venda e abertura/fechamento de turno agora grava o nome do operador responsável.
* **Autorização Rápida de Gerente:** Cancelamentos de itens, descontos e sangrias exigem confirmação de PIN do Gerente caso um operador de caixa esteja logado.

### **v1.3.5**
* **Duplo Código de Barras (Unidade vs Fardo/Kit/Combo):** Suporte a código de barras individual e código de barras do fardo no mesmo cadastro de produto.
* **Abatimento Proporcional de Estoque:** Vender o fardo abate automaticamente o fator de conversão (ex: 12 latinhas) do estoque unitário.

### **v1.3.4**
* **Normalização de Código de Barras Alfanumérico:** Todos os inputs de código de barras (`#prod-codigo-barras`, `#prod-codigo-barras-fardo`, `#pdv-barcode-input`) convertem automaticamente para letras maiúsculas (`.toUpperCase()`).

### **v1.3.3**
* **Bipe Artificial Desativado:** Silenciado o sintetizador de áudio no PDV para valorizar o som nativo emitido pelo próprio hardware do leitor de código de barras.

---

## 📂 3. Estrutura dos Arquivos e Módulos

```text
adega-pdv-gestao/
├── main.js                 # Processo principal Electron, IPCs, AutoUpdater e Janelas
├── preload.js              # Bridge de contexto seguro (electronAPI)
├── index.html              # Interface gráfica única com navegação em abas e modais
├── package.json            # Configurações do projeto, scripts e dependências
├── MEMORIA_PROJETO.md      # Este documento de memória e arquitetura
├── src/
│   ├── assets/             # Ícones e logos oficiais (icon.png, logoflow.png)
│   ├── css/
│   │   └── style.css       # Design System completo, temas, modais, tabelas e botões
│   └── js/
│       ├── app.js          # Orquestrador inicial, atalhos globais e navegação de abas
│       ├── storage.js      # Camada de persistência local (LocalStorage + JSON)
│       ├── auth.js         # Multi-usuários, PIN, sessões, RBAC e autorizações
│       ├── pdv.js          # Frente de caixa, leitor de código de barras, carrinho e vendas
│       ├── caixa.js        # Turnos, troco inicial, sangrias e relatórios em Excel
│       ├── estoque.js      # Gestão de produtos, fardos/kits, margens, reposição e compras
│       ├── gerencia.js     # Central do Dono: Curva ABC, Contas a Pagar, Categorias, Auditoria e Histórico
│       ├── clientes.js     # CRM, gestão de clientes, limites de crédito e fiado/caderneta
│       ├── audit.js        # Módulo de auditoria em tempo real (local + nuvem)
│       ├── fiscal.js       # Módulo fiscal NFC-e (Focus NFe) e integração TEF
│       ├── licenca.js      # Validador SaaS, ouvinte Firestore em tempo real e bloqueios
│       ├── backup.js       # Backup e restauração em nuvem
│       ├── admin-master.js # Painel Master embutido (apenas superadmin)
│       ├── thermal-print.js# Gerador e impressor de cupons térmicos (58mm/80mm)
│       └── firebase-config.js # Configuração do Firebase Client SDK
```

---

## ⌨️ 4. Teclas de Atalho do Sistema

| Atalho | Função |
| :---: | :--- |
| **F1** | Abrir Frente de Caixa (PDV) / Focar Leitor de Código de Barras |
| **F2** | Buscar Produto por Nome, Categoria ou Código (Busca Rápida Paginada) |
| **F4** | Finalizar Venda / Abrir Modal de Pagamento |
| **F7** | Aplicar Cortesia / Desconto de 100% (Exige PIN do Gerente) |
| **F8** | Acessar Configurações da Loja (Exige PIN do Gerente) |
| **F9** | Realizar Sangria / Retirada de Caixa (Exige PIN do Gerente) |
| **F10**| Abrir Turno de Caixa com Troco Inicial |
| **ESC**| Fechar Modal Aberto ou Cancelar Carrinho no PDV (Desabilitado na tela de login) |

---

## 🛠️ 5. Comandos de Desenvolvimento & Compilação

Para compilar e gerar novas versões, execute no terminal do projeto (`D:\Desenvolvimento\adega-pdv-gestao`):

```bash
# 1. Gerar o bundle JavaScript dos módulos:
npm run bundle

# 2. Executar o sistema localmente em modo desenvolvedor:
npm run start

# 3. Gerar o instalador oficial de produção (.exe) para distribuição:
npm run build
```

> **Arquivos gerados pelo build na pasta `dist/`:**
> * `FlowPDV-Setup.exe` (Instalador NSIS com instalação silenciosa e auto-execução)
> * `latest.yml` (Arquivo de controle de versão com hash SHA-512)
> * `FlowPDV-Setup.exe.blockmap` (Mapa de integridade de blocos)

---

## 🔒 6. Regras de Segurança do Firebase Firestore

Para manter o banco de dados blindado contra fraudes e permitir o funcionamento dos clientes e do Master Admin, as seguintes regras devem estar ativas no **Firebase Console ➔ Firestore Database ➔ Regras**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. Coleção de Licenças
    match /licencas/{chaveLicenca} {
      allow get: if true;
      allow list: if request.auth != null;
      allow update: if request.resource.data.dataExpiracao == resource.data.dataExpiracao
                    && request.resource.data.status == resource.data.status;
      allow create, delete: if request.auth != null;
    }

    // 2. Coleção de Backups das Lojas (SaaS Multi-Lojas)
    match /backups_lojas/{chaveLicenca} {
      allow read, write: if chaveLicenca.size() > 5;
    }
    match /backups_adegas/{chaveLicenca} {
      allow read, write: if chaveLicenca.size() > 5;
    }

    // 3. Demais Coleções (Apenas Administrador Autenticado)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 💡 7. Dicas & Boas Práticas para Suporte

1. **Cliente esqueceu o PIN do Gerente:**
   * Acesse o `flowpdv-master-admin` no navegador.
   * Edite a loja do cliente, digite o novo PIN no campo *"PIN do Gerente"* e clique em Salvar.
   * O PDV do cliente atualiza na hora em tempo real.
2. **Cliente trocou de Computador (Limite de Terminais):**
   * No `flowpdv-master-admin`, clique no botão de reset de terminais da loja para liberar a vaga.
   * No computador novo do cliente, clique em *"Reconectar / Autorizar Este Computador"*.
3. **Publicar Atualização Automática:**
   * Altere a versão no `package.json` e no badge do `index.html`.
   * Execute `npm run build`.
   * Crie uma nova Release no repositório GitHub `DouglasNico/flowpdv` com a tag correspondente (ex: `v1.4.2`) e anexe os arquivos da pasta `dist/` (`FlowPDV-Setup.exe`, `latest.yml` e `FlowPDV-Setup.exe.blockmap`).
   * Todos os clientes receberão a notificação de atualização automática em até 5 segundos ao abrir o app.
