// Diário do terminal. Não faz chamadas externas e nunca descarta pendências.
export class TefLedger {
  constructor(storage, key) { this.storage = storage; this.key = key; }
  listar() {
    const raw = this.storage.getItem(this.key);
    const lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) throw new Error('Diário TEF inválido. Restaure o diário antes de cobrar.');
    return lista;
  }
  pendentes() { return this.listar().filter(t => !['concluida', 'cancelada', 'recusada'].includes(t.estado)); }
  obter(id) { return this.listar().find(t => t.id === id); }
  salvar(op) {
    const lista = this.listar();
    const i = lista.findIndex(t => t.id === op.id);
    const registro = { ...(i < 0 ? {} : lista[i]), ...op, atualizadoEm: new Date().toISOString() };
    if (i < 0) lista.push(registro); else lista[i] = registro;
    this.storage.setItem(this.key, JSON.stringify(lista)); // Falha de disco interrompe antes da cobrança.
    return registro;
  }
}

export function validarConfigIntegracao(cfg) {
  if (!cfg || !cfg.habilitado) return '';
  if (cfg.provedor === 'stone') {
    if (!cfg.stoneSecretKey || !cfg.stoneSerial) return 'Informe a chave Stone e o serial da maquininha.';
    return '';
  }
  if (cfg.provedor === 'sitef') {
    if (!cfg.sitefCaminhoDll || !cfg.sitefIp || !/^\d{8}$/.test(cfg.sitefLoja || '') || !/^[A-Z]{2}\d{6}$/.test(cfg.sitefTerminal || '')) {
      return 'Confira DLL, servidor, loja de 8 dígitos e terminal SiTef (ex.: FP000001).';
    }
    return '';
  }
  return 'Escolha Stone ou SiTef para integrar. O simulador não registra pagamentos de vendas.';
}

export function valorTefConfere(esperado, recebido) {
  return Number.isFinite(Number(recebido)) && Number(recebido) > 0
    && Math.round(Number(esperado) * 100) === Math.round(Number(recebido) * 100);
}
