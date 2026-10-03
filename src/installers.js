// Installers (spec 2026-10-03): the team's installer directory, kept in the
// shared settings record (`settings.installers`), and the ones a job is using,
// kept on the project as contact snapshots (`project.installers`) so a quote
// prints the installer it was quoted with even after the directory changes.
// Pure and import-free — model.js and catalog.js import it on the boot path.

export const INSTALL_TRADES = ["tile", "hard", "carpet"];
export const TRADE_LABEL = { tile: "Tile", hard: "Hard Surface", carpet: "Carpet" };

const TYPE_TRADE = { tile: "tile", hardwood: "hard", vinyl: "hard", laminate: "hard", carpet: "carpet" };
// Underlayment and misc lines go in with whichever trade lays the floor, so
// they never ask for an installer of their own.
export const tradeOfType = (type) => TYPE_TRADE[type] || null;

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const normTrades = (raw) => INSTALL_TRADES.filter((t) => Array.isArray(raw) && raw.includes(t));
const clampPriority = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" && v != null ? Math.min(10, Math.max(1, n)) : 5;
};

export function normInstaller(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  return {
    id: String(raw.id),
    company: str(raw.company, 120),
    contact: str(raw.contact, 120),
    phone: str(raw.phone, 40),
    email: str(raw.email, 160),
    trades: normTrades(raw.trades),
    priority: clampPriority(raw.priority),
  };
}

export function normInstallers(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    const i = normInstaller(r);
    if (!i || seen.has(i.id)) continue;
    seen.add(i.id);
    out.push(i);
  }
  return out;
}

// `isBlank` is model.js rowBlank, passed in so this file stays import-free.
export function jobTrades(categories, isBlank) {
  const have = new Set();
  for (const a of categories || []) for (const p of a?.products || []) {
    const t = tradeOfType(p?.type);
    if (t && !isBlank(p)) have.add(t);
  }
  return INSTALL_TRADES.filter((t) => have.has(t));
}

const byPriority = (a, b) => b.priority - a.priority || a.company.localeCompare(b.company);

// The hammer picker's order: installers who cover every trade on the job,
// then those covering some (more of the job first), then the rest.
export function rankInstallers(installers, trades) {
  const full = [], part = [], none = [];
  for (const i of installers || []) {
    const hits = trades.filter((t) => i.trades.includes(t)).length;
    if (trades.length && hits === trades.length) full.push(i);
    else if (hits) part.push({ i, hits });
    else none.push(i);
  }
  return {
    full: full.sort(byPriority),
    part: part.sort((a, b) => b.hits - a.hits || byPriority(a.i, b.i)).map((x) => x.i),
    none: none.sort(byPriority),
  };
}

export const installerEntry = (i, by, at) => ({
  id: i.id, company: i.company, contact: i.contact, phone: i.phone, email: i.email,
  trades: [...i.trades], addedAt: at, addedBy: by || "",
});

export function normProjInstallers(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const r of raw) {
    const i = normInstaller(r);
    if (!i || out.some((e) => e.id === i.id)) continue;
    const { priority, ...rest } = i;
    out.push({ ...rest, addedAt: Number(r.addedAt) || 0, addedBy: str(r.addedBy, 120) });
  }
  return out;
}

export const toggleProjInstaller = (list, i, by, at = Date.now()) =>
  (list || []).some((e) => e.id === i.id) ? list.filter((e) => e.id !== i.id) : [...(list || []), installerEntry(i, by, at)];

// What prints in the Trade column: the trades they cover on this job, or all
// of theirs when the job has none of them (lines changed after they were added).
export function entryTradesOnJob(entry, trades) {
  const on = INSTALL_TRADES.filter((t) => trades.includes(t) && entry.trades.includes(t));
  return on.length ? on : INSTALL_TRADES.filter((t) => entry.trades.includes(t));
}

export const uncoveredTrades = (entries, trades) =>
  trades.filter((t) => !(entries || []).some((e) => e.trades.includes(t)));
