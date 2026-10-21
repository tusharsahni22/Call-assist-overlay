// DOM Elements
const appContainer = document.getElementById('appContainer');
const scrollContainer = document.getElementById('scrollContainer');
const btnMinimize = document.getElementById('btnMinimize');
const btnClose = document.getElementById('btnClose');
const btnPin = document.getElementById('btnPin');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnSlower = document.getElementById('btnSlower');
const btnFaster = document.getElementById('btnFaster');
const btnResetScroll = document.getElementById('btnResetScroll');
const speedDisplay = document.getElementById('speedDisplay');
const opacitySlider = document.getElementById('opacitySlider');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const btnClickThrough = document.getElementById('btnClickThrough');
const btnStealthToggle = document.getElementById('btnStealthToggle');
const liveNotesArea = document.getElementById('liveNotesArea');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Audio / Transcription Elements
const btnToggleTranscribe = document.getElementById('btnToggleTranscribe');
const transcribeBtnText = document.getElementById('transcribeBtnText');
const chipMicSource = document.getElementById('chipMicSource');
const chipSystemSource = document.getElementById('chipSystemSource');
const waveform = document.getElementById('waveform');
const audioStatusText = document.getElementById('audioStatusText');
const transcriptLog = document.getElementById('transcriptLog');
const transcriptPlaceholder = document.getElementById('transcriptPlaceholder');
const interimSpeechBubble = document.getElementById('interimSpeechBubble');
const interimText = document.getElementById('interimText');
const btnClearTranscript = document.getElementById('btnClearTranscript');
const btnCopyTranscript = document.getElementById('btnCopyTranscript');

// State
let isAlwaysOnTop = true;
let isScrolling = false;
let scrollSpeed = 1.0;
let scrollInterval = null;
let isClickThrough = false;
let isStealthActive = true;

let isListening = false;
let audioSourceMode = 'mic'; // 'mic' or 'system'
let speechRecognition = null;
let audioStream = null;
let audioContext = null;
let analyser = null;
let visualizerAnimation = null;

// ============================================
// WINDOW CONTROLS & SHORTCUTS
// ============================================
btnMinimize.addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

btnClose.addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

btnPin.addEventListener('click', () => {
  isAlwaysOnTop = !isAlwaysOnTop;
  window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
  btnPin.classList.toggle('active', isAlwaysOnTop);
});

// Auto-Scroll Prompter Logic
function toggleAutoScroll() {
  isScrolling = !isScrolling;
  if (isScrolling) {
    btnPlayPause.classList.add('primary');
    btnPlayPause.innerHTML = '<span class="icon">⏸</span><span class="btn-text">Pause Scroll</span>';
    startScrolling();
  } else {
    btnPlayPause.innerHTML = '<span class="icon">▶</span><span class="btn-text">Auto-Scroll</span>';
    stopScrolling();
  }
}

function startScrolling() {
  if (scrollInterval) clearInterval(scrollInterval);
  const stepInterval = 40;
  scrollInterval = setInterval(() => {
    const step = 1.0 * scrollSpeed;
    scrollContainer.scrollTop += step;

    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 5) {
      stopScrolling();
      isScrolling = false;
      btnPlayPause.innerHTML = '<span class="icon">▶</span><span class="btn-text">Restart</span>';
    }
  }, stepInterval);
}

function stopScrolling() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

btnPlayPause.addEventListener('click', toggleAutoScroll);

btnFaster.addEventListener('click', () => {
  if (scrollSpeed < 5.0) {
    scrollSpeed = Math.round((scrollSpeed + 0.2) * 10) / 10;
    updateSpeedBadge();
  }
});

btnSlower.addEventListener('click', () => {
  if (scrollSpeed > 0.4) {
    scrollSpeed = Math.round((scrollSpeed - 0.2) * 10) / 10;
    updateSpeedBadge();
  }
});

btnResetScroll.addEventListener('click', () => {
  scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
});

function updateSpeedBadge() {
  speedDisplay.textContent = `${scrollSpeed.toFixed(1)}x`;
}

// Opacity & Font Sizing
opacitySlider.addEventListener('input', (e) => {
  const alpha = e.target.value / 100;
  appContainer.style.background = `rgba(14, 17, 27, ${alpha})`;
});

fontSizeSlider.addEventListener('input', (e) => {
  const size = e.target.value;
  document.documentElement.style.setProperty('--body-font-size', `${size}px`);
});

// Tab Switcher
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    const content = document.getElementById(`tab-${targetTab}`);
    if (content) content.classList.add('active');
  });
});

// Click-through / Transparent mouse mode
btnClickThrough.addEventListener('click', () => {
  isClickThrough = !isClickThrough;
  window.electronAPI.setClickThrough(isClickThrough);
});

window.electronAPI.onClickThroughChanged((active) => {
  isClickThrough = active;
  btnClickThrough.classList.toggle('active', active);
});

// Screen-Share Stealth Shield Toggle
btnStealthToggle.addEventListener('click', () => {
  isStealthActive = !isStealthActive;
  window.electronAPI.setContentProtection(isStealthActive);
  btnStealthToggle.classList.toggle('active', isStealthActive);
  const ind = document.querySelector('.stealth-indicator');
  if (ind) {
    ind.style.display = isStealthActive ? 'flex' : 'none';
  }
});

// Live Notes Persistence
const STORAGE_KEY = 'call_assist_live_notes';
if (liveNotesArea) {
  liveNotesArea.value = localStorage.getItem(STORAGE_KEY) || '';
  liveNotesArea.addEventListener('input', () => {
    localStorage.setItem(STORAGE_KEY, liveNotesArea.value);
  });
}

// ============================================
// REAL-TIME AUDIO & SPEECH TRANSCRIPTION ENGINE
// ============================================

// Toggle source chips
chipMicSource.addEventListener('click', () => {
  if (audioSourceMode === 'mic') return;
  audioSourceMode = 'mic';
  chipMicSource.classList.add('active');
  chipSystemSource.classList.remove('active');
  if (isListening) restartListening();
});

chipSystemSource.addEventListener('click', () => {
  if (audioSourceMode === 'system') return;
  audioSourceMode = 'system';
  chipSystemSource.classList.add('active');
  chipMicSource.classList.remove('active');
  if (isListening) restartListening();
});

btnToggleTranscribe.addEventListener('click', () => {
  if (!isListening) {
    startListening();
  } else {
    stopListening();
  }
});

async function startListening() {
  try {
    audioStatusText.textContent = "Connecting audio feed...";

    if (audioSourceMode === 'system') {
      // CAPTURE SYSTEM / MEETING AUDIO LOOPBACK (Teams, Zoom, Meet, Chrome)
      audioStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required by Chromium display media protocol
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      audioStatusText.textContent = "Meeting Loopback Active";
    } else {
      // CAPTURE LOCAL MICROPHONE
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      audioStatusText.textContent = "Microphone Active";
    }

    // Set up audio analyser for live audio activity visualization
    setupAudioVisualizer(audioStream);

    // Initialize Web Speech Recognition
    setupSpeechRecognition();

    isListening = true;
    btnToggleTranscribe.classList.remove('start');
    btnToggleTranscribe.classList.add('listening');
    transcribeBtnText.textContent = "Stop Listening";
    waveform.classList.add('active');
    if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';

  } catch (err) {
    console.error("Audio capture failed:", err);
    audioStatusText.textContent = "Audio permission/selection cancelled";
    stopListening();
  }
}

function stopListening() {
  isListening = false;
  btnToggleTranscribe.classList.remove('listening');
  btnToggleTranscribe.classList.add('start');
  transcribeBtnText.textContent = "Start Listening";
  waveform.classList.remove('active');
  audioStatusText.textContent = "Idle - Click Start Listening";

  if (speechRecognition) {
    try { speechRecognition.stop(); } catch (e) {}
    speechRecognition = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }

  if (visualizerAnimation) {
    cancelAnimationFrame(visualizerAnimation);
    visualizerAnimation = null;
  }

  interimSpeechBubble.style.display = 'none';
}

function restartListening() {
  stopListening();
  setTimeout(() => startListening(), 250);
}

// Audio visualizer setup
function setupAudioVisualizer(stream) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = waveform.querySelectorAll('.bar');

    function renderBars() {
      if (!isListening) return;
      analyser.getByteFrequencyData(dataArray);

      bars.forEach((bar, index) => {
        const val = dataArray[index] || 0;
        const height = Math.max(4, (val / 255) * 18);
        bar.style.height = `${height}px`;
      });

      visualizerAnimation = requestAnimationFrame(renderBars);
    }
    renderBars();
  } catch (e) {
    console.warn("Visualizer fallback:", e);
  }
}

// Browser / Chromium Speech Recognition
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    audioStatusText.textContent = "Speech API not available in this build";
    appendTranscriptEntry("System", "WebSpeech recognition is initializing. Streaming audio feed active.");
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onstart = () => {
    audioStatusText.textContent = audioSourceMode === 'system' ? "Listening to Meeting Audio..." : "Listening to Microphone...";
  };

  speechRecognition.onresult = (event) => {
    let finalTranscript = '';
    let currentInterim = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        currentInterim += transcript;
      }
    }

    if (currentInterim.trim().length > 0) {
      interimSpeechBubble.style.display = 'flex';
      interimText.textContent = currentInterim;
    } else {
      interimSpeechBubble.style.display = 'none';
    }

    if (finalTranscript.trim().length > 0) {
      interimSpeechBubble.style.display = 'none';
      const speaker = audioSourceMode === 'system' ? "Other Caller / Meeting" : "You (Mic)";
      appendTranscriptEntry(speaker, finalTranscript.trim());
    }
  };

  speechRecognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    if (event.error === 'not-allowed') {
      audioStatusText.textContent = "Microphone access denied";
    }
  };

  speechRecognition.onend = () => {
    // Automatically restart if user hasn't explicitly stopped it
    if (isListening && speechRecognition) {
      try {
        speechRecognition.start();
      } catch (err) {
        console.warn("SpeechRecognition restart attempt:", err);
      }
    }
  };

  try {
    speechRecognition.start();
  } catch (err) {
    console.error("Could not start speech recognition:", err);
  }
}

// Append entry to live log
function appendTranscriptEntry(speaker, text) {
  if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';

  const entry = document.createElement('div');
  const isCaller = speaker.includes("Other") || speaker.includes("Meeting");
  entry.className = `transcript-entry ${isCaller ? 'caller' : ''}`;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  entry.innerHTML = `
    <div class="entry-meta">
      <span class="entry-speaker">${speaker}</span>
      <span class="entry-time">${time}</span>
    </div>
    <div class="entry-text">${escapeHtml(text)}</div>
  `;

  transcriptLog.appendChild(entry);
  transcriptLog.scrollTop = transcriptLog.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Clear & Copy Transcript
btnClearTranscript.addEventListener('click', () => {
  transcriptLog.innerHTML = `
    <div class="transcript-placeholder" id="transcriptPlaceholder">
      <p>Transcript cleared.</p>
    </div>
  `;
});

btnCopyTranscript.addEventListener('click', () => {
  const entries = transcriptLog.querySelectorAll('.transcript-entry');
  if (entries.length === 0) return;

  let fullText = '';
  entries.forEach(e => {
    const speaker = e.querySelector('.entry-speaker')?.innerText || '';
    const time = e.querySelector('.entry-time')?.innerText || '';
    const body = e.querySelector('.entry-text')?.innerText || '';
    fullText += `[${time}] ${speaker}: ${body}\n`;
  });

  navigator.clipboard.writeText(fullText);
  btnCopyTranscript.innerText = "Copied! ✓";
  setTimeout(() => { btnCopyTranscript.innerText = "📋 Copy All"; }, 1500);
});

// Snippet copy
window.copySnippet = function(element) {
  const text = element.querySelector('.snippet-body').innerText.replace(/^"|"$/g, '');
  navigator.clipboard.writeText(text);
  const badge = element.querySelector('.copy-badge');
  const original = badge.innerText;
  badge.innerText = 'Copied! ✓';
  badge.style.color = '#34d399';
  setTimeout(() => {
    badge.innerText = original;
    badge.style.color = '';
  }, 1500);
};

// Global Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    toggleAutoScroll();
  }
});
