const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(dados=new Map()){
  const ctx={console,window:{},sessionStorage:{getItem:()=>JSON.stringify({nome:'Operador original'})},localStorage:{getItem:k=>dados.get(k)??null,setItem:(k,v)=>dados.set(k,String(v)),removeItem:k=>dados.delete(k)}};
  for(const name of ['storage','audit'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/js',name+'.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export const ','var '),ctx);
  const storage=ctx.StorageService,audit=ctx.AuditModule;ctx.window.AuditModule=audit;
  storage.getLicenca=()=>({chaveLicenca:'TESTE'});storage.getProdutos=storage.getMovimentosEstoque=()=>[];storage.getDeviceId=()=> 'T1';
  const descarregar=audit.descarregarPendentes.bind(audit);audit.descarregarPendentes=()=>{};
  return {ctx,dados,storage,audit,descarregar};
}
const venda={id:'V1',total:12,itens:[],formaPagamento:'Pix'};
test('interrupção em cada escrita recupera venda e log únicos com operador original',()=>{
  for(const falha of ['adega_vendas','adega_produtos','adega_produtos_backup_seguranca','flowpdv_estoque_movimentos','flowpdv_logs_auditoria_TESTE','flowpdv_logs_nuvem_pendentes_TESTE','remover-diario']){
    const f=fixture(),set=f.ctx.localStorage.setItem,remove=f.ctx.localStorage.removeItem;
    f.ctx.localStorage.setItem=(k,v)=>{if(k===falha)throw Error('Interrupção');set(k,v);};
    f.ctx.localStorage.removeItem=k=>{if(falha==='remover-diario'&&k==='flowpdv_commit_venda')throw Error('Interrupção');remove(k);};
    assert.throws(()=>f.storage.saveVenda(venda),/Interrupção/);assert.ok(f.dados.has('flowpdv_commit_venda'));
    const reinicio=fixture(f.dados);reinicio.ctx.sessionStorage.getItem=()=>JSON.stringify({nome:'Outro operador'});
    reinicio.storage.recuperarVendaPendente();reinicio.storage.saveVenda(venda);
    assert.equal(reinicio.storage.getVendas().length,1);
    const logs=reinicio.audit.getLocalLogs(),pendentes=reinicio.audit.getPendentes();
    assert.equal(logs.length,1);assert.equal(pendentes.length,1);assert.equal(logs[0].id,pendentes[0].id);
    assert.equal(logs[0].operador,'Operador original');assert.equal(logs[0].detalhes.vendaId,'V1');assert.ok(!f.dados.has('flowpdv_commit_venda'));
  }
});
test('falha ao preparar diário não grava venda nem anuncia log',()=>{
  const f=fixture();f.ctx.localStorage.setItem=()=>{throw Error('Disco cheio');};
  assert.throws(()=>f.storage.saveVenda(venda),/Disco cheio/);assert.equal(f.storage.getVendas().length,0);assert.equal(f.audit.getLocalLogs().length,0);
});
test('recuperação rejeita chave de auditoria pertencente a outra loja',()=>{
  const f=fixture();f.dados.set('flowpdv_commit_venda',JSON.stringify({loja:'TESTE',escritas:{flowpdv_logs_auditoria_OUTRA:'[]'}}));
  assert.throws(()=>f.storage.recuperarVendaPendente(),/inválido/);assert.ok(!f.dados.has('flowpdv_logs_auditoria_OUTRA'));
});
test('log criado durante envio fica pendente; troca de loja não limpa fila alheia',async()=>{
  for(const trocarLoja of [false,true]){
    const f=fixture();let destravar,iniciou;
    const enviando=new Promise(r=>iniciou=r);
    Object.assign(f.ctx,{db:{},garantirSessaoLoja:async()=>true,doc:()=>({}),collection:()=>({}),addDoc:async()=>{},setDoc:()=>{iniciou();return new Promise(r=>destravar=r);}});
    f.audit.lerExclusaoNuvem=async()=>null;f.audit.exclusaoNuvemConfirmada=true;f.audit.purgarPendentesExcluidos=()=>{};
    f.audit.enfileirarPendente({id:'primeiro',chaveLicenca:'TESTE'});
    const envio=f.descarregar();await enviando;
    if(trocarLoja)f.storage.getLicenca=()=>({chaveLicenca:'OUTRA'});
    f.audit.enfileirarPendente({id:'novo',chaveLicenca:trocarLoja?'OUTRA':'TESTE'});
    destravar();await envio;
    assert.equal(f.audit.getPendentes().length,1);assert.equal(f.audit.getPendentes()[0].id,'novo');
    if(trocarLoja)assert.equal(JSON.parse(f.dados.get('flowpdv_logs_nuvem_pendentes_TESTE'))[0].id,'primeiro');
  }
});
