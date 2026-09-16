/**
 * Papel deste computador: caixa (padrão) ou atendimento (mesas/comandas).
 * Default ausente = caixa. "completo" antigo vira caixa.
 */

export function normalizarTipoTerminal(valor) {
  const v = String(valor || '').trim().toLowerCase();
  if (v === 'atendimento' || v === 'comanda') return 'atendimento';
  return 'caixa';
}

export function tipoTerminalDe(obj) {
  if (!obj || obj.tipoTerminal == null || String(obj.tipoTerminal).trim() === '') return null;
  return normalizarTipoTerminal(obj.tipoTerminal);
}

/** Junta heartbeat/ativação sem apagar tipoTerminal já gravado.
 *  Heartbeat: o valor da nuvem vence. Gravação explícita: passar forcarTipoTerminal. */
export function mesclarDadosTerminal(existente, info, opcoes) {
  const base = existente && typeof existente === 'object' ? existente : {};
  const dados = info && typeof info === 'object' ? info : {};
  const forcar = !!(opcoes && opcoes.forcarTipoTerminal);
  const tipo = forcar
    ? (tipoTerminalDe(dados) || tipoTerminalDe(base) || 'caixa')
    : (tipoTerminalDe(base) || tipoTerminalDe(dados) || 'caixa');
  return {
    ...base,
    ...dados,
    id: dados.id || base.id,
    tipoTerminal: tipo
  };
}

export function idComandaPorNumero(modo, numero, tipoEscolhido) {
  const n = parseInt(String(numero == null ? '' : numero).replace(/\D/g, ''), 10);
  if (!n || n < 1) return null;
  const modoNorm = String(modo || 'mesas_e_comandas');
  if (modoNorm === 'desativado') return null;

  let tipo = tipoEscolhido;
  if (modoNorm === 'apenas_mesas') tipo = 'mesa';
  if (modoNorm === 'apenas_comandas') tipo = 'comanda';
  if (tipo !== 'mesa' && tipo !== 'comanda') {
    tipo = modoNorm === 'apenas_mesas' ? 'mesa' : 'comanda';
  }
  return (tipo === 'mesa' ? 'MESA-' : 'CMD-') + n;
}

export function nomeComandaPorId(id, numero) {
  const n = parseInt(numero, 10) || parseInt(String(id || '').replace(/\D/g, ''), 10) || 0;
  const pad = String(n).padStart(2, '0');
  if (String(id || '').indexOf('MESA-') === 0) return 'Mesa ' + pad;
  return 'Comanda #' + pad;
}
