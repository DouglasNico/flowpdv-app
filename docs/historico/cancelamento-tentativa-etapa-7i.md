# Etapa 7I — cancelar tentativas de venda local

Continuação disponível: [etapa 7J — estorno integral da venda local](estorno-local-etapa-7j.md). Os limites descritos abaixo representam o estado da etapa 7I.

Continuação da ponte de estoque da etapa 7H, exclusivamente no ambiente de teste. O cancelamento de tentativa e o estorno de venda concluída foram separados: esta etapa entrega o primeiro. O estorno da nova modalidade local permanece para a próxima parte.

## Operação

Quando uma tentativa fica pendente, o painel **Fechamentos de teste** oferece retomá-la ou cancelá-la. Para cancelar, informe um motivo de 5 a 180 caracteres e confirme que a venda não foi concluída e que o dinheiro foi devolvido ao cliente, se recebido. É um registro manual; o sistema não devolve dinheiro automaticamente.

Se houve baixa remota, a transação devolve exatamente os consumos registrados na tentativa e libera a pendência do turno. Se a baixa nunca aconteceu, o cancelamento apenas registra a desistência. Em ambos os casos, a tentativa permanece marcada no servidor e uma solicitação atrasada não pode recriá-la. Não há nova venda local nem alteração dos valores do caixa.

A decisão fica salva no computador antes da chamada. Se a resposta se perder, recarregue e use **Retomar cancelamento**. O motivo original fica preservado e o estoque não é reposto outra vez. Enquanto não houver confirmação, o sistema mantém a pendência e bloqueia novas vendas pela ponte e o arquivamento local do caixa.

## Proteção da venda já gravada

O cancelamento não fica disponível se a venda já começou a ser escrita localmente ou se existe o diário de recuperação dessa escrita. Nessa situação, use **Retomar venda pendente** para concluir sua confirmação. O servidor também recusa cancelar vendas já confirmadas: a devolução exige estorno, que ainda não está disponível para essa modalidade.

Uma disputa entre baixa e cancelamento termina com a tentativa cancelada e sem perda de estoque. Uma disputa entre confirmação e cancelamento permite apenas uma dessas transições. A autorização continua restrita ao terminal de caixa ativo, dentro da loja e do turno original.

## Limites

- Continua sendo uma ponte de teste para um produto migrado, com recebimento manual do valor exato em dinheiro.
- O fluxo operacional antigo, carrinhos, descontos, pagamentos divididos e estorno da venda local ainda precisam de adaptação.
- A recuperação depende do perfil local preservado. Perda completa do perfil e recuperação em outro terminal não são atendidas nesta etapa.
- Cancelar uma tentativa não equivale a estornar uma venda concluída. O fluxo existente de estorno do restaurante permanece separado.

## Validação

Os testes cobrem cancelamento antes e depois da baixa, requisição atrasada, chamadas concorrentes, autorização, conteúdo divergente, estoque inconsistente, falha ao salvar a decisão e resposta perdida. O teste de interface usa uma janela oculta, exercita uma recusa por falta de estoque e uma falha simulada antes da gravação local, recarrega e cancela pelo formulário.

Evidências no diretório `output` do workspace: `etapa-7i-local.log`, `etapa-7i-backend.log`, `etapa-7i-interface.log`, `etapa-7i-validacao-final.log` e `etapa-7i/tentativa-cancelada.png`. Os dois logs intermediários conservam as falhas de preparação do turno e de inicialização do emulador; não são evidência de aprovação final.

Para repetir os seis cenários de cancelamento e o fluxo completo da interface oculta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pairing.ps1 -Cancelamento
```

O executor preserva as verificações e amplia apenas o prazo de descoberta das funções locais para 60 segundos quando não houver valor configurado. Restaura a variável ao sair. O modo `-Cancelamento` força a janela oculta mesmo se um teste anterior tinha sido configurado como visível.

Resultado final: **133 testes distintos aprovados**, somando 48 locais, 79 cenários existentes do servidor e os seis novos cenários de cancelamento reexecutados após corrigir a preparação do turno. Além deles, o fluxo integrado da interface oculta concluiu com código 0. A execução geral inicial registrou seis falhas de preparação; a reexecução final desses seis terminou sem falhas.

Na interface, permaneceram duas vendas locais (a venda fictícia do turno anterior e a venda de R$ 5,00 do turno atual). As duas novas tentativas foram canceladas: uma antes da baixa e outra após baixa com falha simulada antes da gravação local. O saldo remoto final da farinha foi 2,25 kg, a origem local continuou em 2.500 g, a pendência do turno ficou zerada e a conferência permaneceu em R$ 5,00. Os emuladores foram encerrados ao terminar; nenhuma demonstração foi reaberta.

Nenhuma publicação ou alteração da loja real faz parte desta etapa. Por preferência do usuário, não abrir demonstrações automaticamente; somente quando solicitado.
