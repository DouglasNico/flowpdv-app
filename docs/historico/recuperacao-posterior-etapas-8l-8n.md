# Movimentos posteriores ao backup — etapas 8L a 8N

## 8L — cópia com movimentos confirmados

`reconstruirBackupConfirmado` recompõe vendas e estornos confirmados ausentes do turno aberto em uma cópia do backup. Consulta somente o servidor; não registra venda, não confirma pagamento e não movimenta estoque. O arquivo original permanece intacto.

Valores, ajustes, formas de pagamento, dinheiro recebido e troco vêm do recibo remoto. A data usa o registro da venda no servidor, e os nomes/unidades vêm do cadastro do backup; essas origens ficam identificadas em `recuperacaoV2`. Não há promessa de recuperar informações que nunca foram guardadas no servidor, como o nome histórico exato de um produto ou uma numeração exclusivamente local.

Recusa pendências, vendas divergentes, produto ausente/ambíguo, data remota indisponível e mudanças de revisão durante a conferência. Reconstrução automática de turno fechado não está incluída. Estornos confirmados são incorporados como ajustes, preservando a venda original, sem devolver estoque novamente.

Validação: quatro testes locais específicos e dez testes da suíte de recuperação no servidor (`output/etapa-8l-servidor.log`). O ensaio integrado transfere a identidade e restaura um arquivo anterior à venda/devolução, mantendo saldo e quantidade de registros remotos.

## 8M — histórico de turnos

`listarTurnosRecuperacaoV2` lista somente turnos da identidade financeira autorizada. `conferirHistoricoBackup` compara referências locais/remotas e confere as vendas locais de cada turno. Identifica turnos ausentes do backup e turnos locais sem registro remoto; recusa duplicações e alterações de revisão entre consultas.

A restauração isolada passou a exigir esse diagnóstico sem divergências. O limite atual é de 50 turnos; acima dele o servidor recusa explicitamente, sem retornar lista truncada. Cada turno mantém os limites de conferência já existentes. Paginação ampliada segue pendente.

Isso não substitui a conferência dos totais de fechamento, sangrias legadas ou contas do restaurante: o escopo retornado é `vendas_locais_por_turno`, e a liberação operacional permanece falsa.

Validação: onze testes da suíte de recuperação aprovados (`output/etapa-8m-servidor.log`), incluindo identidade transferida, isolamento e limite de turnos. A conferência também recusa comprovante de outro turno mesmo quando os valores coincidem.

## 8N — painel de conferência e arquivo recuperado

O painel ganhou consulta do histórico local/do arquivo, preparação da cópia e salvamento após nova validação. Ao selecionar outro arquivo, consultar novamente ou trocar o acesso, a cópia preparada é descartada. Antes do download, identidade, movimentos e histórico são consultados novamente; mudança nos dados exige nova preparação.

A conferência de arquivo usa o ID lógico do terminal original presente no backup, condicionado à identidade financeira autorizada. Assim, o caixa substituto não precisa assumir as credenciais do anterior.

Validação: bundle compilado e fluxo completo aprovado em `output/etapa-8n-interface-final.log`. O teste confere três turnos, remove uma venda somente do arquivo de entrada, prepara a cópia com o registro ausente e verifica o conteúdo entregue ao download simulado. A troca de arquivo durante a consulta descarta a resposta atrasada. Os dados do caixa e os saldos remotos permanecem preservados.

As capturas `output/etapa-8n/copia-1366.png` e `copia-1024.png` foram revisadas em duas rodadas; resultado e ações de salvamento ficaram visíveis após a correção de rolagem. As rodadas anteriores identificaram um retorno não serializável no script de teste e uma mensagem de arquivo inválido que precisava indicar claramente a ausência de identidade; ambos foram corrigidos. A última rodada terminou com código zero, incluindo fechamento, cozinha, recebimento e transferência de terminal.

Agregado local de reconstrução/histórico/backup: 26 testes aprovados em `output/etapas-8l-8m-local-final.log`. O download foi interceptado no teste para verificar os bytes gerados sem gravar na pasta de downloads do usuário; isso não valida um diálogo de salvamento do sistema operacional. Nenhum arquivo é importado sobre o caixa aberto.

## Próximas dependências

- Restauração entre perfis do aplicativo, com reabertura segura e sem copiar credenciais.
- Conferência de fechamentos, movimentos do restaurante e registros locais legados.
- Reconstrução de turnos fechados/ausentes e paginação, sem inferir dados financeiros faltantes.
- Integração dos serviços ao perfil operacional e aos dois layouts normais.
