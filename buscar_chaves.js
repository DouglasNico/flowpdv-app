const fs = require('fs');
const targetDir = 'D:\\Desenvolvimento\\adega-pdv-gestao\\temp_leveldb_dir';
const files = fs.readdirSync(targetDir);

for (const f of files) {
  try {
    const str = fs.readFileSync(targetDir + '\\' + f, 'latin1');
    const matches = str.match(/LIC-FLOW-\d+/g);
    if (matches) {
      console.log(`Chaves em ${f}:`, [...new Set(matches)]);
    }
  } catch(e) {}
}
