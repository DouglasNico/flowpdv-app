# Etapa 7V — suspensão de novos pedidos e vendas

Implementação local, sem publicação. A política da ativação agora é aplicada dentro das transações de criação de pedido público, fechamento de atendimento e baixa de estoque de venda local.

## Comportamento

Para lojas que possuem `ativacaoOperacionalV2`, novas operações exigem configuração válida de homologação habilitada. Suspensão, configuração nula/inválida, versão desconhecida ou ambiente de produção bloqueiam essas três entradas. A consulta da tentativa já registrada e a conferência de seu conteúdo ocorrem antes desse bloqueio.

- Pedido público já aceito: reenvio do mesmo usuário, identificador e conteúdo recupera o pedido original. Um identificador novo é recusado durante suspensão.
- Atendimento já fechado: o mesmo fechamento retorna o resultado existente; outro fechamento sem venda registrada é recusado, mesmo que a conta tenha sido aberta antes da suspensão.
- Venda local com baixa já aceita: a tentativa original recupera o recibo; confirmar a gravação ou cancelar a tentativa continua possível com as validações anteriores. Outra venda não baixa estoque.
- Cancelamentos, estornos, acompanhamento, recebimento/preparo de pedidos existentes e controles de turno mantêm suas regras atuais. Suspensão não é desativação da loja nem revogação da identidade.
- Terminal revogado continua recusado nos fluxos privados, inclusive ao tentar recuperar venda existente. Não há exceção de autenticação.

A política lê o documento da loja na mesma transação das novas gravações. Alterar a suspensão concorre com essa leitura, evitando uma decisão baseada apenas em autorização previamente carregada na interface.

## Transição explícita

Lojas anteriores **sem o campo** mantêm o comportamento anterior. Esse é um caminho de compatibilidade temporário, não autorização para ativar o aplicativo normal. Já um campo presente porém nulo ou malformado é recusado.

`adminCriarLojaV2` agora provisiona lojas novas com homologação suspensa, revisão 1. A primeira habilitação usa o comando administrativo e a revisão 1. Lojas anteriores sem configuração usam revisão zero para aderir. Depois da adesão, não remover o campo para contornar a suspensão; clientes não têm permissão de escrita direta nesse documento.

O inventário e a adesão das lojas anteriores são pendências da migração. Não anunciar que toda loja V2 está bloqueada por padrão enquanto existir essa compatibilidade. A consulta de capacidades da etapa 7T continua retornando desabilitada para uma loja sem configuração; as APIs antigas preservam sua compatibilidade até a adesão explícita.

## Limites

Não existe bloqueio universal de todas as funções: o escopo desta etapa são as três entradas de pedidos/vendas. Abertura de turno, configuração e operações de pedidos existentes não foram bloqueadas. A interface administrativa e o aplicativo normal ainda não consomem o controlador novo. Nenhum dado real foi migrado e a produção não foi habilitada.

## Validação

Testes nos emuladores verificam pedido novo recusado, reenvio recuperado, reativação, fechamento suspenso sem baixa, estorno após suspensão, terminal revogado, recibo local recuperado, confirmação da gravação, cancelamento idempotente e ausência de nova baixa. Teste local verifica configuração inválida, suspensão e compatibilidade da ausência do campo.

Evidências: `output/etapa-7v-local.log` e `output/etapa-7v-backend.log`. Resultado final: 112 testes de servidor/regressão e um teste local passaram (113 no total), sem falhas. A primeira execução detectou um turno deixado aberto pela preparação de um novo teste; após incluir seu encerramento, a suíte completa passou com código 0. A suíte de pareamento também confirma que novas lojas nascem suspensas. Nenhuma interface foi aberta.

## Próxima parte

Conectar consulta e comando administrativo à interface de homologação, exibindo estado/revisão e atualização após conflito. Depois integrar o controlador ao aplicativo, com mensagens de suspensão e recuperação. A liberação real continua dependente do roteiro da etapa 7S.

Painel implementado na [etapa 7W](painel-ativacao-etapa-7w.md).
