# Ensaio Atendimento + prep Combos/TEF — BURGER TESTE

Data: 24/09/2026. Loja `legado-lic-flow-937278` / `LIC-FLOW-937278`. Sem release, sem ligar Combos/mesas, sem pinpad.

## Atendimento (instalado)

1. Turno local/servidor fechado antes da troca.
2. Troca de função no servidor exige `ativacaoOperacionalV2.estado === suspensa` ([`vinculo-licenca-v2.js`](../functions/vinculo-licenca-v2.js)). Suspensão temporária só na BURGER; reabilitada ao final.
3. Terminal oficial `fyFJuGJCcrgkVFkiQiFnSpuUlph1`: local + conexão cardápio passaram a **Atendimento**, depois voltaram a **Caixa**.
4. Operador não-gerente `teste`: `pdv-atendimento-ativo` e `operadorEmAtendimento() === true`. Admin não ativa essa UI (esperado).
5. Após restauração: `tipoTerminal=caixa`, status `Conectado · Caixa`, `FlowCaixaOficial` presente, `emAtendimento=false`. Conferência remota: terminal ativo com `papel: caixa`; ativação `habilitada`.

## Combos (ensaio BURGER — 24/09/2026)

- Licença + loja V2: `modulos.combos: true` só na BURGER (`LIC-FLOW-937278` / `legado-lic-flow-937278`).
- Oferta publicada no catálogo `burger-teste`: X-BURGER combo R$ 32,90 com bebidas Coca e Suco (batata inativa omitida).
- Smoke: pedido público `98ddaddd-2bca-401a-96c2-0901630e6327` → `receberPedidoPdvV2` → fechar conta dinheiro R$ 32,90 → estorno com reposição. UI mostrou linha “Combo — incluso… Coca-Cola”.
- Sync PDV: `LicencaModule.sincronizarComNuvem()` restaura `isModuloAtivo('combos')` a partir de `licencas` **sem** `setModulosLicenca` manual (provado limpando o flag local).
- Gap fechado no código: Master passa a espelhar `modulos.combos` em `lojas_v2` (campo pontual); trigger/callable `sincronizarCombosLicencaV2` / `espelharCombosLicencaV2`; `consultarAtivacaoOperacionalV2` agora inclui `modulos.combos`.
- Scripts locais: `scripts/tmp-burger-ativar-combos.cjs`, `tmp-smoke-pedido-combo.cjs`, `tmp-smoke-receber-pagar-combo.cjs`. Sem release.

## TEF / impressora (sem equipamento)

- No PDV instalado: módulo `tefCartao` licenciado (`isModuloAtivo` true), mas `tefConfig.habilitado === false` e `TefModule.tefAtivo() === false`. Checkout manual permanece o caminho ativo.
- Config de papel `impressoraPadrao: 58mm`. Listagem de impressoras Windows não foi exposta pela API chamada neste ensaio; sem homologação física.
- Não foi ligado TEF na BURGER nem simulado sucesso de pinpad.
