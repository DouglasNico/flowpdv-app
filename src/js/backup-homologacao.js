// Ensaio isolado de recuperação. Não é importador de produção nem transfere login.
const CHAVES = [
  'flowpdv_device_id', 'adega_produtos', 'adega_produtos_backup_seguranca',
  'adega_vendas', 'adega_turno_atual', 'adega_turnos_historico', 'adega_clientes',
  'flowpdv_estoque_movimentos', 'flowpdv_ultimo_numero_venda',
  'flowpdv_pagamento_atendimento_pendente','flowpdv_migracoes_estoque_teste', 'flowpdv_venda_servidor_pendente', 'flowpdv_estorno_local_pendente'
];
const DIARIO = 'flowpdv_restauracao_v2_pendente';
const rascunho = 'flowpdv_rascunho_carrinho_v1:';
const chaves = storage => Array.from({ length: storage.length }, (_, i) => storage.key(i));
const permitida = key => CHAVES.includes(key) || key.startsWith(rascunho);
const erro = texto => { throw new Error(texto); };

export function criarBackupHomologacao({ storage, ambienteTeste, destinoIsolado = false, contexto, duranteFechamentoRecuperado = false }) {
  if (ambienteTeste !== true) erro('Disponível somente no teste local.');
  if (!contexto || ['lojaId', 'terminalId', 'terminalUid'].some(k => typeof contexto[k] !== 'string' || !contexto[k] || contexto[k].length > 180)) erro('Confirme a identidade original da recuperação.');
  // Copiado para que o chamador não altere a identidade durante o ensaio.
  const origem = { lojaId: contexto.lojaId, terminalId: contexto.terminalId, terminalUid: contexto.terminalUid };
  function validar(pacote) {
    if (!pacote || pacote.tipo !== 'flowpdv_homologacao_v2' || pacote.versao !== 1
      || Object.keys(origem).some(k => pacote.origem?.[k] !== origem[k])
      || !pacote.dados || typeof pacote.dados !== 'object' || Array.isArray(pacote.dados)) erro('Backup incompatível com a loja ou identidade original.');
    if (pacote.dados.flowpdv_device_id !== origem.terminalId) erro('Identificação do terminal divergente.');
    const parsed = {};
    for (const [key, raw] of Object.entries(pacote.dados)) {
      if (!permitida(key) || typeof raw !== 'string') erro('Chave não permitida no backup de homologação.');
      if (key === 'flowpdv_device_id') continue;
      try { parsed[key] = JSON.parse(raw); } catch { erro('Conteúdo ilegível no backup: ' + key); }
      if (key.startsWith(rascunho)) {
        let ref;
        try { ref = JSON.parse(key.slice(rascunho.length)); } catch { erro('Contexto de rascunho inválido.'); }
        if (!Array.isArray(ref) || ref.length !== 4 || ref[0] !== origem.lojaId || ref[1] !== origem.terminalId) erro('Rascunho de outra loja ou terminal.');
      }
    }
    for (const key of ['adega_produtos', 'adega_produtos_backup_seguranca', 'adega_vendas', 'adega_turnos_historico', 'adega_clientes', 'flowpdv_estoque_movimentos', 'flowpdv_migracoes_estoque_teste']) {
      if (Object.hasOwn(parsed, key) && !Array.isArray(parsed[key])) erro('Lista inválida no backup: ' + key);
    }
    const atual = parsed.adega_turno_atual;
    for (const turno of [atual, ...(parsed.adega_turnos_historico || [])].filter(t => t !== null && t !== undefined)) {
      if (!turno.id || turno.terminalId !== origem.terminalId) erro('Turno de outro terminal.');
      if (turno.restauranteV2 && turno.restauranteV2.lojaId !== origem.lojaId) erro('Resumo de outra loja.');
      if ((turno.estornosLocaisV2 || []).some(e => e.lojaId !== origem.lojaId)) erro('Estorno de outra loja.');
    }
    for (const registro of parsed.flowpdv_migracoes_estoque_teste || []) if (registro.lojaId !== origem.lojaId) erro('Migração de outra loja.');
    for (const venda of parsed.adega_vendas || []) if (venda.estoqueServidorV2 && venda.estoqueServidorV2.lojaId !== origem.lojaId) erro('Venda de outra loja.');
    for (const key of ['flowpdv_pagamento_atendimento_pendente','flowpdv_venda_servidor_pendente', 'flowpdv_estorno_local_pendente']) {
      const p = parsed[key]; if (p === undefined || p === null) continue;
      const ref = p.payload?.turno;
      if (p.lojaId !== origem.lojaId || !atual || ref?.id !== atual.id || ref?.terminalId !== origem.terminalId || ref?.dataAbertura !== atual.dataAbertura) erro('Pendência não corresponde ao turno original.');
    }
    return pacote;
  }
  function exportar() {
    if (!duranteFechamentoRecuperado && storage.getItem('flowpdv_fechamento_recuperado_pendente') !== null) erro('Retome o fechamento recuperado antes de capturar outro backup.');
    for (const key of chaves(storage)) {
      if (['flowpdv_commit_venda', 'flowpdv_ciclo_teste_pendente', DIARIO].includes(key)
        || key.startsWith('flowpdv_ativacao_pendente:') || key.startsWith('flowpdv_recuperacao_terminal_pendente:')) erro('Conclua a recuperação local ou administrativa antes de capturar o backup.');
    }
    const dados = Object.fromEntries(chaves(storage).filter(permitida).map(key => [key, storage.getItem(key)]));
    return validar({ tipo: 'flowpdv_homologacao_v2', versao: 1, origem: { ...origem }, dados });
  }
  function recuperar() {
    if (!destinoIsolado) erro('Restauração disponível somente em destino de ensaio isolado.');
    const raw = storage.getItem(DIARIO); if (!raw) return false;
    const pacote = validar(JSON.parse(raw));
    // Após falha de disco, somente ausência ou valor já aplicado é aceitável.
    for (const key of chaves(storage)) {
      if (key === DIARIO) continue;
      if (!Object.hasOwn(pacote.dados, key) || storage.getItem(key) !== pacote.dados[key]) erro('O destino mudou durante a restauração. Preserve os dados para conferência.');
    }
    for (const [key, valor] of Object.entries(pacote.dados)) storage.setItem(key, valor);
    storage.removeItem(DIARIO);
    return true;
  }
  function restaurar(pacote) {
    if (!destinoIsolado) erro('Restauração disponível somente em destino de ensaio isolado.');
    validar(pacote);
    if (storage.length !== 0) erro('Use armazenamento vazio: restauração não sobrescreve vendas ou saldos existentes.');
    storage.setItem(DIARIO, JSON.stringify(pacote));
    return recuperar();
  }
  return { exportar, restaurar, recuperar, validar };
}
