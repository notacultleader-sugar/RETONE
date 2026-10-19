// Instructions the AI gets for each tone.
// free: true tones work for everyone; the rest need the Pro unlock.
// Keep ids in sync with app/tones.js

module.exports = {
  calmer: {
    free: true,
    prompt: 'Rewrite it to sound calm and level-headed. Remove anger, blame and harsh words, but keep the actual point.',
  },
  professional: {
    free: true,
    prompt: 'Rewrite it to sound polished and professional, like a message to a boss, client or coworker.',
  },
  kinder: {
    free: false,
    prompt: 'Rewrite it to sound warm, caring and kind, without being fake or over the top.',
  },
  firmer: {
    free: false,
    prompt: 'Rewrite it to sound firm and clear, setting a boundary respectfully. No apologising for the point itself.',
  },
  apologetic: {
    free: false,
    prompt: 'Rewrite it as a sincere apology that takes responsibility without grovelling.',
  },
  funnier: {
    free: false,
    prompt: 'Rewrite it to be funny and lighthearted while still getting the point across.',
  },
  confident: {
    free: false,
    prompt: 'Rewrite it to sound confident and self-assured. Remove hedging like "sorry", "just", "maybe".',
  },
  shorter: {
    free: false,
    prompt: 'Rewrite it as short as possible while keeping the meaning. Text-message length.',
  },
  flirty: {
    free: false,
    prompt: 'Rewrite it to be playful and flirty, like texting someone you have a crush on. Keep it charming, not crude.',
  },
  spicy: {
    free: false,
    prompt: 'Rewrite it to be suggestive and steamy for a romantic partner, using innuendo and teasing. Keep it tasteful: no explicit sexual descriptions.',
  },
  angrier: {
    free: false,
    prompt: 'Rewrite it to sound noticeably more frustrated and fired up, so the reader knows the sender is upset. No slurs, threats or personal attacks on appearance or identity.',
  },
  passive: {
    free: false,
    prompt: 'Rewrite it in an over-the-top passive-aggressive tone, sweet on the surface with obvious shade underneath. Play it for laughs.',
  },
  pirate: {
    free: false,
    prompt: 'Rewrite it in the voice of a pirate. Keep the meaning clear.',
  },
};
