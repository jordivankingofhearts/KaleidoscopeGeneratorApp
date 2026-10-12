# Animated rotation + soft zoom for the kaleidoscope

## Answer / approach
Animate in the WebGL render loop, **not** via Figma Motion/CSS transforms on the `<canvas>`:
- CSS rotate/scale of the canvas exposes corners (black background returns), blurs on upscale, and is invisible to PNG/JPG/future video export.
- Instead, compute time-based offsets per frame and feed them into existing/new uniforms. Same `renderFrame` → exports and future WebM/MP4/GIF capture get identical frames.
- The `motion` library is not needed (not in package.json); a small easing helper suffices.

## Behaviour
- **Auto-rotate**: pattern rotation `rotation + speed * t` (deg/s, -90..90, default 10). Applied to `u_rotation` (wedge rotation) so it stays seam-free. Option toggle "Rotate source instead" (adds to `u_srcRot`) – gives a flowing-content look.
- **Soft zoom ("breathing")**: whole-image zoom around the kaleidoscope center, loops smoothly:
  `zoom = 1 + amount * (0.5 - 0.5*cos(2π t / period))` — amount 0–50% (default 15%), period 2–30 s (default 8 s). Ease is sinusoidal so it's soft at the extremes. Only zoom-in (≥1) so the canvas is always filled.
- Play/Pause button; when paused the current animated state freezes (time stops accumulating). Static exports render the currently visible frame.
- Respect `prefers-reduced-motion`: start paused.

## Implementation
1. `src/lib/webgl.ts`
   - Add `uniform float u_viewZoom;` In the shader, scale the aspect-corrected position relative to center before polar conversion: `p /= u_viewZoom;` (zoom-in = smaller radius sampled). Radial wrap & fold unchanged → no seams.
   - Add `viewZoom: number` to `RenderParams`, set uniform, add to `uniformNames`.
2. `src/hooks/useKaleidoscope.ts`
   - New state: `animate` (bool, default false), `rotateSpeed` (deg/s), `rotateTarget: 'pattern' | 'source'`, `zoomEnabled`, `zoomAmount` (%), `zoomPeriod` (s). Add to `KState`, `DEFAULTS`, `reset`.
3. `src/components/Canvas.tsx`
   - Existing rAF loop: keep an accumulated `animTime` ref (delta-time based, only advances while `animate`). Read params via a ref so the loop doesn't restart on each state change.
   - In `buildParams(time)`: `rotation = base + (target==='pattern' ? speed*t : 0)`, `sourceRot = base + (target==='source' ? speed*t : 0)`, `viewZoom` from formula (1 if disabled). Render every frame only while animating; otherwise keep current on-change rendering.
4. `src/components/Sidebar.tsx`
   - New "Animation" section using existing control components: Play/Pause, Rotate speed slider (with direction via negative values), target segmented control, Soft zoom toggle + Amount + Period sliders.
5. Export: `export.ts` uses current frame (pass current `animTime`) so stills match preview. Leave hook point `renderAt(t)` for future frame-by-frame video export (deterministic from `t`, not wall clock).

## Edge cases
- Angle wrap: take `mod(rotation, 2π)` before uploading to keep float precision over long sessions.
- Tab hidden: clamp delta to ≤100 ms to avoid jumps.
- No source loaded: animation controls disabled.

## Verification
- `tsc` passes; visually confirm no seams while rotating at 6/8/12 segments, canvas always filled at peak and min zoom across 16:9, 9:16, 1:1; pause freezes; PNG export matches paused frame.
