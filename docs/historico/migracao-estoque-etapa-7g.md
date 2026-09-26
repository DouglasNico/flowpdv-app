# Etapa 7G — migração conferida dos saldos de estoque

Primeira parte da integração de estoque, exclusivamente no perfil local de teste. A venda antiga ainda não foi ligada ao estoque do servidor. Por isso, os itens migrados ficam bloqueados para venda, edição, exclusão e movimentação pelos métodos locais do PDV neste perfil. Os itens não migrados e o perfil normal mantêm o comportamento anterior.

## Como funciona

Em **Configurar loja → Migrar saldo do PDV de teste**, entre como gerente, carregue a loja, selecione um produto local e clique em **Conferir conversão**. O painel mostra a quantidade de origem e a unidade de destino antes da confirmação. A demonstração inclui farinha fictícia: 2.500 g correspondem a 2,5 kg.

Depois de conferir e marcar a confirmação, use **Migrar ou retomar migração**. O servidor cria um insumo novo, um registro de origem e um movimento de saldo inicial na mesma transação. Não soma a um insumo existente nem associa automaticamente nomes iguais. O código do destino é determinado pelo ID de origem dentro da loja. Cadastros com IDs diferentes não são presumidos como o mesmo produto.

Após migrar, vincule esse insumo na **Ficha de consumo por produto e adicional**. O consumo é informado na unidade do insumo: 0,250 kg por lanche, por exemplo. O pagamento do restaurante baixa a ficha uma vez; o estorno com reposição devolve o consumo salvo na venda.

Conversões aceitas: `un → un`, `kg → kg`, `g → kg`, `l/litro → litro` e `ml → litro`. Não há arredondamento silencioso. Unidade ausente/desconhecida, quantidade negativa, precisão incompatível, embalagem alternativa ou produto sem controle de estoque exigem revisão antes da migração. O painel permanece limitado a 200 insumos.

## Repetição e recuperação

O bloqueio local é salvo antes da chamada ao servidor. Se a resposta se perder, o item continua protegido e a mesma operação pode ser retomada após recarregar. Não libere o item apagando os dados do perfil: a migração pode já ter sido confirmada no servidor.

Repetir a mesma migração retorna o vínculo existente, sem redefinir o saldo atual. Uma solicitação com saldo inicial diferente é recusada. O servidor exige gerente humano autorizado na loja e confirma novamente saldo e unidade. O perfil normal não usa os bloqueios experimentais.

A cópia do produto local fica preservada como origem, com seu saldo antigo; ela não é uma consulta do saldo atual do restaurante. Consulte o insumo no painel de estoque. Não existe sincronização bidirecional de saldos nesta etapa.

## Validação

- Conversões exatas, recusa de entradas ambíguas e falhas ao salvar o bloqueio.
- Resposta remota perdida, retomada, troca indevida de loja e bloqueio real de gravação pelo armazenamento local.
- Chamadas concorrentes produzem uma única migração.
- Importação de 2,5 kg, venda com consumo de 250 g, repetição da migração mantendo 2,25 kg e estorno restaurando 2,5 kg.
- Recusa de operador sem gerência, ausência de confirmação e unidade desconhecida.
- Teste visível do painel com farinha fictícia e tentativa de venda local recusada sem gravar a venda.

Evidências: `output/etapa-7g-local.log`, `output/etapa-7g-legado.log`, `output/etapa-7g-backend.log`, `output/etapa-7g-interface.log` e `output/etapa-7g/saldo-migrado.png` no workspace.

## Próxima parte e limites

Ligar o fechamento de vendas do PDV antigo ao saldo do servidor, tratando repetição e falhas de rede, antes de permitir que os dois fluxos vendam o mesmo item. Ainda faltam a migração entre vários terminais, embalagens/fardos, recuperação em outro computador, sincronização e autenticação legada. Esta ferramenta não autoriza migrar uma loja real nem substitui backup ou inventário físico. Nenhum deploy foi realizado.

Resultado final: **190 testes automatizados distintos aprovados** (76 de servidor, 37 locais e 77 do fluxo antigo), além do fluxo integrado visível. A captura do painel foi inspecionada. O servidor confirmou um único insumo migrado de 2,5 kg, e a venda local recusada não alterou a contagem de vendas. Nenhum deploy realizado.

Continuação: [Etapa 7H — venda local com estoque do servidor](venda-local-estoque-etapa-7h.md). A ponte do painel de teste grava a venda pelo armazenamento do PDV e baixa somente o estoque remoto, com retomada de falhas. A tela operacional antiga e o estorno dessa modalidade continuam pendentes.
