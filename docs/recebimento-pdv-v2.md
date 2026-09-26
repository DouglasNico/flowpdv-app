# Etapa 3 — Recebimento do cardápio no PDV

Implementação local, exclusiva do ambiente de teste. Não publicada e não habilitada em lojas reais.

## Comportamento

O terminal autorizado como caixa recebe pedidos pendentes do cardápio V2 e mostra as contas no botão **Pedidos do cardápio • teste**. Cada linha preserva quantidade, adicionais, observação, preço e pedido de origem. Retiradas têm contas individuais. Pedidos da mesma mesa acumulam na mesma conta aberta.

A função `receberPedidoPdvV2` determina a loja pelo terminal autenticado. Em uma transação, acrescenta as linhas em `lojas_v2/{lojaId}/atendimentos/{id}` e confirma `recebidoPdv` no pedido. Dois caixas podem receber simultaneamente: apenas um acrescenta as linhas; o outro recupera a confirmação. Pedidos diferentes da mesma mesa não sobrescrevem a conta inteira.

O terminal restaura sua própria sessão ao reabrir. As contas vêm do servidor, sem depender de uma cópia local de itens. Falhas interrompem a recepção com mensagem e botão de reconexão. A tela mostra até 50 contas abertas; a fila busca lotes de até 50 pedidos e avança conforme as confirmações. A conta aceita até 300 linhas nesta versão.

## Vínculo das mesas

A mesa V2 precisa de `ativo: true`, `nome` e `comandaPdvId`, por exemplo `MESA-1`. O vínculo é explícito, não inferido do nome. Sem vínculo válido, o pedido permanece pendente. O provisionamento de teste é feito pelo Admin SDK; o painel de configuração e a validação de unicidade desse vínculo são parte da etapa 6.

`atendimentoId` na mesa identifica a conta aberta. A recepção recusa contas encerradas. A etapa 5 deverá encerrar e trocar esse vínculo em uma transação, tratando pedidos que cheguem durante o fechamento.

## Limites desta entrega

- A conferência funciona dentro do PDV, em uma tela própria de teste. Ainda não transfere para o carrinho nem usa o fechamento das comandas antigas. O código antigo agrega itens pelo produto e não preserva todas as variantes.
- Impressão e KDS: etapa 4. Pagamento, baixa de estoque, fechamento e cancelamento depois do recebimento: etapa 5. Não usar o total desta tela para cobrança real antes dessa integração.
- Pedido cancelado antes de receber é confirmado como ignorado e não entra na conta. Cancelamento posterior ainda exige reconciliação na etapa 5.
- Pedidos anteriores sem o campo `recebidoPdv` não entram na consulta. A migração precisa decidir quais pedidos históricos continuam pendentes; não preencher indiscriminadamente em produção.
- Erro de configuração de uma mesa interrompe a recepção deste terminal até correção e reconexão. A evolução operacional deve permitir tratar pendências individualmente.
- O teste não substitui as regras e autenticação legadas. A migração de segurança continua necessária antes da publicação.
- Sem mudança de hospedagem, deploy, cliente real ou impressora física nesta etapa. Os emuladores locais não demonstram custo ou capacidade de produção.

## Validação reproduzível

Resultado em 21/09/2026: 8 testes de recebimento e 9 de isolamento passaram; o fluxo no Electron também passou, desde a criação pela API pública até a restauração da conta após recarga. A captura local fica em `output/etapa-3-recebimento/recebimento-pdv.png` na pasta principal do workspace.

Na pasta `adega-pdv-gestao`:

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Recebimento
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
node --test test/pairing-ui-guard.test.cjs test/runtime-profile.test.cjs
```

O primeiro comando cobre concorrência, repetição, vínculo de mesa, retirada, cancelamento anterior, isolamento, proteção contra escrita direta, conta fechada e revogação. O segundo cria um pedido pela API pública nos emuladores e verifica no Electron o recebimento, os detalhes e a recarga sem duplicação, além do pareamento. O terceiro verifica a separação do modo normal e do ambiente de teste.

Os testes usam `demo-flowpdv`, sem credenciais reais, impressão ou serviço financeiro. O emulador executa Node 24 do computador, enquanto a configuração das Functions declara Node 20; a validação no runtime de implantação fica para a preparação da publicação.

## Próximas etapas

4. Impressão na cozinha e KDS opcional.
5. Pagamento, cancelamento, fechamento e estoque sem duplicação.
6. Configuração por loja e painel administrativo.
7. Migração, segurança e testes com equipamentos reais.
8. Publicação e piloto de uma loja.
