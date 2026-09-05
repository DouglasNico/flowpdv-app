const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg",
  authDomain: "aplicativo-pdv.firebaseapp.com",
  projectId: "aplicativo-pdv",
  storageBucket: "aplicativo-pdv.firebasestorage.app",
  messagingSenderId: "892832112899",
  appId: "1:892832112899:web:ee49b0ea26a76211680936",
  measurementId: "G-9RSWDKL8WP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectFirestore() {
  try {
    const snap = await getDocs(collection(db, "licencas"));
    console.log("TOTAL DE DOCUMENTOS NA COLECAO 'licencas':", snap.size);
    snap.forEach(doc => {
      console.log("-----------------------------------------");
      console.log("DOC ID:", doc.id);
      const data = doc.data();
      console.log("CHAVE LICENCA:", data.chaveLicenca);
      console.log("NOME:", data.nome || data.razaoSocial);
      console.log("DOCUMENTO/CNPJ:", data.documento || data.cnpj);
      console.log("STATUS:", data.status);
      console.log("LOGO URL LENGTH:", (data.logoUrl || '').length);
      console.log("LOGO URL (preview):", (data.logoUrl || '').substring(0, 100));
    });
  } catch (err) {
    console.error("ERRO FIRESTORE:", err);
  }
}

inspectFirestore();