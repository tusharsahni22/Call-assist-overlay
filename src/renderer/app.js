// UI References
const appContainer = document.getElementById('appContainer');
const btnPin = document.getElementById('btnPin');
const btnMinimize = document.getElementById('btnMinimize');
const btnClose = document.getElementById('btnClose');
const btnClickThrough = document.getElementById('btnClickThrough');
const opacitySlider = document.getElementById('opacitySlider');

const callStatusBadge = document.getElementById('callStatusBadge');
const btnToggleListening = document.getElementById('btnToggleListening');
const listeningBtnText = document.getElementById('listeningBtnText');
const btnManualEnd = document.getElementById('btnManualEnd');
const vadMeter = document.getElementById('vadMeter');

const navButtons = document.querySelectorAll('.nav-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

const modePills = document.querySelectorAll('.mode-pill');
const manualAskInput = document.getElementById('manualAskInput');
const btnManualAsk = document.getElementById('btnManualAsk');
const answersStream = document.getElementById('answersStream');
const emptyAnswersPlaceholder = document.getElementById('emptyAnswersPlaceholder');
const rollingTranscriptLog = document.getElementById('rollingTranscriptLog');

// Feedback UI Elements
const feedbackEmpty = document.getElementById('feedbackEmpty');
const feedbackContent = document.getElementById('feedbackContent');
const verdictTag = document.getElementById('verdictTag');
const sentimentTag = document.getElementById('sentimentTag');
const feedbackSummary = document.getElementById('feedbackSummary');
const scoreOverall = document.getElementById('scoreOverall');
const scoreClarity = document.getElementById('scoreClarity');
const scoreListening = document.getElementById('scoreListening');
const scoreQuestioning = document.getElementById('scoreQuestioning');
const strengthsList = document.getElementById('strengthsList');
const improvementsList = document.getElementById('improvementsList');
const missedList = document.getElementById('missedList');

// Settings Form
const inputApiKey = document.getElementById('inputApiKey');
const inputUserContext = document.getElementById('inputUserContext');
const inputSilenceTimeout = document.getElementById('inputSilenceTimeout');
const inputVadThreshold = document.getElementById('inputVadThreshold');
const selectLanguage = document.getElementById('selectLanguage');
const btnSaveSettings = document.getElementById('btnSaveSettings');

let audioEngine = null;
let realtimeAssistant = null;
let currentSettings = {};
let isAlwaysOnTop = true;
let isClickThrough = false;

// ============================================
// INITIALIZATION
// ============================================
async function init() {
  currentSettings = await window.callAPI.getSettings();
  populateSettingsUI(currentSettings);

  // Initialize Realtime Assistant
  realtimeAssistant = new RealtimeAssistant({
    container: answersStream,
    liveTranscriptContainer: rollingTranscriptLog,
    statusBadge: callStatusBadge
  });

  // Initialize Audio Engine with settings
  setupAudioEngine();

  // Setup UI Listeners
  setupWindowControls();
  setupTabs();
  setupSettingsHandlers();
  setupManualAsk();

  // Listen to Global Shortcuts from Electron
  window.callAPI.onToggleListeningShortcut(() => {
    toggleListening();
  });
}

function populateSettingsUI(settings) {
  if (inputApiKey) inputApiKey.value = settings.openaiApiKey || '';
  if (inputUserContext) inputUserContext.value = settings.userContext || '';
  if (inputSilenceTimeout) inputSilenceTimeout.value = settings.silenceTimeout || 8;
  if (inputVadThreshold) inputVadThreshold.value = settings.vadThreshold || 0.02;
  if (selectLanguage) selectLanguage.value = settings.language || 'en';

  // Highlight active mode pill
  const activeMode = settings.mode || 'interview';
  modePills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.mode === activeMode);
  });
}

function setupAudioEngine() {
  audioEngine = new AudioEngine({
    vadThreshold: parseFloat(currentSettings.vadThreshold) || 0.02,
    silenceTimeout: parseInt(currentSettings.silenceTimeout) || 8,

    onStateChange: (state) => {
      console.log('[AudioEngine State]:', state);
      if (state === 'in_conversation') {
        callStatusBadge.textContent = 'Speaking / In Call';
        callStatusBadge.classList.add('active');
        btnManualEnd.style.display = 'flex';
      } else if (state === 'listening') {
        callStatusBadge.textContent = 'Listening for speech...';
        callStatusBadge.classList.remove('active');
      } else if (state === 'idle') {
        callStatusBadge.textContent = 'Idle';
        callStatusBadge.classList.remove('active');
        btnManualEnd.style.display = 'none';
      }
    },

    onVADVolume: (rms) => {
      const pct = Math.min(100, Math.round((rms / 0.08) * 100));
      vadMeter.style.width = `${pct}%`;
      vadMeter.style.background = rms > audioEngine.vadThreshold ? '#10b981' : '#64748b';
    },

    // A 5-second chunk is ready -> Transcribe with Whisper API -> Send to RealtimeAssistant
    onChunkReady: async (chunkBlob) => {
      try {
        const buffer = await chunkBlob.arrayBuffer();
        const res = await window.callAPI.transcribeChunk({
          audioBuffer: buffer,
          language: currentSettings.language
        });

        if (res && res.text) {
          if (emptyAnswersPlaceholder) emptyAnswersPlaceholder.style.display = 'none';
          realtimeAssistant.processSegment(res.text);
        }
      } catch (err) {
        console.warn('[Chunk Transcription Skip]:', err.message);
      }
    },

    // Conversation finished (silence detected or ended) -> Full call feedback
    onCallEnded: async (fullAudioBlob) => {
      callStatusBadge.textContent = 'Analyzing Call Feedback...';
      try {
        const buffer = await fullAudioBlob.arrayBuffer();
        const transcription = await window.callAPI.transcribeChunk({
          audioBuffer: buffer,
          language: currentSettings.language
        });

        if (transcription && transcription.text) {
          const feedback = await window.callAPI.generateFeedback({
            transcript: transcription.text
          });
          renderFeedback(feedback);
        }
      } catch (err) {
        console.error('Call feedback generation error:', err);
      }
      callStatusBadge.textContent = 'Feedback Ready';
    }
  });
}

// Toggle master listening
async function toggleListening() {
  if (!audioEngine.isListening) {
    try {
      await audioEngine.start();
      btnToggleListening.classList.add('listening');
      listeningBtnText.textContent = 'Stop Listening';
    } catch (err) {
      alert(`Could not start audio listener: ${err.message}`);
    }
  } else {
    audioEngine.stop();
    btnToggleListening.classList.remove('listening');
    listeningBtnText.textContent = 'Start Listening';
    vadMeter.style.width = '0%';
  }
}

btnToggleListening.addEventListener('click', toggleListening);

btnManualEnd.addEventListener('click', () => {
  if (audioEngine) {
    audioEngine.stopFullRecorder();
  }
});

// Window controls
function setupWindowControls() {
  btnMinimize.addEventListener('click', () => window.callAPI.minimizeWindow());
  btnClose.addEventListener('click', () => window.callAPI.closeWindow());

  btnPin.addEventListener('click', () => {
    isAlwaysOnTop = !isAlwaysOnTop;
    window.callAPI.setAlwaysOnTop(isAlwaysOnTop);
    btnPin.classList.toggle('active', isAlwaysOnTop);
  });

  btnClickThrough.addEventListener('click', () => {
    isClickThrough = !isClickThrough;
    window.callAPI.setClickThrough(isClickThrough);
  });

  window.callAPI.onClickThroughChanged((active) => {
    isClickThrough = active;
    btnClickThrough.classList.toggle('active', active);
  });

  opacitySlider.addEventListener('input', (e) => {
    const alpha = e.target.value / 100;
    appContainer.style.background = `rgba(14, 17, 27, ${alpha})`;
  });
}

// Tabs
function setupTabs() {
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      navButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });

  // Mode pills
  modePills.forEach(pill => {
    pill.addEventListener('click', async () => {
      modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentSettings.mode = pill.dataset.mode;
      await window.callAPI.saveSettings(currentSettings);
    });
  });
}

// Manual Ask ⚡ Box
function setupManualAsk() {
  const ask = () => {
    const q = manualAskInput.value.trim();
    if (!q) return;
    if (emptyAnswersPlaceholder) emptyAnswersPlaceholder.style.display = 'none';
    realtimeAssistant.enqueueQuestion(q);
    manualAskInput.value = '';
  };

  btnManualAsk.addEventListener('click', ask);
  manualAskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ask();
  });
}

// Save Settings
function setupSettingsHandlers() {
  btnSaveSettings.addEventListener('click', async () => {
    currentSettings.openaiApiKey = inputApiKey.value.trim();
    currentSettings.userContext = inputUserContext.value.trim();
    currentSettings.silenceTimeout = parseInt(inputSilenceTimeout.value) || 8;
    currentSettings.vadThreshold = parseFloat(inputVadThreshold.value) || 0.02;
    currentSettings.language = selectLanguage.value;

    const saved = await window.callAPI.saveSettings(currentSettings);
    if (saved) {
      btnSaveSettings.innerText = 'Saved! ✓';
      setTimeout(() => { btnSaveSettings.innerText = 'Save Settings'; }, 1500);
      setupAudioEngine();
    }
  });
}

// Render Feedback UI
function renderFeedback(data) {
  feedbackEmpty.style.display = 'none';
  feedbackContent.style.display = 'block';

  verdictTag.textContent = data.verdict || 'Call Evaluated';
  sentimentTag.textContent = `Sentiment: ${data.sentiment || 'Constructive'}`;
  feedbackSummary.textContent = data.summary || '';

  if (data.scores) {
    scoreOverall.textContent = data.scores.overall || '0.0';
    scoreClarity.textContent = data.scores.clarity || '0.0';
    scoreListening.textContent = data.scores.listening || '0.0';
    scoreQuestioning.textContent = data.scores.questioning || '0.0';
  }

  renderList(strengthsList, data.strengths);
  renderList(improvementsList, data.improvements);
  renderList(missedList, data.missedOpportunities);

  // Auto switch to feedback tab
  document.querySelector('.nav-btn[data-tab="feedback"]').click();
}

function renderList(element, items) {
  element.innerHTML = '';
  if (!items || items.length === 0) {
    element.innerHTML = '<li>None detected</li>';
    return;
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    element.appendChild(li);
  });
}

window.addEventListener('DOMContentLoaded', init);

