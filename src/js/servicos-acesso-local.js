import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInAnonymously, signOut, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { criarAcessoHomologacao } from './acesso-homologacao.js';
import { criarChamadaSessaoV2 } from './chamada-sessao-v2.js';
import { exigirConsultaDuranteRecuperacao } from './bloqueio-recuperacao-perfil.js';

const appsLocais = new WeakSet();

// Infraestrutura de homologação independente de telas e de window.
// Configuração remota não é aceita implicitamente: este serviço é só local.
export function criarServicosAcessoLocal({ ambienteTeste, storage, exigirOperador = () => {}, obterContextoLocal = () => null }) {
  if (ambienteTeste !== true) throw new Error('Disponível somente no teste local.');
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Armazenamento do perfil indisponível.');
  const sessoes = new Map();
  function sessao(papel) {
    if (sessoes.has(papel)) return sessoes.get(papel);
    const name = `flowpdv-${papel}-teste-v2`;
    const existing = getApps().find(app => app.name === name);
    if (existing && (!appsLocais.has(existing) || existing.options.projectId !== 'demo-flowpdv' || existing.options.apiKey !== 'demo-flowpdv-key')) {
      throw new Error('Configuração de sessão incompatível com a homologação local.');
    }
    const app = existing || initializeApp({ apiKey: 'demo-flowpdv-key', projectId: 'demo-flowpdv', appId: name }, name);
    const auth = getAuth(app), functions = getFunctions(app, 'us-central1'), db = getFirestore(app);
    if (!existing) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      appsLocais.add(app);
    }
    const result = { auth, db, call: criarChamadaSessaoV2({
      auth,
      obterContextoLocal,
      exigirOperacao: (operacao, data) => {
        exigirOperador(papel, operacao, data);
        if (papel === 'terminal') exigirConsultaDuranteRecuperacao(storage, operacao);
      },
      executar: async (operacao, data) => (await httpsCallable(functions, operacao, { timeout: 12000 })(data)).data
    }) };
    sessoes.set(papel, result);
    return result;
  }
  const preparar = async (papel, persistencia) => {
    exigirOperador(papel, 'autenticar');
    const s = sessao(papel);
    await s.auth.authStateReady();
    await setPersistence(s.auth, persistencia);
    return s;
  };
  return {
    terminal: () => sessao('terminal'),
    gerencia: () => sessao('gerencia'),
    encerrarGerencia: () => signOut(sessao('gerencia').auth),
    criarAcesso: () => criarAcessoHomologacao({
      ambienteTeste,
      terminal: () => preparar('terminal', browserLocalPersistence),
      gerencia: () => preparar('gerencia', inMemoryPersistence),
      autenticarAnonimo: signInAnonymously,
      autenticarGerencia: signInWithEmailAndPassword,
      sairGerencia: signOut
    })
  };
}
