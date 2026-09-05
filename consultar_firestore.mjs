import { db, doc, getDoc, getDocs, collection } from './src/js/firebase-config.js';

async function consultarFirestore() {
  console.log('=== CONSULTANDO COLEÇÕES DO FIRESTORE ===');
  try {
    const snaps = await getDocs(collection(db, "backups_adegas"));
    console.log(`Documentos em backups_adegas: ${snaps.size}`);
    snaps.forEach(d => {
      console.log(`\nID: ${d.id}`);
      const data = d.data();
      if (data.produtos) {
        console.log(`- Produtos (${data.produtos.length}):`, data.produtos.map(p => p.nome));
      }
      if (data.atualizadoEm) console.log(`- Atualizado em: ${data.atualizadoEm}`);
    });
  } catch(e) {
    console.log('Erro:', e.message);
  }
}

consultarFirestore();
