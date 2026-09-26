# Etapa 7Q — integração do clássico no teste

O perfil de teste oferece **PDV clássico**, reutilizando o elemento `classic-pdv-shell` do HTML existente e seus estilos originais. Cabeçalho, leitor, imagem, descrição do produto, tabela, faixa de totais e rodapé de atalhos mantêm sua organização. Os ajustes de CSS são restritos ao perfil de teste, para acomodar o aviso de teste e telas menores; o tema e o layout de produção não foram redesenhados.

## Fluxo

O clássico e o moderno usam o mesmo carrinho, preços locais atuais, rascunho e ponte de estoque. Alternar as telas não importa, duplica nem registra a venda.

- Enter no leitor: aceita código exato ou `quantidade*código`, inclusive quantidades com até três casas decimais. Códigos ausentes ou ambíguos exigem F2.
- F2 ou Buscar: pesquisa por nome, código ou identificador, com quantidade na unidade cadastrada.
- Clique numa linha: seleciona o item. Duplo clique ou Enter na linha: abre a edição da quantidade.
- DEL com foco na linha: remove o produto. No campo de código, Delete continua editando o texto.
- F4: abre a conferência de pagamento existente, com divisão, ajustes e troco.
- F8: direciona aos ajustes da venda; F10, aos controles do turno.
- ESC no clássico: pede confirmação antes de limpar o rascunho. ESC numa janela de busca/edição fecha apenas essa janela.
- O controle de saída do cabeçalho volta ao painel de teste.

A confirmação da venda não é restaurada. Depois da recarga, o acesso é consultado, o mesmo rascunho é recuperado e o operador precisa conferir novamente. A baixa remota e a gravação local continuam sendo realizadas pela ponte já validada.

## Escopo

Somente perfil de teste. A inicialização do clássico de produção permanece inalterada. Os eventos inline antigos são removidos da cópia de teste para que nenhum comando use o caminho antigo de baixa local. A troca de operador e os atalhos F6, F7, F9 e F12 ainda não estão integrados neste perfil e são sinalizados como indisponíveis. Uma cortesia integral ainda pode ser registrada como desconto integral na conferência, conforme a etapa 7N.

O pagamento continua no painel de conferência de teste, compartilhado com o moderno. Não foi substituído o modal de pagamento do PDV real. Não há liberação para loja real, cobrança bancária, impressão física ou emissão fiscal.

Próxima etapa sugerida: integrar a conferência final ao contexto de cada layout, com retorno de foco, atalhos e tratamento de pendências consistentes, antes da ativação controlada da loja piloto.

## Validação

Testes do leitor, recusa de código ambíguo, proteção do perfil normal, regressão do legado e fluxo completo em Electron oculto. O fluxo inclui moderno → clássico, leitura com quantidade, busca, edição, remoção, recarga do rascunho, F4 e finalização pela mesma ponte. Capturas em dois tamanhos de janela verificam a disposição do clássico.

Resultado: 86 testes locais, 51 testes do núcleo legado e 26 testes TEF simulados passaram (163 no total). Bundle gerado e fluxo completo de interface em Electron oculto concluído com código 0, incluindo foco na linha, duplo clique sem substituição do elemento e DEL no elemento selecionado. Capturas revisadas nos tamanhos de janela 1366 × 768 e 1024 × 768, sem transbordamento horizontal do shell.

Evidências em `output/etapa-7q-local.log`, `etapa-7q-legado.log`, `etapa-7q-bundle.log`, `etapa-7q-interface.log` e `etapa-7q/classico-*.png`.
