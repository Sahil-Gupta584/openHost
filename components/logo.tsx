/* eslint-disable @next/next/no-img-element */
/**
 * OpenHost brand mark — the single source of truth is `public/favicon.ico`.
 * Every logo in the app renders through this component so UI can never drift
 * from the shipped asset. The original file is kept byte-identical; never
 * recolor or redraw it (tastemaker logo-sourcing rule: preserve an existing
 * identity, do not reinterpret it).
 */

export const LOGO_ASSET = '/favicon.ico';

export function OpenHostMark({
  size = 32,
  className = '',
  alt = 'OpenHost',
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={LOGO_ASSET}
      width={size}
      height={size}
      alt={alt}
      className={`shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
