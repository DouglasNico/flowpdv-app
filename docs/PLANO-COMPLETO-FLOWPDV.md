# FlowPDV — o que ainda falta

Para acompanhar rapidamente: [resumo do projeto](README.md). Este arquivo mantém os critérios detalhados de conclusão.

Para acompanhar as entregas recentes e todas as frentes restantes: [acompanhamento das pendências](ACOMPANHAMENTO-PENDENCIAS.md). Publicação suspensa; correções, auditoria recuperável, cancelamento de delivery e integração operacional avançaram nas fases 6 a 9.

Atualizado em 23/09/2026. Esta lista mostra somente pendências. As entregas concluídas ficam nos relatórios e no histórico arquivado.

O objetivo é expandir o FlowPDV para alimentação, preservando os segmentos existentes e permitindo configurar o que cada cliente utiliza. Piloto e produto completo são marcos diferentes. Os números abaixo representam frentes de entrega, não uma estimativa de quantidade de alterações ou prazo.

Prioridade atualizada em 23/09/2026: o usuário retomou o projeto completo e autorizou continuidade por etapas sem perguntar a cada passo. As correções originais continuam entregues localmente. Retomar integração, recuperação e demais frentes abaixo, com verificações direcionadas e avisos curtos. Publicação permanece suspensa. O acabamento de todos os sistemas está detalhado em [Impeccable no ecossistema](IMPECCABLE-ECOSSISTEMA.md).

## Marco 1 — primeira loja piloto

Prioridade inicial: configurações, permissões e integrações antes do acabamento. Em 22/09/2026, o usuário aprovou a proposta visual e autorizou sua aplicação por etapas, incluindo os modais operacionais. Isso não encerra as pendências funcionais abaixo. Homologações físicas e integrações externas só serão retiradas desta lista quando houver evidência de conclusão. O avanço visual fica em [execução visual](visual-implementacao.md).

Escopo atualizado pelo usuário em 22/09/2026: uma lanchonete, um caixa, pedidos por QR/mesa, retirada, delivery próprio e atendimento por garçom, pagamentos manuais, cozinha com KDS e/ou impressão conforme a configuração. Delivery e garçom fazem parte do primeiro piloto e permanecem opcionais por cliente. Cada canal habilitado precisa estar validado antes do piloto. A inclusão amplia o trabalho necessário; não significa que esses módulos já estejam implementados.

Prioridade e ordem de execução: [escopo do piloto](ESCOPO-PILOTO.md). As frentes 7 e 8 abaixo foram antecipadas para o Marco 1, mantendo a numeração para preservar as referências existentes.

### 1. Integração operacional e acesso — em andamento; próxima frente

- [ ] Completar revogação definitiva/troca de identidade com tentativa financeira pendente, em conjunto com as frentes 2 e 13. Desativação e reautorização do mesmo membro com retomada passaram no aplicativo completo na fase 6.
- [ ] Completar integração dos módulos ao aplicativo completo, incluindo permissões remotas por funcionário e recuperação ampla de perfis; login nativo, venda manual e retomada de confirmação interrompida já passaram localmente.
- [ ] Coordenar migração das identidades e permissões legadas, incluindo lojas sem adesão explícita.

Aceite: fluxo operacional integrado e testado nos dois layouts, sem dupla baixa, sem autorização indevida e com recuperação das pendências.

### 2. Backup, restauração e migração — pendente de homologação completa

- [ ] Ensaiar restauração em perfil limpo/outro computador com vendas, turnos, estoque, vínculos e pendências.
- [ ] Validar inventário físico e divergências de corte com dados representativos da loja.
- [x] Homologar no aplicativo integrado a proteção contra sobrescrita por backup/sincronização legados. Fase 10: importação, troca de loja, carregamento e restauração recusados sem alterar vendas/caixa/estoque.
- [ ] Completar conferência independente de sangrias, vendas, contagem física, conciliação das contas abertas consultadas e recuperação de turnos fechados/ausentes; a checagem aritmética do backup não comprova a integridade desses movimentos.
- [x] Fechar turno recuperado sem contas/pedidos ou pagamentos incertos, com gerente, comprovantes e retomada persistente. [Fase 12](FECHAMENTO-RECUPERADO-FASE-12.md): validado localmente, sem publicação.
- [x] Preservar contas/pedidos após conferência gerencial explícita e revalidação transacional. [Fase 13](PENDENCIAS-RECUPERACAO-FASE-13.md): implementação e testes locais.
- [x] Persistir e retomar o registro manual de pagamento de atendimento após resposta perdida. [Fase 14](PAGAMENTO-ATENDIMENTO-FASE-14.md).
- [ ] Conciliar pagamentos externos incertos, conciliar tentativas ausentes/divergentes/estornadas e ampliar limites/paginação quando necessário. Recuperação de pagamento já confirmado em perfil transferido implementada na [fase 15](PAGAMENTO-RECUPERADO-FASE-15.md). Fase 11 implementa e testa liberação autorizada para novo turno com histórico encerrado, conferência independente e nenhuma pendência.
- [ ] Ampliar recuperação e reversão com movimentos posteriores ao corte em cenários representativos da loja. Fase 11 preservou saldo atual após movimento posterior e validou venda após liberação sem duplicação.


### 3. Compatibilidade da loja e falhas de conexão — parcial

- [ ] Homologar os recursos necessários à loja piloto no clássico e no moderno.
- [ ] Homologar queda da rede física, reinício e retomada no aplicativo integrado; a interrupção do transporte HTTP local do garçom já foi testada, mas não substitui esse ensaio.
- [ ] Ampliar conferência de relatórios, descontos, cancelamentos e estornos no aplicativo integrado; venda nativa manual, troco e ciclo básico de turno possuem ensaio local.

Aceite: operação realista do escopo do piloto sem perda ou duplicação. Simular o evento offline no navegador não substitui interromper a conexão de fato. A validação ampliada dos demais segmentos fica na frente 12.

### 4. Cardápio público e QR em celulares — integração local pronta; publicação pendente

- [ ] Preparar ambiente HTTPS e configurações de acesso de homologação.
- [ ] Gerar QR por loja/mesa com endereço utilizável no celular.
- [ ] Validar aparelhos e navegadores suportados, rede móvel, múltiplas abas e recuperação de envio.
- [ ] Apresentar pausa/suspensão, indisponibilidade e mudança de preço ao cliente.
- [ ] Preparar catálogo realista do piloto; aproveitar os recursos da frente 9 conforme necessários.

Aceite: pedido único, acompanhamento e identificação correta de loja/mesa no celular. Endereço localhost não é entrega pública.

### 5. Impressora e equipamentos — validação física pendente

Modelos/conexões serão informados pela loja piloto. Cabe ao FlowPDV definir a compatibilidade suportada e validar equipamentos representativos; não exigir que o proprietário do produto já tenha escolhido uma impressora. Preparar e testar simulações não encerra esta frente. Divisão completa em [responsabilidades](responsabilidades-implantacao.md).

- [ ] Validar modelo/conexão, papel 58/80 mm, acentos, corte e seleção de impressora.
- [ ] Testar falta de papel, desligamento, reconexão, segunda via e concorrência com cupom do caixa.
- [ ] Homologar leitor, teclado e demais periféricos usados pela loja.
- [ ] Homologar na loja o fluxo QR → cozinha sem garçom/KDS, com atualização manual do andamento pelo caixa e impressão física, se escolhida.

Aceite: roteiro executado com equipamentos físicos, sem interpretar envio ao driver como prova de impressão. Depende do equipamento disponibilizado pela loja.

### 6. Implantação e piloto acompanhado — pendente

Referência de preparação e dependências: [implantação](preparacao-implantacao.md). A conferência de runtime não encerra esta frente.

- [ ] Definir hospedagem de homologação, medir/estimar consumo e configurar acompanhamento e limites no projeto remoto.
- [ ] Validar instalador, dependências nativas, implantação de regras/índices/Functions e atualização de uma instalação existente.
- [ ] Preparar backup, recuperação, logs, suporte e treinamento.
- [ ] Ensaiar implantação e executar um turno completo na loja piloto.
- [ ] Reconciliar pedidos, vendas, caixa e estoque; corrigir os problemas encontrados antes de ampliar.

Aceite: aprovação operacional do piloto com evidências. O trabalho local atual não garante produção gratuita para uma ou mais lojas. Contratações, publicação e uso de dados/equipamentos reais são passos próprios, não efeitos automáticos da implementação.

## Complementos incluídos no Marco 1 pelo usuário

### 7. Delivery próprio — integração operacional e homologação pendentes

- [ ] Homologar queda física de conexão e decidir se a loja precisa de aceite manual em vez do recebimento automático. Pagamento após saída e cancelamento pelo caixa passaram no aplicativo completo; cancelamento antes de recebimento e retomada após resposta incerta passaram nos testes locais das fases 6/7.
- [ ] Validar o cupom de entrega em impressora física e integrar sua fila de impressão; a prévia local não imprime.
- [ ] Homologar o fluxo completo em celular físico e caixa.

Aceite: ciclo completo de entrega com falhas e cancelamento testados. Integrações com marketplaces não estão automaticamente incluídas nesta frente.

### 8. Aplicativo de garçom — integração operacional e homologação pendentes

- [ ] Homologar dispositivos físicos simultâneos, troca de conta e recuperação de pendências em outro aparelho.
- [ ] Integrar acesso de garçom ao ambiente HTTPS e ao aplicativo operacional completo.

Aceite: pedido chega uma única vez à mesa/cozinha e só pode ser operado por usuário autorizado.

## Marco 2 — funcionalidades adicionais do sistema completo

### 9. Cardápio completo — parcial

- [ ] Validar fotos reais da conta Cloudinary e definir envio de imagens pela loja; o cadastro de URL pública, categorias e ordenação já funciona localmente.
- [ ] Apresentação e navegação adequadas ao celular.
- [ ] Disponibilidade, esgotamento e regras de adicionais revisadas na interface final.
- [ ] Homologar a gestão e publicação do catálogo no aplicativo completo e no ambiente HTTPS; publicação/pausa e validações do catálogo passaram localmente.


### 10. Pagamentos integrados — pendente no fluxo novo

O FlowPDV precisa definir as integrações suportadas; cada loja providencia seu cadastro/contrato e conta de recebimento compatíveis. O piloto local usa pagamento manual e não depende dessa contratação.

- [ ] Definir integrações aplicáveis e preservar a opção manual.
- [ ] Conectar cobrança/autorização ao novo registro de venda.
- [ ] Tratar resposta incerta, consulta, confirmação, conciliação e estorno.
- [ ] Homologar com o fornecedor antes de uso real.

O legado possui trabalho de TEF, mas isso não prova integração ao V2. Pix manual não representa confirmação bancária automática. A escolha e habilitação de fornecedores dependem de credenciamento, equipamento e condições vigentes.

### 11. Emissão fiscal no fluxo novo — pendente de integração/homologação

A solução técnica de emissão deve ser definida pelo FlowPDV. Dados, credenciais e requisitos do contribuinte serão tratados com cada loja e seu contador. Nenhuma emissão real autorizada.

- [ ] Definir documentos e requisitos aplicáveis à operação da loja.
- [ ] Integrar emissão, retorno, cancelamento e recuperação ao registro de venda.
- [ ] Validar configurações e cenários de contingência conforme o serviço adotado.

Aceite: homologação fiscal aplicável concluída. Não presumir que a integração antiga cobre o fluxo novo nem habilitar emissão real durante testes fictícios.

### 12. Compatibilidade completa por segmento — parcial; homologação ampliada pendente

Referência de evidências e lacunas: [matriz de compatibilidade](compatibilidade-segmentos.md).

- [ ] Adega: embalagens/fardos, retornáveis e demais rotinas utilizadas.
- [ ] Mercadinho: unidades, peso, códigos e periféricos utilizados.
- [ ] Padaria: venda por peso, produtos e operação de alimentação quando aplicável.
- [ ] Roupas: variações, trocas e rotinas comerciais utilizadas.
- [ ] Revisar fiado, descontos, relatórios, estoque e integrações de cada segmento.
- [ ] Validar clássico e moderno sem impor funções de restaurante às outras lojas.

Aceite: matriz de funções por segmento com testes e limitações explícitos. O cadastro de segmento sozinho não implementa regras comerciais. Recursos já existentes devem ser conferidos antes de decidir por alterações.

### 13. Vários terminais, desempenho e recuperação — pendente de homologação ampliada

- [ ] Validar concorrência entre caixas, cozinha e dispositivos de atendimento.
- [ ] Definir fonte de saldo e sincronização sem conflito com backups legados.
- [ ] Testar recuperação em outro terminal, revogação e troca de equipamento.
- [ ] Ampliar paginação e limites conforme volume medido.
- [ ] Testar carga, latência, erros, filas e consumo de infraestrutura.

Aceite: volume e número de terminais suportados documentados e testados, sem promessa genérica de sincronização perfeita ou operação integral offline.

### 14. Gestão comercial, permissões e relatórios — parcial

- [ ] Planos e recursos contratados por cliente, independentes dos recursos que ele decide utilizar.
- [ ] Permissões por funcionário e trilha de alterações administrativas.
- [ ] Configuração opcional de QR, retirada, delivery, garçom, KDS e impressão conforme disponibilidade real.
- [ ] Relatórios de vendas, caixa, estoque, cancelamentos e estornos do fluxo integrado.
- [ ] Conferir exportações e totais, sem contar uma venda em duplicidade.
- [ ] Documentar instalação, atualização, suporte e recuperação.



## Próxima entrega do projeto completo

Atualização de escopo: usuário priorizou reconstrução visual completa do painel e do cardápio cliente. Implementação e demonstração na [fase 18](REDESIGN-CARDAPIO-FASE-18.md); integração gerencial V2 permanece como próxima frente funcional.

Persistência e retomada de pagamento manual entregues na fase 14; conferência de pagamento confirmado no perfil recuperado implementada na fase 15. Aba Catálogo do painel legado refinada e testada localmente na [fase 16](PAINEL-CARDAPIO-FASE-16.md). Loja, Pedidos e QR/links revisados na [fase 17](PAINEL-ABAS-FASE-17.md), com mapa V2 documentado. Próxima frente: acesso gerencial V2 e consulta de configuração no painel em emuladores. Publicação real e upload permanecem pendentes. Demais casos de conciliação permanecem na frente 2.

## Continuidade do projeto completo

Concluir a integração operacional de delivery/garçom ao aplicativo completo, recuperação ampla, permissões e conferência de caixa. Login, venda manual nativa nos dois layouts e retomada após reinício passaram no perfil isolado; ainda falta ampliar o ensaio aos demais fluxos. Configuração de regiões/horários, consulta protegida de entrega, saída com responsável e base funcional do garçom foram retiradas das pendências locais após os testes registrados em [configuração e operação](configuracao-delivery-garcom.md). As homologações e limitações restantes continuam acima.

## Acabamento visual — aplicação aprovada, pendências

### Revisão das notificações — implementação e validação local em andamento

Fase 4: avisos de sincronização manual, backup e salvamento local revisados e testados. Restam cadastros, XML, restauração e configurações adicionais. Evidências em [avisos administrativos](AVISOS-ADMINISTRATIVOS-FASE-4.md).

Fase 3 local concluída: corrigidos avisos antecipados de impressão, popup bloqueado e serviço ausente; pendências críticas com leitura persistente; entrada inválida no atendimento com orientação e agrupamento. Arquivos e testes em [avisos operacionais — fase 3](AVISOS-OPERACIONAIS-FASE-3.md). Próxima revisão deste grupo: mensagens dos módulos administrativos (cadastros, importações, sincronização e configurações).

Atualização em 22/09/2026: primeira implementação local concluída, com componente compartilhado, agrupamento de itens, fechamento manual e testes Electron. Evidências, arquivos e limites em [notificações — fase 2](NOTIFICACOES-FASE-2.md). Permanecem a revisão dos demais textos/necessidade de avisos e a homologação integrada em ambos os layouts e atendimento.

Continuação: ensaio integrado local aprovado nos PDVs Clássico/Moderno, Comandas/Mesas e terminal de atendimento em duas resoluções, incluindo troca de operador com limpeza de avisos/fila. Homologação com equipamentos reais e revisão dos demais textos continuam pendentes; não confundir este ensaio com validação de pagamentos ou licenciamento.

- [ ] Inventariar avisos do sistema, incluindo PDV Clássico/Moderno e Comandas/Mesas: cortesia com carrinho vazio, item adicionado ao carrinho e item adicionado à comanda.
- [ ] Avaliar frequência e necessidade dos avisos; definir quando usar confirmação discreta no próprio componente, notificação temporária ou mensagem persistente que exige ação.
- [x] Aplicar aparência compartilhada com tipografia, espaçamento, ícones e distinção entre sucesso, informação, impedimento e erro; Impeccable utilizado na fase 2.
- [ ] Revisar posição, duração, fechamento e agrupamento de avisos repetidos, sem cobrir controles nem roubar o foco do leitor/teclado durante vendas.
- [ ] Validar legibilidade, acessibilidade e comportamento em telas menores, adição rápida de vários itens e falhas operacionais, nos dois PDVs e em Comandas/Mesas.

Aceite: avisos claros e apresentáveis, sem acúmulo ou interrupções desnecessárias; erros importantes permanecem perceptíveis e sucesso só é comunicado após a ação confirmada. Continuidade da implementação autorizada pelo usuário após o registro inicial no planejamento.

### Demais pendências visuais

Impeccable está incluído explicitamente para os sistemas web. Escopo, estados e critérios de conclusão em [Impeccable no ecossistema](IMPECCABLE-ECOSSISTEMA.md).

- [ ] Ampliar a validação dos formulários e estados administrativos com módulos reais, permissões e integrações; primeira aplicação visual concluída.
- [ ] Aplicar a direção aprovada ao Flow Gestor, Master, painel de cardápio e consumidor, preservando papéis e canais opcionais.
- [ ] Aplicar o acabamento próprio das telas de venda Clássico e Moderno e do atendimento/garçom, com regressão separada por modalidade.
- [ ] Alinhar o site comercial às funcionalidades efetivamente disponíveis; publicação depende de autorização própria.

Histórico: [plano anterior](historico/HISTORICO-PLANO-ATE-DELIVERY-BASE.md) e [relatório de continuidade](historico/RELATORIO-CONTINUIDADE-2026-09-22.md).


### Continuação dos caixas

PDV Moderno recebeu acabamento local; permanecem a regressão integrada completa da venda e a validação integrada do Clássico, cujo acabamento local foi aplicado. Evidências e limites em `visual-implementacao.md`.


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
