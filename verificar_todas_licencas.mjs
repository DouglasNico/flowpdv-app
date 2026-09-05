import { db, doc, getDoc, getDocs, collection } from './src/js/firebase-config.js';

async function verificarTodasLicencas() {
  console.log('=== VERIFICANDO TODAS AS LICENCAS E BACKUPS ===');
  
  const licsSnap = await getDocs(collection(db, "licencas"));
  console.log(`Total de licenças em 'licencas': ${licsSnap.size}`);
  licsSnap.forEach(d => {
    const data = d.data();
    console.log(`Licença ID: ${d.id} | Razao: ${data.nome || data.razaoSocial} | Chave: ${data.chaveLicenca} | Terminais:`, data.terminaisAtivos?.length || 0);
  });

  const backupsSnap = await getDocs(collection(db, "backups_adegas"));
  console.log(`\nTotal de backups em 'backups_adegas': ${backupsSnap.size}`);
  backupsSnap.forEach(d => {
    const data = d.data();
    console.log(`Backup ID: ${d.id} | Razao: ${data.razaoSocial} | Qtd Produtos: ${data.produtos?.length || 0} | Qtd Usuarios: ${data.usuarios?.length || 0}`);
    if (data.produtos && data.produtos.length > 0) {
      console.log('  -> Produtos:', data.produtos.map(p => p.nome).join(', '));
    }
  });
}

verificarTodasLicencas().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
