// Journal administrativo. Nunca contém senha, token ou credencial do equipamento.
export function criarRecuperacaoTerminalPendente({ storage, uid, lojaId, getUid, call, uuid, ambienteTeste }) {
  const valido = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  if (ambienteTeste !== true || !valido(uid) || !valido(lojaId)) throw new Error('Recuperação disponível somente na homologação identificada.');
  const key = `flowpdv_recuperacao_terminal_pendente:${uid}:${lojaId}`;
  let ocupado = false;
  const sessao = () => { if (getUid() !== uid) throw new Error('A sessão da gerência mudou. Entre com o responsável pela recuperação.'); };
  function validar(record) {
    const p = record?.payload;
    if (record?.schema !== 1 || record.uid !== uid || !p || p.lojaId !== lojaId
      || !valido(p.origemUid) || !valido(p.destinoUid) || p.origemUid === p.destinoUid
      || !valido(p.requestId) || !valido(record.identidadeOperacionalUid)
      || !Number.isSafeInteger(p.revisaoEsperada) || p.revisaoEsperada < 0 || p.revisaoEsperada >= Number.MAX_SAFE_INTEGER
      || p.confirmado !== true || typeof p.motivo !== 'string' || p.motivo.trim().length < 5 || p.motivo.length > 180)
      throw new Error('Registro de recuperação inválido. Confira com a gerência antes de prosseguir.');
    return record;
  }
  function pendente() {
    sessao(); const raw = storage.getItem(key);
    return raw === null ? null : validar(JSON.parse(raw));
  }
  async function enviar(record) {
    sessao();
    // A cópia enviada não pode alterar o journal usado para conferir o retorno.
    const result = await call('recuperarOperacaoTerminalV2', JSON.parse(JSON.stringify(record.payload)));
    sessao(); const p = record.payload;
    if (!result || result.lojaId !== lojaId || result.origemUid !== p.origemUid || result.destinoUid !== p.destinoUid
      || result.identidadeOperacionalUid !== record.identidadeOperacionalUid || result.revisao !== p.revisaoEsperada + 1
      || result.revogaOrigem !== true || result.copiaCredenciais !== false || result.restauraDadosLocais !== false)
      throw new Error('Resposta de recuperação inconsistente. A tentativa foi preservada para conferência.');
    if (JSON.stringify(pendente()) !== JSON.stringify(record)) throw new Error('O registro local mudou. Confira a recuperação pendente.');
    storage.removeItem(key);
    return result;
  }
  async function exclusivo(action) {
    if (ocupado) throw new Error('Recuperação em andamento. Aguarde a confirmação.');
    ocupado = true;
    try { return await action(); } finally { ocupado = false; }
  }
  return {
    pendente,
    executar: (plano, motivo, confirmado) => exclusivo(async () => {
      if (pendente()) throw new Error('Existe uma recuperação pendente. Retome a tentativa original.');
      if (plano?.lojaId !== lojaId || plano.revogaOrigem !== true || plano.copiaCredenciais !== false || plano.restauraDadosLocais !== false)
        throw new Error('Consulte o plano de recuperação antes de confirmar.');
      const record = validar({ schema: 1, uid, identidadeOperacionalUid: plano.identidadeOperacionalUid,
        payload: { lojaId, origemUid: plano.origemUid, destinoUid: plano.destinoUid, revisaoEsperada: plano.revisao,
          motivo: typeof motivo === 'string' ? motivo.trim() : motivo, confirmado, requestId: uuid() } });
      storage.setItem(key, JSON.stringify(record));
      return enviar(record);
    }),
    retomar: () => exclusivo(async () => {
      const record = pendente();
      if (!record) throw new Error('Nenhuma recuperação pendente para esta gerência e loja.');
      return enviar(record);
    })
  };
}
