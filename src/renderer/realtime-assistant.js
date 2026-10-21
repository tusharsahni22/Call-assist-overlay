/**
 * RealtimeAssistant
 * Handles rolling transcript updates, interrogative question detection,
 * queueing, and UI rendering of streaming ChatGPT answers.
 */
class RealtimeAssistant {
  constructor(options = {}) {
    this.container = options.container;
    this.liveTranscriptContainer = options.liveTranscriptContainer;
    this.statusBadge = options.statusBadge;
    this.onAnswerStart = options.onAnswerStart || (() => {});
    
    this.lastAnsweredQuestion = '';
    this.questionQueue = [];
    this.isAnswering = false;

    // Listen to IPC stream events
    window.callAPI.onRealtimeToken((token) => this.handleToken(token));
    window.callAPI.onRealtimeDone(() => this.handleDone());
    window.callAPI.onRealtimeError((err) => this.handleError(err));
  }

  /**
   * Process a new transcript segment from Whisper chunk
   */
  processSegment(text) {
    if (!text || !text.trim()) return;

    // Append to live transcript feed
    this.appendLiveTranscript(text);

    // Question Detection: checks for '?' or interrogative phrasing
    if (this.isQuestion(text)) {
      const cleaned = text.trim();
      if (cleaned !== this.lastAnsweredQuestion) {
        console.log('[Question Detected]:', cleaned);
        this.enqueueQuestion(cleaned);
      }
    }
  }

  isQuestion(text) {
    const t = text.trim();
    if (t.includes('?')) return true;

    const lower = t.toLowerCase();
    const interrogatives = [
      'what', 'how', 'why', 'when', 'where', 'who', 'which',
      'can you explain', 'tell me about', 'walk me through',
      'could you describe', 'what are your', 'how do you handle'
    ];

    return interrogatives.some(prefix => lower.startsWith(prefix));
  }

  enqueueQuestion(question) {
    this.questionQueue.push(question);
    if (!this.isAnswering) {
      this.processNextQuestion();
    }
  }

  processNextQuestion() {
    if (this.questionQueue.length === 0) {
      this.isAnswering = false;
      return;
    }

    const question = this.questionQueue.shift();
    this.lastAnsweredQuestion = question;
    this.isAnswering = true;

    // Create a new Answer Card in UI
    this.currentCard = this.createAnswerCard(question);

    window.callAPI.requestRealtimeAnswer({
      question: question
    });
  }

  createAnswerCard(question) {
    const card = document.createElement('div');
    card.className = 'answer-card streaming';
    card.innerHTML = `
      <div class="answer-card-header">
        <span class="detected-q">⚡ "${escapeHtml(question)}"</span>
        <span class="q-badge">Streaming Answer...</span>
      </div>
      <div class="answer-card-body markdown-content"></div>
    `;

    this.container.prepend(card);
    return card;
  }

  handleToken(token) {
    if (!this.currentCard) return;
    const body = this.currentCard.querySelector('.answer-card-body');
    if (body) {
      body.innerText += token;
      this.container.scrollTop = 0;
    }
  }

  handleDone() {
    if (this.currentCard) {
      this.currentCard.classList.remove('streaming');
      const badge = this.currentCard.querySelector('.q-badge');
      if (badge) badge.innerText = "Answer Ready";
    }
    this.isAnswering = false;
    // Process next queued question if any
    this.processNextQuestion();
  }

  handleError(errMsg) {
    if (this.currentCard) {
      this.currentCard.classList.remove('streaming');
      const body = this.currentCard.querySelector('.answer-card-body');
      if (body) body.innerText += `\n[Error: ${errMsg}]`;
    }
    this.isAnswering = false;
    this.processNextQuestion();
  }

  appendLiveTranscript(text) {
    if (!this.liveTranscriptContainer) return;
    const p = document.createElement('div');
    p.className = 'transcript-line';
    p.innerText = text;
    this.liveTranscriptContainer.appendChild(p);
    this.liveTranscriptContainer.scrollTop = this.liveTranscriptContainer.scrollHeight;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.RealtimeAssistant = RealtimeAssistant;

