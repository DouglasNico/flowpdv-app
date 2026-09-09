/**
 * main.js - Processo Principal do Adega Gestão & PDV Ágil
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

// Prevenir popups de exceções não capturadas no processo principal
process.on('uncaughtException', (err) => {
  console.error('[Main uncaughtException]:', err);
  try {
    if (dialog && typeof dialog.showErrorBox === 'function') {
      dialog.showErrorBox('FlowPDV', 'Ocorreu um erro interno. O caixa continua aberto. Se algo falhar, reinicie o aplicativo.\n\n' + (err && err.message ? err.message : String(err)));
    }
  } catch (e) {}
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main unhandledRejection]:', reason);
});

// Helper seguro para envio de mensagens IPC (evita erro de Object has been destroyed)
function enviarParaJanela(canal, dados) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(canal, dados);
    }
  } catch (e) {}
}

let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  console.log('electron-updater não disponível no momento');
}

let mainWindow;
let isQuiting = false;
let displaySleepBlockerId = null;
let pdvQuerTelaAcordada = true;

function atualizarBloqueioTela() {
  const janelaVisivel = !!(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized()
  );
  const deveManterAcordada = pdvQuerTelaAcordada && janelaVisivel && !isQuiting;

  if (deveManterAcordada) {
    if (displaySleepBlockerId == null || !powerSaveBlocker.isStarted(displaySleepBlockerId)) {
      displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
    return;
  }

  if (displaySleepBlockerId != null) {
    if (powerSaveBlocker.isStarted(displaySleepBlockerId)) {
      powerSaveBlocker.stop(displaySleepBlockerId);
    }
    displaySleepBlockerId = null;
  }
}
// Forçar identificação e pasta de dados permanente e imutável entre versões
app.name = 'flowpdv';
if (process.platform === 'win32') {
  // Instalado: ID novo (v2) para o Windows soltar o ícone antigo cacheado
  // em com.flowpdv.app. Em teste, ID próprio para não herdar o atalho instalado.
  app.setAppUserModelId(app.isPackaged ? 'com.flowpdv.app.v2' : 'com.flowpdv.app.dev');
}
try {
  const userDataPath = path.join(app.getPath('appData'), 'flowpdv');
  app.setPath('userData', userDataPath);
} catch(e) {}

// Evitar instâncias duplicadas disputando o cache do Windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    const icoPath = path.join(__dirname, 'src', 'assets', 'icon.ico');
    const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
    
    const windowConfig = {
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: 'FlowPDV — Sistema de Frente de Caixa e Gestão Comercial',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        spellcheck: true
      },
      backgroundColor: '#e2e8f0',
      autoHideMenuBar: true,
      show: false
    };

    const targetIcon = (process.platform === 'win32' && fs.existsSync(icoPath)) ? icoPath : (fs.existsSync(iconPath) ? iconPath : null);
    if (targetIcon) {
      windowConfig.icon = targetIcon;
    }

    mainWindow = new BrowserWindow(windowConfig);
    if (targetIcon) {
      try {
        mainWindow.setIcon(targetIcon);
      } catch (e) {
        console.log('[Icon Window Warning]:', e?.message || e);
      }
    }

    // Configurar o corretor ortográfico exclusivamente para Português do Brasil
    try {
      mainWindow.webContents.session.setSpellCheckerLanguages(['pt-BR']);
    } catch (e) {
      console.log('[SpellChecker] Aviso ao configurar idiomas:', e?.message || e);
    }

    // Habilitar menu de contexto com sugestões do corretor ortográfico ao clicar com botão direito
    mainWindow.webContents.on('context-menu', (event, params) => {
      const menu = new Menu();

      // 1. Sugestões ortográficas para a palavra sublinhada
      if (params.misspelledWord) {
        if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
          for (const suggestion of params.dictionarySuggestions) {
            menu.append(new MenuItem({
              label: suggestion,
              click: () => mainWindow.webContents.replaceMisspelling(suggestion)
            }));
          }
        } else {
          menu.append(new MenuItem({
            label: 'Nenhuma sugestão encontrada',
            enabled: false
          }));
        }

        menu.append(new MenuItem({ type: 'separator' }));

        // Opção para adicionar palavra ao dicionário pessoal
        menu.append(new MenuItem({
          label: `Adicionar "${params.misspelledWord}" ao Dicionário`,
          click: () => {
            try {
              mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
            } catch (e) {}
          }
        }));

        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 2. Ações padrão de edição de texto quando estiver em um campo editável
      if (params.isEditable) {
        menu.append(new MenuItem({ role: 'undo', label: 'Desfazer' }));
        menu.append(new MenuItem({ role: 'redo', label: 'Refazer' }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ role: 'cut', label: 'Recortar' }));
        menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
        menu.append(new MenuItem({ role: 'paste', label: 'Colar' }));
        menu.append(new MenuItem({ role: 'selectAll', label: 'Selecionar Tudo' }));
      } else if (params.selectionText) {
        menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
      }

      if (menu.items.length > 0) {
        menu.popup();
      }
    });

    // Sempre abrir com a janela maximizada em tela cheia
    mainWindow.maximize();
    mainWindow.show();

    mainWindow.loadFile('index.html');

    let closeClicks = 0;
    let resetCloseTimer = null;
    mainWindow.on('close', (e) => {
      if (!isQuiting) {
        closeClicks++;
        if (closeClicks >= 2) {
          // Se o usuário clicar no X 2 vezes, fecha imediatamente
          isQuiting = true;
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
          app.quit();
          return;
        }
        e.preventDefault();
        enviarParaJanela('solicitar-fechamento-app');

        clearTimeout(resetCloseTimer);
        resetCloseTimer = setTimeout(() => { closeClicks = 0; }, 4000);
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
      atualizarBloqueioTela();
    });
    mainWindow.on('show', atualizarBloqueioTela);
    mainWindow.on('hide', atualizarBloqueioTela);
    mainWindow.on('minimize', atualizarBloqueioTela);
    mainWindow.on('restore', atualizarBloqueioTela);
    atualizarBloqueioTela();

    // Iniciar verificação de atualizações após carregar a janela
    setupAutoUpdater();
  }

  function setupAutoUpdater() {
    if (!autoUpdater) return;

    // Função auxiliar para evitar poluição do console caso o GitHub retorne página HTML de erro (ex: 500)
    function sanitizarMsgErro(msg) {
      if (!msg) return '';
      const str = typeof msg === 'string' ? msg : (msg?.message || String(msg));
      if (str.includes('<!DOCTYPE') || str.includes('<html') || str.length > 250) {
        const primeiraLinha = str.split('\n')[0].trim();
        return `${primeiraLinha} (Servidor GitHub temporariamente indisponível ou instável)`;
      }
      return str;
    }

    // Logger para diagnóstico
    autoUpdater.logger = {
      info: (msg) => console.log('[AutoUpdater INFO]', msg),
      warn: (msg) => console.log('[AutoUpdater WARN]', msg),
      error: (msg) => console.log('[AutoUpdater ERROR]', sanitizarMsgErro(msg)),
      debug: (msg) => console.log('[AutoUpdater DEBUG]', msg),
    };
    autoUpdater.logger.transports = undefined;

    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'DouglasNico',
        repo: 'flowpdv',
        updaterCacheDirName: 'flowpdv-updater'
      });
    } catch (e) {
      console.log('[AutoUpdater] Erro ao configurar feed URL:', e);
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    // Forçar download do instalador completo (sem delta/blockmap)
    // para evitar travamento em 0% por problemas com o blockmap no GitHub CDN
    try {
      autoUpdater.isUpdaterActive = () => true;
    } catch(e) {}

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Verificando atualizações...');
    });

    autoUpdater.on('update-available', (info) => {
      const currentVer = app.getVersion();
      console.log(`[AutoUpdater] Versão disponível: ${info.version} (Atual: ${currentVer})`);
      if (info.version !== currentVer) {
        enviarParaJanela('updater-message', {
          tipo: 'disponivel',
          versao: info.version,
          currentVersion: currentVer,
          msg: `Uma nova versão (v${info.version}) está disponível!`
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater] Sistema já está na versão mais recente.');
      enviarParaJanela('updater-message', {
        tipo: 'atualizado',
        versao: app.getVersion(),
        msg: `🟢 Sistema atualizado na versão mais recente (v${app.getVersion()})!`
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      console.log(`[AutoUpdater] Progresso: ${Math.round(progressObj.percent || 0)}% (${progressObj.bytesPerSecond} B/s)`);
      enviarParaJanela('download-progress', {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Atualização baixada com sucesso:', info.version);
      enviarParaJanela('update-downloaded', {
        tipo: 'baixado',
        versao: info.version,
        msg: `A nova versão v${info.version} foi baixada e está pronta!`
      });
    });

    autoUpdater.on('error', (err) => {
      const errMsg = sanitizarMsgErro(err);
      console.log('[AutoUpdater] Erro:', errMsg);
      enviarParaJanela('updater-message', {
        tipo: 'erro',
        error: errMsg
      });
    });

    // Checar atualizações automaticamente 5 segundos após abrir
    setTimeout(() => {
      if (autoUpdater) {
        autoUpdater.checkForUpdates().catch((err) => {
          console.log('[AutoUpdater] Verificação inicial:', sanitizarMsgErro(err));
        });
      }
    }, 5000);
  }

  function repararAtalhosWindows() {
    if (process.platform !== 'win32') return;
    try {
      const currentExe = process.execPath;
      if (!currentExe || currentExe.toLowerCase().includes('node_modules') || currentExe.toLowerCase().includes('electron.exe')) return;
      
      const appData = process.env.APPDATA || '';
      const tbLnk = path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar', 'FlowPDV.lnk');
      
      if (fs.existsSync(tbLnk)) {
        const psCmd = `$sh = New-Object -ComObject WScript.Shell; $sc = $sh.CreateShortcut('${tbLnk.replace(/'/g, "''")}'); if ($sc.TargetPath -ne '${currentExe.replace(/'/g, "''")}') { $sc.TargetPath = '${currentExe.replace(/'/g, "''")}'; $sc.WorkingDirectory = '${path.dirname(currentExe).replace(/'/g, "''")}'; $sc.Save() }`;
        require('child_process').exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, () => {});
      }
    } catch(e) {}
  }

  app.whenReady().then(() => {
    repararAtalhosWindows();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // IPC Handler: Verificar atualizações manualmente
  ipcMain.handle('check-for-updates', async () => {
    const currentVer = app.getVersion();
    if (autoUpdater) {
      try {
        const res = await autoUpdater.checkForUpdates();
        const latestVer = res?.updateInfo?.version;
        if (latestVer && latestVer !== currentVer) {
          return {
            success: true,
            updateAvailable: true,
            version: latestVer,
            currentVersion: currentVer,
            updateInfo: res.updateInfo
          };
        }
        return {
          success: true,
          updateAvailable: false,
          version: currentVer,
          currentVersion: currentVer,
          msg: `🟢 Você já está na versão mais recente (v${currentVer})!`
        };
      } catch (e) {
        const msg = String(e.message || '');
        if (msg.includes('404') || msg.includes('Cannot find') || msg.includes('releases.atom')) {
          return { success: true, updateAvailable: false, version: currentVer, currentVersion: currentVer, msg: `🟢 Você já está na versão mais recente (v${currentVer})!` };
        }
        return { success: false, updateAvailable: false, error: msg, version: currentVer, currentVersion: currentVer, msg: `Não foi possível verificar no momento (v${currentVer}).` };
      }
    }
    return { success: true, updateAvailable: false, isDev: true, version: currentVer, currentVersion: currentVer, msg: `🟢 Modo local ativo (v${currentVer}).` };
  });

  // IPC Handler: Iniciar Download da Atualização
  ipcMain.handle('iniciar-download-atualizacao', async () => {
    if (autoUpdater) {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'autoUpdater não disponível' };
  });

  // IPC Handler: Aplicar Atualização e Reiniciar Sozinho em Modo Oculto
  ipcMain.handle('aplicar-atualizacao-agora', () => {
    if (autoUpdater) {
      isQuiting = true;
      // quitAndInstall(isSilent = true, isForceRunAfter = true) com oneClick: true instala silencioso e abre sozinho
      autoUpdater.quitAndInstall(true, true);
    }
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  function caminhoArquivoLicenca() {
    return path.join(app.getPath('userData'), 'licenca-loja.json');
  }

  ipcMain.handle('salvar-licenca-arquivo', (_event, lic) => {
    try {
      if (!lic || typeof lic !== 'object') return { ok: false };
      const chave = String(lic.chaveLicenca || '').trim();
      if (!chave) return { ok: false, error: 'sem_chave' };
      const destino = caminhoArquivoLicenca();
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, JSON.stringify(lic), 'utf8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('carregar-licenca-arquivo', () => {
    try {
      const destino = caminhoArquivoLicenca();
      if (!fs.existsSync(destino)) return null;
      const raw = fs.readFileSync(destino, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && String(parsed.chaveLicenca || '').trim()) return parsed;
      return null;
    } catch (e) {
      return null;
    }
  });

  ipcMain.on('carregar-licenca-arquivo-sync', (event) => {
    try {
      const destino = caminhoArquivoLicenca();
      if (!fs.existsSync(destino)) {
        event.returnValue = null;
        return;
      }
      const raw = fs.readFileSync(destino, 'utf8');
      const parsed = JSON.parse(raw);
      event.returnValue = (parsed && String(parsed.chaveLicenca || '').trim()) ? parsed : null;
    } catch (e) {
      event.returnValue = null;
    }
  });

  // IPC Handler: Fechar Aplicativo com Confirmação Estilizada
  ipcMain.handle('fechar-app-confirmado', () => {
    isQuiting = true;
    if (mainWindow) mainWindow.destroy();
    app.quit();
  });

  ipcMain.handle('manter-tela-acordada', (_event, ativa) => {
    pdvQuerTelaAcordada = Boolean(ativa);
    atualizarBloqueioTela();
    return pdvQuerTelaAcordada;
  });

  ipcMain.handle('definir-tela-cheia-operador', (event, ativa) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(Boolean(ativa));
        if (!ativa) mainWindow.maximize();
        return true;
      }
    } catch (e) {}
    return false;
  });

  // IPC Handler: Reiniciar e aplicar atualização
  ipcMain.handle('quit-and-install-update', () => {
    if (autoUpdater) {
      isQuiting = true;
      autoUpdater.quitAndInstall(true, true);
    }
  });

  // IPC Handler: Impressão Térmica Direta (Silenciosa ou com diálogo)
  ipcMain.handle('print-thermal-receipt', async (event, htmlContent, silent = false) => {
    let printWindow = null;
    try {
      printWindow = new BrowserWindow({
        show: false,
        width: 400,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      return new Promise((resolve) => {
        let isDone = false;
        const finalizar = (res) => {
          if (isDone) return;
          isDone = true;
          if (printWindow && !printWindow.isDestroyed()) {
            printWindow.destroy();
          }
          resolve(res);
        };

        // Timeout de segurança (90s para dar tempo ao operador)
        const timer = setTimeout(() => {
          finalizar({ success: false, error: 'Timeout de impressão' });
        }, 90000);

        printWindow.webContents.print(
          {
            silent: silent,
            printBackground: true,
            margins: { marginType: 'none' }
          },
          (success, failureReason) => {
            clearTimeout(timer);
            finalizar({ success, error: failureReason });
          }
        );
      });
    } catch (err) {
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.destroy();
      }
      return { success: false, error: err.message };
    }
  });

  // IPC Handler: Informações do Sistema do Computador (Hostname, Usuário, etc.)
  ipcMain.handle('get-system-info', async () => {
    try {
      const os = require('os');
      let username = 'Operador';
      try {
        if (os.userInfo && typeof os.userInfo === 'function') {
          const u = os.userInfo();
          if (u && u.username) username = u.username;
        }
      } catch(e) {}

      return {
        hostname: os.hostname() || 'Computador Local',
        username: username,
        platform: os.platform() || 'win32',
        release: os.release() || ''
      };
    } catch (e) {
      return {
        hostname: 'Computador Local',
        username: 'Operador',
        platform: 'win32',
        release: ''
      };
    }
  });
}
