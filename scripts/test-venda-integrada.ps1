param([switch]$Revogacao, [switch]$Cancelamento, [switch]$RecuperacaoPerfil, [switch]$LiberacaoPerfil, [switch]$SomenteInterface, [switch]$FechamentoRecuperado, [switch]$PendenciasRecuperacao, [switch]$PagamentoRecuperado)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskWorkspace = Split-Path $taskRepo -Parent
$taskTools = Join-Path $taskWorkspace 'output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js'
$taskJava = Get-ChildItem (Join-Path $taskWorkspace 'output/local-java') -Filter java.exe -Recurse | Select-Object -First 1
$taskNode = Get-ChildItem (Join-Path $taskWorkspace 'output/local-node22') -Filter node.exe -Recurse | Select-Object -First 1
if (!(Test-Path -LiteralPath $taskTools) -or !$taskJava) { throw 'Ferramentas locais de homologação ausentes.' }
$taskOldPath=$env:PATH
$taskOldCache=$env:FIREBASE_EMULATORS_PATH
$taskOldTimeout=$env:FUNCTIONS_DISCOVERY_TIMEOUT
$taskOldRevogacao=$env:FLOWPDV_REVOKED_SALE_TEST
$taskOldElectron=$env:ELECTRON_RUN_AS_NODE
$taskOldRelease=$env:FLOWPDV_RELEASE_PROFILE_TEST
$taskOldClose=$env:FLOWPDV_CLOSE_PROFILE_TEST
$taskOldPending=$env:FLOWPDV_PENDING_RECOVERY_TEST
$taskOldRecoverPayment=$env:FLOWPDV_RECOVER_PAYMENT_TEST
Push-Location $taskRepo
try {
  $env:PATH=$taskJava.Directory.FullName+';'+$env:PATH
  if($taskNode){$env:PATH=$taskNode.Directory.FullName+';'+$env:PATH}
  $env:FIREBASE_EMULATORS_PATH=Join-Path $taskWorkspace 'output/emulator-cache'
  $env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
  $env:FLOWPDV_REVOKED_SALE_TEST=if($Revogacao){'1'}else{'0'}
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  $taskCommand='node test/run-venda-aplicativo-completo.cjs'
  if($Cancelamento){$taskCommand='node --test --test-name-pattern=cancel test/fechamento-v2.test.cjs && node test/run-venda-aplicativo-completo.cjs'}
  if($RecuperacaoPerfil){$taskCommand='node test/run-recuperacao-integrada.cjs'}
  if($LiberacaoPerfil){$env:FLOWPDV_RELEASE_PROFILE_TEST='1';$taskCommand='node --test test/recuperacao-terminal-v2.test.cjs && node test/run-instalacao-perfil-ui.cjs'}
  if($LiberacaoPerfil -and $SomenteInterface){$taskCommand='node test/run-instalacao-perfil-ui.cjs'}
  if($PendenciasRecuperacao){$FechamentoRecuperado=$true;$env:FLOWPDV_PENDING_RECOVERY_TEST='1'}
  if($FechamentoRecuperado){$env:FLOWPDV_CLOSE_PROFILE_TEST='1';$env:FLOWPDV_RELEASE_PROFILE_TEST='0';$taskCommand='node --test test/recuperacao-terminal-v2.test.cjs && node test/run-instalacao-perfil-ui.cjs';if($SomenteInterface){$taskCommand='node test/run-instalacao-perfil-ui.cjs'}}
  if($PagamentoRecuperado){$env:FLOWPDV_RECOVER_PAYMENT_TEST='1';$env:FLOWPDV_RELEASE_PROFILE_TEST='0';$env:FLOWPDV_CLOSE_PROFILE_TEST='0';$env:FLOWPDV_PENDING_RECOVERY_TEST='0';$taskCommand='node --test --test-name-pattern="pagamento de atendimento transferido" test/recuperacao-terminal-v2.test.cjs && node test/run-instalacao-perfil-ui.cjs';if($SomenteInterface){$taskCommand='node test/run-instalacao-perfil-ui.cjs'}}
  & node $taskTools emulators:exec --project demo-flowpdv --config firebase.test.json --only auth,firestore,functions $taskCommand
  if($LASTEXITCODE -ne 0){throw 'Falha no ensaio de venda integrada.'}
} finally {
  Pop-Location
  $env:PATH=$taskOldPath
  $env:FIREBASE_EMULATORS_PATH=$taskOldCache
  $env:FUNCTIONS_DISCOVERY_TIMEOUT=$taskOldTimeout
  $env:FLOWPDV_REVOKED_SALE_TEST=$taskOldRevogacao
  $env:ELECTRON_RUN_AS_NODE=$taskOldElectron
  $env:FLOWPDV_RELEASE_PROFILE_TEST=$taskOldRelease
  $env:FLOWPDV_CLOSE_PROFILE_TEST=$taskOldClose
  $env:FLOWPDV_PENDING_RECOVERY_TEST=$taskOldPending
  $env:FLOWPDV_RECOVER_PAYMENT_TEST=$taskOldRecoverPayment
}
