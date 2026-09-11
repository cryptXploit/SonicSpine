
---

# SonicSpine — Testing Protocol

## 1. Testing Philosophy

Never declare a feature complete merely because the code compiles.

Testing must include:

1. Automated verification
2. Integration verification
3. Manual human/device testing
4. Performance measurement where relevant

---

# 2. Required Verification Sequence

For each significant feature:

Define expected behavior
→ write/update tests
→ implement
→ run tests
→ run lint/type checks
→ run build
→ review
→ perform manual test
→ record result
→ update CURRENT_STATE.md

---

# 3. Automated Tests

Test independently:

- feature calculations
- normalization
- calibration
- calibration rejection
- confidence handling
- posture scoring
- temporal filtering
- hysteresis
- state transitions
- recovery
- audio feedback mapping
- local-storage serialization
- entitlement logic

---

# 4. Integration Tests

The following flow must be testable:

Calibration
→ posture features
→ posture scoring
→ temporal processing
→ state transition
→ audio-feedback mapping

Test both normal and failure conditions.

---

# 5. Camera Tests

Verify:

- camera permission request
- permission granted
- permission denied
- camera unavailable
- camera initialization failure
- camera stream starts
- camera stream stops
- user leaves frame
- user returns to frame

Expected behavior must be explicitly documented.

---

# 6. Pose Tests

Verify:

- pose model initializes
- valid landmarks are received
- required landmarks are identified correctly
- confidence/visibility is processed
- low-confidence frames are rejected from posture correction logic
- model errors are handled

Do not use undocumented MediaPipe behavior.

---

# 7. Calibration Tests

### Test CAL-001 — Stable Calibration

Steps:

1. Start calibration.
2. Sit naturally.
3. Remain reasonably still.
4. Maintain valid visibility.
5. Complete calibration.

Expected:

- Valid baseline is produced.
- Calibration quality is acceptable.
- Session can continue.

---

### Test CAL-002 — Unstable Calibration

Steps:

1. Start calibration.
2. Move substantially during calibration.
3. Allow landmark quality to vary.

Expected:

- Calibration is rejected or marked insufficient.
- User is asked to retry.

---

# 8. Posture Detection Tests

Test at minimum:

### PT-001
Neutral posture.

Expected:

GOOD or appropriate neutral state.

### PT-002
Brief forward movement.

Expected:

No immediate CORRECTIVE transition.

### PT-003
Sustained deviation.

Expected:

DRIFTING and/or CORRECTIVE transition according to configured logic.

### PT-004
Recovery.

Expected:

RECOVERING followed by GOOD after sufficient valid recovery evidence.

### PT-005
Head rotation.

Expected:

Should not automatically produce a false corrective state unless the tested posture features justify it.

### PT-006
Unrelated movement.

Expected:

No unnecessary correction.

---

# 9. Low-Confidence Tests

Conditions:

- leave camera frame
- partially occlude face/body
- poor lighting
- invalid camera position

Expected:

LOW_CONFIDENCE or appropriate setup guidance.

Never convert low confidence directly into bad-posture classification.

---

# 10. Temporal Tests

Verify:

- isolated bad frame
- repeated bad frames
- sustained deviation
- rapid state oscillation
- recovery with noise
- prolonged recovery

Expected:

- isolated noise does not trigger immediate correction
- sustained deviation is recognized
- hysteresis prevents rapid switching

---

# 11. Audio Tests

### AUD-001

Good posture:

Expected clear audio.

### AUD-002

Drifting posture:

Expected gradual mild filtering.

### AUD-003

Corrective posture:

Expected stronger filtering.

### AUD-004

Recovery:

Expected gradual restoration.

### AUD-005

Repeated state changes:

Expected smooth transitions without clicks or abrupt unwanted jumps.

### AUD-006

Audio failure:

Expected posture tracking to remain stable if possible.

---

# 12. End-to-End Acceptance Test

1. Launch SonicSpine.
2. Grant camera permission.
3. Position camera.
4. Start calibration.
5. Complete stable calibration.
6. Start focus session.
7. Sit naturally.
8. Confirm clear audio.
9. Move gradually into sustained posture deviation.
10. Observe state transition.
11. Observe progressive audio filtering.
12. Return to calibrated posture.
13. Observe recovery.
14. Confirm audio restoration.
15. End session.
16. Confirm session summary.
17. Confirm camera footage was not uploaded.

This is the primary MVP acceptance test.

---

# 13. Human Testing Matrix

Test with multiple people when available.

For each tester record:

- tester identifier
- device
- OS
- browser/app build
- camera position
- lighting condition
- test case
- expected result
- actual result
- pass/fail
- notes

Do not collect unnecessary sensitive information.

---

# 14. Ground-Truth Testing

Use controlled labels such as:

- Neutral
- Slight deviation
- Moderate deviation
- Sustained deviation
- Recovery
- Unrelated movement
- Low confidence

A human observer may provide labels.

Compare system output with those labels.

Where sample size allows, calculate:

- precision
- recall
- F1
- false-positive rate
- detection latency
- recovery latency

Do not claim statistically meaningful conclusions from inadequate sample sizes.

---

# 15. Performance Testing

When possible measure:

- camera capture timestamp
- pose inference timestamp
- feature calculation timestamp
- posture decision timestamp
- audio update timestamp

Do not invent target latency claims.

Record actual measurements with:

- device
- OS
- build
- model version
- test procedure
- number of trials
- result

---

# 16. Android Tests

After Capacitor packaging, verify:

- APK installation
- camera permission
- camera initialization
- pose inference
- calibration
- posture state transitions
- audio
- recovery
- local persistence
- app relaunch
- background/foreground behavior where relevant
- RevenueCat integration where relevant

Do not assume browser behavior is identical to Android behavior.

---

# 17. RevenueCat Tests

Use the currently supported testing/sandbox mechanism.

Verify:

- initialization
- entitlement lookup
- purchase/test flow
- cancellation/expiration behavior where supported
- locked/unlocked Pro behavior
- failure handling
- no production secrets in source control

Core posture demo must remain testable.

---

# 18. Regression Testing

After fixing a bug, rerun:

1. the test that exposed the bug
2. related unit tests
3. related integration tests
4. build
5. relevant manual test

Do not assume a local fix cannot affect another subsystem.

---

# 19. Bug Priority

P0:
Core functionality blocked or demo unusable.

P1:
Major user-facing defect.

P2:
Important but workaround exists.

P3:
Cosmetic or non-critical.

Fix in this order:

P0 → P1 → P2 → P3

---

# 20. Manual Test Report Format

For each manual test record:

TEST ID:
Date:
Build:
Device:
OS:

Purpose:

Steps:

Expected Result:

Actual Result:

Pass/Fail:

Notes:

Evidence:
- screenshot/video/log if needed

---

# 21. Release Candidate Testing

Before final demo:

- feature freeze
- full automated test suite
- lint/type checks
- production build
- Android build
- manual end-to-end test
- camera tests
- audio tests
- low-confidence tests
- regression tests
- RevenueCat test
- repository check

Do not make major architectural changes after release-candidate verification unless necessary.

---

# 22. Testing Honesty

Never report:

"100% accurate"

unless there is an extraordinary, independently verified basis, which is not expected for this project.

Never report a benchmark without methodology.

Never hide failed tests.

Never convert an assumption into a test result.

---

# 23. False-Positive Regression Protocols (Phase 2)

To verify the stabilization of the posture intelligence, the following 12 manual tests must be periodically re-verified:

### Movement Gates (FP-001 to FP-003)
- **FP-001**: Look down at keyboard. (Must not trigger CORRECTIVE. Rely on `earMidY` calculation).
- **FP-002**: Turn head to the left/right monitor. (Must not trigger CORRECTIVE. Rely on `noseYawDeviation` penalty suppression).
- **FP-003**: Reach forward rapidly to grab a cup/mouse. (Must not trigger CORRECTIVE. Rely on `motionStability` velocity suppression).

### Oscillation & Hysteresis (FP-004 to FP-006)
- **FP-004**: Hover exactly on the boundary of slumping. (Audio must not jitter. Must stably transition into DRIFTING only after 120 penalty, and not recover until below 70).
- **FP-005**: Enter CORRECTIVE, then sit perfectly straight for 1 second, then slightly slouch again. (Must remain in CORRECTIVE or RECOVERING until the full 2.0s recovery timer completes).
- **FP-006**: Lean forward for 1.0 second, then return. (Must not enter DRIFTING. Suppressed by 1.5s `driftThresholdMs`).

### Low-Confidence Handling (FP-007 to FP-009)
- **FP-007**: Lean partially out of the frame so one shoulder vanishes for 2 seconds, then return. (Audio MUST NOT Muffle. State must hold. Suppressed by 5.0s `LOW_CONFIDENCE_TIMEOUT_MS`).
- **FP-008**: Leave the frame entirely for 6 seconds. (State must transition to `LOW_CONFIDENCE`. UI must show warning. Audio must muffle).
- **FP-009**: Return to frame after FP-008. (Audio must restore. State must transition based on immediate posture geometry, not reset to GOOD blindly).

### Diagnostic Mode (FP-010 to FP-012)
- **FP-010**: Append `?debug=true` to the URL. (DiagnosticPanel must mount).
- **FP-011**: Observe DiagnosticPanel while reaching forward. (`Motion Stb` should drop below 1.0).
- **FP-012**: Observe DiagnosticPanel while turning head. (`Yaw` should exceed 0.3, `Penalty` should not spike).