// Read-only package verification; never installs, launches, signs or publishes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, '../output/piloto-instalador-20260923'));
const archive = path.join(output, 'win-unpacked/resources/app.asar');
const installer = path.join(output, 'FlowPDV-Setup.exe');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const files = asar.listPackage(archive).map(f => f.replaceAll('\\', '/').replace(/^\//, ''));
assert.ok(files.every(f => !/(^|\/)\.(env(?:\..*)?|secret\.local)$/.test(f)), 'Arquivo de ambiente/segredo no pacote');
assert.ok(files.every(f => !/^(functions|test|docs|\.git)\//.test(f)), 'Diretório de desenvolvimento no pacote');
const required = new Set(['main.js', 'preload.js', 'runtime-profile.cjs', 'sitef-bridge.js', 'index.html', 'src/js/bundle.js']);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["'](src\/[^"'?#]+)(?:[^"']*)["']/g)) required.add(match[1]);
const hashes = {};
for (const file of required) {
  assert.ok(files.includes(file), `Arquivo ausente: ${file}`);
  const packaged = asar.extractFile(archive, file.split('/').join(path.sep));
  assert.equal(sha256(packaged), sha256(fs.readFileSync(path.join(root, file))), `Arquivo desatualizado: ${file}`);
  hashes[file] = sha256(packaged);
}
for (const dependency of ['electron-updater', 'koffi']) assert.ok(files.includes(`node_modules/${dependency}/package.json`), `Dependência ausente: ${dependency}`);
const pkg = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(pkg.version, require('../package.json').version);
// Execute only the small profile policy, never the application's entry point.
const profileModule = { exports: {} };
new Function('require', 'module', asar.extractFile(archive, 'runtime-profile.cjs').toString())(require, profileModule);
for (const flag of ['--flowpdv-test', '--flowpdv-homologacao']) {
  assert.throws(() => profileModule.exports.runtimeProfile({ isPackaged: true, argv: [flag], appData: output }), /desenvolvimento/);
}
assert.ok(fs.statSync(installer).size > 1000000, 'Instalador ausente/incompleto');
const report = {
  verifiedAt: new Date().toISOString(), version: pkg.version, installer: path.basename(installer),
  installerBytes: fs.statSync(installer).size, installerSha256: sha256(fs.readFileSync(installer)),
  archiveSha256: sha256(fs.readFileSync(archive)), sourceHashes: hashes,
  checks: ['entrypoints and HTML resources match source', 'no env/secrets or development directories', 'runtime dependencies present', 'packaged test profiles denied'],
  limits: ['Not installed or launched', 'No physical equipment or phone tested', 'No deployment or publication', 'Authenticode status must be checked separately']
};
fs.writeFileSync(path.join(output, 'verificacao-pacote.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PACOTE PASS: versão ${pkg.version}; ${required.size} arquivos conferidos; SHA-256 ${report.installerSha256}`);
