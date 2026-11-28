// Full-screen ads for the free version (Google AdMob). Pro users never see one.
//
// How it works (rules learned the hard way on NYX):
//  - Every ADS_EVERY-th rewrite a free user starts, a full-screen ad plays while the AI writes,
//    so it adds no waiting. Video ads can be skipped after about 5 seconds.
//  - Google's consent check (UMP) runs before any ad. If it says no, no ad is requested.
//    A "yes" is remembered by Google between launches; a "no" or a failed check is never
//    remembered by us, so it's asked again next launch.
//  - Only non-personalised ads are requested, so there is no tracking and no Apple
//    "Allow tracking?" pop-up.
//  - Every step has a time limit and the app never waits on show(), so an ad can't freeze it.
//  - Release builds never use Google's test ads: until real ad unit ids are in config.js,
//    a release build shows no ads. Development builds always use test ads.
//  - The last ad problem is kept for the hidden status screen (tap the SAYTWICE logo 7 times).
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IOS, AD_UNIT_ANDROID, ADS_EVERY } from './config';

const INIT_TIMEOUT = 8000;
const LOAD_TIMEOUT = 10000;
const SHOW_TIMEOUT = 12000;
const REQUEST = { requestNonPersonalizedAdsOnly: true };

// A real ad unit id looks like ca-app-pub-1234/5678 (slash). An app id (tilde) or a
// placeholder is refused, so a mix-up can't silently show nothing.
const realUnit = Platform.OS === 'ios' ? AD_UNIT_IOS : AD_UNIT_ANDROID;
const realUnitOk = /^ca-app-pub-\d+\/\d+$/.test(realUnit || '') && !realUnit.startsWith('ca-app-pub-3940256099942544');
const UNIT = __DEV__ ? TestIds.INTERSTITIAL : realUnitOk ? realUnit : null;

const status = {
  unit: __DEV__ ? 'test ads (development build)' : realUnitOk ? 'real ads' : 'none: real ad unit id missing in config.js',
  consent: 'not checked', started: false, loaded: false, shown: 0, lastError: UNIT ? '' : 'no ad unit id',
};
const fail = (where, e) => { status.lastError = `${where}: ${e?.code || ''} ${e?.message || e || ''}`.trim(); };

const withTimeout = (p, ms, what) => Promise.race([
  p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
]);

let starting = null; // shared, so only one consent check / start runs at a time
let ad = null;
let loading = false;
let showing = false;
let rewritesStarted = 0;

function load() {
  if (!UNIT || loading || ad?.loaded) return;
  loading = true;
  const next = InterstitialAd.createForAdRequest(UNIT, REQUEST);
  let settled = false;
  const done = (ok, e) => {
    if (settled) return;
    settled = true;
    loading = false;
    status.loaded = ok;
    if (ok) { ad = next; return; }
    fail('load', e);
    try { next.destroy?.(); } catch (x) {}
    setTimeout(load, 30000); // try again later
  };
  next.addAdEventListener(AdEventType.LOADED, () => done(true));
  next.addAdEventListener(AdEventType.ERROR, (e) => done(false, e));
  setTimeout(() => done(false, new Error('load timed out')), LOAD_TIMEOUT);
  next.load();
}

async function consentAllowsAds() {
  try {
    await withTimeout(AdsConsent.gatherConsent(), 15000, 'consent');
  } catch (e) { fail('consent', e); }
  try {
    const { canRequestAds } = await AdsConsent.getConsentInfo();
    status.consent = canRequestAds ? 'yes' : 'no (will ask again next launch)';
    return canRequestAds;
  } catch (e) {
    fail('consent', e);
    status.consent = 'check failed (will ask again next launch)';
    return false;
  }
}

// Call once we know the user is on the free version.
export function startAds() {
  if (!UNIT) return Promise.resolve();
  if (status.started) { load(); return Promise.resolve(); }
  if (starting) return starting;
  starting = (async () => {
    try {
      if (!(await consentAllowsAds())) return;
      await withTimeout(mobileAds().initialize(), INIT_TIMEOUT, 'start');
      status.started = true;
      load();
    } catch (e) {
      fail('start', e);
    } finally {
      starting = null; // a failed start is retried on the next rewrite
    }
  })();
  return starting;
}

// Call each time a free user starts a rewrite. Shows an ad on every ADS_EVERY-th one, if one is ready.
// Never waits for the ad: the rewrite carries on underneath it.
export function adForRewrite() {
  rewritesStarted += 1;
  if (!status.started) { startAds(); return; }
  if (rewritesStarted % ADS_EVERY !== 0 || showing) return;
  const current = ad;
  if (!current?.loaded) { load(); return; }
  ad = null;
  status.loaded = false;
  showing = true;
  let finished = false;
  const finish = (e) => {
    if (finished) return;
    finished = true;
    showing = false;
    if (e) fail('show', e);
    setTimeout(load, 1000); // get the next one ready
  };
  // Listeners go on before show() is called.
  let opened = false;
  const guard = setTimeout(() => { if (!opened) finish(new Error('show timed out')); }, SHOW_TIMEOUT);
  current.addAdEventListener(AdEventType.OPENED, () => { opened = true; clearTimeout(guard); status.shown += 1; });
  current.addAdEventListener(AdEventType.CLOSED, () => finish());
  current.addAdEventListener(AdEventType.ERROR, (e) => { clearTimeout(guard); finish(e); });
  current.show().catch((e) => { clearTimeout(guard); finish(e); });
}

// For the hidden status screen.
export function adStatus() {
  return [
    `Ads: ${status.unit}`,
    `Consent: ${status.consent}`,
    `Started: ${status.started ? 'yes' : 'no'}, ad ready: ${status.loaded ? 'yes' : 'no'}, shown this session: ${status.shown}`,
    `Last problem: ${status.lastError || 'none'}`,
  ].join('\n');
}

// Lets someone in Europe change their ad consent later (required by Google there).
export async function adPrivacyOptionsRequired() {
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === 'REQUIRED';
  } catch (e) { return false; }
}
export function showAdPrivacyOptions() {
  return AdsConsent.showPrivacyOptionsForm().catch(() => {});
}
