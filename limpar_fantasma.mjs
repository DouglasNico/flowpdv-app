import { db, doc, getDoc, setDoc } from './src/js/firebase-config.js';

async function limparTerminalFantasma() {
  console.log('=== LIMPANDO TERMINAL FANTASMA CLR0AN002012506 DA ADEGA DO DOUGLAS ===');
  for (const docId of ['CLI-001', 'LIC-FLOW-268008']) {
    const snap = await getDoc(doc(db, "licencas", docId));
    if (snap.exists()) {
      const data = snap.data();
      const termAtuais = Array.isArray(data.terminaisAtivos) ? data.terminaisAtivos : [];
      const limpos = termAtuais.filter(t => (typeof t === 'string' ? !t.includes('CLR0AN') : t && t.hostname !== 'CLR0AN002012506'));
      await setDoc(doc(db, "licencas", docId), { terminaisAtivos: limpos }, { merge: true });
      console.log(`Doc ${docId}: Terminais passaram de ${termAtuais.length} para ${limpos.length}`);
    }
  }
}

limparTerminalFantasma().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
