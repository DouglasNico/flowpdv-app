const fs = require('fs');
const pathModule = require('path');
const targetDir = 'C:\\Users\\User\\AppData\\Roaming\\flowpdv\\Local Storage\\leveldb';

const files = fs.readdirSync(targetDir);
console.log('Lendo todos os arquivos leveldb de flowpdv...');

const produtosMap = new Map();

for (const f of files) {
  const full = pathModule.join(targetDir, f);
  if (fs.statSync(full).isFile()) {
    const buf = fs.readFileSync(full);
    const str = buf.toString('latin1');
    
    const regex = /\{[^{}]*?"nome"\s*:\s*"([^"]+)"[^{}]*?\}/g;
    let match;
    while ((match = regex.exec(str)) !== null) {
      try {
        const objStr = match[0].replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        const obj = JSON.parse(objStr);
        if (obj.nome && (obj.precoVenda !== undefined || obj.precoCusto !== undefined || obj.codigoBarras)) {
          const key = obj.codigoBarras || obj.nome;
          produtosMap.set(key, obj);
        }
      } catch(e) {}
    }
  }
}

console.log(`Total de produtos únicos encontrados na varredura bruta: ${produtosMap.size}`);
for (const [k, p] of produtosMap.entries()) {
  console.log(`-> ${p.nome} | EAN: ${p.codigoBarras} | Venda: R$ ${p.precoVenda} | Estoque: ${p.estoque}`);
}
