// Netlify function: POST { message, tone, userId } -> { text, left: { today, credits } }
//                   POST { status: true, userId }   -> { left: { today, credits }, pro }
//
// Environment variables (set in Netlify > Site settings > Environment variables):
//   GEMINI_API_KEY        - key from https://aistudio.google.com (turn on billing before launch)
//   GEMINI_MODEL          - optional, defaults to gemini-3.1-flash-lite (cheapest)
//   REVENUECAT_SECRET_KEY - secret API key from RevenueCat (starts with sk_)
//   PRO_ENTITLEMENT       - optional, defaults to "pro"
//   FREE_DAILY_LIMIT / PRO_DAILY_LIMIT - optional, default 5 and 50 rewrites a day

const { connectLambda } = require('@netlify/blobs');
const TONES = require('./tones');
const { allowance, spend, FREE_DAILY, PRO_DAILY } = require('./limits');

const MAX_CHARS = 1000;

const SYSTEM = [
  'You rewrite text messages in a requested tone.',
  'Keep the original meaning, facts and intent. Do not add new information or promises.',
  'Write it as the sender, in first person, ready to paste into a text.',
  'Match the casualness of a text message unless the tone says otherwise.',
  'Return ONLY the rewritten message. No quotes, no explanations, no options.',
  'If the message asks for something harmful (threats, harassment, illegal acts), reply exactly: Sorry, I can\'t rewrite that one.',
].join(' ');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

async function getSubscriber(userId) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key || !userId) return null;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.subscriber || null;
}

// Monthly, yearly and lifetime all unlock the same entitlement.
function hasPro(subscriber) {
  const entitlement = process.env.PRO_ENTITLEMENT || 'pro';
  const ent = subscriber?.entitlements?.[entitlement];
  if (!ent) return false;
  // expires_date null = lifetime purchase
  return ent.expires_date === null || new Date(ent.expires_date) > new Date();
}

async function rewrite(message, tonePrompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{
        role: 'user',
        parts: [{ text: `Tone: ${tonePrompt}\n\nMessage:\n${message}` }],
      }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Gemini error', res.status, JSON.stringify(data));
    if (res.status === 429) throw Object.assign(new Error('Busy right now, try again in a minute.'), { status: 429 });
    throw new Error('The AI had a hiccup. Try again.');
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
  if (!text) throw new Error('No rewrite came back. Try rewording your message.');
  return text;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return reply(204, {});
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Bad request' }); }

  connectLambda(event);
  const userId = body.userId ? String(body.userId) : null;
  const ip = event.headers['x-nf-client-connection-ip'] || String(event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const subscriber = await getSubscriber(userId).catch(() => null);
  const isPro = hasPro(subscriber);
  const who = { userId, ip, isPro, subscriber };

  if (body.status) {
    const a = await allowance(who);
    return reply(200, { pro: isPro, left: { today: a.today, credits: a.credits } });
  }

  const message = String(body.message || '').trim();
  const tone = TONES[body.tone];

  if (!message) return reply(400, { error: 'Type a message first.' });
  if (message.length > MAX_CHARS) return reply(400, { error: `Keep it under ${MAX_CHARS} characters.` });
  if (!tone) return reply(400, { error: 'Unknown tone.' });

  // Paywall enforced here too, so nobody can unlock tones by poking the API.
  if (!tone.free && !isPro) return reply(402, { error: 'That tone is part of Pro.' });

  const a = await allowance(who);
  if (a.today <= 0 && a.credits <= 0) {
    return reply(429, {
      code: 'limit',
      pro: isPro,
      left: { today: 0, credits: 0 },
      error: isPro
        ? `You've used today's ${PRO_DAILY} rewrites. Top up, or they refresh tomorrow.`
        : `You've used today's ${FREE_DAILY} free rewrites. Go Pro for ${PRO_DAILY} a day.`,
    });
  }

  try {
    const text = await rewrite(message, tone.prompt);
    const left = await spend(a, who);
    return reply(200, { text, left });
  } catch (e) {
    return reply(e.status || 500, { error: e.message });
  }
};
