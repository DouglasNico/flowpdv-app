# Etapa 7X — suspensão nas telas operacionais de teste

Clássico, moderno e conferência local agora refletem a autorização consultada no servidor. A mudança permanece exclusiva do ambiente de teste, sem ativação no aplicativo normal ou publicação.

## Atualização da autorização

Após confirmar o vínculo do terminal, o painel acompanha o documento da loja. Uma atualização confirmada no servidor dispara `consultarAtivacaoOperacionalV2`; enquanto aguarda, novas vendas ficam bloqueadas. Respostas atrasadas de uma sessão/conexão anterior são ignoradas. A consulta confirma novamente terminal, membro e loja.

A callable informa explicitamente `compatibilidadeLegada` quando o campo de ativação não existe. Isso preserva a transição da etapa 7V sem confundir uma loja sem adesão com configuração nula/inválida. Configuração habilitada precisa permitir balcão para o terminal de caixa. Produção continua desabilitada.

Evento de desconexão, snapshot de cache ou erro de consulta não autorizam uma venda nova. O painel informa que deve preservar as pendências. Ao reconectar ou usar Atualizar acesso, uma nova consulta é necessária.

## Comportamento das telas

- Clássico: leitor e busca ficam bloqueados; o aviso indica suspensão ou indisponibilidade.
- Moderno: inclusão e edição ficam bloqueadas; o aviso apresenta o mesmo estado.
- Conferência local: os controles de uma nova venda ficam desabilitados e a confirmação anterior é desmarcada. Após reativação, confira novamente antes de registrar.
- O carrinho não é apagado pela suspensão/desconexão.
- F4/acesso ao pagamento permanece disponível; se houver tentativa persistida, direciona à pendência. Sem pendência e sem autorização, direciona ao aviso de acesso.
- Retomada e cancelamento de tentativa persistida ficam fora do bloqueio do formulário novo. Cada chamada continua sujeita à autenticação e às regras do servidor.

O fechamento de uma conta do restaurante mantém seu caminho de reenvio para recuperar respostas perdidas; o servidor decide se é uma nova venda recusada ou uma confirmação já existente. Não bloqueamos esse caminho genericamente na interface.

## Limites

Não é uma autorização offline, nem substitui as barreiras do servidor. A interface pode levar tempo para receber uma atualização, e a chamada financeira ainda precisa validar acesso e suspensão no servidor. O evento de desconexão do navegador não comprova disponibilidade de todos os serviços.

Nesta etapa os avisos foram ligados ao PDV e à conferência. O cardápio público mantém a recusa do servidor da etapa 7V; não recebeu novo aviso visual. Cozinha e rotinas de recuperação mantêm as regras existentes. Não houve integração ao login normal ou migração real de loja.

## Validação

Testes de proteção do perfil normal e fluxo completo de interface oculta. O painel administrativo suspende/reativa a loja e o teste confere os controles dos dois layouts; depois simula o evento offline, verifica que o carrinho permanece e que o pagamento pode ser aberto, reconecta e exige nova autorização. Isso não equivale a teste físico de queda de rede.

Evidências: `output/etapa-7x-local.log`, `etapa-7x-bundle.log`, `etapa-7x-interface.log` e capturas em `output/etapa-7x`. Resultado: 13 testes locais e fluxo completo de interface oculta passaram; bundle gerado. Foi corrigida a prontidão após recarga para aguardar também a autorização, e a suíte completa foi repetida com código 0. O log registra `ACESSO OPERACIONAL UI PASS`. A captura do moderno foi revisada; a captura do clássico saiu vazia por anteceder a pintura, embora suas verificações funcionais tenham passado. O capturador recebeu espera por quadros para a próxima execução; essa captura visual específica ainda precisa ser repetida.

Próxima parte: ampliar os cenários de suspensão com tentativa financeira pendente na interface e revisar a extração dos serviços do laboratório para um perfil operacional de homologação, mantendo a produção protegida.

Atualização na [etapa 7Y](suspensao-pendencias-etapa-7y.md): os cenários de cancelamento e conclusão após suspensão e recarga passaram no fluxo completo oculto. A captura do clássico foi repetida e inspecionada, encerrando a pendência visual descrita acima. A extração dos serviços permanece como próxima parte.
