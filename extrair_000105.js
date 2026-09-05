const fs = require('fs');
const path = 'D:\\Desenvolvimento\\adega-pdv-gestao\\temp_leveldb_dir\\000105.ldb';

const buf = fs.readFileSync(path);
const str = buf.toString('latin1');

// Procurar todos os arrays JSON
const regex = /\[\{"id":.*?"nome":.*?\}\]/g;
let m;
while ((m = regex.exec(str)) !== null) {
  try {
    const arr = JSON.parse(m[0]);
    console.log(`\n=== ARRAY ENCONTRADO (TAMANHO: ${arr.length}) ===`);
    console.log(JSON.stringify(arr, null, 2));
    if (arr.length >= 7) {
      fs.writeFileSync('D:\\Desenvolvimento\\adega-pdv-gestao\\produtos_completos_originais.json', JSON.stringify(arr, null, 2));
      console.log('✅ SALVO EM produtos_completos_originais.json !');
    }
  } catch(e) {}
}
