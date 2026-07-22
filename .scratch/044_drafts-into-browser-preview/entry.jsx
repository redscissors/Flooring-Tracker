import React from "react";
import { createRoot } from "react-dom/client";
import CustomerBrowser from "../../src/CustomerBrowser.jsx";

const now = new Date(2026, 6, 22, 14, 0).getTime();
const d = (days) => now - days * 86400000;

const people = [
  { id: "c1", name: "Sarah Jones", phone: "(330) 555-0101", email: "sjones@example.com", address: "4905 Harris Rd", builderId: "b1", createdAt: d(40), updatedAt: d(2) },
  { id: "c2", name: "Troy Sutton", phone: "(740) 555-0202", email: "", address: "5063 County Road 314", builderId: null, createdAt: d(21), updatedAt: d(5) },
  { id: "c3", name: "Amy Adams", phone: "(330) 555-0303", email: "amy@example.com", address: "112 Maple St", builderId: "b1", createdAt: d(11), updatedAt: d(1) },
];
const projects = [
  { id: "p1", customerId: "c1", name: "Kitchen remodel", createdAt: d(38), updatedAt: d(2), sales: "Marcus Mast" },
  { id: "p2", customerId: "c1", name: "Master bath", createdAt: d(20), updatedAt: d(7), sales: "Gina Boyd" },
  { id: "p3", customerId: "c2", name: "Whole house", createdAt: d(21), updatedAt: d(5), sales: "Gina Boyd" },
  { id: "p4", customerId: "c3", name: "Mudroom tile", createdAt: d(10), updatedAt: d(1), sales: "Marcus Mast" },
  // Quick-price drafts — auto-named Q-<first line item>-<M/D>
  { id: "q1", customerId: null, name: "Q-Daltile / Arctic White-7/22", quick: true, createdAt: now, updatedAt: now, sales: "Marcus Mast" },
  { id: "q2", customerId: null, name: "Q-Mannington ADURA Max Sausalito-7/19", quick: true, createdAt: d(3), updatedAt: d(3), sales: "Gina Boyd" },
  { id: "q3", customerId: null, name: "Q-Sheoga White Oak 5\" Select-7/14", quick: true, createdAt: d(8), updatedAt: d(6), sales: "Marcus Mast" },
  // Unassigned estimates — real jobs with no customer filed yet
  { id: "e1", customerId: null, name: "Barn floor rough quote", createdAt: d(15), updatedAt: d(9), sales: "Marcus Mast" },
  { id: "e2", customerId: null, name: "Smith house — LVP estimate", createdAt: d(6), updatedAt: d(4), sales: "Gina Boyd" },
  { id: "e3", customerId: null, name: "Church hallway", createdAt: d(30), updatedAt: d(25), sales: "" },
];
const builders = [{ id: "b1", name: "Peak Custom Homes" }];

createRoot(document.getElementById("root")).render(
  <CustomerBrowser
    people={people} projects={projects} builders={builders}
    myName="Marcus Mast" initialCols={null}
    onColOrder={() => {}} onClose={() => {}} onOpenCustomer={() => {}}
    onOpenProject={() => {}} onNewCustomer={() => {}} onNewProject={() => {}} />
);

// Flip the Estimates & drafts toggle on so the strip is visible in the shot.
setTimeout(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => b.title === "Show estimates & drafts");
  if (btn) btn.click();
}, 50);
