# Saytwice

Type a message → tap a tone → copy the rewrite. Native iPhone + Android app from one codebase.

- **Free:** Calmer, Professional
- **Pro (paywall):** Kinder, Firmer, Apologetic, Funnier, Confident, Shorter, Flirty, Spicy, Fired Up, Passive-Aggro, Pirate

## Plans and limits

| | Price | Rewrites |
|---|---|---|
| Free | $0 | 5 a day, free tones only |
| Pro monthly | $1.99 / month | 50 a day, all tones |
| Pro yearly | $4.99 / year | 50 a day, all tones |
| Pro lifetime | $19.99 once | 50 a day, all tones |
| Top-up packs | $0.99 / $1.99 / $4.99 | +50 / +150 / +500, never expire |

Daily rewrites refresh at midnight UTC (evening in North America). When they run out, the app uses top-up credits, then opens the **store**.

The store is a screen built into the app (`app/Store.js`) where anyone can buy credit packs, with prices shown in their own currency. Open it by tapping **N LEFT TODAY · GET MORE** above the tones, or **Pro ✓** if you're Pro. Free users also see a link to go Pro there.

The backend enforces all of this, so it can't be bypassed by hacking the app. Change the daily numbers with the `FREE_DAILY_LIMIT` and `PRO_DAILY_LIMIT` environment variables in Netlify. Usage is stored in Netlify Blobs, which comes with every Netlify site, so there's nothing extra to set up.

**What the AI costs you:** about $0.0004 per rewrite on Gemini 3.1 Flash-Lite (paid tier, Oct 2026), so about $0.02 per 50. A Pro user who used all 50 every single day would cost about $7 a year.

The app name lives in `app/app.json` and the logo text in `app/App.js`.

## How it fits together

```
Phone app (Expo / React Native)  ──►  Your backend (Netlify function)  ──►  Google Gemini (free AI)
        │                                      │
        └── RevenueCat (paywall + purchases) ◄─┘  checks the user really paid
```

The AI key lives only on the backend, never in the app, so nobody can steal it and run up your bill. The backend also checks the purchase, so locked tones can't be unlocked by hacking the app.

## What you need

- Apple Developer and Google Play accounts (your existing Society Barbers ones work)
- A free Netlify account (you already have one for the shop site)
- A free Google AI Studio account (for the AI key)
- A free RevenueCat account (handles the paywall and both app stores)
- A free Expo account
- Node.js installed on your computer

## Step 1: Get the free AI key

1. Go to https://aistudio.google.com, sign in, click **Get API key**, create one.
2. Copy it. You'll paste it into Netlify in the next step.

The free tier is fine for testing. **Turn on billing before launch:** free-tier messages may be used by Google to train its AI (paid ones aren't), and the free tier has low daily limits.

Then set a monthly **spend cap** in Google AI Studio's billing settings (for example $20), so a surprise can never run past an amount you choose. If the cap is hit, rewrites pause until the next month and the app shows "Busy right now", so watch your usage as the app grows.

## Step 2: Put the backend online

1. In Netlify, **Add new site → Deploy manually**, and drag in the `backend` folder.
   (Or put it in a GitHub repo and connect that.)
2. **Site settings → Environment variables**, add:
   - `GEMINI_API_KEY` = your key from step 1
   - `REVENUECAT_SECRET_KEY` = from step 3 (add it after)
3. Redeploy. Your API address is:
   `https://YOUR-SITE.netlify.app/.netlify/functions/saytwice`
4. Paste that into `API_URL` in `app/config.js`.

## Step 3: Set up the paywall in RevenueCat

1. Create a project at https://app.revenuecat.com and add an **iOS app** and an **Android app**
   (bundle ID / package: `ca.thesocietybarbers.saytwice`, or whatever you change it to).
2. In App Store Connect and Google Play Console, create these products (use the same ids on both stores):

   | Product id | Type | Price |
   |---|---|---|
   | `saytwice_pro_monthly` | Auto-renewing subscription | $1.99 / month |
   | `saytwice_pro_yearly` | Auto-renewing subscription | $4.99 / year |
   | `saytwice_pro_lifetime` | Non-consumable (one-time) | $19.99 |
   | `saytwice_credits_50` | Consumable | $0.99 |
   | `saytwice_credits_150` | Consumable | $1.99 |
   | `saytwice_credits_500` | Consumable | $4.99 |

   The credit ids must match exactly; the backend looks for them (`backend/netlify/functions/limits.js`).
3. In RevenueCat:
   - Create an **entitlement** called `pro` and attach the three Pro products to it (not the credit packs).
   - Make the **default Offering** with the three Pro products as Monthly, Annual and Lifetime packages.
   - Make a second Offering with the identifier `credits` holding the three credit packs. The in-app store reads this offering, so packs you add or reprice show up without an app update (new pack ids also need adding to `limits.js`).
4. In RevenueCat **Paywalls**, design the Pro paywall for the default offering (no code; the app shows whatever you design there). The credits offering doesn't need a paywall; the app's own store screen shows it.
5. **Project settings → API keys:**
   - Copy the public iOS key (`appl_…`) and Android key (`goog_…`) into `app/config.js`.
   - Copy the **secret** key (`sk_…`) into Netlify as `REVENUECAT_SECRET_KEY`.

## Step 4: Install and run the app

In a terminal, inside the `app` folder:

```bash
npm install expo
npx expo install react react-native expo-status-bar expo-clipboard expo-haptics expo-linear-gradient expo-splash-screen expo-font react-native-svg react-native-safe-area-context react-native-purchases react-native-purchases-ui expo-dev-client @expo-google-fonts/unbounded @expo-google-fonts/dm-sans
npm install -g eas-cli
eas login
eas build:configure
```

Purchases don't work in the Expo Go app, so build a test version for your phone:

```bash
eas build --profile development --platform ios      # or android
npx expo start --dev-client
```

Expo builds the iPhone version in the cloud, so you don't need a Mac.

## Step 5: Ship it

```bash
eas build --platform all
eas submit --platform ios
eas submit --platform android
```

**Before submitting:**
- App icon and splash screen (add to `app/app.json`)
- A privacy policy page (messages are sent to Google's AI to be rewritten; say so)
- Age rating: because of Flirty/Spicy, answer the store questionnaires honestly; expect 17+ (iOS) / Mature (Android)
- Apple requires a **Restore purchases** button: keep it switched on in your RevenueCat paywall design (it is by default)

## Changing the tones

- Buttons, which are free, and each tone's colours and headline word: `app/tones.js`
- What the AI is told for each tone: `backend/netlify/functions/tones.js`

Keep the `id`s the same in both files. To make a tone free, set `free: true` in **both**.
