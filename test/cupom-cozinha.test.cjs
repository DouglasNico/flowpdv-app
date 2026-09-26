const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/js/cupom-cozinha.js'), 'utf8').replace(/export /g, '');
const context = {}; vm.runInNewContext(source, context);
const pedido = { pedidoId: 'pedido-teste', mesaNome: 'Mesa 2', itens: [{ nome: '<script>ruim</script>', quantidade: 2, observacao: '<img src=x onerror=alert(1)>', opcoes: [{ nome: 'Bacon & queijo', quantidade: 1 }] }] };

test('combo mostra quantidade inclusa por unidade, bebida e adicionais separados sem executar HTML', () => {
  const item = { ...pedido.itens[0], variante: 'combo', componentes: [{ nome: 'Lanche', quantidade: 1 }, { nome: 'Batata <img>', quantidade: 2 }, { nome: 'Coca & gelo', quantidade: 1 }] };
  const html = context.gerarCupomCozinha({ ...pedido, itens: [item] });
  assert.match(html, /Combo — incluso por unidade: 2 × Batata &lt;img&gt;, 1 × Coca &amp; gelo/);
  assert.match(html, /Bacon &amp; queijo/);
  assert.ok(!html.includes('<img>'));
});
test('cupom de entrega separa taxa, total, pagamento e endereço sem executar HTML',()=>{
 const html=context.gerarCupomEntrega({pedidoId:'teste',entrega:{nome:'<script>Cliente</script>',telefone:'11999999999',logradouro:'Rua A',numero:'1',complemento:'',bairro:'Centro',cidade:'Teste',uf:'SP',cep:'01000000'},itens:[{nome:'Lanche',quantidade:1,totalCentavos:1000}],taxaEntregaCentavos:500,totalCentavos:1500,pagamento:'pendente',responsavel:'Entregador'}, {papelMm:58});
 assert.match(html,/size:58mm/);assert.match(html,/&lt;script&gt;Cliente/);assert.ok(!html.includes('<script>'));assert.match(html,/Taxa de entrega:/);assert.match(html,/15,00/);assert.match(html,/Pagamento: pendente/);assert.match(html,/SEM IMPRESSÃO FÍSICA/);
 const kitchen=context.gerarCupomCozinha({...pedido,tipo:'delivery',entrega:{nome:'Contato privado'}});assert.match(kitchen,/<h2>Delivery<\/h2>/);assert.ok(!kitchen.includes('Contato privado'));
});
test('aviso de cancelamento é destacado e escapa o motivo', () => {
  const html = context.gerarCupomCozinha({ ...pedido, avisoCancelamento: 'Cancelado <script>teste</script>' });
  assert.match(html, /CANCELAMENTO — NÃO PREPARAR/); assert.match(html, /Cancelado &lt;script&gt;/);
});
test('cupom de preparo escapa conteúdo, conserva observações e identifica outra via e largura', () => {
  const html = context.gerarCupomCozinha(pedido, { papelMm: 58, via: 2 });
  assert.ok(html.includes('size:58mm')); assert.ok(html.includes('REIMPRESSÃO')); assert.ok(html.includes('OBS.: &lt;img'));
  assert.ok(html.includes('Bacon &amp; queijo')); assert.ok(html.includes('(por unidade)')); assert.ok(!html.includes('<script>'));
});
test('simulação não chama impressão física e gera prévia claramente identificada', async () => {
  let html;
  const result = await context.enviarCupomCozinha(pedido, { api: { ambienteTeste: true, printThermalReceipt() { throw new Error('Impressora real acessada'); } }, preview: value => { html = value; } });
  assert.equal(result, 'simulado'); assert.match(html, /SEM IMPRESSÃO FÍSICA/);
});
test('adaptador exige impressora escolhida e distingue driver de confirmação física', async () => {
  let received;
  const api = { ambienteTeste: false, async printThermalReceipt(...args) { received = args; return { success: true }; } };
  await assert.rejects(context.enviarCupomCozinha(pedido, { api }), /Selecione/);
  assert.equal(await context.enviarCupomCozinha(pedido, { api, impressora: 'Cozinha USB', papelMm: 80 }), 'enviado_driver');
  assert.equal(received[2].deviceName, 'Cozinha USB'); assert.equal(received[2].papelMm, 80);
  api.printThermalReceipt = async () => ({ success: false });
  assert.equal(await context.enviarCupomCozinha(pedido, { api, impressora: 'Cozinha USB' }), 'incerto');
});
test('painel de cozinha não inicializa fora do ambiente de teste', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../src/js/cozinha-teste.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '');
  vm.runInNewContext(ui + '\ninstalarCozinhaTeste();', { window: {}, document: { getElementById() { throw new Error('DOM acessado'); } } });
});
