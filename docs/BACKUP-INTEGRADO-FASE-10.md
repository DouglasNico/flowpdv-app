# Fase 10 — proteção da base e recuperação em perfil novo

## Alterações e execução

- `test/backup-protecao-integrada.cjs`: executa módulos reais do bundle após vendas/caixa no Electron e confere recusa de importação legada, troca de loja, carregamento legado e restauração da nuvem. Confere preservação dos registros locais e aviso na interface.
- `test/aplicativo-completo-ui.cjs`: inclui essa verificação no fluxo de venda nativa.
- `test/run-recuperacao-integrada.cjs`: executa venda completa/proteções e depois o ensaio existente de conferência/instalação em perfil novo.
- `scripts/test-venda-integrada.ps1 -RecuperacaoPerfil`: seleciona esse fluxo nos emuladores locais.

## Resultados

Execução concluída com código 0. Evidência: `output/recuperacao-integrada-fase10.log` na raiz do workspace.

O ensaio de perfil novo confirmou identidade própria, revogação da origem, estoque preservado, bloqueio após recarga, recusa de rotinas legadas e consulta paginada de 55 contas (50/5) e um pedido pendente. Os 4 testes de consultas de pendências também passaram. O fluxo nativo anterior confirmou 3 vendas locais, delivery/garçom/cancelamento/estorno e caixa conciliado.

## Limites

Perfis isolados neste computador e dados fictícios. A instalação/conferência de recuperação usa o painel de homologação; não comprova outro equipamento físico nem liberação operacional final. Inventário real, movimentos posteriores ao corte, conferência independente e liberação do perfil continuam pendentes no plano mestre.
