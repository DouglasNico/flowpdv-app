# Medição inicial de consumo V2 — 23/09/2026

Ensaio executado com `node test/medir-consumo-v2.cjs`. Usa os handlers reais via `.run` e Firestore/Auth emulados do projeto demo-flowpdv. Conta documentos retornados por transações (mínimo 1 para consulta vazia/documento inexistente), tentativas de transação e documentos escritos em transações confirmadas. Preparação, conferência e limpeza ficam fora da contagem. Não mede a fatura nem executa operações na nuvem.

Cenário: pedido de mesa com 1 produto e 1 adicional, 2 insumos, cozinha KDS sem impressão, três transições de preparo e pagamento manual com turno obrigatório. Perfil/loja/usuários sintéticos exclusivos, removidos ao terminar. Todas as transações medidas concluíram em uma tentativa. Reenvios produziram uma venda, sem novas escritas.

| Operação | Leituras | Gravações |
|---|---:|---:|
| Abrir turno (separado do pedido) | 6 | 2 |
| Criar pedido | 7 | 6 |
| Receber no PDV | 6 | 3 |
| Cada avanço de preparo (3 no fluxo) | 4 | 1 |
| Fechar/pagar atendimento | 13 | 9 |
| **Total por pedido, sem acompanhamento** | **38** | **21** |
| Atualizar acompanhamento uma vez | 2 | 0 |
| Reenvio do mesmo pedido | 3 | 0 |
| Reenvio do pagamento confirmado | 4 | 0 |

## Projeção, não medição de um dia inteiro

O frontend `src/pages/cardapio-v2.js` agenda acompanhamento a cada 5 segundos após concluir a consulta. Só consulta com documento visível e encerra ao cancelar ou quando entregue e pago. Modelo abaixo usa intervalo nominal de 5 segundos, uma única tela por pedido, sem latência ou falhas. Não inclui a primeira consulta imediata na contagem de intervalos. Recargas/múltiplas abas e pedidos entregues ainda não pagos podem elevar consumo; aba oculta reduz.

| Pedidos/dia | Minutos visíveis por pedido | Leituras projetadas/dia | Gravações projetadas/dia |
|---|---:|---:|---:|
| 50 | 0 (sem acompanhamento) | 1.900 | 1.050 |
| 50 | 20 | 25.900 | 1.050 |
| 50 | 40 | 49.900 | 1.050 |
| 100 | 20 | 51.800 | 2.100 |

Fórmula: pedidos × (38 + minutos × 60 / 5 × 2). Acompanhamento também chama a função uma vez por atualização. O principal alvo de otimização identificado é essa frequência, antes de aumentar carga online. Nenhuma frequência/comportamento de produto foi alterado nesta medição.

## Limites

Não inclui consultas diretas dos painéis Master/mobile/PDV, listeners/reconexões, leituras de regras/índices, autenticação, CPU/memória, tráfego, armazenamento, build, estornos, delivery, impressão e contenção real. Portanto não equivale ao total da loja nem permite prometer valor mensal em reais. Vendas locais/offline do PDV não são todas pedidos de mesa V2.

O catálogo V2 público atualmente é lido como um documento por `getDocFromServer`; vários produtos dentro desse documento não representam automaticamente uma leitura por produto. O exemplo anterior de 500 produtos/500 leituras era hipotético, não uma medição desta implementação.

Resultado detalhado: `flowpdv-sistema/output/medicao-consumo-v2/resultado.json`. Preparação do backend hospedado continua separada e não foi realizada pelo ensaio.


## Otimizacao local aplicada em 23/09/2026

O acompanhamento do consumidor passou de 5 para 30 segundos apos cada resposta. Consulta imediatamente ao abrir ou retornar a aba, suspende timers enquanto oculta, impede requisicoes sobrepostas e ignora respostas apos sair/fazer outro pedido. Encerra ao cancelar ou entregar com pagamento concluido. Reabrir confirma pedido final no servidor (inclusive estornos). Mudancas de status podem levar cerca de 30 segundos mais latencia para aparecer durante acompanhamento continuo.

Implementacao: flowpdv-cardapio/src/lib/acompanhamento-v2.js e src/pages/cardapio-v2.js. Testes: test/acompanhamento-v2.test.mjs (5 casos), build e test/catalogo-fluxo-v2.cjs aprovados. Fluxo integrado exercitou produto/adicional, reenvio, cozinha, pagamento/troco e estoque nos emuladores.

Comparacao com a mesma formula nominal anterior, sem a consulta inicial nem consultas extras ao retornar/recarregar:

| Pedidos/dia | Minutos visiveis | Antes (5s) | Agora (30s) |
|---|---:|---:|---:|
| 50 | 20 | 25.900 | 5.900 |
| 50 | 40 | 49.900 | 9.900 |
| 100 | 20 | 51.800 | 11.800 |

Reduz 83,3% das consultas periodicas, aproximadamente 77,2% das leituras do cenario de 100 pedidos/20 minutos. Gravacoes continuam 2.100 neste cenario. Nao equivale a reducao percentual da fatura total. Medidor agora importa o intervalo do frontend para evitar projecao desatualizada. Nova execucao confirmou 38 leituras/21 gravacoes por pedido e 2 leituras por acompanhamento; resultado em output/medicao-consumo-v2/resultado-otimizado.json (relativo a flowpdv-sistema). Baseline resultado.json preservado.

Sem deploy: o ambiente hospedado ainda nao recebe esta economia. Proximo alvo: medir consultas/listeners dos paineis e sincronizacao do PDV, restringir consultas desnecessarias com base em evidencia. Custos totais e reembolso nao foram verificados nesta etapa.


## Paineis e sincronizacao
Auditoria local e correcoes de duplicacao em 23/09/2026: ver CONSUMO-PAINEIS-SYNC.md. Mobile reutiliza listeners; PDV compartilha leituras simultaneas do mesmo resumo. Seis testes aprovados; sem deploy.
