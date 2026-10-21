const { app, BrowserWindow, ipcMain, screen, globalShortcut, session, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;
let isClickThroughState = false;

function toggleClickThrough(forceState = null) {
  if (!mainWindow) return;
  isClickThroughState = forceState !== null ? forceState : !isClickThroughState;

  if (isClickThroughState) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }

  mainWindow.webContents.send('click-through-changed', isClickThroughState);
  console.log('[Click-Through]', isClickThroughState ? 'ENABLED (Use Alt+X to disable)' : 'DISABLED');
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    x: Math.round(screenWidth - 530),
    y: Math.round((screenHeight - 700) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 340,
    minHeight: 350,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // STEALTH: Hide window from Zoom, Teams, Meet, OBS, Discord screen sharing & screen capture
  try {
    mainWindow.setContentProtection(true);
    console.log('[Stealth Mode] Window display capture exclusion active.');
  } catch (err) {
    console.error('Failed to enable content protection:', err);
  }

  // Handle DisplayMedia requests for system audio loopback capture
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources && sources.length > 0) {
        callback({
          video: sources[0],
          audio: 'loopback' // Captures full Windows meeting/system audio!
        });
        console.log('[Audio Capture] Bound to screen loopback source successfully');
      } else {
        callback({});
      }
    } catch (err) {
      console.error('[Audio Capture Error]:', err);
      callback({});
    }
  });

  mainWindow.loadFile('index.html');

  // Handle IPC calls
  ipcMain.on('toggle-click-through', (event, state) => {
    toggleClickThrough(state);
  });

  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('toggle-always-on-top', (event, stayOnTop) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(stayOnTop, 'screen-saver');
    }
  });

  ipcMain.on('toggle-protection', (event, enable) => {
    if (mainWindow) {
      mainWindow.setContentProtection(enable);
      event.reply('protection-status', enable);
    }
  });

  // Provide list of desktop capture sources if renderer requests
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    return sources.map(s => ({ id: s.id, name: s.name }));
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Register Global Hotkey (Alt+X and Ctrl+Shift+X) to escape or toggle click-through
  globalShortcut.register('Alt+X', () => {
    toggleClickThrough();
  });
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    toggleClickThrough();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
