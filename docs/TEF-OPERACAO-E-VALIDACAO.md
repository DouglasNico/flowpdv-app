# TEF opcional — operação e validação

Alterações locais sobre a versão 3.2.26, em 14/09/2026. Não houve publicação de release nem transação financeira real durante o desenvolvimento.

## Escolha do cliente

- **Manual (padrão):** deixar a integração desativada. Receber na maquininha, conferir a aprovação e então lançar Débito/Crédito no PDV. Não há comunicação com a adquirente nesse modo.
- **Stone Connect:** habilitar com chave da conta e serial da maquininha deste caixa. Credenciamento Connect, permissões e demais parâmetros da conta devem ser fornecidos pela Stone.
- **SiTef:** habilitar no aplicativo Windows com DLL de 64 bits, servidor, loja de oito dígitos, terminal e pinpad configurados pelo fornecedor. Testar a conexão antes da primeira venda.

O simulador não pode autorizar vendas reais. A integração continua condicionada ao módulo TEF da licença. Não há mudança automática para confirmação manual após erro de comunicação.

## Pagamento e gravação

1. Registrar a intenção de pagamento e a referência da venda no diário local do terminal, antes do envio.
2. Aguardar a autorização e conferir o valor em centavos. Cobranças parciais ou com resultado incerto não quitam a parcela.
3. Gravar venda, estoque, movimentos, turno e fiado em um diário de recuperação local. Uma retomada aplica os mesmos valores finais, sem repetir o desconto de estoque.
4. Confirmar o SiTef ou encerrar o pedido Stone depois da gravação da venda. Uma falha permanece disponível em **Pendências TEF**; a mensagem informa que a venda já foi gravada e não deve ser cobrada novamente.

No SiTef, o retorno local da função de finalização não é uma consulta independente ao host da adquirente: a função nativa é `void`. A confirmação financeira deve ser conferida na homologação e conciliação do fornecedor.

## Recuperação de falhas

- Não cobrar novamente quando o resultado for incerto. Abrir **Pendências TEF** na tela de pagamento ou de configuração.
- **Consultar / concluir:** consulta Stone, recupera uma gravação local interrompida e retoma a confirmação de uma venda já gravada.
- **Recuperar no caixa:** restaura os itens e pagamentos integrados autorizados, no turno original. Conferir e relançar os pagamentos manuais; eles não são presumidos recebidos na recuperação.
- **Estornar:** disponível ao gerente para pagamentos cujo fechamento ainda não foi gravado. O programa mantém a pendência se a solicitação falhar ou a resposta não comprovar o estado esperado.
- Sem ID de pedido Stone, o reenvio automático usa o mesmo payload e chave idempotente somente durante quatro minutos, margem conservadora para ambientes com prazo curto. Depois disso, localizar o pedido na Stone e informar seu ID: o programa confere o código e o valor antes de vinculá-lo. Ausência de resultado não é prova de ausência de cobrança.
- O estorno de uma venda já concluída continua sendo um procedimento administrativo de cancelamento e conciliação com a adquirente. O botão de pendências não altera uma venda gravada para simular um reembolso.
- Não apagar dados do aplicativo nem trocar de licença com pendências. Resolver a operação antes de fechar o turno. O diário é local ao terminal; perda do disco ou limpeza dos dados exige conciliação com o fornecedor.

## Verificação técnica

Executar `npm test` e `npm run bundle`. Foram acrescentados testes isolados em `test/tef-tests.cjs`, incluindo gravação interrompida, valores divergentes, idempotência, concorrência, estorno sem confirmação, integração com a finalização do caixa e cancelamento durante uma chamada nativa simulada.

Os testes usam memória, HTTP, impressora e DLL substituídos por adaptadores falsos. Eles não verificam credenciamento, operação física do pinpad, papel impresso, conectividade da loja nem liquidação financeira.

Resultado local: 46 testes existentes e 26 testes TEF aprovados (72 no total), compilação do bundle concluída e verificação de sintaxe da ponte SiTef aprovada. O atalho `npm` deste ambiente apontava para um `npm-cli.js` ausente; por isso os scripts foram executados diretamente com Node, sem alterar a instalação do computador.

## Validação necessária antes de liberar TEF real

Com o fornecedor e um ambiente autorizado, executar e conferir no PDV e no painel da adquirente:

1. Débito, crédito e venda dividida entre cartão e dinheiro: valor exato, um registro de venda, um desconto de estoque e comprovantes corretos.
2. Recusa, cancelamento pelo operador, perda de conexão e queda do aplicativo após autorização: recuperar ou estornar, sem cobrança duplicada.
3. Falha de impressão SiTef e falha de finalização: conferir pendência no host e sua resolução. Validar a DLL efetivamente instalada e seu comportamento com chamadas assíncronas serializadas.
4. Reinício do aplicativo antes e depois da gravação local; conferir venda, turno, fiado e estoque, inclusive sincronização entre terminais.
5. Cancelamento administrativo de venda concluída e conciliação dos comprovantes com o fornecedor.

## Referências

- [SiTef: confirmação ou não do pagamento](https://dev.softwareexpress.com.br/docs/clisitef/confirmacao_ou_nao_pagamento/)
- [Pagar.me: idempotência](https://docs.pagar.me/docs/o-que-%C3%A9)
- [Pagar.me: cobranças](https://docs.pagar.me/reference/cobran%C3%A7as-1)
- [Koffi: chamadas assíncronas](https://koffi.dev/load)

Estas mudanças tratam o fluxo de TEF e sua gravação. Não equivalem à correção integral dos demais itens da auditoria do sistema.
