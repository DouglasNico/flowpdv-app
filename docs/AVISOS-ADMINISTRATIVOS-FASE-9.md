# Fase 9 — reimpressão e endereço do cliente

- `src/js/gerencia.js`, `reimprimirFechamentoAuditoria`: não substitui turno solicitado ausente pelo último turno. Retorna o resultado do módulo de impressão e remove anúncio antecipado/duplicado; distingue turno inexistente de impressão indisponível.
- `src/js/clientes.js`, `copiarEndereco`: aguarda cópia, trata falha/recurso indisponível e orienta cópia manual; sucesso só após confirmação da API.
- `test/notificacoes-impressao.test.cjs`: cenário adicional impede imprimir fechamento errado e afirmar envio antecipado. 8 testes aprovados.
- `src/js/bundle.js`: recompilado com sucesso.

Sem publicação ou ensaio físico de impressora. Os demais cadastros/configurações ainda precisam de revisão ampliada.
