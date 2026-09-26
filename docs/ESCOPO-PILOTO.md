# Prioridade: primeira loja piloto

Decisão do usuário em 22/09/2026: concentrar o trabalho no piloto para aproveitar o limite disponível, incluindo delivery próprio e garçom junto. A inclusão desses dois módulos substitui a proposta anterior de deixá-los para depois.

## Escopo aceito

- Uma lanchonete e um caixa, com os layouts clássico e moderno.
- Pedidos por QR/mesa, retirada, delivery próprio e garçom.
- Canais opcionais por cliente, com configuração e autorização efetivas no servidor.
- Cozinha com KDS e/ou impressão conforme configuração; a loja pode operar sem garçom.
- Pagamentos manuais, cancelamentos, estornos, estoque e fechamento conciliados.

Delivery inclui endereço/contato protegidos, área/taxa/pedido mínimo, prazo, aceite, preparo, saída, entrega, cancelamento e responsável pela entrega. Garçom inclui acesso autorizado por loja, mesas, adicionais, observações e proteção contra pedidos duplicados. Integrações com marketplaces seguem fora desse delivery próprio.

## Ordem de execução

Atualização de prioridade: executar todas as configurações e funcionalidades pendentes do plano antes de trabalhar no acabamento visual. Usar controles funcionais no padrão existente durante a implementação e os testes. A mudança de estilo será tratada depois, com o usuário.

1. Consolidar integração operacional e fechamento, preservando lojas existentes e recuperação de pendências.
2. Reaproveitar pedidos, cozinha e pagamentos para os canais delivery e garçom; implementar contratos, permissões, configuração e validações antes das telas.
3. Integrar telas de delivery/garçom e completar o catálogo necessário aos pedidos do piloto.
4. Preparar homologação HTTPS e validar QR, cardápio e garçom em celulares.
5. Homologar equipamentos e executar um turno completo com todos os canais habilitados na loja.

Testes devem acompanhar as mudanças: usar verificações direcionadas e repetir a regressão completa quando a integração justificar. Não alterar os modelos ou comprar créditos/serviços automaticamente. O trabalho permanece local até a etapa própria de publicação.

## Estado atual e próxima dependência

Delivery já possui configuração administrativa de regiões/horários, consulta restrita de endereço no caixa, saída com responsável e confirmação de entrega. Garçom já possui conta individual vinculada à loja, mesa, adicionais, observações e recuperação de envio na interface local. Evidências e limites em [configuração e operação](configuracao-delivery-garcom.md). O plano mestre mostra apenas pendências: integração ao aplicativo operacional completo, recuperação, publicação e homologação física continuam necessárias.

Impressora e contas reais serão levantadas na implantação de cada cliente. O FlowPDV define compatibilidade e integrações suportadas; o cliente fornece seus equipamentos/dados e contrata os serviços da loja, com apoio do contador na parte fiscal. Veja [responsabilidades de implantação](responsabilidades-implantacao.md). Pagamentos manuais e impressão simulada permitem continuar o desenvolvimento independente dessas definições. Nenhum fornecedor será contratado automaticamente.

Configuração, cotação e taxa no fluxo financeiro estão implementadas no servidor. A confirmação pública já grava o pedido e o endereço separadamente. Contratos e limites em [base do delivery](delivery-base-piloto.md) e [envio público](delivery-envio-publico.md).

Nesta rodada foi corrigida uma condição de concorrência do ciclo de caixa: se vendas ou histórico mudarem durante a consulta remota de abertura/fechamento, o aplicativo preserva os novos dados e exige nova conferência. A abertura remota já confirmada mantém a referência pendente para retomada. Os 13 testes direcionados passaram em `output/piloto-caixa-concorrencia.log`; isso não substitui uma homologação física nem conclui a integração operacional.

O [plano completo](PLANO-COMPLETO-FLOWPDV.md) continua sendo a lista dos aceites. Funcionalidades adicionais, integrações de pagamento/fiscal e homologação ampliada dos outros segmentos não são consideradas concluídas por reduzir a prioridade.
