# Etapa 7H — venda local com baixa no estoque do servidor

Entrega no painel isolado de teste. A ponte usa o `StorageService` existente para registrar a venda no caixa local e o estoque V2 para descontar itens migrados. A tela operacional antiga, os meios de pagamento integrados e o perfil de produção não foram adaptados nesta etapa.

## Fluxo disponível

1. Migre o produto local conforme a etapa 7G e mantenha um turno aberto no servidor.
2. Em **Pagamentos e turnos → Venda local com estoque do servidor**, selecione o produto migrado e informe a quantidade na unidade de origem.
3. Clique em **Conferir venda**. Confira produto, quantidade e total; marque que recebeu o valor exato em dinheiro.
4. Clique em **Registrar venda local**.

O exemplo da demonstração utiliza farinha a R$ 0,02 por grama. Uma venda de 250 g totaliza R$ 5,00 e consome 0,250 kg do insumo migrado. A cópia local do saldo inicial não é reduzida novamente. Ela permanece como origem congelada da migração; o saldo atual é o do servidor.

Nesta versão a tela vende um produto por operação, sem fardo, desconto, troco, TEF ou emissão fiscal. Não há comando de estorno dessa nova venda local neste painel; o estorno do restaurante continua com seu fluxo próprio. Os itens migrados seguem bloqueados nos caminhos locais antigos que não passam pela ponte.

## Consistência

A referência da venda e seu conteúdo são preservados em uma pendência local antes da baixa. O servidor identifica a venda por terminal e ID, verifica a migração dentro da loja autorizada, converte a quantidade pela unidade de origem e desconta o saldo em uma transação. Outra solicitação com o mesmo ID e valores diferentes é recusada.

Vendas do restaurante e vendas locais utilizam os mesmos documentos de estoque. Em uma disputa pelo último saldo, apenas a operação que dispõe de quantidade suficiente pode concluir. Não é permitido saldo negativo.

Após a baixa remota, a ponte grava a venda pelo armazenamento real do PDV, conservando o comprovante do servidor e pulando a segunda baixa local. A receita aparece somente na venda local, não nos movimentos financeiros do restaurante. Assim, a conferência de caixa soma essa receita uma vez.

O servidor mantém uma contagem de baixas aguardando gravação local. O turno não pode ser encerrado enquanto essa confirmação estiver pendente. Depois da gravação, o cliente confirma a operação no servidor e remove a pendência local. Cada confirmação também aceita repetição.

## Falhas e retomada

Se a conexão cair ou uma escrita local falhar, use **Retomar venda pendente**. O mesmo ID e conteúdo são enviados. Isso cobre perda da resposta da baixa, falha durante a gravação da venda/turno e perda da confirmação final. Não se deve refazer a venda com outro ID nem apagar a pendência.

Uma recusa por saldo insuficiente não cria baixa parcial. A tentativa fica pendente para conferência e retomada; o cancelamento seguro de tentativas e o estorno dessa modalidade ainda precisam de fluxo próprio. Recuperação em outro computador e exclusão/perda completa do perfil também não são atendidas por este mecanismo.

## Validação e evidências

Testes locais utilizam o `StorageService` real, incluindo seu diário de gravação, para verificar recuperação após falhas e ausência de venda/baixa duplicada. Testes do servidor verificam repetição concorrente, conflito de conteúdo, isolamento de terminal, saldo insuficiente, bloqueio de encerramento e disputa pelo mesmo estoque entre os dois fluxos.

O teste visível migra a farinha, conclui o ciclo de restaurante, abre outro turno e registra a venda local de 250 g por R$ 5,00. Confere a receita local, o saldo remoto de 2,25 kg, a origem local intacta, ausência de movimento local duplicado e recarga sem pendência.

Arquivos no diretório `output` do workspace: `etapa-7h-local.log`, `etapa-7h-legado.log`, `etapa-7h-backend.log`, `etapa-7h-interface.log` e `etapa-7h/venda-local-estoque-servidor.png`.

## Próxima parte

Atualização: [etapa 7I](cancelamento-tentativa-etapa-7i.md) acrescenta cancelamento seguro de tentativas pendentes. O estorno de vendas locais concluídas continua separado, para a etapa seguinte.

Adicionar cancelamento seguro de tentativa e estorno da venda local com estoque compartilhado. Depois, ampliar carrinhos/formas de pagamento e adaptar a tela operacional antiga, com autenticação, sincronização e recuperação entre terminais. Nenhuma mudança desta etapa foi publicada.

Resultado final: **197 testes automatizados distintos aprovados** (79 de servidor, 41 locais e 77 legados), além do fluxo integrado visível. O arquivo adicional etapa-7h-ponte.log registra a revalidação de recuperação, ordem dos campos e recusa de precisão incompatível. Captura inspecionada; saldo remoto final de 2,25 kg, uma venda local de R$ 5,00 e nenhuma baixa local repetida. Nenhum deploy realizado.
