// Coordena o vínculo sem conhecer DOM ou Firebase. Não guarda senha nem código.
export function criarConexaoLicenciada({ servicos, obterContexto, exigirGerente, obterOperador = () => null }) {
  let busy = false;
  const snapshot = () => {
    exigirGerente();
    const c = obterContexto();
    if (!c.chaveLicenca || !c.deviceId || !['caixa', 'atendimento'].includes(c.tipoTerminal)) throw new Error('Confira a licença e a função deste computador.');
    return { chaveLicenca: c.chaveLicenca, deviceId: c.deviceId, tipoTerminal: c.tipoTerminal };
  };
  function conferir(contexto, operador) {
    if (obterOperador() !== operador) throw new Error("O usuário mudou. Abra a conexão novamente.");
    if (JSON.stringify(snapshot()) !== JSON.stringify(contexto)) throw new Error('A licença ou a função mudou. Feche e abra a conexão novamente.');
  }
  function validar(vinculo, contexto) {
    if (!vinculo?.vinculado) return false;
    if (vinculo.chaveLicenca !== contexto.chaveLicenca || vinculo.deviceId !== contexto.deviceId)
      throw new Error('O vínculo não corresponde à licença ou à função deste computador. Solicite a revisão do acesso.');
    return vinculo.papel === contexto.tipoTerminal;
  }
  async function executar(email, senha) {
    if (busy) throw new Error('Aguarde a conferência em andamento.');
    busy = true;
    let loginIniciado = false;
    let acesso;
    try {
      acesso = servicos.criarAcesso();
      const operador = obterOperador();
      const contexto = snapshot();
      const terminal = await acesso.prepararTerminal(); conferir(contexto, operador);
      if (validar(terminal.vinculo, contexto)) return terminal.vinculo;
      if (email === undefined) return { vinculado: false, ajusteFuncao: terminal.vinculo?.vinculado === true, papelAtual: terminal.vinculo?.papel };
      loginIniciado = true;
      await acesso.entrarGerencia(email, senha); conferir(contexto, operador);
      await servicos.gerencia().call('vincularTerminalLicenciadoV2', { ...contexto, terminalUid: terminal.uid });
      conferir(contexto, operador);
      const confirmado = await acesso.consultarTerminal(); conferir(contexto, operador);
      if (!validar(confirmado.vinculo, contexto)) throw new Error('A confirmação não chegou. Use Conferir conexão antes de tentar novamente.');
      return confirmado.vinculo;
    } finally {
      try { if (loginIniciado) await (servicos.encerrarGerencia ? servicos.encerrarGerencia() : acesso.sairGerencia()); }
      finally { busy = false; }
    }
  }
  return { consultar: () => executar(), conectar: (email, senha) => executar(email, senha) };
}
