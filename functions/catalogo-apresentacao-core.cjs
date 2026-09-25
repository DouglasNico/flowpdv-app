function texto(value, max, label) {
  if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`${label}: informe até ${max} caracteres, sem quebras de linha.`);
  return value.trim();
}
function normalizarApresentacao(data, old = {}) {
  const result = {};
  for (const [key, max, label] of [['categoria', 60, 'Categoria'], ['descricao', 300, 'Descrição']]) result[key] = data[key] === undefined ? old[key] || '' : texto(data[key], max, label);
  result.ordem = data.ordem === undefined ? old.ordem || 0 : data.ordem;
  if (!Number.isSafeInteger(result.ordem) || result.ordem < 0 || result.ordem > 9999) throw new Error('Ordem deve ser um inteiro entre 0 e 9999.');
  result.imagemUrl = data.imagemUrl === undefined ? old.imagemUrl || '' : texto(data.imagemUrl, 2048, 'Foto');
  if (result.imagemUrl) {
    let url; try { url = new URL(result.imagemUrl); } catch { throw new Error('Foto deve ser uma URL pública HTTPS do Cloudinary.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || url.search || url.hash || !/^\/[^/]+\/image\/upload\/.+/.test(url.pathname)) throw new Error('Use uma URL pública HTTPS de imagem enviada ao Cloudinary, sem parâmetros ou credenciais.');
    result.imagemUrl = url.href;
  }
  return result;
}
function validarTamanhoCatalogo(catalogo) {
  if (Buffer.byteLength(JSON.stringify(catalogo), 'utf8') > 750000) throw new Error('Catálogo excede o limite do piloto. Reduza produtos, adicionais ou descrições antes de salvar.');
}
module.exports = { normalizarApresentacao, validarTamanhoCatalogo };
