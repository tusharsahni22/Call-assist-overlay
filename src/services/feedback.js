const { OpenAI } = require('openai');

/**
 * Generates structured post-call JSON feedback
 */
async function generateCallFeedback(transcript, apiKey, context = '') {
  if (!apiKey) {
    return generateHeuristicFeedback(transcript);
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an elite executive communication coach and interview analyst.
Analyze the following call transcript and generate comprehensive, structured feedback in strict JSON format.

JSON Schema required:
{
  "summary": "Executive summary of the call (2-3 sentences)",
  "verdict": "Clear outcome summary (e.g., 'Strong Hire Candidate', 'Productive Client Discovery')",
  "scores": {
    "clarity": 8.5,
    "listening": 9.0,
    "questioning": 7.5,
    "engagement": 8.0,
    "overall": 8.2
  },
  "questionsAsked": [
    { "question": "Question text", "quality": "High/Medium/Low", "notes": "Why it was effective or could be improved" }
  ],
  "sentiment": "Positive/Neutral/Hesitant/Constructive",
  "strengths": ["Key strength 1", "Key strength 2", "Key strength 3"],
  "improvements": ["Actionable improvement 1", "Actionable improvement 2"],
  "missedOpportunities": ["Topic or follow-up that could have been explored deeper"],
  "actionItems": ["Follow-up task 1", "Follow-up task 2"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CALL CONTEXT:\n${context || 'General Call'}\n\nTRANSCRIPT:\n${transcript}` }
    ],
    temperature: 0.2
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    throw new Error('Failed to parse structured feedback JSON from OpenAI.');
  }
}

/**
 * Fallback feedback when no OpenAI key is set yet
 */
function generateHeuristicFeedback(transcript) {
  const words = transcript.split(/\s+/).filter(Boolean);
  const questions = (transcript.match(/\?/g) || []).length;
  
  return {
    summary: "Call recorded successfully. (Preview mode - add OpenAI API Key in Settings for in-depth AI coaching).",
    verdict: "Active Conversation Recorded",
    scores: {
      clarity: 7.5,
      listening: 8.0,
      questioning: Math.min(10, 5 + questions),
      engagement: 7.5,
      overall: 7.8
    },
    questionsAsked: [
      { question: "Total questions detected in conversation", quality: "Good", notes: `${questions} question marks found in dialogue.` }
    ],
    sentiment: "Constructive",
    strengths: [
      `Delivered a total of ${words.length} spoken words across the dialogue.`,
      "Maintained regular communication cadence."
    ],
    improvements: [
      "Add your OpenAI API Key under Settings to unlock GPT-4o-mini feedback and sentiment diagnostics."
    ],
    missedOpportunities: [
      "Full AI analysis available with an API key."
    ],
    actionItems: [
      "Review transcript history and export notes."
    ]
  };
}

module.exports = {
  generateCallFeedback,
  generateHeuristicFeedback
};

