# Etapa 7W — ativação no painel de homologação

O painel **Administrar loja • teste** passa a oferecer a seção **Ativação da homologação**. Nenhum controle foi adicionado ao aplicativo normal e não houve publicação.

## Operação

Após entrar como gerente e carregar a loja, o painel mostra o estado e a revisão da ativação. Loja antiga sem adesão é identificada como compatibilidade anterior. Configuração incompatível impede nova alteração pela tela e orienta revisão administrativa.

Para habilitar ou suspender, selecione o estado, informe o motivo e marque a confirmação. A revisão enviada é a carregada no servidor. O comando mantém as verificações de conta, gerência, loja e concorrência das etapas anteriores. Produção continua desabilitada.

A consulta administrativa existente agora retorna a configuração de ativação e um indicador de presença do campo. Isso distingue uma loja sem adesão de uma configuração presente e inválida; a revisão da ativação é independente da revisão dos demais recursos.

## Falhas e recuperação

- Antes de enviar, a tentativa completa é persistida no perfil de teste, por UID gerencial e loja. Se a persistência falhar, nenhuma chamada é feita.
- Erro de rede ou resposta incerta preserva a tentativa. A tela oferece **Retomar alteração pendente**, sem permitir montar outra alteração por cima. Recarga do aplicativo mantém o registro; entre com o mesmo gerente e carregue a mesma loja.
- A retomada usa o mesmo identificador e conteúdo. Não se presume que uma resposta perdida significa que o servidor recusou a alteração.
- Conflito de revisão ou payload recusado definitivamente limpa a tentativa e recarrega o estado; o operador precisa conferir e marcar a confirmação novamente.
- Erro de permissão preserva o registro para conferência. Trocar de usuário ou loja não transfere a tentativa para outra identidade.
- Depois do sucesso, o painel consulta o estado atual. Isso evita mostrar o resultado de uma operação antiga reutilizada como se fosse o estado mais recente.
- Registro local inválido impede envio e exige conferência administrativa; não é apagado silenciosamente.

O formulário de carregamento invalida a configuração anterior antes da consulta e rejeita resposta se a loja ou a identidade mudou. Ainda não existe sincronização automática entre painéis administrativos: use **Atualizar estado**; conflitos são protegidos pelo servidor.

## Escopo e limites

Suspensão segue a etapa 7V: bloqueia novas entradas de pedido e venda para lojas aderentes, preservando as operações de recuperação autorizadas. Não revoga identidades, não cancela pedidos, não fecha turnos e não constitui publicação em produção.

O histórico é gravado no servidor pelo comando administrativo; a listagem visual desse histórico não foi incluída nesta seção. A integração do controlador às telas operacionais e a migração de acesso continuam pendentes.

## Verificação

Testes locais cobrem resposta perdida, recarga, payload imutável, isolamento por usuário/loja, conflito, permissão revogada e falha de persistência. O fluxo de interface oculta exercita suspensão, habilitação, atualização da revisão, conflito e nova confirmação; depois percorre os fluxos existentes de cozinha, vendas, caixa e recuperação com a loja habilitada. Capturas em duas dimensões ficam em `output/etapa-7w`.

Evidências: `output/etapa-7w-local.log`, `etapa-7w-bundle.log` e `etapa-7w-interface.log`. Resultado: 17 testes locais passaram, bundle gerado e fluxo completo de interface oculta concluído com código 0. Capturas revisadas em janelas de 1366 × 768 e 1024 × 768. O log registra `ATIVACAO UI PASS` e os cenários existentes de cozinha, recebimento, caixa, pagamento e recuperação também concluíram.

Próxima etapa: apresentar suspensão e retomada nas telas operacionais de teste, conectando a consulta de capacidades sem impedir a recuperação das pendências. A ativação no aplicativo normal continua separada da homologação.

Continuação implementada: [Etapa 7X — acesso operacional](acesso-operacional-etapa-7x.md).
