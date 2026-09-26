# Conexão do cardápio na configuração existente — 23/09/2026

## Entrega desta etapa

O PDV normal passa a oferecer **Conectar cardápio** no cartão da licença, abaixo de **Função deste computador**. A conexão aproveita a licença e a escolha Caixa/Atendimento existentes; não pede identificação da loja, identificação do terminal, códigos ou outro seletor de função. A conta do gerente do painel confirma a autorização uma vez. A senha fica somente durante a chamada e a sessão de gerência é encerrada ao terminar.

A liberação continua exclusiva para BURGER TESTE (LIC-FLOW-937278). Os perfis do piloto técnico e do PDV normal permanecem separados; não há cópia de credenciais entre eles. Um vínculo existente no piloto não configura automaticamente o PDV normal.

## Arquivos e finalidade

- `index.html`, `src/css/config-admin.css`: ação junto da licença e janela acessível com e-mail/senha, estado da conexão, Escape e estilos do painel atual.
- `src/js/app.js`, `src/js/conexao-cardapio.js`: instalação na configuração normal e atualização conforme licença, função e operador.
- `src/js/conexao-licenciada-core.js`: coordenação da autorização, bloqueio de concorrência, checagem de troca de contexto e recuperação por consulta após resposta perdida.
- `src/js/servicos-acesso-hospedado.js`: sessões Firebase separadas para PDV normal/piloto e gerência/computador; lista restrita de chamadas de conexão.
- `functions/vinculo-licenca-v2.js`, `functions/index.js`: novo vínculo derivado da licença, com loja migrada, gerente verificado pertencente à loja, licença ativa/não vencida e computador previamente registrado na licença. O servidor usa a função registrada; Atendimento não é convertido em Caixa ou Cozinha.
- `functions/acesso-v2.js`: consulta do vínculo reconhece Atendimento e devolve licença/computador para conferir a correspondência local.
- `test/conexao-licenciada.test.cjs`, `test/servicos-acesso-local.test.cjs`, `test/pairing-v2.test.cjs`, `test/conexao-licenciada-ui.cjs`: verificações focadas.

## Evidências locais

- 13 testes unitários de coordenação/serviços passaram.
- 10 testes no emulador isolado passaram, incluindo o pareamento existente e a nova conexão: usuário sem gerência, loja diferente, identidade humana como terminal, licença bloqueada/vencida, dispositivo ausente, função divergente, concorrência, repetição idempotente e tentativa de duplicar dispositivo.
- `npm run bundle` concluído.
- Janela validada em Chromium/Chrome com serviços simulados em 1280×900 e 390×844: sem transbordamento horizontal, confirmação, limpeza da senha e Escape. Capturas inspecionadas em `output/migracao-v2-20260923/conexao-config-*.png` (raiz do workspace).
- Esses testes não representam login real do gerente no PDV instalado, operação de loja nem teste físico.

## Uso e próximos limites

No código local atualizado, iniciar o PDV normal com `npm start` e abrir **Configurações → Licença → Conectar cardápio**. Não usar `start:piloto-v2` para esta nova tela. Não foi criado nem publicado instalador/atualização automática.

A conexão não ativa recebimento, vendas, estoque, fiscal ou TEF V2. O backend operacional e o corte continuam pendentes. Nenhum pedido ou saldo foi modificado nesta etapa. O vínculo com função divergente ou outro UID é recusado, sem sobrescrever acessos; troca posterior de função ou reinstalação exigirá fluxo próprio de revisão. Isso permanece uma limitação explícita, não sincronização automática de papéis.

Próxima fase operacional: conferir catálogo/combos, pedido legado ainda em preparo e saldos reais antes de preparar o recebimento hospedado e o corte. A configuração existente do PDV e seus layouts continuam preservados.

## Publicação e conferência remota — 18:01 UTC

Publicadas somente `vincularTerminalLicenciadoV2` e `consultarMeuTerminalV2` no projeto aplicativo-pdv. Ambas ACTIVE, minInstances=0 e maxInstances=1, com política de transporte HTTP conferida. Chamadas HTTPS sem login chegaram ao backend e receberam UNAUTHENTICATED/401. A loja foi relida e continua com ativação operacional suspensa. Não houve concessão de perfil administrativo global, publicação de regras, alteração de catálogo ou estoque.

Recibos locais: `output/migracao-v2-20260923/conexao-licenciada-deploy.log` e `conexao-licenciada-remoto.json`. O login real e a autorização no PDV normal ainda dependem da sessão do gerente no aplicativo; os testes não criaram vínculo de produção. O limite de instâncias controla capacidade, não representa medição de cobrança. Não há consulta periódica nova; as chamadas ocorrem ao usar a ação de conexão.

## Correção da troca Caixa/Atendimento — 23/09/2026

Relato reproduzido: a configuração antiga emitia sucesso após salvar a função na licença, mas o vínculo V2 mantinha Atendimento. Além disso, a validação local impedia chegar à confirmação do gerente quando apenas o papel divergia.

Correções:
- `src/js/app.js`: exige gerente local, desabilita seletor durante a gravação e abre automaticamente a conferência para BURGER TESTE; remove sucesso antecipado neste fluxo. Falha restaura a seleção pela configuração persistida.
- `src/js/licenca.js`: para a licença piloto, falha na gravação remota restaura a função local anterior e propaga erro. As demais licenças mantêm o comportamento anterior.
- `src/js/conexao-licenciada-core.js`: distingue papel divergente de identidade/loja divergente. O primeiro vira troca pendente e permite confirmação; o segundo continua bloqueado. Sucesso depende da consulta final coerente.
- `src/js/conexao-cardapio.js`: abre conferência após a troca; informa papel anterior/desejado e oferece **Confirmar troca de função**. O rótulo pendente não afirma conexão concluída.
- `functions/vinculo-licenca-v2.js`: gerente verificado da loja pode atualizar, em uma transação, papel do terminal, membro e mapeamento do dispositivo. Preserva UID/dispositivo/loja e registra auditoria. Recusa vínculos revogados/incoerentes, outra loja, outro dispositivo, usuário terminal sem gerência e operação V2 ativa. O papel continua derivado do registro na licença.

Validação: 15 testes unitários de coordenação/serviços/seletor, 10 testes de emulador e teste visual/comportamental em Chrome com serviços simulados passaram. O teste de servidor cobre ida e volta Atendimento/Caixa, identidade preservada e rejeição de terminal/gerente de outra loja. Bundle regenerado.

Limite explícito: salvar o seletor prepara a função no PDV/licença; o V2 só muda após confirmação da conta do painel. Fechar a janela deixa a troca pendente, não desfaz automaticamente a configuração antiga. Eliminar essa confirmação exige integrar a identidade do gerente local ao servidor; não foi substituída por confiança no DOM. O recebimento continua suspenso. Estas mudanças substituem a limitação anterior de recusar qualquer troca de papel durante o piloto.

Publicação da correção concluída às 18:14 UTC: somente vincularTerminalLicenciadoV2 atualizado. Conferência HTTPS e IAM aprovada; função ACTIVE, min=0/max=1. Loja relida com operação suspensa. Nenhum vínculo real foi alterado por script; a confirmação será feita pelo gerente no aplicativo.

Ajuste visual do seletor: em src/css/config-admin.css, foco específico de cfg-tipo-terminal reduzido a 2px e deslocado para dentro (-2px), preservando indicação por teclado sem contorno externo sobre o rótulo. Conferido em Chrome com Tab e captura seletor-foco.png. Apenas CSS; sem alteração de comportamento ou publicação remota.

Correção dos cantos das notificações: src/css/notificacoes.css agora reserva 24px internos ao redor da pilha, compensados pela margem e box-sizing, preservando posição/largura dos cartões. O contêiner rolável deixava a sombra recortada nos quatro cantos. Conferido visualmente em Chrome 900px e 390px usando o módulo real de notificações; imagens notificacao-cantos*.png. Sem alteração de conteúdo, duração ou fechamento.

## Refinamento de login, conexão e notebook — 23/09/2026

- `src/js/auth.js`: login abre sem operador presumido, com “↑↓ Escolher operador” e PIN desabilitado. Setas percorrem operadores sem tirar foco; Enter leva ao PIN. Seleção por mouse continua levando ao PIN; Tab preservado. “Gerente” passa a “Admin” nas duas indicações do login, sem renomear papéis internos. Removidas tentativas atrasadas de foco que interrompiam a escolha.
- `src/js/conexao-cardapio.js`: botão redundante de conferir dentro da janela removido. Senha permanece mascarada e controles bloqueados durante envio; erro preserva o preenchimento, sucesso/fechamento limpam. Sucesso usa título “Computador conectado”, loja/função, aviso separado de recebimento ainda não ativado e botão Concluir, sem instrução de autenticação obsoleta.
- `src/css/config-admin.css`: layout compacto em janelas de até 760px de altura, com menos padding/gap e controles de 36px; texto preservado e conteúdo final acessível por rolagem. Cartões de backup/licença deixam de esticar um ao outro. Contêineres flex de rolagem com min-height:0.
- `test/login-config-refinamento-ui.cjs` e `test/conexao-licenciada-ui.cjs`: Chrome com código real e serviços simulados; escolha vazia/PIN bloqueado, setas, Enter, Shift+Tab e seleção por mouse; senha mantida/desabilitada durante resposta adiada, limpeza após sucesso e ausência do botão redundante. Configurações em áreas 1093×614 e 911×512 (referências de escala 125/150% para notebook 1366×768), sem transbordamento horizontal e final alcançável. Não altera escala real do Windows. Capturas config-escala-* e conexao-sucesso-* inspecionadas.

Bundle local regenerado. Não houve publicação de instalador ou alteração remota nesta rodada.

Login: opção Escolher operador mantida selecionável no topo; ArrowUp pode voltar ao índice zero, limpando o PIN e desabilitando-o novamente. Pequeno espaço tipográfico entre setas e texto. Alteração em src/js/auth.js, verificada pelo teste de navegador login-config-refinamento-ui.cjs (descer/subir/Enter na opção vazia); bundle regenerado.

## Organização das configurações — computador e equipamentos

`index.html`: Fiscal NFC-e, Balança e TEF/Cartão movidos para o formulário Alterar Configurações, após impressão/gaveta. IDs e os cinco handlers de ajuste/teste mantidos, sem copiar controles. Título do formulário atualizado para Configurações da loja. Identificação do terminal, seletor Caixa/Atendimento e conexão do cardápio separados da licença no bloco Este computador.

`src/css/config-admin.css`: equipamentos organizados em linhas compactas no formulário; bloco do computador em duas colunas, uma em largura menor. Ao abrir os modais existentes de equipamento, o formulário fica temporariamente oculto, voltando intacto ao fechar o ajuste, sem perder dados digitados.

Verificação: test/config-reorganizada-ui.cjs em Chrome com HTML/CSS reais e dados estáticos, em 1093×614 e 911×512: controles únicos no destino, ausência dos três cartões na página principal, sem transbordamento horizontal no formulário, abertura/retorno dos ajustes e capturas inspecionadas. Não foi feito teste físico de balança, impressora, fiscal ou TEF. Alteração HTML/CSS local, sem publicação remota.

Refinamento do bloco Este computador: identificação, função e conexão alinhadas em três colunas compactas; quebra em duas/uma coluna em janelas menores e duas quando conexão não disponível. index.html move a conexão para coluna própria; config-admin.css reduz altura/espaços. Correção da sobreposição dos ajustes: regra do formulário pai usa display:none enquanto modal filho ativo, em vez de visibility:hidden (descendentes podiam continuar pintando). Ao fechar, volta o display original sem recriar/resetar o formulário. Teste config-reorganizada-ui.cjs confirma ausência imediata de retângulos nos botões ocultos, preservação de valor digitado e layout 125/150 equivalente; capturas inspecionadas. Apenas HTML/CSS, sem deploy.

Cabeçalho: atualizarHeaderUsuario em src/js/auth.js passa a exibir Admin no badge da sessão administrativa. Classes, cargo persistido e permissões preservados. Bundle regenerado com sucesso.
