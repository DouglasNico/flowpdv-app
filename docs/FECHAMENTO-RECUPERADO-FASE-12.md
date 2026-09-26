# Fase 12 — fechamento do turno recuperado

Validado localmente em 23/09/2026. Publicação permanece suspensa.

## Comportamento

O perfil restaurado com turno aberto pode reconstruir vendas e estornos já confirmados posteriores ao backup, conferir dinheiro e sangrias com comprovantes independentes e solicitar fechamento a um gerente verificado da mesma loja. O formulário não preenche valores esperados. A contagem total da gaveta e a parcela do restaurante são informadas separadamente.

O servidor verifica identidade delegada, revisão do turno, pagamentos e contas/pedidos pendentes. A mesma tentativa produz um único recibo. O diário local permite retomar perda de resposta ou falha na gravação; as vendas reconstruídas e o histórico são gravados sem baixar estoque novamente. O perfil continua bloqueado até a conferência e liberação final da fase 11.

## Código alterado ou implementado

- `src/js/fechamento-perfil-recuperado.js`: preparação, reconstrução, conferência, pedido gerencial, diário persistente e arquivamento recuperável.
- `src/js/fechamento-recuperado-ui.js`: formulário de comprovantes/contagens e retomada; integrado em `src/js/liberacao-perfil-ui.js`.
- `functions/fechamento-recuperado-v2.js` e `functions/index.js`: autorização gerencial, validação transacional e recibo único; reutiliza fechamento V2 existente.
- `src/js/resumo-financeiro-caixa.js` e `src/js/caixa.js`: cálculo financeiro extraído para compartilhar a mesma aritmética entre caixa e recuperação.
- `src/js/backup-homologacao.js`: exportação normal bloqueada durante fechamento incompleto; leitura interna controlada para retomada.
- `src/js/bloqueio-recuperacao-perfil.js`, `src/js/storage.js` e `src/js/liberacao-perfil-recuperado.js`: diário pendente impede operações legadas e liberação prematura, inclusive sem outro marcador.
- `src/js/bundle.js`: recompilado.
- `test/fechamento-perfil-recuperado.test.cjs`: venda posterior, pagamento incerto, divergência de sangria, resposta perdida, falha em cada gravação, identidade e alteração concorrente.
- `test/recuperacao-terminal-v2.test.cjs`: gerente de outra loja, pagamento/pedido pendente, repetição, contagem alterada e estoque preservado.
- `test/run-instalacao-perfil-ui.cjs`, `test/instalacao-perfil-ui-flow.cjs` e `scripts/test-venda-integrada.ps1`: cenário `-FechamentoRecuperado` em perfil Electron isolado.
- `test/estorno-servidor-teste.test.cjs` e `test/resumo-restaurante-caixa.test.cjs`: carregamento do cálculo compartilhado nos testes VM.
- `test/bloqueio-recuperacao-perfil.test.cjs` e `test/storage-recuperacao-operacional.test.cjs`: proteção pelo novo diário.
- Documentação: este relatório, acompanhamento das pendências e plano completo.

## Evidências

Logs na pasta `output` da raiz do workspace:

- `fechamento-recuperado-unit.log`: 23 testes de fechamento, estorno e resumo aprovados.
- `fechamento-recuperado-protecoes.log`: 18 testes de fechamento, bloqueios, storage e backup aprovados (há sobreposição com a suíte anterior).
- `fechamento-recuperado-fase12.log`: 17 testes de servidor aprovados e ensaio Electron aprovado. Sangria divergente recusada; gerente fecha uma vez; histórico e bloqueio final preservados; estoque inalterado.
- `fechamento-recuperado-regressao.log`: 51 testes gerais e 26 TEF aprovados. Não equivale a homologação TEF com fornecedor.

## Limites e próximo passo

Pagamentos incertos, contas abertas e pedidos ainda não recebidos continuam bloqueando o fechamento. Não presumir recebimento, cancelar conta ou recobrar. Próxima etapa: recuperação de mesas/comandas e pedidos pendentes, com conferência explícita e preservação dos pagamentos. Outro computador físico, equipamentos e comprovantes reais continuam pendentes. Este fluxo exige ambiente de homologação habilitado; não foi publicado.
