# Painel do cardápio — fase 16

Entrega local em 23/09/2026. Refinamento com Impeccable da aba Cardápio na rota legada `/painel`, no repositório irmão `flowpdv-cardapio`. Esta etapa não conecta o painel ao catálogo V2 e não publica mudanças.

## Alterações e arquivos

- `flowpdv-cardapio/src/pages/painel.js`: busca, filtros por categoria/situação, contagem e estados vazios distintos. Descrições têm botão Salvar; rascunhos sobrevivem à troca de filtros enquanto a página está aberta, mas não ao recarregamento. Atualização do estado confirmado somente após o salvamento; falhas preservam o rascunho e mostram orientação. Publicação bloqueada enquanto existem descrições pendentes ou salvamentos em curso. Carregamento malsucedido oferece nova tentativa e não libera edição. Opções também atualizam o estado local após resposta do salvamento.
- `flowpdv-cardapio/src/pages/painel-catalogo.css`: estilos delimitados ao painel, filtros e cartões responsivos, foco, contraste e mensagens. Cabeçalho compacto no celular compartilhado pelas abas do painel; identidade azul-marinho/laranja preservada.
- `flowpdv-cardapio/test/painel-ui.cjs`: montagem do painel real com serviços simulados, Electron isolado, capturas e verificação de transbordamento em 1366 e 390 pixels. Utiliza as dependências Electron/esbuild do repositório irmão do sistema.
- `flowpdv-cardapio/test/painel-fluxo.cjs`: verifica filtros, falha de salvamento sem alteração confirmada, preservação/reenvio da descrição, bloqueio de publicação e nova tentativa após falha de carregamento.

## Verificação realizada

Build `npm run build` aprovado. Ensaio local `node test/painel-ui.cjs` aprovado: FILTROS E SALVAMENTO PASS e PAINEL UI PASS. Duas rodadas delimitadas de inspeção visual, com correção do cabeçalho mobile na segunda. Detector Impeccable retornou lista vazia; `git diff --check` sem erros. Permanece aviso de bundle acima de 500 kB do Vite, sem impedir compilação.

Evidências em `flowpdv-sistema/output/painel-cardapio16/`: antes-1366.png, antes-390.png, depois-1366.png, depois-390.png e produto-mobile.png. Dados fictícios; nenhum pedido, upload Cloudinary ou publicação real foi executado.

## Limites e próximo trabalho

Backend, Functions e contratos de publicação permanecem como estavam. Estes testes simulados não homologam regras Firebase, permissões reais, imagens/upload, publicação HTTPS ou integração V2. Próxima etapa: revisar Loja, Pedidos e QR/links do painel e mapear sua integração com V2. Consumidor, Gestor e Master continuam na matriz visual do ecossistema. Publicação permanece suspensa.
