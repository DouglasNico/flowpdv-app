import { normalizarOferta } from './ofertas-core.js';

const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moeda = v => v == null ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const valor = el => !el?.value?.trim() ? null : Number(el.value.replace(/\./g, '').replace(',', '.'));
const categoriaDe = p => {
  const c = String(p?.categoria || '').trim();
  return c || 'Sem categoria';
};
let contexto;

export function montarOfertasProduto(produto, produtos, combosLiberados) {
  document.getElementById('produto-ofertas')?.remove();
  const oferta = produto?.ofertaCardapio || {};
  const combo = oferta.combo || {};
  const root = document.createElement('section');
  root.id = 'produto-ofertas';
  root.className = 'produto-ofertas';
  root.setAttribute('aria-label', 'Combos e preços do cardápio');
  root.innerHTML = `
    <div class="form-group-custom"><label class="form-label-custom" for="oferta-individual">Promoção individual no cardápio (R$)</label>
      <input id="oferta-individual" class="form-input-custom" inputmode="numeric" data-moeda placeholder="Opcional" value="${moeda(oferta.precoPromocional)}">
      <small>Cadastre o valor aqui e ative a promoção no painel do cardápio. O preço do balcão continua igual.</small></div>
    ${combosLiberados ? `<label class="oferta-toggle"><input id="oferta-combo-ativo" type="checkbox" ${combo.ativo ? 'checked' : ''}> Oferecer como combo</label>
    <div id="oferta-combo-campos" ${combo.ativo ? '' : 'hidden'}>
      <div class="produto-estoque-grid">
        <div><label class="form-label-custom" for="oferta-combo-preco">Valor total do combo (R$)</label><input id="oferta-combo-preco" class="form-input-custom" inputmode="numeric" data-moeda value="${moeda(combo.preco)}"></div>
        <div><label class="form-label-custom" for="oferta-combo-promo">Promoção do combo (R$)</label><input id="oferta-combo-promo" class="form-input-custom" inputmode="numeric" data-moeda placeholder="Opcional" value="${moeda(combo.precoPromocional)}"></div>
      </div>
      <p class="form-label-custom">Acompanhamentos incluídos</p><div data-fixos></div>
      <button type="button" class="btn-secondary" data-incluir-fixo>Adicionar acompanhamento</button>
      <label class="form-label-custom" for="oferta-bebidas-categoria">Bebidas permitidas — o cliente escolhe 1</label>
      <select id="oferta-bebidas-categoria" class="form-input-custom" aria-label="Categoria das bebidas">
        <option value="">Selecione uma categoria</option>
      </select>
      <input type="search" id="oferta-bebidas-busca" class="form-input-custom" placeholder="Buscar na categoria" hidden>
      <div class="oferta-bebidas" data-bebidas></div>
      <div class="oferta-bebidas-selecionadas" data-bebidas-selecionadas hidden></div>
      <small>Escolha a categoria, marque as bebidas e salve. O lanche, os acompanhamentos e uma bebida já fazem parte do valor total.</small>
    </div>` : ''}`;
  const ancora = document.querySelector('#form-produto .produto-precos');
  if (!ancora) return;
  ancora.after(root);
  const elegiveis = produtos.filter(p => String(p.id) !== String(produto?.id) && p.ativo !== false && !p.excluido && !p.inativo && !p.permiteFracionado && String(p.unidade || '').toLowerCase() !== 'kg');
  const selecionadosBebidas = new Set((combo.bebidas || []).map(String));
  contexto = { root, oferta, combosLiberados, produto, produtos, elegiveis, selecionadosBebidas };
  root.querySelectorAll('[data-moeda]').forEach(input => input.addEventListener('input', () => {
    const digitos = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = digitos ? moeda(Number(digitos) / 100) : '';
  }));
  if (!combosLiberados) return;
  const check = root.querySelector('#oferta-combo-ativo');
  check.onchange = () => root.querySelector('#oferta-combo-campos').hidden = !check.checked;
  const adicionarFixo = (item = {}) => {
    const row = document.createElement('div'); row.className = 'oferta-fixo';
    const indisponivel = item.produtoId && !elegiveis.some(p => String(p.id) === String(item.produtoId));
    row.innerHTML = `<select class="form-input-custom" aria-label="Acompanhamento"><option value="">Selecione um produto</option>${indisponivel ? `<option value="${escapar(item.produtoId)}">Produto indisponível — substitua</option>` : ''}${elegiveis.map(p => `<option value="${escapar(p.id)}">${escapar(p.nome)}</option>`).join('')}</select><input class="form-input-custom" type="number" min="1" max="99" step="1" aria-label="Quantidade incluída" value="${Number(item.quantidade) || 1}"><button type="button" class="btn-secondary" aria-label="Remover acompanhamento">Remover</button>`;
    row.querySelector('select').value = item.produtoId || '';
    row.querySelector('button').onclick = () => row.remove();
    root.querySelector('[data-fixos]').append(row);
  };
  (combo.fixos || []).forEach(adicionarFixo);
  root.querySelector('[data-incluir-fixo]').onclick = () => adicionarFixo();

  const selectCat = root.querySelector('#oferta-bebidas-categoria');
  const busca = root.querySelector('#oferta-bebidas-busca');
  const lista = root.querySelector('[data-bebidas]');
  const resumo = root.querySelector('[data-bebidas-selecionadas]');
  const categorias = [...new Set(elegiveis.map(categoriaDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  for (const cat of categorias) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectCat.append(opt);
  }
  const porId = new Map(elegiveis.map(p => [String(p.id), p]));
  const renderResumo = () => {
    const ids = [...selecionadosBebidas];
    if (!ids.length) {
      resumo.hidden = true;
      resumo.replaceChildren();
      return;
    }
    resumo.hidden = false;
    resumo.innerHTML = `<strong>Selecionadas (${ids.length})</strong>` + ids.map(id => {
      const p = porId.get(String(id));
      const nome = p ? p.nome : `Produto ${id}`;
      return `<label class="oferta-bebida oferta-bebida-selecionada"><input type="checkbox" value="${escapar(id)}" checked> ${escapar(nome)}</label>`;
    }).join('');
    resumo.querySelectorAll('input').forEach(input => {
      input.onchange = () => {
        if (!input.checked) selecionadosBebidas.delete(String(input.value));
        renderResumo();
        renderLista();
      };
    });
  };
  const renderLista = () => {
    const cat = selectCat.value;
    const termo = busca.value.toLowerCase().trim();
    busca.hidden = !cat;
    if (!cat) {
      lista.innerHTML = '<small>Selecione uma categoria para listar as bebidas.</small>';
      return;
    }
    const itens = elegiveis.filter(p => categoriaDe(p) === cat && (!termo || String(p.nome).toLowerCase().includes(termo)));
    if (!itens.length) {
      lista.innerHTML = '<small>Nenhum produto ativo nesta categoria.</small>';
      return;
    }
    lista.innerHTML = itens.map(p => `<label class="oferta-bebida" data-nome="${escapar(String(p.nome).toLowerCase())}"><input type="checkbox" value="${escapar(p.id)}" ${selecionadosBebidas.has(String(p.id)) ? 'checked' : ''}> ${escapar(p.nome)}</label>`).join('');
    lista.querySelectorAll('input').forEach(input => {
      input.onchange = () => {
        const id = String(input.value);
        if (input.checked) selecionadosBebidas.add(id);
        else selecionadosBebidas.delete(id);
        renderResumo();
      };
    });
  };
  selectCat.onchange = () => { busca.value = ''; renderLista(); };
  busca.oninput = () => renderLista();
  // Sempre começa em "Selecione uma categoria" — não pré-seleciona Bebidas.
  selectCat.value = '';
  renderResumo();
  renderLista();
}

export function lerOfertasProduto(precoNormal) {
  if (!contexto?.root?.isConnected) return undefined;
  const { root, oferta, combosLiberados, produto, produtos, selecionadosBebidas } = contexto;
  let combo = oferta.combo || null;
  if (combosLiberados) {
    const ativo = root.querySelector('#oferta-combo-ativo')?.checked === true;
    if (ativo) {
      if (document.getElementById('prod-permite-fracionado')?.checked) throw new Error('Combos estão disponíveis para produtos vendidos por unidade.');
      const preco = valor(root.querySelector('#oferta-combo-preco'));
      if (preco == null || !(preco > 0)) throw new Error('Informe o valor total do combo.');
      const fixos = [...root.querySelectorAll('.oferta-fixo')].map(row => ({
        produtoId: row.querySelector('select')?.value || '',
        quantidade: Number(row.querySelector('input')?.value),
      })).filter(x => x.produtoId || Number.isFinite(x.quantidade));
      for (const item of fixos) {
        if (!item.produtoId) throw new Error('Selecione o produto de cada acompanhamento ou remova a linha vazia.');
        if (!Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 99) throw new Error('Confira as quantidades dos acompanhamentos.');
      }
      const bebidas = [...(selecionadosBebidas || new Set([...root.querySelectorAll('[data-bebidas] input:checked, [data-bebidas-selecionadas] input:checked')].map(el => el.value)))].map(String).filter(Boolean);
      if (!bebidas.length) throw new Error('Selecione pelo menos uma bebida: escolha a categoria e marque os produtos.');
      const ids = [...fixos.map(x => x.produtoId), ...bebidas];
      for (const id of ids) {
        if (String(id) === String(produto?.id)) throw new Error('O próprio lanche não pode ser componente do combo.');
        const ok = produtos.some(p => String(p.id) === String(id) && p.ativo !== false && !p.excluido && !p.inativo);
        if (!ok) throw new Error('Substitua os componentes indisponíveis do combo.');
      }
      combo = {
        ativo: true,
        preco,
        precoPromocional: valor(root.querySelector('#oferta-combo-promo')),
        fixos,
        bebidas,
      };
    } else combo = combo ? { ...combo, ativo: false } : null;
  }
  return normalizarOferta({ precoPromocional: valor(root.querySelector('#oferta-individual')), combo }, precoNormal);
}
