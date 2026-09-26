# Consumo dos paineis e sincronizacao — 23/09/2026

## Metodo e resultados
Ensaio local do codigo real em VM com adaptadores Firestore simulados que contam inscricoes/getDoc. Nao acessou producao e nao mede documentos faturados, cache SDK, regras, indices, rede ou fatura. Comando: node --test test/consumo-sync.test.cjs em adega-pdv-gestao.

| Componente/cenario | Antes | Depois | Unidade |
|---|---:|---:|---|
| Mobile: iniciar listeners 10 vezes na mesma loja | 30 | 3 | inscricoes onSnapshot criadas |
| PDV: duas cargas simultaneas do mesmo resumo com 5 partes | 10 | 5 | chamadas getDoc |
| Master: 2 lojas e 10 chamadas de inicializacao dos backups | 2 | 2 | inscricoes de backup (ja deduplicadas) |
| Gestao V2: abrir pedidos 10 vezes | 1 | 1 | chamada de listagem; atualizar manual adiciona 1 |

Mobile antes foi reproduzido removendo somente os guards novos no ensaio. PDV antes iniciava uma leitura de cada parte por chamada; o ensaio atual verifica a quantidade e o resultado reconstruido. Estas reducoes se aplicam aos cenarios de duplicacao acima, nao a todo uso diario.

## Alteracoes
- flowpdv-mobile/app.js: reutiliza os listeners de backup, licenca e auditoria para a mesma chave. Troca de loja cancela os anteriores; logout continua encerrando tudo. Erro terminal permite nova inscricao ao atualizar. Callbacks de backup/auditoria de loja anterior sao ignorados.
- flowpdv-mobile/sw.js: nova versao do cache para distribuir o JS quando houver publicacao.
- adega-pdv-gestao/src/js/cloud-sync.js: compartilhar somente leituras simultaneas de partes do mesmo resumo JSON, mesma loja e manifesto. Sem cache persistente; resumo diferente ou consulta posterior relê o servidor. Leitura sem revisao continua independente.
- adega-pdv-gestao/src/js/bundle.js: regenerado por npm run bundle.
- adega-pdv-gestao/test/consumo-sync.test.cjs: seis testes com contadores e verificacao de troca de loja, encerramento, recuperacao apos erro e releitura posterior.

## Inventario restante / limites
- PDV: cada resumo remoto ainda le todas as partes, alem de movimentos, inventarios e checkpoint conforme fluxo. Uma mudanca real de resumo NAO e deduplicada. Reduzir isto requer revisoes confiaveis por parte em todos os escritores, inclusive mobile; usar apenas quantidade de partes como cache perderia alteracoes.
- Mobile: atualizacao manual ainda busca licenca, backup, ate 50 logs e partes. Listener de auditoria tem limite100; inscricao nova pode receber conjunto inicial. Nao se pode multiplicar inscricoes diretamente para prometer economia em reais.
- Master: escuta colecao de licencas, planos e um backup por loja; quantidade de lojas e alteracoes afeta uso. O ensaio cobre apenas deduplicacao dos listeners de backup. Nao foi alterado nesta etapa.
- Gestao V2: configuracao e paginacao por callables; pedidos sob demanda com bloqueio de concorrencia. Nao ha polling de pedidos neste componente.

Validacao: 6 testes focados aprovados, auth-rules mobile aprovado, bundle PDV aprovado. Nenhum deploy, instalador ou teste real de dia inteiro. Estes resultados nao permitem estimar a fatura completa. O instalador criado antes desta etapa nao contem esta alteracao.


## Decisao do usuario — 23/09/2026
Sincronizacao incremental por revisoes de partes fica adiada. Manter as otimizacoes locais prontas. Retomar depois conforme ACOMPANHAMENTO-PENDENCIAS.md.
