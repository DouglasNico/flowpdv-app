import core from '../../functions/estoque-migracao-core.cjs';
export const planejarSaldoLegado=core.planejarSaldoLegado;
export async function migrarEstoqueTeste({storage,ambienteTeste,contexto,produto,call}) {
  if(ambienteTeste!==true) throw new Error('Migração disponível somente no teste.');
  planejarSaldoLegado(produto);
  const key='flowpdv_migracoes_estoque_teste',records=JSON.parse(storage.getItem(key)||'[]');
  let entry=records.find(r=>String(r.produto.id)===String(produto.id));
  if(entry&&(entry.lojaId!==contexto.lojaId||JSON.stringify(entry.produto)!==JSON.stringify(produto))) throw new Error('Produto já vinculado a outra migração. Confira antes de continuar.');
  if(!entry){entry={lojaId:contexto.lojaId,produto:JSON.parse(JSON.stringify(produto)),status:'pendente'};records.push(entry);storage.setItem(key,JSON.stringify(records));}
  // A trava local é persistida antes da chamada. Uma resposta perdida mantém o item protegido.
  const result=await call('migrarSaldoLegadoV2',{...contexto,produto:entry.produto,confirmado:true});
  entry.status='confirmado';entry.estoqueId=result.estoqueId;entry.plano=result.plano;
  storage.setItem(key,JSON.stringify(records));return result;
}
