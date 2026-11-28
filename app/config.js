// Fill these in once (see README.md, steps 2–4).

// Your backend address after deploying /backend to Netlify, e.g.
// https://saytwice-api.netlify.app/.netlify/functions/saytwice
export const API_URL = 'https://YOUR-SITE.netlify.app/.netlify/functions/saytwice';

// RevenueCat public SDK keys (Project settings > API keys in RevenueCat).
export const REVENUECAT_IOS_KEY = 'appl_YOUR_KEY';
export const REVENUECAT_ANDROID_KEY = 'goog_YOUR_KEY';

// The entitlement name you create in RevenueCat for the paid unlock.
export const PRO_ENTITLEMENT = 'pro';

// The RevenueCat offering that holds the credit packs shown in the in-app store (see README.md, step 3).
export const CREDITS_OFFERING = 'credits';

// --- Ads (free version only; Pro users never see ads) ---
// Your AdMob "Interstitial" ad unit ids (AdMob > Apps > Saytwice > Ad units). They look like
// ca-app-pub-1234567890123456/1234567890 (with a slash). Until these are filled in, Google's
// test ads show instead. Your AdMob *app* ids (with a ~) go in app.json instead.
export const AD_UNIT_IOS = 'ca-app-pub-YOUR_ID/YOUR_IOS_UNIT';
export const AD_UNIT_ANDROID = 'ca-app-pub-YOUR_ID/YOUR_ANDROID_UNIT';

// Free users see one full-screen ad every this many rewrites (never on the first one).
export const ADS_EVERY = 2;
