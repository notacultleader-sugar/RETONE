# Saytwice

Type a message → tap a tone → copy the rewrite. Native iPhone + Android app from one codebase.

- **Free:** Calmer, Professional
- **Pro (paywall):** Kinder, Firmer, Apologetic, Funnier, Confident, Shorter, Flirty, Spicy, Fired Up, Passive-Aggro, Pirate, Shakespeare

## Plans and limits

| | Price | Rewrites |
|---|---|---|
| Free | $0 | 5 a day, free tones only, with ads |
| Pro monthly | $1.99 / month | 50 a day, all tones, no ads |
| Pro yearly | $9.99 / year | 50 a day, all tones, no ads |
| Top-up packs | $0.99 / $1.99 / $4.99 | +50 / +150 / +500, never expire |

Daily rewrites refresh at midnight UTC (evening in North America). When they run out, the app uses top-up credits, then opens the **store**.

The store is a screen built into the app (`app/Store.js`) where anyone can buy credit packs, with prices shown in their own currency. Open it by tapping **N LEFT TODAY · GET MORE** above the tones, or **Pro ✓** if you're Pro. Free users also see a link to go Pro there.

The backend enforces all of this, so it can't be bypassed by hacking the app. Change the daily numbers with the `FREE_DAILY_LIMIT` and `PRO_DAILY_LIMIT` environment variables in Netlify. Usage is stored in Netlify Blobs, which comes with every Netlify site, so there's nothing extra to set up.

**What the AI costs you:** about $0.00015 per rewrite on Claude Haiku 5.5 ($0.10 / $0.50 per million tokens in / out, Nov 2026), so under a cent per 50. A Pro user who used all 50 every single day would cost about $3 a year.

The app name lives in `app/app.json` and the logo text in `app/App.js`.

## How it fits together

```
Phone app (Expo / React Native)  ──►  Your backend (Netlify function)  ──►  Claude (Anthropic's AI)
        │                                      │
        └── RevenueCat (paywall + purchases) ◄─┘  checks the user really paid
```

The AI key lives only on the backend, never in the app, so nobody can steal it and run up your bill. The backend also checks the purchase, so locked tones can't be unlocked by hacking the app.

## What you need

- Apple Developer and Google Play accounts (your existing Society Barbers ones work)
- A free Netlify account (you already have one for the shop site)
- An Anthropic Console account (for the Claude AI key; a few dollars of prepaid credit to start)
- A free RevenueCat account (handles the paywall and both app stores)
- A Codemagic account (builds the iPhone and Android apps in the cloud, no Mac needed)
- Node.js installed on your computer

## Step 1: Get the Claude AI key

1. Go to https://console.anthropic.com, sign up, and add a few dollars of credit under **Billing** ($5 covers tens of thousands of rewrites).
2. Go to **API keys**, click **Create key**, and copy it (it starts with `sk-ant-`). You'll paste it into Netlify in the next step.

Claude bills from prepaid credit, so with auto-reload left off you can never be charged more than you've loaded. Anthropic doesn't use API messages to train its AI.

## Step 2: Put the backend online

1. In Netlify, **Add new site → Deploy manually**, and drag in the `backend` folder.
   (Or put it in a GitHub repo and connect that.)
2. **Site settings → Environment variables**, add:
   - `ANTHROPIC_API_KEY` = your Claude key from step 1
   - `REVENUECAT_SECRET_KEY` = from step 3 (add it after)
3. Redeploy. Your API address is:
   `https://YOUR-SITE.netlify.app/.netlify/functions/saytwice`
4. Paste that into `API_URL` in `app/config.js`.

## Step 3: Set up the paywall in RevenueCat

1. Create a project at https://app.revenuecat.com and add an **iOS app** and an **Android app**
   (bundle ID / package: `ca.notacult.apps.saytwice`, or whatever you change it to).
2. In App Store Connect and Google Play Console, create these products (use the same ids on both stores):

   | Product id | Type | Price |
   |---|---|---|
   | `saytwice_pro_monthly` | Auto-renewing subscription | $1.99 / month |
   | `saytwice_pro_yearly` | Auto-renewing subscription | $9.99 / year |
   | `saytwice_credits_50` | Consumable | $0.99 |
   | `saytwice_credits_150` | Consumable | $1.99 |
   | `saytwice_credits_500` | Consumable | $4.99 |

   The credit ids must match exactly; the backend looks for them (`backend/netlify/functions/limits.js`).
3. In RevenueCat:
   - Create an **entitlement** called `pro` and attach the two Pro products to it (not the credit packs).
   - Make the **default Offering** with the two Pro products as Monthly and Annual packages.
   - Make a second Offering with the identifier `credits` holding the three credit packs. The in-app store reads this offering, so packs you add or reprice show up without an app update (new pack ids also need adding to `limits.js`).
4. In RevenueCat **Paywalls**, design the Pro paywall for the default offering (no code; the app shows whatever you design there). The credits offering doesn't need a paywall; the app's own store screen shows it.
5. **Project settings → API keys:**
   - Copy the public iOS key (`appl_…`) and Android key (`goog_…`) into `app/config.js`.
   - Copy the **secret** key (`sk_…`) into Netlify as `REVENUECAT_SECRET_KEY`.

## Step 4: Run it on your computer (optional)

In a terminal, inside the `app` folder:

```bash
npm install
npx expo start
```

Purchases don't work in the Expo Go app, so to test the paywall use a Codemagic test build (next step).

## Step 5: Build with Codemagic

`codemagic.yaml` (in the repo's top folder) has two workflows: **iOS release** sends a build to TestFlight, and **Android release** sends one to Google Play's internal testing track. Neither publishes to the public; you release from App Store Connect / Play Console when you're ready.

One-time setup:

1. **Add the app in Codemagic:** Add application, connect GitHub, pick the `RETONE` repo. Codemagic finds `codemagic.yaml` by itself.
2. **Apple:**
   - In App Store Connect, create the app (bundle ID `ca.notacult.apps.saytwice`). Copy its **Apple ID** number (App Information page) into `APP_STORE_APPLE_ID` in `codemagic.yaml`.
   - In App Store Connect, **Users and Access → Integrations → App Store Connect API**, create a key with App Manager access and download it.
   - In Codemagic, **Team settings → Integrations → Developer Portal**, add that key and name it `codemagic`.
   - In Apple Developer, **Certificates, Identifiers & Profiles → Identifiers** (needed for the iPhone keyboard):
     - Add an **App Group** `group.ca.notacult.apps.saytwice`.
     - Open the app's ID `ca.notacult.apps.saytwice`, tick **App Groups**, Configure, pick that group, Save.
     - Add an **App ID** `ca.notacult.apps.saytwice.keyboard` (description "Saytwice Keyboard"), tick **App Groups**, pick the same group.
   - In Codemagic, **Team settings → Code signing identities**, generate an iOS distribution certificate and fetch the App Store provisioning profiles for **both** `ca.notacult.apps.saytwice` and `ca.notacult.apps.saytwice.keyboard` (if a profile isn't listed, create it in Apple Developer under **Profiles → + → App Store Connect** first). Codemagic picks up the keyboard's profile by itself because its bundle ID starts with the app's.
3. **Android:**
   - Make an upload key once, and keep the file and passwords somewhere safe (lose it and you need Google's help to replace it):
     `keytool -genkey -v -keystore saytwice-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
   - In Codemagic, **Team settings → Code signing identities → Android keystores**, upload it with the reference name `saytwice_upload_key`.
   - In Google Cloud, create a service account, download its JSON key, and invite its email in Play Console (**Users and permissions**) with release permissions. In Codemagic, **Environment variables**, add a secret `GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS` with the JSON contents in a group called `google_play`.
   - Google requires the very first upload of a new app to be done by hand: run the Android workflow once, download the `.aab` from the build page, and upload it in Play Console. After that, Codemagic uploads automatically.
4. Start a build: **Start new build**, pick the workflow. Build numbers go up by themselves.

The app icon is `app/assets/icon.png` (and `adaptive-icon.png` for Android); replace them to change it.

## Step 5b: Ads in the free version (Google AdMob)

Free users see a full-screen ad on every rewrite. It plays while the AI writes, so it adds no waiting, and video ads can be skipped after about 5 seconds. Pro users never see ads. The code is in `app/ads.js`; change how often with `ADS_EVERY` (2 = every 2nd rewrite) in `app/config.js`.

Development builds always show Google's **test ads** (they pay nothing). Release builds (TestFlight, Play testing, the stores) show **no ads at all** until your real ad unit ids are in, so test ads can never ship by mistake. To switch to real ads:

1. Make an AdMob account at https://admob.google.com and add the app twice (iOS and Android).
2. Put each app's **App ID** (has a `~`) in `app/app.json`, under `react-native-google-mobile-ads`: `iosAppId` and `androidAppId`.
3. In each app make an **Interstitial** ad unit, and put its **ad unit ID** (has a `/`) in `app/config.js` as `AD_UNIT_IOS` and `AD_UNIT_ANDROID`.
4. In AdMob, **Privacy & messaging**, create and **publish** a **European regulations** (GDPR) message, and check the **US state regulations** one. If this is missing, AdMob gets zero ad requests and nothing looks broken (this cost days on NYX).
5. Add an `app-ads.txt` file to your website with the line AdMob gives you (Apps → app-ads.txt), and put that website in both store listings.

Before any ad, the app runs Google's consent check (shown only where the law requires). A yes is remembered; a no or a failed check is asked again next launch. The app asks only for **non-personalised** ads, so there's no tracking and no Apple "Allow tracking?" pop-up (non-personalised ads pay a little less). Every ad step has a time limit, so an ad can never freeze the app.

**Why no ads?** Tap the SAYTWICE logo 7 times quickly: a status box shows the ad mode, consent, and the last ad or store problem.

After each store approves the app, open AdMob → Apps, find **"Limited ad serving: Add store"** and link the live listing (once for iPhone, once for Android).

Never tap your own real ads; AdMob can close the account for it. Test with the test ads.

## Step 6: Ship it

From TestFlight / internal testing, submit for review in App Store Connect and Play Console.

**Before submitting:**
- A privacy policy page (messages are sent to Anthropic's Claude AI to be rewritten; say so). Also say the free version shows ads from Google AdMob, which may use the device's advertising ID.
- Ads in the store forms: App Store **App Privacy** answers must include *Device ID* and *Advertising data* collected for **Third-party advertising**, plus *Coarse location*, *Product interaction* and *Crash/Performance data* (AdMob), all **not used for tracking** (the app asks only for non-personalised ads). Google Play: answer **Contains ads = Yes**; in **Data safety** declare Approximate location, App interactions, Crash logs and Diagnostics, and Device or other IDs, collected and shared with Google for advertising; and say yes on the **Advertising ID** form.
- Age rating: because of Flirty/Spicy, answer the store questionnaires honestly; expect 17+ (iOS) / Mature (Android)
- Apple requires a **Restore purchases** button: keep it switched on in your RevenueCat paywall design (it is by default). The Get more rewrites sheet also has Restore, Manage subscription (Pro), Terms and Privacy links.
- In the RevenueCat paywall editor, add Terms (Apple's standard EULA: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) and Privacy (https://saytwice.netlify.app/privacy/) links, and put both links at the end of the App Store description (NYX was rejected under 3.1.2 without the EULA link).
- In RevenueCat, the Pro offering (Monthly + Yearly) must be the one marked **Current**, not the starter "default" one. The app checks this and retries for ~30 seconds before showing the paywall.
- When submitting the first version, attach the Pro subscriptions to it in App Store Connect.

## The iPhone keyboard

`app/targets/keyboard` is a Saytwice keyboard for iPhone and iPad (Swift, added to the Xcode project on `expo prebuild` by `@bacons/apple-targets`).

- A mood bar on top: swipe it to change mood (the keyboard glows in that mood's colours), **double-tap** it to rewrite what's in the text box in that mood. ↺ undoes the last rewrite.
- Below it, a normal full keyboard, so it works for everyday typing with no rewriting.
- It uses the same server, account, Pro tones and daily limits as the app. The app shares the user id, Pro status and server address with it through the App Group `group.ca.notacult.apps.saytwice`, so the app has to be opened once first.
- It needs **Allow Full Access** to reach the server. Nothing typed is sent until the mood bar is double-tapped; then only the text in that box (or the selected text) is sent.
- The ⌨️ button in the app shows people how to turn it on.
- Tone list for the keyboard: `app/targets/keyboard/Tones.swift` (keep in sync with `app/tones.js`).

**App Store:** in the privacy policy and App Review notes, say the keyboard asks for Full Access only to send the text the user chooses to rewrite to the Saytwice server, and that it doesn't store or log keystrokes.

## Changing the tones

- Buttons, which are free, and each tone's colours and headline word: `app/tones.js`
- What the AI is told for each tone: `backend/netlify/functions/tones.js`

Keep the `id`s the same in both files (and in `app/targets/keyboard/Tones.swift` for the keyboard). To make a tone free, set `free: true` in **all of them**.
