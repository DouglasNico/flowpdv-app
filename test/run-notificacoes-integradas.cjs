const { spawnSync } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env, FLOWPDV_FULL_APP_TEST: '1', FLOWPDV_OPERATIONAL_TEST: '1', FLOWPDV_VISIBLE_TEST: '0', FLOWPDV_PAIRING_UI_TEST: '0', FLOWPDV_INSTALL_UI_TEST: '0', FLOWPDV_NATIVE_SALE_TEST: '0', FLOWPDV_NOTIFICATIONS_TEST: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(require('electron'), [path.join(__dirname, 'electron-isolation.smoke.cjs')], { env, stdio: 'inherit', timeout: 60000 });
if (r.error) throw r.error;
process.exitCode = r.status === 0 ? 0 : 1;
