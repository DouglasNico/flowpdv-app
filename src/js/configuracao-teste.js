import { criarAlteracaoAtivacaoTeste } from './ativacao-pendente-teste.js';
import { onAuthStateChanged } from 'firebase/auth';
import qrcode from 'qrcode-generator';
import { sessaoGerenciaTeste } from './sessoes-homologacao.js';
import { StorageService } from './storage.js';
import { planejarSaldoLegado, migrarEstoqueTeste } from './migracao-estoque-teste.js';

export function instalarConfiguracaoTeste() {
  if (window.electronAPI?.ambienteTeste !== true || document.getElementById('admin-open')) return;
  const launch = document.createElement('button'); launch.id = 'admin-open'; launch.textContent = 'Administrar loja • teste';
  launch.style.cssText = 'position:fixed;right:18px;bottom:252px;z-index:2147483645;padding:12px 18px;border:0;border-radius:10px;background:#334155;color:white;cursor:pointer';
  const modal = document.createElement('dialog'); modal.id = 'admin-dialog'; modal.setAttribute('aria-labelledby', 'admin-title');
  const input = (id, label, extra = '') => `<label for="${id}">${label}</label><input id="${id}" ${extra}>`;
  const check = (id, label) => `<label class="adm-check"><input id="${id}" type="checkbox"> ${label}</label>`;
  const productSelect = id => `<label for="${id}">Produto</label><select id="${id}" class="adm-products" required></select>`;
  modal.innerHTML = `<style>
    #admin-dialog{width:min(1000px,94vw);max-height:88vh;overflow:auto;margin:auto;border:0;border-radius:16px;padding:24px;background:#f8fafc;color:#0f172a;font:15px/1.5 system-ui}#admin-dialog::backdrop{background:#0f172aaa}#admin-dialog *{box-sizing:border-box}#admin-dialog h2{margin:0}#admin-dialog details{border:1px solid #cbd5e1;padding:16px;border-radius:12px;margin:14px 0;background:white}#admin-dialog summary{cursor:pointer;font-weight:700;font-size:18px}#admin-dialog label{display:block;margin-top:10px}#admin-dialog input:not([type=checkbox]),#admin-dialog select{width:100%;padding:9px;border:1px solid #94a3b8;border-radius:7px;font:inherit}#admin-dialog button{padding:10px 14px;margin:12px 8px 0 0;border:0;border-radius:8px;background:#334155;color:white;font:inherit;cursor:pointer}#admin-dialog button:disabled{opacity:.5}#admin-dialog .adm-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}#admin-dialog .adm-check{padding:6px 0}#admin-message{padding:12px;background:#e2e8f0;border-radius:8px}#admin-qr svg{max-width:160px;height:auto}#admin-dialog table{width:100%;border-collapse:collapse}#admin-dialog td{padding:8px;border-bottom:1px solid #e2e8f0}#admin-dialog p{margin:10px 0}@media(max-width:640px){#admin-dialog .adm-grid{grid-template-columns:1fr}}
  </style><h2 id="admin-title">Administrar loja</h2><p>Configurações da loja fictícia. Entre como gerente em “Configurar acesso de teste” para administrar.</p><button id="admin-close">Fechar</button>
  <form id="admin-load"><div class="adm-grid">${input('admin-shop', 'Código da loja', 'required')}${input('admin-slug', 'Endereço do cardápio (nome curto)', 'required')}</div><button type="submit">Carregar configuração</button></form>
  <p id="admin-message" role="status">Nenhuma loja carregada.</p><div id="admin-content" hidden>
  <details id="admin-activation-section" open><summary>Ativação da homologação</summary><p id="admin-activation-state" role="status"></p><p>Suspender bloqueia novos pedidos e vendas. Recuperação, cancelamentos e estornos continuam com acesso válido. Produção permanece desabilitada.</p>
  <form id="admin-activation-form"><label for="admin-activation-choice">Novo estado</label><select id="admin-activation-choice"><option value="habilitada">Habilitada para testes</option><option value="suspensa">Suspensa</option></select><label for="admin-activation-reason">Motivo</label><input id="admin-activation-reason" required minlength="5" maxlength="180"><label><input id="admin-activation-confirm" type="checkbox" required> Conferi a loja e autorizo esta alteração de homologação.</label><button id="admin-activation-save" type="submit">Aplicar alteração</button></form><button id="admin-activation-resume" type="button" hidden>Retomar alteração pendente</button><button id="admin-activation-refresh" type="button">Atualizar estado</button><p id="admin-activation-pending" role="status"></p></details>
  <details open><summary>Recursos da loja</summary><form id="admin-modules"><label for="admin-segment">Segmento</label><select id="admin-segment"><option value="lanchonete">Lanchonete</option><option value="restaurante">Restaurante</option><option value="adega">Adega</option><option value="mercado">Mercadinho</option><option value="padaria">Padaria</option><option value="roupas">Loja de roupas</option><option value="outro">Outro</option></select>
  <div class="adm-grid"><div>${check('admin-menu', 'Cardápio digital recebendo pedidos')}${check('admin-tables', 'Pedidos por QR Code na mesa')}${check('admin-pickup', 'Pedidos para retirada')}</div><div>${check('admin-print', 'Impressão da cozinha')}${check('admin-kds', 'Monitor da cozinha (KDS)')}</div></div>
  ${check('admin-waiter', 'Atendimento por garçom')}
  <p>Configure o delivery e o acesso dos garçons nas seções próprias abaixo. Os recursos escolhidos aqui não alteram o PDV antigo.</p>
  <div class="adm-grid"><div><label for="admin-terminal">Terminal responsável pela impressão</label><select id="admin-terminal"></select>${input('admin-printer', 'Nome da impressora no Windows')}</div><div><label for="admin-paper">Papel</label><select id="admin-paper"><option value="80">80 mm</option><option value="58">58 mm</option></select></div></div><p>No teste, a impressão continua simulada. Desativar um canal bloqueia pedidos novos; contas já abertas continuam disponíveis.</p><button type="submit">Salvar recursos</button></form></details>
  <details><summary>Delivery: regiões e horários</summary><form id="admin-delivery">
  ${check('admin-delivery-active', 'Aceitar pedidos para entrega')}${input('admin-delivery-minimum', 'Pedido mínimo em produtos (R$)', 'required inputmode="decimal"')}
  <p>Cadastre faixas de CEP sem sobreposição. Taxa e prazo são definidos por região.</p><div id="admin-delivery-regions"></div><button id="admin-delivery-add-region" type="button">Adicionar região</button>
  ${check('admin-delivery-scheduled', 'Limitar delivery aos horários abaixo')}${input('admin-delivery-timezone', 'Fuso horário da loja', 'required placeholder="America/Sao_Paulo"')}
  <p>Horários no fuso da loja. Use 24:00 para o fim do dia. Para atravessar a meia-noite, cadastre dois períodos, um em cada dia. Com a limitação marcada e sem períodos, o delivery fica fechado.</p><div id="admin-delivery-periods"></div><button id="admin-delivery-add-period" type="button">Adicionar horário</button><button type="submit">Salvar delivery</button>
  </form></details>
  <details><summary>Acesso de garçons</summary><p>A conta deve existir e ter e-mail verificado. Cada funcionário recebe seu próprio acesso à loja.</p><p id="admin-waiter-list"></p><form id="admin-waiter-form">${input('admin-waiter-uid','Identificador da conta (UID)','required maxlength="80"')}${check('admin-waiter-active','Autorizar nesta loja')}<button type="submit">Salvar acesso</button></form></details>
  <details><summary>Convidar garçom por e-mail</summary><p>O funcionário cria sua conta e confirma o e-mail antes de aceitar. Este link funciona apenas no computador de teste; o link público depende da implantação HTTPS.</p><form id="admin-waiter-invite"><label for="admin-waiter-email">E-mail do funcionário</label><input id="admin-waiter-email" type="email" required maxlength="254"><button type="submit">Gerar convite local</button><button id="admin-waiter-revoke-invite" type="button">Revogar convite</button><label for="admin-waiter-link">Link de convite (copie para testar)</label><input id="admin-waiter-link" readonly></form></details>
  <details><summary>Mesas e QR Code</summary><form id="admin-table"><label for="admin-table-select">Editar mesa ou criar</label><select id="admin-table-select"></select><button id="admin-tables-more" type="button" hidden>Carregar mais mesas</button><p id="admin-tables-count" role="status"></p><div class="adm-grid">${input('admin-table-id', 'Código da mesa no cardápio', 'required placeholder="mesa-2"')}${input('admin-table-name', 'Nome exibido', 'required placeholder="Mesa 2"')}${input('admin-table-number', 'Número da mesa no PDV', 'required type="number" min="1" max="9999"')}</div>${check('admin-table-active', 'Mesa ativa')}<button type="submit">Salvar mesa</button><button id="admin-show-qr" type="button">Mostrar QR local</button><p id="admin-qr-url"></p><div id="admin-qr"></div><p>O endereço de teste funciona neste computador com o cardápio local iniciado. O QR para clientes será configurado na publicação.</p></form></details>
  <details><summary>Publicação do cardápio</summary><form id="admin-publication"><p id="admin-publication-state"></p>${check('admin-published','Cardápio publicado para consumidores')}<p>Retirar de publicação bloqueia novos pedidos públicos; pedidos já aceitos continuam disponíveis. O garçom usa a autorização própria da loja.</p><button type="submit">Salvar publicação</button></form></details>
  <details><summary>Produtos do cardápio</summary><form id="admin-product"><label for="admin-product-select">Editar produto ou criar</label><select id="admin-product-select"></select><div class="adm-grid">${input('admin-product-id', 'Código do produto', 'required')}${input('admin-product-name', 'Nome', 'required')}${input('admin-product-price', 'Preço (R$)', 'required inputmode="decimal"')}</div><div class="adm-grid">${input('admin-product-category','Categoria','maxlength="60"')}${input('admin-product-order','Ordem de exibição','type="number" min="0" max="9999" value="0"')}${input('admin-product-description','Descrição','maxlength="300"')}${input('admin-product-image','URL pública da foto no Cloudinary','type="url" maxlength="2048"')}</div><p>Use uma imagem já enviada ao Cloudinary. Campo vazio remove a foto; o envio de arquivos à conta não é feito por este formulário.</p>${check('admin-product-active', 'Disponível no cardápio')}${check('admin-product-soldout', 'Esgotado temporariamente')}<button type="submit">Salvar produto</button></form></details>
  <details><summary>Grupos e adicionais</summary><form id="admin-option">${productSelect('admin-option-product')}<label for="admin-option-select">Editar opção ou criar</label><select id="admin-option-select"></select><div class="adm-grid">${input('admin-group-id', 'Código do grupo', 'required placeholder="extras"')}${input('admin-group-name', 'Nome do grupo', 'required placeholder="Adicionais"')}${input('admin-group-min', 'Escolhas mínimas', 'type="number" min="0" max="20" required value="0"')}${input('admin-group-max', 'Escolhas máximas', 'type="number" min="1" max="20" required value="1"')}${input('admin-option-id', 'Código da opção', 'required placeholder="bacon"')}${input('admin-option-name', 'Nome da opção', 'required')}${input('admin-option-price', 'Preço adicional (R$)', 'required inputmode="decimal" value="0,00"')}${input('admin-option-max', 'Quantidade máxima da opção', 'type="number" min="1" max="10" required value="1"')}</div>${check('admin-option-active', 'Opção ativa')}<button type="submit">Salvar opção</button></form></details>
  <details><summary>Insumos e ajuste de estoque</summary><form id="admin-stock"><label for="admin-stock-select">Editar insumo ou criar</label><select id="admin-stock-select"></select><div class="adm-grid">${input('admin-stock-id', 'Código do insumo', 'required')}${input('admin-stock-name', 'Nome', 'required')}<div><label for="admin-unit">Unidade</label><select id="admin-unit"><option value="un">Unidade</option><option value="kg">Quilograma</option><option value="litro">Litro</option></select></div>${input('admin-stock-delta', 'Quantidade a acrescentar ou retirar (use − para saída)', 'inputmode="decimal" required placeholder="Ex.: 10 ou -0,250"')}</div><p id="admin-stock-balance"></p>${input('admin-stock-reason', 'Motivo do ajuste', 'required maxlength="80"')}<button type="submit">Registrar ajuste</button></form></details>
  <details><summary>Ficha de consumo por produto e adicional</summary><form id="admin-recipe">${productSelect('admin-recipe-product')}<label for="admin-recipe-option">Consumo de</label><select id="admin-recipe-option"></select>${check('admin-no-stock', 'Este produto e seus adicionais não controlam estoque')}<p>Informe o consumo por uma unidade vendida. Para uma opção sem consumo, deixe a lista vazia e salve explicitamente.</p><div id="admin-consumptions"></div><button type="button" id="admin-add-consumption">Adicionar insumo</button><button type="submit">Salvar ficha</button></form></details>
  <details id="admin-migration-section"><summary>Migrar saldo do PDV de teste</summary><p>Confira um produto por vez. O saldo migrado será controlado no restaurante; alterações e vendas desse item no fluxo antigo ficam bloqueadas neste perfil. A ficha de consumo deve ser vinculada depois.</p>
  <label for="admin-migration-product">Produto local</label><select id="admin-migration-product"></select><button id="admin-migration-preview" type="button">Conferir conversão</button><p id="admin-migration-plan" role="status"></p>
  <form id="admin-migration-form">${check('admin-migration-confirm','Conferi saldo e unidade e aceito bloquear este item no fluxo antigo de teste.')}<button type="submit">Migrar ou retomar migração</button></form></details>
  </div>`;
  document.body.append(launch, modal); launch.onclick = () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); modal.showModal(); }; modal.querySelector('#admin-close').onclick = () => modal.close();
  const el = id => modal.querySelector(`#${id}`), value = id => el(id).value.trim(), checked = id => el(id).checked, s = sessaoGerenciaTeste();
  let loaded, busy = false, stockRequest = null;
  let migrationPlan, activation;
  function renderActivation() {
    const config=loaded?.ativacaoOperacionalV2;
    const valid=config?.schema===1 && config.ambiente==='homologacao' && ['habilitada','suspensa'].includes(config.estado) && Number.isSafeInteger(config.revisao) && config.revisao>0;
    el('admin-activation-state').textContent=!loaded?.ativacaoDefinida?'Sem adesão: compatibilidade anterior ativa. A primeira alteração inicia o controle.':valid?(config.estado==='habilitada'?'Habilitada para testes':'Suspensa')+' • revisão '+config.revisao:'Configuração incompatível: exige revisão administrativa.';
    el('admin-activation-state').dataset.revisao=valid?config.revisao:0;
    let pending=null,error='';try{pending=activation?.pendente();}catch(e){error=e.message;}
    el('admin-activation-form').hidden=!!pending||!!error||(loaded?.ativacaoDefinida&&!valid);
    el('admin-activation-resume').hidden=!pending;
    el('admin-activation-pending').textContent=error||(pending?'Alteração pendente para '+pending.estado+'. Retome a mesma tentativa antes de fazer outra.':'');
  }
  const message = text => { el('admin-message').textContent = text; };
  const options = (select, rows, first = null) => { select.replaceChildren(); if (first !== null) select.add(new Option(first, '')); for (const row of rows) select.add(new Option(row.label, row.id)); };
  const amount = (text, scale) => { const raw = String(text).trim().replace(',', '.'); if (!new RegExp(`^-?\\d+(\\.\\d{1,${scale}})?$`).test(raw)) throw new Error(`Informe um valor com até ${scale} casas decimais.`); return Math.round(Number(raw) * 10 ** scale); };
  const base = () => {
    if (!loaded || loaded.lojaId !== value('admin-shop') || loaded.slug !== value('admin-slug')) throw new Error('Carregue a loja escolhida antes de salvar.');
    return { lojaId: loaded.lojaId, slug: loaded.slug, versao: loaded.versao };
  };
  async function run(action) {
    if (busy) return; busy = true; modal.dataset.busy = 'true'; modal.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await action(); } catch (error) { message(error.message || 'Não foi possível salvar. Recarregue a configuração.'); }
    finally { busy = false; modal.dataset.busy = 'false'; modal.querySelectorAll('button').forEach(b => b.disabled = false); if(loaded)renderActivation(); }
  }
  async function load() {
    await s.auth.authStateReady(); if (!s.auth.currentUser) throw new Error('Entre como gerente em Configurar acesso de teste.');
    const lojaId = value('admin-shop'), slug = value('admin-slug');
    loaded=null;activation=null;el('admin-content').hidden=true;el('admin-waiter-link').value='';
    const authUid = s.auth.currentUser.uid, result = await s.call('consultarConfiguracaoV2', { lojaId, slug });
    if (s.auth.currentUser?.uid !== authUid) throw new Error('A sessão gerencial mudou. Entre e carregue a loja novamente.');
    if(lojaId!==value('admin-shop')||slug!==value('admin-slug'))throw new Error('A loja mudou. Carregue novamente.');
    activation=criarAlteracaoAtivacaoTeste({storage:localStorage,uid:authUid,lojaId,call:(n,d)=>{if(s.auth.currentUser?.uid!==authUid)throw new Error('A sessão mudou. Entre novamente.');return s.call(n,d);},uuid:()=>crypto.randomUUID(),ambienteTeste:window.electronAPI.ambienteTeste});
    loaded = { ...result, lojaId }; el('admin-content').hidden = false;
    options(el('admin-migration-product'),StorageService.getProdutos().map(p=>({id:String(p.id),label:p.nome})), 'Selecione um produto');
    migrationPlan=null;el('admin-migration-confirm').checked=false;
    el('admin-migration-plan').textContent='Selecione um produto e confira a conversão.';delete el('admin-migration-plan').dataset.estoqueId;
    el('admin-segment').value = loaded.segmento;
    for (const [id, state] of Object.entries({ 'admin-menu': loaded.modulos.cardapio, 'admin-tables': loaded.modulos.mesas, 'admin-pickup': loaded.modulos.retirada, 'admin-print': loaded.cozinha.impressao, 'admin-kds': loaded.cozinha.kds })) el(id).checked = state === true;
    options(el('admin-terminal'), loaded.terminais.map(t => ({ id: t.uid, label: `${t.papel} • ${t.uid}` })), 'Selecione um terminal autorizado');
    el('admin-terminal').value = loaded.cozinha.terminalUid || ''; el('admin-printer').value = loaded.cozinha.impressora || ''; el('admin-paper').value = loaded.cozinha.papelMm || 80;
    renderTables();
    options(el('admin-product-select'), loaded.catalogo.produtos.map(p => ({ id: p.id, label: p.nome })), 'Novo produto');
    modal.querySelectorAll('.adm-products').forEach(select => options(select, loaded.catalogo.produtos.map(p => ({ id: p.id, label: p.nome }))));
    options(el('admin-stock-select'), loaded.estoque.map(i => ({ id: i.id, label: `${i.nome || i.id} • ${i.saldoMili / 1000} ${i.unidade || 'unidade pendente'}` })), 'Novo insumo');
    fillDelivery();renderActivation();el('admin-activation-confirm').checked=false;
    el('admin-waiter').checked=loaded.modulos.garcom===true;
    el('admin-waiter-list').textContent=(loaded.garcons||[]).map(g=>`${g.uid}: ${g.ativo?'autorizado':'revogado'}`).join(' • ')||'Nenhum garçom cadastrado.';
    el('admin-published').checked=loaded.catalogo.publicado===true;el('admin-publication-state').textContent=loaded.catalogo.publicado?'Publicado':'Fora de publicação';
    fillTable(); fillProduct(); fillStock(); fillOptions(); fillRecipeOptions(); message(`${loaded.nome} carregada • revisão ${loaded.versao} • Cardápio ${loaded.catalogo.publicado && !loaded.catalogo.pausado ? 'recebendo no teste' : 'pausado/sem produtos ativos'}.`);
  }
  function bind(form, fn) { el(form).onsubmit = event => { event.preventDefault(); run(fn); }; }
  async function save(name, payload) { await s.call(name, { ...base(), ...payload }); await load(); message('Configuração salva. Os canais e terminais usam as novas definições.'); }
  bind('admin-load', load);
  async function applyActivation(resume=false) {
    base();const original=activation;
    try {
      await original.executar(resume?undefined:{estado:value('admin-activation-choice'),motivo:value('admin-activation-reason'),confirmado:checked('admin-activation-confirm'),revisaoEsperada:Number(el('admin-activation-state').dataset.revisao)});
    } catch(error) {
      if(error.code==='functions/failed-precondition'||error.code==='functions/invalid-argument') {
        await load();message(error.message+' Estado atualizado; confira e confirme novamente.');return;
      }
      throw error;
    }
    if(activation!==original)throw new Error('Sessão ou loja mudou. Carregue o estado atual.');
    await load();el('admin-activation-reason').value='';message('Alteração confirmada. Estado atual consultado no servidor. Produção permanece desabilitada.');
  }
  bind('admin-activation-form',()=>applyActivation());
  el('admin-activation-resume').onclick=()=>run(()=>applyActivation(true));
  el('admin-activation-refresh').onclick=()=>run(load);
  bind('admin-modules', () => save('salvarModulosV2', { segmento: value('admin-segment'), modulos: { cardapio: checked('admin-menu'), mesas: checked('admin-tables'), retirada: checked('admin-pickup'), garcom: checked('admin-waiter') }, cozinha: { impressao: checked('admin-print'), kds: checked('admin-kds'), papelMm: Number(value('admin-paper')), impressora: value('admin-printer'), terminalUid: value('admin-terminal') } }));
  bind('admin-waiter-form',()=>save('salvarGarcomV2',{uid:value('admin-waiter-uid'),ativo:checked('admin-waiter-active')}));
  bind('admin-waiter-invite',async()=>{
    const contexto=base();el('admin-waiter-link').value='';
    const result=await s.call('emitirConviteGarcomV2',{...contexto,email:value('admin-waiter-email')});
    await load();
    if(loaded.lojaId!==contexto.lojaId||loaded.slug!==contexto.slug)throw new Error('A loja mudou. Gere o convite novamente.');
    el('admin-waiter-link').value=`http://127.0.0.1:5173/v2/${encodeURIComponent(result.slug)}/garcom#convite=${encodeURIComponent(result.token)}`;
    message('Convite local gerado, válido por 24 horas e somente para esse e-mail. Um novo convite invalida o anterior. Nenhum e-mail foi enviado.');
  });
  el('admin-waiter-revoke-invite').onclick=()=>run(async()=>{
    await s.call('revogarConviteGarcomV2',{...base(),email:value('admin-waiter-email')});
    el('admin-waiter-link').value='';message('Convite revogado. Para remover um funcionário já autorizado, revogue o acesso dele acima.');
  });
  function deliveryRow(container, fields) {
    const row=document.createElement('fieldset'); row.className='adm-grid';
    for(const [key,label,val,attrs] of fields) {
      const wrap=document.createElement('label'), control=document.createElement('input');wrap.textContent=label;
      control.dataset.field=key;control.value=val;control.required=true;
      for(const [attr,v] of Object.entries(attrs||{})) control.setAttribute(attr,v);
      wrap.append(control);row.append(wrap);
    }
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.onclick=()=>{if(!busy)row.remove();};row.append(remove);el(container).append(row);
  }
  function addRegion(r={}) {
    if(el('admin-delivery-regions').children.length>=50)throw new Error('Limite de 50 regiões.');
    deliveryRow('admin-delivery-regions',[
      ['id','Código',r.id||crypto.randomUUID(),{maxlength:80,pattern:'[A-Za-z0-9_-]+'}],['nome','Nome da região',r.nome||'',{maxlength:80}],
      ['cepInicial','CEP inicial',r.cepInicial||'',{pattern:'[0-9]{5}-?[0-9]{3}',inputmode:'numeric'}],['cepFinal','CEP final',r.cepFinal||'',{pattern:'[0-9]{5}-?[0-9]{3}',inputmode:'numeric'}],
      ['taxa','Taxa (R$)',((r.taxaCentavos||0)/100).toFixed(2),{inputmode:'decimal'}],['prazo','Prazo (minutos)',r.prazoMinutos||30,{type:'number',min:1,max:1440}]
    ]);
  }
  const clockText=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  function addPeriod(p={dia:1,inicio:1080,fim:1380}) {
    if(el('admin-delivery-periods').children.length>=28)throw new Error('Limite de 28 períodos.');
    deliveryRow('admin-delivery-periods',[
      ['dia','Dia (0 domingo; 1 segunda; …; 6 sábado)',p.dia,{type:'number',min:0,max:6}],
      ['inicio','Abre às',clockText(p.inicio),{pattern:'([01][0-9]|2[0-3]):[0-5][0-9]'}],['fim','Fecha às',clockText(p.fim),{pattern:'(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)'}]
    ]);
  }
  function fillDelivery() {
    const d=loaded.delivery;el('admin-delivery-active').checked=d.ativo===true;el('admin-delivery-minimum').value=(d.pedidoMinimoCentavos/100).toFixed(2);
    el('admin-delivery-regions').replaceChildren();d.regioes.forEach(addRegion);
    el('admin-delivery-scheduled').checked=!!d.horarios;el('admin-delivery-timezone').value=d.horarios?.fuso||'America/Sao_Paulo';
    el('admin-delivery-periods').replaceChildren();(d.horarios?.periodos||[]).forEach(addPeriod);
  }
  el('admin-delivery-add-region').onclick=()=>{if(!busy)try{addRegion();}catch(e){message(e.message);}};
  el('admin-delivery-add-period').onclick=()=>{if(!busy)try{addPeriod();}catch(e){message(e.message);}};
  bind('admin-delivery',()=>{
    const rows=container=>[...el(container).children].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(i=>[i.dataset.field,i.value.trim()])));
    const minutes=v=>{if(!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(v))throw new Error('Confira os horários.');const [h,m]=v.split(':').map(Number);return h*60+m;};
    return save('salvarConfiguracaoDeliveryV2',{delivery:{ativo:checked('admin-delivery-active'),pedidoMinimoCentavos:amount(value('admin-delivery-minimum'),2),
      regioes:rows('admin-delivery-regions').map(r=>({id:r.id,nome:r.nome,cepInicial:r.cepInicial,cepFinal:r.cepFinal,taxaCentavos:amount(r.taxa,2),prazoMinutos:Number(r.prazo)})),
      ...(checked('admin-delivery-scheduled')?{horarios:{fuso:value('admin-delivery-timezone'),periodos:rows('admin-delivery-periods').map(p=>({dia:Number(p.dia),inicio:minutes(p.inicio),fim:minutes(p.fim)}))}}:{})
    }});
  });
  function renderTables() {
    const selected=value('admin-table-select');
    options(el('admin-table-select'),loaded.mesas.map(t=>({id:t.id,label:t.nome+' • '+t.comandaPdvId})),'Nova mesa');
    if(loaded.mesas.some(t=>t.id===selected))el('admin-table-select').value=selected;
    el('admin-tables-more').hidden=!loaded.proximaMesa;
    el('admin-tables-count').textContent=loaded.mesas.length+' mesas carregadas'+(loaded.proximaMesa?'; há mais mesas para consultar.':'.');
  }
  el('admin-tables-more').onclick=()=>run(async()=>{
    const request=base(), original=loaded, auth=s.auth.currentUser;
    if(!original.proximaMesa)return;
    const result=await s.call('listarMesasConfiguracaoV2',{...request,apos:original.proximaMesa});
    if(loaded!==original||s.auth.currentUser!==auth||value('admin-shop')!==request.lojaId||value('admin-slug')!==request.slug)throw new Error('O acesso ou a loja mudou. Carregue novamente.');
    if(result.versao!==original.versao)throw new Error('A configuração mudou. Carregue novamente.');
    loaded.mesas=[...new Map([...loaded.mesas,...result.mesas].map(t=>[t.id,t])).values()];
    loaded.proximaMesa=result.proximaMesa;renderTables();message('Mesas carregadas. Selecione a mesa para editar.');
  });
  function fillTable() { const t = loaded.mesas.find(t => t.id === value('admin-table-select')); el('admin-table-id').value = t?.id || ''; el('admin-table-id').readOnly = !!t; el('admin-table-name').value = t?.nome || ''; el('admin-table-number').value = t?.comandaPdvId?.replace('MESA-', '') || ''; el('admin-table-active').checked = t ? t.ativo : true; el('admin-qr').replaceChildren(); el('admin-qr-url').textContent = ''; }
  el('admin-table-select').onchange = fillTable;
  bind('admin-table', () => save('salvarMesaV2', { mesaId: value('admin-table-id'), nome: value('admin-table-name'), numero: Number(value('admin-table-number')), ativo: checked('admin-table-active') }));
  el('admin-show-qr').onclick = () => run(async () => {
    const table = loaded.mesas.find(t => t.id === value('admin-table-id')); if (!table?.ativo) throw new Error('Salve uma mesa ativa antes de gerar o QR.');
    const url = `http://127.0.0.1:5173/v2/${encodeURIComponent(loaded.slug)}/mesa/${encodeURIComponent(table.id)}`;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); el('admin-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4 }); el('admin-qr-url').textContent = url;
  });
  function fillProduct() { const p = loaded.catalogo.produtos.find(p => p.id === value('admin-product-select')); el('admin-product-id').value = p?.id || ''; el('admin-product-id').readOnly = !!p; el('admin-product-name').value = p?.nome || ''; el('admin-product-price').value = p ? (p.precoCentavos / 100).toFixed(2).replace('.', ',') : ''; el('admin-product-active').checked = p ? p.ativo : true; el('admin-product-soldout').checked = p?.esgotado === true;el('admin-product-category').value=p?.categoria||'';el('admin-product-description').value=p?.descricao||'';el('admin-product-image').value=p?.imagemUrl||'';el('admin-product-order').value=p?.ordem||0; }
  el('admin-product-select').onchange = fillProduct;
  bind('admin-publication',()=>save('publicarCatalogoV2',{publicado:checked('admin-published')}));
  bind('admin-product', () => save('salvarProdutoCardapioV2', { produtoId: value('admin-product-id'), nome: value('admin-product-name'), categoria:value('admin-product-category'), descricao:value('admin-product-description'), imagemUrl:value('admin-product-image'), ordem:Number(value('admin-product-order')), precoCentavos: amount(value('admin-product-price'), 2), ativo: checked('admin-product-active'), esgotado: checked('admin-product-soldout') }));
  function fillOptions() { const p = loaded.catalogo.produtos.find(p => p.id === value('admin-option-product')); options(el('admin-option-select'), (p?.grupos || []).flatMap(g => g.opcoes.map(o => ({ id: `${g.id}/${o.id}`, label: `${g.nome} • ${o.nome}` }))), 'Nova opção'); fillOption(); }
  function fillOption() {
    const [gId, oId] = value('admin-option-select').split('/'), p = loaded.catalogo.produtos.find(p => p.id === value('admin-option-product')), g = p?.grupos.find(g => g.id === gId), o = g?.opcoes.find(o => o.id === oId);
    for (const [key, val] of Object.entries({ 'admin-group-id': g?.id || '', 'admin-group-name': g?.nome || '', 'admin-group-min': g?.min || 0, 'admin-group-max': g?.max || 1, 'admin-option-id': o?.id || '', 'admin-option-name': o?.nome || '', 'admin-option-price': ((o?.precoCentavos || 0) / 100).toFixed(2), 'admin-option-max': o?.maxQuantidade || 1 })) el(key).value = val;
    el('admin-option-active').checked = o ? o.ativo : true;
  }
  el('admin-option-product').onchange = fillOptions; el('admin-option-select').onchange = fillOption;
  bind('admin-option', () => save('salvarOpcaoCardapioV2', { produtoId: value('admin-option-product'), grupoId: value('admin-group-id'), nomeGrupo: value('admin-group-name'), min: Number(value('admin-group-min')), max: Number(value('admin-group-max')), opcaoId: value('admin-option-id'), nome: value('admin-option-name'), precoCentavos: amount(value('admin-option-price'), 2), maxQuantidade: Number(value('admin-option-max')), ativo: checked('admin-option-active') }));
  function fillStock() { stockRequest = null; const item = loaded.estoque.find(i => i.id === value('admin-stock-select')); el('admin-stock-id').value = item?.id || ''; el('admin-stock-id').readOnly = !!item; el('admin-stock-name').value = item?.nome || ''; el('admin-unit').value = item?.unidade || 'un'; el('admin-unit').disabled = !!item; el('admin-stock-delta').value = ''; el('admin-stock-reason').value = ''; el('admin-stock-balance').textContent = item ? `Saldo atual: ${item.saldoMili / 1000} ${item.unidade || '(unidade ainda não cadastrada)'}. O ajuste soma ou retira essa quantidade.` : 'O novo insumo começa com saldo zero.'; }
  el('admin-stock-select').onchange = fillStock;
  bind('admin-stock', async () => { stockRequest ||= crypto.randomUUID(); await save('ajustarEstoqueV2', { estoqueId: value('admin-stock-id'), nome: value('admin-stock-name'), unidade: value('admin-unit'), deltaMili: amount(value('admin-stock-delta'), 3), motivo: value('admin-stock-reason'), requestId: stockRequest }); stockRequest = null; });
  function fillRecipeOptions() { const p = loaded.catalogo.produtos.find(p => p.id === value('admin-recipe-product')); options(el('admin-recipe-option'), (p?.grupos || []).flatMap(g => g.opcoes.map(o => ({ id: `${g.id}/${o.id}`, label: `${g.nome} • ${o.nome}` }))), 'Produto base'); fillRecipe(); }
  function consumption(item = {}) {
    const row = document.createElement('div'); row.className = 'adm-grid'; row.dataset.consumption = 'true';
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Insumo'); options(select, loaded.estoque.map(i => ({ id: i.id, label: `${i.nome || i.id} (${i.unidade || 'unidade pendente'})` }))); if (item.estoqueId) select.value = item.estoqueId;
    const right = document.createElement('div'), quantity = document.createElement('input'), remove = document.createElement('button'); quantity.setAttribute('aria-label', 'Consumo por unidade'); quantity.inputMode = 'decimal'; quantity.value = item.quantidadeMili ? String(item.quantidadeMili / 1000) : ''; quantity.required = true; remove.type = 'button'; remove.textContent = 'Remover insumo'; remove.onclick = () => row.remove(); right.append(quantity, remove); row.append(select, right); el('admin-consumptions').append(row);
  }
  function fillRecipe() { const recipe = loaded.fichas.find(r => r.id === value('admin-recipe-product')), [grupoId, opcaoId] = value('admin-recipe-option').split('/'); el('admin-no-stock').checked = recipe?.semEstoque === true; el('admin-no-stock').disabled = !!grupoId; el('admin-consumptions').replaceChildren(); const entries = grupoId ? recipe?.opcoes?.find(o => o.grupoId === grupoId && o.opcaoId === opcaoId)?.consumos : recipe?.consumos; (entries || []).forEach(consumption); }
  el('admin-recipe-product').onchange = fillRecipeOptions; el('admin-recipe-option').onchange = fillRecipe; el('admin-add-consumption').onclick = () => consumption();
  bind('admin-recipe', () => { const [grupoId, opcaoId] = value('admin-recipe-option').split('/'); return save('salvarFichaEstoqueV2', { produtoId: value('admin-recipe-product'), semEstoque: checked('admin-no-stock'), ...(grupoId ? { grupoId, opcaoId } : {}), consumos: [...el('admin-consumptions').children].map(row => ({ estoqueId: row.querySelector('select').value, quantidadeMili: amount(row.querySelector('input').value, 3) })) }); });
  el('admin-migration-product').onchange=()=>{migrationPlan=null;el('admin-migration-plan').textContent='Confira a conversão antes de migrar.';el('admin-migration-confirm').checked=false;};
  el('admin-migration-preview').onclick=()=>run(async()=>{
    const contexto=base(),produto=StorageService.getProdutos().find(p=>String(p.id)===value('admin-migration-product'));
    const plano=planejarSaldoLegado(produto);migrationPlan={contexto,produto:JSON.parse(JSON.stringify(produto))};
    el('admin-migration-confirm').checked=false;
    el('admin-migration-plan').textContent=`${plano.nome}: ${plano.saldoOrigem} ${plano.unidadeOrigem} → ${plano.saldoMili/1000} ${plano.unidade}. Nenhuma quantidade será acrescentada a um insumo existente.`;
  });
  bind('admin-migration-form',async()=>{
    if(!migrationPlan||!checked('admin-migration-confirm')) throw new Error('Confira a conversão e confirme a migração.');
    const contexto=base(),produto=StorageService.getProdutos().find(p=>String(p.id)===String(migrationPlan.produto.id));
    if(contexto.lojaId!==migrationPlan.contexto.lojaId||JSON.stringify(produto)!==JSON.stringify(migrationPlan.produto)) throw new Error('Produto ou loja mudou. Confira novamente.');
    StorageService.exigirVendaRecuperada();
    const result=await navigator.locks.request('flowpdv-migracao-estoque-teste',()=>migrarEstoqueTeste({storage:localStorage,ambienteTeste:window.electronAPI.ambienteTeste,contexto,produto,call:(n,d)=>s.call(n,d)}));
    await load();el('admin-migration-plan').dataset.estoqueId=result.estoqueId;
    el('admin-migration-plan').textContent=`Migração confirmada: ${result.plano.nome} • saldo inicial ${result.plano.saldoMili/1000} ${result.plano.unidade}. Estoque: ${result.estoqueId}. Vincule esse insumo na ficha de consumo; o saldo local antigo está bloqueado.`;
    message('Migração confirmada sem somar novamente o saldo inicial.');
  });
  onAuthStateChanged(s.auth, () => { loaded = null; activation=null; migrationPlan=null; el('admin-content').hidden = true; message('Carregue a loja após entrar como gerente.'); });
}
