# Preparação de implantação — 22/09/2026

Este documento registra a conferência local e as dependências externas. Não houve implantação ou habilitação de faturamento.

## Runtime

Functions declarava Node 20. A declaração e o lockfile foram alinhados para Node 22, suportado pelo Firebase. A tabela oficial indica desativação do Node 20 em 30/10/2026 e suporte do Node 22 até sua depreciação em 30/04/2027, com desativação em 31/10/2027. Conferir novamente antes do deploy: [runtimes do Google Cloud](https://docs.cloud.google.com/functions/docs/runtime-support) e [configuração de runtime Firebase](https://firebase.google.com/docs/functions/manage-functions).

Node 22.23.2 portátil foi obtido da distribuição oficial, com SHA-256 conferido contra SHASUMS256.txt, em `output/local-node22`. Não substitui o Node global nem o Electron. `scripts/test-pairing.ps1` prefere esse runtime quando disponível. Log de integração: `output/runtime22-integracao.log`.

Os 89 testes de configuração, pedidos públicos/garçom/delivery e fechamento financeiro passaram com as Functions executando em Node 22. Incluem concorrência, estoque, cancelamento, estorno e recuperação de respostas. Isso valida essas suítes locais, sem substituir o ensaio de implantação remota.

Ainda é necessário homologar empacotamento/instalador, versão do Electron, integrações nativas e a atualização de uma instalação existente. Alterar engines das Functions não valida o aplicativo Windows nem publica código.

## Hospedagem e custo

Os testes locais usam emuladores e não acionam serviços de produção. Para publicar as Functions, o projeto precisa do plano Blaze e de faturamento vinculado; franquias não são garantia de custo zero. Fonte: [limites de Cloud Functions](https://firebase.google.com/docs/functions/quotas).

O Vercel Hobby é restrito a uso pessoal não comercial. Não assumir que uma loja piloto comercial pode operar nesse plano só por ter pouco movimento. Fonte: [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Firebase documenta alertas e limites de gasto para serviços elegíveis, incluindo Cloud Run functions. Esses limites são por projeto/serviço e podem ter atraso; excedentes durante o atraso podem ser cobrados. Não são garantia de teto absoluto nem abrangem automaticamente todo o projeto. Fonte: [limites de gasto Firebase](https://firebase.google.com/docs/projects/billing/spend-caps).

Antes de publicar, definir projeto separado de homologação, provedor estático autorizado para uso comercial, domínios de autenticação, configurações públicas do SDK, regiões, orçamento, limites de instâncias e monitoramento. Não registrar segredos no repositório. Os apps V2 ainda bloqueiam execução fora do ambiente local: não remover essa proteção sem concluir acesso operacional, regras e migração.

Para estimar consumo, medir pelo menos pedidos/dia, sessões simultâneas, minutos de acompanhamento por pedido, terminais conectados, leituras de listeners, gravações por transação, tamanho/frequência de fotos e retenção de logs. A quantidade de clientes sozinha não determina consumo. A carga atual ainda não foi medida em ambiente remoto.

## Dependências confirmadas pelo usuário

Impressora/modelo/conexão, fornecedor fiscal e fornecedor de pagamento integrado ainda não definidos. Manter pagamento manual e impressão simulada na homologação local. Emissão e cobrança reais exigem configuração específica do fornecedor e validação própria.

O plano mestre continua sendo a referência de pendências; esta preparação não encerra implantação, fiscal, pagamentos ou homologação física.
