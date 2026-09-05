# Memoria de Continuidade - FlowPDV

Data: 2026-09-04

## Projetos

- PDV desktop: `D:\BACKUP-0309\adega-pdv-gestao`
- Master Admin: `D:\Desenvolvimento\flowpdv-master-admin`
- O PDV nesta pasta nao possui repositorio Git.
- O Master possui Git: `https://github.com/DouglasNico/flowpdv.git`
- Ultimo commit publicado do Master: `84d7789`

## Estado atual

- Bundle do PDV e recompilado com `npm run bundle`.
- Ultimas validacoes passaram com `node --check` em `app.js`, `auth.js`, `licenca.js`, `main.js` e `preload.js`.
- Antes de testar, fechar todas as instancias antigas do Electron. O app usa `requestSingleInstanceLock`; abrir outro .bat pode apenas focar uma janela antiga.

## Clube Fidelidade

- Modulo: `licenca.modulos.clubeFidelidade`.
- Master tem checkbox Clube Fidelidade por licenca.
- PDV esconde Preco Clube, Membro do Clube e F6 se o modulo estiver desligado.
- Produto grava `precoClube`; o campo tem mascara monetaria e e carregado ao editar.
- Estoque usa uma coluna combinada `Promo / Clube`.
- Primeiro item por scanner ou F2 abre `CLUBE?`.
- Enter/SIM abre o CPF; ESC/NAO continua sem Clube.
- CPF usa mascara `000.000.000-00`.
- Modais do Clube foram estilizados.
- O Enter residual do scanner e ignorado apenas uma vez para nao quebrar outros atalhos.

## Vouchers

- Master controla `pagamentos.vouchers`.
- Marcas:
  - `voucherMarcaVr`
  - `voucherMarcaAlelo`
  - `voucherMarcaPluxee`
  - `voucherMarcaTicket`
  - `voucherOutros`
- Checkbox principal `Vouchers` fica na grade de modulos.
- Marcas ficam no bloco abaixo e ficam cinzas/bloqueadas quando Vouchers esta desligado.
- Flags antigas ainda sao lidas no PDV: `voucherVr`, `voucherAlelo`, `voucherSodexo`, `voucherTicket`.
- Fluxo: F5, informa valor, Enter, escolhe marca com setas/Enter, escolhe Refeicao ou Alimentacao com setas/Enter.
- Venda registra exemplos como `Alelo - Refeicao` e `Ticket - Alimentacao`.

## Layout Moderno e Classico

- Master tem o campo `Layout do PDV`: `moderno` ou `classico`.
- Campo do Master: `#cli-layout-pdv`.
- `layoutPdv` e salvo localmente e no Firestore.
- O Master preserva o campo na consulta inicial e nos listeners realtime.
- PDV le o campo na ativacao e sincronizacao da licenca.
- `src/js/app.js` aplica `layoutPdv`.
- `src/js/licenca.js` sincroniza e aplica mudancas de layout.

## Login e acesso por perfil

- Operador deve entrar direto no PDV.
- Gerente deve entrar direto na Gerencia.
- Gerente usa F1 para abrir a Frente Caixa.
- Operador nao deve acessar outras abas; `trocarAba` bloqueia destinos diferentes de `pdv`.
- Navegacao administrativa fica oculta para operador.
- A licenca pendente/bloqueada deve continuar mostrando a tela de ativacao.
- O operador tenta entrar em fullscreen real via IPC Electron; existe fallback para `document.requestFullscreen()`.

Arquivos do controle:

- `src/js/auth.js`: login e direcionamento por perfil.
- `src/js/app.js`: navegacao, bloqueio de abas, fullscreen e layout.
- `main.js`: IPC `definir-tela-cheia-operador`.
- `preload.js`: expoe `electronAPI.definirTelaCheiaOperador`.

## Remodelacao do Classico

O modo Classico inicialmente era apenas CSS sobre o moderno e ficou ruim. Depois foi criado um shell separado:

- `#classic-pdv-shell`
- `#classic-pdv-product-panel`
- `#classic-pdv-list-panel`
- `#classic-pdv-summary-panel`

Em `src/js/app.js`, `aplicarLayoutPdv()` guarda marcadores DOM e move os componentes funcionais para o shell Classico:

- `.pdv-barcode-bar`
- `.pdv-items-table-wrapper`
- `.pdv-total-card`
- `.pdv-actions-panel`

Ao voltar para Moderno, os componentes sao restaurados para os locais originais.

CSS relacionado:

- `#classic-pdv-shell`
- `#classic-pdv-product-panel`
- `#classic-pdv-list-panel`
- `#classic-pdv-summary-panel`
- `#tab-pdv.pdv-layout-classico`
- `body.pdv-operador-restrito`

O proximo refinamento deve ser visual, usando a foto do PDV Yzidro como referencia. Nao voltar a aplicar apenas cores no layout moderno. O shell Classico deve continuar sendo a base.

## Arquivos principais

PDV:

- `index.html`: estrutura, modais e shell Classico.
- `src/js/app.js`: navegacao, perfil, fullscreen e layout.
- `src/js/auth.js`: login.
- `src/js/licenca.js`: ativacao e sincronizacao.
- `src/js/pdv.js`: carrinho, leitor, pagamentos, Clube e Vouchers.
- `src/js/estoque.js`: precoClube e tabela Promo/Clube.
- `src/css/style.css`: estilos.
- `src/js/bundle.js`: gerado pelo esbuild; nao editar manualmente.
- `main.js`: Electron.
- `preload.js`: IPC.

Master:

- `index.html`: cadastro de licenca e modulos.
- `js/app.js`: salvar, ler, sincronizar licencas e layoutPdv.

## Comandos PDV

```powershell
Set-Location 'D:\BACKUP-0309\adega-pdv-gestao'
npm run bundle
node --check src\js\app.js
node --check src\js\auth.js
node --check src\js\licenca.js
node --check main.js
node --check preload.js
```

## Proximo passo recomendado

1. Fechar instancias antigas do Electron.
2. Confirmar no Master uma licenca com Layout do PDV = Classico.
3. Abrir o PDV recompilado.
4. Testar login de operador: somente PDV e fullscreen.
5. Testar gerente: Gerencia e F1 para caixa.
6. Tirar screenshot do shell Classico.
7. Refinar dimensoes e espacos para aproximar a referencia Yzidro sem alterar a logica de venda.

## Cuidados

- Nao editar `src/js/bundle.js` manualmente; rodar `npm run bundle`.
- Nao usar `git reset --hard`.
- Nao remover dados locais ou Firestore durante testes.
- O PDV local nao possui Git; apenas o Master esta publicado.
