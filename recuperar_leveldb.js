const fs = require('fs');
const path = require('path');

// 1. Procurar em todos os arquivos .ldb e .log do LevelDB
const dirs = [
  'C:\\Users\\User\\AppData\\Roaming\\flowpdv\\Local Storage\\leveldb',
  'C:\\Users\\User\\AppData\\Roaming\\adega-pdv-gestao\\Local Storage\\leveldb',
  'C:\\Users\\User\\AppData\\Roaming\\Electron\\Local Storage\\leveldb'
];

console.log('=== BUSCANDO PRODUTOS NOS ARQUIVOS DE STORAGE LOCAL ===');

for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  const files = fs.readdirSync(d);
  for (const f of files) {
    if (f.endsWith('.ldb') || f.endsWith('.log')) {
      const fullPath = path.join(d, f);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Procurar padrões de adega_produtos
        const match = content.match(/adega_produtos.*?(\[\{.*?\}\])/);
        if (match) {
          console.log(`\nEncontrado em ${fullPath}!`);
          console.log('Tamanho:', match[1].length);
          try {
            const parsed = JSON.parse(match[1]);
            console.log(`✅ Total de produtos recuperados: ${parsed.length}`);
            console.log('Exemplo:', parsed.slice(0, 3));
          } catch(e) {
            console.log('Trecho bruto:', match[1].slice(0, 200));
          }
        }
      } catch(e) {}
    }
  }
}
