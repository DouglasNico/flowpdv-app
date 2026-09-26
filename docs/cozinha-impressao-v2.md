# Etapa 4 — Cozinha, cupom de preparo e KDS opcional

Entrega local de 21/09/2026. Não publicada. Impressão validada por simulação e adaptador com driver falso; não houve saída em impressora física.

## O que funciona

Ao receber um pedido V2, o servidor cria uma única entrada na fila da cozinha, na mesma transação que confirma o recebimento. A entrada contém somente aquele pedido: um segundo pedido da mesa gera outro cupom, sem repetir a conta inteira.

No PDV de teste, **Cozinha • teste** abre o painel. Se a impressão estiver ativa, o terminal processa a fila automaticamente, inclusive com o painel fechado, e mostra a prévia do último cupom simulado. O cupom inclui mesa ou retirada, identificação completa do pedido, quantidade, adicionais por unidade e observações em destaque. Não inclui preço, pagamento, endereço ou credenciais. Há formatação para papel de 58 e 80 mm.

Se o KDS estiver ativo, os pedidos recebidos aparecem com os botões **Iniciar preparo**, **Marcar pronto** e **Marcar entregue**. O acompanhamento do cliente lê o mesmo status. As transições são verificadas no servidor; repetição da mesma transição é tolerada e saltos ou retrocessos são recusados. Escrita direta de preparo no Firestore foi bloqueada. O cancelamento legado V2 autorizado para caixa/gerente continua nas regras até sua integração transacional na etapa 5.

## Configuração por loja

Campo privado `cozinha` em `lojas_v2/{lojaId}`, provisionado pelo Admin SDK nesta fase:

```json
{
  "cozinha": {
    "impressao": true,
    "kds": false,
    "papelMm": 80,
    "impressora": "Nome da impressora no Windows"
  }
}
```

| Impressão | KDS | Comportamento |
| --- | --- | --- |
| Ativa | Desativado | Recebe o pedido e gera o cupom, sem exigir uso da tela de preparo. |
| Desativada | Ativo | Pedido aparece no monitor, sem criar cupom. |
| Ativa | Ativo | Cupom e monitor disponíveis. |
| Desativada | Desativado | Recebimento no PDV continua, sem fila de cozinha ou preparo pelo KDS. |

Configuração ausente equivale a ambos desativados. Ativar a impressão depois não cria cupons retroativos de pedidos já recebidos. Desativar pausa a fila existente. O painel administrativo e a seleção definitiva de impressora/terminal por loja ficam na etapa 6. Até lá, qualquer terminal autorizado como caixa ou cozinha pode disputar a fila; só o vencedor recebe autorização de despacho. O terminal de caixa precisa estar conectado para o recebimento inicial no PDV.

## Duplicação e falhas

A coleção privada `impressoes_cozinha` usa o ID do pedido para a primeira via. Uma transação muda `pendente` para `enviando` e registra o terminal, a tentativa e um prazo de dois minutos. Uma segunda reserva, mesmo com a mesma tentativa, não autoriza novo despacho. Se a resposta da reserva se perder, não há reenvio automático ao driver.

O término registra `simulado`, `enviado_driver` ou `incerto`. **Enviado ao driver não comprova saída física do papel.** Queda entre a reserva e a confirmação deixa a tentativa aguardando conferência. Nova reserva depois do prazo a classifica como incerta; o operador também pode solicitar outra via após o prazo. Não existe temporizador automático que reimprima.

Outra via exige motivo de 5 a 180 caracteres, é identificada no cupom e registra operador e origem. O mesmo pedido de reimpressão pode ser reenviado sem criar nova via. Duas solicitações concorrentes para a mesma via não criam duas cópias; uma cadeia de vias permite nova tentativa quando necessário.

Pedidos cancelados antes da reserva não são despachados. Cancelamento depois da reserva pode coincidir com impressão já em andamento: a etapa 5 deverá incluir o aviso operacional de cancelamento e a reconciliação da conta. Não há promessa de impressão física exatamente uma vez diante de falha de energia ou comunicação.

## Segurança e preservação do sistema atual

As funções obtêm a loja do terminal autenticado e verificam usuário ativo, vínculo ativo, papel e loja ativa. O cliente não altera a fila diretamente nem consulta a fila de outra loja. O cupom escapa textos e bloqueia scripts; a prévia usa iframe sem permissões de script.

O painel só inicializa com `ambienteTeste === true`. A impressão física permanece bloqueada nesse perfil. O adaptador preparado para o aplicativo exige uma impressora escolhida e encaminha seu nome ao IPC térmico existente; chamadas antigas sem nome continuam com seu comportamento anterior. Adega, mercado, padaria e loja de roupas não ganham esses painéis no modo normal.

## Validação

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Cozinha
node --test test/cupom-cozinha.test.cjs test/pairing-ui-guard.test.cjs test/runtime-profile.test.cjs
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
```

- 25 testes nos emuladores: cozinha (7), regressão de recebimento (8) e regras de segurança (10).
- 13 testes locais: cupom/adaptador, ausência de inicialização em produção e isolamento do perfil.
- Fluxo Electron: criação pela API pública, recebimento, cupom simulado automático, preparo até entregue, atualização do acompanhamento, segunda via e recarga sem criar impressão extra.

O ambiente é `demo-flowpdv`. Functions e emuladores locais foram migrados e conferidos com Node 22; implantação remota permanece pendente.

## Pendências para uso real

Não houve deploy, alteração da loja real ou teste em impressora. A etapa 7 deve validar impressora USB/rede, largura, corte, acentos, falta de papel, reconexão, seleção do terminal responsável e concorrência com o cupom do caixa. O monitor mostra até 50 pedidos ativos e o histórico, 30 tentativas recentes; paginação e tratamento de filas maiores continuam necessários antes de ampliar o piloto.

Com KDS desligado, o caixa autorizado atualiza manualmente mesa e retirada em Pedidos do cardápio: novo → em preparo → pronto → entregue. O servidor exige a origem caixa e recusa terminal de cozinha nesse modo; reativar KDS remove essa alternativa. Delivery continua pelos controles de entrega. A lista local mostra até 50 pedidos ativos por tipo. Imprimir não altera o preparo automaticamente e não comprova entrega. O modo funciona com impressão habilitada ou desabilitada; equipamentos físicos ainda precisam ser homologados.

Pendências atuais e critérios de conclusão: [plano completo](PLANO-COMPLETO-FLOWPDV.md).
