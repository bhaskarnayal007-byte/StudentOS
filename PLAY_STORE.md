# Stratus on Google Play: launch checklist status

Every row of the Play Store launch checklist (Downloads › *Play Store Launch Checklist*), checked
against the code on 11 Nov 2026. **Done** = true in the code now. **You** = only you can do it, in
Play Console or on your account. **N/A** = doesn't apply to Stratus today.

## 1. Account

| Check | Status | Notes |
|---|---|---|
| Developer account registered, US$25 paid | You | |
| Developer identity verified | You | |
| App registered under the verified developer | You | Package name `com.bhaskarnayal.stratus`. |
| D-U-N-S number | N/A | Personal account. Only needed if you switch to an organisation. |
| Public developer contact email | You | Use the address the policies already give: archive.solutions007@gmail.com. |

## 2. Closed testing (personal accounts made after 13 Nov 2023)

| Check | Status | Notes |
|---|---|---|
| Closed testing track + first release approved | You | Upload the signed `.aab` (see §3). |
| 12+ testers opted in (aim 15–20) | You | They must install from the Play test link, not the APK. |
| Testers opted in for 14 days straight | You | |
| Testers used it; feedback in; an update shipped | You | Ship at least one new `versionCode` during the test. |
| Production access application | You | |

## 3. Technical

| Check | Status | Notes |
|---|---|---|
| targetSdk 36 | Done | `android/variables.gradle`. |
| compileSdk 36 + tested on Android 16 | Done (compileSdk) / You (device test) | Test launch, back gesture, mic permission, Share → Stratus, Google sign-in on an Android 16 emulator or phone. |
| Uploaded as `.aab` | Done (builds) / You (sign) | Built and checked 11 Nov; it comes out unsigned until `keystore.properties` exists (below). `npm run build:android`, then `gradlew bundleRelease` in `frontend/android` (needs `JAVA_HOME` = Android Studio's `jbr`). Output: `%LOCALAPPDATA%\stratus-android-build\app\outputs\bundle\release\app-release.aab`. |
| Play App Signing; upload key backed up | You | Release signing now reads `frontend/android/keystore.properties` (git-ignored). Make the upload key once, below, and back up the `.jks` and its passwords somewhere off this laptop. |
| versionCode bumped every upload | You | `android/app/build.gradle`, now `versionCode 2`. Bump it before each upload (and whenever native code changes, for live updates). |
| 16 KB page size | N/A | The bundle contains no native `.so` libraries (checked). |
| Billing Library 8+ | N/A for now | Nothing is sold yet. **When Plus (₹99/mo) launches, the Android app must sell it through Play Billing, not Razorpay**, or not sell it in the app at all. |
| Digital goods through Play Billing | N/A for now | Same as above. |
| Pre-launch report clean | You | Play Console › Test and release › Pre-launch report, after the first upload. Give it the reviewer login so the robot gets past sign-in. |
| Release build clean | Done | Release builds aren't debuggable and WebView debugging is off (Capacitor's default for release). No `console.log` in `src/`. The app talks only to the production Worker and Supabase. |
| Only needed permissions | Done | Merged release manifest: `INTERNET`, `RECORD_AUDIO` (Octi's mic), plus `WAKE_LOCK`, `ACCESS_NETWORK_STATE`, `RECEIVE_BOOT_COMPLETED`, `FOREGROUND_SERVICE` from WorkManager, which the live-update plugin uses to download bundles. All four are normal permissions with no Play declaration; no foreground service type is declared, so the foreground-service form isn't triggered. |
| SDKs updated and compliant | Done | Capacitor 8, Supabase JS 2, Sentry 11. The live-update plugin only swaps the web bundle (JavaScript in the WebView), which Play allows. |

Make the upload key (once, in `frontend/android`):

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool" -genkeypair -v -keystore stratus-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Then create `frontend/android/keystore.properties`:

```
storeFile=stratus-upload.jks
storePassword=<the password you chose>
keyAlias=upload
keyPassword=<the password you chose>
```

## 4. Store listing

| Check | Status | Notes |
|---|---|---|
| Name ≤30 chars, no keyword stuffing | Done (draft below) | |
| Short (≤80) and full (≤4,000) description | Done (draft below) | |
| Icon 512×512 32-bit PNG | Done | `frontend/play-store/icon-512.png` |
| Feature graphic 1024×500 | Done | `frontend/play-store/feature-graphic-1024x500.png` |
| 2+ phone screenshots (4+ better) | You | Take them on your phone while signed in: Home, Tasks, a mind map, Octi doing something, Spending. |
| Category and tags | You | Category **Productivity**. Tags: Education, Productivity, To-do list, Calendar. |
| No impersonation or IP | Done | Own name, own logo and mascot. Quick Launch shows favicons only for shortcuts the user adds. |

**App name:** Stratus: Student Planner (24)

**Short description:** Tasks, notes, timetable, timers and spending in one app, run by Octi, your AI. (78)

**Full description:**

> Stratus keeps a student's whole week in one place.
>
> • Tasks with due dates and priorities, linked to your courses
> • Courses with a mind map of topics you can tick off as you learn them
> • Notes filed by subject, with PDFs, photos and slides attached
> • A month calendar and a weekly timetable
> • Timers, alarms and a weekly count of your study time
> • A spending tracker with monthly totals by category
> • Friends and chats, and sharing a note, event or mind map with a friend
>
> Octi, the built-in AI assistant, works the app for you. Say "add a task to submit the lab record on Friday" or "set a 25 minute timer" and Octi does it, showing you exactly what it changed. You can type or speak.
>
> Everything syncs across your phone and the web, and you can delete your account and all its data from Settings at any time.

## 5. App content declarations

| Check | Status | Notes |
|---|---|---|
| Privacy policy URL, public, in the app | Done | Use `https://stratus-ae5.pages.dev/privacy` (and the new domain later). Linked from Settings, every legal page, and Octi. Updated today to cover note-file sync, friends and chats, the mic, and AI reports. |
| Data safety form matches the app | You (answers below) | |
| Content rating (IARC) | You | Answer: users can interact (chat between friends); no violence, gambling or purchases; no location sharing. |
| Target audience | You | Recommend **18 and over** (college students). Choosing under-13 would bring in the Families policy. |
| Ads declaration | You | **No ads.** |
| App access: reviewer login | You | Make a test account with email + password (Google sign-in won't work for reviewers), fill it with a few tasks, notes and a course, and give the login under App access. |
| Account deletion in app + web link | Done | In app: Settings › Delete account (now also removes the profile picture). Web link: `https://stratus-ae5.pages.dev/delete-account`, a public page with the steps and an email route. |
| Sensitive permission declarations | N/A | No SMS, call log, location, accessibility or all-files access. |
| Financial features declaration | You | Stratus has no loans, payments, trading or crypto. Answer that it offers none; if the form lists expense tracking/budgeting, tick only that. |
| News / health / government declarations | N/A | |

**Data safety answers** (what the code actually does):

- Collected: Name, Email address, User IDs; Photos (profile picture, photos attached to notes); Files and docs (note attachments); Other in-app messages (chats); Calendar events (events made in Stratus); Other financial info (expenses you enter); Other user-generated content (tasks, notes, courses, Octi messages); Crash logs and Diagnostics (Sentry, only if the build has `VITE_SENTRY_DSN`).
- Not collected: location, contacts, audio (speech becomes text on the device's speech service, and only text reaches us), web history, device IDs for ads. Google Calendar events are fetched on the device and never sent to the server.
- Shared with third parties: **none**. Supabase, Groq, Sentry and Cloudflare process data on your behalf, which Play counts as service providers, not sharing.
- Encrypted in transit: **yes**. Users can request deletion: **yes**, with the `/delete-account` URL.
- Purpose for each: App functionality and Account management; crash logs and diagnostics: Analytics/App functionality.

## 6. Policy compliance

| Check | Status | Notes |
|---|---|---|
| Permissions at the moment of need, denial handled | Done | The mic permission is asked the first time the mic is tapped. A refusal shows "The microphone is blocked…" and typing keeps working. |
| AI integrations meet User Data policy | Done | Octi now says up front that it's an AI and that messages go to the AI provider, with a Privacy link. The policy names Groq. |
| In-app way to report AI content | Done | Every Octi reply has a **Report** link. Reports go to the new `content_reports` table. **Run `supabase/migrations/0009_content_reports.sql` in the Supabase SQL editor**, then read reports in Table Editor. |
| Contact Picker instead of contacts access | N/A | Stratus never reads contacts. |
| Minimum location scope | N/A | No location. |
| Minors blocked from age-restricted features | N/A | Not dating, gambling or anonymous chat. Chat is between accepted friends only. |
| No deceptive behaviour | Done | The listing above describes only what exists. |
| Ads not disruptive | N/A | No ads. |

## 7. Release

| Check | Status | Notes |
|---|---|---|
| Production release with release notes | You | |
| Staged rollout at 10–20% | You | |

## Not on the checklist, but worth knowing

Chats between friends count as user-generated content under Play's UGC policy, which expects a way to
report a message and block a person. Today you can only remove a friend. Reviewers don't always
enforce it for friends-only chat, but it's a common rejection reason.
