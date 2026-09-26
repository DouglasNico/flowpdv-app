// Lista fechada de operações do caixa. Administração, ativação e pareamento
// continuam no acesso de gerente, sem ampliar os privilégios do operador.
export const operacoesPdvV2 = new Set([
  'consultarMeuTerminalV2', 'consultarAtivacaoOperacionalV2',
  'receberPedidoPdvV2', 'fecharAtendimentoV2', 'cancelarPedidoV2', 'estornarVendaV2',
  'abrirTurnoCaixaV2', 'consultarTurnoCaixaV2', 'encerrarTurnoCaixaV2',
  'consultarMovimentosTurnoV2', 'obterResumoFechadoTurnoV2',
  'registrarBaixaVendaLocalV2', 'confirmarGravacaoVendaLocalV2', 'cancelarTentativaVendaLocalV2',
  'estornarVendaLocalV2', 'confirmarEstornoLocalV2', 'avancarPreparoV2', 'listarEntregasCaixaV2',
  'listarPendenciasAtendimentoV2', 'listarTurnosRecuperacaoV2',
  'consultarRecuperacaoLocalV2', 'conferirInventarioCorteV2'
]);
