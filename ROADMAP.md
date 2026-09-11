# SonicSpine — Roadmap

## Project Goal

Build a reliable, privacy-first, camera-based posture awareness application that uses personalized calibration, computer-vision posture estimation, temporal reasoning, and adaptive audio feedback.

The MVP must be functional within approximately 20 days and must not depend on paid AI APIs, cloud infrastructure, or hardware.

---

# Priority System

## P0 — Core / Mandatory

- Project foundation
- Camera pipeline
- Pose estimation
- Landmark confidence handling
- Feature extraction
- Personal calibration
- Posture scoring
- Temporal filtering
- Posture state machine
- Adaptive audio feedback
- Recovery detection
- Basic UX
- Error handling
- Automated tests
- Manual testing
- Working Android build

## P1 — Important

- Performance optimization based on measurements
- Session analytics
- Local persistence
- RevenueCat integration
- Capacitor refinement
- Android device testing
- Privacy UX
- Accessibility refinement

## P2 — Optional

- Posture heatmap
- Daily posture consistency
- Adaptive sensitivity
- Additional audio feedback profiles
- Historical analytics
- Advanced session insights

## P3 — Experimental / Only if time remains

- IMU abstraction
- Future hardware support
- Native Android audio experiments
- Additional experimental integrations

Never sacrifice P0 functionality to implement P2 or P3 features.

---

# Milestones

## M1 — Repository Foundation

- Inspect repository
- Establish React + TypeScript + Vite foundation if needed
- Establish Tailwind if needed
- Establish linting
- Establish testing
- Establish Git workflow
- Establish project documentation
- Ensure reproducible local setup

Acceptance:

- Project installs successfully
- Development server runs
- Build succeeds
- Test framework runs

---

## M2 — Camera Pipeline

- Request camera permission
- Initialize camera
- Display live camera stream
- Handle denied permission
- Handle unavailable camera
- Handle invalid camera state

Acceptance:

- Camera works in supported browser/device environment
- Errors are handled gracefully
- No unnecessary camera data is stored

---

## M3 — Pose Engine

- Integrate current supported MediaPipe Pose Landmarker implementation
- Verify current API usage against official documentation
- Extract required landmarks
- Expose confidence/visibility information
- Visualize landmarks during development

Acceptance:

- Pose inference runs
- Required landmarks are available
- Low-confidence conditions can be detected

---

## M4 — Feature Extraction

Create a dedicated feature extraction layer.

Potential features:

- head orientation/tilt
- head displacement relative to baseline
- head-to-shoulder relationship
- shoulder orientation
- torso inclination
- relevant geometric relationships
- confidence metrics

Acceptance:

- Features are produced independently of UI
- Unit tests exist for deterministic geometry
- No single raw pixel threshold is used as the complete posture detector

---

## M5 — Personal Calibration

Create a calibration flow.

Calibration should:

- guide the user into a stable natural sitting position
- collect several seconds of valid samples
- reject unstable/low-confidence calibration
- generate a personal baseline
- store calibration locally

Acceptance:

- Stable calibration produces a baseline
- Unstable calibration is rejected
- Baseline is reproducible

---

## M6 — Temporal Intelligence

Implement:

- smoothing
- temporal persistence
- debounce where appropriate
- hysteresis
- recovery persistence

Acceptance:

- One-frame movement does not immediately trigger correction
- Sustained deviation can trigger correction
- Recovery is stable
- Rapid oscillation between states is prevented

---

## M7 — Posture State Machine

Canonical states:

- BOOT
- CAMERA_READY
- CALIBRATING
- READY
- GOOD
- DRIFTING
- CORRECTIVE
- RECOVERING
- LOW_CONFIDENCE
- ERROR

Acceptance:

- State transitions are explicit
- State logic is isolated from UI
- State transition tests exist

---

## M8 — Adaptive Audio Engine

Use the application's own controllable audio source.

Preferred conceptual pipeline:

Audio Source
→ AudioContext
→ GainNode
→ BiquadFilterNode
→ Destination

Behavior:

- GOOD → clear audio
- DRIFTING → mild filtering
- CORRECTIVE → stronger filtering
- RECOVERING → gradually restore
- GOOD → clear

Acceptance:

- Audio parameters change smoothly
- No abrupt unpleasant audio changes
- Recovery restores normal audio
- Audio failure does not crash posture tracking

---

## M9 — Full Core Loop

Complete:

Camera
→ Pose
→ Quality Check
→ Features
→ Calibration
→ Temporal Processing
→ Posture State
→ Adaptive Audio
→ Recovery

Acceptance:

The complete end-to-end scenario works reliably.

---

## M10 — UX / Product Polish

Screens:

- Welcome
- Camera Setup
- Calibration
- Focus Session
- Session Summary
- Settings

Requirements:

- Minimal UI
- Clear state feedback
- Clear errors
- No unnecessary screens
- No medical claims
- No intrusive alarms

---

## M11 — Local Persistence

Store only necessary data.

Potential data:

- calibration baseline
- calibration quality
- user settings
- lightweight session metrics
- session summaries

Do not store raw camera footage.

---

## M12 — Performance Engineering

Measure before optimizing.

Potential metrics:

- inference frequency
- processing latency
- state-decision latency
- audio update latency
- CPU usage where practical
- memory behavior

Do not invent performance numbers.

Acceptance:

- No obvious frame-processing bottleneck
- No memory-growth issue during normal sessions
- Measured performance documented

---

## M13 — Capacitor / Android

After browser/core functionality is stable:

- integrate Capacitor
- create Android project
- configure required permissions
- build APK
- test on available Android device

Acceptance:

- APK builds successfully
- Camera works on target device
- Core posture flow works
- Adaptive audio works as implemented

---

## M14 — RevenueCat

Integrate RevenueCat through an abstraction layer.

Requirements:

- entitlement service
- RevenueCat adapter
- test/sandbox flow where appropriate
- no secret credentials committed
- core judging flow remains accessible

Acceptance:

- SDK integration builds
- entitlement state can be read
- test purchase/subscription flow can be verified using the currently supported testing mechanism

---

## M15 — Scientific / Manual Testing

Run controlled tests.

Test conditions:

- neutral
- slight forward deviation
- moderate forward deviation
- sustained deviation
- recovery
- brief movement
- head rotation
- unrelated movement
- low-confidence condition
- different users
- different camera distances
- different lighting

Measure where practical:

- precision
- recall
- F1
- false-positive rate
- detection latency
- recovery latency

Only report actual measured results.

---

## M16 — Final QA

Freeze core features.

Verify:

- install
- build
- camera
- pose engine
- calibration
- posture states
- audio
- recovery
- local storage
- RevenueCat
- Capacitor
- Android
- error handling
- tests
- README

Fix P0/P1 issues before cosmetic work.

---

## M17 — Repository Finalization

Ensure:

- public repository
- open-source LICENSE
- source code
- assets
- setup instructions
- architecture documentation
- testing documentation
- research references
- reproducible build instructions

---

## M18 — Demo Assets

Create:

- 1024×1024 app icon
- required app screenshot(s)
- under-two-minute demo video
- final project description

Demo must clearly show:

1. calibration
2. normal posture
3. posture deviation
4. audio response
5. recovery

---

## M19 — Devpost Finalization

Re-check the current official hackathon rules before submission.

Verify:

- Next Gen eligibility
- required developer tools
- repository requirement
- open-source license
- demo video requirements
- screenshot requirements
- icon requirements
- RevenueCat requirement
- submission category
- deadline

---

## M20 — Final Submission

Perform final verification.

Do not make risky architectural changes immediately before submission.

Final state must be reproducible and demonstrable.