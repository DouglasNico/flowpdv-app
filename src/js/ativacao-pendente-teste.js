export function criarAlteracaoAtivacaoTeste({storage, uid, lojaId, call, uuid, ambienteTeste}) {
  if (ambienteTeste !== true) throw new Error('Disponível somente no teste.');
  const key = `flowpdv_ativacao_pendente:${encodeURIComponent(uid)}:${encodeURIComponent(lojaId)}`;
  function pendente() {
    const raw = storage.getItem(key); if (!raw) return null;
    const record = JSON.parse(raw), p = record.payload;
    if (record.uid !== uid || p?.lojaId !== lojaId || !['habilitada','suspensa'].includes(p.estado)
      || p.ambiente !== 'homologacao' || !Number.isSafeInteger(p.revisaoEsperada) || p.revisaoEsperada < 0
      || typeof p.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.requestId)
      || typeof p.motivo !== 'string' || p.motivo.length < 5 || p.motivo.length > 180 || p.confirmado !== true)
      throw new Error('Registro de ativação inválido. Exige conferência administrativa.');
    return p;
  }
  async function executar(nova) {
    let payload = pendente();
    if (!payload) {
      if (!nova || nova.confirmado !== true) throw new Error('Confirme a alteração.');
      payload = {...nova, lojaId, ambiente:'homologacao', requestId:uuid()};
      storage.setItem(key, JSON.stringify({uid,payload}));
    }
    let result;
    try { result = await call('alterarAtivacaoOperacionalV2', payload); }
    catch (error) {
      if (['functions/failed-precondition','functions/invalid-argument'].includes(error.code)) storage.removeItem(key);
      throw error;
    }
    storage.removeItem(key); return result;
  }
  return {pendente, executar};
}
