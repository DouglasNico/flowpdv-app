import { instalarPdvClassicoTeste } from './pdv-classico-teste.js';
// Reutiliza o layout do balcão, mas opera exclusivamente o carrinho da ponte de teste.
export function instalarPdvOperacionalTeste({estado,adicionar,alterar,remover,pagamento,descartar}) {
  if(window.electronAPI?.ambienteTeste!==true)return;
  const classico=instalarPdvClassicoTeste({estado,adicionar,alterar,remover,pagamento,descartar});
  const host=document.getElementById('pdv-operacional-teste');if(!host)return;
  for(const node of host.querySelectorAll('*'))for(const attr of [...node.attributes])if(attr.name.startsWith('on'))node.removeAttribute(attr.name);
  const left=host.querySelector('.pdv-left-section'),right=host.querySelector('.pdv-right-section');
  const table=host.querySelector('.pdv-items-table-wrapper'),totalCard=host.querySelector('.pdv-total-card');
  left.replaceChildren(table);right.replaceChildren(totalCard);
  const style=document.createElement('style');style.textContent=`
    body.op-balcao-ativo #painel-teste-local{padding:20px 24px 48px}
    body.op-balcao-ativo #painel-teste-local > :not(#op-open):not(#pdv-operacional-teste){display:none!important}
    body.op-balcao-ativo > button{display:none!important}
    #pdv-operacional-teste{margin-top:14px;max-width:1440px;color:#0f172a}
    #pdv-operacional-teste[hidden]{display:none!important}
    #pdv-operacional-teste .pdv-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);height:auto;gap:20px}
    #pdv-operacional-teste .pdv-left-section,#pdv-operacional-teste .pdv-right-section{min-width:0;height:auto;overflow:visible}
    #pdv-operacional-teste .pdv-left-section{padding:14px;background:white}
    #pdv-operacional-teste #op-search{width:100%}
    #pdv-operacional-teste #pdv-total-display{color:white}
    #pdv-operacional-teste .total-label{color:#e2e8f0}
    #pdv-operacional-teste .pdv-items-table-wrapper{overflow:auto;max-height:440px;background:white}
    #pdv-operacional-teste button{font:inherit;padding:10px 14px;cursor:pointer;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#0f172a}
    #pdv-operacional-teste button:disabled{opacity:.55;cursor:not-allowed}
    #pdv-operacional-teste input,#pdv-operacional-teste select{font:inherit;padding:10px;border:1px solid #94a3b8;border-radius:6px;background:white;color:#0f172a;max-width:100%;box-sizing:border-box}
    #pdv-operacional-teste input:focus-visible,#pdv-operacional-teste select:focus-visible,#pdv-operacional-teste button:focus-visible{outline:3px solid #0f766e;outline-offset:2px}
    #pdv-operacional-teste .op-entry{display:grid;grid-template-columns:minmax(0,1fr) 110px auto;gap:10px;margin:14px 0;align-items:end}
    #pdv-operacional-teste label{display:block}#pdv-operacional-teste label input,#pdv-operacional-teste label select{display:block;width:100%;margin-top:6px}
    #pdv-operacional-teste .op-main{background:#047857;color:white;border-color:#047857;width:100%;margin:14px 0 8px}
    #pdv-operacional-teste .pdv-total-card{background:#0f172a;color:white}#pdv-operacional-teste .pdv-subtotal-details{display:none}
    #pdv-operacional-teste th,#pdv-operacional-teste td{padding:10px;text-align:left;color:#0f172a}
    #pdv-operacional-teste th{background:#e2e8f0}#pdv-operacional-teste td input{width:90px}
    @media(max-width:900px){#pdv-operacional-teste .pdv-layout{grid-template-columns:1fr}}
    @media(max-width:550px){#pdv-operacional-teste .op-entry{grid-template-columns:minmax(0,1fr)}#pdv-operacional-teste .pdv-table{min-width:580px}}
  `;host.prepend(style);
  const heading=document.createElement('h2');heading.textContent='Balcão — loja de teste';host.prepend(heading);
  const controls=document.createElement('div');controls.innerHTML=`<label for="op-search">Buscar produto por nome ou código</label><input id="op-search" type="search" placeholder="Digite para buscar; código exato + Enter adiciona">
    <div class="op-entry"><label>Produto<select id="op-product"></select></label><label>Quantidade<input id="op-quantity" inputmode="decimal" value="1"></label><button id="op-add" type="button">Adicionar</button></div><p id="op-status" role="status"></p>`;left.prepend(controls);
  const actions=document.createElement('div');actions.innerHTML='<button id="op-pay" class="op-main" type="button">Conferir e finalizar · F4</button><button id="op-clear" type="button">Limpar carrinho</button><p id="op-summary"></p><p>Estoque conferido no servidor ao registrar. Pagamentos manuais, sem cobrança real.</p>';right.append(actions);
  const el=id=>host.querySelector('#'+id),money=n=>Number.isFinite(n)?(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Confira o preço';
  const trigger=document.createElement('button');trigger.id='op-open';trigger.textContent='PDV de balcão';trigger.type='button';trigger.style.cssText='padding:12px 20px;background:#0f766e;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer;margin:12px 0';host.before(trigger);
  trigger.onclick=()=>{host.hidden=!host.hidden;document.body.classList.toggle('op-balcao-ativo',!host.hidden);trigger.textContent=host.hidden?'PDV de balcão':'Voltar ao painel';if(!host.hidden){render();host.scrollIntoView({block:'start'});el('op-search').focus();}};
  function produtos(){const q=el('op-search').value.trim().toLocaleLowerCase('pt-BR');return estado().produtos.filter(p=>[p.nome,p.codigoBarras,p.id].some(v=>String(v??'').toLocaleLowerCase('pt-BR').includes(q)));}
  function render(){
    classico?.render();
    const st=estado(),selected=el('op-product').value;el('op-product').replaceChildren();
    for(const p of produtos())el('op-product').add(new Option(`${p.nome} (${p.unidade})`,String(p.id)));
    if([...el('op-product').options].some(o=>o.value===selected))el('op-product').value=selected;
    el('op-add').disabled=st.bloqueado||!el('op-product').value;el('op-clear').disabled=st.bloqueado;el('op-pay').disabled=st.ocupado;
    el('op-status').textContent=st.aviso;el('op-pay').textContent=st.pendente?'Retomar venda pendente':'Conferir e finalizar · F4';
    el('pdv-total-display').textContent=st.totalCentavos===null?'Confira os valores':money(st.totalCentavos);el('pdv-items-count-badge').textContent=`${st.itens.length} produtos`;
    el('op-summary').textContent='O carrinho e o rascunho são os mesmos do painel de pagamentos.';
    const tbody=el('pdv-itens-tbody');tbody.replaceChildren();
    if(!st.itens.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='Adicione um produto para começar.';tr.append(td);tbody.append(tr);}
    for(const item of st.itens){const tr=document.createElement('tr');for(const text of [item.nome+' · '+item.unidade,money(item.precoCentavos)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
      const qty=document.createElement('input');qty.value=item.quantidade;qty.inputMode='decimal';qty.setAttribute('aria-label','Quantidade de '+item.nome);qty.disabled=st.bloqueado;qty.onchange=()=>alterar(item.id,qty.value);
      const td=document.createElement('td');td.append(qty);tr.append(td);const sum=document.createElement('td');sum.textContent=Number.isFinite(Number(item.quantidade.replace(',','.')))?money(Math.round(Number(item.quantidade.replace(',','.'))*item.precoCentavos)):'Confira';tr.append(sum);
      const remove=document.createElement('button');remove.textContent='Remover';remove.type='button';remove.disabled=st.bloqueado;remove.setAttribute('aria-label','Remover '+item.nome);remove.onclick=()=>remover(item.id);const action=document.createElement('td');action.append(remove);tr.append(action);tbody.append(tr);
    }
  }
  el('op-search').oninput=render;
  el('op-add').onclick=()=>adicionar(el('op-product').value,el('op-quantity').value);
  el('op-search').onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const q=el('op-search').value.trim();const matches=estado().produtos.filter(p=>String(p.codigoBarras??'')===q||String(p.id)===q);if(matches.length===1)adicionar(String(matches[0].id),el('op-quantity').value);else el('op-status').textContent='Selecione um produto da busca antes de adicionar.';};
  el('op-pay').onclick=pagamento;el('op-clear').onclick=descartar;
  host.addEventListener('keydown',e=>{if(e.key==='F4'){e.preventDefault();if(!el('op-pay').disabled)pagamento();}});
  return {render};
}
