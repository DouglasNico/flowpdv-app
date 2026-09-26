# Compatibilidade: evidências e pendências por segmento

Conferência de 22/09/2026. O código normal e os módulos V2 de homologação continuam separados. Escolher um segmento não ativa automaticamente canais de restaurante. O formulário administrativo mantém escolhas independentes para QR, retirada, garçom, KDS e impressão; delivery tem configuração própria.

| Escopo | Evidência local existente | O que ainda precisa de homologação |
| --- | --- | --- |
| Base comercial de todos os segmentos | Merge de produtos/clientes, movimentos de estoque sem duplicação, caixa, troco, inventário, troca de licença, busca e fila de sincronização na suíte legada | Aplicativo integrado com backup realista, queda efetiva de rede, periféricos e fechamento completo |
| Adega | Operações genéricas de produtos, venda e estoque preservadas | Fardos/embalagens, retornáveis, fiado e equipamentos efetivamente usados |
| Mercadinho | Estoque e inventário concorrentes testados no legado | Peso, balança/leitor, múltiplas unidades e códigos no aplicativo integrado |
| Padaria | Configuração por segmento e módulos opcionais validada no painel local | Venda por peso e mistura de balcão/alimentação com equipamento real |
| Roupas | Base comercial continua isolada dos módulos de restaurante | Variações, trocas, estoque e rotinas específicas no clássico/moderno |
| Lanchonete/restaurante | QR/mesa, retirada, delivery, garçom e fluxos financeiros testados localmente | Acesso operacional completo, restauração, impressão física, dispositivos reais e turno piloto |

`npm test` passou: 51 testes de núcleo legado e 26 testes de TEF simulado. Log: `output/compatibilidade-legado-final.log`. Erros de gravação/disco exibidos nesse log fazem parte de cenários de falha deliberados aprovados pelos testes.

As verificações legadas de payload fiscal/TEF não comprovam requisitos fiscais atuais, credenciamento ou homologação de fornecedor, nem significam integração dessas rotinas ao V2. O usuário ainda não definiu fornecedores fiscal e de pagamento.

Os 16 testes de proteção de perfis também passaram (`output/protecao-perfis-final.log`): separação do perfil fictício, restrição de rede/dispositivos e recusa de inicialização indevida. Isso preserva a loja real durante desenvolvimento, mas não substitui o teste de migração de uma loja para o fluxo novo.
