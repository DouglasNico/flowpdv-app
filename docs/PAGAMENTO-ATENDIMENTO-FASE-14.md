# Fase 14 — tentativa persistente de pagamento de atendimento

Implementada localmente em 23/09/2026. Projeto completo retomado por autorização do usuário; publicação suspensa.

## Entrega

Antes de registrar o pagamento manual de mesa/comanda/retirada/delivery, o aplicativo persiste loja, identidade operacional, turno, conta, versão, formas, valores e dinheiro recebido. A retomada reutiliza exatamente esse pedido e o contrato idempotente já existente no servidor. Uma resposta perdida ou falha ao remover o diário não exige receber dinheiro novamente.

O painel apresenta a ação **Retomar registro do pagamento** e orientação para não receber novamente. Outra tentativa não sobrescreve a existente; mudança de loja/identidade, valores inconsistentes, resposta divergente ou diário corrompido preservam a pendência. Caixa e liberação de perfil não podem ignorá-la. O backup identificado inclui o registro.

## Código e testes

- `src/js/pagamento-atendimento-pendente.js`: serviço novo; persistência antes do envio, validação dos valores e do retorno, identidade, exclusão somente após confirmação e retomada.
- `src/js/fechamento-teste.js`: pagamento usa o serviço; botão de retomada e mensagem específica; fechamento remoto exige resolver pendências. Refinamento com Impeccable, preservando controles existentes.
- `src/js/storage.js`: pagamento pendente bloqueia venda/alteração/encerramento e substituição legada da base.
- `src/js/backup-homologacao.js`: inclui o diário e confere loja/turno do backup.
- `src/js/fechamento-perfil-recuperado.js`, `src/js/liberacao-perfil-recuperado.js`: recusam fechar/liberar com esse pagamento pendente.
- `src/js/bundle.js`: recompilado.
- `test/pagamento-atendimento-pendente.test.cjs`: perda de resposta, nova instância após reinício, payload preservado, outra loja/tentativa, disco, retorno divergente, valores inválidos, corrupção e troca de sessão.
- `test/backup-homologacao.test.cjs`: preservação do diário e rejeição de loja divergente.
- `test/storage-recuperacao-operacional.test.cjs`: proteção de histórico e numeração durante a pendência.
- `test/alimentacao-aplicativo-completo-ui.cjs`: interrupção HTTP ao receber os cabeçalhos da resposta, após o pagamento já estar registrado no emulador; botão retoma sem duplicação. Demais verificações de alimentação, estoque e caixa mantidas.

## Evidências

31 testes locais aprovados em `output/pagamento-pendente-fase14-local.log`. Ensaio do aplicativo completo aprovado em `output/pagamento-pendente-fase14-integrado.log`; validação final da mensagem/captura em `output/pagamento-pendente-fase14-final.log`. Os logs estão na raiz do workspace. O servidor confirmou estoque final e vendas sem duplicação. Impeccable não encontrou achados mecânicos em `output/impeccable-fase14.json`.

## Limites

Trata registro de pagamentos manuais, sem cobrar Pix/cartão por provedor. Não concilia transações bancárias desconhecidas nem certifica dinheiro físico. A persistência após reinício foi testada no serviço; o ensaio Electron interrompeu a resposta HTTP e retomou na mesma sessão. Não substitui queda física da rede. Não remove tentativa recusada/corrompida automaticamente: conferência administrativa ainda pode ser necessária. Transferência desse diário para outro perfil mantém os bloqueios de recuperação; liberação controlada desse caso ainda precisa de integração própria.

## Planejamento atualizado

`README.md`, `ACOMPANHAMENTO-PENDENCIAS.md` e `PLANO-COMPLETO-FLOWPDV.md` retomam o projeto completo. `IMPECCABLE-ECOSSISTEMA.md` explicita Flow Gestor, Master, painel/cardápio web, consumidor, garçom/cozinha, PDVs, administração e site. Usar etapas com critério de conclusão e testes direcionados; evitar repetir fases aprovadas sem motivo.
