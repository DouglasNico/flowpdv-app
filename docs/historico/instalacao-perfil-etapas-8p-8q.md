# Instalação em perfil novo — etapas 8P e 8Q

## Gravação interrompida (8P)

`criarInstalacaoPerfilTeste` confere o arquivo com os serviços de restauração, escreve um journal antes dos dados, aplica valores finais e mantém um marcador de bloqueio operacional. Repetir após falha de disco não duplica registros. Dados locais surgidos durante a instalação impedem sobrescrita.

O perfil deve ser novo: aceita apenas a identificação inicial, a lista vazia de clientes e a configuração padrão vazia criada pelo aplicativo. A chave de autenticação do SDK do próprio terminal é preservada e excluída do journal; não é copiada do backup. Configurações comerciais, clientes ou outras chaves preexistentes impedem a instalação.

Os marcadores bloqueiam novas vendas na autorização da interface, comandos de alteração pela sessão do terminal, alterações locais e importação/sincronização legadas. O bloqueio persiste após recarga. Não existe nesta etapa um comando de liberação automática.

Validação inicial: 25 testes locais de instalação, bloqueio, autorização, backup e sessões aprovados (`output/etapa-8p-local.log`); regressão geral 51/51 e TEF 26/26 aprovadas (`output/etapa-8p-regressao.log`). Cinco testes específicos ampliados da instalação passaram em `output/etapa-8q-local.log`, incluindo preservação de autenticação fora do journal.

## Interface de instalação (8Q)

O preload identifica perfis nomeados de teste, e somente nesses perfis o painel mostra instalação e retomada. O arquivo precisa estar conferido; o destino não aceita substituição de uma base existente. Após instalar, a tela é recarregada e o perfil continua bloqueado para operações.

Validado em `output/etapa-8q-interface-final.log`: inicialização real do Electron, autenticação anônima própria do novo terminal, autorização do gerente, transferência da identidade financeira, importação, recarga e consultas com o UID novo preservado. O primeiro ensaio identificou as configurações vazias criadas automaticamente pelo aplicativo e a necessidade de preservar a chave local do SDK. A proteção de navegação passou a permitir somente a recarga da URL atual, mantendo outros destinos proibidos.

O ensaio terminou com estoque de 2.500 unidades internas, nenhuma venda remota criada e terminal original revogado. Capturas em 1366 e 1024 pixels foram inspecionadas (`output/etapa-8q/perfil-1366.png` e `perfil-1024.png`). As janelas permaneceram ocultas. O bloqueio da instalação é aplicado no cliente; ele não representa um novo bloqueio administrativo no servidor.

## Limites

Ainda é um perfil isolado de desenvolvimento. A liberação após recuperação, a retomada financeira nesse perfil bloqueado e a integração ao login normal precisam de uma política própria com conferência completa; remover manualmente o marcador não é um fluxo suportado. Contagens físicas, sangrias e dados que nunca foram sincronizados não podem ser inferidos de recibos de vendas.
