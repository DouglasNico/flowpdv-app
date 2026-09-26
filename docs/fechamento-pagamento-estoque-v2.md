# Etapa 5 — Fechamento, pagamento manual, cancelamento e estoque

Implementação de teste local em 21/09/2026. Não publicada, sem cobrança, estorno bancário, emissão fiscal ou alteração em estoque de loja real.

## Fluxo na tela

Em **Pedidos do cardápio • teste**, confira a conta e clique em **Fechar conta**. Selecione dinheiro, Pix conferido ou cartão recebido em outra maquininha. Para dinheiro, informe o valor entregue; vazio significa valor exato. Confirme a conferência do recebimento e registre o fechamento.

O total vem dos itens gravados pelo servidor. O caixa envia a versão que está conferindo; se outro pedido ou cancelamento alterar a conta, o fechamento é recusado até uma nova conferência. Contas com todos os pedidos cancelados podem ser encerradas com total zero, sem pagamento.

O painel **Fechamentos • teste** mostra as 30 vendas mais recentes, formas de pagamento, troco e estado da venda. A API também admite pagamento dividido em até cinco parcelas por forma, cuja soma deve corresponder exatamente ao total; a tela desta entrega oferece uma forma por fechamento.

## Transação do fechamento

`fecharAtendimentoV2` grava atomicamente:

1. Venda com cópia dos itens, adicionais, observações, valores e consumo de estoque.
2. Movimento financeiro de recebimento manual.
3. Movimento de saída de estoque e redução dos saldos.
4. Estado pago nos pedidos e fechado na conta.
5. Liberação da mesa para o próximo atendimento.

O ID da venda é o ID da conta. Dois caixas que fecham a mesma versão com o mesmo pagamento recuperam a mesma venda; somente um movimenta estoque. Tentar repetir com pagamento diferente exige conferir a venda já registrada. Se a resposta se perder, consultar o histórico ou repetir a mesma solicitação não deve gerar nova cobrança manual ao cliente.

A mesa possui um contador de pedidos ainda não recebidos. O envio público incrementa esse contador na mesma transação do pedido; recebimento ou cancelamento o reduz. O fechamento exige contador zero e consulta pedidos pendentes, protegendo também dados de teste anteriores. Ao liberar a mesa, seu ciclo aumenta. Pedidos vinculados a um ciclo anterior não são recebidos silenciosamente na conta de outro cliente.

## Estoque de teste

Esta entrega usa estoque e movimentos privados em `lojas_v2/{lojaId}`. **Não é o estoque legado de produção e ainda não alimenta os relatórios/turnos antigos.** A consolidação com o restante do PDV precisa ocorrer na migração das etapas 6 e 7, antes do piloto. Não operar os dois estoques independentemente em uma loja real.

Cada produto precisa de uma ficha privada em `fichas_estoque/{produtoId}`. Exemplo:

```json
{
  "consumos": [{ "estoqueId": "lanche", "quantidadeMili": 1000 }],
  "opcoes": [{
    "grupoId": "extras",
    "opcaoId": "bacon",
    "consumos": [{ "estoqueId": "bacon", "quantidadeMili": 200 }]
  }]
}
```

O documento `estoque/{estoqueId}` contém `saldoMili`, inteiro em milésimos da unidade adotada para aquele insumo. Se a unidade for kg, 200 representa 0,200 kg; se for unidade, 1000 representa uma unidade. O cadastro definitivo deve deixar essa unidade explícita e coerente.

O consumo é multiplicado pela quantidade do produto e, para adicionais, também pela quantidade da opção por unidade. Uma opção sem consumo deve ser mapeada explicitamente com `consumos: []`. Um produto inteiramente sem controle pode usar `semEstoque: true`, decisão administrativa que também dispensa seus adicionais do controle.

Ficha ausente, opção sem mapeamento, saldo insuficiente ou quantidade inválida impedem toda a transação. Nada é baixado parcialmente. As fichas vigentes são lidas no fechamento; o consumo efetivamente aplicado fica preservado na venda para que um estorno não dependa de uma ficha alterada depois. A baixa ocorre no fechamento, não no pedido nem no início do preparo. Reserva de insumos, desperdício de pedido cancelado após preparo e mudanças de ficha durante uma conta ainda exigem política operacional antes do uso real.

## Cancelamento e estorno

**Antes do fechamento:** o botão de cancelamento atua sobre o pedido inteiro, com motivo. Retira suas linhas da conta, recalcula o total e invalida a versão antes conferida. O estoque ainda não foi baixado. Se houver pedido não recebido, o contador da mesa é liberado uma única vez. Vias ainda pendentes são canceladas.

**Depois do fechamento:** o estorno atua sobre a venda inteira. O operador confirma que já conferiu a devolução financeira fora do sistema e decide se deve repor o estoque. Sem reposição, o consumo permanece. A repetição não devolve dinheiro ou estoque novamente. A mesa não é reaberta, pois pode já estar sendo usada por outro cliente. Não há estorno parcial nesta entrega.

Cancelamentos e estornos criam avisos no painel da cozinha, com confirmação de ciência. Se a impressão estiver ativa e o pedido já tiver sido recebido, geram cupom identificado **CANCELAMENTO — NÃO PREPARAR**. Esses cupons são simulados no perfil local. Se um cupom original já estiver no driver, ele pode sair antes do aviso; é necessário conferir o preparo.

## Segurança e limites

- Fechamento, cancelamento e estorno exigem terminal de caixa ativo da própria loja; cozinha não altera financeiro nem estoque.
- Acesso direto de escrita em pedidos, vendas, estoque e movimentos é bloqueado. As mutações passam pelas funções transacionais.
- O acompanhamento público expõe somente o estado do pagamento (`pendente`, `pago`, `estornado`), sem formas, operador, identificador financeiro ou dados de transação.
- O perfil normal não inicializa os painéis novos. Autenticação e regras legadas continuam exigindo a migração planejada.
- Dinheiro, Pix e cartão são registros manuais. Não há TEF, Pix dinâmico, estorno por operadora, NFC-e, controle do saldo físico de troco ou fechamento de turno V2 nesta entrega.
- Não há fechamento offline, descontos, taxa de serviço ou divisão da conta por pessoa. A API suporta até 100 pedidos e 100 insumos distintos por fechamento.
- O painel de configuração de fichas, estoque inicial e permissões mais detalhadas será feito na etapa 6. Hoje o provisionamento dos testes usa Admin SDK.

## Verificação

Resultado: 46 testes de servidor/regressão e 15 testes locais aprovados, além do fluxo completo no Electron. Conta de R$ 12,50, recebimento de R$ 20,00 e troco de R$ 7,50 conferidos na interface. Após recarga, havia uma única venda; o estorno restaurou os saldos de teste e gerou o aviso/cupom de cancelamento. Captura em `output/etapa-5-fechamento/venda-registrada.png` e logs `output/etapa-5-testes-backend.log` e `output/etapa-5-testes-interface.log`, na pasta principal do workspace.

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Fechamento
node --test test/cupom-cozinha.test.cjs test/pairing-ui-guard.test.cjs test/runtime-profile.test.cjs
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
```

A suíte de servidor cobre concorrência entre caixas, último estoque, totais e versões inválidas, ficha/adicional ausente, pagamento dividido, cancelamento concorrente, contador de pedidos, estorno com e sem reposição, revogação e isolamento entre lojas. Também executa regressões de pedidos públicos, recebimento, cozinha e regras.

O fluxo Electron testa pagamento manual com troco, recarga sem venda extra, estorno pela tela, restauração de estoque e aviso/cupom de cancelamento. Todas as integrações externas e impressão física permanecem bloqueadas no perfil de teste. O runtime local das Functions é Node 24; a configuração de implantação declara Node 20 e ainda precisa de validação antes de publicar.

## Próximas etapas

6. Configuração por loja, módulos e painel administrativo.
7. Migração, segurança, consolidação com o PDV e testes em equipamentos reais.
8. Publicação e piloto de uma loja.
