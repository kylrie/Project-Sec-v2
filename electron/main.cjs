const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow;
let tray;
let serverProcess;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function startBackend() {
  if (isDev) {
    // In development mode, the dev server is run separately (e.g. via concurrently)
    return Promise.resolve(true);
  }

  // Production: start the compiled server
  const serverPath = path.join(process.cwd(), 'dist', 'server.cjs');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
    stdio: 'inherit',
    detached: false
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend server:', err);
  });

  // Wait for server to be ready before loading window
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max
    const check = setInterval(() => {
      attempts++;
      http.get('http://localhost:3000/api/health', (res) => {
        if (res.statusCode === 200) {
          clearInterval(check);
          console.log('[Electron] Backend server is healthy and ready.');
          resolve(true);
        }
      }).on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(check);
          console.warn('[Electron] Backend health check timeout reached. Proceeding to load window.');
          resolve(false);
        }
      });
    }, 500);
  });
}

function toggleMiniMode() {
  if (!mainWindow) return;
  if (mainWindow.isAlwaysOnTop()) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(900, 600);
    mainWindow.setSize(1280, 800);
    mainWindow.center();
  } else {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth } = primaryDisplay.workAreaSize;

    mainWindow.setMinimumSize(380, 500);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSize(400, 600);
    mainWindow.setPosition(screenWidth - 420, 20);
    mainWindow.show();
    mainWindow.focus();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 500,
    frame: true,
    backgroundColor: '#030712',
    icon: path.join(__dirname, '../public/icon-256.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  // Register Global Summon Hotkey (Alt+Shift+A)
  globalShortcut.register('Alt+Shift+A', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Mini overlay mode (Ctrl+Shift+M)
  globalShortcut.register('Ctrl+Shift+M', () => {
    toggleMiniMode();
  });

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon-256.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Project Ahri (Alt+Shift+A)',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Toggle Mini Overlay Mode (Ctrl+Shift+M)',
      click: () => {
        toggleMiniMode();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Project Ahri - AI Executive Intelligence');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// IPC Handlers for window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.on('toggle-devtools', () => mainWindow?.webContents.toggleDevTools());
ipcMain.on('toggle-mini-mode', () => toggleMiniMode());

// System-level Device Mesh IPC Handlers
const { exec } = require('child_process');

ipcMain.handle('system-shutdown', () => {
  try {
    exec('shutdown /s /t 60');
    return { success: true, message: 'System shutdown initiated in 60s' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system-lock', () => {
  try {
    exec('rundll32.exe user32.dll,LockWorkStation');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system-volume', (event, level) => {
  try {
    const vol = Math.max(0, Math.min(100, level || 50));
    exec(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"`);
    return { success: true, level: vol };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system-mute', () => {
  try {
    exec(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// Background wake word detection (Windows)
let wakeWordProcess = null;

function startBackgroundWakeWord() {
  if (process.env.DISABLE_WAKE_WORD === 'true') return;
  console.log('[WakeWord] Free Web Speech API continuous mode active in renderer.');
}


app.whenReady().then(async () => {
  await startBackend();
  createWindow();
  createTray();
  startBackgroundWakeWord();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    console.log('[Electron] Terminating background backend process...');
    serverProcess.kill();
  }
  if (wakeWordProcess && typeof wakeWordProcess.stop === 'function') {
    try {
      wakeWordProcess.stop();
    } catch (e) {}
  }
});

