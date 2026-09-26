# Etapa 7A — revisão de acesso e preparação da migração

Esta entrega é local. É a primeira parte da etapa 7, não a conclusão da integração nem autorização para publicar.

## Correções aplicadas

As leituras operacionais V2 agora exigem uma loja ativa e um vínculo ativo com papel permitido. Para usuários humanos, exigem tipo `usuario`, e-mail verificado no token e ausência de cadastro de terminal para a mesma identidade. Para terminais, exigem tipo `terminal`, papel caixa/cozinha, cadastro ativo em `terminais_v2`, mesma loja e mesmo papel nos dois registros. Vínculos sem tipo são recusados: devem ser conferidos antes de migrar.

A recuperação do pareamento também recusa divergência de papel ou vínculo humano associado ao terminal. Um registro de membro remanescente, sozinho, não mantém acesso após desativar o cadastro do terminal.

Administradores por claim continuam com leitura para auditoria de lojas desativadas. A validação administrativa das funções consulta o usuário atual; as regras Firestore usam a claim do token, que pode persistir até sua renovação. Desabilitar somente o usuário no Firebase Auth não equivale a revogar instantaneamente todos os tokens de leitura. Para operadores, o bloqueio operacional deve atualizar o membro/terminal. Não há promessa de apagar dados que já tenham sido vistos ou copiados.

Catálogo publicado continua público; a pausa dos pedidos não torna os produtos secretos. Rotas privadas, fichas e escritas financeiras continuam restritas ao servidor. As regras e a autenticação das coleções legadas não foram migradas nesta entrega.

## O que a leitura do código revelou sobre a integração

| Área | Fluxo existente | Fluxo restaurante V2 | Trabalho necessário |
| --- | --- | --- | --- |
| Venda | `StorageService.saveVenda`, valores em reais e diário de commit local | Transação no servidor, valores em centavos | Identidade única de venda, origem e projeção de relatório, sem executar novamente a venda local |
| Turno | Turno local e lista de vendas; resumo em `caixa.js` | Venda identifica terminal, sem vínculo com turno legado | Definir turno do fechamento, abertura/fechamento e recuperação de falhas antes da soma no caixa |
| Estoque | Produtos, fatores de fardo e movimentos locais sincronizados | Insumos/fichas em milésimos, baixa transacional | Mapear unidades e IDs, conferir saldo de corte e escolher uma única origem de saldo por produto |
| Pagamento | Dinheiro, PIX, débito, crédito, fiado e divisões | Dinheiro, PIX manual e cartão manual | Não adivinhar débito/crédito de cartão genérico; ajustar classificação e conciliação |
| Estorno | Histórico e ajustes próprios do fluxo existente | Venda estornada com movimento inverso e reposição opcional | Refletir estorno uma única vez nos totais e preservar rastreabilidade |
| Sincronização | Mescla backups e movimentos entre terminais | Leituras em tempo real e funções transacionais | Evitar que o backup legado sobrescreva registros ou saldos novos |

**Não usar `saveVenda` para importar uma venda V2 já fechada:** essa função também baixa estoque e associa a venda ao turno local. Reexecutá-la produziria uma segunda baixa e poderia lançar no turno errado. Uma ponte de integração precisa projetar o resultado confirmado, com deduplicação por loja/venda, em vez de repetir efeitos financeiros.

## Continuação da etapa 7

1. Construir e testar a conciliação de vendas/estornos e vínculo com turnos, incluindo classificação de cartão manual e recuperação após queda.
2. Preparar simulação de migração com mapeamento de produtos/insumos/unidades, divergências de saldo e bloqueio de importação repetida. Só aplicar um corte após conferir o resultado.
3. Coordenar substituição da autenticação legada e permissões de administração; validar isolamento também nos caminhos antigos.
4. Testar impressora e equipamento reais com configuração conhecida. A demonstração continua sem impressão física.
5. Ensaiar backup/restauração e regressão dos segmentos existentes antes da etapa 8 (publicação/piloto).

A etapa 7 permanece em andamento. Delivery, aplicativo de garçom e demais recursos não implementados continuam fora do piloto atual.

## Verificação

Resultados: 66 testes de servidor/regras, 16 testes locais de isolamento/cupom, 51 testes do núcleo existente e 26 de TEF simulado aprovados. Evidências na pasta principal do workspace: `output/etapa-7a-backend.log`, `output/etapa-7a-local.log` e `output/etapa-7a-legado.log`. A validação de interface é registrada separadamente em `output/etapa-7a-interface.log`. Os testes antigos são regressões automatizadas; não equivalem à homologação de todos os equipamentos e segmentos em campo.


## Acompanhamento visível

Por solicitação do usuário, os próximos testes de interface devem ser executados visivelmente desde o início, com pausas entre ações. O modo automatizado oculto continua disponível para uso explícito, mas não atende ao acompanhamento ao vivo.

```powershell
$env:FLOWPDV_VISIBLE_TEST = '1'
powershell -NoProfile -File scripts/test-pairing.ps1 -Interface
```

Esse modo executa os mesmos testes no Electron com pausas de 1,6 segundo antes dos preenchimentos e cliques e encerra ao concluir. A demonstração livre, com PDV e cardápio lado a lado, é iniciada por `scripts/demo-local.ps1`. Não executar ambas simultaneamente: usam as mesmas portas. Os dados são fictícios e reiniciados entre sessões. A validação de interface oculta desta entrega passou; a execução visível tem evidência em `output/etapa-7a-interface-visivel.log`.

A execução visível também concluiu com sucesso: configuração, cozinha, fechamento, estorno, recuperação e revogação. Foram aprovados 159 testes automatizados de servidor e unidades (66 + 16 + 51 + 26), além do fluxo integrado de interface. Não houve deploy nem homologação de impressora física.

Continuação implementada: consulte [Etapa 7B — referência de turno e conferência financeira](conciliacao-turno-etapa-7b.md). Essa conferência prepara a integração, mas não substitui os relatórios oficiais antigos nem migra os saldos.
