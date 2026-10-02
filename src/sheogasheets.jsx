// The Sheoga book's Price sheets tab: the uploaded accessory sheet (its
// stored table) and the review a new or replacement sheet passes through
// before it is saved.
import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { HelpTip } from "./widgets.jsx";
import { readXlsxSheets } from "./fileread.js";
import { parseAccessorySheet, diffAccessorySheets, TRIM_PROFILES, TRIM_SPECIES } from "./sheogatrim.js";
import { sheetDateMDY } from "./vendorbook.js";

const BUILT_IN = [
  { name: "Flooring & stocked prefinished", src: "Distributor Price List", when: "Jan ’26" },
  { name: "Wood vents", src: "Vent price sheet", when: "Feb ’22" },
  { name: "Dampers", src: "Damper sheet", when: "Jul ’26" },
];
const PRICE_COUNT = TRIM_SPECIES.length * TRIM_PROFILES.length;
const fm = (n) => (n == null ? "—" : "$" + n.toFixed(2));
const th = "px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 bg-slate-100 first:text-left whitespace-nowrap";
const td = "px-2 py-1 text-right tabular-nums text-xs first:text-left first:font-bold";
const changed = "bg-amber-100 text-amber-800 font-semibold";

export async function readAccessoryFile(file) {
  try { return parseAccessorySheet(await readXlsxSheets(file)); }
  catch { return { sheet: null, problems: ["Not a spreadsheet this app can open"] }; }
}

const NO_TEXTURE = "can't be textured";

function AccTable({ sheet, was = {} }) {
  const cell = (label, v, nullTitle) => {
    const text = v == null ? "—" : v.toFixed(2);
    const none = v == null ? nullTitle : undefined;
    return label in was
      ? <td key={label} className={`${td} ${changed}`} title={[`was ${fm(was[label])}`, none].filter(Boolean).join(" · ")}>{text}</td>
      : <td key={label} className={td} title={none}>{text}</td>;
  };
  return (
    <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full">
        <thead><tr><th className={th}>$ per lineal ft</th>{TRIM_PROFILES.map((p) => <th key={p.id} className={th}>{p.short}</th>)}</tr></thead>
        <tbody>
          {TRIM_SPECIES.map((sp) => (
            <tr key={sp} className="border-b border-slate-100">
              <td className={td}>{sp}</td>{TRIM_PROFILES.map((p) => cell(`${sp} — ${p.short}`, sheet.species[sp]?.[p.id]))}
            </tr>
          ))}
          <tr style={{ background: "var(--ft-tint)" }}>
            <td className={td}>+ Prefinished</td>{TRIM_PROFILES.map((p) => cell(`Prefinished — ${p.short}`, sheet.prefin?.[p.id]))}
          </tr>
          <tr style={{ background: "var(--ft-tint)" }}>
            <td className={td}>+ Textured</td>{TRIM_PROFILES.map((p) => cell(`Textured — ${p.short}`, sheet.tex?.[p.id], NO_TEXTURE))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const slipLine = (slip, was, wasBundle) => {
  if (slip?.perLf == null) return null;
  const price = <>${slip.perLf.toFixed(2)}/lf</>;
  const bundle = <>{slip.bundleLf} lf</>;
  return (
    <div className="mt-2 text-[11px] text-slate-500">
      Slip tongue {was ? <span className={`rounded px-0.5 ${changed}`} title={`was ${fm(was.from)}`}>{price}</span> : price} in {wasBundle ? <span className={`rounded px-0.5 ${changed}`} title={`was ${wasBundle.from} lf`}>{bundle}</span> : bundle} bundles
    </div>
  );
};

export function SheetReview({ prev, fileName, parsed, onSave, onCancel }) {
  const { sheet, problems } = parsed;
  const diff = sheet && prev ? diffAccessorySheets(prev, sheet) : [];
  const was = Object.fromEntries(diff.map((d) => [d.label, d.from]));
  const summary = !prev ? `First upload — ${PRICE_COUNT} prices` : diff.length ? `${diff.length} price${diff.length === 1 ? "" : "s"} changed` : "No prices changed";
  const dated = sheet && sheetDateMDY(sheet.sheetDate);
  return (
    <div className="mt-3 rounded-md border border-indigo-200 px-3 py-2.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[13px] font-semibold text-slate-800">Review {fileName || "sheet"}</span>
        {dated && <span className="text-[11px] text-slate-500 tabular-nums">sheet dated {dated}</span>}
      </div>
      {problems.length ? (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <div className="font-semibold">Couldn't read this sheet:</div>
          <ul className="mt-1 list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      ) : (<>
        <div className={`mt-1 text-[11.5px] font-semibold ${diff.length ? "text-amber-700" : "text-slate-600"}`}>{summary}</div>
        <AccTable sheet={sheet} was={was} />
        {slipLine(sheet.slip, diff.find((d) => d.label === "Slip tongue"), diff.find((d) => d.label === "Slip tongue bundle"))}
      </>)}
      <div className="mt-3 flex items-center gap-2">
        <button disabled={!sheet} onClick={() => onSave(sheet)} className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs font-semibold disabled:opacity-40">Save sheet</button>
        <button onClick={onCancel} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

export function AccessorySheetCard({ book, updateBook, userName, review, onReview, onReviewDone }) {
  const fileRef = useRef(null);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const stored = book.data?.sheets?.accessories || null;
  const take = async (file) => {
    if (!file) return;
    setReading(true);
    const parsed = await readAccessoryFile(file);
    setReading(false);
    onReview({ fileName: file.name, parsed });
  };
  const save = (sheet) => {
    updateBook(book.id, { dataPatch: { sheets: { ...book.data?.sheets, accessories: { ...sheet, fileName: review.fileName, uploadedAt: Date.now(), uploadedBy: userName || "" } } } });
    onReviewDone();
  };
  const dated = stored && sheetDateMDY(stored.sheetDate);
  const uploaded = stored?.uploadedAt ? `uploaded ${new Date(stored.uploadedAt).toLocaleDateString()}${stored.uploadedBy ? ` by ${stored.uploadedBy}` : ""}` : "";
  return (
    <div className="pt-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="ft-eyebrow text-[10px]">Sheoga price sheets</span>
        <HelpTip className="align-middle" w={300} tip={<>An uploaded sheet prices the configurator's Trim &amp; accessories tab. Replace it when Sheoga sends a new one — new picks use the new prices, saved estimates keep theirs.</>} />
      </div>
      <div className={`rounded-md border px-3 ${over ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200"}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer?.files?.[0]); }}>
        <div className="flex items-center gap-3 py-2 flex-wrap">
          <FileSpreadsheet size={16} className={stored ? "text-[color:var(--ft-brand-deep)]" : "text-slate-300"} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-slate-800">Accessory pricing</div>
            {stored ? (<>
              <div className="text-[11px] text-slate-400 truncate" title={stored.fileName}>{stored.fileName}</div>
              {uploaded && <div className="text-[11px] text-slate-400">{uploaded}</div>}
            </>) : <div className="text-[11px] text-slate-400">not uploaded — drop Sheoga's accessory .xlsx here</div>}
          </div>
          {dated && <div className="text-[11px] text-slate-500 tabular-nums">sheet dated {dated}</div>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={reading} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 inline-flex items-center gap-1 disabled:opacity-40">
            <Upload size={12} /> {reading ? "Reading…" : stored ? "Replace…" : "Upload…"}
          </button>
        </div>
        {BUILT_IN.map((r) => (
          <div key={r.name} className="flex items-center gap-3 py-2 border-t border-slate-100">
            <FileSpreadsheet size={16} className="text-slate-300" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-800">{r.name}</div>
              <div className="text-[11px] text-slate-400">{r.src}</div>
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">{r.when}</div>
            <span className="text-[10.5px] text-slate-400">built into the app</span>
          </div>
        ))}
      </div>

      {review ? (
        <SheetReview prev={stored} fileName={review.fileName} parsed={review.parsed} onSave={save} onCancel={onReviewDone} />
      ) : stored && (<>
        <AccTable sheet={stored} />
        {slipLine(stored.slip)}
      </>)}
    </div>
  );
}
