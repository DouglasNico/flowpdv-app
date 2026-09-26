const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');
assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');
// Executa primeiro as transições concorrentes, depois o formulário real, na mesma base descartável.
for(const args of [
 ['--test','--test-name-pattern=^(cancelamento concorrente devolve|cancelar antes da baixa|cancelamento disputando|cancelamento exige autorização|cancelar disputando|estoque inconsistente)','test/fechamento-v2.test.cjs'],
 ['test/run-pairing-ui.cjs']
]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,FLOWPDV_VISIBLE_TEST:'0'},timeout:600000});
 if(result.error)throw result.error;
 if(result.status!==0){process.exitCode=1;break;}
}
