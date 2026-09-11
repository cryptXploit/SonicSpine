# SonicSpine — Architecture

## 1. Architectural Goal

SonicSpine is a local-first, privacy-conscious posture-awareness application.

Core runtime functionality should work without a backend, cloud AI API, database server, or hardware.

---

# 2. Core Architecture

Camera
↓
Pose Estimation
↓
Landmark Quality Check
↓
Feature Extraction
↓
Personal Calibration
↓
Temporal Filtering
↓
Posture Scoring
↓
Posture State Machine
↓
Adaptive Audio
↓
User Response
↓
Feedback Loop

Supporting systems:

RevenueCat
Local Storage
Capacitor / Android

---

# 3. Technology Stack

Preferred stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- MediaPipe Tasks Vision / Pose Landmarker
- Web Camera APIs
- Web Audio API
- Capacitor
- RevenueCat Capacitor SDK
- Vitest or equivalent lightweight test framework
- ESLint
- Prettier
- Git
- GitHub

Do not introduce Next.js unless a concrete requirement justifies it.

---

# 4. Runtime Architecture

The core system should be local:

Camera
→ Local pose inference
→ Local geometric reasoning
→ Local calibration
→ Local temporal reasoning
→ Local posture state
→ Local audio feedback
→ Local session metrics

No backend by default.

---

# 5. Computer Vision Layer

Create:

`src/vision/PoseEngine.ts`

Responsibilities:

- model initialization
- current supported API integration
- pose inference
- timestamps
- landmark output
- confidence/visibility information
- initialization error handling

Current MediaPipe APIs must be verified against official documentation before implementation.

Never use undocumented API behavior.

---

# 6. Landmark Processing

Create:

`src/vision/LandmarkProcessor.ts`

Responsibilities:

- validate landmark availability
- normalize required data
- calculate useful reference points
- detect insufficient input
- expose stable internal landmark structures

Relevant landmarks may include:

- nose
- left/right ear
- left/right shoulder
- left/right hip
- eyes where useful

Exact landmark identifiers must be verified against the current official MediaPipe documentation.

---

# 7. Confidence Layer

Create:

`src/vision/ConfidenceEstimator.ts`

Responsibilities:

- evaluate required landmark quality
- detect insufficient visibility/presence
- reject invalid frames
- provide confidence information to the posture engine

If confidence is insufficient:

`LOW_CONFIDENCE`

must be preferred over:

`CORRECTIVE`

Do not classify bad posture merely because the person cannot be reliably detected.

---

# 8. Feature Extraction

Create:

`src/vision/FeatureExtractor.ts`

Potential features:

- head tilt/orientation
- head displacement
- head-to-shoulder relationship
- shoulder orientation
- torso inclination
- relative landmark geometry
- confidence values

Feature extraction must remain independent of React UI.

No complex posture logic should live directly inside React components.

---

# 9. Personal Calibration

Create:

`src/posture/CalibrationEngine.ts`

Responsibilities:

- collect valid calibration samples
- reject invalid/low-confidence samples
- assess calibration stability
- calculate robust baseline
- expose calibration quality
- serialize baseline safely for local storage

Use robust statistics where justified.

Do not treat a universally fixed threshold as automatically correct for every user.

---

# 10. Posture Scoring

Create:

`src/posture/PostureScorer.ts`

Conceptual pipeline:

Feature deviations
→ normalization
→ weighted combination
→ posture deviation score

The weights and thresholds are product parameters and must be experimentally tuned.

They are not medical truths.

Do not describe the posture score as a clinical diagnostic measure.

---

# 11. Temporal Processing

Create:

`src/posture/TemporalFilter.ts`

Responsibilities:

- smoothing
- persistence
- debounce
- hysteresis support
- recovery persistence

The system must not react to one noisy frame.

A sustained pattern is more important than an isolated frame.

---

# 12. State Machine

Create:

`src/posture/StateMachine.ts`

Canonical states:

BOOT
CAMERA_READY
CALIBRATING
READY
GOOD
DRIFTING
CORRECTIVE
RECOVERING
LOW_CONFIDENCE
ERROR

State transitions must be explicit and testable.

Do not scatter state logic across UI components.

---

# 13. Audio Architecture

Create:

`src/audio/AudioEngine.ts`

and:

`src/audio/FilterController.ts`

Conceptual pipeline:

Audio Source
→ AudioContext
→ GainNode
→ BiquadFilterNode
→ Destination

The application should primarily demonstrate audio that SonicSpine itself controls.

Do not make the core demo depend on controlling Spotify, YouTube, or another external application's audio.

---

# 14. Audio Feedback Mapping

Create:

`src/audio/FeedbackMapper.ts`

Conceptual mapping:

GOOD
→ clear

DRIFTING
→ mild filtering

CORRECTIVE
→ stronger filtering

RECOVERING
→ smooth restoration

Avoid abrupt changes.

Avoid loud alarms.

Avoid feedback that unnecessarily compromises environmental awareness.

---

# 15. Platform Abstraction

Core posture logic should remain platform-independent.

Conceptual:

PostureInput
├── CameraPostureInput
├── future IMUPostureInput
└── future native posture input

Audio abstraction:

AudioEngine
├── WebAudioEngine
└── future NativeAudioEngine

Do not build unused abstractions prematurely.

---

# 16. Local Storage

Create:

`src/storage/CalibrationStore.ts`

`src/storage/SessionStore.ts`

Store only lightweight required data.

Potential stored values:

- baseline
- calibration quality
- settings
- session duration
- state durations
- session summaries

Do not store camera video.

---

# 17. Monetization Architecture

Create:

`src/monetization/EntitlementService.ts`

and:

`src/monetization/RevenueCatAdapter.ts`

UI should communicate with an entitlement abstraction rather than directly coupling every component to RevenueCat.

Verify current RevenueCat Capacitor implementation before coding.

Never commit secret RevenueCat credentials.

---

# 18. Capacitor Architecture

Browser-first development:

React
↓
stable web application
↓
Capacitor
↓
Android project
↓
real-device testing

Capacitor-specific code should remain isolated wherever practical.

---

# 19. Backend Policy

No backend by default.

A backend may only be introduced if a concrete requirement justifies:

- data flow
- privacy
- latency
- cost
- operational complexity

must be documented first.

---

# 20. AI Policy

No cloud LLM is required for the core product.

Do not introduce an LLM unless a future feature has a genuine use case.

Core intelligence is:

- computer vision
- geometry
- calibration
- temporal signal processing
- state-machine reasoning
- adaptive audio

---

# 21. RAG Policy

Runtime RAG is not required.

Research material may be stored in:

`docs/research/`

but this does not become a runtime dependency.

---

# 22. Privacy

Default design:

Camera frames → local
Pose inference → local
Calibration → local
Posture features → local
Session metrics → local

No camera-footage upload is required.

Only claim privacy properties that are actually implemented and verified.

---

# 23. Error Boundaries

Separate:

- camera errors
- model errors
- calibration errors
- posture-engine errors
- audio errors
- monetization errors

A non-core failure should not unnecessarily crash the entire application.

---

# 24. Performance

Do not invent latency or FPS numbers.

Measure where practical:

- capture time
- inference time
- feature-processing time
- decision time
- audio-update time

Optimize based on measured bottlenecks.

Do not introduce Web Workers or complex scheduling unless profiling justifies them.

---

# 25. Memory

Do not accumulate raw camera frames indefinitely.

Process and discard frames.

Calibration should retain extracted feature samples rather than raw video.

Session history should retain lightweight metrics.

---

# 26. Suggested Directory Structure

sonicspine/

├── src/
│   ├── app/
│   ├── components/
│   │   ├── CameraView/
│   │   ├── Calibration/
│   │   ├── PostureIndicator/
│   │   ├── AudioPlayer/
│   │   ├── SessionDashboard/
│   │   └── Settings/
│   │
│   ├── vision/
│   │   ├── PoseEngine.ts
│   │   ├── LandmarkProcessor.ts
│   │   ├── FeatureExtractor.ts
│   │   └── ConfidenceEstimator.ts
│   │
│   ├── posture/
│   │   ├── CalibrationEngine.ts
│   │   ├── PostureScorer.ts
│   │   ├── TemporalFilter.ts
│   │   ├── StateMachine.ts
│   │   └── thresholds.ts
│   │
│   ├── audio/
│   │   ├── AudioEngine.ts
│   │   ├── FilterController.ts
│   │   └── FeedbackMapper.ts
│   │
│   ├── storage/
│   │   ├── CalibrationStore.ts
│   │   └── SessionStore.ts
│   │
│   ├── monetization/
│   │   ├── EntitlementService.ts
│   │   └── RevenueCatAdapter.ts
│   │
│   ├── types/
│   └── utils/
│
├── public/
├── android/
├── docs/
├── tests/
├── README.md
├── LICENSE
├── package.json
└── capacitor.config.ts