import { criarCartaoEntrega } from './cartao-entrega.js';

export function instalarConsultaEntregas({ host, call }) {
  const section = document.createElement('section'); section.id = 'delivery-history';
  section.innerHTML = '<h3>Consultar entregas</h3><p>Consulte todas as entregas em páginas de 25, ordenadas pelo código. Atualize para conferir alterações.</p><div class="cardapio-consulta-barra"><label for="delivery-history-filter">Situação</label><select id="delivery-history-filter"><option value="andamento">Em andamento</option><option value="finalizadas">Finalizadas</option><option value="canceladas">Canceladas</option></select><button id="delivery-history-refresh" type="button">Consultar / atualizar</button></div><p id="delivery-history-state" role="status"></p><div id="delivery-history-list"></div><div class="cardapio-consulta-nav"><button id="delivery-history-prev" type="button" disabled>Anterior</button><button id="delivery-history-next" type="button" disabled>Próxima</button></div>';
  host.append(section);
  const el = id => section.querySelector('#delivery-history-' + id), filtro = el('filter'), lista = el('list'), aviso = el('state');
  let generation = 0, cursors = [null], pagina = 0, proximo = null;
  function reset() {
    generation++; cursors = [null]; pagina = 0; proximo = null;
    lista.replaceChildren(); aviso.textContent = host.closest('#tab-cardapio') ? '' : 'Clique em Consultar para carregar as entregas.';
    el('prev').disabled = true; el('next').disabled = true;
    el('refresh').disabled = false; filtro.disabled = false;
  }
  async function carregar(destino = 0) {
    const epoch = ++generation, selecionado = filtro.value;
    lista.replaceChildren(); aviso.textContent = 'Consultando entregas…';
    for (const id of ['prev', 'next', 'refresh']) el(id).disabled = true;
    filtro.disabled = true;
    try {
      const result = await call('listarEntregasCaixaV2', { filtro: selecionado, cursor: cursors[destino] });
      if (epoch !== generation) return;
      pagina = destino; proximo = result.proximo;
      aviso.textContent = result.pedidos.length ? `Página ${pagina + 1} • ${result.pedidos.length} entregas` : 'Nenhuma entrega nesta página. Atualize a consulta se os pedidos mudaram.';
      for (const p of result.pedidos) lista.append(criarCartaoEntrega({ record: { id: p.id, data: () => p }, call, atual: () => epoch === generation, aviso }));
      el('prev').disabled = pagina === 0; el('next').disabled = !proximo;
    } catch (error) {
      if (epoch === generation) aviso.textContent = `Consulta indisponível: ${error.message}. Use Consultar / atualizar.`;
    } finally {
      if (epoch === generation) { el('refresh').disabled = false; filtro.disabled = false; }
    }
  }
  el('refresh').onclick = () => { cursors = [null]; return carregar(); };
  filtro.onchange = reset;
  el('prev').onclick = () => carregar(pagina - 1);
  el('next').onclick = () => { if (!proximo) return; cursors[pagina + 1] = proximo; return carregar(pagina + 1); };
  reset();
  return { reset };
}
