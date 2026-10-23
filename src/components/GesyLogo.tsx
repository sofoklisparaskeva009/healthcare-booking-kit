import { useState } from "react";

interface GesyLogoProps {
  className?: string;
  src?: string;
  alt?: string;
}

/**
 * Renders the GeSY logo. If `src` fails to load (e.g. offline, 404, broken asset link),
 * it gracefully falls back to an authentic, crisp vector inline SVG.
 */
export function GesyLogo({ className = "h-12 w-12 shrink-0", src = "/gesy-logo.svg", alt = "GeSY Logo" }: GesyLogoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <svg
        className={className}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={alt}
        role="img"
      >
        <defs>
          <linearGradient id="gesyInlineBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#0e4e59" />
          </linearGradient>
          <linearGradient id="gesyInlineCross" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        <rect width="160" height="160" rx="36" fill="url(#gesyInlineBg)" />
        <rect x="4" y="4" width="152" height="152" rx="32" stroke="#5eead4" strokeOpacity="0.25" strokeWidth="2" />

        <g transform="translate(80, 62)">
          <rect x="-10" y="-32" width="20" height="64" rx="10" fill="url(#gesyInlineCross)" />
          <rect x="-32" y="-10" width="64" height="20" rx="10" fill="url(#gesyInlineCross)" />
          <circle cx="0" cy="0" r="8" fill="#ffffff" opacity="0.95" />
          <path d="M -30 -4 C -28 -26, 28 -26, 30 -4" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
        </g>

        <g transform="translate(80, 126)" textAnchor="middle">
          <text
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="28"
            letterSpacing="1.5"
            fill="#ffffff"
          >
            ΓεΣΥ
          </text>
          <text
            y="16"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="600"
            fontSize="8.5"
            letterSpacing="2"
            fill="#5eead4"
          >
            CYPRUS GHS
          </text>
        </g>
      </svg>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={56}
      height={56}
      className={`${className} object-contain`}
      onError={() => setHasError(true)}
      loading="eager"
    />
  );
}
