// Every tone button in the app.
// free: true  -> anyone can use it
// free: false -> needs the Pro unlock (paywall)
// confirm     -> asks "you sure?" before copying
// word        -> fills the headline: "Say it ___."
// a, b        -> the tone's two colours (screen glow, tile, bubble)
//
// Keep the `id` values in sync with backend/netlify/functions/tones.js

export const TONES = [
  { id: 'calmer',       label: 'Calmer',        word: 'calmer',   emoji: '🧊', free: true, a: '#3fc8ff', b: '#6f6bff' },
  { id: 'professional', label: 'Professional',  word: 'pro',      emoji: '💼', free: true, a: '#9fb4d9', b: '#4d6bff' },

  { id: 'kinder',       label: 'Kinder',        word: 'kinder',   emoji: '💛', free: false, a: '#ffd84d', b: '#ff9f43' },
  { id: 'firmer',       label: 'Firmer',        word: 'firmer',   emoji: '🪨', free: false, a: '#c9c3b6', b: '#7d7aa8' },
  { id: 'apologetic',   label: 'Apologetic',    word: 'sorry',    emoji: '🙏', free: false, a: '#b8a4ff', b: '#7fd1ff' },
  { id: 'funnier',      label: 'Funnier',       word: 'funnier',  emoji: '😂', free: false, a: '#b6ff4d', b: '#25d9c5' },
  { id: 'confident',    label: 'Confident',     word: 'bolder',   emoji: '😎', free: false, a: '#ffb347', b: '#ff4d8b' },
  { id: 'shorter',      label: 'Shorter',       word: 'shorter',  emoji: '✂️', free: false, a: '#e8e8f0', b: '#8f8fa8' },
  { id: 'flirty',       label: 'Flirty',        word: 'flirtier', emoji: '😏', free: false, a: '#ff7ac6', b: '#b56bff' },
  { id: 'spicy',        label: 'Spicy',         word: 'spicier',  emoji: '🌶️', free: false, a: '#ff3d6e', b: '#a3195b' },
  { id: 'angrier',      label: 'Fired Up',      word: 'louder',   emoji: '🔥', free: false, a: '#ff5a1f', b: '#ff1f3d', confirm: true },
  { id: 'passive',      label: 'Passive-Aggro', word: 'sweeter',  emoji: '🙂', free: false, a: '#ffe066', b: '#ff6b9d' },
  { id: 'pirate',       label: 'Pirate',        word: 'pirate',   emoji: '🏴‍☠️', free: false, a: '#2bd4a8', b: '#1b6f8f' },
];
