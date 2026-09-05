// US phone formatting: xxx-xxx-xxxx, digits after the tenth become an
// extension. `deleting` handles a backspace landing on a dash — the digit in
// front of it goes too, otherwise the dash just reappears.
export const fmtPhone = (raw, { deleting = false } = {}) => {
  let s = String(raw ?? "");
  if (deleting && /-$/.test(s)) s = s.slice(0, -2);
  let d = s.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 10), ext = d.slice(10);
  let out = a;
  if (d.length > 3) out += "-" + b;
  if (d.length > 6) out += "-" + c;
  if (ext) out += " x" + ext;
  return out;
};

// onChange handler for a controlled phone input: pass the previous value so a
// backspace over a dash is detected.
export const phoneChange = (prev, next) => fmtPhone(next, { deleting: next.length < (prev || "").length });
