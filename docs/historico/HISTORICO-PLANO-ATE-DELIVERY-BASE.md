# FlowPDV — plano completo e acompanhamento

Lista consolidada em 21/09/2026 a pedido do usuário, após a etapa 7X. Referência principal do escopo restante. Os documentos por etapa preservam detalhes e evidências históricas.

O objetivo é expandir o FlowPDV para alimentação, preservando os segmentos existentes e permitindo configurar o que cada cliente utiliza. Piloto e produto completo são marcos diferentes. Os números abaixo representam frentes de entrega, não uma estimativa de quantidade de alterações ou prazo.

## Marco 1 — primeira loja piloto

Escopo atualizado pelo usuário em 22/09/2026: uma lanchonete, um caixa, pedidos por QR/mesa, retirada, delivery próprio e atendimento por garçom, pagamentos manuais, cozinha com KDS e/ou impressão conforme a configuração. Delivery e garçom fazem parte do primeiro piloto e permanecem opcionais por cliente. Cada canal habilitado precisa estar validado antes do piloto. A inclusão amplia o trabalho necessário; não significa que esses módulos já estejam implementados.

Prioridade e ordem de execução: [escopo do piloto](../ESCOPO-PILOTO.md). As frentes 7 e 8 abaixo foram antecipadas para o Marco 1, mantendo a numeração para preservar as referências existentes.

### 1. Integração operacional e acesso — em andamento; próxima frente

- [x] Consulta de ativação por loja/terminal no servidor, com acesso revalidado.
- [x] Comando administrativo com revisão, auditoria e repetição segura.
- [x] Suspensão de novos pedidos e vendas das lojas aderentes, preservando recuperação autorizada.
- [x] Painel administrativo de homologação com estado, revisão e retomada de alteração.
- [x] Avisos e bloqueios no clássico/moderno de teste, preservando carrinho e acesso ao pagamento.
- [x] Testar suspensão/reativação com tentativa financeira pendente pela interface: cancelamento e conclusão após recarga, sem duplicação (7Y).
- [x] Repetir e inspecionar a captura do clássico que ficou vazia na etapa 7X (7Y).
- [ ] Validar terminal revogado com tentativa financeira pendente e recuperação por identidade autorizada, em conjunto com as frentes 2 e 13.
- [x] Transferir administrativamente a identidade financeira a um caixa novo, revogar o anterior e retomar baixa pendente sem duplicação no servidor (8I, emuladores).
- [x] Conferir e confirmar transferência pela interface da gerência, com journal e repetição segura após resposta perdida (8J).
- [ ] Extrair serviços do laboratório para perfil operacional de homologação, sem remover as proteções do teste.
- [x] Separar a criação das sessões e o monitor de autorização das telas (7Z).
- [x] Extrair o ciclo de autenticação/vínculo e revalidar as telas após troca de identidade ou revogação (8A).
- [ ] Integrar acesso, módulos, tratamento de falhas e recuperação ao aplicativo completo.
- [ ] Coordenar migração das identidades e permissões legadas, incluindo lojas sem adesão explícita.

Aceite: fluxo operacional integrado e testado nos dois layouts, sem dupla baixa, sem autorização indevida e com recuperação das pendências. As marcações concluídas acima se referem ao ambiente local de teste, não à produção.

### 2. Backup, restauração e migração — pendente de homologação completa

- [ ] Ensaiar restauração em perfil limpo/outro computador com vendas, turnos, estoque, vínculos e pendências.
- [ ] Definir inventário de corte e relatório de divergências por produto/unidade.
- [ ] Impedir que backup ou sincronização antiga sobrescrevam o saldo novo.
- [x] Bloquear importação, aplicação e publicação legadas de bases com evidências V2, preservando bases legadas comuns (8B).
- [x] Ensaiar backup e retomada em armazenamento vazio com identidade original, inclusive falhas de resposta e de disco (8C; servidor simulado).
- [x] Consultar identidade e registros no servidor e identificar vendas/estornos ausentes do backup sem alterar saldos (8E, turno atual).
- [x] Retomar a venda/cancelamento em armazenamento vazio com instância Firebase nova autenticada como o terminal original (8F, emuladores).
- [x] Disponibilizar diagnóstico do turno e de arquivo de backup no painel local, sem restauração automática (8G).
- [x] Conferir unidade/saldo de corte contra a migração e distinguir o saldo atual após movimentos (8H, servidor; inventário físico ainda pendente).
- [x] Ensaiar backup pendente em armazenamento vazio autenticado pelo novo caixa, conferindo delegação, turno e inventário antes da restauração e retomando a venda sem nova baixa (8K, emuladores).
- [x] Reconstruir uma cópia com vendas/estornos confirmados ausentes do turno aberto, sem reaplicar efeitos financeiros ou estoque (8L).
- [x] Conferir inventário de turnos e vendas locais do histórico, detectar ausências e recusar truncamento ou mudança de revisão (8M; até 50 turnos).
- [x] Preparar e salvar pela interface uma cópia recuperada, com revalidação, histórico e descarte de resposta após troca do arquivo (8N; download simulado no teste).
- [x] Separar perfis nomeados de origem/destino em desenvolvimento e verificar persistência sem compartilhar dados locais (8O).
- [x] Instalar arquivo em perfil nomeado novo, preservar autenticação própria e retomar escrita interrompida com bloqueio persistente (8P–8Q; Electron oculto e emuladores).
- [x] Conferir movimentos, formas de pagamento e resumos encerrados do restaurante antes da instalação, recusando divergências ou mudança de revisão (8R).
- [x] Mostrar diferenças dos resumos do restaurante na consulta do histórico/arquivo, preservando a base atual (8S; fluxo completo aprovado).
- [ ] Validar recuperação e reversão preservando movimentos posteriores ao corte.

Base existente: migração e retomada de produtos fictícios. Aceite: saldos e totais reconciliados após restauração, sem reaplicar efeitos financeiros.

### 3. Compatibilidade da loja e falhas de conexão — parcial

- [ ] Homologar os recursos necessários à loja piloto no clássico e no moderno.
- [ ] Testar queda real de conexão, reinício e retomada; documentar o que depende do servidor.
- [x] Interromper requisições na sessão Electron, verificar falha real da requisição e recuperar carrinho/autorização após reconexão (8D; não é queda física do computador/rede).
- [ ] Conferir relatórios, troco, descontos, cancelamentos, estornos e fechamento de turno no aplicativo integrado.

Aceite: operação realista do escopo do piloto sem perda ou duplicação. Simular o evento offline no navegador não substitui interromper a conexão de fato. A validação ampliada dos demais segmentos fica na frente 12.

### 4. Cardápio público e QR em celulares — integração local pronta; publicação pendente

- [ ] Preparar ambiente HTTPS e configurações de acesso de homologação.
- [ ] Gerar QR por loja/mesa com endereço utilizável no celular.
- [ ] Validar aparelhos e navegadores suportados, rede móvel, múltiplas abas e recuperação de envio.
- [ ] Apresentar pausa/suspensão, indisponibilidade e mudança de preço ao cliente.
- [ ] Preparar catálogo realista do piloto; aproveitar os recursos da frente 9 conforme necessários.

Aceite: pedido único, acompanhamento e identificação correta de loja/mesa no celular. Endereço localhost não é entrega pública.

### 5. Impressora e equipamentos — validação física pendente

- [ ] Validar modelo/conexão, papel 58/80 mm, acentos, corte e seleção de impressora.
- [ ] Testar falta de papel, desligamento, reconexão, segunda via e concorrência com cupom do caixa.
- [ ] Homologar leitor, teclado e demais periféricos usados pela loja.
- [ ] Definir operação QR → cozinha sem garçom e, se escolhido, sem KDS; estabelecer como atualizar o andamento.

Aceite: roteiro executado com equipamentos físicos, sem interpretar envio ao driver como prova de impressão. Depende do equipamento disponibilizado pela loja.

### 6. Implantação e piloto acompanhado — pendente

- [ ] Conferir hospedagem, requisitos e custos vigentes; estimar consumo e configurar acompanhamento.
- [ ] Validar runtime, instalador, regras, índices, Functions e versões compatíveis.
- [ ] Preparar backup, recuperação, logs, suporte e treinamento.
- [ ] Ensaiar implantação e executar um turno completo na loja piloto.
- [ ] Reconciliar pedidos, vendas, caixa e estoque; corrigir os problemas encontrados antes de ampliar.

Aceite: aprovação operacional do piloto com evidências. O trabalho local atual não garante produção gratuita para uma ou mais lojas. Contratações, publicação e uso de dados/equipamentos reais são passos próprios, não efeitos automáticos da implementação.

## Complementos incluídos no Marco 1 pelo usuário

### 7. Delivery próprio — pendente; incluído no piloto

- [ ] Endereço e contato do cliente com acesso restrito.
- [ ] Áreas, taxas, pedido mínimo, horários e prazo estimado.
- [x] Implementar configuração de regiões por CEP, taxa, mínimo e prazo, com cotação no servidor usando preços oficiais (backend; envio e telas ainda pendentes). Ver [base do delivery](../delivery-base-piloto.md).
- [ ] Fluxo de aceite, preparo, saída, entrega e cancelamento.
- [ ] Atribuição de entregador e acompanhamento do pedido.
- [ ] Pagamento, devolução e conciliação conforme as formas disponíveis.

Aceite: ciclo completo de entrega com falhas e cancelamento testados. Integrações com marketplaces não estão automaticamente incluídas nesta frente.

### 8. Aplicativo de garçom — pendente; incluído no piloto

- [ ] Login, papéis e autorização por loja.
- [ ] Pedidos por mesa, adicionais e observações.
- [ ] Concorrência entre dispositivos, confirmação de envio e recuperação.
- [ ] Funcionamento opcional: a loja deve continuar operando sem usar garçom.

Aceite: pedido chega uma única vez à mesa/cozinha e só pode ser operado por usuário autorizado.

## Marco 2 — funcionalidades adicionais do sistema completo

### 9. Cardápio completo — parcial

- [ ] Fotos e integração de imagens, categorias e ordenação.
- [ ] Apresentação e navegação adequadas ao celular.
- [ ] Disponibilidade, esgotamento e regras de adicionais revisadas na interface final.
- [ ] Gestão e publicação do catálogo pela loja, com limites e validações claros.

Base existente: catálogo V2 com preços, adicionais, quantidades, observações e acompanhamento no teste. Aceite: loja administra o catálogo e cliente completa o pedido nos aparelhos suportados.

### 10. Pagamentos integrados — pendente no fluxo novo

- [ ] Definir integrações aplicáveis e preservar a opção manual.
- [ ] Conectar cobrança/autorização ao novo registro de venda.
- [ ] Tratar resposta incerta, consulta, confirmação, conciliação e estorno.
- [ ] Homologar com o fornecedor antes de uso real.

O legado possui trabalho de TEF, mas isso não prova integração ao V2. Pix manual não representa confirmação bancária automática. A escolha e habilitação de fornecedores dependem de credenciamento, equipamento e condições vigentes.

### 11. Emissão fiscal no fluxo novo — pendente de integração/homologação

- [ ] Definir documentos e requisitos aplicáveis à operação da loja.
- [ ] Integrar emissão, retorno, cancelamento e recuperação ao registro de venda.
- [ ] Validar configurações e cenários de contingência conforme o serviço adotado.

Aceite: homologação fiscal aplicável concluída. Não presumir que a integração antiga cobre o fluxo novo nem habilitar emissão real durante testes fictícios.

### 12. Compatibilidade completa por segmento — parcial; homologação ampliada pendente

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

Base existente: módulos de loja no teste, papéis V2 e conciliação financeira. Aceite: cada cliente só acessa o que está autorizado, utiliza o que configurou e recebe relatórios reconciliados.

## Como acompanharemos

1. Continuar pela frente 1 até o aceite; depois seguir as dependências do piloto.
2. Para cada parte, registrar o que mudou, os testes, as limitações e o próximo passo.
3. Atualizar esta lista ao concluir uma entrega; não marcar uma frente inteira por terminar apenas uma subetapa.
4. Reaproveitar entregas sobrepostas: fotos/categorias feitas para o piloto também contam na frente 9, por exemplo.
5. Não usar porcentagem sem base. “Completo” significa os aceites do escopo acordado atendidos, incluindo homologações externas necessárias.
6. Recursos adicionais descobertos serão apresentados como mudança de escopo, sem ampliar silenciosamente a lista.

## Próxima parte concreta

**Frentes 1 e 2: completar conferência e recuperação antes de liberar o perfil novo.** As etapas 8A–8K prepararam acesso, diagnóstico, transferência e restauração isolada. As etapas 8L–8N recuperam vendas/devoluções confirmadas ausentes do turno aberto, conferem vendas locais do histórico e permitem salvar uma cópia revalidada pela interface. A 8O separa perfis de teste de origem/destino; 8P–8Q instalam o arquivo no perfil novo com retomada de escrita interrompida, autenticação própria e bloqueio após recarga. Continuam pendentes sangrias/rotinas legadas, contagem consolidada, contas abertas do restaurante, recuperação de turnos ausentes/fechados e paginação ampliada. Integração ao login normal e migração de permissões também continuam pendentes. Remover o marcador manualmente não é um fluxo suportado de liberação.

A etapa 7Y concluiu os cenários de suspensão com venda pendente e a repetição da captura do clássico. A etapa 8I cobre a retomada no servidor por outra identidade autenticada; a restauração completa no novo equipamento ainda precisa de integração.

## Referências

- [Prontidão do piloto — etapa 7S](prontidao-piloto-etapa-7s.md).
- [Acesso operacional — etapa 7X](acesso-operacional-etapa-7x.md).
- [Suspensão com venda pendente — etapa 7Y](suspensao-pendencias-etapa-7y.md).
- [Serviços de sessão e autorização — etapa 7Z](servicos-homologacao-etapa-7z.md).
- [Ciclo de acesso, backup e interrupção de rede — etapas 8A a 8D](continuidade-etapas-8a-8d.md).
- [Conferência remota e recuperação com sessão nova — etapas 8E a 8G](conferencia-recuperacao-etapas-8e-8g.md).
- [Inventário de corte — etapa 8H](inventario-corte-etapa-8h.md).
- [Recuperação administrativa de caixa — etapas 8I e 8J](recuperacao-terminal-etapas-8i-8j.md).
- [Restauração autorizada — etapa 8K](restauracao-autorizada-etapa-8k.md).
- [Movimentos posteriores e histórico — etapas 8L a 8N](recuperacao-posterior-etapas-8l-8n.md).
- [Perfis separados para recuperação — etapa 8O](perfis-isolados-etapa-8o.md).
- [Instalação no perfil novo — etapas 8P e 8Q](instalacao-perfil-etapas-8p-8q.md).
- [Conferência dos fechamentos na recuperação — etapa 8R](conferencia-fechamento-etapa-8r.md).
- [Diagnóstico financeiro na interface — etapa 8S](diagnostico-fechamentos-etapa-8s.md).
- [Painel administrativo — etapa 7W](painel-ativacao-etapa-7w.md).

Esta consolidação acompanha as etapas 8A–8S. As evidências de cada execução estão nos documentos das etapas e no [relatório de continuidade de 22/09](RELATORIO-CONTINUIDADE-2026-09-22.md). Não representa nova auditoria de todos os segmentos ou uma entrega das funcionalidades marcadas como pendentes.
