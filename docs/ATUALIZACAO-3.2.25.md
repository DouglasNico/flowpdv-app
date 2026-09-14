# FlowPDV — o que foi feito até a v3.2.25

Resumo para o Douglas: correções da auditoria, NFC-e e TEF reais, e o logo oficial em app, site, mobile e painel master.

---

## 1. Logo oficial (esta versão)

Pasta de origem: `src/assets/logos/`

| Arquivo | Uso |
|---|---|
| `para-fundo-claro/FlowPDV-horizontal.png` | Cabeçalho do PDV e PDV clássico (fundo branco) |
| `para-fundo-escuro/FlowPDV-vertical.png` | **Só login** (painel escuro à esquerda) |
| `para-fundo-claro/FlowPDV-icone.png` | Favicon e modais claros (atualização / ativação) |
| `para-fundo-escuro/FlowPDV-icone.png` | Ícones em fundo escuro (site, mobile, master) |

**Ícone do instalador não mudou:** `src/assets/icon.ico` e `src/assets/icon.png` (carrinho metálico) continuam no `electron-builder` e na janela do Windows.

Tamanhos das páginas foram mantidos (`height` / `max-height` que já existiam). O horizontal entra com a mesma altura de antes; o vertical no login cabe no painel escuro sem o carrinho + texto HTML.

Também atualizado:

- Site (`D:\Desenvolvimento\flowpdv-site`) — navbar e rodapé escuros usam horizontal/ícone escuros
- Mobile (`D:\Desenvolvimento\flowpdv-mobile`) — login com vertical escuro; header com ícone escuro
- Painel Master (`D:\Desenvolvimento\flowpdv-master-admin`) — login com vertical escuro

---

## 2. NFC-e real (Focus NFe) — v3.2.24

A venda é gravada primeiro e depois vai para `POST /v2/nfce` com referência fixa `fp-<id da venda>` (não duplica nota se o PC cair no meio).

- Homologação e produção, tokens separados
- Sem internet: status `pendente` e reenvio automático
- Rejeição da SEFAZ fica na venda, com botão de reemitir
- Cancelamento na SEFAZ em até 30 minutos
- Cupom/A4: QR Code real, URL de consulta do estado, marca de homologação/cancelada
- CSC e numeração ficam no painel da Focus (evita conflito entre dois caixas)

O cliente precisa: conta Focus, certificado A1 + CSC no painel deles, token colado no FlowPDV. Primeiro teste em **homologação**.

---

## 3. TEF real — v3.2.24

Na tela de TEF o cliente escolhe a maquininha:

| Opção | O que faz |
|---|---|
| **Stone Connect** | Cria o pedido na API da Stone; a maquininha abre o pagamento |
| **SiTef** | Carrega a `CliSiTefI.dll` 64 bits no Windows (Cielo, Rede, Getnet, PagBank no pinpad, se a loja tiver SiTef) |
| **Simulador** | Só demonstração; botões de aprovado/recusado |

PagBank/Cielo/PayGo **não** têm API própria no PDV de computador. No caixa, entram pelo **SiTef** quando a loja tem o servidor + pinpad.

O instalador já leva o `koffi.node` (ponte com a DLL). No `package.json` o `asarUnpack` inclui `koffi` e `@koromix/koffi-win32-x64` para o próximo build não depender do unpack automático.

---

## 4. Correções da auditoria (v3.2.23)

Já estavam no ar antes desta semana de NFC-e/TEF:

- Importação de planilha alinhada (colunas, decimais, movimento de estoque com `saldoPara`)
- Functions de licença exigem login (código pronto; deploy no Firebase depende do plano Blaze)
- Fechamento de caixa só soma venda do turno; troco sem desconto duplo
- Ajuste de estoque aceita decimal (kg)
- Balança aceita peso zero
- XML de NF-e não duplica se reimportar
- Cache de produtos limpo na troca de licença
- Exclusão de despesa/funcionário não volta no sync (tombstone)
- Comanda só baixa os itens cobrados

---

## 5. Releases

| Versão | Conteúdo |
|---|---|
| 3.2.22 | Estoque offline dos dois caixas + saldo absoluto digitado |
| 3.2.23 | Auditoria (planilha, turno, decimais, XML, tombstones, comanda) |
| 3.2.24 | NFC-e Focus + TEF Stone/SiTef |
| **3.2.25** | Logo oficial em app/site/mobile + `asarUnpack` do koffi |

Instalador: https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.25

NFC-e e TEF só fecham o ciclo com token Focus / maquininha / CliSiTef no cliente. O caminho no sistema é o de produção; o cadastro é da loja.

---

## 6. Como o cliente configura (piloto)

1. **NFC-e:** Focus → homologação → token + CNPJ no FlowPDV → venda de teste → conferir QR e consulta da SEFAZ → só então produção.
2. **Stone:** Connect ativo na conta, chave `sk_`, serial da maquininha; venda pequena e cancelamento em seguida.
3. **SiTef:** `CliSiTefI.dll` 64 bits no PC, IP/loja/terminal da Fiserv; menu administrativo no próprio FlowPDV.
