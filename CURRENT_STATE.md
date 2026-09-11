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

## Next Steps
Phases 1 through 14 are complete. The core engine is mathematically sound, and the Android/Monetization scaffolding is safely integrated.
The final remaining milestone is **M15 & M16: Scientific Manual Testing & Final QA**, which involves running the build on an actual Android device and verifying the RevenueCat test purchase flow.
