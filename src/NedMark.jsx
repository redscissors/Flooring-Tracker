// NED app-icon mark — the "ned" wordmark in Sand on a Walnut-900 tile, corner
// radius ~23% of the icon per the brand kit. Pure type; no external asset.
export default function NedMark({ size = 34, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, background: "#2E2418", borderRadius: Math.round(size * 0.23) }}
    >
      <span style={{ fontFamily: "var(--ft-ui)", fontWeight: 700, letterSpacing: "-0.02em", color: "#E8D5B5", fontSize: Math.round(size * 0.42), lineHeight: 1 }}>ned</span>
    </div>
  );
}
