# Loja, Pedidos e QR/links — fase 17

Entrega local em 23/09/2026 no repositório irmão `flowpdv-cardapio`, rota legada `/painel`. Continuidade da fase 16, com Impeccable. Nenhuma publicação ou operação com dados reais.

## Implementação

- `src/pages/painel.js`: Loja passa a usar Salvar alterações para horário, pausa, entrega, mínimo e contato. Rascunho preservado ao alternar abas ou após falha; só existe na memória da página. Validação de dias, horários preenchidos e mínimo não negativo. Controles bloqueados durante envio; resumo confirmado só muda após sucesso. Erro de salvamento permanece visível e permite reenviar.
- No mesmo arquivo, Pedidos distingue carregamento, vazio e falha da consulta, com nova tentativa. Mudanças de status aguardam confirmação e impedem cliques concorrentes por pedido. Erros aparecem no próprio pedido; Histórico inclui entregues e cancelados.
- `src/lib/pedidos.js`: assinatura inclui mudanças de metadados e ignora snapshots com escritas locais pendentes; evita que a antecipação do SDK pareça confirmação do servidor. Não altera o contrato de gravação existente.
- `src/pages/painel.js`: QR usa referências da própria aba e versão da geração, evitando resultados antigos após troca rápida de mesa/aba. Ações ficam desabilitadas enquanto o QR não está pronto. Mesa aceita inteiros de 1 a 9999. Links locais recebem orientação de que não funcionam em outro celular. URLs continuam legadas.
- `src/pages/painel-catalogo.css`: acabamento das três abas, controles com foco/contraste, salvamento acessível no rodapé, cartões e QR mais compactos. Pedidos ficam empilhados no celular/tablet, sem depender da rolagem horizontal do quadro.
- `test/painel-ui.cjs`: extensão das simulações de configuração/pedidos e seleção da fase 17.
- Novos `test/painel-abas.cjs`, `test/painel-abas-fluxo.cjs` e `test/pedidos-confirmacao.cjs`: capturas e ensaios de falha, rascunho, retry, status confirmado, escrita local pendente e geração concorrente de QR.

## Evidências

`node test/pedidos-confirmacao.cjs`: SNAPSHOT PASS. `$env:PAINEL_ETAPA17='1'; node test/painel-ui.cjs`: ABAS PASS e PAINEL UI PASS. Interface real com serviços simulados, capturas em 1366, 768 e 390 pixels, sem transbordamento horizontal da página. Saída em `flowpdv-sistema/output/painel-abas17/`, arquivos antes/depois por aba e resolução.

`npm run build`: aprovado; aviso preexistente de chunk acima de 500 kB permanece (aproximadamente 587 kB). Detector Impeccable: lista vazia. Não foram testados Firebase/Cloudinary reais, download em celular ou impressão física. O ensaio de pedidos usa simulações do servidor e um teste específico dos metadados do listener, não homologação de rede física.

## Mapa de integração V2

| Parte | Painel atual | V2 existente e trabalho restante |
|---|---|---|
| Acesso | `src/lib/auth.js`, chave/licença e PIN do legado | `functions/configuracao-v2.js` exige usuário verificado e membro gerente ativo (ou administrador autorizado). Conectar uma sessão gerencial própria; não reutilizar o PIN como autorização V2. |
| Catálogo/configuração | `cardapio_config`, overlays e `cardapio_publico` | `catalogos_publicos_v2/{slug}` e `lojas_v2/{lojaId}`; APIs consultarConfiguracaoV2, salvarProdutoCardapioV2 e publicarCatalogoV2, com versão e verificação de vínculo. Adaptar o painel a esses contratos e tratar conflitos. |
| Pedidos | `backups_lojas/{chave}/pedidos` e cópia `cardapio_pedidos` | Conectar consulta e transições autorizadas do fluxo operacional V2; não gravar documentos V2 diretamente usando o serviço legado. |
| QR | `/{chave}` e `/{chave}/mesa/{numero}` | `src/pages/cardapio-v2.js` interpreta `/v2/{slug}`, `/v2/{slug}/mesa/{mesaId}` e `/v2/{slug}/delivery`. Usar slug e ID cadastrado da mesa, conforme canais habilitados. |
| Ambiente | Publicação legada no endereço atual | `src/lib/v2.js` restringe V2 a ambiente local de teste e emuladores. HTTPS/piloto e regras de produção ainda precisam de preparação própria. |

Fontes inspecionadas: arquivos acima, `src/main.js`, `src/lib/overlay.js`, `src/lib/pedidos.js` e `src/lib/garcom-v2.js`. Nenhum adaptador V2 foi implementado nesta fase.

## Limites e próxima entrega

A gravação legada de configuração atualiza configuração e cópia pública em etapas; uma falha pode acontecer após gravação parcial. A tela informa que não conseguiu confirmar e permite repetir os mesmos valores. A cópia pública de status de pedidos também mantém o comportamento preexistente de tolerar falha; reconciliação dessas cópias segue pendente. Não confundir acabamento e tratamento de falhas com atomicidade de backend.

Próxima etapa: acesso gerencial V2 e consulta de configuração no painel, começando em emuladores e respeitando papéis/versões. Migração, edição/publicação V2, integração de pedidos, upload real e piloto HTTPS seguem no plano. Publicação continua suspensa.
