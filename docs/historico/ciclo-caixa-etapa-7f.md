# Etapa 7F — encerrar caixa e abrir o próximo turno

Somente no painel local de teste. A loja real, sua licença e os serviços de produção não são utilizados.

## Como usar

1. Em **Pagamentos e turnos**, confira e encerre o turno do restaurante no servidor.
2. Incorpore o resumo encerrado. Ele mantém itens, adicionais, pagamentos e estornos.
3. Em **Encerrar caixa e abrir próximo turno**, informe o dinheiro total contado na gaveta e marque a conferência.
4. Clique em **Arquivar caixa conferido**. O histórico mostra esperado, contado e diferença. Uma diferença é registrada, não descartada.
5. Informe o fundo separado para o próximo turno, confirme e clique em **Abrir próximo turno**. O sistema aguarda a confirmação do servidor antes de liberar pagamentos.

O dinheiro anterior não é transferido automaticamente. O fundo informado pertence ao restaurante e não é duplicado como fundo local. A demonstração inicial ainda utiliza um turno fictício previamente preparado; a interface permite seguir com os próximos turnos sem editar dados manualmente.

## Persistência e recuperação

O fechamento consulta novamente o resumo encerrado do servidor, confere o histórico local e usa o calculador do caixa existente. Arquiva o retrato do turno e remove o turno ativo, preservando todas as vendas. Não executa sincronização, impressão, cobrança ou novas movimentações de estoque.

As gravações locais usam um registro de recuperação. Uma interrupção entre a gravação do histórico e a remoção do turno é concluída na retomada, sem inserir o turno novamente. Se os dados locais divergirem do estado esperado, a recuperação recusa a substituição silenciosa.

A abertura salva sua referência antes de chamar o servidor. Se a resposta se perder, o estado fica **Abertura pendente** e o botão **Retomar abertura pendente** envia o mesmo ID e fundo. O servidor já garante a abertura idempotente e um turno ativo por terminal. Turnos pendentes não são reconhecidos como abertos pelo serviço de armazenamento do PDV. As ações do painel usam uma trava entre janelas para serializar as operações locais.

Esta recuperação depende de conservar o perfil local; não é backup contra perda do computador ou exclusão dos dados. Recuperação em outro dispositivo e sincronização continuam pendentes.

## Validação

Testes específicos cobrem diferença de caixa, preservação de vendas, ausência de transferência automática, gravações interrompidas, resposta de abertura perdida, falha local após confirmação do servidor, retomada com o mesmo ID e recusa de conflitos/perfil real.

O teste visível executa o fluxo completo anterior e acrescenta arquivamento com diferença, recarga sem turno ativo, abertura com fundo próprio, nova recarga e conferência zerada no novo turno. O histórico antigo continua com seus valores originais. As evidências ficam em `output/etapa-7f-local.log`, `output/etapa-7f-legado.log`, `output/etapa-7f-interface.log` e `output/etapa-7f/novo-turno-historico.png` no workspace.

## O que falta

A próxima parte é a migração conferida dos saldos de estoque e unidades, garantindo uma fonte de saldo consistente entre os fluxos. Também seguem pendentes autenticação legada, recuperação/sincronização, testes com equipamentos reais e o piloto/publicação. O ciclo entregue aqui ainda é de homologação local.

Resultado: **110 testes automatizados aprovados nesta etapa** (33 locais e 77 do fluxo antigo), além do fluxo integrado visível com os serviços locais. Captura inspecionada: caixa anterior com R$ 5,00 esperados, R$ 4,00 contados e diferença de -R$ 1,00; próximo turno com fundo de R$ 10,00 e nenhum movimento. Nenhum deploy realizado.

Continuação: [Etapa 7G — migração conferida do estoque](migracao-estoque-etapa-7g.md). Entrega a importação inicial com conversão de unidades e proteção dos itens migrados no perfil local; a venda do fluxo antigo usando o saldo do servidor segue pendente.
