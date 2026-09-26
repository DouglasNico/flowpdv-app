$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskWorkspace = Split-Path $taskRepo -Parent
$taskJava = Get-ChildItem (Join-Path $taskWorkspace 'output/local-java') -Filter java.exe -Recurse | Select-Object -First 1
$env:PATH = $taskJava.Directory.FullName + ';' + $env:PATH
$env:FIREBASE_EMULATORS_PATH = Join-Path $taskWorkspace 'output/emulator-cache'
Set-Location -LiteralPath $taskRepo
& node (Join-Path $taskWorkspace 'output/local-tools/node_modules/firebase-tools/lib/bin/firebase.js') emulators:exec --project demo-flowpdv --config firebase.test.json --only auth,firestore,functions 'node test/run-demo-local.cjs'
