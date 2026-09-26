import { collection, doc, query, where, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { sessaoTerminalTeste } from './sessoes-homologacao.js';
import { enviarCupomCozinha, textoComboPedido } from './cupom-cozinha.js';

export function instalarCozinhaTeste() {
  if (window.electronAPI?.ambienteTeste !== true || document.getElementById('kitchen-open')) return;
  const launch = document.createElement('button'); launch.id = 'kitchen-open'; launch.textContent = 'Cozinha • teste';
  launch.style.cssText = 'position:fixed;right:18px;bottom:148px;z-index:2147483645;padding:12px 18px;border:0;border-radius:10px;background:#7c3aed;color:white;cursor:pointer';
  const modal = document.createElement('dialog'); modal.id = 'kitchen-dialog';
  modal.setAttribute('aria-labelledby', 'kitchen-title');
  modal.innerHTML = `<style>
    #kitchen-dialog{margin:auto;width:min(1080px,94vw);max-height:88vh;overflow:auto;border:0;border-radius:16px;padding:24px;background:#f8fafc;color:#0f172a;font:15px/1.5 system-ui}#kitchen-dialog::backdrop{background:#0f172aaa}
    #kitchen-dialog h2{margin:0}#kitchen-dialog button{border:0;border-radius:8px;padding:10px 14px;margin:6px 6px 6px 0;background:#6d28d9;color:white;font:inherit;cursor:pointer}#kitchen-dialog button:disabled{opacity:.5;cursor:wait}
    #kitchen-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}#kitchen-dialog article{background:white;border:1px solid #cbd5e1;border-radius:12px;padding:16px;overflow-wrap:anywhere}#kitchen-dialog article h3{margin:0 0 8px}#kitchen-dialog p{margin:8px 0}
    #kitchen-print-list>div{padding:8px;border-bottom:1px solid #cbd5e1}#kitchen-preview{width:100%;height:380px;background:white;border:1px solid #cbd5e1;border-radius:10px}#kitchen-message{color:#9a3412;min-height:24px}
  </style><h2 id="kitchen-title">Cozinha</h2><p>Ambiente de teste • impressão simulada, sem gastar papel.</p><button id="kitchen-close">Fechar</button><button id="kitchen-reconnect">Reconectar</button>
  <p id="kitchen-state" role="status"></p><p id="kitchen-message" role="alert"></p><section><h3>Avisos de cancelamento</h3><div id="kitchen-alerts"></div></section><section id="kitchen-kds"><h3>Painel de preparo</h3><div id="kitchen-cards"></div></section>
  <section id="kitchen-print"><h3>Impressão da cozinha</h3><p>Se uma tentativa ficar sem confirmação, confira antes de solicitar outra via. São exibidas as 30 tentativas mais recentes.</p><div id="kitchen-print-list"></div>
  <form id="kitchen-reprint" hidden><p>Confira o papel antes de repetir a impressão.</p><label for="kitchen-reason">Motivo da outra via</label><input id="kitchen-reason" required minlength="5" maxlength="180" style="display:block;width:95%;padding:10px;margin:8px 0"><button type="submit">Confirmar outra via</button><button id="kitchen-reprint-cancel" type="button">Cancelar</button></form>
  <h3>Último cupom simulado neste terminal</h3><iframe id="kitchen-preview" title="Prévia do cupom da cozinha" sandbox=""></iframe></section>`;
  document.body.append(launch, modal); launch.onclick = () => modal.showModal();
  const el = id => modal.querySelector(`#${id}`), s = sessaoTerminalTeste();
  el('kitchen-close').onclick = () => modal.close();
  let generation = 0, stops = [], running = false;
  const labels = { novo: 'Novo', em_preparo: 'Em preparo', pronto: 'Pronto', pendente: 'Pendente', enviando: 'Aguardando confirmação', simulado: 'Simulado — sem papel', enviado_driver: 'Enviado ao driver', incerto: 'Conferência necessária', cancelado: 'Cancelado' };
  function clear() { generation++; stops.forEach(fn => fn()); stops = []; el('kitchen-cards').replaceChildren(); el('kitchen-alerts').replaceChildren(); el('kitchen-print-list').replaceChildren(); el('kitchen-preview').srcdoc = ''; el('kitchen-reprint').hidden = true; }
  function error(e) { el('kitchen-message').textContent = e.message || 'Conexão indisponível. Reconecte para conferir a fila.'; }
  el('kitchen-reprint-cancel').onclick = () => { el('kitchen-reprint').hidden = true; };
  el('kitchen-reprint').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button[type=submit]');
    if (button.disabled) return; button.disabled = true;
    try { await s.call('reimprimirCozinhaV2', { jobId: form.dataset.jobId, requestId: form.dataset.requestId, motivo: el('kitchen-reason').value }); form.hidden = true; }
    catch (e) { error(e); } finally { button.disabled = false; }
  };
  async function connect() {
    clear(); const epoch = generation; el('kitchen-message').textContent = ''; el('kitchen-state').textContent = 'Consultando acesso…';
    try {
      await s.auth.authStateReady(); if (epoch !== generation) return;
      if (!s.auth.currentUser) { el('kitchen-state').textContent = 'Autorize este terminal como caixa ou cozinha.'; return; }
      const binding = await s.call('consultarMeuTerminalV2'); if (epoch !== generation) return;
      if (!binding.vinculado || !['caixa', 'cozinha'].includes(binding.papel)) { el('kitchen-state').textContent = 'Terminal ainda não autorizado.'; return; }
      const base = `lojas_v2/${binding.lojaId}`; let childStops = [], config = {}, online = false;
      stops.push(onSnapshot(query(collection(s.db, `${base}/avisos_cozinha`), where('status', '==', 'pendente'), limit(50)), snap => {
        if (epoch !== generation) return;
        const box = el('kitchen-alerts'); box.replaceChildren();
        for (const record of snap.docs) {
          const notice = record.data(), row = document.createElement('article'), text = document.createElement('p'), btn = document.createElement('button');
          text.textContent = `ATENÇÃO: ${notice.tipo} • ${notice.mesaNome} • Pedido ${notice.pedidoId} • ${notice.motivo}`;
          btn.textContent = 'Ciente — conferi o preparo'; btn.onclick = async () => { btn.disabled = true; try { await s.call('confirmarAvisoCozinhaV2', { avisoId: record.id }); } catch (e) { error(e); btn.disabled = false; } };
          row.append(text, btn); box.append(row);
        }
        if (!snap.size) box.textContent = 'Nenhum aviso pendente.';
      }, e => { if (epoch === generation) error(e); }));
      stops.push(() => childStops.forEach(fn => fn()));
      const failed = e => { if (epoch === generation) { clear(); error(e); el('kitchen-state').textContent = 'Conexão interrompida. Use Reconectar.'; } };
      const watch = (ref, callback) => onSnapshot(ref, { includeMetadataChanges: true }, snap => { if (epoch === generation) callback(snap); }, failed);
      const queue = new Set();
      const drain = async () => {
        if (running || !online || !config.impressao || (config.terminalUid && config.terminalUid !== s.auth.currentUser?.uid)) return; running = true;
        try {
          while (queue.size && epoch === generation && config.impressao && online) {
            const jobId = queue.values().next().value; queue.delete(jobId);
            const tentativa = crypto.randomUUID();
            const result = await s.call('reservarImpressaoCozinhaV2', { jobId, tentativa });
            if (!result.autorizado) continue;
            // Se a conexão/tela mudou após reservar, não despacha. A fila exigirá conferência.
            if (epoch !== generation || !config.impressao || !online) break;
            let resultado = 'incerto';
            try { resultado = await enviarCupomCozinha(result.pedido, { api: window.electronAPI, via: result.via, papelMm: config.papelMm, impressora: config.impressora, preview: html => { el('kitchen-preview').srcdoc = html; } }); }
            catch (e) { error(e); }
            await s.call('concluirImpressaoCozinhaV2', { jobId, tentativa, resultado });
          }
        } catch (e) { if (epoch === generation) error(e); }
        finally { running = false; if (epoch !== generation) window.dispatchEvent(new Event('flowpdv-kitchen-idle')); }
      };
      const idle = () => { if (epoch === generation) drain(); }; window.addEventListener('flowpdv-kitchen-idle', idle); stops.push(() => window.removeEventListener('flowpdv-kitchen-idle', idle));
      stops.push(watch(doc(s.db, base), snapshot => {
        childStops.forEach(fn => fn()); childStops = []; queue.clear(); config = snapshot.data()?.cozinha || {};
        online = !snapshot.metadata.fromCache;
        el('kitchen-kds').hidden = config.kds !== true; el('kitchen-print').hidden = config.impressao !== true;
        el('kitchen-state').textContent = !online ? 'Aguardando conexão com o servidor…' : `KDS: ${config.kds ? 'ativado' : 'desativado'} • Impressão: ${config.impressao ? 'ativada (simulada)' : 'desativada'}`;
        if (config.kds) childStops.push(watch(query(collection(s.db, `${base}/pedidos`), where('status', 'in', ['novo', 'em_preparo', 'pronto']), limit(50)), snap => {
          const cards = el('kitchen-cards'); cards.replaceChildren();
          for (const record of snap.docs) {
            const p = record.data(); if (!p.recebidoPdv || p.ignoradoPdv) continue;
            const card = document.createElement('article'); card.dataset.pedidoId = record.id;
            const title = document.createElement('h3'); title.textContent = `${p.tipo === 'delivery' ? 'Delivery' : p.mesaNome || 'Retirada'} • ${labels[p.status]}`; card.append(title);
            const code = document.createElement('small'); code.textContent = `Pedido ${record.id}`; card.append(code);
            for (const line of p.itens) { const row = document.createElement('p'); row.textContent = `${line.quantidade} × ${line.nome}${line.opcoes?.length ? ' | ' + line.opcoes.map(o => `${o.quantidade} × ${o.nome} por unidade`).join(', ') : ''}${line.observacao ? ' | Obs.: ' + line.observacao : ''}`; card.append(row); if (line.variante === 'combo') { const included = document.createElement('p'); included.textContent = textoComboPedido(line); card.append(included); } }
            if(p.tipo==='delivery'&&p.status==='pronto'){const note=document.createElement('p');note.textContent='Pronto para o caixa despachar a entrega.';card.append(note);cards.append(card);continue;}
            const button = document.createElement('button'); button.textContent = { novo: 'Iniciar preparo', em_preparo: 'Marcar pronto', pronto: 'Marcar entregue' }[p.status]; button.disabled = snap.metadata.fromCache;
            button.onclick = async () => { button.disabled = true; try { await s.call('avancarPreparoV2', { pedidoId: record.id, de: p.status, para: { novo: 'em_preparo', em_preparo: 'pronto', pronto: 'entregue' }[p.status] }); } catch (e) { error(e); button.disabled = false; } }; card.append(button); cards.append(card);
          }
          if (!cards.childElementCount) cards.textContent = 'Nenhum pedido aguardando preparo. Exibição limitada a 50 pedidos.';
        }));
        if (config.impressao) {
          childStops.push(watch(query(collection(s.db, `${base}/impressoes_cozinha`), where('status', '==', 'pendente'), limit(50)), snap => {
            online = !snap.metadata.fromCache; if (!online) return;
            snap.docs.forEach(d => queue.add(d.id)); drain();
          }));
          childStops.push(watch(query(collection(s.db, `${base}/impressoes_cozinha`), orderBy('criadoEm', 'desc'), limit(30)), snap => {
            const list = el('kitchen-print-list'); list.replaceChildren();
            for (const record of snap.docs) {
              const job = record.data(), row = document.createElement('div'); row.dataset.jobId = record.id; row.dataset.status = job.status;
              const label = document.createElement('span'); label.textContent = `Pedido ${job.pedidoId} • Via ${job.via} • ${labels[job.status] || job.status}`; row.append(label);
              if (!job.reimpressaoId && ['simulado', 'enviado_driver', 'incerto', 'enviando'].includes(job.status)) {
                const btn = document.createElement('button'); btn.textContent = 'Solicitar outra via'; btn.disabled = snap.metadata.fromCache;
                btn.onclick = () => {
                  const form = el('kitchen-reprint'); form.dataset.jobId = record.id; form.dataset.requestId = crypto.randomUUID();
                  el('kitchen-reason').value = ''; form.hidden = false; el('kitchen-reason').focus();
                }; row.append(btn);
              } list.append(row);
            }
            if (!list.childElementCount) list.textContent = 'Nenhuma impressão na fila.';
          }));
        }
      }));
    } catch (e) { if (epoch === generation) { error(e); el('kitchen-state').textContent = 'Não foi possível conectar.'; } }
  }
  el('kitchen-reconnect').onclick = connect; window.addEventListener('online', connect); window.addEventListener('flowpdv-terminal-v2', connect); connect();
}
