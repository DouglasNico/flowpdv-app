# Etapa 7T — contrato de ativação por loja

Primeiro trecho da etapa 1 do roteiro do piloto, implementado localmente em 21/09/2026. Não conclui a migração de acesso nem ativa o aplicativo normal.

## Implementação

A callable `consultarAtivacaoOperacionalV2` consulta a autorização de homologação da loja do terminal autenticado. O payload não escolhe loja, papel ou módulos. A consulta revalida a conta no Auth e lê terminal, loja e membro em uma transação. Recusa conta desativada, terminal revogado, loja inativa, membro inativo, membro humano ou papel divergente.

O servidor só considera a configuração `lojas_v2/{lojaId}.ativacaoOperacionalV2` válida quando todos os campos correspondem a:

```json
{"schema":1,"estado":"habilitada","ambiente":"homologacao","revisao":1}
```

A revisão deve ser inteiro positivo. Ausência, suspensão, versão desconhecida, revisão inválida e ambiente de produção resultam em homologação não autorizada. O resultado sempre contém `producaoHabilitada: false` nesta entrega.

Esse registro foi criado somente pelas massas fictícias dos testes. Não existe botão nem nova API de gravação da ativação nesta etapa; a autorização não pode ser atribuída pelo terminal. Não editar manualmente uma loja real seguindo o exemplo.

## Capacidades retornadas

| Capacidade | Condição adicional à homologação válida |
| --- | --- |
| Balcão | Terminal de caixa |
| Mesas e retirada | Terminal de caixa e respectivo módulo ativo na loja |
| KDS | Configuração de KDS ativa |
| Impressão | Impressão ativa e UID do terminal igual ao terminal designado |

Os campos são a interseção das configurações existentes com o papel. Não habilitam delivery, garçom, cobrança automática ou emissão fiscal. A resposta contém apenas IDs operacionais, papel, revisão, motivo e capacidades; não retorna licença, tokens ou configuração completa da loja.

**A consulta é preparatória, não uma nova barreira global de autorização.** Nenhum consumidor operacional foi conectado a ela e as callables existentes continuam com suas validações atuais. Não anunciar que suspender esse registro já bloqueia todas as operações V2. Uma resposta obtida anteriormente também não é uma autorização permanente ou válida offline.

## Matriz de transição

| Ponto atual | Próximo trabalho | Proteção a manter |
| --- | --- | --- |
| `app.js`: painel de teste desvia da inicialização normal | Criar entrada operacional explícita por loja após acesso confirmado | Sem autorização ou com erro de consulta, não inicializar novos módulos |
| `pareamento-teste.js`: identidade V2 do terminal | Extrair o serviço de sessão do painel do laboratório | Não derivar identidade privada da URL, licença ou formulário |
| Nova consulta de ativação | Conectar controlador de capacidades e revogação | Não confiar em armazenamento local como autorização |
| `configuracao-v2.js`: módulos da loja | Preparar comando administrativo de ativação com revisão e auditoria | Configurar módulo não equivale a autorizar entrada em produção |
| Callables de pedido, cozinha, venda e turno | Aplicar política por operação, distinguindo nova operação e recuperação | Suspensão não pode simplesmente tornar irrecuperável uma venda já persistida |
| `firestore.rules`: caminhos V2 e legados coexistem | Ensaiar a transição coordenada de identidades e clientes | Não revogar acesso legado antes de preparar atualização e recuperação |
| `runtime-profile.cjs`: teste só em desenvolvimento | Manter laboratório isolado e definir perfil operacional próprio | Não remover a barreira do teste para fabricar uma release |
| Ponte de estoque, backup e sincronização | Integrar conforme etapas seguintes do roteiro | Não permitir dois caminhos de baixa nem restauração de saldo antigo sobre o novo |

O aplicativo normal continua na inicialização anterior. Não há consulta remota nova no seu login, dependência nova de rede ou mudança visual nesta entrega. O contrato só existe nas Functions locais até publicação futura coordenada.

## Critérios e testes

Testes acrescentados à suíte `configuracao-v2.test.cjs` exercitam a callable real nos emuladores:

- configuração ausente e payload forjado não autorizam;
- configuração suspensa ou incompatível não autoriza;
- loja autorizada retorna capacidades conforme papel e terminal da impressora;
- outra loja não herda autorização, mesmo enviando ID da loja autorizada;
- identidade sem pareamento e gerente humano não são tratados como terminal;
- escrita direta da autorização pelo cliente é recusada pelas regras;
- revogação do terminal, membro incompatível, loja inativa e conta desativada são revalidados.

Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pairing.ps1 -Configuracao`. Resultado: 104 testes de servidor e regressão passaram, com código de saída 0. Outros 13 testes de isolamento e proteção da interface normal passaram: `node --test test/pairing-ui-guard.test.cjs test/runtime-profile.test.cjs`. Total desta execução: 117 testes, sem falhas. Evidências: `output/etapa-7t-backend.log` e `output/etapa-7t-isolamento.log`. Não foi aberta interface para este trecho de servidor.

## Próxima entrega

Preparar a ativação administrativa com revisão concorrente e auditoria, e especificar a suspensão para novas operações sem impedir a recuperação das pendências. Depois conectar o controlador operacional, ainda em homologação. Produção permanece bloqueada até completar os aceites da etapa 7S.

Comando administrativo implementado na [etapa 7U](administracao-ativacao-etapa-7u.md), ainda sem conectar o bloqueio às operações nem ativar produção. A ausência de API de gravação descrita acima registra o estado ao final da etapa 7T.
