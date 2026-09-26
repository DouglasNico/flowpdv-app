const { chromium } = require('playwright');

const PEDIDO = process.env.FLOWPDV_PEDIDO_ID || '98ddaddd-2bca-401a-96c2-0901630e6327';
const TOTAL = '32,90';
const ATENDIMENTO = `retirada-${PEDIDO}`;
const PIN = process.env.FLOWPDV_PIN || '';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9228');
  const page = browser.contexts().flatMap((c) => c.pages())[0];
  if (!page) throw new Error('PDV CDP sem página aberta.');

  const sessao = await page.evaluate(() => ({
    loginAtiva: document.body.classList.contains('tela-login-ativa'),
    temUsuario: !!(window.AuthModule && AuthModule.getUsuario && AuthModule.getUsuario()),
    usuario: window.AuthModule?.getUsuario?.()?.nome || null,
    turno: window.FlowCaixaOficial?.estadoLocal?.()?.turno?.id || window.StorageService?.getTurnoAtual?.()?.id || null,
  }));
  if (!sessao.temUsuario) {
    if (!PIN) throw new Error('Sessão caiu e FLOWPDV_PIN ausente.');
    await page.evaluate((pin) => {
      const admin = StorageService.getUsuarios().find((u) => ['gerente', 'admin', 'superadmin'].includes(u.cargo));
      if (!admin) throw new Error('Operador gerente/admin ausente.');
      AuthModule.selecionarUsuarioLogin(admin.id, true);
      const el = document.getElementById('login-pin-input');
      el.disabled = false;
      el.value = pin;
      AuthModule.executarLogin();
    }, PIN);
    await page.waitForFunction(() => !document.body.classList.contains('tela-login-ativa') && AuthModule.getUsuario());
  }

  await page.evaluate(() => {
    const botao = document.getElementById('receive-open');
    if (!botao) throw new Error('Painel de pedidos ausente (#receive-open).');
    botao.hidden = false;
    botao.click();
  });
  await page.waitForFunction(() => {
    const texto = document.getElementById('receive-state')?.textContent || '';
    return texto && !/^Consultando/.test(texto);
  }, null, { timeout: 30000 });
  await page.waitForTimeout(4000);

  const painel = await page.evaluate((pedidoId) => {
    const lista = document.getElementById('receive-list');
    const contas = [...(lista?.querySelectorAll('[data-atendimento-id]') || [])].map((el) => ({
      id: el.dataset.atendimentoId,
      texto: el.innerText.trim().slice(0, 240),
    }));
    return {
      estado: document.getElementById('receive-state')?.textContent?.trim() || '',
      contas,
      temPedido: (lista?.innerText || '').includes(pedidoId) || contas.some((c) => c.id.includes(pedidoId)),
      lista: (lista?.innerText || '').trim().slice(0, 2500),
    };
  }, PEDIDO);
  if (!painel.temPedido && !painel.contas.some((c) => c.id === ATENDIMENTO)) {
    console.log(JSON.stringify({ ok: false, etapa: 'receber', painel, sessao }, null, 2));
    process.exit(2);
  }

  const seletor = `#receive-list [data-atendimento-id="${ATENDIMENTO}"] button[data-action=checkout], #receive-list button[data-action=checkout]`;
  const fechar = page.locator(seletor);
  if (!(await fechar.count())) throw new Error('Botão Fechar conta ausente para o combo.');
  await fechar.first().click();

  await page.waitForFunction((total) => {
    const form = document.getElementById('checkout-form');
    const resumo = document.getElementById('checkout-summary')?.textContent || '';
    const re = new RegExp(total.replace(',', '[,\\.]'));
    return form && !form.hidden && re.test(resumo);
  }, TOTAL, { timeout: 20000 });

  await page.selectOption('#checkout-method', 'dinheiro');
  await page.fill('#checkout-cash', TOTAL);
  await page.check('#checkout-confirm');
  await page.locator('#checkout-form button[type=submit]').click();
  await page.waitForFunction(() => {
    const msg = document.getElementById('checkout-message')?.textContent || '';
    return /conclu|pago|fechad|venda/i.test(msg) || !(document.getElementById('checkout-form') && !document.getElementById('checkout-form').hidden);
  }, null, { timeout: 30000 });
  const pagamento = await page.evaluate(() => ({
    mensagem: document.getElementById('checkout-message')?.textContent?.trim() || '',
    resumo: document.getElementById('checkout-summary')?.textContent?.trim() || '',
  }));

  await page.evaluate(() => {
    const b = document.getElementById('checkout-open');
    if (b) { b.hidden = false; b.click(); }
  });
  await page.waitForTimeout(1500);
  let estornoBtn = page.locator('#checkout-sales button', { hasText: 'Estornar venda' });
  if (!(await estornoBtn.count())) {
    await page.click('#checkout-reconnect').catch(() => {});
    await page.waitForTimeout(3000);
    estornoBtn = page.locator('#checkout-sales button', { hasText: 'Estornar venda' });
  }
  if (!(await estornoBtn.count())) throw new Error('Botão de estorno não apareceu após pagamento do combo.');
  await estornoBtn.first().click();
  await page.waitForSelector('#checkout-adjust:not([hidden])');
  await page.fill('#checkout-reason', 'Smoke combos BURGER — estorno');
  await page.check('#checkout-return');
  await page.check('#checkout-refund-confirm');
  await page.locator('#checkout-adjust button[type=submit]').click();
  await page.waitForTimeout(4000);
  const estorno = await page.evaluate(() => ({
    mensagem: document.getElementById('checkout-message')?.textContent?.trim() || '',
  }));

  console.log(JSON.stringify({
    ok: true,
    pedidoId: PEDIDO,
    atendimentoId: ATENDIMENTO,
    sessao,
    painel: { estado: painel.estado, contas: painel.contas },
    pagamento,
    estorno,
  }, null, 2));
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, erro: e.message || String(e) }, null, 2));
  process.exit(1);
});
