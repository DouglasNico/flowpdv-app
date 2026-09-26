// Executar da raiz flowpdv-sistema. Não altera claims globais nem ativa a loja.
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { encode } = require('./preparar-burger-v2.cjs');
const { documentData } = require('../functions/migracao-loja-core.cjs');
async function main() {
  const lib = path.resolve('output/local-tools/node_modules/firebase-tools/lib');
  const auth = require(path.join(lib, 'auth.js')), { requireAuth } = require(path.join(lib, 'requireAuth.js')), { Client } = require(path.join(lib, 'apiv2.js'));
  const options = { project: 'aplicativo-pdv', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(process.cwd()) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(options, account);
  await requireAuth(options);
  const identity = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', apiVersion: 'v1' });
  const response = await identity.post('projects/aplicativo-pdv/accounts:lookup', { email: ['dougnvds26@gmail.com'] });
  const user = response.body.users?.[0];
  if (!user || user.disabled || user.email !== 'dougnvds26@gmail.com' || user.localId !== 'hbZxm0eydmelYGv1WUGEfpMm73I3') throw new Error('Conta mudou ou está indisponível.');
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
  const base = 'lojas_v2/legado-lic-flow-937278';
  const shop = (await client.get(prefix + base)).body, data = documentData(shop);
  if (data.ativo !== false || data.ativacaoOperacionalV2?.estado !== 'suspensa' || data.chaveLicencaLegada !== 'LIC-FLOW-937278') throw new Error('Loja saiu do estado preparatório; conferir antes de alterar o vínculo.');
  const memberPath = `${base}/membros/${user.localId}`;
  let previous;
  try { previous = (await client.get(prefix + memberPath)).body; }
  catch (e) { if (e.status !== 404 && e.context?.response?.statusCode !== 404) throw e; }
  const member = { papel: 'gerente', tipo: 'usuario', ativo: user.emailVerified === true, origem: 'migracao-burger-20260923', aguardandoVerificacaoEmail: user.emailVerified !== true };
  if (previous) {
    const p = documentData(previous);
    if (p.origem !== member.origem || p.papel !== member.papel || p.tipo !== member.tipo) throw new Error('Vínculo preexistente exige revisão.');
    if (p.ativo === member.ativo && p.aguardandoVerificacaoEmail === member.aguardandoVerificacaoEmail) { console.log(JSON.stringify({ reutilizado: true, ativo: p.ativo, lojaAtivada: false })); return; }
  }
  const audit = { acao: 'gerente_migracao_preparado', lojaId: base.split('/')[1], alvoUid: user.localId, ativo: member.ativo, origem: member.origem, em: new Date().toISOString() };
  const result = await client.post(prefix.slice(0, -1) + ':commit', { writes: [
    { verify: shop.name, currentDocument: { updateTime: shop.updateTime } },
    { update: { name: prefix + memberPath, fields: encode(member).mapValue.fields }, currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false } },
    { update: { name: prefix + 'auditoria_acesso_v2/' + randomUUID(), fields: encode(audit).mapValue.fields }, currentDocument: { exists: false } }
  ] });
  const read = documentData((await client.get(prefix + memberPath)).body);
  if (read.ativo !== member.ativo || read.papel !== 'gerente' || read.tipo !== 'usuario') throw new Error('Conferência do vínculo falhou.');
  const receipt = { ...audit, commitTime: result.body.commitTime, emailVerificado: user.emailVerified === true, lojaAtivada: false };
  fs.writeFileSync('output/migracao-v2-20260923/gerente-vinculo-recibo.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error('Vínculo interrompido: ' + (e.status || e.code || e.message?.slice(0, 160))); process.exitCode = 1; });
