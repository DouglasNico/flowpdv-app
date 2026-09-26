# Fase 3 — avisos de impressão, pagamento e atendimento

Data: 22/09/2026. Alterações locais, sem publicação.

## Problema e resultado

Algumas telas anunciavam impressão com sucesso antes de receber o retorno do serviço; a reimpressão do PDV chegava a informar sucesso sem módulo de impressão disponível. O feedback foi centralizado no serviço: a confirmação térmica informa apenas que o sistema aceitou o envio e pede conferir o papel. Cancelamentos/retornos sem confirmação exibem orientação persistente. Abrir o diálogo do navegador/A4 não é tratado como impressão ou PDF concluído.

## Arquivos alterados

- `src/js/thermal-print.js`: `executarImpressao` avisa após retorno confirmado, trata falhas sem falso sucesso e preserva a rejeição exigida pelo comprovante TEF. `imprimirViaJanelaNavegador` retorna Promise, trata popup bloqueado, janela fechada e erro tardio de `print`. `executarImpressaoA4` usa o mesmo caminho. Geradores de cupom, fechamento e A4 retornam o resultado.
- `src/js/pdv.js`: remove mensagens antecipadas em reimpressão/cupom/A4; módulo indisponível gera orientação e mantém a tentativa aberta. Avisos de TEF incerto, confirmação TEF pendente e retorno fiscal rejeitado/pendente usam título específico e duração persistente.
- `src/js/comandas.js`: pré-conta usa somente o feedback central de impressão.
- `src/js/caixa.js`: removidos avisos duplicados/antecipados de cupom de fechamento e de venda selecionada; o serviço compartilhado informa o resultado.
- `src/js/atendimento-pdv.js`: mesa/comanda ou produto não encontrado gera atenção com orientação e chave de agrupamento; não acumula um erro persistente para cada código digitado incorretamente.
- `src/js/bundle.js`: recompilado.
- `test/notificacoes-impressao.test.cjs`: sete cenários com retorno atrasado, falha/cancelamento, confirmação obrigatória TEF, popup bloqueado, diálogo sem confirmação física, erro tardio e PDV sem módulo.

## Verificações e limites

7/7 testes de impressão aprovados; 26/26 testes TEF aprovados; teste integrado de notificações no aplicativo completo aprovado novamente; bundle gerado. O ensaio não imprime documentos físicos, não efetua pagamentos nem publica alterações. O navegador não fornece confirmação de papel impresso/PDF salvo/cancelamento do diálogo; retorna `dialogOpened` sem sucesso confirmado. As alterações não modificam valores, estoque ou regras de autorização financeira.

Revisão de mensagens dos demais módulos administrativos permanece pendente. Esta etapa fecha o grupo de avisos de impressão e os ajustes prioritários de pendências financeiras/entrada inválida no atendimento; não representa revisão de cada aviso existente.
