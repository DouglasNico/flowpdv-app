# Instalador local preparado — 23/09/2026

Artefato NSIS Windows x64, FlowPDV 3.2.38, gerado sem publicação:

`flowpdv-sistema/output/piloto-instalador-20260923/FlowPDV-Setup.exe`

- Tamanho: 90.819.306 bytes.
- SHA-256: `a55dc335978d2e74c3471fe81bcf0ce5483cd661a63f9903ba4e0d791df5e7c3`.
- Authenticode: `NotSigned`. As mensagens de signtool no build não representam assinatura válida.
- Configuração normal do projeto preservada; nenhuma alteração de versão, updater ou destino de produção.
- Não instalado nem iniciado. Este instalador usa o perfil normal e não é um laboratório conectado aos emuladores. Executá-lo neste computador pode substituir a instalação FlowPDV existente.

## Geração

Na pasta `adega-pdv-gestao`:

```powershell
npm run bundle
$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
npx --no-install electron-builder --win nsis --x64 --publish never --config.directories.output=../output/piloto-instalador-20260923
node scripts/verificar-pacote-local.cjs
node --test test/runtime-profile.test.cjs
```

O bundle foi regenerado pelo esbuild. Seu diff apresenta quatro linhas vazias com espaços produzidas pelo gerador; não foi editado manualmente depois de empacotar, para manter a correspondência de hashes.

## Conferência realizada

Novo `scripts/verificar-pacote-local.cjs`: examina `app.asar` sem executar o aplicativo. Compara hashes de 21 arquivos, incluindo main/preload/política de perfil/ponte SiTef/bundle e recursos referenciados pelo HTML. Confere versão e dependências electron-updater/koffi; rejeita arquivos .env/.secret.local e diretórios functions/test/docs/.git. Exercita a política extraída do pacote para confirmar que perfis de teste/homologação continuam proibidos no aplicativo empacotado.

Resultado aprovado em `output/piloto-instalador-20260923/verificacao-pacote.json`. Os dez testes existentes de isolamento/perfis também passaram. Os arquivos com credenciais Cloudinary locais não entraram no pacote.

O script confere o pacote `win-unpacked` produzido junto do instalador e registra o hash do EXE NSIS; não simula a instalação ou desinstalação.

## Pendências concretas

1. Testar instalação, abertura, atualização e desinstalação em Windows separado, com dados fictícios e acesso de homologação apropriado. A política atual não permite simplesmente passar `--flowpdv-test` ao EXE empacotado; não foi removida para contornar isso.
2. Definir ambiente HTTPS/backend de homologação para celular/QR. O servidor localhost não atende esse aceite e nenhuma publicação foi feita.
3. Testar impressora térmica física (neste computador só há Print to PDF e OneNote).
4. Assinatura digital e publicação permanecem fora desta entrega. O artefato não está declarado pronto para distribuição a clientes.
