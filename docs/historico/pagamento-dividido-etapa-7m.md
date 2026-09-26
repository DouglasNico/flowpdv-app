# Etapa 7M — pagamento dividido manual

O carrinho local com estoque do servidor, disponível no perfil de teste, aceita dinheiro, Pix, débito e crédito na mesma venda. Também aceita pagamento integral por uma forma eletrônica. O fluxo de fechamento das contas do restaurante continua com seu seletor anterior; esta etapa amplia a ponte de vendas locais.

## Como operar

Adicione os produtos. Informe os valores efetivamente recebidos em Pix, débito e crédito; campos vazios equivalem a zero. A diferença para o total é a parcela em dinheiro. Informe o dinheiro entregue pelo cliente ou deixe vazio para o valor exato dessa parcela. Confira a divisão e o troco, marque a confirmação e registre.

Exemplo: venda de R$ 7,00 com R$ 2,00 em Pix, R$ 1,00 em débito e R$ 2,00 em crédito deixa R$ 2,00 em dinheiro. Se o cliente entrega uma nota de R$ 10,00, o troco é R$ 8,00. A receita é R$ 7,00 e a entrada líquida na gaveta é R$ 2,00. O valor pago bruto no Excel é R$ 15,00, incluindo as formas eletrônicas, antes do troco.

O sistema recusa valores negativos, precisão maior que dois decimais, soma eletrônica acima do total, dinheiro insuficiente e dinheiro informado quando não há parcela em dinheiro. Alterar pagamentos, produtos, preços ou turno exige nova conferência antes de registrar.

## Consistência e devoluções

O servidor valida formas únicas, soma exata em centavos e troco somente sobre a parcela em dinheiro. Repetir a tentativa recupera os valores originais; modificar a divisão de uma tentativa já iniciada é recusado. A baixa de todos os produtos continua atômica, com uma única venda e confirmação local recuperável.

O caixa separa dinheiro, Pix, débito e crédito. O Excel informa a divisão na coluna de forma de pagamento. O histórico local e a pendência mostram os pagamentos originais.

O estorno integral devolve as mesmas parcelas da venda original. O operador deve realizar e conferir cada devolução fora do sistema antes de registrar o estorno. O ajuste ocorre no turno atual por forma, sem alterar o fechamento anterior nem descontar Pix ou cartões da gaveta. O servidor fornece as formas originais no comprovante; o cliente rejeita divergências. A planilha de estornos também informa as formas devolvidas.

As vendas e pendências antigas sem divisão mantêm seu formato e continuam recuperáveis. Nenhuma migração automática de dados reais é feita.

## Limites e próxima etapa

Somente ambiente de teste e conferência manual. Não há integração bancária, cobrança Pix, TEF, taxas de cartão, parcelamento, devolução parcial ou documento fiscal nesta etapa. O rascunho do carrinho ainda não é salvo ao reiniciar; a recuperação persistente começa na tentativa de registro. Descontos, acréscimos e integração à tela operacional continuam pendentes.

Próxima etapa sugerida: descontos e acréscimos com regras explícitas, conferência do total no servidor e reflexos em estoque, relatórios e estorno.

Implementação seguinte: [ajustes da venda — etapa 7N](ajustes-venda-etapa-7n.md).

## Validação

227 testes distintos aprovados: 70 locais, 80 de servidor e 77 do legado. A exportação de estornos foi também validada em execução específica com Excel real. Compilação concluída. O fluxo completo da interface oculta passou com a divisão do exemplo, bloqueio de excesso e alteração após conferência, recarga sem duplicação e conferência independente do comprovante no servidor. Os emuladores foram encerrados normalmente.

Resultados e evidências: `output/etapa-7m-local.log`, `output/etapa-7m-legado.log`, `output/etapa-7m-backend.log`, `output/etapa-7m-interface.log`, `output/etapa-7m-estorno-excel.log`, `output/etapa-7m-bundle.log` e captura `output/etapa-7m/pagamento-dividido.png`.
