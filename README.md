# Retone

Type a message → tap a tone → copy the rewrite. Native iPhone + Android app from one codebase.

- **Free:** Calmer, Professional
- **Pro (paywall):** Kinder, Firmer, Apologetic, Funnier, Confident, Shorter, Flirty, Spicy, Fired Up, Passive-Aggro, Pirate

"Retone" is a placeholder name. Change it in `app/app.json` and the logo text in `app/App.js`.

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

The free tier has daily limits. Fine for testing and launch; if the app takes off, turn on billing in Google AI Studio (costs are small per rewrite).

## Step 2: Put the backend online

1. In Netlify, **Add new site → Deploy manually**, and drag in the `backend` folder.
   (Or put it in a GitHub repo and connect that.)
2. **Site settings → Environment variables**, add:
   - `GEMINI_API_KEY` = your key from step 1
   - `REVENUECAT_SECRET_KEY` = from step 3 (add it after)
3. Redeploy. Your API address is:
   `https://YOUR-SITE.netlify.app/.netlify/functions/retone`
4. Paste that into `API_URL` in `app/config.js`.

## Step 3: Set up the paywall in RevenueCat

1. Create a project at https://app.revenuecat.com and add an **iOS app** and an **Android app**
   (bundle ID / package: `ca.thesocietybarbers.retone`, or whatever you change it to).
2. In App Store Connect and Google Play Console, create the product you'll sell. Suggested:
   - **Retone Pro, lifetime unlock**, one-time purchase (e.g. $4.99), or
   - a subscription (e.g. $1.99/month). Lifetime is simpler to launch with.
3. In RevenueCat: create an **entitlement** called `pro`, attach your products to it, and put them in an **Offering**.
4. In RevenueCat **Paywalls**, design the paywall screen (no code; the app shows whatever you design there).
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
