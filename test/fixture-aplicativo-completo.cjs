// Dados fictícios exclusivos do teste Electron descartável. Nunca carregados pelo app distribuído.
module.exports=()=>{
  const produto={id:'produto-migrado-app',nome:'Produto fictício migrado',unidade:'un',precoVenda:10,estoque:20,controlarEstoque:true,categoria:'Alimentos'};
  const data={
    flowpdv_device_id:'terminal-app-completo-ficticio',
    adega_licenca:{chaveLicenca:'LIC-APP-FICTICIA',status:'ativa',nomeCliente:'Loja fictícia de integração',dataExpiracao:new Date(Date.now()+86400000*30).toISOString(),whatsappSuporte:'',chavePixSuporte:'teste-local'},
    flowpdv_usuarios:[{id:'operador-ficticio',nome:'Operador de teste',pin:'876543',cargo:'gerente',ativo:true}],
    adega_produtos:[produto],adega_vendas:[],adega_clientes:[],adega_turnos_historico:[],
    adega_turno_atual:{id:'turno-app-ficticio',terminalId:'terminal-app-completo-ficticio',dataAbertura:new Date().toISOString(),status:'aberto',trocoInicial:0,sangrias:[]},
    flowpdv_migracoes_estoque_teste:[{status:'confirmado',lojaId:'loja-app-ficticia',produto,estoqueId:'estoque-ficticio'}]
  };
  return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
};
