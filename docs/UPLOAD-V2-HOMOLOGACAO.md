# Upload V2 — homologação local com Cloudinary real

Validado em 23/09/2026, por autorização do usuário para executar o upload real e seguir as etapas sem confirmações intermediárias. Não houve deploy.

## Configuração

- `functions/.env.local`: `CLOUDINARY_V2_CLOUD_NAME` e `CLOUDINARY_V2_API_KEY`, correspondentes à conta já utilizada pelo cardápio.
- `functions/.secret.local`: `CLOUDINARY_V2_API_SECRET`, reutilizada da configuração local existente. Nunca copiar o valor para documentação, frontend ou Git.
- Os três arquivos locais de ambiente/segredo estão protegidos pelo `.gitignore`. O emulator usa o projeto `demo-flowpdv`; o destino das imagens é o Cloudinary real.
- Configuração de produção permanece separada: estas variáveis locais não provisionam segredos nem publicam funções remotas.

## Evidência reproduzível

No repositório `flowpdv-cardapio`, com Vite em 53700 e emuladores Auth/Firestore/Functions ativos:

```powershell
$env:FLOWPDV_UPLOAD_REAL='1'
node test/upload-real-v2.cjs
node --test test/upload-foto-v2.test.mjs
```

O teste exige adesão explícita pela variável acima: não deve integrar a suíte automática comum, pois usa o provedor real. Cria loja/gerente fictícios nos emuladores, gera dois PNGs simples em canvas e executa o formulário real de foto. Confere envio assinado, prévia carregada, vínculo só após salvar, troca sem sobrescrever o ativo anterior e remoção do vínculo só após salvar. O catálogo permanece fora do ar.

Cada assinatura gerada é registrada apenas no processo do teste para limpar os public IDs exclusivos daquele ensaio. O cleanup não lista nem remove imagens do negócio; usa exclusivamente o prefixo UUID da fixture. Ambos os ativos sintéticos foram removidos, incluindo os do primeiro ensaio cujo parser de variáveis foi corrigido para aceitar o dígito de V2. Reexecução completa aprovada, junto dos três testes simulados.

O botão **Remover foto do produto** remove o vínculo no catálogo; não exclui o arquivo remoto. A exclusão remota neste ensaio é somente limpeza de seus próprios dados sintéticos. Arquivos abandonados por usuários não possuem coleta automática.

Referência técnica: [Upload API e destroy](https://cloudinary.com/documentation/image_upload_api_reference). A invalidação de cache solicitada na limpeza pode demorar a se propagar.

## Limites restantes

Upload real aprovado para este ambiente local. Ainda faltam homologação da configuração hospedada, limites do provedor e piloto em celular real. HTTPS/QR externo e publicação continuam separados. Impressora térmica física não encontrada neste computador em 23/09/2026; foram detectadas apenas Microsoft Print to PDF e OneNote.
