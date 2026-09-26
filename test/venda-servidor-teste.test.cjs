const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../functions/venda-local-core.cjs');
test('backup em armazenamento vazio retoma venda ou cancelamento com IDs originais sem nova baixa', async () => {
  const backupCtx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/backup-homologacao.js'), 'utf8').replace('export function', 'function'), backupCtx);
  for (const falha of ['baixa', 'ack', 'cancelar']) {
    const f = fixture(); f.storage.setItem('flowpdv_device_id', 'device');
    const p = f.create().preparar(f.produto, '250', '10');
    f.lose(falha === 'cancelar' ? 'baixa' : falha); await assert.rejects(f.create().executar(p));
    if (falha === 'cancelar') { f.lose('cancelar'); await assert.rejects(f.create().cancelar('Cliente desistiu da compra', true)); }
    const origem = { ...f.storage, get length() { return f.data.size; }, key: i => [...f.data.keys()][i] };
    const opts = { ambienteTeste: true, contexto: { lojaId: 'loja', terminalId: 'device', terminalUid: 'uid-original' } };
    const pacote = backupCtx.criarBackupHomologacao({ ...opts, storage: origem }).exportar();
    const dados = new Map(), destino = { get length() { return dados.size; }, key: i => [...dados.keys()][i], getItem: k => dados.get(k) ?? null, setItem: (k, v) => dados.set(k, v), removeItem: k => dados.delete(k) };
    backupCtx.criarBackupHomologacao({ ...opts, storage: destino, destinoIsolado: true }).restaurar(pacote);
    const novo = { localStorage: destino, window: { electronAPI: { ambienteTeste: true } }, console };
    vm.createContext(novo);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/perfil-operacional-v2.js'),'utf8').replace(/export function /g,'function '),novo);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/js/storage.js'), 'utf8').replace(/^import .*;\r?$/gm, '').replace('export const ', 'var '), novo);
    novo.StorageService.getLicenca = () => null;
    const ponte = f.create({ storage: destino, servico: novo.StorageService });
    if (falha === 'cancelar') await ponte.cancelar(); else await ponte.executar();
    assert.equal(f.stock(), falha === 'cancelar' ? 2500 : 2250);
    assert.equal(novo.StorageService.getVendas().length, falha === 'cancelar' ? 0 : 1);
    assert.equal(ponte.pendente(), null);
    if (falha !== 'cancelar') {
      assert.equal(novo.StorageService.getVendas()[0].id, p.venda.id);
      assert.equal(novo.StorageService.getVendas()[0].trocoCentavos, 500);
      assert.equal(novo.StorageService.getProdutos()[0].estoque, 2250);
      assert.equal(novo.StorageService.getMovimentosEstoque().length, 0);
    }
  }
});
function fixture(){
 const produto={id:'farinha',nome:'Farinha',estoque:2500,unidade:'g',preco:0.02},turno={id:'T',terminalId:'device',dataAbertura:'2026-09-21T10:00:00.000Z',status:'aberto'};
 const data=new Map([['adega_produtos',JSON.stringify([produto])],['adega_turno_atual',JSON.stringify(turno)],['flowpdv_migracoes_estoque_teste',JSON.stringify([{status:'confirmado',lojaId:'loja',produto}])]]);let failKey;
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(k===failKey){failKey=null;throw Error('Falha local');}data.set(k,v);},removeItem:k=>data.delete(k)};
 const ctx={core,estoqueCore:require('../functions/estoque-migracao-core.cjs'),localStorage:storage,window:{electronAPI:{ambienteTeste:true}},console};vm.createContext(ctx);
 for(const file of ['perfil-operacional-v2.js','storage.js','venda-servidor-teste.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),ctx);
 const service=ctx.StorageService;service.getDeviceId=()=> 'device';service.getLicenca=()=>null;
 let receipt,cancellation,lose='',wrongShop=false,ackCount=0;const balances=new Map([['farinha',2500]]);
 const call=async(name,p)=>{
   if(name==='consultarMeuTerminalV2') return {vinculado:true,lojaId:wrongShop?'outra':'loja',papel:'caixa'};
   if(name==='registrarBaixaVendaLocalV2'){
     if(cancellation)throw Error('Tentativa cancelada');
     if(lose==='antes'){lose='';throw Error('Conexão caiu antes da baixa');}
     if(!receipt){
       const itensSemEstoque=p.itens.filter(i=>service.getProdutos().find(v=>String(v.id)===i.legadoId).controlarEstoque===false).map(i=>i.legadoId);
       const consumos=p.itens.filter(i=>!itensSemEstoque.includes(i.legadoId)).map(i=>{const product=service.getProdutos().find(v=>String(v.id)===i.legadoId),converter=ctx.estoqueCore.planejarSaldoLegado;
         if(!balances.has(i.legadoId))balances.set(i.legadoId,converter(product).saldoMili);
         const quantidadeMili=converter({...product,estoque:i.quantidade}).saldoMili;
         balances.set(i.legadoId,balances.get(i.legadoId)-quantidadeMili);return {legadoId:i.legadoId,estoqueId:`stock-${i.legadoId}`,quantidadeMili};});
       receipt={reciboId:'receipt',vendaId:p.vendaId,lojaId:'loja',turno:p.turno,venda:core.normalizarVendaLocal(p),consumos,...(itensSemEstoque.length?{itensSemEstoque}:{})};
     }
     if(lose==='baixa'){lose='';throw Error('Resposta perdida');}return {...receipt,venda:{...receipt.venda,totalCentavos:receipt.venda.totalCentavos,itens:receipt.venda.itens,vendaId:receipt.venda.vendaId}};
   }
   if(name==='cancelarTentativaVendaLocalV2'){
     if(!cancellation){if(receipt)for(const c of receipt.consumos)balances.set(c.legadoId,balances.get(c.legadoId)+c.quantidadeMili);cancellation={cancelado:true,vendaId:p.vendaId,lojaId:'loja',estoqueDevolvido:!!receipt,motivo:p.motivo};}
     if(lose==='cancelar'){lose='';throw Error('Cancelamento com resposta perdida');}return cancellation;
   }
   ackCount++;if(lose==='ack'){lose='';throw Error('Ack perdido');}return {confirmado:true};
 };
 const create=(extra={})=>ctx.criarVendaServidorTeste({storage,servico:service,ambienteTeste:true,call,uuid:()=> 'UUID',agora:()=> '2026-09-21T11:00:00.000Z',...extra});
 return {produto,ctx,create,service,data,storage,stock:(id='farinha')=>balances.get(id),ackCount:()=>ackCount,lose:v=>{lose=v;},fail:k=>{failKey=k;},otherShop:()=>{wrongShop=true;}};
}
function addProduct(f,produto,lojaId='loja'){
 const products=JSON.parse(f.storage.getItem('adega_produtos'));products.push(produto);f.storage.setItem('adega_produtos',JSON.stringify(products));f.service._produtosMem=null;
 const migrations=JSON.parse(f.storage.getItem('flowpdv_migracoes_estoque_teste'));migrations.push({status:'confirmado',lojaId,produto});f.storage.setItem('flowpdv_migracoes_estoque_teste',JSON.stringify(migrations));
 return produto;
}

test('balcão misto grava produto sem estoque e baixa apenas o produto controlado uma vez', async () => {
 const f=fixture(),lanche=addProduct(f,{id:'lanche',nome:'Lanche',unidade:'un',precoVenda:18.9,estoque:0,controlarEstoque:false});
 const registros=JSON.parse(f.storage.getItem('flowpdv_migracoes_estoque_teste'));
 registros.find(r=>r.produto.id==='lanche').semEstoque=true;
 f.storage.setItem('flowpdv_migracoes_estoque_teste',JSON.stringify(registros));
 const ponte=f.create(),plano=ponte.prepararCarrinho([{produto:f.produto,quantidade:250},{produto:lanche,quantidade:1}],25);
 f.lose('ack');await assert.rejects(ponte.executar(plano));await ponte.executar();
 assert.equal(f.stock(),2250);assert.equal(f.service.getVendas().length,1);
 assert.deepEqual(Array.from(f.service.getVendas()[0].estoqueServidorV2.itensSemEstoque),['lanche']);
 assert.equal(f.service.getProdutos().find(p=>p.id==='lanche').estoque,0);
 assert.throws(()=>ponte.preparar(lanche,'0.5',20),/inteiras/);
 registros.find(r=>r.produto.id==='lanche').semEstoque=false;
 f.storage.setItem('flowpdv_migracoes_estoque_teste',JSON.stringify(registros));
 assert.throws(()=>ponte.preparar(lanche,1,20),/migração sem estoque/);
});
test('cadastro real precoVenda determina cobrança e recibo, preservando compatibilidade com preco antigo',async()=>{
 const f=fixture();f.produto.precoVenda=0.03;
 const p=f.create().preparar(f.produto,'250','10');assert.equal(p.payload.totalCentavos,750);assert.equal(p.payload.itens[0].precoUnitarioCentavos,3);
 await f.create().executar(p);assert.equal(f.service.getVendas()[0].itens[0].precoUnitario,0.03);assert.equal(f.service.getVendas()[0].total,7.5);
 assert.equal(core.precoProdutoLocalCentavos({preco:8}),800);assert.equal(core.precoProdutoLocalCentavos({precoVenda:0,preco:8}),0);
 for(const precoVenda of [null,undefined,'',true,'1,25',-1,0.001,Infinity,1e20])assert.throws(()=>core.precoProdutoLocalCentavos({precoVenda,preco:8}),/Preço local inválido/);
 assert.throws(()=>core.precoProdutoLocalCentavos({}),/Preço local inválido/);
});
test('dinheiro recebido e troco são persistidos sem aumentar ou descontar duas vezes a receita',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250','10,00');assert.equal(p.payload.recebidoDinheiroCentavos,1000);assert.equal(p.payload.trocoCentavos,500);
 await f.create().executar(p);const sale=f.service.getVendas()[0];assert.equal(sale.total,5);assert.equal(sale.recebidoDinheiroCentavos,1000);assert.equal(sale.trocoCentavos,500);
 for(const file of ['merge-core.js','resumo-restaurante-caixa.js','conciliacao-turno.js','resumo-financeiro-caixa.js','caixa.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),f.ctx);
 const summary=f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getTurnoAtual());assert.equal(summary.totalVendas,5);assert.equal(summary.totalDinheiro,5);assert.equal(summary.saldoEmGaveta,5);
 assert.equal(f.ctx.resumoConciliacao(f.service.getTurnoAtual(),f.service.getVendas(),[]).total,500);
 f.ctx.ExcelJS=require('exceljs');f.ctx.AuthModule={isGerente:()=>true};f.ctx.window.App={showToast(){}};f.service.getConfig=()=>({});f.service.formatarNumeroTurno=id=>id;
 let exported;f.ctx.CaixaModule.salvarArquivoExcel=async book=>{exported=new f.ctx.ExcelJS.Workbook();await exported.xlsx.load(await book.xlsx.writeBuffer());};
 await f.ctx.CaixaModule.exportarTurnoExcel('T');const sheet=exported.worksheets.find(s=>s.getCell('H4').value==='Valor Pago (R$)');
 assert.ok(sheet);assert.equal(sheet.getCell('G5').value,5);assert.equal(sheet.getCell('H5').value,10);assert.equal(sheet.getCell('I5').value,5);assert.equal(exported.worksheets[0].getCell('B17').value,5);
});
test('dinheiro inválido ou insuficiente e troco adulterado são recusados antes de gravar',()=>{
 const f=fixture();for(const cash of ['4,99','-10','10,001','1.000,00','Infinity','NaN','1e2','10000001'])assert.throws(()=>f.create().preparar(f.produto,'250',cash));
 assert.equal(f.create().pendente(),null);const p=f.create().preparar(f.produto,'250','5,00');assert.equal(p.payload.trocoCentavos,0);
 assert.throws(()=>core.normalizarVendaLocal({...p.payload,trocoCentavos:1}));assert.throws(()=>core.normalizarVendaLocal({...p.payload,recebidoDinheiroCentavos:500.1}));
});
test('falhas preservam dinheiro e troco originais e não aceitam novo valor na retomada',async()=>{
 for(const stage of ['baixa','disco','ack']){
 const f=fixture(),p=f.create().preparar(f.produto,'250','10');if(stage==='disco')f.fail('adega_vendas');else f.lose(stage);
 await assert.rejects(f.create().executar(p));await assert.rejects(f.create().executar({...p,payload:{...p.payload,recebidoDinheiroCentavos:2000,trocoCentavos:1500}}));
 await f.create().executar();assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].trocoCentavos,500);assert.equal(f.stock(),2250);
 }
});
test('pendência antiga sem campos de troco continua recuperável',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');
 for(const k of ['recebidoDinheiroCentavos','trocoCentavos','valorPago','troco']){delete p.payload[k];delete p.venda[k];}
 f.lose('baixa');await assert.rejects(f.create().executar(p));await f.create().executar();
 assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].total,5);assert.equal(f.stock(),2250);
});
test('armazenamento real recusa dinheiro local divergente do comprovante',()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250','10'),r={reciboId:'receipt',vendaId:p.venda.id,lojaId:'loja',turno:p.payload.turno,venda:core.normalizarVendaLocal(p.payload),consumos:[{legadoId:'farinha',estoqueId:'stock',quantidadeMili:250}]};
 assert.throws(()=>f.service.saveVendaComEstoqueServidorTeste({...p.venda,trocoCentavos:499},r),/troco/);assert.equal(f.service.getVendas().length,0);
});
test('carrinho grava uma venda com dois produtos e converte unidades sem baixa local duplicada',async()=>{
 const f=fixture(),extra=addProduct(f,{id:'acucar',nome:'Açúcar',unidade:'kg',estoque:1,preco:8});
 const p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'},{produto:extra,quantidade:'0,25'}]);
 assert.equal(p.payload.totalCentavos,700);await f.create().executar(p);await f.create().executar(p);
 assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].itens.length,2);assert.equal(f.service.getVendas()[0].total,7);
 assert.equal(f.stock(),2250);assert.equal(f.stock('acucar'),750);assert.equal(f.service.getProdutos()[0].estoque,2250);assert.equal(f.service.getProdutos()[1].estoque,0.75);assert.equal(f.service.getMovimentosEstoque().length,0);
});
test('carrinho recupera falhas sem dividir a venda nem repetir qualquer consumo',async()=>{
 for(const stage of ['baixa','disco','ack']){
 const f=fixture(),extra=addProduct(f,{id:'acucar',nome:'Açúcar',unidade:'kg',estoque:1,preco:8});
 const p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'},{produto:extra,quantidade:'0.25'}]);
 if(stage==='disco')f.fail('adega_vendas');else f.lose(stage);await assert.rejects(f.create().executar(p));await f.create().executar();
 assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].itens.length,2);assert.equal(f.stock(),2250);assert.equal(f.stock('acucar'),750);
 }
});
test('cancelamento de carrinho pendente devolve ambos os consumos uma vez',async()=>{
 const f=fixture(),extra=addProduct(f,{id:'acucar',nome:'Açúcar',unidade:'kg',estoque:1,preco:8});
 const p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'},{produto:extra,quantidade:'0.25'}]);f.lose('baixa');await assert.rejects(f.create().executar(p));
 f.lose('cancelar');await assert.rejects(f.create().cancelar('Cliente desistiu do carrinho',true));await f.create().cancelar();
 assert.equal(f.stock(),2500);assert.equal(f.stock('acucar'),1000);assert.equal(f.service.getVendas().length,0);
});
test('carrinho recusa loja misturada, duplicatas, excesso, vazio e precisão inválida antes de criar pendência',()=>{
 const f=fixture(),line={produto:f.produto,quantidade:'250'},extra=addProduct(f,{id:'outro',nome:'Outro',unidade:'un',estoque:10,preco:2},'outra');
 for(const lines of [[],[line,line],Array(31).fill(line),[line,{produto:extra,quantidade:'1'}],[line,{produto:{id:'inexistente'},quantidade:'1'}],[{...line,quantidade:'0.5'}]])assert.throws(()=>f.create().prepararCarrinho(lines));
 assert.equal(f.create().pendente(),null);assert.equal(f.service.getVendas().length,0);
});
test('grava venda real pelo StorageService, baixa remota única e espelha o saldo na vitrine',async()=>{
 const f=fixture(),bridge=f.create(),p=bridge.preparar(f.produto,'250');await bridge.executar(p);
 assert.equal(f.stock(),2250);assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].total,5);assert.equal(f.service.getProdutos()[0].estoque,2250);assert.equal(f.service.getMovimentosEstoque().length,0);assert.equal(bridge.pendente(),null);
 await bridge.executar(p);assert.equal(f.stock(),2250);assert.equal(f.service.getVendas().length,1);
});
test('resposta perdida, falha de disco e confirmação perdida retomam sem dupla baixa nem venda',async()=>{
 for(const stage of ['baixa','disco','discoTurno','ack']){
 const f=fixture(),p=f.create().preparar(f.produto,'250');if(stage==='disco')f.fail('adega_vendas');else if(stage==='discoTurno')f.fail('adega_turno_atual');else f.lose(stage);
 await assert.rejects(f.create().executar(p));assert.ok(f.create().pendente());assert.throws(()=>f.service.exigirVendaRecuperada());
 await f.create().executar();assert.equal(f.stock(),2250);assert.equal(f.service.getVendas().length,1);assert.equal(f.create().pendente(),null);assert.equal(f.service.getProdutos()[0].estoque,2250);
 }
});
test('pendência não aceita outra venda e vínculo de outra loja impede baixa',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('baixa');await assert.rejects(f.create().executar(p));
 await assert.rejects(f.create().executar({...p,venda:{...p.venda,id:'OUTRA'}}));assert.throws(()=>f.create().preparar(f.produto,'100'));
 const g=fixture(),plan=g.create().preparar(g.produto,'250');g.otherShop();await assert.rejects(g.create().executar(plan),/loja/);assert.equal(g.stock(),2500);assert.equal(g.create().pendente(),null);
});
test('validação recusa total divergente, linhas duplicadas e quantidade negativa',()=>{
 const f=fixture();assert.throws(()=>f.create().preparar(f.produto,'0,5'),/precisão/);assert.equal(f.create().pendente(),null);
 const item={legadoId:'p',quantidade:'1',precoUnitarioCentavos:100};
 for(const patch of [{totalCentavos:99},{itens:[item,item],totalCentavos:200},{itens:[{...item,quantidade:'-1'}]}])assert.throws(()=>core.normalizarVendaLocal({vendaId:'V',itens:[item],totalCentavos:100,...patch}));
});
test('cancelamento após resposta perdida devolve estoque sem criar venda ou alterar caixa',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250'),turn=f.data.get('adega_turno_atual');f.lose('baixa');
 await assert.rejects(f.create().executar(p));assert.equal(f.stock(),2250);
 await f.create().cancelar('Cliente desistiu da compra',true);
 assert.equal(f.stock(),2500);assert.equal(f.service.getVendas().length,0);assert.equal(f.data.get('adega_turno_atual'),turn);assert.equal(f.create().pendente(),null);
 assert.equal(f.service.getProdutos()[0].estoque,2500);assert.equal(f.service.getMovimentosEstoque().length,0);
});
test('decisão de cancelamento sobrevive à recarga e resposta perdida sem repor duas vezes',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('baixa');await assert.rejects(f.create().executar(p));
 f.lose('cancelar');await assert.rejects(f.create().cancelar('Cliente desistiu da compra',true));assert.equal(f.stock(),2500);
 assert.ok(f.create().pendente().cancelamento);await assert.rejects(f.create().executar(),/cancelamento/);
 await f.create().cancelar();assert.equal(f.stock(),2500);assert.equal(f.create().pendente(),null);assert.equal(f.service.getVendas().length,0);
});
test('cancelar exige motivo, confirmação, loja e turno original antes de persistir decisão',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('baixa');await assert.rejects(f.create().executar(p));
 for(const [reason,confirmed] of [['curto',false],['x',true],['x'.repeat(181),true]]) await assert.rejects(f.create().cancelar(reason,confirmed));
 assert.equal(f.create().pendente().cancelamento,undefined);assert.equal(f.stock(),2250);
 f.otherShop();await assert.rejects(f.create().cancelar('Cliente desistiu',true),/loja/);assert.equal(f.create().pendente().cancelamento,undefined);
 f.storage.setItem('adega_turno_atual',JSON.stringify({id:'outro',terminalId:'device',status:'aberto'}));await assert.rejects(f.create().cancelar('Cliente desistiu',true),/turno/);
});
test('venda com escrita iniciada ou confirmação pendente exige recuperação, nunca cancelamento',async()=>{
 for(const stage of ['disco','discoTurno','ack']){
 const f=fixture(),p=f.create().preparar(f.produto,'250');if(stage==='disco')f.fail('adega_vendas');else if(stage==='discoTurno')f.fail('adega_turno_atual');else f.lose(stage);
 await assert.rejects(f.create().executar(p));await assert.rejects(f.create().cancelar('Cliente desistiu',true),/estorno/);
 assert.equal(f.stock(),2250);await f.create().executar();assert.equal(f.service.getVendas().length,1);assert.equal(f.create().pendente(),null);
 }
});
test('falha ao persistir decisão impede cancelamento remoto e permite retomar a venda',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('baixa');await assert.rejects(f.create().executar(p));
 f.fail('flowpdv_venda_servidor_pendente');await assert.rejects(f.create().cancelar('Cliente desistiu',true));
 assert.equal(f.stock(),2250);assert.equal(f.create().pendente().cancelamento,undefined);await f.create().executar();assert.equal(f.service.getVendas().length,1);
});
test('cancelar antes de a baixa chegar não altera saldo nem caixa',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('antes');await assert.rejects(f.create().executar(p));
 const result=await f.create().cancelar('Cliente desistiu',true);assert.equal(result.estoqueDevolvido,false);
 assert.equal(f.stock(),2500);assert.equal(f.service.getVendas().length,0);assert.equal(f.create().pendente(),null);
});
test('falha ao limpar pendência após cancelar recupera sem devolver estoque outra vez',async()=>{
 const f=fixture(),p=f.create().preparar(f.produto,'250');f.lose('baixa');await assert.rejects(f.create().executar(p));
 const remove=f.storage.removeItem;let fail=true;f.storage.removeItem=k=>{if(fail){fail=false;throw Error('Disco indisponível');}return remove(k);};
 await assert.rejects(f.create().cancelar('Cliente desistiu',true));assert.equal(f.stock(),2500);assert.ok(f.create().pendente().cancelamento);
 await f.create().cancelar();assert.equal(f.stock(),2500);assert.equal(f.create().pendente(),null);
});

test('divisão manual conserva centavos, dinheiro líquido e resumo por forma',async()=>{
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'10',{'PIX':'1','Débito':'1','Crédito':'1'});
 await f.create().executar(p);const sale=f.service.getVendas()[0];assert.equal(sale.trocoCentavos,800);assert.equal(sale.valorPago,13);assert.equal(sale.pagamentos[0].valor,2);assert.equal(sale.pagamentos[0].valorEntregue,10);
 for(const file of ['merge-core.js','resumo-restaurante-caixa.js','conciliacao-turno.js','resumo-financeiro-caixa.js','caixa.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),f.ctx);
 const r=f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getTurnoAtual());assert.equal(r.totalVendas,5);assert.equal(r.totalDinheiro,2);assert.equal(r.saldoEmGaveta,2);assert.equal(r.totalPix,1);assert.equal(r.totalDebito,1);assert.equal(r.totalCredito,1);
 f.ctx.ExcelJS=require('exceljs');f.ctx.AuthModule={isGerente:()=>true};f.ctx.window.App={showToast(){}};f.service.getConfig=()=>({});f.service.formatarNumeroTurno=id=>id;
 let exported;f.ctx.CaixaModule.salvarArquivoExcel=async book=>{exported=new f.ctx.ExcelJS.Workbook();await exported.xlsx.load(await book.xlsx.writeBuffer());};
 await f.ctx.CaixaModule.exportarTurnoExcel('T');const sheet=exported.worksheets.find(s=>s.getCell('H4').value==='Valor Pago (R$)');assert.equal(sheet.getCell('G5').value,5);assert.equal(sheet.getCell('H5').value,13);assert.equal(sheet.getCell('I5').value,8);assert.match(sheet.getCell('D5').value,/PIX/);
});
test('voucher manual puro e misto baixam estoque e entram no resumo',async()=>{
 const f=fixture(),lines=[{produto:f.produto,quantidade:'250'}];
 const puro=f.create().prepararCarrinho(lines,'',{'Voucher':'5'});assert.equal(puro.payload.pagamentos[0].forma,'Voucher');assert.equal(puro.payload.recebidoDinheiroCentavos,0);
 await f.create().executar(puro);assert.equal(f.stock(),2250);assert.equal(f.service.getVendas()[0].formaPagamento,'Voucher');
 const g=fixture(),misto=g.create().prepararCarrinho(lines,'2',{'Voucher':'2','PIX':'1'});
 assert.equal(misto.payload.pagamentos.map(p=>p.forma).join(','),'Dinheiro,PIX,Voucher');
 await g.create().executar(misto);
 for(const file of ['merge-core.js','resumo-restaurante-caixa.js','conciliacao-turno.js','resumo-financeiro-caixa.js','caixa.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),g.ctx);
 const r=g.ctx.CaixaModule.calcularResumoFinanceiro(g.service.getTurnoAtual());assert.equal(r.totalVoucher,2);assert.equal(r.totalPix,1);assert.equal(r.totalDinheiro,2);
 assert.throws(()=>g.create().prepararCarrinho(lines,'',{'Voucher':'5,01'}));
});
test('pagamento totalmente eletrônico não gera dinheiro nem troco e recusa excesso',async()=>{
 const f=fixture(),lines=[{produto:f.produto,quantidade:'250'}];
 for(const forms of [{'PIX':'5,01'},{'PIX':'-1'},{'PIX':'1.001'},{Fiado:'5'}])assert.throws(()=>f.create().prepararCarrinho(lines,'',forms));
 assert.throws(()=>f.create().prepararCarrinho(lines,'10',{'PIX':'5'}));
 const p=f.create().prepararCarrinho(lines,'',{'PIX':'5'});assert.equal(p.payload.trocoCentavos,0);assert.equal(p.payload.recebidoDinheiroCentavos,0);await f.create().executar(p);assert.equal(f.service.getVendas()[0].pagamentos.length,1);
});
test('divisão recupera falhas sem trocar formas e rejeita divergência no armazenamento',async()=>{
 for(const stage of ['baixa','disco','ack']){
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'5',{'PIX':'3'});
 if(stage==='disco')f.fail('adega_vendas');else f.lose(stage);await assert.rejects(f.create().executar(p));
 await assert.rejects(f.create().executar({...p,payload:{...p.payload,pagamentos:[{forma:'PIX',valorCentavos:500}]}}));await f.create().executar();assert.equal(f.service.getVendas().length,1);assert.equal(f.stock(),2250);
 }
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'5',{'PIX':'3'}),r={reciboId:'receipt',vendaId:p.venda.id,lojaId:'loja',turno:p.payload.turno,venda:core.normalizarVendaLocal(p.payload),consumos:[{legadoId:'farinha'}]};
 assert.throws(()=>f.service.saveVendaComEstoqueServidorTeste({...p.venda,pagamentos:[{forma:'Dinheiro',valor:5}]},r),/Pagamentos/);
});

test('ajuste muda total e pagamento, preserva estoque e aparece no Excel',async()=>{
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'10',{'PIX':'2'},{desconto:'1,50',acrescimo:'0,75',motivo:'Acordo com cliente'});
 assert.equal(p.payload.totalCentavos,425);assert.equal(p.payload.subtotalCentavos,500);assert.equal(p.payload.trocoCentavos,775);await f.create().executar(p);assert.equal(f.stock(),2250);
 for(const file of ['merge-core.js','resumo-restaurante-caixa.js','conciliacao-turno.js','resumo-financeiro-caixa.js','caixa.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),f.ctx);
 const r=f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getTurnoAtual());assert.equal(r.totalVendas,4.25);assert.equal(r.totalDinheiro,2.25);assert.equal(r.totalPix,2);
 f.ctx.ExcelJS=require('exceljs');f.ctx.AuthModule={isGerente:()=>true};f.ctx.window.App={showToast(){}};f.service.getConfig=()=>({});f.service.formatarNumeroTurno=id=>id;
 let book;f.ctx.CaixaModule.salvarArquivoExcel=async b=>{book=new f.ctx.ExcelJS.Workbook();await book.xlsx.load(await b.xlsx.writeBuffer());};await f.ctx.CaixaModule.exportarTurnoExcel('T');const w=book.worksheets.find(s=>s.getCell('H4').value==='Valor Pago (R$)');
 for(const [cell,value] of Object.entries({E5:5,F5:1.5,G5:4.25,H5:12,I5:7.75,K5:.75,L5:'Acordo com cliente'}))assert.equal(w.getCell(cell).value,value);
});
test('ajustes inválidos e totais adulterados são rejeitados',()=>{
 const f=fixture(),lines=[{produto:f.produto,quantidade:'250'}];
 for(const a of [{desconto:'5,01'},{desconto:'-1'},{acrescimo:'0.001'},{acrescimo:'10000001'},{desconto:'1',motivo:'abc'}])assert.throws(()=>f.create().prepararCarrinho(lines,'',undefined,{motivo:'Motivo válido',...a}));
 const p=f.create().prepararCarrinho(lines,'',undefined,{desconto:'5',motivo:'Cortesia integral'});assert.equal(p.payload.totalCentavos,0);assert.equal(p.payload.trocoCentavos,0);
 assert.throws(()=>core.normalizarVendaLocal({...p.payload,totalCentavos:1}));assert.throws(()=>core.normalizarVendaLocal({...p.payload,subtotalCentavos:1}));assert.equal(f.create().pendente(),null);
});
test('ajustes recuperam falhas sem alteração e armazenamento rejeita divergência',async()=>{
 for(const stage of ['baixa','disco','ack']){
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'',undefined,{acrescimo:'2',motivo:'Embalagem especial'});
 if(stage==='disco')f.fail('adega_vendas');else f.lose(stage);await assert.rejects(f.create().executar(p));await assert.rejects(f.create().executar({...p,payload:{...p.payload,ajuste:{...p.payload.ajuste,motivo:'Outro motivo'}}}));await f.create().executar();assert.equal(f.service.getVendas().length,1);assert.equal(f.service.getVendas()[0].total,7);assert.equal(f.stock(),2250);
 }
 const f=fixture(),p=f.create().prepararCarrinho([{produto:f.produto,quantidade:'250'}],'',undefined,{desconto:'1',motivo:'Acordo comercial'}),r={reciboId:'receipt',vendaId:p.venda.id,lojaId:'loja',turno:p.payload.turno,venda:core.normalizarVendaLocal(p.payload),consumos:[{legadoId:'farinha'}]};
 assert.throws(()=>f.service.saveVendaComEstoqueServidorTeste({...p.venda,desconto:2},r),/ajuste/);
});

test('rascunho só é removido após pendência durável e antes da baixa remota',async()=>{
 const f=fixture();let calls=0;const bridge=f.create({aoPersistirPendencia:p=>{calls++;assert.ok(f.storage.getItem('flowpdv_venda_servidor_pendente'));assert.equal(f.stock(),2500);assert.equal(p.lojaId,'loja');}}),p=bridge.preparar(f.produto,'250');f.fail('flowpdv_venda_servidor_pendente');await assert.rejects(bridge.executar(p));assert.equal(calls,0);await bridge.executar(p);assert.equal(calls,1);assert.equal(f.service.getVendas().length,1);
});
test('falha ao remover rascunho mantém pendência e impede venda ou cancelamento remoto',async()=>{
 const f=fixture();let fail=true;const bridge=f.create({aoPersistirPendencia:()=>{if(fail)throw Error('Falha no rascunho');}}),p=bridge.preparar(f.produto,'250');await assert.rejects(bridge.executar(p),/rascunho/);assert.ok(bridge.pendente());assert.equal(f.stock(),2500);assert.equal(f.service.getVendas().length,0);await assert.rejects(bridge.cancelar('Cliente desistiu',true),/rascunho/);assert.ok(bridge.pendente().cancelamento);fail=false;await bridge.cancelar();assert.equal(bridge.pendente(),null);assert.equal(f.stock(),2500);
});
