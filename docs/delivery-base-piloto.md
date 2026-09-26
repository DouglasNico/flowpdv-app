# Delivery do piloto — configuração e cotação

Primeira parte de backend. Ainda não habilita o envio de pedidos de delivery nem fornece telas de delivery/garçom.

## Configuração por loja

`salvarConfiguracaoDeliveryV2` usa a autorização existente de gerência com e-mail verificado, vínculo com a loja, versão esperada e auditoria. Armazena em `lojas_v2/{lojaId}.delivery`:

- `ativo`: disponibilidade da cotação de delivery nesta etapa.
- `pedidoMinimoCentavos`: mínimo dos produtos, sem somar a taxa de entrega.
- `regioes`: até 50 faixas de CEP, cada uma com ID/nome, CEP inicial/final inclusivos, taxa em centavos e prazo estimado em minutos.

Faixas sobrepostas, IDs repetidos, CEP inválido e valores negativos/fracionados são recusados. CEP é normalizado para oito dígitos; não há consulta de endereço externo ou cálculo de distância. A consulta administrativa de configuração devolve esses campos. As operações existentes de módulos preservam a configuração de delivery.

## Cotação pública autenticada

`cotarDeliveryPublicoV2` recebe `slug`, `catalogoVersao`, `cep` e `itens`, usando a sessão anônima do cardápio. Resolve a loja pelo slug e recalcula preços/adicionais pelo catálogo atual. Recusa loja inativa/suspensa, cardápio pausado/desativado, delivery inativo, versão antiga, produto indisponível, CEP fora da área ou mínimo não atingido.

Devolve região, subtotal, taxa, total, prazo, mínimo, versões de catálogo/configuração e `somenteCotacao: true`. Valores de taxa, preço, total e loja enviados pelo cliente não substituem os dados oficiais. A cotação não cria pedido, não reserva estoque e não grava nem devolve o CEP. O prazo é uma estimativa configurada, não rastreamento de entregador.

## Próximas dependências

A taxa no recebimento, pagamento, cancelamento, estorno e relatório foi acrescentada na [entrega financeira](delivery-taxa-financeira.md). O [envio público](delivery-envio-publico.md) agora inclui delivery, endereço/contato restritos e revalidação da cotação. Ainda faltam telas, horários, aceite, preparo, saída, entrega e responsável. O garçom segue no escopo do piloto, com implementação própria de acesso e pedidos ainda pendente.

## Validação

Três testes locais aprovados em `output/delivery-base-local.log`; 30 testes integrados e de regressão das APIs de configuração e pedidos aprovados em `output/delivery-base-servidor.log`. O cenário novo testa permissão, versão concorrente, preço recalculado, taxa, ausência de criação de pedido, CEP fora da região, catálogo antigo, mínimo e pausa. Não houve publicação nem abertura de telas.
