// Preparação atômica no Firebase real. Não ativa recebimento nem publica catálogo.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { prepararPilotoAvulsos } = require('../functions/piloto-avulsos-core.cjs');
const { documentData } = require('../functions/migracao-loja-core.cjs');
const { encode } = require('./preparar-burger-v2.cjs');
const workspace = path.resolve(__dirname, '../..');
const folder = path.join(workspace, 'output/migracao-v2-20260923');
async function main() {
  const snapshot = JSON.parse(fs.readFileSync(path.join(folder, 'burger-origem-atual.json')));
  const plan = prepararPilotoAvulsos(snapshot, { pedidosSomenteHistorico: ['PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0'] });
  const proof = JSON.parse(fs.readFileSync(path.join(folder, 'ensaio-avulsos-recibo.json')));
  const tested = JSON.parse(fs.readFileSync(path.join(folder, 'burger-piloto-avulsos-validado.json')));
  // Um backup periódico pode mudar apenas a versão/data da origem. Todos os dados
  // operacionais precisam continuar idênticos ao plano efetivamente ensaiado.
  const content = p => ({ lojaId: p.lojaId, chave: p.chave, slug: p.slug, decisoes: p.decisoes,
    catalogo: p.catalogo, fichas: p.fichas, mapeamentos: p.mapeamentos, saldos: p.saldos, resumo: p.resumo });
  if (proof.planoHash !== tested.hash || !isDeepStrictEqual(content(plan), content(tested))
    || proof.vendaBalcaoMista !== true || proof.estoqueBaixadoUmaVez !== true) throw new Error('Plano sem ensaio completo correspondente.');
  const lib = path.join(workspace, 'output/local-tools/node_modules/firebase-tools/lib');
  const auth = require(path.join(lib, 'auth.js'));
  const { requireAuth } = require(path.join(lib, 'requireAuth.js'));
  const { Client } = require(path.join(lib, 'apiv2.js'));
  const options = { project: 'aplicativo-pdv', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(workspace) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(options, account);
  await requireAuth(options);
  const rules = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
  const release = await rules.get('projects/aplicativo-pdv/releases/cloud.firestore');
  if (release.body.rulesetName !== 'projects/aplicativo-pdv/rulesets/88ab1d48-4825-4d7a-ad48-96197e19112c')
    throw new Error('Regras publicadas mudaram; revisar acesso antes de preparar dados.');
  const api = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
  async function get(p) {
    try { return (await api.get(prefix + p)).body; }
    catch (e) { if (e.status === 404 || e.context?.response?.statusCode === 404) return null; throw e; }
  }
  const base = `lojas_v2/${plan.lojaId}`;
  const shop = await get(base), catalog = await get(`catalogos_publicos_v2/${plan.slug}`);
  const state = shop && documentData(shop), priorCatalog = catalog && documentData(catalog);
  if (state?.chaveLicencaLegada !== plan.chave || state.ativacaoOperacionalV2?.estado !== 'suspensa'
    || state.modulos?.cardapio !== false || state.modulos?.retirada !== false
    || priorCatalog?.publicado !== false || priorCatalog?.pausado !== true) throw new Error('Loja ou catálogo fora do estado suspenso esperado.');
  const records = [
    ...plan.fichas.map(p => ({ path: `${base}/fichas_estoque/${p.produtoId}`, data: p.ficha })),
    ...plan.mapeamentos.map(p => ({ path: `${base}/migracoes_estoque/${createHash('sha256').update(p.produtoId).digest('hex')}`, data: p.registro })),
    ...plan.saldos.map(p => ({ path: `${base}/estoque/${p.produtoId}`, data: { nome: p.nome, unidade: p.unidade, saldoMili: p.saldoMili } })),
    { path: `${base}/preparacao_piloto/avulsos`, data: { schema: 1, hash: plan.hash, origemFingerprint: plan.origemFingerprint,
      capturadoEm: plan.capturadoEm, decisoes: plan.decisoes, resumo: plan.resumo, corteOperacional: false } }
  ];
  const writes = [{ verify: shop.name, currentDocument: { updateTime: shop.updateTime } }];
  const sourceDocs = [...Object.values(snapshot.snaps), ...Object.values(snapshot.lists).flat()];
  for (const d of sourceDocs) {
    if (!d.name.startsWith(prefix) || !d.updateTime) throw new Error('Origem inválida.');
    writes.push({ verify: d.name, currentDocument: { updateTime: d.updateTime } });
  }
  let reused = 0;
  for (let i = 0; i < records.length; i += 10) {
    const group = records.slice(i, i + 10), current = await Promise.all(group.map(r => get(r.path)));
    group.forEach((r, index) => {
      const old = current[index];
      if (old) {
        if (!isDeepStrictEqual(documentData(old), r.data)) throw new Error('Destino divergente; nenhum saldo será sobrescrito: ' + r.path);
        reused++; writes.push({ verify: old.name, currentDocument: { updateTime: old.updateTime } });
      } else writes.push({ update: { name: prefix + r.path, fields: encode(r.data).mapValue.fields }, currentDocument: { exists: false } });
    });
  }
  if (reused && reused !== records.length) throw new Error('Preparação parcial; conferir antes de prosseguir.');
  writes.push({ update: { name: catalog.name, fields: encode(plan.catalogo).mapValue.fields }, currentDocument: { updateTime: catalog.updateTime } });
  if (writes.length > 450) throw new Error('Lote excede limite da preparação.');
  const applying = process.argv.includes('--aplicar');
  console.log(JSON.stringify({ modo: applying ? 'preparar_suspenso' : 'simular', documentosPreparados: records.length, reutilizados: reused,
    origensProtegidas: sourceDocs.length, corteOperacional: false }));
  if (!applying) return;
  const result = await api.post(prefix.slice(0, -1) + ':commit', { writes });
  const finalShop = documentData(await get(base)), finalCatalog = documentData(await get(`catalogos_publicos_v2/${plan.slug}`));
  if (finalShop.ativacaoOperacionalV2.estado !== 'suspensa' || finalCatalog.publicado !== false || finalCatalog.pausado !== true)
    throw new Error('Estado final exige conferência.');
  const receipt = { commitTime: result.body.commitTime, planoHash: plan.hash, planoEnsaiadoHash: tested.hash, documentosPreparados: records.length,
    ...plan.resumo, operacaoSuspensa: true, catalogoPublicado: false, corteOperacional: false };
  fs.writeFileSync(path.join(folder, 'preparacao-avulsos-remota.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error('Preparação interrompida: ' + (e.message || e.code).slice(0, 220)); process.exitCode = 1; });
