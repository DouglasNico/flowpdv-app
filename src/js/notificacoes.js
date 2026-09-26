// Feedback compartilhado: não move o foco nem interfere no leitor de códigos.
const tipos = {
  success: { titulo: 'Concluído', icone: '<path d="m5 12 4 4L19 6"/>', tempo: 2800 },
  info: { titulo: 'Informação', icone: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', tempo: 4500 },
  warning: { titulo: 'Confira antes de continuar', icone: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>', tempo: 7000 },
  error: { titulo: 'Não foi possível concluir', icone: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>', tempo: 8000 }
};
const ativos = new Map();
const fila = [];
export function limparNotificacoes() {
  fila.length = 0;
  for (const registro of [...ativos.values()]) registro.fechar(false);
}
const svg = desenho => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${desenho}</svg>`;

export function mostrarCarregando(texto) {
  let overlay = document.getElementById('flow-carregando');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'flow-carregando';
    overlay.className = 'flow-carregando';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="login-carregando-box"><span class="login-carregando-spinner"></span><span id="flow-carregando-texto"></span></div>';
    document.body.append(overlay);
  }
  const rotulo = overlay.querySelector('#flow-carregando-texto');
  if (rotulo) rotulo.textContent = texto || 'Carregando…';
  overlay.classList.add('ativo');
  overlay.setAttribute('aria-busy', 'true');
}

export function fecharCarregando() {
  const overlay = document.getElementById('flow-carregando');
  if (!overlay) return;
  overlay.classList.remove('ativo');
  overlay.setAttribute('aria-busy', 'false');
}

export function showToast(mensagem, tipo = 'info', opcoes = {}) {
  if (document.getElementById('modal-login-operador')?.classList.contains('active')) return;
  if (!tipos[tipo]) tipo = 'info';
  if (typeof opcoes === 'number') opcoes = { duracao: opcoes };
  opcoes = opcoes || {};
  const texto = String(mensagem ?? '').replace(/^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+/u, '').trim();
  if (!texto) return;
  const chave = `${tipo}:${opcoes.chave || texto}`;
  const pedida = Number(opcoes.duracao);
  const item = { chave, texto, tipo, titulo: opcoes.titulo || tipos[tipo].titulo,
    duracao: Number.isFinite(pedida) && pedida > 0 ? pedida : tipos[tipo].tempo };
  if (ativos.has(chave)) { ativos.get(chave).atualizar(item); return; }
  const pendente = fila.findIndex(v => v.chave === chave);
  if (pendente >= 0) { fila[pendente] = item; return; }
  if (ativos.size >= 3) {
    // Um erro nunca é substituído por uma confirmação de rotina.
    const transitorio = [...ativos.values()].find(v => v.tipo === 'success' || v.tipo === 'info');
    if (transitorio) transitorio.fechar(false);
    else { fila.push(item); return; }
  }
  exibir(item);
}

function exibir(item) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('section');
    container.id = 'toast-container';
    container.className = 'flow-notifications';
    container.setAttribute('aria-label', 'Notificações');
    document.body.append(container);
  }
  container.className = 'flow-notifications';
  const toast = document.createElement('div');
  toast.className = `flow-notice flow-notice--${item.tipo}`;
  const icon = document.createElement('span');
  icon.className = 'flow-notice__icon';
  icon.innerHTML = svg(tipos[item.tipo].icone);
  const conteudo = document.createElement('div');
  conteudo.className = 'flow-notice__content';
  conteudo.setAttribute('role', item.tipo === 'error' ? 'alert' : 'status');
  conteudo.setAttribute('aria-atomic', 'true');
  const titulo = document.createElement('strong'), texto = document.createElement('p');
  conteudo.append(titulo, texto);
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.className = 'flow-notice__close';
  fechar.setAttribute('aria-label', 'Fechar notificação');
  fechar.innerHTML = svg('<path d="m6 6 12 12M18 6 6 18"/>');
  toast.append(icon, conteudo, fechar);
  let timer, restante, inicio, encerrado = false;
  const pausar = () => { clearTimeout(timer); if (inicio) restante = Math.max(0, restante - (Date.now() - inicio)); inicio = 0; };
  const retomar = () => {
    clearTimeout(timer);
    if (!item.duracao || document.hidden || toast.matches(':hover') || toast.contains(document.activeElement)) return;
    inicio = Date.now(); timer = setTimeout(() => registro.fechar(), restante);
  };
  const visibilidade = () => document.hidden ? pausar() : retomar();
  const registro = {
    tipo: item.tipo,
    atualizar(novo) {
      item = novo; restante = novo.duracao; inicio = 0;
      titulo.textContent = novo.titulo; texto.textContent = novo.texto;
      retomar();
    },
    fechar(processarFila = true) {
      if (encerrado) return;
      encerrado = true; clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilidade);
      ativos.delete(item.chave); toast.remove();
      if (processarFila && fila.length) exibir(fila.shift());
    }
  };
  fechar.addEventListener('pointerdown', e => e.preventDefault());
  fechar.addEventListener('click', () => registro.fechar());
  toast.addEventListener('mouseenter', pausar);
  toast.addEventListener('mouseleave', retomar);
  toast.addEventListener('focusin', pausar);
  toast.addEventListener('focusout', () => setTimeout(retomar, 0));
  document.addEventListener('visibilitychange', visibilidade);
  ativos.set(item.chave, registro);
  container.append(toast);
  registro.atualizar(item);
}
