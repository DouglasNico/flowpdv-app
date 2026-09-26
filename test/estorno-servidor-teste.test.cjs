const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const original={id:'ANTERIOR',terminalId:'device',dataAbertura:'2026-09-20T10:00:00Z',status:'fechado',trocoInicial:0,sangrias:[]};
 const turno={id:'ATUAL',terminalId:'device',dataAbertura:'2026-09-21T10:00:00Z',status:'aberto',trocoInicial:0,sangrias:[]};
 const sale={id:'VL-1',turnoId:'ANTERIOR',terminalId:'device',status:'concluida',data:'2026-09-20T11:00:00Z',formaPagamento:'Dinheiro',total:5,itens:[],estoqueServidorV2:{lojaId:'loja',reciboId:'sale'}};
 const data=new Map([['adega_vendas',JSON.stringify([sale])],['adega_turno_atual',JSON.stringify(turno)],['adega_turnos_historico',JSON.stringify([original])]]);let failKey,lose='',other=false,receipt,stock=2250;
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(k===failKey){failKey=null;throw Error('Falha local');}data.set(k,v);},removeItem:k=>data.delete(k)};
 const ctx={localStorage:storage,window:{electronAPI:{ambienteTeste:true}},console};vm.createContext(ctx);
 for(const f of ['perfil-operacional-v2.js','storage.js','merge-core.js','resumo-restaurante-caixa.js','conciliacao-turno.js','resumo-financeiro-caixa.js','caixa.js','estorno-servidor-teste.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js',f),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export const /g,'var ').replace(/export function /g,'function '),ctx);
 const service=ctx.StorageService;service.getDeviceId=()=> 'device';service.getLicenca=()=>null;
 const call=async(name,p)=>{
  if(name==='consultarMeuTerminalV2')return {vinculado:true,lojaId:other?'outra':'loja',papel:'caixa'};
  if(name==='estornarVendaLocalV2'){
   if(!receipt){receipt={reciboId:'refund',vendaId:p.vendaId,lojaId:'loja',turno:p.turno,turnoVenda:original,totalCentavos:500,motivo:p.motivo,devolverEstoque:p.devolverEstoque};const split=service.getVendas()[0].pagamentosCentavos;if(split)receipt.pagamentos=split;if(p.devolverEstoque)stock+=250;}
   if(lose==='estorno'){lose='';throw Error('Resposta perdida');}return {...receipt,reutilizado:true};
  }
  if(lose==='ack'){lose='';throw Error('Confirmação perdida');}return {confirmado:true};
 };
 const create=()=>ctx.criarEstornoServidorTeste({storage,servico:service,ambienteTeste:true,call});
 const plan=(devolver=true)=>create().preparar('VL-1','Devolução conferida',devolver,true);
 return {ctx,service,storage,data,create,plan,stock:()=>stock,fail:k=>{failKey=k;},lose:s=>{lose=s;},otherShop:()=>{other=true;}};
}
test('estorno em outro turno ajusta calculador e conciliação sem reescrever venda ou histórico',async()=>{
 const f=fixture(),vendas=f.data.get('adega_vendas'),history=f.data.get('adega_turnos_historico');await f.create().executar(f.plan());
 const t=f.service.getTurnoAtual(),summary=f.ctx.CaixaModule.calcularResumoFinanceiro(t);
 assert.equal(summary.totalVendas,-5);assert.equal(summary.totalDinheiro,-5);assert.equal(summary.saldoEmGaveta,-5);
 assert.equal(f.ctx.resumoConciliacao(t,f.service.getVendas(),[],f.ctx.totalEstornosLocais(t)).total,-500);
 assert.equal(f.stock(),2500);assert.equal(f.data.get('adega_vendas'),vendas);assert.equal(f.data.get('adega_turnos_historico'),history);
 assert.equal(f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getHistoricoTurnos()[0]).totalVendas,5);
 assert.throws(()=>f.plan(),/estornada/);
});
test('resposta, escrita e confirmação perdidas recuperam sem duplicar ajuste ou estoque',async()=>{
 for(const stage of ['estorno','disco','ack','limpeza']){
  const f=fixture(),p=f.plan();if(stage==='disco')f.fail('adega_turno_atual');else f.lose(stage);
  if(stage==='limpeza'){const remove=f.storage.removeItem;let fail=true;f.storage.removeItem=k=>{if(fail){fail=false;throw Error('Falha ao limpar');}return remove(k);};}
  await assert.rejects(f.create().executar(p));assert.ok(f.create().pendente());assert.throws(()=>f.service.exigirVendaRecuperada());
  assert.throws(()=>f.service.saveVenda({id:'OUTRA',itens:[],total:1}));
  await f.create().executar();assert.equal(f.stock(),2500);assert.equal(f.service.getTurnoAtual().estornosLocaisV2.length,1);assert.equal(f.create().pendente(),null);
  assert.equal(f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getTurnoAtual()).totalVendas,-5);
 }
});
test('sem reposição mantém estoque e exige confirmação, loja e turno originais',async()=>{
 const f=fixture();assert.throws(()=>f.create().preparar('VL-1','Motivo válido',true,false));
 await f.create().executar(f.plan(false));assert.equal(f.stock(),2250);
 const g=fixture(),p=g.plan();g.otherShop();await assert.rejects(g.create().executar(p),/loja/);assert.equal(g.create().pendente(),null);
 const h=fixture(),q=h.plan();h.lose('estorno');await assert.rejects(h.create().executar(q));
 await assert.rejects(h.create().executar({...q,totalCentavos:501}),/original/);
 h.storage.setItem('adega_turno_atual',JSON.stringify({...h.service.getTurnoAtual(),id:'OUTRO'}));await assert.rejects(h.create().executar(),/turno/);
});
test('falha ao salvar a intenção impede qualquer estorno remoto',async()=>{
 const f=fixture(),p=f.plan();f.fail('flowpdv_estorno_local_pendente');await assert.rejects(f.create().executar(p));assert.equal(f.stock(),2250);assert.equal(f.create().pendente(),null);
});
test('perfil normal ignora ajustes experimentais e ajuste inválido bloqueia o resumo de teste',async()=>{
 const f=fixture();await f.create().executar(f.plan());const t=f.service.getTurnoAtual();
 f.ctx.window.electronAPI.ambienteTeste=false;assert.equal(f.ctx.CaixaModule.calcularResumoFinanceiro(t).totalVendas,0);
 f.ctx.window.electronAPI.ambienteTeste=true;
 assert.throws(()=>f.ctx.totalEstornosLocais({...t,estornosLocaisV2:[...t.estornosLocaisV2,...t.estornosLocaisV2]}));
 assert.throws(()=>f.ctx.totalEstornosLocais({...t,id:'OUTRO'}));
});
test('estorno no próprio turno zera a receita e repetir operação concluída não desconta novamente',async()=>{
 const f=fixture(),sale=f.service.getVendas()[0];sale.turnoId='ATUAL';sale.data='2026-09-21T11:00:00Z';f.storage.setItem('adega_vendas',JSON.stringify([sale]));
 const plan=f.plan(false);await f.create().executar(plan);await f.create().executar(plan);
 const t=f.service.getTurnoAtual();assert.equal(t.estornosLocaisV2.length,1);assert.equal(f.ctx.CaixaModule.calcularResumoFinanceiro(t).totalVendas,0);
 assert.equal(f.ctx.resumoConciliacao(t,f.service.getVendas(),[],f.ctx.totalEstornosLocais(t)).total,0);assert.equal(f.stock(),2250);
});
test('Excel registra devolução negativa e turno da venda sem alterar o movimento original',async()=>{
 const f=fixture();await f.create().executar(f.plan());
 const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();f.ctx.adicionarDetalhesRestauranteExcel(book,[f.service.getTurnoAtual()]);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await book.xlsx.writeBuffer());const s=loaded.getWorksheet('Estornos locais');
 assert.equal(s.getCell('A2').value,'ATUAL');assert.equal(s.getCell('C2').value,'ANTERIOR');assert.equal(s.getCell('D2').value,-5);assert.equal(s.getCell('E2').value,'Sim');
});
test('calculador soma fundo do restaurante e exportações reais incluem ajuste uma vez',async()=>{
 const f=fixture();await f.create().executar(f.plan());let t=f.service.getTurnoAtual();
 const snapshot={versao:1,lojaId:'loja',status:'fechado',revisao:3,turno:{id:t.id,terminalId:t.terminalId,dataAbertura:t.dataAbertura,chave:'key'},recebimentos:0,estornos:0,trocoInicialCentavos:1000,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},detalhes:[]};
 t=f.ctx.incorporarResumoRestaurante(t,snapshot);assert.equal(f.ctx.CaixaModule.calcularResumoFinanceiro(t).saldoEmGaveta,5);
 f.storage.setItem('adega_turno_atual',JSON.stringify(t));
 f.ctx.ExcelJS=require('exceljs');f.ctx.AuthModule={isGerente:()=>true};f.ctx.window.App={showToast(){}};
 f.service.getConfig=()=>({});f.service.formatarNumeroTurno=id=>id;
 const books=[];f.ctx.CaixaModule.salvarArquivoExcel=async book=>{const b=new f.ctx.ExcelJS.Workbook();await b.xlsx.load(await book.xlsx.writeBuffer());books.push(b);};
 await f.ctx.CaixaModule.exportarTurnoExcel(t.id);
 f.storage.setItem('adega_turnos_historico',JSON.stringify([{...t,status:'fechado',dataFechamento:'2026-09-21T20:00:00Z'},...f.service.getHistoricoTurnos()]));f.storage.removeItem('adega_turno_atual');
 await f.ctx.CaixaModule.exportarTodosTurnosExcel();
 assert.equal(books.length,2);for(const b of books){assert.equal(b.getWorksheet('Estornos locais').getCell('D2').value,-5);assert.equal(b.getWorksheet('Estornos locais').rowCount,2);}
 assert.equal(books[0].worksheets[0].getCell('B17').value,-5);
 assert.equal(books[0].worksheets[0].getCell('B22').value,5);
});

test('estorno dividido desconta as formas originais e recupera sem duplicação',async()=>{
 const f=fixture(),sale=f.service.getVendas()[0];sale.formaPagamento='Múltiplos';sale.pagamentoDividido=true;sale.pagamentosCentavos=[{forma:'Dinheiro',valorCentavos:200},{forma:'PIX',valorCentavos:100},{forma:'Débito',valorCentavos:100},{forma:'Crédito',valorCentavos:100}];f.storage.setItem('adega_vendas',JSON.stringify([sale]));
 const p=f.plan();f.lose('ack');await assert.rejects(f.create().executar(p));await f.create().executar();
 const r=f.ctx.CaixaModule.calcularResumoFinanceiro(f.service.getTurnoAtual());assert.equal(r.totalVendas,-5);assert.equal(r.totalDinheiro,-2);assert.equal(r.saldoEmGaveta,-2);assert.equal(r.totalPix,-1);assert.equal(r.totalDebito,-1);assert.equal(r.totalCredito,-1);assert.equal(f.stock(),2500);assert.equal(f.service.getTurnoAtual().estornosLocaisV2.length,1);
 const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();f.ctx.adicionarDetalhesRestauranteExcel(book,[f.service.getTurnoAtual()]);const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await book.xlsx.writeBuffer());assert.equal(reopened.getWorksheet('Estornos locais').getCell('D2').value,-5);assert.equal(reopened.getWorksheet('Estornos locais').getCell('H2').value,'Dinheiro: 2.00 + PIX: 1.00 + Débito: 1.00 + Crédito: 1.00');
});
test('estorno recusa formas alteradas ou omitidas pelo servidor antes de gravar ajuste',async()=>{
 const f=fixture(),p=f.plan();p.pagamentos=[{forma:'PIX',valorCentavos:500}];await assert.rejects(f.create().executar(p),/divergente/);assert.equal(f.service.getTurnoAtual().estornosLocaisV2,undefined);assert.ok(f.create().pendente());
});
