export function iniciarPainelTeste() {
  if (window.electronAPI?.ambienteTeste !== true) return false;
  if (window.electronAPI.aplicativoCompletoTeste === true) return false;
  window.electronAPI.onSolicitarFechamento?.(() => window.electronAPI.fecharAppConfirmado());
  window.electronAPI.onForcarOfflineESair?.(() => window.electronAPI.fecharAppConfirmado());
  const banner = document.getElementById('flowpdv-profile-banner') || [...document.body.children].find(el => el.textContent === 'AMBIENTE DE TESTE — dados separados; serviços reais bloqueados');
  const layoutPdv=document.querySelector('#tab-pdv > .pdv-layout')?.cloneNode(true);
  const layoutClassico=document.getElementById('classic-pdv-shell')?.cloneNode(true);
  const main = document.createElement('main'); main.id = 'painel-teste-local';
  const operacional = window.electronAPI?.homologacaoOperacional === true;
  main.dataset.perfil = operacional ? 'homologacao-operacional' : 'laboratorio';
  main.style.cssText = 'position:fixed;inset:0;background:#f8fafc;color:#0f172a;padding:48px 40px;overflow:auto;font:16px/1.5 system-ui';
  const title = document.createElement('h1'); title.textContent = operacional ? 'FlowPDV — homologação operacional' : 'FlowPDV — loja de teste';
  const intro = document.createElement('p'); intro.textContent = 'Este ambiente local não precisa de licença. Pedidos, pagamentos e impressões são fictícios.';
  const instructions = document.createElement('p'); instructions.textContent = operacional ? 'Autorize o terminal em Acesso do terminal e habilite a homologação em Configurar loja. Novas vendas exigem adesão explícita. Este perfil tem dados próprios, separados do laboratório e da loja real.' : 'Use o cardápio para enviar um pedido e acompanhe o atendimento pelos controles abaixo. A loja real não é acessada.';
  if (window.electronAPI.pilotoHospedado === true) {
    title.textContent = 'FlowPDV — piloto V2 conectado';
    intro.textContent = 'Este perfil acessa o Firebase real. Alterações autorizadas são gravadas na loja vinculada.';
    instructions.textContent = 'Autorize o computador em Acesso do terminal. A cópia migrada permanece suspensa até a conferência do catálogo, dos pedidos e do estoque. O caixa instalado usa outra pasta. TEF, emissão fiscal e impressão física ficam bloqueados neste piloto.';
  }
  main.append(title,intro,instructions);
  for(const [id,label] of [['receive-open','Pedidos e mesas'],['kitchen-open','Cozinha e cupons'],['checkout-open','Pagamentos e turnos'],['admin-open','Configurar loja'],['pair-open','Acesso do terminal']]) {
    if (window.electronAPI.pilotoHospedado === true && id !== 'pair-open') continue;
    const button=document.createElement('button'); button.type='button';button.textContent=label;
    button.style.cssText='display:block;margin:12px 0;padding:12px 20px;background:#0f766e;color:white;border:0;border-radius:8px;font:inherit;cursor:pointer';
    button.onclick=()=>document.getElementById(id)?.click();main.append(button);
  }
  if(layoutPdv){const host=document.createElement('section');host.id='pdv-operacional-teste';host.hidden=true;host.append(layoutPdv);main.append(host);}
  if(layoutClassico){const host=document.createElement('section');host.id='pdv-classico-teste';host.hidden=true;host.append(layoutClassico);main.append(host);}
  document.body.replaceChildren(main,...(banner?[banner]:[]));
  return true;
}
