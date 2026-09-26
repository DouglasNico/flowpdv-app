import { usarPdvOficialV2, usarFluxoOperacionalV2, usarAplicativoIntegradoV2 } from './perfil-operacional-v2.js';
import { onAuthStateChanged } from 'firebase/auth';
import { criarServicosAcessoLocal } from './servicos-acesso-local.js';
import { criarServicosAcessoHospedado } from './servicos-acesso-hospedado.js';

let servicos;
function obterServicos() {
  if (!usarFluxoOperacionalV2()) throw new Error('Disponível somente no teste local.');
  const oficial = usarPdvOficialV2();
  const criarServicos = (window.electronAPI.pilotoHospedado === true || usarPdvOficialV2()) ? criarServicosAcessoHospedado : criarServicosAcessoLocal;
  return servicos ||= criarServicos({ ambienteTeste: true, integracaoPdv: usarPdvOficialV2(), operacionalPdv: usarPdvOficialV2(), pilotoHospedado: window.electronAPI.pilotoHospedado === true, storage: window.localStorage,
    obterContextoLocal: () => usarAplicativoIntegradoV2() ? window.AuthModule?.getUsuario() : null,
    exigirOperador: (papel, operacao, data) => {
      if (oficial && !usarPdvOficialV2()) throw new Error('A licença mudou. Confira a conexão do cardápio.');
      if (!usarAplicativoIntegradoV2()) return;
      if (!window.AuthModule?.getUsuario() || document.body.classList.contains('tela-login-ativa')) throw new Error('Entre como operador no aplicativo antes de acessar o restaurante.');
      if (papel === 'gerencia' && !window.AuthModule.isGerente()) throw new Error('A configuração exige um gerente autenticado no aplicativo.');
      if (papel === 'terminal') {
        const permissoes = { cancelarPedidoV2: 'cancelarVenda', estornarVendaV2: 'cancelarVenda', estornarVendaLocalV2: 'cancelarVenda', cancelarTentativaVendaLocalV2: 'cancelarVenda', reimprimirCozinhaV2: 'reimprimirCupons' };
        const permissao = permissoes[operacao];
        if (permissao && !window.AuthModule.temPermissao(permissao)) throw new Error('Este operador não tem permissão para esta operação. Entre com um operador autorizado.');
        if (operacao === 'registrarBaixaVendaLocalV2' && data?.ajuste?.descontoCentavos > 0 && !window.AuthModule.temPermissao('darDesconto')) throw new Error('Este operador não tem permissão para dar desconto.');
      }
    }
  });
}

// Adaptador do aplicativo: não contém configuração Firebase nem regras de login.
export function sessaoTerminalTeste() { return obterServicos().terminal(); }
export function sessaoGerenciaTeste() { return obterServicos().gerencia(); }
export function acessoHomologacao() { return obterServicos().criarAcesso(); }

let pararObservacao;
export function iniciarObservacaoTerminalHomologacao() {
  if (!usarFluxoOperacionalV2() || pararObservacao) return;
  // O evento não transporta uma autorização. Os consumidores reconsultam o servidor.
  let inicial = true, anterior;
  pararObservacao = onAuthStateChanged(sessaoTerminalTeste().auth, usuario => {
    const atual = usuario?.uid || null;
    // As telas já fazem a consulta inicial. Repeti-la aqui interromperia operações
    // iniciadas durante a restauração da sessão, sem haver troca de identidade.
    if (inicial) { inicial = false; anterior = atual; return; }
    if (atual === anterior) return;
    anterior = atual;
    window.dispatchEvent(new CustomEvent('flowpdv-terminal-v2', { detail: { revalidar: true } }));
  });
  window.addEventListener('beforeunload', () => { pararObservacao?.(); pararObservacao = undefined; }, { once: true });
  if (usarAplicativoIntegradoV2()) {
    const sincronizarOperador = () => {
      const logado = !!window.AuthModule?.getUsuario() && !document.body.classList.contains('tela-login-ativa');
      for (const id of ['pair', 'receive', 'kitchen', 'checkout', 'admin']) {
        const permitido = logado && (id !== 'admin' || window.AuthModule.isGerente()) && !((id === 'receive' || id === 'checkout') && usarPdvOficialV2());
        const botao = document.getElementById(id + '-open'), modal = document.getElementById(id + '-dialog');
        if (botao) botao.hidden = !permitido;
        if (!permitido && modal?.open) modal.close();
      }
      servicos?.encerrarGerencia().catch(() => {});
      window.dispatchEvent(new CustomEvent('flowpdv-terminal-v2', { detail: { revalidar: true } }));
    };
    window.addEventListener('flowpdv-operador-local', sincronizarOperador);
    sincronizarOperador();
    window.addEventListener('beforeunload', () => window.removeEventListener('flowpdv-operador-local', sincronizarOperador), { once: true });
  }
}
