# Fase 6 — acesso revogado e recuperação de venda

## Alterações

- `src/js/fechamento-teste.js`: botão Reconectar histórico reinicia a consulta autorizada após uma interrupção de acesso; erro do observador orienta a recuperação. Não repete cobranças nem altera registros de venda. Bundle recompilado.
- `test/revogacao-venda-pendente-ui.cjs`: desativa o membro fictício com uma confirmação local pendente, confere preservação do diário/vendas/estoque, restaura a autorização e usa os controles de reconexão de pedidos e histórico.
- `test/venda-aplicativo-completo-ui.cjs`: aciona o cenário opcional por `FLOWPDV_REVOKED_SALE_TEST=1`.
- `scripts/test-venda-integrada.ps1 -Revogacao`: executa emuladores locais e ensaio Electron, restaurando variáveis de ambiente ao terminar.
- `test/alimentacao-aplicativo-completo-ui.cjs`: confere que delivery ainda não pago pode sair para entrega e receber pagamento depois, conservando o estado da entrega; segue com entrega, estorno e conciliação do turno.

## Validação

13 testes de venda e recuperação local aprovados; bundle compilado. Ensaio integrado concluído com código 0: revogação/retomada, três vendas confirmadas sem duplicação, fechamento e reabertura, delivery pago após saída, garçom com reenvio, estorno com devolução de estoque e conciliação final. Evidência: `../output/venda-revogacao-integrada.log`, na raiz do workspace.

As duas primeiras execuções localizaram observadores encerrados pela revogação: pedidos exigia acionar Reconectar; histórico não oferecia controle equivalente, agora incluído. Não enfraquecemos as regras de acesso para contornar os erros.

## Limites

Ambiente fictício local, sem cobrança ou publicação. Revogação testada por desativação do membro; não comprova troca física de equipamento, migração de identidade nem revogação definitiva do dispositivo. Permanecem os demais cenários do plano mestre.
