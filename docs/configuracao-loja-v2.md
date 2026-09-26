# Etapa 6 — Configuração por loja e painel de gerência

Entrega local de 21/09/2026. Não publicada. O painel só é instalado no perfil de teste do PDV; não muda as configurações das lojas legadas.

## Acesso

Entre como gerente em **Configurar acesso de teste**. Abra **Administrar loja • teste**, informe o código da loja e o nome curto do cardápio já provisionado e clique em **Carregar configuração**.

O servidor exige conta humana ativa com e-mail verificado e vínculo ativo de gerente da loja. Administrador com claim verificada também pode administrar. Caixas, cozinhas e consumidores não podem configurar a loja. A sessão gerencial continua separada da identidade do terminal.

O painel não cria contas de usuários nem reserva novos endereços públicos. Esse provisionamento continua pelas funções administrativas de acesso já existentes. O nome curto deve pertencer à loja carregada; não é possível usar a rota de outra loja.

## Recursos disponíveis

| Configuração | Efeito |
| --- | --- |
| Segmento | Identifica lanchonete, restaurante, adega, mercadinho, padaria, roupas ou outro. Não substitui os módulos comerciais legados. |
| Cardápio recebendo pedidos | Liga ou pausa a entrada de novos pedidos. |
| Mesas/QR | Autoriza novos pedidos vinculados a mesas. |
| Retirada | Autoriza pedidos para retirada no balcão. |
| Impressão da cozinha | Ativa a fila e exige selecionar o terminal e informar o nome da impressora. A saída permanece simulada neste perfil. |
| KDS | Liga ou desliga o painel de preparo independentemente da impressão. |

É possível configurar uma lanchonete com QR e impressão, sem usar KDS ou aplicativo de garçom. Também é possível operar com KDS sem impressão. Delivery com entrega e aplicativo de garçom ainda não foram implementados e não recebem um controle de ativação que sugira funcionamento.

Lojas V2 novas são criadas com os canais desligados. Em lojas de teste anteriores sem o campo de módulos, a compatibilidade anterior continua até salvar a configuração explícita.

A pausa não cancela pedidos, contas, pagamentos ou acompanhamentos existentes. Um catálogo já publicado continua legível como pausado, permitindo recuperar um envio aceito cuja resposta se perdeu. No cardápio de teste, após carregar/atualizar, botões de novos pedidos ficam desabilitados para o canal pausado; o servidor sempre verifica os canais, mesmo se a página estiver antiga. “Desativar entrada” não equivale a apagar ou tornar secreto o catálogo.

## Cadastros pelo painel

**Mesas:** cadastrar/editar código, nome, número no PDV e estado ativo. Duas mesas não podem apontar para o mesmo número. Não é possível trocar o vínculo ou desativar uma mesa com conta aberta ou pedido pendente. O QR usa o endereço local `127.0.0.1:5173/v2/...`; ele é uma prévia para este computador, não um endereço utilizável por celulares de clientes. A URL pública fica para a publicação.

**Produtos:** criar/editar nome, preço em reais, disponibilidade e indicação de esgotado. Grupos existentes são preservados ao mudar o preço do produto. A revisão do catálogo aumenta; pedidos montados com revisão antiga precisam ser conferidos novamente.

**Adicionais:** criar/editar grupos com mínimo e máximo de escolhas e opções com preço, quantidade máxima e disponibilidade. Desativar todas as opções de um grupo obrigatório impede a compra do produto até corrigir a configuração; não remove automaticamente a obrigatoriedade.

**Insumos:** cadastrar nome, unidade (`un`, `kg`, `litro`) e saldo inicial por ajuste. Depois, registrar entradas ou retiradas com motivo. O ajuste soma ao saldo atual, não grava um saldo absoluto antigo, e usa um identificador para evitar repetição após perda de resposta. Saldo negativo e mudança da unidade de um insumo existente são recusados. Documentos antigos sem unidade exigem migração conferida; o painel não presume uma unidade para alterar esses saldos.

**Ficha de consumo:** vincular múltiplos insumos ao produto base e a cada opção, informando a quantidade por unidade vendida, com até três casas decimais. Uma opção sem consumo deve ter lista vazia salva explicitamente. Marcar “não controla estoque” dispensa o produto inteiro e seus adicionais, não apenas uma opção.

O estoque e as fichas continuam na base V2 isolada. Não se trata de sincronização com os saldos legados nem com os relatórios antigos.

## Proteções

- Alterações usam revisão da configuração: duas telas não sobrescrevem silenciosamente uma edição anterior. Recarregue se receber aviso de configuração desatualizada.
- O endereço público é validado contra a loja antes da leitura ou gravação.
- Alterações de configuração geram auditoria privada com responsável, loja, ação e alvo. Ajustes de estoque também registram quantidade e motivo em seus movimentos.
- Apenas o terminal escolhido pode reservar novas impressões. Uma tentativa já reservada antes de trocar o terminal exige conferência; não é transferida/reimpressa automaticamente.
- Desativar a entrada de pedidos não impede receber ou fechar pedidos anteriormente aceitos.
- Fichas e estoque são alterados no servidor. Credenciais, licença e contatos de clientes não entram no QR.

## Limites antes do piloto

O painel carrega até 200 registros por seção. O piloto limita catálogo a 200 produtos, 10 grupos por produto, 20 opções por grupo e 20 insumos por componente da ficha, além dos limites de fechamento documentados na etapa 5. Catálogos grandes ainda precisam de paginação e validação de tamanho antes de ampliar o uso.

Não foram incluídos nesta entrega fotos/Cloudinary, categorias e ordenação visual do cardápio, delivery, garçom, horários/taxas de entrega, planos comerciais ou permissões finas por funcionário. Não há lançamento de versão, migração de saldos, impressora física ou URL pública nesta etapa. A publicação dos produtos pelo painel refere-se ao catálogo V2 local, não ao site em produção.

## Verificação

Resultado: 61 testes de servidor/regressão e 16 testes locais aprovados. O fluxo administrativo no Electron e o fluxo do cardápio em largura de celular também passaram. A captura do painel foi inspecionada visualmente. O log móvel adicional está em `output/etapa-6-testes-cardapio.log`.

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Configuracao
node --test test/cupom-cozinha.test.cjs test/pairing-ui-guard.test.cjs test/runtime-profile.test.cjs
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
powershell -NoProfile -File scripts/test-pairing.ps1 -Cardapio
```

A suíte verifica gerência e isolamento, bloqueio dos canais, terminal da impressora, edição concorrente, vínculo de mesa, produto/adicional, ajuste de estoque e ficha. Inclui regressões de acesso, pedidos, cozinha, recebimento, fechamento e regras.

O teste Electron usa os formulários reais para alternar o KDS, escolher terminal, gerar QR e cadastrar produto, opção, insumo e ficha. Depois percorre novamente cozinha, fechamento e estorno. O teste móvel do cardápio cobre recuperação de resposta perdida com o canal pausado, bloqueio de pedidos novos e reativação.

Arquivos de evidência na pasta principal do workspace: `output/etapa-6-configuracao/painel-administrativo.png`, `output/etapa-6-testes-backend.log` e `output/etapa-6-testes-interface.log`. Tudo usa `demo-flowpdv` nos emuladores; não houve deploy.

## Próximo passo

Etapa 7: revisar segurança e migração, consolidar o novo fluxo com caixa/estoque/relatórios existentes e validar equipamentos. Etapa 8: publicação e piloto. As funcionalidades adicionais listadas como ausentes precisam ser priorizadas separadamente, sem confundir piloto com um sistema já equivalente a todos os recursos do BeeFood.
