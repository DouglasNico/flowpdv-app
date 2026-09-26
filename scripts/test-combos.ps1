param([switch]$SomenteCombos)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskWorkspace = Split-Path $taskRepo -Parent
$taskTools = Join-Path $taskWorkspace 'output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js'
$taskJava = Get-ChildItem (Join-Path $taskWorkspace 'output/local-java') -Filter java.exe -Recurse | Select-Object -First 1
$taskNode = Get-ChildItem (Join-Path $taskWorkspace 'output/local-node22') -Filter node.exe -Recurse | Select-Object -First 1
if (!(Test-Path -LiteralPath $taskTools) -or !$taskJava -or !$taskNode) { throw 'Ferramentas locais de homologação ausentes.' }
$taskVariables = @('PATH', 'FIREBASE_EMULATORS_PATH', 'FUNCTIONS_DISCOVERY_TIMEOUT', 'FLOWPDV_COMBOS_ISOLADO')
$taskPrevious = @{}
foreach ($name in $taskVariables) { $taskPrevious[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location $taskRepo
try {
  $env:PATH = $taskJava.Directory.FullName + ';' + $taskNode.Directory.FullName + ';' + $env:PATH
  $env:FIREBASE_EMULATORS_PATH = Join-Path $taskWorkspace 'output/emulator-cache'
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
  $env:FLOWPDV_COMBOS_ISOLADO = '1'
  & node --test test/composicao-pedido.test.cjs test/ofertas-core.test.cjs test/cupom-cozinha.test.cjs test/combo-modulos-v2.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de composição e cupom.' }
  $taskCommand = 'node --test --test-concurrency=1 test/fechamento-v2.test.cjs test/public-orders-v2.test.cjs'
  if ($SomenteCombos) { $taskCommand = 'node --test --test-name-pattern=combo: test/fechamento-v2.test.cjs' }
  & node $taskTools emulators:exec --project demo-flowpdv --config firebase.combos-test.json --only auth,firestore,functions $taskCommand
  if ($LASTEXITCODE -ne 0) { throw 'Falha no ensaio de combo e fechamento.' }
} finally {
  Pop-Location
  foreach ($name in $taskVariables) { [Environment]::SetEnvironmentVariable($name, $taskPrevious[$name], 'Process') }
}
