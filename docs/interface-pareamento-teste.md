# Parte 2D — pareamento pela interface de teste

21/09/2026. Entrega local, sem publicação. A interface está em `src/js/pareamento-teste.js`, instalada pelo app somente quando o preload confirma o ambiente de teste.

## O que funciona

No PDV aberto com `npm run start:test`, o botão **Configurar acesso de teste** abre uma janela com duas áreas:

1. **Terminal:** preparar a identidade, informar o código de autorização, ativar e consultar a ativação.
2. **Gerência:** entrar com conta fictícia verificada, informar loja/terminal, escolher caixa ou cozinha, gerar a autorização e revogar o terminal informado.

A identidade do terminal usa persistência local em um aplicativo Firebase nomeado próprio. O gerente usa outro aplicativo Firebase nomeado, com sessão apenas em memória. Nenhum desses logins substitui a sessão legada usada pelo caixa. Recarregar a página encerra a sessão de gerência; sair da gerência não encerra o terminal.

O código de autorização é exibido somente para transferência ao terminal e não é salvo pela interface em localStorage. Senha e códigos são limpos em operações de saída, fechamento ou ativação concluída. Os dados retornados pelo servidor são inseridos por textContent/value, não interpolados em HTML.

Enquanto uma operação está em andamento, os botões ficam desativados para impedir duplo envio. Falhas de conexão exibem mensagem; não há tentativa de usar serviços reais como alternativa. Após falha na consulta, a tela não mantém a indicação de terminal ativo.

## Validação executada

Teste de ponta a ponta no Electron real, em janela oculta, com Auth, Firestore e Functions emulados e dados fictícios:

- Preparou uma identidade anônima e exibiu seu identificador.
- Fez login do gerente pela interface e limpou o campo de senha.
- Tentou autorizar para outra loja e recebeu recusa.
- Gerou uma autorização para a loja correta e ativou o terminal pela interface.
- Saiu da conta do gerente e consultou o terminal ainda ativo.
- Recarregou a aplicação e recuperou o mesmo UID e vínculo persistido.
- Revogou o terminal pela interface e confirmou a recusa em nova consulta.
- Validou novamente pasta descartável, carregamento da aplicação e bloqueios de rede externa, impressão e HTTP fiscal.

**Resultado: teste integrado passou.** Também passaram **8 testes locais**: os 7 do perfil isolado e um novo teste que verifica que a interface não acessa DOM ou inicializa sessões no modo normal.

A captura `output/parte-2-interface/pareamento-ativado.png`, relativa a `flowpdv-sistema`, foi gerada após recarga e inspecionada visualmente. Contém apenas a identidade fictícia do terminal; campos de senha e autorização estão vazios. O painel permite rolagem para os controles inferiores.

A primeira execução do teste integrado parou por um retorno de função não serializável no código de automação do diálogo de confirmação. O retorno foi corrigido, e a repetição percorreu a revogação até o fim com sucesso. Isso não exigiu alterar a regra de autorização do servidor.

## Repetir a validação

A partir de `adega-pdv-gestao`, usando as ferramentas locais preparadas nas etapas anteriores:

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
node --test test/runtime-profile.test.cjs test/pairing-ui-guard.test.cjs
```

O primeiro comando inicia emuladores vazios, cria as contas/lojas fictícias, compila o aplicativo em pasta temporária, percorre a interface e encerra Electron e emuladores. Não deixa um ambiente manual aberto. A massa de teste está em `test/run-pairing-ui.cjs`; as ações de interface estão em `test/pairing-ui-flow.cjs`.

Para uma sessão manual, iniciar os emuladores da Parte 2A, provisionar uma conta fictícia verificada e seu vínculo de gerente conforme a Parte 2C e abrir `npm run start:test`. Não usar credenciais reais. O campo de loja é, nesta interface de validação, a identificação interna da loja fictícia. A seleção amigável de lojas pertence à integração futura com o painel administrativo.

## Limites

- Esta é uma interface de validação dentro do PDV de teste. O projeto separado do painel administrativo não foi modificado.
- Não há ainda tela administrativa completa para cadastrar loja, usuário ou redefinir senha. O servidor da Parte 2C oferece os endpoints de vínculo; o teste usa preparação automática de dados fictícios.
- “Terminal ativo” confirma o vínculo V2; não ativa a licença legada, não libera vendas e não conecta pedidos do cardápio ao caixa.
- A nova autenticação ainda não substituiu o fluxo antigo. A vulnerabilidade legada continua pendente da migração coordenada.
- Não foram repetidas nesta entrega todas as suítes históricas; o resultado acima corresponde aos testes efetivamente executados agora.
- O emulador de Functions continua usando Node 24 do computador, enquanto o pacote declara Node 20; permanece a pendência de alinhamento antes da publicação.

O próximo marco funcional é a API de pedidos públicos e sua ligação ao terminal autorizado, inicialmente em uma loja fictícia, antes da integração com comanda, impressão e fechamento.
