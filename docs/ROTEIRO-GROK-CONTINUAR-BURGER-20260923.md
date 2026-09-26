# Continuidade segura — FlowPDV / BURGER TESTE

Você está continuando um projeto existente. Leia este roteiro e os arquivos citados antes de alterar qualquer coisa. Trabalhe em etapas curtas, registre evidências e não declare sucesso apenas porque compilou. O objetivo é concluir e testar a integração cardápio → PDV oficial, somente na BURGER TESTE, antes de distribuir a clientes.

## Estado confirmado agora, 23/09/2026

- O usuário entrou como Admin no aplicativo OFICIAL instalado usando seu próprio PIN. A consulta de conexão foi executada: mensagem “Caixa integrado conectado. Os pedidos aparecem em Pedidos do cardápio.”, sem erro, adesão local presente. Essa mensagem NÃO prova recebimento operacional.
- Consulta remota posterior via `node scripts/corte-burger-oficial.cjs`: terminal oficial ativo/licenciado e `aderiu:true`; corte `aguardando_pdv`; ativação `suspensa`; público e V2 pausados. ESTA É A ETAPA EXATA ONDE PARAMOS. Não foi executado `--ativar`.
- Loja: BURGER TESTE, licença `LIC-FLOW-937278`, documento `lojas_v2/legado-lic-flow-937278`, slug `burger-teste`, Firebase `aplicativo-pdv`.
- Terminal oficial `fyFJuGJCcrgkVFkiQiFnSpuUlph1`; dispositivo `TERM-08ZBDJ-MT3GCG0S`. Terminal técnico antigo `HdPRbUveCld3Z0BiHHrop0nAPFD3` já desativado. Não reativar.
- 60 produtos. Origem preparada: 14 estoques controlados de 50 unidades, 46 produtos sem controle. Conferir valores atuais antes/depois do teste; não restaurar estes números cegamente.
- Serviços operacionais, regras e índices publicados; ponte do cardápio publicada (commit `1bef861`). Cardápio público pausado durante corte; legado bloqueado para evitar dupla baixa. Nenhuma venda real nova foi criada nesta validação.
- Usuário confirmou caixa fechado e sem venda pendente. Antes da adesão instalada também foi conferido turno local ausente. Revalidar se houve uso posterior.
- Pedido antigo de R$ 163,40 `PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0` é TESTE: manter só no histórico, sem importar como nova venda/baixar estoque. Quatro combos antigos ficam desativados; piloto apenas avulsos e retirada.

## Caminhos e leitura inicial

Raiz: `D:\Desenvolvimento-PDV\flowpdv-sistema`

Executar comandos do PDV em `adega-pdv-gestao`, dentro dessa raiz. Respeitar AGENTS.md aplicáveis, se existentes, e inspecionar git status antes de editar. Há muitas alterações legítimas ainda não commitadas: não resetar, não limpar e não publicar tudo indiscriminadamente.

Ler nesta ordem:

1. Este roteiro (mais recente que as seções históricas).
2. `docs/INTEGRACAO-PDV-OFICIAL-20260923.md` e `docs/PILOTO-BURGER-AVULSOS-20260923.md`.
3. `scripts/corte-burger-oficial.cjs`: entender os guardas antes de executar a ativação.
4. `src/js/adesao-pdv-v2.js`, `perfil-operacional-v2.js`, `operacoes-pdv-v2.js`, `conexao-cardapio.js` e `functions/preparacao-pdv-v2.js`.
5. Para teste instalado: `recebimento-teste.js`, `fechamento-teste.js`, `venda-aplicativo-completo.js`, testes/harnesses associados. Os nomes históricos não significam criar outro aplicativo.

Os repositórios web ficam no diretório pai da raiz: `flowpdv-cardapio`, `flowpdv-cardapio-login-release`, `flowpdv-mobile`. O primeiro tem alterações pendentes; a publicação seletiva foi feita pelo segundo. Não sobrescrever/publicar alterações alheias.

## Próxima etapa — ativação restrita

1. Conferir novamente, sem mutação:

   `node scripts/corte-burger-oficial.cjs`

   Esperado: único caixa oficial ativo, licenciado, aderiu true; aguardando_pdv; suspensa; catálogos pausados. Se divergir, investigar antes de agir.

2. A migração dessa loja já foi autorizada. Se os guardas corresponderem, executar:

   `node scripts/corte-burger-oficial.cjs --ativar`

   O executor exige adesão dos caixas ativos e atualiza loja/catálogos atomicamente, sem reimportar estoque. NÃO repetir `--preparar`, NÃO executar novamente migração de saldos e NÃO editar flags diretamente para contornar falhas.

3. Conferir o recibo em `../output/migracao-v2-20260923/` e executar a consulta novamente. Confirmar corte concluído, ativação habilitada e catálogos disponíveis. Se já estiver ativado, não repetir a mutação sem ler a lógica de idempotência.

4. No PDV instalado, atualizar a conexão e confirmar a ativação real. Se necessário reiniciar normalmente, desde que não exista operação pendente. Não substituir o PDV por um perfil técnico.

## Teste obrigatório antes de dizer que está pronto

1. Registrar estoque inicial do produto escolhido, pedidos/atendimentos/vendas/turno relacionados. Usar um avulso disponível com estoque controlado. Abrir o caixa pelo fluxo normal; fundo de teste zero se permitido pelo sistema.
2. Pelo cardápio publicado `https://flowpdv.app.br/LIC-FLOW-937278`, criar UM pedido de retirada, avulso, identificado como TESTE DE INTEGRAÇÃO. Não disparar mensagens externas nem cobranças reais. Registrar IDs e preço esperado; proteger token de acompanhamento.
3. Confirmar que entrou no painel “Pedidos do cardápio” do aplicativo instalado e que item, quantidade, preço e total correspondem ao publicado. Receber/fechar pelo fluxo do aplicativo, não gravando documentos manualmente.
4. Usar pagamento manual de teste claramente identificado. Não acionar TEF, cartão real, fiscal ou emissão de documento fiscal. Conferir venda, movimento de caixa, vínculo do pedido e baixa de estoque exata UMA vez.
5. Validar idempotência com a MESMA chave/mesmo pedido. Não criar outro pedido achando que isso testa repetição. Repetição e atualização/reabertura do aplicativo não podem gerar outra venda nem outra baixa.
6. Finalizar o teste de modo rastreável: usar estorno/cancelamento suportado, se aplicável, e conferir recomposição uma vez; não apagar registros nem restaurar estoque manualmente. Fechar turno de teste sem pendências. Informar ao usuário exatamente quais registros ficaram.
7. Se falhar, registrar etapa/IDs/erro e corrigir pontualmente com teste direcionado. Em resultado incerto de pagamento/estoque, consultar recuperação antes de repetir. Não desbloquear legado como solução improvisada.

Se houver falha que exija pausar o público, inspecionar e usar o mecanismo existente mantendo o bloqueio legado. Não inventar um rollback que habilite os dois motores; não reimportar dados por cima de movimentações.

## Instalador e acesso local já preparados

- Oficial instalado: `C:\Users\User\AppData\Local\Programs\flowpdv\FlowPDV.exe`.
- Instalador atual: `../output/instalador-oficial-v2-20260923-retomada/FlowPDV-Setup.exe`, versão 3.2.38, SHA256 `ce73d4dc3b57af641b34946d40b64d6cae2fec0841f5698082ad95816db6b5af`.
- Instalação terminou com código 0; ASAR conferido contra pacote. Ainda NÃO há validação de pedido/venda instalada.
- App foi aberto com depuração somente local em `127.0.0.1:9228`. Pode-se conectar Playwright por CDP, caso ainda ativo. Biblioteca disponível em `C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`.
- UI: `App.trocarAba('config')`, botão `#cfg-conexao-cardapio-abrir`, mensagem `#conexao-cardapio-mensagem`, painel `#receive-open`, checkout `#checkout-open`. Inspecionar DOM atual antes de interagir.
- Consultas booleanas permitidas: `AuthModule.isGerente()`, presença de usuário/turno. Não ler PIN/senha/tokens do localStorage nem fabricar login/marcador de adesão. Usuário faz autenticação na própria tela.
- Ao terminar, reiniciar sem depuração quando não houver operação pendente. Não publicar versão 3.2.38 como novo release automático.

## Evidências existentes e limites

Já passaram: testes de adesão/acesso/migração/recuperação, 15 testes de regras, 3 de preparação/adesão backend, 3 da ponte pública, ensaio de recebimento com bloqueio de loja suspensa, bundle e conferência de 21 arquivos do pacote. Logs ficam em `../output/test-*.log`, deploys em `../output/deploy-*.log`. Não repetir todas as suítes sem alteração ou falha que justifique.

A ponte envia apenas loja explicitamente marcada para V2, sem gravar segundo pedido no legado. Acompanhamento usa token, consulta a cada 30 segundos e suspende com aba oculta. Não remover esses controles de custo/idempotência. Backend tem limites de instância; não publicar todas as funções por conveniência.

Fonte privada `../output/migracao-v2-20260923/burger-origem-atual.json` contém dados de conta: não imprimir, enviar ao chat, commitar ou incluir no instalador. Nunca executar `firebase login:list --json` para mostrar credenciais. Não criar credenciais administrativas novas.

## Restrições essenciais

- Só BURGER TESTE. Nenhuma migração em massa, release para clientes ou mudança de outras lojas.
- Projeto OFICIAL; nenhuma distribuição separada, perfil de teste novo ou redesign. Preservar Moderno, Clássico e Atendimento.
- Não remover validações de licença, dispositivo, membro, autenticação, preço, saldo, caixa fechado e idempotência para fazer o teste passar.
- Não usar git reset --hard, git clean, exclusões recursivas ou sobrescrever arquivos pendentes. Pasta antiga `output/burger-teste-local` foi abandonada; ignorar, não tentar limpá-la.
- Não confundir HTTP 200, teste em emulador, ASAR correto ou adesão confirmada com venda integrada validada.
- Se não houver acesso aos arquivos/terminal, orientar o usuário passo a passo; nunca alegar execução que não aconteceu.
- Atualizar `docs/INTEGRACAO-PDV-OFICIAL-20260923.md` com arquivos alterados, motivo, comandos/resultados e pendências. Entregar conclusão curta dizendo se o teste instalado passou e o que falta antes de clientes.

Comece pela consulta somente leitura do corte. Não precisa refazer o que já está concluído.

## Escopo completo solicitado para esta continuação

Concluir a integração oficial, corrigir os defeitos encontrados, executar a matriz abaixo, entregar instalador oficial atualizado se o código mudar e deixar documentação suficiente para revisão pelo Codex. “Fazer tudo” refere-se a essa entrega: não reabre redesign, domínios, promoções, composição dos quatro combos ou migração de outras lojas. Essas funcionalidades adiadas devem ficar listadas como futuras, sem serem habilitadas incompletas.

Trabalhe até concluir as etapas tecnicamente possíveis. Se surgir dependência externa real, registre o bloqueio exato e prossiga com testes independentes. Nunca marque teste não executado como aprovado. Não existe garantia de ausência de defeitos só por passar a suíte.

## Etapa A — preservar uma base para revisão posterior

Antes da primeira edição, crie uma pasta de evidências com data/hora em `../output/revisao-grok/`. Para cada repositório que tocar, registre caminho, branch, HEAD, `git status --short`, lista de arquivos não rastreados e diff inicial dos arquivos de código. Preserve cópia inicial dos arquivos que pretende editar, inclusive não rastreados; não copie credenciais nem dados privados. Diffs devem ser revisados para não conter segredos antes de compartilhar.

Essa base é indispensável: já existem mudanças do Codex e do usuário. Não atribua todas as diferenças em relação ao HEAD ao seu trabalho. No final, gere comparação entre a base inicial e o resultado, mantendo separadas alterações preexistentes e alterações suas. Não faça commit de tudo para “organizar”.

## Etapa B — testes automatizados completos e seguros

1. Inventarie scripts de teste nos package.json e arquivos de teste dos componentes afetados. Leia os runners antes de executá-los: alguns escrevem dados ou dependem de emuladores. Não execute todos os arquivos .cjs indiscriminadamente.
2. Execute a suíte padrão do PDV: `npm test`, `npm run test:profile` e `npm run bundle`. O script `npm test` cobre testes gerais e TEF simulado, não todos os testes V2.
3. Execute as suítes V2 relevantes à cadeia completa: adesão/preparação; autenticação/pareamento; política de ativação; recebimento; pedidos públicos; fechamento; turno; estoque; venda local integrada; cancelamento/estorno; recuperação; proteção/reconstrução de backup; regras de segurança. Inclua os testes de combos existentes para confirmar que continuam bloqueados onde necessário, sem habilitá-los na loja.
4. Arquivos de referência existentes: `test/adesao-pdv-v2.test.cjs`, `preparacao-pdv-v2.test.cjs`, `politica-ativacao-v2.test.cjs`, `recebimento-v2.test.cjs`, `public-orders-v2.test.cjs`, `fechamento-v2.test.cjs`, `piloto-burger-v2.test.cjs`, `security-v2.test.cjs`, `recuperacao-terminal-v2.test.cjs`, `protecao-backup-v2.test.cjs`, `reconstrucao-backup-v2.test.cjs`. Descobrir os demais runners pelo código e documentação; alguns precisam de fixtures específicas.
5. Testes destrutivos, concorrência, indisponibilidade e falhas financeiras SOMENTE em emulador com projeto demo. Configuração isolada disponível: `firebase.combos-test.json` (Auth 9199, Firestore 8180, Functions 5101). Conferir configuração e ambiente; abortar se apontar para produção. Não desligar processos de outro trabalho para liberar porta.
6. Runtime Node 22 disponível em `../output/local-node22/node-v22.23.2-win-x64/node.exe`; Firebase CLI em `../output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js`. Consultar logs anteriores para reproduzir os comandos já usados. Não instalar/atualizar dependências em massa para resolver um problema de ambiente.
7. No cardápio, executar build e `test/ponte-pedido-v2.test.js` conforme o runner do projeto, além de testes existentes relevantes ao pedido/acompanhamento. Testar interface pública em desktop e celular. Não publicar o repositório web sujo inteiro.
8. Guardar comando, diretório, projeto/ambiente, data, código de saída, contagem e log sanitizado de cada suíte. Corrigir falhas reais com mudanças mínimas. Não apagar testes, enfraquecer asserts nem ignorar falhas para deixar verde. Distinguir falha preexistente comprovada de regressão.

Executar uma rodada completa pertinente ao final; durante as correções, repetir apenas as suítes afetadas. Não gastar tempo repetindo resultados encerrados sem motivo.

## Etapa C — matriz funcional e de integridade

Para cada linha, registrar PASSOU, FALHOU ou NÃO EXECUTADO, ambiente e evidência. Testes de falha devem ocorrer em emulador; em produção, apenas o ciclo controlado da BURGER TESTE descrito acima.

| Cenário | Resultado obrigatório | Ambiente |
| --- | --- | --- |
| Adesão correta | Loja, licença, dispositivo, revisão, catálogo e saldo conferidos; confirmação local e remota | Já observado instalado; revalidar estado |
| Licença/dispositivo/revisão divergente | Recusa sem conceder acesso nem alterar estoque | Emulador/unitário |
| Sem login, membro revogado ou outra loja | Sem acesso a dados/operações protegidos | Emulador/regras |
| Loja suspensa | Pedido/recebimento novo recusado; repetição de operação concluída preserva idempotência | Emulador |
| Avulso de retirada | Preço do servidor, total correto, vínculo rastreável e recebimento único | Emulador + instalado/publicado |
| Preço adulterado, quantidade inválida, produto ausente | Recusa coerente; nenhum efeito financeiro parcial | Emulador/API |
| Combos/adicionais fora do piloto | Bloqueados sem cobrança parcial nem fallback legado | Emulador + inspeção pública |
| Pedido antigo de R$ 163,40 | Histórico preservado, nenhuma nova venda/baixa | Consulta controlada |
| Duplo envio do pedido e resposta perdida | Mesma chave gera um pedido; retomada encontra resultado anterior | Emulador; repetição controlada publicada |
| Duplo recebimento/concorrência | Um atendimento/vínculo, sem duplicar baixa | Emulador |
| Caixa fechado | Operações que exigem turno recusadas sem efeitos parciais | Emulador + inspeção instalada |
| Abertura/fechamento de turno | Mesmo turno local/remoto, valores e resumo conciliados | Emulador + instalado |
| Fechamento do pedido | Um pagamento/venda, total correto, estoque no ponto previsto pelo domínio uma vez | Emulador + instalado |
| Produto sem controle e saldo insuficiente | Política existente respeitada, sem saldo/baixa inventados | Emulador |
| Cancelamento antes de concluir | Estado consistente, sem venda/baixa indevida | Emulador |
| Estorno e repetição de estorno | Reversão rastreável uma vez; repetição não repõe novamente | Emulador; teste instalado se aplicável |
| Queda/reabertura em etapa intermediária | Recuperação encontra operação; não cobra/baixa de novo | Emulador/harness isolado |
| Venda local normal após migração | Usa motor correto; legado não baixa junto; Moderno/Clássico preservados | Emulador + smoke instalado |
| Atendimento | Fluxo preservado; permissões da função corretas | Emulador/smoke sem trocar terminal de produção indevidamente |
| Backup/restauração | Não reintroduz saldo antigo nem apaga journal pendente | Emulador, nunca restaurar em produção para testar |
| Acompanhamento público | Status atualizado; token inválido não revela pedido; polling controlado | Emulador + publicado |
| Reabrir aplicativo normal | Adesão persiste; sessão/permissões corretas; pedido não duplica | Instalado sem operação pendente |
| Outras lojas | Comportamento legado preservado, corte limitado à BURGER | Regras/emulador, sem vendas em lojas reais |

Para TEF, fiscal, impressora, gaveta e balança: executar testes simulados existentes e smoke de interface sem acionar hardware/serviços reais. Declarar homologação física NÃO EXECUTADA quando não houver equipamento e autorização específica. Não inventar evidência física.

## Etapa D — correções, publicação mínima e instalador final

Se não houver mudança de código, aproveite o instalador já validado e termine a validação instalada. Se houver correção, registre arquivos/motivo, execute testes pertinentes, gere novamente bundle e instalador OFICIAL sem publicação automática. Não executar `npm run release`: esse script publica artefatos. Leia configuração e use empacotamento explicitamente sem publicação (`--publish never`) em pasta nova de output; preserve o artefato anterior.

Execute `node scripts/verificar-pacote-local.cjs <pasta-do-pacote>` conforme uso real do script, calcule SHA256 e confirme que o ASAR instalado corresponde ao novo pacote. Mantenha appId, identidade de instalação, atalhos e dados do usuário. Nunca apagar userData para “resolver” migração. Instalar/reiniciar somente sem operação pendente; depois repetir o ciclo essencial no aplicativo instalado atualizado.

Se corrigir backend ou web, publicar somente os componentes necessários à integração autorizada, após testes, registrando projeto, funções/rotas, commit ou hash e resultado. Não afrouxar regras nem ampliar permissões. Não executar deploy global. Alterações compartilhadas devem ter teste de isolamento para outras lojas antes de publicar.

## Etapa E — pacote de entrega para auditoria do Codex

Criar `docs/RELATORIO-GROK-INTEGRACAO-20260923.md` e uma pasta de evidências sanitizadas. O relatório deve conter:

1. Estado inicial e final: corte, ativação, pausa pública, terminal, turno e pendências. Separar fatos consultados de inferências.
2. Lista de arquivos alterados por você, propósito, comparação com base inicial e testes associados. Incluir scripts temporários usados para mutações.
3. Matriz de testes preenchida, comandos exatos e links locais para logs. Listar explicitamente testes não executados, limitações e falhas remanescentes.
4. IDs dos pedidos/atendimentos/vendas/movimentos de TESTE e saldos antes/depois. Não registrar PIN, senha, token de acompanhamento, tokens Firebase ou dados privados desnecessários.
5. Prova de uma única venda/baixa e do resultado da repetição. Explicar cancelamento/estorno/fechamento final do teste, sem apagar a trilha.
6. Publicações efetuadas, recibos, projeto Firebase, rotas e escopo. Registrar se algum índice ficou pendente.
7. Caminho/hash/versão do instalador, resultado da instalação e screenshots sanitizadas do fluxo efetivamente instalado. Distinguir isso do npm start.
8. Como o proprietário testa normalmente e qual estado deixou no aplicativo. Se ficou suspenso, explicar por quê; não esconder indisponibilidade.
9. Pendências antes de atender clientes, incluindo combos adiados e homologações físicas. Não publicar em release/auto-update nem migrar outras lojas.

Entregar ao usuário o relatório e o instalador quando atualizado. O Codex fará revisão independente ao retornar; não substituir evidências por “está tudo certo”. Se a integração essencial falhar, declarar claramente que ainda não está pronta e deixar estado coerente, sem habilitar caminhos concorrentes.
