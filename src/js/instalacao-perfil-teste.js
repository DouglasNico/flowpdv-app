import { criarBackupHomologacao } from './backup-homologacao.js';
import { ensaiarRestauracaoTerminal } from './restauracao-terminal-teste.js';

// Aplicação restrita a perfil novo: preserva autenticação externa ao arquivo e
// registra bloqueio antes de escrever dados. Não habilita vendas após instalação.
export function criarInstalacaoPerfilTeste({ storage, sessao, ambienteTeste, perfilNomeado }) {
  if (ambienteTeste !== true || perfilNomeado !== true) throw new Error('Use um perfil de teste novo e nomeado.');
  const journal = 'flowpdv_instalacao_perfil_pendente', bloqueio = 'flowpdv_recuperacao_operacao_bloqueada';
  const chaves = () => Array.from({ length: storage.length }, (_,i) => storage.key(i));
  // Essa chave pertence ao SDK do terminal atual: nunca copiar seu valor ao journal.
  const credencialLocal = k => k === 'firebase:authUser:demo-flowpdv-key:flowpdv-terminal-teste-v2';
  const capturar = () => Object.fromEntries(chaves().filter(k => !credencialLocal(k)).map(k => [k, storage.getItem(k)]));
  function perfilNovo(dados) {
    const defaults = { nomeLoja: '', cnpj: '', endereco: '', telefone: '', chavePix: '', impressoraPadrao: '58mm', autoImprimirCupom: true, habilitarModuloFiado: true };
    try {
      return Object.entries(dados).every(([k,v]) => {
        if (k === 'flowpdv_device_id') return typeof v === 'string' && !!v;
        if (k === 'adega_clientes') return Array.isArray(JSON.parse(v)) && JSON.parse(v).length === 0;
        if (k !== 'adega_config') return false;
        const c = JSON.parse(v);
        return c && Object.keys(defaults).every(f => c[f] === defaults[f])
          && Object.keys(c).every(f => Object.hasOwn(defaults,f) || (f === 'atualizadoEm' && typeof c[f] === 'string' && Number.isFinite(Date.parse(c[f]))));
      });
    } catch { return false; }
  }
  let ocupado = false;
  const uid = () => sessao.auth.currentUser?.uid;
  async function exclusivo(action) {
    if (ocupado) throw new Error('Instalação em andamento. Aguarde.');
    ocupado = true; try { return await action(); } finally { ocupado = false; }
  }
  async function aplicar() {
    const raw = storage.getItem(journal);
    if (!raw) throw new Error('Nenhuma instalação pendente neste perfil.');
    const p = JSON.parse(raw);
    if (p?.schema !== 1 || !p.uid || uid() !== p.uid || !p.antes || !perfilNovo(p.antes)) throw new Error('Registro de instalação ou identidade inválido.');
    criarBackupHomologacao({ storage: null, contexto: p.contexto, ambienteTeste }).validar(p.pacote);
    const b = await sessao.call('consultarMeuTerminalV2', {});
    if (uid() !== p.uid || b?.vinculado !== true || b.papel !== 'caixa' || b.lojaId !== p.contexto.lojaId || (b.identidadeOperacionalUid || p.uid) !== p.contexto.terminalUid) throw new Error('A autorização da instalação mudou.');
    if (storage.getItem(journal) !== raw) throw new Error('O registro de instalação mudou. Preserve o perfil para conferência.');
    const marca = JSON.stringify({ schema: 1, lojaId: p.contexto.lojaId, terminalUid: p.contexto.terminalUid, autenticadoUid: p.uid, motivo: 'recuperacao_exige_conferencia' });
    for (const k of chaves()) {
      if (k === journal || credencialLocal(k)) continue;
      const value = storage.getItem(k);
      if (k === bloqueio && value === marca) continue;
      if ((Object.hasOwn(p.antes,k) && value === p.antes[k]) || (Object.hasOwn(p.pacote.dados,k) && value === p.pacote.dados[k])) continue;
      throw new Error('O perfil recebeu dados durante a instalação. Nenhum conteúdo será sobrescrito.');
    }
    storage.setItem(bloqueio, marca);
    for (const [k,v] of Object.entries(p.pacote.dados)) storage.setItem(k,v);
    storage.removeItem(journal);
    return { instalado: true, exigeReinicio: true, liberacaoOperacional: false };
  }
  return {
    pendente: () => storage.getItem(journal) !== null,
    retomar: () => exclusivo(aplicar),
    instalar: (pacote, reconstruirConfirmadas = false) => exclusivo(async () => {
      if (!uid()) throw new Error('Autentique o novo terminal primeiro.');
      if (!perfilNovo(capturar())) throw new Error('Perfil possui dados. Use um perfil novo, sem copiar credenciais ou apagar o existente.');
      const antes = capturar(), autenticadoUid = uid(), map = new Map();
      const vazio = { get length() { return map.size; }, key: i => [...map.keys()][i], getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) };
      const resultado = await ensaiarRestauracaoTerminal({ pacote, sessao, storageDestino: vazio, ambienteTeste, destinoIsolado: true, reconstruirConfirmadas });
      if (uid() !== autenticadoUid || JSON.stringify(capturar()) !== JSON.stringify(antes)) throw new Error('A sessão ou o perfil mudou durante a conferência.');
      const conferido = criarBackupHomologacao({ storage: vazio, contexto: resultado.contexto, ambienteTeste }).exportar();
      storage.setItem(journal, JSON.stringify({ schema: 1, uid: autenticadoUid, contexto: resultado.contexto, antes, pacote: conferido }));
      return aplicar();
    })
  };
}
