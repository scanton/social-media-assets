/* ============================================================
   BEAT MOTION

   How a nugget arrives and how it leaves.

   motion-and-feedback.md sets the timing budget: entrance and exit are 7 and 5
   frames at 30fps, and step 3 of the compression order says they can drop to
   about 4 and 3 before the pop reads as a hard cut. That is the whole envelope,
   so this is a fast movement by specification and the character has to come
   from its shape rather than its length.

   The shape is the step response of an underdamped spring:

       s(u) = 1 - e^(-D u) (cos(W u) + (D/W) sin(W u))

   which starts at exactly 0, overshoots by about 21% a fifth of the way in, and
   rings down to 1. One formula, no keyframes to keep in sync, and the same
   numbers drive the editor preview and the render route, so what a person
   approves is what ffmpeg draws.

   The exit is the entrance played backwards, so the ring happens as it goes
   rather than as it lands.
   ============================================================ */

/** Damping and frequency. Tuned for ~21% overshoot, settled inside the window. */
export const SPRING_D = 8;
export const SPRING_W = 16;

/** Entrance and exit, in seconds. Inside the 7-and-5-frame budget at 30fps. */
export const POP_IN_S = 0.30;
export const POP_OUT_S = 0.22;

/**
 * The peak of the overshoot, which is how much bigger than final size a nugget
 * ever gets. Anything rasterising the artwork should carry at least this much
 * headroom, or the overshoot is an upscale of a bitmap and goes soft exactly
 * when the eye is on it.
 */
export const OVERSHOOT = 1.21;

/** 0 at u=0, overshoots, settles at 1. Outside 0..1 it is clamped by callers. */
export function springStep(u) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-SPRING_D * u) * (Math.cos(SPRING_W * u) + (SPRING_D / SPRING_W) * Math.sin(SPRING_W * u));
}

/**
 * How long the entrance and exit actually get for a beat this long.
 *
 * A beat shorter than the two windows together would otherwise start leaving
 * before it had arrived. They shrink in proportion and never take more than
 * four fifths of the beat, so there is always some of it at full size.
 */
export function windows(span) {
  const want = POP_IN_S + POP_OUT_S;
  const have = Math.max(0.001, span) * 0.8;
  const k = want > have ? have / want : 1;
  return { inS: POP_IN_S * k, outS: POP_OUT_S * k };
}

/** Scale for a beat at time `t`. 0 outside its window, 1 while it holds. */
export function beatScale(t, tIn, tOut) {
  if (t < tIn || t > tOut) return 0;
  const { inS, outS } = windows(tOut - tIn);
  if (t < tIn + inS) return springStep((t - tIn) / inS);
  if (t > tOut - outS) return springStep((tOut - t) / outS);
  return 1;
}

/**
 * The same curve as an ffmpeg expression over `t`.
 *
 * Written here rather than in the render route so there is one definition of
 * the motion. A second copy in filter syntax is a second thing to get wrong,
 * and the failure would be silent: the export would simply move differently
 * from the preview.
 */
export function ffmpegScaleExpr(tIn, tOut) {
  const { inS, outS } = windows(tOut - tIn);
  const f = (n) => n.toFixed(4);
  const k = f(SPRING_D / SPRING_W);
  // s(x) for a normalised 0..1 progress expression
  const step = (x) =>
    `(1-exp(-${SPRING_D}*(${x}))*(cos(${SPRING_W}*(${x}))+${k}*sin(${SPRING_W}*(${x}))))`;

  const rising = step(`(t-${f(tIn)})/${f(inS)}`);
  const falling = step(`(${f(tOut)}-t)/${f(outS)}`);

  return `if(lt(t,${f(tIn + inS)}),${rising},if(gt(t,${f(tOut - outS)}),${falling},1))`;
}
