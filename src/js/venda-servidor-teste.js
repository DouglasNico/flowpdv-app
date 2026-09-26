import core from '../../functions/venda-local-core.cjs';
import estoqueCore from '../../functions/estoque-migracao-core.cjs';
export function precoProdutoLocalCentavos(produto) { return core.precoProdutoLocalCentavos(produto); }
export function criarVendaServidorTeste({storage,servico,ambienteTeste,call,uuid,agora,aoPersistirPendencia=()=>{}}) {
  if(ambienteTeste!==true) throw new Error('Ponte disponível somente no teste.');
  const key='flowpdv_venda_servidor_pendente';
  const pendente=()=>JSON.parse(storage.getItem(key)||'null');
  function preparar(produto,quantidade,recebido) {
    return prepararCarrinho([{produto,quantidade}],recebido);
  }
  function prepararCarrinho(linhas,recebido,outrasFormas,ajustes) {
    if(pendente()) throw new Error('Retome a venda pendente antes de iniciar outra.');
    servico.exigirVendaRecuperada();
    const turno=servico.getTurnoAtual();if(!turno||turno.terminalId!==servico.getDeviceId()) throw new Error('Abra um turno neste terminal.');
    const registros=JSON.parse(storage.getItem('flowpdv_migracoes_estoque_teste')||'[]');
    if(!Array.isArray(linhas)||!linhas.length||linhas.length>30)throw new Error('Adicione entre 1 e 30 produtos diferentes ao carrinho.');
    let lojaId;const ids=new Set(),itens=[],locais=[];
    for(const {produto,quantidade} of linhas){
      const id=String(produto?.id),migracao=registros.find(r=>r.status==='confirmado'&&String(r.produto.id)===id);
      if(!migracao)throw new Error('Selecione produtos com migração confirmada.');
      if(ids.has(id))throw new Error('Produto repetido. Altere a quantidade na linha existente.');ids.add(id);
      if(!migracao.lojaId||(lojaId&&lojaId!==migracao.lojaId))throw new Error('Todos os produtos devem pertencer à mesma loja.');lojaId=migracao.lojaId;
      if(produto.precoFardo||produto.codigoBarrasFardo||produto.unidadeFracionada)throw new Error('Embalagem alternativa não suportada nesta ponte.');
      const qty=String(quantidade).replace(',','.');
      if(produto.controlarEstoque===false && (migracao.semEstoque!==true || !/^\d+$/.test(qty) || !Number.isSafeInteger(Number(qty))))throw new Error('Confirme a migração sem estoque e informe unidades inteiras.');
      if(produto.controlarEstoque!==false && migracao.semEstoque===true)throw new Error('Controle de estoque diverge da migração.');
      const consumo=estoqueCore.planejarSaldoLegado({...produto,controlarEstoque:true,unidade:produto.unidade||produto.unidadeMedida,estoque:qty});
      if(consumo.saldoMili<=0)throw new Error('Informe uma quantidade positiva.');
      const preco=precoProdutoLocalCentavos(produto)/100;
      itens.push({legadoId:id,quantidade:qty,precoUnitarioCentavos:Math.round(preco*100)});
      locais.push({id:produto.id,nome:produto.nome,quantidade:Number(qty),precoUnitario:preco,unidade:produto.unidade||produto.unidadeMedida});
    }
    const vendaId=`VL-${uuid()}`;
    const subtotalCentavos=itens.reduce((sum,i)=>sum+Math.round(Number(i.quantidade)*i.precoUnitarioCentavos),0);
    const ajuste=ajustes===undefined?undefined:core.validarAjuste({descontoCentavos:core.dinheiroRecebidoCentavos(ajustes.desconto,0),acrescimoCentavos:core.dinheiroRecebidoCentavos(ajustes.acrescimo,0),motivo:ajustes.motivo},subtotalCentavos);
    const totalCentavos=ajuste?subtotalCentavos-ajuste.descontoCentavos+ajuste.acrescimoCentavos:subtotalCentavos;
    let pagamentos;
    if(outrasFormas!==undefined){
      if(!outrasFormas||typeof outrasFormas!=='object'||Array.isArray(outrasFormas)||Object.keys(outrasFormas).some(k=>!['PIX','Débito','Crédito','Voucher'].includes(k)))throw new Error('Formas de pagamento inválidas.');
      pagamentos=['PIX','Débito','Crédito','Voucher'].map(forma=>({forma,valorCentavos:core.dinheiroRecebidoCentavos(outrasFormas[forma],0)})).filter(p=>p.valorCentavos>0);
      const restante=totalCentavos-pagamentos.reduce((s,p)=>s+p.valorCentavos,0);
      if(restante<0)throw new Error('Pix, cartões e voucher excedem o total. Corrija os valores conferidos.');
      if(restante)pagamentos.unshift({forma:'Dinheiro',valorCentavos:restante});
    }
    const dinheiro=pagamentos?pagamentos.find(p=>p.forma==='Dinheiro')?.valorCentavos||0:totalCentavos;
    const normalized=core.normalizarVendaLocal({vendaId,itens,totalCentavos,...(ajuste?{ajuste}:{}),...(pagamentos?{pagamentos}:{}),recebidoDinheiroCentavos:core.dinheiroRecebidoCentavos(recebido,dinheiro)});
    const reference={id:turno.id,terminalId:turno.terminalId,dataAbertura:turno.dataAbertura};
    const venda={id:vendaId,turnoId:turno.id,terminalId:turno.terminalId,data:agora(),status:'concluida',formaPagamento:'Dinheiro',total:normalized.totalCentavos/100,itens:locais,recebidoDinheiroCentavos:normalized.recebidoDinheiroCentavos,trocoCentavos:normalized.trocoCentavos,valorPago:normalized.recebidoDinheiroCentavos/100,troco:normalized.trocoCentavos/100};
    if(normalized.ajuste)Object.assign(venda,{ajuste:normalized.ajuste,subtotal:normalized.subtotalCentavos/100,desconto:normalized.ajuste.descontoCentavos/100,acrescimo:normalized.ajuste.acrescimoCentavos/100});
    if(normalized.pagamentos){
      const unico=normalized.pagamentos.length===1;
      venda.formaPagamento=unico?normalized.pagamentos[0].forma:'Múltiplos';
      venda.pagamentoDividido=!unico;
      venda.pagamentos=normalized.pagamentos.map(p=>({forma:p.forma,valor:p.valorCentavos/100,...(p.forma==='Dinheiro'?{valorEntregue:normalized.recebidoDinheiroCentavos/100}:{})}));
      venda.pagamentosCentavos=normalized.pagamentos;
      venda.valorPago=(normalized.totalCentavos+normalized.trocoCentavos)/100;
    }
    return {payload:{...normalized,turno:reference,confirmado:true},venda,lojaId};
  }
  async function executar(plano, bindingPronto) {
    if(storage.getItem('flowpdv_estorno_local_pendente'))throw new Error('Retome o estorno pendente antes de vender.');
    let p=pendente();if(p&&plano&&JSON.stringify(p)!==JSON.stringify(plano)) throw new Error('Já existe outra venda pendente.');
    p=p||plano;if(!p) throw new Error('Nenhuma venda pendente.');
    if(p.cancelamento) throw new Error('Retome o cancelamento pendente; esta tentativa não pode ser vendida novamente.');
    const turno=servico.getTurnoAtual();if(!turno||turno.id!==p.venda.turnoId||turno.terminalId!==p.venda.terminalId) throw new Error('Recupere o turno original da venda pendente.');
    const binding=bindingPronto?.vinculado?bindingPronto:await call('consultarMeuTerminalV2',{});
    if(!binding.vinculado||binding.lojaId!==p.lojaId||binding.papel!=='caixa') throw new Error('Terminal não está vinculado à loja desta migração.');
    if(!pendente()) storage.setItem(key,JSON.stringify(p));
    aoPersistirPendencia(p);
    const recibo=await call('registrarBaixaVendaLocalV2',p.payload);
    const expected=core.normalizarVendaLocal(p.payload);
    if(JSON.stringify(core.normalizarVendaLocal(recibo.venda))!==JSON.stringify(expected)||recibo.vendaId!==p.venda.id) throw new Error('Resposta do servidor diverge da venda pendente.');
    servico.saveVendaComEstoqueServidorTeste(p.venda,recibo);
    const ack=await call('confirmarGravacaoVendaLocalV2',{vendaId:p.venda.id,reciboId:recibo.reciboId});
    if(ack.confirmado!==true) throw new Error('Servidor ainda não confirmou a gravação local.');
    storage.removeItem(key);return p.venda;
  }
  async function cancelar(motivo,confirmado) {
    const p=pendente();if(!p) throw new Error('Nenhuma tentativa pendente.');
    if(storage.getItem('flowpdv_commit_venda')||servico.getVendas().some(v=>v.id===p.venda.id)) throw new Error('A venda já começou a ser gravada. Retome a venda; a devolução exige estorno.');
    const turno=servico.getTurnoAtual();if(!turno||turno.id!==p.venda.turnoId||turno.terminalId!==p.venda.terminalId) throw new Error('Recupere o turno original da tentativa.');
    if(!p.cancelamento){
      motivo=typeof motivo==='string'?motivo.trim():'';
      if(confirmado!==true||motivo.length<5||motivo.length>180) throw new Error('Confirme a devolução do dinheiro, se recebido, e informe um motivo entre 5 e 180 caracteres.');
      p.cancelamento={motivo,confirmado:true};
    }
    const binding=await call('consultarMeuTerminalV2',{});
    if(!binding.vinculado||binding.lojaId!==p.lojaId||binding.papel!=='caixa') throw new Error('Terminal não está vinculado à loja desta tentativa.');
    storage.setItem(key,JSON.stringify(p));
    aoPersistirPendencia(p);
    const result=await call('cancelarTentativaVendaLocalV2',{...p.payload,...p.cancelamento});
    if(result.cancelado!==true||result.vendaId!==p.venda.id||result.lojaId!==p.lojaId) throw new Error('Servidor ainda não confirmou o cancelamento desta tentativa.');
    storage.removeItem(key);return result;
  }
  return {preparar,prepararCarrinho,executar,pendente,cancelar};
}
