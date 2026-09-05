import { db, doc, getDocs, collection, setDoc } from './src/js/firebase-config.js';

async function sanearTerminais() {
  console.log('=== SANEANDO TERMINAIS ATIVOS DAS LICENÇAS ===');
  const snaps = await getDocs(collection(db, "licencas"));
  for (const d of snaps.docs) {
    const data = d.data();
    let term = Array.isArray(data.terminaisAtivos) ? data.terminaisAtivos : [];
    
    // Desduplicar terminais pelo ID
    const mapa = new Map();
    term.forEach(t => {
      if (typeof t === 'string' && t.trim()) {
        mapa.set(t.trim(), { id: t.trim(), hostname: 'Computador PDV', atualizadoEm: new Date().toISOString() });
      } else if (t && t.id) {
        mapa.set(t.id, t);
      }
    });

    const limpos = Array.from(mapa.values()).slice(0, data.limiteTerminais || 1);
    await setDoc(doc(db, "licencas", d.id), { terminaisAtivos: limpos }, { merge: true });
    console.log(`Licença ${d.id}: Terminais reduzidos de ${term.length} para ${limpos.length}`);
  }
}

sanearTerminais().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
