import { criarBackupHomologacao } from './backup-homologacao.js';
import { conferirBackupServidor } from './conferencia-backup-v2.js';

// Inventário de turnos e conferência das vendas locais. Não reconstrói fechamento nem sangrias legadas.
export async function conferirHistoricoBackup({ pacote, contexto, ambienteTeste, call }) {
  criarBackupHomologacao({ storage: null, contexto, ambienteTeste }).validar(pacote);
  const copia = JSON.parse(JSON.stringify(pacote));
  const atual = JSON.parse(copia.dados.adega_turno_atual || 'null'), historico = JSON.parse(copia.dados.adega_turnos_historico || '[]');
  const locais = [...(atual ? [atual] : []), ...historico];
  const chave = t => JSON.stringify([t.id, t.terminalId, t.dataAbertura]);
  if (locais.length > 50 || new Set(locais.map(chave)).size !== locais.length) throw new Error('Histórico excede o limite ou contém turno repetido.');
  async function listar() {
    const result = await call('listarTurnosRecuperacaoV2', {});
    if (result?.versao !== 1 || result.lojaId !== contexto.lojaId || result.terminalUid !== contexto.terminalUid || result.somenteConferencia !== true
      || !Array.isArray(result.turnos) || result.turnos.length > 50 || new Set(result.turnos.map(chave)).size !== result.turnos.length
      || result.turnos.some(t => !t.id || t.terminalId !== contexto.terminalId || !t.dataAbertura || !Number.isSafeInteger(t.revisao)))
      throw new Error('Inventário remoto de turnos incompleto ou de outra identidade.');
    return result.turnos;
  }
  const remotos = await listar(), divergencias = [], conferencias = [];
  for (const t of remotos) if (!locais.some(l => chave(l) === chave(t))) divergencias.push({ codigo: 'turno_ausente_no_backup', turnoId: t.id });
  for (const local of locais) {
    const remoto = remotos.find(t => chave(t) === chave(local));
    if (!remoto) { divergencias.push({ codigo: 'turno_local_sem_registro_remoto', turnoId: local.id }); continue; }
    const porTurno = JSON.parse(JSON.stringify(copia));
    porTurno.dados.adega_turno_atual = JSON.stringify(local);
    if (local !== atual) {
      delete porTurno.dados.flowpdv_venda_servidor_pendente;
      delete porTurno.dados.flowpdv_estorno_local_pendente;
    }
    const r = await conferirBackupServidor({ pacote: porTurno, contexto, ambienteTeste, call });
    if (r.revisaoServidor !== remoto.revisao) throw new Error('Histórico mudou durante a conferência. Consulte novamente.');
    conferencias.push(r);
    divergencias.push(...r.divergencias.map(d => ({ ...d, turnoId: local.id })));
  }
  const assinatura = lista => JSON.stringify(lista.map(t => [chave(t), t.status, t.revisao]).sort((a,b) => a[0].localeCompare(b[0])));
  if (assinatura(await listar()) !== assinatura(remotos)) throw new Error('Histórico mudou durante a conferência. Consulte novamente.');
  return { escopo: 'vendas_locais_por_turno', liberacaoOperacional: false, divergencias, conferencias,
    semDivergencias: divergencias.length === 0, pendencias: conferencias.flatMap(r => r.pendencias.map(p => ({ ...p, turnoId: r.turnoId }))),
    turnosLocais: locais.length, turnosServidor: remotos.length };
}
