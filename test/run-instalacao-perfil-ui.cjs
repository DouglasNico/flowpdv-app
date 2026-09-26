const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), os = require('node:os');
const { spawnSync } = require('node:child_process'), { createHash } = require('node:crypto');
const admin = require('../functions/node_modules/firebase-admin');
(async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080'); assert.equal(process.env.GCLOUD_PROJECT, 'demo-flowpdv');
  admin.initializeApp({projectId:'demo-flowpdv'}); const db=admin.firestore();
  const lojaId='loja-instalacao', origemUid='caixa-original-instalacao', gerenteUid='gerente-instalacao', base=`lojas_v2/${lojaId}`;
  const liberacao=process.env.FLOWPDV_RELEASE_PROFILE_TEST==='1';
  const pendencias=process.env.FLOWPDV_PENDING_RECOVERY_TEST==='1';
  const fechamento=process.env.FLOWPDV_CLOSE_PROFILE_TEST==='1';
  await admin.auth().createUser({uid:origemUid});
  await admin.auth().createUser({uid:gerenteUid,email:'gerente-instalacao@example.test',emailVerified:true,password:'TesteInstalacao-123!'});
  await db.doc(base).set({ativo:true,caixaV2:{exigirTurno:true},ativacaoOperacionalV2:{schema:1,ambiente:'homologacao',estado:'habilitada',revisao:1}});
  await db.doc(`${base}/membros/${gerenteUid}`).set({ativo:true,papel:'gerente',tipo:'usuario'});
  await db.doc(`${base}/membros/${origemUid}`).set({ativo:true,papel:'caixa',tipo:'terminal'});
  await db.doc(`terminais_v2/${origemUid}`).set({ativo:true,papel:'caixa',lojaId});
  const turno=require('../functions/turno-referencia-v2').referenciaTurno({id:'TRN-ORIGINAL',terminalId:'TERM-ORIGINAL',dataAbertura:'2026-09-22T10:00:00.000Z'},origemUid);
  await db.doc(`${base}/turnos_v2/${turno.chave}`).set({...turno,status:'aberto',revisao:2,trocoInicialCentavos:0,totalCentavos:0,formas:{dinheiro:0,pix_manual:0,cartao_manual:0},movimentos:0,baixasLocaisPendentes:0});
  await db.doc(`${base}/caixas_v2/${origemUid}`).set({turnoChave:turno.chave});
  const produto={id:'farinha',nome:'Farinha',unidade:'g',estoque:2500,preco:0.02};
  await db.doc(`${base}/migracoes_estoque/${createHash('sha256').update('farinha').digest('hex')}`).set({estoqueId:'farinha',plano:{legadoId:'farinha',nome:'Farinha',unidadeOrigem:'g',unidade:'kg',saldoMili:2500}});
  await db.doc(`${base}/estoque/farinha`).set({saldoMili:2500,unidade:'kg'});
  const contas=db.batch();
  for(let i=0;i<55;i++)contas.set(db.doc(`${base}/atendimentos/conta-${String(i).padStart(3,'0')}`),{tipo:'mesa',status:'aberto',totalCentavos:1000,versao:1,telefone:'nao-expor'});
  contas.set(db.doc(`${base}/pedidos/aguarda-caixa`),{tipo:'retirada',status:'novo',recebidoPdv:false,totalCentavos:1200});
  await contas.commit();
  const pacote={tipo:'flowpdv_homologacao_v2',versao:1,origem:{lojaId,terminalUid:origemUid,terminalId:turno.terminalId},dados:{flowpdv_device_id:turno.terminalId,adega_turno_atual:JSON.stringify({...turno,status:'aberto'}),adega_produtos:JSON.stringify([produto]),adega_vendas:'[]',adega_turnos_historico:'[]',flowpdv_migracoes_estoque_teste:JSON.stringify([{lojaId,status:'confirmado',produto,estoqueId:'farinha'}])}};
  if(liberacao){
    await db.doc(`${base}/turnos_v2/${turno.chave}`).delete();await db.doc(`${base}/caixas_v2/${origemUid}`).delete();
    const limpar=db.batch();for(const d of (await db.collection(`${base}/atendimentos`).get()).docs)limpar.delete(d.ref);limpar.delete(db.doc(`${base}/pedidos/aguarda-caixa`));await limpar.commit();
    await db.doc(`${base}/estoque/farinha`).update({saldoMili:2250});pacote.dados.adega_turno_atual='null';
  }
  if(fechamento){
    const limpar=db.batch();for(const d of (await db.collection(`${base}/atendimentos`).get()).docs)limpar.delete(d.ref);limpar.delete(db.doc(`${base}/pedidos/aguarda-caixa`));await limpar.commit();
    pacote.dados.adega_turno_atual=JSON.stringify({...turno,status:'aberto',trocoInicial:10,sangrias:[{valor:2,motivo:'Comprovante fictício'}]});
  }
  if(pendencias){
    const itens=[{linhaId:'L',origemPedidoId:'recebido',origemLinhaId:'recebido:L',produtoId:'lanche',nome:'Lanche',quantidade:1,precoUnitarioCentavos:500,totalCentavos:500,opcoes:[]}];
    await db.doc(base+'/mesas/M1').set({ativo:true,comandaPdvId:'MESA-1',atendimentoId:'C1',ciclo:1});
    await db.doc(base+'/atendimentos/C1').set({tipo:'mesa',status:'aberto',versao:1,mesaId:'M1',comandaPdvId:'MESA-1',itens,totalCentavos:500});
    await db.doc(base+'/pedidos/recebido').set({tipo:'mesa',mesaId:'M1',status:'novo',recebidoPdv:true,atendimentoId:'C1',pagamento:'pendente',itens,totalCentavos:500});
    await db.doc(base+'/pedidos/aguarda-caixa').set({tipo:'retirada',status:'novo',recebidoPdv:false,pagamento:'pendente',itens,totalCentavos:500});
  }
  if(process.env.FLOWPDV_RECOVER_PAYMENT_TEST==='1'){
    const pagamentos=[{forma:'dinheiro',valorCentavos:500}],recebidoDinheiro=1000;
    const payload={turno,atendimentoId:'CONTA-PAGA',versao:1,pagamentos,recebidoDinheiroCentavos:recebidoDinheiro,confirmado:true};
    const itens=[{origemLinhaId:'PG:L',origemPedidoId:'PG',produtoId:'lanche',nome:'Lanche',quantidade:1,precoUnitarioCentavos:500,totalCentavos:500,opcoes:[]}];
    await db.doc(base+'/vendas/CONTA-PAGA').set({status:'concluida',terminalUid:origemUid,turno,totalCentavos:500,trocoCentavos:500,itens,pagamentos,fingerprint:JSON.stringify({versao:1,pagamentos,recebidoDinheiro,turno})});
    await db.doc(base+'/atendimentos/CONTA-PAGA').set({tipo:'retirada',status:'fechado',vendaId:'CONTA-PAGA',versao:2,itens,totalCentavos:500});
    await db.doc(base+'/movimentos_financeiros/CONTA-PAGA').set({tipo:'recebimento_manual',terminalUid:origemUid,turno,vendaId:'CONTA-PAGA',totalCentavos:500,pagamentos});
    await db.doc(base+'/turnos_v2/'+turno.chave).update({revisao:3,movimentos:1,totalCentavos:500,formas:{dinheiro:500,pix_manual:0,cartao_manual:0}});
    pacote.dados.flowpdv_pagamento_atendimento_pendente=JSON.stringify({schema:1,lojaId,terminalUid:origemUid,payload,totalCentavos:500});
  }
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'flowpdv-install-ui-')), arquivo=path.join(scratch,'backup.json');fs.writeFileSync(arquivo,JSON.stringify(pacote));
  const result=spawnSync(require('electron'),[path.join(__dirname,'electron-isolation.smoke.cjs')],{stdio:'inherit',timeout:240000,env:{...process.env,FLOWPDV_VISIBLE_TEST:'0',FLOWPDV_PAIRING_UI_TEST:'0',FLOWPDV_INSTALL_UI_TEST:'1',FLOWPDV_TEST_PROFILE_NAME:'destino',FLOWPDV_PROFILE_SCRATCH:scratch,FLOWPDV_INSTALL_BACKUP:arquivo}});
  if(result.error)throw result.error;assert.equal(result.status,0);
  assert.equal((await db.doc(`${base}/estoque/farinha`).get()).data().saldoMili,liberacao?2000:2500);
  assert.equal((await db.collection(`${base}/vendas_locais_v2`).get()).size,liberacao?1:0);
  assert.equal((await db.collection(`${base}/atendimentos`).where('status','==','aberto').get()).size,pendencias?2:liberacao||fechamento?0:55);
  if(!liberacao&&!fechamento)assert.equal((await db.doc(`${base}/pedidos/aguarda-caixa`).get()).data().recebidoPdv,false);
  if(fechamento){assert.equal((await db.collection(`${base}/fechamentos_recuperados`).get()).size,1);assert.equal((await db.doc(`${base}/turnos_v2/${turno.chave}`).get()).data().status,'fechado');}
  if(pendencias){assert.equal((await db.collection(base+'/liberacoes_perfis').get()).size,1);const pedido=(await db.doc(base+'/pedidos/aguarda-caixa').get()).data();assert.equal(pedido.recebidoPdv,true);assert.equal(pedido.pagamento,'pendente');const conta=(await db.doc(base+'/atendimentos/'+pedido.atendimentoId).get()).data();assert.equal(conta.status,'aberto');assert.equal(conta.itens.length,1);assert.equal(conta.totalCentavos,500);assert.equal((await db.collection(base+'/vendas').get()).size,0);}
  if(liberacao){assert.equal((await db.collection(`${base}/liberacoes_perfis`).get()).size,1);const novos=await db.collection(`${base}/turnos_v2`).get();assert.equal(novos.size,1);assert.equal(novos.docs[0].data().trocoInicialCentavos,1000);}
  if(process.env.FLOWPDV_RECOVER_PAYMENT_TEST==='1'){assert.equal((await db.collection(base+'/vendas').get()).size,1);assert.equal((await db.collection(base+'/movimentos_financeiros').get()).size,1);}
  assert.equal((await db.doc(`terminais_v2/${origemUid}`).get()).data().ativo,false);
  console.log('INSTALACAO PERFIL UI PASS: perfil novo restaurado, identidade própria preservada, bloqueio após recarga e estoque inalterado.');
  await admin.app().delete();
})().catch(e=>{console.error(e);process.exitCode=1;});
