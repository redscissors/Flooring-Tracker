// "the ned" app-icon mark — the logo kit's solo-n glyph (paper plank "n") on
// an Ink tile, corner radius ~23% per the kit. Colors are fixed because the
// tile is always ink, whatever the app theme.
export default function NedMark({ size = 34, className = "" }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`shrink-0 ${className}`} role="img" aria-label="the ned">
      <rect width="200" height="200" rx="46" fill="#1C1A17" />
      <defs><clipPath id="ned-mark-n"><path d="M45,165 V40 H107 A48,48 0 0 1 155,88 V165 H125 V103 A25,25 0 0 0 75,103 V165 Z" /></clipPath></defs>
      <path d="M45,165 V40 H107 A48,48 0 0 1 155,88 V165 H125 V103 A25,25 0 0 0 75,103 V165 Z" fill="#F6F3EC" />
      <g clipPath="url(#ned-mark-n)" stroke="#1C1A17" strokeWidth="4" fill="none">
        <line x1="59" y1="36" x2="59" y2="169" />
        <line x1="43" y1="50" x2="100" y2="80" />
        <line x1="88" y1="58" x2="157" y2="58" />
        <line x1="126" y1="60" x2="157" y2="114" />
        <line x1="139" y1="108" x2="139" y2="169" />
      </g>
    </svg>
  );
}
