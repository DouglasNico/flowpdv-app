const assert=require('node:assert/strict');
module.exports=async(_win,{js})=>{
  const resultado=await js(`(async()=>{
    const chaves=['adega_vendas','adega_produtos','adega_turno_atual','adega_turnos_historico','flowpdv_migracoes_estoque_teste','flowpdv_venda_servidor_pendente','flowpdv_estoque_movimentos','adega_licenca'];
    const snapshot=()=>JSON.stringify(chaves.map(k=>[k,localStorage.getItem(k)]));
    const antes=snapshot(),erros=[];
    for(const operacao of [()=>StorageService.importarBackupCompleto({tipo:'flowpdv_backup',vendas:[],produtos:[]}),()=>CloudSyncModule.carregarBaseCompletaNovaEmpresa({vendas:[],produtos:[]}),()=>StorageService.limparDadosLocaisParaNovaEmpresa({})]){
      try{operacao();erros.push(null);}catch(e){erros.push(e.message);}
    }
    document.querySelectorAll('.flow-notice__close').forEach(b=>b.click());
    await BackupModule.restaurarBackupNuvem();
    return {erros,intacto:antes===snapshot(),aviso:document.querySelector('.flow-notifications')?.textContent||document.getElementById('toast-container')?.textContent||''};
  })()`);
  assert.equal(resultado.intacto,true);assert.equal(resultado.erros.length,3);
  assert.ok(resultado.erros.every(e=>e?.includes('recuperação específica')));
  assert.match(resultado.aviso,/recuperação específica/);
  console.log('BACKUP PROTECAO INTEGRADA PASS: arquivo, troca de loja e restauração antiga não sobrescrevem vendas/caixa/estoque V2.');
};
