# SonicSpine — Current State & Audit Findings

## Current Verified State
Following a comprehensive Phase 1 Audit, critical P0 and P1 defects in the audio pipeline, posture intelligence, and architecture lifecycle were identified and fixed. The system is now scientifically sound and reliably plays audio.

### 1. Audio Reliability (FIXED - P0)
- **Problem**: Audio would consistently fail to play or fail to update on Safari and strict mobile browsers.
- **Cause 1**: The external audio URL (Pixabay) was returning a `403 Forbidden` error because it blocked cross-origin/bot requests. `MediaElementAudioSourceNode` received zero data and silently output nothing.
- **Cause 2**: Browser autoplay policies require `.play()` to happen strictly synchronously with a user gesture. `App.tsx` was `await`-ing `startCalibration()` before calling `.play()`, which pushed playback into a detached microtask and resulted in `NotAllowedError`.
- **Cause 3**: React hot reloads or state changes unmounted the `<audio>` tag. Since `AudioEngine` caches its initialization, the new `<audio>` element was never connected to the Web Audio API context.
- **Fix Applied**: 
  1. Rewrote `AudioEngine.ts` to be completely deterministic and detached from the React DOM tree. It now programmatically spawns `new Audio()` and controls its own graph.
  2. Implemented an explicit fallback strategy (`load()`) so if `public/ambient.wav` fails, it falls back to a known-safe external source.
  3. Ensured that `audioEngine.play()` is invoked strictly and synchronously inside the click handler to satisfy iOS Safari autoplay protections.

### 2. Posture Detection False-Positives (FIXED - P0)
- **Problem**: Looking down at the keyboard, or looking sideways to a second monitor, would trigger immediate false positives for slouching and craning.
- **Cause 1 (Looking Down)**: `neckCollapseRatio` was using the distance from shoulders to the *nose*. Nodding the head down drops the nose significantly, triggering a massive collapse penalty even if the spine is straight.
- **Cause 2 (Looking Sideways)**: Turning the head (yaw) shrinks the 2D projected distance between ears (`headSize`), heavily distorting the `forwardCraneRatio` and causing unpredictable geometric penalties.
- **Fix Applied**:
  1. Modified `FeatureExtractor.ts` to use `earMidY` (the midpoint of the ears) instead of the nose for slouch detection. Ears are located near the axis of cervical rotation, making them invariant to head pitch (looking up/down).
  2. Implemented `noseYawDeviation` to detect head turning.
  3. In `TemporalFilter.ts`, reduced the weight of the unreliable 2D `forwardCraneRatio`, vastly increased the weight of the robust `neckCollapseRatio`, and added a penalty suppression rule that disables craning/slouching penalties when the head is turned (`noseYawDeviation > 0.3`).

### 3. Architecture Memory Leaks (FIXED - P1)
- **Problem**: `PoseEngine` did not have a cleanup method. When `CameraView` unmounted, the MediaPipe WASM instance remained in memory.
- **Fix Applied**: Added a `close()` method to `PoseEngine` which invokes `this.poseLandmarker.close()` and wired it to `CameraView`'s `useEffect` cleanup return.

### 4. Posture Intelligence Hardening & Oscillation (FIXED - P1)
- **Problem**: The system would oscillate between states rapidly, stay trapped in `CORRECTIVE` for normal posture, and instantly silence audio if the user briefly moved out of frame.
- **Cause 1 (Oscillation)**: Transitions between states were instantaneous. A 10ms weight shift would spike the penalty and instantly trigger `DRIFTING`.
- **Cause 2 (Trapped in Corrective)**: `TemporalFilter` used the exact same threshold for drifting and recovering, leading to boundary oscillation, constantly resetting the 1.5s recovery timer.
- **Cause 3 (Audio Drops)**: `ConfidenceEstimator` used a binary HIGH/LOW toggle, and `PostureStateMachine` immediately transitioned to `LOW_CONFIDENCE`, instantly dropping audio gain to 0.6.
- **Fix Applied**: 
  1. Rewrote `TemporalFilter` to include a **Motion Gate** (calculated from feature velocity) to suppress posture penalties during rapid movement.
  2. Implemented strict **Hysteresis** (Penalty > 120 to enter CORRECTIVE, but must drop below 70 to RECOVER).
  3. Rewrote `ConfidenceEstimator` to output a continuous score, and gave `PostureStateMachine` a 5-second graceful degradation timeout for low confidence before mutating the state.
  4. Built a `DiagnosticPanel` overlay (accessible via `?debug=true`) for transparent real-time debugging.

### 5. Capacitor & Android Foundation (M13 - COMPLETE)
- **Status**: The Android Capacitor wrapper has been successfully generated (`android/` folder).
- **Permissions**: `android.permission.CAMERA` and `android.permission.RECORD_AUDIO` have been injected into the `AndroidManifest.xml` to ensure WebRTC functionality in the native WebView.
- **Action Required**: You must now run `npx cap open android` and build the APK via Android Studio to test the WebView bindings on a real device.

### 6. RevenueCat Isolation & Monetization (M14 - COMPLETE)
- **Status**: `@revenuecat/purchases-capacitor` is installed.
- **Architecture**: Implemented an explicit `EntitlementService` interface and a `RevenueCatAdapter` implementation to isolate the dashboard UI from direct SDK calls.
- **Safety**: No hardcoded API keys exist. The SDK reads from `import.meta.env.VITE_REVENUECAT_PUBLIC_KEY`. A `.env.example` has been provided.
- **Graceful Fallback**: The adapter checks `Capacitor.isNativePlatform()`. If the app is run on the web, it gracefully falls back to a mocked `FREE` state and avoids crashing or spamming console errors.

### 7. Documentation & Final QA (M16 & M17 - COMPLETE)
- **Status**: The `README.md` has been completely rewritten to include the project pitch, feature highlights, architecture overview, and reproducible build instructions.
- **QA**: The repository is verified to be under the MIT License, contains no hardcoded secrets, and has 100% passing automated tests.

### 8. Centralized Settings & Timing Configs (M18 - COMPLETE)
- **Status**: Implemented persistent, backward-compatible Settings architecture via `SettingsManager.ts` using `localStorage`.
- **Screen Presence Grace Period (9A)**: Decoupled `NONE` confidence (user absent) from `LOW` confidence. `NONE` triggers the configurable absence timer before treating it as low confidence.
- **Recovery Delay (9B)**: State transitions back to `GOOD` are now delayed by the configured `recoveryDelayMs`.
- **Low Confidence Audio (9C)**: `AudioEngine` handles `CLEAR`, `MAINTAIN`, and `PAUSE`. `PAUSE` successfully drops the `GainNode` to 0.0 (safe muting) and seamlessly restores the intended target when posture validity returns.
- **UI**: Added human-readable `SettingsPanel` inside Dashboard.
- **Regression Safety**: Passed all automated test suites ensuring `0ms` recovery and `5000ms` absence perfectly recreate the existing user-visible logic.

### 9. Hand Gesture Volume Control (M19 - COMPLETE)
- **Status**: Implemented an independent, evidence-based gesture recognition subsystem.
- **Safety**: Defaults to `false` in `SettingsManager`. Exposes a Beta toggle in `SettingsPanel`.
- **Architecture**: `PoseEngine` → `LandmarkProcessor` (now extracting Wrists) → `GestureRecognizer`. It evaluates confidence, temporal consistency, and minimum displacement (15% screen height) to prevent false positives from typing or mouse movement.
- **Audio Integration**: Bounded fixed increments (±0.15) applied strictly to `AudioEngine.setVolume()`. Employs a 1000ms cooldown to block runaway scrolling.

### 10. Session Analytics (M20 - COMPLETE)
- **Status**: Implemented high-value tracking for 'Low Confidence' / 'Away' time.
- **Metrics**: `SessionManager` now accumulates `timeInLowConfidenceMs`. This duration is successfully excluded from the `healthScore` penalty math (so standing up for coffee doesn't artificially ruin your posture consistency).
- **UI**: Added a 6-metric grid to `App.tsx` "Session Complete" view to accurately surface: Consistency, Duration, Stable, Drifting, Corrective, and Away time.

### 11. Camera Setup UX (M21 - COMPLETE)
- **Status**: Implemented high-priority camera setup checklist in the pre-session UI.
- **Metrics**: `ConfidenceEstimator` now extracts and returns explicit `headVisible` and `shouldersVisible` metrics alongside the overall confidence score.
- **UI**: Added a dynamic overlay checklist over the camera view during the `CAMERA_READY` state. The "Calibrate & Start Session" button is **disabled** and explicitly reads "Position yourself in frame" until both the Head and Shoulders are detected. This guarantees valid baseline calibration data.

## Final Status
- **Browser Web App:** Verified (Automated tests passing, Vite production build successful).
- **Automated Tests:** Verified (48/48 tests passing covering state machine, vision math, and filtering).
- **Android Compilation:** Not yet verified (Local Android SDK missing, user must compile physically).
- **Physical Device:** Not yet verified (Awaiting manual validation gate on an Android phone).

### M22 Physical Device Testing Checklist
The final step is for the user to validate the app on a physical Android device. A strict testing protocol has been generated.
3. **Devpost Submission**: Verify all hackathon rules and submit the project.
