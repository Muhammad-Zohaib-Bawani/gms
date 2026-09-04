// Concrete brand colours for the three places CSS custom properties cannot
// reach: SVG presentation attributes (fill=/stroke=/stopColor= never resolve
// var()), library props that expect a real colour string (QR codes, charts),
// and email HTML. Everything else must use var(--accent) / hsl(var(--brand-hsl))
// straight from styles/brand.css — see that file's header.
//
// These read the tokens back out of brand.css at call time, so the hue is still
// defined in exactly one place.

const read = (token) =>
  typeof document === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(token).trim();

// ponytail: last-resort fallbacks for a call before the stylesheet is live.
// Keep in sync with brand.css only if you ever see them render.
const FALLBACK = { '--brand': 'hsl(226 62% 30%)', '--brand-2': 'hsl(226 51% 46%)', '--brand-deep': 'hsl(226 71% 21%)' };

/** Solid brand colour. token: --brand (default) | --brand-2 | --brand-deep */
export const brandColor = (token = '--brand') => read(token) || FALLBACK[token] || FALLBACK['--brand'];

/** Brand colour at an alpha, e.g. brandTint(0.34). */
export const brandTint = (alpha, token = '--brand-hsl') => {
  const channels = read(token);
  return channels ? `hsl(${channels} / ${alpha})` : `hsl(226 62% 30% / ${alpha})`;
};

/** Brand colour as #rrggbb — for the JS colour maths (orb tints, blends) that
 *  cannot work on an hsl() string. Same source, converted on the way out. */
export const brandHex = (token = '--brand-hsl') => {
  const m = (read(token) || '226 62% 30%').match(/(-?[\d.]+)\D+([\d.]+)%\s+([\d.]+)%/);
  const [h, s, l] = m ? [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100] : [226, 0.62, 0.30];
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), min = l - c / 2;
  const seg = Math.floor((((h % 360) + 360) % 360) / 60) % 6;
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return '#' + [r, g, b].map((v) => Math.round((v + min) * 255).toString(16).padStart(2, '0')).join('');
};
