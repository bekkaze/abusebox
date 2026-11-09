/**
 * The AbuseBox mark: a box inside a box, drawn on true isometric projection.
 *
 * Inlined rather than loaded as an image so it inherits `currentColor`. The
 * navigation is a deep violet, and a mark with that colour baked into it
 * would sit on it and disappear; this way each place that uses it says what
 * colour it should be, and a theme change cannot strand it.
 *
 * The seams between the faces are open, not white. A white seam only works on
 * a white page; an open one lets whatever is behind the mark show through, so
 * the same file works on paper, on the nav and on a dark tile.
 *
 * The inner cube is darkened with color-mix instead of being thinned with
 * opacity. Opacity blends toward whatever is behind the mark, so on a light
 * page the inner cube comes out lighter than the shell and the depth cue
 * inverts between themes. Mixing toward black keeps it darker in both. The
 * plain `fill` stays underneath as the fallback, so a renderer that cannot
 * parse color-mix draws a legible one-tone mark rather than nothing.
 *
 * The seam is wider than the reference drawing and the inner cube slightly
 * larger, because at 16px the reference's proportions close up into a blob.
 */

const FACE_TOP = 'M24.00 3.00 L40.59 12.58 L34.15 16.29 L24.00 10.43 L13.85 16.29 L7.41 12.58Z';
const FACE_LEFT = 'M5.81 15.35 L12.25 19.06 L12.25 30.78 L22.40 36.64 L22.40 44.08 L5.81 34.50Z';
const FACE_RIGHT = 'M35.75 19.06 L42.19 15.35 L42.19 34.50 L25.60 44.08 L25.60 36.64 L35.75 30.78Z';
const INNER_TOP = 'M24.00 14.13 L32.55 19.07 L24.00 24.00 L15.45 19.07Z';
const INNER_BODY = 'M15.45 19.07 L24.00 24.00 L32.55 19.07 L32.55 28.93 L24.00 33.87 L15.45 28.93Z';

export default function Logo({ className = '', title = 'AbuseBox' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={FACE_TOP} />
      <path d={FACE_LEFT} />
      <path d={FACE_RIGHT} />
      <path d={INNER_TOP} style={{ fill: 'color-mix(in srgb, currentColor 72%, #000)' }} />
      <path d={INNER_BODY} style={{ fill: 'color-mix(in srgb, currentColor 52%, #000)' }} />
    </svg>
  );
}
