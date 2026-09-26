# Etapa 2 de 8 — cardápio conectado à API V2

21/09/2026. Integração implementada no projeto irmão `flowpdv-cardapio`. Somente ambiente local; nenhuma publicação.

## Funcionamento entregue

- Rota `/v2/{slug}/mesa/{mesaId}` para mesa e `/v2/{slug}` para retirada, sem chave de licença na URL.
- Leitura do catálogo V2 publicado, seleção de produto, grupos de opções, adicionais, quantidade e observação.
- Carrinho salvo no navegador por loja e mesa. Cálculo de exibição em centavos; o servidor continua sendo a autoridade dos valores.
- Sessão anônima do consumidor separada da sessão administrativa legada.
- Registro persistido do envio antes da requisição: UID da sessão, corpo e requestId. Reenvio após falha ou recarga usa o mesmo conteúdo e identificador.
- Enquanto um envio está sem confirmação, a montagem de outro pedido fica bloqueada. Se a identidade original se perder, a interface orienta consultar a loja em vez de reenviar com outra identidade.
- Confirmação salva antes de apagar o envio pendente e o carrinho. O token de acompanhamento permanece no armazenamento local, sem entrar na URL.
- Consulta do andamento pela API a cada cinco segundos enquanto a página está visível, sem consultas sobrepostas. Em falha, informa que mostra a última confirmação recebida.
- Novo pedido iniciado explicitamente pelo consumidor após a confirmação do anterior.

O envio também usa Web Locks por loja/mesa no mesmo navegador para serializar tentativas entre abas. Navegadores sem essa API recebem uma orientação de atualização em vez de usar um caminho sem proteção. A validação integrada desta etapa exercitou a perda de resposta e recarga de uma página; não incluiu uma bateria de múltiplas abas ou todos os navegadores móveis.

## Arquivos alterados

Em `flowpdv-cardapio`:

- `src/main.js`: entrada da rota V2, preservando rotas legadas.
- `src/lib/v2.js`: sessão do consumidor, catálogo, envio persistido e acompanhamento.
- `src/pages/cardapio-v2.js` e `.css`: interface responsiva de integração.
- `src/lib/firebase.js`: seleção explícita de emuladores para o modo local, inclusive nos imports legados.
- `vite.config.js`: modo `teste` reproduzível sem depender de arquivo de ambiente não versionado.

O modo exige servidor de desenvolvimento e hostname localhost/127.0.0.1. A rota V2 recusa execução na build de produção nesta fase. As rotas existentes continuam usando o comportamento anterior fora do modo de teste. Os arquivos e alterações preexistentes do usuário foram preservados.

## Validação executada

O teste abriu a aplicação real do cardápio em navegador Chromium/Electron oculto, em viewport móvel de 430×900, com Auth, Firestore e Functions locais:

1. Recusou adicionar um produto sem sua escolha obrigatória.
2. Adicionou X-burger de R$ 10,00 com bacon de R$ 2,50 e observação.
3. Enviou o pedido e simulou perda da resposta depois da gravação efetiva no servidor.
4. Conferiu que havia um único pedido no banco.
5. Recarregou a página, recuperou o envio pendente e recebeu o mesmo pedido, mantendo um único registro e total de R$ 12,50.
6. Alterou o estado fictício para `em_preparo`, recarregou e verificou o acompanhamento atualizado.
7. Conferiu ausência de rolagem horizontal e o retorno à montagem de novo pedido.

**Resultado final: teste integrado passou.** As capturas móveis foram inspecionadas; o acompanhamento mostra “Em preparo”, o produto e o total correto. A compilação Vite de produção também passou, com aviso de bundle principal acima de 500 kB, sem implantação. Alterações posteriores de bloqueio de abas/configuração/UI foram recompiladas pelo servidor Vite e validadas novamente pelo teste integrado; a build de produção não foi repetida após esses ajustes.

Não foram repetidas as suítes históricas do PDV nesta etapa. O teste usa contas e catálogo fictícios; nenhuma consulta, compra ou gravação em loja real foi realizada. O servidor local, navegador e emuladores foram encerrados.

## Como repetir

A partir de `flowpdv-sistema/adega-pdv-gestao`, com as ferramentas locais já preparadas:

```powershell
powershell -NoProfile -File scripts/test-pairing.ps1 -Cardapio
```

O runner prepara o catálogo fictício, abre Vite com `--mode teste`, executa o navegador de teste e encerra os processos. Usa porta 5173 com strictPort; não iniciar outra instância nessa porta durante o teste.

Para trabalhar manualmente no cardápio, depois de iniciar os emuladores e provisionar catálogo/mesa fictícios:

```powershell
# Dentro de flowpdv-cardapio
npm run dev -- --mode teste --host 127.0.0.1 --strictPort
```

Abrir `http://127.0.0.1:5173/v2/lanchonete-ui/mesa/mesa-1` quando a massa fictícia correspondente estiver disponível. O runner automatizado não deixa essa massa/servidor disponíveis depois de encerrar.

Capturas em `flowpdv-sistema/output/etapa-2-cardapio/`: `cardapio-mobile.png` e `acompanhamento-mobile.png`.

## Limites e próximo passo

A integração consome o schema V2 documentado na etapa 1. O cadastro/publicação automática a partir do catálogo legado e a migração de URLs reais não foram executados; nesta validação o catálogo foi provisionado como dado fictício. A nova tela é a interface funcional de integração, não uma substituição publicada de todos os recursos visuais do cardápio anterior.

Ficam pendentes a publicação/gestão do catálogo V2 no painel definitivo, fotos e categorias nessa nova tela, validação em aparelhos reais, configuração de autenticação em produção e migração coordenada do acesso antigo. Impressão, pagamentos e baixa de estoque ainda não acontecem nesse fluxo. O runtime Functions local continua Node 24 enquanto o pacote declara Node 20.

Próximo marco da lista: **Etapa 3 — receber no PDV e na mesa**, preservando linhas, adicionais, observações e a identidade do pedido para evitar reaplicação.
