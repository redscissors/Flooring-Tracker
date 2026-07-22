// Preview harness for the customer browser (issue 040): the REAL
// CustomerBrowser, embedded, over fake state — no Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import CustomerBrowser from "./CustomerBrowser.jsx";

const DAY = 86400000;
const now = Date.now();

const SALES = ["Marcus Mast", "Gina Boyd", "Steve Paxos", ""];
const FIRST = ["Sarah", "Troy", "Randall", "Dan", "Jonathan", "Justin", "Debbie", "Margret", "Paul", "Steve", "Amy", "Chris", "Karen", "Mike", "Laura", "Pete", "Nancy", "Owen", "Rita", "Sam", "Tina", "Vic", "Wendy", "Gus", "Holly", "Ivan"];
const LAST = ["Jones", "Sutton", "McCrork", "Minard", "Weaver", "Ringler", "Sheetz", "Kujawa", "Mickley", "Paxos", "Adams", "Beauchamp", "Hershberger", "Yoder", "Miller", "Troyer", "Raber", "Schlabach", "Mast", "Coblentz", "Byler", "Gingerich", "Kline", "Wengerd", "Bontrager", "Swartz"];
const ROADS = ["Township Road 652", "County Road 314", "State Route 557", "Harris Rd", "Westview Ave", "McCoy Rd", "Erie Ave NW", "Township Road 26", "E Moreland Rd", "County Road 207"];
const TOWNS = ["Millersburg", "Wooster", "Berlin", "Charm", "Butler", "Fredericktown", "Orrville", "Coshocton", "Wadsworth", "Canal Fulton"];
const BUILDERS = [{ id: "b1", name: "Peak Custom Homes" }, { id: "b2", name: "Hillside Builders" }, { id: "b3", name: "Doughty Valley Builders" }, { id: "b4", name: "Berlin Construction" }];
const JOBS = ["Kitchen", "Master bath", "Whole house", "Basement remodel", "New house", "Mudroom & laundry", "Rental turnover", "Addition", "Shop floor"];

const people = [], projects = [];
FIRST.forEach((fn, i) => {
  const created = now - ((i * 37) % 400) * DAY;
  const touched = now - ((i * 13) % 180) * DAY;
  people.push({
    id: `c${i}`, name: `${fn} ${LAST[i]}`,
    builderId: i % 3 === 0 ? BUILDERS[i % 4].id : null,
    phone: `(330) 55${i % 10}-0${(1000 + i * 87) % 10000}`.padEnd(14, "0"),
    email: i % 2 ? `${fn.toLowerCase()}.${LAST[i].toLowerCase()}@example.com` : "",
    address: `${1000 + i * 371} ${ROADS[i % ROADS.length]}, ${TOWNS[i % TOWNS.length]} OH`,
    createdAt: created, updatedAt: touched,
  });
  const nProj = i % 4; // 0–3 projects each
  for (let j = 0; j < nProj; j++) {
    projects.push({
      id: `p${i}-${j}`, customerId: `c${i}`,
      name: `${JOBS[(i + j * 3) % JOBS.length]}${j ? ` ${2024 + j}` : ""}`,
      sales: SALES[(i + j) % SALES.length],
      createdAt: created + j * 5 * DAY,
      updatedAt: touched - j * 11 * DAY,
    });
  }
});

function Harness() {
  const [log, setLog] = useState("—");
  return (
    <div className="h-screen" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <p className="text-xs p-2" style={{ color: "var(--ft-faint)" }}>
        Customer browser — real component, fake directory. Last action: <b style={{ color: "var(--ft-brand-deep)" }}>{log}</b>
      </p>
      <CustomerBrowser people={people} projects={projects} builders={BUILDERS} myName="Marcus Mast"
        onClose={() => setLog("close")}
        onOpenCustomer={(id) => setLog(`open customer ${id} (${people.find((c) => c.id === id)?.name})`)}
        onOpenProject={(id) => setLog(`open project ${id}`)}
        onNewCustomer={() => setLog("new customer")}
        onNewProject={(cid) => setLog(`new project for ${cid}`)} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
