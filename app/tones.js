// Every tone button in the app.
// free: true  -> anyone can use it
// free: false -> needs the Pro unlock (paywall)
// confirm     -> asks "you sure?" before copying
//
// Keep the `id` values in sync with backend/netlify/functions/tones.js

export const TONES = [
  { id: 'calmer',       label: 'Calmer',        emoji: '🧊', free: true },
  { id: 'professional', label: 'Professional',  emoji: '💼', free: true },

  { id: 'kinder',       label: 'Kinder',        emoji: '💛', free: false },
  { id: 'firmer',       label: 'Firmer',        emoji: '🪨', free: false },
  { id: 'apologetic',   label: 'Apologetic',    emoji: '🙏', free: false },
  { id: 'funnier',      label: 'Funnier',       emoji: '😂', free: false },
  { id: 'confident',    label: 'Confident',     emoji: '😎', free: false },
  { id: 'shorter',      label: 'Shorter',       emoji: '✂️', free: false },
  { id: 'flirty',       label: 'Flirty',        emoji: '😏', free: false },
  { id: 'spicy',        label: 'Spicy',         emoji: '🌶️', free: false },
  { id: 'angrier',      label: 'Fired Up',      emoji: '🔥', free: false, confirm: true },
  { id: 'passive',      label: 'Passive-Aggro', emoji: '🙂', free: false },
  { id: 'pirate',       label: 'Pirate',        emoji: '🏴‍☠️', free: false },
];
