# Research Evidence

This document tracks scientific and technical research findings used to justify engineering decisions in SonicSpine.

## Claim: Using "Ears" instead of "Nose" prevents false positives from looking down.
- **Source**: Basic Biomechanical Kinesiology (Axis of Rotation of the Cervical Spine)
- **Support**: The atlanto-occipital joint (where the skull meets the spine) is positioned roughly between the ears. When a user flexes their neck (looks down at a keyboard), the face/nose swings forward and down in an arc. However, the ears remain relatively stable in vertical space relative to the shoulders. 
- **Implementation Consequence**: We compute the `neckCollapseRatio` using `(shoulderMidY - earMidY)`. This ensures that merely looking down does not register as a slouching penalty. Slouching is defined as the entire cervical axis dropping closer to the shoulders.

## Claim: 2D Head Size is distorted by Head Yaw (Turning).
- **Source**: Projective Geometry
- **Support**: When a 3D object is projected onto a 2D camera plane, rotation around the vertical axis (yaw) causes the perceived horizontal width of the object to shrink according to `cos(yaw)`. Therefore, `headSize` (distance between left and right ears) becomes artificially small when the user looks at a second monitor.
- **Implementation Consequence**: We implemented a `noseYawDeviation` feature. If the nose shifts far from the horizontal midpoint of the ears, we classify the head as "turned". When `isHeadTurned` is true, we explicitly suppress 2D depth/scale penalties in `TemporalFilter` to avoid false positives.

## Claim: iOS Safari strictly blocks async Autoplay.
- **Source**: Apple WebKit Documentation (Autoplay Policy Changes)
- **Support**: Media elements can only be played automatically if the `play()` method is executed synchronously within the execution stack of a user gesture (e.g., click or touch event). If an asynchronous operation (`await fetch()`, `await setup()`) occurs between the click and the `.play()` call, the user gesture token expires and playback is denied with a `NotAllowedError`.
- **Implementation Consequence**: In `App.tsx`, `audio.play()` is invoked immediately as the first synchronous operation inside `handleStartSession`, and any required asynchronous calibration or setup logic is `await`-ed *afterwards*.

## Claim: MediaElementAudioSourceNode outputs silence for Cross-Origin requests without CORS headers.
- **Source**: MDN Web Docs (`AudioContext.createMediaElementSource()`)
- **Support**: If an `<audio>` element loads a media file from a cross-origin domain that does not supply valid `Access-Control-Allow-Origin` headers, the browser will successfully play the audio normally, but the Web Audio API will refuse to capture the buffer data to prevent side-channel timing attacks. The resulting `MediaElementAudioSourceNode` will silently output 0s.
- **Implementation Consequence**: External CDNs like Pixabay (which block bots or omit CORS headers) cannot be used safely with Web Audio nodes. We generated a local `ambient.wav` in the `public/` directory to guarantee audio processing works on all devices without network constraints.