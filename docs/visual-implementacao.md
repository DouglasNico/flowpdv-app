# Visual aprovado — execução por etapas

Atualizado em 22/09/2026. Direção aprovada pelo usuário; implementação local autorizada. Publicação não autorizada nesta rodada.

## Aplicado nesta rodada

- Estoque: hierarquia, espaçamento, busca com rótulo, botões, estados de saldo, tabela e valores monetários. Todas as colunas/ferramentas existentes foram mantidas.
- `src/css/estoque-admin.css`: estilos restritos a `#tab-estoque`. Fonte existente mantida nesta etapa para evitar troca global de tipografia. Navegação geral ainda não redesenhada.
- Modais operacionais: padrão explícito `flow-dialog`, com tamanhos compact/regular/wide/expanded de 480/640/960/1120 px CSS, limitados à área útil da tela. Altura automática, rolagem, cabeçalhos, rodapés, campos e foco consistentes.
- `src/css/dialogs.css`: 49 IDs de modais estáticos, mais pendências TEF dinâmicas. Há duas instâncias preexistentes de `modal-ajuste-estoque` no HTML; não foi alterada a resolução desse ID nesta rodada. Revisar essa duplicidade antes de modificar o fluxo de ajuste.
- Clube/voucher receberam as classes estruturais comuns. CPF TEF mantém superfície escura para preservar leitura dos estados. Login inicial, ativação, pagamento de licença e atualização mantêm layouts próprios.
- Os layouts de venda Moderno e Clássico permanecem distintos. O acabamento das próprias telas de venda ainda está pendente; os modais foram antecipados a pedido do usuário.

## Verificação e limites

Fixture local em `flowpdv-sistema/output/estoque-visual`, origem própria 127.0.0.1:4179, usando HTML/CSS e módulo Estoque reais com produtos fictícios. Auth/auditoria substituídos apenas na fixture; app, nuvem, TEF e impressora não inicializados. Não é validação de permissões ou operação instalada.

- Busca encontrou somente SUCO; busca inexistente exibiu estado vazio; categoria Lanches retornou o sanduíche; estoque baixo retornou suco e item zerado.
- Cadastro fictício salvou DEMO005, preço 12,00 e saldo 8, exibindo confirmação e linha na tabela.
- Antes da ampliação para modais, comparados 334 elementos da frente de caixa em cada modalidade, com/sem CSS de Estoque: cores, fonte, espaçamentos e geometria idênticos. No Clássico, fixture reproduz a seleção de shell feita por `aplicarLayoutPdv`.
- Modais: primeira varredura dos 49 IDs nos dois layouts; 44 usavam estrutura comum. Cinco estruturas especiais foram adaptadas e conferidas posteriormente. Verificação de limites dos contêineres com conteúdo inicial, não homologação de todos os fluxos/dados longos.
- Estoque renderizado em 1280×720 e quadros menores de 1024×768 e 390×844. Corrigida expansão vertical indevida da busca em layout de coluna. No quadro estreito, largura e scrollWidth do painel coincidiram; tabela preserva rolagem horizontal interna.
- Pagamento estreito passou a ter duas colunas de formas de pagamento, resumo em uma coluna e entrada de valor acima da ação, evitando compressão dos valores.
- Bundle compilado com esbuild local, equivalente ao comando de `npm run bundle`. O executável npm deste ambiente aponta para módulo inexistente; por isso foi utilizado diretamente o esbuild já instalado. Sintaxe do TEF e `git diff --check` passaram.

Não foram alterados handlers de venda, cálculos, teclas, permissões ou ordem de sobreposição. Não foram ensaiadas transações financeiras, hardware, dados reais ou todos os estados dinâmicos de cada modal. A conferência visual não encerra essas homologações.

## Próximas etapas visuais

### Continuação — Clientes

Aplicado `src/css/clientes-admin.css`, restrito a `#tab-clientes`: título, busca rotulada, ação principal, indicadores, tabela, leitura monetária condicional ao modo fiado, estados de saldo e foco. As ações e os dois modos existentes foram mantidos; não houve alteração em `clientes.js` nem nas regras de crédito.

Conferido com módulo real e clientes fictícios em origem isolada 127.0.0.1:4180: busca por bairro, estado vazio, cadastro (contador passou de 2 para 3), abertura de recebimento com saldo correto de R$ 40,00, e modo sem fiado com seis colunas e nenhum botão Receber. Não houve envio de WhatsApp, consulta de CEP, impressão ou confirmação financeira. Tela estreita em quadro 390×844: painel com clientWidth/scrollWidth iguais a 385, mantendo rolagem interna da tabela. Modais usam o padrão entregue na rodada anterior.

Ainda falta verificar rotinas com dados reais/permissões e instalação completa; a fixture não substitui essas homologações. Nenhuma publicação.

1. Conferir formulários completos e estados administrativos com módulos reais, permissões e integrações. A primeira aplicação visual das seis áreas administrativas está concluída localmente.
2. Aplicar direção ao Flow Gestor e Master, mantendo papéis e contratos de dados separados.
3. Painel do cardápio e consumidor, incluindo estados de indisponibilidade e canais opcionais.
4. Acabamento próprio das telas de venda Moderno e Clássico, com regressão funcional separada; atendimento/garçom conforme escopo.
5. Site comercial alinhado às entregas efetivamente disponíveis.

As pendências funcionais permanecem em [PLANO-COMPLETO-FLOWPDV.md](PLANO-COMPLETO-FLOWPDV.md). Não há instalação nova, release, push ou deploy decorrente desta rodada.

## Continuação — Caixa

Aplicado `src/css/caixa-admin.css`, restrito a `#tab-caixa`: hierarquia do cabeçalho, ações de abertura/sangria/fechamento, banner do turno, tabela de vendas, foco e adaptação a telas estreitas. Handlers, cálculos e permissões não foram modificados. Nenhuma mudança em `caixa.js`; CSS/HTML dispensam recompilação do bundle.

Validação local em 127.0.0.1:4181, com módulo real e dados fictícios, autenticação/auditoria simuladas e sem inicialização do app/nuvem: turno fechado, aberto vazio e aberto com uma venda; abertura dos três modais sem confirmar movimentações. Exemplo: troco 50 + venda em dinheiro 25 = saldo exibido 75. Renderização desktop (910 px) e quadro 390×844, com painel clientWidth/scrollWidth iguais a 385; tabela com rolagem interna. O cabeçalho global preexistente segue fora deste escopo. Não homologados hardware, permissões reais, atalhos globais ou instalação completa.

Próxima etapa após Caixa: Gerência (aplicada abaixo). Sem publicação.

## Continuação — Gerência

Aplicado `src/css/gerencia-admin.css`, restrito a `#tab-gerencia`, com navegação, indicadores, filtros, tabelas, foco e adaptação estreita. HTML ganhou classes locais e regiões de tabela focáveis. Sem alteração nos módulos JS ou controles de acesso.

Fixture em 127.0.0.1:4182, sem inicialização de app/nuvem: sete subáreas acessadas; Curva ABC exibiu venda fictícia de R$ 25,00 e Contas a Pagar exibiu despesa vencida fictícia de R$ 120,00. Filtro Pagas mostrou estado vazio; cadastro de despesa abriu sem salvar. Categorias com produto fictício; histórico e auditoria sem registros. Funcionários teve apenas sua estrutura visual conferida, pois o renderizador de autenticação foi substituído na fixture. Não foram testados cadastro/permissões de usuários, exportação, exclusão, pagamento ou auditoria remota.

Desktop conferido em 1280 e 910 px; subáreas em quadro 390×844. Corrigida largura mínima da barra de ações de auditoria. Tabelas mantêm rolagem interna. Cabeçalho global continua fora deste escopo. Próxima etapa após Gerência: Comandas (aplicada abaixo). Nenhuma publicação.

## Continuação — Comandas e Mesas

Aplicado `src/css/comandas-admin.css`, exclusivamente na gestão `#tab-comandas`: cabeçalho, indicadores, filtros, busca, cartões e painel de detalhes. Em janelas estreitas, lista e detalhes ficam em uma coluna; em baixa altura, o conteúdo permanece acessível por rolagem. Ações de pré-conta, transferência e caixa foram organizadas no painel. Os modais continuam usando o padrão comum. Não houve edição de `comandas.js`, cálculos ou permissões; terminal de atendimento e frentes de venda permanecem fora desta etapa.

Fixture 127.0.0.1:4183 com três registros fictícios (livre, ocupada e aguardando fechamento), total em aberto R$ 75,00. Verificados seleção, busca por cliente, busca sem resultados, abertura de cadastro e transferência sem confirmar. Desktop a 910 px e quadro 390×844; painel estreito clientWidth/scrollWidth 385/385, detalhes 351/351. Não realizados lançamentos, transferências, pagamentos ou impressões. Modo somente mesas/comandas, hardware e integração real ainda requerem regressão funcional.

Próxima etapa após Comandas: Configurações (aplicada abaixo). Sem publicação.

## Continuação — Configurações

Aplicado `src/css/config-admin.css`, com escopo na página e no modal de empresa. Organização, tamanhos de botões, leitura de nomes longos e disposição estreita de dados/equipamentos/serviços. Modal de empresa limitado ao viewport, rolagem interna e campos em uma coluna estreita; mantém o mecanismo de display controlado pelo App. Sem alteração em JavaScript de produção ou configurações salvas.

Fixture de apresentação 127.0.0.1:4184 com HTML/CSS reais e valores fictícios, sem carregar App ou integrações. A abertura/fechamento da edição foi simulada exclusivamente para inspeção visual: não valida autorização, preenchimento automático ou salvamento reais. Conferido desktop e quadro 390×844: página 390/390 de largura/scrollWidth; modal 351/351, com rolagem vertical interna. Botões de hardware, fiscal, TEF, licença, backup e atualização não foram acionados.

A primeira aplicação visual administrativa está concluída. Permanecem validação integrada e acabamento das frentes Moderno/Clássico, atendimento/garçom, Gestor/Master, cardápio e site conforme o plano. Próxima etapa proposta: frente de caixa Moderna, preservando o Clássico como layout separado. Nada publicado.

## Continuação — PDV Moderno

Aplicado `src/css/pdv-moderno.css`, condicionado à ausência de `.pdv-layout-classico`. Leitor, tabela, total em superfície azul escura, ação principal laranja, botões secundários e rolagem responsiva. Todos os IDs e handlers preservados; leitor ganhou nome acessível. Sem mudança no módulo de venda ou bundle.

Fixture 127.0.0.1:4185 utiliza PdvModule real, turno/produtos/carrinho fictícios e Auth/Audit simulados, sem App completo, nuvem ou hardware. Carrinho vazio conferido; entrada `2*DEMO001` pelo campo/Enter resultou em R$ 8,00; aumentar quantidade no carrinho de exemplo atualizou R$ 32,00 para R$ 36,00; pagamento abriu com R$ 36,00 sem lançar pagamento. Desktop 1280 px e quadro 390×844, largura/scrollWidth do painel iguais a 390. Tabela mantém rolagem interna e largura mínima para legibilidade. Comparados 110 elementos do shell Clássico com/sem CSS Moderno: geometria, cores, fonte e padding idênticos.

Ainda pendente a matriz completa de atalhos globais (App não inicializado), F1 por contexto, cancelamento, descontos, cortesia, conclusão/recuperação de pagamento, impressão e instalação real. Conferência de aparência não homologa venda completa. Próxima etapa visual: PDV Clássico. Nada publicado.

## Continuação — PDV Clássico

Aplicado `src/css/pdv-classico.css`, exclusivamente no `#classic-pdv-shell`: cabeçalho, status, leitor, informações do último item, lista, totais e faixa de atalhos. Ajustado contraste do status e total contra superfície azul escura. Estrutura, IDs, handlers e lógica de venda preservados; nenhum JS de produção alterado.

Fixture 127.0.0.1:4186 com PdvModule real, Auth/Audit simulados e dados fictícios. Leitura `2*DEMO001` somou R$ 8,00 ao carrinho de R$ 32,00; total Clássico R$ 40,00. Estado vazio exibiu CAIXA LIVRE. Conferência desktop e quadro 1024×768, com limites renderizados do shell em 1024×768. Comparação de 136 elementos do Moderno com/sem CSS Clássico: geometria, cores e tamanho de fonte idênticos.

Não homologados todos os atalhos globais, pagamentos, cancelamentos, hardware ou instalação real. Regras para largura estreita incluídas, mas uso móvel do Clássico não homologado nesta rodada. A matriz integrada permanece pendente. Próxima etapa: atendimento/garçom conforme plano. Nada publicado.
