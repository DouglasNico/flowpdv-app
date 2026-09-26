// O servidor continua sendo a autoridade. Esta proteção impede que uma resposta
// da sessão anterior seja aplicada ao estado local depois de logout/troca de conta.
export function criarChamadaSessaoV2({ auth, executar, exigirOperacao = () => {}, obterContextoLocal = () => null }) {
  return async (operacao, data = {}) => {
    // Após recarga, Firebase restaura a sessão persistida de forma assíncrona.
    // Ausência transitória nessa fase não significa que o operador saiu.
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    const usuario = auth.currentUser;
    const contextoLocal = obterContextoLocal();
    const uid = usuario?.uid;
    const conferir = () => {
      if (!uid || auth.currentUser !== usuario || auth.currentUser?.uid !== uid || obterContextoLocal() !== contextoLocal) {
        const erro = new Error('A sessão mudou. Confira o acesso e retome a operação pendente.');
        erro.code = 'flowpdv/sessao-alterada';
        throw erro;
      }
      exigirOperacao(operacao, data);
    };
    conferir();
    const resultado = await executar(operacao, data);
    conferir();
    return resultado;
  };
}
