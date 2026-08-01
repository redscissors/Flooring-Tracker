// Seed rows for the fake Supabase — shaped exactly like the real tables so the
// real loaders (bootload.js) map them without special-casing.
const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const NAMES = [
  "Gary Kisling", "Laura Pappas", "Dennis Yoder", "Marlin Hostetler", "Ruth Ann Byler",
  "Steve Coblentz", "Amanda Troyer", "Wayne Miller", "Ervin Schlabach", "Nancy Raber",
];

const area = (id, name, products) => ({ id, name, note: "", products });
const prod = (over) => ({
  id: "pr" + Math.random().toString(36).slice(2, 8),
  type: "tile", sku: "", L: "", W: "", thickness: "", sizeText: "", brandColor: "",
  priceSqft: "", qtyType: "sqft", qty: "", cartonSf: "", cartonPc: "", cartonUnit: "",
  cartonManual: "", note: "",
  grout: { checked: false, product: "", color: "", sku: "", joint: "", manual: "", caulk: "", caulkSku: "", caulkPrice: "" },
  mortar: { checked: false, product: "", manual: "" },
  underlay: { checked: false, product: "", manual: "", install: false },
  attached: {}, freight: "",
  ...over,
});

const OPEN_JOB = {
  name: "Kisling — kitchen, bath & mudroom",
  address: "4188 Twp Rd 606, Millersburg OH",
  phone: "330 893 1292", email: "",
  notes: "Homeowner picking grout color at the shop Thursday. Mudroom tile is a hold — confirm before ordering.",
  priceTier: "retail", printPricing: "full", customPct: "", freight: true,
  salesperson: { name: "Marcus", phone: "330 893 1292", email: "marcus@example.com" },
  waste: { tile: "10", floor: "5", tileOn: true, floorOn: true },
  attachments: [],
  categories: [
    area("a1", "Kitchen", [
      prod({ type: "tile", brandColor: "Sunset Glass — Alabaster", sku: "GLZ12241", L: "12", W: "24", thickness: "0.375", qty: "186", priceSqft: "8.40", costSqft: "5.80", cartonSf: "15.5", grout: { checked: true, product: "Permacolor Grout", color: "Frost", sku: "PCG-FRO", joint: "0.125", manual: "", caulk: "", caulkSku: "", caulkPrice: "" }, mortar: { checked: true, product: "254 Platinum", manual: "" } }),
      prod({ type: "tile", brandColor: "Terra Grande — Ash", sku: "GLZ2424", L: "24", W: "24", thickness: "0.375", qty: "64", priceSqft: "9.60", costSqft: "6.75" }),
    ]),
    area("a2", "Master bath", [
      prod({ type: "tile", brandColor: "Marbella Hex — Carrara", sku: "ANA-HEX", L: "2", W: "2", thickness: "0.375", qty: "78", priceSqft: "12.25", costSqft: "8.10" }),
      prod({ type: "vinyl", brandColor: "Mannington Adura — Napa Barrel", sku: "MPB770", sizeText: '6" x 48"', qty: "120", priceSqft: "5.35", costSqft: "3.40", cartonSf: "36" }),
    ]),
    area("a3", "Mudroom", [
      prod({ type: "tile", brandColor: "Slate Ridge — Graphite", sku: "GLZ1212", L: "12", W: "12", thickness: "0.375", qty: "96", priceSqft: "6.15", costSqft: "4.05" }),
    ]),
  ],
};

const projRow = (id, customerId, name, daysAgo, data = {}) => ({
  id, customer_id: customerId, owner_id: "u1",
  created_at: iso(daysAgo + 3), updated_at: iso(daysAgo),
  name, address: data.address || "", phone: data.phone || "", email: "",
  quick: data.quick ? "true" : null, sales: "Marcus",
  data: { name, ...data },
});

export const SEED = () => {
  const customers = NAMES.map((n, i) => ({
    id: "c" + i, owner_id: "u1", builder_id: i % 3 === 0 ? "b1" : null,
    created_at: iso(120 - i * 5), updated_at: iso(30 - i),
    name: n, phone: "330 555 01" + (10 + i), email: "", address: "", notes: "",
    data: { name: n },
  }));

  const projects = [
    { ...projRow("p-open", "c0", OPEN_JOB.name, 0, OPEN_JOB), data: OPEN_JOB },
    projRow("p2", "c0", "Kisling — basement", 6),
    projRow("p3", "c1", "Pappas — main floor", 1),
    projRow("p4", "c2", "Yoder — bath remodel", 3),
    projRow("p5", "c3", "Hostetler — new build", 4),
    projRow("p6", "c4", "Byler — laundry", 9),
    projRow("p7", "c5", "Coblentz — entry tile", 12),
    projRow("p8", "c6", "Troyer — kitchen", 14),
    projRow("p9", null, "Q-Arctic White-7/20", 2, { quick: true }),
    projRow("p10", null, "Walk-in — sample pricing", 5),
  ];

  return {
    app_data: [{ user_id: "u1", data: { profile: { name: "Marcus", phone: "330 893 1292", email: "marcus@example.com" } } }],
    shared_settings: [{ id: "singleton", data: {} }],
    projects,
    customers,
    builders: [{ id: "b1", name: "Weaver Builders" }],
    price_books: [],
    price_book_items: [],
    todos: [
      { id: "t1", position: 1, data: { text: "Mirage book re-import", done: false, createdBy: "Marcus" } },
      { id: "t2", position: 2, data: { text: "Check Glazzio freight sheet", done: false, createdBy: "Gina" } },
    ],
    labels: [],
    versions: [],
    ui_prefs: [],
  };
};
