/**
 * AudioEngine
 * Captures System Audio (loopback) + Microphone, mixes them via Web Audio API,
 * runs Voice Activity Detection (VAD), and manages full-call & rolling-chunk MediaRecorders.
 */
class AudioEngine {
  constructor(options = {}) {
    this.vadThreshold = options.vadThreshold || 0.02;
    this.silenceTimeoutMs = (options.silenceTimeout || 8) * 1000;
    this.onStateChange = options.onStateChange || (() => {});
    this.onVADVolume = options.onVADVolume || (() => {});
    this.onChunkReady = options.onChunkReady || (() => {});
    this.onCallEnded = options.onCallEnded || (() => {});

    this.audioContext = null;
    this.micStream = null;
    this.systemStream = null;
    this.mixedDestination = null;
    this.analyser = null;

    // Full conversation recorder
    this.fullRecorder = null;
    this.fullChunks = [];

    // Rolling chunk recorder (for real-time questions)
    this.chunkRecorder = null;
    this.chunkInterval = null;

    // VAD State
    this.isListening = false;
    this.isSpeaking = false;
    this.speechStartTime = null;
    this.lastSpeechTime = null;
    this.silenceCheckTimer = null;
    this.animationFrame = null;
  }

  async start() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.mixedDestination = this.audioContext.createMediaStreamDestination();

    // 1. Microphone capture
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const micSource = this.audioContext.createMediaStreamSource(this.micStream);
      micSource.connect(this.mixedDestination);
      console.log('[AudioEngine] Microphone connected.');
    } catch (err) {
      console.warn('[AudioEngine] Microphone skipped or denied:', err);
    }

    // 2. System Audio (Screen/Tab Loopback) capture
    try {
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      const systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
      systemSource.connect(this.mixedDestination);
      console.log('[AudioEngine] System audio loopback connected.');
    } catch (err) {
      console.warn('[AudioEngine] System audio skipped (mic-only active):', err);
    }

    if (!this.micStream && !this.systemStream) {
      throw new Error('No audio input available.');
    }

    // Connect to Analyser for VAD & UI visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    const mixedSource = this.audioContext.createMediaStreamSource(this.mixedDestination.stream);
    mixedSource.connect(this.analyser);

    this.isListening = true;
    this.onStateChange('listening');
    this.startVADLoop();
    this.startChunkRecorder();
  }

  startVADLoop() {
    const pcmData = new Float32Array(this.analyser.fftSize);

    const checkVolume = () => {
      if (!this.isListening) return;

      this.analyser.getFloatTimeDomainData(pcmData);
      let sum = 0;
      for (let i = 0; i < pcmData.length; i++) {
        sum += pcmData[i] * pcmData[i];
      }
      const rms = Math.sqrt(sum / pcmData.length);
      this.onVADVolume(rms);

      const now = Date.now();

      if (rms > this.vadThreshold) {
        this.lastSpeechTime = now;

        if (!this.isSpeaking) {
          if (!this.speechStartTime) {
            this.speechStartTime = now;
          } else if (now - this.speechStartTime >= 600) {
            // Speech detected for 600ms = CONVERSATION START
            this.isSpeaking = true;
            this.onStateChange('in_conversation');
            this.startFullRecorder();
          }
        }
      } else {
        this.speechStartTime = null;

        // If in conversation and silence exceeds timeout = CONVERSATION END
        if (this.isSpeaking && this.lastSpeechTime && (now - this.lastSpeechTime >= this.silenceTimeoutMs)) {
          this.isSpeaking = false;
          this.onStateChange('conversation_ended');
          this.stopFullRecorder();
        }
      }

      this.animationFrame = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  // Full conversation recorder
  startFullRecorder() {
    if (this.fullRecorder && this.fullRecorder.state === 'recording') return;
    this.fullChunks = [];
    this.fullRecorder = new MediaRecorder(this.mixedDestination.stream, { mimeType: 'audio/webm' });
    this.fullRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.fullChunks.push(e.data);
    };
    this.fullRecorder.onstop = () => {
      const blob = new Blob(this.fullChunks, { type: 'audio/webm' });
      this.onCallEnded(blob);
    };
    this.fullRecorder.start(1000);
  }

  stopFullRecorder() {
    if (this.fullRecorder && this.fullRecorder.state === 'recording') {
      this.fullRecorder.stop();
    }
  }

  // Rolling 5-second chunk recorder for Real-time Q&A
  startChunkRecorder() {
    if (!this.mixedDestination) return;

    const recordNextChunk = () => {
      if (!this.isListening) return;

      let chunkParts = [];
      this.chunkRecorder = new MediaRecorder(this.mixedDestination.stream, { mimeType: 'audio/webm' });
      
      this.chunkRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunkParts.push(e.data);
      };

      this.chunkRecorder.onstop = () => {
        if (chunkParts.length > 0) {
          const chunkBlob = new Blob(chunkParts, { type: 'audio/webm' });
          this.onChunkReady(chunkBlob);
        }
        if (this.isListening) recordNextChunk();
      };

      this.chunkRecorder.start();

      // Flush chunk every 5 seconds
      setTimeout(() => {
        if (this.chunkRecorder && this.chunkRecorder.state === 'recording') {
          this.chunkRecorder.stop();
        }
      }, 5000);
    };

    recordNextChunk();
  }

  stop() {
    this.isListening = false;
    this.isSpeaking = false;

    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.chunkRecorder && this.chunkRecorder.state === 'recording') this.chunkRecorder.stop();
    if (this.fullRecorder && this.fullRecorder.state === 'recording') this.fullRecorder.stop();

    if (this.micStream) this.micStream.getTracks().forEach(t => t.stop());
    if (this.systemStream) this.systemStream.getTracks().forEach(t => t.stop());

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.onStateChange('idle');
  }
}

window.AudioEngine = AudioEngine;

