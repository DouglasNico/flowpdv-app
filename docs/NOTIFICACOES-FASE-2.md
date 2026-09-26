# Fase 2 — notificações operacionais

## Continuação — validação integrada em 22/09/2026

- Aplicativo completo iniciado com `main.js`, preload, bundle real e perfil temporário. Testados login, PDVs Clássico/Moderno, cadastro e persistência de mesas, 20 lançamentos consecutivos e mais um lançamento via evento Enter no campo real do terminal de atendimento. Enquadramento das notificações validado a 1366×768 e 1024×768.
- Encontrado e corrigido aviso persistente da sessão anterior sobre o login. `src/js/notificacoes.js` agora exporta `limparNotificacoes`, que cancela temporizadores, remove listeners, limpa fila e fecha avisos. `src/js/auth.js` chama essa rotina em `abrirTelaLogin`, abrangendo logout e troca de operador.
- `src/css/notificacoes.css`: Clássico e terminal de atendimento usam canto superior direito para liberar os atalhos inferiores. Demais telas mantêm a posição anterior.
- Novos `test/notificacoes-aplicativo-completo.cjs` e `test/run-notificacoes-integradas.cjs`; `test/aplicativo-completo-ui.cjs` executa a extensão apenas com flag explícita. `test/notificacoes-ui.cjs` atualizado para os dois exports. Bundle recompilado.
- Resultados: teste integrado aprovado, teste isolado de notificações aprovado, detector sem achados. Capturas atualizadas em `../output/notificacoes-integradas/`. Captura de janela oculta precisa de frame novo: `invalidate` e captura com `stayHidden`/`stayAwake`; dimensões restauradas após fullscreen do operador.
- Limites: loja e operadores fictícios; produção, impressão e fiscal bloqueados pelo ambiente. Apenas no teste, reação à exclusão da licença fictícia no emulador foi substituída por função vazia para manter o ensaio de notificações estável. Isso não altera licenciamento distribuído. Leitor físico, pagamentos e leitor de tela não homologados aqui. Revisão dos demais textos do sistema continua pendente. Nenhuma publicação.

Data: 22/09/2026. Implementação local, sem publicação. Refinamento com a skill Impeccable, preservando a interface existente.

## Diagnóstico e decisões

`App.showToast` aplicava cores saturadas por estilo inline, não respeitava o terceiro argumento de duração já usado por alguns módulos, não agrupava repetições e removia todos os avisos após 3,5 segundos. A marcação existente usava outro posicionamento por CSS.

Novo padrão: superfície branca, texto escuro, ícone SVG com cor semântica, título e botão de fechar. No desktop, canto inferior esquerdo para liberar os controles de pagamento à direita; em janela estreita, faixa superior com altura limitada e rolagem. Não cria confirmação extra para produtos normais que já têm feedback no carrinho.

## Arquivos e comportamento

- `src/js/notificacoes.js` (novo): implementação compartilhada; no máximo três avisos visíveis, repetições atualizam a mesma mensagem, fila preserva erros quando todos os espaços estão ocupados por avisos importantes. Não injeta HTML recebido na mensagem nem move o foco. Pausa expiração com mouse, foco e janela oculta. Sucesso dura 2,8s, informação 4,5s, atenção 7s; erro permanece até ser fechado por padrão. Terceiro argumento numérico continua aceito e tem precedência. Mantém a supressão durante login.
- `src/css/notificacoes.css` (novo): estilos isolados, ícones, contraste, foco de teclado, telas estreitas e movimento reduzido.
- `src/js/app.js`: delega `showToast` para o componente e encaminha terceiro argumento. Chamadas existentes em outros módulos recebem o padrão automaticamente.
- `index.html`: carrega CSS e atualiza a região de notificações existente com nome acessível.
- `src/js/pdv.js`: mensagens de item avulso e balança agrupadas por carrinho; cortesia vazia recebe título claro e orientação de recuperação.
- `src/js/comandas.js`: confirmações de itens lançados atualizam uma única mensagem, exibindo o último lançamento; quantidades da comanda continuam sendo acumuladas normalmente.
- `src/js/bundle.js`: recompilado.
- `test/notificacoes-ui.cjs` (novo): ensaio Electron isolado com HTML/CSS reais, função real de cortesia e função real de adição à comanda, com persistência e dependências externas simuladas.

## Evidências e limites

Teste Electron aprovado: cortesia vazia, deduplicação, 20 adições (20 unidades na conta e um aviso), foco preservado, enquadramento a 1366×768, 1024×768 e 390×844, mensagem como texto seguro, duração explícita, pausa de leitura, erro persistente e fila. Capturas em `../output/notificacoes-fase2/`. Renderização conferida em duas rodadas; detector Impeccable sem achados nos componentes novos. Os três testes de regressão da fase 1 passaram novamente e o bundle foi gerado.

O ensaio carrega a página sem inicialização completa e bloqueia rede; não representa homologação de Firebase, leitor físico ou pagamento. O restante da página ainda tem limitações próprias em janela estreita. Falta ampliar validação no aplicativo completo nos dois layouts e na tela real de atendimento. Os avisos continuam sendo sobreposições: a região pode ocupar parte da lista de produtos. Não foram reescritas todas as mensagens do sistema nem transformados avisos de outros módulos em feedback inline nesta fase.
