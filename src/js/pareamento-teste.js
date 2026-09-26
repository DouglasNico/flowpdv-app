import { acessoHomologacao, sessaoGerenciaTeste } from './sessoes-homologacao.js';
import { criarRecuperacaoTerminalPendente } from './recuperacao-terminal-pendente.js';

export function instalarPareamentoTeste() {
  if (window.electronAPI?.ambienteTeste !== true || document.getElementById('pair-open')) return;
  const launcher = document.createElement('button');
  launcher.id = 'pair-open'; launcher.textContent = 'Configurar acesso de teste';
  launcher.style.cssText = 'position:fixed;right:18px;bottom:44px;z-index:2147483646;padding:12px 18px;border:0;border-radius:10px;background:#0f766e;color:white;cursor:pointer';
  document.body.appendChild(launcher);
  const dialog = document.createElement('dialog'); dialog.id = 'pair-dialog';
  dialog.setAttribute('aria-labelledby', 'pair-title');
  dialog.innerHTML = `
    <style>
      #pair-dialog{width:min(920px,94vw);max-height:88vh;margin:auto;padding:26px;border:0;border-radius:18px;background:#f8fafc;color:#0f172a;font:15px/1.5 system-ui;box-sizing:border-box;overflow:auto}
      #pair-dialog::backdrop{background:#0f172aaa} #pair-dialog *{box-sizing:border-box}
      #pair-dialog h2{margin:0;font-size:23px} #pair-dialog h3{font-size:18px;margin:0 0 14px}
      #pair-dialog p{margin:8px 0 16px} #pair-dialog .pair-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
      #pair-dialog section{background:white;padding:20px;border:1px solid #dbe3ea;border-radius:12px;min-width:0}
      #pair-dialog label{display:block;margin:12px 0 5px;font-weight:600}
      #pair-dialog input,#pair-dialog select{display:block;width:100%;padding:9px;border:1px solid #94a3b8;border-radius:7px;background:white;color:#0f172a;font:inherit}
      #pair-dialog button{padding:9px 13px;border:0;border-radius:7px;background:#0f766e;color:white;font:inherit;cursor:pointer;margin-top:12px}
      #pair-dialog button:disabled{opacity:.5;cursor:wait} #pair-dialog .pair-secondary{background:#e2e8f0;color:#0f172a}
      #pair-dialog .pair-small{font-size:13px;color:#475569} #pair-message{padding:12px;background:#e2e8f0;border-radius:8px;min-height:46px}
      #pair-message[data-error=true]{background:#fee2e2;color:#991b1b} #pair-dialog hr{border:0;border-top:1px solid #e2e8f0;margin:18px 0}
      #pair-transfer-state{overflow-wrap:anywhere} #pair-transfer-section{scroll-margin-top:20px}
      @media(max-width:700px){#pair-dialog .pair-grid{grid-template-columns:1fr}}
    </style>
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><h2 id="pair-title">Acesso da loja • teste</h2><button id="pair-close" class="pair-secondary" type="button">Fechar</button></div>
    <p id="pair-intro">Autorize este computador como caixa ou cozinha usando uma loja fictícia.</p>
    <div class="pair-grid">
      <section><h3>1. Identificar este terminal</h3>
        <p class="pair-small">Prepare a identificação e informe-a ao gerente da loja.</p>
        <button id="pair-prepare" type="button">Preparar terminal</button>
        <label for="pair-uid">Identificação do terminal</label><input id="pair-uid" readonly placeholder="Prepare o terminal primeiro">
        <form id="pair-activate-form"><label for="pair-token">Código de autorização</label><input id="pair-token" required autocomplete="off" spellcheck="false">
        <button type="submit">Ativar terminal</button></form>
        <button id="pair-recover" type="button" class="pair-secondary">Consultar ativação</button>
        <p id="pair-terminal-state" class="pair-small">Nenhuma ativação consultada.</p>
      </section>
      <section><h3>2. Autorizar como gerente</h3>
        <form id="pair-login-form"><label for="pair-email">E-mail</label><input id="pair-email" type="email" required autocomplete="username">
        <label for="pair-password">Senha</label><input id="pair-password" type="password" required autocomplete="current-password">
        <button type="submit">Entrar como gerente</button></form>
        <p id="pair-manager-state" class="pair-small">Gerente desconectado.</p><button id="pair-logout" type="button" class="pair-secondary">Sair da gerência</button>
        <hr><form id="pair-issue-form"><label for="pair-shop">Código da loja de teste</label><input id="pair-shop" required autocomplete="off">
        <label for="pair-target">Identificação do terminal a autorizar</label><input id="pair-target" required autocomplete="off">
        <label for="pair-name">Nome do terminal</label><input id="pair-name" required maxlength="80" placeholder="Ex.: Caixa do balcão">
        <label for="pair-role">Função</label><select id="pair-role"><option value="caixa">Caixa</option><option value="cozinha">Cozinha</option></select>
        <button type="submit">Gerar autorização</button></form>
        <label for="pair-issued">Código gerado — selecione para copiar</label><input id="pair-issued" readonly autocomplete="off">
        <p id="pair-expiry" class="pair-small">Válido por dez minutos e para um único terminal.</p>
        <button id="pair-revoke" type="button" class="pair-secondary">Revogar terminal informado</button>
      </section>
    </div>
    <section style="margin-top:18px" id="pair-transfer-section">
      <h3>Recuperar um caixa em outro equipamento</h3>
      <p class="pair-small">Use um caixa novo, já autorizado na mesma loja. Ao confirmar, o caixa anterior perde o acesso. Os dados locais precisam ser recuperados e conferidos separadamente.</p>
      <label for="pair-transfer-source">Identificação do caixa anterior</label><input id="pair-transfer-source" autocomplete="off" spellcheck="false">
      <label for="pair-transfer-target">Identificação do caixa novo</label><input id="pair-transfer-target" autocomplete="off" spellcheck="false">
      <button id="pair-transfer-plan" type="button" class="pair-secondary">Conferir transferência</button>
      <p id="pair-transfer-state" class="pair-small" role="status" aria-live="polite">Entre como gerente e informe o código da loja acima.</p>
      <label for="pair-transfer-reason">Motivo da troca</label><input id="pair-transfer-reason" maxlength="180" placeholder="Ex.: computador anterior com defeito">
      <button id="pair-transfer-apply" type="button">Confirmar transferência</button>
      <button id="pair-transfer-resume" type="button" class="pair-secondary">Consultar tentativa pendente</button>
    </section>
    <p id="pair-message" role="status" aria-live="polite">Use apenas as contas fictícias do ambiente local.</p>`;
  document.body.appendChild(dialog);
  const el = id => dialog.querySelector(`#${id}`), value = id => el(id).value.trim();
  const hospedado = window.electronAPI?.pilotoHospedado === true;
  if (hospedado) {
    launcher.textContent = 'Configurar acesso V2';
    el('pair-title').textContent = 'Acesso da loja • piloto V2';
    el('pair-intro').textContent = 'Autorize este computador na loja V2. Este perfil acessa dados reais no Firebase.';
    dialog.querySelector('label[for="pair-shop"]').textContent = 'Identificação da loja V2';
    el('pair-shop').value = 'legado-lic-flow-937278';
    el('pair-message').textContent = 'Entre com a conta de gerente da BURGER TESTE. O e-mail precisa estar verificado.';
    el('pair-transfer-section').hidden = true;
  }
  const acesso = acessoHomologacao(); let busy = false;
  let planoTransferencia = null;
  const invalidarPlano = () => { planoTransferencia = null; el('pair-transfer-state').textContent = 'Confira a transferência antes de confirmar.'; };
  for (const id of ['pair-shop', 'pair-transfer-source', 'pair-transfer-target']) el(id).addEventListener('input', invalidarPlano);
  function recuperacaoPendente() {
    const s = sessaoGerenciaTeste();
    return criarRecuperacaoTerminalPendente({ storage: localStorage, uid: s.auth.currentUser?.uid, lojaId: value('pair-shop'),
      getUid: () => s.auth.currentUser?.uid, uuid: () => crypto.randomUUID(), ambienteTeste: window.electronAPI?.ambienteTeste,
      call: (_nome, dados) => acesso.recuperarTerminal(dados) });
  }
  function transferenciaConcluida(result) {
    planoTransferencia = null;
    el('pair-transfer-state').textContent = result.reutilizado
      ? 'A tentativa já havia sido concluída. Consulte a ativação do caixa novo para confirmar seu acesso atual.'
      : 'Transferência concluída. O caixa anterior perdeu o acesso; confira a recuperação dos dados locais no caixa novo.';
    window.dispatchEvent(new CustomEvent('flowpdv-terminal-v2', { detail: { revalidar: true } }));
    message(el('pair-transfer-state').textContent);
  }
  const message = (text, error = false) => { el('pair-message').textContent = text; el('pair-message').dataset.error = String(error); };
  const clearSecrets = () => { for (const id of ['pair-password', 'pair-token', 'pair-issued']) el(id).value = ''; };
  const errors = {
    'auth/invalid-credential': 'E-mail ou senha inválidos.', 'auth/invalid-login-credentials': 'E-mail ou senha inválidos.',
    'auth/network-request-failed': 'Não foi possível conectar ao serviço de teste. Verifique os emuladores locais.',
    'functions/unavailable': 'Serviço de teste indisponível. Verifique os emuladores locais.',
    'functions/deadline-exceeded': 'A confirmação demorou. Use Consultar ativação antes de tentar novamente.'
  };
  if (hospedado) {
    errors['auth/network-request-failed'] = 'Não foi possível conectar ao Firebase. Confira a conexão.';
    errors['functions/unavailable'] = 'Serviço V2 indisponível. Confira a publicação do backend e a conexão.';
  }
  async function run(action) {
    if (busy) return; busy = true; dialog.dataset.busy = 'true';
    const buttons = [...dialog.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try { await action(); } catch (error) { message(errors[error.code] || error.message || 'Não foi possível concluir a operação.', true); }
    finally { busy = false; dialog.dataset.busy = 'false'; buttons.forEach(b => b.disabled = false); }
  }
  function bind(id, event, action) { el(id).addEventListener(event, e => { e.preventDefault(); run(action); }); }
  function showBinding(binding) {
    window.dispatchEvent(new CustomEvent('flowpdv-terminal-v2', { detail: binding }));
    el('pair-terminal-state').textContent = binding.vinculado === false ? 'Terminal ainda não autorizado.' : `Terminal ativo • ${binding.papel === 'cozinha' ? 'Cozinha' : 'Caixa'} • Loja ${binding.lojaId}`;
  }
  launcher.addEventListener('click', () => { dialog.showModal(); });
  el('pair-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  dialog.addEventListener('close', clearSecrets);
  bind('pair-prepare', 'click', async () => {
    el('pair-terminal-state').textContent = 'Ativação ainda não confirmada.';
    const result = await acesso.prepararTerminal();
    el('pair-uid').value = result.uid;
    showBinding(result.vinculo);
    message('Identificação preparada. O gerente pode autorizar este terminal.');
  });
  bind('pair-login-form', 'submit', async () => {
    invalidarPlano();
    let usuario;
    try { usuario = await acesso.entrarGerencia(value('pair-email'), el('pair-password').value); }
    finally { el('pair-password').value = ''; }
    el('pair-manager-state').textContent = `Conectado: ${usuario.email}`;
    message('Login concluído. As permissões da loja serão verificadas ao autorizar.');
  });
  bind('pair-logout', 'click', async () => {
    invalidarPlano();
    await acesso.sairGerencia(); clearSecrets(); el('pair-manager-state').textContent = 'Gerente desconectado.'; message('Gerência desconectada. A identidade do terminal foi preservada.');
  });
  bind('pair-issue-form', 'submit', async () => {
    el('pair-issued').value = '';
    const invitation = await acesso.emitir( { lojaId: value('pair-shop'), terminalUid: value('pair-target'), nome: value('pair-name'), papel: value('pair-role') });
    el('pair-issued').value = invitation.token;
    el('pair-expiry').textContent = `Use até ${new Date(invitation.expiraEm).toLocaleTimeString('pt-BR')}.`;
    message('Autorização gerada. Informe o código na ativação do terminal.');
  });
  bind('pair-activate-form', 'submit', async () => {
    const result = await acesso.ativarTerminal(value('pair-token'));
    showBinding(result.vinculo); clearSecrets(); message(hospedado ? 'Terminal pareado no V2. Isso não ativa vendas nem altera o estoque.' : 'Terminal ativado com sucesso no ambiente de teste.');
  });
  bind('pair-recover', 'click', async () => {
    el('pair-terminal-state').textContent = 'Consultando autorização…';
    try {
      const result = await acesso.consultarTerminal();
      el('pair-uid').value = result.uid;
      showBinding(result.vinculo); message('Consulta concluída.');
    } catch (error) { el('pair-terminal-state').textContent = 'Ativação não confirmada. Consulte a mensagem abaixo.'; throw error; }
  });
  bind('pair-revoke', 'click', async () => {
    if (!window.confirm(hospedado ? 'Revogar o acesso deste terminal à loja V2?' : 'Revogar o acesso do terminal informado à loja de teste?')) return;
    await acesso.revogar( { lojaId: value('pair-shop'), terminalUid: value('pair-target') });
    if (value('pair-target') === value('pair-uid')) { showBinding({ vinculado: false }); el('pair-terminal-state').textContent = 'Acesso revogado.'; }
    clearSecrets(); message('Acesso do terminal revogado.');
  });
  bind('pair-transfer-plan', 'click', async () => {
    invalidarPlano();
    if (recuperacaoPendente().pendente()) throw new Error('Existe uma transferência pendente. Use Consultar tentativa pendente.');
    const usuario = sessaoGerenciaTeste().auth.currentUser?.uid;
    const plano = await acesso.consultarPlanoRecuperacao({ lojaId: value('pair-shop'), origemUid: value('pair-transfer-source'), destinoUid: value('pair-transfer-target') });
    planoTransferencia = { ...plano, gerenteUid: usuario };
    el('pair-transfer-state').textContent = `Loja ${plano.lojaId}: transferir de ${plano.origemUid} para ${plano.destinoUid}. O acesso anterior será revogado. Nenhuma senha será copiada.`;
    message('Confira a loja e os dois equipamentos antes de confirmar.');
  });
  bind('pair-transfer-apply', 'click', async () => {
    const p = planoTransferencia;
    if (!p || p.gerenteUid !== sessaoGerenciaTeste().auth.currentUser?.uid || p.lojaId !== value('pair-shop')
      || p.origemUid !== value('pair-transfer-source') || p.destinoUid !== value('pair-transfer-target')) throw new Error('Confira a transferência novamente.');
    if (!window.confirm('Transferir a operação para o caixa novo e revogar o acesso do caixa anterior?')) return;
    transferenciaConcluida(await recuperacaoPendente().executar(p, value('pair-transfer-reason'), true));
  });
  bind('pair-transfer-resume', 'click', async () => {
    transferenciaConcluida(await recuperacaoPendente().retomar());
  });
}
