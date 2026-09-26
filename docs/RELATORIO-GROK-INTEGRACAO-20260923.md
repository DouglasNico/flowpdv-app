# Relatório — integração BURGER TESTE — 23/09/2026

Relatório para revisão independente. Fatos abaixo foram consultados ou executados nesta sessão. Onde a evidência não existe, o resultado está como não executado. Nenhum PIN, senha ou token de acompanhamento foi gravado aqui.

## 1. Estado inicial e final

Consulta somente leitura, antes de qualquer mutação, com `node scripts/corte-burger-oficial.cjs` em `adega-pdv-gestao`:

- Terminal oficial `fyFJuGJCcrgkVFkiQiFnSpuUlph1`: ativo, papel caixa, licenciado, adesão confirmada.
- Terminal técnico `HdPRbUveCld3Z0BiHHrop0nAPFD3`: inativo. Não foi reativado.
- Corte `aguardando_pdv`, ativação `suspensa`, cardápio público pausado e catálogo V2 pausado.

Ativação executada em seguida, porque os guardas do script coincidiam com o roteiro:

- Comando: `node scripts/corte-burger-oficial.cjs --ativar`
- Recibo: `output/migracao-v2-20260923/corte-oficial-ativar-recibo.json`
- `commitTime`: `2026-09-23T20:48:48.983250Z`
- Quatro escritas. Não houve `--preparar` nem nova importação de saldo.

Consulta repetida depois da ativação:

- Mesmos terminais, com o oficial ativo/licenciado/aderido e o técnico inativo.
- Corte `concluido`, ativação `habilitada`, público e V2 sem pausa.

Estado deixado ao final:

- A loja permanece habilitada e o cardápio publicado em `https://flowpdv.app.br/LIC-FLOW-937278` está aberto. Não foi suspenso de novo.
- Não há turno aberto no servidor nem no caixa local. O turno de teste foi encerrado e o caixa local arquivado, ambos com diferença de R$ 0,00.
- O aplicativo oficial foi fechado e aberto de novo sem porta de depuração. A sessão de operador não sobrevive a esse reinício: a tela de login volta a aparecer. Na reabertura imediatamente anterior, ainda com depuração, a adesão local continuava em `legado-lic-flow-937278`, revisão 1, o botão `Pedidos do cardápio` estava presente e não havia turno.
- O banner do caixa, nessa reabertura conferida, chegou a mostrar `Homologação habilitada para novas vendas.` Durante o pagamento ele ainda estava em `Consultando autorização para novas vendas.` A venda mesmo assim foi aceita pelo servidor.

Inferência explícita: a mensagem de conexão e o banner de homologação não foram tratados como prova da venda. A prova é o pedido, a venda, o movimento e o saldo lidos depois da operação.

## 2. Arquivos alterados nesta sessão

Base anterior a qualquer edição: `output/revisao-grok/20260923-174821`. Ela guarda branch, HEAD, status e diff dos repositórios, mais a cópia dos testes antes da edição. Não inclui credenciais.

Não houve commit. Não houve alteração de produto, regra, função publicada ou cardápio. O instalador 3.2.38 já instalado não foi gerado de novo.

Única mudança de código: os testes de emulador que estavam presos nas portas 8080/9099/5001 passaram a aceitar o mesmo modo isolado já usado por `fechamento-v2` e `public-orders-v2`, quando `FLOWPDV_COMBOS_ISOLADO=1`. As portas padrão continuam iguais sem essa variável. Cópias anteriores estão em `output/revisao-grok/20260923-174821/originais`.

Arquivos:

- `test/recebimento-v2.test.cjs`
- `test/recuperacao-terminal-v2.test.cjs`
- `test/cozinha-v2.test.cjs`
- `test/configuracao-v2.test.cjs`
- `test/pendencias-atendimento-v2.test.cjs`
- `test/convites-garcom-v2.test.cjs`
- `test/consulta-entregas-v2.test.cjs`

Motivo: as portas 8080, 9099 e 5001 já estavam ocupadas por outro processo. O roteiro proíbe encerrá-lo. Os testes rodaram no emulador demo `firebase.combos-test.json` (Auth 9199, Firestore 8180, Functions 5101), projeto `demo-flowpdv`.

Scripts temporários de consulta e de automação do aplicativo instalado ficam na pasta de evidências, não no repositório do PDV. Eles não contêm o PIN. O script de corte existente foi o único que gravou a ativação no Firebase.

## 3. Testes executados

Ambiente local do PDV, Node 22.23.2, diretório `adega-pdv-gestao`. Logs em `output/revisao-grok/20260923-174821/logs`.

| Comando | Resultado | Log |
| --- | --- | --- |
| `npm test` | 51/51 gerais e 26/26 TEF simulado, saída 0 | `npm-test.log` |
| `npm run test:profile` | 12/12, saída 0 | `test-profile.log` |
| `npm run bundle` | saída 0 | `bundle.log` |
| `node --test` dos testes unitários V2 listados no comando do log | 106/106, saída 0 | `unit-v2.log` |
| Ponte em `flowpdv-cardapio-login-release`: `node --test test/ponte-pedido-v2.test.js` | 3/3, saída 0 | `ponte-pedido-v2.log` |
| `flowpdv-cardapio`: acompanhamento e ambiente | 7/7, saída 0 | `cardapio-unit.log` |
| Emulador isolado, `demo-flowpdv`, `firebase.combos-test.json` | 155/155, saída 0 | `emulator-v2.log` |
| Regras no mesmo emulador, só Firestore | 15/15, saída 0 | `emulator-security.log` |

O conjunto de 155 inclui, em concorrência 1: piloto BURGER, fechamento, pedidos públicos, recebimento, pareamento, recuperação de terminal, cozinha, configuração, pendências de atendimento, convites de garçom e consulta de entregas. A mensagem de impressora offline no TEF é a falha simulada que o próprio teste espera. Não é homologação física.

`npm run build` no repositório local `flowpdv-cardapio` terminou com saída 0 (Vite `built in 3.38s`). Não publiquei esse resultado. Log: `cardapio-build.log`. O repositório publicado `flowpdv-cardapio-login-release` não tem `node_modules` local; não instalei dependências. O site publicado foi o que recebeu o pedido.

### Matriz

| Cenário | Resultado | Ambiente e evidência |
| --- | --- | --- |
| Adesão correta | PASSOU | Instalado. Conexão: caixa integrado. Adesão local da loja `legado-lic-flow-937278`, revisão 1. Consulta remota com terminal oficial aderido. |
| Licença, dispositivo ou revisão divergente | PASSOU | Unitário `adesao-pdv-v2` e `preparacao-pdv-v2`, dentro dos 106. |
| Sem login, membro revogado ou outra loja | PASSOU | Emulador demo, `security-v2`, 15/15. |
| Loja suspensa | PASSOU no emulador | Coberto pela suíte de 155 e pela ponte (resposta de loja suspensa). Não foi recriado na BURGER já habilitada. |
| Avulso de retirada | PASSOU | Emulador (piloto, 155) e instalado/publicado. Pedido abaixo. |
| Preço adulterado, quantidade inválida, produto ausente | PASSOU no emulador/ponte | Ponte recusa outra loja, mesa, combo e adicional. Preço divergente está no piloto. Não repeti adulteração no site publicado. |
| Combos e adicionais fora do piloto | PASSOU na ponte; inspeção pública sem combo no item testado | Não enviei um combo pelo site publicado. Quatro combos continuam fora do piloto. |
| Pedido antigo de R$ 163,40 | PASSOU na consulta V2 | O id `PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0` não existe em `lojas_v2/legado-lic-flow-937278/pedidos`. Não virou venda nem baixa V2. O documento legado não foi relido nesta sessão. |
| Duplo envio do pedido | PASSOU no emulador e na ponte | No publicado, o carrinho chegou a duas linhas por dois cliques e uma foi removida antes do envio. Saiu um único pedido. |
| Duplo recebimento e repetição do pagamento | PASSOU | Instalado: o segundo fechamento devolveu a mesma venda. Saldo permaneceu 49 unidades. Um movimento de recebimento. |
| Caixa fechado | PASSOU no emulador; inspeção instalada antes da abertura | Antes do turno, `getTurnoAtual` estava vazio. Não forcei uma venda com o caixa fechado no instalado. |
| Abertura e fechamento de turno | PASSOU | Instalado. Fundo zero. Servidor fechou com diferença R$ 0,00. Caixa local arquivado com diferença R$ 0,00. |
| Fechamento do pedido | PASSOU | Uma venda, R$ 6,00 em dinheiro manual, baixa de 1 unidade. |
| Produto sem controle e saldo insuficiente | PASSOU no emulador | Piloto dentro dos 155. O item instalado era controlado e tinha saldo. |
| Cancelamento antes de concluir | PASSOU no emulador | Não cancelei o pedido instalado antes do pagamento; ele foi pago e depois estornado. |
| Estorno e repetição | PASSOU o primeiro estorno instalado | Estoque voltou de 49 para 50. O botão de estornar sumiu depois do primeiro. A segunda repetição na tela instalada não foi oferecida e portanto não foi executada. A suíte de fechamento no emulador cobre a repetição de servidor. |
| Queda e reabertura | PASSOU no emulador de recuperação | No instalado, reabri o processo e a adesão continuou, sem segunda venda. Não cortei a energia no meio do pagamento. |
| Venda local de balcão depois da migração | PASSOU no instalado em 24/09 | Venda `VL-62466ea5-fa93-47ad-a49b-3e2941b30dfb`, R$ 6,00. A segunda chamada no mesmo clique não gerou outra venda. Estoque 50 → 49 → 50 no estorno local. |
| Atendimento | NÃO EXECUTADO no terminal oficial | Não troquei a função do caixa de produção para atendimento. |
| Backup e restauração em produção | NÃO EXECUTADO | Há testes unitários de reconstrução e proteção. Nada foi restaurado na BURGER. |
| Acompanhamento público | PASSOU | Depois do estorno, a página do pedido mostrou `Cancelado` e `Este pedido foi cancelado pela loja`, item 1× Coca-Cola. Token inválido está no teste de regras, não foi repetido no ar com um token fabricado. |
| Reabrir o aplicativo | PASSOU | Adesão e botão de pedidos permaneceram; turno ausente. Em seguida o processo foi aberto sem depuração. |
| Outras lojas | PASSOU nas regras do emulador | Nenhuma venda foi feita em loja real além da BURGER TESTE. |
| TEF, fiscal, impressora, gaveta e balança físicos | NÃO EXECUTADO | TEF simulado 26/26. Sem equipamento e sem autorização de hardware. |

## 4. Registros do teste instalado

Produto: `PRD-MU60B0MN-AVIW`, REFRIGERANTE COCA-COLA LATA 350ML, preço publicado R$ 6,00, preço V2 600 centavos. Saldo antes: 50000 mili (50 unidades).

Pedido público: `bfa4138e-9b1e-4035-962f-e7f4470dcbe2`, exibido como `V2-` mais esse id. Tipo retirada. Quantidade 1. Observação `TESTE DE INTEGRAÇÃO`. Total 600 centavos. Sem adicional.

Depois do recebimento e do pagamento:

- Pedido `recebidoPdv: true`, pagamento `pago`.
- Atendimento `retirada-bfa4138e-9b1e-4035-962f-e7f4470dcbe2`, status `fechado`, versão 2, total 600.
- Venda no mesmo id, status `concluida`, dinheiro 600 centavos.
- Movimento `recebimento_manual` de 600 centavos.
- Saldo: 49000 mili. Uma unidade, uma vez.

Repetição do mesmo fechamento: a tela mostrou de novo a mesma venda e o mesmo troco de R$ 0,00. Saldo continuou 49000. Não surgiu segundo movimento.

Estorno, motivo operacional `TESTE DE INTEGRAÇÃO`, com reposição de estoque:

- Venda `estornada`.
- Movimento `estorno_manual` de -600 centavos. O recebimento original permanece.
- Pedido `cancelado` e pagamento `estornado`.
- Saldo de volta a 50000 mili.
- Acompanhamento público: cancelado pela loja.

Turno: `TRN-eb430970-a32b-433e-94f8-c3f952eea3b1`. Fundo R$ 0,00. Encerrado no servidor com recebimentos líquidos R$ 0,00 e diferença R$ 0,00. Caixa local arquivado com diferença R$ 0,00. Não há turno aberto.

O token de acompanhamento não está neste relatório.

## 5. Prova de uma venda e do estorno

A baixa foi de 50 para 49 unidades no fechamento e voltou a 50 no estorno. A repetição do pagamento, entre esses dois momentos, não alterou o saldo nem criou outro recebimento. Os documentos de venda, recebimento e estorno continuam no Firebase. Nada foi apagado para limpar a trilha.

## 6. Publicação

Nenhuma função, regra, índice ou site foi publicado nesta sessão. A ativação só mudou os documentos da BURGER TESTE que o script `--ativar` já previa: corte, ativação, módulos e a pausa dos dois catálogos. Projeto Firebase da loja: `aplicativo-pdv`. Não há índice pendente registrado por esta sessão. Não executei `npm run release`.

## 7. Instalador

O aplicativo que executou o ciclo é o já instalado em `C:\Users\User\AppData\Local\Programs\flowpdv\FlowPDV.exe`, versão 3.2.38, instalador `output/instalador-oficial-v2-20260923-retomada/FlowPDV-Setup.exe`, SHA256 `ce73d4dc3b57af641b34946d40b64d6cae2fec0841f5698082ad95816db6b5af`. Não gerei outro instalador: o código de produto não mudou. A alteração ficou só nos testes de emulador, que não entram no pacote.

Captura do caixa já arquivado, ainda na sessão com depuração: `output/revisao-grok/20260923-174821/pdv-caixa-arquivado.png`. Isso não é `npm start`. Ao terminar, o processo foi iniciado de novo sem `--remote-debugging-port`. A porta 9228 não ficou em escuta.

## 8. Como o proprietário confere

Abrir o FlowPDV normal, entrar como Admin e olhar `Pedidos do cardápio`. Não deve haver conta aberta destes testes. O caixa local está sem turno. O cardápio público da BURGER TESTE está no ar. Os dois pedidos de teste ficam no histórico como cancelados/estornados. O saldo da Coca-Cola lata voltou às 50 unidades.

## 9. Pendências antes de clientes

- Não publicar release nem atualização automática.
- Não migrar outras lojas.
- Combos, adicionais, promoções e a composição dos quatro combos continuam desligados.
- Homologação física de TEF, impressora térmica, gaveta, balança e documento fiscal não foi feita. Nesta máquina só há Microsoft Print to PDF e Enviar para o OneNote.
- A venda de balcão no instalado passou em 24/09. A troca do terminal oficial para o perfil Atendimento continua não executada.
- O segundo estorno não foi repetido na tela instalada, porque o botão some depois do primeiro.
- A queda física de rede no meio do pagamento não foi executada: cortar o adaptador derrubaria a conexão desta máquina.
- O build do repositório publicado não rodou nesta máquina por falta de `node_modules`. O build do cardápio local sujo passou e não foi publicado. O site no ar foi o que recebeu o pedido.

## 10. Continuação em 24/09/2026

Sem mudança de produto, sem novo instalador, sem deploy e sem release. O aplicativo voltou a abrir sem porta de depuração.

Venda de balcão no PDV instalado, turno `TRN-3a5a8e63-e56f-4e52-a5a6-84265f64fe9e`, fundo R$ 0,00:

- Produto `PRD-MU60B0MN-AVIW`, 1 unidade, dinheiro, total R$ 6,00.
- Venda `VL-62466ea5-fa93-47ad-a49b-3e2941b30dfb`. A segunda chamada de finalização, ainda com a primeira em andamento, não criou outra venda. O carrinho ficou vazio.
- Saldo depois da venda: 49000 mili. Estorno local confirmado na tela, com reposição. Saldo de volta a 50000 mili.

Pedido público de retirada no celular emulado, viewport 390×844:

- Pedido `7a872ba7-acaf-4dcb-9f2e-87679a5da6b1`, exibido como `V2-` mais esse id, código 5DA6B1. Um item, observação `TESTE DE PREPARO`, total 600 centavos, sem adicional.
- Recebido no caixa. Status avançou de `novo` para `em_preparo` e depois `pronto`, com pagamento ainda pendente.
- A página pública, na mesma largura de celular, mostrou `PRONTO PARA RETIRAR / SERVIR`.
- Pagamento em dinheiro de R$ 6,00. Saldo foi a 49000 mili. Estorno devolveu o estoque uma vez. Pedido `cancelado`, pagamento `estornado`, saldo 50000 mili. A página pública mostrou `CANCELADO`.

O turno do restaurante foi encerrado e o caixa local arquivado, ambos com diferença de R$ 0,00. Não há turno aberto.

## 11. Aba Cardápio online na compilação local

O aplicativo aberto até aqui ainda era a compilação anterior. As mudanças de tela foram compiladas de novo, sem publicar atualização.

- Comando: `npx electron-builder --win --publish never`. Exit code 0. Nenhum upload.
- Instalador: `output/instalador-cardapio-aba-20260924/FlowPDV-Setup.exe`. SHA256 `0e36e993bf18d1e24b3454d78393908daa9f6d89174020fcef71af67e2233a68`. O instalador de 23/09 não foi substituído.
- Instalação silenciosa sobre `C:\Users\User\AppData\Local\Programs\flowpdv`, exitCode 0. Versão do pacote continua 3.2.38. O pacote instalado contém o título `Bem-vindo`, a aba `nav-btn-cardapio` e o aviso de erro com `tempo: 8e3`.

Conferido no aplicativo instalado, depois do login, com depuração só em 127.0.0.1:9228:

- O aviso de entrada usou o título `Bem-vindo`.
- Um aviso de erro de verificação apareceu e saiu sozinho, sem clique no X, em menos de 12 segundos.
- A aba `Cardápio online` ficou visível. Ao abri-la, o conteúdo é uma `section` dentro de `#tab-cardapio`, com o texto de pedidos do cardápio e nenhuma conta aberta.
- O botão flutuante `Pedidos do cardápio` permaneceu oculto.
- O botão `Caixa integrado` ficou visível.

Não houve nova venda, novo pedido público, estorno nem fechamento de turno nesta compilação. Impressora, gaveta, balança, TEF, NFC-e e release continuam sem execução.
