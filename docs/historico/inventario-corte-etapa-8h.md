# Etapa 8H — inventário de corte e saldo atual

A callable `conferirInventarioCorteV2` consulta até 100 produtos informados, com vínculo e acesso de caixa revalidados pelo servidor. Compara unidade e saldo inicial do snapshot com o plano de migração registrado. Retorna também o saldo atual, sem escrever em estoque, migração ou turno.

As situações são separadas:

- Vínculo conferido: identificação, unidade e saldo inicial correspondem à migração.
- Corte divergente: o snapshot traz outra quantidade inicial.
- Unidade divergente: origem, unidade convertida ou unidade atual não correspondem.
- Sem vínculo: o produto não possui migração nesta loja.

A diferença entre saldo de corte e saldo atual pode ser efeito normal de vendas, devoluções ou ajustes. O relatório não a trata como autorização para repor o saldo antigo e não substitui contagem física.

O painel de recuperação ganhou “Conferir estoque migrado”, com uma tabela de produto, corte, atual, variação e situação. Cada valor apresenta sua unidade; conversões preservam os milésimos. A conferência atual não aceita mais de 100 vínculos e não oculta registros excedentes.

Validações: 27 testes locais passaram em `output/etapa-8h-local.log`, incluindo os serviços de conferência e proteção. O diagnóstico financeiro também passou a detectar estorno local sem registro remoto, pendência de estorno já confirmada no servidor e venda repetida no arquivo. No servidor, 89 testes passaram em `output/etapa-8h-servidor.log`, incluindo a variação de 2500 para 2250 milésimos depois de vender, saldo inicial divergente, unidade divergente, vínculo ausente, produto duplicado e acesso de cozinha recusado.

Validação da tabela e confirmação visual do espaçamento em duas resoluções: passaram em `output/etapa-8h-interface.log`, com código 0 e marcadores `INVENTARIO CORTE UI PASS` e `RECUPERACAO CONFERENCIA UI PASS`. As capturas em `output/etapa-8g` foram inspecionadas: título visível abaixo do cabeçalho fixo, controles e tabela legíveis nas duas resoluções, sem transbordamento horizontal do diálogo. O runner confirmou também os saldos finais do servidor.

Limites: relatório de conferência em homologação local. Inventário físico, aprovação do corte de uma loja real, paginação e aplicação de correção de saldo permanecem pendentes. Nenhum saldo é corrigido automaticamente.
