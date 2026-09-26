# Histórico da conversa Cursor — FlowPDV / BURGER TESTE

**Período:** 23/09/2026 ~ 25/09/2026  
**Participante:** Douglas (FlowPDV)  
**Loja piloto:** BURGER TESTE  
**Licença:** `LIC-FLOW-937278`  
**Loja V2:** `legado-lic-flow-937278`  
**Slug público:** `burger-teste`  
**Firebase:** `aplicativo-pdv`  
**PDV instalado:** ~3.2.38 (ASAR patched localmente em vários pontos)  

**Repos:**
- `D:\Desenvolvimento-PDV\flowpdv-sistema` (PDV / gestão / functions)
- `D:\Desenvolvimento-PDV\flowpdv-cardapio` (site cardápio / painel / Vercel `flowcardapio`)

**Nota de segurança:** este arquivo **não** reproduz senhas, PINs nem tokens compartilhados no chat. Credenciais devem ficar só no cofre/local do titular.

**Transcripts Cursor (internos):** conversa principal sob o id `bbe02062-142e-4eec-9825-6e582d23f416` nos agent-transcripts do projeto.

---

## 1. Objetivo geral

Continuar o roteiro da BURGER TESTE no PDV oficial V2: caixa utilizável, recebimento de pedidos do cardápio, combos, sync de licença/módulos, painel web e URL amigável para o cliente — **sem** release/minInstances/auto-update salvo pedido explícito.

Referência inicial do usuário:  
`adega-pdv-gestao/docs/ROTEIRO-GROK-CONTINUAR-BURGER-20260923.md`

---

## 2. Linha do tempo (resumo cronológico)

### 23/09 — Retomada e corte V2

- Backup/workspace confirmado em `flowpdv-sistema`; outros sites em `D:\Desenvolvimento-PDV\`.
- Deploy operacional de Cloud Functions V2, regras e índices.
- Corte BURGER preparado/ativado: `legadoBloqueado`, cardápio público legado pausado, rota V2 (`integracaoPdv` / slug `burger-teste`).
- Instalador oficial gerado e instalado localmente; terminal oficial vinculado.
- Ponte do cardápio legado → V2 no repo `flowcardapio` (retirada/avulsos no piloto).
- Docs: `INTEGRACAO-PDV-OFICIAL-20260923.md`, recibos de corte em `output/migracao-v2-20260923/`.

### 24/09 (manhã) — Caixa, venda, estorno, UX

Temas tratados com o Douglas (prints + testes no PDV instalado):

| Tema | O que aconteceu / decisão |
|------|---------------------------|
| Módulo Cardápio / aba no PDV | Preferência: liberar pelo **Master** como outros módulos (não “feio”/solto). |
| TEF, impressora, gaveta, balança, NF | Sem equipamento nesta máquina; deixar código/config pronto para o cliente. |
| Venda offline | “VALOR QUITADO” sem finalizar até voltar internet — comportamento ligado à confirmação no servidor. |
| Estorno | Fluxo e UI; botão/opções que não apareciam no PDV antigo vs build com ASAR atualizado. |
| “Caixa integrado” | Só aparece com perfil/adesão V2 correta. |
| Notificações | Erro deve sair da página; “Concluído” no perfil → esperado **“Bem-vindo”**. |
| Demora ao fechar venda | Confirmação no servidor; tentativas de não travar o caixa (background após timeout; cupom precisa da tela até finalizar se impressão). |
| Estorno lento | Investigação ligada a round-trip servidor. |

### 24/09 (meio) — Combos, Atendimento, Cloudinary, sync

- Módulo **combos** na licença BURGER + espelho em `lojas_v2.modulos.combos`.
- Sync Master→loja: trigger/callable `sincronizarCombosLicencaV2` / `espelharCombosLicencaV2`; `consultarAtivacaoOperacionalV2` passa a incluir `modulos.combos`.
- `LicencaModule.sincronizarComNuvem()` restaura `isModuloAtivo('combos')` sem gambiarra local.
- Secret Cloudinary no Secret Manager; **deploy completo** de functions (inclui `assinarFotoCardapioV2`).
- Smoke: pedido combo público → receber → pagar → estorno com reposição.
- Ensaio Atendimento (troca de papel caixa/atendimento) documentado em `ENSAIO-ATENDIMENTO-PREP-20260924.md`.
- Cadastro de combo no estoque do PDV: preço total, fixos, bebidas; UI de ofertas.

### 24/09 (tarde) — UI estoque / save combo

Pedidos do Douglas e correções:

1. **Salvar combo não fazia nada** → validação HTML5 silenciosa + toasts fracos → `novalidate` + erros amigáveis.
2. **Select de bebidas** → começa em “Selecione uma categoria”; lista filtrada; seleção abaixo.
3. **Após save:** “Item em migração…” → `saveProdutos` só bloqueia mudança de campos de estoque em itens migrados; metadados/combo liberados.
4. **Outline de foco** sobrepondo UI → remoção de box-shadow externo.
5. **Tabela estoque** → `table-layout: fixed`, larguras (nome / estoque / ações / categoria); chips escuros quando selecionados.
6. Foto no cardápio: mensagem de permissão Firestore (ligado ao tema das regras + corte).

ASAR do PDV em `C:\Users\User\AppData\Local\Programs\flowpdv\resources\app.asar` atualizado várias vezes (sem release público).

### 24/09 (noite) — Domínio, permissões, URL amigável

**Problema:** `https://flowpdv.app.br/painel` com “erro de permissão em tudo” após troca de `cardapio.flowpdv.com.br` → `flowpdv.app.br`.

**Diagnóstico:**
- Domínio sozinho não explica `permission-denied` do Firestore.
- BURGER com `corteOperacionalV2.legadoBloqueado` + regras `legadoGravavel` bloqueavam escrita em `cardapio_config` / pedidos, etc.
- Auth: `flowpdv.app.br` já estava (ou foi confirmado) em Authorized Domains; adicionado também `www.flowpdv.app.br`.
- Browser API key sem restrição de referrer problemática.

**Correção de regras (deploy Firestore):**
- `cardapio_config` e `cardapio_publico`: escrita para `isLoja` **sem** exigir `legadoGravavel`.
- `backups_lojas/.../pedidos`: **update** liberado para a loja mesmo com corte; create/delete de estoque legado continua bloqueado.

**Combo no painel web legado:**  
O card de produto do painel **não** mostra selo “Combo”. Combo fica no PDV (`oferta.combo`) e no catálogo V2 publicado. No V2, X-BURGER mostra Individual R$ 18,90 / Combo R$ 32,90.

**URL amigável (recomendado e implementado):**

| Antes | Depois (canonical) |
|-------|--------------------|
| `https://flowpdv.app.br/LIC-FLOW-937278` | `https://flowpdv.app.br/burger-teste` |

- V2 habilitado em produção: `.env.production` com `VITE_V2_HOSPEDADO=true` e `VITE_V2_ORIGEM=https://flowpdv.app.br/`.
- Apex `/{slug}` renderiza cardápio V2; `/v2/{slug}` permanece.
- `/{LIC-FLOW-…}` na **raiz** redireciona para o slug se `integracaoPdv.motor === 'v2'` **ou** fallback piloto `LIC-FLOW-937278` → `burger-teste`.
- Publicar no painel legado **preserva** `integracaoPdv` (antes o `setDoc` apagava e quebrava a ponte/redirect).
- Deploy Vercel produção no projeto **`flowcardapio`** → alias `https://flowpdv.app.br`.
- Validado no browser: menu V2 com combo; redirect da licença; `/painel` ok.

### 25/09 — Documentação desta conversa

- Pedido de resumo + este MD completo do histórico.

---

## 3. O que ficou pronto (checklist)

### Backend / Firebase
- [x] Functions V2 operacionais (recebimento, fechamento, pedidos públicos, combos sync, foto, ativação, etc.)
- [x] Regras Firestore com corte legado BURGER + liberação de cardápio/pedidos status
- [x] Secret Cloudinary + assinatura de upload V2
- [x] Domínios Auth para `flowpdv.app.br` / `www`

### PDV Windows (local)
- [x] Perfil oficial V2 / adesão / caixa integrado
- [x] Combos no cadastro + módulo sincronizado
- [x] Correções de save/UI estoque (migrados, focus, tabela, bebidas)
- [x] Patches no ASAR instalado (sem release público automático)

### Cardápio web (`flowpdv-cardapio`)
- [x] V2 hospedado no domínio apex
- [x] URL `/burger-teste` + redirect da licença
- [x] Preserve `integracaoPdv` no publicar
- [x] Deploy produção Vercel

### Validado em smoke / ensaio
- [x] Pedido combo → PDV → pagamento → estorno (ensaio documentado)
- [x] Sync combos licença
- [x] Menu público V2 com escolha Individual/Combo no X-BURGER

---

## 4. Pendências conscientes

- TEF / impressora térmica / gaveta / balança / NF — depende de equipamento do cliente.
- Mais combos no estoque + republish consciente do catálogo V2 quando necessário.
- Renomear slug `burger-teste` → nome comercial (ex. `le-burgers-hamburgueria`).
- Selo “Combo” no painel legado (opcional; hoje só no V2/PDV).
- Release/instalador oficial novo **só se pedir**.
- Commit/push organizado do `flowpdv-cardapio` (deploy foi por CLI; working tree local pode ter mais alterações não relacionadas).
- Performance percebida de fechamento/estorno vs “instantâneo” antigo (mitigações parciais; servidor continua autoritativo).

---

## 5. URLs e IDs úteis

| Uso | Valor |
|-----|--------|
| Cardápio cliente (canonical) | https://flowpdv.app.br/burger-teste |
| Compat QR/licença | https://flowpdv.app.br/LIC-FLOW-937278 → redirect |
| Path V2 explícito | https://flowpdv.app.br/v2/burger-teste |
| Painel gestor | https://flowpdv.app.br/painel |
| Domínio antigo | cardapio.flowpdv.com.br (legado) |
| Licença | LIC-FLOW-937278 |
| Slug / catálogo V2 | burger-teste / `catalogos_publicos_v2/burger-teste` |
| Loja V2 | legado-lic-flow-937278 |
| Vercel projeto | mabiefestas/flowcardapio |

---

## 6. Arquivos / áreas de código mais tocados

### `flowpdv-sistema` / `adega-pdv-gestao`
- `firestore.rules` — cardápio + pedidos vs `legadoGravavel`
- `functions/*` — combos sync, ativação, pedidos públicos, Cloudinary
- `src/js/ofertas-*.js`, `estoque.js`, `storage.js`, CSS estoque
- `docs/INTEGRACAO-PDV-OFICIAL-20260923.md`, `ENSAIO-ATENDIMENTO-PREP-20260924.md`, planos de combos

### `flowpdv-cardapio`
- `.env.production` — flags V2
- `src/main.js` — rotas apex + redirect licença
- `src/lib/slug-publico.js` — validação slug + fallback BURGER
- `src/pages/cardapio-v2.js` — apex + `/v2`, sem banner “Ambiente de teste” em prod
- `src/lib/overlay.js` — preserve `integracaoPdv` no publicar
- `test/ambiente-v2.test.mjs`, `test/slug-publico.test.mjs`

---

## 7. Decisões de produto registradas

1. **Piloto só BURGER** — outras lojas não migrar nesta leva.
2. **Sem release** até pedido — patches locais/ASAR ok.
3. **Combos** liberados pelo módulo de licença (Master), não gambiarra só no terminal.
4. **URL cliente** = slug no apex apontando para **V2**; licença só compatibilidade.
5. **Estoque legado bloqueado** no corte; overlay do cardápio (foto/config) e status de pedido liberados de novo para o painel funcionar.

---

## 8. Como retomar depois

1. Relê este arquivo + `INTEGRACAO-PDV-OFICIAL-20260923.md` + `ENSAIO-ATENDIMENTO-PREP-20260924.md`.
2. Conferir se o PDV instalado ainda tem o ASAR com as últimas correções de estoque/combo (reiniciar o app após patch).
3. Cardápio: testar https://flowpdv.app.br/burger-teste e o redirect da licença.
4. Painel: login loja + salvar foto/config (regras já liberadas).
5. Próximos pedidos típicos: slug comercial, TEF com pinpad, release, selo Combo no painel legado.

---

*Documento gerado a partir do histórico da conversa Cursor (23–25/09/2026). Não substitui os docs técnicos de corte/ensaio; complementa com a narrativa do que foi pedido e entregue no chat.*
