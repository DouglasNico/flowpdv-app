# Etapa 7C — painel sem licença e turnos do restaurante no servidor

## Entrada local corrigida

O perfil `--flowpdv-test` agora abre um painel próprio da loja fictícia. Não inicializa o licenciamento, login, sincronização e integrações do fluxo antigo. O pareamento V2 e seus controles de autorização continuam obrigatórios. A chave oferecida pelo usuário não foi utilizada, armazenada ou copiada para código, dados ou relatório.

O perfil normal segue pelo caminho existente; o executável instalado continua recusando o perfil de desenvolvimento. O painel de teste preserva a faixa de ambiente isolado e os bloqueios de rede externa, impressão física, cobrança e fiscal. Os botões permitem acessar pedidos, cozinha, pagamentos/turnos, configuração e pareamento.

## Ciclo de turno V2

Nas lojas com `caixaV2.exigirTurno: true`, abrir turno é uma operação autenticada de caixa no servidor. A demonstração habilita essa configuração na loja fictícia. O turno guarda referência local, terminal autenticado, fundo de troco, total líquido, distribuição por forma de pagamento, número de movimentos e revisão.

Há no máximo um turno aberto por terminal. A mesma abertura pode ser repetida sem criar outro turno; fundo diferente é recusado. Uma referência já encerrada não reabre. Referências da etapa anterior que já possuem movimentos declarados são recusadas para adoção automática: precisam de conciliação de migração.

O pagamento e o estorno atualizam o turno na mesma transação dos seus movimentos financeiros e de estoque. Se o turno não estiver aberto ou não for o corrente do terminal, um novo lançamento é recusado. A repetição de uma operação já efetivada continua recuperando o resultado, sem nova baixa.

Encerrar exige revisão conferida, confirmação e dinheiro contado. O servidor calcula o esperado (fundo inicial + dinheiro líquido V2), registra a diferença e libera o terminal para outro turno. Uma venda concorrente e o encerramento não podem ambos usar uma revisão antiga: a transação revalida e exige nova conferência quando necessário.

A devolução em turno posterior gera valor negativo nesse novo turno e preserva o resumo do turno original, já encerrado. Nesta versão, as formas de devolução seguem as formas da venda; devolver por outro meio ainda necessita fluxo específico.

## Tela

Em **Pagamentos e turnos**, a seção **Turno do restaurante no servidor** permite confirmar abertura do turno local, consultar e encerrar. Após vender ou estornar, consulte novamente antes de encerrar; uma revisão antiga é recusada. O resultado informa status, valores líquidos, dinheiro esperado e diferença no encerramento.

A conferência da etapa 7B continua somando vendas locais e movimentos V2 para comparação. Os valores do turno servidor referem-se somente ao restaurante; não incluem as vendas locais, sangrias, suprimentos ou o fechamento antigo.

## Limites e continuidade

- Não foi feita migração da abertura/fechamento antigo para o servidor, nem substituição dos relatórios/exportações oficiais antigos. Essa integração continua pendente.
- O turno local fornece a referência, mas o servidor passa a decidir se ela está aberta para movimentação V2 quando o controle está habilitado. A configuração é privada de provisionamento; ainda não há botão de migração na administração.
- Lojas sem a configuração preservam a compatibilidade anterior; não devem ser consideradas migradas.
- O encerramento não cancela pedidos ou contas em andamento. Outro turno autorizado poderá recebê-los. O cardápio pode continuar recebendo pedidos mesmo com o caixa encerrado.
- Para começar outro turno, é necessária uma nova referência local. A demonstração reiniciada cria uma sessão fictícia nova; a integração do ciclo completo do caixa antigo virá na continuação.
- O estoque V2 permanece separado do estoque antigo. Não houve alteração de saldo real, ativação de licença, deploy, cobrança, fiscal ou impressão física.

## Verificação

O fluxo de interface é visível desde o início. Verifica ausência da tela de ativação, abertura no servidor, pagamento, conferência de R$ 17,50 (R$ 5,00 locais + R$ 12,50 restaurante), estorno, conferência de R$ 5,00 e encerramento V2 com diferença zero.

Testes do servidor cobrem ausência de abertura, idempotência, fundo divergente, turno simultâneo, nova venda após encerrar, disputa entre venda e encerramento, estorno em outro turno e recusa de adoção de referências antigas.

Evidências na pasta principal: `output/etapa-7c-local.log`, `output/etapa-7c-legado.log`, `output/etapa-7c-interface.log`, `output/etapa-7c-backend.log`, `output/etapa-7c/turno-encerrado.png` e `output/demo-local/pdv.png`. Resultados finais abaixo após a execução.

**Resultado final:** 73 testes de servidor, 20 testes locais, 51 testes do núcleo antigo e 26 de TEF simulado aprovados, além do fluxo integrado de interface visível. A captura do turno encerrado foi inspecionada. O teste confirmou que a tela de ativação legada não existe no painel isolado. Após o ajuste do comando de saída, a guarda confirmou novamente que o painel não altera o DOM no perfil normal. A demonstração final utiliza esse código atualizado.


Continuação entregue no perfil de teste: [Etapa 7D — resumo encerrado no caixa antigo](resumo-caixa-etapa-7d.md). O cálculo central e os resumos de exportação passam a incorporar o turno V2 encerrado sem regravar vendas. Detalhamento por produto e migração de estoque continuam pendentes.
