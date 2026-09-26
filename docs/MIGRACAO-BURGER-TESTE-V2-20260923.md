# BURGER TESTE — preparação da migração V2

Atualização posterior: a etapa de acesso hospedado foi publicada e o cadastro liberado somente para pareamento, com operação ainda suspensa. O estado atual e as verificações estão em [PILOTO-V2-ACESSO-HOSPEDADO-20260923.md](PILOTO-V2-ACESSO-HOSPEDADO-20260923.md). O registro abaixo documenta a cópia inicial.

## Resultado verificado em 23/09/2026

Escopo escolhido pelo proprietário: primeiro BURGER TESTE, licença `LIC-FLOW-937278`. Foi criada uma cópia **inativa** no projeto Firebase `aplicativo-pdv`, loja `legado-lic-flow-937278`, slug reservado `burger-teste`.

Commit Firestore: `2026-09-23T17:08:40.035135Z`. Foram gravados e relidos **101 documentos**. As **26 versões de documentos de origem** foram protegidas por precondição no mesmo commit; a releitura final encontrou zero alterações nessas origens. Isso confere os documentos capturados, não congela novas gravações futuras nem impede a chegada de novos pedidos no legado.

| Dado | Preparação |
| --- | --- |
| Produtos | 60 preservados, com IDs originais |
| Publicados na origem | 7 identificados; catálogo V2 não publicado |
| Controle de estoque | 14 saldos preparados; nenhum saldo operacional criado |
| Sem controle de estoque | 46 produtos |
| Pedidos | 11 arquivados; nenhum importado como recebimento ou venda |
| Em andamento | 1 em preparo, permanece no fluxo antigo |
| Combos antigos | 4 produtos com opções textuais para revisão |

O backup de saldo é de 22/09/2026 e não prova o saldo atual do terminal. Os saldos foram colocados em `preparacao_estoque`, separados da coleção operacional `estoque`. Pedidos estão em `historico_legado`, separados de `pedidos`, `atendimentos` e `vendas`. Não houve confirmação de pagamento, baixa, estorno, cancelamento ou fechamento de pedido.

## Acesso, custos e publicação

A consulta ao Cloud Billing confirmou `billingEnabled: true` nesta data; o bloqueio anterior não é mais atual. Esta etapa executou leituras administrativas e 101 gravações de documentos. Não foi medida cobrança real.

As regras remotas foram lidas e revisadas antes da escrita (`88ab1d48-4825-4d7a-ad48-96197e19112c`). Elas não concedem acesso de cliente às novas coleções V2. O executor interrompe se essa versão mudar, exigindo nova revisão. Nenhuma regra ou Function foi publicada. A loja está `ativo: false`, módulos de operação desativados, ativação suspensa e catálogo `publicado: false`, `pausado: true`.

O link atual e a operação legada continuam como estavam. O domínio `flowpdv.app.br` não foi configurado nesta etapa. Reservar o slug não disponibiliza uma página pública.

## Implementação e evidências

- `functions/migracao-loja-core.cjs`: transforma a captura em plano determinístico, preserva produtos, catálogo original, configurações, overlays e pedidos; registra pendências de composição e estoque. Não copia credenciais da licença nem usuários do backup para o destino.
- `scripts/preparar-burger-v2.cjs`: execução administrativa restrita a essa licença e projeto. Simula por padrão; `--aplicar` cria documentos somente se inexistentes, com versões de origem verificadas atomicamente. Destino diferente ou parcial interrompe sem sobrescrever. Uma repetição com os mesmos documentos apenas confere a cópia.
- `test/migracao-loja.test.cjs`: **4/4 testes aprovados** para isolamento operacional, precondições de escrita, origem incompleta/duplicada e serialização sem perda silenciosa.
- `../output/migracao-v2-20260923/burger-recibo.json`: recibo local com caminhos, contagens e hash do destino.
- `../output/migracao-v2-20260923/burger-origem.json`: captura privada de recuperação. Contém dados sensíveis da origem; não adicionar ao Git, publicar ou servir por HTTP.

Comandos executados da raiz `flowpdv-sistema`:

```powershell
node --test adega-pdv-gestao/test/migracao-loja.test.cjs
node adega-pdv-gestao/scripts/preparar-burger-v2.cjs
node adega-pdv-gestao/scripts/preparar-burger-v2.cjs --aplicar
```

## Pendências para troca operacional

1. Configurar os combos no cadastro do PDV com preço total, componentes e bebida permitida. Não converter nomes livres automaticamente em referências de estoque. O plano conserva a configuração antiga para revisão, inclusive a taxa fixa do combo do X-Egg.
2. Encerrar/conferir o pedido legado ainda em preparo, sem inferir pagamento. Fazer inventário final com o terminal e impedir escrita simultânea dos dois fluxos durante o corte.
3. Implementar e validar a conexão hospedada do PDV. `servicos-acesso-local.js` continua intencionalmente restrito ao emulador e `ativacao-operacional-v2.js` só autoriza homologação. Trocar apenas flags não completa a integração.
4. Provisionar identidades de gerente/terminal, publicar backend e regras revisados, conferir catálogo e autorizações, então ativar a loja piloto e testar um pedido completo.
5. Preparar o domínio e preservar links/QR existentes. Só ampliar para outras lojas depois da homologação da piloto.

Esta entrega conclui a **cópia preparatória**, não a migração operacional. Para recuperação, manter o legado em uso; nenhum dado legado foi substituído. A cópia pausada não deve ser publicada diretamente sem resolver as pendências.
