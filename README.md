# SonicSpine: Body-Aware Focus Environment

<div align="center">
  <p><strong>Don't interrupt. Influence.</strong></p>
  <p><i>A privacy-first posture intelligence engine built for the RevenueCat Ship-a-ton 2026 (Next Gen Award).</i></p>
</div>

---

## 🎧 The Concept

Most posture apps act like strict teachers—blasting loud alarms or push notifications every time you slouch. This creates notification fatigue, interrupts your flow state, and causes users to uninstall the app within days. 

**SonicSpine** is different. It turns your physical posture into a continuous input for your ambient audio environment. 

- **Good Posture** → Audio is crystal clear.
- **Posture Drift** → Audio gently loses clarity (muffles).
- **Recovery** → Audio gradually restores to normal.

By using native audio biquad filters, SonicSpine influences your subconscious to sit up and restore the crisp sound—without ever breaking your focus.

## ✨ Key Features

- **Privacy-First Inference:** All camera processing runs 100% locally in the browser/device using WebAssembly (MediaPipe). No video feeds or images are ever sent to a server.
- **Personalized Calibration:** SonicSpine captures a baseline of your unique body geometry to establish what "Good Posture" means for *you*, rather than relying on arbitrary global thresholds.
- **Evidence Fusion Architecture:** A robust temporal state machine that utilizes motion gating, normalized geometric ratios, and hysteresis to intelligently distinguish between actual slouching and normal head movements.
- **Touchless Hand Gestures (Pro):** Control the volume with a vertical hand swipe—engineered to aggressively reject false positives from typing or mouse movement.
- **Session Analytics:** Accurately tracks Stable, Drifting, Corrective, and Away time without penalizing your consistency score if you stand up for a coffee.
- **Cross-Platform & Monetized:** Built as a responsive Web App with a generated Capacitor wrapper, integrated with **RevenueCat** to manage the "SonicSpine Pro" freemium entitlements.

## 🧠 Architecture Highlights

- **Vision:** Uses `@mediapipe/tasks-vision` for lightweight, high-FPS skeletal landmark tracking.
- **Posture Math:** Normalizes key relationships (e.g., ear height relative to shoulder height) rather than tracking raw pixels, making the engine distance and perspective invariant.
- **State Machine:** Employs an Evidence Accumulator that assigns penalties based on deviation severity. The system smoothly transitions between `GOOD` -> `DRIFTING` -> `CORRECTIVE` -> `RECOVERING`.
- **Audio:** Uses the native Web Audio API (`BiquadFilterNode` and `GainNode`) for interpolated, synchronous audio manipulation that complies with strict mobile browser policies.

For a deeper technical dive, see our [ARCHITECTURE.md](./ARCHITECTURE.md) and [DECISIONS.md](./DECISIONS.md).

## 🚀 Local Setup & Development

### Web Development
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/cryptXploit/SonicSpine.git
   cd SonicSpine
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Access the web app at `http://localhost:5173`. 
   - *Pro tip: Append `?debug=true` to the URL to view the live diagnostic heads-up display.*

### Running Tests
We enforce a strict TDD protocol (Vitest) for the state machine, computer vision math, and temporal filtering.
```bash
npm run test
```

### Android (Capacitor) Setup
The project is scaffolded for native Android deployment via Capacitor.
```bash
npm run build
npx cap sync android
npx cap open android
```

## 🧪 Testing Protocol
SonicSpine includes an extensive manual testing matrix to ensure real-world accuracy against false positives (e.g., leaning, stretching, looking off-screen). Please refer to the [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md) for the exact procedures to validate the engine.

## 📄 License
This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
