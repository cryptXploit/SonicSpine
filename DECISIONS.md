# SonicSpine — Architecture Decisions Record (ADR)

This file tracks important architectural decisions for the SonicSpine project.

## ADR-001
**Date:** 2026-09-09
**Decision:** Scaffold the web application using React, TypeScript, and Vite directly in the repository root.
**Reason:** The primary focus is the client-side, real-time camera and computer-vision architecture. Vite provides an extremely fast, lightweight, and local-first development environment without the overhead of SSR (e.g., Next.js).
**Status:** Accepted
