# Plano de combos e promoções — FlowPDV

Data: 23/09/2026. Status: cadastro, catálogo e ciclo de pedido/recebimento/venda/estoque/estorno implementados e testados no V2 local. Ligação do cardápio atualmente publicado ao V2 e homologação de produção pendentes; nenhuma publicação desta etapa.

## Objetivo e decisões acordadas

Concentrar preços e composição no PDV. O painel do cardápio escolhe o que divulgar, sem exigir o cadastro dos mesmos preços novamente.

- Master libera o módulo Combos por licença. Sugerir ativo para novas lojas de alimentação; permitir escolha manual do administrador por loja. Não alterar licenças existentes automaticamente.
- No PDV: valor individual, “Oferecer como combo”, valor total do combo, acompanhamentos fixos, bebidas permitidas e quantidades incluídas.
- Também no PDV: valor promocional individual e valor promocional do combo, ambos opcionais e independentes.
- No painel do cardápio: No cardápio, Mais pedido, Promoção e Esgotado. Promoção usa os valores recebidos do PDV, sem campo duplicado para editá-los.
- Sem preço promocional válido, não permitir ativação e explicar que o valor deve ser cadastrado no PDV.
- Publicação continua explícita: salvar cadastro/enquadramento/configuração não equivale a publicar.
- Promoções são independentes do módulo Combos e podem atender outros segmentos.

## Exemplo de referência

| Opção | Normal | Promocional |
| --- | ---: | ---: |
| X-Burger individual | R$ 18,90 | R$ 16,90 |
| Combo: lanche + batata pequena + 1 bebida permitida | R$ 30,90 | R$ 27,90 |

A bebida permitida é inclusa: não acrescentar seu preço avulso. Bacon e outros adicionais pagos continuam separados. Se existir promoção apenas do individual, o combo mantém seu preço normal. O preço total do combo substitui o valor individual; não somar os dois nem acumular descontos.

## Fase 1 — mapear os fluxos e fechar o contrato de dados

- Confirmar o caminho de catálogo/pedidos usado pela loja e sua integração ao PDV; distinguir o cardápio publicado atual de módulos V2 locais ou ainda não ativados.
- Mapear cadastro, backup/sincronização, publicação, API de pedido, recebimento, venda, cancelamento e estoque nos fluxos envolvidos.
- Definir dados versionados para combo, componentes por ID real de produto, quantidades, preços e promoção. Valores monetários devem ter normalização única e cálculo sem erros de ponto flutuante.
- Definir tratamento de produto removido/inativo, bebida indisponível, composição incompleta e configurações antigas de combo no painel.
- Pack/Fardo continua com sua regra atual de múltiplas unidades do mesmo produto. Combo terá composição própria, sem reinterpretar registros de fardo.

## Fase 2 — Master e permissões

- Acrescentar Combos à aba Módulos e persistir na licença, aproveitando a estrutura existente.
- Ajustar a identificação do segmento de alimentação para incluir pizzarias com clareza.
- Sincronizar a permissão com o PDV e respeitá-la na publicação e no servidor de pedidos; esconder o campo sozinho não é suficiente.
- Desativação preserva cadastros e pedidos históricos, mas impede novas ofertas/vendas de combo pelos canais abrangidos. Planejar invalidação da oferta já publicada e tratamento de terminais offline antes da implementação.

## Fase 3 — cadastro no PDV

- Organizar preço individual e campos opcionais de combo/promoção, com máscara em reais.
- Selecionar acompanhamentos e bebidas por produtos existentes; guardar IDs e quantidades, não apenas nomes copiados.
- Configurar bebidas permitidas e limite de escolha (primeira versão: escolher uma bebida).
- Cadastrar preço total do combo; o acréscimo em relação ao individual é derivado automaticamente quando necessário para apresentação.
- Validar valores não negativos, promoção inferior ao respectivo preço normal e composição válida. Não oferecer bebida com preço avulso somado ao combo incluso.
- Preservar PDV Moderno, PDV Clássico e atendimento; implementar nos fluxos aplicáveis sem unificá-los visualmente à força.

## Fase 4 — sincronização e painel do cardápio

- Transportar os dados do PDV e incorporá-los ao catálogo publicado com versão compatível.
- Exibir preços recebidos como informação e permitir ativar Promoção no painel.
- Mostrar prévia “De / Por” para individual e combo conforme os preços cadastrados.
- Manter publicação explícita e explicar quando há mudanças ainda não publicadas.
- Tratar combos antigos do painel com migração assistida/mapeamento seguro; não converter escolhas textuais automaticamente em produtos de estoque.

## Fase 5 — cardápio público e validade

- Seção Promoções antes de Mais pedidos, com carrossel, preço anterior riscado, preço vigente destacado e selo discreto.
- Manter produto em sua categoria normal com o mesmo preço vigente; reutilizar enquadramento de foto e comportamento responsivo existente.
- Modal distingue individual e combo; combo apresenta acompanhamentos e escolhas incluídas. Carrinho deve preservar essa distinção.
- Prever início/fim opcionais de promoção, com fuso definido. Proposta: cadastro dos preços no PDV e ativação/agendamento por canal no painel. A localização final do agendamento deve ser confirmada ao desenhar o cadastro.
- Após publicar um período, início/fim devem ser avaliados sem exigir nova publicação e sem polling adicional frequente. Servidor é a autoridade sobre a validade.
- Se a promoção expirar com o carrinho aberto, informar o novo total e exigir confirmação antes de concluir o pedido.

## Fase 6 — pedido, cobrança e estoque

- Recalcular preços no servidor usando catálogo e permissão válidos; não confiar no total enviado pelo navegador.
- Validar variante escolhida, bebida permitida, quantidade e adicionais; evitar soma do preço avulso da bebida ou desconto duplicado.
- Guardar no pedido um retrato dos preços e componentes usados, para mudanças futuras não alterarem pedidos existentes.
- Levar a composição até o recebimento e a venda no PDV; cozinha e comprovantes devem mostrar escolhas e acompanhamentos de forma legível.
- Definir baixa conforme a política real de estoque de cada componente, sem presumir ficha técnica de ingredientes. Baixa e estorno precisam ocorrer uma única vez mesmo com repetição de sincronização, retomada ou cancelamento.

## Fase 7 — validação e entrega por partes

- Testar individual normal/promocional, combo normal/promocional, bebida inclusa, adicional pago, múltiplas unidades e promoção só do individual.
- Testar módulo bloqueado, escolha inválida, preço adulterado, validade de promoção e carrinho desatualizado.
- Validar compatibilidade com catálogo sem novos campos e combos antigos, preservando Pack/Fardo.
- Validar pedido até venda/estoque e estorno sem duplicação nos caminhos efetivamente integrados.
- Conferir interfaces no PC e celular, com testes focados; registrar arquivos alterados, finalidade e evidências de cada fase.
- Distinguir validação local/emulador, publicação web e homologação no PDV instalado. Verificar custos/leituras antes de publicar mudanças de backend; não ativar serviços hospedados adicionais implicitamente.

## Limites e decisões ainda necessárias

- O controle Promoção do painel ativa a oferta no cardápio. Sua ativação também no balcão do PDV não foi decidida: não propagar silenciosamente entre canais.
- Agendamento opcional implementado no painel, em horário de Brasília, somente para o cardápio; não altera promoções do balcão.
- Fora da primeira versão: cupons, descontos cumulativos, compre/leve, regras recorrentes de happy hour, upgrades pagos de bebida e criação de ficha técnica de ingredientes.
- Links amigáveis por loja são uma frente separada. O usuário comprou flowpdv.app.br; DNS e migração não foram executados nesta etapa. Preservar links antigos/QR codes.

## Registro desta entrega

O registro inicial era somente planejamento. A implementação local posterior está documentada em [COMBOS-PROMOCOES-ETAPA-CATALOGO-20260923.md](COMBOS-PROMOCOES-ETAPA-CATALOGO-20260923.md).

Fases 2–5: implementação local e verificações focadas concluídas para o cadastro e catálogo. Fase 1 identificou a separação entre pedidos públicos atuais e recebimento V2. Após escolha explícita do usuário pelo V2 local, a fase 6 foi validada nessa base: preço autoritativo, recebimento, venda, baixa e estorno dos componentes. Fase 7: verificações locais/emuladas concluídas; não equivalem à homologação do cardápio publicado, do PDV instalado ou da impressora física.

Detalhes e pendências da integração: [COMBOS-PROMOCOES-INTEGRACAO-V2-20260923.md](COMBOS-PROMOCOES-INTEGRACAO-V2-20260923.md).

Migração piloto autorizada para BURGER TESTE: cópia inativa de 101 documentos gravada e conferida no Firebase, sem corte operacional. O faturamento foi confirmado habilitado em consulta atual. Dados, verificações e pendências: [MIGRACAO-BURGER-TESTE-V2-20260923.md](MIGRACAO-BURGER-TESTE-V2-20260923.md).
