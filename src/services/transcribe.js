const { OpenAI, toFile } = require('openai');
const fs = require('fs');

/**
 * Transcribes audio buffer via OpenAI Whisper API
 * @param {Buffer} audioBuffer - WebM or WAV audio buffer
 * @param {string} apiKey - User OpenAI API key
 * @param {string} language - ISO language code (e.g., 'en', 'hi', or null for auto)
 */
async function transcribeAudio(audioBuffer, apiKey, language = 'en') {
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please set your key in Settings.');
  }

  const openai = new OpenAI({ apiKey });
  const file = await toFile(audioBuffer, 'recording.webm', { type: 'audio/webm' });

  const params = {
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    temperature: 0.2
  };

  if (language && language !== 'auto') {
    params.language = language;
  }

  const response = await openai.audio.transcriptions.create(params);
  return {
    text: response.text,
    segments: response.segments || []
  };
}

module.exports = {
  transcribeAudio
};

