import { StorageService } from './storage.js';
import { vendaPertenceAoTurno } from './merge-core.js';

export function turnoLocalAberto() {
  const turno = StorageService.getTurnoAtual();
  if (!turno || turno.dataFechamento || turno.terminalId !== StorageService.getDeviceId()) throw new Error('Abra um turno neste terminal antes de registrar o pagamento ou estorno.');
  return { id: turno.id, terminalId: turno.terminalId, dataAbertura: turno.dataAbertura };
}
// Somente leitura: não chama saveVenda, não altera produtos ou backups.
export function resumoConciliacao(turno, vendas, movimentos, estornosLocais=0) {
  if(!Number.isSafeInteger(estornosLocais)||estornosLocais<0)throw new Error('Estornos locais inválidos.');
  const cents = value => { const n = Math.round(Number(value) * 100); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Valor local inválido. Confira o histórico do caixa.'); return n; };
  const selected = vendas.filter(v => vendaPertenceAoTurno(v, turno));
  const ids = new Set(); let legado = 0;
  for (const sale of selected) {
    if (!sale.id || ids.has(sale.id)) throw new Error('Histórico local com venda sem ID ou repetida. Confira antes de consolidar.');
    if (sale.origem === 'restaurante_v2' || sale.vendaV2Id) throw new Error('Histórico local já contém importação V2. Confira para evitar duplicação.');
    if (sale.terminalId && sale.terminalId !== turno.terminalId) throw new Error('Venda de outro terminal no turno selecionado. Confira o histórico.');
    if (sale.status && !['concluida', 'finalizada'].includes(sale.status)) throw new Error('Histórico local contém situação que precisa de conciliação manual.');
    ids.add(sale.id); legado += cents(sale.total);
  }
  let recebimentos = 0, estornos = 0; const formas = {};
  const movementIds = new Set();
  for (const m of movimentos) {
    if (!m.id || movementIds.has(m.id)) throw new Error('Movimento V2 repetido. Atualize a conferência.');
    movementIds.add(m.id);
    if (!Number.isSafeInteger(m.totalCentavos) || !['recebimento_manual', 'estorno_manual'].includes(m.tipo)) throw new Error('Movimento V2 inválido.');
    const sign = m.tipo === 'estorno_manual' ? -1 : 1;
    if (sign * m.totalCentavos < 0 || !Array.isArray(m.pagamentos) || m.pagamentos.reduce((s,p) => s + p.valorCentavos, 0) !== Math.abs(m.totalCentavos)) throw new Error('Movimento sem detalhamento financeiro válido.');
    if (sign > 0) recebimentos += m.totalCentavos; else estornos -= m.totalCentavos;
    for (const p of m.pagamentos) {
      if (!['dinheiro', 'pix_manual', 'cartao_manual'].includes(p.forma) || !Number.isSafeInteger(p.valorCentavos) || p.valorCentavos <= 0) throw new Error('Forma de pagamento inválida.');
      formas[p.forma] = (formas[p.forma] || 0) + sign * p.valorCentavos;
    }
  }
  const total = legado + recebimentos - estornos - estornosLocais;
  if (![legado, recebimentos, estornos, total, ...Object.values(formas)].every(Number.isSafeInteger)) throw new Error('Totais excedem o limite permitido.');
  return { legado, recebimentos, estornos, estornosLocais, restaurante: recebimentos-estornos, total, formas, vendasLocais: selected.length, movimentos: movimentos.length };
}
