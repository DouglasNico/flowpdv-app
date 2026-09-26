// Preparação administrativa, sem ativar loja, publicar catálogo ou movimentar estoque.
// Executar da raiz flowpdv-sistema. Sem --aplicar, apenas simula.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { prepararMigracaoLoja, documentData } = require('../functions/migracao-loja-core.cjs');
const project = 'aplicativo-pdv';
const prefix = `projects/${project}/databases/(default)/documents/`;
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && Object.getPrototypeOf(value) === Object.prototype) return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
  throw new Error('Valor não serializável; preparação interrompida.');
}
function writesFor(plan) {
  if (plan.resumo.chave !== 'LIC-FLOW-937278' || plan.resumo.corteOperacional !== false) throw new Error('Escopo não autorizado.');
  const sources = plan.sourceDocs.map(d => {
    if (!d.name.startsWith(prefix) || !d.updateTime) throw new Error('Origem ou versão inválida.');
    return { verify: d.name, currentDocument: { updateTime: d.updateTime } };
  });
  return [...sources, ...plan.docs.map(d => ({ update: { name: prefix + d.path, fields: encode(d.data).mapValue.fields }, currentDocument: { exists: false } }))];
}
async function main() {
  const folder = path.resolve('output/migracao-v2-20260923');
  const snapshot = JSON.parse(fs.readFileSync(path.join(folder, 'burger-origem.json')));
  const plan = prepararMigracaoLoja(snapshot, { slug: 'burger-teste' });
  const writes = writesFor(plan);
  if (Buffer.byteLength(JSON.stringify({ writes })) > 9000000) throw new Error('Lote excede tamanho seguro.');
  console.log(JSON.stringify({ modo: process.argv.includes('--aplicar') ? 'preparar' : 'simular', documentos: plan.docs.length, origensVerificadas: plan.sourceDocs.length, ...plan.resumo }));
  if (!process.argv.includes('--aplicar')) return;
  const lib = path.resolve('output/local-tools/node_modules/firebase-tools/lib');
  const auth = require(path.join(lib, 'auth.js'));
  const { requireAuth } = require(path.join(lib, 'requireAuth.js'));
  const { Client } = require(path.join(lib, 'apiv2.js'));
  const opts = { project, nonInteractive: true };
  const account = auth.getProjectDefaultAccount(process.cwd()) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(opts, account);
  await requireAuth(opts);
  // A regra publicada foi revisada: estas coleções não têm acesso de cliente.
  // Qualquer mudança exige nova revisão; não confiar só no arquivo local.
  const rules = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
  const release = await rules.get(`projects/${project}/releases/cloud.firestore`);
  if (release.body.rulesetName !== `projects/${project}/rulesets/88ab1d48-4825-4d7a-ad48-96197e19112c`) throw new Error('Regras publicadas mudaram; revisar acesso antes de preparar dados.');
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  async function get(relative) {
    try { return (await client.get(prefix + relative)).body; }
    catch (e) { if (e.status === 404 || e.context?.response?.statusCode === 404) return null; throw e; }
  }
  let existing = 0;
  for (const doc of plan.docs) {
    const current = await get(doc.path);
    if (!current) continue;
    if (!isDeepStrictEqual(documentData(current), doc.data)) throw new Error('Destino já existe com conteúdo diferente: ' + doc.path);
    existing++;
  }
  if (existing && existing !== plan.docs.length) throw new Error('Destino parcial: exige conferência; nenhum documento foi sobrescrito.');
  let commitTime = null;
  if (!existing) {
    const result = await client.post(prefix.slice(0, -1) + ':commit', { writes });
    commitTime = result.body.commitTime;
  }
  for (const doc of plan.docs) {
    const current = await get(doc.path);
    if (!current || !isDeepStrictEqual(documentData(current), doc.data)) throw new Error('Conferência do destino falhou: ' + doc.path);
  }
  const changedSources = [];
  for (const doc of plan.sourceDocs) {
    const current = await get(doc.name.slice(prefix.length));
    if (!current || current.updateTime !== doc.updateTime) changedSources.push(doc.name.slice(prefix.length));
  }
  const receipt = { ...plan.resumo, verificadoEm: new Date().toISOString(), commitTime, documentosVerificados: plan.docs.length, reutilizado: !!existing, origensAlteradasDesdeCaptura: changedSources, hashDestino: createHash('sha256').update(JSON.stringify(plan.docs)).digest('hex'), caminhos: plan.docs.map(d => d.path) };
  fs.writeFileSync(path.join(folder, 'burger-recibo.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ resultado: 'copia_pausada_conferida', documentos: plan.docs.length, commitTime, reutilizado: !!existing, origensAlteradas: changedSources.length, corteOperacional: false }));
}
if (require.main === module) main().catch(e => { console.error('Preparação interrompida: ' + (e.status || e.code || e.message?.slice(0, 220))); process.exitCode = 1; });
module.exports = { encode, writesFor };
