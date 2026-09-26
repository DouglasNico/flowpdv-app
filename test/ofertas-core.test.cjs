const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const local = path.resolve(__dirname, '../src/js/ofertas-core.js');
const web = path.resolve(__dirname, '../../../flowpdv-cardapio/shared/ofertas.js');
test('PDV e cardápio usam o mesmo contrato de preços e composição', async () => {
  assert.equal(fs.readFileSync(local,'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(web,'utf8').replace(/\r\n/g,'\n'));
  assert.equal(fs.readFileSync(local,'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.resolve(__dirname, '../functions/ofertas-core.mjs'),'utf8').replace(/\r\n/g,'\n'));
  const {normalizarOferta}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(local,'utf8')).toString('base64'));
  assert.throws(()=>normalizarOferta({precoPromocional:25},20));
  const p=normalizarOferta({precoPromocional:16.9,combo:{ativo:true,preco:30.9,precoPromocional:27.9,fixos:[{produtoId:'batata',quantidade:1}],bebidas:['coca']}},18.9);
  assert.equal(p.combo.preco,30.9);assert.equal(p.precoPromocional,16.9);
  assert.deepEqual(p.combo.fixos,[{produtoId:'batata',quantidade:1}]);
});
