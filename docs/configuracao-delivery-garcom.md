# Configuração e operação local de delivery e garçom

Entrega de 22/09/2026, em ambiente fictício. O acabamento visual permanece para depois, conforme solicitado.

## Configuração

O gerente configura regiões por CEP, taxa, mínimo em produtos, prazo e horários no painel. É permitido operar somente delivery, sem mesas/retirada. Horários usam fuso IANA, até 28 períodos semanais, dia 0 domingo a 6 sábado, início inclusivo e fim exclusivo. Fim 1440 representa 24:00; madrugada deve ser dividida em dois dias. Sem horários configurados mantém-se a disponibilidade anterior; horários habilitados sem períodos fecham o canal. Cotação e confirmação verificam o relógio do servidor. Reenvio de pedido já aceito permanece recuperável após fechar o horário.

O módulo de garçom é independente de QR e retirada. A gerência vincula ou revoga conta humana existente por UID, com e-mail verificado. Não pode transformar terminal ou gerente em garçom. Convite/cadastro de conta e recuperação de senha ainda precisam de integração.

## Delivery no caixa

Consulta de endereço/contato exige terminal de caixa ativo e vínculo da mesma loja; cozinha, consumidor e outra loja não consultam essa API. O painel exibe até 50 entregas em andamento, incluindo contas já pagas. Contato e responsável ficam somente em `dados_entrega`, separados do preparo e do acompanhamento público.

Transições: novo → em_preparo → pronto → saiu_entrega → entregue. Saída exige responsável; confirmação de entrega não registra pagamento. O preparo pode ser operado pelo caixa mesmo sem KDS. Com KDS, a cozinha prepara e marca pronto, mas a saída/entrega fica com o caixa. Pedidos existentes continuam operáveis quando o canal é pausado.

Alterações usam transação, estado anterior e identificador de tentativa por loja. Repetição da mesma tentativa recupera a resposta, inclusive em outro caixa; conteúdo diferente é recusado. A API não permite avançar pedido cancelado. Cancelamento e estorno continuam passando pelos serviços financeiros existentes.

O cupom da cozinha identifica delivery sem contato/endereço. O caixa tem prévia separada de entrega com endereço, produtos, taxa, total, situação de pagamento e responsável. Essa prévia está identificada como teste e não envia ao driver. Fila/segunda via e validação física do cupom de entrega permanecem pendentes.

## Garçom local

Rota no cardápio local: `/v2/{slug}/garcom`. Sessão Firebase separada da sessão anônima de consumidor. O funcionário entra com e-mail/senha, escolhe mesa e utiliza o catálogo com adicionais/observações. A configuração pode manter QR público desligado e garçom ligado.

A mesma precificação/transação de pedidos valida preços e opções no servidor. Origem `garcom_v2` e UID do funcionário são registrados no pedido; a conta chega ao recebimento do PDV existente. Garçom não recebe acesso de caixa nem endereço de delivery.

Carrinho e tentativa são separados por UID, loja e mesa. Bloqueio entre abas e persistência da intenção antecedem o envio. Resposta perdida pode ser recuperada após recarga e após pausa do módulo. Revogação do funcionário bloqueia consultas e reenvios; a gerência precisa conferir pedidos já registrados. Mesa desativada com envio pendente continua aparecendo como opção de recuperação. Não há promessa de operação integral offline.

## Evidências

- 5 testes de regras de delivery: faixas, taxa, mínimo, fuso e limites de horário.
- 6 testes de cupons: escape de conteúdo, separação do contato e simulação sem driver.
- 30 testes de configuração/cozinha em `output/delivery-operacao-servidor.log`, incluindo saída concorrente, consulta restrita e recuperação.
- 37 testes de configuração/pedidos em `output/garcom-servidor.log`, incluindo garçom, opcionais, revogação e regressão de consumidor/delivery.
- PDV oculto em `output/configuracao-delivery-interface.log`: formulário de delivery persiste e recarrega taxa/mínimo/prazo/horários; regressão operacional anterior passou.
- PDV oculto final em `output/delivery-caixa-interface-final.log`, com Functions em Node 22: consulta de endereço, preparo, saída com responsável, prévia de cupom e entrega sem alterar pagamento passaram, assim como a regressão completa do clássico/moderno, caixa, cozinha e recuperação já implementada.
- Navegador oculto em `output/garcom-cardapio-interface.log`: mesa/consumidor, delivery e garçom; login, adicionais, perda de resposta, pausa, recarga e logout passaram.
- Rodada final em `output/garcom-conexao-interface-final.log`: serviços locais bloqueados no transporte HTTP antes do envio do garçom não criaram pedido; reconexão retomou a mesma tentativa e criou um único pedido. Cancelamento encerrou o polling automático. Não equivale a desconectar roteador ou validar um telefone físico.
- Bundle do PDV e build do cardápio passaram. Build não é publicação; Vite ainda sinaliza bundle principal acima de 500 kB.

A regressão de servidor também foi executada no runtime Node 22: 89 testes aprovados em `output/runtime22-integracao.log`. Proteções de perfil: 16 testes aprovados em `output/protecao-perfis-final.log`. Legado: 51 testes do núcleo e 26 de TEF simulado aprovados em `output/compatibilidade-legado-final.log`.

Não houve publicação, contratação, impressão física ou operação na loja real. O plano mestre mantém as pendências de integração operacional, recuperação, equipamentos, implantação, pagamentos/fiscal e demais segmentos.
