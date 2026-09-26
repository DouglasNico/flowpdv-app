import { confirmarAdesaoPdvV2 } from './adesao-pdv-v2.js';
import { criarServicosAcessoHospedado } from './servicos-acesso-hospedado.js';
import { criarConexaoLicenciada } from './conexao-licenciada-core.js';

export function instalarConexaoCardapio({ storage, auth }) {
  const host = document.getElementById('cfg-conexao-cardapio');
  if (!host || window.electronAPI?.ambienteTeste === true || !window.electronAPI) return;
  let servicos, controller, busy = false;
  const contexto = () => ({ chaveLicenca: String(storage.getLicenca()?.chaveLicenca || storage.getLicenca()?.clienteId || '').trim().toUpperCase(), deviceId: storage.getDeviceId(), tipoTerminal: storage.getTipoTerminal() });
  const exigirGerente = () => {
    if (!auth.isGerente() || !auth.getUsuario() || document.body.classList.contains('tela-login-ativa')) throw new Error('Entre como gerente no PDV para conectar este computador.');
    if (!contexto().chaveLicenca) throw new Error('Licença não configurada no PDV.');
  };
  const obterController = () => {
    exigirGerente();
    servicos ||= criarServicosAcessoHospedado({ integracaoPdv: true, storage: localStorage, exigirOperador: exigirGerente, obterContextoLocal: () => auth.getUsuario() });
    return controller ||= criarConexaoLicenciada({ servicos, obterContexto: contexto, exigirGerente, obterOperador: () => auth.getUsuario() });
  };
  const dialog = document.createElement('dialog');
  dialog.id = 'conexao-cardapio-dialog'; dialog.setAttribute('aria-labelledby', 'conexao-cardapio-title');
  dialog.innerHTML = `<div class="conexao-cabecalho"><h2 id="conexao-cardapio-title">Conectar este computador</h2><button type="button" data-fechar aria-label="Fechar">Fechar</button></div>
    <p id="conexao-cardapio-resumo"></p>
    <p class="conexao-explicacao">A loja e a função vêm das configurações do PDV. Confirme sua conta de gerente para autorizar a conexão.</p>
    <p id="conexao-cardapio-mensagem" role="status" aria-live="polite"></p>
    <form id="conexao-cardapio-form">
      <label for="conexao-cardapio-email">E-mail do gerente</label><input id="conexao-cardapio-email" type="email" autocomplete="username" required>
      <label for="conexao-cardapio-senha">Senha da conta</label><input id="conexao-cardapio-senha" type="password" autocomplete="current-password" required>
      <p class="conexao-explicacao">Use a conta do painel da loja. A senha não será salva no PDV.</p>
      <div class="conexao-acoes"><button type="submit">Autorizar este computador</button></div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), password = dialog.querySelector('#conexao-cardapio-senha'), email = dialog.querySelector('#conexao-cardapio-email'), message = dialog.querySelector('#conexao-cardapio-mensagem');
  const abrir = document.getElementById('cfg-conexao-cardapio-abrir'), status = document.getElementById('cfg-conexao-cardapio-status');
  function atualizar() {
    host.hidden = !contexto().chaveLicenca;
    status.textContent = 'Conexão do cardápio · ' + (contexto().tipoTerminal === 'atendimento' ? 'Atendimento' : 'Caixa');
  }
  async function executar(action) {
    if (busy) return;
    busy = true; message.textContent = 'Conferindo a conexão deste computador…'; message.dataset.error = 'false';
    dialog.querySelectorAll('button,input').forEach(e => e.disabled = true);
    try {
      const result = await action();
      let operacional = false;
      if (result.vinculado && result.papel === 'caixa') {
        const resposta = await servicos.terminal().call('consultarPreparacaoOperacionalPdvV2');
        operacional = confirmarAdesaoPdvV2({storage: localStorage, servico: storage, resposta});
        if (operacional) {
          await servicos.terminal().call('confirmarAdesaoOperacionalPdvV2',{deviceId:resposta.deviceId,revisao:resposta.revisao});
          window.dispatchEvent(new Event('flowpdv-operacao-v2-pronta'));
        }
      }
      if (!dialog.open) return;
      form.hidden = result.vinculado === true;
      dialog.querySelector('#conexao-cardapio-title').textContent = result.vinculado ? 'Computador conectado' : 'Conectar este computador';
      dialog.querySelector('.conexao-explicacao').hidden = result.vinculado === true;
      dialog.querySelector('[data-fechar]').textContent = result.vinculado ? 'Concluir' : 'Fechar';
      message.textContent = result.vinculado ? (operacional ? 'Caixa integrado conectado. Os pedidos aparecem em Pedidos do cardápio.' : 'Computador conectado. A migração do recebimento ainda está pendente.') : 'Confirme sua conta para conectar este computador.';
      dialog.querySelector('button[type=submit]').textContent = result.ajusteFuncao ? 'Confirmar troca de função' : 'Autorizar este computador';
      if (result.ajusteFuncao) {
        const nome = p => p === 'atendimento' ? 'Atendimento' : 'Caixa';
        message.textContent = 'Troca pendente: de ' + nome(result.papelAtual) + ' para ' + nome(contexto().tipoTerminal) + '. Confirme a conta do painel para atualizar o mesmo computador.';
        status.textContent = 'Troca de função pendente no cardápio';
        abrir.textContent = 'Concluir troca de função';
      }
      if (result.vinculado) { password.value = ''; status.textContent = 'Conectado · ' + (result.papel === 'atendimento' ? 'Atendimento' : 'Caixa'); abrir.textContent = 'Conferir conexão'; }
    } catch (error) {
      if (!dialog.open) return;
      message.dataset.error = 'true';
      message.textContent = ['auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code) ? 'Confira o e-mail e a senha da conta do painel.' : error.message || 'Não foi possível conectar. Confira sua conexão e tente novamente.';
    } finally {
      busy = false;
      dialog.querySelectorAll('button,input').forEach(e => e.disabled = false);
    }
  }
  abrir.addEventListener('click', () => {
    if (busy) return;
    form.hidden = false; password.value = ''; message.textContent = '';
    dialog.querySelector('#conexao-cardapio-title').textContent = 'Conectar este computador';
    dialog.querySelector('.conexao-explicacao').hidden = false;
    dialog.querySelector('[data-fechar]').textContent = 'Fechar';
    const license = storage.getLicenca() || {};
    dialog.querySelector('#conexao-cardapio-resumo').textContent = `${license.nomeCliente || license.nome || license.razaoSocial || 'Sua loja'} · ${contexto().tipoTerminal === 'atendimento' ? 'Atendimento' : 'Caixa'}`;
    dialog.showModal(); executar(() => obterController().consultar());
  });
  form.addEventListener('submit', e => { e.preventDefault(); const senha = password.value; executar(() => obterController().conectar(email.value.trim(), senha)); });
  dialog.querySelector('[data-fechar]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  dialog.addEventListener('close', () => { password.value = ''; email.value = ''; servicos?.encerrarGerencia().catch(() => {}); });
  window.addEventListener('flowpdv-operador-local', () => { if (dialog.open) dialog.close(); atualizar(); });
  document.getElementById('cfg-tipo-terminal')?.addEventListener('change', atualizar);
  window.ConexaoCardapio = { atualizar, async conferirAposTroca() {
    if (!contexto().chaveLicenca) return false;
    atualizar();
    status.textContent = 'Função salva no PDV; conferência do cardápio pendente';
    abrir.click();
    return true;
  } };
  atualizar();
}
