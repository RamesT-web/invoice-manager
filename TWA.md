# Play Store Publishing via Trusted Web Activity (TWA)

A TWA wraps your deployed PWA in a thin Android shell, giving it a full-screen native experience and a Play Store listing — no Java/Kotlin needed.

## Prerequisites

- App **deployed** to a public HTTPS URL (see DEPLOY.md)
- PWA passes installability: manifest.json + service worker + HTTPS
- A **Google Play Developer account** ($25 one-time fee)

## Step 1: Verify PWA Installability

Open your deployed URL in Chrome and check DevTools:
- **Application > Manifest** — green checks, all icons loaded
- **Application > Service Workers** — `sw.js` registered
- **Lighthouse > PWA** — passes installable audit

## Step 2: Generate Android Project with PWABuilder

1. Go to [pwabuilder.com](https://www.pwabuilder.com)
2. Enter your deployed URL (e.g., `https://invoice-manager.onrender.com`)
3. Click **Start** — PWABuilder validates your PWA
4. Click **Package for Stores** > **Android** > **Google Play (TWA)**
5. Configure:
   - **Package ID**: `com.yourcompany.invoicemanager`
   - **App name**: Invoice Manager
   - **App version**: 1.0.0
   - **Host**: your deployed URL
   - **Signing key**: Generate new (save the `.jks` keystore file safely!)
6. Click **Download** — you get a ZIP with an Android Studio project

## Step 3: Build the App Bundle

1. Install [Android Studio](https://developer.android.com/studio)
2. Open the downloaded project in Android Studio
3. Wait for Gradle sync to complete
4. **Build** > **Generate Signed Bundle / APK**
   - Choose **Android App Bundle (.aab)** (required by Play Store)
   - Select your keystore from step 2
5. Find the `.aab` in `app/build/outputs/bundle/release/`

## Step 4: Digital Asset Links (Required)

This proves you own both the website and the Android app, enabling full-screen mode (no browser bar).

### Get your SHA-256 fingerprint:

```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

Copy the SHA-256 fingerprint line.

### Create the asset links file:

Create `public/.well-known/assetlinks.json` in your web project:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.invoicemanager",
    "sha256_cert_fingerprints": [
      "AA:BB:CC:DD:... (your SHA-256 fingerprint)"
    ]
  }
}]
```

Deploy so it's accessible at `https://your-domain.com/.well-known/assetlinks.json`.

### Verify:

Open: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://your-domain.com&relation=delegate_permission/common.handle_all_urls`

## Step 5: Publish to Google Play

1. Go to [Google Play Console](https://play.google.com/console)
2. **Create app**: name "Invoice Manager", category "Business", free
3. Complete **Store listing**: description, screenshots, 512x512 icon
4. Go to **Production** > **Create new release** > upload `.aab`
5. Complete declarations: content rating, privacy policy URL, etc.
6. Submit for review (typically 1-3 business days)

## Important Notes

- Digital Asset Links must be live **before** review submission
- A **privacy policy page** is required by Google Play
- The TWA auto-updates when you update your website — no new APK needed
- Minimum: Chrome 72+ / Android 7.0+
- For a custom icon, replace `icon-512.png` and `icon-maskable-512.png` in `public/` with your brand icon before generating the TWA

## Alternative: Bubblewrap CLI

Google's [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) CLI can generate a TWA project from the command line:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain.com/manifest.json
bubblewrap build
```

This produces a signed APK and AAB. See the [Bubblewrap docs](https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli) for details. For most users, the **PWABuilder web tool** above is simpler.
