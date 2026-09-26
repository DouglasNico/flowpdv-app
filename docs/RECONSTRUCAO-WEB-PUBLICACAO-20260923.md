## Reconstrucao web publicada por autorizacao explicita — 23/09/2026

Usuario pediu finalizar interfaces e adiar testes/otimizacoes para amanha; em seguida autorizou publicar todos os sites, pois nao ha clientes reais. Esta autorizacao substitui a suspensao anterior da publicacao dos frontends.

Publicados via main dos repos existentes:
- flowpdv-mobile / cliente-flowpdv: f3a2864. app.js com deduplicacao anterior e cores de status; index.html com titulos/navegacao SVG; reconstruction.css; sw.js e docs. https://cliente.flowpdv.com.br/
- flowpdv-master-admin / flowpdv: eddbf05. index.html, css/reconstruction.css, sw.js, docs. Lista continua de lojas, indicadores, formularios e login. https://admin.flowpdv.com.br/
- flowpdv-site: ce8965e + merge2830718. index.html, reconstruction.css e docs. Hero centrado, telas reais, recursos/galeria/planos/FAQ. Alteracoes remotas da secao planos e previa-visual preservadas no merge. https://www.flowpdv.com.br/
- flowpdv-cardapio / flowcardapio: cf2ded7. src, vite.config.js e MEMORIA-PUBLICACAO.md. Publica reconstrucao anterior do painel/cardapio legado e fontes V2 com opt-in. https://cardapio.flowpdv.com.br/

Verificacao de entrega: quatro HTTP200; nos tres primeiros o HTML referencia reconstruction.css e hash normalizado do CSS remoto e igual ao local. No cardapio bundle publicado index-AZRujMQl.js contem rotas V2. Relatorio output/reconstrucao-web-20260923/publicacao.json relativo a flowpdv-sistema. Build Vite e sintaxe JS aprovados como checagem minima de publicacao; NAO e homologacao completa. Capturas desktop/mobile com dados sinteticos e rede externa bloqueada em output/reconstrucao-web-20260923; nenhuma fixture enviada a nuvem.

V2 NAO ativada nesta publicacao: nao houve deploy Functions/regras/indices, provisao de gerente/loja remota, alteracao do faturamento nem uso de segredos Cloudinary. Fluxo integrado hospedado e otimizacao estrutural continuam para amanha. Build tem aviso preexistente de bundle maior que500k. Revisao completa Impeccable, aparelhos reais, login/dados reais e equipamento instalado permanecem pendentes. Nao apresentar paginas como homologadas.

PRODUCT.md, DESIGN.md, .impeccable/design.json e surface-brief escritos nos tres repos; ultima atualizacao documental de autorizacao pode permanecer local apos commits de publicacao. Arquivos alheios nao incluidos (salvarCliente.txt, fixtures, functions locais, segredos). Nenhum instalador publicado.
