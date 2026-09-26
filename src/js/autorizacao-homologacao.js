// Não persiste uma autorização: cada conexão exige confirmação do servidor.
// O adaptador fornece sessão e observação; este serviço não conhece DOM/Firebase.
export function criarAutorizacaoHomologacao({ ambienteTeste, call, observarLoja, alterar, bloqueioLocal = () => false, exigirAdesaoExplicita = false }) {
  if (ambienteTeste !== true) throw new Error('Disponível somente no teste local.');
  let versao = 0, stop;
  function parar(aviso = 'Consultando autorização para novas vendas.') {
    versao++;
    const anterior = stop; stop = undefined;
    anterior?.();
    alterar(false, aviso);
  }
  function iniciar(lojaId) {
    parar();
    if (typeof lojaId !== 'string' || !lojaId.trim()) return;
    const conexao = versao;
    let consulta = 0;
    stop = observarLoja(lojaId, async ({ fromCache }) => {
      if (conexao !== versao) return;
      const pedido = ++consulta;
      if (bloqueioLocal()) { alterar(false, 'Perfil em recuperação. Conclua a instalação e a conferência antes de operar.'); return; }
      if (fromCache) {
        alterar(false, 'Sem confirmação do servidor. Novas vendas bloqueadas; preserve as pendências.');
        return;
      }
      alterar(false, 'Atualizando autorização para novas vendas.');
      try {
        const acesso = await call('consultarAtivacaoOperacionalV2');
        if (conexao !== versao || pedido !== consulta) return;
        if (bloqueioLocal()) { alterar(false, 'Perfil em recuperação. Conclua a instalação e a conferência antes de operar.'); return; }
        const permitido = acesso.lojaId === lojaId && acesso.papel === 'caixa'
          && (!exigirAdesaoExplicita || acesso.homologacaoHabilitada === true)
          && (acesso.modulos?.balcao === true || (!exigirAdesaoExplicita && acesso.compatibilidadeLegada === true));
        alterar(permitido, permitido
          ? (acesso.compatibilidadeLegada ? 'Loja anterior à ativação: compatibilidade de teste.' : 'Homologação habilitada para novas vendas.')
          : 'Homologação suspensa ou indisponível. Retome pendências pelo pagamento; não repita cobranças.');
      } catch {
        if (conexao === versao && pedido === consulta)
          alterar(false, 'Não foi possível confirmar o acesso. Use Atualizar acesso; preserve as pendências.');
      }
    }, () => {
      if (conexao === versao) parar('Acesso indisponível. Confira a autorização do terminal; preserve as pendências.');
    });
  }
  return { iniciar, parar, desconectar: () => parar('Sem conexão. Novas vendas bloqueadas; preserve as pendências até reconectar.') };
}
