import {mostrarPendenciasRecuperacao} from './pendencias-recuperacao.js';
import {criarFechamentoPerfilRecuperado} from './fechamento-perfil-recuperado.js';
export function instalarFechamentoRecuperado({host,storage,sessao,gerencia}){
  if(storage.getItem('flowpdv_recuperacao_operacao_bloqueada')===null)return;
  const service=criarFechamentoPerfilRecuperado({storage,sessao,gerencia,ambienteTeste:true});
  const section=document.createElement('section');section.innerHTML='<h3>Concluir o caixa recuperado</h3><p>Reconstrói apenas movimentos confirmados. Pagamentos incertos permanecem bloqueados. O gerente deve entrar pelo painel de acesso.</p><button type="button" id="recovery-close-prepare">Conferir caixa aberto</button><button type="button" id="recovery-close-resume">Retomar fechamento</button><p id="recovery-close-state" role="status"></p><form id="recovery-close-form" hidden></form>';
  host.append(section);const el=id=>section.querySelector('#'+id),form=el('recovery-close-form'),state=el('recovery-close-state');let ocupado=false,aceitarPendencias=()=>false;
  const executar=async fn=>{if(ocupado)return;ocupado=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){state.textContent=e.message;}finally{ocupado=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);el('recovery-close-resume').hidden=!service.pendente();}};
  el('recovery-close-resume').hidden=!service.pendente();
  el('recovery-close-resume').onclick=()=>executar(async()=>{await service.retomar();window.location.reload();});
  el('recovery-close-prepare').onclick=()=>executar(async()=>{
    form.hidden=true;const p=await service.preparar({preservarPendencias:true});state.textContent=`Turno ${p.turnoId}: ${p.recuperados} movimentos confirmados recuperados na cópia. Confira os comprovantes e conte o dinheiro.`;form.replaceChildren();aceitarPendencias=mostrarPendenciasRecuperacao(form,p.pendencias);
    for(const [id,label] of [['dinheiroCentavos','Dinheiro líquido nos comprovantes (R$)'],['sangriasCentavos','Sangrias nos comprovantes (R$)'],['restauranteCentavos','Dinheiro conferido na parcela do restaurante (R$)'],['contagemCentavos','Contagem total da gaveta (R$)'],['fonte','Referência dos comprovantes']]){
      const l=document.createElement('label'),i=document.createElement('input');l.textContent=label+' ';i.name=id;i.required=true;if(id!=='fonte')i.inputMode='decimal';else{i.minLength=5;i.maxLength=180;}l.append(i);form.append(l,document.createElement('br'));
    }
    const l=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name='confirmado';check.required=true;l.append(check,document.createTextNode('Conferi os comprovantes, a contagem e as pendências.'));const b=document.createElement('button');b.type='submit';b.textContent='Concluir fechamento com gerente';form.append(l,document.createElement('br'),b);form.hidden=false;
  });
  form.onsubmit=e=>{e.preventDefault();executar(async()=>{
    const dados={pendenciasConfirmadas:aceitarPendencias(),fonte:form.elements.fonte.value,confirmado:form.elements.confirmado.checked};
    for(const k of ['dinheiroCentavos','sangriasCentavos','contagemCentavos','restauranteCentavos']){const v=form.elements[k].value.trim().replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(v))throw Error('Informe os valores em reais com até duas casas decimais.');dados[k]=Math.round(Number(v)*100);}
    await service.encerrar(dados);state.textContent='Fechamento recuperado. O perfil continua protegido até a liberação final.';window.location.reload();
  });};
}
