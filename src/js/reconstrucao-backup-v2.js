import { conferirBackupServidor } from './conferencia-backup-v2.js';
import core from '../../functions/venda-local-core.cjs';

// Reconstrói uma cópia do arquivo. Nunca vende, estorna, confirma ou altera saldo remoto.
export async function reconstruirBackupConfirmado({ pacote, contexto, ambienteTeste, call }) {
  const copia = JSON.parse(JSON.stringify(pacote));
  const relatorio = await conferirBackupServidor({ pacote: copia, contexto, ambienteTeste, call, incluirRegistros: true });
  if (relatorio.pendencias.length || relatorio.divergencias.some(d => !['venda_ausente_no_backup', 'estorno_ausente_no_backup'].includes(d.codigo)))
    throw new Error('Há pendências ou divergências que exigem recuperação específica.');
  if (relatorio.turnoServidor.status !== 'aberto') throw new Error('Reconstrução automática disponível apenas para o turno aberto.');
  const turno = JSON.parse(copia.dados.adega_turno_atual), vendas = JSON.parse(copia.dados.adega_vendas || '[]');
  const produtos = JSON.parse(copia.dados.adega_produtos || '[]');
  const ajustes = turno.estornosLocaisV2 || [], alteracoes = [];
  const mesmaReferencia = ref => ref && ref.id === turno.id && ref.terminalId === contexto.terminalId
    && ref.dataAbertura === turno.dataAbertura && ref.terminalUid === contexto.terminalUid && ref.chave === relatorio.turnoServidor.chave;
  for (const d of relatorio.divergencias) {
    const registro = relatorio.registrosConferidos.find(r => r.vendaId === d.vendaId);
    if (!registro || !['confirmado', 'estornado'].includes(registro.status)) throw new Error('Movimento ainda não confirmado no servidor.');
    if (d.codigo === 'venda_ausente_no_backup') {
      const recibo = registro.recibo, raw = recibo?.venda;
      if (!mesmaReferencia(recibo?.turno) || recibo.lojaId !== contexto.lojaId || recibo.vendaId !== d.vendaId
        || !recibo.reciboId || raw?.vendaId !== d.vendaId || vendas.some(v => v.id === d.vendaId)) throw new Error('Comprovante ou identificação da venda divergente.');
      if (typeof registro.criadoEm !== 'string' || !Number.isFinite(Date.parse(registro.criadoEm))) throw new Error('Data de registro da venda indisponível no servidor.');
      const normalizada = core.normalizarVendaLocal(raw);
      const itens = normalizada.itens.map(i => {
        const encontrados = produtos.filter(p => String(p.id) === i.legadoId);
        if (encontrados.length !== 1 || !encontrados[0].nome || !encontrados[0].unidade) throw new Error('Produto ausente ou ambíguo no backup. Confira o cadastro antes de reconstruir.');
        return { id: encontrados[0].id, nome: encontrados[0].nome, unidade: encontrados[0].unidade, quantidade: Number(i.quantidade), precoUnitario: i.precoUnitarioCentavos / 100 };
      });
      const semEstoque = recibo.itensSemEstoque || [];
      if (!Array.isArray(recibo.consumos) || !Array.isArray(semEstoque)) throw new Error('Consumos da venda incompletos.');
      const cobertos = [...recibo.consumos.map(c => c.legadoId), ...semEstoque];
      if (new Set(cobertos).size !== itens.length || cobertos.length !== itens.length || itens.some(i => !cobertos.includes(String(i.id)))) throw new Error('Consumos da venda incompletos.');
      const venda = { id: d.vendaId, turnoId: turno.id, terminalId: turno.terminalId, data: registro.criadoEm, status: 'concluida', formaPagamento: 'Dinheiro',
        total: normalizada.totalCentavos / 100, itens,
        estoqueServidorV2: { reciboId: recibo.reciboId, lojaId: contexto.lojaId, consumos: recibo.consumos, ...(semEstoque.length ? { itensSemEstoque: semEstoque } : {}) },
        recuperacaoV2: { origem: 'recibo_servidor', dataOrigem: 'registro_servidor', nomesOrigem: 'cadastro_backup', revisaoConferida: relatorio.revisaoServidor } };
      if (normalizada.ajuste) Object.assign(venda, { ajuste: normalizada.ajuste, subtotal: normalizada.subtotalCentavos / 100,
        desconto: normalizada.ajuste.descontoCentavos / 100, acrescimo: normalizada.ajuste.acrescimoCentavos / 100 });
      if (normalizada.recebidoDinheiroCentavos !== undefined) Object.assign(venda, { recebidoDinheiroCentavos: normalizada.recebidoDinheiroCentavos,
        trocoCentavos: normalizada.trocoCentavos, valorPago: normalizada.recebidoDinheiroCentavos / 100, troco: normalizada.trocoCentavos / 100 });
      if (normalizada.pagamentos) Object.assign(venda, { formaPagamento: normalizada.pagamentos.length === 1 ? normalizada.pagamentos[0].forma : 'Múltiplos', pagamentoDividido: normalizada.pagamentos.length > 1, pagamentosCentavos: normalizada.pagamentos,
        pagamentos: normalizada.pagamentos.map(p => ({ forma: p.forma, valor: p.valorCentavos / 100, ...(p.forma === 'Dinheiro' ? { valorEntregue: normalizada.recebidoDinheiroCentavos / 100 } : {}) })),
        valorPago: (normalizada.totalCentavos + normalizada.trocoCentavos) / 100 });
      vendas.push(venda);
    } else {
      const e = registro.estorno;
      if (registro.status !== 'estornado' || !mesmaReferencia(e?.turno) || e.lojaId !== contexto.lojaId || e.vendaId !== d.vendaId
        || !e.reciboId || !Number.isSafeInteger(e.totalCentavos) || e.totalCentavos < 0 || typeof e.motivo !== 'string'
        || typeof e.devolverEstoque !== 'boolean' || ajustes.some(a => a.reciboId === e.reciboId)) throw new Error('Comprovante de estorno inválido.');
      if (registro.recibo?.venda?.totalCentavos !== e.totalCentavos
        || JSON.stringify(registro.recibo.venda.pagamentos) !== JSON.stringify(e.pagamentos)) throw new Error('Devolução diverge da venda.');
      ajustes.push(e);
    }
    alteracoes.push({ codigo: d.codigo, vendaId: d.vendaId });
  }
  copia.dados.adega_vendas = JSON.stringify(vendas);
  if (ajustes.length) turno.estornosLocaisV2 = ajustes;
  copia.dados.adega_turno_atual = JSON.stringify(turno);
  const final = await conferirBackupServidor({ pacote: copia, contexto, ambienteTeste, call });
  if (!final.semDivergencias || final.pendencias.length || final.revisaoServidor !== relatorio.revisaoServidor) throw new Error('O turno mudou durante a reconstrução. Confira novamente.');
  return { pacote: copia, alteracoes, conferencia: final, liberacaoOperacional: false };
}
