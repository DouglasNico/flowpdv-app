# Etapa 7Y — suspensão com venda pendente na interface

Ampliação do teste completo em Electron oculto. Dados fictícios, Auth/Firestore/Functions locais; sem publicação, cobrança ou impressão física. Esta etapa valida os mecanismos existentes e não libera produção.

## Cenários acrescentados

### Cancelar após baixa aceita

O teste provoca falha na gravação local depois da baixa remota, preserva a tentativa original e usa o painel gerencial para suspender a homologação. Confere bloqueio dos controles de nova venda e disponibilidade da retomada. Recarrega o aplicativo, cancela pela interface com motivo e confirmação e reativa a loja pelo painel.

O caixa deve conservar a contagem de vendas anterior; a tentativa não pode virar receita. O runner verifica no servidor os registros cancelados e a devolução de estoque, além de ausência de baixas pendentes no turno.

### Concluir após baixa aceita

Na venda final de dois produtos, com ajuste e pagamento dividido, o teste interrompe a gravação local após o servidor aceitar a baixa. Suspende pelo painel, recarrega o aplicativo e abre a pendência pelo F4 do clássico. Confere que a identidade é a mesma e que o formulário de nova venda está oculto.

Retoma a tentativa, verifica uma única venda local com o ID original e tenta repetir o comando para confirmar que não surge outra venda. Depois reativa pelo painel. O runner mantém suas verificações finais de estoque remoto, registros de venda e caixa, sem relaxar os totais esperados.

## Cobertura e limites

A falha é injetada no método de gravação local; não é um desligamento físico do computador. A recarga reinicializa o aplicativo e restaura a implementação normal antes da retomada. Autorização e persistência remotas continuam sendo exercitadas nos emuladores.

O cenário de terminal revogado existente no fluxo geral continua sendo executado; ainda não equivale a revogar um terminal com essa mesma pendência e recuperá-la por outra identidade. Recuperação administrativa em outro computador permanece na frente de migração/backup.

A captura do clássico da etapa 7X também é repetida pelo fluxo completo, agora aguardando a pintura da tela antes de capturar.

## Resultado

Execução: `scripts/test-pairing.ps1 -Interface`, com `FLOWPDV_VISIBLE_TEST=0`. Evidência: `output/etapa-7y-interface.log`. Fluxo completo de interface e verificações finais no servidor passaram com código 0. O log registra `SUSPENSAO CANCELAMENTO UI PASS` e `SUSPENSAO RETOMADA UI PASS`: cancelamento com devolução de estoque, conclusão com identidade original, repetição sem venda extra e reativação. Os totais finais de caixa, estoque e registros remotos permaneceram conforme o esperado, sem baixas pendentes no turno.

Capturas do aviso de desconexão: `output/etapa-7x`. A captura do clássico foi repetida e inspecionada: apresenta os dois itens preservados, aviso de desconexão, controles bloqueados e acesso ao F4. A pendência visual da etapa 7X está encerrada. Não foi executada uma nova bateria de testes unitários nesta etapa.

## Próxima parte

Mapear e extrair os serviços de sessão e autorização do painel de laboratório para um perfil operacional de homologação, preservando os bloqueios de rede, impressão, fiscal e cobrança do teste. A frente 1 do plano completo permanece em andamento.

Continuação: a [etapa 7Z](servicos-homologacao-etapa-7z.md) separou a criação das sessões e o monitor de autorização das telas, com testes locais e fluxo completo oculto aprovados. O ciclo de autenticação/vínculo e a integração operacional ainda estão pendentes.
