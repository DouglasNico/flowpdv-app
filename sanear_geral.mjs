import { db, doc, getDocs, collection, setDoc } from './src/js/firebase-config.js';

async function sanearGeral() {
  console.log('=== SANEANDO TODAS AS LICENÇAS NO FIRESTORE ===');
  const snaps = await getDocs(collection(db, "licencas"));
  
  // Computador atual: TERM-08ZBDJ-MT3GCG0S (DESKTOP-4EA1D02)
  // Notebook: TERM-27AVV3-MT3G4JOV (CLR0AN002012506)
  // Marcelo-Cruz: TERM-ZU6PK4-MTALPYV8 (Marcelo-Cruz)
  
  const myDevId = 'TERM-08ZBDJ-MT3GCG0S';
  const notebookId = 'TERM-27AVV3-MT3G4JOV';

  for (const d of snaps.docs) {
    const data = d.data();
    const chave = (data.chaveLicenca || d.id).trim().toUpperCase();
    let terminais = data.terminaisAtivos || [];
    
    // Desduplicar
    const mapa = new Map();
    terminais.forEach(t => {
      if (!t) return;
      const id = typeof t === 'string' ? t.trim() : (t.id ? String(t.id).trim() : '');
      if (id) {
        const obj = typeof t === 'string' ? { id, hostname: 'Computador', ultimoAcesso: new Date().toISOString() } : t;
        mapa.set(id, obj);
      }
    });
    let unicos = Array.from(mapa.values());

    if (chave === 'LIC-FLOW-268008') {
      // Manter os 2 computadores legítimos na Adega do Douglas (Notebook + DESKTOP)
      unicos = unicos.filter(u => u.id === myDevId || u.id === notebookId);
      if (!unicos.some(u => u.id === myDevId)) {
        unicos.push({ id: myDevId, hostname: 'DESKTOP-4EA1D02', usuario: 'Dono / Gerente', sistema: 'Windows', ultimoAcesso: new Date().toISOString() });
      }
      if (!unicos.some(u => u.id === notebookId)) {
        unicos.push({ id: notebookId, hostname: 'CLR0AN002012506', usuario: 'Administrador', sistema: 'Windows', ultimoAcesso: new Date().toISOString() });
      }
    } else {
      // Qualquer outra empresa: remover o seu computador atual
      unicos = unicos.filter(u => u.id !== myDevId);
    }

    await setDoc(doc(db, "licencas", d.id), {
      terminaisAtivos: unicos,
      atualizadoEm: new Date().toISOString()
    }, { merge: true });

    console.log(`Licença "${d.id}" (${chave}): ${unicos.length} terminal(is) ->`, unicos.map(u => `${u.hostname} (${u.id})`));
  }
  console.log('\n✅ Firestore 100% limpo e atualizado!');
}

sanearGeral().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
