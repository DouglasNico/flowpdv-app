# Piloto V2 — acesso hospedado da BURGER TESTE

## Entrega

Foi adicionado o perfil de desenvolvimento `--flowpdv-piloto-v2`, com pasta própria `flowpdv-piloto-v2`. Ele conecta autenticação e Functions ao Firebase real `aplicativo-pdv`, com identidades separadas para terminal e gerente. Não reutiliza o login legado, a sessão dos emuladores ou o armazenamento do caixa instalado.

Esta etapa permite somente consultar, emitir, concluir e revogar pareamento. O transporte recusa outras operações antes do envio; a interface não monta as telas de recebimento, cozinha, pagamentos e configuração. TEF, emissão fiscal, impressão física e atualização do instalador continuam bloqueados nesse perfil. Não é uma versão de produção do caixa.

## Estado remoto conferido

- `dougnvds26@gmail.com`: conta ativa e e-mail verificado. O usuário confirmou pelo link do Firebase. A tentativa de envio administrativo de e-mail foi recusada; nenhum e-mail foi enviado pela ferramenta. O link foi entregue diretamente na conversa, não guardado nesta documentação.
- Gerência criada apenas em `lojas_v2/legado-lic-flow-937278/membros/{uid}`; nenhuma claim administrativa global foi concedida.
- Cadastro da loja com `ativo: true` **apenas para permitir pareamento**, mantendo `ativacaoOperacionalV2.estado: suspensa`, módulos cardápio/mesas/retirada desligados e catálogo não publicado/pausado. Essa atualização substitui o estado inicial `ativo: false` da cópia preparatória.
- Quatro Functions V2 publicadas em `us-central1`: `consultarMeuTerminalV2`, `emitirPareamentoV2`, `concluirPareamentoV2`, `revogarTerminalV2`. Todas conferidas como `ACTIVE`, mínimo zero e máximo uma instância cada.
- Autenticação anônima habilitada para criar a identidade do aparelho antes do pareamento. Criar essa identidade não concede vínculo ou acesso à loja.
- A primeira publicação falhou apenas para `emitirPareamentoV2` por acesso à conta de serviço durante a preparação inicial. A conta existia e as outras três funções funcionaram. Repetiu-se somente essa função; a segunda publicação foi bem-sucedida. Nenhuma concessão IAM manual foi feita para contornar o erro.
- Retenção de imagens de build: 30 dias no repositório `gcf-artifacts` de `us-central1`. O CLI havia retornado erro final por ausência dessa política, mesmo após publicar as funções; a política foi configurada e os estados das funções foram conferidos separadamente.

Foram habilitadas pelo Firebase CLI as APIs de infraestrutura necessárias ao primeiro deploy V2, incluindo Cloud Build, Artifact Registry, Cloud Run, Eventarc, Firebase Extensions e Secret Manager. Isso não significa que todos esses serviços tenham uma aplicação em execução. Há possibilidade de custos de build, armazenamento e uso das funções; não foi medida cobrança real. Limites de instância não são um teto financeiro.

Não foram publicados o backend de pedidos/vendas, regras Firestore, índices, site ou instalador. O cardápio antigo e seus pedidos permanecem no fluxo existente. O domínio novo não foi configurado.

## Verificação

- 26 testes de sessão, ciclo de acesso e perfil passaram. Cobrem isolamento, recusa de combinação de perfis, rede permitida, sessão obsoleta, recuperação e bloqueio das operações não liberadas.
- 9 testes de pareamento passaram em emuladores isolados. Acrescentada recusa de gerente sem e-mail verificado, incluindo convite emitido antes da perda da verificação.
- Bundle do PDV compilado.
- Teste HTTPS real: consulta sem login recusada; identidade temporária autenticada retornou `vinculado: false`; identidade temporária removida ao final. Nenhum pedido, pagamento, venda ou saldo foi criado nesse teste.
- Tela conferida no Chrome headless com ponte Electron simulada e rede bloqueada: modal de acesso correto, identificação da loja preenchida, telas operacionais ausentes, sem erros JavaScript. Isso não substitui homologação do Electron instalado.

Evidências locais em `../output/migracao-v2-20260923/`: `pareamento-testes.log`, `functions-acesso-recibo.json`, `smoke-acesso-recibo.json`, `tela-piloto-recibo.json`, `gerente-vinculo-recibo.json`, `liberacao-pareamento-recibo.json`, `auth-piloto-recibo.json` e `retencao-builds.log`. Não publicar capturas privadas de origem ou credenciais.

## Arquivos e finalidade

- `src/js/servicos-acesso-hospedado.js`: transporte remoto opt-in, projeto fixo e operações limitadas ao pareamento.
- `src/js/acesso-homologacao.js`: permite o ciclo de autenticação também no piloto explicitamente selecionado, preservando a separação terminal/gerente.
- `runtime-profile.cjs`, `main.js`, `preload.js`: pasta isolada, sinalização do perfil e política de rede; bloqueios de dispositivos e serviços financeiros preservados.
- `src/js/sessoes-homologacao.js`: seleção do adaptador hospedado pelo perfil exposto pelo Electron.
- `src/js/app.js`, `painel-teste.js`, `pareamento-teste.js`: inicialização limitada ao acesso e textos que identificam uso do Firebase real.
- `functions/acesso-v2.js`: limite de instâncias e validação de e-mail do gerente também na conclusão do convite.
- `scripts/vincular-gerente-burger-v2.cjs`, `liberar-pareamento-burger-v2.cjs`: alterações administrativas restritas à piloto, com precondições, auditoria e conferência. Não habilitam operação.
- `test/servicos-acesso-local.test.cjs`, `runtime-profile.test.cjs`, `pairing-v2.test.cjs`: verificações acima. O pareamento aceita portas isoladas por variável de ambiente para não reutilizar Functions antigas.
- `package.json` e `src/js/bundle.js`: comando de inicialização e bundle atualizado.

## Próxima ação no computador

Na pasta `adega-pdv-gestao`, executar:

```powershell
npm run start:piloto-v2
```

Em **Acesso do terminal**, preparar a identificação do aparelho. Entrar como gerente com `dougnvds26@gmail.com` e a própria senha, autorizar o terminal para `legado-lic-flow-937278` e concluir com o código emitido. A senha deve ser digitada apenas no aplicativo, nunca enviada na conversa. Pareamento não ativa vendas.

Após pareamento: revisar os combos antigos no cadastro do PDV, conferir o pedido legado em preparo e os saldos atuais do terminal; preparar o restante do backend e regras; validar o ciclo no ambiente hospedado antes do corte. Ainda não há migração operacional concluída.

## Correção da emissão de convite — 23/09, 17:37 UTC

O usuário autenticou no piloto, mas recebeu `unauthenticated` ao gerar autorização. Conferência das políticas IAM dos quatro serviços mostrou que apenas `emitirpareamentov2` não tinha `allUsers` em `roles/run.invoker`. A criação parcial seguida de atualização deixara o transporte inacessível ao token Firebase, apesar de a função constar como ACTIVE. As outras três funções já tinham a permissão de transporte esperada.

Foi corrigida somente a política do serviço `projects/aplicativo-pdv/locations/us-central1/services/emitirpareamentov2`, preservando a política existente e seu etag. Isso permite a chamada HTTP do SDK; a autorização Firebase continua obrigatória dentro de `identity` e `manager`. Não foi concedido papel administrativo no projeto. A configuração `invoker: 'public'` foi explicitada em `functions/acesso-v2.js` para os próximos deploys; a correção remota já foi aplicada diretamente, sem precisar recompilar o aplicativo.

Validação HTTPS: a chamada sem login agora chega ao backend e recebe `Autenticação necessária`; uma identidade temporária autenticada, sem gerência, recebe `permission-denied`. A identidade temporária foi removida. Não foi gerado convite nem alterado vínculo de terminal no teste. A emissão com a sessão do gerente real deve ser repetida na janela já aberta.

Evidências: `correcao-invoker-recibo.json` e `smoke-convite-recibo.json` na pasta local da migração. A checagem de publicação deve conferir a política de invocação de cada serviço, além do estado ACTIVE.

## Continuação — conexão na configuração existente

A etapa seguinte está registrada em [CONEXAO-LICENCIADA-PDV-20260923.md](CONEXAO-LICENCIADA-PDV-20260923.md). O PDV normal passa a usar a licença e Caixa/Atendimento para a conexão, eliminando os campos técnicos e códigos da tela piloto. Não houve corte operacional nem publicação de instalador.
