import { db, doc, setDoc, deleteDoc } from './src/js/firebase-config.js';

async function resetarBackupsTeste() {
  console.log('=== LIMPANDO BACKUPS DE TESTE CONTAMINADOS NO FIRESTORE ===');
  
  const chavesParaZerar = [
    'LIC-FLOW-884210',
    'LIC-FLOW-993144',
    'LIC-FLOW-532215',
    'LIC-FLOW-532216'
  ];

  for (const chave of chavesParaZerar) {
    try {
      console.log(`Resetando dados de: ${chave}...`);
      // Deletar o backup anterior para que a empresa comece com base limpa
      await deleteDoc(doc(db, "backups_adegas", chave));
      console.log(`✅ Backup da chave ${chave} zerado com sucesso!`);
    } catch(e) {
      console.error(`❌ Erro ao zerar ${chave}:`, e);
    }
  }

  console.log('\n✨ Concluído! Agora as licenças secundárias estão 100% zeradas (sem produtos nem operadores da Adega).');
}

resetarBackupsTeste().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
