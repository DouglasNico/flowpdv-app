const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/js/bloqueio-recuperacao-perfil.js'),'utf8').replace(/export /g,''),ctx);
test('marcador mesmo corrompido só admite consultas explícitas; não admite nova mutação disfarçada', () => {
  for (const key of ['flowpdv_fechamento_recuperado_pendente','flowpdv_instalacao_perfil_pendente','flowpdv_recuperacao_operacao_bloqueada']) {
    const storage = { getItem: k => k === key ? '{invalido' : null };
    assert.equal(ctx.perfilEmRecuperacao(storage),true);
    for (const nome of ['registrarBaixaVendaLocalV2','fecharAtendimentoV2','consultarEAlterarV2','estornarVendaV2']) assert.throws(()=>ctx.exigirConsultaDuranteRecuperacao(storage,nome),/recuperação/);
    assert.doesNotThrow(()=>ctx.exigirConsultaDuranteRecuperacao(storage,'listarTurnosRecuperacaoV2'));
    assert.doesNotThrow(()=>ctx.exigirConsultaDuranteRecuperacao(storage,'listarPendenciasAtendimentoV2'));
    assert.doesNotThrow(()=>ctx.exigirConsultaDuranteRecuperacao(storage,'conferirPendenciasRecuperacaoV2'));
    assert.doesNotThrow(()=>ctx.exigirConsultaDuranteRecuperacao(storage,'consultarPagamentoAtendimentoV2'));
  }
  assert.doesNotThrow(()=>ctx.exigirConsultaDuranteRecuperacao({getItem:()=>null},'registrarBaixaVendaLocalV2'));
});
