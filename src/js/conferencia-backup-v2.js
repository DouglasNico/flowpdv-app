import { criarBackupHomologacao } from './backup-homologacao.js';
import core from '../../functions/venda-local-core.cjs';

export async function conferirInventarioBackup({ pacote, contexto, ambienteTeste, call }) {
  criarBackupHomologacao({ storage: null, contexto, ambienteTeste }).validar(pacote);
  const registros = JSON.parse(pacote.dados.flowpdv_migracoes_estoque_teste || '[]');
  if (!registros.length || registros.length > 100) throw new Error('Confira entre 1 e 100 produtos migrados por vez.');
  const produtos = registros.map(r => r.produto);
  const result = await call('conferirInventarioCorteV2', { produtos });
  if (result?.versao !== 1 || result.lojaId !== contexto.lojaId || result.terminalUid !== contexto.terminalUid
    || result.somenteConferencia !== true || !Array.isArray(result.produtos)
    || result.produtos.length !== produtos.length
    || new Set(result.produtos.map(p => p.legadoId)).size !== produtos.length
    || result.produtos.some(p => !produtos.some(local => String(local.id) === p.legadoId))) throw new Error('Conferência de estoque incompleta ou de outra identidade.');
  return { ...result, liberacaoOperacional: false };
}

// Diagnóstico somente leitura. Não autoriza importação nem refaz efeitos financeiros.
export async function conferirBackupServidor({ pacote, contexto, ambienteTeste, call, incluirRegistros = false }) {
  criarBackupHomologacao({ storage: null, contexto, ambienteTeste }).validar(pacote);
  const ler = key => JSON.parse(pacote.dados[key] || 'null');
  const turno = ler('adega_turno_atual');
  if (!turno) throw new Error('Esta conferência exige um turno atual; histórico requer conferência própria.');
  const vendas = (ler('adega_vendas') || []).filter(v => v.estoqueServidorV2 && v.turnoId === turno.id && v.terminalId === contexto.terminalId);
  if (new Set(vendas.map(v => v.id)).size !== vendas.length) throw new Error('Backup contém venda repetida no turno. Preserve o arquivo para conferência.');
  const pendente = ler('flowpdv_venda_servidor_pendente'), devolucao = ler('flowpdv_estorno_local_pendente');
  const ajustes = turno.estornosLocaisV2 || [];
  const vendaIds = [...new Set([...vendas.map(v => v.id), ...ajustes.map(e => e.vendaId), pendente?.payload?.vendaId, devolucao?.payload?.vendaId].filter(Boolean))];
  if (vendaIds.length > 50) throw new Error('Backup excede 50 vendas na conferência. Exige paginação.');
  const remoto = await call('consultarRecuperacaoLocalV2', { turno: { id: turno.id, terminalId: turno.terminalId, dataAbertura: turno.dataAbertura }, vendaIds });
  if (remoto?.versao !== 1 || remoto.lojaId !== contexto.lojaId || remoto.terminalUid !== contexto.terminalUid
    || remoto.turno?.id !== turno.id || remoto.turno.terminalId !== turno.terminalId
    || remoto.turno.dataAbertura !== turno.dataAbertura || !Array.isArray(remoto.registros)) throw new Error('Resposta não corresponde à identidade e ao turno do backup.');
  const divergencias = [], pendencias = [], ids = new Set();
  const add = (codigo, vendaId = null) => divergencias.push({ codigo, vendaId });
  const igual = (a, b) => JSON.stringify(core.normalizarVendaLocal(a)) === JSON.stringify(core.normalizarVendaLocal(b));
  for (const registro of remoto.registros) {
    const id = registro.vendaId;
    if (typeof id !== 'string' || ids.has(id)) throw new Error('Conferência remota contém registros inválidos ou repetidos.');
    ids.add(id);
    const local = vendas.find(v => v.id === id), tentativa = pendente?.payload?.vendaId === id ? pendente : null;
    if (local) {
      const payload = { vendaId: id, itens: (local.itens || []).map(i => ({ legadoId: String(i.id), quantidade: String(i.quantidade), precoUnitarioCentavos: Math.round(i.precoUnitario * 100) })),
        totalCentavos: Math.round(local.total * 100), ajuste: local.ajuste, pagamentos: local.pagamentosCentavos,
        recebidoDinheiroCentavos: local.recebidoDinheiroCentavos, trocoCentavos: local.trocoCentavos };
      let confere = false;
      try { confere = registro.recibo?.reciboId === local.estoqueServidorV2.reciboId && registro.recibo.turno?.chave === remoto.turno.chave && igual(payload, registro.recibo.venda); } catch {}
      if (!confere) add('venda_divergente', id);
      if (registro.status === 'cancelado' || registro.status === 'ausente') add('venda_local_sem_confirmacao_remota', id);
    } else if (registro.status !== 'ausente' && registro.status !== 'cancelado' && !tentativa
      && registro.recibo?.turno?.chave === remoto.turno.chave) add('venda_ausente_no_backup', id);
    if (tentativa) {
      let confere = registro.status === 'ausente';
      try { if (registro.recibo) confere = registro.recibo.turno?.chave === remoto.turno.chave && igual(tentativa.payload, registro.recibo.venda); } catch {}
      // Cancelamento antes da baixa possui marcador, mas não recibo de estoque.
      if (registro.status === 'cancelado' && !registro.recibo) confere = !!tentativa.cancelamento
        && registro.cancelamento?.motivo === tentativa.cancelamento.motivo;
      if (!confere) add('tentativa_divergente', id);
      pendencias.push({ vendaId: id, codigo: tentativa.cancelamento ? 'cancelamento_a_conferir' : 'venda_a_conferir', statusServidor: registro.status });
    } else if (registro.status === 'aguardando_gravacao_local') pendencias.push({ vendaId: id, codigo: 'confirmacao_local_pendente' });
    if (registro.estorno?.turno?.chave === remoto.turno.chave) {
      const gravado = (turno.estornosLocaisV2 || []).find(e => e.reciboId === registro.estorno.reciboId);
      if (!gravado && devolucao?.payload?.vendaId !== id) add('estorno_ausente_no_backup', id);
      if (gravado && ['totalCentavos', 'motivo', 'devolverEstoque', 'vendaId', 'lojaId'].some(k => gravado[k] !== registro.estorno[k])) add('estorno_divergente', id);
      if (gravado && JSON.stringify(gravado.pagamentos) !== JSON.stringify(registro.estorno.pagamentos)) add('pagamentos_estorno_divergentes', id);
    }
    if (registro.status === 'estorno_pendente') pendencias.push({ vendaId: id, codigo: 'estorno_a_conferir' });
    if (devolucao?.payload?.vendaId === id) {
      if (registro.status !== 'estorno_pendente') pendencias.push({ vendaId: id, codigo: 'estorno_a_conferir' });
      const receipt = registro.estorno;
      if (receipt && (receipt.totalCentavos !== devolucao.totalCentavos || receipt.motivo !== devolucao.payload.motivo
        || receipt.devolverEstoque !== devolucao.payload.devolverEstoque
        || JSON.stringify(receipt.pagamentos) !== JSON.stringify(devolucao.pagamentos))) add('tentativa_estorno_divergente', id);
    }
    if (!['ausente', 'cancelado', 'aguardando_gravacao_local', 'confirmado', 'estorno_pendente', 'estornado'].includes(registro.status)) add('status_desconhecido', id);
  }
  for (const id of vendaIds) if (!ids.has(id)) add('resposta_incompleta', id);
  for (const ajuste of ajustes) if (!remoto.registros.some(r => r.estorno?.reciboId === ajuste.reciboId)) add('estorno_local_sem_confirmacao_remota', ajuste.vendaId);
  if (turno.status !== remoto.turno.status) add('estado_turno_divergente');
  return { versao: 1, escopo: 'turno_atual', liberacaoOperacional: false, lojaId: contexto.lojaId,
    turnoId: turno.id, revisaoServidor: remoto.turno.revisao, divergencias, pendencias,
    semDivergencias: divergencias.length === 0, quantidadeRegistrosServidor: remoto.registros.length,
    ...(incluirRegistros ? { registrosConferidos: remoto.registros, turnoServidor: remoto.turno } : {}) };
}
