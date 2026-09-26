# Delivery — taxa no fluxo financeiro

O recebimento de um pedido de delivery já registrado cria uma conta própria, sem mesa, com produtos e taxa separados. Reenvios simultâneos não repetem itens ou taxa. O fechamento valida a taxa contra o pedido e cobra o total de produtos mais entrega.

O consumo de estoque usa somente produtos/adicionais. A taxa não vira produto fictício. Cancelamento antes do pagamento remove a taxa; estorno integral devolve o valor pago incluindo a entrega, repetindo com segurança o resultado quando a requisição é reenviada. Não há estorno parcial da taxa nesta entrega.

O resumo encerrado preserva a taxa separada no detalhamento. O relatório Excel mostra a taxa e sua devolução em linhas próprias, com valores positivos/negativos e indicação de que não movimentam estoque. Totais do turno incluem a taxa uma única vez. Registros antigos sem taxa continuam válidos.

## Validação

16 testes locais aprovados em `output/delivery-financeiro-local.log`: detalhamento, estorno, relatório Excel, cálculo real de caixa e conferência de recuperação. Bundle compilado em `output/delivery-financeiro-bundle.log`.

Cenários novos de servidor: recebimento simultâneo, taxa de R$ 5 sobre produtos de R$ 25, pagamento de R$ 30 com R$ 20 de troco, repetição de pagamento/estorno, estoque somente dos produtos, encerramento líquido zero e cancelamento da taxa. Teste adicional recusa taxa ausente ou adulterada. Evidência em `output/delivery-financeiro-servidor.log`.

As suítes integradas de recebimento e fechamento terminaram com sucesso, sem falhas, incluindo regressão de mesa/retirada. Não foi necessário repetir a interface completa nesta alteração de backend e cálculo/exportação.

## Limites e próxima entrega

Os pedidos dos testes desta entrega financeira foram semeados diretamente no emulador. A entrega posterior de [envio público](delivery-envio-publico.md) acrescenta confirmação com endereço/contato restritos e revalidação das versões. Ainda faltam apresentação da taxa nas telas e cupons, fluxo de entrega e integração completa da configuração. A parte financeira isolada não torna o delivery pronto para operação real.
