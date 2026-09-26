# Diagnóstico financeiro na recuperação — etapa 8S

A consulta de histórico agora apresenta tanto diferenças de vendas locais quanto diferenças nos resumos do restaurante. Funciona no perfil atual e no arquivo selecionado. Identifica turno sem registro, resumo encerrado ausente, resumo divergente, fundo de troco diferente e fechamento local sem encerramento remoto.

As respostas continuam sendo descartadas se o usuário trocar o arquivo, a sessão ou os dados locais durante a consulta. A ação é somente leitura e não libera o perfil para operar. Sangrias, contagem consolidada e contas abertas continuam explicitamente fora do resultado de conferência.

## Evidências

- Fluxo completo da interface aprovado em `output/etapa-8s-interface.log`, incluindo clássico/moderno, pagamentos divididos, suspensão/retomada, inventário, cópia recuperada, transferência de terminal, pedidos, cozinha e fechamento.
- Caso novo: arquivo perde um resumo encerrado; a consulta identifica a ausência e mantém os resumos do histórico local. Marcador `FECHAMENTOS RECUPERACAO UI PASS`.
- Capturas `output/etapa-8s/historico-1366.png` e `historico-1024.png` inspecionadas, sem transbordamento horizontal do diálogo. Janelas ocultas durante toda a execução.
- Bundle compilado em `output/etapa-8s-bundle.log`.

## Próxima dependência

Conferir a contagem consolidada e os movimentos legados; definir recuperação suportada para turnos fechados/ausentes, contas abertas e pendências do perfil instalado. Só então estabelecer a política de liberação e integrar ao login normal. O diagnóstico atual não atesta esses itens nem deve ser tratado como aprovação automática para produção.
