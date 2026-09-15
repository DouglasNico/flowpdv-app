# FlowPDV — o que foi feito até a v3.2.28

Resumo para o Douglas: auditoria, NFC-e, TEF com diário de recuperação, logo oficial e os ajustes de caixa.

Instalador atual: https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.28

---

## 1. Logo oficial

Pasta de origem no PDV: `src/assets/logos/`

| Arquivo | Uso |
|---|---|
| `para-fundo-claro/FlowPDV-horizontal.png` | Cabeçalho do PDV e PDV clássico (fundo branco) |
| `para-fundo-escuro/FlowPDV-vertical.png` | **Só login** (painel escuro à esquerda) |
| `para-fundo-claro/FlowPDV-icone.png` | Favicon e modais claros (atualização / ativação) |
| `para-fundo-escuro/FlowPDV-icone.png` | Ícones em fundo escuro (site, mobile, master) |

**Ícone do instalador não mudou:** `src/assets/icon.ico` e `src/assets/icon.png` (carrinho metálico) continuam no `electron-builder` e na janela do Windows.

Alturas das páginas foram mantidas. O horizontal entra com a mesma altura de antes; o vertical no login substitui o carrinho + texto HTML.

### Onde mais foi aplicado

| Projeto | O que mudou | Git |
|---|---|---|
| App desktop | Header, PDV clássico, login, favicon, modais | `DouglasNico/flowpdv-app` |
| Site | Navbar, favicon, rodapé | `DouglasNico/flowpdv-site` |
| Mobile v2.2.22 | Login (vertical escuro) e header (ícone) | `DouglasNico/cliente-flowpdv` |
| Painel Master v3.3.5 / v3.3.6 | Login (vertical), sidebar, upload da logo do cliente | `DouglasNico/flowpdv` |

### Logo da loja do cliente (capa no PDV)

O master **não força mais 240×240**. Isso enfiava faixa em branco em volta da 600×300.

- Upload guarda a **proporção original** (lado maior no máximo 600px)
- No PDV clássico a imagem **preenche o card** sem esticar (`object-fit: contain`)
- Placeholders de teste (pontilhado na borda real):
  - `src/assets/placeholders/sua-logo-aqui-500x500.png`
  - `src/assets/placeholders/logo-da-sua-empresa-aqui-600x300.png`

Se a loja ainda tem logo antiga (quadrado 240), **anexar de novo** no master.

---

## 2. Frente clássica em tela larga — v3.2.28

Em alguns PCs (e nos prints maximizados) a caixa clássica parava no meio e deixava uma faixa azul na direita. A janela era maior que o `100vw` do Electron.

A frente agora cola nas quatro bordas. A coluna da logo continua 580px; a lista de produtos é que cresce. Fundo igual ao da caixa, sem o azul vazando.

---

## 3. Caixa e gerência — v3.2.26

- Título da aba: **Central da Gerência** (o selo Modo Gestor continua)
- Coluna **QTD** da lista: unidade mostra `1 UN`; peso mostra `1,365 KG`
- Para lançar peso quebrado no código: `1,365*2` (peso * código do produto). Só o código `2` entra 1 KG. Se o item já está no carrinho, **soma**
- **DEL:** peso aparece como KG (não mais UN). A quantidade a remover **já vem com o total** do item — Enter / Remover tira a linha inteira. Para tirar só um pedaço, altere o valor. Botão `-1 UN` só em produto de unidade
- NFC-e: removida chave duplicada `autoEmitirAoFinalizar` (padrão continua ligado no interruptor)

---

## 4. NFC-e real (Focus NFe) — v3.2.24

A venda é gravada primeiro e depois vai para `POST /v2/nfce` com referência fixa `fp-<id da venda>` (não duplica nota se o PC cair no meio).

- Homologação e produção, tokens separados
- Sem internet: status `pendente` e reenvio automático
- Rejeição da SEFAZ fica na venda, com botão de reemitir
- Cancelamento na SEFAZ em até 30 minutos
- Cupom/A4: QR Code real, URL de consulta do estado, marca de homologação/cancelada
- CSC e numeração ficam no painel da Focus (evita conflito entre dois caixas)

O cliente precisa: conta Focus, certificado A1 + CSC no painel deles, token colado no FlowPDV. Primeiro teste em **homologação**.

---

## 5. TEF — v3.2.24 e v3.2.27

Na tela de TEF o cliente escolhe a maquininha:

| Opção | O que faz |
|---|---|
| **Manual (padrão)** | Recebe na maquininha e só lança Débito/Crédito no PDV depois da aprovação. Sem API. |
| **Stone Connect** | Cria o pedido na API da Stone; a maquininha abre o pagamento |
| **SiTef** | Carrega a `CliSiTefI.dll` 64 bits no Windows (Cielo, Rede, Getnet, PagBank no pinpad, se a loja tiver SiTef) |
| **Simulador** | Só demonstração; não autoriza venda real |

PagBank/Cielo/PayGo **não** têm API própria no PDV de computador. No caixa, entram pelo **SiTef** quando a loja tem o servidor + pinpad.

O instalador leva o `koffi.node`. No `package.json` o `asarUnpack` inclui `koffi` e `@koromix/koffi-win32-x64`.

### O que a 3.2.27 acrescentou

- Diário local do terminal (`tef-ledger`): registra a intenção **antes** de cobrar
- Só quita a parcela com autorização e valor conferido em centavos
- Venda, estoque e turno gravam juntos; retomada não baixa estoque de novo
- Tela **Pendências TEF**: consultar / concluir, recuperar no caixa, estornar (gerente)
- Não fecha o caixa nem troca licença com pendência
- Simulador não passa mais como pagamento de venda real
- Detalhe operacional: `docs/TEF-OPERACAO-E-VALIDACAO.md`

Ainda precisa de homologação na loja com Stone/SiTef de verdade. Os testes locais (72) cobrem o fluxo no código, não o pinpad físico.

---

## 6. Correções da auditoria (v3.2.23)

Já estavam no ar antes da semana de NFC-e/TEF:

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

## 7. Releases

| Versão | Conteúdo | Link |
|---|---|---|
| 3.2.22 | Estoque offline dos dois caixas + saldo absoluto digitado | |
| 3.2.23 | Auditoria (planilha, turno, decimais, XML, tombstones, comanda) | |
| 3.2.24 | NFC-e Focus + TEF Stone/SiTef | [v3.2.24](https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.24) |
| 3.2.25 | Logo oficial em app/site/mobile + `asarUnpack` do koffi | [v3.2.25](https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.25) |
| **3.2.26** | Logo da loja no card; QTD UN/KG; DEL com total; Central da Gerência | [v3.2.26](https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.26) |
| **3.2.27** | Diário TEF, pendências, sem cobrança duplicada; bloqueio de caixa com pendência | [v3.2.27](https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.27) |
| **3.2.28** | Frente clássica ocupa a janela inteira em monitor largo | [v3.2.28](https://github.com/DouglasNico/flowpdv/releases/tag/v3.2.28) |

NFC-e e TEF só fecham o ciclo com token Focus / maquininha / CliSiTef no cliente. O caminho no sistema é o de produção; o cadastro é da loja.

---

## 8. Como o cliente configura (piloto)

1. **NFC-e:** Focus → homologação → token + CNPJ no FlowPDV → venda de teste → conferir QR e consulta da SEFAZ → só então produção.
2. **Stone:** Connect ativo na conta, chave `sk_`, serial da maquininha; venda pequena e cancelamento em seguida.
3. **SiTef:** `CliSiTefI.dll` 64 bits no PC, IP/loja/terminal da Fiserv; menu administrativo no próprio FlowPDV.
4. **Logo da loja:** PNG ou JPG no master (proporcional, até 600px). Quadrado 500×500 ou faixa 600×300. Depois de mudar o upload, anexar de novo se a capa ainda estiver pequena.
