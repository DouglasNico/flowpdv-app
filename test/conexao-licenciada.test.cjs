const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/js/conexao-licenciada-core.js','utf8').replace('export function','function'),ctx);
function fixture(){
 let context={chaveLicenca:'LIC-TEST',deviceId:'TERM-TEST',tipoTerminal:'atendimento'},operator={},linked=false,logouts=0,calls=0,hook=async()=>{};
 const result=()=>({vinculado:linked,...context,papel:context.tipoTerminal});
 const access={prepararTerminal:async()=>{await hook();return {uid:'anon',vinculo:result()};},entrarGerencia:async()=>{},consultarTerminal:async()=>({vinculo:result()})};
 const services={criarAcesso:()=>access,encerrarGerencia:async()=>{logouts++;},gerencia:()=>({call:async(name,data)=>{assert.equal(name,'vincularTerminalLicenciadoV2');assert.equal(data.terminalUid,'anon');calls++;linked=true;}})};
 const c=ctx.criarConexaoLicenciada({servicos:services,obterContexto:()=>context,exigirGerente:()=>{},obterOperador:()=>operator});
 return {c,access,services,set linked(v){linked=v},set hook(v){hook=v},change:()=>context.tipoTerminal='caixa',operator:()=>operator={},stats:()=>({calls,logouts})};
}
test('consulta não pede login; conexão usa licença e confirma vínculo, encerrando gerência',async()=>{const f=fixture();assert.equal((await f.c.consultar()).vinculado,false);assert.equal((await f.c.conectar('e','s')).papel,'atendimento');assert.deepEqual(f.stats(),{calls:1,logouts:1});await f.c.conectar('e','s');assert.equal(f.stats().calls,1);});
test('mudança de função ou operador interrompe o fluxo',async()=>{for(const change of ['change','operator']){const f=fixture();f.hook=async()=>f[change]();await assert.rejects(f.c.conectar('e','s'),/mudou/);assert.equal(f.stats().calls,0);}});
test('falha após gravação permite consultar sem repetir vínculo',async()=>{const f=fixture();f.access.consultarTerminal=async()=>{throw Error('offline')};await assert.rejects(f.c.conectar('e','s'),/offline/);assert.equal((await f.c.consultar()).vinculado,true);assert.deepEqual(f.stats(),{calls:1,logouts:1});});
test('falha de login encerra sessão; vínculo incompatível é recusado',async()=>{const f=fixture();f.access.entrarGerencia=async()=>{throw Error('login')};await assert.rejects(f.c.conectar('e','s'),/login/);assert.equal(f.stats().logouts,1);f.access.prepararTerminal=async()=>({vinculo:{vinculado:true,papel:'caixa'}});await assert.rejects(f.c.consultar(),/não corresponde/);});
test('chamada simultânea bloqueada; fábrica com falha não trava próxima tentativa',async()=>{const f=fixture();let resolve;f.hook=()=>new Promise(r=>resolve=r);const p=f.c.consultar();await assert.rejects(f.c.consultar(),/Aguarde/);resolve();await p;const original=f.services.criarAcesso;f.services.criarAcesso=()=>{throw Error('factory')};await assert.rejects(f.c.consultar(),/factory/);f.services.criarAcesso=original;f.hook=async()=>{};await f.c.consultar();});

test('função divergente da mesma identidade fica pendente e pode ser confirmada',async()=>{
 const f=fixture();let papel='caixa';
 const vinculo=()=>({vinculado:true,chaveLicenca:'LIC-TEST',deviceId:'TERM-TEST',papel});
 f.access.prepararTerminal=async()=>({uid:'anon',vinculo:vinculo()});
 f.access.consultarTerminal=async()=>({vinculo:vinculo()});
 f.services.gerencia=()=>({call:async()=>{papel='atendimento'}});
 const pending=await f.c.consultar();assert.equal(pending.ajusteFuncao,true);assert.equal(pending.papelAtual,'caixa');
 assert.equal((await f.c.conectar('e','s')).papel,'atendimento');assert.equal(f.stats().logouts,1);
});

test('seletor abre conferência sem toast de sucesso e restaura controle após falha',async()=>{
 const source=fs.readFileSync('src/js/app.js','utf8');
 const method=source.slice(source.indexOf('  salvarTipoTerminalLocal(valor) {'),source.indexOf('  verificarValidadesAoIniciar() {')).trim().replace(/,$/,'');
 let abrir=0,sync=0,fail=false;const toast=[],select={disabled:false};
 const scope={AuthModule:{isGerente:()=>true},document:{getElementById:()=>select},window:{LicencaModule:{setTipoTerminalAtual:async()=>{if(fail)throw Error('offline')}},ConexaoCardapio:{conferirAposTroca:async()=>{abrir++;return true}}}};
 vm.createContext(scope);const app=vm.runInContext('({'+method+'})',scope);
 app.sincronizarSelectTipoTerminal=()=>sync++;app.aplicarModoTerminal=()=>{};app.showToast=(...args)=>toast.push(args);
 app.salvarTipoTerminalLocal('caixa');await new Promise(r=>setImmediate(r));assert.equal(abrir,1);assert.equal(toast.length,0);assert.equal(select.disabled,false);
 fail=true;app.salvarTipoTerminalLocal('atendimento');await new Promise(r=>setImmediate(r));assert.equal(abrir,1);assert.equal(toast[0][1],'error');assert.equal(select.disabled,false);assert.equal(sync,2);
});
