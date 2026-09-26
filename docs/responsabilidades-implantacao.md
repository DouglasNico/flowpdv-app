# Responsabilidades na implantação do FlowPDV

## Loja e FlowPDV

O cliente não precisa escolher a arquitetura técnica do FlowPDV. O desenvolvimento continua com dados fictícios e recursos simulados; equipamentos e contas reais são configurados na implantação de cada loja.

| Tema | Responsabilidade da loja | Responsabilidade do FlowPDV |
| --- | --- | --- |
| Impressora e periféricos | Informar modelos/conexões existentes ou adquirir equipamento compatível | Definir compatibilidade suportada, fornecer configuração e validar impressão/falhas em equipamentos representativos |
| Recebimento manual | Receber e conferir dinheiro, Pix ou maquininha externa e informar a forma recebida | Registrar pagamentos, troco e conciliação corretamente, sem confundir lançamento manual com confirmação bancária |
| Pagamento integrado | Ter cadastro/contrato e conta de recebimento no provedor suportado | Escolher e implementar integrações suportadas, tratar confirmação incerta/estorno e homologar; não prometer compatibilidade com qualquer maquininha |
| Fiscal | Com apoio do contador, informar enquadramento/dados e providenciar credenciais/credenciamento aplicáveis | Definir solução de emissão, integrar, validar cenários e atender exigências técnicas aplicáveis ao software |
| Módulos e operação | Escolher quais recursos deseja usar e cadastrar produtos, mesas, funcionários e regiões | Disponibilizar apenas recursos implementados/contratados, com permissões e funcionamento independente |
| Hospedagem do serviço | Usar a conexão necessária à loja e cumprir sua parte contratual | Definir infraestrutura, acesso, monitoramento, atualização e suporte do produto; não transferir essa escolha técnica a cada lojista |

A contratação da infraestrutura/API fiscal pode ser centralizada no FlowPDV ou feita por loja, conforme o modelo comercial e o fornecedor escolhido. Essa é uma decisão do produto, não uma exigência para o usuário escolher um fornecedor agora.

## Fiscal: separar dados do contribuinte e requisitos do sistema

Os requisitos dependem da operação e da UF; não tratar cadastro de certificado/CSC como único requisito nem impor uma regra estadual a todas as lojas. Exemplo oficial: o Paraná descreve tanto requisitos do contribuinte quanto procedimentos do fornecedor do sistema emissor em [credenciamento de emissores](https://sped.fazenda.pr.gov.br/NFCe/Pagina/Credenciamento-de-emissores). A definição concreta será conferida para a loja atendida.

## Como continuar sem cliente/equipamento definido

Implementar e validar acesso, catálogo, canais, pedidos, caixa, estoque, recuperação e relatórios localmente. Preparar adaptadores/configuração para integrações; pagamentos permanecem manuais e impressão simulada até as respectivas homologações. O acabamento visual continua por último.

Na implantação, coletar somente os dados necessários: segmento/UF, equipamentos, conexão, meios de pagamento e módulos desejados. Senhas, certificados e chaves não devem ser pedidos no chat nem gravados no plano. A ausência de um cliente piloto ou fornecedor definido não bloqueia as funcionalidades independentes.
