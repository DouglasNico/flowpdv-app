# Parte 2A — perfil de teste do PDV

Atualização posterior: as ferramentas locais, o teste de abertura real e a primeira bateria de regras entre lojas foram concluídos na [Parte 2B](seguranca-restaurantes-v2.md). As limitações abaixo descrevem o estado ao final da Parte 2A.

Implementado em 21/09/2026. Alteração local, sem publicação ou migração de dados.

## O que muda

`npm run start:test` compila e inicia o Electron com `--flowpdv-test`. Esse perfil usa `%APPDATA%/flowpdv-test`, sem copiar dados ou licença de `%APPDATA%/flowpdv`. Uma faixa identifica o ambiente. O aplicativo empacotado recusa essa opção. Erro na criação/configuração do diretório interrompe a abertura.

O modo normal continua usando a pasta `flowpdv` e o Firebase configurado anteriormente. **`npm start` não é o comando de teste isolado.**

No modo de teste:

- Firebase usa exclusivamente `demo-flowpdv`, Auth em 127.0.0.1:9099, Firestore em 127.0.0.1:8080 e Functions em 127.0.0.1:5001.
- A sessão do navegador bloqueia requisições remotas; recursos locais e as três portas de emuladores são permitidos. Sem emulador, a operação falha ou permanece pendente conforme o SDK; não troca automaticamente para produção.
- Atualizador e ponte nativa SiTef não são carregados. HTTP fiscal/TEF e impressão via IPC retornam falha explícita, nunca sucesso simulado.
- Links externos, novas janelas e permissões de dispositivos são bloqueados. Fotos/fontes externas também não carregam; usar arquivos de teste locais.

Esse perfil é uma proteção de desenvolvimento para os caminhos atuais do aplicativo, não um sandbox para executar código hostil. Novas integrações no processo principal precisarão respeitar o mesmo bloqueio. Não importar backups, certificados, tokens ou dados pessoais reais.

## Execução local

Configuração separada: `firebase.test.json`, sem alterar `.firebaserc` ou a configuração de publicação.

Com Firebase CLI e Java compatíveis previamente disponíveis, a partir de `adega-pdv-gestao`:

```powershell
firebase emulators:start --project demo-flowpdv --config firebase.test.json --only auth,firestore,functions
```

Em outro terminal:

```powershell
npm run start:test
```

A configuração usa as regras e Functions atuais para reprodução local; não representa a nova autorização segura entre lojas. Ainda faltam criar massa fictícia/licença, conectar o cardápio e validar o fluxo completo. Não usar a licença de uma loja real.

Na inspeção desta etapa, `firebase` e `java` não foram encontrados no PATH. Nenhum pacote foi instalado, emulador iniciado ou aplicativo gráfico aberto. Portanto o perfil foi validado por testes automatizados e compilação, e a execução visual com emuladores continua pendente.

## Verificação

- 7 testes novos em `test/runtime-profile.test.cjs`: separação de diretório, recusa no aplicativo empacotado, restrição de rede/dispositivos, barreiras IPC do main, falha de configuração do diretório, seleção dos SDKs/emuladores e bloqueio de links no preload.
- 51 testes de regras existentes e 26 de pagamentos simulados passaram novamente.
- Bundle de aplicação compilado em pasta temporária, sem substituir `src/js/bundle.js` nesta entrega.
- Verificação de sintaxe de main/preload e revisão do diff. O aviso de linha vazia em `functions/index.js` já existia e foi preservado.

Comandos de testes:

```powershell
npm run test:profile
node ../output/parte-1/executar-testes-isolados.cjs
```

## Próxima subetapa — acesso público e privado

O mecanismo antigo de autenticação continua no código normal e ainda precisa ser substituído. Não anunciar a correção de segurança como concluída.

Ordem preparada:

1. Provisionar duas lojas fictícias no emulador, com identidades privadas diferentes. Identificação pública (`slug`) deve ser independente da licença e dos segredos de autenticação.
2. Definir vínculo privado entre usuário/terminal e loja, criado por administrador autenticado. Pareamento de dispositivo com token aleatório, de uso único e expiração, validado no servidor. A chave publicada no QR não poderá ativar um terminal.
3. API pública resolve o slug internamente, valida catálogo/preço e cria pedido com proteção contra reenvios. Não retorna licença ou credenciais; acompanhamento usa token próprio e dados mínimos. Garantir gravação atômica do pedido e de sua projeção pública.
4. Testar regras com clientes não administrativos: anônimo, operador da loja A, operador da loja B e administrador. Cobrir leitura, criação, alteração de status e proibição de elevação de privilégios.
5. Adaptar conjuntamente PDV, cardápio e administração. Planejar versionamento e transição dos terminais existentes antes de revogar credenciais antigas. Apenas esconder a licença na URL não elimina o risco das credenciais antigas.
6. Só após validação local e homologação, planejar implantação coordenada das aplicações e regras, com recuperação. Esta entrega não executou essa implantação.

Separar acesso é pré-requisito para disponibilizar novos pedidos públicos. Integração de comanda, impressão automática e delivery permanecem nas etapas posteriores.
