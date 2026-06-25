# Penny

A premium, highly aesthetic, cross-platform **Personal Ledger & Envelope Budgeting** companion built with React Native, React Native Web, Vite, and Capacitor.

## Features 🚀

- **Relational Multi-User Database:** Runs on a highly optimized Local JSON Database engine that persists accounts, utilities, salaries, and transactions locally with zero network latency.
- **Peso Currency Support (₱):** Custom-tailored formatting across all dashboard tabs, analytics cards, and bill ledgers.
- **Smart Dynamic Icon Mapping:** Automatically assigns minimal vector icons based on envelope names (e.g., "Food" gets a restaurant icon, "Rent" gets a home icon).
- **Overspent Visual Cues:** Intelligent progress bars that turn bright red when a budget category exceeds its limit.
- **Dynamic Time Bomb Expiration:** Built-in trial expiration logic with a premium locked clock screen for beta management.
- **Overdue Utility Bill Alerts:** Integrated local notification system that triggers reminders 24 hours before a bill is due.

## Security & Privacy 🔒

- **100% Offline-First:** Your financial data never leaves your device. No cloud sync, no tracking, absolute privacy.
- **6-Digit PIN Security:** Protect your ledger from local unauthorized access with a mandatory secure PIN on startup.
- **Biometric Integration:** Seamlessly unlock your budget using Fingerprint or Face ID on supported Android devices.
- **Local Persistence:** Data is stored using highly optimized browser and native storage adapters for instant load times.

## Customization 🎨

- **Aesthetic Accent Palettes:** Choose from curated themes including *Penny Classic*, *Corporate Blue*, *Rose Gold*, *Lavender Dream*, *Stealth Black*, and *Latte Neutral*.
- **Responsive UI:** Adaptive layout that works beautifully on mobile devices and scales elegantly for desktop web browsers.

## Tech Stack 🛠️

- **Core Framework:** React 18 & React Native (Web + Mobile Hybrid)
- **Bundler:** Vite
- **Native Wrapper:** Capacitor (Instant Android integration)
- **Icons:** Expo Vector Icons / Material Design
- **State Management:** React Context API + Custom Hooks
- **Styling:** React Native Stylesheets with Dynamic Theme Injection

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

## Project Structure 📁

```text
├── android/            # Native Android Capacitor Project
├── assets/             # Global static assets (logos, splash)
├── src/
│   ├── components/    # Reusable UI components
│   ├── contexts/      # App-wide state (Auth, Theme, User)
│   ├── navigation/    # React Navigation stacks & tabs
│   ├── screens/       # Main feature screens
│   ├── utils/         # Helpers (formatting, notifications, database)
│   └── main.jsx       # Entry point
├── capacitor.config.json
└── vite.config.js
```

## Available Scripts 📜

- `npm run dev`: Launch the Vite development server.
- `npm run build`: Generate optimized production assets in `/dist`.
- `npm run test`: Execute test suites using Vitest.

---
*Developed with a focus on privacy, aesthetics, and financial discipline.*
