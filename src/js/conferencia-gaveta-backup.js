// Confere somente a aritmética registrada no arquivo, nunca a existência do dinheiro.
export function conferirGavetaBackup(turno) {
  const divergencias = [], pendencias = [];
  const apontar = (lista, codigo) => lista.push({ turnoId: turno.id, codigo });
  const centavos = valor => {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
    const n = Math.round(valor * 100);
    return Number.isSafeInteger(n) && Math.abs(valor * 100 - n) < 0.000001 ? n : null;
  };
  const resultado = () => ({ escopo: 'aritmetica_do_backup', liberacaoOperacional: false, divergencias, pendencias });
  if (turno.status !== 'fechado' && !turno.dataFechamento) {
    apontar(pendencias, 'gaveta_turno_aberto'); return resultado();
  }
  const campos = ['trocoInicial', 'totalDinheiro', 'totalSangrias', 'saldoEsperado', 'saldoInformado', 'diferenca'];
  if (campos.some(k => turno[k] === undefined) || turno.sangrias === undefined) {
    apontar(pendencias, 'gaveta_dados_incompletos'); return resultado();
  }
  const valores = Object.fromEntries(campos.map(k => [k, centavos(turno[k])]));
  const fundo = turno.restauranteV2?.trocoInicialCentavos ?? turno.fundoRestauranteCentavos ?? 0;
  if (Object.values(valores).some(v => v === null) || valores.trocoInicial < 0 || valores.totalSangrias < 0 || valores.saldoInformado < 0
    || !Number.isSafeInteger(fundo) || fundo < 0 || !Array.isArray(turno.sangrias)) {
    apontar(divergencias, 'gaveta_valores_invalidos'); return resultado();
  }
  let sangrias = 0;
  for (const retirada of turno.sangrias) {
    const valor = centavos(retirada?.valor);
    if (valor === null || valor <= 0 || !Number.isSafeInteger(sangrias + valor)) {
      apontar(divergencias, 'gaveta_sangria_invalida'); return resultado();
    }
    sangrias += valor;
  }
  if (sangrias !== valores.totalSangrias) apontar(divergencias, 'gaveta_sangrias_divergentes');
  if (turno.suprimentos !== undefined && (!Array.isArray(turno.suprimentos) || turno.suprimentos.length)) {
    apontar(pendencias, 'gaveta_suprimentos_nao_conferidos'); return resultado();
  }
  const esperado = valores.trocoInicial + fundo + valores.totalDinheiro - sangrias;
  const diferenca = valores.saldoInformado - valores.saldoEsperado;
  if (!Number.isSafeInteger(esperado) || !Number.isSafeInteger(diferenca)) {
    apontar(divergencias, 'gaveta_valores_invalidos'); return resultado();
  }
  if (esperado !== valores.saldoEsperado) apontar(divergencias, 'gaveta_saldo_divergente');
  if (diferenca !== valores.diferenca) apontar(divergencias, 'gaveta_contagem_divergente');
  for (const campo of ['dinheiroGaveta']) if (turno[campo] !== undefined && centavos(turno[campo]) !== valores.saldoEsperado) apontar(divergencias, 'gaveta_saldo_divergente');
  return { ...resultado(), saldoCalculadoCentavos: esperado, sangriasCentavos: sangrias };
}
