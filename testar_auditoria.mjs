import { db, collection, addDoc, getDocs, query, orderBy, limit } from './src/js/firebase-config.js';

async function testarAuditoria() {
  console.log('=== TESTANDO GRAVAÇÃO E LEITURA DE AUDITORIA ===');
  
  // 1. Gravar um log de teste
  const docRef = await addDoc(collection(db, "auditoria_lojas"), {
    chaveLicenca: 'LIC-FLOW-268008',
    razaoSocial: 'Adega do Douglas',
    tipo: 'importacao_planilha',
    descricao: 'Teste automatizado de importação em massa via planilha Excel',
    operador: 'Dono / Gerente',
    terminalId: 'TERM-08ZBDJ-MT3GCG0S',
    detalhes: { totalProdutos: 25 },
    criadoEm: new Date().toISOString(),
    dataHoraFormatada: new Date().toLocaleString('pt-BR')
  });

  console.log(`✅ Log de teste gravado no Firestore com ID: ${docRef.id}`);

  // 2. Consultar logs
  const snaps = await getDocs(collection(db, "auditoria_lojas"));
  console.log(`✅ Total de logs de auditoria encontrados: ${snaps.size}`);
  snaps.forEach(d => {
    const data = d.data();
    console.log(`- [${data.dataHoraFormatada || data.criadoEm}] [${data.razaoSocial}] [${data.tipo}]: ${data.descricao} (Operador: ${data.operador})`);
  });
}

testarAuditoria().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
