import { criarBackupHomologacao } from './backup-homologacao.js';
import { conferirBackupServidor, conferirInventarioBackup } from './conferencia-backup-v2.js';
import { reconstruirBackupConfirmado } from './reconstrucao-backup-v2.js';
import { conferirHistoricoBackup } from './conferencia-historico-v2.js';
import { conferirFechamentosBackup } from './conferencia-fechamento-backup-v2.js';

// Porta de entrada do ensaio em armazenamento vazio. Nunca sobrescreve o perfil aberto.
// A identidade vem da sessão e da delegação no servidor, não da escolha do arquivo.
export async function ensaiarRestauracaoTerminal({ pacote, sessao, storageDestino, ambienteTeste, destinoIsolado, reconstruirConfirmadas = false }) {
  if (ambienteTeste !== true || destinoIsolado !== true) throw new Error('Use um destino de ensaio isolado.');
  if (!storageDestino || storageDestino.length !== 0) throw new Error('O destino precisa estar vazio. Preserve os dados existentes.');
  const uid = sessao.auth.currentUser?.uid;
  if (!uid) throw new Error('Autentique o terminal novo antes de restaurar.');
  const conferirSessao = () => { if (sessao.auth.currentUser?.uid !== uid) throw new Error('A identidade mudou durante a recuperação.'); };
  const call = async (nome, dados) => { conferirSessao(); const result = await sessao.call(nome, dados); conferirSessao(); return result; };
  const binding = await call('consultarMeuTerminalV2', {});
  if (binding?.vinculado !== true || binding.papel !== 'caixa') throw new Error('Autorize este equipamento como caixa antes de restaurar.');
  let copia = JSON.parse(JSON.stringify(pacote));
  const contexto = { lojaId: binding.lojaId, terminalUid: binding.identidadeOperacionalUid || uid, terminalId: copia?.origem?.terminalId };
  const backup = criarBackupHomologacao({ storage: storageDestino, contexto, ambienteTeste, destinoIsolado });
  backup.validar(copia);
  let reconstrucao = null;
  if (reconstruirConfirmadas === true) {
    reconstrucao = await reconstruirBackupConfirmado({ pacote: copia, contexto, ambienteTeste, call });
    copia = reconstrucao.pacote;
  }
  const conferencia = await (JSON.parse(copia.dados.adega_turno_atual || 'null') ? conferirBackupServidor : conferirHistoricoBackup)({ pacote: copia, contexto, ambienteTeste, call });
  if (!conferencia.semDivergencias) throw new Error('O backup diverge do servidor. Confira os movimentos posteriores antes de restaurar.');
  const migracoes = JSON.parse(copia.dados.flowpdv_migracoes_estoque_teste || '[]');
  const inventario = migracoes.length ? await conferirInventarioBackup({ pacote: copia, contexto, ambienteTeste, call }) : null;
  if (inventario?.produtos.some(p => p.situacao !== 'vinculo_conferido')) throw new Error('Vínculos ou unidades do inventário divergem. Confira a migração.');
  const historico = await conferirHistoricoBackup({ pacote: copia, contexto, ambienteTeste, call });
  if (!historico.semDivergencias) throw new Error('O histórico do backup diverge do servidor. Confira os turnos antes de restaurar.');
  const fechamentos = await conferirFechamentosBackup({ pacote: copia, contexto, ambienteTeste, call });
  if (!fechamentos.semDivergencias) throw new Error('Resumos ou fechamentos do restaurante divergem. Confira o arquivo antes de restaurar.');
  if (fechamentos.gavetas?.some(g => g.divergencias.length)) throw new Error('A aritmética da gaveta diverge no backup. Confira sangrias e contagem antes de restaurar.');
  // Revalida imediatamente antes da escrita síncrona; não reutiliza autorização do início.
  const atual = await call('consultarMeuTerminalV2', {});
  if (atual?.vinculado !== true || atual.papel !== 'caixa' || atual.lojaId !== contexto.lojaId
    || (atual.identidadeOperacionalUid || uid) !== contexto.terminalUid) throw new Error('A autorização da recuperação mudou.');
  backup.restaurar(copia);
  return { autenticadoUid: uid, contexto, conferencia, inventario, historico, fechamentos, reconstrucao: reconstrucao?.alteracoes || [], liberacaoOperacional: false, somenteEnsaio: true };
}
