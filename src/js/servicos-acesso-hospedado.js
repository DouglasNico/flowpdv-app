import { operacoesPdvV2 } from './operacoes-pdv-v2.js';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInAnonymously, signOut, setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
import { criarAcessoHomologacao } from './acesso-homologacao.js';
import { criarChamadaSessaoV2 } from './chamada-sessao-v2.js';
import { exigirConsultaDuranteRecuperacao } from './bloqueio-recuperacao-perfil.js';

// Configuração pública fixa: não aceita endpoint/projeto vindo de URL ou storage.
const projetoPiloto = Object.freeze({
  apiKey: 'AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg',
  authDomain: 'aplicativo-pdv.firebaseapp.com',
  projectId: 'aplicativo-pdv',
  appId: '1:892832112899:web:ee49b0ea26a76211680936'
});
const appsHospedados = new WeakSet();
const operacoesPiloto = new Set(['consultarMeuTerminalV2', 'emitirPareamentoV2', 'concluirPareamentoV2', 'revogarTerminalV2']);
export function criarServicosAcessoHospedado({ pilotoHospedado, integracaoPdv, operacionalPdv = false, storage, exigirOperador = () => {}, obterContextoLocal = () => null }) {
  if (pilotoHospedado !== true && integracaoPdv !== true) throw new Error('O piloto hospedado exige seleção explícita no aplicativo.');
  if (pilotoHospedado === true && integracaoPdv === true) throw new Error('Escolha um único perfil de conexão.');
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Armazenamento do perfil indisponível.');
  const sessoes = new Map();
  function sessao(papel) {
    if (sessoes.has(papel)) return sessoes.get(papel);
    const name = `flowpdv-${papel}-${integracaoPdv === true ? 'pdv' : 'piloto'}-v2`;
    const existing = getApps().find(app => app.name === name);
    if (existing && (!appsHospedados.has(existing) || existing.options.projectId !== projetoPiloto.projectId || existing.options.apiKey !== projetoPiloto.apiKey)) throw new Error('Sessão incompatível com o piloto hospedado.');
    const app = existing || initializeApp(projetoPiloto, name);
    const auth = getAuth(app), functions = getFunctions(app, 'us-central1'), db = getFirestore(app);
    const result = { auth, db, call: criarChamadaSessaoV2({
      auth, obterContextoLocal,
      exigirOperacao: (operacao, data) => {
        exigirOperador(papel, operacao, data);
        if (papel === 'terminal') exigirConsultaDuranteRecuperacao(storage, operacao);
        const permitida = integracaoPdv === true ? (operacionalPdv && papel === 'terminal' ? operacoesPdvV2.has(operacao) : ['consultarMeuTerminalV2', 'vincularTerminalLicenciadoV2', 'consultarAtivacaoOperacionalV2', 'consultarPreparacaoOperacionalPdvV2', 'confirmarAdesaoOperacionalPdvV2'].includes(operacao)) : operacoesPiloto.has(operacao);
        if (!permitida) throw new Error('Esta etapa do piloto permite apenas o acesso e pareamento do terminal.');
      },
      executar: async (operacao, data) => (await httpsCallable(functions, operacao, { timeout: 12000 })(data)).data
    }) };
    appsHospedados.add(app);
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
    terminal: () => sessao('terminal'), gerencia: () => sessao('gerencia'),
    encerrarGerencia: () => signOut(sessao('gerencia').auth),
    criarAcesso: () => criarAcessoHomologacao({
      pilotoHospedado: true,
      terminal: () => preparar('terminal', browserLocalPersistence),
      gerencia: () => preparar('gerencia', inMemoryPersistence),
      autenticarAnonimo: signInAnonymously, autenticarGerencia: signInWithEmailAndPassword, sairGerencia: signOut
    })
  };
}
