# Etapa 7J — estorno integral da venda local

Continua a ponte das etapas 7H e 7I, exclusivamente no perfil isolado de teste. Acrescenta devolução integral das vendas locais em dinheiro, com ajuste do caixa e opção de reposição do estoque.

## Como utilizar

Em **Fechamentos de teste → Estornar venda local**, selecione uma venda deste terminal, informe o motivo e escolha se o produto retornou em condição de venda. Confirme que o valor integral já foi devolvido em dinheiro ao cliente e registre o estorno. O sistema registra a devolução manual; não executa transferência nem cobrança externa.

O estorno pertence ao turno atualmente aberto. A venda original permanece registrada e o fechamento anterior não é reescrito. Se a venda foi de R$ 5,00 em um turno anterior, esse turno conserva a receita original e o turno da devolução recebe um ajuste de -R$ 5,00. A conciliação, o calculador real do caixa e a exportação Excel incluem o ajuste uma vez. O Excel oferece a aba **Estornos locais**, com turno da devolução, venda, turno original, valor negativo, reposição, motivo e comprovante.

Só as vendas desta ponte, em dinheiro e pertencentes ao terminal atual, podem ser selecionadas. Tentativas não concluídas devem ser recuperadas ou canceladas pelo fluxo da etapa 7I. Não há estorno parcial, devolução por outro terminal nem devolução automática de Pix/cartão nesta etapa.

## Estoque e recuperação

O servidor utiliza os consumos registrados na venda, em vez de recalcular pela ficha atual. Se a reposição estiver marcada, devolve esses consumos uma vez; caso contrário, conserva o saldo consumido. O motivo, o turno e a decisão de reposição não podem mudar em uma repetição da mesma operação.

Antes da chamada, a intenção é gravada no perfil local. O servidor registra o estorno e mantém uma pendência no turno enquanto aguarda a gravação do ajuste local. O cliente grava o comprovante no turno atual, confirma essa gravação no servidor e remove a intenção pendente. Repetir o fluxo não incrementa o estoque ou o ajuste novamente.

Se a conexão cair, uma escrita falhar ou o aplicativo reiniciar, use **Retomar estorno pendente**. Não devolva o dinheiro novamente. Novas vendas pela ponte e o encerramento local ficam bloqueados enquanto a recuperação não terminar. O servidor também impede encerrar um turno com ajuste ainda não confirmado.

Um estorno pendente não pode ser abandonado ou trocado por outro motivo: a devolução manual já foi confirmada. Caso haja inconsistência de estoque ou de vínculo, corrija a causa e retome a operação original. Perda completa do perfil ou recuperação em outra máquina ainda exigem uma etapa própria.

## Validação

Os testes locais usam o armazenamento e o calculador reais. Cobrem resposta perdida, falha ao gravar o turno, confirmação perdida, falha ao limpar a intenção, perfil normal, histórico preservado, Excel e saldo negativo sem ocultar diferença de caixa. Os testes do servidor cobrem chamadas concorrentes, autorização, decisão imutável, venda pendente/cancelada, falta de integridade do estoque, confirmação e estorno em turno posterior.

O teste da interface roda oculto: vende 250 g de farinha por R$ 5,00, cancela tentativas de teste, encerra o turno com R$ 15,00 (R$ 10,00 de fundo e R$ 5,00 de venda), abre outro turno e estorna a venda com reposição. Recarrega para verificar persistência do ajuste sem duplicação.

Evidências no diretório `output` do workspace: `etapa-7j-local.log`, `etapa-7j-estorno-local.log`, `etapa-7j-relatorios.log`, `etapa-7j-legado.log`, `etapa-7j-backend.log`, `etapa-7j-interface.log` e `etapa-7j/estorno-local.png`.

Resultado final: **205 testes distintos aprovados** — 56 locais (48 existentes e oito de estorno), 72 do servidor e 77 legados (51 de núcleo e 26 de TEF simulado). As reexecuções de relatórios estão incluídas nessa contagem, sem contar o mesmo teste duas vezes. O fluxo completo da interface oculta terminou com código 0 e sua captura foi inspecionada.

Conferência final: três turnos no servidor, dois encerrados e um aberto; uma venda local estornada e duas tentativas canceladas; estoque remoto da farinha em 2,5 kg; saldo de origem local preservado em 2.500 g; histórico anterior idêntico; ajuste único de -R$ 5,00 no novo turno; nenhuma pendência de estorno ou nova baixa local. Os emuladores foram encerrados ao final. Nada foi publicado e nenhuma demonstração foi reaberta.

## Próxima parte

Continuação: [etapa 7K — carrinho com vários produtos](carrinho-local-etapa-7k.md).

Ampliar a ponte de venda para carrinho com vários produtos, mantendo os mesmos cuidados de quantidade, estoque compartilhado e recuperação. Formas de pagamento, descontos e troco ainda precisam de evolução, assim como a integração à tela operacional antiga. Nada desta etapa autoriza produção ou utiliza cobrança/impressão real.
