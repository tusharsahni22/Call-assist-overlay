const { OpenAI } = require('openai');

const MODE_PROMPTS = {
  interview: `You are answering in first-person AS THE CANDIDATE on a live job interview call.
Strict Rule: Ground your answers in the user's provided context/resume. Never invent employers, years, or projects outside it.
Output format:
**Say this:** 2-4 lines of speakable, natural, professional dialogue that the user can read directly.
**Key points:**
- bullet points for key arguments
**If they dig deeper:**
- extra depth, metrics, or technical nuances.`,

  coding: `You are assisting the candidate in a technical/coding interview.
Output format:
**Say this:** Clear spoken approach to explain to the interviewer before coding.
**Key points:**
- Algorithm approach & Big-O time/space complexity
**Code sketch:**
\`\`\`
compact, clean logic
\`\`\`
**Edge cases:**
- potential pitfalls to mention aloud.`,

  meeting: `You are assisting an attendee on a business/project meeting.
Output format:
**Say this:** Immediate, constructive response to address what was asked or said.
**Follow-up question:** Suggested question to ask next to steer the conversation positively.
**Key points:**
- brief rationale or action items.`,

  sales: `You are assisting a sales or client-facing representative on a live customer call.
Output format:
**Say this:** Empathetic, value-oriented response handling objections or answering client questions.
**Next step CTA:** A low-friction closing question to advance the deal.
**Key points:**
- Value proposition and proof points to support your claim.`,

  general: `You are a real-time smart communication assistant.
Output format:
**Say this:** 2-3 lines of direct, polite, articulate spoken answer.
**Key points:**
- 2-3 supporting takeaways.`
};

/**
 * Streams real-time answer tokens from ChatGPT
 */
async function streamRealtimeAnswer({ question, context, mode, apiKey, onToken, onDone, onError }) {
  if (!apiKey) {
    onError(new Error('OpenAI API Key is missing.'));
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const systemPrompt = (MODE_PROMPTS[mode] || MODE_PROMPTS.general) + 
      (context ? `\n\nUSER'S BACKGROUND & CONTEXT (Grounded data):\n${context}` : '');

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `The other person on the call asked/said: "${question}"\n\nGenerate my immediate answer now.` }
      ],
      temperature: 0.3,
      stream: true
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        onToken(token);
      }
    }

    onDone();
  } catch (err) {
    onError(err);
  }
}

module.exports = {
  streamRealtimeAnswer,
  MODE_PROMPTS
};

