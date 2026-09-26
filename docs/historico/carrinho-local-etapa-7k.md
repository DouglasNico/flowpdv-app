# Etapa 7K — carrinho local com estoque compartilhado

Amplia a venda local do painel de teste para até 30 produtos diferentes, com estoque migrado e pertencentes à mesma loja. Mantém pagamento manual pelo valor exato em dinheiro e os fluxos de recuperação, cancelamento de tentativa e estorno integral das etapas anteriores.

## Operação

1. Em **Fechamentos de teste → Venda local com estoque do servidor**, selecione o produto e informe a quantidade na unidade de origem.
2. Clique em **Adicionar ao carrinho**. Repita para os demais produtos.
3. Edite a quantidade na própria linha ou clique em **Remover**. Para o mesmo produto, altere a linha existente; não adicione uma duplicata.
4. Clique em **Conferir carrinho** e confira produtos, quantidades e total. Qualquer edição exige uma nova conferência.
5. Confirme o recebimento do valor exato em dinheiro e registre a venda.

Limpar ou remover todos os produtos deixa o carrinho vazio, que não pode ser registrado. Antes de enviar, o sistema também relê os produtos e bloqueia a operação se preço, itens, loja ou turno divergirem da conferência.

## Consistência

Todos os saldos são lidos antes de qualquer baixa. Se qualquer produto tiver saldo insuficiente, unidade incompatível ou migração ausente, a transação é recusada sem baixar parcialmente o carrinho. Uma confirmação gera uma venda local com todos os itens e um comprovante remoto com os respectivos consumos.

Os saldos locais de origem permanecem congelados; a venda não realiza outra baixa local. O total usa centavos inteiros por linha, com soma dos subtotais. As quantidades seguem a conversão exata já adotada na migração de unidades.

A partir da tentativa de registro, a pendência conserva o carrinho inteiro e o mesmo identificador. Resposta perdida, falha na gravação local ou perda da confirmação final podem ser recuperadas sem duplicar a venda ou qualquer consumo. Cancelar uma tentativa pendente devolve todos os consumos registrados uma vez. Estornar uma venda concluída continua sendo uma devolução integral do carrinho, com reposição opcional de todos os produtos.

## Limites desta etapa

- Funciona somente no perfil de teste e com produtos migrados da mesma loja.
- O carrinho ainda em edição fica na memória desta tela. Recarregar/reiniciar antes de iniciar o registro descarta esse rascunho. A proteção persistente cobre a tentativa de registro, não o rascunho. Trocar de turno também limpa o carrinho em edição.
- Ainda não oferece fardos, descontos, acréscimos, troco, pagamento dividido, integração financeira externa ou estorno parcial.
- Ainda não substitui o carrinho da tela operacional antiga. A migração para essa tela faz parte de uma etapa posterior.

## Validação

Testes locais usam o armazenamento real para gravar farinha em gramas e açúcar em quilogramas na mesma venda. Exercitam resposta perdida, falha de disco, confirmação perdida, cancelamento, mistura de lojas, duplicatas, carrinho vazio, limite de itens e precisão de quantidade.

Testes do servidor verificam falta de saldo no segundo item sem baixa do primeiro, confirmação concorrente, alteração da segunda linha em uma repetição, cancelamento de todos os consumos e estorno integral com reposição única.

O teste oculto da interface migra dois produtos, adiciona e remove itens, muda a quantidade após conferir e recusa um preço alterado depois da conferência. Registra um carrinho de R$ 7,00 (250 g de farinha por R$ 5,00 e 0,25 kg de açúcar por R$ 2,00), recarrega e confere estoque e caixa. O turno já possui um estorno anterior de R$ 5,00, portanto seu movimento líquido deve ser R$ 2,00.

Evidências no diretório `output`: `etapa-7k-local.log`, `etapa-7k-backend.log`, `etapa-7k-interface.log` e `etapa-7k/carrinho-conferido.png`.

Resultado final: **135 testes automatizados distintos aprovados** — 60 locais e 75 de servidor — além do fluxo completo da interface oculta, encerrado com código 0. A captura da conferência foi inspecionada. O servidor terminou com uma venda confirmada de dois itens por R$ 7,00, farinha em 2,25 kg e açúcar em 0,75 kg. A recarga preservou uma única venda e a conferência do turno apresentou R$ 2,00 líquidos, considerando o estorno anterior. Nenhuma baixa de estoque local foi criada. Os emuladores foram encerrados ao final.

## Próxima parte

Continuação: [etapa 7L — dinheiro recebido e troco](troco-local-etapa-7l.md). Os limites anteriores descrevem o estado da etapa 7K.

Ampliar as condições de pagamento, começando por dinheiro recebido e troco, mantendo os mesmos controles de conferência e recuperação. Nenhuma publicação, cobrança, impressão física ou abertura de demonstração faz parte desta etapa.
