// What the Email estimate button fills in: the customer's address, the
// subject and message, and the PDF's name ("Customer - Project Name", owner
// 2026-10-02).
export function estimateMail({ cust, project, salesperson }) {
  const custName = (cust?.name || "").trim();
  const projName = (project?.name || "").trim();
  const filename = [custName, projName].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "Estimate";
  const first = custName.split(/\s+/)[0];
  const sp = salesperson || {};
  const sign = [sp.name, sp.phone].map((s) => (s || "").trim()).filter(Boolean);
  const body = [`Hi${first ? " " + first : ""},`, "", `Attached is your estimate${projName ? ` for ${projName}` : ""}. Let me know if you have any questions.`, "", "Thanks,", ...sign].join("\n");
  return { to: (cust?.email || "").trim(), subject: projName ? `Estimate – ${projName}` : "Estimate", body, filename: filename + ".pdf" };
}
