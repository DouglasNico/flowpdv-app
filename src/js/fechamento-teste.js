import { usarFluxoOperacionalV2, usarAplicativoIntegradoV2, usarPdvOficialV2 } from './perfil-operacional-v2.js';
import {criarPagamentoAtendimentoPendente} from './pagamento-atendimento-pendente.js';
import { criarAutorizacaoHomologacao } from './autorizacao-homologacao.js';
import { instalarConsultaPendenciasAtendimento } from './consulta-pendencias-atendimento.js';
import { perfilEmRecuperacao } from './bloqueio-recuperacao-perfil.js';
import { criarBackupHomologacao } from './backup-homologacao.js';
import { conferirBackupServidor, conferirInventarioBackup } from './conferencia-backup-v2.js';
import { conferirHistoricoBackup } from './conferencia-historico-v2.js';
import { conferirFechamentosBackup } from './conferencia-fechamento-backup-v2.js';
import { reconstruirBackupConfirmado } from './reconstrucao-backup-v2.js';
import { criarInstalacaoPerfilTeste } from './instalacao-perfil-teste.js';
import { instalarLiberacaoPerfil } from './liberacao-perfil-ui.js';
import { instalarPdvOperacionalTeste } from './pdv-operacional-teste.js';
import { criarRascunhoCarrinhoTeste } from './rascunho-carrinho-teste.js';
import { doc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { sessaoTerminalTeste, sessaoGerenciaTeste } from './sessoes-homologacao.js';
import { StorageService } from './storage.js';
import { turnoLocalAberto, resumoConciliacao } from './conciliacao-turno.js';
import { incorporarResumoRestaurante, totalEstornosLocais } from './resumo-restaurante-caixa.js';
import { criarEstornoServidorTeste } from './estorno-servidor-teste.js';
import { criarCicloCaixaTeste } from './ciclo-caixa-teste.js';
import { criarVendaServidorTeste, precoProdutoLocalCentavos } from './venda-servidor-teste.js';

const precoExibicao = produto => { try { return precoProdutoLocalCentavos(produto); } catch { return NaN; } };

export function instalarFechamentoTeste() {
  if (!usarFluxoOperacionalV2() || document.getElementById('checkout-open')) return;
  const oficial = usarPdvOficialV2();
  const tituloCaixa = oficial ? 'Caixa do cardápio' : 'Fechamentos de teste';
  const launcher = document.createElement('button'); launcher.id = 'checkout-open'; launcher.textContent = oficial ? 'Caixa integrado' : 'Fechamentos • teste';
  launcher.hidden = oficial;
  launcher.style.cssText = 'position:fixed;right:18px;bottom:200px;z-index:2147483645;padding:12px 18px;border:0;border-radius:10px;background:#047857;color:white;cursor:pointer';
  const dialog = document.createElement('dialog'); dialog.id = 'checkout-dialog'; dialog.setAttribute('aria-labelledby', 'checkout-title');
  dialog.innerHTML = `<style>
    #checkout-dialog{width:min(850px,94vw);max-height:85vh;overflow:auto;margin:auto;padding:24px;border:0;border-radius:16px;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui}#checkout-dialog::backdrop{background:#0f172aaa}#checkout-dialog h2{margin:0}#checkout-dialog button{padding:10px 14px;margin:8px 8px 8px 0;border:0;border-radius:8px;background:#047857;color:white;font:inherit;cursor:pointer}#checkout-dialog button:disabled{opacity:.5}#checkout-dialog input:not([type=checkbox]),#checkout-dialog select{display:block;width:95%;padding:10px;margin:6px 0 14px;font:inherit}#checkout-dialog article{padding:14px;border:1px solid #cbd5e1;border-radius:10px;background:white;margin-top:12px}#checkout-message{padding:12px;background:#e2e8f0;border-radius:8px}
    #checkout-dialog[data-origem] > section:not([aria-labelledby="local-stock-title"]),#checkout-dialog[data-origem] > #checkout-form,#checkout-dialog[data-origem] > #checkout-adjust,#checkout-dialog[data-origem] > #checkout-sales,#checkout-dialog[data-origem] > h3{display:none!important}
    #checkout-dialog[data-origem] #local-cash-history,
    #checkout-dialog[data-origem] #local-stock-title + p,
    #checkout-dialog[data-origem] #local-stock-product,
    #checkout-dialog[data-origem] label[for="local-stock-product"],
    #checkout-dialog[data-origem] #local-stock-quantity,
    #checkout-dialog[data-origem] label[for="local-stock-quantity"],
    #checkout-dialog[data-origem] #local-cart-add,
    #checkout-dialog[data-origem] #local-cart-clear{display:none}
    #checkout-dialog[data-origem="classico"]{font-family:'Segoe UI',sans-serif;border-radius:8px}
    #checkout-dialog .checkout-header{position:sticky;top:-24px;background:#f8fafc;z-index:2;padding:12px 0;border-bottom:1px solid #cbd5e1}
    #checkout-dialog :focus-visible{outline:3px solid #0f766e;outline-offset:2px}
    #checkout-dialog input:not([type=checkbox]),#checkout-dialog select{box-sizing:border-box;max-width:100%}
    #checkout-dialog section[aria-labelledby="recovery-title"]{margin-block:24px;padding-block:20px;border-block:1px solid #cbd5e1}
    #recovery-title{scroll-margin-top:160px}#recovery-state{max-width:70ch;overflow-wrap:anywhere;margin-top:12px}
    #recovery-findings:empty{display:none}#checkout-dialog summary{cursor:pointer}
    #recovery-inventory{overflow:auto;margin-top:16px}#recovery-inventory table{width:100%;border-collapse:collapse;font-size:14px}
    #recovery-inventory th,#recovery-inventory td{padding:10px 8px;text-align:left;border-bottom:1px solid #cbd5e1;vertical-align:top}
    #recovery-inventory th{background:#e2e8f0}#recovery-inventory td{font-variant-numeric:tabular-nums}
  </style><div class="checkout-header"><h2 id="checkout-title">${tituloCaixa}</h2><p>Registro manual: este painel não cobra cartão, não movimenta Pix e não emite nota fiscal.</p>
  <button id="checkout-close">Fechar</button><button id="checkout-reconnect">Atualizar acesso</button></div><p id="checkout-activation" role="status"></p><p id="checkout-message" role="status">Selecione uma conta em Pedidos do cardápio.</p>
  <form id="checkout-form" hidden><h3 id="checkout-summary"></h3><label for="checkout-method">Forma recebida</label><select id="checkout-method"><option value="dinheiro">Dinheiro</option><option value="pix_manual">Pix conferido manualmente</option><option value="cartao_manual">Cartão recebido em outra maquininha</option></select>
  <label for="checkout-cash">Dinheiro entregue pelo cliente (R$; deixe vazio para valor exato)</label><input id="checkout-cash" inputmode="decimal" placeholder="Ex.: 20,00">
  <label><input id="checkout-confirm" type="checkbox" required> Conferi o recebimento e os itens desta conta.</label><p>O servidor confere o total e calcula o troco. Se a conta mudou, revise antes de tentar novamente.</p><button type="submit">Registrar pagamento e fechar</button></form>
  <form id="checkout-adjust" hidden><h3 id="checkout-adjust-title"></h3><label for="checkout-reason">Motivo</label><input id="checkout-reason" required minlength="5" maxlength="180">
  <div id="checkout-refund-fields"><label><input id="checkout-return" type="checkbox"> Repor estoque: produtos/insumos retornaram em condição de uso.</label><p>Se não marcar, o estoque permanece consumido.</p><label><input id="checkout-refund-confirm" type="checkbox"> Já conferi a devolução do pagamento fora do sistema.</label></div><button type="submit">Confirmar operação</button></form>
  <section aria-labelledby="local-stock-title"><h3 id="local-stock-title">Venda local com estoque do servidor</h3>
  <p>Adicione até 30 produtos migrados e confira o dinheiro recebido e o troco. A venda entra no caixa local; todos os estoques são conferidos juntos. Fardos ainda não estão disponíveis aqui.</p>
  <form id="local-stock-form"><label for="local-stock-product">Produto migrado</label><select id="local-stock-product" required></select>
  <label for="local-stock-quantity">Quantidade na unidade de origem do produto</label><input id="local-stock-quantity" inputmode="decimal" value="1" required>
  <button id="local-cart-add" type="button">Adicionar ao carrinho</button><button id="local-cart-clear" type="button">Limpar carrinho</button>
  <p id="local-draft-state" role="status">Confirme o acesso e abra um turno para recuperar o carrinho.</p><button id="local-draft-discard" type="button">Descartar rascunho</button>
  <div id="local-cart-items" aria-live="polite"></div>
  <fieldset><legend>Ajustes da venda em reais</legend><p>Desconto limitado ao subtotal dos produtos. Informe o motivo quando usar um ajuste.</p>
  <label for="local-discount">Desconto (R$)</label><input id="local-discount" inputmode="decimal" placeholder="0,00">
  <label for="local-surcharge">Acréscimo (R$)</label><input id="local-surcharge" inputmode="decimal" placeholder="0,00">
  <label for="local-adjust-reason">Motivo do ajuste</label><input id="local-adjust-reason" maxlength="180" placeholder="Ex.: desconto combinado com o cliente"></fieldset>
  <fieldset><legend>Pix e cartões conferidos manualmente</legend><p>Preencha o que já recebeu em cada forma. O restante será pago em dinheiro. Para usar só dinheiro, deixe estes campos vazios.</p>
  <label for="local-pay-pix">Pix (R$)</label><input id="local-pay-pix" inputmode="decimal" placeholder="0,00">
  <label for="local-pay-debit">Cartão de débito (R$)</label><input id="local-pay-debit" inputmode="decimal" placeholder="0,00">
  <label for="local-pay-credit">Cartão de crédito (R$)</label><input id="local-pay-credit" inputmode="decimal" placeholder="0,00"></fieldset>
  <label for="local-stock-cash">Dinheiro entregue pelo cliente (R$)</label><input id="local-stock-cash" inputmode="decimal" placeholder="Em branco para valor exato">
  <button id="local-stock-preview" type="button">Conferir carrinho</button><p id="local-stock-preview-text" aria-live="polite"></p>
  <label><input id="local-stock-confirm" type="checkbox" required> Conferi os itens, todos os pagamentos recebidos e a entrega do troco indicado.</label><button type="submit">Registrar venda local</button></form>
  <button id="local-stock-resume" hidden>Retomar venda pendente</button><p id="local-stock-state" role="status"></p>
  <div id="local-cash-history"></div>
  <form id="local-stock-cancel-form" hidden><h4>Cancelar tentativa pendente</h4>
  <p>Use somente quando a venda ainda não foi gravada. O estoque reservado por esta tentativa será devolvido uma única vez.</p>
  <p id="local-stock-cancel-value"></p>
  <label for="local-stock-cancel-reason">Motivo do cancelamento</label><input id="local-stock-cancel-reason" required minlength="5" maxlength="180">
  <label><input id="local-stock-cancel-confirm" type="checkbox" required> A venda não foi concluída e conferi a devolução em cada forma recebida, se houver.</label>
  <button id="local-stock-cancel-submit" type="submit">Cancelar tentativa</button></form></section>
  <section aria-labelledby="local-refund-title"><h3 id="local-refund-title">Estornar venda local</h3>
  <p>Devolução integral pelas formas originais, registrada no turno atual. O fechamento do turno da venda permanece no histórico.</p>
  <form id="local-refund-form"><label for="local-refund-sale">Venda deste terminal</label><select id="local-refund-sale" required></select>
  <p id="local-refund-payments" role="status"></p><label for="local-refund-reason">Motivo da devolução</label><input id="local-refund-reason" required minlength="5" maxlength="180">
  <label><input id="local-refund-stock" type="checkbox"> Repor estoque: o produto voltou em condição de venda.</label><br>
  <label><input id="local-refund-confirm" type="checkbox" required> Conferi a devolução integral em cada forma original fora do sistema.</label>
  <button type="submit">Registrar estorno integral</button></form>
  <button id="local-refund-resume" hidden>Retomar estorno pendente</button><p id="local-refund-state" role="status"></p><div id="local-refund-history"></div></section>
  <section aria-labelledby="server-turn-title"><h3 id="server-turn-title">Turno do restaurante no servidor</h3>
  <p>Controla somente os recebimentos do restaurante. O caixa antigo e suas vendas continuam separados.</p>
  <label for="server-turn-float">Fundo de troco do restaurante (R$)</label><input id="server-turn-float" inputmode="decimal" value="0,00">
  <button id="server-turn-open">Confirmar abertura do turno local</button><button id="server-turn-refresh">Consultar turno no servidor</button>
  <p id="server-turn-state" role="status">Consulte ou confirme a abertura antes de receber pagamentos.</p>
  <button id="server-turn-integrate">Incorporar resumo encerrado ao caixa de teste</button><p id="server-turn-integrated" role="status"></p><div id="server-turn-items"></div>
  <form id="server-turn-close-form" hidden><label for="server-turn-count">Dinheiro contado do restaurante (R$)</label><input id="server-turn-count" inputmode="decimal" required>
  <label><input id="server-turn-confirm" type="checkbox" required> Conferi os recebimentos e as devoluções do restaurante.</label><button type="submit">Encerrar turno do restaurante</button></form></section>
  <section aria-labelledby="checkout-turn-title"><h3 id="checkout-turn-title">Conferência do turno atual</h3>
  <p>Consulta os movimentos do restaurante neste terminal e soma às vendas locais do turno. Não altera o estoque nem o fechamento antigo do caixa.</p>
  <button id="checkout-reconcile">Conferir valores do turno</button><div id="checkout-reconciliation" role="status">Atualize para conferir. Movimentos antigos sem turno não entram nesta consulta.</div></section>
  <section aria-labelledby="recovery-title"><h3 id="recovery-title">Conferência de recuperação</h3>
  <p>Compare as vendas do turno deste terminal com o servidor antes de planejar uma recuperação. A conferência não restaura dados nem movimenta estoque.</p>
  <button id="recovery-current" type="button">Conferir dados deste terminal</button>
  <button id="recovery-stock" type="button">Conferir estoque migrado</button>
  <button id="recovery-history" type="button">Conferir histórico de turnos</button>
  <details><summary>Conferir um arquivo de backup</summary><label for="recovery-file">Backup de homologação do terminal original (JSON, até 10 MB)</label>
  <input id="recovery-file" type="file" accept=".json,application/json"><button id="recovery-check-file" type="button">Conferir arquivo selecionado</button>
  <button id="recovery-file-history" type="button">Conferir histórico do arquivo</button>
  <p>Se faltarem vendas ou devoluções já confirmadas no turno aberto, prepare uma cópia recuperada. Datas usarão o registro do servidor; nomes virão do cadastro do backup. Os dados deste caixa não serão substituídos.</p>
  <button id="recovery-rebuild" type="button">Preparar cópia recuperada</button><button id="recovery-download" type="button" hidden>Salvar cópia conferida</button></details>
  <p id="recovery-state" role="status" aria-live="polite">Abra um turno e confirme o acesso para consultar. A análise cobre o turno atual do backup; o histórico exige conferência própria.</p>
  <ul id="recovery-findings" aria-label="Diferenças e pendências encontradas"></ul><div id="recovery-inventory" hidden></div></section>
  <section id="recovery-install-section" hidden aria-labelledby="recovery-install-title"><h3 id="recovery-install-title">Instalar no perfil novo</h3>
  <p>Selecione acima o backup de homologação já conferido. A instalação aceita somente um perfil sem dados, preserva a autenticação deste terminal e reinicia a tela. O caixa permanece bloqueado para operações até a conclusão da recuperação.</p>
  <button id="recovery-install" type="button">Instalar arquivo neste perfil novo</button><button id="recovery-install-resume" type="button">Retomar instalação interrompida</button>
  <p id="recovery-install-state" role="status" aria-live="polite">Disponível somente nos perfis nomeados de teste.</p></section>
  <section aria-labelledby="cycle-title"><h3 id="cycle-title">Encerrar caixa e abrir próximo turno</h3>
  <p id="cycle-state" role="status"></p>
  <form id="cycle-close-form" hidden><p>Primeiro encerre o restaurante no servidor e incorpore seu resumo acima. Conte o dinheiro total da gaveta, incluindo o fluxo local.</p>
  <label for="cycle-count">Dinheiro total contado (R$)</label><input id="cycle-count" inputmode="decimal" required>
  <label><input id="cycle-close-confirm" type="checkbox" required> Conferi o resumo e a contagem total.</label><button type="submit">Arquivar caixa conferido</button></form>
  <form id="cycle-open-form" hidden><p>Informe apenas o dinheiro reservado para o novo turno. O saldo anterior não é transferido automaticamente.</p>
  <label for="cycle-fund">Fundo de troco do próximo turno (R$)</label><input id="cycle-fund" inputmode="decimal" value="0,00" required>
  <label><input id="cycle-open-confirm" type="checkbox" required> Conferi o fundo de troco separado para este turno.</label><button id="cycle-open-submit" type="submit">Abrir próximo turno</button></form>
  <h4>Histórico de caixas de teste</h4><div id="cycle-history"></div></section>
  <h3>Últimas 30 vendas registradas</h3><button id="checkout-reconnect" type="button">Reconectar histórico</button><div id="checkout-sales"></div>`;
  document.body.append(launcher, dialog);
  if (oficial) dialog.classList.add('checkout-oficial');
  const el = id => dialog.querySelector(`#${id}`), s = sessaoTerminalTeste(); let target, adjustment, stop, generation = 0, busy = false;
  const textoOperacional = aviso => {
    if (!oficial) return aviso;
    const mapa = [
      [/^Homologação habilitada/, 'Novas vendas liberadas.'],
      [/^Loja anterior/, 'Novas vendas liberadas.'],
      [/^Homologação suspensa/, 'Novas vendas suspensas. Conclua o que já estava pendente.'],
      [/^Consultando autorização/, 'Consultando o caixa…'],
      [/^Atualizando autorização/, 'Atualizando…'],
      [/^Sem confirmação do servidor/, 'Sem conexão com o servidor. Novas vendas pausadas.'],
      [/^Não foi possível confirmar/, 'Não foi possível confirmar o acesso. Use Atualizar acesso.'],
      [/^Entre como operador/, 'Entre na frente de caixa para continuar.']
    ];
    const troca = mapa.find(([regra]) => regra.test(aviso));
    return troca ? troca[1] : aviso;
  };
  if (oficial) {
    const subtitulo = dialog.querySelector('.checkout-header p');
    if (subtitulo) subtitulo.textContent = 'Feche uma conta do cardápio, lance uma venda avulsa ou registre um estorno neste turno.';
    el('checkout-message').textContent = 'Nenhuma conta selecionada. A venda avulsa fica logo abaixo.';
    el('local-stock-title').textContent = 'Venda avulsa';
    el('local-stock-title').nextElementSibling.textContent = 'Escolha o produto e informe como o cliente pagou. O estoque baixa nesta venda.';
    const rotuloProduto = dialog.querySelector('label[for="local-stock-product"]');
    const rotuloQtd = dialog.querySelector('label[for="local-stock-quantity"]');
    if (rotuloProduto) rotuloProduto.textContent = 'Produto';
    if (rotuloQtd) rotuloQtd.textContent = 'Quantidade';
    el('server-turn-title').textContent = 'Turno do cardápio';
    el('server-turn-title').nextElementSibling.textContent = 'Abertura e encerramento dos recebimentos do cardápio neste caixa.';
    el('checkout-turn-title').textContent = 'Conferência do turno';
    el('checkout-turn-title').nextElementSibling.textContent = 'Soma as vendas deste terminal no turno aberto.';
    el('cycle-title').textContent = 'Fechar caixa e abrir o próximo';
    el('local-refund-title').textContent = 'Estornar venda';
    el('local-refund-title').nextElementSibling.textContent = 'Devolve o valor integral da venda e pode repor o estoque.';
    const rotuloVenda = dialog.querySelector('label[for="local-refund-sale"]');
    if (rotuloVenda) rotuloVenda.textContent = 'Venda';
    const historico = [...dialog.querySelectorAll('h4')].find((item) => item.textContent.includes('teste'));
    if (historico) historico.textContent = 'Turnos encerrados';
  }
  const pendenciasAtendimento = instalarConsultaPendenciasAtendimento({ host: el('recovery-title').parentElement, call: (nome, dados) => s.call(nome, dados) });
  const pagamentoConta=criarPagamentoAtendimentoPendente({storage:localStorage,sessao:s,ambienteTeste:true});
  const retomarConta=document.createElement('button');retomarConta.id='checkout-resume-payment';retomarConta.type='button';retomarConta.textContent='Retomar registro do pagamento';retomarConta.hidden=localStorage.getItem('flowpdv_pagamento_atendimento_pendente')===null;el('checkout-message').after(retomarConta);
  retomarConta.onclick=()=>run(async()=>{const r=await pagamentoConta.retomar();el('checkout-form').hidden=true;message(`Pagamento confirmado: ${r.vendaId}. Não receba o valor novamente.`);});
  const money = n => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let operacional,avisoOperacional='';
  let novasPermitidas=false, avisoAtivacao='Consultando autorização para novas vendas.';
  function setActivation(permitidas,aviso) {
    novasPermitidas=permitidas;avisoAtivacao=aviso;
    el('checkout-activation').textContent=textoOperacional(aviso);
    dialog.dataset.novasPermitidas=String(permitidas);
    if(!permitidas){vendaPreparada=null;el('local-stock-confirm').checked=false;}
    renderLifecycle();
  }
  function exigirNovaVenda(){if(!novasPermitidas)throw new Error(avisoAtivacao);}

  const message = text => { const aviso = textoOperacional(String(text || '')); el('checkout-message').textContent = aviso; avisoOperacional = aviso; };
  const ciclo=criarCicloCaixaTeste({storage:localStorage,ambienteTeste:usarFluxoOperacionalV2(),terminalId:StorageService.getDeviceId(),calcular:t=>window.CaixaModule.calcularResumoFinanceiro(t),conferir:t=>{StorageService.exigirVendaRecuperada();resumoConciliacao(t,StorageService.getVendas(),[]);},call:(name,data)=>s.call(name,data),uuid:()=>crypto.randomUUID(),agora:()=>new Date().toISOString(),nomeOperador:()=>window.AuthModule?.getUsuario()?.nome||'Operador de teste'});
  const rascunho=criarRascunhoCarrinhoTeste({storage:localStorage,ambienteTeste:usarFluxoOperacionalV2()});
  let lojaRascunho=null,contextoRascunho=null,chaveRascunho=null,rascunhoInvalido=false;
  const contextoPlano=p=>({lojaId:p.lojaId,terminalId:p.venda.terminalId,turnoId:p.payload.turno.id,dataAbertura:p.payload.turno.dataAbertura});
  const ponte=criarVendaServidorTeste({storage:localStorage,servico:StorageService,ambienteTeste:usarFluxoOperacionalV2(),call:(n,d)=>s.call(n,d),uuid:()=>crypto.randomUUID(),agora:()=>new Date().toISOString(),aoPersistirPendencia:p=>rascunho.remover(contextoPlano(p))});let vendaPreparada;
  let carrinho=[];
  function salvarRascunho(){
    if(!contextoRascunho)throw new Error('Confirme acesso à loja e turno antes de editar.');
    if(rascunhoInvalido)throw new Error('Rascunho inválido: descarte-o antes de continuar.');
    if(ponte.pendente())return;
    rascunho.salvar(contextoRascunho,{itens:carrinho,campos:Object.fromEntries(rascunho.campos.map(k=>[k,el(k).value]))});
    el('local-draft-state').textContent='Rascunho salvo neste terminal e turno. Ainda não é uma venda.';
  }
  function sincronizarRascunho(){
    const turno=StorageService.getTurnoAtual();
    const contexto=lojaRascunho&&turno&&!turno.dataFechamento&&turno.status==='aberto'?{lojaId:lojaRascunho,terminalId:StorageService.getDeviceId(),turnoId:turno.id,dataAbertura:turno.dataAbertura}:null;
    const key=contexto?rascunho.chave(contexto):null;if(key===chaveRascunho)return;
    contextoRascunho=contexto;chaveRascunho=key;rascunhoInvalido=false;carrinho=[];vendaPreparada=null;el('local-stock-form').reset();el('local-stock-confirm').checked=false;el('local-stock-preview-text').textContent='';
    el('local-draft-state').textContent=contexto?'Nenhum rascunho neste turno.':'Confirme o acesso e abra um turno para recuperar o carrinho.';
    if(!contexto)return;
    if(ponte.pendente()){el('local-draft-state').textContent='Venda pendente: retome a tentativa original.';return;}
    try{const d=rascunho.carregar(contexto);if(d){carrinho=d.itens;for(const k of rascunho.campos)el(k).value=d.campos[k];el('local-draft-state').textContent='Rascunho recuperado. Confira preços, produtos e pagamentos novamente antes de registrar.';}}
    catch(e){rascunhoInvalido=true;el('local-draft-state').textContent=e.message;}
  }
  function invalidarCarrinho(){vendaPreparada=null;el('local-stock-confirm').checked=false;el('local-stock-preview-text').textContent='Confira a venda após alterar os itens ou valores.';try{salvarRascunho();}catch(e){el('local-draft-state').textContent='Não salvo: '+e.message;}operacional?.render();}
  const produtoPorId=id=>StorageService.getProdutos().find(p=>String(p.id)===String(id));
  const ajustesVenda=()=>{const a={desconto:el("local-discount").value,acrescimo:el("local-surcharge").value,motivo:el("local-adjust-reason").value};return a.desconto.trim()||a.acrescimo.trim()||a.motivo.trim()?a:undefined;};
  const ajusteTexto=v=>v.ajuste?` • Subtotal: ${money(Math.round(v.subtotal*100))} • Desconto: ${money(v.ajuste.descontoCentavos)} • Acréscimo: ${money(v.ajuste.acrescimoCentavos)} • Motivo: ${v.ajuste.motivo}`:"";
  const outrasFormas=()=>{const p={'PIX':el('local-pay-pix').value,'Débito':el('local-pay-debit').value,'Crédito':el('local-pay-credit').value};return Object.values(p).some(v=>v.trim())?p:undefined;};
  const formasTexto=v=>(v.pagamentosCentavos||[{forma:'Dinheiro',valorCentavos:Math.round(v.total*100)}]).map(p=>p.forma+': '+money(p.valorCentavos)).join(' + ');
  const linhasCarrinho=()=>carrinho.map(i=>({produto:produtoPorId(i.id),quantidade:i.quantidade}));
  function renderCarrinho(){
    const list=el('local-cart-items');list.replaceChildren();
    if(!carrinho.length){list.textContent='Carrinho vazio. Adicione um produto para começar.';return;}
    for(const [index,item] of carrinho.entries()){
      const produto=produtoPorId(item.id),row=document.createElement('div');row.dataset.produtoId=item.id;row.style.cssText='border-bottom:1px solid #cbd5e1;padding:12px 0';
      const label=document.createElement('label'),input=document.createElement('input'),subtotal=document.createElement('p'),remove=document.createElement('button');
      input.id=`local-cart-quantity-${index}`;input.inputMode='decimal';input.value=item.quantidade;input.required=true;label.htmlFor=input.id;
      label.textContent=`${produto?.nome||'Produto indisponível'} • ${produto?.unidade||''} • Quantidade`;
      const atualizar=()=>{const q=Number(String(item.quantidade).replace(',','.'));subtotal.textContent=produto&&Number.isFinite(precoExibicao(produto))&&Number.isFinite(q)&&q>0?`Unitário: ${money(precoExibicao(produto))} • Subtotal: ${money(Math.round(q*precoExibicao(produto)))}`:'Confira o produto e a quantidade.';};
      input.oninput=()=>{if(busy||ponte.pendente())return;item.quantidade=input.value;invalidarCarrinho();atualizar();};
      remove.type='button';remove.textContent='Remover';remove.setAttribute('aria-label',`Remover ${produto?.nome||'produto'}`);remove.onclick=()=>run(async()=>{carrinho.splice(index,1);invalidarCarrinho();});
      atualizar();row.append(label,input,subtotal,remove);list.append(row);
    }
  }
  el('local-cart-add').onclick=()=>run(async()=>{
    if(!contextoRascunho)throw new Error('Aguarde a confirmação de acesso antes de editar o carrinho.');
    const id=el('local-stock-product').value;
    if(carrinho.some(i=>i.id===id))throw new Error('Produto já adicionado. Altere a quantidade na linha do carrinho.');
    const next=[...carrinho,{id,quantidade:el('local-stock-quantity').value}];
    ponte.prepararCarrinho(next.map(i=>({produto:produtoPorId(i.id),quantidade:i.quantidade})));
    carrinho=next;invalidarCarrinho();
  });
  const descartarRascunho=()=>run(async()=>{
    if(!contextoRascunho||ponte.pendente())throw new Error('Confirme o acesso ou resolva a venda pendente antes de descartar.');
    rascunho.remover(contextoRascunho);rascunhoInvalido=false;carrinho=[];vendaPreparada=null;el('local-stock-form').reset();el('local-stock-preview-text').textContent='';el('local-draft-state').textContent='Rascunho descartado. Nenhuma venda ou estoque foi alterado.';
  });
  el('local-cart-clear').onclick=descartarRascunho;el('local-draft-discard').onclick=descartarRascunho;
  for(const id of ['local-stock-product','local-stock-quantity','local-stock-cash','local-pay-pix','local-pay-debit','local-pay-credit','local-discount','local-surcharge','local-adjust-reason'])el(id).addEventListener('input',invalidarCarrinho);
  const estorno=criarEstornoServidorTeste({storage:localStorage,servico:StorageService,ambienteTeste:usarFluxoOperacionalV2(),call:(n,d)=>s.call(n,d)});
  function renderEstornos(){
    const pending=estorno.pendente(),turno=StorageService.getTurnoAtual();
    el('local-refund-form').hidden=!!pending;el('local-refund-resume').hidden=!pending;
    if(pending)el('local-refund-state').textContent=`Estorno pendente de ${money(pending.totalCentavos)}. Retome para concluir; não repita a devolução.`;
    const history=[...(turno?.estornosLocaisV2||[]),...StorageService.getHistoricoTurnos().flatMap(t=>t.estornosLocaisV2||[])];
    const refunded=new Set(history.map(e=>e.vendaId)),select=el('local-refund-sale'),value=select.value;
    select.replaceChildren();for(const v of StorageService.getVendas().filter(v=>v.estoqueServidorV2&&v.terminalId===StorageService.getDeviceId()&&!refunded.has(v.id)))select.add(new Option(`${v.id} • ${money(Math.round(v.total*100))}`,v.id));
    if([...select.options].some(o=>o.value===value))select.value=value;
    if(!select.options.length)select.add(new Option('Nenhuma venda disponível',''));
    const selected=StorageService.getVendas().find(v=>v.id===select.value);el('local-refund-payments').textContent=selected?'Devolver: '+formasTexto(selected):'';
    el('local-refund-history').replaceChildren();
    for(const e of history.slice(0,10)){const row=document.createElement('p');row.textContent=`${e.vendaId} • Devolução: ${money(e.totalCentavos)} • Turno: ${e.turno.id} • Estoque ${e.devolverEstoque?'reposto':'não reposto'} • ${e.motivo}`;el('local-refund-history').append(row);}
  }
  el('local-refund-sale').onchange=()=>{el('local-refund-confirm').checked=false;renderEstornos();};
  async function concluirEstorno(plano){
    const result=await estorno.executar(plano);el('local-refund-form').reset();
    el('local-refund-state').dataset.vendaId=result.vendaId;el('local-refund-state').textContent=`Estorno confirmado: ${money(result.totalCentavos)} descontados do caixa atual. Estoque ${result.devolverEstoque?'reposto':'não reposto'}.`;
    el('checkout-reconciliation').textContent='Estorno local registrado. Atualize a conferência do turno.';
  }
  el('local-refund-form').onsubmit=event=>{event.preventDefault();run(()=>concluirEstorno(estorno.preparar(el('local-refund-sale').value,el('local-refund-reason').value,el('local-refund-stock').checked,el('local-refund-confirm').checked)));};
  el('local-refund-resume').onclick=()=>run(()=>concluirEstorno());
  function renderBalcao(){
    const pending=ponte.pendente();el('local-stock-form').hidden=!!pending;el('local-stock-resume').hidden=!pending||!!pending.cancelamento;
    const gravada=pending&&(localStorage.getItem('flowpdv_commit_venda')||StorageService.getVendas().some(v=>v.id===pending.venda.id));
    el('local-stock-cancel-form').hidden=!pending||!!gravada;
    el('local-stock-cancel-reason').readOnly=!!pending?.cancelamento;
    el('local-stock-cancel-confirm').disabled=!!pending?.cancelamento;
    el('local-stock-cancel-submit').textContent=pending?.cancelamento?'Retomar cancelamento':'Cancelar tentativa';
    if(pending?.cancelamento){el('local-stock-cancel-reason').value=pending.cancelamento.motivo;el('local-stock-cancel-confirm').checked=true;}
    if(pending) el('local-stock-state').textContent=pending.cancelamento?'Cancelamento pendente. Retome para confirmar a devolução do estoque.':gravada?'Venda gravada ou em recuperação. Retome a confirmação; uma devolução exige estorno.':'Tentativa pendente. Retome a venda ou cancele antes de iniciar outra ou encerrar o turno.';
    if(pending&&Number.isSafeInteger(pending.venda.recebidoDinheiroCentavos))el('local-stock-state').textContent+=`${ajusteTexto(pending.venda)} Pagamentos: ${formasTexto(pending.venda)} • Recebido em dinheiro: ${money(pending.venda.recebidoDinheiroCentavos)} • Troco: ${money(pending.venda.trocoCentavos)}. A retomada não exige nova movimentação de dinheiro.`;
    el('local-stock-cancel-value').textContent=pending?`Valor da venda: ${money(Math.round(pending.venda.total*100))}. Se o troco já foi entregue, devolva somente esse valor. Pagamentos originais: ${formasTexto(pending.venda)}. Confira cada devolução antes de confirmar.`:'';
    const records=JSON.parse(localStorage.getItem('flowpdv_migracoes_estoque_teste')||'[]').filter(r=>r.status==='confirmado');
    const signature=JSON.stringify(records.map(r=>r.produto.id)),select=el('local-stock-product');
    if(select.dataset.options!==signature){select.replaceChildren();for(const r of records){const unidade=r.produto.unidade?` (${r.produto.unidade})`:'';select.add(new Option(`${r.produto.nome}${unidade}`,String(r.produto.id)));}select.dataset.options=signature;vendaPreparada=null;}
    sincronizarRascunho();el('local-stock-form').hidden=!!pending||!contextoRascunho;dialog.dataset.rascunhoReady=String(!!contextoRascunho&&novasPermitidas);renderCarrinho();
    el('local-stock-form').querySelectorAll('input,select,button').forEach(control=>control.disabled=busy||!novasPermitidas);
    el('local-cash-history').replaceChildren();
    for(const v of StorageService.getVendas().filter(v=>v.estoqueServidorV2&&v.terminalId===StorageService.getDeviceId()&&Number.isSafeInteger(v.recebidoDinheiroCentavos)).slice(0,10)){
      const row=document.createElement('p');row.textContent=`${v.id} • Venda: ${money(Math.round(v.total*100))}${ajusteTexto(v)} • ${formasTexto(v)} • Recebido em dinheiro: ${money(v.recebidoDinheiroCentavos)} • Troco: ${money(v.trocoCentavos)} (registro original)`;el('local-cash-history').append(row);
    }
  }
  el('local-stock-preview').onclick=()=>run(async()=>{
    exigirNovaVenda();
    salvarRascunho();
    vendaPreparada=ponte.prepararCarrinho(linhasCarrinho(),el('local-stock-cash').value,outrasFormas(),ajustesVenda());el('local-stock-confirm').checked=false;
    el('local-stock-preview-text').textContent=`${vendaPreparada.venda.itens.map(i=>`${i.nome}: ${i.quantidade} ${i.unidade}`).join(' • ')}${ajusteTexto(vendaPreparada.venda)} • Pagamentos: ${formasTexto(vendaPreparada.venda)} • Total: ${money(vendaPreparada.payload.totalCentavos)} • Recebido: ${money(vendaPreparada.payload.recebidoDinheiroCentavos)} em dinheiro • Troco: ${money(vendaPreparada.payload.trocoCentavos)}. Confira a entrega do troco antes de registrar.`;
  });
  const concluirVenda=async plano=>{
    const venda=await ponte.executar(plano);carrinho=[];vendaPreparada=null;el('local-stock-form').reset();el('local-stock-preview-text').textContent='';
    el('local-draft-state').textContent='Venda registrada. O rascunho foi removido.';
    el('local-stock-state').dataset.vendaId=venda.id;el('local-stock-state').textContent=`Venda local confirmada: ${money(Math.round(venda.total*100))}. Estoque baixado no servidor, sem nova baixa local.`;
    el('checkout-reconciliation').textContent='Venda local registrada. Atualize a conferência do turno.';
    if(usarAplicativoIntegradoV2() && venda.origemAplicativoCompleto) window.PdvModule?.atualizarVendaAplicativoRecuperada(venda);
  };
  el('local-stock-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    exigirNovaVenda();
    salvarRascunho();
    if(!vendaPreparada||!el('local-stock-confirm').checked)throw new Error('Confira novamente a venda antes de confirmar.');
    const fresh=ponte.prepararCarrinho(linhasCarrinho(),el('local-stock-cash').value,outrasFormas(),ajustesVenda());
    if(JSON.stringify(fresh.payload.ajuste)!==JSON.stringify(vendaPreparada.payload.ajuste)||JSON.stringify(fresh.payload.pagamentos)!==JSON.stringify(vendaPreparada.payload.pagamentos)||JSON.stringify(fresh.venda.itens)!==JSON.stringify(vendaPreparada.venda.itens)||fresh.payload.totalCentavos!==vendaPreparada.payload.totalCentavos||fresh.payload.recebidoDinheiroCentavos!==vendaPreparada.payload.recebidoDinheiroCentavos||fresh.payload.trocoCentavos!==vendaPreparada.payload.trocoCentavos||fresh.lojaId!==vendaPreparada.lojaId||JSON.stringify(fresh.payload.turno)!==JSON.stringify(vendaPreparada.payload.turno))throw new Error('Itens, preço, ajuste, dinheiro, pagamentos ou turno mudaram. Confira novamente antes de confirmar.');
    await concluirVenda(vendaPreparada);
  });};
  el('local-stock-resume').onclick=()=>run(()=>concluirVenda());
  el('local-stock-cancel-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    const result=await ponte.cancelar(el('local-stock-cancel-reason').value,el('local-stock-cancel-confirm').checked);
    carrinho=[];vendaPreparada=null;el('local-stock-form').reset();el('local-draft-state').textContent='Tentativa cancelada. O rascunho foi removido.';el('local-stock-cancel-form').reset();el('local-stock-preview-text').textContent='';
    el('local-stock-state').dataset.canceladaId=result.vendaId;
    el('local-stock-state').textContent=result.estoqueDevolvido?'Tentativa cancelada. Estoque devolvido no servidor; nenhuma venda entrou no caixa.':'Tentativa cancelada antes da baixa. Nenhuma venda ou movimentação de estoque foi criada.';
    el('checkout-reconciliation').textContent='Tentativa cancelada. Os valores do caixa permanecem iguais.';
  });};
  function renderLifecycle() {
    renderBalcao();
    renderEstornos();operacional?.render();
    const {atual,historico}=ciclo.estado(),pending=atual?.status==='abertura_pendente';
    el('cycle-state').dataset.status=atual?.status||'sem_turno';
    el('cycle-state').textContent=atual?pending?'Abertura pendente. Retome com o mesmo fundo; pagamentos aguardam confirmação.':`Turno atual: ${atual.id}${atual.restauranteV2?' • Gaveta total esperada: '+money(Math.round(window.CaixaModule.calcularResumoFinanceiro(atual).saldoEmGaveta*100)):''}`:'Caixa arquivado ou ainda não aberto. Você pode iniciar um novo turno.';
    el('cycle-close-form').hidden=!atual?.restauranteV2||atual.status!=='aberto';
    el('cycle-open-form').hidden=!!atual&&!pending;
    el('cycle-fund').readOnly=pending;
    if(pending) el('cycle-fund').value=(atual.fundoRestauranteCentavos/100).toFixed(2);
    el('cycle-open-submit').textContent=pending?'Retomar abertura pendente':'Abrir próximo turno';
    el('cycle-history').replaceChildren();
    for(const t of historico.slice(0,10)){
      const p=document.createElement('p');p.dataset.turnoId=t.id;
      p.textContent=`${t.id} • Encerrado • Esperado: ${money(Math.round(t.saldoEsperado*100))} • Contado: ${money(Math.round(t.saldoInformado*100))} • Diferença: ${money(Math.round(t.diferenca*100))}`;el('cycle-history').append(p);
    }
    if(!historico.length) el('cycle-history').textContent='Nenhum caixa arquivado neste perfil.';
  }
  el('server-turn-integrate').onclick = () => run(async () => {
    const reference = turnoLocalAberto(), epoch = generation;
    const snapshot = await s.call('obterResumoFechadoTurnoV2', { turno: reference });
    if (epoch !== generation) return;
    if (JSON.stringify(turnoLocalAberto()) !== JSON.stringify(reference)) throw new Error('Turno mudou. Confira novamente.');
    const local = StorageService.getTurnoAtual();
    resumoConciliacao(local, StorageService.getVendas(), []); // Recusa histórico duplicado/importado.
    StorageService.exigirVendaRecuperada();
    const merged = incorporarResumoRestaurante(local, snapshot);
    // Escrita exclusiva do perfil de teste; não chama salvarVenda nem sincronização legada.
    localStorage.setItem('adega_turno_atual', JSON.stringify(merged));
    const calculated = window.CaixaModule.calcularResumoFinanceiro(merged);
    renderItems(snapshot);
    el('server-turn-integrated').dataset.totalCentavos = String(Math.round(calculated.totalVendas * 100));
    el('server-turn-integrated').textContent = `Resumo incorporado uma única vez. Caixa: ${money(Math.round(calculated.totalVendas * 100))} • Gaveta esperada: ${money(Math.round(calculated.saldoEmGaveta * 100))} • Cartão a classificar: ${money(Math.round(calculated.totalCartaoNaoClassificado * 100))}. As vendas e o estoque não foram regravados.`;
  });
  let serverTurn, closeAttempt;
  function renderItems(snapshot) {
    el('server-turn-items').replaceChildren();
    const heading=document.createElement('h4');heading.textContent='Itens do resumo encerrado';el('server-turn-items').append(heading);
    const note=document.createElement('p');note.textContent='Adicionais já incluídos no preço. Estornos aparecem com quantidade e valor negativos.';el('server-turn-items').append(note);
    for(const movimento of snapshot.detalhes || []) for(const item of movimento.itens){
      const row=document.createElement('p');row.dataset.movimento=movimento.tipo;
      row.textContent=`${movimento.tipo==='estorno_manual'?'Estorno':'Recebimento'} • ${item.quantidade} × ${item.nome} • ${money(item.totalCentavos)}${item.opcoes.length?' • '+item.opcoes.map(o=>`${o.quantidade} × ${o.nome}`).join(', '):''}`;
      el('server-turn-items').append(row);
    }
  }
  const parseMoney = text => {
    const raw = text.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error('Informe um valor com até duas casas decimais.');
    const value = Math.round(Number(raw) * 100); if (!Number.isSafeInteger(value)) throw new Error('Valor inválido.'); return value;
  };
  function showServerTurn(turn) {
    serverTurn = turn;
    el('server-turn-close-form').hidden = !turn || turn.status !== 'aberto';
    el('server-turn-state').dataset.status = turn?.status || 'ausente';
    el('server-turn-state').textContent = !turn ? 'Turno ainda não registrado no servidor.' : `Turno ${turn.id}: ${turn.status} • Recebimentos líquidos: ${money(turn.totalCentavos)} • Dinheiro esperado: ${money(turn.trocoInicialCentavos + (turn.formas.dinheiro || 0))}${turn.status === 'fechado' ? ` • Diferença: ${money(turn.diferencaCentavos)}` : ''}. Valores somente do restaurante.`;
  }
  el('cycle-close-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    const closed=await ciclo.encerrar({dinheiroContadoCentavos:parseMoney(el('cycle-count').value),confirmado:el('cycle-close-confirm').checked});
    target=null;adjustment=null;el('checkout-form').hidden=true;el('checkout-adjust').hidden=true;
    el('cycle-close-form').reset();message(`Caixa ${closed.id} arquivado. Diferença: ${money(Math.round(closed.diferenca*100))}. Abra o próximo turno quando estiver pronto.`);
    atualizarCaixaAplicativo();
  });};
  el('cycle-open-form').onsubmit=event=>{event.preventDefault();run(async()=>{
    const turn=await ciclo.abrir({fundoCentavos:parseMoney(el('cycle-fund').value),confirmado:el('cycle-open-confirm').checked});
    showServerTurn(turn);closeAttempt=null;target=null;adjustment=null;
    el('server-turn-float').value=(turn.trocoInicialCentavos/100).toFixed(2);
    el('server-turn-integrated').textContent='';delete el('server-turn-integrated').dataset.totalCentavos;el('server-turn-items').replaceChildren();
    el('checkout-reconciliation').textContent='Novo turno aberto. Atualize a conferência para consultar somente este turno.';delete el('checkout-reconciliation').dataset.totalCentavos;
    el('server-turn-close-form').reset();el('cycle-open-form').reset();message('Novo turno confirmado no servidor. Os movimentos anteriores permanecem no histórico.');
    atualizarCaixaAplicativo();
  });};
  function atualizarCaixaAplicativo() {
    if(!usarAplicativoIntegradoV2()) return;
    window.CaixaModule.renderStatusTurno();window.CaixaModule.renderHistoricoVendasTurno();window.CaixaModule.renderHistoricoTurnosFechados();
    window.PdvModule.renderMiniDashboardTurno();window.PdvModule.renderCarrinho();
  }
  const centavosInformados = valor => {
    const cents = Math.round(Number(valor) * 100);
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Informe um valor de caixa válido.');
    return cents;
  };
  if (oficial) window.FlowCaixaOficial = {
    abrir(fundoReais) { return ciclo.abrir({ fundoCentavos: centavosInformados(fundoReais), confirmado: true }).then(turn => { atualizarCaixaAplicativo(); return turn; }); },
    retomar() { return ciclo.retomarTurnoServidor().then(turn => { atualizarCaixaAplicativo(); return turn; }); },
    estadoLocal() { return ciclo.estado(); },
    async encerrar(dinheiroReais) {
      const contado = centavosInformados(dinheiroReais);
      const liberarEstornoTurnoMorto = async (refTurno) => {
        const key = 'flowpdv_estorno_local_pendente';
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        let pendente;
        try { pendente = JSON.parse(raw); } catch { localStorage.removeItem(key); return true; }
        const ref = refTurno || pendente?.payload?.turno;
        if (!ref?.id) { localStorage.removeItem(key); return true; }
        try {
          const remotoPendente = (await s.call('consultarTurnoCaixaV2', { turno: ref })).turno;
          if (remotoPendente?.status === 'aberto') return false;
        } catch (_) { /* turno inacessível — libera a pendência local */ }
        localStorage.removeItem(key);
        return true;
      };
      const arquivarLocal = async (centavos) => {
        try {
          return await ciclo.encerrar({ dinheiroContadoCentavos: centavos, confirmado: true });
        } catch (erro) {
          const msg = String(erro && erro.message || erro || '');
          if (/Turno já consta no histórico/i.test(msg)) {
            return ciclo.encerrarOrfaoLocal({ dinheiroContadoCentavos: centavos, confirmado: true });
          }
          if (!/Encerre o turno do restaurante|Turno não encontrado|Resumo difere|não corresponde/i.test(msg)) throw erro;
          return ciclo.encerrarOrfaoLocal({ dinheiroContadoCentavos: centavos, confirmado: true });
        }
      };
      let turno = turnoLocalAberto();
      let remoto = null;
      try {
        remoto = (await s.call('consultarTurnoCaixaV2', { turno })).turno;
      } catch (_) {
        remoto = null;
      }
      if (remoto?.status === 'aberto') {
        await s.call('encerrarTurnoCaixaV2', { turno, revisao: remoto.revisao, dinheiroContadoCentavos: contado, confirmado: true });
        const closed = await arquivarLocal(contado);
        atualizarCaixaAplicativo();
        return closed;
      }
      if (remoto?.status === 'fechado') {
        await liberarEstornoTurnoMorto(turno);
        const contadoServidor = Number.isSafeInteger(remoto.dinheiroContadoCentavos) ? remoto.dinheiroContadoCentavos : contado;
        const closed = await arquivarLocal(contadoServidor);
        atualizarCaixaAplicativo();
        return closed;
      }
      try {
        await ciclo.retomarTurnoServidor();
        atualizarCaixaAplicativo();
        turno = turnoLocalAberto();
        remoto = (await s.call('consultarTurnoCaixaV2', { turno })).turno;
        if (remoto?.status === 'aberto') {
          await s.call('encerrarTurnoCaixaV2', { turno, revisao: remoto.revisao, dinheiroContadoCentavos: contado, confirmado: true });
          const closed = await arquivarLocal(contado);
          atualizarCaixaAplicativo();
          return closed;
        }
        if (remoto?.status === 'fechado') {
          await liberarEstornoTurnoMorto(turno);
          const contadoServidor = Number.isSafeInteger(remoto.dinheiroContadoCentavos) ? remoto.dinheiroContadoCentavos : contado;
          const closed = await arquivarLocal(contadoServidor);
          atualizarCaixaAplicativo();
          return closed;
        }
      } catch (erro) {
        const msg = String(erro && erro.message || erro || '');
        if (!/Não há turno aberto neste terminal no servidor/i.test(msg)) throw erro;
      }
      await liberarEstornoTurnoMorto(turno);
      const closed = ciclo.encerrarOrfaoLocal({ dinheiroContadoCentavos: contado, confirmado: true });
      atualizarCaixaAplicativo();
      return closed;
    },
    async estornar(vendaId, motivo, devolverEstoque) {
      const liberarEstornoTurnoMorto = async () => {
        const key = 'flowpdv_estorno_local_pendente';
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        let pendente;
        try { pendente = JSON.parse(raw); } catch { localStorage.removeItem(key); return true; }
        const ref = pendente?.payload?.turno;
        if (!ref?.id) { localStorage.removeItem(key); return true; }
        try {
          const remotoPendente = (await s.call('consultarTurnoCaixaV2', { turno: ref })).turno;
          if (remotoPendente?.status === 'aberto') return false;
        } catch (_) { /* libera */ }
        localStorage.removeItem(key);
        return true;
      };
      const rodar = () => estorno.executar(estorno.preparar(vendaId, motivo, devolverEstoque === true, true));
      try {
        const result = await rodar();
        atualizarCaixaAplicativo();
        return result;
      } catch (erro) {
        let falha = erro;
        const msg = String(erro && erro.message || erro || '');
        if (/Turno não está aberto neste terminal|Confira o caixa/i.test(msg)) {
          try {
            await ciclo.retomarTurnoServidor();
            atualizarCaixaAplicativo();
            const result = await rodar();
            atualizarCaixaAplicativo();
            return result;
          } catch (e2) {
            falha = e2;
          }
        }
        const msg2 = String(falha && falha.message || falha || '');
        if (/Não há turno aberto neste terminal no servidor|Recupere o turno original do estorno|Abra um turno neste terminal/i.test(msg2)) {
          if (await liberarEstornoTurnoMorto()) {
            atualizarCaixaAplicativo();
            throw new Error('O turno desta venda já foi encerrado no servidor. Liberamos o estorno pendente — feche o caixa e, se já devolveu o valor, confira o estoque.');
          }
        }
        throw falha;
      }
    }
  };
  el('server-turn-open').onclick = () => run(async () => {
    const result = await s.call('abrirTurnoCaixaV2', { turno: turnoLocalAberto(), trocoInicialCentavos: parseMoney(el('server-turn-float').value) });
    showServerTurn(result.turno); closeAttempt = null;
  });
  el('server-turn-refresh').onclick = () => run(async () => {
    showServerTurn((await s.call('consultarTurnoCaixaV2', { turno: turnoLocalAberto() })).turno); closeAttempt = null;
  });
  el('server-turn-close-form').onsubmit = event => { event.preventDefault(); run(async () => {
    StorageService.exigirVendaRecuperada();
    if (!serverTurn || serverTurn.status !== 'aberto') throw new Error('Consulte o turno aberto antes de encerrar.');
    const turno = turnoLocalAberto(), contado = parseMoney(el('server-turn-count').value);
    if (serverTurn.id !== turno.id || serverTurn.terminalId !== turno.terminalId || serverTurn.dataAbertura !== turno.dataAbertura) throw new Error('O turno local mudou. Consulte novamente.');
    closeAttempt ||= { turno, revisao: serverTurn.revisao, dinheiroContadoCentavos: contado, confirmado: el('server-turn-confirm').checked };
    if (closeAttempt.dinheiroContadoCentavos !== contado) throw new Error('Consulte o turno para revisar a tentativa anterior.');
    const result = await s.call('encerrarTurnoCaixaV2', closeAttempt); showServerTurn(result.turno); closeAttempt = null;
    message('Turno do restaurante encerrado no servidor. Novos pagamentos exigem outro turno aberto.');
  }); };
  el('checkout-reconcile').onclick = () => run(async () => {
    const output = el('checkout-reconciliation'); output.replaceChildren();
    const epoch = generation, turno = turnoLocalAberto(), local = StorageService.getTurnoAtual();
    const result = await s.call('consultarMovimentosTurnoV2', { turno });
    if (epoch !== generation) return;
    if (JSON.stringify(turnoLocalAberto()) !== JSON.stringify(turno)) throw new Error('O turno mudou. Atualize a conferência.');
    const summary = resumoConciliacao(local, StorageService.getVendas(), result.movimentos,totalEstornosLocais(local));
    output.dataset.totalCentavos = String(summary.total);
    const refundRow=document.createElement('p');refundRow.textContent=`Estornos de vendas locais: ${money(summary.estornosLocais)}`;output.append(refundRow);
    for (const [label, value] of [['Vendas locais',summary.legado],['Recebimentos do restaurante',summary.recebimentos],['Estornos neste turno',summary.estornos],['Total líquido conferido',summary.total],['Restaurante — dinheiro líquido',summary.formas.dinheiro || 0],['Restaurante — Pix líquido',summary.formas.pix_manual || 0],['Restaurante — cartão sem classificação',summary.formas.cartao_manual || 0]]) {
      const row = document.createElement('p'); row.textContent = `${label}: ${money(value)}`; output.append(row);
    }
    const note = document.createElement('p'); note.textContent = `Turno ${turno.id} • ${summary.vendasLocais} vendas locais e ${summary.movimentos} movimentos do restaurante • conferido às ${new Date().toLocaleTimeString('pt-BR')}. Este total não é o saldo da gaveta: não inclui troco inicial, sangrias ou suprimentos.`; output.append(note);
  });
  let origemPagamento=null;
  const open = (origem=null) => {
    retomarConta.hidden=localStorage.getItem('flowpdv_pagamento_atendimento_pendente')===null;if(!retomarConta.hidden)message('Existe um registro de pagamento pendente. Retome a tentativa original; não receba o valor novamente.');
    origemPagamento=typeof origem==='string'?origem:null;
    if(oficial&&window.AuthModule?.getUsuario()&&/operador|frente de caixa/.test(el('checkout-message').textContent))el('checkout-message').textContent='Nenhuma conta selecionada. A venda avulsa fica logo abaixo.';
    if(origemPagamento)dialog.dataset.origem=origemPagamento;else delete dialog.dataset.origem;
    el('checkout-title').textContent=origemPagamento?'Conferir pagamento — PDV '+(origemPagamento==='classico'?'clássico':'moderno'):tituloCaixa;
    el('checkout-close').textContent=origemPagamento?'Voltar ao carrinho · ESC':'Fechar';
    el('local-stock-title').textContent=origemPagamento?'Itens e pagamento':(oficial?'Venda avulsa':'Venda local com estoque do servidor');
    if(origemPagamento&&el('checkout-message').textContent==='Selecione uma conta em Pedidos do cardápio.')el('checkout-message').textContent='Confira os itens e os valores recebidos. F4 confere os valores; registrar a venda exige sua confirmação.';
    renderLifecycle(); for (const modal of document.querySelectorAll('dialog[open]')) if (modal !== dialog) modal.close(); if (!dialog.open) dialog.showModal();
  };
  dialog.addEventListener('close',()=>{
    if(dialog.open)return;
    const id=origemPagamento==='classico'?'classic-pdv-barcode-input':origemPagamento==='moderno'?'op-search':null;
    if(id){const input=document.getElementById(id);const fallback=document.getElementById(origemPagamento==='classico'?'classic-status-text':'op-pay');if(input&&!input.disabled)input.focus();else if(fallback){fallback.tabIndex=0;fallback.focus();}}
    origemPagamento=null;
  });
  dialog.addEventListener('keydown',event=>{
    if(!origemPagamento||event.key!=='F4')return;
    event.preventDefault();event.stopPropagation();
    if(busy)return;
    if(ponte.pendente()){const status=el('local-stock-state');status.tabIndex=-1;status.focus();return;}
    if(!el('local-stock-form').hidden)el('local-stock-preview').click();
  });
  launcher.onclick = open; el('checkout-close').onclick = () => { if (!busy) dialog.close(); };
  el('checkout-reconnect').onclick = () => run(connect);
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  async function run(action) {
    if (busy) return; busy = true; dialog.dataset.busy = 'true'; dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await navigator.locks.request('flowpdv-ciclo-caixa-teste',async()=>{ciclo.recuperar();await action();}); } catch (e) { message(localStorage.getItem('flowpdv_pagamento_atendimento_pendente')!==null?'Pagamento sem confirmação na tela. Retome o registro pendente; não receba o valor novamente.':`${e.message || 'Não foi possível confirmar.'} Confira o histórico antes de repetir a operação.`); }
    finally { retomarConta.hidden=localStorage.getItem('flowpdv_pagamento_atendimento_pendente')===null;busy = false; dialog.dataset.busy = 'false'; dialog.querySelectorAll('button').forEach(b => b.disabled = false); renderLifecycle(); }
  }
  window.addEventListener('flowpdv-checkout-open', event => {
    if (busy) return; target = event.detail; el('checkout-form').hidden = false; el('checkout-adjust').hidden = true;
    el('checkout-summary').textContent = `${target.nome} • Total ${money(target.totalCentavos)}`;
    el('checkout-cash').value = ''; el('checkout-method').value = 'dinheiro'; el('checkout-confirm').checked = false;
    el('checkout-cash').disabled = false;
    message('Confira os itens e o recebimento. Pagamento registrado apenas nesta base de teste.'); open();
  });
  function adjust(mode, id) {
    if (busy) return; adjustment = { mode, id }; el('checkout-form').hidden = true; el('checkout-adjust').hidden = false;
    el('checkout-adjust-title').textContent = mode === 'cancelar' ? 'Cancelar pedido antes do fechamento' : 'Estornar venda completa';
    el('checkout-reason').value = ''; el('checkout-return').checked = false; el('checkout-refund-confirm').checked = false;
    el('checkout-refund-fields').hidden = mode !== 'estornar'; open();
  }
  window.addEventListener('flowpdv-cancel-order', event => adjust('cancelar', event.detail.pedidoId));
  el('checkout-method').onchange = () => { el('checkout-cash').disabled = el('checkout-method').value !== 'dinheiro'; el('checkout-cash').value = ''; };
  el('checkout-form').onsubmit = event => {
    event.preventDefault(); run(async () => {
      if (!target) return;
      const forma = el('checkout-method').value, cashText = el('checkout-cash').value.trim().replace(',', '.');
      if (cashText && !/^\d+(\.\d{1,2})?$/.test(cashText)) throw new Error('Informe o dinheiro recebido com até duas casas decimais.');
      const recebidoDinheiroCentavos = forma === 'dinheiro' ? (cashText ? Math.round(Number(cashText) * 100) : target.totalCentavos) : 0;
      target.turno ||= turnoLocalAberto();
      const result = await pagamentoConta.executar({ turno: target.turno, atendimentoId: target.atendimentoId, versao: target.versao, pagamentos: target.totalCentavos ? [{ forma, valorCentavos: target.totalCentavos }] : [], recebidoDinheiroCentavos, confirmado: el('checkout-confirm').checked },target.totalCentavos);
      el('checkout-reconciliation').textContent = 'Pagamento registrado. Atualize a conferência do turno.';
      el('checkout-form').hidden = true; message(`Venda registrada: ${result.vendaId} • ${money(result.totalCentavos)} • Troco: ${money(result.trocoCentavos)}. Mesa liberada. Nenhuma cobrança externa foi executada.`);
    });
  };
  el('checkout-adjust').onsubmit = event => {
    event.preventDefault(); run(async () => {
      const motivo = el('checkout-reason').value;
      if (adjustment.mode === 'cancelar') await s.call('cancelarPedidoV2', { pedidoId: adjustment.id, motivo });
      else {
        adjustment.turno ||= turnoLocalAberto();
        await s.call('estornarVendaV2', { turno: adjustment.turno, vendaId: adjustment.id, motivo, devolverEstoque: el('checkout-return').checked, confirmado: el('checkout-refund-confirm').checked });
      }
      el('checkout-reconciliation').textContent = 'Operação registrada. Atualize a conferência do turno.';
      el('checkout-adjust').hidden = true; message(adjustment.mode === 'cancelar' ? 'Pedido cancelado. Total da conta atualizado e aviso enviado ao painel da cozinha.' : 'Estorno registrado. A decisão de reposição de estoque foi aplicada uma única vez.');
    });
  };
  const autorizacao = criarAutorizacaoHomologacao({
    exigirAdesaoExplicita: window.electronAPI?.homologacaoOperacional === true || usarPdvOficialV2(),
    ambienteTeste: usarFluxoOperacionalV2(),
    bloqueioLocal: () => perfilEmRecuperacao(localStorage),
    call: (...args) => s.call(...args),
    observarLoja: (lojaId, atualizar, falhar) => onSnapshot(
      doc(s.db, 'lojas_v2', lojaId), { includeMetadataChanges: true },
      snap => atualizar(snap.metadata), falhar),
    alterar: setActivation
  });
  const nomesDivergencias = {
    venda_divergente: 'Valor, itens ou comprovante da venda diferem do servidor.',
    venda_local_sem_confirmacao_remota: 'Venda local sem confirmação correspondente no servidor.',
    venda_ausente_no_backup: 'Venda do servidor ausente neste backup.',
    tentativa_divergente: 'A tentativa pendente difere do registro do servidor.',
    confirmacao_local_pendente: 'A gravação local da venda aguarda confirmação.',
    venda_a_conferir: 'Há uma tentativa de venda que precisa ser conferida.',
    cancelamento_a_conferir: 'Há um cancelamento que precisa ser conferido.',
    estorno_a_conferir: 'Há uma devolução que precisa ser conferida.',
    estorno_ausente_no_backup: 'Devolução registrada no servidor ausente neste backup.',
    estorno_divergente: 'Os dados da devolução diferem do servidor.',
    tentativa_estorno_divergente: 'A tentativa de devolução difere do comprovante do servidor.',
    estorno_local_sem_confirmacao_remota: 'Devolução local sem comprovante correspondente no servidor.',
    pagamentos_estorno_divergentes: 'As formas de devolução diferem do servidor.',
    resposta_incompleta: 'O servidor não retornou todos os registros solicitados.',
    estado_turno_divergente: 'O estado de abertura ou fechamento do turno mudou.',
    status_desconhecido: 'Situação da venda exige conferência técnica.'
  };
  let copiaRecuperada = null, revisaoArquivo = 0;
  const limparCopia = () => { copiaRecuperada = null; el('recovery-download').hidden = true; };
  el('recovery-file').addEventListener('change', () => { revisaoArquivo++; limparCopia(); });
  const conferirRecuperacao = (usarArquivo, tipo = 'turno') => run(async () => {
    limparCopia();
    const inventario = tipo === 'inventario', historico = tipo === 'historico', reconstruir = tipo === 'reconstruir';
    const estado = el('recovery-state'), lista = el('recovery-findings'), epoch = generation, arquivoConferido = revisaoArquivo;
    estado.textContent = 'Conferindo identidade, turno e registros no servidor…';
    estado.dataset.resultado = 'consultando'; lista.replaceChildren(); el('recovery-inventory').replaceChildren(); el('recovery-inventory').hidden = true;
    try {
      await s.auth.authStateReady();
      const uid = s.auth.currentUser?.uid;
      if (!uid) throw new Error('Prepare o terminal antes de conferir a recuperação.');
      const binding = await s.call('consultarMeuTerminalV2');
      if (!binding.vinculado || binding.papel !== 'caixa') throw new Error('Autorize este terminal como caixa antes de conferir.');
      const contexto = { lojaId: binding.lojaId, terminalId: StorageService.getDeviceId(), terminalUid: binding.identidadeOperacionalUid || uid };
      const backup = criarBackupHomologacao({ storage: localStorage, ambienteTeste: usarFluxoOperacionalV2(), contexto });
      let pacote;
      if (usarArquivo) {
        const file = el('recovery-file').files[0];
        if (!file) throw new Error('Selecione o arquivo de backup que deseja conferir.');
        if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo excede 10 MB. Separe a conferência por turno.');
        try { pacote = JSON.parse(await file.text()); } catch { throw new Error('O arquivo não contém um JSON válido. Selecione o backup original.'); }
      } else pacote = backup.exportar();
      const antes = JSON.stringify(pacote);
      // No equipamento substituto, o ID lógico do arquivo continua sendo o original;
      // a autorização vem da identidade financeira delegada pelo servidor.
      if (usarArquivo) {
        if (!pacote?.origem?.terminalId) throw new Error('Backup incompatível: identificação original ausente. Selecione o arquivo de homologação.');
        contexto.terminalId = pacote.origem.terminalId;
      }
      const consultar = inventario ? conferirInventarioBackup : historico ? conferirHistoricoBackup : reconstruir ? reconstruirBackupConfirmado : conferirBackupServidor;
      const result = await consultar({ pacote, contexto, ambienteTeste: usarFluxoOperacionalV2(), call: (nome, dados) => s.call(nome, dados) });
      const fechamentos = historico ? await conferirFechamentosBackup({ pacote, contexto, ambienteTeste: true, call: (nome, dados) => s.call(nome, dados) }) : null;
      if (epoch !== generation || uid !== s.auth.currentUser?.uid) throw new Error('O acesso mudou durante a consulta. Confira novamente.');
      if (usarArquivo && arquivoConferido !== revisaoArquivo) throw new Error('O arquivo selecionado mudou. Confira novamente.');
      if (!usarArquivo && antes !== JSON.stringify(backup.exportar())) throw new Error('Os dados locais mudaram durante a consulta. Confira novamente.');
      if (reconstruir) {
        const historicoConferido = await conferirHistoricoBackup({ pacote: result.pacote, contexto, ambienteTeste: true, call: (n,d) => s.call(n,d) });
        if (!historicoConferido.semDivergencias || historicoConferido.pendencias.length) throw new Error('O histórico ainda possui diferenças ou pendências. Confira antes de salvar uma cópia.');
        if (epoch !== generation || uid !== s.auth.currentUser?.uid || arquivoConferido !== revisaoArquivo) throw new Error('O acesso ou arquivo mudou. Prepare a cópia novamente.');
        copiaRecuperada = { original: pacote, pacote: result.pacote, contexto, uid, epoch, arquivoConferido };
        el('recovery-download').hidden = false;
        estado.dataset.resultado = 'copia-conferida';
        estado.textContent = `${result.alteracoes.length} ${result.alteracoes.length === 1 ? 'registro recuperado' : 'registros recuperados'} na cópia. Histórico conferido. Confira os registros abaixo antes de salvar; o arquivo não substitui o caixa aberto nem libera sua operação.`;
        for (const a of result.alteracoes) { const li = document.createElement('li'); li.textContent = `${a.vendaId}: ${a.codigo === 'venda_ausente_no_backup' ? 'venda recuperada' : 'devolução recuperada'}.`; lista.append(li); }
        estado.tabIndex = -1; estado.focus({ preventScroll: true }); estado.scrollIntoView({ block: 'center' });
        return;
      }
      if (inventario) {
        const situacoes = { vinculo_conferido: 'Vínculo conferido', corte_divergente: 'Corte divergente', unidade_divergente: 'Unidade divergente', sem_vinculo: 'Sem vínculo' };
        const divergentes = result.produtos.filter(p => p.situacao !== 'vinculo_conferido').length;
        estado.dataset.resultado = divergentes ? 'inventario-divergente' : 'inventario-conferido';
        estado.textContent = `${result.produtos.length} produtos conferidos; ${divergentes} com vínculo ou corte a revisar. A variação mostra movimentos após a migração. Não reponha o saldo antigo: nenhum estoque foi alterado. A contagem física ainda precisa ser conferida.`;
        const table = document.createElement('table'), caption = document.createElement('caption');
        caption.textContent = 'Saldo inicial da migração e saldo atual no servidor'; table.append(caption);
        const head = table.createTHead().insertRow();
        for (const label of ['Produto', 'Corte', 'Atual', 'Variação', 'Situação']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th); }
        const body = table.createTBody();
        for (const p of result.produtos) {
          const format = (n, unidade = p.unidadeServidor) => Number.isSafeInteger(n) ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade || ''}` : '—';
          const row = body.insertRow();
          for (const texto of [p.nome, format(p.saldoCorteMili, p.unidadeCorte), format(p.saldoAtualMili), format(p.variacaoDesdeCorteMili), situacoes[p.situacao] || 'Exige revisão']) row.insertCell().textContent = texto;
        }
        el('recovery-inventory').append(table); el('recovery-inventory').hidden = false;
        return;
      }
      const achados = [...result.divergencias, ...result.pendencias, ...(fechamentos?.divergencias || []), ...(fechamentos?.gavetas || []).flatMap(g => [...g.divergencias, ...g.pendencias])];
      estado.dataset.resultado = achados.length ? 'conferencia-necessaria' : 'sem-divergencias';
      estado.textContent = historico ? `Histórico: ${result.turnosLocais} turnos no arquivo e ${result.turnosServidor} no servidor. Vendas locais: ${result.divergencias.length} diferenças e ${result.pendencias.length} pendências. Resumos do restaurante: ${fechamentos.divergencias.length} diferenças. Aritmética da gaveta no arquivo: ${fechamentos.gavetas.reduce((n, g) => n + g.divergencias.length + g.pendencias.length, 0)} apontamentos. Os totais locais não comprovam todas as vendas, retiradas nem o dinheiro físico. Contas abertas exigem conferência própria. Nenhum dado foi restaurado; esta consulta não libera operações.` : `Turno ${result.turnoId}: ${result.divergencias.length} ${result.divergencias.length === 1 ? 'diferença' : 'diferenças'} e ${result.pendencias.length} ${result.pendencias.length === 1 ? 'pendência' : 'pendências'}. ${achados.length ? 'Confira os itens abaixo antes de recuperar.' : 'Nenhuma diferença encontrada nas vendas locais deste turno.'} Histórico, estoque atual e troca de equipamento ainda exigem conferência. Nenhum dado foi restaurado.`;
      for (const achado of achados) {
        const li = document.createElement('li'); li.style.overflowWrap = 'anywhere';
        li.textContent = `${achado.turnoId ? 'Turno ' + achado.turnoId + ' • ' : ''}${achado.vendaId ? achado.vendaId + ': ' : ''}${nomesDivergencias[achado.codigo] || ({ gaveta_turno_aberto: 'Gaveta ainda aberta: contagem final pendente.', gaveta_dados_incompletos: 'Arquivo sem todos os campos necessários para conferir a gaveta.', gaveta_valores_invalidos: 'Gaveta contém valores inválidos.', gaveta_sangria_invalida: 'Retirada com valor inválido.', gaveta_sangrias_divergentes: 'Total de sangrias difere das retiradas registradas.', gaveta_saldo_divergente: 'Saldo esperado difere do cálculo da gaveta.', gaveta_contagem_divergente: 'Diferença de caixa incompatível com a contagem registrada.', gaveta_suprimentos_nao_conferidos: 'Suprimentos exigem conferência própria.', turno_ausente_no_backup: 'Turno ausente no backup.', turno_local_sem_registro_remoto: 'Turno sem registro remoto correspondente.', fundo_restaurante_divergente: 'Fundo de troco do restaurante diferente do servidor.', resumo_restaurante_ausente: 'Resumo encerrado do restaurante ausente no arquivo.', resumo_restaurante_divergente: 'Resumo do restaurante diferente do servidor. Confira totais e itens.', fechamento_local_sem_encerramento_remoto: 'Arquivo indica fechamento, mas o turno continua aberto no servidor.' })[achado.codigo] || 'Registro exige conferência.'}`;
        lista.append(li);
      }
    } catch (error) { estado.dataset.resultado = 'erro'; estado.textContent = error.message || 'Não foi possível conferir. Verifique o acesso e tente novamente.'; }
  });
  el('recovery-current').onclick = () => conferirRecuperacao(false);
  el('recovery-stock').onclick = () => conferirRecuperacao(false, 'inventario');
  el('recovery-history').onclick = () => conferirRecuperacao(false, 'historico');
  el('recovery-file-history').onclick = () => conferirRecuperacao(true, 'historico');
  el('recovery-rebuild').onclick = () => conferirRecuperacao(true, 'reconstruir');
  el('recovery-check-file').onclick = () => conferirRecuperacao(true);
  if (window.electronAPI.perfilTesteNomeado === true) {
    el('recovery-install-section').hidden = false;
    instalarLiberacaoPerfil({host:el('recovery-install-section'),storage:localStorage,sessao:s,gerencia:sessaoGerenciaTeste()});
    const instalacao = criarInstalacaoPerfilTeste({ storage: localStorage, sessao: s, ambienteTeste: true, perfilNomeado: true });
    el('recovery-install-state').textContent = perfilEmRecuperacao(localStorage) ? 'Perfil em recuperação: as operações estão bloqueadas. Retome uma instalação interrompida ou confira os dados recuperados.' : 'O perfil deve estar vazio. A instalação recusa substituir dados existentes.';
    async function instalarPerfil(retomar) {
      await s.auth.authStateReady();
      if (!window.confirm(retomar ? 'Retomar a instalação no perfil de teste e recarregar a tela?' : 'Instalar o arquivo conferido neste perfil novo e recarregar a tela? O caixa ficará bloqueado para conferência.')) return;
      el('recovery-install-state').textContent = 'Conferindo identidade e dados para instalação…';
      try {
        if (retomar) await instalacao.retomar();
        else {
          const file = el('recovery-file').files[0];
          if (!file || file.size > 10 * 1024 * 1024) throw new Error('Selecione um backup de homologação de até 10 MB.');
          const versao = revisaoArquivo, pacote = JSON.parse(await file.text());
          if (versao !== revisaoArquivo) throw new Error('O arquivo mudou. Selecione e confira novamente.');
          await instalacao.instalar(pacote);
        }
        window.location.reload();
      } catch (error) { el('recovery-install-state').textContent = error.message || 'Instalação não concluída. Preserve este perfil e retome a instalação.'; throw error; }
    }
    el('recovery-install').onclick = () => run(() => instalarPerfil(false));
    el('recovery-install-resume').onclick = () => run(() => instalarPerfil(true));
  }
  el('recovery-download').onclick = () => run(async () => {
    const p = copiaRecuperada;
    if (!p || p.uid !== s.auth.currentUser?.uid || p.epoch !== generation) { limparCopia(); throw new Error('Prepare a cópia novamente antes de salvar.'); }
    const binding = await s.call('consultarMeuTerminalV2');
    if (!binding.vinculado || binding.papel !== 'caixa' || binding.lojaId !== p.contexto.lojaId || (binding.identidadeOperacionalUid || p.uid) !== p.contexto.terminalUid) { limparCopia(); throw new Error('A autorização mudou. Confira o acesso antes de salvar.'); }
    const fresh = await reconstruirBackupConfirmado({ pacote: p.original, contexto: p.contexto, ambienteTeste: true, call: (n,d) => s.call(n,d) });
    const history = await conferirHistoricoBackup({ pacote: fresh.pacote, contexto: p.contexto, ambienteTeste: true, call: (n,d) => s.call(n,d) });
    if (p !== copiaRecuperada || p.arquivoConferido !== revisaoArquivo || p.uid !== s.auth.currentUser?.uid || p.epoch !== generation || !history.semDivergencias || history.pendencias.length || JSON.stringify(fresh.pacote) !== JSON.stringify(p.pacote)) { limparCopia(); throw new Error('Os dados mudaram. Prepare e confira a cópia novamente.'); }
    const url = URL.createObjectURL(new Blob([JSON.stringify(fresh.pacote, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'FlowPDV-backup-recuperado.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    el('recovery-state').textContent = 'Download solicitado da cópia conferida. Os dados do caixa aberto foram preservados.';
    limparCopia();
  });
  async function connect() {
    limparCopia();
    autorizacao.parar();
    lojaRascunho=null;sincronizarRascunho();el('local-stock-form').hidden=true;dialog.dataset.rascunhoReady='false';renderCarrinho();
    el('server-turn-integrated').textContent = '';
    el('server-turn-items').replaceChildren();
    serverTurn = null; closeAttempt = null; el('server-turn-close-form').hidden = true;
    el('server-turn-state').textContent = 'Consulte o turno após confirmar o acesso.';
    el('checkout-reconciliation').textContent = 'Atualize a conferência após confirmar o acesso.';
    stop?.(); pendenciasAtendimento.reset(); const epoch = ++generation; el('checkout-sales').replaceChildren();
    try {
      await s.auth.authStateReady(); if (!s.auth.currentUser || epoch !== generation) return;
      const binding = await s.call('consultarMeuTerminalV2'); if (epoch !== generation) return;
      if (!binding.vinculado || binding.papel !== 'caixa') { message('Autorize este terminal como caixa.'); return; }
      lojaRascunho=binding.lojaId;renderBalcao();
      autorizacao.iniciar(binding.lojaId);
      stop = onSnapshot(query(collection(s.db, `lojas_v2/${binding.lojaId}/vendas`), orderBy('criadoEm', 'desc'), limit(30)), snap => {
        if (epoch !== generation) return; const list = el('checkout-sales'); list.replaceChildren();
        for (const record of snap.docs) {
          const sale = record.data(), row = document.createElement('article'); row.dataset.vendaId = record.id; row.dataset.status = sale.status;
          const text = document.createElement('p'); text.textContent = `${sale.mesaNome || 'Retirada'} • ${money(sale.totalCentavos)} • ${sale.status} • ${record.id}`; row.append(text);
          const details = document.createElement('p'); details.textContent = `${sale.pagamentos.map(p => `${p.forma.replace('_manual', ' conferido')}: ${money(p.valorCentavos)}`).join(' + ')} • Troco: ${money(sale.trocoCentavos)}`; row.append(details);
          if (sale.status === 'concluida') { const button = document.createElement('button'); button.textContent = 'Estornar venda'; button.disabled = snap.metadata.fromCache || busy; button.onclick = () => adjust('estornar', record.id); row.append(button); } list.append(row);
        }
        if (snap.empty) list.textContent = 'Nenhuma venda registrada.';
      }, e => { if (epoch === generation) { el('checkout-sales').replaceChildren(); message(`Histórico interrompido. Após recuperar o acesso, use Reconectar histórico. ${e.message}`); } });
    } catch (e) { if (epoch === generation) message(e.message); }
  }
  operacional=instalarPdvOperacionalTeste({
    estado:()=>{
      const pendente=!!ponte.pendente(),bloqueado=busy||pendente||!novasPermitidas||!contextoRascunho||rascunhoInvalido;
      const registros=JSON.parse(localStorage.getItem('flowpdv_migracoes_estoque_teste')||'[]');
      const produtos=StorageService.getProdutos().filter(p=>registros.some(r=>r.status==='confirmado'&&r.lojaId===contextoRascunho?.lojaId&&String(r.produto.id)===String(p.id)));
      let totalCentavos=carrinho.length?null:0;
      if(carrinho.length&&!pendente&&contextoRascunho)try{totalCentavos=ponte.prepararCarrinho(linhasCarrinho(),undefined,undefined,ajustesVenda()).payload.totalCentavos;}catch{}
      return {produtos,itens:carrinho.map(i=>{const p=produtoPorId(i.id);return {...i,nome:p?.nome||'Produto indisponível',unidade:p?.unidade||'—',precoCentavos:precoExibicao(p)};}),totalCentavos,bloqueado,pendente,ocupado:busy,aviso:!novasPermitidas?avisoAtivacao:avisoOperacional||el('local-draft-state').textContent};
    },
    adicionar:(id,quantidade)=>run(async()=>{
      avisoOperacional='';exigirNovaVenda();if(!contextoRascunho||ponte.pendente()||rascunhoInvalido)throw new Error('Confirme o acesso e resolva a pendência antes de adicionar.');
      const next=carrinho.map(i=>({...i})),old=next.find(i=>i.id===id);
      const q=String(quantidade).replace(',','.');if(!/^\d+(\.\d{1,3})?$/.test(q)||Number(q)<=0)throw new Error('Informe uma quantidade positiva com até três casas decimais.');
      if(old)old.quantidade=String(Math.round((Number(old.quantidade.replace(',','.'))+Number(q))*1000)/1000);else next.push({id,quantidade});
      ponte.prepararCarrinho(next.map(i=>({produto:produtoPorId(i.id),quantidade:i.quantidade})));carrinho=next;invalidarCarrinho();
    }),
    alterar:(id,quantidade)=>run(async()=>{avisoOperacional='';if(!contextoRascunho||ponte.pendente())throw new Error('Retome a pendência antes de editar.');const item=carrinho.find(i=>i.id===id);if(!item)throw new Error('Produto não encontrado no carrinho.');item.quantidade=quantidade;invalidarCarrinho();}),
    remover:id=>run(async()=>{avisoOperacional='';if(!contextoRascunho||ponte.pendente())throw new Error('Retome a pendência antes de remover.');carrinho=carrinho.filter(i=>i.id!==id);invalidarCarrinho();}),
    pagamento:destino=>{
      const origem=document.body.classList.contains('op-classico-ativo')?'classico':'moderno';
      open(destino==='turno'?null:origem);
      const pending=ponte.pendente();
      const id=pending?'local-stock-state':!novasPermitidas?'checkout-activation':destino==='turno'?'cycle-title':destino==='ajustes'?'local-discount':'local-stock-preview';
      const alvo=el(id);if(!alvo.matches('input,button,select'))alvo.tabIndex=-1;
      alvo.focus();alvo.scrollIntoView({block:'center'});
    },
    descartar:descartarRascunho
  });
  el('checkout-reconnect').onclick = () => run(connect);
  window.addEventListener('flowpdv-terminal-v2', connect); window.addEventListener('online', connect); window.addEventListener('offline',()=>{generation++;stop?.();pendenciasAtendimento.reset();autorizacao.desconectar();}); connect();run(async()=>{});
}
