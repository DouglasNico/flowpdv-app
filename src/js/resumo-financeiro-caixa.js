import { vendaPertenceAoTurno, dinheiroLiquidoVenda } from './merge-core.js';
import { mesclarResumoRestaurante } from './resumo-restaurante-caixa.js';

export function calcularResumoFinanceiroBase(turno, vendas, ambienteTeste = false) {
    if (!turno) return {
      vendasCount: 0, totalVendas: 0, totalDinheiro: 0, totalPix: 0,
      totalDebito: 0, totalCredito: 0, totalFiado: 0, totalVoucher: 0, totalSangrias: 0, saldoEmGaveta: 0
    };


    const vendasTurno = vendas.filter(v => vendaPertenceAoTurno(v, turno));

    let totalDinheiro = 0;
    let totalPix = 0;
    let totalDebito = 0;
    let totalCredito = 0;
    let totalFiado = 0;
    let totalVoucher = 0;
    let totalVendas = 0;

    const acumularForma = (forma, val) => {
      if (forma === 'PIX') totalPix += val;
      else if (forma === 'Débito') totalDebito += val;
      else if (forma === 'Crédito') totalCredito += val;
      else if (forma === 'Fiado') totalFiado += val;
      else if (forma === 'Voucher' || (typeof forma === 'string' && (/^(VR|Alelo|Pluxee|Ticket|Outros)\s*-/i.test(forma) || /voucher/i.test(forma)))) totalVoucher += val;
    };

    vendasTurno.forEach(v => {
      const tot = v.total || 0;
      totalVendas += tot;

      if (v.pagamentoDividido && Array.isArray(v.pagamentos)) {
        v.pagamentos.forEach(p => {
          const val = parseFloat(p.valor) || 0;
          acumularForma(p.forma, val);
        });
        totalDinheiro += dinheiroLiquidoVenda(v);
      } else if (v.pagamentoDividido && (v.parcela1 || v.parcela2)) {
        const addParcela = (forma, valor) => acumularForma(forma, parseFloat(valor) || 0);
        if (v.parcela1) addParcela(v.parcela1.forma, v.parcela1.valor);
        if (v.parcela2) addParcela(v.parcela2.forma, v.parcela2.valor);
        totalDinheiro += dinheiroLiquidoVenda(v);
      } else {
        if (v.formaPagamento === 'Dinheiro') totalDinheiro += tot;
        else if (v.formaPagamento === 'PIX') totalPix += tot;
        else if (v.formaPagamento === 'Débito') totalDebito += tot;
        else if (v.formaPagamento === 'Crédito') totalCredito += tot;
        else if (v.formaPagamento === 'Fiado') totalFiado += tot;
        else if (v.formaPagamento === 'Voucher') totalVoucher += tot;
      }
    });

    const totalSangrias = (turno.sangrias || []).reduce((acc, s) => acc + (s.valor || 0), 0);
    const saldoEmGaveta = Math.max(0, (turno.trocoInicial || 0) + totalDinheiro - totalSangrias);

    return mesclarResumoRestaurante(turno, {
      vendasCount: vendasTurno.length,
      totalVendas,
      totalDinheiro,
      totalPix,
      totalDebito,
      totalCredito,
      totalFiado,
      totalVoucher,
      totalSangrias,
      saldoEmGaveta
    }, ambienteTeste);
  }
