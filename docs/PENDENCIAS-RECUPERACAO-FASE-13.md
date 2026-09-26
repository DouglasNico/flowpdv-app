# Fase 13 — preservar contas e pedidos na recuperação

Implementação local em 23/09/2026; publicação suspensa.

## Comportamento

O fechamento do turno recuperado e a liberação do perfil agora admitem contas/pedidos pendentes conferidos explicitamente pelo gerente. A tela lista os registros que permanecerão abertos e exige confirmar que não há pagamento recebido sem registro, além dos comprovantes e contagens já exigidos. Nenhum pagamento é inferido pelo backup.

Uma consulta transacional confere os itens/totais, vínculos da mesa, pedidos de origem e ausência de venda/movimento financeiro para a conta aberta. Pedidos com pagamento registrado, vínculos divergentes e registros incompletos impedem a conferência. A prova inclui a revisão de cada documento lido; qualquer alteração antes da autorização exige nova conferência. O contrato antigo, sem aceite das pendências, continua bloqueando qualquer conta/pedido pendente.

A recuperação não modifica contas, pedidos, estoque ou pagamentos. Após liberar e reconectar, o recebimento normal pode transformar pedido aguardando caixa em conta aberta, sem cobrá-lo. O pagamento continua sendo uma ação própria, no novo turno.

## Arquivos e alterações

- `functions/pendencias-recuperacao-v2.js`: leitura e validação das pendências, prova de revisão e conferência do aceite; até 100 contas e 100 pedidos pendentes, com até 300 pedidos de origem vinculados.
- `functions/recuperacao-local-v2.js`: consulta protegida `conferirPendenciasRecuperacaoV2` pelo controle existente de terminal/loja/identidade.
- `functions/fechamento-recuperado-v2.js`, `functions/liberacao-perfil-v2.js`: conferência das pendências na mesma transação da autorização; prova/referência persistidas nos recibos. Sem aceite, preservam o bloqueio anterior.
- `src/js/pendencias-recuperacao.js`: validação da resposta, aceite explícito e lista acessível de registros, com texto seguro via `textContent`.
- `src/js/fechamento-perfil-recuperado.js`, `src/js/liberacao-perfil-recuperado.js`: opção de preservar pendências, comparação antes do envio, vínculo da prova ao digest da tentativa; diários e bloqueios anteriores preservados.
- `src/js/fechamento-recuperado-ui.js`, `src/js/liberacao-perfil-ui.js`: lista e confirmação separada nos formulários existentes.
- `src/js/bloqueio-recuperacao-perfil.js`: permite a nova consulta somente leitura no perfil bloqueado.
- `src/js/bundle.js`: recompilado.
- `test/fechamento-perfil-recuperado.test.cjs`, `test/liberacao-perfil-recuperado.test.cjs`: aceite obrigatório, alteração concorrente e envio da prova correta.
- `test/bloqueio-recuperacao-perfil.test.cjs`: nova consulta permitida sem liberar mutações.
- `test/recuperacao-terminal-v2.test.cjs`: cenário real de conta de mesa e pedido pendente, permissões, divergências, preservação e pagamento no turno seguinte sem duplicação.
- `test/run-instalacao-perfil-ui.cjs`, `test/instalacao-perfil-ui-flow.cjs`: fixtures e ensaio de fechamento/liberação com contas de mesa e retirada; garante que o recebimento automático não cobra nem duplica itens.
- `scripts/test-venda-integrada.ps1`: opção `-PendenciasRecuperacao`, combinável com `-SomenteInterface`.
- Este relatório, plano completo, acompanhamento e nota de memória atualizados.

## Validação e limites

13 testes locais aprovados em `output/pendencias-fase13-local.log`. Os 18 testes de servidor passaram em `output/pendencias-fase13-integrado.log`: registro de pagamento inconsistente e gerente de outra loja recusados; alteração após consulta detectada; mesma conta preservada; pedido recebido duas vezes adiciona itens uma vez; pagamento reenviado gera uma única venda e baixa de estoque. Nesse primeiro ensaio, a expectativa final da fixture de interface foi corrigida para considerar o recebimento automático existente. O ensaio separado de interface passou com código 0 em `output/pendencias-fase13-interface.log`.

Não confirma pagamentos físicos nem resolve respostas incertas de TEF/Pix. O gerente precisa conferir os comprovantes. Dados incompletos, limite excedido, revogação ou mudanças concorrentes mantêm o bloqueio. Se houver tentativa de fechamento já persistida e resultado incerto, preservar o diário e retomar a mesma tentativa; não apagar para contornar a conferência. Não homologa equipamento físico nem publica Functions.

Próxima frente: conciliação das tentativas de pagamento incertas e retomada após perda real de conexão, mantendo o vínculo com a tentativa original.
