# Hanzi Cards

Chinese flashcards for Android. 151 starter words (greetings, numbers, time, food, verbs and more) with pinyin and English, spaced repetition, audio, and your own cards. Works offline.

## Get the APK (no Android Studio needed)

1. Create a free account at github.com and make a new repository (private is fine).
2. Upload everything in this folder to it (drag and drop in the browser works; keep the `.github` folder).
3. Open the repository's **Actions** tab. The "Build Android APK" job starts by itself (or press **Run workflow**).
4. After 4-8 minutes, open the finished run and download **hanzi-cards-apk** from the Artifacts section. Unzip it to get `app-debug.apk`.
5. Send the APK to your phone and open it. Android will ask you to allow installing from that source; allow it for this one install.

## Or build it yourself with Android Studio

1. Install Node.js 22 or newer and Android Studio.
2. In this folder run `npm install`, then `npx cap open android`.
3. In Android Studio choose **Build → Build APK(s)**. The file is `android/app/build/outputs/apk/debug/app-debug.apk`.

## Or just use it as a web app

Everything in `www/` is a normal website. Put that folder on any HTTPS host (GitHub Pages, Netlify), open it in Chrome on Android, and choose **Install app** from the menu. It then works offline like an app.

## Add or change words

Open `www/words.js` and add lines like `["谢谢", "xièxie", "thank you", "Greetings"],`. Then rebuild the APK. Cards you add inside the app are saved on the phone and don't need a rebuild.

## How the review schedule works

Tap a card to reveal the answer, then press **Got it** or **Again**. A card you got right comes back after 1, 3, 7, then 16 days. A card you missed comes back a few cards later in the same session and starts over. Cards at 7 days or more count as "known".

## Publishing to Google Play

The debug APK is for your own phone. Play Store needs a signed release build (an `.aab` file) and a Play developer account; ask and I can set that up.
