// Rail drawers (spec 2026-09-24): which drawer is out, what fills the work
// area, and when a configurator asks Continue / Start new.
export const APP_IDS = ["labels", "schluter", "wedi", "sheoga"];
export const CONFIGURATOR_IDS = ["sheoga", "wedi", "schluter"];
export const SETTINGS_IDS = ["profile", "general", "book", "materials", "backup"];

export const initialRail = { drawer: null, pane: null, lastApp: null, broke: {} };

// A "break" (owner, 2026-09-24) is the Apps tray closing or the open project
// changing; only a configurator returned to after a break asks to resume.
const breakAll = () => Object.fromEntries(CONFIGURATOR_IDS.map((id) => [id, true]));
const idsFor = (kind) => (kind === "app" ? APP_IDS : kind === "settings" ? SETTINGS_IDS : []);
const drawerFor = (kind) => (kind === "app" ? "apps" : "settings");

export function railReducer(s, a) {
  switch (a.type) {
    case "toggleDrawer": {
      if (a.which !== "apps" && a.which !== "settings") return s;
      const drawer = s.drawer === a.which ? null : a.which;
      return { ...s, drawer, broke: s.drawer === "apps" ? breakAll() : s.broke };
    }
    case "pick": {
      if (!idsFor(a.kind).includes(a.id)) return s;
      const drawer = drawerFor(a.kind);
      let broke = s.drawer === "apps" && drawer !== "apps" ? breakAll() : s.broke;
      const isCfg = a.kind === "app" && CONFIGURATOR_IDS.includes(a.id);
      const same = s.pane && s.pane.kind === a.kind && s.pane.id === a.id;
      const resume = !same && isCfg && !!a.inProgress && !!broke[a.id];
      if (isCfg && broke[a.id]) broke = { ...broke, [a.id]: false };
      if (same) return { ...s, drawer, broke };
      return { ...s, drawer, broke, pane: { kind: a.kind, id: a.id, resume }, lastApp: a.kind === "app" ? a.id : s.lastApp };
    }
    case "resolveResume":
      return s.pane?.resume ? { ...s, pane: { ...s.pane, resume: false } } : s;
    case "closePane":
      return s.pane ? { ...s, pane: null } : s;
    case "projectChanged":
      return { ...s, pane: null, broke: breakAll() };
    case "restore":
      return stateFromLayer(a.layer) || s;
    default:
      return s;
  }
}

// The `ft-open-layer` entry (ADR 0028) for the rail: the pane if one shows,
// else the open drawer. Entries written before 2026-09-24 are
// { kind: "apps" } and { kind: "settings", section } — both still read.
export function layerOf(s) {
  if (s.pane) return s.pane.kind === "app" ? { kind: "apps", app: s.pane.id } : { kind: "settings", section: s.pane.id };
  if (s.drawer) return { kind: s.drawer };
  return null;
}

export function stateFromLayer(L) {
  if (!L || typeof L !== "object") return null;
  if (L.kind === "apps") {
    const id = APP_IDS.includes(L.app) ? L.app : null;
    return { ...initialRail, drawer: "apps", pane: id ? { kind: "app", id, resume: false } : null, lastApp: id };
  }
  if (L.kind === "settings") {
    const id = SETTINGS_IDS.includes(L.section) ? L.section : null;
    return { ...initialRail, drawer: "settings", pane: id ? { kind: "settings", id, resume: false } : null };
  }
  return null;
}
