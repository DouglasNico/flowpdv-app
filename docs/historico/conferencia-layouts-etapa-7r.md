# Etapa 7R — conferência no contexto do PDV

O clássico e o moderno abrem a mesma conferência financeira validada, identificando o layout de origem. Nesse acesso, seções de estorno, histórico e fechamento do turno ficam fora da conferência da venda. O acesso geral por Fechamentos de teste continua disponível com todas as seções.

- Voltar ao carrinho ou ESC fecha a conferência e devolve o foco ao leitor clássico ou à busca moderna. Com o leitor bloqueado, o foco vai para o status da pendência.
- F4 dentro da conferência apenas revisa os valores. Não registra venda nem retoma automaticamente uma tentativa pendente. O registro continua exigindo conferência e confirmação explícitas.
- F8 no clássico abre os ajustes. F10 mantém o acesso aos controles do turno no painel geral.
- Uma pendência abre o aviso da tentativa original, com o formulário de nova venda oculto. Permanecem os comandos existentes de retomada e cancelamento, com suas validações.
- Durante uma operação, o fechamento por ESC e os comandos do painel permanecem bloqueados.
- O cabeçalho mantém o botão de retorno acessível durante a rolagem.

Somente ambiente de teste. Não altera o modal de pagamento de produção nem habilita cobrança, impressão física ou emissão fiscal. Não há nova implementação de cálculo, estoque ou registro de venda.

## Validação

Testes locais de isolamento de produção, ponte de vendas e rascunho; teste completo de interface oculta com pagamento dividido, ajustes, recarga, falha de gravação e cancelamento. As verificações desta etapa incluem origem, retorno de foco, ESC, F8, F4 sem registro automático e preservação do identificador da pendência. Capturas em duas dimensões de janela ficam em `output/etapa-7r`.

Resultado: 41 testes locais passaram; bundle gerado; fluxo completo em Electron oculto concluído com código 0 após o ajuste visual. Capturas revisadas em janelas de 1366 × 768 e 1024 × 768, sem transbordamento horizontal da conferência. Os testes de proteção do perfil de produção foram repetidos após o ajuste e passaram.

Evidências: `output/etapa-7r-local.log`, `etapa-7r-guard-final.log`, `etapa-7r-bundle.log` e `etapa-7r-interface.log`.

Próxima etapa: revisar a prontidão para a loja piloto e consolidar as funcionalidades ainda indisponíveis no perfil de teste, antes de propor sua ativação em uma loja real.

Revisão concluída: [Etapa 7S — prontidão e caminho até a loja piloto](prontidao-piloto-etapa-7s.md).
