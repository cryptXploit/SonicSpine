# SonicSpine

**SonicSpine** is a privacy-first, camera-based posture awareness application. It utilizes local computer-vision inference (MediaPipe) to track your posture, temporal evidence accumulation to filter out noise, and an adaptive audio engine to provide seamless, non-intrusive feedback to keep you sitting up straight.

This project was built as a submission for the Shipathon 2026 Hackathon.

## ✨ Features

- **Privacy-First Inference:** All camera processing runs 100% locally in the browser/device using WebAssembly. No video feeds or images are ever sent to a server.
- **Personalized Calibration:** SonicSpine captures a baseline of your unique body geometry to establish what "Good Posture" means for *you*, rather than relying on arbitrary global thresholds.
- **Evidence Fusion Architecture:** A robust temporal state machine that utilizes motion gating, normalized geometric ratios, and hysteresis to intelligently distinguish between actual slouching and normal head movements.
- **Adaptive Audio Feedback:** Instead of annoying alarms, SonicSpine gently muffles ambient audio when you drift from your baseline, guiding you back to a healthy posture subconsciously.
- **Cross-Platform Ready:** Built as a responsive Web App with a generated Capacitor wrapper, ready to be compiled into a native Android APK with RevenueCat integration.

## 🧠 Architecture Highlights

- **Vision:** Uses `@mediapipe/tasks-vision` for lightweight, high-FPS skeletal landmark tracking.
- **Posture Math:** Normalizes key relationships (e.g., ear height relative to shoulder height) rather than tracking raw pixels, making the engine distance and perspective invariant.
- **State Machine:** Employs an Evidence Accumulator that assigns penalties based on deviation severity. The system smoothly transitions between `GOOD` -> `DRIFTING` -> `CORRECTIVE` -> `RECOVERING`.
- **Audio:** Uses the native Web Audio API (`BiquadFilterNode`) for interpolated, synchronous audio manipulation that complies with strict mobile browser autoplay policies.

For a deeper technical dive, see our [ARCHITECTURE.md](./ARCHITECTURE.md) and [DECISIONS.md](./DECISIONS.md).

## 🚀 Local Setup & Development

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Web Development
1. Clone the repository:
   ```bash
   git clone https://github.com/cryptXploit/SonicSpine.git
   cd SonicSpine
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:5173`. 
   - *Pro tip: Append `?debug=true` to the URL to view the live diagnostic heads-up display.*

### Running Tests
We enforce a strict TDD protocol for the state machine and temporal math.
```bash
npm run test
```

### Android (Capacitor) Setup
The project is scaffolded for native Android deployment via Capacitor.
1. Build the web project:
   ```bash
   npm run build
   ```
2. Sync the Capacitor project:
   ```bash
   npx cap sync android
   ```
3. Open in Android Studio to build the APK:
   ```bash
   npx cap open android
   ```

## 🧪 Testing Protocol

SonicSpine includes an extensive manual testing matrix to ensure real-world accuracy against false positives (e.g., leaning, stretching, looking off-screen). Please refer to the [TESTING_PROTOCOL.md](./TESTING_PROTOCOL.md) for the exact procedures to validate the engine.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
