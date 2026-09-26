# Etapa 7Z — serviços de sessão e autorização

Primeira extração da frente 1. O aplicativo de teste passa a consumir serviços separados da construção das telas; o login operacional normal ainda não foi integrado.

## Dependências e alterações

- `sessoes-homologacao.js` concentra a criação das sessões Firebase do terminal e da gerência. Preserva os nomes de aplicativos, projeto fictício, portas dos três emuladores e bloqueio fora do perfil de teste. Não acessa a conta Firebase legada.
- Pareamento, configuração, recebimento, cozinha e fechamento importam as sessões diretamente desse módulo, sem depender da construção da tela de pareamento. A persistência do terminal e da gerência permanece como antes: configurada no fluxo de login, local para o terminal e em memória para a gerência.
- `autorizacao-homologacao.js` controla a autorização de novas vendas por meio de adaptadores de consulta e observação. Não depende de DOM nem do SDK Firebase. A tela de fechamento fornece esses adaptadores e apresenta os estados nos dois layouts.
- Cada conexão e consulta possui uma identidade interna. Cache, falha, troca de loja e desconexão impedem respostas antigas de restaurar uma autorização. A desconexão encerra a observação anterior; reconectar exige consultar novamente o vínculo e a autorização.
- A recuperação financeira continua fora do bloqueio de novas vendas, sujeita às validações do servidor. Nenhuma autorização é persistida para uso offline.

O módulo de autorização continua restrito ao perfil de teste. Sua separação permite reaproveitar a lógica posteriormente, mas não configura um ambiente remoto nem habilita produção. Não houve alteração visual, publicação, impressão física, cobrança ou uso de licença real.

## Validação

`node --test test/autorizacao-homologacao.test.cjs test/runtime-profile.test.cjs`: 13 testes passaram. Cobrem respostas fora de ordem, cache, desconexão, troca de loja, erro de observação/consulta, papel/capacidade e proteções do perfil local. `npm run bundle` passou.

`node --test test/pairing-ui-guard.test.cjs`: mais 7 testes passaram, incluindo recusa dos serviços extraídos antes de acessar Firebase no perfil normal. Evidência: `output/etapa-7z-guard.log`. Total desta etapa: 20 testes locais.

Fluxo completo oculto: `FLOWPDV_VISIBLE_TEST=0` e `scripts/test-pairing.ps1 -Interface` passaram com código 0. Evidência: `output/etapa-7z-interface.log`. Inclui pareamento, isolamento entre lojas, logout separado, revogação, configuração, recebimento, cozinha, clássico/moderno, suspensão/reativação, cancelamento e retomada após recarga. O runner confirmou os totais finais de caixa, registros e estoque remoto sem duplicação. Os marcadores `ACESSO OPERACIONAL UI PASS`, `SUSPENSAO CANCELAMENTO UI PASS` e `SUSPENSAO RETOMADA UI PASS` permaneceram aprovados após a extração.

## Próxima parte

Extrair a preparação/autenticação e consulta do vínculo do terminal da tela de pareamento, definindo o ciclo de sessão para o perfil operacional de homologação. Preservar as identidades e pendências existentes e testar logout/revogação durante consultas. Configuração, integração ao login normal e migração de permissões ainda permanecem pendentes na frente 1.
