// "the ned" app-icon mark — the stacked lockup in Paper (with the moss "the")
// on an Ink tile, corner radius ~23% of the icon per the brand kit. Pure type;
// colors are fixed because the tile is always ink, whatever the app theme.
export default function NedMark({ size = 34, className = "" }) {
  const ned = Math.round(size * 0.42);
  return (
    <div
      className={`flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, background: "#1C1A17", borderRadius: Math.round(size * 0.23) }}
    >
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", fontFamily: "var(--ft-ui)", fontWeight: 700, letterSpacing: "-0.02em", color: "#F6F3EC", fontSize: ned, lineHeight: 1, textTransform: "lowercase" }}>
        <span style={{ fontSize: "0.265em", fontWeight: 600, letterSpacing: "0.02em", color: "#93B56A", margin: "0 0 -0.78em 0.22em" }}>the</span>
        ned
      </span>
    </div>
  );
}
