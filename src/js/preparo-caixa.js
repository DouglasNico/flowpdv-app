import { collection, doc, query, where, limit, onSnapshot } from 'firebase/firestore';

// Atualização manual para lojas que dispensam o monitor da cozinha.
export function instalarPreparoCaixa({ host, sessao }) {
  const section=document.createElement('section');section.id='receive-preparo';section.hidden=true;
  section.innerHTML='<h3>Preparo pelo caixa — sem KDS</h3><p>Confirme o andamento informado pela cozinha. Imprimir o pedido não altera seu preparo. Exibindo até 50 pedidos de mesa e 50 de retirada; delivery usa os controles de entrega.</p><p id="receive-preparo-state" role="status"></p><div id="receive-preparo-list"></div>';
  host.append(section);
  const lista=section.querySelector('#receive-preparo-list'),aviso=section.querySelector('#receive-preparo-state');
  let generation=0,configGeneration=0,unsubShop=null,stops=[];
  function reset(){generation++;unsubShop?.();unsubShop=null;stops.forEach(fn=>fn());stops=[];section.hidden=true;lista.replaceChildren();aviso.textContent='';}
  function connect(lojaId){
    reset();const current=generation;
    unsubShop=onSnapshot(doc(sessao.db,`lojas_v2/${lojaId}`),{includeMetadataChanges:true},shop=>{
      if(current!==generation)return;
      const configEpoch=++configGeneration;
      stops.forEach(fn=>fn());stops=[];lista.replaceChildren();
      section.hidden=shop.metadata.fromCache||!shop.data()?.ativo||shop.data()?.cozinha?.kds===true;
      if(section.hidden)return;
      const views=new Map();let version=0;
      for(const tipo of ['mesa','retirada'])stops.push(onSnapshot(query(collection(sessao.db,`lojas_v2/${lojaId}/pedidos`),where('tipo','==',tipo),where('status','in',['novo','em_preparo','pronto']),limit(50)),{includeMetadataChanges:true},snap=>{
        if(current!==generation||configEpoch!==configGeneration||section.hidden)return;
        views.set(tipo,snap);const draw=++version;lista.replaceChildren();aviso.textContent='';
        for(const page of views.values())for(const record of page.docs){
          const p=record.data();if(p.recebidoPdv!==true||p.ignoradoPdv)continue;
          const row=document.createElement('p');row.dataset.pedidoId=record.id;row.style.overflowWrap='anywhere';
          const label=document.createElement('span');label.textContent=`${p.mesaNome||'Retirada'} • ${record.id} • ${p.status} `;row.append(label);
          const next={novo:'em_preparo',em_preparo:'pronto',pronto:'entregue'},button=document.createElement('button');button.type='button';
          button.textContent={novo:'Iniciar preparo',em_preparo:'Marcar pronto',pronto:'Marcar entregue'}[p.status];button.disabled=page.metadata.fromCache;
          button.onclick=async()=>{button.disabled=true;try{await sessao.call('avancarPreparoV2',{origem:'caixa',pedidoId:record.id,de:p.status,para:next[p.status]});}catch(e){if(current===generation&&configEpoch===configGeneration&&draw===version&&!section.hidden){aviso.textContent=e.message;button.disabled=page.metadata.fromCache;}}};
          row.append(button);lista.append(row);
        }
        if(lista.childElementCount)aviso.textContent='Atualize somente após confirmar o andamento com a cozinha.';
        if(host.closest('#tab-cardapio'))section.dataset.vazio=lista.childElementCount?'0':'1';
      },e=>{if(current===generation&&configEpoch===configGeneration){reset();aviso.textContent=e.message;}}));
    },e=>{if(current===generation){reset();aviso.textContent=e.message;}});
  }
  return {connect,reset};
}
