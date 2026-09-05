const fs = require('fs');
const targetDir = 'D:\\Desenvolvimento\\adega-pdv-gestao\\temp_leveldb_dir';
const files = fs.readdirSync(targetDir);

for (const f of files) {
  try {
    const str = fs.readFileSync(targetDir + '\\' + f, 'utf8');
    const match = str.match(/adega_licenca.*?(\{.*?\})/);
    if (match) {
      console.log(`Licenca encontrada em ${f}:`);
      console.log(match[1].slice(0, 300));
    }
  } catch(e) {}
}
