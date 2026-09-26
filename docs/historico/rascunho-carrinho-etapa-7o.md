# Etapa 7O — recuperação do carrinho em edição

O carrinho local do perfil de teste salva automaticamente os produtos, quantidades, campos de pagamento, desconto, acréscimo e motivo no armazenamento local deste terminal. Textos ainda incompletos, como `10,`, são preservados para continuar a edição.

## Recuperação e isolamento

Cada rascunho pertence à loja autorizada, terminal, turno e data de abertura. O painel só recupera o rascunho após consultar a autorização do terminal. Rascunhos de outra loja, terminal ou turno não são carregados; iniciar um novo turno não transporta o carrinho anterior automaticamente.

Após recarregar ou reabrir o mesmo perfil do aplicativo no mesmo turno, os campos são restaurados e a confirmação fica desmarcada. É obrigatório conferir novamente. O rascunho não armazena preços, total, autorização, identificador de venda nem confirmação. Os produtos e preços são consultados novamente na base local, a migração é revalidada e o estoque continua sendo conferido pelo servidor ao registrar. Produtos indisponíveis não são substituídos ou retirados silenciosamente.

O aviso do painel distingue rascunho salvo, recuperado e falha de gravação. Falhas não são tratadas como salvamento concluído. Rascunhos inválidos são preservados no armazenamento até o descarte explícito. **Descartar rascunho** e **Limpar carrinho** removem o rascunho do contexto atual e limpam itens, pagamentos e ajustes, sem movimentar caixa ou estoque.

## Passagem para venda pendente

A tentativa de venda é gravada de forma durável antes de remover o rascunho e antes de pedir a baixa remota. Se a gravação da tentativa falhar, o rascunho permanece. Se a remoção do rascunho falhar, a tentativa fica pendente e nenhuma nova baixa é solicitada nessa execução.

Uma tentativa pendente tem prioridade sobre a recuperação de rascunho. Retomar a venda ou seu cancelamento tenta remover o rascunho novamente antes de continuar. Assim, uma interrupção entre gravação local, resposta do servidor e confirmação não reapresenta a tentativa enviada como um novo carrinho.

## Limites e próxima etapa

Armazenamento local do perfil de teste, sem sincronização de rascunhos entre computadores e sem reserva de estoque. Limpar os dados do aplicativo remove esses dados locais. Rascunhos de turnos anteriores não são retomados pelo painel atual. A recuperação depende de usar o mesmo perfil, loja, terminal e turno e de confirmar o acesso. Não há edição simultânea coordenada entre várias janelas.

Próxima etapa sugerida: integrar os fluxos validados à tela operacional de venda, preservando os bloqueios de teste e a separação dos segmentos. Isso ainda requer validação própria antes de qualquer publicação.

Implementação seguinte: [primeira integração ao balcão — etapa 7P](balcao-operacional-etapa-7p.md).

## Validação

Testes locais cobrem persistência, isolamento por contexto, texto incompleto, exclusão de confirmação e preço, limites, dados corrompidos, falha de disco e passagem para tentativa pendente. O fluxo oculto da interface verifica recuperação de itens, pagamentos e ajustes, nova conferência obrigatória e remoção do rascunho depois da venda.

159 testes distintos aprovados: 82 locais e 77 do legado. Compilação concluída e fluxo completo da interface oculta aprovado com recarga, recuperação de dois produtos, desconto, acréscimo e pagamento dividido. A tentativa sem nova conferência foi bloqueada, e a venda final removeu o rascunho sem duplicar vendas ou estoque. Os emuladores foram encerrados normalmente.

O teste também identificou e levou à correção de uma corrida na recarga: o formulário agora permanece oculto enquanto o acesso é consultado, impedindo que a restauração substitua uma edição iniciada antes de recuperar o contexto.

Evidências: `output/etapa-7o-local.log`, `etapa-7o-legado.log`, `etapa-7o-bundle.log`, `etapa-7o-interface.log` e `etapa-7o/rascunho-recuperado.png`.
