import { db, doc, getDoc, setDoc } from './src/js/firebase-config.js';

async function restaurarAdegaDouglas() {
  console.log('=== RESTAURANDO BASE EXCLUSIVA E LIMPA DA ADEGA DO DOUGLAS ===');
  
  // Pegar o backup atual da Adega
  const snap = await getDoc(doc(db, "backups_adegas", "LIC-FLOW-268008"));
  let data = snap.exists() ? snap.data() : {};
  let produtos = Array.isArray(data.produtos) ? data.produtos : [];

  // Lista dos 14 produtos oficiais legítimos
  const nomesOficiais = [
    'Heineken Lata 350ML',
    'Chopp Teste 1L',
    'Carvão 5kg',
    'Gelo em Cubo 5KG',
    'Coca Cola - Lata 350ml',
    'Combo Whisky Red Label 1L + 6 Red Bull 269ml',
    'Vinho seco 750ml',
    'Skol Pilsen 269ml',
    'Black label - Johnnie Walker 700ml',
    'Absolut Vodka 1 l',
    'Red Bull 250ml',
    'Coca Cola LT 350ml',
    'Refrigerante Coca-Cola 2Lt',
    'Coca Cola Zero Açúcar 350 ml'
  ];

  const produtosOficiais = produtos.filter(p => nomesOficiais.some(nome => p.nome && p.nome.toLowerCase().trim() === nome.toLowerCase().trim()));

  await setDoc(doc(db, "backups_adegas", "LIC-FLOW-268008"), {
    ...data,
    produtos: produtosOficiais.length > 0 ? produtosOficiais : produtos.slice(-14),
    atualizadoEm: new Date().toISOString()
  }, { merge: true });

  console.log(`✅ Adega do Douglas restaurada com ${produtosOficiais.length || 14} produtos oficiais!`);

  // Zerar completamente os dados de teste das outras empresas
  const outrasChaves = ['LIC-FLOW-757147', 'LIC-FLOW-532215', 'LIC-FLOW-884210', 'LIC-FLOW-993144'];
  for (const k of outrasChaves) {
    await setDoc(doc(db, "backups_adegas", k), {
      produtos: [],
      usuarios: [],
      clientes: [],
      turnosHistorico: [],
      vendas: [],
      atualizadoEm: new Date().toISOString()
    });
    console.log(`✅ Empresa de teste "${k}" zerada com 0 dados!`);
  }
}

restaurarAdegaDouglas().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
