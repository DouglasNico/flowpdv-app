# Etapa 7S — prontidão e caminho até a loja piloto

Escopo e acompanhamento atualizados: [Plano completo FlowPDV](../PLANO-COMPLETO-FLOWPDV.md), com as seis frentes do piloto e os recursos adicionais do produto completo.

Revisão local de 21/09/2026, após a etapa 7R. Esta é a referência consolidada de pendências; os documentos anteriores registram o estado histórico de cada entrega.

## Conclusão

O fluxo integrado foi validado com dados fictícios e serviços locais. Ainda não está pronto para ativação comercial. O PDV normal, o cardápio publicado e o instalador não receberam essa integração. Não houve publicação, migração real, impressão física ou transação financeira nesta revisão.

Não é correto atribuir um percentual de conclusão ou chamar este estado de “100% pronto”. O piloto de uma loja tem escopo menor que a expansão completa com delivery, garçom e todos os segmentos.

## O que já existe

| Recurso | Evidência e limite atual |
| --- | --- |
| Acesso por loja e terminal | Pareamento V2, permissões e revogação exercitados nos emuladores; autenticação legada ainda existe. |
| Cardápio QR e retirada | Catálogo, adicionais, observação, envio e acompanhamento implementados na rota V2 local. A rota recusa produção. |
| Recebimento no PDV | Pedido vinculado à conta/mesa sem reaplicação após recarga, coberto pelo fluxo de interface. |
| Cozinha | Fila, cupom, segunda via e KDS opcionais; saída de papel ainda simulada. |
| Configuração por cliente | Cardápio, mesas, retirada, KDS e impressão configuráveis. Informar um segmento não implementa suas regras comerciais. |
| Financeiro e estoque | Pagamento manual, troco, divisão, ajustes, cancelamento, estorno, turno e consumo remoto integrados no teste. |
| Carrinho | Vários produtos, edição, remoção, rascunho, recuperação e nova conferência após recarga. Limite de 30 produtos diferentes. |
| Clássico e moderno | Usam o mesmo carrinho e conferência no teste; visual principal do clássico preservado. ESC retorna ao PDV e F4 confere sem registrar automaticamente. |
| Migração de saldo | Conversões e retomada testadas com produtos fictícios. Não houve inventário ou corte de uma loja real. |

## Escopo proposto para o primeiro piloto

Uma lanchonete, um terminal de caixa, catálogo pequeno, pedidos por mesa/QR e retirada, pagamento conferido manualmente e um processo de cozinha escolhido pela loja. KDS e impressão são independentes. Delivery, garçom e TEF integrado ao fluxo V2 ficam fora desse primeiro recorte. Trata-se de proposta de escopo, não de configuração já aplicada a um cliente.

Se a loja escolher QR → cupom na cozinha, a homologação da impressora é obrigatória. Sem KDS, deve ficar definido como a equipe atualiza o andamento: imprimir não significa preparar ou entregar.

## Seis etapas restantes até o piloto

### 1. Acesso e ativação controlada — próxima implementação

Separar os serviços operacionais das proteções exclusivas do laboratório, criar ativação explícita por loja e integrar o provisionamento e os papéis ao aplicativo normal. Coordenar a transição das credenciais antigas com as regras e rotas V2. Não basta retirar verificações de `ambienteTeste`.

Aceite: loja autorizada acessa os módulos; outra loja e terminal revogado não acessam; instalação normal sem ativação conserva seu fluxo; versões antigas e novas têm uma política de transição testada. Não publicar a mudança antes dos demais aceites.

### 2. Backup, restauração e corte de dados

Ensaiar recuperação em perfil limpo/outro computador com saldo, vínculo de produtos, turnos, vendas e operações pendentes. Definir qual saldo é a fonte oficial e impedir que restaurações e sincronização antigas o sobrescrevam. Estabelecer inventário de corte, relatório de divergências e procedimento de recuperação após falha.

Aceite: totais, IDs e pendências permanecem reconciliáveis após restauração; não há nova baixa nem receita duplicada. A recuperação após recarregar a mesma tela, já testada, não substitui esse ensaio.

### 3. Compatibilidade do varejo e operação sem conexão

Homologar o que cada segmento realmente usa nos dois layouts. Para adega: embalagens/fardos e retornáveis, se aplicáveis. Para mercado/padaria: unidades, peso e periféricos utilizados. Para roupas: variações e trocas utilizadas. Conferir fiado, descontos, relatórios e integrações existentes conforme o escopo da loja, sem presumir suporte na ponte nova.

Definir e testar o comportamento sem conexão: informar estado pendente, impedir repetição e recuperar ao reconectar. O fluxo de estoque central depende de confirmação do servidor; não há evidência de operação V2 completa offline.

Aceite: matriz por segmento com resultado e evidência; toda função necessária ao piloto funciona ou fica explicitamente fora de seu escopo. O legado ter passado em testes não homologa equipamentos nem todas as combinações comerciais.

### 4. Cardápio e QR utilizáveis pelo cliente

Preparar ambiente de homologação HTTPS, autenticação e configuração apropriadas, catálogo realista, categorias, fotos e ordenação conforme o piloto. Trocar o endereço local do QR por URL pública da loja. Validar aparelhos reais, navegadores suportados, rede móvel, reconexão, múltiplas abas, pausa do cardápio e alterações de preço.

Aceite: celular do cliente envia e acompanha um único pedido sem expor credenciais; alterações e pausas são respeitadas no servidor. QR de `127.0.0.1` não serve para celulares de clientes. Publicação externa será uma ação separada da preparação local.

### 5. Equipamentos e recuperação operacional

Testar o modelo e conexão da impressora escolhida, 58/80 mm, acentos, corte, falta de papel, desligamento e reconexão. Conferir leitor, teclado e demais periféricos realmente usados. Validar terminal responsável, disputa de fila, segunda via e concorrência com o cupom do caixa.

Aceite: roteiro físico registrado; falha incerta exige conferência sem reimpressão silenciosa. Depende dos equipamentos da loja. TEF e fiscal exigem validação própria caso entrem no escopo, pois simulação não comprova operação real.

### 6. Implantação e piloto acompanhado

Validar o runtime de destino, pacote/instalador, Functions, regras e índices como um conjunto versionado. Preparar backup, recuperação, logs, acompanhamento de erros e consumo, parâmetros por loja, suporte e treinamento. Ensaiar o procedimento antes de aplicá-lo à loja piloto.

Aceite: iniciar e encerrar um turno completo, reconciliar pedidos/vendas/estoque/caixa, executar cenários de falha e aprovar o resultado com a loja. Reversão deve preservar e reconciliar vendas já realizadas; não significa restaurar cegamente saldo antigo.

Só depois desses aceites liberar o piloto. Essas seis etapas são frentes de trabalho e podem exigir subetapas; não representam seis mudanças pequenas nem uma estimativa de prazo.

## Expansão posterior ao primeiro piloto

| Área | Trabalho ainda necessário |
| --- | --- |
| Delivery próprio | Endereço, área e taxa, pedido mínimo, prazo, entrega, atribuição de entregador, cancelamento e acompanhamento. |
| Garçom | Autenticação/papéis, lançamento por mesa, adicionais, observações e concorrência entre dispositivos. |
| Pagamentos integrados | Cobrança, confirmação, conciliação e estorno pela integração escolhida. Pix manual não é confirmação automática. |
| Fiscal | Conectar e homologar a emissão aplicável ao fluxo novo; não presumir que a integração antiga o cobre. |
| Catálogo e escala | Ampliar paginação e limites, testar volume, mais terminais e rotinas operacionais. |
| Gestão comercial | Planos e permissões por funcionário, relatórios adicionais e recursos específicos priorizados por segmento. |

Não foi reavaliada nesta etapa a paridade com o BeeFood nem a infraestrutura interna daquele fornecedor. O objetivo da revisão é a prontidão deste código.

## Hospedagem e custos

Esta revisão não exige contratação de hospedagem: é possível continuar o desenvolvimento no laboratório atual. Não foi feita consulta de planos, preços ou cotas nesta etapa. Portanto, não há garantia aqui de produção gratuita para uma, duas ou três lojas. Antes da implantação, verificar as condições vigentes de hospedagem, Functions, banco, imagens e tráfego e estimar o consumo do piloto. Trocar de hospedagem, sozinho, não resolve as pendências funcionais e de sincronização.

## Base verificada nesta revisão

- `src/js/app.js`: inicialização do painel de teste desvia do fluxo normal.
- `runtime-profile.cjs`: aplicativo empacotado recusa o perfil de teste.
- `src/js/venda-servidor-teste.js`: ponte exige ambiente de teste e limita o carrinho.
- `src/js/cozinha-teste.js`: painel exclusivo do teste e estados de impressão simulada.
- `firestore.rules`: coexistência de autorização V2 e caminho legado baseado no e-mail da loja.
- Projeto irmão `flowpdv-cardapio/src/lib/v2.js`: exige desenvolvimento, modo de teste e localhost/127.0.0.1.
- `functions/package.json`: Node 20 declarado. Os registros de execução documentam Node 24 local; compatibilidade do runtime de publicação ainda deve ser validada.

Logs existentes foram conferidos, não reexecutados nesta revisão documental: etapa 7Q com 86 testes locais; etapa 7R com 41 testes locais e fluxo completo de interface concluído com código 0; etapa 7N com 82 testes de servidor. Essas suítes se sobrepõem: seus totais não devem ser somados como testes distintos. Nenhuma evidência de uso físico ou produção é inferida desses resultados.

## Próxima entrega concreta

Preparar a arquitetura de ativação por loja e a matriz de transição do acesso legado para V2, identificando os pontos de inicialização, autorização, configuração e recuperação. Implementar o primeiro trecho isoladamente com testes de loja autorizada, loja não autorizada e terminal revogado. Manter o perfil normal protegido enquanto a integração não satisfizer os aceites acima.

Primeiro trecho implementado: [Etapa 7T — contrato de ativação por loja](ativacao-operacional-etapa-7t.md). A consulta preparatória de homologação não conclui a etapa 1 nem libera produção.
