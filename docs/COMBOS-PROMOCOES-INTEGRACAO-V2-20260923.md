# Combos — integração V2 local

23/09/2026. O usuário escolheu continuar pelo V2 local. Sem deploy, ativação hospedada, migração de pedidos reais ou instalador.

## Resultado

O pedido V2 recebe a variante e a bebida escolhida, calcula o preço no servidor e preserva os componentes. Recebimento mantém uma única linha comercial. Fechamento confirmado calcula o consumo de cada componente pela respectiva ficha de estoque, agrega quantidades e grava venda, financeiro e estoque na mesma transação. Cancelar antes do pagamento não baixa nem devolve estoque. Estornar usa os consumos históricos da venda, mesmo se a ficha mudar depois.

A bebida inclusa não soma o preço avulso. Adicionais pertencem somente ao produto principal e continuam cobrados/consumidos conforme seu mapeamento existente. Componentes com ficha semEstoque não impedem o processamento dos demais. Ficha ausente ou saldo insuficiente impede a operação inteira.

## Arquivos e finalidade

| Local | Alteração |
| --- | --- |
| PDV `functions/composicao-pedido-core.cjs` | Validação e expansão de componentes apenas para estoque; não modifica preço ou linha comercial. |
| PDV `functions/recebimento-v2.js` | Recusa composição inconsistente antes de abrir/incrementar atendimento. |
| PDV `functions/fechamento-v2.js` | Aplica as fichas aos componentes e agrega consumos na transação existente. O estorno existente usa o retrato gravado. |
| PDV `functions/ofertas-core.mjs` | Espelho do contrato de ofertas do PDV/cardápio, conferido por teste de igualdade. |
| PDV `functions/pedidos-publicos-v2.js` | Variante/bebida/preço conferido, promoção vigente, permissão de combos e retrato de composição. Compatibilidade com pedidos antigos sem ofertas preservada. |
| PDV `functions/configuracao-v2.js` | Preserva a concessão de Combos ao salvar outros módulos; a gerência não a concede pelo payload. |
| PDV `functions/cozinha-v2.js`, `delivery-operacao-v2.js` | Incluem composição nos dados destinados aos cupons. |
| PDV `src/js/cupom-cozinha.js`, `recebimento-teste.js`, `cozinha-teste.js` | Apresentam bebida e acompanhamentos como inclusos por unidade, com escape de texto. Bundle regenerado. |
| Cardápio `src/pages/cardapio-v2.js`, `cardapio-v2.css` | Escolha individual/combo, bebida obrigatória, promoção, resumo no carrinho, preço esperado e reconfirmação após mudança. Preserva recuperação de envio pendente. |
| PDV `firebase.combos-test.json`, `scripts/test-combos.ps1` | Ensaio isolado em portas 9199/8180/5101, sem derrubar a homologação já aberta. |

## Evidências

- 57 testes de `test/fechamento-v2.test.cjs` aprovados no emulador isolado. Inclui concorrência entre caixas, falta de estoque, cancelamento, estorno, preservação de pagamentos, recuperação e ciclo iniciado pela API pública com promoção e adicional.
- 13 testes de `test/public-orders-v2.test.cjs` aprovados, cobrindo contratos antigos, isolamento de loja, reenvio, acompanhamento e delivery.
- 11 testes Node aprovados: composição (2), igualdade do contrato (1), cupons (7), preservação da permissão de Combos (1).
- Build do cardápio e bundle do PDV aprovados. Aviso de chunk Vite acima de 500 KB permanece. `git diff --check` dos arquivos da interface V2 não acusou erros; o bundle completo conserva quatro linhas de whitespace de templates preexistentes de outras áreas.
- Navegador em 1366/390: bebida obrigatória, inclusão sem preço avulso, adicional, duas unidades, total e reconfirmação após expiração. Sem erros JS ou overflow horizontal. Fonte real e CSS compilado com serviços simulados; emulador valida o backend separadamente.
- Evidências em `flowpdv-sistema/output/reconstrucao-web-20260923/combos-fechamento-emulador.log`, `combos-public-orders.log` e `combos-v2/browser-results.json`, com capturas na mesma pasta.
- A execução inicial em serviços já abertos não serviu de evidência para a nova baixa. O ensaio isolado revelou referências de porta fixas em testes antigos; elas foram parametrizadas. A execução final passou integralmente.

Reprodução: `powershell -File scripts/test-combos.ps1`. Use `-SomenteCombos` para os cenários específicos; não repetir suítes fechadas sem mudança/falha que justifique.

## Ligação com o cardápio atual e limites

O contrato está compatível: as ofertas publicadas são reutilizadas no catálogo V2, com preço base convertido para `precoCentavos`; o servidor constrói os componentes, não aceita composição enviada pelo consumidor. O ensaio publica dados fictícios pelo contrato compartilhado e percorre API → recebimento → pagamento confirmado → estoque → estorno.

Ainda NÃO existe migração/ponte automática de `backups_lojas/{chave}/pedidos` para `lojas_v2/{lojaId}/pedidos`, nem sincronização automática do cadastro de ofertas legado para o catálogo V2. A liberação no Master antigo e os módulos da loja V2 continuam exigindo vínculo administrativo explícito antes de disponibilizar para lojas reais. A interface V2 foi preparada para receber esse contrato; os cenários de teste semeiam um catálogo fictício.

Não expor a mesma loja aos dois recebimentos com estoques independentes. A próxima etapa de implantação deve definir o vínculo licença/loja V2, transportar catálogo/IDs e estoque pela migração existente, escolher um canal autoritativo e validar a passagem com o aplicativo instalado. Impressão física e HTTPS/produção não foram homologados. flowpdv.app.br não foi configurado nesta etapa.

Consumo: a tela V2 relê um catálogo ao confirmar ou cotar entrega, exceto recuperação de envio pendente; sem polling novo. Fechamento lê uma ficha por produto distinto e os saldos envolvidos; estorno usa consumos gravados. São caminhos de código, não uma medição de cobrança Firebase.
