# Conferência dos fechamentos na recuperação — etapa 8R

Antes de instalar o arquivo, a restauração agora confere os movimentos e resumos do restaurante para cada turno do backup. O serviço é somente leitura e usa a identidade financeira autorizada do terminal.

São conferidos os recebimentos e estornos, as formas de pagamento, a quantidade de movimentos, o fundo do restaurante e a consistência da contagem remota. Em turnos encerrados, o resumo local precisa corresponder ao resumo remoto, incluindo os itens detalhados. Resumo ausente ou divergente impede a escrita no destino. Alterações de revisão durante a consulta também impedem continuar.

## Validação

- 24 testes locais de conferência, restauração, instalação e perfis aprovados em `output/etapa-8r-local-final.log`.
- 12 testes integrados de recuperação aprovados em `output/etapa-8r-servidor.log`.
- O novo cenário remoto usa recebimento dividido em dinheiro/Pix, uma segunda venda estornada, contagem com diferença e transferência de identidade. Comprova consulta sem alteração de estoque, detecção de resumo ausente/adulterado e rejeição de total remoto inconsistente.
- A fixture financeira desse cenário é semeada no emulador: não substitui os testes existentes de fechamento de pedidos.
- Instalação completa no Electron oculto aprovada novamente com esta proteção em `output/etapa-8r-interface.log`: perfil novo, UID próprio preservado, bloqueio após recarga e estoque inalterado.

## Limites

A conferência cobre movimentos e resumos do restaurante, até 50 turnos e 500 movimentos por turno. Não reconstrói automaticamente turnos fechados, não recupera sangrias/suprimentos que nunca chegaram ao servidor, não atesta contas abertas/pedidos pendentes e não valida a contagem consolidada com vendas legadas. Não libera o perfil para operar; o bloqueio da etapa 8P permanece.
