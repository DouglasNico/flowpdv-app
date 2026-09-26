const {spawnSync}=require('node:child_process');
for(const args of [['--test','--test-concurrency=1','test/configuracao-v2.test.cjs','test/cozinha-v2.test.cjs'],['test/run-pairing-ui.cjs']]){
  const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env,timeout:480000});
  if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
}
