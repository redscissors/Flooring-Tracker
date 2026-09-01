// Pure text logic for the Settings "Test address lookup" probe result — split
// out of SettingsWorkspace.jsx (a .jsx file, which `node --test`'s plain ESM
// loader can't import — no JSX transform outside Vite) so this can be unit
// tested directly, the same split as samples.js/orderentry.js. `errText` is
// the caller's error-code resolver — SettingsWorkspace.jsx passes widgets.jsx's
// lookupErrText, so the real copy is reused rather than duplicated here.
//
// Google answers 403 for three different causes — the API was never enabled,
// the key is restricted from it, or the quota/billing is exhausted — so
// Places and Routes are reported separately rather than collapsed, and all
// three causes are named.
export const probeText = (p, errText) => {
  if (p?.error) return errText(p.error);
  if (p?.ok) return "Working — Places and Routes both answered.";
  const bad = [p?.places !== 200 && `Places ${p?.places}`, p?.routes !== 200 && `Routes ${p?.routes}`].filter(Boolean).join(", ");
  return `Key is set, but ${bad} did not answer 200 — the API may not be enabled, the key may be restricted from it, or the quota/billing may be exhausted.`;
};
