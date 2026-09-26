# Parte 2B — acesso entre lojas e validação do perfil isolado

Continuação: o provisionamento e pareamento do servidor foram implementados na [Parte 2C](pareamento-restaurantes-v2.md). Os itens pendentes abaixo registram o estado ao final da Parte 2B.

21/09/2026. Implementação e testes locais. Nenhuma publicação, conta real, cobrança ou migração.

## Entregue

- Regras aditivas em `firestore.rules` para o novo espaço V2, sem mudar permissões das coleções legadas.
- Dez cenários de segurança executados contra o Firestore Emulator com duas lojas fictícias e identidades simuladas de gerente, caixa, cozinha, administrador e usuário sem vínculo.
- Abertura automatizada do Electron real em janela oculta, compilando o código atual e usando uma pasta descartável. A aplicação carregou, mostrou o aviso de teste e bloqueou rede externa, impressão e HTTP fiscal.
- Java portátil Temurin 21 baixado do provedor oficial com SHA-256 conferido e ferramentas npm locais, sem instalação global ou alteração persistente de PATH.

## Contrato inicial V2

| Caminho | Conteúdo e acesso |
|---|---|
| `lojas_v2/{lojaId}` | Resumo operacional da loja, legível por membros ativos. Não colocar licença, credenciais ou dados pessoais aqui. |
| `lojas_v2/{lojaId}/membros/{uid}` | Papel e vínculo ativo. Provisionamento/revogação exclusivamente no servidor; cliente não pode elevar seu papel. |
| `lojas_v2/{lojaId}/pedidos/{pedidoId}` | Conteúdo de preparo sem endereço ou credenciais. Membros ativos leem; não criam, excluem ou alteram valores pelo SDK cliente. |
| `lojas_v2/{lojaId}/dados_entrega/{pedidoId}` | Dados de entrega separados, legíveis por caixa/gerente e administrador; cozinha não lê. |
| `catalogos_publicos_v2/{slug}` | Projeção pública sanitizada. Anônimo só consulta um catálogo publicado, sem listar todos. Publicação apenas no servidor. |
| `rotas_publicas_v2/{slug}` | Mapeamento privado entre slug e loja. Nenhum cliente lê ou escreve, inclusive administrador via SDK cliente. |

Administração global exige custom claim `admin: true` emitida por servidor confiável; e-mail ou papel enviado pelo cliente não bastam na área V2. Provisionamento via Admin SDK não é validado pelas regras, portanto o futuro endpoint administrativo precisará autenticar/autorizar explicitamente o chamador.

O fluxo permitido de preparo é `novo → em_preparo → pronto → entregue`. Caixa/gerente também podem marcar cancelamento antes da entrega; cozinha não pode. Alteração exige carimbo de servidor e só admite `status` e `atualizadoEm`. Cancelamento aqui é apenas estado operacional: estorno, auditoria, estoque e impressão de cancelamento ainda exigem implementação no servidor. Esse fluxo não deve ser exposto ao usuário final antes dessa integração.

Os identificadores de loja e os slugs não funcionam como credenciais. O servidor futuro deverá garantir unicidade/resolução de slug, sanitização da projeção e identidade privada independente da licença. A etapa atual testa as regras com documentos fictícios provisionados no emulador; não criou ainda esse serviço de provisionamento.

## Resultados verificados

`test/security-v2.test.cjs`: **10/10 passaram** contra Firestore Emulator 1.22.0:

1. Consulta pública limitada a catálogo publicado.
2. Slug não permite consultar rota privada nem criar/ler pedido privado.
3. Acesso cruzado entre lojas recusado em ambos os sentidos, inclusive listagem e atualização.
4. Membro revogado, desconhecido, e-mail administrativo legado ou e-mail de loja não acessam V2 sem vínculo.
5. Cozinha segue a sequência de preparo; não pula/reabre estados.
6. Endereço de entrega não é exposto à cozinha ou à outra loja.
7. Cancelamento limitado a caixa/gerente; pedido cancelado não reabre.
8. Valores, itens, pagamento, identidade e exclusão de pedido protegidos.
9. Proibição de criar vínculos, elevar papel ou publicar catálogo pelo cliente.
10. Administrador por claim consegue consultar lojas; informações de papel/loja isoladas no token não concedem acesso.

Os contextos autenticados são gerados pela biblioteca oficial de testes, sem login em produção. Isso testa as regras, não o futuro fluxo de autenticação/pareamento de terminais. As recusas `PERMISSION_DENIED` nos logs são resultados esperados.

`test/electron-isolation.smoke.cjs`: **passou no Electron real**. Verificou perfil descartável, API de teste, aviso na página, carregamento de `window.App`, rejeição de requisição externa, impressão e chamada fiscal. Nenhum emulador precisa estar disponível para esse teste de abertura/bloqueio; ele não valida login, sincronização completa nem o visual de todas as telas.

As 84 verificações registradas na Parte 2A continuam sendo a referência anterior. Nesta etapa foram executados os 10 cenários de regras e o teste de abertura real; não confundir contagem acumulada com uma nova execução de todas as suítes.

## Repetir

A partir de `adega-pdv-gestao`:

```powershell
powershell -NoProfile -File scripts/test-security.ps1
.\node_modules\.bin\electron.cmd test/electron-isolation.smoke.cjs
```

O runner fixa `demo-flowpdv` e inicia/encerra o Firestore local. A suíte verifica o projeto e `127.0.0.1:8080` antes de limpar os dados fictícios. Não manter outra sessão de teste importante no mesmo emulador durante essa execução.

Ferramentas nesta máquina ficam em `../output/local-tools`, Java em `../output/local-java` e cache em `../output/emulator-cache`. O manifesto/lock do npm está na pasta local-tools. Para preparar dependências equivalentes em outro checkout, a partir de `flowpdv-sistema`:

```powershell
npm install --prefix output/local-tools --no-audit --no-fund firebase-tools@15.30.2 @firebase/rules-unit-testing@5.0.2 firebase@12.19.0
```

Usar Java 21 portátil no caminho documentado ou Java compatível já disponível no PATH. Não houve atualização das dependências de produção do PDV. Os scripts de instalação opcionais que o npm bloqueou não foram liberados, e os testes executaram com sucesso sem eles.

Referências de preparação: [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure), [projetos fictícios e Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore), [Java portátil oficial](https://adoptium.net/installation/archives).

## O que falta na Parte 2

- Provisionamento privado de loja/usuário/terminal e pareamento com token de uso único.
- API pública de pedidos, gravação atômica e proteção contra reenvio/abuso.
- Adaptação conjunta do cardápio, administração e PDV ao novo contrato.
- Revogação planejada das credenciais antigas após migração, testes de compatibilidade e recuperação.
- Validação integrada com Auth/Functions emulados, duas lojas e o fluxo real de pedido.

**A vulnerabilidade do acesso legado ainda não está corrigida.** A nova área tem regras verificadas, mas as aplicações atuais ainda usam as coleções e a autenticação anteriores. Não publicar isoladamente estas regras esperando que isso migre o sistema. A próxima entrega é o serviço de provisionamento/pareamento e sua validação local.
