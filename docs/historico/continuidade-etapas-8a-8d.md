# Continuidade — acesso, proteção de backup e recuperação

Execução autorizada em sequência, sem abrir janelas e sem publicação. Todas as contas e operações financeiras dos ensaios são fictícias.

## 8A — ciclo de autenticação e vínculo

`acesso-homologacao.js` extrai da tela a preparação/consulta/ativação do terminal e login/logout/emissão/revogação da gerência. Adaptadores Firebase e persistência ficam em `sessoes-homologacao.js`. Mantêm-se a identidade persistente do terminal e a sessão da gerência em memória. Credenciais não são armazenadas pelo novo serviço.

Consultas conferem a identidade antes e depois da resposta. Logout invalida comandos da gerência em curso; login e logout são serializados. Revogação invalida consultas anteriores do vínculo e informa as telas para revalidarem o acesso. A observação de identidade do terminal pede nova consulta quando o usuário muda; o evento não concede autorização.

27 testes locais de acesso, autorização e proteção do perfil passaram. A primeira execução da interface encontrou uma consulta de conciliação descartada por reconexão duplicada na inicialização. A observação foi corrigida para ignorar a notificação inicial e repetições da mesma identidade; o comportamento tem teste dedicado. Validação completa após a correção: passou com código 0 em `output/etapa-8a-8d-interface-validacao.log`, incluindo as conferências finais de caixa e estoque no servidor.

Limite: login normal, migração das identidades legadas e recuperação administrativa por outro terminal ainda não foram integrados.

## 8B — impedir mistura com restauração e sincronização legadas

`StorageService.exigirBaseLegadaPermitida` recusa importação antiga, troca/limpeza de loja e aplicação de base da nuvem se houver migração, pendência, recibo ou resumo V2. O pacote recebido também é examinado antes de gravar. Dados de controle ilegíveis não autorizam sobrescrita.

Os caminhos de backup manual, carregamento completo, sincronização inicial, aplicação em tempo real, consolidação de produtos e publicação do pacote usam essa proteção. O resumo de turno não é enviado isoladamente ao caminho antigo quando contém operação V2. Um envio recusado não apresenta mensagem de sucesso.

Isso protege a transição; não implementa sincronização V2 de todos os cadastros. Bases exclusivamente legadas conservam o fluxo anterior. Antes de habilitar V2 no aplicativo normal, é necessário disponibilizar a recuperação e sincronização próprias.

Evidências: `output/etapa-8b-local.log` (32 testes, incluindo cinco cenários de proteção), `output/etapa-8b-regressao.log` (51 testes gerais e 26 testes TEF). Os testes verificam preservação dos dados após recusa e manutenção da importação legada comum.

## 8C — ensaio de backup em armazenamento vazio

`backup-homologacao.js` captura apenas as chaves operacionais previstas: produtos, vendas, turnos, vínculos, movimentos locais, rascunhos e tentativas financeiras pendentes. Não copia Firebase Auth, licença, PIN ou operadores. O pacote identifica loja, terminal local e UID original. Outra identidade é recusada; não há transferência automática de credenciais.

A restauração exige destino vazio e explicitamente isolado para ensaio. Um diário persiste antes das escritas: depois de uma falha de disco, reaplica os valores finais. Qualquer alteração inesperada no destino interrompe a recuperação sem sobrescrever o dado divergente. Backup com diário local de venda/caixa ainda incompleto ou alteração administrativa pendente é recusado até sua recuperação.

39 testes passaram em `output/etapa-8c-local.log`: formato, segregação, falha de disco, origem divergente, destino ocupado e retomada da venda/cancelamento em um armazenamento novo usando o armazenamento real do aplicativo e um servidor simulado. Nos casos de resposta de baixa perdida, confirmação perdida e cancelamento com resposta perdida, IDs, troco, quantidade de vendas e estoque ficaram corretos.

Limites: este módulo ainda não está ligado à interface do aplicativo. O ensaio troca o armazenamento local e o contexto de execução, mas não representa restauração em outro computador com Auth/Firestore reais. O contexto de identidade é uma entrada do ensaio, não uma credencial nem prova de autenticação. É necessário validar snapshot/revisões com o servidor, recuperar histórico posterior ao backup e implementar transferência administrativa da identidade antes de oferecer essa operação a uma loja. Não usar este módulo para importar arquivo não confiável na operação normal.

## 8D — interrupção do transporte no teste de interface

O cenário de desconexão passa a bloquear requisições HTTP na sessão Electron e encerrar conexões abertas, preservando a barreira que proíbe destinos externos. Uma requisição ao emulador deve funcionar antes do corte, falhar durante o corte e voltar após liberar a rede. Os dois layouts mantêm carrinho e acesso à pendência; novas vendas dependem de nova autorização.

A tentativa inicial com `enableNetworkEmulation` não bloqueou a requisição de loopback, e o teste falhou corretamente. Foi substituída pelo bloqueio no transporte descrito acima. Não é desligamento do roteador ou do computador. A nova execução passou: `REDE INTERROMPIDA UI PASS`, fluxo completo e conferências finais do servidor com código 0 em `output/etapa-8a-8d-interface-validacao.log`.

## Sequência seguinte

Concluir a validação integrada; avançar a restauração com confirmação de identidade e reconciliação no servidor. Depois integrar a recuperação ao perfil operacional de homologação. As frentes de acesso, backup e falha de conexão permanecem abertas até seus aceites completos.
