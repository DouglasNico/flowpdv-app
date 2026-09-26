# BURGER TESTE — preparação operacional de avulsos

## Decisões confirmadas

Em 23/09/2026 o proprietário confirmou:

- Começar o piloto com avulsos. Combos dependem do cadastro de composição e preço total no PDV.
- O pedido `PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0`, R$ 163,40, é teste e permanece somente no histórico; não entra novamente no caixa nem baixa estoque.

O recorte avulso não transporta grupos de opções ainda sem vínculo de estoque. O catálogo público legado não foi alterado.

## Conferência atual

Captura atualizada do Firebase: 60 produtos, 7 publicados, 14 com controle de estoque (50 unidades cada), 46 sem controle, 11 pedidos (6 entregues, 4 cancelados e o teste em preparo). A cópia privada da origem fica em `output/migracao-v2-20260923/burger-origem-atual.json`, fora do instalador; contém informações privadas e não deve ser publicada.

`functions/piloto-avulsos-core.cjs` produz um plano sem usuários, senhas ou dados de clientes. Preserva IDs/preços, cria fichas explícitas sem estoque para os 46 produtos, prepara fichas e saldos para os outros 14 e bloqueia unidades/embalagens não suportadas ou pedidos ativos sem decisão. O catálogo resultante continua pausado e não publicado.

`scripts/preparar-piloto-burger.cjs` gera `burger-piloto-avulsos.json`. `scripts/preparar-dados-piloto-burger.cjs` exige prova do ensaio correspondente, protege versões de origem/destino, recusa saldos divergentes e exige loja suspensa. Sem `--aplicar`, somente lê/simula.

## Preparação no Firebase real

Commit confirmado: `2026-09-23T19:08:25.971534Z`.

Foram preparados 135 documentos: 60 fichas, 60 vínculos de produtos, 14 saldos e um registro de preparação. O catálogo V2 foi atualizado **pausado e não publicado**. Nenhum pedido, recebimento ou venda operacional foi criado no Firebase real. A ativação continua suspensa e os módulos continuam desligados.

Conferência posterior somente de leitura: os 135 documentos correspondem integralmente ao plano. As regras publicadas continuam na versão legada já revisada, sem acesso de cliente às coleções V2. O executor verifica essa versão antes de novas preparações.

A primeira tentativa foi recusada atomicamente porque o backup mudou. A captura foi renovada e todos os dados operacionais comparados ao plano ensaiado; não houve alteração de produtos/preços/saldos. Somente após essa comparação foi feita a gravação protegida. Recibo: `output/migracao-v2-20260923/preparacao-avulsos-remota.json`.

O trabalho remoto utilizou consultas pontuais e um lote de preparação, sem instalar listener/polling. Não representa medição de custo faturado.

## Correção necessária encontrada

A ponte de venda local V2 aceitava somente produtos que baixam estoque. Isso impediria vender os 46 produtos sem controle no balcão depois da migração.

- `functions/venda-local-v2.js`: aceita produto sem estoque somente com vínculo administrativo e ficha coerentes; valida unidades inteiras e registra `itensSemEstoque` no recibo. O cliente não escolhe ignorar estoque.
- `src/js/venda-servidor-teste.js`: exige migração explícita sem estoque e preserva o fluxo de recuperação de venda pendente.
- `src/js/storage.js`: confere cobertura exata dos itens por consumos ou marcadores sem estoque, preserva os marcadores e não executa baixa local adicional.
- `src/js/reconstrucao-backup-v2.js`: preserva esses marcadores na reconstrução e rejeita cobertura ausente/duplicada.
- `src/js/bundle.js`: regenerado pelo build normal.

## Validação realizada

42 testes unitários/de recuperação aprovados nos arquivos `migracao-loja.test.cjs`, `venda-servidor-teste.test.cjs` e `reconstrucao-backup-v2.test.cjs`. O harness da venda foi atualizado para carregar o módulo de resumo financeiro já extraído anteriormente.

`test/piloto-burger-v2.test.cjs`, executado exclusivamente nos emuladores isolados (Auth 9199, Firestore 8180, Functions 5101), passou com cópia dos dados atuais:

- Sete produtos, pedido avulso de **R$ 149,40**.
- Envio concorrente → um pedido; recebimento concorrente → uma conta.
- Fechamento concorrente e repetido → um movimento financeiro e uma baixa por produto controlado.
- Pedido antigo não importado; preço divergente rejeitado.
- Outra venda de balcão com os mesmos produtos mistura itens controlados e sem estoque, usa o mesmo saldo, suporta repetição sem segunda baixa e recusa ficha divergente.
- Teste da ponte com `StorageService` real verifica gravação local única após perda da confirmação, sem alterar o saldo local novamente.

O ensaio testa APIs/ponte de armazenamento, **não** o recebimento no aplicativo normal instalado. Resultado em `ensaio-avulsos-recibo.json`; plano efetivamente ensaiado preservado em `burger-piloto-avulsos-validado.json`. `npm run bundle` aprovado.

## Restante para o instalador sincronizado

1. Adaptar recebimento, turno, fechamento e recuperação V2 ao aplicativo normal com a sessão já vinculada. Hoje essas telas e a ponte de caixa continuam restritas à homologação; a sessão normal permite somente acesso/vínculo.
2. Fazer o corte de estoque/catálogo de forma única: impedir vendas/alterações legadas concorrentes, transportar o vínculo de migração ao terminal e escolher a rota publicada do cardápio. Não basta ligar um campo no servidor.
3. Publicar somente os serviços/regras necessários para a BURGER TESTE, com limites de instância e operação; ligar o canal e validar no PDV normal.
4. Gerar e conferir o novo instalador e testar o ciclo no aplicativo instalado. Nenhum novo instalador sincronizado foi gerado ou declarado pronto nesta etapa.

Não publicar todas as alterações pendentes do repositório. Não ativar a loja só porque a preparação e o ensaio de API passaram.
