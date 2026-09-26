import {mostrarPendenciasRecuperacao} from './pendencias-recuperacao.js';
import {criarLiberacaoPerfilRecuperado} from './liberacao-perfil-recuperado.js';
import {instalarFechamentoRecuperado} from './fechamento-recuperado-ui.js';
export function instalarLiberacaoPerfil({host,storage,sessao,gerencia}){
  if(storage.getItem('flowpdv_recuperacao_operacao_bloqueada')===null)return;
  instalarFechamentoRecuperado({host,storage,sessao,gerencia});
  const criar=(tag,texto)=>{const e=document.createElement(tag);if(texto)e.textContent=texto;return e;};
  const service=criarLiberacaoPerfilRecuperado({storage,sessao,gerencia,ambienteTeste:true});
  const section=criar('section'),title=criar('h3','Conferir e liberar este perfil'),intro=criar('p','Liberação para iniciar um novo turno: exige turnos encerrados, conferência das contas/pedidos que continuarão pendentes, contagem física e comprovantes independentes. Entre como gerente no painel de acesso antes de confirmar.');
  const preparar=criar('button','Preparar conferência de liberação');preparar.type='button';preparar.id='recovery-release-prepare';
  const state=criar('p');state.id='recovery-release-state';state.setAttribute('role','status');
  const form=criar('form');form.id='recovery-release-form';form.hidden=true;
  section.append(title,intro,preparar,state,form);host.append(section);
  let dados,ocupado=false;
  async function executar(fn){if(ocupado)return;ocupado=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){state.textContent=e.message||'Não foi possível concluir. O perfil permanece bloqueado.';}finally{ocupado=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  const campo=(parent,label,scale=100)=>{
    const wrap=criar('label',label+' '),input=criar('input');input.type='text';input.inputMode='decimal';input.required=true;input.autocomplete='off';wrap.append(input);parent.append(wrap,criar('br'));
    return ()=>{const text=input.value.trim().replace(',','.');if(!/^\d+(\.\d{1,3})?$/.test(text))throw Error('Informe valores numéricos válidos.');const n=Number(text)*scale;if(!Number.isSafeInteger(Math.round(n))||Math.abs(n-Math.round(n))>0.000001)throw Error('Confira as casas decimais informadas.');return Math.round(n);};
  };
  preparar.onclick=()=>executar(async()=>{
    form.hidden=true;form.replaceChildren();state.textContent='Conferindo vendas, caixa, estoque e pendências…';
    const plano=await service.preparar({preservarPendencias:true});dados={turnos:[],produtos:[],aceitarPendencias:mostrarPendenciasRecuperacao(form,plano.pendencias)};
    for(const t of plano.turnos){const group=criar('fieldset');group.append(criar('legend','Turno '+t.id));form.append(group);dados.turnos.push({id:t.id,dinheiro:campo(group,'Recebimentos em dinheiro dos comprovantes (R$)'),sangrias:campo(group,'Sangrias dos comprovantes (R$)'),contagem:campo(group,'Contagem registrada no fechamento (R$)')});}
    for(const p of plano.produtos){dados.produtos.push({id:p.id,contagem:campo(form,`Contagem física: ${p.nome} (${p.unidade})`,1000)});}
    const label=criar('label','Referência dos comprovantes usados '),fonte=criar('input');fonte.required=true;fonte.minLength=5;fonte.maxLength=180;label.append(fonte);form.append(label,criar('br'));dados.fonte=fonte;
    const aceite=criar('label','Conferi os comprovantes e a contagem física. '),check=criar('input');check.type='checkbox';check.required=true;aceite.prepend(check);form.append(aceite,criar('br'));dados.check=check;
    const confirmar=criar('button','Autorizar e liberar novo turno');confirmar.type='submit';form.append(confirmar);form.hidden=false;state.textContent='Dados eletrônicos conferidos. Preencha a conferência independente; nenhum saldo será restaurado.';
  });
  form.onsubmit=e=>{e.preventDefault();executar(async()=>{
    const entrada={pendenciasConfirmadas:dados.aceitarPendencias(),confirmado:dados.check.checked,fonte:dados.fonte.value,turnos:dados.turnos.map(t=>({id:t.id,dinheiroCentavos:t.dinheiro(),sangriasCentavos:t.sangrias(),contagemCentavos:t.contagem()})),produtos:dados.produtos.map(p=>({id:p.id,saldoMili:p.contagem()}))};
    await service.liberar(entrada);state.textContent='Perfil liberado. Recarregando para iniciar um novo turno…';window.location.reload();
  });};
}
