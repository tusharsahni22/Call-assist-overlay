const { app, BrowserWindow, ipcMain, screen, globalShortcut, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('../services/transcribe');
const { streamRealtimeAnswer } = require('../services/realtime-answer');
const { generateCallFeedback } = require('../services/feedback');

let mainWindow = null;
let isClickThroughState = false;

// Settings store file in userData
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'call-feedback-settings.json');
}

function loadSettings() {
  try {
    const p = getSettingsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  return {
    openaiApiKey: '',
    silenceTimeout: 8, // seconds
    vadThreshold: 0.02,
    language: 'en',
    mode: 'interview',
    userContext: ''
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save settings:', err);
    return false;
  }
}

function toggleClickThrough(forceState = null) {
  if (!mainWindow) return;
  isClickThroughState = forceState !== null ? forceState : !isClickThroughState;

  if (isClickThroughState) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }

  mainWindow.webContents.send('click-through-changed', isClickThroughState);
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 520,
    height: 720,
    x: Math.round(screenWidth - 550),
    y: Math.round((screenHeight - 720) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 360,
    minHeight: 400,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // STEALTH: Prevent Zoom, Teams, Meet, OBS, Discord from capturing this overlay
  try {
    mainWindow.setContentProtection(true);
    console.log('[Stealth Mode] Content protection active.');
  } catch (err) {
    console.error('Content protection error:', err);
  }

  // Intercept getDisplayMedia for Windows WASAPI loopback capture
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      if (sources && sources.length > 0) {
        callback({
          video: sources[0],
          audio: 'loopback' // Windows WASAPI loopback captures call participants!
        });
      } else {
        callback({});
      }
    } catch (e) {
      console.error('DisplayMedia handler error:', e);
      callback({});
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Window Controls
  ipcMain.on('minimize-window', () => mainWindow && mainWindow.minimize());
  ipcMain.on('close-window', () => mainWindow && mainWindow.close());
  ipcMain.on('toggle-always-on-top', (e, state) => mainWindow && mainWindow.setAlwaysOnTop(state, 'screen-saver'));
  ipcMain.on('toggle-click-through', (e, state) => toggleClickThrough(state));
  ipcMain.on('toggle-protection', (e, state) => {
    if (mainWindow) {
      mainWindow.setContentProtection(state);
      e.reply('protection-status', state);
    }
  });

  // Settings IPC
  ipcMain.handle('get-settings', () => loadSettings());
  ipcMain.handle('save-settings', (e, settings) => saveSettings(settings));

  // Audio Chunk / Full Audio Transcription IPC
  ipcMain.handle('transcribe-chunk', async (e, { audioBuffer, language }) => {
    const settings = loadSettings();
    const buf = Buffer.from(audioBuffer);
    return await transcribeAudio(buf, settings.openaiApiKey, language || settings.language);
  });

  // Post-Call Feedback IPC
  ipcMain.handle('generate-feedback', async (e, { transcript }) => {
    const settings = loadSettings();
    return await generateCallFeedback(transcript, settings.openaiApiKey, settings.userContext);
  });

  // Realtime Answer Streaming IPC
  ipcMain.on('request-realtime-answer', async (e, { question, customContext, mode }) => {
    const settings = loadSettings();
    const selectedMode = mode || settings.mode || 'interview';
    const ctx = customContext || settings.userContext || '';

    await streamRealtimeAnswer({
      question,
      context: ctx,
      mode: selectedMode,
      apiKey: settings.openaiApiKey,
      onToken: (token) => {
        if (mainWindow) mainWindow.webContents.send('realtime:token', token);
      },
      onDone: () => {
        if (mainWindow) mainWindow.webContents.send('realtime:done');
      },
      onError: (err) => {
        if (mainWindow) mainWindow.webContents.send('realtime:error', err.message);
      }
    });
  });
}

app.whenReady().then(() => {
  createWindow();

  // Global hotkey to escape/toggle click-through anywhere
  globalShortcut.register('Alt+X', () => toggleClickThrough());
  globalShortcut.register('CommandOrControl+Shift+X', () => toggleClickThrough());
  
  // Ctrl+Shift+L to toggle listening
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (mainWindow) mainWindow.webContents.send('shortcut:toggle-listening');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

