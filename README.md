# Budget-Wise ₱

A premium, highly aesthetic, cross-platform **Personal Budget Tracker** application built with React Native, React Native Web, Vite, and Capacitor.

## Features 🚀

- **Relational Multi-User Database:** Runs on a highly optimized Local JSON Database engine that persists accounts, utilities, salaries, and transactions locally with zero network latency.
- **Peso Currency Support (₱):** Custom-tailored formatting across all dashboard tabs, analytics cards, and bill ledgers.
- **Dynamic Time Bomb Expiration:** Built-in trial expiration set for **May 25, 2026** showing a premium locked clock screen to restrict access after the beta period.
- **Overdue utility bill alerts:** Keeps your finances on track with active notifications.
- **Premium Branding:** Loaded with a custom-engineered 3D Emerald Green & Gold peso vault app logo.

## Tech Stack 🛠️

- **Core Framework:** React 18 & React Native (Web + Mobile Hybrid)
- **Bundler:** Vite
- **Native Wrapper:** Capacitor (Instant Android integration)
- **Icons:** Expo Vector Icons / Material Design

## Getting Started 💻

### Web Development
1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

### Compile to Native Android APK
1. Build the production web bundle:
   ```bash
   npm run build
   ```
2. Sync assets with the Capacitor native project:
   ```bash
   npx cap sync
   ```
3. Open the `android` folder in **Android Studio** and click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**!
