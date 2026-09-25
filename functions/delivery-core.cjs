const { HttpsError } = require('firebase-functions/v2/https');
const fail = (message, code = 'invalid-argument') => { throw new HttpsError(code, message); };
function cep(value) {
  if (typeof value !== 'string' || !/^\d{5}-?\d{3}$/.test(value)) fail('Informe um CEP com oito dígitos.');
  return value.replace('-', '');
}
function inteiro(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('Valor de delivery inválido.');
  return value;
}
function normalizarHorarios(horarios) {
  if (horarios == null) return null;
  if (typeof horarios !== 'object' || !Array.isArray(horarios.periodos) || horarios.periodos.length > 28
    || typeof horarios.fuso !== 'string' || horarios.fuso.length > 80) fail('Horários de delivery inválidos.');
  try { new Intl.DateTimeFormat('en', { timeZone: horarios.fuso }).format(); } catch { fail('Fuso horário inválido.'); }
  const periodos = horarios.periodos.map(p => {
    if (!p || typeof p !== 'object') fail('Período inválido.');
    const dia = inteiro(p.dia, 0, 6), inicio = inteiro(p.inicio, 0, 1439), fim = inteiro(p.fim, 1, 1440);
    if (inicio >= fim) fail('O fim deve ser posterior ao início; divida a madrugada entre os dois dias.');
    return { dia, inicio, fim };
  }).sort((a,b) => a.dia - b.dia || a.inicio - b.inicio);
  for (let i=1;i<periodos.length;i++) if (periodos[i].dia === periodos[i-1].dia && periodos[i].inicio < periodos[i-1].fim) fail('Horários sobrepostos.');
  return { fuso: horarios.fuso, periodos };
}
function abertoNoHorario(horarios, agora = new Date()) {
  if (!horarios) return true;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: horarios.fuso, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const part = type => parts.find(p => p.type === type).value;
  const dia = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday')), minuto = Number(part('hour')) * 60 + Number(part('minute'));
  return horarios.periodos.some(p => p.dia === dia && minuto >= p.inicio && minuto < p.fim);
}
function normalizarDelivery(config) {
  if (!config || typeof config.ativo !== 'boolean' || !Array.isArray(config.regioes) || config.regioes.length > 50) fail('Configuração de delivery inválida.');
  const pedidoMinimoCentavos = inteiro(config.pedidoMinimoCentavos, 0, 1000000), ids = new Set();
  const regioes = config.regioes.map(r => {
    if (!r || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(r.id) || ids.has(r.id)
      || typeof r.nome !== 'string' || !r.nome.trim() || r.nome.trim().length > 80) fail('Região de entrega inválida ou repetida.');
    ids.add(r.id);
    const cepInicial = cep(r.cepInicial), cepFinal = cep(r.cepFinal);
    if (cepInicial > cepFinal) fail('Faixa de CEP invertida.');
    return { id: r.id, nome: r.nome.trim(), cepInicial, cepFinal, taxaCentavos: inteiro(r.taxaCentavos, 0, 100000), prazoMinutos: inteiro(r.prazoMinutos, 1, 1440) };
  }).sort((a,b) => a.cepInicial.localeCompare(b.cepInicial));
  if (config.ativo && !regioes.length) fail('Cadastre uma região antes de ativar o delivery.');
  for (let i = 1; i < regioes.length; i++) if (regioes[i].cepInicial <= regioes[i-1].cepFinal) fail('As faixas de CEP não podem se sobrepor.');
  return { ativo: config.ativo, pedidoMinimoCentavos, regioes, ...(config.horarios != null ? { horarios: normalizarHorarios(config.horarios) } : {}) };
}
function cotarDelivery(config, destinoCep, subtotalCentavos, agora = new Date()) {
  const c = normalizarDelivery(config), destino = cep(destinoCep);
  inteiro(subtotalCentavos, 0, 1000000);
  if (!c.ativo) fail('Delivery indisponível nesta loja.', 'failed-precondition');
  if (!abertoNoHorario(c.horarios, agora)) fail('Delivery fora do horário de atendimento.', 'failed-precondition');
  const regiao = c.regioes.find(r => destino >= r.cepInicial && destino <= r.cepFinal);
  if (!regiao) fail('CEP fora da área de entrega.', 'failed-precondition');
  if (subtotalCentavos < c.pedidoMinimoCentavos) fail('O valor dos produtos não atinge o pedido mínimo para entrega.', 'failed-precondition');
  const totalCentavos = subtotalCentavos + regiao.taxaCentavos;
  if (totalCentavos > 1000000) fail('Pedido com entrega excede o limite permitido.');
  return { regiaoId: regiao.id, regiaoNome: regiao.nome, subtotalCentavos, taxaEntregaCentavos: regiao.taxaCentavos, totalCentavos, prazoMinutos: regiao.prazoMinutos, pedidoMinimoCentavos: c.pedidoMinimoCentavos };
}
function normalizarEntrega(data) {
  const texto = (v, max, opcional=false) => {
    if (opcional && v == null) return '';
    if (typeof v !== 'string' || (!opcional && !v.trim()) || v.trim().length > max || /[\x00-\x1f\x7f]/.test(v)) fail('Confira os dados de contato e endereço.');
    return v.trim();
  };
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Informe contato e endereço para entrega.');
  const telefone = texto(data.telefone, 25).replace(/[ ()+-]/g, '');
  if (!/^\d{10,11}$/.test(telefone)) fail('Informe telefone com DDD, sem código do país.');
  const uf = texto(data.uf, 2).toUpperCase();
  if (!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(uf)) fail('Informe a UF da entrega.');
  return { nome: texto(data.nome, 80), telefone, cep: cep(data.cep), logradouro: texto(data.logradouro, 120), numero: texto(data.numero, 20),
    complemento: texto(data.complemento, 120, true), bairro: texto(data.bairro, 80), cidade: texto(data.cidade, 80), uf };
}
module.exports = { normalizarDelivery, cotarDelivery, normalizarEntrega, normalizarHorarios, abertoNoHorario };
