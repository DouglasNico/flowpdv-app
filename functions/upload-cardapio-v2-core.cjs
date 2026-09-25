const { createHash, randomUUID } = require('node:crypto');
function assinaturaUploadV2({ lojaId, produtoId, cloudName, apiKey, secret, timestamp = Math.floor(Date.now() / 1000), nonce = randomUUID() }) {
  if (![lojaId, produtoId, nonce].every(v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v))) throw Error('Identificação de upload inválida.');
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName || '') || !/^\d+$/.test(apiKey || '') || !secret) throw Error('Upload V2 não configurado no servidor.');
  const publicId = `flowpdv-v2/${lojaId}/${produtoId}/${nonce}`;
  const params = { overwrite: 'false', public_id: publicId, timestamp };
  const serialized = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return { cloudName, apiKey, publicId, timestamp, signature: createHash('sha1').update(serialized + secret).digest('hex') };
}
module.exports = { assinaturaUploadV2 };
