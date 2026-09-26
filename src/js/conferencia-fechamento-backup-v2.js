import { criarBackupHomologacao } from './backup-homologacao.js';
import { validarResumoRestaurante } from './resumo-restaurante-caixa.js';
import { conferirGavetaBackup } from './conferencia-gaveta-backup.js';

const formas = ['dinheiro', 'pix_manual', 'cartao_manual'];
const igual = (a, b) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
function ordenar(value) {
  if (Array.isArray(value)) return value.map(ordenar);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, ordenar(value[k])])) : value;
}

// Conferência somente leitura. Não estima valores legados nem libera o perfil recuperado.
export async function conferirFechamentosBackup({ pacote, contexto, ambienteTeste, call }) {
  criarBackupHomologacao({ storage: null, contexto, ambienteTeste }).validar(pacote);
  const copia = JSON.parse(JSON.stringify(pacote));
  const atual = JSON.parse(copia.dados.adega_turno_atual || 'null');
  const locais = [...(atual ? [atual] : []), ...JSON.parse(copia.dados.adega_turnos_historico || '[]')];
  const chave = t => JSON.stringify([t.id, t.terminalId, t.dataAbertura]);
  if (locais.length > 50 || new Set(locais.map(chave)).size !== locais.length) throw new Error('Histórico excede o limite ou contém turno repetido.');
  async function listar() {
    const r = await call('listarTurnosRecuperacaoV2', {});
    if (r?.versao !== 1 || r.lojaId !== contexto.lojaId || r.terminalUid !== contexto.terminalUid || r.somenteConferencia !== true
      || !Array.isArray(r.turnos) || r.turnos.length > 50 || new Set(r.turnos.map(chave)).size !== r.turnos.length
      || r.turnos.some(t => !t.id || t.terminalId !== contexto.terminalId || !t.dataAbertura || !t.chave || t.terminalUid !== contexto.terminalUid
        || !Number.isSafeInteger(t.revisao) || t.revisao < 1 || !['aberto', 'fechado'].includes(t.status))) throw new Error('Inventário remoto inválido para a conferência de fechamento.');
    return r.turnos;
  }
  const remotos = await listar(), divergencias = [], conferencias = [];
  const apontar = (turno, codigo) => divergencias.push({ turnoId: turno.id, codigo });
  for (const remoto of remotos) if (!locais.some(t => chave(t) === chave(remoto))) apontar(remoto, 'turno_ausente_no_backup');
  for (const local of locais) {
    const remoto = remotos.find(t => chave(t) === chave(local));
    if (!remoto) { apontar(local, 'turno_local_sem_registro_remoto'); continue; }
    const { turno: estado } = await call('consultarTurnoCaixaV2', { turno: local });
    if (!estado || chave(estado) !== chave(remoto) || estado.chave !== remoto.chave || estado.terminalUid !== contexto.terminalUid
      || estado.revisao !== remoto.revisao || estado.status !== remoto.status) throw new Error('Turno mudou ou pertence a outra identidade. Consulte novamente.');
    if (!Number.isSafeInteger(estado.trocoInicialCentavos) || estado.trocoInicialCentavos < 0) throw new Error('Fundo de troco remoto inválido.');
    const result = await call('consultarMovimentosTurnoV2', { turno: local });
    if (result?.turno?.chave !== remoto.chave || result.turno.terminalUid !== contexto.terminalUid || !Array.isArray(result.movimentos) || result.movimentos.length > 500) throw new Error('Movimentos remotos incompletos ou de outra identidade.');
    const totais = Object.fromEntries(formas.map(f => [f, 0])), ids = new Set(); let total = 0;
    for (const m of result.movimentos) {
      const sinal = m.tipo === 'recebimento_manual' ? 1 : m.tipo === 'estorno_manual' ? -1 : 0;
      if (!m.id || ids.has(m.id) || !m.vendaId || !sinal || !Number.isSafeInteger(m.totalCentavos) || sinal * m.totalCentavos < 0
        || !Array.isArray(m.pagamentos) || m.pagamentos.some(p => !formas.includes(p.forma) || !Number.isSafeInteger(p.valorCentavos) || p.valorCentavos <= 0)
        || m.pagamentos.reduce((s, p) => s + p.valorCentavos, 0) !== sinal * m.totalCentavos) throw new Error('Movimento financeiro remoto inconsistente.');
      ids.add(m.id); total += m.totalCentavos;
      for (const p of m.pagamentos) totais[p.forma] += sinal * p.valorCentavos;
    }
    if (![total, ...Object.values(totais)].every(Number.isSafeInteger) || total !== estado.totalCentavos || ids.size !== estado.movimentos
      || formas.some(f => totais[f] !== estado.formas?.[f])) throw new Error('Resumo remoto difere dos movimentos financeiros.');
    if (local.fundoRestauranteCentavos !== undefined && local.fundoRestauranteCentavos !== estado.trocoInicialCentavos) apontar(local, 'fundo_restaurante_divergente');
    if (estado.status === 'fechado') {
      if (![estado.dinheiroEsperadoCentavos, estado.dinheiroContadoCentavos, estado.diferencaCentavos, estado.revisaoConferida].every(Number.isSafeInteger)
        || estado.dinheiroContadoCentavos < 0 || estado.revisaoConferida !== estado.revisao - 1
        || estado.dinheiroEsperadoCentavos !== estado.trocoInicialCentavos + totais.dinheiro
        || estado.diferencaCentavos !== estado.dinheiroContadoCentavos - estado.dinheiroEsperadoCentavos) throw new Error('Contagem de fechamento remoto inconsistente.');
      const snapshot = validarResumoRestaurante(local, await call('obterResumoFechadoTurnoV2', { turno: local }));
      if (snapshot.lojaId !== contexto.lojaId || snapshot.turno.terminalUid !== contexto.terminalUid || snapshot.turno.chave !== remoto.chave
        || snapshot.revisao !== estado.revisao || snapshot.totalCentavos !== total || snapshot.detalhes === undefined
        || snapshot.trocoInicialCentavos !== estado.trocoInicialCentavos || formas.some(f => snapshot.formas[f] !== totais[f])) throw new Error('Resumo encerrado mudou durante a conferência.');
      if (!local.restauranteV2) apontar(local, 'resumo_restaurante_ausente');
      else {
        validarResumoRestaurante(local, local.restauranteV2);
        if (!igual(local.restauranteV2, snapshot)) apontar(local, 'resumo_restaurante_divergente');
      }
    } else if (local.restauranteV2 || local.dataFechamento || local.status === 'fechado') apontar(local, 'fechamento_local_sem_encerramento_remoto');
    conferencias.push({ turnoId: local.id, status: estado.status, revisao: estado.revisao, movimentos: ids.size, totalRestauranteCentavos: total });
  }
  const assinatura = lista => lista.map(t => [chave(t), t.chave, t.status, t.revisao]).sort((a,b) => a[0].localeCompare(b[0]));
  if (!igual(assinatura(remotos), assinatura(await listar()))) throw new Error('Histórico mudou durante a conferência. Consulte novamente.');
  return { escopo: 'movimentos_e_resumos_restaurante', liberacaoOperacional: false, semDivergencias: divergencias.length === 0,
    divergencias, conferencias, gavetas: locais.map(conferirGavetaBackup), limites: ['A aritmética da gaveta usa apenas o backup; sangrias, suprimentos, vendas legadas e dinheiro físico exigem confirmação independente.', 'Contas abertas e pedidos pendentes não estão incluídos nesta conferência.'] };
}
