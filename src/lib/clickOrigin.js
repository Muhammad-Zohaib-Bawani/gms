// Tracks where the user last pressed, so overlays can animate out of the
// control that opened them.
//
// The alternative was passing an anchor ref into every <Modal>, which would
// mean touching all 23 views that use one and getting it right again for each
// new modal. A pointer listener gets the same effect for free: by the time a
// dialog opens, the press that opened it is the most recent one.

let last = null;

// Capture phase, so we still record the press even when a handler stops
// propagation on the way up.
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      // Prefer the centre of the activating control over the raw pointer
      // position — animating from the middle of a button looks deliberate,
      // animating from wherever the cursor clipped its corner does not.
      const control = e.target?.closest?.(
        'button, [role="button"], a, [data-modal-origin]',
      );
      if (control) {
        const r = control.getBoundingClientRect();
        last = { x: r.left + r.width / 2, y: r.top + r.height / 2, at: performance.now() };
      } else {
        last = { x: e.clientX, y: e.clientY, at: performance.now() };
      }
      publishVars();
    },
    true,
  );
}

// Keyboard activation and programmatic opens have no meaningful origin, and a
// stale one (from a press a minute ago, somewhere else entirely) is worse than
// none — the modal would fly in from an unrelated corner. Past the window we
// report null and callers fall back to a plain centre zoom.
const MAX_AGE_MS = 900;

export function getClickOrigin() {
  if (!last) return null;
  if (performance.now() - last.at > MAX_AGE_MS) return null;
  return { x: last.x, y: last.y };
}

// How far a surface should start from centre, given the press that opened it.
// The offset is damped rather than exact: travelling the full distance reads as
// a slide across the page, while a fraction of it reads as "this came from
// there" without the journey. Returns {x, y} in pixels, ready for a transform.
export function originOffset(damping = 0.34) {
  const o = getClickOrigin();
  if (!o) return { x: 0, y: 0 };
  return {
    x: (o.x - window.innerWidth / 2) * damping,
    y: (o.y - window.innerHeight / 2) * damping,
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}


// Most dialogs in this app are hand-rolled overlay divs rather than the shared
// <Modal>, so the same effect is published as CSS custom properties: any
// element carrying `.modal-solid` picks up the origin-aware entry animation
// from styles/qoc-revamp.css without its own component needing to know.
function publishVars() {
  if (!last || typeof document === 'undefined') return;
  const { x, y } = originOffset();
  const root = document.documentElement;
  root.style.setProperty('--click-dx', `${x.toFixed(1)}px`);
  root.style.setProperty('--click-dy', `${y.toFixed(1)}px`);
}
