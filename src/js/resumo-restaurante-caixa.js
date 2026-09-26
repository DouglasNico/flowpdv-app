// Ponte de resumo, sem gravar vendas nem movimentar estoque.
export function validarResumoRestaurante(turno, snapshot) {
  if (!snapshot || snapshot.versao !== 1 || snapshot.status !== 'fechado' || !snapshot.lojaId || !snapshot.turno?.chave || snapshot.turno.id !== turno.id || snapshot.turno.terminalId !== turno.terminalId || snapshot.turno.dataAbertura !== turno.dataAbertura) throw new Error('Resumo do restaurante não corresponde a este turno.');
  for(const n of [snapshot.revisao,snapshot.recebimentos,snapshot.estornos,snapshot.trocoInicialCentavos]) if(!Number.isSafeInteger(n)||n<0) throw new Error('Resumo de turno inválido.');
  const values=['dinheiro','pix_manual','cartao_manual'].map(k=>snapshot.formas?.[k]);
  if(![snapshot.totalCentavos,...values].every(Number.isSafeInteger)||values.reduce((a,b)=>a+b,0)!==snapshot.totalCentavos) throw new Error('Totais do restaurante inconsistentes.');
  if(snapshot.detalhes !== undefined) validarDetalhesRestaurante(snapshot);
  return snapshot;
}
export function validarDetalhesRestaurante(snapshot) {
  const fail=()=>{throw new Error('Detalhamento do restaurante inconsistente.');};
  if(!Array.isArray(snapshot.detalhes)||snapshot.detalhes.length>500) fail();
  const ids=new Set();let total=0,recebimentos=0,estornos=0,linhas=0;
  for(const m of snapshot.detalhes){
    const sinal=m.tipo==='recebimento_manual'?1:m.tipo==='estorno_manual'?-1:0;
    if(!sinal||!m.movimentoId||!m.vendaId||ids.has(m.movimentoId)||!Array.isArray(m.itens)||!m.itens.length) fail();
    ids.add(m.movimentoId);if(sinal===1) recebimentos++;else estornos++;
    const origens=new Set();let subtotal=0;
    for(const i of m.itens){
      if(!i.origemLinhaId||origens.has(i.origemLinhaId)||!i.origemPedidoId||!i.produtoId||typeof i.nome!=='string'||!i.nome||!Number.isSafeInteger(i.quantidade)||sinal*i.quantidade<=0||!Number.isSafeInteger(i.precoUnitarioCentavos)||i.precoUnitarioCentavos<0||!Number.isSafeInteger(i.totalCentavos)||i.quantidade*i.precoUnitarioCentavos!==i.totalCentavos||!Array.isArray(i.opcoes)) fail();
      origens.add(i.origemLinhaId);
      for(const o of i.opcoes) if(typeof o.nome!=='string'||!o.nome||!Number.isSafeInteger(o.quantidade)||o.quantidade<1||!Number.isSafeInteger(o.precoCentavos)||o.precoCentavos<0) fail();
      if(i.opcoes.reduce((sum,o)=>sum+o.quantidade*o.precoCentavos,0)>i.precoUnitarioCentavos) fail();
      subtotal+=i.totalCentavos;linhas++;
    }
    const taxa=m.taxaEntregaCentavos ?? 0;
    if(!Number.isSafeInteger(taxa)||sinal*taxa<0||Math.abs(taxa)>100000||subtotal+taxa!==m.totalCentavos) fail();total+=subtotal+taxa;
  }
  if(linhas>2000||total!==snapshot.totalCentavos||recebimentos!==snapshot.recebimentos||estornos!==snapshot.estornos) fail();
  return snapshot.detalhes;
}

export function adicionarDetalhesRestauranteExcel(workbook, turnos) {
  const ajustes=turnos.flatMap(t=>{totalEstornosLocais(t);return (t.estornosLocaisV2||[]).map(e=>[t.id,e.vendaId,e.turnoVenda.id,-e.totalCentavos/100,e.devolverEstoque?'Sim':'Não',e.motivo,e.reciboId,(e.pagamentos||[{forma:'Dinheiro',valorCentavos:e.totalCentavos}]).map(p=>p.forma+': '+(p.valorCentavos/100).toFixed(2)).join(' + ')]);});
  if(ajustes.length){
    const refunds=workbook.addWorksheet('Estornos locais');
    refunds.columns=['Turno da devolução','Venda','Turno da venda','Devolução (R$)','Repor estoque','Motivo','Comprovante','Formas devolvidas'].map(header=>({header,width:28}));
    ajustes.forEach((valores,r)=>valores.forEach((v,c)=>{refunds.getRow(r+2).getCell(c+1).value=v;}));refunds.getRow(1).font={bold:true};refunds.getColumn(4).numFmt='0.00';refunds.views=[{state:'frozen',ySplit:1}];
  }
  const ws=workbook.addWorksheet('Itens restaurante');
  const headers=['Turno','Origem','Movimento','Venda','Pedido','Linha','Produto','Nome','Quantidade líquida','Unitário com adicionais (R$)','Total líquido (R$)','Adicionais por unidade (já incluídos)'];
  ws.columns=headers.map((_,i)=>({width:i===11?55:i===7?28:24}));
  headers.forEach((h,i)=>{ws.getRow(1).getCell(i+1).value=h;});ws.getRow(1).font={bold:true};
  ws.views=[{state:'frozen',ySplit:1}];let row=2;
  for(const turno of turnos){
    if(!turno.restauranteV2) continue;
    const snapshot=validarResumoRestaurante(turno,turno.restauranteV2);
    if(snapshot.detalhes===undefined){ws.getRow(row).getCell(1).value=turno.id;ws.getRow(row++).getCell(2).value='Resumo antigo sem detalhes';continue;}
    for(const m of snapshot.detalhes) {
      if(m.taxaEntregaCentavos){
        const valores=[turno.id,m.tipo==='estorno_manual'?'Delivery — devolução da taxa':'Delivery — taxa de entrega',m.movimentoId,m.vendaId,'','','','Taxa de entrega','','',m.taxaEntregaCentavos/100,'Não movimenta estoque'];
        valores.forEach((v,c)=>{ws.getRow(row).getCell(c+1).value=v;});ws.getRow(row).getCell(11).numFmt='0.00';row++;
      }
      for(const i of m.itens){
      const valores=[turno.id,m.tipo==='estorno_manual'?'Restaurante — estorno':'Restaurante — recebimento',m.movimentoId,m.vendaId,i.origemPedidoId,i.origemLinhaId,i.produtoId,i.nome,i.quantidade,i.precoUnitarioCentavos/100,i.totalCentavos/100,i.opcoes.map(o=>`${o.quantidade} × ${o.nome} (R$ ${(o.precoCentavos/100).toFixed(2)})`).join('; ')];
      valores.forEach((v,c)=>{ws.getRow(row).getCell(c+1).value=v;});
      ws.getRow(row).getCell(10).numFmt='0.00';ws.getRow(row).getCell(11).numFmt='0.00';row++;
      }
    }
  }
  ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,row-1),column:headers.length}};
}
export function incorporarResumoRestaurante(turno, snapshot) {
  validarResumoRestaurante(turno,snapshot);
  if(turno.restauranteV2 && JSON.stringify(turno.restauranteV2)!==JSON.stringify(snapshot)) throw new Error('O turno já possui outro resumo. Confira a migração antes de substituir.');
  return {...turno,restauranteV2:JSON.parse(JSON.stringify(snapshot))};
}
export function mesclarResumoRestaurante(turno, local, ambienteTeste) {
  if(!ambienteTeste) return local;
  const devolvido=totalEstornosLocais(turno);
  if(turno?.estornosLocaisV2?.length){
    const porForma={'Dinheiro':0,'PIX':0,'Débito':0,'Crédito':0,'Voucher':0};
    for(const e of turno.estornosLocaisV2)for(const p of e.pagamentos||[{forma:'Dinheiro',valorCentavos:e.totalCentavos}])porForma[p.forma]=(porForma[p.forma]||0)+p.valorCentavos;
    local={...local,totalVendas:Math.round(local.totalVendas*100-devolvido)/100,totalDinheiro:Math.round(local.totalDinheiro*100-porForma.Dinheiro)/100,totalPix:Math.round((local.totalPix||0)*100-porForma.PIX)/100,totalDebito:Math.round((local.totalDebito||0)*100-porForma['Débito'])/100,totalCredito:Math.round((local.totalCredito||0)*100-porForma['Crédito'])/100,totalVoucher:Math.round((local.totalVoucher||0)*100-(porForma.Voucher||0))/100,saldoEmGaveta:Math.round((Number(turno.trocoInicial||0)+local.totalDinheiro-local.totalSangrias)*100-porForma.Dinheiro)/100,totalEstornosLocais:devolvido/100};
  }
  if(!turno?.restauranteV2) {
    if(turno?.fundoRestauranteCentavos !== undefined) {
      const fundo = turno.fundoRestauranteCentavos;
      if(!Number.isSafeInteger(fundo)||fundo<0||fundo>1e12) throw new Error('Fundo do turno integrado inválido.');
      return {...local,fundoRestaurante:fundo/100,saldoEmGaveta:Math.round(local.saldoEmGaveta*100+fundo)/100};
    }
    return local;
  }
  const s=validarResumoRestaurante(turno,turno.restauranteV2);
  const sum=(a,b)=>Math.round(Number(a||0)*100+b)/100;
  const merged={...local,vendasCount:local.vendasCount+s.recebimentos,totalVendas:sum(local.totalVendas,s.totalCentavos),totalDinheiro:sum(local.totalDinheiro,s.formas.dinheiro),totalPix:sum(local.totalPix,s.formas.pix_manual),totalCartaoNaoClassificado:s.formas.cartao_manual/100,estornosRestaurante:s.estornos,recebimentosRestaurante:s.recebimentos,totalRestaurante:s.totalCentavos/100,fundoRestaurante:s.trocoInicialCentavos/100,restauranteIntegrado:true};
  merged.saldoEmGaveta=Math.round(((Number(turno.trocoInicial||0)+merged.totalDinheiro-local.totalSangrias)*100+s.trocoInicialCentavos))/100;
  if(![merged.totalVendas,merged.totalDinheiro,merged.totalPix,merged.saldoEmGaveta].every(Number.isFinite)) throw new Error('Resumo consolidado inválido.');
  return merged;
}
export function totalEstornosLocais(turno){
  const ids=new Set(),vendas=new Set();let total=0;
  for(const e of turno?.estornosLocaisV2||[]){
    if(!e.reciboId||ids.has(e.reciboId)||!e.vendaId||vendas.has(e.vendaId)||!e.lojaId||!e.turnoVenda?.id||e.turno?.id!==turno.id||e.turno.terminalId!==turno.terminalId||e.turno.dataAbertura!==turno.dataAbertura||!Number.isSafeInteger(e.totalCentavos)||e.totalCentavos<0||typeof e.devolverEstoque!=='boolean'||typeof e.motivo!=='string')throw new Error('Ajustes de estorno local inconsistentes.');
    if(e.pagamentos!==undefined){
      const formas=new Set();let soma=0;
      if(!Array.isArray(e.pagamentos)||e.pagamentos.length>5)throw new Error('Formas do estorno inválidas.');
      for(const p of e.pagamentos){if(!p||!['Dinheiro','PIX','Débito','Crédito','Voucher'].includes(p.forma)||formas.has(p.forma)||!Number.isSafeInteger(p.valorCentavos)||p.valorCentavos<=0)throw new Error('Formas do estorno inválidas.');formas.add(p.forma);soma+=p.valorCentavos;}
      if(soma!==e.totalCentavos)throw new Error('Formas do estorno não correspondem ao total.');
    }
    ids.add(e.reciboId);vendas.add(e.vendaId);total+=e.totalCentavos;
  }
  if(!Number.isSafeInteger(total))throw new Error('Total de estornos excede o limite.');return total;
}
