export function interpretarCodigoClassico(texto,produtos){
  const partes=String(texto).trim().split('*');
  if(partes.length>2)throw new Error('Use código ou quantidade*código.');
  const quantidade=partes.length===2?partes[0].trim().replace(',','.'): '1',codigo=partes.at(-1).trim().toUpperCase();
  if(!/^\d+(\.\d{1,3})?$/.test(quantidade)||Number(quantidade)<=0||!Number.isFinite(Number(quantidade))||!codigo)throw new Error('Informe código e quantidade positiva com até três casas decimais.');
  const encontrados=produtos.filter(p=>[p.codigoBarras,p.id].some(v=>v!=null&&String(v).toUpperCase()===codigo));
  if(encontrados.length!==1)throw new Error('Código não encontrado ou ambíguo. Use a busca F2.');
  return {id:String(encontrados[0].id),quantidade};
}

export function instalarPdvClassicoTeste({estado,adicionar,alterar,remover,pagamento,descartar}){
  if(window.electronAPI?.ambienteTeste!==true)return;
  const host=document.getElementById('pdv-classico-teste');if(!host)return;
  const shell=host.querySelector('#classic-pdv-shell'),el=id=>host.querySelector('#'+id);
  for(const node of host.querySelectorAll('*'))for(const a of [...node.attributes])if(a.name.startsWith('on'))node.removeAttribute(a.name);
  shell.classList.add('active');
  const style=document.createElement('style');style.textContent=`
    #pdv-classico-teste[hidden]{display:none!important}
    body.op-classico-ativo > button{display:none!important}
    #pdv-classico-teste #classic-pdv-shell{bottom:28px;min-height:0;min-width:0}
    #pdv-classico-teste .classic-main-content{overflow:auto}
    #pdv-classico-teste .classic-left-pane{min-width:340px;flex-basis:43%;width:43%}
    #pdv-classico-teste .classic-right-pane{min-width:0}
    #pdv-classico-teste .classic-table-container{overflow:auto}
    #pdv-classico-teste tr[aria-selected=true]{outline:2px solid #2563eb;outline-offset:-2px}
    #pdv-classico-teste .classic-shortcuts-bar span[role=button]{cursor:pointer}
    #pdv-classico-teste [aria-disabled=true]{opacity:.5;cursor:not-allowed}
    #classic-test-notice{margin:4px 20px;font:13px/1.4 'Segoe UI',sans-serif;color:#334155}
    .classic-test-dialog{width:min(560px,90vw);max-height:85vh;overflow:auto;margin:auto;padding:24px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;font:16px/1.5 'Segoe UI',sans-serif}
    .classic-test-dialog::backdrop{background:#0f172a99}
    .classic-test-dialog input,.classic-test-dialog select{width:100%;box-sizing:border-box;padding:10px;margin:6px 0 12px;font:inherit;border:1px solid #94a3b8;border-radius:4px;background:white;color:#0f172a}
    .classic-test-dialog button{padding:10px 16px;margin:8px 8px 0 0;font:inherit;cursor:pointer}
    #pdv-classico-teste :focus-visible,.classic-test-dialog :focus-visible{outline:3px solid #2563eb;outline-offset:2px}
    @media(max-width:1000px){#pdv-classico-teste .classic-left-pane{min-width:290px}#pdv-classico-teste .classic-main-content{padding:12px;gap:12px}}
  `;host.prepend(style);
  const notice=document.createElement('p');notice.id='classic-test-notice';notice.role='status';shell.querySelector('.classic-status-bar').after(notice);
  const trigger=document.createElement('button');trigger.id='op-classic-open';trigger.type='button';trigger.textContent='PDV clássico';trigger.style.cssText='padding:12px 20px;background:#0f766e;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer;margin:12px 0';host.before(trigger);
  let selecionado=null,modo='adicionar';
  function voltar(){host.hidden=true;document.body.classList.remove('op-classico-ativo');trigger.focus();}
  trigger.onclick=()=>{document.body.classList.remove('op-balcao-ativo');document.getElementById('pdv-operacional-teste').hidden=true;document.getElementById('op-open').textContent='PDV de balcão';host.hidden=false;document.body.classList.add('op-classico-ativo');render();el('classic-pdv-barcode-input').focus();};
  const close=shell.querySelector('.classic-window-controls span');close.title='Voltar ao painel';close.role='button';close.tabIndex=0;close.setAttribute('aria-label','Voltar ao painel');close.onclick=voltar;close.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();voltar();}};
  el('classic-btn-trocar-operador').disabled=true;el('classic-btn-trocar-operador').title='Troca de operador não integrada neste perfil de teste';el('classic-operator-name').textContent='Operador: terminal de teste';
  const dialog=document.createElement('dialog');dialog.id='classic-test-search';dialog.className='classic-test-dialog';dialog.setAttribute('aria-labelledby','classic-test-title');
  dialog.innerHTML='<h2 id="classic-test-title">Buscar produto</h2><form><label for="classic-test-query">Nome ou código</label><input id="classic-test-query" type="search"><label for="classic-test-product">Produto</label><select id="classic-test-product" required></select><label for="classic-test-quantity">Quantidade na unidade do produto</label><input id="classic-test-quantity" inputmode="decimal" value="1" required><p id="classic-test-error" role="status"></p><button id="classic-test-apply" type="submit">Adicionar</button><button type="button" id="classic-test-close">Voltar</button></form>';
  const discard=document.createElement('dialog');discard.id='classic-test-discard';discard.className='classic-test-dialog';discard.innerHTML='<h2>Limpar o carrinho?</h2><p>Os itens, pagamentos e ajustes deste rascunho serão descartados. Nenhuma venda ou estoque será alterado.</p><button id="classic-test-discard-confirm">Limpar carrinho</button><button id="classic-test-discard-back">Continuar editando</button>';
  document.body.append(dialog,discard);const d=id=>dialog.querySelector('#'+id);
  function listar(){const q=d('classic-test-query').value.trim().toLocaleLowerCase('pt-BR'),old=d('classic-test-product').value;d('classic-test-product').replaceChildren();for(const p of estado().produtos.filter(p=>[p.nome,p.id,p.codigoBarras].some(v=>String(v??'').toLocaleLowerCase('pt-BR').includes(q))))d('classic-test-product').add(new Option(`${p.nome} (${p.unidade})`,String(p.id)));if([...d('classic-test-product').options].some(o=>o.value===old))d('classic-test-product').value=old;}
  function buscar(edicao=false){if(estado().bloqueado){notice.textContent=estado().aviso;return;}modo=edicao?'editar':'adicionar';d('classic-test-query').value='';listar();d('classic-test-product').disabled=edicao;d('classic-test-query').disabled=edicao;d('classic-test-error').textContent='';d('classic-test-title').textContent=edicao?'Alterar quantidade':'Buscar produto';d('classic-test-apply').textContent=edicao?'Salvar quantidade':'Adicionar';d('classic-test-quantity').value='1';if(edicao){const i=estado().itens.find(i=>i.id===selecionado);if(!i)return;d('classic-test-product').value=i.id;d('classic-test-quantity').value=i.quantidade;}dialog.showModal();d(edicao?'classic-test-quantity':'classic-test-query').focus();}
  d('classic-test-query').oninput=listar;d('classic-test-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>el('classic-pdv-barcode-input').focus());
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();if(estado().bloqueado)return;const id=d('classic-test-product').value,q=d('classic-test-quantity').value.trim().replace(',','.');if(!id||!/^\d+(\.\d{1,3})?$/.test(q)||Number(q)<=0){d('classic-test-error').textContent='Selecione o produto e informe uma quantidade positiva.';return;}selecionado=id;await (modo==='editar'?alterar(id,q):adicionar(id,q));dialog.close();render();};
  discard.querySelector('#classic-test-discard-back').onclick=()=>discard.close();discard.querySelector('#classic-test-discard-confirm').onclick=async()=>{if(!estado().bloqueado)await descartar();discard.close();render();};
  shell.querySelector('.classic-search-button').onclick=()=>buscar();
  el('classic-pdv-barcode-input').onkeydown=async e=>{if(e.key!=='Enter')return;e.preventDefault();if(estado().bloqueado)return;try{const p=interpretarCodigoClassico(e.target.value,estado().produtos);selecionado=p.id;await adicionar(p.id,p.quantidade);e.target.value='';render();}catch(err){notice.textContent=err.message;}};
  const funcoes={F2:()=>buscar(),F4:()=>pagamento(),F8:()=>pagamento('ajustes'),F10:()=>pagamento('turno'),Delete:()=>{if(!estado().bloqueado&&selecionado)remover(selecionado);},Escape:()=>{if(!estado().bloqueado&&estado().itens.length)discard.showModal();}};
  shell.addEventListener('keydown',e=>{if(estado().ocupado)return;if(e.key==='Delete'&&e.target.matches('input'))return;if(funcoes[e.key]){e.preventDefault();e.stopPropagation();funcoes[e.key]();}});
  for(const span of shell.querySelectorAll('.classic-shortcuts-bar span')){const label=span.querySelector('kbd').textContent,key=label==='DEL'?'Delete':label==='ESC'?'Escape':label;span.role='button';span.tabIndex=0;if(funcoes[key]){span.onclick=()=>{if(!estado().ocupado)funcoes[key]();};span.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();span.click();}};}else{span.setAttribute('aria-disabled','true');span.title='Não integrado ao perfil de teste';span.onclick=()=>{notice.textContent='Este atalho ainda não está integrado ao perfil de teste.';};}}
  const moeda=n=>Number.isFinite(n)?(n/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'Confira';
  function render(atualizarTabela=true){const st=estado();if(!st.itens.some(i=>i.id===selecionado))selecionado=st.itens.at(-1)?.id||null;
    el('classic-status-text').textContent=st.pendente?'VENDA PENDENTE':st.bloqueado?'AGUARDE / CONFIRA O ACESSO':st.itens.length?'VENDA EM ANDAMENTO':'CAIXA LIVRE';notice.textContent=st.aviso||'Selecione uma linha. Duplo clique altera a quantidade; DEL remove.';
    el('classic-clock').textContent=new Date().toLocaleTimeString('pt-BR');el('classic-pdv-barcode-input').disabled=st.bloqueado;shell.querySelector('.classic-search-button').disabled=st.bloqueado;
    const subtotal=st.itens.reduce((s,i)=>s+Math.round(Number(i.quantidade.replace(',','.'))*i.precoCentavos),0);el('classic-subtotal').textContent=Number.isFinite(subtotal)?moeda(subtotal):'Confira';el('classic-qtd-itens').textContent=String(st.itens.length);el('classic-total-venda').textContent=st.totalCentavos===null?'Confira':moeda(st.totalCentavos);
    const item=st.itens.find(i=>i.id===selecionado);el('classic-ultimo-nome').textContent=item?.nome||'Aguardando leitura...';el('classic-ultimo-produto').classList.toggle('is-empty',!item);el('classic-ultimo-qtd').textContent=item?item.quantidade+' '+item.unidade:'';el('classic-codigo-barras').textContent=item?.id||'';el('classic-valor-unitario').textContent=moeda(item?item.precoCentavos:0);el('classic-total-item').textContent=item?moeda(Math.round(Number(item.quantidade.replace(',','.'))*item.precoCentavos)):'0,00';
    const tbody=el('classic-pdv-itens-tbody');if(!atualizarTabela){for(const row of tbody.children)row.setAttribute('aria-selected',String(row.dataset.produtoId===selecionado));return;}tbody.replaceChildren();for(const [n,i] of st.itens.entries()){const tr=document.createElement('tr');tr.dataset.produtoId=i.id;tr.tabIndex=0;tr.setAttribute('aria-selected',String(i.id===selecionado));for(const text of [n+1,i.id,i.nome,i.quantidade+' '+i.unidade,moeda(i.precoCentavos),moeda(Math.round(Number(i.quantidade.replace(',','.'))*i.precoCentavos))]){const td=document.createElement('td');td.textContent=String(text);tr.append(td);}tr.onclick=()=>{selecionado=i.id;render(false);tr.focus();};tr.ondblclick=()=>{selecionado=i.id;buscar(true);};tr.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();selecionado=i.id;buscar(true);}};tbody.append(tr);}
  }
  return {render};
}
