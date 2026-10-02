// What the Email button fills in (owner 2026-10-02): the customer's address,
// subject "Selections - Customer - Project" — these are selection sheets with
// pricing, not quotes or estimates — an empty body, and the PDF's name
// "Customer - Project Name".
export function estimateMail({ cust, project }) {
  const parts = [cust?.name, project?.name].map((s) => (s || "").trim()).filter(Boolean);
  const filename = parts.join(" - ").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "Selections";
  return { to: (cust?.email || "").trim(), subject: ["Selections", ...parts].join(" - "), body: "", filename: filename + ".pdf" };
}
