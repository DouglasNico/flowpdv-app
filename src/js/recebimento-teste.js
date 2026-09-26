import { usarFluxoOperacionalV2, usarAplicativoIntegradoV2, usarPdvOficialV2 } from './perfil-operacional-v2.js';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { criarCartaoEntrega } from './cartao-entrega.js';
import { instalarConsultaEntregas } from './consulta-entregas.js';
import { instalarPreparoCaixa } from './preparo-caixa.js';
import { sessaoTerminalTeste } from './sessoes-homologacao.js';
import { textoComboPedido } from './cupom-cozinha.js';

export function instalarRecebimentoTeste() {
  if (!usarFluxoOperacionalV2() || document.getElementById('receive-open')) return;
  const oficial = usarPdvOficialV2();
  const launcher = document.createElement('button');
  launcher.id = 'receive-open'; launcher.textContent = oficial ? 'Pedidos do cardápio' : 'Pedidos do cardápio • teste';
  launcher.hidden = oficial;
  launcher.style.cssText = 'position:fixed;right:18px;bottom:96px;z-index:2147483645;padding:12px;border:0;border-radius:10px;background:#1e40af;color:white;cursor:pointer';
  const dialog = document.createElement(oficial ? 'section' : 'dialog'); dialog.id = 'receive-dialog';
  if (oficial) dialog.className = 'cardapio-online';
  dialog.style.cssText = oficial
    ? ''
    : 'margin:auto;width:min(900px,92vw);max-height:80vh;overflow:auto;border:0;border-radius:14px;padding:24px;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui';
  const intro = oficial
    ? 'Pedidos enviados pelo cardápio. Confira os itens, avance o preparo e feche a conta.'
    : 'Contas de teste: confira os itens antes de fechar. Preparo e cupom simulado estão no painel Cozinha.';
  dialog.innerHTML = oficial
    ? `<div class="view-container cardapio-pagina"><div class="view-header"><div class="view-title-group"><h2>Cardápio</h2><p>${intro}</p></div><div class="caixa-header-actions"><span id="receive-state" class="cardapio-status" role="status"></span><button type="button" id="receive-entregas" class="btn-secondary-action">Entregas</button><button type="button" id="receive-retry" class="btn-secondary-action">Atualizar</button></div></div><div id="receive-list"></div><div id="receive-extra"></div></div><button type="button" id="receive-close" hidden>Fechar</button>`
    : `<style>#receive-dialog button{padding:9px 12px;margin:8px 8px 0 0;border:0;border-radius:8px;background:#1e40af;color:white;cursor:pointer;font:inherit}#receive-dialog button[data-action=cancel]{background:#f1f5f9;color:#991b1b;font-size:13px;overflow-wrap:anywhere}</style><h2>Pedidos do cardápio</h2><p>${intro}</p><button id="receive-close">Fechar</button> <button id="receive-retry">Reconectar / tentar novamente</button><p id="receive-state" role="status"></p><div id="receive-list"></div>`;
  const painel = document.getElementById('tab-cardapio');
  const nav = document.getElementById('nav-btn-cardapio');
  if (oficial && painel) {
    painel.append(dialog);
    if (nav) nav.style.display = '';
    document.body.append(launcher);
  } else {
    document.body.append(launcher, dialog);
  }
  launcher.onclick = () => { if (oficial && window.App) window.App.trocarAba('cardapio'); else dialog.showModal(); };
  dialog.querySelector('#receive-close').onclick = () => { if (oficial && window.App) window.App.trocarAba('pdv'); else dialog.close(); };
  const state = dialog.querySelector('#receive-state'), list = dialog.querySelector('#receive-list');
  const hostConteudo = oficial ? dialog.querySelector('#receive-extra') : dialog;
  const deliveryList=document.createElement('div');deliveryList.id='receive-deliveries';hostConteudo.append(deliveryList);
  const s = sessaoTerminalTeste(); let generation = 0, stops = [], receiving = false;
  const consultaEntregas = instalarConsultaEntregas({ host: hostConteudo, call: s.call });
  const preparoCaixa = instalarPreparoCaixa({ host: hostConteudo, sessao: s });
  if (oficial) {
    const preparoTitulo = dialog.querySelector('#receive-preparo h3');
    const preparoAjuda = dialog.querySelector('#receive-preparo p');
    if (preparoTitulo) preparoTitulo.textContent = 'Preparo';
    if (preparoAjuda) preparoAjuda.textContent = 'Atualize o andamento quando a cozinha confirmar.';
    const entregaAjuda = dialog.querySelector('#delivery-history p');
    if (entregaAjuda) entregaAjuda.textContent = 'Filtre por situação e atualize para ver as entregas.';
    const historicoEntregas = dialog.querySelector('#delivery-history');
    if (historicoEntregas) historicoEntregas.hidden = true;
    const botaoEntregas = dialog.querySelector('#receive-entregas');
    botaoEntregas.setAttribute('aria-pressed', 'false');
    botaoEntregas.onclick = () => {
      historicoEntregas.hidden = !historicoEntregas.hidden;
      botaoEntregas.setAttribute('aria-pressed', String(!historicoEntregas.hidden));
    };
  }
  function setEstado(texto) {
    state.textContent = texto;
    if (!oficial) return;
    state.classList.toggle('cardapio-status--ok', texto === 'Conectado.');
    state.classList.toggle('cardapio-status--erro', /interrompido|Autorize|suspenso|Prepare/.test(texto));
  }
  const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function stop() { generation++; stops.forEach(fn => fn()); stops = []; list.replaceChildren(); deliveryList.replaceChildren(); consultaEntregas.reset(); preparoCaixa.reset(); }
  function failure(error) { stop(); setEstado(`Recebimento interrompido: ${error.message || 'conexão indisponível'}. Use ${oficial ? 'Atualizar' : 'Reconectar'}.`); }
  function render(snapshot) {
    list.replaceChildren();
    if (snapshot.empty) {
      if (!oficial) { list.textContent = 'Nenhuma conta aberta recebida.'; return; }
      const vazio = document.createElement('div');
      vazio.className = 'cardapio-vazio';
      vazio.innerHTML = '<strong>Nenhuma conta aberta</strong><span>Os pedidos enviados pelo cardápio aparecem aqui para conferir e fechar a conta.</span>';
      list.append(vazio);
      return;
    }
    for (const record of snapshot.docs) {
      const a = record.data(), section = document.createElement('section'), title = document.createElement('h3');
      if (!oficial) section.style.cssText = 'padding:12px;margin-top:14px;border:1px solid #cbd5e1;border-radius:10px;background:white';
      if (oficial) section.className = 'cardapio-conta';
      section.dataset.atendimentoId = record.id;
      title.textContent = `${a.tipo==='delivery'?'Delivery':a.mesaNome || 'Retirada'} • ${a.comandaPdvId}`; section.append(title);
      for (const line of a.itens) {
        const row = document.createElement('p'); row.dataset.linhaId = line.origemLinhaId;
        row.textContent = `${line.quantidade} × ${line.nome} — ${money(line.totalCentavos)}${line.opcoes?.length ? ' | ' + line.opcoes.map(o => `${o.quantidade} × ${o.nome}`).join(', ') : ''}${line.observacao ? ' | Obs.: ' + line.observacao : ''}`;
        section.append(row);
        if (line.variante === 'combo') { const included = document.createElement('p'); included.textContent = textoComboPedido(line); section.append(included); }
      }
      const total = document.createElement('strong'); total.textContent = `Total: ${money(a.totalCentavos)}`; section.append(total); list.append(section);
      const acoes = document.createElement('div'); acoes.className = 'cardapio-acoes';
      const close = document.createElement('button'); close.textContent = 'Fechar conta'; close.dataset.action = 'checkout';
      close.onclick = () => window.dispatchEvent(new CustomEvent('flowpdv-checkout-open', { detail: { atendimentoId: record.id, versao: a.versao, totalCentavos: a.totalCentavos, nome: a.mesaNome || 'Retirada' } }));
      if (!oficial) section.append(document.createElement('br'));
      (oficial ? acoes : section).append(close);
      for (const pedidoId of new Set(a.itens.map(line => line.origemPedidoId))) {
        const cancel = document.createElement('button'); cancel.textContent = `Cancelar pedido ${pedidoId}`; cancel.dataset.action = 'cancel';
        cancel.onclick = () => window.dispatchEvent(new CustomEvent('flowpdv-cancel-order', { detail: { pedidoId } }));
        (oficial ? acoes : section).append(cancel);
      }
      if (oficial) section.append(acoes);
    }
  }
  async function connect() {
    stop(); const epoch = generation; setEstado('Consultando terminal…');
    try {
      await s.auth.authStateReady(); if (epoch !== generation) return;
      if (!s.auth.currentUser) { setEstado('Prepare e autorize este terminal como caixa.'); return; }
      const binding = await s.call('consultarMeuTerminalV2'); if (epoch !== generation) return;
      if (!binding.vinculado || binding.papel !== 'caixa') { setEstado('Autorize este terminal como caixa para receber pedidos.'); return; }
      if (usarPdvOficialV2()) {
        const acesso = await s.call('consultarAtivacaoOperacionalV2');
        if(epoch !== generation) return;
        if(acesso.lojaId !== binding.lojaId || acesso.homologacaoHabilitada !== true) {setEstado('Recebimento suspenso pelo servidor.');return;}
      }
      const base = `lojas_v2/${binding.lojaId}`;
      preparoCaixa.connect(binding.lojaId);
      stops.push(onSnapshot(query(collection(s.db, `${base}/pedidos`),where('tipo','==','delivery'),where('status','in',['novo','em_preparo','pronto','saiu_entrega']),limit(50)),snap=>{
        if(epoch!==generation)return;
        deliveryList.replaceChildren();if(snap.empty)return;const heading=document.createElement('h3');heading.textContent=oficial?'Entregas em andamento':'Entregas em andamento (até 50)';deliveryList.append(heading);
        for(const record of snap.docs) deliveryList.append(criarCartaoEntrega({record, fromCache:snap.metadata.fromCache, call:s.call, atual:()=>epoch===generation, aviso:state}));
      },error=>{if(epoch===generation)failure(error);}));
      const queue = new Set(); const completed = new Set();
      const drain = async () => {
        if (receiving) return; receiving = true;
        try {
          while (queue.size && epoch === generation) {
            const id = queue.values().next().value; queue.delete(id);
            if (completed.has(id)) continue;
            await s.call('receberPedidoPdvV2', { pedidoId: id }); completed.add(id);
          }
        } catch (error) { if (epoch === generation) failure(error); }
        finally { receiving = false; if (epoch !== generation) window.dispatchEvent(new Event('flowpdv-receive-idle')); }
      };
      stops.push(onSnapshot(query(collection(s.db, `${base}/atendimentos`), where('status', '==', 'aberto'), limit(50)), snap => {
        if (epoch === generation) render(snap);
      }, error => { if (epoch === generation) failure(error); }));
      stops.push(onSnapshot(query(collection(s.db, `${base}/pedidos`), where('recebidoPdv', '==', false), limit(50)), { includeMetadataChanges: true }, snap => {
        if (epoch !== generation) return;
        setEstado(snap.metadata.fromCache ? 'Sem confirmação de conexão. Aguardando servidor…' : (oficial ? 'Conectado.' : 'Recebimento conectado. Exibindo até 50 contas abertas.'));
        if (snap.metadata.fromCache) return;
        for (const record of snap.docs) if (!completed.has(record.id)) queue.add(record.id);
        drain();
      }, error => { if (epoch === generation) failure(error); }));
      const idle = () => { if (epoch === generation) drain(); };
      window.addEventListener('flowpdv-receive-idle', idle); stops.push(() => window.removeEventListener('flowpdv-receive-idle', idle));
    } catch (error) { if (epoch === generation) failure(error); }
  }
  dialog.querySelector('#receive-retry').onclick = connect;
  window.addEventListener('flowpdv-terminal-v2', connect);
  window.addEventListener('online', connect);
  window.addEventListener('offline', stop);
  onAuthStateChanged(s.auth, connect);
}
