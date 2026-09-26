# Recuperação administrativa de caixa — etapas 8I e 8J

Escopo: homologação local com emuladores. Não publicado em produção.

## Transferência no servidor (8I)

O gerente verificado da loja consulta origem/destino e confirma uma transferência com revisão e motivo. O destino precisa ser um caixa novo autorizado, sem histórico financeiro. A transação revoga o terminal anterior, mantém a identidade financeira original no novo terminal e grava auditoria. Não copia senha, token, credencial ou saldo.

A identidade autenticada continua sendo a do novo equipamento. O servidor resolve a identidade financeira por registro de delegação conferido em cada operação. O cliente não escolhe essa identidade no payload. Uma segunda transferência preserva a origem financeira; repetir uma transferência antiga retorna seu recibo sem reativar o equipamento anterior.

Primeira validação corrigida: `output/etapa-8i-servidor-validacao.log`, 64 testes aprovados, incluindo recuperação de baixa pendente, revogação, isolamento entre lojas, escrita direta recusada, concorrência e segunda transferência. A primeira rodada falhou por ausência do nome do produto no fixture, corrigido antes dessa validação.

## Journal e interface (8J)

O pedido administrativo é salvo antes de enviar. Após falha de conexão, resposta divergente, mudança de sessão ou falha de disco, o registro permanece disponível para conferência/repetição pelo mesmo gerente e loja. Nova tentativa não substitui silenciosamente a anterior. O journal não entra no backup financeiro e impede sua captura enquanto pendente.

A seção de recuperação no painel de acesso exige conferência do plano e confirmação da transferência. Alterar loja/origem/destino ou fazer login/logout invalida o plano. A interface avisa que a transferência não restaura os arquivos locais. Um replay informa que a tentativa anterior foi concluída e solicita consulta do acesso atual, pois pode ter ocorrido outra transferência depois dela.

Validação ampliada: `output/etapa-8i-8j-servidor.log`, 66 testes aprovados, incluindo perda da resposta da transferência seguida de reconstrução do serviço e repetição do mesmo pedido. A comparação do payload persistido é independente da ordem das propriedades do mapa.

Testes locais: `output/etapa-8j-local.log`, 25 aprovados. Bundle compilado (`output/etapa-8j-bundle.log`). Fluxo Electron completo aprovado em `output/etapa-8j-interface.log`, com verificação final no servidor de uma única transferência e preservação dos saldos e vendas. Capturas `output/etapa-8j/transferencia-1366.png` e `transferencia-1024.png` inspecionadas: seção e botões legíveis, sem transbordamento horizontal.

## Limites e próximo trabalho

- Restauração em outro armazenamento continua um ensaio isolado; não há importação sobre o perfil aberto.
- Registros posteriores ao backup são detectados, mas ainda não reconstruídos automaticamente.
- Conferência atual cobre um turno e possui limites explícitos de volume.
- Transferência por gerente vale somente para lojas com adesão explícita à homologação.
- As frentes de integração ao login normal, recuperação entre perfis e migração legada permanecem abertas.
- Equipamentos físicos, implantação e homologações fiscal/pagamento permanecem etapas externas próprias.
