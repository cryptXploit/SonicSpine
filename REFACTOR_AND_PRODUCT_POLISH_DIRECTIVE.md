# SONICSPINE — REFACTOR & PRODUCT POLISH DIRECTIVE

This document temporarily takes priority over the normal feature roadmap because the current implementation needs a serious quality, performance, posture-detection, and UX correction pass before more features are added.

The goal is NOT to add random new features.

The goal is to transform the current prototype into a coherent, lightweight, polished, testable product.

---

# 1. FIRST: STOP FOLLOWING THE OLD ROADMAP BLINDLY

Do NOT immediately continue to the next numbered milestone.

First inspect the current repository and existing implementation.

The project already contains substantial work across:

* camera pipeline
* MediaPipe pose estimation
* feature extraction
* calibration
* temporal filtering
* posture state machine
* adaptive audio
* session analytics
* local persistence
* posture dashboard
* Capacitor/PWA foundation

Therefore, the next phase is a QUALITY / REFACTOR / PRODUCT INTEGRATION PHASE.

Do not rebuild working functionality from scratch without evidence that it is defective.

---

# 2. USER-REPORTED PROBLEMS TO TREAT AS REAL PRODUCT BUGS

The current application has these reported issues:

1. The visual design/outlook is poor.
2. The application feels cheap and unfinished.
3. Camera processing appears laggy.
4. The application may become too heavy for mobile devices if the current processing architecture is retained.
5. Posture detection is currently weak and does not feel reliable.
6. The visible posture visualization appears overly simplistic, approximately like a basic angle/90-degree demonstration.
7. The actual posture intelligence is not convincingly communicated.
8. The music/audio experience is not centrally integrated into the product experience.
9. The current screen structure does not feel like one coherent product.
10. The application needs a professional, lightweight, mobile-first visual system suitable for a hackathon-winning demo.

These are not reasons to hide the problems.

They are reasons to inspect, measure, refactor, and improve the implementation.

---

# 3. FIRST TASK: FULL CURRENT-STATE AUDIT

Before changing code, inspect:

* package.json
* all source files
* App.tsx
* CameraView
* PoseEngine
* LandmarkProcessor
* ConfidenceEstimator
* FeatureExtractor
* CalibrationEngine
* TemporalFilter
* PostureStateMachine
* AudioEngine
* SessionManager
* Database
* Dashboard
* Capacitor configuration
* CSS/Tailwind configuration
* current tests
* current documentation

Also inspect:

* unnecessary re-renders
* camera frame processing frequency
* canvas operations
* pose inference loop
* state updates per frame
* audio updates per frame
* object allocations per frame
* useEffect dependencies
* event listeners
* timers
* stale subscriptions
* repeated MediaPipe initialization
* React component coupling

Do NOT modify anything until this audit is complete.

---

# 4. PERFORMANCE IS NOW A P0 PRIORITY

The application must be lightweight enough for mobile.

Do NOT solve lag by simply hiding the camera or removing the feature.

Find the actual bottleneck.

Measure before optimizing.

Investigate:

* actual inference frequency
* render frequency
* CPU usage where practical
* frame drops where measurable
* main-thread blocking
* repeated calculations
* redundant React state updates
* unnecessary canvas rendering
* unnecessary DOM updates
* excessive feature recalculation
* model initialization lifecycle
* object allocation pressure

Do not invent performance numbers.

---

# 5. CAMERA / VISION PERFORMANCE POLICY

Separate the real-time vision loop from high-frequency React rendering.

The vision pipeline should NOT cause React to re-render the entire application on every camera frame.

Avoid patterns equivalent to:

```text
camera frame
→ setState()
→ full React tree render
→ camera frame
→ setState()
→ full React tree render
```

Prefer:

```text
camera frame
→ pose inference
→ internal vision processing
→ minimal state/event changes
→ React updates only when the UI actually needs to change
```

Use refs, subscriptions, or other suitable mechanisms where justified.

Do not introduce a complicated Worker architecture unless profiling demonstrates that the main thread requires it.

---

# 6. ADAPTIVE INFERENCE

Do not blindly run expensive pose inference at the maximum possible frame rate.

Investigate an adaptive strategy.

The implementation may use:

* controlled inference frequency
* frame skipping
* timestamp-based scheduling
* device-aware quality
* reduced inference during non-critical UI states

The exact strategy must be based on actual observed performance.

The objective is:

> smooth user experience with sufficiently responsive posture feedback.

Do NOT claim a specific FPS or latency until it has been measured.

---

# 7. MODEL LIFECYCLE

The pose model should initialize once per appropriate application/session lifecycle.

Do NOT repeatedly create the model.

Verify:

* initialization
* teardown
* camera lifecycle
* session restart
* calibration restart
* navigation/re-render behavior

There must not be hidden duplicate model initialization.

---

# 8. CAMERA RESOLUTION

Do not automatically use unnecessarily high camera resolution.

Investigate the minimum practical resolution that still provides adequate landmark quality for this product.

Use a sensible balance between:

```text
accuracy
performance
memory
battery
```

Measure where practical.

---

# 9. UI PERFORMANCE

The UI must not re-render expensive components unnecessarily.

Inspect:

* CameraView
* pose overlay
* posture indicator
* audio controls
* session dashboard
* historical dashboard

Use memoization only where it provides a meaningful benefit.

Do not add memoization everywhere blindly.

---

# 10. REMOVE UNNECESSARY VISUAL PROCESSING

If the current skeleton/overlay is only visually decorative and contributes to performance cost, redesign it.

The posture visualization should communicate useful information rather than merely draw a cheap-looking skeleton.

Possible visual concepts:

* posture alignment guide
* head/shoulder alignment indicator
* subtle live deviation indicator
* baseline relationship
* state-driven visual feedback

Do NOT show a fake anatomical/medical diagram.

---

# 11. POSTURE DETECTION MUST BE REWORKED

The current posture detection is not sufficiently convincing.

Do NOT merely change the UI while leaving weak detection logic underneath.

First inspect the actual mathematical features currently implemented.

Verify exactly what:

* `headTilt`
* `shoulderRoll`
* `neckForwardDepth`
* `shoulderWidth`

mean in the actual code.

Do not trust earlier descriptions blindly.

Then evaluate whether the current features actually represent the posture problem we want to detect.

---

# 12. DO NOT USE A SINGLE ANGLE AS THE PRODUCT'S CORE TRUTH

The system must not effectively behave like:

```text
angle > threshold
→ bad posture
```

Instead use a multi-signal approach where justified:

```text
head displacement
+
head/shoulder relationship
+
torso relationship
+
head orientation
+
confidence
+
temporal persistence
```

The final scoring method must be explainable.

---

# 13. PERSONAL BASELINE MUST BE MEANINGFUL

Inspect the current calibration implementation.

Determine:

* what exactly is being calibrated
* how many samples are used
* how invalid samples are rejected
* whether normalization is used
* whether the baseline is robust to small natural movement
* whether the baseline is actually used by posture scoring

The system must not claim personalized posture detection unless the baseline genuinely affects the decision.

---

# 14. CAMERA GEOMETRY MUST BE HANDLED

Recognize that apparent posture changes can result from:

* camera height
* camera tilt
* camera distance
* user position
* partial framing

Design the onboarding/setup experience around a controlled camera position.

The product should guide the user to a reasonable framing before calibration.

Do not pretend 2D camera data is equivalent to clinical measurement.

---

# 15. LOW-CONFIDENCE MODE

When the model cannot confidently determine the required landmarks:

Do NOT say:

> bad posture

Instead:

```text
LOW_CONFIDENCE
```

with user-facing guidance such as:

> Move into view

or:

> Adjust camera position

The system should never confuse "I cannot see you" with "your posture is bad."

---

# 16. POSTURE STATE DESIGN

Retain the conceptual state-machine architecture where useful.

Possible states:

```text
SETUP
CALIBRATING
READY
GOOD
DRIFTING
CORRECTIVE
RECOVERING
LOW_CONFIDENCE
ERROR
```

However, simplify the user-facing language.

The internal state machine may remain detailed.

The user-facing experience should feel simple.

---

# 17. POSTURE UI MUST LOOK PREMIUM

Replace the current simplistic posture presentation.

The user should not see an amateur-looking "90 degree" style visualization as the main product experience.

Instead create a premium posture status area containing:

* current state
* subtle visual posture indicator
* deviation trend
* confidence/quality indicator where useful
* short explanatory message

Example:

```text
GOOD
You're in your calibrated posture.
```

or:

```text
DRIFTING
Your posture is moving away from your baseline.
```

or:

```text
RECOVER
Return to your calibrated position.
```

Do not use medical language.

---

# 18. CENTRAL PRODUCT EXPERIENCE

The application should feel like one product.

Do NOT make:

* camera page
* music page
* analytics page
* dashboard page

feel like unrelated mini-apps.

Create a central session experience.

Recommended conceptual structure:

```text
HOME / SETUP
      ↓
FOCUS SESSION
      ↓
SESSION SUMMARY
      ↓
PROGRESS / HISTORY
```

The primary focus session should contain:

```text
camera/vision
+
posture status
+
music controls
+
session timer
+
minimal analytics
```

---

# 19. MUSIC MUST BE CENTRALLY INTEGRATED

Music is part of the SonicSpine concept, not an afterthought.

During the main Focus Session, the interface should show a compact music control area.

It should include, where practical:

* play/pause
* current track
* volume
* mute
* filter/feedback status
* optionally track selection

The music must visibly be part of the posture feedback loop.

Example:

```text
FOCUS SESSION

Posture: GOOD

[ waveform / subtle visual ]

Music
Ambient Focus
▶  ━━━━━━━

Audio Feedback
CLEAR
```

When posture drifts:

```text
Posture: DRIFTING

Audio Feedback
SOFTENING
```

When corrective:

```text
Posture: CORRECTIVE

Audio Feedback
MUFFLED
```

The user should immediately understand the relationship:

> posture → audio response.

---

# 20. AUDIO MUST NOT FEEL LIKE A SEPARATE DEMO

The audio engine already exists.

Do not create a second unrelated audio system.

Inspect and centralize the existing `AudioEngine`.

There must be one authoritative audio lifecycle.

Avoid:

* duplicate AudioContexts
* duplicate audio elements
* multiple playback controllers
* multiple state sources controlling audio

Create a single clear ownership model.

---

# 21. AUDIO FEEDBACK DESIGN

Use gradual feedback.

Preferred concept:

```text
GOOD
→ clear

DRIFTING
→ subtle filtering

CORRECTIVE
→ noticeable but comfortable filtering

RECOVERING
→ smooth restoration
```

Do not use abrupt destructive changes.

Do not create loud alarms.

Do not unexpectedly disable important environmental awareness.

---

# 22. MUSIC SOURCE

Inspect the current hardcoded audio source.

Replace hardcoded external URLs if they are brittle or inappropriate.

Prefer a bundled/licensed/local audio asset suitable for the hackathon.

Verify asset licensing.

Provide at least one reliable demo track that works without external network dependency where practical.

Optional local track upload may be considered later, but it is NOT a priority over core reliability.

---

# 23. MOBILE-FIRST DESIGN

The UI must be designed for a phone first.

Requirements:

* thumb-friendly controls
* large touch targets
* responsive camera area
* no horizontal overflow
* no excessive scrolling during an active session
* clear primary action
* readable typography
* sensible spacing
* low visual clutter
* dark/light styling if appropriate
* safe-area awareness where relevant

Do not design the desktop layout first and simply squeeze it onto a mobile screen.

---

# 24. VISUAL DESIGN DIRECTION

The visual direction should feel:

* modern
* minimal
* premium
* technical
* calm
* focused

Avoid:

* generic dashboard templates
* excessive gradients
* excessive glassmorphism
* cheap neon effects
* giant text
* cluttered cards
* unnecessary animations
* random decorative graphics

Use motion only where it communicates state or improves interaction.

---

# 25. MAIN SCREEN

Design a single strong home/setup screen.

Possible structure:

```text
SONICSPINE

Good posture starts with your baseline.

[ Camera preview ]

Camera status
Ready

[ Calibrate ]

Recent consistency
78%

Last session
24 min
```

Do not finalize this exact UI without inspecting the existing implementation.

This is a direction, not a rigid design.

---

# 26. FOCUS SESSION SCREEN

This should become the hero screen.

Concept:

```text
SONICSPINE

GOOD
You're in your calibrated posture.

[ live visual ]

18:42
Focus Session

Audio
Ambient Focus
▶ ━━━━━━━

Feedback
CLEAR
```

When posture changes, the screen should respond subtly.

---

# 27. SESSION SUMMARY

Replace any misleading term such as "Health Score" if it implies medical measurement.

Prefer concepts such as:

* Posture Consistency
* Session Consistency
* Time in Calibrated Range
* Corrections
* Longest Stable Streak

Do NOT call it a medical health score.

---

# 28. ANALYTICS

Keep analytics useful and simple.

Possible metrics:

* session duration
* time within calibrated range
* sustained deviations
* longest stable streak
* correction count
* recent consistency trend

Avoid charts that add complexity without value.

---

# 29. HISTORY / DASHBOARD

The existing dashboard should become part of the overall product flow rather than a separate generic data table.

Use the existing IndexedDB persistence where valid.

Do not introduce a server.

Do not introduce a cloud database.

---

# 30. PRODUCT LANGUAGE

Use consistent terminology.

Preferred:

* Calibrate
* Baseline
* Good
* Drifting
* Corrective
* Recovering
* Low confidence
* Posture consistency
* Focus session
* Audio feedback

Avoid:

* Health Score
* Disease
* Diagnosis
* Clinical accuracy
* Perfect posture
* Medical correction

unless evidence later justifies stronger terminology.

---

# 31. ADDITIONAL FEATURES — ONLY AFTER CORE REFACTOR

Do not add features until:

1. camera performance is acceptable
2. posture detection is meaningfully improved
3. music is centrally integrated
4. visual design is polished
5. full end-to-end flow works

Then consider, in priority order:

## P1

* sensitivity control
* recalibration control
* session history
* posture consistency trend
* audio feedback settings

## P2

* posture heatmap
* daily/weekly insights
* multiple audio profiles

## P3

* experimental hardware abstraction
* native Android enhancements

Do not build social features, chatbots, RAG, unnecessary AI, or complex backends.

---

# 32. TEST THE ACTUAL POSTURE ENGINE

Create or improve tests for:

* neutral position
* sustained deviation
* brief motion
* head rotation
* camera repositioning
* low confidence
* recovery
* different baseline values
* different body proportions where the geometry supports testing

Unit tests alone are insufficient.

Create deterministic synthetic feature tests AND human/device tests.

---

# 33. HUMAN TEST PROTOCOL

Prepare a structured manual protocol.

At minimum:

### Test A — Neutral

Remain in calibrated posture.

Expected:
GOOD.

### Test B — Brief motion

Move briefly.

Expected:
No immediate corrective action.

### Test C — Sustained deviation

Hold a posture deviation.

Expected:
DRIFTING → CORRECTIVE according to configured persistence.

### Test D — Recovery

Return to baseline.

Expected:
RECOVERING → GOOD.

### Test E — Camera visibility

Move partially out of frame.

Expected:
LOW_CONFIDENCE.

### Test F — Camera framing

Change device position.

Expected:
System either remains appropriately stable or requests recalibration/setup.

### Test G — Multiple users

Run calibration independently for different people.

Expected:
Personalized baselines differ appropriately.

---

# 34. PERFORMANCE TEST

Create a manual/automated performance report where practical.

Record:

* device
* OS
* browser/app
* model version
* inference cadence
* perceived lag
* measured latency if available

Do not invent results.

---

# 35. CAMERA LAG INVESTIGATION

If lag exists:

First identify whether the bottleneck is:

* inference
* canvas
* React rendering
* video resolution
* audio updates
* object allocation
* browser limitations

Then fix the actual cause.

Do NOT randomly reduce everything until the app becomes inaccurate.

The goal is balanced performance.

---

# 36. RENDERING STRATEGY

The camera stream should remain smooth even if posture UI changes.

Separate:

```text
camera rendering
vision processing
posture state
UI rendering
audio processing
```

as much as the architecture reasonably allows.

---

# 37. AUDIO UPDATE FREQUENCY

Do not update Web Audio parameters on every frame unless necessary.

Only update when meaningful posture state or feedback intensity changes.

Use smooth audio parameter transitions.

---

# 38. DATA FLOW

Prefer this centralized flow:

```text
Camera
 ↓
Pose Engine
 ↓
Validated Landmarks
 ↓
Feature Extraction
 ↓
Calibration / Baseline
 ↓
Posture Scoring
 ↓
Temporal Processing
 ↓
Posture State
 ↓
Session Analytics
 ↓
UI State
 ↓
Audio Feedback
```

There must be one authoritative posture state.

Avoid parallel duplicate posture calculations.

---

# 39. SINGLE SOURCE OF TRUTH

There should not be:

* one posture state in CameraView
* another posture state in App
* another state in AudioEngine
* another state in Analytics

Create a clear authoritative posture state model.

Other systems consume it.

---

# 40. APP.TSX REFACTOR

If `App.tsx` currently contains too much orchestration logic, refactor it.

`App.tsx` should primarily compose the application.

Move complex logic into dedicated services/hooks/controllers where appropriate.

Do not over-engineer.

---

# 41. UI / BUSINESS / ENGINE SEPARATION

Maintain clear separation:

```text
Vision
Posture Intelligence
Audio
Analytics
Storage
Monetization
UI
```

UI should not contain complex posture mathematics.

Posture logic should not directly manipulate DOM elements.

Audio should not own application navigation.

---

# 42. MOBILE MEMORY

Avoid:

* storing video frames
* large in-memory history
* repeated model creation
* unnecessary image buffers
* unbounded logs
* excessive canvas snapshots

Core sessions should remain lightweight.

---

# 43. CAPACITOR COMPATIBILITY

The current architecture already has Capacitor configuration.

Do not claim Android functionality is complete until an actual Android build/device test has been performed.

During this refactor, ensure browser APIs used by the core experience have a viable Capacitor path.

Identify any browser-only dependency that may fail on Android.

---

# 44. NO PREMATURE NATIVE WORK

Do not add custom native plugins unless required.

First make the web/core experience excellent.

Then verify Android packaging.

Only add native functionality when browser/WebView behavior genuinely cannot satisfy the product requirement.

---

# 45. REVENUECAT

Do not let RevenueCat interrupt the core product refactor.

After the core experience is stable:

* keep the entitlement layer isolated
* verify current Capacitor SDK compatibility
* use supported test/sandbox functionality
* never commit secrets
* ensure the demo remains freely testable

---

# 46. NO RAG

Do not add runtime RAG.

It does not solve SonicSpine's main problem.

---

# 47. NO CLOUD POSTURE API

Do not send camera frames to a cloud API for posture classification unless a future requirement explicitly justifies it and the cost/privacy implications are acceptable.

The current product should remain local-first.

---

# 48. RESEARCH CHECKPOINT

Before changing the posture algorithm materially:

1. Inspect the current implementation.
2. Research current relevant posture-assessment literature.
3. Verify which metrics are appropriate.
4. Map the research method to the actual camera setup.
5. Identify limitations.
6. Implement.
7. Test.
8. Document.

Do not claim medical validity.

---

# 49. RESEARCH EVIDENCE RULE

Every major new scientific claim should be added to:

`RESEARCH_EVIDENCE.md`

with:

* claim
* source
* what it supports
* what it does not support
* implementation consequence

---

# 50. DOCUMENTATION UPDATE RULE

After this refactor update:

* CURRENT_STATE.md
* ROADMAP.md
* ARCHITECTURE.md
* DECISIONS.md
* TESTING_PROTOCOL.md
* RESEARCH_EVIDENCE.md

Only mark work complete after actual verification.

---

# 51. GIT SAFETY

Before changes:

```text
git status
```

Before major refactors:

Create a safe checkpoint commit if the repository has uncommitted working changes.

Do not discard existing work.

After coherent changes:

* test
* build
* review
* commit

Do not blindly push broken code.

---

# 52. REQUIRED OUTPUT FROM THIS TASK

After inspection, report:

## Current Problems Found

List the actual evidence-based issues.

## Performance Bottlenecks

List measured or code-supported causes.

## Posture Detection Problems

Explain the actual weaknesses.

## Architecture Problems

List coupling/duplication.

## UI Problems

Describe what is structurally wrong.

## Refactor Plan

Give the exact order of fixes.

## Feature Plan

Only recommend features that fit the project after the core refactor.

Do not immediately implement everything in one giant change.

---

# 53. IMPLEMENTATION ORDER

The recommended order is:

```text
1. Audit
2. Performance diagnosis
3. Vision-loop optimization
4. Posture-engine validation/refinement
5. State/data-flow cleanup
6. Centralized audio integration
7. Complete UI/UX redesign
8. Session experience refinement
9. Analytics refinement
10. Mobile/Capacitor verification
11. RevenueCat verification
12. Full regression testing
13. Demo preparation
```

Do not reverse this order without a documented reason.

---

# 54. IMPORTANT: DO NOT TRUST PREVIOUS AI REPORTS

Previous generated reports may contain incorrect claims such as:

* "fully functional"
* "perfect"
* "complete"
* "verified"
* "no lag"
* "accurate"

Treat all such statements as historical claims.

Inspect the actual code and verify current behavior yourself.

---

# 55. FINAL QUALITY BAR

The finished product should feel like:

> a real, coherent product

not:

> a collection of hackathon features.

The judge should be able to understand in seconds:

```text
This is SonicSpine.
It watches my posture locally.
It learned my baseline.
When I drift for long enough,
my music subtly changes.
When I recover,
the music returns.
```

That experience must work reliably before adding anything else.

---

# 56. MANUAL TESTING REQUIREMENT

After every completed refactor milestone, provide the user with:

* exact commands
* exact steps
* exact expected behavior
* what counts as failure
* what evidence to record

Example:

```text
Run:
npm run dev

Then:

1. Open the app.
2. Allow camera access.
3. Calibrate.
4. Start a Focus Session.
5. Stay neutral for 20 seconds.
6. Lean forward for at least the configured persistence period.
7. Observe posture state.
8. Observe audio.
9. Return to baseline.
10. Observe recovery.

Expected:
...
Failure condition:
...
```

Do not merely say:

> "Test it manually."

---

# 57. IMPORTANT COMMAND BEHAVIOR

When the user says:

`next`

continue from the current verified state.

Before implementation:

* inspect CURRENT_STATE.md
* inspect this directive
* inspect ROADMAP.md
* inspect relevant code
* verify necessary APIs/research

Then:

```text
plan
→ implement
→ test
→ build
→ manual test instructions
→ documentation update
```

---

# 58. END GOAL

The goal is NOT to maximize feature count.

The goal is:

```text
LOW LATENCY
+
LIGHTWEIGHT
+
RELIABLE POSTURE INTELLIGENCE
+
PERSONALIZATION
+
PREMIUM UX
+
CENTRALIZED MUSIC FEEDBACK
+
PRIVACY
+
CAPACITOR COMPATIBILITY
+
REVENUECAT READINESS
+
HONEST TESTING
+
STRONG HACKATHON DEMO
```

END OF DIRECTIVE.
