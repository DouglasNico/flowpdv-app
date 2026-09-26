// Corte restrito à BURGER TESTE, com duas fases e precondições de versão.
const fs=require('node:fs'),path=require('node:path'),{isDeepStrictEqual}=require('node:util');
const {documentData}=require('../functions/migracao-loja-core.cjs'),{encode}=require('./preparar-burger-v2.cjs');
const workspace=path.resolve(__dirname,'../..'),folder=path.join(workspace,'output/migracao-v2-20260923');
async function main(){
  const mode=process.argv.includes('--aposentar-piloto')?'aposentar_piloto':process.argv.includes('--preparar')?'preparar':process.argv.includes('--ativar')?'ativar':'conferir';
  const lib=path.join(workspace,'output/local-tools/node_modules/firebase-tools/lib'),auth=require(path.join(lib,'auth.js'));
  const options={project:'aplicativo-pdv',nonInteractive:true},account=auth.getProjectDefaultAccount(workspace)||auth.getGlobalDefaultAccount();
  if(account)auth.setActiveAccount(options,account);await require(path.join(lib,'requireAuth.js')).requireAuth(options);
  const {Client}=require(path.join(lib,'apiv2.js')),api=new Client({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'});
  const prefix='projects/aplicativo-pdv/databases/(default)/documents/',base='lojas_v2/legado-lic-flow-937278',chave='LIC-FLOW-937278';
  const get=async p=>(await api.get(prefix+p)).body;
  const [shopDoc,publicDoc,v2Doc]=await Promise.all([get(base),get('cardapio_publico/'+chave),get('catalogos_publicos_v2/burger-teste')]);
  const shop=documentData(shopDoc),publico=documentData(publicDoc),v2=documentData(v2Doc);
  if(shop.chaveLicencaLegada!==chave)throw Error('Loja incompatível.');
  if(mode==='conferir'){const query=await api.post('projects/aplicativo-pdv/databases/(default)/documents:runQuery',{structuredQuery:{from:[{collectionId:'terminais_v2'}],where:{fieldFilter:{field:{fieldPath:'lojaId'},op:'EQUAL',value:{stringValue:'legado-lic-flow-937278'}}}}});console.log(JSON.stringify({terminais:query.body.filter(r=>r.document).map(r=>{const t=documentData(r.document);return {uid:r.document.name.split('/').pop(),ativo:t.ativo,papel:t.papel,licenciado:t.chaveLicenca===chave,aderiu:t.adesaoOperacionalV2?.confirmada===true};}),estado:shop.corteOperacionalV2?.estado||'nao_iniciado',ativacao:shop.ativacaoOperacionalV2?.estado,publicoPausado:publico.pausado,v2Pausado:v2.pausado}));return;}
  const writes=[],verify=d=>writes.push({verify:d.name,currentDocument:{updateTime:d.updateTime}});
  const update=(d,fields)=>writes.push({update:{name:d.name,fields:encode(fields).mapValue.fields},updateMask:{fieldPaths:Object.keys(fields)},currentDocument:{updateTime:d.updateTime}});
  if(mode==='aposentar_piloto'){
    if(shop.corteOperacionalV2?.estado!=='aguardando_pdv')throw Error('Fora do corte em preparação.');
    const uid='HdPRbUveCld3Z0BiHHrop0nAPFD3';
    const [terminal,member]=await Promise.all([get('terminais_v2/'+uid),get(base+'/membros/'+uid)]),t=documentData(terminal),m=documentData(member);
    if(t.lojaId!=='legado-lic-flow-937278'||t.chaveLicenca||m.tipo!=='terminal')throw Error('Não é o terminal técnico esperado.');
    verify(shopDoc);const fields={ativo:false,motivoDesativacao:'Substituído pelo PDV oficial na migração autorizada',desativadoEm:new Date().toISOString()};update(terminal,fields);update(member,fields);
  } else if(mode==='preparar'){

    if(!process.argv.includes('--caixa-fechado'))throw Error('Exige confirmação do caixa fechado.');
    if(shop.corteOperacionalV2||shop.ativacaoOperacionalV2?.estado!=='suspensa'||v2.publicado!==false)throw Error('Estado fora da preparação inicial.');
    const snapshot=JSON.parse(fs.readFileSync(path.join(folder,'burger-origem-atual.json')));
    const plan=require('../functions/piloto-avulsos-core.cjs').prepararPilotoAvulsos(snapshot,{pedidosSomenteHistorico:['PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0']});
    const tested=JSON.parse(fs.readFileSync(path.join(folder,'burger-piloto-avulsos-validado.json')));
    const content=p=>({catalogo:p.catalogo,fichas:p.fichas,mapeamentos:p.mapeamentos,saldos:p.saldos,resumo:p.resumo});
    if(!isDeepStrictEqual(content(plan),content(tested)))throw Error('Dados mudaram desde o ensaio; corte interrompido.');
    for(const p of plan.saldos){const d=await get(`${base}/estoque/${p.produtoId}`),s=documentData(d);if(s.saldoMili!==p.saldoMili||s.unidade!==p.unidade)throw Error('Saldo remoto divergente.');verify(d);}
    for(const d of [...Object.values(snapshot.snaps),...Object.values(snapshot.lists).flat()])if(d.name!==publicDoc.name)verify(d);
    const sourcePublic=snapshot.snaps['cardapio_publico/'+chave];if(sourcePublic.updateTime!==publicDoc.updateTime)throw Error('Catálogo mudou depois da captura.');
    verify(v2Doc);
    update(publicDoc,{pausado:true,integracaoPdv:{schema:1,motor:'v2',slug:'burger-teste',catalogoVersao:v2.versao},produtos:publico.produtos.map(p=>({...p,grupos:[],combo:{ativo:false}}))});
    update(shopDoc,{corteOperacionalV2:{schema:1,estado:'aguardando_pdv',legadoBloqueado:true,rotaPublicaV2:true,origemFingerprint:plan.origemFingerprint,preparadoEm:new Date().toISOString()}});
  } else {
    if(shop.corteOperacionalV2?.estado!=='aguardando_pdv'||publico.integracaoPdv?.motor!=='v2'||publico.pausado!==true)throw Error('Prepare o corte antes de ativar.');
    const response=await api.post('projects/aplicativo-pdv/databases/(default)/documents:runQuery',{structuredQuery:{from:[{collectionId:'terminais_v2'}],where:{fieldFilter:{field:{fieldPath:'lojaId'},op:'EQUAL',value:{stringValue:'legado-lic-flow-937278'}}}}});
    const terminals=response.body.filter(r=>r.document).map(r=>r.document),cashiers=terminals.filter(d=>{const t=documentData(d);return t.ativo&&t.papel==='caixa';});
    if(!cashiers.length||cashiers.some(d=>{const t=documentData(d);return t.chaveLicenca!==chave||t.adesaoOperacionalV2?.confirmada!==true||t.adesaoOperacionalV2?.deviceId!==t.deviceId||t.adesaoOperacionalV2?.revisao!==shop.ativacaoOperacionalV2.revisao;}))throw Error('Aguardando confirmação de adesão de todos os caixas ativos. Não ativado.');
    cashiers.forEach(verify);
    update(shopDoc,{corteOperacionalV2:{...shop.corteOperacionalV2,estado:'concluido',ativadoEm:new Date().toISOString()},ativacaoOperacionalV2:{...shop.ativacaoOperacionalV2,estado:'habilitada'},modulos:{...shop.modulos,balcao:true,cardapio:true,retirada:true,mesas:false,combos:false},caixaV2:{exigirTurno:true}});
    update(publicDoc,{pausado:false});update(v2Doc,{publicado:true,pausado:false});
  }
  if(writes.length>450)throw Error('Lote excedido.');
  const result=await api.post('projects/aplicativo-pdv/databases/(default)/documents:commit',{writes});
  fs.writeFileSync(path.join(folder,`corte-oficial-${mode}-recibo.json`),JSON.stringify({modo:mode,commitTime:result.body.commitTime,escritas:writes.length},null,2));
  console.log(JSON.stringify({modo:mode,commitTime:result.body.commitTime,estado:mode==='ativar'?'concluido':'aguardando_pdv'}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
