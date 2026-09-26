const path = require('node:path');
function runtimeProfile({ isPackaged, argv, appData }) {
  const hosted = argv.includes('--flowpdv-piloto-v2');
  if (hosted && argv.some(arg => arg === '--flowpdv-homologacao' || arg.startsWith('--flowpdv-test') || arg === '--flowpdv-app-completo')) throw new Error('O piloto hospedado não pode ser combinado com perfis locais.');
  const operational = hosted || argv.includes('--flowpdv-homologacao');
  const fullApp = argv.includes('--flowpdv-app-completo');
  if (fullApp && !operational) throw new Error('O aplicativo completo de ensaio exige homologação operacional.');
  const test = argv.includes('--flowpdv-test') || operational;
  if (operational && argv.includes('--flowpdv-test')) throw new Error('Escolha laboratório ou homologação operacional, não os dois.');
  if (test && isPackaged) throw new Error('O perfil de teste só pode ser usado em desenvolvimento.');
  const named = argv.filter(arg => arg.startsWith('--flowpdv-test-profile'));
  if (named.length && (!test || named.length !== 1 || !/^--flowpdv-test-profile=[a-z0-9][a-z0-9-]{0,31}$/.test(named[0])))
    throw new Error('Informe um único nome de perfil de teste, em desenvolvimento, com até 32 letras minúsculas, números ou hífens.');
  const nome = named.length ? named[0].split('=')[1] : null;
  return Object.freeze({ test, hosted, operational, fullApp, testName: nome, userData: path.join(appData, hosted ? 'flowpdv-piloto-v2' : test ? `${operational ? (fullApp ? 'flowpdv-app-homologacao' : 'flowpdv-homologacao') : 'flowpdv-test'}${nome ? '-' + nome : ''}` : 'flowpdv') });
}
function testUrlAllowed(value) {
  try {
    const url = new URL(value);
    if (['file:', 'data:', 'blob:', 'devtools:'].includes(url.protocol)) return true;
    return url.protocol === 'http:' && url.hostname === '127.0.0.1'
      && ['9099', '8080', '5001'].includes(url.port) && !url.username && !url.password;
  } catch { return false; }
}
function hostedUrlAllowed(value) {
  try {
    const url = new URL(value);
    if (['file:', 'data:', 'blob:', 'devtools:'].includes(url.protocol)) return true;
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    if (['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com'].includes(url.hostname)) return true;
    return url.hostname === 'us-central1-aplicativo-pdv.cloudfunctions.net' && /^\/[a-zA-Z][a-zA-Z0-9]*V2$/.test(url.pathname);
  } catch { return false; }
}
function protectTestSession(session, { hosted = false } = {}) {
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !(hosted ? hostedUrlAllowed : testUrlAllowed)(details.url) }));
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
}
module.exports = { runtimeProfile, testUrlAllowed, hostedUrlAllowed, protectTestSession };
