# Fase 7 — cancelamento e retomada de delivery

## Concluído localmente

- `test/fechamento-v2.test.cjs`: cenário de delivery cancelado antes de recebimento, repetido por outro caixa; tentativa posterior de receber mantém pedido ignorado, sem atendimento, venda, estoque consumido ou impressão de preparo; aviso de cozinha único.
- `test/alimentacao-aplicativo-completo-ui.cjs`: pedido público recebido pelo aplicativo é cancelado pelos controles do caixa; total/taxa/itens zerados, sem venda extra e sem baixa de estoque. Fechamento final continua conciliado.
- `test/run-venda-aplicativo-completo.cjs`: espera os três pedidos do cenário ampliado.
- `scripts/test-venda-integrada.ps1 -Cancelamento`: executa os testes selecionados de cancelamento e o ensaio Electron no mesmo ciclo dos emuladores.
- `test/delivery-retomada.test.cjs`: resposta incerta conserva requestId/responsável, consulta indisponível permite nova tentativa e consulta atrasada não mostra endereço após mudar o contexto.

## Evidências

15 testes de servidor aprovados com seleção `cancel`; ensaio integrado terminou com código 0. Log: `output/delivery-cancelamento-integrado.log` na raiz do workspace. Os 3 testes focados de retomada também passaram. Nesta fase foi ampliada a cobertura; nenhuma alteração nas regras financeiras do produto foi necessária.

## Pendências externas e limites

Não comprova queda física da rede, dispositivos móveis reais ou impressão física. Cancelamento antes de recebimento foi validado no servidor; a interface atual recebe automaticamente e não oferece aceite manual. Essa decisão de produto permanece no planejamento.
