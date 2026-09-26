# FlowPDV — resumo do projeto

Atualizado em 23/09/2026. Comece por este arquivo. O [plano completo](PLANO-COMPLETO-FLOWPDV.md) guarda a lista detalhada de pendências e seus critérios de conclusão.

Prioridade atualizada em 23/09/2026: o usuário retomou o projeto completo e autorizou continuidade por etapas sem perguntar a cada passo. As correções originais continuam entregues localmente. Retomar integração, recuperação e demais frentes abaixo, com verificações direcionadas e avisos curtos. Publicação permanece suspensa. O acabamento de todos os sistemas está detalhado em [Impeccable no ecossistema](IMPECCABLE-ECOSSISTEMA.md).

## Onde estamos

Estamos ampliando o sistema para lanchonetes, mantendo os outros segmentos e os layouts clássico e moderno. QR/mesa, retirada, delivery, garçom e cozinha devem ser opcionais por loja.

Há implementação e testes locais de pedidos, caixa/estoque, cozinha, configuração de delivery, atendimento do garçom, permissões e recuperação. Isso ainda não significa integração completa ao aplicativo normal nem liberação para uma loja real. Evidências recentes: [delivery e garçom](configuracao-delivery-garcom.md).

Últimos avanços: perfil separado que inicializa o aplicativo completo, com login nativo e os dois layouts, além dos painéis de homologação. A venda manual do carrinho nativo passou a usar o registro e estoque do servidor, com adesão explícita e recuperação de confirmação interrompida. Acesso dos painéis acompanha login/logout; configuração exige gerente local e autenticação remota. Isso ainda não equivale à integração de todos os módulos ou à liberação para produção. Detalhes no [histórico de continuidade](historico/RELATORIO-CONTINUIDADE-2026-09-22.md).

O catálogo também passou com categorias, ordenação, descrição, URL Cloudinary validada e pausa/publicação pela gerência. Pedidos já enviados continuam recuperáveis durante a pausa. Falta validar imagens reais/upload e publicação externa. A recuperação passou a diagnosticar a aritmética da gaveta, sem interpretar o arquivo como prova de dinheiro físico.

A recuperação agora também consulta contas abertas e pedidos aguardando recebimento, em páginas de 50. Rotinas antigas de venda, fechamento e estoque não podem alterar um perfil bloqueado; produtos migrados continuam protegidos mesmo fora do modo de teste. A retomada de venda após reinício passou no aplicativo completo; a restauração ampla de perfis ainda depende de conferências antes de qualquer liberação operacional.

No aplicativo completo de teste, abrir/fechar caixa encaminha ao controle integrado existente. O fechamento ainda tem etapas separadas de conferência do restaurante e do caixa completo. Preços usam o campo real `precoVenda`, e o fundo do turno integrado entra no cálculo da gaveta antes do encerramento. TEF/fiscal, fiado e embalagens alternativas não são convertidos silenciosamente em vendas manuais no fluxo novo.

Delivery e pedido pela API do garçom também passaram no aplicativo completo: recebimento, Pix/dinheiro, entrega, estorno com reposição e fechamento consolidado. Isso não substitui o ensaio da interface do garçom em aparelhos reais. Vendas confirmadas no servidor agora recusam alterações pela rotina legada de atualização.

A gerência agora carrega mesas por páginas, sem deixar de abrir quando há mais de 200. Sem KDS, o caixa pode confirmar preparo e entrega de pedidos de mesa/retirada; delivery mantém seus controles próprios. São funções locais de homologação, ainda sem validação de impressão física.

## O que falta, na ordem de trabalho

1. **Integração operacional:** conectar acesso e módulos ao aplicativo completo; concluir recuperação de caixa, backup e conferência financeira.
2. **Fluxos completos:** validar clássico/moderno, delivery e garçom com pagamentos, cancelamentos, falhas e retomadas; completar acesso dos funcionários e consultas de maior volume.
3. **Catálogo e gestão:** imagens reais/upload, publicação HTTPS, permissões, recursos contratados e relatórios; categorias, ordenação e pausa/publicação já foram testadas localmente.
4. **Preparação do piloto:** ambiente HTTPS, QR utilizável no celular, instalador/atualização, monitoramento, suporte e ensaio de um turno completo.
5. **Validações externas:** celulares e rede física, equipamentos da loja, impressão e operação acompanhada. Exigem ambiente/equipamento disponível.
6. **Complementos do produto:** pagamentos integrados, emissão fiscal e homologação ampliada de segmentos e vários terminais. Pagamentos manuais continuam como opção para o piloto.
7. **Visual:** direção aprovada; Estoque, Clientes, Caixa, Gerência, Comandas, Configurações e padrão dos modais operacionais aplicados localmente. PDVs Moderno e Clássico também receberam acabamento local. Atendimento, cardápio e garçom seguem pendentes. Ver [execução visual e validações](visual-implementacao.md). As homologações funcionais acima continuam necessárias.

Esta é uma visão resumida, não sete alterações pequenas. As 14 frentes do plano detalham o escopo; não há percentual confiável de conclusão.

## Quem define impressora e fornecedores

A loja informa seus equipamentos, meios de recebimento e necessidades. O FlowPDV define o que suporta, implementa as integrações e valida a compatibilidade. Dados fiscais e requisitos da loja são tratados com seu contador. Você não precisa escolher tudo agora para continuarmos o desenvolvimento. Veja [responsabilidades de implantação](responsabilidades-implantacao.md).

## Como vamos continuar

- Trabalho atual: reconstrução visual de gestão e cardápio cliente, conforme correção de escopo do usuário, na [fase 18](REDESIGN-CARDAPIO-FASE-18.md). Demonstração local navegável; integração gerencial V2 continua pendente.
- Avançar por etapas sem novas perguntas de continuidade; comunicar entregas e limitações em poucas linhas.
- Não abrir telas automaticamente. Testes locais usam dados fictícios.
- Publicação, contratação, emissão real e impressão física ainda dependem de preparação específica.
- Atualizar este resumo quando mudar a próxima entrega; manter tarefas concluídas fora do plano de pendências.

## Documentos de referência

- [Plano completo — somente o que falta](PLANO-COMPLETO-FLOWPDV.md).
- [Escopo da primeira loja piloto](ESCOPO-PILOTO.md).
- [Preparação de implantação e infraestrutura](preparacao-implantacao.md).
- [Compatibilidade dos segmentos e limites dos testes](compatibilidade-segmentos.md).
- [Histórico das etapas](historico/README.md): consultas técnicas antigas, não lista atual de tarefas.

Os demais documentos nesta pasta descrevem APIs, módulos e procedimentos técnicos. Para acompanhar o andamento, basta este resumo e o plano completo.


- [Gestão V2 — fase 19](GESTAO-V2-FASE-19.md): acesso, consulta e edição inicial do catálogo nos emuladores.
