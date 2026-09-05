# 🍷 Adega Gestão & PDV Ágil — Sistema SaaS Desktop

Sistema profissional de Frente de Caixa (PDV Ágil com leitor de código de barras), Controle de Estoque com Grade Fracionada (Fardo/Lata), Turnos de Caixa, Fiado e Motor de Licenciamento Remoto por Nuvem (SaaS com bloqueio).

---

## 🚀 Como Iniciar em Modo de Desenvolvimento:

No terminal dentro da pasta `D:\Desenvolvimento\adega-pdv-gestao`:

```bash
npm start
```
*(Ou execute `npx esbuild src/js/app.js --bundle --outfile=src/js/bundle.js` e `npx electron .`)*

---

## ⌨️ Teclas de Atalho do Caixa:

| Tecla | Ação |
| :---: | :--- |
| **`F1`** | Ir para a tela de **Caixa / PDV**. |
| **`F2`** | Abrir **Busca Rápida de Produtos** (para itens sem leitor: gelo, carvão, copos). |
| **`F3`** | Ir para a tela de **Estoque & Produtos**. |
| **`F4`** | Abrir **Finalizar Venda / Pagamento** (com cálculo automático de troco). |
| **`F5`** | Ir para a tela de **Turno de Caixa** (abertura, sangria, fechamento). |
| **`F6`** | Ir para a tela de **Clientes & Fiado (Caderneta)**. |
| **`F7`** | Registrar **Cortesia / Bonificação**. |
| **`F8`** | Ir para **Configurações da Adega**. |
| **`F9`** | Registrar **Sangria / Retirada de Caixa**. |
| **`ESC`** | Fechar qualquer modal ativo ou cancelar. |

---

## 🔫 Exemplos de Códigos de Barras Prontos para Testar:

Você pode digitar no campo de código de barras ou passar no leitor:

* `7891991000833` ➡️ **Skol Lata 350ml** (R$ 4,00)
* `7896045506019` ➡️ **Heineken Long Neck 330ml** (R$ 8,50)
* `7896045506040` ➡️ **Amstel Lata 350ml** (R$ 4,50)
* `7891991010856` ➡️ **Corona Extra 330ml** (R$ 9,00)
* `5000281005409` ➡️ **Whisky Red Label 1L** (R$ 105,00)
* `5010103937107` ➡️ **Gin Tanqueray 750ml** (R$ 130,00)
* `70847012354`   ➡️ **Monster Energy 473ml** (R$ 10,00)
* `90162602`      ➡️ **Red Bull 250ml** (R$ 9,50)

> 💡 **Multiplicador Rápido:** Digite `3*7891991000833` para passar 3 Skol de uma só vez!

---

## 🔑 PINs de Troca de Usuário:
Clique no crachá do usuário no canto superior direito para alternar perfis:
* `1234` ➡️ **Operador de Caixa** (Apenas vende, sem acesso a margens de lucro).
* `8888` ➡️ **Dono / Gerente** (Acesso completo a produtos, lucro, sangrias e relatórios).
* `9999` ➡️ **Super Administrador (Você)** (Libera a aba exclusiva **👑 Licenças Master** para controlar as adegas clientes e conceder +30 dias).