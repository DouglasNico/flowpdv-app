import { db, doc, getDoc, getDocs, collection } from './src/js/firebase-config.js';

async function checarDocsLicenca() {
  console.log('=== CHECANDO DOCUMENTOS DE LICENCAS ===');
  const snaps = await getDocs(collection(db, "licencas"));
  snaps.forEach(d => {
    const data = d.data();
    if (d.id.includes('268008') || d.id.includes('532215') || d.id === 'CLI-001' || d.id === 'CLI-2215') {
      console.log(`\nDoc ID: "${d.id}"`);
      console.log(`ChaveLicenca: "${data.chaveLicenca}" | Razao: "${data.nome || data.razaoSocial}"`);
      console.log(`Terminais (${data.terminaisAtivos?.length || 0}):`, JSON.stringify(data.terminaisAtivos, null, 2));
    }
  });
}

checarDocsLicenca().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
