# SonicSpine — Architecture Decisions Record (ADR)

This file tracks important architectural decisions for the SonicSpine project.

## ADR-001
**Date:** 2026-09-09
**Decision:** Scaffold the web application using React, TypeScript, and Vite directly in the repository root.
**Reason:** The primary focus is the client-side, real-time camera and computer-vision architecture. Vite provides an extremely fast, lightweight, and local-first development environment without the overhead of SSR (e.g., Next.js).
**Status:** Accepted

## ADR-002
**Date:** 2026-09-11
**Decision:** Fully decouple `AudioEngine` from React Component state and DOM `<audio>` tags.
**Reason:** iOS Safari strictly blocks async Autoplay, and React state mutations would trigger component re-renders that detached the AudioContext from the user-gesture token. `AudioEngine` is now a standalone deterministic class.
**Status:** Accepted

## ADR-003
**Date:** 2026-09-11
**Decision:** Implement Hysteresis, Motion Gating, and `earMidY` logic for Posture Intelligence.
**Reason:** 2D projections of human geometry are highly susceptible to false positives (e.g., looking down, turning head, reaching forward). Rigid thresholds trap the user in `CORRECTIVE` and oscillating boundary states ruin the audio UX. Using motion velocity to gate penalties and strict hysteresis bands guarantees temporal stability.
**Status:** Accepted
