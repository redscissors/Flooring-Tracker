// Preview harness for the vendor board's in-flight fetch note: the REAL
// VendorSheetRow in its three mid-fetch states — building counter, retry
// pacing, and the error sub-line — no Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { createRoot } from "react-dom/client";
import "./index.css";
import { VendorSheetRow } from "./vendorpanel.jsx";

const group = { id: "g1", name: "Virginia Tile · C28895MM", host: "connect24.virginiatile.com", user: "C28895MM" };
const sheet = (filename) => ({ vendor: "dancik", host: group.host, uid: "1047", user: group.user, filename });

const STATES = [
  { label: "streamed build in progress", prog: { state: "fetching", value: null, note: "portal is building this sheet — 47s…" } },
  { label: "patient retry pause", prog: { state: "fetching", value: null, note: "portal is still building this sheet — waiting, then retry 1 of 3…" } },
  { label: "download with content-length", prog: { state: "fetching", value: 0.62, note: "" } },
  { label: "error sub-line (unchanged)", prog: { state: "error", note: "the portal spent over 6 minutes building this sheet and still wasn't done — download it by hand and drop it in" } },
];

const noop = () => {};

function Harness() {
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-md space-y-5">
        {STATES.map(({ label, prog }, i) => (
          <div key={i}>
            <p className="ft-eyebrow text-[10px] mb-1">{label}</p>
            <div className="bg-white border border-slate-200 rounded-lg">
              <VendorSheetRow sheet={sheet("CAE EFT 25 06 23")} group={group} groups={[group]} books={[]}
                prog={prog} locked={false} mismatch={false} running={prog.state === "fetching"} stale={null}
                bookName="" checked={false} pending={null}
                onToggle={noop} onRedownload={noop} onRemove={noop} onMove={noop}
                onCreateBook={noop} onLinkBook={noop} onUnlinkBook={noop} onReview={noop} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
