# Auditoria técnica do FlowPDV — diagnóstico e plano de correção

Data: 14/09/2026. Projeto: `adega-pdv-gestao`, versão declarada 3.2.22, commit de referência `61c821e`.

**Resultado: 26 achados agrupados, sustentados por 30 cenários reproduzidos em isolamento. Há falhas de segurança, cobrança, fechamento de caixa, sincronização e recuperação. Nenhuma correção foi aplicada.**

## Escopo e evidência

Foram examinados os fluxos de vendas, pagamentos, caixa, fiado, estoque, inventários, importação, comandas, licenciamento, autenticação, sincronização, backup, fiscal, balança, impressão e etiquetas. As referências abaixo apontam para as linhas do código local analisado.

- Verificação de sintaxe dos 25 arquivos JavaScript de execução: 25.788 linhas físicas, incluindo comentários e espaços. Todos passaram.
- Verificação de sintaxe de outros 29 scripts auxiliares: 3.786 linhas. Todos passaram. Esses scripts não receberam a mesma profundidade de revisão funcional dos fluxos principais e não foram executados.
- Leitura das regras do Firestore, configuração de empacotamento e trechos pertinentes da interface HTML.
- Compilação completa do aplicativo somente em memória: passou, sem avisos. O resultado coincide com o `src/js/bundle.js` existente, normalizadas as quebras de linha.
- Os **32 testes existentes passaram**. Seu ponto de entrada cobre principalmente armazenamento e regras de mesclagem; isso não comprova os fluxos completos da aplicação.
- **30 reproduções adicionais confirmaram comportamentos incorretos**, identificados por R01–R30. Foram usados métodos do código original, com armazenamento em memória, dados fictícios, DOM simplificado e serviços externos substituídos. São reproduções de defeitos, e não testes que certificam o comportamento desejado.
- Não foram feitas chamadas de escrita ao Firebase, vendas reais, emissões fiscais, cobranças, instalações ou mudanças no código do aplicativo. Os arquivos desta auditoria ficam em `output/auditoria`, fora da pasta do aplicativo. O estado Git permaneceu igual ao início da auditoria.

Esta revisão combina análise estática, leitura dos fluxos e execução isolada. **Não equivale a certificar manualmente cada linha de todo o repositório nem garante ausência de outros bugs.** A configuração efetivamente publicada do Firebase, o instalador distribuído, os equipamentos e a operação real ainda precisam de validação própria. Os riscos de produção indicados abaixo dependem de o código analisado estar em uso.

Prioridades: **P0** = bloqueador para uso real do recurso afetado; **P1** = alto risco de valores incorretos, perda de dados ou acesso indevido; **P2** = confiabilidade e gestão. A ordem é uma recomendação; nada foi desativado.

## Achados e correções propostas

### F01 · P0 · Consulta e desvinculação de licenças sem autenticação

**Evidência:** R24 e R25. A consulta por CNPJ, sem `request.auth`, devolveu a licença fictícia completa, incluindo chave e PIN de gerente. Outra chamada sem autenticação removeu um terminal da licença fictícia. Isso ocorreu somente no simulador local do backend.

**Causa e impacto:** `buscarLicenca` e `desvincularTerminal` não verificam o chamador. A consulta espalha todos os campos do documento. Além disso, o aplicativo deriva as credenciais de máquina da chave e de uma constante distribuída; as regras autorizam a loja pela correspondência do e-mail. Em conjunto, existe um caminho de acesso aos dados da loja a partir da licença exposta. Não foi tentado acesso a uma loja real nem verificado se essas funções estão publicadas.

**Plano:** exigir identidade e autorização sobre a loja/terminal; separar ativação inicial da consulta administrativa; devolver apenas os campos necessários; emitir credenciais por terminal pelo servidor e vincular a autorização a identificadores/claims confiáveis. Após fechar a exposição, avaliar revogação das credenciais e PINs afetados e revisar os acessos. Limitação de tentativas complementa a autorização. A chave pública de configuração do Firebase, isoladamente, não foi considerada um segredo vazado.

**Aceite:** chamadas anônimas ou de outra loja não consultam dados sensíveis nem alteram terminais; ativação legítima continua funcionando; usuário não consegue escolher um e-mail e obter privilégios apenas por essa correspondência.

**Código:** [functions/index.js:30](/D:\FLOWPDV-0809\adega-pdv-gestao/functions/index.js:30), [consulta:69](/D:\FLOWPDV-0809\adega-pdv-gestao/functions/index.js:69), [desvinculação:81](/D:\FLOWPDV-0809\adega-pdv-gestao/functions/index.js:81), [credenciais:43](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/firebase-config.js:43), [regras:20](/D:\FLOWPDV-0809\adega-pdv-gestao/firestore.rules:20).

### F02 · P0 · NFC-e aparece autorizada sem autorização externa

**Evidência:** R01. Com o ambiente configurado como produção, `emitirNFCe` retornou `autorizada` sem comunicação com um autorizador.

**Causa e impacto:** chave, protocolo e QR são montados localmente; o resultado de sucesso é produzido pelo próprio módulo. O PDV confia nesse resultado. O teste de conexão também usa uma espera e exibe sucesso sem testar o serviço. A configuração `autoEmitirAoFinalizar` é salva, mas a decisão de emissão do PDV considera apenas módulo e habilitação.

**Plano:** separar explicitamente o simulador; impedir autorização de produção sem resposta válida do provedor; implementar fila persistente, identificação única por emissão, tratamento de rejeição/timeout e reconciliação. Respeitar a opção de emissão automática.

**Aceite:** sem resposta externa confirmada, a venda nunca recebe autorização fiscal; repetição da tentativa não gera emissão duplicada; simulação é identificada em tela e comprovante.

**Código:** [fiscal.js:221](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/fiscal.js:221), [emissão:294](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/fiscal.js:294), [resultado:366](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/fiscal.js:366), [PDV:2681](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2681).

### F03 · P0 · TEF produz aprovação local

**Evidência:** R02. Sem o modal disponível, uma transação retornou sucesso automaticamente. O caminho de aprovação pelo modal também cria NSU/autorização localmente, sem confirmação de adquirente.

**Impacto:** o sistema pode tratar uma simulação como pagamento confirmado. Há ainda um único par de callbacks para transações e a remoção de um pagamento não solicita reversão.

**Plano:** isolar a simulação, integrar o terminal/provedor real, permitir apenas uma transação pendente por terminal e persistir seu estado. Tratar cancelamento, reversão, timeout e resposta tardia antes de permitir o fechamento da venda.

**Aceite:** ausência de hardware, recusa ou timeout não aprovam pagamento; resposta duplicada não duplica cobrança; remoção de pagamento integrado segue o fluxo de reversão.

**Código:** [tef.js:51](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/tef.js:51), [aprovação:113](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/tef.js:113), [remoção:2240](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2240), [botões:4092](/D:\FLOWPDV-0809\adega-pdv-gestao/index.html:4092).

### F04 · P1 · Fechamento soma venda de outro turno

**Evidência:** R03. Um turno sem vendas próprias contabilizou R$ 80 de outro turno que ocorreu no mesmo horário.

**Causa:** a seleção aceita a venda pelo intervalo de datas, mesmo sem pertencer ao turno/terminal. Isso contamina o fechamento em operações simultâneas.

**Plano e aceite:** relacionar cada venda ao turno e terminal; migrar registros antigos com tratamento explícito. Dois caixas abertos ao mesmo tempo devem fechar apenas suas próprias vendas, incluindo vendas com horários iguais.

**Código:** [caixa.js:113](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/caixa.js:113), [filtro:123](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/caixa.js:123).

### F05 · P1 · Troco descontado duas vezes

**Evidência:** R04. Venda de R$ 100: PIX de R$ 60 e dinheiro de R$ 40, recebido R$ 50 com R$ 10 de troco. O fechamento contabilizou R$ 30 em dinheiro; deveria contabilizar R$ 40.

**Causa:** o PDV armazena `pagamento.valor` líquido, mas o fechamento subtrai o troco novamente. A apuração de gaveta contém lógica semelhante.

**Plano e aceite:** padronizar valor recebido, valor aplicado à venda e troco; centralizar a apuração em centavos inteiros. Validar dinheiro puro, múltiplas parcelas, PIX + dinheiro e troco, tanto no caixa quanto no comprovante.

**Código:** [caixa.js:140](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/caixa.js:140), [lançamento:2327](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2327), [gaveta:2765](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2765).

### F06 · P1 · Venda pode ficar parcialmente gravada

**Evidência:** R05. Uma falha simulada de armazenamento deixou a venda registrada, mas o estoque permaneceu em 10 em vez de baixar para 8.

**Causa e impacto:** venda, turno, movimentação e produto são gravados separadamente. O fiado pode ser atualizado antes da venda. O erro pede nova tentativa, que gera outro ID, podendo duplicar efeitos que já foram persistidos.

**Plano:** usar transação local ou diário de operações com recuperação; manter ID estável entre tentativas; confirmar o conjunto venda/pagamento/estoque/fiado antes do sucesso e enviar à nuvem por fila persistente.

**Aceite:** injetar falha e encerramento em cada etapa; ao reabrir, a operação fica completa ou não aplicada, nunca pela metade; repetir a tentativa produz uma única venda.

**Código:** [storage.js:343](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:343), [fiado:2659](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2659), [tratamento de erro:2706](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2706).

### F07 · P1 · Troca de empresa mantém estado da loja anterior

**Evidência:** R06. Após limpar os dados e salvar a licença B, `getProdutos()` ainda devolveu produtos da loja A pelo cache em memória.

**Causa e impacto:** a limpeza remove chaves locais, mas não `_produtosMem` e todo o estado do carrinho. Se o carregamento da nova loja falhar, dados antigos continuam disponíveis. Categorias e PIN da nova loja também são gravados antes da confirmação do backup da anterior.

**Plano e aceite:** preparar a troca sem modificar a loja ativa; salvar a anterior; cancelar tarefas antigas; limpar memória/carrinho/pagamentos e carregar dados isolados por loja. Uma troca com falha deve preservar integralmente a loja anterior ou manter a nova bloqueada até carregar, sem mistura.

**Código:** [cache:252](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:252), [limpeza:1011](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:1011), [ativação:1005](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/licenca.js:1005).

### F08 · P1 · Compras fiadas simultâneas perdem lançamentos

**Evidência:** R07. Saldo inicial de R$ 100; dois terminais acrescentam R$ 30 e R$ 20. A mesclagem resultou em R$ 120, em vez de R$ 150, descartando parte do histórico.

**Causa:** a versão mais recente do cliente substitui o objeto inteiro, incluindo saldo e histórico.

**Plano e aceite:** registrar débitos e recebimentos como eventos com IDs próprios; calcular o saldo a partir deles. Duas vendas ou pagamentos simultâneos, offline e reenviados devem manter todos os lançamentos exatamente uma vez. Definir separadamente a política de limite de crédito durante operação offline.

**Código:** [merge-core.js:81](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/merge-core.js:81), [sincronização:1032](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:1032).

### F09 · P1 · Sincronização deixa pendências e pula movimentos

**Evidência:** R12: uma chamada com 650 movimentos enviou 300 e deixou 350 para chamadas futuras. R13: com 3.000 movimentos, a recuperação devolveu 2.150 e avançou a marca até o último, pulando 850 no intervalo.

**Causa:** envio limitado aos últimos 300 sem esvaziar a fila na mesma execução; download junta os primeiros 2.000 aos últimos 150 e usa a maior data como marca de progresso, sem percorrer as páginas intermediárias. Os limites de retenção de IDs enviados e movimentos também diferem.

**Plano:** enviar do mais antigo até esvaziar a fila, com confirmação por lote; baixar todas as páginas antes de avançar o cursor; usar ordenação estável e identificar movimentos recebidos tardiamente. Descartar dados apenas quando houver garantia de inclusão em checkpoint.

**Aceite:** 10 mil movimentos, timestamps iguais, relógios diferentes, falha no meio e terminal offline por vários dias devem convergir sem perdas ou aplicação duplicada. Não declarar sincronização completa com pendências restantes.

**Código:** [envio:426](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:426), [consulta:449](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:449), [marca:498](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:498).

### F10 · P1 · Inventário reaberto ou editado volta ao estado anterior

**Evidência:** R08: inventário reaberto voltou a `concluido` na mesclagem. R09: uma linha excluída reapareceu ao receber a cópia antiga.

**Causa:** a prioridade fixa dos estados prevalece sobre a reabertura mais recente; linhas são unidas sem um registro de exclusão.

**Plano e aceite:** versionar transições e reaberturas; persistir exclusões; identificar unicamente o processamento de cada sessão. Validar reabertura e remoção em dois terminais, inclusive após desconexão. O processamento simultâneo da mesma sessão também merece ensaio específico: o bloqueio observado é local.

**Código:** [reabertura:139](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/inventario.js:139), [processamento:147](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/inventario.js:147), [mesclagem:374](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/merge-core.js:374).

### F11 · P1 · Fardo e unidade excedem juntos o estoque disponível

**Evidência:** R10. Com seis unidades em estoque, foi aceito um fardo de seis mais uma unidade avulsa: sete unidades no carrinho.

**Causa:** o limite considera separadamente as linhas de fardo e unidade. A baixa limita o estoque a zero e pode esconder o excesso vendido.

**Plano e aceite:** converter todas as apresentações do produto para a unidade base, somar o carrinho e validar novamente no fechamento. Com saldo seis, fardo de seis + unidade deve ser bloqueado ou seguir uma política explícita de estoque negativo.

**Código:** [pdv.js:581](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:581), [alteração de quantidade:664](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:664), [baixa:363](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:363).

### F12 · P1 · Preço unitário do clube aplicado ao fardo inteiro

**Evidência:** R11. Fardo de R$ 50 e preço unitário do clube de R$ 8: total calculado para o fardo foi R$ 8.

**Causa:** `precoClube` é aplicado ao item sem considerar a apresentação. O desconto do clube também não integra o mesmo campo de desconto gravado na venda.

**Plano e aceite:** definir preço promocional por apresentação ou conversão explícita; registrar descontos de forma consistente. Validar unidade, fardo, peso e desconto manual, conferindo que subtotal menos descontos equivale ao total em tela, venda e cupom.

**Código:** [pdv.js:1026](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:1026), [persistência:2645](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2645).

### F13 · P1 · Backup e restauração não recompõem a base integralmente

**Evidência:** R14. A carga inicial de uma nova empresa recebeu uma comanda no backup, mas restaurou zero comandas.

**Outros pontos estáticos:** o exportador chamado completo não inclui comandas, inventários, movimentos/checkpoints e todos os marcadores de exclusão. Na importação local, `turnoAtual: null` não limpa um turno preexistente. A restauração em nuvem pode repor o turno do documento sem verificar sua identidade de terminal e manter marcadores de sincronização incompatíveis com o estoque restaurado.

**Plano:** criar formato versionado e completo, validar loja e terminal, restaurar de forma atômica e reconstituir os marcadores corretamente. Manter cópias históricas independentes do estado sincronizado atual.

**Aceite:** exportar e restaurar em ambiente vazio deve preservar quantidades e vínculos de todas as entidades; backup sem turno deve resultar em nenhum turno aberto; sincronizar após restaurar não deve perder nem reaplicar movimentos.

**Código:** [exportação:934](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:934), [importação:1034](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/storage.js:1034), [carga de loja:875](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:875), [restauração:163](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/backup.js:163).

### F14 · P1 · Balança mantém peso antigo ao receber zero

**Evidência:** R15. Após 0,650 kg, uma mensagem com peso zero manteve 0,650 kg.

**Causa e impacto:** o parser só atualiza quando o valor é maior que zero. Também processa cada bloco serial isoladamente, sem montar mensagens fragmentadas. Isso permite reaproveitar uma leitura antiga.

**Plano e aceite:** zero deve zerar a leitura; montar mensagens completas, distinguir erro/instabilidade e expirar leituras antigas. Validar remoção do produto, tara, mensagem dividida, desconexão e nova pesagem. Seleção de porta e compatibilidade por modelo precisam de teste em hardware; hoje é usada a primeira porta previamente autorizada.

**Código:** [balanca.js:244](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/balanca.js:244), [parser:272](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/balanca.js:272).

### F15 · P1 · Reimportar o mesmo XML duplica a entrada

**Evidência:** R16. A mesma nota, importada duas vezes com duas unidades, elevou o estoque de zero para quatro.

**Causa:** a chave da nota é lida, mas não existe controle de entrada já aplicada no fluxo de confirmação; contas também podem ser criadas novamente.

**Plano e aceite:** registrar a nota por loja + chave de acesso e vincular seus efeitos em uma única operação. Repetição, clique duplicado e importação em dois terminais devem produzir uma entrada e um conjunto de contas. Retificação deve ser uma ação própria, rastreável.

**Código:** [confirmação:490](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/xml-importer.js:490), [estoque:535](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/xml-importer.js:535), [financeiro:596](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/xml-importer.js:596).

### F16 · P1 · Planilha tem colunas deslocadas e erro ao atualizar produto

**Evidência:** R17: atualização de produto lançou `precoClube is not defined`. R18: um CSV com as 11 colunas do modelo, estoque 20 e mínimo 3, foi interpretado como estoque 3; o código de barras do fardo desapareceu.

**Causa:** o modelo e o leitor XLSX usam 11 colunas, mas a desestruturação espera 12 ao inserir `precoClube`. Esse valor não é incorporado corretamente ao produto e é referenciado fora de seu escopo na confirmação. O CSV também é dividido por separador sem tratar campos entre aspas.

**Plano e aceite:** compartilhar esquema entre modelo e leitor, mapear por cabeçalho/versão, validar prévia, preço de clube e campos fracionados. O próprio modelo exportado deve voltar sem mudança de valores. Atualizar produto existente, importar nomes com separador e reimportar a planilha devem funcionar de forma previsível; ajustes de saldo precisam entrar no histórico de estoque.

**Código:** [modelo:2217](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2217), [CSV:2389](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2389), [colunas:2407](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2407), [mapeamento:2438](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2438), [variável indefinida:2618](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2618).

### F17 · P1 · Ajuste de estoque descarta casas decimais

**Evidência:** R19. Estoque de 1 kg, entrada digitada de 0,75 kg: saldo ficou em 1 kg, em vez de 1,75 kg.

**Causa:** `parseInt` elimina a fração. A importação de saldo usa a mesma estratégia de inteiro.

**Plano e aceite:** trabalhar com precisão definida por unidade de medida, aceitar e validar o separador decimal brasileiro, impedir valores inválidos. Entrada, perda, balanço, importação e venda de 0,125 kg devem preservar a quantidade exata.

**Código:** [ajuste:1809](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:1809), [importação:2461](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2461).

### F18 · P2 · Curva ABC apresenta faturamento que não corresponde à venda

**Evidência:** R20. Cortesia com total zero e item de R$ 50 gerou R$ 50 de faturamento na curva ABC.

**Causa:** soma de quantidade × preço de tabela, sem reconciliar tipo da operação, descontos e total. O agrupamento também usa o nome, podendo juntar produtos diferentes ou separar um produto renomeado.

**Plano e aceite:** definir receita bruta/líquida, separar recebimento de fiado de nova venda, distribuir descontos quando necessário e agrupar pelo ID. Reconciliar ABC e relatórios com vendas, cortesias e recebimentos conhecidos.

**Código:** [gerencia.js:466](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/gerencia.js:466).

### F19 · P2 · Baixa repetida duplica próxima despesa recorrente

**Evidência:** R21. Executar duas vezes a baixa da mesma despesa criou duas próximas parcelas.

**Causa:** não há proteção para conta já paga nem chave única para a próxima competência.

**Plano e aceite:** tornar a baixa repetível sem efeitos duplicados, identificar a série e competência e proteger a transição de estado. Clique repetido, reenvio e dois terminais devem gerar uma única próxima parcela.

**Código:** [gerencia.js:948](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/gerencia.js:948).

### F20 · P1 · Exclusões podem ser desfeitas pela sincronização

**Evidência:** R22. Uma despesa excluída reapareceu ao mesclar uma cópia antiga da nuvem.

**Causa:** excluir significa remover da lista, enquanto sincronizar significa unir os IDs. O mesmo padrão está presente na exclusão de funcionários e sua mesclagem, podendo restaurar um acesso apagado.

**Plano e aceite:** persistir exclusão com versão/data e propagá-la antes de limpar definitivamente; preferir desativação explícita para acesso de funcionário. Excluir offline e sincronizar com outro terminal antigo não deve recriar a entidade nem o acesso.

**Código:** [exclusão de despesa:1013](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/gerencia.js:1013), [mesclagem:176](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/merge-core.js:176), [exclusão de funcionário:763](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:763), [sincronização de usuários:981](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/cloud-sync.js:981).

### F21 · P1 · Fechar comanda apaga consumo acrescentado durante a cobrança

**Evidência:** R23. Um item foi enviado ao pagamento; outro foi lançado na mesa depois disso. Finalizar a cobrança do primeiro apagou também o novo item, que não estava sendo cobrado.

**Causa:** a transferência copia um retrato dos itens; a liberação posterior zera a comanda atual inteira, sem conferir versão ou itens pagos. A transferência também substitui diretamente o carrinho existente.

**Plano e aceite:** identificar sessão de atendimento e itens; bloquear alterações durante cobrança ou dar baixa apenas nos itens efetivamente pagos; proteger carrinho em andamento. Dois operadores e lançamento tardio não podem eliminar consumo não cobrado.

**Código:** [transferência:1161](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/comandas.js:1161), [liberação:1212](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/comandas.js:1212), [chamada no PDV:2695](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/pdv.js:2695).

### F22 · P1 · Gerador de barras perde informação do código

**Evidência:** R26. Os códigos distintos `A123` e `1123` geraram SVGs de barras idênticos.

**Causa:** cada caractere vira `charCode % 16`, seguido por um padrão inventado. Essa transformação tem colisões e não implementa um codificador EAN/Code 128. A aparência de código de barras não comprova que ele representa o produto.

**Plano e aceite:** usar um codificador de simbologia adequada, validar o conteúdo e preservar o código interno. Testar leitura por decodificador independente e leitor físico nas dimensões reais da etiqueta, com códigos numéricos e alfanuméricos. Códigos diferentes não devem produzir o mesmo símbolo.

**Código:** [etiquetas.js:430](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/etiquetas.js:430).

### F23 · P2 · Erro de impressão pode ser ignorado

**Evidência:** R27. O IPC devolveu `{success:false}` e o módulo não entrou no tratamento de falha. Ele só observa rejeição da Promise; o processo principal resolve a Promise mesmo quando a impressão falha.

**Outro ponto estático:** a função de abertura de gaveta depende de `sendRawPrinterData`, ausente no preload; o caminho alternativo apenas escreve no console.

**Plano e aceite:** conferir o resultado de impressão e informar falha/cancelamento; permitir reimprimir sem refazer a venda. Implementar a abertura física da gaveta ou apresentar o recurso como indisponível. Validar impressora desligada, cancelamento, timeout e pulso de gaveta em equipamento real.

**Código:** [impressão:113](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/thermal-print.js:113), [gaveta:140](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/thermal-print.js:140), [IPC:512](/D:\FLOWPDV-0809\adega-pdv-gestao/main.js:512), [preload:7](/D:\FLOWPDV-0809\adega-pdv-gestao/preload.js:7).

### F24 · P1 · Revogar funcionário não revoga a sessão ativa

**Evidência:** R28. Depois de salvar o funcionário como inativo e retirar sua permissão, a sessão em memória continuou permitindo cancelamento de venda.

**Causa:** `temPermissao` usa o objeto capturado no login; salvar/sincronizar usuários não reconcilia necessariamente a sessão ativa.

**Plano e aceite:** invalidar/revalidar a sessão quando cargo, PIN, permissões ou situação forem alterados; conferir autorização antes do efeito sensível. A revogação recebida pela sincronização deve impedir imediatamente novas operações protegidas; definir a política quando o terminal estiver offline.

**Código:** [auth.js:93](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:93), [sessão:422](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:422), [salvar funcionário:697](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:697).

### F25 · P1 · Cancelar consumo da comanda não consulta permissão

**Evidência:** R29. Um operador com verificação de permissão configurada para negar conseguiu zerar a comanda pelo método usado no botão; nenhuma verificação foi chamada.

**Causa:** remover item e liberar/cancelar comanda não usam o controle de permissão/PIN empregado no PDV. A confirmação de intenção não substitui a autorização do gerente.

**Plano e aceite:** definir permissões de remoção e cancelamento de consumo, verificar no método que modifica os dados e registrar o autorizador. Operador sem permissão não deve descartar itens ou zerar mesa sem autorização válida.

**Código:** [botão:390](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/comandas.js:390), [remoção:840](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/comandas.js:840), [cancelamento:864](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/comandas.js:864).

### F26 · P1 · Dados importados entram na interface como HTML

**Evidência:** R30. Um nome de produto contendo marcação HTML inofensiva foi incorporado diretamente a `innerHTML` na prévia da planilha. Nenhum script malicioso foi executado no ensaio.

**Causa e impacto:** também existem interpolações sem escape de fornecedor/nome/EAN na prévia XML e de nome/loja nas etiquetas. Isso permite alterar a estrutura da página e constitui caminho para injeção de conteúdo ativo quando o campo contém esse conteúdo. O aplicativo expõe funções operacionais globais e pontes do Electron, aumentando o impacto possível. Não foi demonstrada execução de código nativo.

**Plano:** usar nós de texto e propriedades DOM para dados; tratar escape pelo contexto quando HTML for necessário; substituir handlers montados com strings. Revisar CSP, navegação, sandbox e validação dos argumentos/origem do IPC; restringir protocolos/URLs de `openExternal`.

**Aceite:** nomes contendo aspas, `<`, `>`, `&` e marcação devem aparecer como texto; arquivo importado não cria elementos nem executa eventos; páginas não confiáveis não acessam funções privilegiadas.

**Código:** [planilha:2547](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/estoque.js:2547), [XML:290](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/xml-importer.js:290), [atributos:349](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/xml-importer.js:349), [etiquetas:473](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/etiquetas.js:473), [janela:101](/D:\FLOWPDV-0809\adega-pdv-gestao/main.js:101), [openExternal:18](/D:\FLOWPDV-0809\adega-pdv-gestao/preload.js:18).

## Plano de execução recomendado

| Etapa | Trabalho proposto | Condição para avançar |
|---|---|---|
| 1. Proteger acesso e distinguir simulações | F01–F03 e F26; confirmar o que está publicado, corrigir autorização das funções, separar integrações simuladas e fechar entrada de HTML | Testes de acesso entre lojas negam operações; nenhuma simulação aparece como autorização real |
| 2. Garantir preservação de dados | F06–F10, F13, F20, F21 e F24; transações locais, IDs estáveis, fila completa, exclusões e restauração coerentes | Queda em qualquer etapa e dois terminais convergem sem perder ou duplicar operações; restauração ensaiada |
| 3. Reconciliar cobrança e estoque | F04, F05, F11, F12, F14–F19 e F25; corrigir valores, apresentação do produto, importações e permissões | Venda, pagamento, caixa, estoque e fiado fecham com os mesmos dados de referência |
| 4. Validar periféricos e preparar versão | F22–F23; testes reais de etiqueta, impressão, gaveta, balança, TEF e fiscal em ambiente apropriado; instalador e atualização | Recursos confirmados em equipamento real; plano de retorno e backup testados antes da distribuição |

Na implementação futura, começar cada correção com o teste que expressa o comportamento esperado, mantendo os ensaios desta auditoria como evidência do defeito anterior. Evitar uma alteração única envolvendo todos os módulos: separar mudanças revisáveis, respeitando as dependências entre armazenamento, sincronização e cálculos.

Não é prudente estimar uma data única para tudo sem definir os provedores reais de TEF/fiscal e a estratégia de persistência. Correções como variável indefinida e casas decimais são localizadas; transações, sincronização e integrações exigem desenho e validação mais extensos.

## Melhorias e riscos que pedem validação adicional

Estes pontos não entram na contagem das 30 reproduções:

1. **Processamento simultâneo de inventário e edição simultânea da mesma mesa:** há verificação local de sessão e mesclagem da mesa inteira pela versão mais recente. Ensaiar duas máquinas desconectadas e o reencontro das versões antes de escolher a estratégia de conflito. Referências: [inventário:147](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/inventario.js:147) e [mesclagem de mesas:221](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/merge-core.js:221).
2. **Proteção de PINs e trilha de auditoria:** PINs são persistidos recuperáveis e os clientes autorizados podem atualizar/apagar logs da própria loja nas regras atuais. Planejar verificação de credencial protegida, limitação de tentativas e registro de eventos sensíveis com integridade no servidor, considerando o funcionamento offline. Referências: [PIN:127](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:127), [armazenamento:738](/D:\FLOWPDV-0809\adega-pdv-gestao/src/js/auth.js:738) e [regras de auditoria:78](/D:\FLOWPDV-0809\adega-pdv-gestao/firestore.rules:78).
3. **Privilégio administrativo por e-mail:** a lista de administradores não exige `email_verified`. Avaliar a configuração de cadastro e se endereços permitidos poderiam ser reivindicados indevidamente; preferir privilégio emitido pelo servidor. Não houve tentativa de cadastro. Referências: [backend:14](/D:\FLOWPDV-0809\adega-pdv-gestao/functions/index.js:14) e [regras:5](/D:\FLOWPDV-0809\adega-pdv-gestao/firestore.rules:5).
4. **Atualizações com resultado enganoso:** erros de consulta como 404 são convertidos em “versão mais recente”. Separar “não foi possível verificar” de “já atualizado”; validar recuperação do instalador e atualização com caixa em uso. Referência: [main.js:397](/D:\FLOWPDV-0809\adega-pdv-gestao/main.js:397).
5. **Qualidade contínua:** adicionar análise de variáveis não definidas, validação dos esquemas persistidos e testes de cenários críticos ao processo de build. Sintaxe válida não detectou `precoClube` fora de escopo. Manter migrações versionadas, métricas de operações pendentes/falhas e dados fictícios representativos de dois terminais.
6. **Dependências e distribuição:** fazer análise de dependências e teste do instalador/atualizador em ambiente separado. Não foi feita consulta a bases de vulnerabilidades nem auditoria do código de terceiros; não há neste relatório afirmação de CVE específica. Scripts de manutenção com acesso a dados devem ganhar modo de simulação, escopo explícito e proteção contra execução acidental antes de serem usados.

## Arquivos de evidência

- [Resultados das 30 reproduções](/D:/Backups/1409/FlowPDV/output/auditoria/reproducoes-resultados.json).
- [Código dos ensaios isolados](/D:/Backups/1409/FlowPDV/output/auditoria/reproducoes.cjs).
- [Inventário dos 25 arquivos de execução](/D:/Backups/1409/FlowPDV/output/auditoria/inventario.json).
- [Verificação dos scripts auxiliares e compilação](/D:/Backups/1409/FlowPDV/output/auditoria/empacotamento.json).
- [Hashes das fontes analisadas](/D:/Backups/1409/FlowPDV/output/auditoria/fontes-sha256.json).
- [Executor dos testes existentes sem sobrescrever artefatos do aplicativo](/D:/Backups/1409/FlowPDV/output/auditoria/revisar.cjs).

Para repetir localmente a análise isolada, a partir de `D:\Backups\1409\FlowPDV`, executar `node output/auditoria/revisar.cjs`, depois `node output/auditoria/reproducoes.cjs`. Esses executores escrevem suas evidências na pasta desta auditoria e substituem armazenamento e serviços por objetos de teste; não iniciam o PDV nem conectam ao Firebase.

**Entrega atual: diagnóstico e plano. Todas as correções propostas permanecem por implementar.**
