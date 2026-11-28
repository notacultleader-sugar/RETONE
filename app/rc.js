// Small helpers so RevenueCat calls can never leave the app stuck on "loading".
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

export const RC_TIMEOUT = 12000;
// Apple's test store can be slow to wake up (NYX was rejected for showing an error instead of a
// price), so offerings are retried for about 30 seconds before giving up.
const RETRY_DELAYS = [1500, 3000, 5000, 8000, 12000];

export const withTimeout = (p, ms = RC_TIMEOUT, what = 'Store') => Promise.race([
  p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} took too long to answer.`)), ms)),
]);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let lastStoreError = '';
export const getLastStoreError = () => lastStoreError;

// Gets offerings and checks `pick(offerings)` finds something usable, retrying for ~30s.
export async function offeringsWithRetry(pick) {
  for (let i = 0; ; i += 1) {
    try {
      const o = await withTimeout(Purchases.getOfferings(), RC_TIMEOUT, 'The store');
      const found = pick(o);
      if (found) { lastStoreError = ''; return found; }
      lastStoreError = 'offering missing or empty (is the right one marked Current in RevenueCat?)';
    } catch (e) {
      lastStoreError = e?.message || 'getOfferings failed';
    }
    if (i >= RETRY_DELAYS.length) return null;
    await wait(RETRY_DELAYS[i]);
  }
}

export const MANAGE_SUBSCRIPTION_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/account/subscriptions'
  : 'https://play.google.com/store/account/subscriptions';
