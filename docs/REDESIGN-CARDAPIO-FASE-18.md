# Reconstrução visual do painel e cardápio — fase 18

23/09/2026. Usuário esclareceu que o painel anterior veio de outra IA e não atendia à qualidade visual desejada. Confirmou reconstruir tanto gestão quanto experiência do cliente, diretamente no código. Esta etapa substitui a abordagem de mero refinamento das fases 16/17. Sem publicação.

## Arquivos e resultado

Repositório de implementação: `flowpdv-cardapio` (irmão de flowpdv-sistema).

- `src/pages/painel.js`: navegação lateral com ícones no desktop e abas no celular, identificação da loja, link para o cardápio do cliente, edição de descrição recolhível com preservação de estado e abertura em caso de falha, indicação acessível da aba ativa, transição breve entre seções respeitando preferência por movimento reduzido.
- `src/pages/painel-catalogo.css`: substituído pelo sistema visual de gestão; escala tipográfica, filtros, controles, produtos, Loja, quadro de Pedidos e QR, com regras isoladas da experiência de compra.
- `src/lib/icons.js`: ícones SVG coerentes para loja, pedidos, QR, saída, link externo e abertura de detalhes.
- `src/pages/cardapio.js`: aplicação do novo visual do cliente, busca visível inicialmente, legendas de destaques fora da fotografia, assinatura FlowPDV discreta. Mantidos contratos e funções existentes de seleção, adicionais e carrinho.
- Novo `src/pages/cardapio-design.css`: composição editorial em até 1120px, catálogo em duas colunas no desktop e linhas com fotos no celular, categorias, estados de foco, preços, detalhe de produto e resumo do pedido. Imagens, cores e textos comerciais reais continuam vindo do catálogo; não se grava conteúdo fictício no produto.
- `src/pages/cardapio-v2.js` e `src/pages/cardapio-v2.css`: identidade coerente com o consumidor, separação do estilo de página, opções por produto recolhíveis e mensagem do carrinho vazio. Preservada restrição a emuladores e contratos V2; imagens ausentes continuam suportadas.
- `PRODUCT.md`, `.impeccable/config.json` e `.impeccable/direction.md`: escopo confirmado, execução code-first e direção documentada. DESIGN.md e sidecar registram o sistema final após revisão.
- Novo `test/design-preview.cjs`: servidor local isolado com serviços simulados e produtos fictícios identificados, modo navegável e testes Electron com renderização offscreen. Usa fotos de teste já existentes somente na demonstração; nenhuma imagem demonstrativa inserida no catálogo real.

## Verificação e demonstração

`node test/design-preview.cjs`: sem overflow da página em 390/768/1440px; inclusão de item no carrinho legado e V2 aprovada. Capturas válidas em `flowpdv-cardapio/.impeccable/review/`: gestão por aba e resolução, catálogo cliente, produto, carrinho e V2. Corrigida captura de compositor de janela oculta no harness, usando renderização offscreen; imagens antigas transitórias foram substituídas.

`node test/painel-ui.cjs` e modo `PAINEL_ETAPA17=1`: filtros, salvamento, tratamento de falhas, rascunhos, pedidos e QR preservados. `npm run build` aprovado; persiste aviso de bundle acima de 500kB (aproximadamente 588kB JS). Nenhuma homologação Firebase/Cloudinary real ou publicação foi feita.

Detector Impeccable rodado uma vez: advertência sobre borda inferior 3px nas categorias; trata-se do marcador ativo de abas retas, não de borda grossa em cartão arredondado. Mantido deliberadamente. Revisão visual independente registrada separadamente em `.impeccable/review/`.

Para abrir demonstração novamente: `$env:DESIGN_PREVIEW='1'; node test/design-preview.cjs`, no repo web. O terminal informa a porta. Rotas `/gestao`, `/cliente` e `/v2/demonstracao`. O servidor de demonstração recusa publicação, upload e envio de pedidos; edições só afetam dados simulados em memória. Não é implantação nem substituto de homologação de backend.

## Continuidade

Prioridade imediata: usuário avaliar as telas funcionando. Retomar acesso gerencial e consulta V2 após esta entrega visual. Integração V2 do painel, publicação/HTTPS, imagem real, reconciliação de cópias legadas e homologação de produção permanecem pendentes. Não anunciar o ecossistema completo como concluído por causa desta etapa.

Revisão final: demonstração local liberada pelo revisor independente após correção dos dois itens apontados. Parecer em flowpdv-cardapio/.impeccable/review/VERDICT.md. Isso não homologa backend nem autoriza publicação.

## Complemento — categorias acompanham a rolagem (23/09/2026)

Pedido explícito do usuário na prévia `/cliente`: ao rolar Mais pedidos, Hambúrgueres, Bebidas e demais seções, destacar automaticamente a categoria correspondente.

Implementado em `flowpdv-cardapio/src/lib/categorias-scroll.js`: cálculo da seção abaixo do cabeçalho fixo, eventos passivos limitados a um requestAnimationFrame, ajuste de altura via ResizeObserver, destaque exclusivo com aria-current e deslocamento horizontal apenas da faixa de categorias. Última seção reconhecida no fim da página. Cliques usam a altura real do cabeçalho e respeitam movimento reduzido. Não atualiza seção com produto/carrinho sobreposto.

`src/pages/cardapio.js` conecta/recria a observação após busca e renderização; retorna limpeza. `src/main.js` utiliza essa limpeza ao sair da rota. V2 não possui essa faixa e não foi alterado.

`test/scroll-categorias.cjs` e modo TEST_SCROLL de `test/design-preview.cjs`: teste focado em 1440/390px, seções ao descer, retorno por clique, fim da página e busca com reconstrução do menu. SCROLL PASS, build aprovado e diff sem erros. Prévia reiniciada na mesma porta 53663. Sem publicação.

## Complemento — fotos, troca de aba e campos neutros (23/09/2026)

`flowpdv-cardapio/src/pages/painel.js`: removidas as ações minúsculas sobre a miniatura. Botões separados Adicionar foto/Trocar foto e Remover foto; seletor de arquivo acionado por botão acessível ao teclado. Remoção de imagem sem publicId limpa a referência via salvarOverlay; remoção com publicId preserva o serviço existente. Mensagem não afirma exclusão no Cloudinary. Cada clique de aba volta imediatamente ao topo. Placeholders de telefone e endereço agora contêm instruções genéricas, sem dados pessoais de exemplo; dados realmente cadastrados da loja são preservados.

`src/pages/painel-catalogo.css`: ações com ícone, texto, 40px de altura e remoção com cor distinta, permitindo quebra no celular. `test/design-preview.cjs`, modo TEST_GESTAO_UI: remoção simulada, rótulos, abas no topo e placeholders verificados em1440/390; GESTAO PASS. Build passou (aviso preexistente de chunk). Prévia reiniciada na porta53663; sem publicação.
