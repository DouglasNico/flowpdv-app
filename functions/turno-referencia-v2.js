const { createHash } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
// Referência declarada pelo PDV local. Não substitui abertura/fechamento de turno no servidor.
function referenciaTurno(value, uid) {
  if (value == null) return null;
  if (typeof value !== 'object' || typeof value.id !== 'string' || typeof value.terminalId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id || '') || !/^[A-Za-z0-9_-]{1,100}$/.test(value.terminalId || '') || typeof value.dataAbertura !== 'string' || !Number.isFinite(Date.parse(value.dataAbertura))) {
    throw new HttpsError('invalid-argument', 'Referência de turno inválida. Confira o caixa aberto.');
  }
  const dataAbertura = new Date(value.dataAbertura).toISOString();
  return { id: value.id, terminalId: value.terminalId, dataAbertura, terminalUid: uid,
    chave: createHash('sha256').update(JSON.stringify([uid, value.terminalId, value.id, dataAbertura])).digest('hex') };
}
module.exports = { referenciaTurno };
