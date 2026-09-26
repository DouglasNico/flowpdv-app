# FlowPDV — acompanhamento das pendências

Atualizado em 23/09/2026. Resumo do [plano mestre](PLANO-COMPLETO-FLOWPDV.md). As frentes abaixo têm trabalho pendente, mesmo quando já existe implementação parcial. Não são percentuais de conclusão. Publicação continua suspensa por orientação do usuário.

Prioridade atualizada em 23/09/2026: o usuário retomou o projeto completo e autorizou continuidade por etapas sem perguntar a cada passo. As correções originais continuam entregues localmente. Retomar integração, recuperação e demais frentes abaixo, com verificações direcionadas e avisos curtos. Publicação permanece suspensa. O acabamento de todos os sistemas está detalhado em [Impeccable no ecossistema](IMPECCABLE-ECOSSISTEMA.md).

## Entregas locais recentes

- Fase 18: reconstrução visual de painel e cardápio cliente solicitada explicitamente; fases 16/17 eram refinamentos. Nova navegação e catálogo responsivo, alinhamento visual V2 e demonstração local. [Arquivos e limites](REDESIGN-CARDAPIO-FASE-18.md).

- Fase 17: Loja com salvamento explícito e rascunho; Pedidos sem confirmação antecipada e com retry; QR protegido contra geração desatualizada. Impeccable nas três abas e testes locais aprovados. Integração V2 mapeada, ainda não conectada. [Detalhes](PAINEL-ABAS-FASE-17.md).

- Fase 16: catálogo do painel web legado recebeu filtros, acabamento Impeccable e salvamento com tratamento de falhas; testes locais desktop/mobile aprovados. Integração V2 e publicação real continuam pendentes. [Detalhes](PAINEL-CARDAPIO-FASE-16.md).

- Fase 15: pagamento já confirmado pode ser conferido no perfil transferido sem executar nova venda. Somente a tentativa é removida; perfil continua bloqueado para liberação final. [Detalhes](PAGAMENTO-RECUPERADO-FASE-15.md).

- Fase 14: tentativa persistente de pagamento manual de atendimento e retomada após resposta perdida; mesmos valores/referência, sem duplicar venda/estoque. [Detalhes](PAGAMENTO-ATENDIMENTO-FASE-14.md).

- Fase 13: recuperação preserva contas/pedidos após conferência explícita do gerente, com revalidação de documentos e pagamentos. Pagamento no turno seguinte validado sem duplicar estoque. [Detalhes e limites](PENDENCIAS-RECUPERACAO-FASE-13.md).

- Fase 12: fechamento de turno recuperado com gerente, reconstrução de movimentos confirmados, conferência de sangrias e retomada sem duplicação. Testes locais, servidor e interface aprovados. Contas/pedidos e pagamentos incertos continuam pendentes. [Detalhes](FECHAMENTO-RECUPERADO-FASE-12.md).

- Fase 11: liberação do perfil recuperado para um novo turno, com gerente verificado, conferência independente e revalidação de caixa/estoque. 27 testes locais, 16 de servidor e ensaio de venda posterior aprovados, sem dupla baixa. Apenas histórico encerrado e sem contas/pedidos pendentes; turno aberto recebeu tratamento na fase 12 abaixo descrita no relatório próprio. [Detalhes](LIBERACAO-PERFIL-FASE-11.md).

- Fase 10: proteção contra backup/troca de loja legados aprovada no aplicativo completo; recuperação em perfil novo, identidade própria, bloqueio e paginação de pendências aprovados no painel local. Liberação operacional final continua pendente. [Detalhes](BACKUP-INTEGRADO-FASE-10.md).

- Fase 9: reimpressão mantém o turno selecionado e aguarda retorno; falha ao copiar endereço recebe orientação. 8 testes de impressão aprovados e bundle compilado. [Detalhes](AVISOS-ADMINISTRATIVOS-FASE-9.md).

- Fase 7: cancelamento de delivery antes do recebimento validado no servidor e após recebimento validado pela interface; sem cobrança/estoque indevidos. Retomada após resposta incerta preserva tentativa. [Detalhes](DELIVERY-CANCELAMENTO-FASE-7.md).
- Fase 8 concluída localmente: diário da venda inclui auditoria e fila de envio; preservação de logs concorrentes. Testes focados e integrados aprovados. [Detalhes](AUDITORIA-RECUPERACAO-FASE-8.md).

- Fase 6: recuperação após revogação de membro, reconexão do histórico e venda pendente validadas no aplicativo completo. Delivery pago após saída, garçom, estorno e caixa conciliado aprovados. 13 testes focados e ensaio integrado aprovados. [Detalhes](RECUPERACAO-ACESSO-FASE-6.md). Próximo item: cancelamentos do delivery.

- Fase 5: restauração protegida contra troca de loja durante confirmação, erro de aplicação tratado, avisos XML e clientes revisados. 11 testes aprovados; [detalhes](AVISOS-RESTAURACAO-FASE-5.md). Próxima etapa ativa: integração e recuperação com venda pendente.

- Fase 1: contagem CSV, categorias importadas, auditoria de novas vendas, sigilo de saldo na sangria do operador. Testes locais aprovados; conferir com o CSV real do usuário.
- Fase 2: notificações compartilhadas e agrupadas; ensaio integrado dos dois PDVs, mesas e atendimento; limpeza ao trocar operador.
- Fase 3: impressão sem sucesso antecipado; orientação de falhas; pendências TEF/fiscal persistentes; avisos de códigos/contas inválidos agrupados.
- Fase 4: retorno explícito de sincronização manual, validação da loja do pacote, mensagens de salvamento local e backup não confirmado. Relatório: [avisos administrativos](AVISOS-ADMINISTRATIVOS-FASE-4.md).

## Trabalho restante

| Frente | O que falta | Situação |
|---|---|---|
| Revisão administrativa e correções | Terminar revisão dos avisos de cadastros e configurações; testar CSV real. XML/restauração revisados na fase 5; recuperação de auditoria validada na fase 8. | Em andamento |
| 1. Integração e acesso | Completar integração no aplicativo, permissões remotas, revogação com pagamento pendente e migração de identidades legadas. | Parcial |
| 2. Backup e recuperação | Outro computador físico, comprovação real dos documentos/contagens e conciliação de pagamentos incertos. Contas/pedidos conferidos podem ser preservados na fase 13. Turno aberto sem essas pendências validado na fase 12. Liberação para novo turno com histórico encerrado e preservação de movimentos posteriores testadas na fase 11. | Homologação ampliada pendente |
| 3. Compatibilidade e conexão | Ensaiar os dois PDVs, queda real de rede/reinício, descontos, cancelamentos, estornos e relatórios no fluxo completo. | Parcial |
| 4. QR/cardápio no celular | Preparar HTTPS, gerar QR utilizável, testar aparelhos/rede móvel/reenvio, pausa, indisponibilidade e mudança de preço; catálogo realista. | Integração local existente; entrega externa pendente |
| 5. Equipamentos | Impressoras 58/80 mm, acentos/corte, papel ausente, reconexão, segunda via, concorrência caixa/cozinha, leitor e teclado. | Depende de ensaio físico |
| 6. Implantação/piloto | Validar instalador e atualização, regras/índices/Functions, consumo e monitoramento, treinamento, backup e turno completo conciliado. | Pendente; publicação em etapa própria |
| 7. Delivery | Queda física de rede, eventual aceite manual; fila/cupom físico e ensaio celular–caixa. Pagamento após saída e cancelamentos/retomada validados localmente nas fases 6/7. | Homologação externa restante |
| 8. Garçom | HTTPS, integração operacional, dispositivos simultâneos, troca de conta e retomada em outro aparelho. | Integração/homologação restantes |
| 9. Cardápio completo | Cloudinary real/upload pela loja, navegação mobile, adicionais/esgotamento e gestão/publicação do catálogo no aplicativo e HTTPS. | Parcial |
| 10. Pagamentos integrados | Definir provedores, integrar ao novo fluxo, consultar resposta incerta, confirmar/conciliar/estornar e homologar com fornecedor. | Pendente no fluxo novo; piloto manual |
| 11. Fiscal no fluxo novo | Definir documentos/serviço, integrar emissão/retorno/cancelamento/recuperação e homologar contingência e dados do contribuinte. | Pendente; sem emissão real |
| 12. Outros segmentos | Adega/fardos/retornáveis, mercado/peso/códigos, padaria, roupas/variações/trocas; fiado, estoque e relatórios nos dois layouts. | Homologação ampliada |
| 13. Vários terminais | Concorrência, fonte do saldo, recuperação/troca de equipamento/revogação, paginação, carga, latência e custos. | Homologação ampliada |
| 14. Gestão e relatórios | Planos/módulos, permissões e auditoria, canais opcionais, relatórios/exportações conciliados e documentação de suporte. | Parcial |
| Acabamento visual | Estados administrativos reais, Flow Gestor, Master, painel e cardápio consumidor; regressão completa dos PDVs/garçom e site coerente com recursos disponíveis. | Parcial; Impeccable disponível |

## Ordem de acompanhamento

1. Integração operacional e retomada de pagamentos, caixa e acesso, com critérios objetivos por etapa.
2. Catálogo, delivery/garçom e preparação local de QR/HTTPS.
3. Acabamento Impeccable dos sistemas web e interfaces do ecossistema, conforme a matriz dedicada.
4. Instalador e preparação do piloto; equipamentos, publicação e serviços externos conforme dependências reais.
5. Pagamentos/fiscal, segmentos e múltiplos terminais do produto completo.

Validar o comportamento alterado; repetir suítes amplas apenas quando houver mudança ou risco concreto. Não reabrir fases aprovadas sem motivo. CSV real e experiência do usuário continuam no roteiro original, sem impedir trabalho independente.


### Fase 19 — integração gerencial V2 inicial (23/09/2026)

Concluídos no ambiente local: login próprio do gerente, consulta autorizada da loja e edição de produtos com versão, preservação de rascunho e bloqueio de acesso revogado. Ensaio integrado aprovado com Auth/Firestore/Functions emulados e navegador em desktop/celular. A rota `/gestao-v2` é inicial; integrar todas as abas do painel, fotos, adicionais, pedidos e QR continua pendente. Nenhuma publicação. Registro por arquivo e limites: [Gestão V2 — fase 19](GESTAO-V2-FASE-19.md).

Aba Loja V2 integrada localmente (23/09): segmento e canais com salvamento versionado, rascunhos entre abas e teste real nos emuladores aprovado. Detalhes em [fase 19](GESTAO-V2-FASE-19.md). Delivery/horários/contato, pedidos e QR seguem pendentes.


Delivery V2 integrado localmente: ativação, mínimo e regiões por CEP/taxa/prazo, com proteção de versão e teste em emuladores aprovado. Horários preservados; edição de horários/contato, pedidos e QR permanecem. Detalhes na [fase 19](GESTAO-V2-FASE-19.md).


Horários de delivery V2 integrados: períodos semanais, fuso, madrugada e remoção da restrição; testes de persistência/validação aprovados nos emuladores. Contato, pedidos, QR e catálogo ampliado seguem pendentes. [Registro fase 19](GESTAO-V2-FASE-19.md).


Mesas e QR V2 integrados localmente: cadastro/edição, vínculo PDV, QR por ID e paginação. Testes aprovaram duplicidade, proteção de conta aberta e 202 mesas. QR apenas localhost. Pedidos/contato e catálogo ampliado ainda pendentes. [Fase 19](GESTAO-V2-FASE-19.md).


Consulta gerencial de pedidos V2 integrada localmente: páginas de 25, status/pagamento/itens, atualização manual e permissões por loja. Testes em emuladores aprovados. Ações operacionais continuam nos terminais. Próximo: criação de produtos/adicionais/fotos e contato; integração visual final e piloto continuam pendentes. [Fase 19](GESTAO-V2-FASE-19.md).


Criação de produtos e adicionais V2 integrada localmente: grupos, opções, preços, limites e inativação, com rascunhos/versionamento. Testes em emuladores aprovados. Fotos/contato e integração visual final continuam pendentes. [Fase 19](GESTAO-V2-FASE-19.md).


Contato V2 integrado (telefone/endereço comerciais) e fotos por link Cloudinary com prévia/remoção ao salvar. Testes em emuladores aprovados. Upload direto de arquivo ainda PENDENTE, assim como integração final no painel redesenhado/piloto. [Fase 19](GESTAO-V2-FASE-19.md).


Upload direto V2: fluxo implementado com assinatura gerencial e testes simulados aprovados. Uso real ainda depende de CLOUDINARY_V2_CLOUD_NAME/API_KEY/API_SECRET e homologação externa. Nenhum arquivo enviado. Integração final ao painel redesenhado/piloto seguem pendentes. [Fase 19](GESTAO-V2-FASE-19.md).


Painel V2 com navegação e estrutura visual editorial integradas. Preview funcional aberto/autenticado em 53700/gestao-v2 com loja fictícia. Testes desktop/celular aprovados. Cloudinary real/piloto HTTPS continuam pendentes; mock53663 permanece separado. [Fase 19](GESTAO-V2-FASE-19.md).


Painel V2: proteção de rascunhos ao sair/fechar/recarregar e avisos de salvamento aprimorados; ensaio integrado e build aprovados. Sem publicação. [Fase 19](GESTAO-V2-FASE-19.md).


## Estado atual — catálogo e integração local encerrados (23/09/2026)

Concluído: controles explícitos de disponibilidade/pausa/retirada, fim da publicação automática ao editar e teste integrado gerente → cliente → serviços PDV/cozinha → pagamento/estoque, inclusive resposta perdida e repetição sem duplicidade. Regressão gerencial e build aprovados. Detalhes e arquivos: [Fase 19](GESTAO-V2-FASE-19.md).

Pendências desta frente: Cloudinary real; piloto HTTPS/QR no celular e aplicativo PDV instalado/impressora física. Publicação externa é uma etapa separada. Sem continuar pequenos ajustes visuais. O ensaio integrado atual usa UI gerente/cliente e callables reais dos terminais nos emuladores, não o equipamento instalado. Os registros anteriores abaixo/acima são históricos; esta atualização consolida o estado desta frente, não encerra o roadmap inteiro.

## Atualização — upload real local aprovado (23/09/2026)

Cloudinary já configurado nos emuladores; adicionar, visualizar, salvar, trocar e remover vínculo passaram na UI com imagens sintéticas, excluídas após o ensaio. Detalhes: [homologação do upload](UPLOAD-V2-HOMOLOGACAO.md). A pendência de upload real LOCAL está encerrada; configuração hospedada/produção permanece separada. Piloto de celular via HTTPS e impressora térmica física não estão concluídos (somente impressoras virtuais detectadas). Sem novas rodadas visuais e sem publicação externa.

Ensaio test/run-pairing-ui.cjs concluído com saída 0: interface Electron real do projeto, clássico/moderno, pedidos/cozinha/pagamento/estoque, requisição interrompida/retomada e recuperação aprovados em emuladores. Instalador, celular HTTPS e equipamento físico seguem pendentes; não repetir a suíte sem motivo novo. Registro completo na fase 19.

## Instalador local preparado — 23/09/2026

Build NSIS x64 3.2.38 concluído com --publish never em output/piloto-instalador-20260923, sem substituir instalação existente. Novo scripts/verificar-pacote-local.cjs conferiu 21 arquivos do app.asar contra fontes, dependências, ausência de .env/segredos/diretórios de desenvolvimento e proibição de perfis de teste no pacote. SHA-256 e relatório gravados; 10 testes de perfis aprovados. src/js/bundle.js regenerado (quatro linhas de whitespace do gerador no diff). EXE NotSigned. Nenhuma mudança funcional/deploy; instalador não executado.

Detalhes, comando e limites: [instalador local](INSTALADOR-LOCAL-20260923.md). Ainda pendentes instalação real em Windows separado, HTTPS/celular e impressora térmica. O pacote normal conecta aos serviços normais; não remover a proteção de perfis nem instalá-lo sobre a loja atual para simular homologação.

## Pré-verificação remota — 23/09/2026

Consultas autenticadas somente leitura no projeto aplicativo-pdv:
- functions:list retornou sucesso e lista vazia (zero Cloud Functions).
- Cloud Billing projects/billingInfo retornou billingEnabled=false. Bloqueia implantação das Cloud Functions V2, que exige Blaze; não tentar deploy repetidamente nem habilitar cobrança sem participação do titular.
- Firestore release ativo consultado; regras remotas não possuem catalogos_publicos_v2. Backup salvo em output/hospedagem-preflight/rules-remotas-backup.json; SHA256 a65580d055fc25bb0c148ca9b253ef5ce59d9b8712371493a129e7ecee2e7146. Nenhuma regra alterada.
- Auth permite e-mail; domínios autorizados incluem admin.flowpdv.com.br, cliente.flowpdv.com.br e cardapio.flowpdv.com.br. O campo de login anônimo não veio habilitado na resposta consultada; conferir/ativar antes do piloto consumidor. Não criar usuário/loja remota sem definir fixture e acesso.
- HTTPS cardapio.flowpdv.com.br e pdv.flowpdv.com.br responderam 200, servidor Vercel. Não há vínculo .vercel ou CLI vercel disponível neste checkout. Endereço existente utilizável; não exigir domínio novo.

Próxima ação externa necessária: titular habilitar faturamento/Blaze no Firebase aplicativo-pdv. Após isso: conferir diff das regras preservando legado, índices, APIs/segredos, implantar funções V2 de forma controlada, provisionar loja/gerente de teste e configurar frontend para origem HTTPS escolhida. Não habilitar VITE_V2_HOSPEDADO antes de backend pronto. Não há deploy feito nesta etapa.

Referência de requisito: https://firebase.google.com/docs/functions/get-started . Resultado sanitizado em output/hospedagem-preflight/resumo.json. Credenciais usadas apenas em memória; não repetir login:list --json com stdout exposto.


## Prioridade revisada pelo usuario — 23/09/2026

A otimizacao estrutural de sincronizacao incremental fica PARA DEPOIS: adicionar revisoes confiaveis por parte em todos os escritores, baixar apenas partes alteradas, validar duas lojas e depois comparar consumo hospedado. Nao iniciar essa implementacao agora. Otimizacoes locais ja concluidas (acompanhamento30s e deduplicacoes mobile/PDV) permanecem.

Validacao LOCAL de catalogo operacional, painel gerencial V2 e fluxo integrado esta encerrada nas condicoes documentadas: emuladores, Electron de desenvolvimento, upload Cloudinary sintetico real. Nao repetir suites amplas sem alteracao/risco novo.

Falta validacao EXTERNA: preparar e publicar backend/frontend V2 no ambiente existente, QR/HTTPS em celular real, instalacao/atualizacao em Windows separado e equipamentos fisicos. Instalador anterior nao inclui ultimas alteracoes e precisa novo build antes desse ensaio. Situacao atual de faturamento nao foi reconsultada; usuario informou solicitacao de reembolso. Nao tratar preflight antigo billingEnabled=false como estado atual.

Reconstrucao do ecossistema ainda pendente: site oficial, painel gerencial MOBILE do cliente (Flow Gestor) e Master. Mobile recebeu correcoes funcionais de autenticacao/sincronizacao; nao foi reconstruido visualmente. Master recebeu auditoria pontual nesta sequencia, nao redesign completo. Painel de gestao do CARDAPIO nao e o painel gerencial mobile. Impeccable continua previsto para essas tres frentes.

Pendencias mais amplas permanecem no roadmap: pagamentos integrados e fiscal no fluxo novo, ensaios fisicos/multiterminais e demais segmentos. Nao bloqueiam registrar o encerramento da validacao local ja feita.


## Atualizacao final — interfaces web publicadas (23/09/2026)
Usuario autorizou publicacao dos quatro frontends; site/mobile/Master reconstruidos e cardapio anterior publicados e confirmados via HTTPS. Registro: RECONSTRUCAO-WEB-PUBLICACAO-20260923.md. V2 backend/ativacao, testes completos e otimizacoes ficam para amanha. Nao repetir suites encerradas sem motivo. A linha anterior de reconstrucao visual pendente destas tres frentes foi substituida por implementacao publicada, com revisao/homologacao ainda pendentes.


## Roteiro para a proxima retomada — pedido do usuario em 23/09/2026

Usuario encerrou por hoje e pediu registrar para amanha, nesta ordem:
1. Verificar o estado dos quatro sites publicados: site oficial, gerencial mobile do cliente, Master e cardapio/painel. Conferir versao entregue, login/acesso, navegacao, telas desktop/celular, formularios e dados sem alterar registros reais inadvertidamente. Separar defeitos de interface de dependencias de backend.
2. Levantar e priorizar o que pode ser otimizado com evidencia: consultas/leitores e sincronizacao Firebase, consumo, carregamento/bundle/imagens e experiencia de uso. Retomar o planejamento de baixar somente partes alteradas, com revisoes confiaveis por parte; nao prometer economia na fatura a partir de mocks. Nao migrar banco/VPS nem mudar cobranca sem escopo concreto.
3. Definir roteiro de testes necessarios, com criterios de conclusao, e executar por prioridade na retomada. Incluir login/permissoes e isolamento entre lojas; cadastros/fotos; pedido/cozinha/pagamento/estoque; resposta perdida/reenvio e reconexao; celular HTTPS/QR; atualizacao/instalacao e impressora fisica conforme disponibilidade. Testes de pagamentos integrados/fiscal exigem suas integracoes; nao afirmar homologacao deles. Reutilizar evidencias locais aprovadas e repetir somente testes afetados ou ainda pendentes.

Ponto de partida: RECONSTRUCAO-WEB-PUBLICACAO-20260923.md e CONSUMO-PAINEIS-SYNC.md. Os quatro frontends foram publicados; backend/ativacao V2 do cardapio ainda pendente. Hoje nao executar mais alteracoes/testes nem criar agendamento automatico: anotacao para retomar quando o usuario voltar.
