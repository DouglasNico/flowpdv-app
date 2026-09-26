# Fase 15 — conferir pagamento no perfil recuperado

Implementação local em 23/09/2026; publicação suspensa.

## Entrega e limite

O botão de retomada existente agora identifica o perfil em recuperação e consulta exclusivamente o recebimento já confirmado no servidor. Confere loja, identidade operacional original, conta, turno, versão, formas, valores, troco e movimento financeiro. Não reenvia o comando de fechamento nesse perfil.

Após confirmação correspondente, salva recibo de conferência local e remove somente a tentativa pendente. O bloqueio operacional permanece para as etapas de caixa/inventário/liberação gerencial. Pagamento ausente, divergente ou estornado continua pendente para conciliação; ausência no servidor não é autorização para receber novamente. Esta etapa resolve perda de resposta de um pagamento já registrado, não transação externa desconhecida.

## Arquivos

- `functions/conferencia-pagamento-atendimento-v2.js`: nova consulta somente leitura de venda/conta/movimento, com correspondência exata à tentativa original.
- `functions/fechamento-v2.js`: expõe a consulta pelo controle existente de terminal ativo, vínculo de loja e identidade delegada.
- `src/js/pagamento-atendimento-pendente.js`: escolhe consulta no perfil recuperado, valida marcador/identidade/retorno, grava recibo antes de remover a tentativa e conserva o bloqueio. Fluxo normal continua usando o fechamento idempotente existente.
- `src/js/bloqueio-recuperacao-perfil.js`: permite apenas a nova consulta; comandos financeiros continuam bloqueados no perfil recuperado.
- `src/js/bundle.js`: recompilado. Nenhuma mudança visual nova; reutiliza o botão da fase 14.
- `test/pagamento-atendimento-pendente.test.cjs`: transferência, consulta sem reenvio, falha de resposta, recibo em disco e preservação do bloqueio.
- `test/bloqueio-recuperacao-perfil.test.cjs`: consulta permitida sem liberar mutações.
- `test/recuperacao-terminal-v2.test.cjs`: recebimento real no emulador, transferência, origem revogada/terceiro recusados, valores/conta divergentes, reinício após resposta perdida, uma venda/movimento e estoque preservado; estorno recusado.
- `test/run-instalacao-perfil-ui.cjs`, `test/instalacao-perfil-ui-flow.cjs`: backup com tentativa, instalação em perfil novo, retomada pela interface, recibo local e bloqueio mantido.
- `scripts/test-venda-integrada.ps1`: opção `-PagamentoRecuperado` executa o cenário de servidor específico e a interface, evitando repetir cenários sem mudanças.

## Evidências

15 testes locais aprovados em `output/pagamento-recuperado-fase15-local.log`. Cenário específico de servidor e ensaio Electron aprovados, com código 0, em `output/pagamento-recuperado-fase15-integrado.log`. Logs na raiz do workspace. O ensaio da interface usa fixture de pagamento confirmado; o cenário de servidor cria o pagamento pelas APIs reais antes da transferência.

## Continuidade

A rodada de recuperação de pagamentos confirmados tem um limite claro. Conciliação de pagamentos ausentes/divergentes/estornados, transações externas e rede física permanecem no planejamento. Próxima frente local: painel de gestão do cardápio, suas dependências funcionais e acabamento Impeccable conforme a matriz do ecossistema.
