export function perfilEmRecuperacao(storage) {
  return !!storage && ['flowpdv_fechamento_recuperado_pendente', 'flowpdv_instalacao_perfil_pendente', 'flowpdv_recuperacao_operacao_bloqueada'].some(k => storage.getItem(k) !== null);
}
export function exigirConsultaDuranteRecuperacao(storage, operacao) {
  if (perfilEmRecuperacao(storage) && ![
    'consultarMeuTerminalV2', 'consultarAtivacaoOperacionalV2', 'consultarConfiguracaoV2',
    'consultarTurnoCaixaV2', 'consultarMovimentosTurnoV2', 'obterResumoFechadoTurnoV2',
    'consultarRecuperacaoLocalV2', 'conferirInventarioCorteV2', 'listarTurnosRecuperacaoV2', 'listarPendenciasAtendimentoV2', 'conferirPendenciasRecuperacaoV2', 'consultarPagamentoAtendimentoV2'
  ].includes(operacao)) throw new Error('Perfil em recuperação. Conclua a instalação e a conferência antes de operar.');
}
