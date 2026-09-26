# Delivery — endereço, cotação e confirmação no cardápio

Implementado no projeto irmão `flowpdv-cardapio`, na rota local `/v2/{slug}/delivery`. O cabeçalho permite escolher retirada/delivery conforme a configuração pública. Os fluxos de mesa e retirada foram preservados.

O cliente monta o pedido, preenche nome/telefone/endereço e calcula a entrega. A tela separa valor dos produtos, taxa, prazo estimado e total. Alterar endereço ou carrinho invalida a cotação; confirmar exige nova consulta. O servidor continua conferindo os valores e versões.

## Recuperação e dados pessoais

Após falha de resposta, a intenção original permanece no armazenamento local para consultar o mesmo envio. Na recarga, os campos ficam bloqueados até resolver a pendência, mesmo se a loja tiver pausado o delivery. Ao confirmar, a intenção é removida e a confirmação salva não contém endereço/telefone. Antes do envio, os dados digitados ficam somente na memória da tela; atualizar a página exige preenchê-los novamente.

A consulta de endereço pelo caixa, cupons de entrega e gestão de saída/entregador ainda precisam de telas próprias. O garçom não foi implementado nesta entrega.

## Integração de configuração

Salvar a configuração de delivery atualiza `catalogos_publicos_v2/{slug}.canais.delivery`. Alterar os módulos gerais preserva a disponibilidade do delivery. A confirmação usa a revisão geral da configuração para recusar uma cotação anterior; preços do catálogo continuam sujeitos à própria versão.

## Validação

- Fluxo oculto do Electron com Vite e emuladores aprovado em `output/delivery-cardapio-interface.log`: mesa, pausa/reativação, endereço, CEP fora da área, taxa alterada, confirmação e reenvio após recarga/pausa sem duplicação.
- Pedido final único de R$ 18,50, com taxa revalidada de R$ 6,00 e endereço original preservado; intenção privada removida após confirmação.
- Capturas de endereço/cotação em 390 e 1280 pixels inspecionadas em `output/delivery-cardapio/`, sem rolagem horizontal.
- Build do cardápio aprovado em `output/delivery-cardapio-build.log`. O Vite ainda informa bundle acima de 500 kB; não houve otimização geral nesta entrega.
- 20 testes de regressão administrativa aprovados em `output/delivery-cardapio-configuracao.log`. Após corrigir a inicialização do catálogo vazio, os dois testes direcionados de delivery foram aprovados em `output/delivery-cardapio-configuracao-final.log`, incluindo preservação do canal ao salvar módulos gerais.

O cardápio V2 permanece limitado ao ambiente local de teste. Não houve publicação HTTPS nem validação em aparelho físico.
