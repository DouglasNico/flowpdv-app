import { db, doc, getDoc, getDocs, collection, setDoc } from './src/js/firebase-config.js';

function limparDuplicados(lista) {
  if (!Array.isArray(lista)) return [];
  const mapa = new Map();
  lista.forEach(t => {
    if (!t) return;
    const id = typeof t === 'string' ? t.trim() : (t.id ? String(t.id).trim() : '');
    if (id) {
      const obj = typeof t === 'string' ? { id, hostname: 'Computador', ultimoAcesso: new Date().toISOString() } : t;
      mapa.set(id, obj);
    }
  });
  return Array.from(mapa.values());
}

async function corrigirTerminais() {
  console.log('=== DESDUPLICANDO TERMINAIS NO FIRESTORE ===');
  const snaps = await getDocs(collection(db, "licencas"));
  for (const d of snaps.docs) {
    const data = d.data();
    const term = data.terminaisAtivos || [];
    const unicos = limparDuplicados(term);
    
    // Se a licença da Adega estiver vencida com data antiga, colocar uma data futura (ex: 2026-09-26)
    const updatePayload = { terminaisAtivos: unicos };
    if (d.id === 'CLI-001' || d.id === 'LIC-FLOW-268008') {
      updatePayload.vencimento = '2026-09-26';
      updatePayload.status = 'ativa';
    }

    await setDoc(doc(db, "licencas", d.id), updatePayload, { merge: true });
    console.log(`Doc ${d.id}: Terminais reduzidos de ${term.length} para ${unicos.length}`);
    console.log('  Terminais únicos:', unicos.map(u => `${u.hostname} (${u.id})`));
  }
}

corrigirTerminais().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
