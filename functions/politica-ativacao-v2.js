const { HttpsError } = require('firebase-functions/v2/https');

function exigirNovaOperacaoV2(loja) {
  // Compatibilidade temporária para lojas anteriores à adesão. Não autoriza
  // ativação no aplicativo normal; novas lojas são provisionadas suspensas.
  if (!Object.prototype.hasOwnProperty.call(loja, 'ativacaoOperacionalV2')) return;
  const config = loja.ativacaoOperacionalV2;
  if (config?.schema !== 1 || config.estado !== 'habilitada'
    || config.ambiente !== 'homologacao' || !Number.isSafeInteger(config.revisao) || config.revisao < 1)
    throw new HttpsError('failed-precondition', 'Novas operações suspensas. Consulte a gerência; não repita recebimentos já registrados.');
}

module.exports = { exigirNovaOperacaoV2 };
