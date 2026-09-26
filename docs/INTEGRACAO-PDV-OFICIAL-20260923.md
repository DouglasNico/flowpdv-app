> ATUALIZAÇÃO MAIS RECENTE — 24/09/2026, deploy completo de functions OK (`CLOUDINARY_V2_API_SECRET` no Secret Manager; inclui `assinarFotoCardapioV2`). Sync Combos Master→loja + smoke combo/Atendimento/voucher já validados na BURGER. Pendente: TEF/impressora com equipamento, mais ofertas de combo no estoque + publicar cardápio, release só sob pedido.
# Integração no PDV oficial — 23/09/2026

Na retomada, o proprietário confirmou: caixa da BURGER TESTE fechado e sem venda pendente. A confirmação permite prosseguir com a preparação do corte; não equivale a validar a integração instalada.

## Estado atual da retomada (23/09, após 20:06 UTC)

- Publicados 22 serviços operacionais selecionados (lista em `../output/deploy-operacional-lista.txt`), mais a atualização de `consultarPreparacaoOperacionalPdvV2` e a nova `confirmarAdesaoOperacionalPdvV2`. Deploys concluídos. Regras e índices V2 publicados; regras novas bloqueiam a gravação legada da BURGER quando o corte está preparado. Outros estabelecimentos mantêm o comportamento anterior.
- `receberPedidoPdvV2` agora recusa recebimento novo com loja suspensa; preserva idempotência de pedidos já recebidos. Ensaio BURGER completo passou novamente com essa verificação. Os 15 testes de regras passaram, incluindo bloqueio de escrita legada e preservação de leitura/outras lojas. Três testes da consulta/adesão passaram.
- Ponte do cardápio atual publicada no commit `1bef861` do repositório `flowcardapio`. Mantém a interface atual; encaminha somente a rota explicitamente marcada para V2, inicialmente retirada/avulsos. Não grava um segundo pedido no legado. Acompanhamento usa token no link e consultas a cada 30 segundos, suspensas com aba oculta. Build e três testes da ponte aprovados. Rota publicada confirmada por resposta JSON de token inválido.
- Novo instalador OFICIAL `../output/instalador-oficial-v2-20260923-retomada/FlowPDV-Setup.exe`, SHA256 `ce73d4dc3b57af641b34946d40b64d6cae2fec0841f5698082ad95816db6b5af`, versão 3.2.38. Instalado silenciosamente com exitCode 0 em `C:/Users/User/AppData/Local/Programs/flowpdv`. ASAR instalado corresponde ao pacote conferido. Aplicativo iniciado e conferido: licença LIC-FLOW-937278, 60 produtos, caixa fechado e tela de login. NÃO é ainda validação de venda instalada.
- Captura da origem renovada. `scripts/corte-burger-oficial.cjs --preparar --caixa-fechado` confirmou atomicamente o corte em `2026-09-23T20:05:15.788865Z`: estado `aguardando_pdv`, legado bloqueado, cardápio público pausado e roteamento V2 preparado. Ativação operacional segue suspensa; catálogo V2 segue pausado. Não houve nova venda ou baixa real.
- Terminal técnico antigo `HdPRbUveCld3Z0BiHHrop0nAPFD3` e seu membro foram desativados condicionalmente, com motivo de substituição pelo PDV oficial, em `2026-09-23T20:06:59.404266Z`. Terminal oficial `fyFJuGJCcrgkVFkiQiFnSpuUlph1` permanece ativo. Recibos em `../output/migracao-v2-20260923/corte-oficial-*-recibo.json`.
- Pergunta/ação pendente enviada ao usuário: entrar como Admin no aplicativo instalado usando o PIN na própria tela e responder “Já entrei”. Na última consulta ainda estava deslogado. NÃO ler/extrair o PIN do armazenamento nem simular autenticação para pular essa etapa.

### Próximo passo exato

Após o login do usuário, abrir Configurações/Conferir conexão no aplicativo instalado. A consulta confere 60 produtos/saldos/preços e grava a adesão local, depois `confirmarAdesaoOperacionalPdvV2` confirma revisão/dispositivo no terminal remoto. Só então executar `node scripts/corte-burger-oficial.cjs --ativar`: o executor exige confirmação de todos os caixas ativos e muda atomically loja/catálogos, sem reimportar estoque. O PIN não precisa ser enviado ao chat.

O aplicativo foi aberto com depuração LOCAL em 127.0.0.1:9228 para conferir DOM/estado sem credenciais; Playwright pode conectar via CDP. Remover essa execução com depuração ao concluir os testes (reiniciar normalmente). Não fechar o navegador CDP de modo que encerre uma operação financeira pendente.

Depois da ativação: validar um pedido avulso no cardápio publicado e seu recebimento/fechamento no aplicativo instalado, conferir estoque e repetição sem duplicação. Ainda falta essa validação real. Nenhum release/atualizador foi publicado para clientes. Não dizer que já sincroniza enquanto esse ciclo não estiver comprovado.

As seções abaixo registram a etapa anterior; a situação acima é a mais recente.

O proprietário determinou continuar no projeto oficial, sem distribuição de teste separada. A tentativa de scripts para uma versão isolada foi removida do repositório. Uma pasta temporária gerada em `../output/burger-teste-local` permaneceu porque a revisão automática bloqueou sua exclusão; ela não foi instalada nem publicada.

## Código desta etapa

- `perfil-operacional-v2.js`: permite usar o motor integrado no PDV normal somente com adesão da BURGER TESTE, revisão e identidade do computador correspondentes. Mantém os perfis locais existentes.
- `adesao-pdv-v2.js`: exige confirmação de corte pelo servidor, caixa fechado, 60 produtos iguais e preços/saldos compatíveis. Registra primeiro os vínculos que bloqueiam a baixa legada; falha na gravação não libera operação parcialmente migrada.
- `servicos-acesso-hospedado.js`, `operacoes-pdv-v2.js` e `sessoes-homologacao.js`: reutilizam a sessão já vinculada do computador, com lista explícita de chamadas operacionais e verificação do operador. Não usam outra conta de máquina nem concedem administração ao caixa.
- `recebimento-teste.js`, `fechamento-teste.js`, `venda-aplicativo-completo.js`, `storage.js` e `caixa.js`: disponibilizam os adaptadores existentes também para o perfil oficial aderido. Os nomes históricos dos arquivos foram mantidos. O servidor continua validando cada operação.
- `conexao-cardapio.js` e `app.js`: consultam a preparação após conectar o caixa e instalam o fluxo integrado após adesão válida. A mensagem de conexão distingue recebimento pendente de fluxo aderido.
- `functions/preparacao-pdv-v2.js`: consulta autenticada, restrita ao caixa vinculado à BURGER TESTE, retorna `corte_pendente` enquanto o legado e a rota pública não tiverem sido migrados. Não realiza o corte nem altera saldos.
- `functions/index.js`: registra essa consulta. `bundle.js` regenerado.

## Publicação e custo

Publicados apenas `consultarPreparacaoOperacionalPdvV2` e `consultarAtivacaoOperacionalV2` em `aplicativo-pdv/us-central1`. Ambos responderam HTTP 401/UNAUTHENTICATED a consulta sem autenticação, confirmando que as rotas alcançam o código e recusam acesso anônimo. A nova consulta tem mínimo zero e máximo uma instância; a consulta de ativação herda as opções globais existentes. São consultas pontuais, sem novo listener enquanto o recebimento continua suspenso. Isso não é medição de faturamento.

Não foram publicados nesta etapa os serviços operacionais de recebimento/venda, as regras V2 nem a nova rota pública. Não houve alteração de ativação, estoque, histórico ou pedidos reais.

## Verificação

- 42 testes de migração, venda, armazenamento e reconstrução aprovados.
- Mais 35 testes de adesão, acesso, venda nativa, estorno e recuperação aprovados. Incluem preço/saldo divergente, caixa aberto, outra licença/dispositivo e falha de disco durante adesão.
- Harnesses que removem imports foram atualizados para carregar a nova dependência de perfil.
- Build do bundle aprovado.
- Suíte padrão do projeto aprovada: 51/51 testes gerais e 26/26 testes TEF (simulados; não é homologação física).
- Instalador oficial gerado localmente em `../output/instalador-oficial-v2-20260923`, sem publicação em release ou atualizador. Consultar `verificacao-pacote.json` dessa pasta para a conferência estática final. Mantém a identidade e a versão 3.2.38 do projeto; não constitui uma nova versão pública.
- Conferência estática aprovada: 21 arquivos do pacote coincidem com o fonte, dependências presentes e perfis de teste recusados no pacote normal. SHA-256 do instalador: `7b6abd1306f42db8beb420a4ff747b6cde0822acbc230e4bcb164a538d1d89b5`. Não instalado nem validado em operação nesta etapa.

## Pendência real — não declarar sincronizado

O recebimento permanece suspenso. A adesão oficial não é gravada enquanto o servidor não confirmar o corte; não criar manualmente esse marcador no armazenamento local.

Ainda é necessário concluir e ensaiar o corte único entre legado/V2 (catálogo, rota pública, estoque e caixa fechado), publicar o conjunto operacional mínimo/regras, habilitar somente a BURGER TESTE e testar um pedido completo no aplicativo instalado. Revisar também os comandos de recuperação expostos no painel contra a lista de operações autorizadas antes de liberar a adesão. Os testes de código e a inspeção ASAR não substituem essa validação instalada.

