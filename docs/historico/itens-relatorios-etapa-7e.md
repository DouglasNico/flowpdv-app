# Etapa 7E — produtos, adicionais e estornos nos relatórios

Implementação restrita ao ambiente local de teste. Não houve publicação nem mudança de estoque, cobrança ou impressão física.

## Comportamento entregue

O resumo encerrado agora traz os itens das vendas que originaram cada movimento financeiro. Usa os nomes e preços gravados na venda, sem consultar o catálogo atual. Cada linha conserva produto, pedido, linha original, venda e movimento, permitindo identificar sua origem.

O recebimento mantém quantidade e total positivos. O estorno aparece em uma linha separada, com quantidade e total negativos. Quando a devolução acontece em outro turno, ela entra nesse outro turno; o recebimento do turno original continua positivo mesmo que a venda esteja atualmente estornada.

Os adicionais são informativos, por unidade, e já estão incluídos no preço unitário e no total. Exemplo: duas unidades de um lanche de R$ 10,00 com bacon de R$ 2,50 resultam em R$ 25,00. O relatório não soma o bacon novamente.

As exportações de um turno e do histórico completo passam a ter a aba **Itens restaurante**. As abas anteriores de vendas e itens continuam mostrando o fluxo local. Não são criadas vendas legadas nem movimentações adicionais de estoque. A tela de teste mostra os itens depois de incorporar o resumo encerrado.

## Conferências e compatibilidade

- O servidor confere valores dos itens, quantidades, adicionais, linhas duplicadas e total de cada venda contra o movimento financeiro e o resumo do turno.
- O aplicativo verifica novamente o detalhamento antes de incorporar ou exportar.
- Repetir a incorporação do mesmo resumo não duplica valores nem itens.
- Limites atuais: 500 movimentos, 2.000 linhas e 750 KB de detalhes por resumo. O servidor recusa excedentes explicitamente; não entrega um relatório cortado. Paginação fica para uma etapa posterior.
- Resumos antigos, sem itens, continuam aceitos e são identificados como **Resumo antigo sem detalhes** na planilha. Não se inventam linhas a partir dos totais. Um resumo já incorporado não é substituído silenciosamente: tentar aplicar uma versão diferente exige revisão da migração. Para a demonstração atual, é usado um perfil novo com dados fictícios.

## Validação

Os testes geram e reabrem planilhas com ExcelJS, verificando itens, bacon, totais, estornos negativos e indicação de resumo antigo. Os testes de servidor verificam estorno em outro turno e recusam venda com linhas inconsistentes. O fluxo de interface visível recebe, paga, estorna e incorpora o mesmo resumo duas vezes, conferindo que existem somente duas linhas de restaurante e uma venda legada fictícia.

Evidências no diretório `output` do workspace: `etapa-7e-local.log`, `etapa-7e-backend.log`, `etapa-7e-legado.log`, `etapa-7e-interface.log` e `etapa-7e/itens-restaurante.png`.

## Próxima etapa

Completar o ciclo de caixa pela interface integrada: encerramento do turno atual e abertura do próximo, com conferência dos valores. Depois seguem migração conferida do estoque e das unidades, integração da autenticação antiga, recuperação/sincronização e homologação de equipamentos. O piloto e a publicação continuam pendentes.

Resultado final: **179 testes automatizados distintos aprovados** (74 de servidor, 28 locais e 77 do fluxo antigo), além do fluxo integrado de interface visível. A captura dos itens foi inspecionada: recebimento e estorno de R$ 12,50 com bacon, sem duplicar a venda local de R$ 5,00. Planilhas geradas e relidas em memória. Nenhum deploy realizado.

Continuação entregue no ambiente de teste: [Etapa 7F — ciclo de caixa](ciclo-caixa-etapa-7f.md), com arquivamento conferido, próximo turno e recuperação local de interrupções.
