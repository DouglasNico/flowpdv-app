# Perfis separados para ensaio de recuperação — etapa 8O

Em desenvolvimento, `--flowpdv-test --flowpdv-test-profile=origem` seleciona a pasta `flowpdv-test-origem` dentro do appData. O perfil `destino` usa outra pasta; o teste padrão continua em `flowpdv-test`, e o perfil normal continua em `flowpdv`.

O nome aceita até 32 letras minúsculas, números ou hífens. Caminhos, separadores, argumentos repetidos e uso sem `--flowpdv-test` são recusados. O aplicativo empacotado continua recusando o perfil de teste. Não foi criado um modo de produção novo.

As proteções existentes são mantidas: somente emuladores locais, impressora física e integrações externas bloqueadas, sem atualização automática. Nenhuma credencial é copiada ao criar um perfil. A autenticação da nova sessão continua sendo um passo próprio de pareamento.

## Validação

- `output/etapa-8o-local.log`: oito testes aprovados, incluindo caminhos inválidos, preservação dos diretórios anteriores e bloqueios de serviços reais.
- `output/etapa-8o-electron.log`: três inicializações reais e ocultas do Electron, em pasta temporária. Origem e destino receberam marcadores distintos em localStorage; reiniciar origem encontrou somente seu marcador. A pasta normal `flowpdv` não foi criada nesse ensaio.
- O teste confirma separação e persistência do armazenamento local. Não equivale ainda a uma transferência completa do backup entre os dois perfis com autenticação independente.

Próxima integração: receber um arquivo conferido no perfil novo, tratar a escrita interrompida, reabrir a aplicação e manter a operação bloqueada até a conferência necessária. Não apagar um perfil existente nem transferir dados financeiros usando cópia bruta do userData.
