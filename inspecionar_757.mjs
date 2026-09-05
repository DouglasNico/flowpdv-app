import { db, doc, getDocs, collection } from './src/js/firebase-config.js';

async function inspecionar757() {
  const snaps = await getDocs(collection(db, "licencas"));
  snaps.forEach(d => {
    const data = d.data();
    if (d.id.includes('757') || data.chaveLicenca?.includes('757') || data.nome?.includes('757') || data.razaoSocial?.includes('757')) {
      console.log(`Doc ID: "${d.id}" | Chave: "${data.chaveLicenca}" | Nome: "${data.nome || data.razaoSocial}"`);
      console.log('Terminais:', JSON.stringify(data.terminaisAtivos, null, 2));
    }
  });
}

inspecionar757().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
