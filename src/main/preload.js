const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('callAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (enabled) => ipcRenderer.send('toggle-always-on-top', enabled),
  setClickThrough: (enabled) => ipcRenderer.send('toggle-click-through', enabled),
  onClickThroughChanged: (callback) => ipcRenderer.on('click-through-changed', (_, val) => callback(val)),
  setContentProtection: (enabled) => ipcRenderer.send('toggle-protection', enabled),
  onProtectionStatus: (callback) => ipcRenderer.on('protection-status', (_, val) => callback(val)),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Transcription & Feedback
  transcribeChunk: (data) => ipcRenderer.invoke('transcribe-chunk', data),
  generateFeedback: (data) => ipcRenderer.invoke('generate-feedback', data),

  // Real-time answers
  requestRealtimeAnswer: (data) => ipcRenderer.send('request-realtime-answer', data),
  onRealtimeToken: (callback) => ipcRenderer.on('realtime:token', (_, token) => callback(token)),
  onRealtimeDone: (callback) => ipcRenderer.on('realtime:done', () => callback()),
  onRealtimeError: (callback) => ipcRenderer.on('realtime:error', (_, err) => callback(err)),

  // Shortcuts
  onToggleListeningShortcut: (callback) => ipcRenderer.on('shortcut:toggle-listening', () => callback())
});

