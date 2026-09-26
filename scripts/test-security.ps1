$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskWorkspace = Split-Path $taskRepo -Parent
$taskTools = Join-Path $taskWorkspace 'output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js'
$taskJava = Get-ChildItem (Join-Path $taskWorkspace 'output/local-java') -Filter java.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (!(Test-Path -LiteralPath $taskTools)) { throw 'Ferramentas locais ausentes. Consulte docs/seguranca-restaurantes-v2.md.' }
if (!$taskJava -and !(Get-Command java -ErrorAction SilentlyContinue)) { throw 'Java ausente. Consulte docs/seguranca-restaurantes-v2.md.' }
$taskOriginalPath = $env:PATH
$taskOriginalCache = $env:FIREBASE_EMULATORS_PATH
Push-Location $taskRepo
try {
  if ($taskJava) { $env:PATH = $taskJava.Directory.FullName + ';' + $env:PATH }
  $env:FIREBASE_EMULATORS_PATH = Join-Path $taskWorkspace 'output/emulator-cache'
  & node $taskTools emulators:exec --project demo-flowpdv --config firebase.test.json --only firestore 'node --test test/security-v2.test.cjs'
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de seguranca.' }
} finally {
  Pop-Location
  $env:PATH = $taskOriginalPath
  $env:FIREBASE_EMULATORS_PATH = $taskOriginalCache
}
