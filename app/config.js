// Fill these in once (see README.md, steps 2–4).

// Your backend address after deploying /backend to Netlify, e.g.
// (Saytwice's Netlify site is saytwice.netlify.app.)
export const API_URL = 'https://saytwice.netlify.app/.netlify/functions/saytwice';

// RevenueCat public SDK keys (Project settings > API keys in RevenueCat).
export const REVENUECAT_IOS_KEY = 'appl_YOUR_KEY';
export const REVENUECAT_ANDROID_KEY = 'goog_YOUR_KEY';

// The entitlement name you create in RevenueCat for the paid unlock.
export const PRO_ENTITLEMENT = 'pro';

// The RevenueCat offering that holds the credit packs shown in the in-app store (see README.md, step 3).
export const CREDITS_OFFERING = 'credits';

// --- Ads (free version only; Pro users never see ads) ---
// Your AdMob "Interstitial" ad unit ids (AdMob > Apps > Saytwice > Ad units). They look like
// ca-app-pub-1234567890123456/1234567890 (with a slash). Development builds always use Google's
// test ads; release builds (TestFlight, Play testing, the stores) show NO ads until these are real.
// Your AdMob *app* ids (with a ~) go in app.json instead.
export const AD_UNIT_IOS = 'ca-app-pub-YOUR_ID/YOUR_IOS_UNIT';
export const AD_UNIT_ANDROID = 'ca-app-pub-YOUR_ID/YOUR_ANDROID_UNIT';

// Free users see one full-screen ad every this many rewrites (1 = every rewrite).
export const ADS_EVERY = 1;

// Links shown in the store sheet (Apple requires Terms + Privacy near anything you sell).
export const PRIVACY_URL = 'https://saytwice.netlify.app/privacy/';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'; // Apple's standard EULA
