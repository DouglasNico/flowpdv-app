/**
 * preload.js - Ponte Segura de Comunicação (IPC)
 */

const { contextBridge, ipcRenderer, shell } = require('electron');
const testMode = process.argv.includes('--flowpdv-test-renderer');
const hostedPilot = testMode && process.argv.includes('--flowpdv-piloto-v2-renderer');
if (testMode) {
  window.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'flowpdv-profile-banner';
    banner.textContent = hostedPilot ? 'PILOTO V2 — conectado ao Firebase real; TEF, emissão fiscal e impressão física bloqueados' : 'AMBIENTE DE TESTE — dados separados; serviços reais bloqueados';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#9a3412;color:white;text-align:center;padding:6px;font:14px sans-serif;pointer-events:none';
    document.body.appendChild(banner);
  });
}

contextBridge.exposeInMainWorld('electronAPI', {
  ambienteTeste: testMode,
  pilotoHospedado: hostedPilot,
  homologacaoOperacional: testMode && process.argv.includes('--flowpdv-homologacao-renderer'),
  aplicativoCompletoTeste: testMode && process.argv.includes('--flowpdv-homologacao-renderer') && process.argv.includes('--flowpdv-app-completo-renderer'),
  perfilTesteNomeado: testMode && process.argv.includes('--flowpdv-recovery-profile-renderer'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  iniciarDownloadAtualizacao: () => ipcRenderer.invoke('iniciar-download-atualizacao'),
  aplicarAtualizacaoAgora: () => ipcRenderer.invoke('aplicar-atualizacao-agora'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  printThermalReceipt: (htmlContent, silent, opts) => ipcRenderer.invoke('print-thermal-receipt', htmlContent, silent, opts || {}),
  fecharAppConfirmado: () => ipcRenderer.invoke('fechar-app-confirmado'),
  definirTelaCheiaOperador: (ativa) => ipcRenderer.invoke('definir-tela-cheia-operador', Boolean(ativa)),
  manterTelaAcordada: (ativa) => ipcRenderer.invoke('manter-tela-acordada', Boolean(ativa)),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  // Chamadas HTTP à Focus NFe saem pelo processo principal (sem CORS).
  fiscalHttp: (req) => ipcRenderer.invoke('http-json', req),
  httpJson: (req) => ipcRenderer.invoke('http-json', req),
  // TEF SiTef (CliSiTef via DLL no processo principal)
  sitefConfigurar: (cfg) => ipcRenderer.invoke('sitef-configurar', cfg),
  sitefExecutar: (params) => ipcRenderer.invoke('sitef-executar', params),
  sitefResponder: (resposta) => ipcRenderer.invoke('sitef-responder', resposta),
  sitefCancelar: () => ipcRenderer.invoke('sitef-cancelar'),
  sitefFinalizar: (params) => ipcRenderer.invoke('sitef-finalizar', params),
  sitefPinpadPresente: () => ipcRenderer.invoke('sitef-pinpad-presente'),
  onSitefEvento: (callback) => {
    ipcRenderer.on('sitef-evento', (_event, data) => callback(data));
  },
  openExternal: (url) => testMode ? Promise.reject(new Error('Links externos desativados no ambiente de teste.')) : shell.openExternal(url),
  salvarLicencaArquivo: (lic) => ipcRenderer.invoke('salvar-licenca-arquivo', lic),
  carregarLicencaArquivo: () => ipcRenderer.invoke('carregar-licenca-arquivo'),
  carregarLicencaArquivoSync: () => ipcRenderer.sendSync('carregar-licenca-arquivo-sync'),
  onSolicitarFechamento: (callback) => {
    ipcRenderer.on('solicitar-fechamento-app', () => callback());
  },
  onForcarOfflineESair: (callback) => {
    ipcRenderer.on('forcar-offline-e-sair', () => callback());
  },
  onUpdaterMessage: (callback) => {
    ipcRenderer.on('updater-message', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, data) => callback(data));
  }
});
