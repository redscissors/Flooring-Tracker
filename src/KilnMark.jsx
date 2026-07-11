// Kiln arch mark — a kiln door: a paper-colored rounded-top rectangle sitting on
// the bottom edge of a terracotta square. No letterforms. Proportions match the
// favicon and design reference (inner arch ≈41% wide, 56% tall, bottom-anchored).
export default function KilnMark({ size = 34, className = "" }) {
  const w = Math.round(size * 0.41);
  const h = Math.round(size * 0.56);
  const mb = Math.round(size * 0.18);
  const r = Math.round(size * 0.21);
  return (
    <div
      className={`rounded-md bg-indigo-600 flex items-end justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div style={{ width: w, height: h, background: "var(--ft-card)", borderRadius: `${r}px ${r}px 0 0`, marginBottom: mb }} />
    </div>
  );
}
