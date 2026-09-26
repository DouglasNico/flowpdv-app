const {test,after}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'flowpdv-conciliacao-'));
const output=path.join(folder,'core.cjs');
require('esbuild').buildSync({entryPoints:[path.resolve(__dirname,'../src/js/conciliacao-turno.js')],bundle:true,platform:'node',format:'cjs',outfile:output,logLevel:'silent'});
const {resumoConciliacao}=require(output);
after(()=>fs.rmSync(folder,{recursive:true,force:true}));
const turno={id:'TRN-1',terminalId:'TERM-1',dataAbertura:'2026-09-21T10:00:00Z'};
const sale={id:'V-1',turnoId:turno.id,terminalId:turno.terminalId,total:5};
const receipt={id:'R-1',tipo:'recebimento_manual',totalCentavos:1250,pagamentos:[{forma:'dinheiro',valorCentavos:1250}]};
test('soma em centavos sem descontar troco novamente nem modificar fontes',()=>{
 const vendas=[sale],movimentos=[receipt],before=JSON.stringify({vendas,movimentos});
 assert.equal(resumoConciliacao(turno,vendas,movimentos).total,1750);
 assert.equal(resumoConciliacao(turno,vendas,movimentos).formas.dinheiro,1250);
 assert.equal(JSON.stringify({vendas,movimentos}),before);
});
test('estorno reduz apenas o turno consultado e cartão genérico permanece separado',()=>{
 const refund={...receipt,id:'E-1',tipo:'estorno_manual',totalCentavos:-1250};
 assert.equal(resumoConciliacao(turno,[sale],[receipt,refund]).total,500);
 assert.equal(resumoConciliacao(turno,[],[refund]).total,-1250);
 const card={...receipt,pagamentos:[{forma:'cartao_manual',valorCentavos:1250}]};
 assert.equal(resumoConciliacao(turno,[],[card]).formas.cartao_manual,1250);
});
test('não omite conflitos nem duplica vendas importadas ou IDs',()=>{
 for(const vendas of [[sale,sale],[{...sale,origem:'restaurante_v2'}],[{...sale,terminalId:'OUTRO'}],[{...sale,status:'estornada'}]]) assert.throws(()=>resumoConciliacao(turno,vendas,[]));
 assert.throws(()=>resumoConciliacao(turno,[],[receipt,receipt]));
 assert.throws(()=>resumoConciliacao(turno,[],[{...receipt,pagamentos:[]} ]));
 assert.equal(resumoConciliacao(turno,[{...sale,turnoId:'OUTRO'}],[]).total,0);
});
