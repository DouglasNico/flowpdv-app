# Fase 4 — primeira rodada de avisos administrativos

22/09/2026. Trabalho local, sem publicação.

- `src/js/cloud-sync.js`: busca manual informa licença ausente, pacote inexistente e falha de leitura/aplicação; antes de aplicar, rejeita pacote de outra loja ou troca de licença durante a consulta. Sucesso permanece posterior à aplicação. Erro na aplicação manual de sincronização deixa orientação persistente. Mensagens online/offline não prometem disponibilidade de todos os recursos nem confundem rede restabelecida com sincronização concluída.
- `src/js/estoque.js`: sucesso de CSV identifica o salvamento neste computador, mantendo a contagem corrigida.
- `src/js/app.js`: confirmação dos dados da empresa identifica salvamento local.
- `src/js/backup.js`: erro de backup não atribui toda falha à conexão e orienta conferir a data do último backup confirmado.
- `src/js/bundle.js`: recompilado.
- `test/avisos-sincronizacao.test.cjs`: quatro testes cobrem licença/base ausente, falha na leitura ou aplicação, pacote incompatível/troca de loja e sucesso. Dependências remotas e persistência simuladas; não houve alteração em base real.

Validação: 4/4 testes novos e 3/3 testes da fase 1 aprovados; bundle gerado. Não houve ensaio remoto do Firebase. O recebimento legado continua sem transação única para todas as gravações: erro não garante ausência de aplicação parcial; por isso a mensagem não promete rollback. Recuperação ampla permanece no plano.

Próximos avisos: cadastros, importação XML, restauração e demais configurações. Resumo completo para acompanhamento criado em `ACOMPANHAMENTO-PENDENCIAS.md`.
