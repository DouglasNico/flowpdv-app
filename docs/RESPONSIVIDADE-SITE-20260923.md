# Responsividade do site — 23/09/2026

Pedido: telas grandes/médias/pequenas, notebooks com escala 125%/150%, tablets e celulares em retrato/paisagem.

## Alterações
- flowpdv-site/responsive.css: largura máxima 1240px com margens fluidas/áreas seguras; cabeçalhos ajustados à altura; menu com rolagem interna; hero compacta em janelas baixas; preço fluido; galeria móvel vertical; telefone alinhado; ações e rodapé responsivos.
- index.html: folha final, cache de site.js e largura natural da foto 1586px.
- site.js: IntersectionObserver recolhe atalhos flutuantes nas áreas de contato, preservando foco.
- DESIGN.md, .impeccable e MEMORIA.md: regras e localização das alterações.

## Verificação
Matriz de 16 viewports em Chromium: 2560x1440, 1920x1080, 1366x768; FHD 125%/150% (1536x864/1280x720); HD 125%/150% (1093x614/911x512); limites 1101/700/701px; tablet 768x1024 e 1024x768; celular 320x568, 390x844, 844x390, 667x375. DPR equivalente nas escalas. Sem overflow horizontal, cabeçalho sobreposto, preço transbordando ou erro JS. Menu chega ao último link e modal mantém botão fechar visível. Confirmação focada após ajustes finais em quatro tamanhos de celular: galeria inteira, atalhos ocultos em planos/contato e rotação 390x844 para 844x390 sem overflow.

Evidência: output/reconstrucao-web-20260923/responsive-after/results.json e responsive-final-mobile/results.json (estes substituem os quatro cenários móveis da primeira matriz). Capturas de confirmação via Electron oculto podem refletir um frame anterior à rolagem; as medidas DOM e estados são a evidência dos controles. Capturas da matriz mostram a composição nos demais tamanhos. Não equivale a teste físico no Windows/iOS/Android ou Safari.

## Publicação
Commit c850d65 enviado para origin/main. https://www.flowpdv.com.br/ retorna HTML atualizado; responsive.css e site.js HTTP200 idênticos aos arquivos locais. Prova: output/reconstrucao-web-20260923/responsive-publicacao.json. Mensalidade permanece R$ 217,90. Sintaxe JS e git diff --check passaram.
