/**
 * firebase-config.js - Firestore + Functions (PDV da loja, sem login admin)
 *
 * O caixa nunca pede e-mail/senha. A chave da licença vira uma conta de máquina
 * (`loja_<chave>@pdv.flowpdv.com.br`) e é o e-mail dessa conta que as regras do
 * Firestore usam para isolar uma loja da outra.
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, collection, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, addDoc, query, orderBy, limit, where, startAfter, getCountFromServer, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

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
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const auth = getAuth(app);

export { doc, getDoc, getDocs, collection, onSnapshot, setDoc, updateDoc, deleteDoc, deleteField, addDoc, query, orderBy, limit, where, startAfter, getCountFromServer, writeBatch };

export async function buscarLicencaNuvem({ chave = "", cnpj = "", clienteId = "" } = {}) {
  const fn = httpsCallable(functions, "buscarLicenca");
  const res = await fn({ chave, cnpj, clienteId });
  return res.data || { ok: false, licenca: null };
}

export async function desvincularTerminalNuvem({ deviceId, chaveManter }) {
  const fn = httpsCallable(functions, "desvincularTerminal");
  const res = await fn({ deviceId, chaveManter });
  return res.data || { ok: false };
}

const DOMINIO_LOJA = "pdv.flowpdv.com.br";
const SAL_ACESSO = "flowpdv-2026-acesso-loja";

/** Precisa bater exatamente com o que a regra do Firestore monta. */
export function emailDaLoja(chave) {
  return `loja_${String(chave || "").trim().toLowerCase()}@${DOMINIO_LOJA}`;
}

function senhaDaLoja(chave) {
  return `${String(chave || "").trim().toUpperCase()}.${SAL_ACESSO}`;
}

let lojaAutenticada = "";
let sessaoEmAndamento = null;

export function lojaDaSessao() {
  return lojaAutenticada;
}

/**
 * Garante que este terminal esteja autenticado como a loja informada.
 * Retorna false quando não deu (offline, chave inválida): o chamador segue e a
 * própria regra do Firestore recusa a escrita, sem travar o caixa.
 */
export async function garantirSessaoLoja(chave, opts = {}) {
  const alvo = String(chave || "").trim().toUpperCase();
  if (!alvo) return false;

  if (lojaAutenticada === alvo && auth.currentUser) return true;

  if (sessaoEmAndamento) {
    try {
      await sessaoEmAndamento;
    } catch (e) { /* tratado abaixo */ }
    if (lojaAutenticada === alvo && auth.currentUser) return true;
  }

  sessaoEmAndamento = (async () => {
    const email = emailDaLoja(alvo);
    const senha = senhaDaLoja(alvo);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e) {
      // Primeira ativação desta loja: a conta de máquina ainda não existe.
      const codigo = (e && e.code) || "";
      const podeCriar = codigo === "auth/user-not-found"
        || codigo === "auth/invalid-credential"
        || codigo === "auth/invalid-login-credentials";
      if (!podeCriar) throw e;

      try {
        await createUserWithEmailAndPassword(auth, email, senha);
      } catch (eCriacao) {
        if ((eCriacao && eCriacao.code) !== "auth/email-already-in-use") throw eCriacao;
        await signInWithEmailAndPassword(auth, email, senha);
      }
    }

    lojaAutenticada = alvo;
    return true;
  })();

  try {
    return await sessaoEmAndamento;
  } catch (e) {
    console.warn("[FirebaseLoja] Não foi possível autenticar a loja na nuvem:", e && (e.message || e));
    return false;
  } finally {
    sessaoEmAndamento = null;
  }
}

export async function encerrarSessaoLoja() {
  lojaAutenticada = "";
  try {
    await signOut(auth);
  } catch (e) { /* sessão já encerrada */ }
}
