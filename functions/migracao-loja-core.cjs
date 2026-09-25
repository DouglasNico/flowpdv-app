const { createHash } = require('node:crypto');
const { planejarSaldoLegado } = require('./estoque-migracao-core.cjs');
const decode = value => {
  if ('nullValue' in value) return null;
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  for (const key of ['stringValue', 'booleanValue', 'timestampValue', 'nullValue']) if (key in value) return value[key];
  throw new Error('Tipo Firestore não suportado; revise a origem.');
};
const documentData = doc => decode({ mapValue: { fields: doc.fields || {} } });
function prepararMigracaoLoja(snapshot, { slug }) {
  const chave = snapshot.key;
  if (!/^LIC-FLOW-[A-Z0-9-]+$/.test(chave) || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) throw new Error('Licença ou endereço inválido.');
  const required = name => {
    const doc = snapshot.snaps[`${name}/${chave}`];
    if (!doc?.updateTime) throw new Error(`Origem ausente: ${name}.`);
    return documentData(doc);
  };
  const license = required('licencas'), backup = required('backups_lojas'), publicCatalog = required('cardapio_publico'), config = required('cardapio_config');
  let products = backup.produtos || [];
  if (!products.length) {
    const count = backup.partes?.produtos;
    if (!Number.isSafeInteger(count) || count < 0 || count > 100) throw new Error('Manifesto de produtos inválido.');
    products = [];
    for (let i = 0; i < count; i++) {
      const part = snapshot.snaps[`backups_lojas/${chave}/partes/produtos_${i}`];
      if (!part?.updateTime || !Array.isArray(documentData(part).itens)) throw new Error('Parte de produtos incompleta.');
      products.push(...documentData(part).itens);
    }
  }
  if (products.length > 200 || new Set(products.map(p => String(p.id))).size !== products.length) throw new Error('Produtos duplicados ou limite V2 excedido.');
  const lojaId = `legado-${chave.toLowerCase()}`, base = `lojas_v2/${lojaId}`, docs = [], issues = [];
  const add = (path, data) => docs.push({ path, data });
  const id = value => { const s = String(value); if (!/^[A-Za-z0-9_-]{1,80}$/.test(s)) throw new Error('ID incompatível: ' + s); return s; };
  const money = value => { const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 10000) throw new Error('Preço inválido.'); return Math.round(n * 100); };
  const published = new Map((publicCatalog.produtos || []).map(p => [String(p.id), p]));
  const catalog = products.map(p => {
    const produtoId = id(p.id), source = published.get(produtoId);
    if (typeof p.controlarEstoque !== 'boolean') issues.push({ tipo: 'controle_estoque_indefinido', produtoId });
    if (p.controlarEstoque === true) {
      try {
        const plano = planejarSaldoLegado({ ...p, unidade: p.unidade || p.unidadeMedida });
        add(`${base}/preparacao_estoque/${produtoId}`, { plano, confirmadoNoTerminal: false, origemBackupEm: backup.atualizadoEm || null });
      } catch (error) { issues.push({ tipo: 'saldo_nao_convertido', produtoId, motivo: error.message }); }
    }
    add(`${base}/produtos_legados/${produtoId}`, { produto: p });
    const groups = (source?.grupos || []).map(g => {
      const precoGrupo = money(g.precoGrupo || 0);
      if (precoGrupo && g.max !== 1) issues.push({ tipo: 'preco_grupo_requer_revisao', produtoId, grupoId: g.id });
      if (/combo/i.test(g.nome || '') || g.inclusoNome) issues.push({ tipo: 'combo_legado_sem_composicao', produtoId, grupoId: g.id });
      return { id: id(g.id), nome: g.nome, min: g.min, max: g.max,
        opcoes: (g.opcoes || []).map(o => ({ id: id(o.id), nome: o.nome, ativo: true,
          precoCentavos: money(o.preco) + (g.max === 1 ? precoGrupo : 0), maxQuantidade: 1 })) };
    });
    if (groups.length) issues.push({ tipo: 'mapear_estoque_das_opcoes', produtoId });
    return { id: produtoId, nome: p.nome, precoCentavos: money(source?.preco ?? p.precoVenda), ativo: !!source,
      esgotado: source?.esgotado === true, categoria: source?.categoria || p.categoria || 'Outros',
      descricao: source?.descricao || '', imagemUrl: source?.fotoUrl || '',
      fotoEnquadramento: source?.fotoEnquadramento || null, grupos: groups,
      migracaoRequerRevisao: true };
  });
  const orders = snapshot.lists[`backups_lojas/${chave}/pedidos`];
  if (!Array.isArray(orders)) throw new Error('Inventário de pedidos ausente.');
  const active = [];
  for (const doc of orders) {
    const pedidoId = id(doc.name.split('/').at(-1)), order = documentData(doc);
    if (!['entregue', 'cancelado'].includes(order.status)) active.push(pedidoId);
    add(`${base}/historico_legado/${pedidoId}`, { pedido: order, origem: doc.name, origemUpdateTime: doc.updateTime, somenteArquivo: true });
  }
  if (active.length) issues.push({ tipo: 'pedidos_em_andamento', pedidoIds: active });
  for (const [i, table] of (backup.comandas || []).entries()) if (table.itens?.length || !['livre', 'fechada'].includes(table.status)) issues.push({ tipo: 'comanda_requer_conferencia', indice: i });
  add(`${base}/origem_legada/configuracao`, { config, comandas: backup.comandas || [], categorias: backup.categorias || [] });
  add(`${base}/origem_legada/catalogo_publicado`, publicCatalog);
  for (const doc of snapshot.lists[`cardapio_config/${chave}/produtos`] || []) {
    add(`${base}/overlays_legados/${id(doc.name.split('/').at(-1))}`, documentData(doc));
  }
  const modulos = { cardapio: false, mesas: false, retirada: false, combos: license.modulos?.combos === true };
  add(base, { nome: license.nome || publicCatalog.nome, slug, ativo: false, modulos,
    chaveLicencaLegada: chave, migracao: { schema: 1, estado: 'preparada', requerConferencia: true },
    ativacaoOperacionalV2: { schema: 1, estado: 'suspensa', ambiente: 'homologacao', revisao: 1 } });
  add(`catalogos_publicos_v2/${slug}`, { nome: publicCatalog.nome, versao: 1, publicado: false, pausado: true,
    publicacaoManual: true, produtos: catalog, canais: { mesas: false, retirada: false, delivery: false } });
  add(`rotas_publicas_v2/${slug}`, { lojaId });
  const sourceDocs = [...Object.values(snapshot.snaps), ...Object.values(snapshot.lists).flat()];
  if (sourceDocs.some(d => !d.updateTime || !d.name) || new Set(sourceDocs.map(d => d.name)).size !== sourceDocs.length) throw new Error('Versões de origem incompletas ou duplicadas.');
  const fingerprint = createHash('sha256').update(JSON.stringify(sourceDocs.map(d => [d.name, d.updateTime]).sort())).digest('hex');
  const resumo = { chave, lojaId, slug, produtos: products.length, publicadosNaOrigem: published.size,
    saldosPreparados: docs.filter(d => d.path.includes('/preparacao_estoque/')).length,
    semControleEstoque: products.filter(p => p.controlarEstoque === false).length, pedidosArquivados: orders.length,
    pedidosEmAndamento: active.length, pendencias: issues, fingerprint, corteOperacional: false };
  add(`migracoes_v2/${chave}`, { ...resumo, estado: 'preparada', capturadoEm: snapshot.capturadoEm });
  if (docs.length + sourceDocs.length > 450) throw new Error('Migração excede lote seguro; exige paginação planejada.');
  return { docs, sourceDocs, resumo };
}
module.exports = { prepararMigracaoLoja, documentData, decode };
