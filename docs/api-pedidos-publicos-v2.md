# Etapa 1 de 8 — API de pedidos públicos

21/09/2026. Implementação local em `functions/pedidos-publicos-v2.js`. Exportada por `functions/index.js`, sem publicação ou alteração do cardápio existente.

## Entrega

- `criarPedidoPublicoV2`: valida e registra pedidos de mesa ou retirada.
- `acompanharPedidoPublicoV2`: consulta uma resposta restrita ao consumidor usando um token próprio.
- Valores em centavos inteiros, calculados pelo servidor a partir do catálogo publicado, incluindo adicionais por unidade do produto.
- Cada linha recebe identidade própria; duas versões do mesmo produto não são agrupadas automaticamente.
- Pedido privado, registro de reenvio, acesso de acompanhamento e contadores de frequência gravados na mesma transação do Firestore.

## Contrato de envio

O cardápio deverá iniciar uma sessão anônima do Firebase Auth em segundo plano, sem pedir cadastro ou senha ao consumidor. A sessão permite vincular um reenvio ao seu remetente; não é a credencial da loja. O frontend atual ainda não está conectado a esse contrato.

```json
{
  "slug": "lanchonete-a",
  "requestId": "f5ca3bd2-f689-4cd9-86e4-bdc9f6e9769e",
  "tipo": "mesa",
  "mesaId": "mesa-1",
  "catalogoVersao": 1,
  "itens": [{
    "produtoId": "lanche",
    "quantidade": 2,
    "observacao": "Sem cebola",
    "opcoes": [
      { "grupoId": "ponto", "opcaoId": "bem", "quantidade": 1 },
      { "grupoId": "extras", "opcaoId": "bacon", "quantidade": 1 }
    ]
  }]
}
```

Campos de preços, total ou loja privada enviados pelo cliente são ignorados. A loja é resolvida pelo slug na coleção privada `rotas_publicas_v2`. Para retirada, `mesaId` é desconsiderado. Delivery não é aceito nesta etapa.

O cliente precisa manter o mesmo `requestId` e a mesma sessão para repetir um envio incerto. Se modificar o carrinho depois de um envio concluído, deve gerar outro identificador. Não gerar outro ID automaticamente após timeout, pois isso representa outro pedido.

O servidor normaliza a ordem das opções e calcula um hash do conteúdo. A mesma sessão, loja e requestId recuperam o pedido já registrado. Reutilizar o identificador com conteúdo diferente é recusado. Outra sessão não consegue recuperar o token do pedido anterior com essa chave; será tratada como outro remetente. Apagar o armazenamento/sessão do navegador perde essa associação.

## Dados que a publicação do catálogo deverá fornecer

`catalogos_publicos_v2/{slug}` deve conter `publicado`, `pausado`, `versao` e `produtos`. Cada produto contém `id`, `nome`, `ativo`, `esgotado` opcional, `precoCentavos` e `grupos`.

Cada grupo contém `id`, `nome`, `min`, `max` e `opcoes`; cada opção contém `id`, `nome`, `ativo`, `precoCentavos` e `maxQuantidade`. Os limites do grupo se aplicam à soma das quantidades de opções por unidade do produto. A API recusa seleção duplicada da mesma opção e exige que sua quantidade seja informada explicitamente.

Para pedido em mesa, `lojas_v2/{lojaId}/mesas/{mesaId}` precisa existir, com `ativo: true` e `nome`. A loja precisa estar ativa. A tabela é validada, mas esse mecanismo ainda não comprova presença física na mesa; proteção do QR/abertura de atendimento pertence à integração seguinte.

O servidor exige que `catalogoVersao` coincida com a versão publicada. Se o catálogo mudou, o consumidor deve revisar o carrinho antes de enviar. Um reenvio de pedido já registrado recupera os valores originais mesmo depois da mudança de catálogo ou pausa; isso não cria um novo pedido.

## Persistência e acesso

| Caminho | Finalidade |
|---|---|
| `lojas_v2/{lojaId}/pedidos/{pedidoId}` | Pedido operacional, com opções, observações, preços e pagamento pendente |
| `lojas_v2/{lojaId}/solicitacoes/{hash}` | Recuperação do envio vinculada à sessão; hash do conteúdo, ID e token recuperável pelo servidor |
| `acompanhamentos_v2/{hashDoToken}` | Referência privada ao pedido, válida por sete dias |
| `limites_pedidos_v2/{hash}` | Contadores privados por minuto |

As três últimas áreas não têm regras que permitam acesso direto do cliente. O token de acompanhamento tem 256 bits aleatórios. Seu hash identifica o documento de acesso; uma cópia do segredo fica no registro privado de reenvio para permitir recuperar a resposta perdida. Nenhum token é gravado em coleção publicamente legível.

A consulta de acompanhamento lê o pedido atual e devolve somente ID, situação, tipo, nome da mesa, total, produtos e opções. Não devolve licença, identidade privada da loja, pagamento, observações livres ou endereço. Como consulta o pedido diretamente, não depende de atualizar duas cópias do status. Quem possui o token pode acompanhar o pedido durante sua validade; o frontend não deve enviá-lo a analytics ou logs.

## Limites iniciais

- De 1 a 30 linhas; quantidade inteira de 1 a 99 por linha.
- Até 20 seleções por linha; quantidade de opção de 1 a 10, limitada também pelo catálogo.
- Observação até 180 caracteres.
- Total máximo inicial de R$ 10.000 por pedido.
- Até 5 pedidos novos por sessão/loja/minuto e 120 por loja/minuto, em janelas fixas. Reenvios confirmados não consomem nova cota.

Esses limites são iniciais, fixos e ainda precisam ser calibrados no piloto. Não substituem proteção contra abuso automatizado, App Check, monitoramento e controles de borda antes de expor o serviço publicamente. A validade dos documentos é verificada pelo código; limpeza automática de registros expirados ainda não foi configurada.

## Validação

**Resultado: 10/10 cenários passaram, zero falhas.** Os emuladores foram encerrados ao final. As suítes anteriores não foram reexecutadas nesta entrega; a contagem acima é específica da nova API.

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Pedidos
```

`test/public-orders-v2.test.cjs` usa Auth, Firestore e Functions locais em `demo-flowpdv`, com chamadas reais aos endpoints e duas lojas fictícias. Testa:

1. Preço adulterado ignorado, gravações correlacionadas, pedido na loja correta e acesso restrito ao funcionário autorizado.
2. Duas chamadas simultâneas com o mesmo envio produzindo um único pedido/token; conflito de conteúdo recusado.
3. Isolamento da recuperação entre sessões de consumidores.
4. Linhas distintas e multiplicação dos adicionais.
5. Quantidades inválidas, opções repetidas, limites e grupo obrigatório.
6. Produto/opção/mesa inválidos ou indisponíveis, sem pedido parcial.
7. Catálogo alterado exigindo revisão, preservando recuperação do pedido original.
8. Loja pausada, retirada e recusa de delivery.
9. Limite de frequência sem bloquear a recuperação de um envio confirmado.
10. Acompanhamento atualizado, resposta restrita, token inválido/expirado e exigência de sessão para criar.

Na primeira tentativa a suíte não iniciou por resolução incorreta da dependência Timestamp no arquivo de teste. Corrigido o caminho usando createRequire do pacote functions. Runtime local continua Node 24; permanece a pendência de alinhar o runtime declarado antes de publicar.

## Fora desta entrega

Disponibilidade significa loja/catálogo/mesa ativos e produto/opção disponível no catálogo. Não há reserva de estoque, consumo de ingredientes ou baixa de estoque nesta API. O pedido começa como `novo` e com pagamento pendente; não cobra, não imprime e não é inserido automaticamente na comanda legada.

O cadastro/publicação do catálogo V2 e o frontend público ainda serão conectados. As credenciais antigas e o fluxo publicado continuam inalterados; a migração de segurança não está concluída. Não houve deploy.

Próxima etapa da lista: **2. Conectar o cardápio**, incluindo adaptação do catálogo, sessão anônima do consumidor, persistência do identificador de envio, confirmação e acompanhamento.
