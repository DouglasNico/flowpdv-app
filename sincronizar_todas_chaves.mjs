import { db, doc, setDoc, getDoc } from './src/js/firebase-config.js';

const produtosOficiaisCompletos = [
  {
    id: "PRD-HEINEKEN-350",
    codigoBarras: "2000250900931",
    codigoBarrasFardo: "17931",
    nome: "Heineken Lata 350ML",
    categoria: "Cervejas",
    precoCusto: 4.90,
    precoVenda: 6.90,
    estoque: 44,
    estoqueMinimo: 10,
    unidadeFracionada: "Fardo",
    fatorConversao: 12,
    precoFardo: 82.80,
    gradeHabilitada: true,
    controlarEstoque: true
  },
  {
    id: "PRD-CHOPP-1L",
    codigoBarras: "705GH0SW019",
    nome: "Chopp Teste 1L",
    categoria: "Destilados",
    precoCusto: 35.00,
    precoVenda: 59.90,
    estoque: 29,
    estoqueMinimo: 5,
    gradeHabilitada: false,
    controlarEstoque: true
  },
  {
    id: "PRD-CARVAO-5KG",
    codigoBarras: "10",
    nome: "Carvão 5kg",
    categoria: "Gelo & Carvão",
    precoCusto: 9.90,
    precoVenda: 25.00,
    estoque: 10,
    estoqueMinimo: 5,
    gradeHabilitada: false,
    controlarEstoque: true
  },
  {
    id: "PRD-GELO-5KG",
    codigoBarras: "15",
    nome: "Gelo em Cubo 5KG",
    categoria: "Gelo & Carvão",
    precoCusto: 5.90,
    precoVenda: 14.90,
    estoque: 25,
    estoqueMinimo: 5,
    gradeHabilitada: false,
    controlarEstoque: true
  },
  {
    id: "PRD-COCA-350",
    codigoBarras: "195949121371",
    nome: "Coca Cola - Lata 350ml",
    categoria: "Não Alcoólicos",
    precoCusto: 2.90,
    precoVenda: 3.50,
    estoque: 48,
    estoqueMinimo: 10,
    gradeHabilitada: false,
    controlarEstoque: true
  },
  {
    id: "PRD-COMBO-REDLABEL",
    codigoBarras: "2000285353893",
    nome: "Combo Whisky Red Label 1L + 6 Red Bull 269ml",
    categoria: "Destilados",
    precoCusto: 130.00,
    precoVenda: 190.00,
    estoque: 5,
    estoqueMinimo: 2,
    gradeHabilitada: false,
    controlarEstoque: true
  },
  {
    id: "PRD-VINHO-750",
    codigoBarras: "Q02G70100036830CHX2511059574",
    nome: "Vinho seco 750ml",
    categoria: "Vinhos",
    precoCusto: 19.90,
    precoVenda: 39.90,
    estoque: 10,
    estoqueMinimo: 5,
    gradeHabilitada: false,
    controlarEstoque: true
  }
];

async function syncNuvem() {
  const chaves = ['LIC-FLOW-884210', 'LIC-FLOW-268008', 'LIC-FLOW-993144'];
  for (const chave of chaves) {
    try {
      const snap = await getDoc(doc(db, "backups_adegas", chave));
      const dadosExistentes = snap.exists() ? snap.data() : {};
      
      const payload = {
        ...dadosExistentes,
        chaveLicenca: chave,
        produtos: produtosOficiaisCompletos,
        produtosExcluidos: [],
        atualizadoEm: new Date().toISOString(),
        dataBackupFormatada: new Date().toLocaleString('pt-BR'),
        motivo: 'restauracao_unificada_oficial',
        origemTerminal: 'RECOVERY_TOOL'
      };
      
      await setDoc(doc(db, "backups_adegas", chave), payload);
      console.log(`✅ [NUVEM] Chave ${chave} atualizada com os 7 produtos oficiais.`);
    } catch(e) {
      console.error(`Erro na chave ${chave}:`, e.message);
    }
  }
}

syncNuvem().then(() => {
  console.log('🎉 SINCRONIZAÇÃO EM NUVEM CONCLUÍDA COM SUCESSO!');
  process.exit(0);
});
