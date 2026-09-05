const fs = require('fs');
const pathModule = require('path');
const targetDir = 'D:\\Desenvolvimento\\adega-pdv-gestao\\temp_leveldb_dir';

const files = fs.readdirSync(targetDir);
console.log('Lendo todos os arquivos leveldb copiados...');

const produtosMap = new Map();

for (const f of files) {
  const full = pathModule.join(targetDir, f);
  if (fs.statSync(full).isFile()) {
    try {
      const buf = fs.readFileSync(full);
      const str = buf.toString('latin1');
      
      // 1. Procurar chaves adega_produtos no LevelDB
      // No LevelDB do Chromium, as strings do localStorage são armazenadas com prefixo _http... \x01 ou \x00
      // Vamos procurar por '[' seguido de objetos com 'nome'
      const matches = str.match(/\[\{"id":.*?"nome":.*?\}\]/g);
      if (matches) {
        matches.forEach(m => {
          try {
            const arr = JSON.parse(m);
            console.log(`[JSON ARRAY] Encontrado array com ${arr.length} itens em ${f}`);
            arr.forEach(p => {
              if (p.nome) produtosMap.set(p.codigoBarras || p.id || p.nome, p);
            });
          } catch(e) {}
        });
      }

      // Procurar objetos individuais
      const regexSingle = /\{[^{}]*?"id":"PRD-[^"]*"[^{}]*?\}/g;
      let singleMatch;
      while ((singleMatch = regexSingle.exec(str)) !== null) {
        try {
          const p = JSON.parse(singleMatch[0]);
          if (p.nome) produtosMap.set(p.codigoBarras || p.id || p.nome, p);
        } catch(e) {}
      }

    } catch(e) {}
  }
}

console.log(`\n=== TOTAL DE PRODUTOS RESGATADOS: ${produtosMap.size} ===`);
const listaFinal = Array.from(produtosMap.values());
listaFinal.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.categoria || 'Sem Categoria'}] ${p.nome} | EAN: ${p.codigoBarras} | Preço: R$ ${p.precoVenda} | Estoque: ${p.estoque}`);
});

fs.writeFileSync('D:\\Desenvolvimento\\adega-pdv-gestao\\produtos_recuperados_leveldb.json', JSON.stringify(listaFinal, null, 2));
