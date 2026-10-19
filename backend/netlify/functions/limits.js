// Daily rewrite limits and top-up credits, saved in Netlify Blobs (built into Netlify, no setup).
//
// Everyone gets a fresh daily allowance at midnight UTC: free users 5, Pro users 50.
// When that runs out, rewrites come out of credits the user bought (they never expire).

const { getStore } = require('@netlify/blobs');

const FREE_DAILY = Number(process.env.FREE_DAILY_LIMIT || 5);
const PRO_DAILY = Number(process.env.PRO_DAILY_LIMIT || 50);
// Backstop so free users can't get unlimited rewrites by reinstalling the app.
const FREE_PER_IP_DAILY = Number(process.env.FREE_PER_IP_DAILY_LIMIT || 30);

// Store product id -> rewrites it adds. These ids must match the products
// you create in App Store Connect, Google Play and RevenueCat.
const CREDIT_PACKS = {
  saytwice_credits_50: 50,
  saytwice_credits_150: 150,
  saytwice_credits_500: 500,
};

const store = () => getStore({ name: 'saytwice-usage', consistency: 'strong' });
const today = () => new Date().toISOString().slice(0, 10);

async function readJSON(key, fallback) {
  return (await store().get(key, { type: 'json' })) || fallback;
}

// Add any credit packs bought since we last looked. Each store transaction is
// only ever counted once, so this is safe to run on every request.
async function syncCredits(userId, subscriber) {
  const key = `credits/${userId}`;
  const wallet = await readJSON(key, { balance: 0, seen: [] });
  let changed = false;
  const bought = subscriber?.non_subscriptions || {};
  for (const [productId, amount] of Object.entries(CREDIT_PACKS)) {
    for (const tx of bought[productId] || []) {
      if (!wallet.seen.includes(tx.id)) {
        wallet.seen.push(tx.id);
        wallet.balance += amount;
        changed = true;
      }
    }
  }
  if (changed) await store().setJSON(key, wallet);
  return wallet;
}

async function allowance({ userId, ip, isPro, subscriber }) {
  const who = userId || `ip/${ip}`;
  const day = today();
  const [used, ipUsed, wallet] = await Promise.all([
    readJSON(`day/${day}/${who}`, 0),
    isPro ? 0 : readJSON(`day/${day}/ip/${ip}`, 0),
    userId ? syncCredits(userId, subscriber) : { balance: 0 },
  ]);
  const daily = isPro ? PRO_DAILY : FREE_DAILY;
  let todayLeft = Math.max(0, daily - used);
  if (!isPro && ipUsed >= FREE_PER_IP_DAILY) todayLeft = 0;
  return { who, day, used, ipUsed, wallet, today: todayLeft, credits: wallet.balance };
}

// Call after a rewrite succeeds, so failed rewrites don't use anything up.
async function spend(a, { userId, ip, isPro }) {
  if (a.today > 0) {
    const writes = [store().setJSON(`day/${a.day}/${a.who}`, a.used + 1)];
    if (!isPro) writes.push(store().setJSON(`day/${a.day}/ip/${ip}`, a.ipUsed + 1));
    await Promise.all(writes);
    return { today: a.today - 1, credits: a.credits };
  }
  a.wallet.balance -= 1;
  await store().setJSON(`credits/${userId}`, a.wallet);
  return { today: 0, credits: a.wallet.balance };
}

module.exports = { allowance, spend, FREE_DAILY, PRO_DAILY };
