const fs = require('node:fs');
const path = require('node:path');
const { prepararPilotoAvulsos } = require('../functions/piloto-avulsos-core.cjs');
const folder = path.resolve(__dirname, '../../output/migracao-v2-20260923');
const snapshot = JSON.parse(fs.readFileSync(path.join(folder, 'burger-origem-atual.json')));
// Decisão expressa do proprietário em 23/09. Novo pedido ativo exige nova conferência.
const plan = prepararPilotoAvulsos(snapshot, {
  pedidosSomenteHistorico: ['PED-57851ae1-06b1-49a0-850f-79d8ecd61cb0']
});
fs.writeFileSync(path.join(folder, 'burger-piloto-avulsos.json'), JSON.stringify(plan, null, 2));
console.log(JSON.stringify({ ...plan.resumo, hash: plan.hash, corteOperacional: false }));
