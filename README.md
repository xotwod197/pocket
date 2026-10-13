# Pocket: money tracker

A phone-first expense tracker you install on your iPhone home screen. Sign in with Google; each person's data is private to their own account.

- **Home:** how much is *safe to spend* until your next payday, account balances, bills due this week, budgets, goals
- **Calendar:** leftover money on every day, paydays and bills on their real dates
- **Activity:** every transaction with search and filters, plus **Insights** (spending by category, income vs spending, 60-day forecast, top spending)
- **Plan:** budgets, bills and subscriptions, savings goals, debt payoff, and a paycheck planner that moves paydays off weekends and holidays
- Multiple accounts (bank, Cash App, PayPal, savings, credit card) with transfers between them
- Import your old tracker backup; export everything any time (backup file or spreadsheet)
- Works offline; light and dark mode

**Cost:** $0. GitHub (free) stores the code and publishes it automatically. Firebase's free Spark plan handles sign-in, storage (1 GB) and hosting.

---

## Setup (about 20 minutes, one time)

You'll do 6 things. Nothing here needs a credit card.

### 1. Create the Firebase project
1. Go to **console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project**. Name it, for example `pocket-ramiro`.
3. Turn **Google Analytics off** (not needed), then **Create project**.
4. Write down the **Project ID** shown under the name (e.g. `pocket-ramiro` or `pocket-ramiro-1a2b3`). You'll need it below.

### 2. Register the web app and copy its settings
1. On the project home page, click the **web icon `</>`** ("Add app").
2. Nickname: `Pocket`. Leave "Firebase Hosting" unchecked. Click **Register app**.
3. You'll see a block of code with `const firebaseConfig = { apiKey: ..., ... }`.
4. Open `public/js/firebase-config.js` in this repo and replace each `PASTE_...` value with the matching value from that block.
5. Also put your Project ID into `.firebaserc`.

> These values are meant to be public: they only identify your project. Your data is protected by the security rules in step 4, not by hiding these.

### 3. Turn on Google sign-in
1. Left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → switch **Enable** on → pick your support email → **Save**.

### 4. Create the database and lock it down
1. Left menu: **Build → Firestore Database → Create database**.
2. Location: pick one near you (e.g. `us-west2 (Los Angeles)`). Start in **production mode**. Click **Create**.
3. Open the **Rules** tab, delete everything there, paste the contents of `firestore.rules` from this repo, and click **Publish**.

These rules mean a signed-in person can only read and write their own folder (`users/<their id>`). Nobody can read anyone else's data.

### 5. Put the code on GitHub
1. On **github.com**, click **New repository**. Name it `pocket`. It can be public or private. Don't add a README (this repo has one). Click **Create**.
2. Upload this folder: either drag all the files onto the repo page ("uploading an existing file"), or with git:
   ```
   git init && git add . && git commit -m "Pocket"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/pocket.git
   git push -u origin main
   ```
   If you drag-and-drop in the browser, make sure the hidden `.github` folder comes along. On a Mac, press Cmd+Shift+. to show hidden files.

### 6. Let GitHub publish to Firebase automatically
GitHub needs a key that's allowed to publish your site.

**a) Make the key (Google Cloud console)**
1. Go to **console.cloud.google.com/iam-admin/serviceaccounts** and pick your Firebase project at the top.
2. **Create service account** → name `github-deploy` → **Create and continue**.
3. Add these roles: **Firebase Hosting Admin** and **API Keys Viewer**. Click **Continue**, then **Done**.
4. Click the new account → **Keys** tab → **Add key → Create new key → JSON → Create**. A `.json` file downloads. Treat it like a password: never commit it to GitHub.

**b) Give it to GitHub**
1. In your GitHub repo: **Settings → Secrets and variables → Actions**.
2. **Secrets** tab → **New repository secret** → Name `FIREBASE_SERVICE_ACCOUNT` → paste the entire contents of the downloaded `.json` file → **Add secret**. Then delete the downloaded file from your computer.
3. **Variables** tab → **New repository variable** → Name `FIREBASE_PROJECT_ID` → value is your Project ID → **Add variable**.

**c) Publish**
- Go to the **Actions** tab → **Test and deploy** → **Run workflow** (or just push any change to `main`).
- When it turns green (about a minute), your app is live at **`https://YOUR-PROJECT-ID.firebaseapp.com`**.
- From now on, every change pushed to `main` is tested and published automatically.

---

## Install it on your iPhone
1. Open **`https://YOUR-PROJECT-ID.firebaseapp.com`** in **Safari**. Use this exact address: sign-in works most reliably on it, and the `.web.app` address redirects here automatically.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
3. Open Pocket from your home screen and tap **Continue with Google**.
4. On first launch, turn on the accounts you use, enter today's balances, and choose your backup file (`finance-backup-2026-10-12.json`) to bring in your old data.

Anyone else can do the same with their own Google account; they'll start with an empty, private Pocket.

---

## Tips
- **Safe to spend** = money in your spending accounts − bills due before your next paycheck − your cushion (Settings). Add your jobs in **Plan → Paychecks** so it knows when payday is.
- Tap any **repeating** item on the calendar to change just that one (amount or date) or skip it.
- **Settings → Holidays → Add US holidays** so paydays move to the business day before, like your payroll.
- **Settings → Back up everything** saves a file you can restore from on any device.

## Free-plan limits (plenty for personal use)
Firestore Spark plan: 1 GB stored, 50,000 reads and 20,000 writes per day. Pocket stores each month's transactions in a single document, so opening the app reads roughly 20–40 documents, not thousands.

## For developers
```
public/            the app (plain HTML/CSS/JS modules, no build step)
  js/finance.js    all money/date math, no DOM, unit tested
  js/store.js      Firebase (Google sign-in + Firestore) and an on-device demo store
  js/app.js        screens and interactions
  js/charts.js     small SVG charts
firestore.rules    database security rules
tests/             unit tests + iPhone end-to-end tests (Playwright)
```
- Unit tests: `npm test`
- Run locally: `cd public && python3 -m http.server 8765`, then open `http://localhost:8765/?demo=1`
- End-to-end (needs Playwright): `node tests/e2e.mjs shots` and `node tests/e2e-firebase.mjs`
- Firebase SDK version is set in `public/js/store.js` (`FB_VER`).
