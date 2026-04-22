/**
 * FOS brand logo component.
 *
 * Renders the Future of Society hexagonal logo in SVG
 * with stacked, hero, and mark layout variants.
 *
 * Exports: FosBrand (named), FosBrand (default)
 */
import { useId } from "react";

interface FosBrandProps {
  layout?: "stacked" | "hero" | "mark";
  className?: string;
}

export function FosBrand({ layout = "stacked", className = "" }: FosBrandProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <span
      className={`ss-fos-brand ss-fos-brand--${layout} ${className}`.trim()}
      aria-label="FOS, Future of Society"
    >
      <span className="ss-fos-brand__icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="presentation">
          <defs>
            <linearGradient id={gradientId} x1="7" x2="39" y1="8" y2="39" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#d9be82" />
              <stop offset="0.52" stopColor="#b6914d" />
              <stop offset="1" stopColor="#7b5b2a" />
            </linearGradient>
          </defs>

          <g
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          >
            <path d="M11.5 14.4 24 8.8l12.1 5.9v13.7L24 39.2 11.5 33V14.4Z" />
            <path d="M24 8.8v14.7M11.5 14.4 24 23.5l12.1-8.8M24 23.5v15.7M11.5 33 24 23.5l12.1 4.9" opacity="0.84" />
          </g>

          {[
            [11.5, 14.4],
            [24, 8.8],
            [36.1, 14.7],
            [36.1, 28.4],
            [24, 39.2],
            [11.5, 33],
            [24, 23.5],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.25" fill={`url(#${gradientId})`} />
          ))}
        </svg>
      </span>

      {layout !== "mark" ? (
        <span className="ss-fos-brand__copy">
          <span className="ss-fos-brand__title">FOS</span>
        </span>
      ) : null}

      {layout === "hero" ? <span className="ss-fos-brand__line" aria-hidden="true" /> : null}
    </span>
  );
}

export default FosBrand;
