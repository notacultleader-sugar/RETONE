// Full-screen ads for the free version (Google AdMob). Pro users never see one.
//
// How it works:
//  - Every ADS_EVERY-th rewrite a free user starts, a full-screen ad plays while the AI writes,
//    so it doesn't add any waiting. Video ads can be skipped after about 5 seconds.
//  - If an ad hasn't finished loading yet (e.g. right after opening the app), that rewrite has none.
//  - Before any ad loads we ask for consent where the law needs it (Europe/UK/some US states,
//    Google's own pop-up) and, on iPhone, Apple's "Allow tracking?" prompt. Saying no still
//    shows ads, just not personalised ones.
//
// Until real ad unit ids are put in config.js, Google's test ads are used (they pay nothing).
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { AD_UNIT_IOS, AD_UNIT_ANDROID, ADS_EVERY } from './config';

const realUnit = Platform.OS === 'ios' ? AD_UNIT_IOS : AD_UNIT_ANDROID;
const UNIT = !__DEV__ && realUnit && !realUnit.includes('YOUR') ? realUnit : TestIds.INTERSTITIAL;

let started = null; // promise, so startAds only ever runs once
let ad = null;
let rewritesStarted = 0;

function loadNext() {
  ad = InterstitialAd.createForAdRequest(UNIT);
  // After an ad closes or fails, get the next one ready in the background.
  const again = () => { setTimeout(loadNext, 1000); };
  ad.addAdEventListener(AdEventType.CLOSED, again);
  ad.addAdEventListener(AdEventType.ERROR, () => { setTimeout(loadNext, 30000); });
  ad.load();
}

// Call once we know the user is on the free version.
export function startAds() {
  if (started) return started;
  started = (async () => {
    try {
      // Google's consent pop-up (only shows where the law requires it).
      await AdsConsent.gatherConsent().catch(() => {});
      // Apple's tracking prompt, iPhone/iPad only, asked once.
      if (Platform.OS === 'ios') {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') await requestTrackingPermissionsAsync().catch(() => {});
      }
      const { canRequestAds } = await AdsConsent.getConsentInfo().catch(() => ({ canRequestAds: true }));
      if (!canRequestAds) return;
      await mobileAds().initialize();
      loadNext();
    } catch (e) {
      console.warn('Ads not started:', e?.message);
    }
  })();
  return started;
}

// Call each time a free user starts a rewrite. Shows an ad on every ADS_EVERY-th one, if one is ready.
export function adForRewrite() {
  rewritesStarted += 1;
  if (rewritesStarted % ADS_EVERY !== 0) return;
  if (ad?.loaded) ad.show().catch(() => {});
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
