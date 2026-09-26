# Etapa 7N — descontos e acréscimos

Disponível no carrinho local do perfil de teste, com estoque no servidor. Ajustes em reais sobre a venda inteira, com motivo de 5 a 180 caracteres. O preço unitário e a quantidade de cada produto permanecem registrados sem alteração.

## Operação

Informe desconto e/ou acréscimo, descreva o motivo e confira novamente o carrinho antes de confirmar. Campos vazios significam zero. O desconto não pode superar o subtotal dos produtos, mesmo que exista acréscimo. São aceitas até duas casas decimais, com ponto ou vírgula, sem separador de milhar. Não há ajuste percentual ou por item nesta etapa.

Total = subtotal dos itens − desconto + acréscimo. O servidor recalcula os itens em centavos, valida os limites e exige que o total informado corresponda ao resultado. Também confere a soma dos pagamentos e o troco sobre a parcela em dinheiro. Mudar o motivo ou os valores exige nova conferência. Um ajuste já enviado não pode ser alterado na retomada.

Exemplo: subtotal R$ 5,00, desconto R$ 1,50 e acréscimo R$ 0,75 resultam em R$ 4,25. Com R$ 2,00 em Pix, restam R$ 2,25 em dinheiro; uma nota de R$ 10,00 gera R$ 7,75 de troco.

## Caixa, estoque e recuperação

O caixa recebe o total ajustado, distribuído pelas formas de pagamento. O estoque segue as quantidades dos produtos, independentemente do ajuste. Uma cortesia integral resulta em total zero e ainda consome os produtos; cancelar a tentativa devolve o estoque conforme o fluxo existente.

O estorno integral devolve o total efetivamente pago, incluindo o acréscimo e descontando o desconto, nas formas originais. Não devolve o subtotal nem o dinheiro bruto antes do troco. A venda original e seu motivo ficam preservados.

O comprovante do servidor, a pendência e a venda local conservam o ajuste. O armazenamento recusa valores locais divergentes. Pendências anteriores sem ajuste mantêm o formato original e continuam recuperáveis.

O Excel apresenta subtotal, desconto, total, valor pago e troco nas colunas existentes; as novas colunas finais registram acréscimo e motivo. O histórico do painel apresenta o ajuste e o motivo. O detalhamento de itens continua mostrando os valores brutos dos produtos; o ajuste pertence à venda inteira.

## Limites e próxima etapa

Somente perfil de teste; não publicado. Não há cobrança bancária, impressão física, documento fiscal, regras por percentual, limite comercial por operador ou integração desta ponte à tela operacional nesta etapa. A validação do servidor confere a composição aritmética enviada pela ponte local.

Próxima etapa sugerida: preservar o carrinho ainda em edição após recarregar ou reiniciar, com isolamento por loja e terminal e nova conferência de preços e estoque. Atualmente, a recuperação persistente começa na tentativa de registrar a venda.

Implementação seguinte: [recuperação de rascunho — etapa 7O](rascunho-carrinho-etapa-7o.md).

## Validação

232 testes distintos aprovados: 73 locais, 82 no servidor e 77 do legado. Compilação concluída. A exportação Excel foi lida novamente para conferir subtotal, desconto, acréscimo, total, recebido, troco e motivo.

O fluxo completo da interface oculta passou: subtotal R$ 7,00, desconto R$ 0,50, acréscimo R$ 1,50 e total R$ 8,00. A divisão ficou em R$ 3,00 em dinheiro, R$ 2,00 em Pix, R$ 1,00 em débito e R$ 2,00 em crédito; recebido R$ 10,00 em dinheiro, troco R$ 7,00. Motivo e valores permaneceram após recarga, sem duplicação de venda ou estoque. O comprovante remoto foi conferido independentemente. Os emuladores foram encerrados normalmente.

Evidências em `output/etapa-7n-local.log`, `etapa-7n-backend.log`, `etapa-7n-legado.log`, `etapa-7n-excel.log`, `etapa-7n-bundle.log`, `etapa-7n-interface.log` e `etapa-7n/ajuste-conferido.png`.
