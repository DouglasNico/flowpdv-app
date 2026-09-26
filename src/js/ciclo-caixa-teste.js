import { incorporarResumoRestaurante } from './resumo-restaurante-caixa.js';

// Somente perfil isolado. Não usa os métodos legados que disparam sincronização ou impressão.
export function criarCicloCaixaTeste({ storage, ambienteTeste, terminalId, calcular, conferir, call, uuid, agora, nomeOperador = () => 'Operador de teste' }) {
  if (ambienteTeste !== true) throw new Error('Ciclo disponível somente no ambiente de teste.');
  const current='adega_turno_atual', history='adega_turnos_historico', journal='flowpdv_ciclo_teste_pendente';
  const read=key=>JSON.parse(storage.getItem(key)||'null');
  const put=(key,value)=>value===null?storage.removeItem(key):storage.setItem(key,value);
  const idTerminal=()=>storage.getItem('flowpdv_device_id')||terminalId;
  function recuperar() {
    const p=read(journal);if(!p) return;
    for(const key of [current,history]) if(![p.antes[key],p.depois[key]].includes(storage.getItem(key))) throw new Error('Estado local mudou durante a recuperação. Confira o histórico.');
    put(history,p.depois[history]);put(current,p.depois[current]);storage.removeItem(journal);
  }
  function gravar(turno,historico) {
    const antes={[current]:storage.getItem(current),[history]:storage.getItem(history)};
    const depois={[current]:turno?JSON.stringify(turno):null,[history]:JSON.stringify(historico)};
    storage.setItem(journal,JSON.stringify({antes,depois}));recuperar();
  }
  const referencia=t=>({id:t.id,terminalId:t.terminalId,dataAbertura:t.dataAbertura});
  function estado() {return {atual:read(current),historico:read(history)||[]};}
  // As consultas remotas podem terminar depois de uma venda ou alteração do histórico.
  const capturarBase = () => [current, history, 'adega_vendas'].map(key => [key, storage.getItem(key)]);
  function exigirBaseInalterada(base) {
    if(base.some(([key,valor])=>storage.getItem(key)!==valor)) throw new Error('O caixa recebeu alterações durante a consulta. Confira novamente antes de continuar.');
  }
  function inteiro(n) {if(!Number.isSafeInteger(n)||n<0||n>1e12) throw new Error('Valor de caixa inválido.');}
  // Turno já arquivado no histórico, mas o ponteiro "atual" ficou aberto — só limpa o atual.
  function destravarSeJaArquivado() {
    recuperar();
    const {atual:t,historico}=estado();
    if(!t||t.status!=='aberto') return null;
    const arquivado=historico.find(h=>h&&h.id===t.id);
    if(!arquivado) return null;
    gravar(null,historico);
    return arquivado;
  }
  function montarFechado(t,merged,dinheiroContadoCentavos,{cego=false}={}) {
    conferir(t);
    const r=calcular(merged);
    const {historico}=estado();
    if(historico.some(h=>h.id===t.id)) throw new Error('Turno já consta no histórico. Confira a recuperação.');
    const esperado=Math.round(r.saldoEmGaveta*100);if(!Number.isSafeInteger(esperado)) throw new Error('Saldo esperado inválido.');
    return {...merged,status:'fechado',dataFechamento:agora(),totalDinheiro:r.totalDinheiro,totalPix:r.totalPix,totalDebito:r.totalDebito,totalCredito:r.totalCredito,totalFiado:r.totalFiado,totalCartaoNaoClassificado:r.totalCartaoNaoClassificado,fundoRestaurante:r.fundoRestaurante,totalVendasGeral:r.totalVendas,totalSangrias:r.totalSangrias,dinheiroGaveta:esperado/100,saldoEsperado:esperado/100,saldoInformado:dinheiroContadoCentavos/100,diferenca:(dinheiroContadoCentavos-esperado)/100,qtdVendas:r.vendasCount,fechamentoCego:cego===true};
  }
  async function encerrar({dinheiroContadoCentavos,confirmado}) {
    const ja=destravarSeJaArquivado();if(ja) return ja;
    recuperar();inteiro(dinheiroContadoCentavos);
    const {atual:t,historico}=estado();
    if(!t||t.status!=='aberto'||t.terminalId!==idTerminal()||!confirmado) throw new Error('Confira o turno aberto e confirme a contagem.');
    const base=capturarBase();
    const snapshot=await call('obterResumoFechadoTurnoV2',{turno:referencia(t)});
    exigirBaseInalterada(base);
    if(JSON.stringify(read(current))!==JSON.stringify(t)) throw new Error('Turno local mudou. Confira novamente.');
    const fechado=montarFechado(t,incorporarResumoRestaurante(t,snapshot),dinheiroContadoCentavos);
    gravar(null,[fechado,...historico]);return fechado;
  }
  // Servidor sem turno aberto para este terminal: libera o caixa local com a contagem informada.
  function encerrarOrfaoLocal({dinheiroContadoCentavos,confirmado}) {
    const ja=destravarSeJaArquivado();if(ja) return ja;
    recuperar();inteiro(dinheiroContadoCentavos);
    const {atual:t,historico}=estado();
    if(!t||t.status!=='aberto'||t.terminalId!==idTerminal()||!confirmado) throw new Error('Confira o turno aberto e confirme a contagem.');
    const fechado=montarFechado(t,t,dinheiroContadoCentavos,{cego:true});
    gravar(null,[fechado,...historico]);return fechado;
  }
  async function abrir({fundoCentavos,confirmado}) {
    recuperar();inteiro(fundoCentavos);
    if(!confirmado) throw new Error('Confirme o fundo de troco para abrir.');
    const terminal=idTerminal();
    let {atual:t,historico}=estado();
    if(t&&t.status!=='abertura_pendente') throw new Error('Encerre o turno atual antes de abrir outro.');
    if(t&&(t.terminalId!==terminal||t.fundoRestauranteCentavos!==fundoCentavos)) throw new Error('Retome a abertura pendente com o mesmo fundo de troco.');
    const criouPendencia=!t;
    if(!t){const nome=nomeOperador();t={id:`TRN-${uuid()}`,terminalId:terminal,dataAbertura:agora(),status:'abertura_pendente',trocoInicial:0,sangrias:[],fundoRestauranteCentavos:fundoCentavos,operador:typeof nome==='string'&&nome.trim()?nome.trim():'Operador de teste'};gravar(t,historico);}
    const base=capturarBase();
    try {
      const result=await call('abrirTurnoCaixaV2',{turno:referencia(t),trocoInicialCentavos:fundoCentavos});
      exigirBaseInalterada(base);
      if(JSON.stringify(read(current))!==JSON.stringify(t)) throw new Error('Abertura local mudou. Atualize antes de continuar.');
      if(result.turno?.status!=='aberto'||result.turno.id!==t.id||result.turno.terminalId!==terminal||result.turno.dataAbertura!==t.dataAbertura||result.turno.trocoInicialCentavos!==fundoCentavos) throw new Error('Servidor não confirmou esta abertura. Retome a tentativa.');
      gravar({...t,status:'aberto'},historico);return result.turno;
    } catch (erro) {
      const msg=String(erro&&erro.message||erro||'');
      if(/já possui outro turno aberto/i.test(msg)) {
        if(criouPendencia){
          const atual=read(current);
          if(atual&&atual.id===t.id&&atual.status==='abertura_pendente') gravar(null,historico);
        }
        return retomarTurnoServidor();
      }
      throw erro;
    }
  }
  async function retomarTurnoServidor() {
    recuperar();
    let {atual,historico}=estado();
    const terminal=idTerminal();
    if(atual?.status==='aberto'&&atual.terminalId===terminal) {
      try {
        const consultadoLocal=await call('consultarTurnoCaixaV2',{turno:referencia(atual)});
        if(consultadoLocal.turno?.status==='aberto') return atual;
      } catch (_) { /* local desalinhado do servidor — retoma pelo slot remoto */ }
    }
    const lista=await call('listarTurnosRecuperacaoV2',{});
    const turnos=lista.turnos||[];
    // Lista já vem filtrada pela identidade do terminal; aceita o aberto mesmo se o deviceId local divergir.
    const aberto=turnos.find(t=>t.status==='aberto'&&t.terminalId===terminal)||turnos.find(t=>t.status==='aberto');
    if(!aberto) throw new Error('Não há turno aberto neste terminal no servidor.');
    const terminalTurno=aberto.terminalId||terminal;
    const consultado=await call('consultarTurnoCaixaV2',{turno:{id:aberto.id,terminalId:terminalTurno,dataAbertura:aberto.dataAbertura}});
    const remoto=consultado.turno;
    if(!remoto||remoto.status!=='aberto') throw new Error('O turno do servidor não está aberto para retomada.');
    if(terminalTurno!==terminal&&typeof storage.setItem==='function') storage.setItem('flowpdv_device_id',terminalTurno);
    const vendas=JSON.parse(storage.getItem('adega_vendas')||'[]')||[];
    const vendasIds=[...new Set(vendas.filter(v=>v&&v.turnoId===aberto.id).map(v=>v.id))];
    const nome=nomeOperador();
    const local={
      id:aberto.id,
      terminalId:terminalTurno,
      dataAbertura:aberto.dataAbertura,
      status:'aberto',
      trocoInicial:0,
      sangrias:Array.isArray(atual?.sangrias)&&atual.id===aberto.id?atual.sangrias:[],
      fundoRestauranteCentavos:Number.isSafeInteger(remoto.trocoInicialCentavos)?remoto.trocoInicialCentavos:0,
      operador:typeof nome==='string'&&nome.trim()?nome.trim():(atual?.operador||'Operador de teste'),
      vendasIds,
      estornosLocaisV2:Array.isArray(atual?.estornosLocaisV2)&&atual.id===aberto.id?atual.estornosLocaisV2:[]
    };
    gravar(local,historico);
    return remoto;
  }
  return {estado,recuperar,encerrar,encerrarOrfaoLocal,abrir,retomarTurnoServidor};
}
