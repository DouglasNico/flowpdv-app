# 📖 Guia Completo de Testes e Operação do Sistema FlowPDV

> **Versão Homologada:** `v1.9.9` | **Ambiente:** Desktop (Windows) + Master Admin + Mobile Companion PWA

---

## 🗺️ Os 4 Pilares do Ecossistema

| Componente | O que é | Como Abrir |
| :--- | :--- | :--- |
| 👑 **Painel Master Admin** | Painel do Super Admin (Você) para criar licenças, escolher ramos e ligar/desligar módulos. | `Abrir-Painel-Master-FlowPDV.bat` |
| 🖥️ **FlowPDV Desktop** | O sistema de Frente de Caixa instalado no computador do comércio (Adega, Mercado, etc.). | `Iniciar-Adega-PDV.bat` |
| 📱 **FlowPDV Gestor Mobile** | Aplicativo do Dono para acompanhar faturamento, estoque e contas pelo smartphone. | `flowpdv-mobile/index.html` |
| 🌐 **Site Oficial FlowPDV** | Landing page de vendas e planos para novos clientes. | `flowpdv-site/index.html` |

---

## 👑 PARTE 1: Testando o Painel Master Admin

1. Dê dois cliques em **`Abrir-Painel-Master-FlowPDV.bat`** (ou abra `flowpdv-master-admin/index.html`).
2. Clique no botão **`➕ Novo Cliente`** (ou clique em **`✏️ Editar`** em um cliente existente).
3. **Teste a Segmentação Inteligente:**
   * No campo **"Ramo do Comércio"**, selecione por exemplo **🥩 Açougue & Carnes**.
   * Veja que o sistema automaticamente pré-marca **Balança / Venda por Kg** e sugere categorias de carnes.
   * Se trocar para **🍷 Adega & Bebidas**, ele pré-marca **Fardos & Packs** e categorias de bebidas.
4. **Matriz de Módulos (Liga / Desliga):**
   * Você pode marcar ou desmarcar manualmente qualquer checkbox:
     * `[X] 📦 Fardos & Packs (Bebidas)`
     * `[X] ⚖️ Balança / Venda por Kg`
     * `[X] 📅 Controle de Validade`
     * `[X] 👗 Grade de Roupas & Calçados`
     * `[X] 📖 Fiado & Cobrança WhatsApp`
     * `[X] 📥 Importador XML de NF-e`
5. Clique em **`💾 Salvar Cliente & Sincronizar Licença`**.

---

## 🖥️ PARTE 2: Testando o FlowPDV Desktop (Frente de Caixa)

Dê dois cliques em **`Iniciar-Adega-PDV.bat`** (ou use o instalador `dist/FlowPDV-Setup.exe`).

### 1. 🟢 Abertura de Caixa `[F10]`
* Antes de vender, o sistema exige que o caixa esteja aberto.
* Aperte **`[F10]`**, digite o troco inicial da gaveta (ex: `R$ 50,00`) e clique em **Abrir Caixa**.

---

### 2. ⚡ Frente de Caixa `[F1]`
* **Bipando Produtos:**
  * Digite ou bipe um código de barras (ex: `7891991000833`) e aperte `Enter`.
* **Multiplicador de Quantidade:**
  * Digite `3*7891991000833` para passar 3 unidades de uma vez.
* **Item Avulso / Diverso:**
  * Digite `*15` para passar um item avulso de R$ 15,00.
* **Busca Rápida `[F2]`:**
  * Aperte **`[F2]`**, digite o nome de um produto ou clique nas abas de categoria.
  * Se clicar em um item de **Balança / Kg**, o visor LCD verde da balança abrirá na tela para você confirmar o peso!
* **Balança Integrada (Visor LCD):**
  * Na tela da balança, clique nos botões rápidos (`+250g`, `+500g`, `+1kg`) ou digite o peso manual e aperte `Enter` para lançar no carrinho.

---

### 3. 💳 Finalizando a Venda `[F4]`
Com itens no carrinho, aperte **`[F4] Pagar`**:
* **💵 Dinheiro:** Digite o valor entregue (ex: R$ 50,00). O sistema calcula o troco automaticamente.
* **📱 PIX:** Exibe a chave PIX cadastrada da loja.
* **📖 Fiado:** Escolha o cliente cadastrado. O valor é somado na dívida dele na hora!
* **💳 Cartão TEF / Smart POS:**
  * Selecione Cartão de Crédito ou Débito e clique em Confirmar.
  * O modal da maquininha abre na tela travando o valor.
  * Clique em **`🟢 Simular Aprovado (Mastercard)`**.
  * O FlowPDV recebe o NSU e autorização, fecha a venda sozinho e imprime o cupom!
* **✂️ Dividir Pagamento:** Permite pagar parte em Dinheiro e parte no Cartão/PIX.

---

### 4. 📦 Estoque & Produtos `[F3]`
* **📥 Importador de XML de Notas (NF-e):**
  * Clique no botão **`📥 Importar XML (NF-e)`**.
  * Arraste o arquivo de teste `docs_assets/nfe-teste-ambev.xml`.
  * Veja o sistema converter caixas em unidades, calcular custos unitários e agendar os boletos no financeiro!
  * Clique em **`✅ Confirmar Entrada`**.
* **➕ Novo Produto:**
  * Cadastre produtos com preço de custo, venda, margem de lucro e fardos.
* **📊 Planilhas:**
  * Baixe o estoque em Excel ou faça importação em massa via planilha.

---

### 5. 👥 Clientes & Fiado `[F4]`
* Cadastre clientes com CPF, telefone/WhatsApp e limite de crédito.
* Veja o saldo devedor de cada um.
* Clique no botão **`📱 Cobrar WhatsApp`** para abrir uma mensagem pronta no WhatsApp do cliente com o valor exato da dívida.
* Clique em **`💵 Receber Fiado`** para dar baixa no pagamento da dívida.

---

### 6. 📊 Central do Dono & Gerência `[F5]`
* **Contas a Pagar (Financeiro):**
  * Exibe os cards de métricas formatados (`R$ 11.850,00`, `R$ 1.630,00`, `R$ 1.256,53`).
  * Lista as despesas em ordem cronológica de vencimento (as mais urgentes e vencidas no topo).
  * Clique em **`💵 Pagar`** para dar baixa na despesa.
* **Curva ABC de Vendas:**
  * Mostra quais produtos geram mais lucro para a loja (Produtos A, B e C).
* **Auditoria em Tempo Real:**
  * Registra sangrias, cancelamentos, cortesias e entradas de nota com data, hora e operador.
* **Histórico de Caixas:**
  * Conferência detalhada de todos os turnos abertos e fechados.
* **Funcionários:**
  * Cadastro de operadores de caixa e definição do PIN do Gerente.

---

### 7. ⚙️ Configurações `[F8]`
* Altere Nome da Loja, CNPJ, WhatsApp e Chave PIX.
* Teste a impressora térmica (58mm / 80mm).
* Teste a comunicação da **Balança** e da **Máquina de Cartão (TEF)**.

---

## 📱 PARTE 3: Testando o FlowPDV Gestor Mobile (Celular)

1. Abra `flowpdv-mobile/index.html` no navegador (ou pelo smartphone).
2. Digite a Chave de Licença (ex: `LIC-FLOW-498210`) e o PIN do Gerente (`1234`).
3. O painel carrega **instantaneamente (0ms)** exibindo:
   * 💰 Faturamento do Dia em tempo real.
   * 💵 Dinheiro na Gaveta do Caixa.
   * ⚠️ Produtos com Estoque Baixo.
   * 📋 Contas a Pagar do Dia.
   * 📖 Clientes no Fiado (com botão direto para cobrar no WhatsApp).
   * ⚡ Histórico de Auditoria ao Vivo.

---

## 🎯 Resumo dos Principais Atalhos do Teclado

* **`[F1]`** — Ir para Frente de Caixa
* **`[F2]`** — Buscar Produto no Estoque
* **`[F3]`** — Abrir Gestão de Estoque
* **`[F4]`** — Pagar / Finalizar Venda (ou Aba de Clientes)
* **`[F5]`** — Central do Dono & Gerência
* **`[F7]`** — Cortesia / Bonificação (Exige PIN do Gerente)
* **`[F8]`** — Configurações da Loja
* **`[F9]`** — Registrar Sangria de Dinheiro
* **`[F10]`** — Abrir ou Fechar Turno de Caixa
* **`[ESC]`** — Cancelar ou Fechar Modais
