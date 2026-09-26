# FlowPDV — continuidade de implementação

## Aplicativo completo — login, venda nativa e retomada

Complemento validado: `output/alimentacao-aplicativo-completo-integracao.log` concluiu também pedido público de delivery e pedido autenticado pela API do garçom, com reenvio sem duplicação, recebimento no aplicativo completo, Pix/dinheiro, preparo/saída/entrega, estorno integral com estoque e fechamento consolidado. Após o estorno do delivery, o segundo turno reteve R$5 de venda da mesa e R$15 de fundo, com contagem fictícia de R$20 e diferença zero. Este teste não controla a interface do celular do garçom e não comprova equipamentos físicos.

A atualização legada de uma venda confirmada agora é recusada, inclusive se o marcador do recibo estiver inválido. Atualizações fiscais de vendas exclusivamente legadas continuam disponíveis. Evidência: `output/vendas-confirmadas-protecao-local.log`, 47 testes de armazenamento, ponte e estorno aprovados. A suíte de adaptador/ponte passou a 36 casos após incluir adesão explícita e troca de operador (`output/venda-aplicativo-local.log`).

O parâmetro de desenvolvimento `--flowpdv-app-completo`, junto de `--flowpdv-homologacao`, inicializa o App normal em outro perfil isolado, sem substituir a página pelos painéis de laboratório. A distribuição empacotada continua recusando esse modo. Testes injetam uma licença e operador fictícios apenas no HTML temporário do ensaio; o produto não ganha usuários, PINs ou licença de demonstração embutidos.

O login nativo passou com PIN errado/correto, clássico/moderno, bloqueio em recuperação e fechamento dos painéis no logout. Chamadas verificam a identidade local antes/depois da resposta; gerência exige também gerente local, mantendo sua autenticação Firebase separada. Cancelamento, estorno, desconto e segunda via respeitam permissões locais no perfil completo. Essas verificações de interface não substituem autorização remota individual de funcionários, que permanece pendente.

A venda do carrinho nativo usa a ponte idempotente existente: dinheiro, Pix e cartões manuais, parcelas agrupadas em centavos, desconto autorizado e operador no registro local. Cadastro real usa `precoVenda`; o fallback `preco` atende somente cadastros antigos sem esse campo. Preço inválido ou diferente do carrinho, fiado, TEF, fiscal ativo, comanda legada e embalagem alternativa são recusados nessa integração. O diário guarda a tentativa antes da baixa; pagamento pendente exige retomada pelo controle integrado. Login alterado durante a operação conserva a pendência.

Os comandos nativos de abrir/fechar caixa encaminham ao controle integrado existente, evitando gravação de turno exclusivamente local. O fundo do turno passa a compor o saldo da gaveta antes do resumo encerrado, sem duplicá-lo após incorporar esse resumo. O fechamento continua em duas etapas: restaurante no servidor e conferência do caixa completo; não há conciliação automática de dinheiro físico nem unificação remota de sangrias.

Evidências locais: `output/cadastro-preco-integracao-interface.log` (suíte de painéis com produto no cadastro real), `output/aplicativo-sessao-operador-local.log` (32 testes de sessão/runtime), `output/venda-aplicativo-local.log` (35 testes de venda/ponte), `output/caixa-aplicativo-local.log` (29 testes de caixa, permissões e adaptador). O ensaio Electron com servidor local está em `output/venda-aplicativo-completo-integracao.log`: três vendas, confirmação HTTP interrompida, bloqueio de nova tentativa, reinício e retomada; encerramento com R$24 de dinheiro/R$6 Pix e próximo turno com R$15 de fundo. A regressão legada está em `output/aplicativo-nativo-regressao.log` (51 testes principais e 26 TEF simulados). Totais de rodadas incluem casos repetidos.

Limites: modo exclusivamente local de desenvolvimento; não habilita produção. Delivery/garçom, backup completo, autorização remota por funcionário, integração fiscal/TEF, equipamentos e outros segmentos ainda exigem os ensaios do plano. Nenhum acabamento visual foi iniciado.

## Mesas da gerência e preparo sem KDS

Configuração administrativa passou a carregar mesas em páginas de 200, preservando seleção e recusando continuação com revisão antiga ou sessão/loja alterada. Insumos, fichas e membros continuam com limite de 200 por seção; esta entrega não amplia todos os cadastros. A interface editou uma mesa da última página entre mais de 200 registros.

Sem KDS, mesa e retirada podem avançar manualmente no caixa autorizado, sem depender de garçom ou de impressão. Reativar KDS retira esses controles e o servidor recusa o caminho antigo. Delivery mantém seu despacho com responsável. O recebimento de pedido/conta não implica preparo, e imprimir não confirma preparo/entrega. A nova lista mostra até 50 pedidos por tipo; paginação adicional segue vinculada à homologação de volume.

Evidências de servidor: 35 testes de configuração/cozinha aprovados em `output/configuracao-preparo-servidor-interface.log`. A mesma execução confirmou os controles sem KDS e a edição administrativa paginada na interface. A regressão legada passou: 51 testes principais e 26 testes TEF simulados em `output/legado-regressao-recuperacao.log`. Nenhuma cobrança, impressão física, publicação ou mudança de estilo foi realizada.


## Proteção das rotinas do aplicativo e pendências de atendimento

Rotinas do StorageService agora recusam venda direta, reaplicação de diário, numeração, exclusão/arquivamento de turno, movimentos de estoque, comandas e registros financeiros quando há marcador de recuperação, inclusive vazio ou corrompido. A inicialização conserva o perfil para permitir a abertura da recuperação. Pendências V2 e produtos migrados também são protegidos fora do modo de teste, preservando a operação legada sem esses marcadores. Isso prepara a integração, mas não significa que todos os módulos estejam conectados ao novo login/serviço.

Consulta paginada de contas abertas e pedidos ainda não recebidos no caixa: 50 por página, restrita ao caixa autorizado da loja, com filtro e cursor vinculados à identidade. Contatos e itens não são retornados. Consulta disponível no perfil recuperado bloqueado, sem receber pedidos, encerrar contas ou liberar operações. Mudança de acesso/conexão limpa a lista. As páginas são consultas no tempo, não um retrato único da loja; seus valores não representam saldo a receber.

Evidências: 58 testes locais em `output/rotinas-legadas-recuperacao-local.log`; quatro testes de servidor e instalação/recarga em Electron oculto em `output/pendencias-recuperacao-servidor-interface.log`. A interface percorreu 55 contas (50/5), voltou de página e consultou pedido pendente com o perfil ainda bloqueado. Não houve escrita de vendas, alteração do estoque ou recebimento do pedido por essa consulta.


## Catálogo e conferência aritmética de caixa

Catálogo: categorias, ordenação, descrição, URL pública Cloudinary restrita, limites de tamanho e publicação/pausa manual. O consumidor filtra categorias e recupera envio com resposta perdida mesmo após pausar o catálogo. Imagem indisponível não bloqueia pedidos. Nenhum upload Cloudinary ou publicação remota foi realizado.

Evidências: `output/catalogo-publicacao-servidor.log` (38 testes); `output/catalogo-restaurantes-interface.log` (suíte completa de consumidor e PDV concluída, incluindo cadastro/convite de garçom, delivery, caixa, cozinha e recuperação); capturas 360 e 1080 px em `output/catalogo-funcional`. Builds locais concluídos. O build do cardápio conserva aviso de chunk principal superior a 500 kB.

A conferência do backup passou a comparar retiradas com total de sangrias, saldo esperado, contagem e diferença em centavos, sem somar novamente recebimentos de restaurante já consolidados. Divergências aritméticas impedem gravação no ensaio de restauração; arquivos incompletos, turnos abertos e suprimentos permanecem pendências. A checagem não verifica se todas as vendas/retiradas existem no arquivo e não libera o perfil recuperado. São 23 testes locais de conferência, ciclo de caixa e restauração aprovados (`output/gaveta-recuperacao-local.log`). A rodada completa do PDV oculto também passou (`output/gaveta-recuperacao-interface.log`), incluindo o aviso de pendência da gaveta no histórico e a transferência de terminal.


## Continuação — perfil operacional, histórico de delivery e contas de garçom

- `npm run start:homologacao` inicia um perfil local próprio (`flowpdv-homologacao`), separado do laboratório e do perfil real. Continua bloqueando rede externa, cobrança e impressão física. É exclusivo de desenvolvimento. A autorização de novas vendas exige adesão explícita; a compatibilidade legada do laboratório não basta. Os painéis existentes são reutilizados; ainda falta a integração ao login e a todos os módulos do aplicativo normal.
- Consulta protegida de entregas em páginas de 25, com filtros de andamento/finalizadas/canceladas, navegação anterior/próxima e acesso aos detalhes. Ordenação por código, não por data. A página é uma consulta pontual: atualizar confere mudanças; o painel inicial continua mostrando até 50 entregas ao vivo. Cursor não atravessa loja/filtro; revogação bloqueia a próxima página.
- Convite gerencial por e-mail, válido por 24 horas. O token só aparece na resposta e no fragmento do link; o banco guarda hash. Novo convite invalida o anterior; revogação do convite não revoga um funcionário já vinculado. Aceitação exige e-mail verificado correspondente, preserva outros papéis e não reativa acesso revogado por replay.
- Garçom pode criar conta, solicitar verificação, confirmar o e-mail, aceitar convite e recuperar senha. Na validação, códigos de ação foram gerados e consumidos no emulador; nenhum e-mail real foi enviado. Publicação HTTPS, domínio de ações e entrega de e-mails reais continuam pendentes.
- Mesas do garçom são carregadas em páginas de 200, sem limite total fixo na interface. Pedidos pendentes de mesa desativada continuam acessíveis para retomada.

Evidências: `output/perfil-operacional-local.log` (25 testes), `output/perfil-operacional-interface.log` (fluxo oculto), `output/consulta-entregas-servidor.log` (4 testes), `output/garcom-contas-servidor.log` (28 testes) e `output/restaurantes-contas-historico-interface.log` (consumidor/garçom/PDV completos). A interface percorreu 53 entregas, mais de 200 mesas, verificação por código do emulador, convite e recuperação de senha. Os totais de rodadas incluem regressões e não devem ser somados como casos exclusivos.

## Complemento — infraestrutura de acesso sem dependência das telas

`servicos-acesso-local.js` reúne Firebase, emuladores, persistência e criação do ciclo de acesso, recebendo explicitamente o armazenamento do perfil. Não depende de DOM nem de `window`. `sessoes-homologacao.js` permanece como adaptador do aplicativo e observador de mudanças de identidade. Os nomes dos aplicativos Firebase foram preservados, inclusive a chave usada na instalação de perfil recuperado.

Terminal e gerente continuam em sessões separadas, respectivamente com persistência local e em memória no preparo do acesso. O serviço recusa uso fora de homologação local, armazenamento ausente, aplicativo Firebase preexistente não configurado por ele e tentativa de reutilização após falha parcial de conexão aos emuladores. Não altera a conta Firebase legada nem cria automaticamente outro terminal.

Validação local: 27 testes de serviço, isolamento de interface, ciclo de acesso e resposta de sessão passaram (`output/servicos-acesso-local.log`). Essa extração não habilita ambiente remoto nem conclui a conexão ao login/perfil operacional do aplicativo completo; essas pendências continuam no plano.

Regressão da interface aprovada integralmente em `output/servicos-acesso-interface.log`, com Electron oculto e emuladores: clássico/moderno, configuração, delivery, caixa, cozinha, suspensão, recarga, transferência e recuperação. Bundle gerado com sucesso. Não houve mudança visual nem publicação.

## Complemento — revogação e respostas após troca de sessão

Em 22/09/2026, a suíte de recuperação passou com 15 testes no Firebase local/Node 22 (`output/recuperacao-revogacao-final.log`). Os três cenários acrescentados verificam: origem revogada sem permissão para confirmar/cancelar/repetir a baixa; substituto autorizado resolve a pendência durante suspensão sem vender novamente; cancelamento devolve estoque uma vez e bloqueia reenvio; confirmação e cancelamento concorrentes produzem um único resultado e zeram a pendência do turno.

`chamada-sessao-v2.js` passa a proteger as chamadas das sessões de homologação: confere a sessão e o bloqueio de recuperação antes do envio e antes de devolver o resultado ao consumidor. Respostas de sessão antiga são recusadas, inclusive quando há novo login com o mesmo UID. Não há repetição automática nem limpeza da tentativa. A operação pode ter sido concluída remotamente e deve ser retomada pela identidade autorizada.

Quatorze testes locais de acesso/chamada de sessão passaram (`output/acesso-sessao-local-final.log`), incluindo troca de conta durante resposta, preservação do journal real da ponte de venda, logout, bloqueio de recuperação iniciado durante a chamada e preservação do erro de transporte. A primeira rodada da interface identificou que a verificação precisava aguardar `authStateReady()` na recarga; essa espera foi acrescentada e ganhou teste de regressão. Isso não substitui a validação do aplicativo operacional completo nem promete detectar revogação remota instantaneamente sem consulta ao servidor.

A rodada corrigida da interface passou integralmente em `output/acesso-sessao-interface-validado.log`: fluxos locais clássico/moderno, login/recarga/revogação, delivery, caixa/estoque, reconstrução, transferência e conferência de recuperação. Electron permaneceu oculto. Bundle atualizado com `npm run bundle`. Nenhuma publicação nem impressão física.

Atualização de 22/09/2026. Referência de escopo: [plano completo](../PLANO-COMPLETO-FLOWPDV.md).

## Resultado desta sequência

O ambiente local passou a separar o acesso do gerente e do terminal, proteger dados V2 contra restauração legada e conferir backups com o servidor. Agora há também transferência administrativa de caixa para equipamento novo, com revogação do anterior, auditoria e retomada da mesma requisição após falha de comunicação.

| Parte | Entrega | Evidência/limite |
|---|---|---|
| 8A | Ciclo de autenticação separado das telas, descarte de respostas antigas | Testes locais e Electron; sem integração ao login normal |
| 8B | Proteção contra sobrescrita por backup/sincronização legada | Bases legadas comuns preservadas; bases V2 exigem fluxo próprio |
| 8C | Backup financeiro sem credenciais e restauração em armazenamento vazio | Falhas de disco e retomada ensaiadas |
| 8D | Interrupção efetiva de requisições na sessão Electron | Não equivale a desligar computador ou rede física |
| 8E | Consulta de vendas/estornos e divergências do turno | Apenas leitura; limites explícitos de volume |
| 8F | Retomada de pendência com sessão Firebase nova do UID original | Emuladores; sem copiar token no arquivo |
| 8G | Conferência de recuperação na interface | Diagnóstico, sem importação sobre perfil aberto |
| 8H | Comparação de unidade, inventário de corte e saldo atual | Não substitui contagem física |
| 8I | Transferência da identidade financeira entre caixas | Mesmo gerente/loja, origem revogada, destino sem histórico |
| 8J | Interface da transferência e journal administrativo | Fluxo completo aprovado; captura em duas resoluções |
| 8K | Restauração isolada ligada à identidade autenticada/delegada | Ensaio integrado aprovado; venda única e estoque preservado |
| 8L | Cópia com vendas/estornos confirmados posteriores ao backup | Sem reaplicar efeitos remotos; somente turno aberto |
| 8M | Inventário e conferência das vendas locais do histórico | Até 50 turnos, com recusa de truncamento e mudanças concorrentes |
| 8N | Preparação e salvamento de cópia recuperada pela interface | Revalidação antes do download; caixa aberto preservado |
| 8O | Perfis de teste separados para origem e destino | Persistência e isolamento verificados em três inicializações do Electron |
| 8P | Instalação com journal e bloqueio persistente | Falha de disco e retomada; sessão própria excluída do arquivo/journal |
| 8Q | Instalação real pela interface no perfil nomeado | Autenticação preservada após recarga, sem novas vendas nem alteração de estoque |
| 8R | Conferência de movimentos e resumos encerrados do restaurante | Divergência impede instalação; sangrias e contagem consolidada continuam pendentes |
| 8S | Diagnóstico dos resumos na consulta de histórico/arquivo | Diferenças por turno, sem modificar dados; interface inspecionada em duas resoluções |

## Validação registrada

- 50 testes locais de acesso, backup, recuperação, diagnóstico e isolamento aprovados na rodada final (`output/etapas-8-validacao-local-final.log`).
- 66 testes de servidor aprovados após a transferência/journal (`output/etapa-8i-8j-servidor.log`).
- Fluxo completo de interface aprovado em `output/etapa-8j-interface.log`: clássico/moderno, pedidos, cozinha simulada, fechamento, recuperação e transferência. Verificações finais no servidor confirmaram saldos e ausência de duplicações esperadas.
- Bundle compilado. Testes executados sem abrir janelas para acompanhamento.
- A validação integrada da 8K passou nos nove testes da suíte de recuperação (`output/etapa-8k-servidor-validacao.log`). Detalhes em [restauração autorizada](restauracao-autorizada-etapa-8k.md). Os números das rodadas não devem ser somados como casos exclusivos: há testes repetidos entre elas.
- Instalação real em perfil nomeado aprovada em `output/etapa-8q-interface-final.log` e repetida após a conferência financeira em `output/etapa-8r-interface.log`. Detalhes em [8P–8Q](instalacao-perfil-etapas-8p-8q.md).
- Na etapa 8R, 24 testes locais e 12 testes integrados de recuperação aprovados (`output/etapa-8r-local-final.log` e `etapa-8r-servidor.log`). O resumo inclui pagamentos divididos, estorno e conferência de fechamento, sem recompor saldos remotamente. Detalhes em [8R](conferencia-fechamento-etapa-8r.md).
- Fluxo completo da interface aprovado novamente em `output/etapa-8s-interface.log`, incluindo o diagnóstico de resumo ausente no arquivo, preservação do histórico local e ambos os layouts. Capturas inspecionadas em duas resoluções; bundle atualizado. Detalhes em [8S](diagnostico-fechamentos-etapa-8s.md).

## O que ainda impede considerar o produto completo

Atualização posterior: 26 testes locais da reconstrução/conferência aprovados, onze testes da suíte de recuperação no servidor aprovados e fluxo completo da interface aprovado em `output/etapa-8n-interface-final.log`. Outros oito testes do perfil e três inicializações ocultas do Electron passaram em `output/etapa-8o-local.log` e `etapa-8o-electron.log`. Detalhes em [8L–8N](recuperacao-posterior-etapas-8l-8n.md) e [8O](perfis-isolados-etapa-8o.md). Os totais de rodadas não representam casos exclusivos somáveis.

1. Integrar os serviços ao perfil operacional e ao login do aplicativo completo.
2. Completar recuperação de turnos fechados/ausentes, fechamento e movimentos ainda não cobertos, além da paginação e da política de liberação. Instalação/retomada no perfil novo foi validada em 8P–8Q; vendas/devoluções confirmadas do turno aberto e conferência das vendas locais do histórico foram entregues em 8L–8N.
3. Validar todos os recursos necessários ao piloto nos dois layouts e preservar as rotinas dos demais segmentos.
4. Preparar e publicar homologação HTTPS, QR de uso no celular e validar dispositivos/rede móvel.
5. Homologar impressoras e periféricos físicos.
6. Ensaiar instalador, implantação, monitoramento, suporte e turno completo da loja piloto.
7. Concluir delivery, garçom, catálogo ampliado, pagamentos integrados, fiscal, gestão comercial e relatórios, conforme os aceites do plano mestre.

Não houve publicação, contratação de serviço, cobrança ou impressão física. Nenhuma frente inteira foi marcada concluída apenas por essas subetapas. As escolhas comerciais, equipamentos e credenciais de homologação externa precisam ser definidos para as respectivas integrações; o desenvolvimento local não comprova operação 100% pronta em loja real.
