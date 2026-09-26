// Ciclo de acesso independente das telas e do SDK. Nenhuma credencial é persistida aqui.
export function criarAcessoHomologacao({ ambienteTeste, pilotoHospedado, terminal, gerencia, autenticarAnonimo, autenticarGerencia, sairGerencia }) {
  if (ambienteTeste !== true && pilotoHospedado !== true) throw new Error('Disponível somente no teste local ou piloto hospedado explícito.');
  let versaoTerminal = 0, versaoGerencia = 0, filaGerencia = Promise.resolve();
  const obsoleto = () => new Error('A sessão mudou durante a operação. Consulte o acesso novamente.');
  function conferir(sessao, uid, versao, atual) {
    if (versao !== atual || !uid || sessao.auth.currentUser?.uid !== uid) throw obsoleto();
  }
  function enfileirarGerencia(acao) {
    const tarefa = filaGerencia.then(acao, acao);
    filaGerencia = tarefa.catch(() => {});
    return tarefa;
  }
  async function consultarTerminal({ preparar = false, token } = {}) {
    const versao = ++versaoTerminal, s = await terminal();
    if (versao !== versaoTerminal) throw obsoleto();
    if (preparar && !s.auth.currentUser) await autenticarAnonimo(s.auth);
    const uid = s.auth.currentUser?.uid;
    if (!uid) throw new Error('Prepare este terminal primeiro.');
    conferir(s, uid, versao, versaoTerminal);
    const vinculo = await s.call(token === undefined ? 'consultarMeuTerminalV2' : 'concluirPareamentoV2', token === undefined ? {} : { token });
    conferir(s, uid, versao, versaoTerminal);
    return { uid, vinculo };
  }
  async function comandoGerencia(nome, dados) {
    const versao = versaoGerencia, s = await gerencia(), uid = s.auth.currentUser?.uid;
    if (!uid) throw new Error('Entre como gerente antes de autorizar ou revogar.');
    conferir(s, uid, versao, versaoGerencia);
    const result = await s.call(nome, dados);
    conferir(s, uid, versao, versaoGerencia);
    return result;
  }
  return {
    prepararTerminal: () => consultarTerminal({ preparar: true }),
    consultarTerminal: () => consultarTerminal(),
    ativarTerminal: token => consultarTerminal({ token }),
    entrarGerencia(email, senha) {
      const versao = ++versaoGerencia;
      return enfileirarGerencia(async () => {
        if (versao !== versaoGerencia) throw obsoleto();
        const s = await gerencia();
        if (versao !== versaoGerencia) throw obsoleto();
        await autenticarGerencia(s.auth, email, senha);
        const uid = s.auth.currentUser?.uid;
        conferir(s, uid, versao, versaoGerencia);
        return { uid, email: s.auth.currentUser.email };
      });
    },
    sairGerencia() {
      ++versaoGerencia;
      return enfileirarGerencia(async () => sairGerencia((await gerencia()).auth));
    },
    emitir: dados => comandoGerencia('emitirPareamentoV2', dados),
    consultarPlanoRecuperacao: dados => comandoGerencia('consultarPlanoRecuperacaoTerminalV2', dados),
    async recuperarTerminal(dados) {
      ++versaoTerminal;
      return comandoGerencia('recuperarOperacaoTerminalV2', dados);
    },
    async revogar(dados) {
      // Invalida consultas em curso antes do comando: resposta anterior não reafirma o vínculo.
      ++versaoTerminal;
      return comandoGerencia('revogarTerminalV2', dados);
    }
  };
}
