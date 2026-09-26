const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'flowpdv-profiles-isolation-'));
for (const [nome, esperado, valor] of [['origem', null, 'dado-origem'], ['destino', null, 'dado-destino'], ['origem', 'dado-origem', 'dado-origem']]) {
  const r = spawnSync(require('electron'), [path.join(__dirname, 'electron-isolation.smoke.cjs')], { stdio: 'inherit', timeout: 60000,
    env: { ...process.env, FLOWPDV_VISIBLE_TEST: '0', FLOWPDV_PAIRING_UI_TEST: '0', FLOWPDV_PROFILE_SCRATCH: scratch,
      FLOWPDV_TEST_PROFILE_NAME: nome, FLOWPDV_PROFILE_EXPECT: JSON.stringify(esperado), FLOWPDV_PROFILE_WRITE: valor } });
  if (r.error) throw r.error;
  assert.equal(r.status, 0, `Falha no perfil ${nome}`);
}
assert.ok(fs.existsSync(path.join(scratch, 'flowpdv-test-origem')));
assert.ok(fs.existsSync(path.join(scratch, 'flowpdv-test-destino')));
assert.equal(fs.existsSync(path.join(scratch, 'flowpdv')), false);
console.log('PERFIS ISOLADOS PASS: origem e destino independentes; reinício preserva somente os dados do perfil selecionado.');
