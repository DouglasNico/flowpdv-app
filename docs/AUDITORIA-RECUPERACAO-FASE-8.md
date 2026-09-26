# Fase 8 — recuperação de auditoria da venda

## Código

- `src/js/audit.js`: separa preparação do registro e das escritas locais do envio; preserva logs criados durante envio em andamento e interrompe processamento se mudar a licença. Mantém os limites existentes de 200 registros locais/pendentes.
- `src/js/storage.js`: inclui registro de auditoria e fila de envio no mesmo diário recuperável da venda. Os dados preservam operador, horário e ID originais. Recuperação reaplica valores finais sem duplicar; a lista de chaves permitidas aceita apenas auditoria da licença atual. Diários antigos continuam compatíveis.
- `src/js/bundle.js`: recompilado.
- `test/auditoria-venda-recuperacao.test.cjs`: falhas em cada escrita e ao remover diário, reinício com outro operador, falha antes do commit, chave de outra loja, novo log durante envio e troca de licença.

## Validação

14 testes focados de auditoria, correções e recuperação aprovados; `npm test` aprovado, incluindo 26 testes TEF; bundle aprovado. Ensaio integrado do aplicativo aprovado, código 0: `output/auditoria-venda-integrada.log` na raiz do workspace. Inclui revogação, reinício, caixa, delivery, cancelamento e estorno.

## Limites

Não recria logs históricos já perdidos. A retenção de 200 registros continua existente, assim como a necessidade de conexão/autorização para confirmar envio à nuvem. O diário garante recuperação local após interrupção, não uma transação única entre disco e servidor.
