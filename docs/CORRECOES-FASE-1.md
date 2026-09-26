# Fase 1 — CSV, categorias, auditoria de vendas e sangria

Atualização posterior: a janela de interrupção entre commit e auditoria descrita neste relatório foi tratada na [fase 8](AUDITORIA-RECUPERACAO-FASE-8.md), para novas vendas. O restante deste documento preserva o registro da fase 1.

Data: 22/09/2026. Solicitação: continuar o desenvolvimento por fases, registrar alterações e suspender a publicação.

## Alterações

- `src/js/estoque.js`, `confirmarImportacaoMassa`: captura o total antes de limpar o modal, corrigindo a mensagem de zero importados. Normaliza espaços e diferenças de maiúsculas nas categorias, mantém o nome já cadastrado, remove o marcador de exclusão de categorias explicitamente importadas e chama a sincronização de categorias da licença, como no cadastro manual. Categoria vazia utiliza Geral.
- `src/js/storage.js`, `saveVenda`: registra `venda_realizada` após o commit local com identificador, total, forma de pagamento e turno. O retorno antecipado para uma venda já existente evita log duplicado. Falhas de auditoria não desfazem a venda concluída.
- `src/js/gerencia.js`, filtro de auditoria: inclui `venda_realizada` em Vendas/Operação.
- `src/js/caixa.js`, `realizarSangria`: preenche o saldo somente para gerente; para operador limpa o texto e oculta o bloco, inclusive após troca de perfil. `confirmarSangria`: mantém a validação de valor, mas a mensagem de rejeição não revela o saldo.
- `index.html`: remove o valor inicial do campo de saldo de sangria.
- `src/js/bundle.js`: regenerado com `npm run bundle`.
- `test/correcoes-operacionais-fase1.test.cjs`: testes com armazenamento em memória e módulos reais para importação de 60 itens, categorias, auditoria sem duplicação/falso sucesso e sigilo de sangria.

## Verificação

- 3 testes novos + 7 testes de recuperação operacional: 10/10 aprovados.
- Suíte central `node test/run-tests.js`: 51/51 aprovados.
- Bundle gerado com sucesso.
- Sem teste com CSV real do usuário, Firebase ao vivo ou aplicativo instalado nesta rodada. Sincronização externa foi simulada nos testes. Não houve publicação, push ou geração de instalador.

## Limites e continuidade

As causas verificadas da categoria invisível incluem marcador de exclusão e ausência da chamada de sincronização da licença no importador; o arquivo original do usuário não foi reproduzido. A correção vale para novas importações e novas vendas; não recria logs históricos nem altera automaticamente categorias de produtos já importados. Uma interrupção do processo entre commit e auditoria ainda pode deixar uma venda sem log; recuperação transacional da auditoria exige fase própria. Ocultar o saldo na interface não restringe acesso técnico ao armazenamento local.

Próxima validação manual: importar CSV em ambiente de teste, conferir categorias na Gerência, concluir uma venda e consultar Logs > Vendas, abrir F9 como operador e testar retirada acima do disponível. Para alterações visuais futuras, Impeccable está disponível; Higgsfield não está integrado nesta sessão.
