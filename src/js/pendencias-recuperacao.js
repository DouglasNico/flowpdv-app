export async function consultarPendenciasRecuperacao(call, contexto) {
  const p = await call('conferirPendenciasRecuperacaoV2');
  if (p?.versao !== 1 || p.somenteConferencia !== true || p.lojaId !== contexto.lojaId || p.terminalUid !== contexto.terminalUid
    || !/^[a-f0-9]{64}$/.test(p.digest || '') || !Array.isArray(p.registros) || p.registros.length > 200
    || p.registros.some(r => !['contas','pedidos'].includes(r.grupo) || typeof r.id !== 'string' || !Number.isSafeInteger(r.totalCentavos) || r.totalCentavos < 0)) throw Error('Conferência das pendências inválida. O perfil permanece bloqueado.');
  return p;
}
export function aceitePendencias(p, entrada) {
  if (!p) return undefined;
  if (p.registros.length && entrada.pendenciasConfirmadas !== true) throw Error('Confira cada conta/pedido e confirme que não existe pagamento recebido sem registro.');
  return {digest:p.digest,confirmado:true,fonte:entrada.fonte};
}
export function mostrarPendenciasRecuperacao(form, p) {
  if (!p?.registros.length) return () => false;
  const grupo=document.createElement('fieldset'),titulo=document.createElement('legend');
  titulo.textContent='Contas e pedidos que continuarão pendentes';grupo.append(titulo);
  const texto=document.createElement('p');texto.textContent='Confira cada registro com os comprovantes da loja. Esta etapa preserva os pedidos no servidor; não registra pagamento nem cancela contas. Se um pagamento foi recebido e não está registrado, mantenha o perfil bloqueado para conciliação.';grupo.append(texto);
  const lista=document.createElement('ul');lista.style.cssText='max-height:240px;overflow:auto;overflow-wrap:anywhere';
  for(const r of p.registros){const li=document.createElement('li');li.textContent=`${r.grupo==='contas'?'Conta':'Pedido'} ${r.id} • ${r.tipo}${r.mesaId?' • mesa '+r.mesaId:''} • ${r.status} • ${(r.totalCentavos/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;lista.append(li);}
  grupo.append(lista);const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.required=true;check.name='pendenciasConfirmadas';
  label.append(check,document.createTextNode(' Conferi os registros acima: podem continuar pendentes e não há pagamento recebido sem registro.'));grupo.append(label);form.append(grupo);
  return () => check.checked;
}
