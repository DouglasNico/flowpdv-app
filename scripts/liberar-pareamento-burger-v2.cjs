// Libera somente o cadastro para pareamento. Não habilita operação nem publicação.
const path = require('node:path'), fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { encode } = require('./preparar-burger-v2.cjs');
const { documentData } = require('../functions/migracao-loja-core.cjs');
(async () => {
  const lib = path.resolve('output/local-tools/node_modules/firebase-tools/lib');
  const auth = require(path.join(lib, 'auth.js')), { requireAuth } = require(path.join(lib, 'requireAuth.js')), { Client } = require(path.join(lib, 'apiv2.js'));
  const opts = { project: 'aplicativo-pdv', nonInteractive: true };
  const account = auth.getProjectDefaultAccount(process.cwd()) || auth.getGlobalDefaultAccount();
  if (account) auth.setActiveAccount(opts, account);
  await requireAuth(opts);
  const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const prefix = 'projects/aplicativo-pdv/databases/(default)/documents/';
  const base = 'lojas_v2/legado-lic-flow-937278';
  const paths = [base, `${base}/membros/hbZxm0eydmelYGv1WUGEfpMm73I3`, 'catalogos_publicos_v2/burger-teste'];
  const docs = await Promise.all(paths.map(async p => (await client.get(prefix + p)).body));
  const [shop, member, catalog] = docs.map(documentData);
  if (shop.chaveLicencaLegada !== 'LIC-FLOW-937278' || shop.migracao?.estado !== 'preparada'
    || shop.ativacaoOperacionalV2?.estado !== 'suspensa' || shop.modulos?.cardapio !== false
    || shop.modulos?.mesas !== false || shop.modulos?.retirada !== false
    || member.ativo !== true || member.tipo !== 'usuario' || member.papel !== 'gerente'
    || catalog.publicado !== false || catalog.pausado !== true) throw new Error('Pré-condições da cópia pausada não atendidas.');
  if (shop.ativo === true && shop.migracao.acessoAdministrativo === true) { console.log('Pareamento já liberado; operação continua suspensa.'); return; }
  if (shop.ativo !== false) throw new Error('Estado administrativo inesperado.');
  const data = { ativo: true, migracao: { ...shop.migracao, acessoAdministrativo: true } };
  const audit = { acao: 'cadastro_liberado_para_pareamento', lojaId: base.split('/')[1], operacaoHabilitada: false, em: new Date().toISOString() };
  const r = await client.post(prefix.slice(0, -1) + ':commit', { writes: [
    ...docs.slice(1).map(d => ({ verify: d.name, currentDocument: { updateTime: d.updateTime } })),
    { update: { name: docs[0].name, fields: encode(data).mapValue.fields }, updateMask: { fieldPaths: ['ativo', 'migracao'] }, currentDocument: { updateTime: docs[0].updateTime } },
    { update: { name: prefix + 'auditoria_acesso_v2/' + randomUUID(), fields: encode(audit).mapValue.fields }, currentDocument: { exists: false } }
  ] });
  const result = documentData((await client.get(prefix + base)).body);
  if (result.ativo !== true || result.ativacaoOperacionalV2.estado !== 'suspensa' || result.modulos.cardapio !== false) throw new Error('Conferência administrativa falhou.');
  const receipt = { ...audit, commitTime: r.body.commitTime, cadastroAtivo: true };
  fs.writeFileSync('output/migracao-v2-20260923/liberacao-pareamento-recibo.json', JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
})().catch(e => { console.error(e.status || e.code || e.message?.slice(0, 160)); process.exitCode = 1; });
