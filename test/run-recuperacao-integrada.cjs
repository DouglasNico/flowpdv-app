const {spawnSync}=require('node:child_process');
for(const arquivo of ['test/run-venda-aplicativo-completo.cjs','test/run-conferencia-recuperacao.cjs']){
  const result=spawnSync(process.execPath,[arquivo],{stdio:'inherit',env:process.env,timeout:360000});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
