/**
 * The AbuseBox mark: an A whose counter is a box, so it reads as the initial
 * and as the product name at once.
 *
 * Inlined rather than loaded as an image so it inherits `currentColor`. The
 * navigation is a dark teal now, and a mark with teal baked into it would sit
 * on teal and disappear; this way each place that uses it says what colour it
 * should be, and a theme change cannot strand it.
 *
 * One stroke weight, no gradient, nothing that only works large: it has to
 * hold at 16px in a favicon and at a metre on a slide.
 */
export default function Logo({ className = '', title = 'AbuseBox' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d="M9.5 38 L14 28 V14.5 A4.5 4.5 0 0 1 18.5 10 H29.5 A4.5 4.5 0 0 1 34 14.5 V28 L38.5 38" />
      <path d="M14 28 H34" />
    </svg>
  );
}
