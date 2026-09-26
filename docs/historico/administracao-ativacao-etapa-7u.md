# Etapa 7U — comando administrativo de homologação

Implementação local, sem deploy ou ativação de loja real. Continuação da etapa 7T; ainda não conclui a ativação operacional no aplicativo normal.

## Comando entregue

`alterarAtivacaoOperacionalV2` recebe `lojaId`, `requestId`, `estado` (`habilitada` ou `suspensa`), `ambiente` obrigatoriamente `homologacao`, `revisaoEsperada`, `motivo` de 5 a 180 caracteres e `confirmado: true`.

Exige conta humana ativa com e-mail verificado e gerência ativa da loja. Administrador com claim presente no token e no cadastro atual também pode administrar. Identidade cadastrada como terminal é recusada. Loja inativa não pode ser alterada por esse comando.

A primeira alteração parte da revisão zero quando não há configuração. Cada comando novo incrementa a revisão e grava, na mesma transação:

- o estado de homologação na loja;
- o resultado da operação em `lojas_v2/{lojaId}/operacoes_ativacao/{requestId}`;
- auditoria privada em `auditoria_ativacao_v2`, com responsável, motivo, estado anterior, estado novo e horário do servidor.

Reenvio do mesmo identificador, autor e conteúdo retorna o resultado original, sem incrementar revisão ou duplicar auditoria. O resultado reutilizado descreve aquela operação, não necessariamente o estado atual: consulte a configuração atual após recuperar a resposta. Repetir uma ativação antiga depois de uma suspensão não reativa a loja.

Mesmo no reenvio, conta, gerência e loja são revalidadas. Reutilização de identificador com conteúdo ou autor diferente é recusada. Alterações concorrentes com identificadores diferentes e a mesma revisão têm apenas uma vencedora. Configuração desconhecida/incompatível não é sobrescrita pelo comando.

Não há exclusão automática do registro de deduplicação. Retenção e eventual limpeza exigem política própria antes da produção. Não existem regras permitindo escrita direta de clientes na operação ou auditoria.

## Suspensão e pendências

O comando só altera a configuração da homologação. Não cancela pedidos, não estorna vendas, não repõe estoque, não fecha caixa e não remove pendências. A consulta da etapa 7T passa a retornar a homologação desabilitada.

**Limite atual:** os consumidores e as callables operacionais ainda não aplicam essa nova política. Suspender o registro não bloqueia globalmente todas as operações existentes. A aplicação desse bloqueio é a próxima integração; não deve ser anunciada como concluída.

Política a implementar nas operações:

| Situação | Tratamento necessário |
| --- | --- |
| Nova operação com homologação suspensa | Recusar no servidor, sem efeito financeiro ou de estoque |
| Operação já confirmada no servidor, resposta perdida | Permitir consultar/recuperar o mesmo resultado sob acesso válido, sem repetir os efeitos |
| Intenção apenas local, sem aceitação remota | Não tratar como venda confirmada; conferir o estado remoto antes de cancelar ou retomar |
| Reserva/baixa já realizada e conclusão pendente | Recuperar ou cancelar pela identidade original e por transação, com trilha de auditoria |
| Terminal ou usuário revogado | Não abrir exceção de autenticação; recuperação administrativa por identidade autorizada precisa de fluxo próprio |
| Falha de rede | Não interpretar cache de autorização como liberação para novas operações |

Essa tabela define o trabalho seguinte, não comprova que cada cenário já foi integrado ao bloqueio novo. Os mecanismos existentes de recuperação continuam com suas regras anteriores.

## Validação

Testes acrescentados à suíte real de emuladores cobrem autorização entre lojas, campos inválidos, recusa de produção, confirmação, ativação/suspensão, auditoria, repetição concorrente, revisão vencida, reenvio antigo após suspensão, gerência revogada, proteção contra escrita direta e preservação de um registro operacional fictício durante a suspensão.

A preservação desse registro não substitui os testes futuros de recuperação operacional sob suspensão. Não foi aberta interface nem realizado teste físico.

Evidência: `output/etapa-7u-backend.log`, execução de `scripts/test-pairing.ps1 -Configuracao`. Resultado: 108 testes de servidor e regressão passaram, sem falhas, com código de saída 0. Incluem os quatro cenários novos desta etapa e as suítes existentes de configuração, acesso, pedidos, recebimento, cozinha, fechamento e segurança.

## Próxima parte

Aplicar a política às entradas de novas operações e à recuperação de resultados existentes, com testes de suspensão durante falha/reenvio. Depois conectar os controles administrativos e o aplicativo. A produção continua retornando desabilitada e não foi alterada.

Integração posterior: [Etapa 7V — suspensão de novos pedidos e vendas](suspensao-operacoes-etapa-7v.md). O limite de ausência de bloqueio descrito acima corresponde ao estado histórico da etapa 7U.
