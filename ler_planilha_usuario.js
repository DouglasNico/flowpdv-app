const xlsx = require('xlsx');
const path = 'C:\\Users\\User\\Downloads\\Estoque_Adega_do_Douglas_20260825.xlsx';

try {
  const wb = xlsx.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log('=== PRODUTOS NA PLANILHA EXCEL DO USUÁRIO ===');
  console.log(`Total de produtos na planilha: ${data.length}`);
  console.log(JSON.stringify(data, null, 2));
} catch(e) {
  console.error('Erro ao ler Excel:', e.message);
}
