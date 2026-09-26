const {spawnSync}=require('node:child_process'),path=require('node:path');
const r=spawnSync(require('electron'),[path.join(__dirname,'electron-isolation.smoke.cjs')],{stdio:'inherit',timeout:60000,env:{...process.env,FLOWPDV_FULL_APP_TEST:'1',FLOWPDV_OPERATIONAL_TEST:'1',FLOWPDV_VISIBLE_TEST:'0',FLOWPDV_PAIRING_UI_TEST:'0',FLOWPDV_INSTALL_UI_TEST:'0'}});
if(r.error)throw r.error;process.exitCode=r.status===0?0:1;
