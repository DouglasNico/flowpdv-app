# Delivery — confirmação pública e dados privados

`criarPedidoPublicoV2` passa a aceitar `tipo: delivery`, além de mesa/retirada. Esta entrega é da API local; as [telas do cardápio](delivery-telas-cardapio.md) foram integradas na entrega seguinte.

## Contrato

Além de slug, requestId, catálogo e itens, enviar:

- `entrega`: nome, telefone nacional com DDD, CEP, logradouro, número, complemento opcional, bairro, cidade e UF.
- `cotacao`: `configuracaoVersao`, `taxaEntregaCentavos` e `totalCentavos` conferidos pelo cliente na cotação.

O servidor normaliza os dados, confere a versão do catálogo e da configuração, recalcula produtos/adicionais, área, mínimo e taxa usando o CEP da entrega. Total/taxa diferentes ou configuração alterada exigem nova cotação. A checagem valida formato e faixa de CEP; não comprova correspondência geográfica entre rua, cidade e CEP.

Pedido, contato/endereço, idempotência e acompanhamento são gravados na mesma transação. Repetir a mesma requisição na mesma sessão recupera o pedido anterior, inclusive depois de pausa da loja. Trocar endereço mantendo a mesma chave é recusado, em vez de alterar silenciosamente o destino.

## Acesso aos dados

Nome, telefone e endereço ficam somente em `lojas_v2/{lojaId}/dados_entrega/{pedidoId}`. As regras existentes autorizam gerência/caixa da loja e administração; cozinha, consumidor e outra loja não podem ler esse documento. Escrita direta é proibida inclusive ao caixa.

O pedido operacional, a conta, a resposta do envio e o acompanhamento não recebem esses campos. A idempotência armazena o hash do conteúdo normalizado, sem copiar o contato/endereço. A resposta pública apresenta subtotal, taxa, total, prazo estimado e andamento. O link de acompanhamento continua sem acesso aos dados privados.

## Testes e limites

33 testes integrados aprovados, sem falhas, em `output/delivery-envio-servidor.log`. Cenários incluem envio simultâneo, leitura por papéis/lojas diferentes, tentativa de escrita direta, cotação alterada, endereço inválido, CEP fora da área, reenvio após pausa e fluxo real API → recebimento → pagamento com taxa. Dados exclusivamente fictícios nos emuladores.

As telas de formulário e confirmação do cardápio já foram integradas e testadas localmente. Ainda faltam apresentação do endereço no caixa autorizado, configuração administrativa nas telas, horários, saída/entrega/responsável, cupons e homologação pública/em celular físico. A interface do garçom também continua pendente. Não houve publicação.
