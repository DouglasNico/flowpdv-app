import { gerarCupomEntrega } from './cupom-cozinha.js';
export function criarCartaoEntrega({record, fromCache=false, call, atual, aviso}) {
  const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const p=record.data(),section=document.createElement('section'),label=document.createElement('p'),open=document.createElement('button'),detail=document.createElement('div');
          section.dataset.deliveryId=record.id;label.textContent=`Pedido ${record.id} • ${p.status} • ${p.pagamento||'pendente'} • ${money(p.totalCentavos)}`;
          open.textContent='Consultar endereço e entrega';open.disabled=fromCache;
          open.onclick=async()=>{
            open.disabled=true;
            try{
              const d=await call('consultarEntregaCaixaV2',{pedidoId:record.id});
              if(!atual()||!section.isConnected)return;
              label.textContent=`Pedido ${record.id} • ${d.status} • ${d.pagamento||'pendente'} • ${money(d.totalCentavos)}`;
              detail.replaceChildren();const address=document.createElement('p');
              address.textContent=`${d.entrega.nome} • ${d.entrega.telefone} • ${d.entrega.logradouro}, ${d.entrega.numero} ${d.entrega.complemento} • ${d.entrega.bairro}, ${d.entrega.cidade}/${d.entrega.uf} • CEP ${d.entrega.cep} • Taxa ${money(d.taxaEntregaCentavos)}${d.responsavel?' • Responsável: '+d.responsavel:''}`;
              detail.append(address);
              const preview=document.createElement('button');preview.textContent='Conferir cupom de entrega (simulado)';
              preview.onclick=()=>{const frame=document.createElement('iframe');frame.title='Cupom de entrega simulado';frame.setAttribute('sandbox','');frame.srcdoc=gerarCupomEntrega(d);detail.append(frame);preview.disabled=true;};detail.append(preview);
              const next={novo:['em_preparo','Iniciar preparo'],em_preparo:['pronto','Marcar pronto'],pronto:['saiu_entrega','Confirmar saída'],saiu_entrega:['entregue','Confirmar entrega']}[d.status];
              if(next&&d.recebidoPdv){
                const responsible=document.createElement('input');responsible.maxLength=80;responsible.setAttribute('aria-label','Responsável pela entrega');responsible.placeholder='Responsável pela entrega';
                if(d.status==='pronto')detail.append(responsible);
                const advance=document.createElement('button');advance.textContent=next[1];let attempt=null;
                advance.onclick=async()=>{
                  if(!attempt&&d.status==='pronto'&&!responsible.value.trim()){aviso.textContent='Informe o responsável pela entrega.';return;}
                  attempt||={pedidoId:record.id,de:d.status,para:next[0],requestId:crypto.randomUUID(),...(d.status==='pronto'?{responsavel:responsible.value.trim()}:{})};
                  advance.disabled=true;responsible.disabled=true;
                  try{await call('avancarEntregaV2',attempt);if(atual()){aviso.textContent='Andamento da entrega confirmado.';await open.onclick();}}
                  catch(e){if(atual()){aviso.textContent=e.message;advance.disabled=false;advance.textContent='Consultar / retomar mesma alteração';}}
                };
                detail.append(advance);
              }
            }catch(e){if(atual())aviso.textContent=e.message;}
            finally{if(atual())open.disabled=false;}
          };
          section.append(label,open,detail);return section;
}
