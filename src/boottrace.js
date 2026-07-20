// Boot timing. Pure and clock-injected so node --test can drive it; the
// console output lives at the call site (App.jsx), not here.
export function bootTrace(now = () => performance.now()) {
  const t0 = now();
  const spans = [];
  let paintAt = null, doneAt = null;
  return {
    async span(name, fn) {
      const start = now();
      try { return await fn(); }
      finally { spans.push({ name, start: start - t0, ms: now() - start }); }
    },
    paint() { paintAt = now() - t0; },
    done() { doneAt = now() - t0; },
    report() { return { spans: [...spans], paintAt, doneAt }; },
  };
}

export function traceRows({ spans, paintAt, doneAt }) {
  const rows = spans.map((s) => ({ load: s.name, "started at (ms)": Math.round(s.start), "took (ms)": Math.round(s.ms) }));
  if (paintAt != null) rows.push({ load: "first paint", "started at (ms)": Math.round(paintAt), "took (ms)": 0 });
  if (doneAt != null) rows.push({ load: "background done", "started at (ms)": Math.round(doneAt), "took (ms)": 0 });
  return rows;
}
