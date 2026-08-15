// Preview proof for the customer browser's Project # column (the project-numbers
// spec's deferred "directory column"): the REAL CustomerBrowser over local mock
// light rows — the same shapes bootload projects — no Supabase.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import CustomerBrowser from "../../src/CustomerBrowser.jsx";

const DAY = 86400000;
const ago = (d) => new Date(2026, 7, 15).getTime() - d * DAY;

const builders = [
  { id: "b1", name: "Peak Custom Homes" },
  { id: "b2", name: "Meridian Homes" },
];
const people = [
  { id: "c1", name: "Kathy Marsh", phone: "(330) 555-0101", email: "kmarsh@example.com", address: "214 Old Mill Rd, Chagrin Falls", builderId: "b2", createdAt: ago(210), updatedAt: ago(3) },
  { id: "c2", name: "Troy Sutton", phone: "(740) 555-0202", email: "", address: "5063 County Road 314, Millersburg", builderId: "b1", createdAt: ago(160), updatedAt: ago(9) },
  { id: "c3", name: "Amy Adams", phone: "(330) 555-0303", email: "amy.adams@example.com", address: "88 Winesburg St", builderId: null, createdAt: ago(120), updatedAt: ago(1) },
  { id: "c4", name: "Dale Yoder", phone: "(330) 555-0404", email: "", address: "1490 Township Rd 606", builderId: "b1", createdAt: ago(64), updatedAt: ago(30) },
  { id: "c5", name: "Renee Hostetler", phone: "(234) 555-0505", email: "renee.h@example.com", address: "702 Maple Ave, Wooster", builderId: null, createdAt: ago(20), updatedAt: ago(2) },
];
const projects = [
  { id: "p1", customerId: "c1", projectNo: 214, name: "Marsh — whole first floor", updatedAt: ago(3), createdAt: ago(40), sales: "Marcus Mast" },
  { id: "p2", customerId: "c1", projectNo: 187, name: "Master bath", updatedAt: ago(58), createdAt: ago(70), sales: "Marcus Mast" },
  { id: "p3", customerId: "c1", projectNo: 141, name: "Basement rec room", updatedAt: ago(150), createdAt: ago(160), sales: "Gina Boyd" },
  { id: "p4", customerId: "c2", projectNo: 205, name: "Whole house", updatedAt: ago(9), createdAt: ago(30), salesperson: { name: "Gina Boyd" }, _full: true },
  { id: "p5", customerId: "c3", projectNo: 221, name: "Kitchen + hall tile", updatedAt: ago(1), createdAt: ago(6), sales: "Marcus Mast" },
  { id: "p6", customerId: "c3", name: "New Project", updatedAt: ago(1), createdAt: ago(1), sales: "Marcus Mast" },
  { id: "p7", customerId: "c4", projectNo: 168, name: "Shop floor", updatedAt: ago(30), createdAt: ago(48), sales: "Alan Yoder" },
  { id: "p8", customerId: "c5", projectNo: 219, name: "Hostetler — laundry & bath", updatedAt: ago(2), createdAt: ago(12), sales: "Gina Boyd" },
  // Customer-less rows: the Estimates & drafts strip
  { id: "p9", customerId: null, projectNo: 217, name: "Smith house — stair treads", updatedAt: ago(4), createdAt: ago(11), sales: "Marcus Mast" },
  { id: "p10", customerId: null, name: "Q-Marcus-8/9", quick: true, updatedAt: ago(6), createdAt: ago(6), sales: "Marcus Mast" },
];

function Demo() {
  const [cols, setCols] = useState(null);
  return (
    <CustomerBrowser
      people={people} projects={projects} builders={builders} myName=""
      initialCols={cols} onColOrder={setCols}
      onClose={() => {}} onOpenCustomer={() => {}} onOpenProject={() => {}}
      onNewCustomer={() => {}} onNewProject={() => {}}
    />
  );
}

createRoot(document.getElementById("preview")).render(<Demo />);
