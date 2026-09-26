# Recuperação — conferência remota e nova sessão

Continuação das [etapas 8A–8D](continuidade-etapas-8a-8d.md). Sem publicação, licença real ou operação financeira externa.

## 8E — conferência do backup com o servidor

`consultarRecuperacaoLocalV2` é uma callable somente leitura. Usa a autenticação e revalidação de terminal, membro e loja das operações financeiras. O UID vem da autenticação, nunca do arquivo ou do payload. Aceita referência do turno e até 50 vendas distintas e retorna seu estado atual, recibos e cancelamentos. Também busca vendas e estornos do próprio turno que não constem da lista, detectando operações posteriores ao backup. Mais de 100 registros por consulta de turno exige recuperação paginada; não retorna uma amostra como se fosse completa.

`conferencia-backup-v2.js` compara IDs, recibos, itens, valores, pagamentos e situação do turno. Classifica vendas/devoluções ausentes, divergências e tentativas a conferir. O resultado contém sempre `liberacaoOperacional: false`: diagnóstico não equivale a autorização para importar ou reprocessar pagamentos.

Validação: 16 testes locais passaram (`output/etapa-8e-local.log`), e 87 testes dos emuladores passaram (`output/etapa-8e-servidor.log`). A consulta identificou uma venda ausente no arquivo sem alterar estoque/turno e recusou outra identidade, cozinha, usuário sem vínculo e terminal revogado.

Escopo: turno atual do backup e vendas informadas; não é auditoria completa de histórico, inventário ou todos os turnos. Não há reconstituição automática de venda ausente.

## 8F — restauração isolada com autenticação nova

O ensaio passa a usar StorageService e a ponte reais com Auth, Firestore e Functions nos emuladores. Após perder uma resposta da baixa, confirmação ou cancelamento, captura o backup, restaura em armazenamento vazio e cria outra instância Firebase autenticada com o UID original. A retomada preserva ID, troco e efeito de estoque e encerra a pendência do turno.

O Admin do emulador emite o token de reautenticação exclusivamente na fixture de teste. O token não faz parte do backup e não é registrado no log. Isso não disponibiliza uma rota de emissão de tokens no aplicativo nem implementa transferência de equipamento para cliente real.

Validação: 88 testes de servidor passaram, incluindo os três cenários de recuperação, em `output/etapa-8f-servidor.log`. A autenticação usa uma instância Firebase nova e o armazenamento é vazio; não foi ensaiada reinstalação física em outro computador.

## 8G — diagnóstico no painel de teste

A seção “Conferência de recuperação”, em Pagamentos e turnos, permite consultar os dados do terminal ou conferir um arquivo JSON de homologação. Exibe turno, diferenças e pendências em linguagem legível. O arquivo é limitado a 10 MB e precisa corresponder à identidade atual; erros não alteram dados. Troca de acesso ou mudança dos dados locais durante a consulta exige nova conferência.

O fluxo não possui botão de restauração: a próxima integração precisa reconciliar histórico e movimentos posteriores ao snapshot. A seção não aparece na conferência de pagamento aberta pelo clássico/moderno, para não misturar diagnóstico administrativo com finalização de venda.

Testes locais: 19 passaram em `output/etapa-8g-local.log`; bundle gerado. A interface completa passou em `output/etapa-8g-interface.log`, com arquivo inválido recusado e dados preservados. As capturas em duas resoluções mostraram que o título ficava sob o cabeçalho fixo ao rolar até a seção. Foi acrescentada margem de rolagem e separação visual; a confirmação dessa correção acompanha a etapa 8H.

## Próximas dependências

1. Conferir inventário de corte e saldos atuais por produto/unidade.
2. Reconciliar histórico posterior ao backup e estornos, com paginação e identidade original.
3. Preparar recuperação administrativa quando o equipamento/identidade original não estiver disponível, sem clonar credenciais.
4. Integrar o perfil operacional e suas permissões preservando o aplicativo legado e os dois layouts.

As frentes 1 e 2 continuam em andamento; os testes não liberam piloto ou produção.
