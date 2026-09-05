const xlsx = require('xlsx');
const fs = require('fs');

const path = 'C:\\Users\\User\\Downloads\\Estoque_Adega_do_Douglas_20260825.xlsx';
const wb = xlsx.readFile(path);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rawRows = xlsx.utils.sheet_to_json(sheet);

console.log('Linhas brutas da planilha:', rawRows.length);

const produtosRestaurados = [];

// Linhas a partir do índice 2 até a penúltima
for (let i = 2; i < rawRows.length - 1; i++) {
  const row = rawRows[i];
  const ean = String(row['__EMPTY'] || '').trim();
  const nome = String(row['__EMPTY_1'] || '').trim();
  const categoria = String(row['__EMPTY_2'] || 'Geral').trim();
  const precoCusto = parseFloat(row['__EMPTY_3']) || 0;
  const precoVenda = parseFloat(row['__EMPTY_4']) || 0;
  const estoque = parseInt(row['__EMPTY_5'], 10) || 0;

  if (nome) {
    produtosRestaurados.push({
      id: 'PRD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      codigoBarras: ean,
      nome,
      categoria,
      precoCusto,
      precoVenda,
      estoque,
      estoqueMinimo: 5,
      controlarEstoque: true,
      gradeHabilitada: false
    });
  }
}

// Adicionar produtos adicionais se houver
console.log('=== PRODUTOS EXTRAÍDOS DA PLANILHA ORIGINAL DO USUÁRIO ===');
console.log(JSON.stringify(produtosRestaurados, null, 2));

fs.writeFileSync('D:\\Desenvolvimento\\adega-pdv-gestao\\produtos_para_restaurar.json', JSON.stringify(produtosRestaurados, null, 2));
