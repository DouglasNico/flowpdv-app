const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/js/autorizacao-homologacao.js'), 'utf8').replace('export function', 'function'), ctx);
const create = ctx.criarAutorizacaoHomologacao;
const permitido = { lojaId: 'A', papel: 'caixa', modulos: { balcao: true } };
function fixture() {
  const eventos = [], consultas = [], estados = [];
  const deps = { ambienteTeste: true, alterar: (ok, aviso) => estados.push({ ok, aviso }),
    call: () => new Promise((resolve, reject) => consultas.push({ resolve, reject })),
    observarLoja: (id, snapshot, erro) => { const evento = { id, snapshot, erro, encerrado: false }; eventos.push(evento); return () => evento.encerrado = true; } };
  return { deps, eventos, consultas, estados, ultimo: () => estados.at(-1).ok, servico: create(deps) };
}
test('cache não autoriza e invalida consulta anterior; resposta nova confirma', async () => {
  const f = fixture(); f.servico.iniciar('A');
  const primeira = f.eventos[0].snapshot({ fromCache: false });
  await f.eventos[0].snapshot({ fromCache: true });
  f.consultas[0].resolve(permitido); await primeira; assert.equal(f.ultimo(), false);
  const segunda = f.eventos[0].snapshot({ fromCache: false });
  f.consultas[1].resolve(permitido); await segunda; assert.equal(f.ultimo(), true);
});
test('desconexão encerra observação e impede resposta ou evento antigo de liberar', async () => {
  const f = fixture(); f.servico.iniciar('A');
  const p = f.eventos[0].snapshot({ fromCache: false });
  f.servico.desconectar(); assert.equal(f.eventos[0].encerrado, true);
  f.consultas[0].resolve(permitido); await p;
  await f.eventos[0].snapshot({ fromCache: false });
  assert.equal(f.consultas.length, 1); assert.equal(f.ultimo(), false);
});
test('troca de loja descarta respostas e erros da sessão anterior', async () => {
  const f = fixture(); f.servico.iniciar('A');
  const p = f.eventos[0].snapshot({ fromCache: false });
  f.servico.iniciar('B'); assert.equal(f.eventos[0].encerrado, true);
  const atual = f.eventos[1].snapshot({ fromCache: false });
  f.consultas[1].resolve({ ...permitido, lojaId: 'B' }); await atual;
  f.consultas[0].resolve(permitido); await p; f.eventos[0].erro();
  assert.equal(f.ultimo(), true);
});
test('respostas fora de ordem não restauram autorização suspensa', async () => {
  const f = fixture(); f.servico.iniciar('A');
  const a = f.eventos[0].snapshot({ fromCache: false }), b = f.eventos[0].snapshot({ fromCache: false });
  f.consultas[1].resolve({ ...permitido, modulos: {} }); await b;
  f.consultas[0].resolve(permitido); await a; assert.equal(f.ultimo(), false);
});
test('outra loja, cozinha e capacidade ausente são recusadas; legado explícito aceito', async () => {
  const f = fixture(); f.servico.iniciar('A');
  for (const [resposta, esperado] of [
    [{ ...permitido, lojaId: 'B' }, false], [{ ...permitido, papel: 'cozinha' }, false],
    [{ ...permitido, modulos: {} }, false], [{ ...permitido, modulos: {}, compatibilidadeLegada: true }, true]
  ]) {
    const p = f.eventos[0].snapshot({ fromCache: false });
    f.consultas.at(-1).resolve(resposta); await p; assert.equal(f.ultimo(), esperado);
  }
});
test('falha de consulta ou listener bloqueia; perfil normal não cria serviço', async () => {
  const f = fixture(); assert.throws(() => create({ ...f.deps, ambienteTeste: false }));
  f.servico.iniciar('A'); const p = f.eventos[0].snapshot({ fromCache: false });
  f.consultas[0].reject(new Error('rede')); await p; assert.equal(f.ultimo(), false);
  const q = f.eventos[0].snapshot({ fromCache: false }); f.eventos[0].erro();
  f.consultas[1].resolve(permitido); await q; assert.equal(f.ultimo(), false);
});

test('perfil operacional não aceita compatibilidade legada como adesão', async () => {
  const f = fixture(), s = create({ ...f.deps, exigirAdesaoExplicita: true });
  s.iniciar('A');
  for (const [resposta, esperado] of [
    [{ ...permitido, compatibilidadeLegada: true }, false],
    [{ ...permitido, homologacaoHabilitada: true }, true],
    [{ ...permitido, homologacaoHabilitada: false }, false]
  ]) {
    const p = f.eventos[0].snapshot({ fromCache: false });
    f.consultas.at(-1).resolve(resposta); await p; assert.equal(f.ultimo(), esperado);
  }
});

test('recuperação local bloqueia antes da consulta e invalida autorização em curso', async () => {
  const f = fixture(); let bloqueado = true;
  const s = create({ ...f.deps, bloqueioLocal: () => bloqueado }); s.iniciar('A');
  await f.eventos[0].snapshot({ fromCache: false }); assert.equal(f.consultas.length, 0); assert.equal(f.ultimo(), false);
  bloqueado = false; const p = f.eventos[0].snapshot({ fromCache: false });
  bloqueado = true; f.consultas[0].resolve(permitido); await p; assert.equal(f.ultimo(), false);
});
