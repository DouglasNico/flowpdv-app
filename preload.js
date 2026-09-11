/**
 * preload.js - Ponte Segura de Comunicação (IPC)
 */

const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
  openExternal: (url) => shell.openExternal(url),
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