# Etapa 7B — referência de turno e conferência financeira

Entrega local de preparação para integrar o restaurante ao caixa. Não é a migração completa nem a substituição do fechamento oficial antigo.

## Comportamento entregue

O pagamento no painel de restaurante usa a referência do turno aberto neste terminal: ID, terminal local e data de abertura. O servidor valida o formato, acrescenta o UID autenticado e grava essa referência na mesma transação que a venda, o recebimento e a baixa de estoque. Não há uma segunda gravação local da venda V2.

O estorno registra o turno em que a devolução foi realizada, preservando o turno original da venda. Assim, uma devolução posterior não apaga o recebimento histórico. Os movimentos inversos carregam o detalhamento das formas originais; este fluxo pressupõe devolução por essas mesmas formas. Devolver por outro meio ainda exige um fluxo de conciliação específico.

A seção **Conferência do turno atual**, dentro de **Fechamentos de teste**, consulta os movimentos daquele turno e terminal e soma ao histórico local selecionado. Exibe vendas locais, recebimentos V2, estornos V2 e total líquido. Mostra separadamente dinheiro, Pix e cartão V2 sem classificação; não presume débito/crédito.

O resumo não chama `saveVenda`, não altera estoque, turnos, vendas antigas ou backups. Não é saldo de gaveta: não inclui fundo de troco, sangrias ou suprimentos. Os relatórios/exportações antigos continuam lendo a base antiga; ainda não devem ser usados como total consolidado de uma loja com os dois fluxos.

## Reenvios e divergências

- Venda/recebimento/estoque continuam numa transação única. Reenvio idêntico reutiliza a venda; referência de turno diferente não transfere uma venda já registrada.
- A tela conserva a referência da tentativa enquanto se repete o envio, para não mudar o turno após uma resposta perdida.
- Reenvio do estorno não cria outro movimento e não repõe estoque novamente.
- Consulta usa loja e UID derivados da autenticação; um terminal não consulta o turno de outro só copiando seus campos.
- Mais de 500 movimentos no turno causa erro explícito, nunca um total parcial apresentado como completo.
- A conferência recusa IDs locais duplicados, importações V2 já marcadas no histórico antigo, situações locais não reconhecidas e dados financeiros inconsistentes.
- A conferência é uma leitura no momento do clique. Atualize após novas operações; não é um fechamento transacional das duas bases.

## Limites que permanecem

A referência de turno é **declarada pelo PDV local**. O servidor não tem ainda o ciclo de abertura/fechamento dos turnos antigos; valida formato e vincula ao operador autenticado, mas não comprova que aquele turno local está aberto. A tela exige turno aberto do próprio dispositivo. A migração futura precisa tornar esse ciclo autoritativo no servidor antes de usar isso como controle definitivo de caixa.

A API mantém compatibilidade com clientes anteriores sem referência de turno. Esses movimentos continuam sem vínculo e não entram na consulta por turno. Não foi inventado vínculo retroativo por horário; é necessária conferência de migração. A identidade de um terminal pareado novamente muda o escopo da consulta, exigindo recuperação administrativa do histórico anterior.

O estoque V2 continua separado dos produtos antigos. Não houve importação de saldos, alterações no caixa de produção, publicação ou impressora física. Fluxos offline e encerramento do caixa com operações pendentes ainda exigem integração específica.

## Demonstração e validação

A demonstração cria um turno fictício e uma venda local de R$ 5,00, claramente identificada como `VENDA-LOCAL-DEMO`, somente no perfil temporário. O teste visível registra R$ 12,50 do restaurante, confere R$ 17,50, faz o estorno e confere R$ 5,00. Confirma também que o histórico local mantém apenas uma venda.

Evidências: `output/etapa-7b-local.log`, `output/etapa-7b-interface.log`, `output/etapa-7b-backend.log` e `output/etapa-7b/conferencia.png` na pasta principal do workspace. Resultados finais abaixo após a execução.

## Próxima parte

Integrar o ciclo de turnos e os relatórios oficiais; depois simular a migração de produtos, unidades e saldos, com uma única origem de baixa. A etapa 7 segue em andamento. A etapa 8 (publicação/piloto) depende dessas validações, da autenticação legada e dos equipamentos.

Resultado final: **69 testes de servidor, 19 testes locais e o fluxo de interface visível aprovados**. A captura da conferência foi inspecionada e mostra R$ 17,50 (R$ 5,00 locais + R$ 12,50 restaurante). O teste confirmou R$ 5,00 após o estorno e apenas uma venda no histórico local. Não houve deploy.

Continuação: [Etapa 7C — painel sem licença e turnos do restaurante no servidor](turnos-servidor-etapa-7c.md). Nas lojas de teste habilitadas, o servidor já exige turno aberto e encerra com conferência de revisão. A migração do ciclo antigo e de seus relatórios permanece pendente.
