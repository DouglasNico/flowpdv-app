/**
 * sitef-bridge.js - Ponte entre o Electron (processo principal) e a CliSiTefI.dll.
 *
 * A CliSiTef trabalha em laço interativo: a automação chama
 * ContinuaFuncaoSiTefInterativo repetidas vezes e recebe "comandos" (mostrar
 * mensagem, menu, coletar campo, devolver resultado...). Aqui o laço roda no
 * main; o que precisa de tela vai por IPC para o renderer ('sitef-evento') e a
 * resposta volta em 'sitef-responder'.
 *
 * A DLL é do cliente (fornecida pela Software Express/Fiserv junto com o
 * SiTef). O FlowPDV só precisa do caminho dela. Electron x64 exige a DLL x64.
 */

const path = require('path');
const fs = require('fs');

const TAM_BUFFER = 20000;

// Comandos que precisam de resposta do operador/renderer.
const COMANDOS_COM_RESPOSTA = new Set([20, 21, 22, 29, 30, 31, 34, 35, 41, 42]);

let koffi = null;
let lib = null;
let fn = null;
let dllCarregada = '';
let configurada = false;

let emExecucao = false;
let chamadaNativa = false;
let cancelarSolicitado = false;
let seqEvento = 0;
const pendentes = new Map(); // idEvento -> resolve

function latin1(str) {
  return Buffer.from(String(str || '').replace(/\0/g, '') + '\0', 'latin1');
}

function chamar(f, ...args) {
  if (chamadaNativa) return Promise.reject(new Error('CliSiTef ocupada. Aguarde.'));
  chamadaNativa = true;
  return new Promise((resolve, reject) => {
    try { f.async(...args, (err, result) => err ? reject(err) : resolve(result)); }
    catch (e) { reject(e); }
  }).finally(() => { chamadaNativa = false; });
}

function lerBuffer(buf) {
  const fim = buf.indexOf(0);
  return buf.toString('latin1', 0, fim < 0 ? buf.length : fim);
}

function carregarDll(caminho) {
  if (lib && dllCarregada === caminho) return;
  if (!caminho || !fs.existsSync(caminho)) {
    throw new Error('CliSiTefI.dll não encontrada em: ' + (caminho || '(vazio)'));
  }
  if (!koffi) koffi = require('koffi');

  // A CliSiTefI carrega a CliSiTef.dll da mesma pasta: entra na pasta antes.
  const pasta = path.dirname(caminho);
  const cwdAnterior = process.cwd();
  try { process.chdir(pasta); } catch (e) {}
  try {
    lib = koffi.load(caminho);
  } finally {
    try { process.chdir(cwdAnterior); } catch (e) {}
  }

  fn = {
    configurar: lib.func('int __stdcall ConfiguraIntSiTefInterativoEx(const char *ip, const char *loja, const char *terminal, short reservado, const char *param)'),
    iniciar: lib.func('int __stdcall IniciaFuncaoSiTefInterativo(int funcao, const char *valor, const char *cupom, const char *data, const char *hora, const char *operador, const char *param)'),
    continuar: lib.func('int __stdcall ContinuaFuncaoSiTefInterativo(_Inout_ int *comando, _Inout_ int *tipoCampo, _Inout_ short *tamMin, _Inout_ short *tamMax, _Inout_ uint8_t *buffer, int tamBuffer, int continua)'),
    finalizar: lib.func('void __stdcall FinalizaFuncaoSiTefInterativo(short confirma, const char *cupom, const char *data, const char *hora, const char *param)'),
    pinpad: lib.func('int __stdcall VerificaPresencaPinPad()'),
    mensagemPinpad: lib.func('int __stdcall EscreveMensagemPermanentePinPad(const char *msg)')
  };
  dllCarregada = caminho;
  configurada = false;
}

async function configurar(cfg) {
  if (emExecucao || chamadaNativa) throw new Error('Aguarde o fim da transação antes de configurar o SiTef.');
  carregarDll(cfg.caminhoDll);
  const ip = String(cfg.ipServidor || '').trim();
  const loja = String(cfg.codigoLoja || '').replace(/\D/g, '').padStart(8, '0');
  const terminal = String(cfg.codigoTerminal || '').trim();
  const param = String(cfg.parametrosAdicionais || '');
  if (!ip) throw new Error('IP do servidor SiTef não informado.');
  if (!/^[A-Za-z]{2}\d{6}$/.test(terminal)) throw new Error('Código do terminal deve ter 2 letras + 6 dígitos (ex.: FP000001).');

  const r = await chamar(fn.configurar, latin1(ip), latin1(loja), latin1(terminal), 0, latin1(param));
  configurada = r === 0;
  return r;
}

function aguardarResposta(idEvento) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pendentes.delete(idEvento); cancelarSolicitado = true; resolve({ cancelar: true }); }, 120000);
    pendentes.set(idEvento, resposta => { clearTimeout(timer); resolve(resposta); });
  });
}

function enviarEvento(win, evento) {
  if (win && !win.isDestroyed()) win.webContents.send('sitef-evento', evento);
}

/**
 * Executa uma função da CliSiTef do início ao fim do laço interativo.
 * Devolve { retorno, campos, cancelado } sem chamar Finaliza (o renderer
 * confirma depois de imprimir os comprovantes).
 */
async function executar(win, params) {
  if (emExecucao || chamadaNativa) return { retorno: -12, erro: 'Já existe uma transação SiTef em andamento.' };
  if (!fn || !configurada) return { retorno: -1, erro: 'CliSiTef não configurada. Salve a configuração do TEF e teste a conexão.' };

  emExecucao = true;
  cancelarSolicitado = false;
  const campos = {};

  try {
    const inicio = await chamar(fn.iniciar,
      parseInt(params.funcao, 10) || 0,
      latin1(params.valor || ''),
      latin1(params.cupomFiscal || ''),
      latin1(params.dataFiscal || ''),
      latin1(params.horaFiscal || ''),
      latin1((params.operador || 'CAIXA').slice(0, 20)),
      latin1(params.paramAdic || '')
    );
    if (inicio !== 10000) {
      return { retorno: inicio, campos, cancelado: false };
    }

    const comando = [0];
    const tipoCampo = [0];
    const tamMin = [0];
    const tamMax = [0];
    const buffer = Buffer.alloc(TAM_BUFFER);
    let continua = 0;
    let retorno = 10000;
    let iteracoes = 0;

    while (retorno === 10000) {
      retorno = await chamar(fn.continuar, comando, tipoCampo, tamMin, tamMax, buffer, TAM_BUFFER, continua);
      if (retorno !== 10000) break;
      if (++iteracoes > 200000) { retorno = -15; break; }

      const cmd = comando[0];
      const tipo = tipoCampo[0];
      const texto = lerBuffer(buffer);
      continua = 0;

      if (cancelarSolicitado) {
        continua = -1;
        buffer.fill(0);
        continue;
      }

      if (cmd === 0) {
        // Resultado devolvido pela CliSiTef (NSU, comprovantes, etc.)
        campos[tipo] = texto;
        buffer.fill(0);
        continue;
      }

      if (cmd === 23) {
        // CliSiTef perguntando se pode seguir esperando o pinpad: nunca atrasar.
        buffer.fill(0);
        continue;
      }

      const evento = { id: ++seqEvento, comando: cmd, tipoCampo: tipo, tamMin: tamMin[0], tamMax: tamMax[0], texto };

      if (!COMANDOS_COM_RESPOSTA.has(cmd)) {
        // Mensagens de visor, cabeçalhos e limpezas: só mostra e segue.
        enviarEvento(win, evento);
        buffer.fill(0);
        continue;
      }

      const espera = aguardarResposta(evento.id);
      enviarEvento(win, evento);
      const resposta = await espera;
      buffer.fill(0);
      if (!resposta || resposta.cancelar || cancelarSolicitado) {
        continua = -1;
      } else {
        const valor = latin1(resposta.buffer || '');
        valor.copy(buffer, 0, 0, Math.min(valor.length, TAM_BUFFER - 1));
        continua = Number.isInteger(resposta.continua) ? resposta.continua : 0;
      }
    }

    return { retorno, campos, cancelado: cancelarSolicitado || retorno === -2 || retorno === -6 || retorno === -15 };
  } catch (err) {
    return { retorno: -100, campos, erro: err.message, cancelado: false };
  } finally {
    emExecucao = false;
    pendentes.clear();
  }
}

async function finalizar(params) {
  if (!fn) return false;
  if (emExecucao) throw new Error('Aguarde o fim do laço interativo antes de finalizar.');
  await chamar(fn.finalizar,
    params.confirma ? 1 : 0,
    latin1(params.cupomFiscal || ''),
    latin1(params.dataFiscal || ''),
    latin1(params.horaFiscal || ''),
    latin1(params.paramAdic || '')
  );
  return true;
}

function registrar(ipcMain, getWindow) {
  const handle = (channel, handler) => ipcMain.handle(channel, (event, ...args) => {
    const win = getWindow();
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Origem IPC SiTef inválida.');
    return handler(event, ...args);
  });
  handle('sitef-configurar', async (_e, cfg) => {
    try {
      const r = await configurar(cfg || {});
      return { ok: r === 0, codigo: r };
    } catch (err) {
      return { ok: false, codigo: 13, erro: err.message };
    }
  });

  handle('sitef-executar', (_e, params) => executar(getWindow(), params || {}));

  handle('sitef-responder', (_e, resposta) => {
    const r = pendentes.get(resposta && resposta.id);
    if (r) {
      pendentes.delete(resposta.id);
      r(resposta);
      return true;
    }
    return false;
  });

  handle('sitef-cancelar', () => {
    cancelarSolicitado = true;
    // Se estava esperando o operador, destrava o laço para ele encerrar.
    pendentes.forEach((resolve) => resolve({ cancelar: true }));
    pendentes.clear();
    return true;
  });

  handle('sitef-finalizar', async (_e, params) => {
    try { return await finalizar(params || {}); } catch (err) { return false; }
  });

  handle('sitef-pinpad-presente', async () => {
    if (emExecucao || chamadaNativa) return false;
    try { return fn ? (await chamar(fn.pinpad)) === 1 : false; } catch (err) { return false; }
  });
}

module.exports = { registrar };
