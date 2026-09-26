const { test }=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
  const avisos=[],aplicados=[];
  const ctx={window:{App:{showToast:(...a)=>avisos.push(a)}},console:{warn(){},error(){}}};
  const source=fs.readFileSync(path.join(__dirname,'../src/js/cloud-sync.js'),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?$/gm,'').replace('export const ','var ');
  vm.runInNewContext(source,ctx);
  const sync=ctx.CloudSyncModule;
  sync.getChaveLicenca=()=> 'LOJA-A';
  sync.pacotePertenceALicenca=p=>p.chaveLicenca==='LOJA-A';
  sync.carregarBaseCompletaNovaEmpresa=p=>aplicados.push(p);
  return {sync,avisos,aplicados};
}
test('licença ausente e base inexistente têm retorno explícito',async()=>{
  const f=fixture();f.sync.getChaveLicenca=()=>'';
  await f.sync.forcarBaixarBaseNuvem();assert.equal(f.avisos[0][1],'warning');
  f.sync.getChaveLicenca=()=> 'LOJA-A';f.sync.lerPacote=async()=>null;
  await f.sync.forcarBaixarBaseNuvem();assert.equal(f.avisos[1][1],'info');assert.equal(f.aplicados.length,0);
});
test('falha de rede ou de aplicação não anuncia sucesso',async()=>{
  for(const aplicar of [false,true]){
    const f=fixture();f.sync.lerPacote=async()=>{if(!aplicar)throw Error('offline');return {chaveLicenca:'LOJA-A'};};
    f.sync.carregarBaseCompletaNovaEmpresa=()=>{throw Error('recuperação pendente');};
    await f.sync.forcarBaixarBaseNuvem();assert.equal(f.avisos.length,1);assert.equal(f.avisos[0][1],'warning');assert.equal(f.avisos[0][2].duracao,0);
  }
});
test('base de outra loja ou troca de loja durante consulta não é aplicada',async()=>{
  for(const troca of [true,false]){
    const f=fixture();f.sync.lerPacote=async()=>{if(troca)f.sync.getChaveLicenca=()=> 'LOJA-B';return {chaveLicenca:troca?'LOJA-A':'LOJA-B'};};
    await f.sync.forcarBaixarBaseNuvem();assert.equal(f.aplicados.length,0);assert.equal(f.avisos[0][1],'warning');
  }
});
test('sucesso só é mostrado após aplicar o pacote da loja atual',async()=>{
  const f=fixture();f.sync.lerPacote=async()=>({chaveLicenca:'LOJA-A',produtos:[{},{}]});
  await f.sync.forcarBaixarBaseNuvem();assert.equal(f.aplicados.length,1);assert.equal(f.avisos[0][1],'success');assert.match(f.avisos[0][0],/2 produto/);
});
