import { db, doc, getDocs, collection, setDoc, deleteDoc } from './src/js/firebase-config.js';

async function unificarFirestore() {
  console.log('=== UNIFICANDO E SANEANDO TODAS AS LICENÇAS NO FIRESTORE ===');
  const snaps = await getDocs(collection(db, "licencas"));
  
  // Agrupar por chaveLicenca
  const porChave = new Map();
  snaps.forEach(d => {
    const data = d.data();
    const chave = (data.chaveLicenca || d.id).trim().toUpperCase();
    if (!porChave.has(chave)) {
      porChave.set(chave, []);
    }
    porChave.get(chave).push({ docId: d.id, data });
  });

  for (const [chave, docs] of porChave.entries()) {
    console.log(`\nProcessando chave: ${chave} (encontrados ${docs.length} docs: ${docs.map(x => x.docId).join(', ')})`);
    
    // Pegar os terminais do doc mais recente ou preferir CLI- se os terminais estiverem zerados
    let terminaisFinais = [];
    let docMestre = docs[0].data;

    // Se um dos docs foi zerado recentemente (ex: CLI-7147 com 0 terminais), a intenção é 0 terminais!
    const docComMenosTerminais = [...docs].sort((a, b) => (a.data.terminaisAtivos?.length || 0) - (b.data.terminaisAtivos?.length || 0))[0];
    const docMaisRecente = [...docs].sort((a, b) => new Date(b.data.atualizadoEm || 0) - new Date(a.data.atualizadoEm || 0))[0];

    // Se a licença atual é Adega do Douglas (268008), manter os 2 computadores
    if (chave === 'LIC-FLOW-268008') {
      terminaisFinais = [
        {
          id: "TERM-27AVV3-MT3G4JOV",
          hostname: "CLR0AN002012506",
          usuario: "Administrador",
          sistema: "Windows",
          ultimoAcesso: new Date().toISOString()
        },
        {
          id: "TERM-08ZBDJ-MT3GCG0S",
          hostname: "DESKTOP-4EA1D02",
          usuario: "Administrador",
          sistema: "Windows",
          ultimoAcesso: new Date().toISOString()
        }
      ];
    } else {
      // Para qualquer outra empresa de teste onde o PC saiu, garantir 0 terminais
      terminaisFinais = [];
    }

    // Sincronizar todos os docs da mesma chave com os terminais corretos
    for (const d of docs) {
      await setDoc(doc(db, "licencas", d.docId), {
        ...docMestre,
        terminaisAtivos: terminaisFinais,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      console.log(`  -> Sincronizado ${d.docId} com ${terminaisFinais.length} terminal(is)`);
    }
  }

  console.log('\n✅ Unificação e saneamento concluídos com sucesso!');
}

unificarFirestore().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
