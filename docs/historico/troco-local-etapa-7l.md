# Etapa 7L — dinheiro recebido e troco

Acrescenta valor recebido e cálculo de troco ao carrinho local do perfil de teste. O valor recebido pode superar o total, mas o caixa continua registrando somente a receita da venda.

## Operação

Monte o carrinho e preencha **Dinheiro entregue pelo cliente (R$)**. Deixe em branco para valor exato. Use vírgula ou ponto decimal, até duas casas e sem separador de milhar. Clique em **Conferir carrinho** para ver o total, o recebido e o troco; confirme os itens e a entrega do troco antes de registrar.

Exemplo: venda de R$ 7,00, recebido de R$ 10,00 e troco de R$ 3,00. A receita e a entrada líquida em dinheiro são R$ 7,00. Não se soma o recebido inteiro ao caixa nem se desconta o troco novamente do total da venda.

Editar o dinheiro recebido exige nova conferência. Valores insuficientes, negativos, com precisão excessiva ou fora do limite são recusados antes de gerar a pendência. A gravação também relê os valores para impedir confirmação baseada em uma conferência antiga.

## Consistência e histórico

O servidor recalcula o troco em centavos inteiros a partir do recebido e do total validado. Recusa troco adulterado e não aceita mudar o recebido em uma repetição da mesma tentativa. O comprovante, a pendência e a venda local conservam os valores originais.

As vendas novas preenchem também os campos de valor pago e troco usados pelos relatórios existentes. A exportação Excel mostra total, valor pago e troco em colunas separadas. O painel mantém os registros originais de dinheiro recebido e troco após a recarga, inclusive quando há estorno posterior identificado no histórico de devoluções.

Pendências antigas, das versões de pagamento exato sem campos específicos de troco, continuam recuperáveis com seu conteúdo e identificador originais. Não são reinterpretadas como novas operações.

## Retomada e devolução

Após uma falha, retome o registro pendente sem repetir recebimento ou entrega de troco. O painel mostra os valores da tentativa original. Cancelar a tentativa ou estornar a venda repõe estoque conforme as regras anteriores e não registra uma segunda movimentação de dinheiro automaticamente.

Se o troco já foi entregue, a devolução integral corresponde ao total da venda, não ao valor recebido antes do troco. No exemplo de R$ 7,00 pagos com R$ 10,00 e R$ 3,00 de troco já entregues, o estorno é de R$ 7,00. O operador deve conferir o dinheiro efetivamente entregue antes de confirmar a devolução manual.

## Limites

Continua sendo pagamento manual em dinheiro no ambiente de teste. Não controla disponibilidade de cédulas/moedas, não aciona gaveta, não cobra cartão/Pix e não emite documento fiscal. Pagamento dividido, descontos, acréscimos e integração à tela operacional antiga continuam pendentes. O carrinho ainda em edição não é preservado ao reiniciar; a recuperação persistente começa na tentativa de registro.

## Validação

Testes locais usam armazenamento, calculador e exportação Excel reais. Cobrem valor exato, troco, recebido insuficiente, precisão inválida, comprovante divergente, mudança na retomada, falhas de gravação/confirmação e compatibilidade com pendências antigas. Testes do servidor cobrem recálculo, adulteração, repetição, cancelamento e estorno limitado ao total da venda.

O fluxo oculto da interface recusa R$ 6,99 para uma venda de R$ 7,00, calcula R$ 3,00 de troco sobre R$ 10,00 e recusa mudar o recebido após conferir. Recarrega e confere que os valores, o caixa e o estoque permanecem consistentes.

Resultado: 220 testes aprovados (65 locais, 78 de servidor e 77 do legado), além do fluxo completo da interface em janela oculta, encerrado com código 0. A captura do carrinho foi inspecionada: venda de R$ 7,00, recebido de R$ 10,00 e troco de R$ 3,00. A recarga conservou os valores sem duplicar venda ou estoque. O caixa do cenário ficou em R$ 2,00 líquidos, considerando o estorno anterior de R$ 5,00. Os emuladores foram encerrados; nenhuma publicação, cobrança ou impressão física foi realizada, e a demonstração não foi reaberta.

Evidências no diretório `output`: `etapa-7l-local.log`, `etapa-7l-backend.log`, `etapa-7l-legado.log`, `etapa-7l-interface.log` e `etapa-7l/troco-conferido.png`.

## Próxima parte

Pagamento dividido entre formas conferidas manualmente, mantendo valores em centavos, tratamento correto do troco e recuperação sem duplicação. Nenhuma publicação ou transação financeira real faz parte desta etapa.

Implementação seguinte: [pagamento dividido — etapa 7M](pagamento-dividido-etapa-7m.md).
