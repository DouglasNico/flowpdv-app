# Etapa 7D — resumo encerrado do restaurante no caixa antigo

Entrega restrita ao perfil local de teste. Não houve publicação nem alteração da loja real.

## Resultado

O servidor disponibiliza um resumo somente após o turno V2 estar encerrado. Antes de retorná-lo, confere todos os movimentos do turno (até 500), suas formas de pagamento, total e quantidade contra os acumuladores transacionais. Não apresenta uma soma parcial como completa; inconsistências impedem a incorporação.

Em **Pagamentos e turnos**, o botão **Incorporar resumo encerrado ao caixa de teste** grava esse resumo no turno local correspondente. Valida ID, dispositivo, abertura, totais e versão; repetir o mesmo resumo é inofensivo. Um resumo diferente não substitui o anterior silenciosamente. Não grava vendas, produtos, movimentos de estoque ou backups.

O cálculo central `CaixaModule.calcularResumoFinanceiro` agora soma esse resumo no perfil de teste. Inclui recebimentos líquidos e devoluções, mantém cartão V2 genérico como **cartão a classificar** e soma o fundo adicional do restaurante uma única vez. Se os fundos representam o mesmo dinheiro físico, não devem ser informados duas vezes: esta etapa trata os fundos declarados como distintos. O saldo negativo não é escondido por um arredondamento para zero.

A quantidade de vendas conta os recebimentos; estornos permanecem separados. O total financeiro é líquido. O detalhe de produtos/vendas permanece em cada origem: a integração é por resumo, não por duplicação dos documentos de venda.

## Caixa, relatórios e impressão

- O fechamento antigo, quando chamado no perfil de teste, exige o resumo incorporado antes de prosseguir. O fluxo normal não recebe esse bloqueio.
- O histórico local conserva o resumo anexado ao turno, permitindo recalcular após recarga.
- O relatório de turno inclui o total consolidado, cartão a classificar, fundo adicional e indicação de que as abas de itens/vendas detalham apenas o fluxo local.
- A exportação do histórico inclui uma aba **Restaurante por turno**, com recebimentos, estornos, líquido, cartão não classificado e fundo adicional. As colunas antigas mantêm suas posições.
- O detalhe de turno e o modelo de cupom de fechamento identificam as novas parcelas. A impressão física permanece bloqueada.

A demonstração usa o painel próprio de teste. A incorporação chama o calculador real do caixa antigo, mas não abre automaticamente a interface operacional antiga nem executa seu fechamento, exportação ou impressão. As exportações foram verificadas em teste com ExcelJS: geração e leitura dos arquivos em memória, sem publicar documentos.

## Proteções e limites

O cálculo normal ignora a incorporação experimental. Não existe ainda migração de saldo de estoque nem adoção desse mecanismo em produção. A cópia do resumo local não é uma nova fonte autenticada para todo o sistema: antes da publicação, precisa integrar recuperação, sincronização e os acessos legados.

O relatório detalhado por produto ainda precisa da integração das linhas V2; não se deve interpretar a aba de itens locais como uma lista de todos os itens do restaurante. Também continuam pendentes a abertura de um próximo turno pela interface integrada, a migração de saldos/unidades, a autenticação legada e a homologação de equipamentos.

## Validação

Evidências na pasta principal do workspace:

- `output/etapa-7d-interface.log` e `output/etapa-7d/resumo-incorporado.png`: teste visível, mesma incorporação repetida, quantidade local preservada e leitura pelo calculador antigo.
- `output/etapa-7d-exportacao.log`: soma positiva, saldo negativo após estorno, recusa de conflitos, recarga, planilha do turno e planilha do histórico.
- `output/etapa-7d-local.log`, `output/etapa-7d-legado.log` e `output/etapa-7d-backend.log`: regressões e autorização/consistência do servidor.

Resultados finais abaixo após a execução. O próximo trabalho continua sendo a integração completa do ciclo operacional e a migração conferida de estoque; a etapa 8 de publicação/piloto ainda não foi iniciada.

Resultado final: **74 testes de servidor, 24 testes locais (incluindo exportações) e 77 testes do fluxo antigo aprovados**, além do fluxo integrado visível. As planilhas foram geradas e relidas em memória para conferir os valores; a captura da incorporação foi inspecionada. Não houve deploy. Total: 175 testes automatizados distintos, sem contar repetições de verificação.

Continuação: [Etapa 7E — itens, adicionais e estornos nos relatórios](itens-relatorios-etapa-7e.md). A limitação do detalhamento por produto descrita acima foi tratada nessa etapa, somente no perfil de teste.
