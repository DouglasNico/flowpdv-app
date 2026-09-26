param([switch]$Interface, [switch]$Pedidos, [switch]$Cardapio, [switch]$Recebimento, [switch]$Cozinha, [switch]$Fechamento, [switch]$Configuracao, [switch]$Cancelamento, [switch]$Recuperacao)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskWorkspace = Split-Path $taskRepo -Parent
$taskTools = Join-Path $taskWorkspace 'output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js'
$taskJava = Get-ChildItem (Join-Path $taskWorkspace 'output/local-java') -Filter java.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (!(Test-Path -LiteralPath $taskTools) -or !$taskJava) { throw 'Ferramentas locais ausentes; consulte docs/seguranca-restaurantes-v2.md.' }
$taskOriginalPath = $env:PATH
$taskOriginalCache = $env:FIREBASE_EMULATORS_PATH
$taskOriginalDiscoveryTimeout = $env:FUNCTIONS_DISCOVERY_TIMEOUT
$taskNode = Get-ChildItem (Join-Path $taskWorkspace 'output/local-node22') -Filter node.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
Push-Location $taskRepo
try {
  $env:PATH = $taskJava.Directory.FullName + ';' + $env:PATH
  if ($taskNode) { $env:PATH = $taskNode.Directory.FullName + ';' + $env:PATH }
  $env:FIREBASE_EMULATORS_PATH = Join-Path $taskWorkspace 'output/emulator-cache'
  if (!$env:FUNCTIONS_DISCOVERY_TIMEOUT) { $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60' }
  if (([int]$Interface.IsPresent + [int]$Pedidos.IsPresent + [int]$Cardapio.IsPresent + [int]$Recebimento.IsPresent + [int]$Cozinha.IsPresent + [int]$Fechamento.IsPresent + [int]$Configuracao.IsPresent + [int]$Cancelamento.IsPresent + [int]$Recuperacao.IsPresent) -gt 1) { throw 'Selecione somente uma suite.' }
  $taskCommand = if ($Interface) { 'node test/run-pairing-ui.cjs' } elseif ($Pedidos) { 'node --test test/public-orders-v2.test.cjs' } elseif ($Cardapio) { 'node test/run-cardapio-v2.cjs' } elseif ($Recebimento) { 'node --test test/recebimento-v2.test.cjs' } else { 'node --test test/pairing-v2.test.cjs' }
  if ($Cozinha) { $taskCommand = 'node --test --test-concurrency=1 test/security-v2.test.cjs test/cozinha-v2.test.cjs test/recebimento-v2.test.cjs' }
  if ($Fechamento) { $taskCommand = 'node --test --test-concurrency=1 test/fechamento-v2.test.cjs test/security-v2.test.cjs test/public-orders-v2.test.cjs test/recebimento-v2.test.cjs test/cozinha-v2.test.cjs' }
  if ($Configuracao) { $taskCommand = 'node --test --test-concurrency=1 test/configuracao-v2.test.cjs test/fechamento-v2.test.cjs test/security-v2.test.cjs test/public-orders-v2.test.cjs test/recebimento-v2.test.cjs test/cozinha-v2.test.cjs test/pairing-v2.test.cjs' }
  if ($Recuperacao) { $taskCommand = 'node --test --test-concurrency=1 test/recuperacao-terminal-v2.test.cjs test/pairing-v2.test.cjs test/fechamento-v2.test.cjs' }
  if ($Cancelamento) { $taskCommand = 'node test/run-cancelamento-ui.cjs' }
  & node $taskTools emulators:exec --project demo-flowpdv --config firebase.test.json --only auth,firestore,functions $taskCommand
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de pareamento.' }
} finally {
  Pop-Location
  $env:PATH = $taskOriginalPath
  $env:FIREBASE_EMULATORS_PATH = $taskOriginalCache
  $env:FUNCTIONS_DISCOVERY_TIMEOUT = $taskOriginalDiscoveryTimeout
}
