const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
assert.equal(process.env.GCLOUD_PROJECT,'demo-flowpdv');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
for(const file of ['run-cardapio-v2.cjs','run-pairing-ui.cjs']){
 const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',windowsHide:true,timeout:480000,env:{...process.env,FLOWPDV_VISIBLE_TEST:'0'}});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
