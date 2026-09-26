# Combos e promoções — etapa local de catálogo

Data: 23/09/2026. Não publicado; não é homologação de venda/estoque.

## Implementação e arquivos

- Master: `index.html` e `js/app.js` incluem permissão Combos, preset de alimentação para novos cadastros e leitura/gravação explícita do módulo. Licenças antigas não são ativadas automaticamente.
- PDV: `src/js/ofertas-core.js` normaliza preços/composição; `src/js/ofertas-cadastro.js` monta campos de promoção individual, combo total, promoção do combo, acompanhamentos e uma bebida permitida. `src/js/estoque.js` conecta edição/salvamento; `src/css/style.css` estiliza apenas a seção; `src/js/bundle.js` foi regenerado. Dados em `ofertaCardapio`, separados da promoção existente no balcão e de Pack/Fardo.
- Cardápio: `shared/ofertas.js` contém o contrato compartilhado. `src/lib/overlay.js` resolve componentes por ID e publica preços/composição; rejeita componentes inválidos e conflito com grupo antigo chamado combo, exigindo correção explícita no painel.
- Painel: `src/pages/painel.js`, `painel-grupos.js` e `painel-catalogo.css` mostram preços vindos do PDV, ativação de promoção e período opcional em Brasília. Salvar grupos agora também deixa rascunho: publicação é sempre explícita.
- Público: `src/pages/cardapio.js`, `cardapio-design.css` e `src/lib/grupos.js` incluem carrossel Promoções, preço vigente, escolha individual/combo e bebida inclusa. Adicionais pagos são somados uma vez. Expiração usa temporizador local; mudança de preço na confirmação exige nova confirmação do cliente.
- API: `api/criar-pedido.js` recalcula valores em centavos, valida escolha, quantidade, preço esperado e permissão atual do Master para combos. Grava retrato dos componentes e preços no pedido. `src/lib/pedidos.js` preserva código de erro retornado. Reenvio idempotente mantém o pedido existente.

## Verificação

- Cardápio: 17 testes aprovados nos arquivos `tests/ofertas.test.js`, `tests/ofertas-publicacao.test.js`, `tests/entrega.test.js` e `tests/foto.test.js`.
- PDV: `test/ofertas-core.test.cjs` aprovado, incluindo igualdade do contrato compartilhado com normalização de quebras de linha. Bundle gerado.
- Build Vite aprovado; permanece aviso de chunk acima de 500 KB. Conferência de diff sem erros de whitespace.
- Fixtures de navegador em 1366 e 390 pixels: Master, cadastro PDV, painel, carrosséis, combo, bebida inclusa, carrinho e reconfirmação de preço. Sem erros JavaScript. Fontes reais com serviços simulados; não houve gravação Firebase real.
- Evidências: `flowpdv-sistema/output/reconstrucao-web-20260923/combos-promocoes/browser-results.json` e capturas na mesma pasta.

## Custos e limites

A confirmação relê um documento de catálogo. A API lê a licença uma vez adicional quando o pedido contém combo novo. Temporizador de promoção não consulta rede. São contagens dos caminhos de código, não medição de cobrança. Nenhum serviço V2 ou polling novo foi ativado.

Os pedidos públicos atuais continuam em `backups_lojas/{chave}/pedidos`. O recebimento com fechamento/estoque identificado está em outro fluxo V2. Gravar composição NÃO implementa baixa automática. Não foram alterados pagamento, venda no balcão, estoque ou estorno; a disponibilidade de estoque dos componentes não é consultada em tempo real.

## Próxima etapa necessária

Integrar a composição ao fluxo efetivamente usado para receber e fechar pedidos no PDV. Validar baixa única e estorno dos componentes, retomada/reenvio, cancelamento e impressão; preservar política real de estoque e não inferir pagamento. Só depois homologar o ciclo completo e preparar publicação/instalador. Não migrar pedidos ou ativar backend V2 implicitamente.

O domínio flowpdv.app.br foi comprado pelo usuário, mas não foi configurado/verificado aqui. Não houve commit, push, deploy ou geração de instalador nesta etapa.
