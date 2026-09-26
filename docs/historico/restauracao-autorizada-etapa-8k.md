# Restauração autorizada em destino vazio — etapa 8K

O serviço `ensaiarRestauracaoTerminal` liga o backup ao terminal autenticado. A identidade financeira é obtida de `consultarMeuTerminalV2`; um arquivo não pode escolher outro UID apenas por pertencer à mesma loja. O destino deve estar vazio e explicitamente isolado.

Antes de escrever, o serviço valida o arquivo, confere o turno no servidor e os vínculos/unidades do inventário, e consulta novamente a autorização. Mudança de sessão, delegação ou loja impede a aplicação. Vendas posteriores ao backup ou outras divergências também bloqueiam o ensaio. Diferença de saldo causada por movimentação válida não redefine o saldo remoto.

O retorno mantém `liberacaoOperacional: false`: pendências ainda precisam ser retomadas e conferidas. O serviço não apaga o perfil aberto, não copia credenciais e não implementa reconstrução automática de movimentos ausentes. A integração ao perfil de uso normal permanece pendente.

## Validação

- `output/etapa-8k-local.log`: nove testes aprovados, incluindo identidade/loja incorretas, destino ocupado, alteração de sessão/delegação e inventário divergente.
- `output/etapa-8k-servidor-validacao.log`: nove testes de recuperação aprovados nos emuladores, incluindo backup com baixa pendente, transferência administrativa, armazenamento vazio, credenciais próprias do novo caixa, retomada pela ponte real de vendas e conferência final sem diferenças/pendências. Estoque preservado em 2.250 milésimos e venda local registrada uma única vez.
- A rodada anterior (`etapa-8k-servidor.log`) passou em 66 casos e falhou apenas no cenário novo porque o fixture misturava venda sem campo de dinheiro recebido com reenvio que informava esse campo. O servidor rejeitou a alteração corretamente. O fixture foi alinhado e a suíte afetada foi repetida com sucesso.
- Agregado local final: 50 testes aprovados em `output/etapas-8-validacao-local-final.log`.
