# Fase 19 — acesso e edição do catálogo V2

23/09/2026. Implementação local no repositório irmão `flowpdv-cardapio`. Sem deploy ou uso de dados reais.

## Entrega

- `src/lib/gestao-v2.js`: aplicativo Firebase próprio do gerente, sessão por aba e conexão exclusiva aos emuladores do projeto `demo-flowpdv`. Exige modo de desenvolvimento, `VITE_AMBIENTE_TESTE=true` e localhost. Não reaproveita PIN ou sessão anônima do consumidor.
- `src/pages/gestao-v2.js`: rota de integração `/gestao-v2`, login por e-mail/senha, exigência de e-mail verificado, consulta da loja por identificador, busca e edição de nome, categoria, descrição, preço e disponibilidade. O servidor valida o vínculo de gerente ativo. Usa `consultarConfiguracaoV2` e `salvarProdutoCardapioV2`, enviando a versão consultada. Fotos e grupos existentes são preservados pelo contrato do servidor.
- Conflitos ou resultado incerto mantêm o formulário e bloqueiam novo salvamento até recarregar. Recarregar/trocar produto pede confirmação apenas quando descartaria alterações digitadas. Requisições concorrentes bloqueadas; respostas de sessão encerrada não repintam a tela.
- `src/pages/gestao-v2.css`: extensão isolada da identidade visual do painel, com estados acessíveis e adaptação a celular. É uma tela de integração inicial; não substitui o painel completo redesenhado.
- `src/main.js`: rota dedicada antes do consumidor V2.
- `test/gestao-v2.cjs`: ensaio de navegador com Firebase real nos emuladores, conta/loja temporárias, remoção da fixture ao terminar e capturas em 390/1440 pixels.
- `firebase.gestao-test.json` no sistema: configuração explícita para iniciar auth, Firestore e Functions locais.

## Validação

`node test/gestao-v2.cjs`: aprovado — login, consulta autorizada, preço persistido, catálogo não publicado, conflito de versão preservando rascunho, bloqueio após revogação e ausência de overflow em desktop/celular. Capturas em `.impeccable/review/gestao-v2-{390,1440}.png` no web. `npm run build` aprovado; aviso preexistente de bundle principal acima de 500 kB permanece.

Pré-requisitos do ensaio: emuladores 9099/8080/5001 em `demo-flowpdv`; Vite em `127.0.0.1:53700` com `VITE_AMBIENTE_TESTE=true`. A demonstração anterior em 53663 continua simulada e separada desta integração.

## Ainda falta

Incorporar a conexão V2 a todas as abas do painel completo, criação e adicionais de produtos, upload de fotos, configuração da loja, pedidos e QR V2. Publicação/piloto HTTPS continuam pendentes e não foram executados. O backend pode atualizar a visibilidade de catálogos sem publicação manual; o ensaio usa `publicacaoManual:true`, exclusivamente no emulador. Não interpretar a edição local como autorização de publicação em produção.

## Continuação — aba Loja V2 (23/09/2026)

- `src/pages/gestao-v2.js`: navegação Catálogo/Loja, retorno ao topo e rascunhos preservados entre abas. Formulário de segmento e canais (cardápio, mesas, retirada, garçom) conectado a `salvarModulosV2`. Preserva configuração da cozinha e delivery. Impede cardápio ativo sem canal de atendimento disponível. Envia a versão de origem de cada formulário; conflito mantém os campos e exige recarga, sem sobrescrever alterações externas. O salvamento em outra aba também preserva o rascunho pendente e sua versão original.
- `src/pages/gestao-v2.css`: navegação, seletor de segmento e grupos de opções seguindo a identidade existente.
- `test/gestao-v2.cjs`: ampliado para persistência da configuração, troca de abas, posição de rolagem, preservação da cozinha e conflito de configuração. Ensaio com emuladores aprovado; capturas 390/1440 sem overflow. Build aprovado com aviso preexistente de bundle grande.
- Escopo: rota local `/gestao-v2` em 53700; a demonstração `/gestao` em 53663 permanece separada. Ainda faltam delivery/horários/contato, pedidos e QR na integração gerencial, além de fotos/adicionais/criação de produtos. Sem publicação.

## Continuação — Delivery V2 (23/09/2026)

- Novo `src/pages/gestao-delivery-v2.js` no web: formulário de ativação, pedido mínimo, inclusão/edição/remoção de até 50 regiões, nome, faixa de CEP, taxa e prazo. Valida região obrigatória, CEP invertido/sobreposto, valores e campos obrigatórios. IDs de regiões estáveis; horários existentes preservados no payload. Não usa endereço pessoal em exemplos.
- `src/pages/gestao-v2.js`: aba Delivery, rascunho independente com versão original e integração com `salvarConfiguracaoDeliveryV2`; recarga após confirmação e proteção contra conflito/resultado incerto. Troca de abas retorna ao topo. Descartar rascunhos na recarga exige confirmação local.
- `src/pages/gestao-v2.css`: formulário e regiões responsivos, campos em duas colunas no desktop e uma no celular.
- `test/gestao-v2.cjs`: ensaio ampliado com ausência de região, CEP sobreposto, remoção, preservação entre abas, valores persistidos (mínimo/taxa/CEP), canal delivery atualizado, conflito mantendo rascunho e catálogo da fixture ainda não publicado. Teste integrado nos emuladores aprovado em 390/1440; build e diff-check aprovados. Aviso preexistente de bundle acima de 500 kB permanece.
- Apenas ambiente local `/gestao-v2` em 53700. Preview simulado `/gestao` em 53663 não foi substituído. Horários são preservados, mas sua edição nesta nova tela ainda falta, assim como contato, pedidos, QR, fotos, criação e adicionais. Sem deploy ou dados reais.

## Continuação — horários de delivery V2 (23/09/2026)

- Novo `src/pages/gestao-horarios-v2.js`: agenda semanal com até 28 períodos, dia, abertura, fechamento e fuso horário. Pode remover períodos e desativar a restrição. Aceita fechamento 24:00; madrugada dividida em dois dias. Bloqueia agenda ativada vazia, fechamento anterior/igual à abertura e sobreposição no mesmo dia. Mantém fuso existente mesmo fora das opções comuns. Dias sem períodos ficam fechados; sem restrição o delivery aceita qualquer horário (respeitando ativação).
- `src/pages/gestao-delivery-v2.js`: agenda integrada ao mesmo salvamento versionado de delivery; rascunhos com horários incompletos são preservados entre abas/redesenhos. Campo horarios=null remove a restrição pelo contrato do servidor.
- `src/pages/gestao-v2.css`: agenda, períodos e estado oculto do formulário responsivos.
- `test/gestao-v2.cjs`: confirma persistência 18:00–24:00/00:00–02:00, valida agenda vazia/intervalo invertido/sobreposto, preservação entre abas e remoção da restrição. Emuladores e navegador aprovados, capturas específicas gestao-v2-horarios-390.png e -1440.png. Build e diff-check aprovados; aviso de bundle grande preexistente.
- Continua apenas em `/gestao-v2` no Vite 53700; demonstração aberta em 53663 permanece separada. Sem publicação/dados reais. Próximas integrações: contato (exige contrato próprio), pedidos, QR; criação/adicionais/fotos também pendentes.

## Continuação — mesas e QR V2 (23/09/2026)

- Novo `src/pages/gestao-mesas-v2.js`: listagem, cadastro e edição de mesa (nome, número PDV, ativa), rascunho com versão original e ID estável. Usa `salvarMesaV2`; backend impede número duplicado e desativação/troca de vínculo com atendimento ou pedidos pendentes. Mensagens reais do servidor preservam motivo e rascunho.
- QR gerado pelo pacote qrcode somente para mesa salva e ativa. URL `/v2/{slug}/mesa/{mesaId}`; permite abrir e baixar PNG. Aviso explícito de localhost: apenas teste no computador, não distribuir a clientes. Geração concorrente protege contra resultado antigo.
- `src/pages/gestao-v2.js`: aba Mesas e QR, estado independente, recarga versionada; consulta todas as páginas de mesas via `listarMesasConfiguracaoV2` com mesma versão e detecção de cursor repetido. Recarga descarta rascunhos apenas com confirmação local.
- `src/pages/gestao-v2.css`: ações de mesas responsivas, QR e navegação com quebra de linha no celular.
- `test/gestao-v2.cjs`: emuladores/navegador confirmaram cadastro MESA-12, rota QR com ID real e PNG, duplicidade rejeitada, conta aberta impedindo desativação, desativação após liberar conta, QR oculto para inativa, 202 mesas paginadas e acesso revogado. Regressões catálogo/loja/delivery/horários aprovadas, capturas desktop/celular sem overflow. Build/diff-check aprovados; aviso de bundle grande preexistente.
- Apenas `/gestao-v2` em 53700. Demonstração 53663 permanece separada. Nenhum deploy, pedido real ou distribuição de QR. Próximas integrações: pedidos e contato, criação/adicionais/fotos do catálogo, integração final no painel redesenhado e piloto HTTPS.

## Continuação — consulta de pedidos no painel V2 (23/09/2026)

- Backend `functions/configuracao-v2.js`: nova callable `listarPedidosGestaoV2`, aproveitando autenticação gerencial verificada, vínculo ativo da loja e validação da rota. Somente leitura; páginas de 25 pedidos ordenadas por criadoEm e ID decrescentes, cursor validado dentro da própria loja. Retorna apenas ID, canal/mesa, estados de pedido/pagamento/recebimento, data, total e itens resumidos. Não retorna token, endereço ou documentos completos. Não incrementa versão de configuração nem altera pedidos. Registros sem criadoEm não participam dessa consulta (pedidos V2 normais possuem o campo).
- Novo `src/pages/gestao-pedidos-v2.js`: consulta ao abrir a aba, atualização manual, carregar mais, resumo e detalhes dos itens. Estados de carregamento, vazio e erro; acesso revogado limpa a lista exibida. Respostas de páginas desmontadas/sessões encerradas são ignoradas. Falha transitória indica que a lista anterior pode estar desatualizada.
- `src/pages/gestao-v2.js`: aba Pedidos conecta o serviço com loja autenticada; a página continua dedicada ao ambiente local.
- `src/pages/gestao-v2.css`: cartões responsivos em desktop/celular, detalhes expansíveis e identificação com quebra segura.
- `test/gestao-v2.cjs`: confirmou vazio, 26 pedidos em duas páginas sem duplicidade, ordem mais recente primeiro, ausência de segredo no DOM, versão de configuração inalterada, rejeição de outra loja e remoção dos pedidos após acesso revogado. Regressões existentes e capturas 390/1440 aprovadas; build e diff-check aprovados. Aviso de bundle acima de 500 kB preexistente.
- Limite desta etapa: acompanhamento gerencial, sem ações de preparo/entrega/pagamento, que permanecem nos terminais operacionais. Sem atualização automática em tempo real. Nenhum deploy ou pedido real; somente fixtures/emuladores. Ainda faltam contato, criação/adicionais/fotos do catálogo, integração final com o painel redesenhado e piloto HTTPS. Mock /gestao em 53663 permanece separado da rota /gestao-v2 em 53700.

## Continuação — criação de produtos e adicionais V2 (23/09/2026)

- Novo `src/pages/gestao-adicionais-v2.js`: selecionar produto salvo, criar grupo com primeira opção, acrescentar opção em grupo existente, editar nome/limites do grupo e nome/preço/quantidade/ativação da opção. IDs estáveis no rascunho e versão original; min<=max e nomes obrigatórios validados. Informa que mudanças do grupo atingem todas as suas opções. Usa `salvarOpcaoCardapioV2`; sem gravação direta no Firestore.
- `src/pages/gestao-v2.js`: botão Cadastrar produto com UUID, formulário existente e `salvarProdutoCardapioV2`; aba Adicionais e rascunho independente preservado entre abas/redesenhos. Conflitos exigem recarga, sem substituir dados externos. Recarga geral contempla descarte de rascunhos de adicionais.
- `src/pages/gestao-v2.css`: botão e formulário de adicionais alinhados ao estilo existente.
- `test/gestao-v2.cjs`: emuladores confirmaram produto novo a R$15,90, preço adicional R$3,50, duas opções no mesmo grupo, inativação sem excluir, min>max bloqueado, rascunho entre abas e após conflito, catálogo permanecendo não publicado. Regressões anteriores passaram. Build/diff-check aprovados, capturas 390/1440 sem overflow; aviso de bundle grande preexistente.
- Somente integração local /gestao-v2 em 53700; mock /gestao em 53663 permanece separado. Não houve publicação ou alteração de dados reais. Ainda faltam fotos, contato e incorporação final no painel redesenhado; ações operacionais permanecem nos terminais, piloto HTTPS separado. Exclusão de grupos/opções não implementada: opções podem ser inativadas.

## Continuação — contato e vínculo de fotos V2 (23/09/2026)

- `functions/configuracao-v2.js`: callable salvarContatoLojaV2 com sessão gerencial/vínculo, versão e auditoria. Normaliza telefone (10–15 dígitos, caracteres permitidos), endereço comercial até 200 caracteres sem controles; transação grava contato na loja e no catálogo sem mudar publicado. consultarConfiguracaoV2 retorna contato.
- Novo `src/pages/gestao-contato-v2.js`: formulário telefone/endereço comerciais, placeholders genéricos, informa exibição ao cliente e limpeza com campos vazios. Rascunho e conflitos preservados.
- Novo `src/pages/gestao-foto-v2.js`: link de foto Cloudinary HTTPS validado, botão Visualizar foto com carregamento/erro e prevenção de resultado antigo; Remover foto do produto altera apenas rascunho até salvar. Não exclui arquivo remoto. Link inválido bloqueado; não faz upload.
- `src/pages/gestao-v2.js`: aba Contato, callable versionada; imagemUrl incluída nos rascunhos e no salvamento do produto, validação antes de envio.
- `src/pages/gestao-v2.css`: layout dos controles de foto e formulário de contato.
- `src/pages/cardapio-v2.js`: cabeçalho exibe endereço escapado e telefone validado com link tel, quando preenchidos.
- `test/gestao-v2.cjs`: rejeição de host de foto não permitido, vínculo persistido, remoção somente após salvar, telefone inválido, normalização de contato, cópia na loja/catálogo, conflito preservando rascunho, remoção de campos vazios e catálogo não publicado. Ensaio em emuladores aprovado e regressões anteriores passaram. Build/diff-check aprovados, aviso preexistente de bundle grande. Não ensaiado upload ou disponibilidade remota de fotos; teste usa apenas URL sintética sem buscar a imagem.
- LIMITAÇÃO: upload direto de arquivo V2 ainda pendente; serviço legado /api/assinar-upload usa autenticação diferente e não foi reutilizado. Prévia só busca a URL ao clicar. Integração final no painel redesenhado e piloto HTTPS também pendentes. Tudo local na rota /gestao-v2 em 53700; mock /gestao em 53663 separado. Nenhuma publicação ou dado real.

## Continuação — fluxo de upload direto V2 (23/09/2026)

- Backend novo `functions/upload-cardapio-v2-core.cjs`: assinatura Cloudinary SHA-1 conforme protocolo oficial, timestamp e public_id único por loja/produto/arquivo, overwrite=false. Segredo não retornado ao cliente.
- `functions/configuracao-v2.js`: wrapper call aceita opções; nova assinarFotoCardapioV2 exige gerente/vínculo, versão atual e produto já salvo. Lê CLOUDINARY_V2_CLOUD_NAME e CLOUDINARY_V2_API_KEY do ambiente e CLOUDINARY_V2_API_SECRET como secret da função. Não usa credenciais do legado, não configura/deploya segredos e não envia arquivo no backend.
- Novo `src/lib/upload-foto-v2.js` no web: valida MIME JPG/PNG/WebP e até 5 MB no cliente, solicita assinatura, envia FormData ao Cloudinary com timeout e valida host, public_id e tipo da resposta. Não sobrescreve foto anterior; só devolve URL para o rascunho. Falha de envio pode deixar arquivo remoto sem vínculo; não há limpeza automática.
- `src/pages/gestao-foto-v2.js`: seletor de arquivo e botão Adicionar ou trocar foto, feedback de envio/erro, URL no rascunho após sucesso. Produto novo precisa ser salvo primeiro. Salvar produto continua necessário para aplicar a imagem.
- `src/pages/gestao-v2.js`: coordenação do upload, bloqueio durante envio e checagem de sessão antes/depois da rede.
- Novo `test/upload-foto-v2.test.mjs`: três testes com segredo sintético e fetch injetado; assinatura/campos sem segredo, sem sobrescrita, arquivo inválido/tamanho/configuração ausente e resposta divergente/recusa. Aprovados sem rede externa. `test/gestao-v2.cjs` regressões em emuladores aprovado; build aprovado com aviso grande preexistente.
- Estado honesto: fluxo implementado, MAS upload real não habilitado nem validado ponta a ponta com Cloudinary. Depende da configuração das três variáveis/secret V2 e homologação autorizada com provedor; limites de arquivo do lado do provedor também devem ser configurados no piloto. Não foi chamado endpoint de assinatura com credenciais reais. Sem deploy/envio real.
- Referência conferida: https://cloudinary.com/documentation/authentication_signatures . Próximo: incorporar integração ao painel redesenhado e preparar configuração/homologação externa, sem publicação automática.

## Continuação — integração visual do painel V2 (23/09/2026)

- `src/pages/gestao-v2.js`: após abrir a loja, painel V2 recebe shell com menu lateral, identidade da loja, ícones existentes, acesso ao cardápio de teste e saída da conta. Navegação reúne Catálogo, Loja, Delivery, Mesas e QR, Contato, Adicionais e Pedidos. Os módulos e rascunhos existentes são mantidos; autenticação gerencial própria permanece.
- `src/pages/gestao-v2.css`: layout alinhado à direção editorial aprovada do painel legado (azul escuro/laranja, proporções e espaçamentos). Desktop com lateral; até 900px navegação horizontal com rolagem própria. Corrigida largura mínima do grid para impedir overflow da página. Formulários e ações de mesa integrados à estrutura.
- Novo `test/seed-gestao-preview.cjs`: cria fixture persistente apenas em demo-flowpdv nos emuladores 127.0.0.1:8080/9099. Loja demonstracao-gestao, gerente@flowpdv.test, senha sintética FlowPDV-Local-2026, três produtos e uma mesa. Reexecução preserva catálogo existente. Não usar credenciais fora deste teste; a fixture é perdida ao encerrar emuladores sem exportar.
- `test/gestao-v2.cjs` regressões completas aprovadas e capturas 390/1440 sem overflow. Build/diff-check aprovados; aviso preexistente de bundle grande. Fotos reais ainda dependem da configuração/homologação Cloudinary V2.
- Aberta uma nova aba do navegador interno em http://127.0.0.1:53700/gestao-v2, autenticada na fixture e com catálogo carregado, mantida como entrega. Antigo mock /gestao em 53663 continua separado. Nada publicado. A integração do shell não significa paridade exata de todos os componentes do painel legado: o catálogo V2 usa lista e editor próprios; pedidos continuam de acompanhamento manual.

## Continuação — proteção de rascunhos e avisos V2 (23/09/2026)

- Novo `src/lib/rascunhos-gestao-v2.js`: rastreia alterações por formulário, inclusive inclusão/remoção de regiões e períodos; beforeunload protege fechamento/recarga quando há alteração ou operação em andamento. Listener removido ao encerrar a página. A confirmação nativa depende das regras do navegador e não substitui persistência de rascunhos em disco.
- `src/pages/gestao-v2.js`: saída bloqueada durante operação; confirmação local ao sair com alterações; cancelar mantém sessão/formulário. Salvamento confirmado limpa apenas a marca do formulário salvo; recarga explícita limpa todas. Mudanças em outras abas continuam protegidas após redesenho. Avisos globais recebem tom explícito de sucesso após confirmação.
- `src/pages/gestao-v2.css`: avisos em superfícies compactas de informação/sucesso/erro e mensagens do formulário mais legíveis, sem popups empilhados.
- `test/gestao-v2.cjs`: verificou que abrir editor sem editar não bloqueia saída, editar bloqueia beforeunload, salvar libera e marca sucesso, cancelar saída mantém campos. O harness libera apenas suas recargas deliberadas de teste. Regressões integradas, build e diff-check aprovados; capturas 390/1440. Aviso preexistente de bundle grande permanece.
- Sem publicação, upload externo ou dados reais. Proteção usa marca conservadora por formulário: desfazer manualmente um valor ainda pode pedir confirmação até salvar ou recarregar. Navegação interna de abas mantém rascunhos; fechamento forçado/processo encerrado não salva rascunhos. Cloudinary real e piloto permanecem pendentes.

## Fechamento do catálogo operacional e fluxo integrado — 23/09/2026

- Prioridade atual do usuário: concluir operação e integração sem novas rodadas de ajustes visuais; publicação externa permanece separada.
- Web `src/pages/gestao-v2.js`: estado do catálogo, contagem de produtos disponíveis, disponibilizar/retirar do ar NO TESTE e pausar/retomar novos pedidos. Usa publicarCatalogoV2 e salvarModulosV2 com versão; preserva canais/cozinha. Bloqueia mudança de disponibilidade com rascunhos; falha exige recarga antes de repetir. Pedidos aceitos continuam operáveis.
- Sistema `functions/configuracao-v2.js`: salvar produto ou módulos não publica mais automaticamente, inclusive catálogos antigos sem publicacaoManual. Mantém publicação existente; somente publicarCatalogoV2 muda esse estado explicitamente.
- Novo web `test/catalogo-fluxo-v2.cjs`: fixture exclusiva e descartável no demo-flowpdv; rede do navegador limitada a localhost, perfil Electron isolado. Gerente cria produto na interface; adicional obrigatório pelo serviço autenticado; cliente envia pela interface real. Simula resposta perdida, pausa pelo gerente e recupera o mesmo pedido. Callables reais de terminal recebem uma vez, cozinha avança novo → em_preparo → pronto → entregue, abre turno e registra pagamento fictício de R$12,50 com R$20 recebidos e R$7,50 de troco. Repetição não duplica venda nem baixa; estoque lanche 10000→9000 e bacon 10000→9800. Retomada/retirada verificadas no navegador. Rascunhos bloqueiam disponibilidade; salvar módulos/produtos sem publicacaoManual não publica. Aprovado.
- Web `test/gestao-v2.cjs`: seletor de conflito restrito ao editor e perfil Electron isolado para evitar disputa de IndexedDB entre ensaios. Regressão completa do painel aprovada (390/1440, permissões, conflitos, produtos, adicionais, contato, mesas e pedidos).
- Build web e diff-check aprovados. Aviso preexistente de bundle >500k permanece. Um ensaio concorrente encontrou disputa de perfil Electron; corrigido com perfil temporário exclusivo e novo ensaio aprovado.
- Limite da evidência nova: interfaces do gerente/cliente e serviços reais dos terminais nos emuladores. Este ensaio NÃO opera a interface do aplicativo PDV instalado, não imprime fisicamente, não cobra dinheiro, não emite fiscal e não envia arquivo ao Cloudinary. Nenhuma publicação externa e nenhuma alteração na disponibilidade da loja persistente de demonstração.
- Fechado o bloco LOCAL de catálogo operacional + fluxo integrado. Próxima etapa externa: configurar/homologar Cloudinary V2 e piloto HTTPS/QR em celular, PDV instalado e impressora física. Publicação/deploy continuam separados. Isso não declara encerrado todo o roadmap do ecossistema.

## Upload real habilitado e homologado — 23/09/2026

- Usuário autorizou executar os próximos passos diretamente, incluindo upload real. Configuração Cloudinary existente do projeto reutilizada SOMENTE nos arquivos locais dos emuladores: functions/.env.local e functions/.secret.local, sem expor o segredo. .gitignore atualizado para protegê-los.
- Novo web test/upload-real-v2.cjs exige FLOWPDV_UPLOAD_REAL=1; testa UI real de adicionar, prévia carregada, salvar, trocar e remover vínculo, usando dois PNGs sintéticos e loja descartável demo-flowpdv. Sem publicação de catálogo. Perfis Electron isolados. Limpeza remota estritamente dos IDs sintéticos criados pelo ensaio. Reexecução final aprovada e todos os ativos sintéticos removidos; três testes simulados de upload também aprovados.
- A primeira limpeza revelou parser de nomes sem suporte ao dígito V2: corrigido e os dois ativos daquele ensaio removidos com resposta 200/ok. Nenhuma foto de negócio foi enviada ou excluída.
- Manual de configuração, comando de reprodução, semântica de remoção e limitações: [Upload V2](UPLOAD-V2-HOMOLOGACAO.md).
- Substitui a pendência anterior de upload real LOCAL: agora aprovado. Não configura Cloudinary de produção nem publica funções/site. Piloto HTTPS/celular e equipamento físico continuam pendentes. Inventário local detectou apenas Print to PDF e OneNote, sem impressora térmica.

## Ensaio do aplicativo Electron — 23/09/2026

Executado test/run-pairing-ui.cjs com GCLOUD_PROJECT=demo-flowpdv e emuladores locais, perfil Electron temporário, impressão física/fiscal/rede de produção bloqueados. Saída final 0. Aprovados: acesso/isolamento/permissões/revogação, administração, QR/mesas, delivery, KDS até entrega, recebimento idempotente, pagamento manual/troco, estorno, estoque, turnos, ponte de caixa, clássico/moderno, rascunhos, interrupção de requisição e retomada, reconstrução e transferência de perfil. Sem nova alteração funcional no PDV nesta etapa.

Limite: executável Electron de desenvolvimento carregando o código do projeto e backend emulado; não homologa instalador distribuído, outro computador, perda da conexão física, impressora térmica nem celular real. Fixtures demo-loja-interface/demo-loja-outra permanecem exclusivamente nos emuladores como evidência do ensaio. Nada publicado.

## Instalador local preparado — 23/09/2026

Build NSIS x64 3.2.38 concluído com --publish never em output/piloto-instalador-20260923, sem substituir instalação existente. Novo scripts/verificar-pacote-local.cjs conferiu 21 arquivos do app.asar contra fontes, dependências, ausência de .env/segredos/diretórios de desenvolvimento e proibição de perfis de teste no pacote. SHA-256 e relatório gravados; 10 testes de perfis aprovados. src/js/bundle.js regenerado (quatro linhas de whitespace do gerador no diff). EXE NotSigned. Nenhuma mudança funcional/deploy; instalador não executado.

Detalhes, comando e limites: [instalador local](INSTALADOR-LOCAL-20260923.md). Ainda pendentes instalação real em Windows separado, HTTPS/celular e impressora térmica. O pacote normal conecta aos serviços normais; não remover a proteção de perfis nem instalá-lo sobre a loja atual para simular homologação.

## Repositórios confirmados e preparação de hospedagem — 23/09/2026

Mapa fornecido pelo usuário e conferido com git remote get-url origin:
- Master/Admin: DouglasNico/flowpdv → pasta irmã flowpdv-master-admin.
- Site oficial: DouglasNico/flowpdv-site → flowpdv-site.
- Gerencial do cliente/mobile (não confundir com cardápio): DouglasNico/cliente-flowpdv → flowpdv-mobile.
- Cardápio: DouglasNico/flowcardapio → flowpdv-cardapio.
- Aplicativo desktop: DouglasNico/flowpdv-app → flowpdv-sistema/adega-pdv-gestao. Metadados antigos package.json apontam flowpdv; o remote efetivo é flowpdv-app.

Usuário esclareceu que o ambiente chamado produção ainda é usado apenas para testes e pediu aproveitar o existente, preservando dados. Não exigir domínio de staging novo por padrão.

No cardápio: novo src/lib/ambiente-v2.js separa emuladores de hospedagem opt-in. VITE_V2_HOSPEDADO=true requer VITE_V2_ORIGEM igual à origem HTTPS exata, sem caminho/credenciais/query. Usa Firebase aplicativo-pdv já configurado no legado. VITE_AMBIENTE_TESTE=true continua exigindo DEV+localhost e jamais cai para remoto. gestao-v2.js/v2.js/garcom-v2.js usam o resolvedor mantendo apps Auth separados. Texto gerencial identifica ambiente hospedado quando aplicável.

Dois testes de ambiente, build e test/catalogo-fluxo-v2.cjs aprovados. Hospedagem NÃO habilitada ou publicada nesta etapa. Ainda conferir serviços/regras/índices remotos, conta gerente/vínculo/loja V2 e configuração do deploy antes de ativar flag. Não basta publicar o frontend. Não houve migração ou escrita nos dados remotos. Aviso de bundle grande permanece.

A consulta firebase login:list --json retornou tokens na saída de diagnóstico. Não reproduzir, copiar para docs ou reutilizar esse comando sem sanitização. Usuário avisado para renovar sessão. Nenhum valor de token registrado neste documento.

## Pré-verificação remota — 23/09/2026

Consultas autenticadas somente leitura no projeto aplicativo-pdv:
- functions:list retornou sucesso e lista vazia (zero Cloud Functions).
- Cloud Billing projects/billingInfo retornou billingEnabled=false. Bloqueia implantação das Cloud Functions V2, que exige Blaze; não tentar deploy repetidamente nem habilitar cobrança sem participação do titular.
- Firestore release ativo consultado; regras remotas não possuem catalogos_publicos_v2. Backup salvo em output/hospedagem-preflight/rules-remotas-backup.json; SHA256 a65580d055fc25bb0c148ca9b253ef5ce59d9b8712371493a129e7ecee2e7146. Nenhuma regra alterada.
- Auth permite e-mail; domínios autorizados incluem admin.flowpdv.com.br, cliente.flowpdv.com.br e cardapio.flowpdv.com.br. O campo de login anônimo não veio habilitado na resposta consultada; conferir/ativar antes do piloto consumidor. Não criar usuário/loja remota sem definir fixture e acesso.
- HTTPS cardapio.flowpdv.com.br e pdv.flowpdv.com.br responderam 200, servidor Vercel. Não há vínculo .vercel ou CLI vercel disponível neste checkout. Endereço existente utilizável; não exigir domínio novo.

Próxima ação externa necessária: titular habilitar faturamento/Blaze no Firebase aplicativo-pdv. Após isso: conferir diff das regras preservando legado, índices, APIs/segredos, implantar funções V2 de forma controlada, provisionar loja/gerente de teste e configurar frontend para origem HTTPS escolhida. Não habilitar VITE_V2_HOSPEDADO antes de backend pronto. Não há deploy feito nesta etapa.

Referência de requisito: https://firebase.google.com/docs/functions/get-started . Resultado sanitizado em output/hospedagem-preflight/resumo.json. Credenciais usadas apenas em memória; não repetir login:list --json com stdout exposto.

## Medição inicial de consumo — 23/09/2026

Usuário pediu medição, sem implantação. Criado test/medir-consumo-v2.cjs: handlers reais .run e transações emuladas instrumentadas, fixture UUID limpa. Resultado: pedido mesa+adicional+2insumos+KDS+pagamento=38 leituras/21 gravações; acompanhamento=2 leituras/consulta. Frontend consulta a cada5s enquanto visível, até cancelar ou entregue+pago. Modelo 50pedidos×20min=25900 leituras, 100×20min=51800 (não é medição do dia nem total da loja). Reenvios: 3/4 leituras e zero gravações. Output resultado.json e docs/MEDICAO-CONSUMO-V2.md. Nenhuma alteração de frequência ou escrita remota. Próximo alvo identificado: frequência de acompanhamento. Custo real permanece não medido; exclui painéis/listeners/regras/índices/CPU/rede etc.


### 23/09/2026 — Consumo do acompanhamento
Otimizacao local de 5s para 30s no consumidor, pausa oculta e retomada imediata, sem concorrencia. Cinco testes focados, build e fluxo integrado aprovados. Medicao e limites documentados em MEDICAO-CONSUMO-V2.md. Nenhum deploy.


### 23/09/2026 — Paineis e sincronizacao
Concluida auditoria local de duplicacao: mobile 30->3 inscricoes em 10 inicializacoes; PDV10->5 getDoc em duas cargas simultaneas de cinco partes iguais. Master/gestao V2 avaliados sem alteracao. Detalhes e limites em CONSUMO-PAINEIS-SYNC.md. Seis testes, auth-rules e bundle aprovados. Sem deploy.
