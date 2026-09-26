# Etapa 7P — primeira integração ao balcão

O perfil de teste agora oferece **PDV de balcão**, reutilizando a estrutura do PDV moderno: entrada de produtos, tabela do carrinho e cartão de total. Os comandos dessa tela operam o mesmo carrinho usado pelo painel de pagamentos; não criam uma segunda venda ou rascunho. O layout clássico não foi integrado nem validado visualmente nesta etapa e permanece uma pendência explícita.

## Operação

Abra **PDV de balcão** no painel da loja de teste. Após confirmar o acesso do terminal e abrir o turno, pesquise pelo nome, código de barras ou identificador e selecione o produto. Informe a quantidade na unidade cadastrada. Um código exato seguido de Enter adiciona o produto; repeti-lo soma a quantidade na mesma linha. Códigos ambíguos exigem seleção explícita.

A lista inclui somente produtos com migração confirmada na loja autorizada. É possível alterar a quantidade, remover a linha ou limpar o carrinho. Os rascunhos e avisos de gravação seguem a etapa 7O. O estoque disponível continua sendo verificado pelo servidor na tentativa de registrar a venda.

**Conferir e finalizar**, ou F4 com foco no balcão, abre a conferência de pagamentos existente. Confira novamente os itens, ajustes, formas recebidas e troco antes de registrar. Pendências direcionam à tentativa original. A venda continua usando a mesma baixa remota, gravação local e confirmação recuperável.

## Compatibilidade e limites

A integração só é instalada com `ambienteTeste === true`. O fluxo normal de inicialização e finalização do `PdvModule` permanece fora desta integração. O layout original é reaproveitado no perfil de teste, mas seus comandos inline antigos são removidos, evitando que uma ação da tela use o caminho antigo de baixa local.

Esta é a primeira integração do balcão. O fechamento ainda ocorre no painel de conferência de teste; não substitui o modal de pagamento do PDV real. Mesas/comandas, fardos, fiado, fidelidade, sangria, fiscal, balança e impressão não ganharam novos comandos nesta etapa. Não há interpretação de código de balança ou sintaxe `3*código` no novo campo; a quantidade é informada separadamente.

Próximas etapas: integrar e validar também o layout clássico; aproximar a conferência e a finalização da operação de balcão, com foco, atalhos e estados de pendência próprios, antes de planejar a ativação controlada na loja piloto. Nenhuma publicação é feita nesta etapa.

Implementação seguinte: [integração do clássico — etapa 7Q](classico-operacional-etapa-7q.md).

## Validação

Testes locais e de regressão do legado, fluxo completo em Electron oculto e capturas em 1366×768 e 1024×768. O fluxo verifica código exato, soma de quantidade, busca por nome, remoção, total, F4, recuperação do rascunho e confirmação final pelo mesmo servidor.

160 testes distintos aprovados: 83 locais e 77 do legado, além do fluxo completo em Electron oculto, encerrado com código 0. As capturas foram inspecionadas nos dois tamanhos de janela. A revisão removeu a sobreposição dos atalhos flutuantes, melhorou o contraste do total e identificou a unidade de cada produto. A consulta geométrica por ponto foi mantida apenas como diagnóstico; a disposição dos controles foi confirmada pelas capturas, e as ações foram exercitadas pelo fluxo funcional.

O modo balcão inclui **Voltar ao painel** para acessar os demais controles. O carrinho foi finalizado pela ponte existente com pagamento dividido e ajustes; estoque, recarga e rascunho permaneceram consistentes. O layout clássico continua pendente. Os emuladores foram encerrados, sem publicação ou operação financeira real.

Evidências em `output/etapa-7p-local.log`, `etapa-7p-legado.log`, `etapa-7p-interface.log`, `etapa-7p-bundle.log` e `etapa-7p/balcao-*.png`.
