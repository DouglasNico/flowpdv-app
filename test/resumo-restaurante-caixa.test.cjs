const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/js/resumo-restaurante-caixa.js'),'utf8').replace(/export function /g,'function ');
const context={};vm.createContext(context);vm.runInContext(source,context);
const turno={id:'TRN-1',terminalId:'TERM-1',dataAbertura:'2026-09-21T10:00:00.000Z',trocoInicial:10};
const snapshot={versao:1,lojaId:'loja',status:'fechado',revisao:3,turno:{...turno,chave:'chave'},recebimentos:1,estornos:0,trocoInicialCentavos:500,totalCentavos:1250,formas:{dinheiro:750,pix_manual:0,cartao_manual:500}};
const local={vendasCount:1,totalVendas:5,totalDinheiro:5,totalPix:0,totalDebito:0,totalCredito:0,totalFiado:0,totalSangrias:2,saldoEmGaveta:13};
const detalhe={movimentoId:'M-1',vendaId:'V-R',tipo:'recebimento_manual',totalCentavos:1250,itens:[{origemLinhaId:'P-1:L-1',origemPedidoId:'P-1',produtoId:'lanche',nome:'Lanche',quantidade:1,precoUnitarioCentavos:1250,totalCentavos:1250,opcoes:[{nome:'Bacon',quantidade:1,precoCentavos:250}]}]};

test('fundo de abertura integrado entra na gaveta antes do encerramento, sem duplicar o resumo fechado',()=>{
 const t={...turno,fundoRestauranteCentavos:500};
 assert.equal(context.mesclarResumoRestaurante(t,local,true).saldoEmGaveta,18);
 assert.equal(context.mesclarResumoRestaurante({...t,restauranteV2:snapshot},local,true).saldoEmGaveta,25.5);
 assert.equal(context.mesclarResumoRestaurante(t,local,false).saldoEmGaveta,13);
 assert.throws(()=>context.mesclarResumoRestaurante({...t,fundoRestauranteCentavos:-1},local,true));
});

test('relatório separa taxa de entrega dos produtos e valida a devolução integral',()=>{
 const recebido={...detalhe,totalCentavos:1750,taxaEntregaCentavos:500};
 const estorno={...recebido,movimentoId:'M-E',tipo:'estorno_manual',totalCentavos:-1750,taxaEntregaCentavos:-500,itens:detalhe.itens.map(i=>({...i,quantidade:-1,totalCentavos:-1250}))};
 const s={...snapshot,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},estornos:1,detalhes:[recebido,estorno]};
 assert.doesNotThrow(()=>context.validarResumoRestaurante(turno,s));
 assert.throws(()=>context.validarResumoRestaurante(turno,{...s,detalhes:[recebido,{...estorno,taxaEntregaCentavos:500}]}));
 const workbook=new (require('exceljs').Workbook)();context.adicionarDetalhesRestauranteExcel(workbook,[{...turno,restauranteV2:s}]);
 const sheet=workbook.getWorksheet('Itens restaurante');assert.equal(sheet.getCell('H2').value,'Taxa de entrega');assert.equal(sheet.getCell('K2').value,5);assert.equal(sheet.getCell('K4').value,-5);
 assert.equal(sheet.getCell('H3').value,'Lanche');assert.equal(sheet.getCell('K3').value,12.5);assert.equal(sheet.getCell('K5').value,-12.5);
});
test('detalhes conferem valores, origem única e adicionais sem somar duas vezes',()=>{
 const s={...snapshot,detalhes:[detalhe]};assert.equal(context.validarResumoRestaurante(turno,s),s);
 for(const detalhes of [[detalhe,detalhe],[{...detalhe,totalCentavos:1000}],[{...detalhe,itens:[{...detalhe.itens[0],quantidade:2}]}]]) assert.throws(()=>context.validarResumoRestaurante(turno,{...snapshot,detalhes}));
 const refund={...detalhe,movimentoId:'M-2',tipo:'estorno_manual',totalCentavos:-1250,itens:detalhe.itens.map(i=>({...i,quantidade:-1,totalCentavos:-1250}))};
 assert.doesNotThrow(()=>context.validarResumoRestaurante(turno,{...snapshot,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},estornos:1,detalhes:[detalhe,refund]}));
});
test('soma uma vez, preserva fontes e não classifica cartão genérico como crédito',()=>{
 const original=JSON.stringify({turno,snapshot,local}),merged=context.incorporarResumoRestaurante(turno,snapshot);
 const result=context.mesclarResumoRestaurante(merged,local,true);
 assert.equal(result.totalVendas,17.5);assert.equal(result.saldoEmGaveta,25.5);assert.equal(result.totalCartaoNaoClassificado,5);assert.equal(result.totalCredito,0);
 assert.equal(JSON.stringify(context.incorporarResumoRestaurante(merged,snapshot)),JSON.stringify(merged));
 assert.equal(JSON.stringify({turno,snapshot,local}),original);
 assert.equal(context.mesclarResumoRestaurante(merged,local,false),local);
});
test('recusa turno divergente, totais inválidos e substituição de resumo já aplicado',()=>{
 for(const invalid of [{...snapshot,status:'aberto'},{...snapshot,totalCentavos:1},{...snapshot,turno:{...snapshot.turno,id:'OUTRO'}}]) assert.throws(()=>context.incorporarResumoRestaurante(turno,invalid));
 const merged=context.incorporarResumoRestaurante(turno,snapshot);
 assert.throws(()=>context.incorporarResumoRestaurante(merged,{...snapshot,revisao:4}));
});
test('estorno posterior pode deixar saldo negativo sem esconder falta de dinheiro',()=>{
 const ref={...snapshot,totalCentavos:-2500,formas:{dinheiro:-2500,pix_manual:0,cartao_manual:0},trocoInicialCentavos:0,recebimentos:0,estornos:1};
 assert.equal(context.mesclarResumoRestaurante(context.incorporarResumoRestaurante(turno,ref),local,true).saldoEmGaveta,-12);
});
test('Excel preserva estorno negativo e identifica resumo antigo sem inventar itens',async()=>{
 const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();
 const refund={...detalhe,movimentoId:'M-R',tipo:'estorno_manual',totalCentavos:-1250,itens:detalhe.itens.map(i=>({...i,quantidade:-1,totalCentavos:-1250}))};
 const s={...snapshot,totalCentavos:-1250,formas:{dinheiro:-1250,pix_manual:0,cartao_manual:0},recebimentos:0,estornos:1,detalhes:[refund]};
 context.adicionarDetalhesRestauranteExcel(book,[{...turno,restauranteV2:s},{...turno,restauranteV2:snapshot}]);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await book.xlsx.writeBuffer());const sheet=loaded.worksheets[0];
 assert.equal(sheet.getCell('I2').value,-1);assert.equal(sheet.getCell('K2').value,-12.5);assert.equal(sheet.getCell('B3').value,'Resumo antigo sem detalhes');
});

test('calculador e exportações reais do caixa incluem resumo, preservam detalhamento local e sobrevivem à recarga',async()=>{
 const turn=context.incorporarResumoRestaurante({...turno,status:'fechado',dataFechamento:'2026-09-21T20:00:00Z',sangrias:[{valor:2}]},{...snapshot,detalhes:[detalhe]});
 const sale={id:'V-1',turnoId:turn.id,total:5,formaPagamento:'Dinheiro',data:'2026-09-21T11:00:00Z',itens:[]};
 const ExcelJS=require('exceljs');const sandbox={window:{electronAPI:{ambienteTeste:true},App:{showToast(){}}},ExcelJS,AuthModule:{isGerente:()=>true},StorageService:{getVendas:()=>[sale],getHistoricoTurnos:()=>[JSON.parse(JSON.stringify(turn))],getTurnoAtual:()=>turn,getConfig:()=>({}),formatarNumeroTurno:id=>id},console};
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/merge-core.js'),'utf8').replace(/export /g,''),sandbox);
 vm.runInContext(source,sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/resumo-financeiro-caixa.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace(/export /g,''),sandbox);

 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/js/caixa.js'),'utf8').replace(/^import .*;\r?$/gm,'').replace('export const CaixaModule','var CaixaModule'),sandbox);
 const api=sandbox.CaixaModule,books=[];api.salvarArquivoExcel=async book=>{const bytes=await book.xlsx.writeBuffer();const reread=new ExcelJS.Workbook();await reread.xlsx.load(bytes);books.push(reread);};
 assert.equal(api.calcularResumoFinanceiro(turn).totalVendas,17.5);
 assert.equal(api.calcularResumoFinanceiro(JSON.parse(JSON.stringify(turn))).saldoEmGaveta,25.5);
 await api.exportarTurnoExcel(turn.id);
 const summary=books[0].worksheets[0];assert.equal(summary.getCell('B17').value,17.5);assert.equal(summary.getCell('B19').value,5);assert.equal(summary.getCell('B20').value,5);
 const items=books[0].getWorksheet('Itens restaurante');assert.equal(items.getCell('H2').value,'Lanche');assert.equal(items.getCell('K2').value,12.5);assert.match(items.getCell('L2').value,/Bacon/);assert.equal(items.rowCount,2);
 await api.exportarTodosTurnosExcel();
 const extra=books[1].getWorksheet('Restaurante por turno');assert.ok(extra);assert.equal(extra.getCell('D2').value,12.5);assert.equal(extra.getCell('E2').value,5);
 assert.equal(books[1].getWorksheet('Itens restaurante').getCell('I2').value,1);
 sandbox.window.electronAPI.ambienteTeste=false;assert.equal(api.calcularResumoFinanceiro(turn).totalVendas,5);
 sandbox.window.electronAPI.ambienteTeste=true;sandbox.StorageService.getTurnoAtual=()=>turno;
 let prevented=false;api.confirmarFechamentoCaixa({preventDefault(){prevented=true;}});assert.equal(prevented,true);
});
