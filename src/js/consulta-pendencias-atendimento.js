export function instalarConsultaPendenciasAtendimento({ host, call }) {
  const section = document.createElement('section'); section.id = 'recovery-accounts';
  section.innerHTML = '<h3>Pendências de atendimento da loja</h3><p>Consulta do servidor, sem receber pedidos ou fechar contas. Cada página reflete o momento da consulta; atualize se houver outro caixa operando. Não substitui a conferência de pagamentos nem libera este perfil.</p><label for="recovery-accounts-filter">Consultar</label><select id="recovery-accounts-filter"><option value="contas">Contas abertas</option><option value="pedidos">Pedidos ainda não recebidos no caixa</option></select><button id="recovery-accounts-refresh" type="button">Consultar / atualizar</button><p id="recovery-accounts-state" role="status"></p><ul id="recovery-accounts-list"></ul><button id="recovery-accounts-prev" type="button" disabled>Anterior</button><button id="recovery-accounts-next" type="button" disabled>Próxima</button>';
  host.append(section);
  const el = id => section.querySelector('#recovery-accounts-' + id);
  let generation = 0, cursores = [null], pagina = 0, proximo = null;
  function reset() {
    generation++; cursores = [null]; pagina = 0; proximo = null;
    el('list').replaceChildren(); el('state').textContent = 'Consulte após confirmar o acesso do terminal.';
    el('prev').disabled = true; el('next').disabled = true;
    el('refresh').disabled = false; el('filter').disabled = false;
  }
  async function carregar(destino = 0) {
    const epoch = ++generation, tipo = el('filter').value;
    el('list').replaceChildren(); el('state').textContent = 'Consultando pendências…';
    for (const id of ['prev', 'next', 'refresh', 'filter']) el(id).disabled = true;
    try {
      const result = await call('listarPendenciasAtendimentoV2', { tipo, cursor: cursores[destino] });
      if (epoch !== generation) return;
      if (result?.versao !== 1 || result.somenteConferencia !== true || result.tipo !== tipo || !Array.isArray(result.registros)
        || result.registros.length > 50 || result.registros.some(p => !p.id || !Number.isSafeInteger(p.totalCentavos) || p.totalCentavos < 0)) throw new Error('Resposta de conferência inválida.');
      pagina = destino; proximo = result.proximo;
      const soma = result.registros.reduce((n, p) => n + p.totalCentavos, 0);
      if (!Number.isSafeInteger(soma)) throw new Error('Total da página inválido.');
      el('state').textContent = result.registros.length ? `Página ${pagina + 1}: ${result.registros.length} registros • valor dos registros desta página: ${(soma / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Não é saldo a receber; pode incluir pedido cancelado aguardando processamento.` : 'Nenhuma pendência nesta página. A consulta não comprova o fechamento financeiro.';
      for (const p of result.registros) {
        const li = document.createElement('li'); li.style.overflowWrap = 'anywhere';
        li.textContent = `${p.id} • ${p.tipo}${p.mesaId ? ' • mesa ' + p.mesaId : ''} • ${p.status} • ${(p.totalCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        el('list').append(li);
      }
      el('prev').disabled = pagina === 0; el('next').disabled = !proximo;
    } catch (error) {
      if (epoch === generation) { proximo = null; el('list').replaceChildren(); el('state').textContent = `Consulta indisponível: ${error.message}. Atualize para tentar novamente.`; }
    } finally {
      if (epoch === generation) { el('refresh').disabled = false; el('filter').disabled = false; }
    }
  }
  el('refresh').onclick = () => { cursores = [null]; return carregar(); };
  el('filter').onchange = reset;
  el('prev').onclick = () => { if (pagina > 0) return carregar(pagina - 1); };
  el('next').onclick = () => { if (proximo) { cursores[pagina + 1] = proximo; return carregar(pagina + 1); } };
  reset(); return { reset };
}
