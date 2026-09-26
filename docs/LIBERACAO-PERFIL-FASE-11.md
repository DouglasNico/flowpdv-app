# Fase 11 — liberação do perfil recuperado

## Escopo implementado

Liberação na homologação local para começar um novo turno, após restaurar um perfil sem turno atual e conferir todo o histórico encerrado. Turnos abertos, contas/pedidos pendentes, dados incompletos e divergências continuam bloqueados. Não remove bloqueios apenas por existir um backup.

## Arquivos

- `src/js/liberacao-perfil-recuperado.js`: orquestra conferência de vendas, fechamentos, aritmética das sangrias/gaveta, vínculos e saldo atual do estoque; solicita valores independentes e referência dos comprovantes. Reconfere antes de pedir autorização. Persiste recibo local antes de remover o bloqueio; resposta incerta reutiliza a tentativa.
- `src/js/liberacao-perfil-ui.js`: formulário de conferência sem preencher valores esperados; exige referência, confirmação e gerente autenticado no painel de acesso.
- `src/js/fechamento-teste.js`: integra o formulário aos perfis nomeados em recuperação.
- `functions/liberacao-perfil-v2.js` e `functions/index.js`: nova autorização pelo gerente verificado da mesma loja. Transação revalida terminal/delegação, revisões dos turnos fechados, pendências e estoque atual; grava recibo único em `liberacoes_perfis`. Não modifica vendas, estoque nem caixa.
- `src/js/restauracao-terminal-teste.js`: aceita conferir backup apenas com histórico, sem turno atual, usando a conferência completa dos turnos.
- `src/js/bundle.js`: recompilado.
- `test/liberacao-perfil-recuperado.test.cjs`: divergência de dinheiro/sangria/contagem/estoque, mudanças concorrentes, disco cheio, resposta perdida, repetição e troca de identidade.
- `test/recuperacao-terminal-v2.test.cjs`: autorização, bloqueio de gerente de outra loja, turno aberto, estoque antigo, pedido pendente, terminal revogado e recibo idempotente. Corrigida dependência ausente de `conferirGavetaBackup` no carregador VM de um teste anterior.
- `test/run-instalacao-perfil-ui.cjs` e `test/instalacao-perfil-ui-flow.cjs`: cenário separado de recuperação/liberação. Corte de 2,500 kg, saldo atual de 2,250 kg: contagem antiga recusada e saldo atual conservado; novo turno e venda posterior testados.
- `scripts/test-venda-integrada.ps1`: opções `-LiberacaoPerfil` e `-SomenteInterface` para repetir apenas a interface quando o servidor já foi validado.

## Validação

27 testes locais e 16 testes de servidor aprovados. Ensaio Electron de liberação, recarga e abertura de turno aprovado em `output/liberacao-perfil-fase11.log`. Extensão aprovada em `output/liberacao-perfil-venda-fase11.log`: novo turno com R$ 10 de fundo, dois envios do pagamento geram uma venda de 250 g e saldo remoto de 2,000 kg, preservando o movimento anterior de 250 g. Ambos terminaram com código 0. Logs na raiz do workspace.

## Limites preservados

Sem publicação. Não homologa outro equipamento físico nem certifica que comprovantes/contagens informados são verdadeiros: a interface exige conferência independente pelo gerente. Recuperação com turno ainda aberto não pode ser liberada por este caminho; exige tratamento próprio do fechamento. Limites existentes de 50 turnos, 100 produtos e tamanho das consultas permanecem. Movimentos posteriores ao corte são preservados porque a liberação não escreve saldos ou vendas antigos. A restauração com vendas ausentes/divergentes continua exigindo a cópia reconstruída/conferida antes da instalação.
