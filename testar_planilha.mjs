import ExcelJS from 'exceljs';

async function testarGeracaoModelo() {
  console.log('=== TESTANDO GERADOR DE PLANILHA MODELO EXCEL ===');
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Produtos_Modelo');
  
  const headers = [
    'Código de Barras',
    'Categoria',
    'Nome / Descrição',
    'Preço de Custo',
    'Preço de Venda',
    'Estoque Atual',
    'Estoque Mínimo'
  ];

  ws.addRow(headers);
  ws.addRow(['7891991000826', 'Cervejas', 'Cerveja Skol Lata 350ml', 2.80, 4.50, 48, 12]);
  ws.addRow(['7896045506019', 'Cervejas', 'Cerveja Heineken Long Neck 330ml', 5.20, 8.99, 24, 6]);

  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`✅ Planilha gerada com sucesso! Tamanho: ${buffer.byteLength} bytes.`);

  // Testar leitura de volta
  const readWb = new ExcelJS.Workbook();
  await readWb.xlsx.load(buffer);
  const readWs = readWb.worksheets[0];
  console.log(`✅ Planilha lida com sucesso! Total de linhas: ${readWs.rowCount}`);
  readWs.eachRow((row, rowNumber) => {
    console.log(`Linha ${rowNumber}:`, row.values.slice(1));
  });
}

testarGeracaoModelo().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
