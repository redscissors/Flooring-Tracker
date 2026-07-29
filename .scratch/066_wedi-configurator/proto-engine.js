// wedi shower-system configurator — prototype engine (issue 066).
// Pure logic, no DOM. Loads as a plain <script> after proto-data.js and exposes
// one global `WEDI`; `node proto-engine.js` runs the self-test at the bottom.
//
// wedi is the opposite of Sheoga on both axes: every piece has a part number,
// and wedi publishes suggested retail while the shop buys at distributor net —
// so there is no markup knob here. Sell = book retail, cost = ERP/net, and the
// tiers are display lenses (ADR 0018), with the one wedi rule that Builder is
// retail × 0.82 rather than the flat 8% off.
//
// What replaces a description builder is a SYSTEM SOLVER: a shower is a pan +
// extensions + panels + curb + drain finish + consumables that all have to
// agree with each other. The install rules encoded below come from the wedi
// Technical Handbook and the Illustrated Price List 2026 — see ticket.md.
//
// Prices are the Jan 1 2026 distribution pricelist and the shop's ERP export.

(function () {
  "use strict";

  var round2 = function (n) { return Math.round((n + Number.EPSILON) * 100) / 100; };

  // --- wedi's own planning figures (Illustrated PL pp.19–21) -----------------
  var CONSUMABLES = {
    sealantOzPerSf: 1.2,   // "covers shower wall, base and curb installation"
    fastenersPerSf: 1,     // 1 screw + washer per ft² of building panel
    fastenerKitCt: 100,
    // A curbless field seal is 620 sealant, quoted as an allowance rather than
    // per-foot: the perimeter, the Subliner laps and the recess all draw on it.
    curbless620Oz: 40,
    sausageOz: 20,
    tubeOz: 10.5,
  };

  var TIERS = ["retail", "builder", "employee", "sale", "custom"];
  var WEDI_BUILDER_MULT = 0.82;   // owner rule 2026-07-29, not the flat 8% off
  var SO_MIN_NET = 500;           // wedi small-order handling threshold

  // --- part numbers the recipes name ----------------------------------------
  var SKU = {
    panelDefault: "US8000017",    // 3×5×½ — the shop's bread-and-butter sheet
    curbLean60: "US3000038",
    curbLean96: "US3000040",
    coverSS: "US1000057",
    fastenerKit: "US5000070",
    sealantSausage: "US5000010",
    sealantTube: "US5000013",
    sealant620Sausage: "US5000083",
    sealant620Tube: "US5000088",
    gun: "US5000019",
    trowel: "US5000044",
    collarValve: "US5000000",
    collarPipe: "US5000033",
    subliner53: "US5000001",
    subCornerIn: "US5000007",
    recessKit: "US5000085",
    ramp: "073736517",
    extFundo24: "073783528",
    extFundo12: "US3000036",
    extCurbless12: "US3000035",
    cornerFundo: "US3000053",
    cornerCurbless: "US3000052",
  };

  // Extension geometry. A straight adds 12" or 24" of pre-sloped depth along a
  // side; it is cuttable in length and in depth (the trimmed edge is the high,
  // thick one — the slope still lands on the pan), and stackable in depth.
  // Curbless has only the 12" piece, so 24" is its ceiling.
  var EXT = {
    fundo: { depths: [24, 12], max: 36, items: { 24: SKU.extFundo24, 12: SKU.extFundo12 }, corner: SKU.cornerFundo },
    curbless: { depths: [12], max: 24, items: { 12: SKU.extCurbless12 }, corner: SKU.cornerCurbless },
  };
  var MIN_GAP = 6;         // below this, cut the pan rather than shim a strip
  var CORNER_MAX = 12;     // the 16½" corner piece wraps 12" of two straights

  // Riolito neo modules. The ERP prints the 32"'s channel as 27-1/2 where the
  // pricelist prints 27 19/32 — the pricelist figure is the one that matches the
  // cover plates, so the table wins over either description.
  var MODULE_LENGTHS = [32, 36, 42, 48, 54];
  var MODULE_CHANNEL = { 32: 27.59, 36: 31.5, 42: 35.0, 48: 43.31, 54: 48.9 };
  var MODULE_DEPTH = 5.75;
  var MODEXT_DEPTH = 66.75;
  var COVER_NOMINALS = [27, 31, 35, 43];

  var FINISHES = {
    SS: "Stainless, brushed natural", T14: 'Tileable — ¼" tile', T38: 'Tileable — ⅜" tile',
    T: "Tileable", C: "Chrome, polished", B: "Brass, brushed", G: "Gold, polished",
    ORB: "Oil-rubbed bronze", MB: "Matte black", CHA: "Champagne", WHT: "White matte",
    CSL: "Chrome, polished slotted", SSP: "Stainless, perforated", MBP: "Matte black, perforated",
    BP: "Brass, perforated", CP: "Chrome, perforated",
  };

  var GROUP_LABEL = {
    pan: "Pans", module: "Linear modules", modExt: "Module extensions",
    extension: "Pan extensions", cornerExt: "Corner extensions", ramp: "Ramps",
    curb: "Curbs", panel: "Building panels", cover: "Drain covers",
    coverFrame: "Cover frames", drainKit: "Drain kits", recess: "Recess kits",
    niche: "Niches", shelf: "Niche shelves", seat: "Seats", bench: "Benches",
    fastener: "Fasteners", sealant: "Sealant", tool: "Tools", collar: "Collars & seals",
    subliner: "Subliner & tapes", kit: "Factory kits", sdry: "S-DRY system", misc: "Other",
  };

  // ==========================================================================
  // number + dimension parsing
  // ==========================================================================

  // "1 37/64", "27-1/2", "5 3/4", "3/8", "42.5" → inches.
  function frac(s) {
    var t = String(s == null ? "" : s).trim().replace(/[–—]/g, "-");
    var m = t.match(/^(\d+(?:\.\d+)?)[\s-]+(\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[1] + +m[2] / +m[3];
    m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return +m[1] / +m[2];
    m = t.match(/^(\d+(?:\.\d+)?)$/);
    return m ? +m[1] : null;
  }

  // Bare fractions first — "1/2" must not read as the "1" of a mixed number.
  var NUM = "\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?(?:[\\s-]+\\d+\\s*\\/\\s*\\d+)?";
  var UNIT = "(?:''|\"|in\\.?|inch(?:es)?|'|ft\\.?|feet)";
  var DIM_RE = new RegExp(
    "(" + NUM + ")\\s*(" + UNIT + ")?\\s*[x×]\\s*(" + NUM + ")\\s*(" + UNIT + ")?" +
    "(?:\\s*[x×]\\s*(" + NUM + ")\\s*(" + UNIT + ")?)?", "i");

  function isFeet(u) { return !!u && /^(?:'|ft\.?|feet)$/i.test(u.trim()); }

  // Every dimension the two sheets print, in inches. Handles the pricelist's
  // "36 in. x 60 in. x 1 37/64 in." and the ERP's "3'x5'", "4'x8'x1/2\"",
  // "38x64", "32\"x5-3/4\"". Unit-less groups are read as FEET only when every
  // value is ≤ 12 — "4x8" is a sheet, "38x64" is an S-DRY base.
  function dims(text) {
    var m = String(text == null ? "" : text).replace(/≈/g, "").match(DIM_RE);
    if (!m) return null;
    var raw = [], units = [];
    for (var i = 1; i < 7; i += 2) {
      if (m[i] == null) continue;
      var v = frac(m[i]);
      if (v == null) return null;
      raw.push(v); units.push(m[i + 1] || "");
    }
    if (raw.length < 2) return null;
    // A unit-less value is inches, except when the whole group is unit-less and
    // every value is ≤ 12 — "4x8" is a sheet in feet, "38x64" a base in inches.
    var bareFeet = units.every(function (u) { return !u; }) && raw.every(function (v) { return v <= 12; });
    return raw.map(function (v, k) {
      return isFeet(units[k]) || (bareFeet && !units[k]) ? v * 12 : v;
    });
  }

  // A flat board's W × D × T. The thinnest value is the thickness whenever it
  // reads like one; the other two keep source order.
  function board(vals) {
    if (!vals) return {};
    if (vals.length < 3) return { w: vals[0], d: vals[1] };
    var min = Math.min.apply(null, vals);
    if (min >= 4) return { w: vals[0], d: vals[1], t: vals[2] };
    var rest = [], t = null;
    for (var i = 0; i < vals.length; i++) {
      if (t == null && vals[i] === min) t = vals[i];
      else rest.push(vals[i]);
    }
    return { w: rest[0], d: rest[1], t: t };
  }

  function nominalLen(actual) {
    if (actual == null) return null;
    var best = null, bd = 2.01;
    COVER_NOMINALS.forEach(function (n) {
      var dd = Math.abs(n - actual);
      if (dd < bd) { bd = dd; best = n; }
    });
    return best;
  }

  // Back to the sheets' own fractions — a pan is 1 37/64" thick, not 1.58".
  function inch(n) {
    var whole = Math.floor(n + 1e-9), rem = n - whole;
    if (rem < 1e-6) return String(whole);
    var den = 64, num = Math.round(rem * den);
    if (num === den) return String(whole + 1);
    while (num % 2 === 0 && den % 2 === 0) { num /= 2; den /= 2; }
    return (whole ? whole + " " : "") + num + "/" + den;
  }

  function sizeTextOf(w, d, t) {
    if (w == null || d == null) return "";
    return inch(w) + '" x ' + inch(d) + '"' + (t != null ? " x " + inch(t) + '"' : "");
  }

  function cleanDesc(desc, us) {
    var s = String(desc || "");
    if (us) s = s.split(us).join(" ");
    return s.replace(/\s+-\s*$/, "").replace(/\s+-\s+/g, " — ").replace(/\s{2,}/g, " ").trim();
  }

  // ==========================================================================
  // classification
  // ==========================================================================

  var SET = function (list) {
    var o = {};
    list.forEach(function (k) { o[k] = true; });
    return o;
  };
  var POINT_COVERS = SET(["US1000047", "US1000053", "US1000054", "US1000055", "US1000056",
    "US1000057", "US1000058", "US1000060", "US1000062", "US1000124", "US1000125"]);
  var DRAIN_KITS = SET(["077000054", "US1000003", "US1000004", "US1000035", "US5000022"]);
  var FASTENERS = SET(["US5000070", "US5000086", "US5000009", "US5000012", "US5000018", "US5000089"]);
  var SEALANTS = SET(["US5000013", "US5000010", "US5000083", "US5000088"]);
  var TOOLS = SET(["US5000019", "US5000020", "US5000044", "US5000032", "US7000058"]);
  var COLLARS = SET(["US5000000", "US5000033"]);
  var SUBLINER = SET(["US5000001", "US5000005", "US50000005", "US5000002", "US5000007",
    "US5000008", "US5000084", "095225053", "095215052"]);
  var NICHES = SET(["US3000003", "US3000004", "US3000005", "US3000007", "US3000016",
    "US3000024", "US3000051", "US3000248"]);
  var SHELVES = SET(["US3000050", "US3000245", "US3000246"]);
  var SEATS = SET(["US3000001", "US3000002"]);
  var BENCHES = SET(["US3000000", "US3000042", "US3000043", "US3000044", "US3000045",
    "US3000046", "US3000047", "US3000054", "US3000055", "US3000056"]);
  var CURBS = {
    US3000039: "full", US3000041: "full", US3000038: "lean", US3000040: "lean",
    US3000008: "cap", US3000010: "cap", US3000048: "at", US3000049: "at",
  };
  var EXT_SUBS = {
    "073783528": ["extension", "fundo"], US3000036: ["extension", "fundo"],
    US3000035: ["extension", "curbless"], US3000053: ["cornerExt", "fundo"],
    US3000052: ["cornerExt", "curbless"], "073736517": ["ramp", "fundo"],
  };
  // The ERP still carries wedi's pre-US part numbers for three linear pieces the
  // pricelist only prints under a US sku (or, for the SS frames, not at all).
  var LEGACY = {
    "676797048": ["cover", "linear"], "676800061": ["coverFrame", "linear"],
    "676800064": ["coverFrame", "linear"], "075100052": ["module", "legacy"],
    "073738206": ["module", "discreto"], "073738209": ["module", "discreto"],
  };

  function classify(us, name) {
    var u = String(us || ""), n = String(name || "");
    if (/^US\d\d76\d{3}$/.test(u)) return /^US9176/.test(u) ? ["pan", "sdry"] : ["sdry", ""];
    if (LEGACY[u]) return LEGACY[u];
    if (/^US9100/.test(u)) return ["pan", "fundo"];
    if (/^US9200/.test(u)) return ["pan", "curbless"];
    if (/^US9310/.test(u)) return ["pan", "linear"];
    if (/^US9320/.test(u)) return ["module", "neo"];
    if (/^US9330/.test(u)) return ["modExt", "neo"];
    if (/^US9400/.test(u) || DRAIN_KITS[u]) return ["drainKit", /subliner/i.test(n) ? "subliner" : ""];
    if (/^US2[01]00/.test(u)) return ["kit", /nojs/i.test(n) ? "nojs" : "complete"];
    if (/^US4000/.test(u)) return ["panel", "kit"];
    if (/^US8000/.test(u)) return ["panel", /vapor/i.test(n) ? "vapor" : "board"];
    if (EXT_SUBS[u]) return EXT_SUBS[u];
    if (CURBS[u]) return ["curb", CURBS[u]];
    if (NICHES[u]) return ["niche", ""];
    if (SHELVES[u]) return ["shelf", ""];
    if (SEATS[u]) return ["seat", ""];
    if (BENCHES[u]) return ["bench", /bench kit/i.test(n) ? "kit" : "sanoasa"];
    if (/^US1000/.test(u)) {
      if (/frame/i.test(n)) return ["coverFrame", "linear"];
      return ["cover", POINT_COVERS[u] ? "point" : "linear"];
    }
    if (u === "US5000085") return ["recess", ""];
    if (FASTENERS[u]) return ["fastener", /vapor/i.test(n) ? "vapor" : ""];
    if (SEALANTS[u]) return ["sealant", /620/.test(u + " " + n) ? "620" : "joint"];
    if (TOOLS[u]) return ["tool", ""];
    if (COLLARS[u]) return ["collar", ""];
    if (SUBLINER[u]) return ["subliner", /mesh|fiberglass/i.test(n) ? "mesh" : ""];
    return ["misc", ""];
  }

  // ==========================================================================
  // catalog
  // ==========================================================================

  var STOCK = null, SO = null, CAT = null, INDEX = null;

  function tables() {
    if (STOCK && SO) return;
    /* global WEDI_STOCK, WEDI_SO */
    if (typeof WEDI_STOCK === "undefined" || typeof WEDI_SO === "undefined")
      throw new Error("proto-data.js must load before proto-engine.js");
    STOCK = WEDI_STOCK; SO = WEDI_SO;
  }

  function unitOf(stockRow, soRow) {
    if (stockRow && stockRow.unit) return stockRow.unit;
    var d = soRow ? String(soRow.details || "") : "";
    if (/per roll|\/roll|\broll\b/i.test(d)) return "RL";
    if (/\/bag|per bag|\bbag\b/i.test(d)) return "BG";
    if (/\/box|per box/i.test(d)) return "BX";
    return "EA";
  }

  function drainOf(entry, text) {
    var t = String(text || "").toLowerCase();
    var type = /linear|4 sided slope|channel/.test(t) ? "linear"
      : /offset|corner/.test(t) ? "offset" : "center";
    if (entry.sub === "linear") type = "linear";
    var w = entry.w, d = entry.d;
    if (type === "linear") {
      var ch = entry.channel || 0;
      // The channel runs along the long side, set 2" in from that wall.
      return d >= w
        ? { type: type, x: 2, y: round2(d / 2), len: ch, axis: "d", note: "" }
        : { type: type, x: round2(w / 2), y: 2, len: ch, axis: "w", note: "" };
    }
    if (type === "offset") {
      return {
        type: type, x: round2(w / 2), y: round2(d * 0.25), len: 0, axis: null,
        note: "offset drain — read the exact position off the wedi spec sheet at install",
      };
    }
    return { type: type, x: round2(w / 2), y: round2(d / 2), len: 0, axis: null, note: "" };
  }

  function finishOf(name, desc) {
    var tail = (String(name || "").trim().split(/\s+/).pop() || "").toUpperCase();
    // "T38" and "T14" are whole finish codes; "MB27"/"27MB" are a finish plus a
    // cover length, printed in either order.
    if (FINISHES[tail]) return { finish: tail, len: null };
    var letters = tail.replace(/[^A-Z]/g, "");
    var digits = tail.replace(/\D/g, "");
    if (letters && digits && FINISHES[letters]) return { finish: letters, len: nominalLen(+digits) };
    var d = String(desc || "");
    var fin = /stainless|\bss\b/i.test(d) ? "SS" : /matte black|\bmb\b/i.test(d) ? "MB"
      : /tileable/i.test(d) ? "T" : /chrome/i.test(d) ? "C" : /brass/i.test(d) ? "B" : null;
    var lead = d.match(/(\d+(?:\.\d+)?)\s*"/);
    return { finish: fin, len: lead ? nominalLen(+lead[1]) : null };
  }

  function makeEntry(stockRow, soRow) {
    var us = (soRow && soRow.us) || (stockRow && stockRow.us) || "";
    var name = soRow ? String(soRow.name || "") : cleanDesc(stockRow.desc, stockRow.us);
    // Classify off the NAME only: a point cover's size text reads "cover and
    // frame made from stainless steel…", which would file it as a cover frame.
    var g = classify(us, name);
    var e = {
      key: us || (stockRow && stockRow.erp) || "",
      us: us,
      erp: (stockRow && stockRow.erp) || (soRow && soRow.erp) || "",
      stock: !!stockRow,
      name: name,
      group: g[0],
      sub: g[1] || "",
      w: null, d: null, t: null, sf: null, len: null,
      finish: null, drain: null, channel: null,
      cost: stockRow ? stockRow.cost : (soRow ? soRow.net : 0),
      retail: stockRow ? stockRow.retail : (soRow ? soRow.retail : 0),
      unit: unitOf(stockRow, soRow),
      section: (soRow && soRow.section) || "",
      details: (soRow && soRow.details) || "",
      size: (soRow && soRow.size) || "",
      sizeText: "",
      soRetail: soRow ? soRow.retail : null,
      soNet: soRow ? soRow.net : null,
      desc: (stockRow && stockRow.desc) || "",
    };

    // Size text: the pricelist's own words where they exist (they carry the
    // thickness), otherwise the ERP description.
    var srcs = [];
    if (soRow) { srcs.push(soRow.size); srcs.push(soRow.name); }
    if (stockRow) srcs.push(stockRow.desc);
    var vals = null;
    for (var i = 0; i < srcs.length && !vals; i++) vals = dims(srcs[i]);
    var b = board(vals);
    e.w = b.w != null ? b.w : null;
    e.d = b.d != null ? b.d : null;
    e.t = b.t != null ? b.t : null;

    var text = (soRow ? soRow.name + " " + soRow.size + " " + soRow.details : "") + " " + (stockRow ? stockRow.desc : "");

    if (e.group === "pan") {
      if (e.sub === "linear") {
        var ch = String(text).match(new RegExp("(" + NUM + ")\\s*in\\.?\\s*channel", "i"));
        var chv = ch ? frac(ch[1].trim()) : null;
        e.channel = chv == null ? null : round2(chv);
      }
      e.drain = drainOf(e, text);
      e.sizeText = sizeTextOf(e.w, e.d, e.t);
    } else if (e.group === "module") {
      e.len = Math.max(e.w || 0, e.d || 0) || null;
      if (e.sub !== "discreto") { e.w = e.len; e.d = MODULE_DEPTH; e.channel = MODULE_CHANNEL[e.len] || null; }
      else {
        var dc = String(text).match(/channel length\s*([\d.]+)/i);
        e.channel = dc ? +dc[1] : null;
      }
      e.sizeText = sizeTextOf(e.w, e.d, null);
    } else if (e.group === "modExt") {
      // Every module extension is 66¾" deep, so the module length is the other
      // number whichever way round the sheet printed it.
      e.len = Math.min(e.w || 0, e.d || 0) || null;
      e.w = e.len; e.d = MODEXT_DEPTH;
      e.sizeText = sizeTextOf(e.w, e.d, null);
    } else if (e.group === "extension" || e.group === "cornerExt" || e.group === "ramp") {
      // The two sheets print these both ways round ("48 x 24", "12 x 60"), so
      // normalize: w is the run, d the depth it adds.
      var lo = Math.min(e.w, e.d), hi = Math.max(e.w, e.d);
      e.w = hi; e.d = lo; e.len = hi;
      e.sizeText = sizeTextOf(e.w, e.d, e.t);
    } else if (e.group === "curb") {
      var all = (vals || []).slice().sort(function (a, c) { return c - a; });
      e.len = all[0] || null;
      e.w = all[1] != null ? all[1] : null;   // profile height
      e.d = all[2] != null ? all[2] : null;   // profile width
      e.sizeText = e.len ? String(e.len) + '" curb' : "";
    } else if (e.group === "panel") {
      if (e.w && e.d) e.sf = round2(e.w * e.d / 144);
      e.sizeText = sizeTextOf(e.w, e.d, e.t);
    } else if (e.group === "cover" || e.group === "coverFrame") {
      var f = finishOf(name, e.desc);
      e.finish = f.finish;
      if (e.sub === "linear") { e.len = f.len; e.channel = f.len; }
      e.sizeText = e.sub === "linear" ? (e.len ? e.len + '" channel' : "") : '4" x 4"';
    } else if (e.group === "kit") {
      e.sizeText = sizeTextOf(e.w, e.d, null);
      e.drain = { type: /offset/i.test(text) ? "offset" : /linear|module/i.test(text) ? "linear" : "center" };
      e.sub = /nojs/i.test(name) ? "nojs" : "complete";
      e.family = /curbless/i.test(text) ? "curbless" : /linear/i.test(text) ? "linear" : "fundo";
    } else if (e.group === "subliner") {
      var sfm = String(text).match(/(\d+)\s*(?:sft|sf|ft2)\b/i);
      if (sfm) e.sf = +sfm[1];
      e.sizeText = e.size || "";
    } else {
      e.sizeText = e.w && e.d ? sizeTextOf(e.w, e.d, e.t) : "";
    }
    return e;
  }

  function build() {
    tables();
    var soRows = SO.filter(function (r) { return !r.kitNote; });
    var byErp = {}, byUs = {};
    soRows.forEach(function (r) {
      if (r.erp) byErp[r.erp] = r;
      if (r.us) byUs[r.us] = r;
    });
    var used = {}, out = [];
    // Stock outranks a matching pricelist row: one entry, stock:true, cost and
    // retail off the ERP (the pricelist figures ride along as soRetail/soNet —
    // the two linear extensions are the only pair that disagree).
    STOCK.forEach(function (row) {
      var so = (row.erp && byErp[row.erp]) || (row.us && byUs[row.us]) || null;
      if (so) used[so.us] = true;
      out.push(makeEntry(row, so));
    });
    soRows.forEach(function (row) {
      if (used[row.us]) return;
      out.push(makeEntry(null, row));
    });
    INDEX = {};
    out.forEach(function (e) {
      if (!INDEX[e.key]) INDEX[e.key] = e;
      if (e.erp && !INDEX[e.erp]) INDEX[e.erp] = e;
    });
    // The ERP mis-keys one Subliner roll as US50000005; keep it findable.
    STOCK.forEach(function (row) { if (row.us && !INDEX[row.us] && INDEX[row.erp]) INDEX[row.us] = INDEX[row.erp]; });
    return out;
  }

  function catalog() {
    if (!CAT) CAT = build();
    return CAT;
  }
  function item(key) {
    catalog();
    return INDEX[key] || null;
  }
  function group(g) {
    return catalog().filter(function (e) { return e.group === g; });
  }

  // Every pan the configurator will build on. S-DRY bases are stocked and
  // searchable but are a separate system — they stay out of the kit/solver tabs.
  function pans(opts) {
    opts = opts || {};
    var list = group("pan").filter(function (p) {
      if (p.sub === "sdry" && !opts.sdry) return false;
      if (opts.family && p.sub !== opts.family) return false;
      if (opts.drain && opts.drain !== "any" && (!p.drain || p.drain.type !== opts.drain)) return false;
      return true;
    });
    var order = { fundo: 0, curbless: 1, linear: 2, sdry: 3 };
    return list.sort(function (a, b) {
      return (order[a.sub] - order[b.sub]) || (a.w * a.d - b.w * b.d) || (a.w - b.w);
    });
  }

  // ==========================================================================
  // tiers
  // ==========================================================================

  function tierPrice(entry, tier, pct) {
    if (!entry) return 0;
    var retail = +entry.retail || 0, cost = +entry.cost || 0;
    switch (tier) {
      case "builder": return round2(retail * WEDI_BUILDER_MULT);
      case "employee": return round2(cost * 1.06);
      case "sale": return round2(retail * (1 - (pct == null ? 10 : pct) / 100));
      case "custom": return round2(retail * (1 - (pct == null ? 0 : pct) / 100));
      default: return round2(retail);
    }
  }

  // ==========================================================================
  // consumables
  // ==========================================================================

  function sealantItem(form, six20) {
    if (six20) return item(form === "tube" ? SKU.sealant620Tube : SKU.sealant620Sausage);
    return item(form === "tube" ? SKU.sealantTube : SKU.sealantSausage);
  }

  function figureConsumables(panelSf, form) {
    var sf = Math.max(0, +panelSf || 0);
    form = form === "tube" ? "tube" : "sausage";
    var oz = round2(sf * CONSUMABLES.sealantOzPerSf);
    var per = form === "tube" ? CONSUMABLES.tubeOz : CONSUMABLES.sausageOz;
    var fastenerCount = Math.ceil(sf * CONSUMABLES.fastenersPerSf);
    var lines = [];
    if (sf > 0) {
      lines.push({
        item: item(SKU.fastenerKit), qty: Math.ceil(fastenerCount / CONSUMABLES.fastenerKitCt),
        group: "install", auto: true,
        note: "1 screw + washer per ft² — " + round2(sf) + " sf, " + fastenerCount + " fasteners",
      });
      lines.push({
        item: sealantItem(form, false), qty: Math.ceil(oz / per),
        group: "install", auto: true,
        note: CONSUMABLES.sealantOzPerSf + " oz per ft² — " + oz + " oz",
      });
    }
    return { panelSf: round2(sf), sealantOz: oz, fastenerCount: fastenerCount, form: form, lines: lines };
  }

  // ==========================================================================
  // kit builder
  // ==========================================================================

  function defaultWalls(pan, room, h) {
    h = h || 80;
    var lo, hi;
    if (room && room.w && room.d) { hi = room.w; lo = room.d; }
    else if (pan.group === "module") { hi = pan.len; lo = MODULE_DEPTH + MODEXT_DEPTH; }
    else { hi = Math.max(pan.w, pan.d); lo = Math.min(pan.w, pan.d); }
    return [{ len: hi, h: h, side: "back" }, { len: lo, h: h, side: "left" }, { len: lo, h: h, side: "right" }];
  }

  function wallSf(walls) {
    return round2((walls || []).reduce(function (s, w) {
      return s + (+w.len || 0) * (+w.h || 0) / 144;
    }, 0));
  }

  function familyOf(pan) {
    if (pan.group === "module" || pan.group === "modExt") return "linear";
    return pan.sub === "sdry" ? "sdry" : pan.sub;
  }

  function factoryKit(w, d, family, drainType) {
    var fam = family === "curbless" ? "curbless" : family === "linear" ? "linear" : "fundo";
    var hits = group("kit").filter(function (k) {
      if (k.family !== fam) return false;
      var fit = (k.w === w && k.d === d) || (k.w === d && k.d === w);
      if (!fit) return false;
      if (fam === "linear") return true;
      return !drainType || !k.drain || k.drain.type === drainType;
    });
    var complete = hits.filter(function (k) { return k.sub === "complete"; })[0] || null;
    var nojs = hits.filter(function (k) { return k.sub === "nojs"; })[0] || null;
    return complete || nojs ? { kit: complete, nojs: nojs } : null;
  }

  function linearCoverFor(channel, finish) {
    var nom = nominalLen(channel);
    if (!nom) return null;
    var hits = group("cover").filter(function (c) {
      return c.sub === "linear" && c.len === nom && c.finish === (finish || "SS");
    });
    hits.sort(function (a, b) { return (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail; });
    return hits[0] || null;
  }

  function push(lines, key, qty, grp, note, auto) {
    var it = typeof key === "string" ? item(key) : key;
    if (!it || !(qty > 0)) return;
    lines.push({ item: it, qty: qty, group: grp, auto: auto !== false, note: note || "" });
  }

  function kitFor(panKey, opts) {
    opts = opts || {};
    var pan = typeof panKey === "string" ? item(panKey) : panKey;
    if (!pan) return null;
    var fam = familyOf(pan);
    var option = opts.option || null;
    var room = opts.room || (option ? { w: option.room.w, d: option.room.d } : null);
    var walls = opts.walls || defaultWalls(pan, room, opts.wallHeight);
    var panelSf = wallSf(walls);
    var form = opts.sealantForm === "tube" ? "tube" : "sausage";
    var panel = item(opts.panelKey || SKU.panelDefault) || item(SKU.panelDefault);
    var lines = [], hints = [];

    // --- floor ---------------------------------------------------------------
    push(lines, pan, 1, "floor", pan.sizeText, true);
    if (option) {
      option.floorLines.forEach(function (fl) {
        if (fl.item.key === pan.key) return;
        push(lines, fl.item, fl.qty, "floor", fl.note || "", true);
      });
    }
    (opts.floorExtra || []).forEach(function (x) {
      push(lines, x.key || x.item, x.qty || 1, "floor", x.note || "", false);
    });

    // --- walls ---------------------------------------------------------------
    var sheets = panel && panel.sf ? Math.ceil(panelSf / panel.sf) : 0;
    push(lines, panel, sheets, "walls",
      round2(panelSf) + " sf of wall — " + (panel.sf || 0) + " sf/sheet", true);

    // --- curb ----------------------------------------------------------------
    var curbKey = opts.curbKey;
    if (curbKey === undefined && fam === "fundo") {
      var entry = room ? room.w : Math.max(pan.w, pan.d);
      curbKey = entry > 60 ? SKU.curbLean96 : SKU.curbLean60;
    }
    if (curbKey === undefined && fam === "linear") curbKey = SKU.curbLean60;
    if (curbKey) {
      var curb = item(curbKey);
      var entryLen = room ? room.w : Math.max(pan.w, pan.d);
      push(lines, curb, 1, "floor",
        curb && curb.len && curb.len > entryLen ? "cut to " + round2(entryLen) + '"' : "", true);
    }

    // --- drain finish --------------------------------------------------------
    var coverKey = opts.coverKey;
    var cover = null;
    if (coverKey) cover = item(coverKey);
    else if (fam === "linear") {
      var ch = pan.channel || (option && option.drain && option.drain.len) || 0;
      cover = linearCoverFor(ch, opts.coverFinish || "SS");
    } else cover = item(SKU.coverSS);
    push(lines, cover, 1, "drain", cover && cover.finish ? FINISHES[cover.finish] || "" : "", true);

    // --- curbless waterproofing ---------------------------------------------
    var recess = opts.recess === undefined ? (fam === "curbless" ? "kit" : "none") : opts.recess;
    if (fam === "curbless") {
      push(lines, SKU.subliner53, 1, "install", "53 sf roll — field seal at the pan perimeter", true);
      push(lines, SKU.subCornerIn, 1, "install", "2 pcs/bag", true);
      push(lines, sealantItem(form, true), Math.ceil(CONSUMABLES.curbless620Oz / (form === "tube" ? CONSUMABLES.tubeOz : CONSUMABLES.sausageOz)),
        "install", CONSUMABLES.curbless620Oz + " oz allowance — Subliner field seal", true);
    }
    if (recess === "kit") push(lines, SKU.recessKit, 1, "install", "recess up to 5×5 ft in ¾ ply", true);
    if (recess === "ramp") push(lines, SKU.ramp, 1, "install", "surface mount — ADA slope", true);

    // --- consumables + install ----------------------------------------------
    var con = figureConsumables(panelSf, form);
    con.lines.forEach(function (l) { lines.push(l); });
    push(lines, SKU.collarValve, 1, "install", "mixing valve", true);
    push(lines, SKU.collarPipe, 1, "install", "shower arm / pipe", true);
    push(lines, SKU.trowel, 1, "install", "", true);

    // --- add-ons -------------------------------------------------------------
    (opts.addons || []).forEach(function (a) {
      var key = typeof a === "string" ? a : a.key;
      push(lines, key, (a && a.qty) || 1, "addon", (a && a.note) || "", false);
    });

    var hasGun = lines.some(function (l) { return l.item.key === SKU.gun; });
    var hasSausage = lines.some(function (l) { return l.item.group === "sealant" && /sausage/i.test(l.item.name); });
    if (hasSausage && !hasGun) hints.push("sausage-gun");
    var soNet = lines.reduce(function (s, l) {
      return s + (l.item.stock ? 0 : (l.item.soNet || l.item.cost || 0) * l.qty);
    }, 0);
    if (soNet > 0 && soNet < SO_MIN_NET) hints.push("small-order");

    var fw = room ? room.w : pan.w, fd = room ? room.d : pan.d;
    var factory = factoryKit(fw, fd, fam, pan.drain ? pan.drain.type : null);

    var cfg = {
      panKey: pan.key, walls: walls, panelKey: panel ? panel.key : null,
      curbKey: curbKey || null, coverKey: cover ? cover.key : null,
      sealantForm: form, recess: recess,
      addons: (opts.addons || []).map(function (a) { return typeof a === "string" ? a : a.key; }),
      room: room || null, solve: option ? { id: option.id, input: option.input } : null,
      tier: opts.tier || "retail",
    };

    return {
      pan: pan, lines: lines, panelSf: round2(panelSf), factory: factory, hints: hints,
      mode: opts.mode || (option ? "custom" : "kit"), cfg: cfg,
      consumables: con, soNet: round2(soNet),
    };
  }

  // ==========================================================================
  // solver
  // ==========================================================================
  //
  // Room coords: origin at the back-left corner, x rightward along the back
  // wall, y increasing toward the entry. A pan sits at (0,0) and any extensions
  // fill the +x and +y sides, so every piece stays against a wall.

  function orientations(p) {
    var o = [{ w: p.w, d: p.d, rot: false }];
    if (p.w !== p.d) o.push({ w: p.d, d: p.w, rot: true });
    return o;
  }

  function mapDrain(pan, rot, x0, y0) {
    var dr = pan.drain;
    if (!dr) return null;
    var x = rot ? dr.y : dr.x, y = rot ? dr.x : dr.y;
    var axis = dr.axis ? (rot ? (dr.axis === "w" ? "d" : "w") : dr.axis) : null;
    return {
      type: dr.type, x: round2(x0 + x), y: round2(y0 + y),
      len: dr.len || 0, axis: axis, note: dr.note || "",
    };
  }

  // A gap → the stacked extension layers that fill it, deepest against the pan.
  function layers(gap, fam) {
    var spec = EXT[fam === "curbless" ? "curbless" : "fundo"];
    if (gap <= 0) return [];
    if (gap > spec.max + 0.01) return null;
    var asc = spec.depths.slice().sort(function (a, b) { return a - b; });
    var one = asc.filter(function (x) { return x >= gap - 0.01; })[0];
    if (one != null) return [{ depth: gap, nominal: one, key: spec.items[one] }];
    var big = asc[asc.length - 1];
    var rest = layers(round2(gap - big), fam);
    return rest ? [{ depth: big, nominal: big, key: spec.items[big] }].concat(rest) : null;
  }

  // A gapped side → its pieces. Each layer is a band `depth` deep laid across
  // the side; a side longer than the extension takes several runs, the last cut.
  function runPieces(kind, lay, x0, y0, sideLen, horizontal) {
    var pieces = [], off = 0;
    lay.forEach(function (L) {
      var it = item(L.key);
      var n = Math.ceil(round2(sideLen / it.len - 0.0001)) || 1;
      var placed = 0;
      for (var i = 0; i < n; i++) {
        var runLen = Math.min(it.len, round2(sideLen - placed));
        var pw = horizontal ? L.depth : runLen;
        var pd = horizontal ? runLen : L.depth;
        var nomW = horizontal ? L.nominal : it.len;
        var nomD = horizontal ? it.len : L.nominal;
        pieces.push({
          kind: kind, item: it,
          x: round2(horizontal ? x0 + off : x0 + placed),
          y: round2(horizontal ? y0 + placed : y0 + off),
          w: round2(pw), d: round2(pd),
          cut: (pw < nomW - 0.01 || pd < nomD - 0.01) ? { w: nomW, d: nomD } : null,
        });
        placed = round2(placed + runLen);
      }
      off = round2(off + L.depth);
    });
    return pieces;
  }

  function aggregate(pieces) {
    var by = {}, order = [];
    pieces.forEach(function (p) {
      if (!by[p.item.key]) { by[p.item.key] = { item: p.item, qty: 0 }; order.push(p.item.key); }
      by[p.item.key].qty += 1;
    });
    return order.map(function (k) { return by[k]; });
  }

  function priceOf(lines) {
    return round2(lines.reduce(function (s, l) { return s + l.item.retail * l.qty; }, 0));
  }

  function seamWarning(n) {
    return n + " seam" + (n === 1 ? "" : "s") + " — set every joint in wedi Joint Sealant";
  }

  function exactOption(input, list) {
    var tol = input.tolerance || 0, best = null;
    list.forEach(function (p) {
      orientations(p).forEach(function (o) {
        if (Math.abs(o.w - input.w) > tol || Math.abs(o.d - input.d) > tol) return;
        if (!best || p.retail < best.pan.retail) best = { pan: p, o: o };
      });
    });
    if (!best) return null;
    var pieces = [{ kind: "pan", item: best.pan, x: 0, y: 0, w: best.o.w, d: best.o.d, cut: null }];
    var lines = aggregate(pieces);
    return {
      id: "exact", kind: "exact", title: best.pan.name + " " + best.pan.sizeText,
      badges: ["Perfect fit — no cutting"], pieces: pieces,
      drain: mapDrain(best.pan, best.o.rot, 0, 0), warnings: [],
      floorLines: lines, floorPrice: priceOf(lines), input: input,
      room: { w: input.w, d: input.d }, pan: best.pan,
    };
  }

  function extendOption(input, list, fam) {
    var best = null;
    list.forEach(function (p) {
      orientations(p).forEach(function (o) {
        var gw = round2(input.w - o.w), gd = round2(input.d - o.d);
        if (gw < 0 || gd < 0) return;
        if (gw === 0 && gd === 0) return;
        if ((gw > 0 && gw < MIN_GAP) || (gd > 0 && gd < MIN_GAP)) return;
        var lw = gw > 0 ? layers(gw, fam) : [];
        var ld = gd > 0 ? layers(gd, fam) : [];
        if (!lw || !ld) return;
        var pieces = [{ kind: "pan", item: p, x: 0, y: 0, w: o.w, d: o.d, cut: null }];
        var warn = [];
        if (gw > 0) pieces = pieces.concat(runPieces("ext", lw, o.w, 0, o.d, true));
        if (gd > 0) pieces = pieces.concat(runPieces("ext", ld, 0, o.d, o.w, false));
        if (gw > 0 && gd > 0) {
          if (gw <= CORNER_MAX && gd <= CORNER_MAX) {
            var ce = item(EXT[fam === "curbless" ? "curbless" : "fundo"].corner);
            pieces.push({
              kind: "cornerExt", item: ce, x: o.w, y: o.d, w: gw, d: gd,
              cut: (gw < ce.w - 0.01 || gd < ce.d - 0.01) ? { w: ce.w, d: ce.d } : null,
            });
          } else {
            warn.push("corner over 12\" — mitre two straights at 45° instead of a corner extension");
            var cw = gw > 0 ? layers(gw, fam) : [];
            pieces = pieces.concat(runPieces("ext", cw, o.w, o.d, gd, true));
          }
        }
        var lines = aggregate(pieces);
        var cuts = pieces.filter(function (x) { return !!x.cut; }).length;
        warn.unshift(seamWarning(pieces.length - 1));
        var cand = {
          id: "extend", kind: "extend",
          title: p.sizeText + " base + " + (pieces.length - 1) + " extension piece" + (pieces.length === 2 ? "" : "s"),
          badges: ["Extensions"].concat(cuts ? [] : ["No cutting"]),
          pieces: pieces, drain: mapDrain(p, o.rot, 0, 0), warnings: warn,
          floorLines: lines, floorPrice: priceOf(lines), input: input,
          room: { w: input.w, d: input.d }, pan: p, cuts: cuts,
        };
        if (!best) best = cand;
        else if (cand.pieces.length !== best.pieces.length) best = cand.pieces.length < best.pieces.length ? cand : best;
        else if (cand.cuts !== best.cuts) best = cand.cuts < best.cuts ? cand : best;
        else if (cand.floorPrice < best.floorPrice) best = cand;
      });
    });
    return best;
  }

  function cutdownOption(input, list, fam) {
    var best = null;
    list.forEach(function (p) {
      orientations(p).forEach(function (o) {
        if (o.w < input.w - 0.01 || o.d < input.d - 0.01) return;
        if (o.w === input.w && o.d === input.d) return;
        var area = o.w * o.d;
        if (!best || area < best.area || (area === best.area && p.retail < best.pan.retail)) best = { pan: p, o: o, area: area };
      });
    });
    if (!best) return null;
    var p = best.pan, o = best.o;
    var pieces = [{ kind: "pan", item: p, x: 0, y: 0, w: input.w, d: input.d, cut: { w: o.w, d: o.d } }];
    var lines = aggregate(pieces);
    var waste = round2((o.w * o.d - input.w * input.d) / 144);
    var warn = [fam === "curbless"
      ? "trim the perimeter to size — the ¾\" edge has to be re-formed"
      : "cut to size and re-create the ½\" channel around every cut edge"];
    var drain = mapDrain(p, o.rot, 0, 0);
    var offX = round2(Math.abs(drain.x - input.w / 2)), offY = round2(Math.abs(drain.y - input.d / 2));
    if (offX > 1 || offY > 1) warn.push("cut off the far sides — the drain lands " + Math.max(offX, offY) + "\" off the room centre");
    return {
      id: "cutdown", kind: "cutdown", title: p.sizeText + " base cut to " + sizeTextOf(input.w, input.d),
      badges: ["Cut to size"], pieces: pieces, drain: drain, warnings: warn,
      floorLines: lines, floorPrice: priceOf(lines), waste: waste, input: input,
      room: { w: input.w, d: input.d }, pan: p,
    };
  }

  function linearOption(input) {
    var tol = input.tolerance || 0;
    var base = null;
    group("pan").filter(function (p) { return p.sub === "linear"; }).forEach(function (p) {
      orientations(p).forEach(function (o) {
        if (Math.abs(o.w - input.w) > tol || Math.abs(o.d - input.d) > tol) return;
        if (!base || p.retail < base.pan.retail) base = { pan: p, o: o };
      });
    });
    if (base) {
      var pieces = [{ kind: "pan", item: base.pan, x: 0, y: 0, w: base.o.w, d: base.o.d, cut: null }];
      var lines = aggregate(pieces);
      return {
        id: "linear", kind: "linear", title: base.pan.name + " " + base.pan.sizeText,
        badges: ["Drain at wall", "Perfect fit — no cutting"], pieces: pieces,
        drain: mapDrain(base.pan, base.o.rot, 0, 0), warnings: [],
        floorLines: lines, floorPrice: priceOf(lines), input: input,
        room: { w: input.w, d: input.d }, pan: base.pan,
      };
    }
    // The module carries the channel and cannot be cut through it, so the room
    // width has to be a module length; the extension takes the depth cut.
    var len = MODULE_LENGTHS.filter(function (L) { return Math.abs(L - input.w) <= tol; })[0];
    if (!len) return null;
    var extDepth = round2(input.d - MODULE_DEPTH);
    if (extDepth <= 0 || extDepth > MODEXT_DEPTH + 0.01) return null;
    var mod = group("module").filter(function (m) { return m.sub === "neo" && m.len === len; })
      .sort(function (a, b) { return (b.stock ? 1 : 0) - (a.stock ? 1 : 0); })[0];
    var ext = group("modExt").filter(function (m) { return m.len === len; })[0];
    if (!mod || !ext) return null;
    var mp = [
      { kind: "module", item: mod, x: 0, y: 0, w: len, d: MODULE_DEPTH, cut: null },
      {
        kind: "modExt", item: ext, x: 0, y: MODULE_DEPTH, w: len, d: extDepth,
        cut: extDepth < MODEXT_DEPTH - 0.01 ? { w: len, d: MODEXT_DEPTH } : null,
      },
    ];
    var ml = aggregate(mp);
    var mw = [seamWarning(1)];
    if (mp[1].cut) mw.push("extension cut to " + extDepth + "\" deep — the module sets the width");
    return {
      id: "linear", kind: "linear", title: len + '" linear module + extension',
      badges: ["Drain at wall"], pieces: mp,
      drain: { type: "linear", x: round2(len / 2), y: round2(MODULE_DEPTH / 2), len: mod.channel, axis: "w", note: "" },
      warnings: mw, floorLines: ml, floorPrice: priceOf(ml), input: input,
      room: { w: input.w, d: input.d }, pan: mod,
    };
  }

  function solve(input) {
    input = {
      w: +(input && input.w) || 0, d: +(input && input.d) || 0,
      curb: (input && input.curb) === "curbless" ? "curbless" : "curbed",
      drain: (input && input.drain) || "any",
      tolerance: +(input && input.tolerance) || 0,
    };
    if (!(input.w > 0) || !(input.d > 0)) return [];
    var fam = input.curb === "curbless" ? "curbless" : "fundo";
    var list = group("pan").filter(function (p) {
      if (p.sub !== fam) return false;
      if (input.drain !== "any" && p.drain.type !== input.drain) return false;
      return true;
    });

    var out = [];
    if (input.drain !== "linear") {
      [exactOption(input, list), extendOption(input, list, fam), cutdownOption(input, list, fam)]
        .forEach(function (o) { if (o) out.push(o); });
    }
    if (input.curb === "curbed" && (input.drain === "any" || input.drain === "linear")) {
      var lin = linearOption(input);
      if (lin) out.push(lin);
    }
    out.sort(function (a, b) {
      return a.warnings.length - b.warnings.length || a.floorPrice - b.floorPrice;
    });
    if (out.length) {
      var cheap = out.slice().sort(function (a, b) { return a.floorPrice - b.floorPrice; })[0];
      cheap.badges = ["Cheapest"].concat(cheap.badges);
      var few = out.slice().sort(function (a, b) { return a.pieces.length - b.pieces.length; })[0];
      if (few !== cheap && few.pieces.length < cheap.pieces.length) few.badges = few.badges.concat(["Fewest pieces"]);
    }
    return out;
  }

  // ==========================================================================
  // product-row payloads (requirement 12)
  // ==========================================================================

  function lineItems(build, opts) {
    if (!build || !build.lines) return [];
    opts = opts || {};
    var mark = { mode: build.mode || "kit", cfg: JSON.parse(JSON.stringify(build.cfg || {})) };
    if (opts.tier) mark.cfg.tier = opts.tier;
    return build.lines.map(function (l, i) {
      var e = l.item;
      var anchor = i === 0;
      var lead = e.stock ? (/^\s*wedi/i.test(e.name) ? "" : "wedi — ") : "wedi " + e.us + " — ";
      return {
        type: "misc",
        sku: e.stock ? e.erp || "" : "",
        sizeText: e.sizeText || "",
        brandColor: lead + e.name,
        qtyType: "count",
        qty: String(l.qty),
        priceSqft: String(round2(e.retail)),
        costSqft: String(round2(e.cost)),
        markupPct: "",
        tierPrice: String(round2(e.retail * WEDI_BUILDER_MULT)),
        wedi: anchor ? mark : { part: true },
      };
    });
  }

  // ==========================================================================
  // search entry
  // ==========================================================================

  // Words that name wedi on their own; the generic ones below need a size or the
  // word "shower" beside them, or every tile query would pin the configurator.
  var STRONG = ["fundo", "curbless", "riolito", "subliner", "sanoasa", "discreto",
    "click and seal", "shower base", "shower pan", "shower kit", "niche", "vapor 85",
    "curbless pan", "linear drain", "shower system"];
  var WEAK = ["pan", "curb", "sealant", "vapor", "base", "panel", "drain", "cover",
    "seat", "bench", "shelf", "ramp", "screw", "washer", "fastener", "membrane",
    "backer", "shower"];

  var SIZE_RE = new RegExp(
    "(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?\\s*(?:x|×|by)\\s*(\\d+(?:\\.\\d+)?)\\s*(''|\"|in\\.?|'|ft\\.?)?", "i");

  function parseQuery(q) {
    var s = " " + String(q || "").toLowerCase().replace(/[,]/g, " ") + " ";
    var out = { w: null, d: null, curb: null, drain: "any", tab: "browse" };
    var m = s.match(SIZE_RE);
    if (m) {
      var a = +m[1], b = +m[3];
      var ft = /^(?:'|ft\.?)$/.test((m[2] || "").trim()) || /^(?:'|ft\.?)$/.test((m[4] || "").trim());
      if (!ft && !m[2] && !m[4] && a <= 12 && b <= 12) ft = true;
      out.w = ft ? a * 12 : a;
      out.d = ft ? b * 12 : b;
    }
    if (/curbless|barrier[- ]free|zero[- ]entry|ligno/.test(s)) out.curb = "curbless";
    else if (/curbed|\bcurb\b/.test(s)) out.curb = "curbed";
    if (/linear|riolito|channel|trough/.test(s)) out.drain = "linear";
    else if (/offset/.test(s)) out.drain = "offset";
    else if (/cente?re?r?\b/.test(s)) out.drain = "center";
    var kitWords = /\bkits?\b|\bpans?\b|shower base|\bbase\b|fundo|curbless|linear|riolito|shower system/.test(s);
    var partWords = STRONG.concat(WEAK).some(function (w) { return s.indexOf(w) >= 0; });
    // A bare "wedi" lands on the kit cards; naming a part goes to the catalog.
    out.tab = out.w && out.d ? "custom" : kitWords ? "kits" : partWords ? "browse" : "kits";
    return out;
  }

  function queryHit(q) {
    var s = String(q || "").toLowerCase();
    var toks = s.split(/[^a-z0-9'"×.\/]+/).filter(Boolean);
    if (toks.some(function (t) { return t.length >= 3 && "wedi".indexOf(t) === 0; })) return true;
    if (STRONG.some(function (w) { return s.indexOf(w) >= 0; })) return true;
    var weak = WEAK.filter(function (w) { return s.indexOf(w) >= 0; });
    if (!weak.length) return false;
    if (weak.indexOf("shower") >= 0 && weak.length > 1) return true;
    var p = parseQuery(q);
    return !!(p.w && p.d);
  }

  function querySummary(p) {
    if (typeof p === "string") p = parseQuery(p);
    if (!p) return "";
    if (p.tab === "custom") {
      var bits = [round2(p.w) + "×" + round2(p.d) + '"', p.curb === "curbless" ? "curbless" : "curbed"];
      if (p.drain !== "any") bits.push(p.drain + " drain");
      return "opens the room solver: " + bits.join(" · ");
    }
    if (p.tab === "kits") {
      return "opens one-click stock kits" + (p.curb ? " · " + p.curb : "") + (p.drain !== "any" ? " · " + p.drain + " drain" : "");
    }
    return "opens the wedi catalog — stock first, special order behind it";
  }

  function seedFromQuery(q) {
    var p = parseQuery(q);
    return {
      tab: p.tab,
      input: {
        w: p.w || 36, d: p.d || 60,
        curb: p.curb || "curbed", drain: p.drain || "any", tolerance: 0,
      },
      search: p.tab === "browse" ? String(q || "").replace(/\bwedi\b/gi, "").trim() : "",
      parsed: p,
    };
  }

  // ==========================================================================

  var API = {
    catalog: catalog, item: item, group: group, pans: pans,
    kitFor: kitFor, solve: solve, figureConsumables: figureConsumables,
    TIERS: TIERS, tierPrice: tierPrice, lineItems: lineItems,
    queryHit: queryHit, parseQuery: parseQuery, querySummary: querySummary, seedFromQuery: seedFromQuery,
    factoryKit: factoryKit, linearCoverFor: linearCoverFor, dims: dims, round2: round2, inch: inch,
    CONSUMABLES: CONSUMABLES, SKU: SKU, FINISHES: FINISHES, GROUP_LABEL: GROUP_LABEL,
    MODULE_CHANNEL: MODULE_CHANNEL, BUILDER_MULT: WEDI_BUILDER_MULT, SO_MIN_NET: SO_MIN_NET,
    selfTest: selfTest,
  };
  (typeof globalThis !== "undefined" ? globalThis : this).WEDI = API;

  // ==========================================================================
  // self-test
  // ==========================================================================

  function selfTest(log) {
    var pass = 0, fail = 0;
    function ok(name, cond, got) {
      if (cond) { pass++; log("PASS  " + name); }
      else { fail++; log("FAIL  " + name + (got === undefined ? "" : "  → got: " + JSON.stringify(got))); }
    }
    var near = function (a, b, e) { return Math.abs(a - b) <= (e == null ? 0.01 : e); };

    // --- parsing -------------------------------------------------------------
    ok("frac 1 37/64 = 1.578125", frac("1 37/64") === 1.578125);
    ok("frac 27-1/2 = 27.5", frac("27-1/2") === 27.5);
    ok("inch() prints the sheets' fractions", inch(1.578125) === "1 37/64" && inch(0.5) === "1/2" && inch(5.75) === "5 3/4" && inch(36) === "36");
    ok("pan sizeText matches the pricelist", item("US9100004").sizeText === '36" x 60" x 1 37/64"', item("US9100004").sizeText);
    ok("dims '36 in. x 60 in. x 1 37/64 in.'", JSON.stringify(dims("36 in. x 60 in. x 1 37/64 in.")) === "[36,60,1.578125]", dims("36 in. x 60 in. x 1 37/64 in."));
    ok('dims \'48"x60"x1/2"\'', JSON.stringify(dims('wedi® Building Panel 48"x60"x1/2"')) === "[48,60,0.5]", dims('wedi® Building Panel 48"x60"x1/2"'));
    ok("dims '16 1/2 in. x 16 1/2 in.'", JSON.stringify(dims("16 1/2 in. x 16 1/2 in.")) === "[16.5,16.5]", dims("16 1/2 in. x 16 1/2 in."));
    ok("dims ERP \"3'x5' Wedi Fundo Pan\"", JSON.stringify(dims("3'x5' Wedi Fundo Pan - US9100004 CS Center Drain")) === "[36,60]", dims("3'x5' Wedi Fundo Pan"));
    ok("dims ERP \"4'x8'x1/2\\\" panel\"", JSON.stringify(dims('4\'x8\'x1/2" Wedi Building Panel')) === "[48,96,0.5]", dims('4\'x8\'x1/2" Wedi Building Panel'));
    ok("dims ERP '38x64' reads inches", JSON.stringify(dims("38x64 Wedi S-DRY Shower Base")) === "[38,64]", dims("38x64 Wedi S-DRY Shower Base"));
    ok("dims ERP '4x8' reads feet", JSON.stringify(dims("4x8 Wedi Vapor 85")) === "[48,96]", dims("4x8 Wedi Vapor 85"));
    ok('dims ERP \'32"x5-3/4"\'', JSON.stringify(dims('32"x5-3/4" Wedi Riolito Neo')) === "[32,5.75]", dims('32"x5-3/4"'));

    // --- catalog -------------------------------------------------------------
    var cat = catalog();
    var stockEntries = cat.filter(function (e) { return e.stock; });
    ok("151 stock rows classified", stockEntries.length === 151, stockEntries.length);
    var stockMisc = stockEntries.filter(function (e) { return e.group === "misc"; });
    ok("0 stock rows in misc", stockMisc.length === 0, stockMisc.map(function (e) { return e.us + " " + e.name; }));
    var soMisc = cat.filter(function (e) { return !e.stock && e.group === "misc"; });
    ok("0 special-order rows in misc", soMisc.length === 0, soMisc.map(function (e) { return e.us + " " + e.name; }));
    ok("269 catalog entries (151 stock + 118 SO-only; 105 pricelist rows merge)", cat.length === 269, cat.length);
    var keys = {}, dupes = [];
    cat.forEach(function (e) { if (keys[e.key]) dupes.push(e.key); keys[e.key] = 1; });
    ok("catalog keys unique", dupes.length === 0, dupes);
    ok("every entry priced", cat.every(function (e) { return e.retail > 0 || /sample/i.test(e.name); }));

    // --- pans ----------------------------------------------------------------
    var allPans = pans({ sdry: true });
    ok("every pan has w, d and a drain", allPans.every(function (p) { return p.w > 0 && p.d > 0 && p.drain && p.drain.type; }),
      allPans.filter(function (p) { return !(p.w > 0 && p.d > 0 && p.drain); }).map(function (p) { return p.us; }));
    var byFam = function (f) { return allPans.filter(function (p) { return p.sub === f; }).length; };
    ok("17 stocked Fundo pans", byFam("fundo") === 17, byFam("fundo"));
    ok("10 curbless pans", byFam("curbless") === 10, byFam("curbless"));
    ok("3 linear bases", byFam("linear") === 3, byFam("linear"));
    ok("4 S-DRY bases (excluded from pans() by default)", byFam("sdry") === 4 && pans().length === allPans.length - 4);
    ok("US9100004 is 36×60, centre drain at (18,30)", (function () {
      var p = item("US9100004");
      return p.w === 36 && p.d === 60 && p.drain.type === "center" && p.drain.x === 18 && p.drain.y === 30;
    })());
    ok("US9100004 prices: ERP 343.04 cost / 566.01 retail (pricelist net 343.03 rides along)", (function () {
      var p = item("US9100004");
      return p.cost === 343.04 && p.retail === 566.01 && p.soNet === 343.03;
    })(), item("US9100004").cost + "/" + item("US9100004").retail);
    ok("US9100005 (36×72) is the offset fundo, drain at (18,18) + spec-sheet note", (function () {
      var p = item("US9100005");
      return p.drain.type === "offset" && p.drain.x === 18 && p.drain.y === 18 && /spec sheet/.test(p.drain.note);
    })());
    ok("US9200007 (36×60 curbless) is offset", item("US9200007").drain.type === "offset" && item("US9200007").sub === "curbless");
    ok("US9100013 Primo (60×72 corner/offset) reads offset", item("US9100013").drain.type === "offset");
    ok("linear base channels 43.30 / 27.59 / 43.30", (function () {
      return near(item("US9310001").channel, 43.3) && near(item("US9310002").channel, 27.59) && near(item("US9310003").channel, 43.3);
    })(), [item("US9310001").channel, item("US9310002").channel, item("US9310003").channel]);

    // --- other groups --------------------------------------------------------
    ok("panel US8000017 = 36×60×½, 15 sf", (function () {
      var p = item("US8000017");
      return p.w === 36 && p.d === 60 && p.t === 0.5 && p.sf === 15;
    })());
    ok("panel sf: 4×5 = 20, 4×8 = 32", item("US8000014").sf === 20 && item("US8000015").sf === 32);
    ok("Vapor 85 US8000026 sub 'vapor'", item("US8000026").sub === "vapor" && item("US8000026").sf === 32);
    ok("extensions normalized run×depth: 48×24, 72×12, 60×12", (function () {
      var a = item("073783528"), b = item("US3000036"), c = item("US3000035");
      return a.w === 48 && a.d === 24 && b.w === 72 && b.d === 12 && c.w === 60 && c.d === 12 && c.sub === "curbless";
    })());
    ok("corner extensions are 16.5 sq", item("US3000053").w === 16.5 && item("US3000052").d === 16.5);
    ok("curb lengths from the name: 60 / 96", item("US3000038").len === 60 && item("US3000040").len === 96);
    ok("modules carry the pricelist channel (32→27.59, 48→43.31)", item("US9320001").channel === 27.59 && item("US9320002").channel === 43.31);
    ok("module extensions are 66¾ deep", item("US9330001").d === 66.75 && item("US9330002").len === 48);
    ok("legacy 075100052 classifies as a module (pre-Click&Seal 32\")", item("075100052").group === "module" && item("075100052").sub === "legacy");
    ok("US9330001 keeps both prices (ERP 407.32 retail vs pricelist 529.79)", item("US9330001").retail === 407.32 && item("US9330001").soRetail === 529.79);
    ok("point cover finishes parse (SS, T38, CHA, CSL)", (function () {
      return item("US1000057").finish === "SS" && item("US1000047").finish === "T38" &&
        item("US1000124").finish === "CHA" && item("US1000053").finish === "CSL";
    })());
    ok("linear cover SS43 = US1000085, nominal 43", item("US1000085").finish === "SS" && item("US1000085").len === 43 && item("US1000085").sub === "linear");
    ok("legacy 676797048 is the stocked SS27 linear cover", (function () {
      var c = item("676797048");
      return c.group === "cover" && c.sub === "linear" && c.finish === "SS" && c.len === 27;
    })());
    ok("legacy 676800061/64 are the only SS cover frames", (function () {
      var f = group("coverFrame").filter(function (c) { return c.finish === "SS"; }).map(function (c) { return c.len; }).sort();
      return item("676800061").len === 27 && item("676800064").len === 43 && f.length === 4;
    })());
    ok("the ERP's mis-keyed US50000005 resolves to the US5000005 subliner roll", (function () {
      var a = item("US50000005"), b = item("US5000005");
      return a && a === b && a.group === "subliner" && a.stock && a.sf === 323;
    })(), item("US50000005") && item("US50000005").key);
    ok("the bucket and gun tips are tools, not misc", item("US7000058").group === "tool" && item("US5000020").group === "tool");
    ok("Vapor 85 patch kit files with fasteners", item("US5000089").group === "fastener" && item("US5000089").sub === "vapor");
    ok("S-DRY line is its own group (US9176 bases stay pans)", (function () {
      var s = group("sdry");
      return s.length >= 25 && s.every(function (e) { return /^US\d\d76/.test(e.us); }) && item("US9176001").group === "pan";
    })(), group("sdry").length);

    // --- tiers ---------------------------------------------------------------
    ok("builder on $378.18 retail → 310.11", tierPrice({ retail: 378.18, cost: 229.2 }, "builder") === 310.11, tierPrice({ retail: 378.18 }, "builder"));
    ok("employee = cost × 1.06 (343.04 → 363.62)", tierPrice({ retail: 566.01, cost: 343.04 }, "employee") === 363.62, tierPrice({ cost: 343.04 }, "employee"));
    ok("sale defaults to 10% off retail", tierPrice({ retail: 566.01 }, "sale") === 509.41, tierPrice({ retail: 566.01 }, "sale"));
    ok("custom 15% off retail", tierPrice({ retail: 566.01 }, "custom", 15) === 481.11);
    ok("TIERS list", TIERS.join() === "retail,builder,employee,sale,custom");

    // --- consumables ---------------------------------------------------------
    var con = figureConsumables(100, "sausage");
    ok("100 sf → 120 oz → 6 sausages, 1 fastener kit", con.sealantOz === 120 && con.lines[1].qty === 6 && con.lines[0].qty === 1, [con.sealantOz, con.lines[1].qty, con.lines[0].qty]);
    var conT = figureConsumables(100, "tube");
    ok("100 sf in tubes → ceil(120/10.5) = 12", conT.lines[1].qty === 12, conT.lines[1].qty);

    // --- kit builder ---------------------------------------------------------
    var kit = kitFor("US9100004");
    var lineFor = function (b, key) { return b.lines.filter(function (l) { return l.item.key === key; })[0]; };
    // 3 walls at 80" over a 36×60 pan: 80 × (60+36+36) / 144 = 73.33 sf.
    ok("36×60 default walls → 73.33 sf of panel", near(kit.panelSf, 73.33), kit.panelSf);
    ok("kit contains the pan", lineFor(kit, "US9100004") && lineFor(kit, "US9100004").qty === 1);
    ok("5 sheets of 3×5×½ (73.33 / 15 = 4.89)", lineFor(kit, "US8000017").qty === 5, lineFor(kit, "US8000017") && lineFor(kit, "US8000017").qty);
    ok("1 fastener kit (73 fasteners ≤ 100)", lineFor(kit, "US5000070").qty === 1);
    ok("5 sausages (1.2 × 73.33 = 88 oz / 20)", lineFor(kit, "US5000010").qty === 5, lineFor(kit, "US5000010") && lineFor(kit, "US5000010").qty);
    ok("curb lean 60 US3000038", !!lineFor(kit, "US3000038"));
    ok("SS 4×4 cover US1000057", !!lineFor(kit, "US1000057"));
    ok("both collars, one each", lineFor(kit, "US5000000").qty === 1 && lineFor(kit, "US5000033").qty === 1);
    ok("corner putty trowel", !!lineFor(kit, "US5000044"));
    ok("factory compare = US2000003 / US2100004", kit.factory && kit.factory.kit.key === "US2000003" && kit.factory.nojs.key === "US2100004",
      kit.factory && [kit.factory.kit.key, kit.factory.nojs.key]);
    ok("sausage in the build with no gun → hints ['sausage-gun']", kit.hints.indexOf("sausage-gun") >= 0, kit.hints);
    // The recipe mirrors wedi's own boxed contents, so the stock build should
    // land within a few percent of the factory NOJS kit.
    var kitTotal = kit.lines.reduce(function (s, l) { return s + l.item.retail * l.qty; }, 0);
    var noJsTotal = kit.lines.reduce(function (s, l) { return s + (l.item.group === "sealant" ? 0 : l.item.retail * l.qty); }, 0);
    ok("stock build (no sealant) within 5% of the US2100004 boxed kit", Math.abs(noJsTotal - 998.48) / 998.48 < 0.05,
      round2(noJsTotal) + " vs 998.48");
    ok("stock build with sealant within 5% of the US2000003 boxed kit", Math.abs(kitTotal - 1152.21) / 1152.21 < 0.05,
      round2(kitTotal) + " vs 1152.21");
    var kit72 = kitFor("US9100006");   // 36×72 — entry side over 60"
    ok("36×72 entry takes the 96\" lean curb", !!lineFor(kit72, "US3000040") && !lineFor(kit72, "US3000038"));
    var kitC = kitFor("US9200003");
    ok("curbless kit: no curb, + subliner, corners, 620 and the recess kit", (function () {
      return !lineFor(kitC, "US3000038") && !!lineFor(kitC, "US5000001") && !!lineFor(kitC, "US5000007") &&
        !!lineFor(kitC, "US5000083") && !!lineFor(kitC, "US5000085");
    })());
    ok("curbless 620 = 40 oz allowance → 2 sausages", lineFor(kitC, "US5000083").qty === 2, lineFor(kitC, "US5000083").qty);
    var kitL = kitFor("US9310001");
    ok("linear base takes the matching 43\" SS linear cover", !!lineFor(kitL, "US1000085"), kitL.lines.filter(function (l) { return l.item.group === "cover"; }).map(function (l) { return l.item.key; }));
    var kitAdd = kitFor("US9100004", { addons: ["US3000005", SKU.gun], sealantForm: "tube" });
    ok("addons land un-auto in the addon group", (function () {
      var n = lineFor(kitAdd, "US3000005");
      return n && n.group === "addon" && n.auto === false;
    })());
    ok("tube form → 9 tubes (88 oz / 10.5), gun addon clears the hint", lineFor(kitAdd, "US5000013").qty === 9 && kitAdd.hints.indexOf("sausage-gun") < 0,
      lineFor(kitAdd, "US5000013").qty);

    // --- solver --------------------------------------------------------------
    var s1 = solve({ w: 36, d: 60, curb: "curbed", drain: "any" });
    ok("36×60 curbed → exact US9100004 first", s1[0].kind === "exact" && s1[0].pieces[0].item.key === "US9100004", s1[0] && [s1[0].kind, s1[0].pieces[0].item.key]);
    ok("36×60 exact has no warnings and is badged Cheapest", s1[0].warnings.length === 0 && s1[0].badges.indexOf("Cheapest") >= 0);
    ok("36×60 exact drain lands at room centre (18,30)", s1[0].drain.x === 18 && s1[0].drain.y === 30);

    var s2 = solve({ w: 48, d: 66, curb: "curbed", drain: "any" });
    var ex = s2.filter(function (o) { return o.kind === "extend"; })[0];
    var cd = s2.filter(function (o) { return o.kind === "cutdown"; })[0];
    ok("48×66 extend = 48×48 base + 073783528 cut to 18\" deep", (function () {
      if (!ex) return false;
      var e = ex.pieces[1];
      return ex.pieces[0].item.key === "US9100003" && e.item.key === "073783528" && e.d === 18 && e.cut && e.cut.d === 24;
    })(), ex && ex.pieces.map(function (p) { return p.item.key + " " + p.w + "×" + p.d; }));
    ok("48×66 extension sits against the far wall at y = 48", ex && ex.pieces[1].x === 0 && ex.pieces[1].y === 48);
    ok("48×66 cutdown uses the 48×72 US9100010", cd && cd.pieces[0].item.key === "US9100010" && cd.pieces[0].cut.d === 72, cd && cd.pieces[0].item.key);
    ok("48×66 cutdown warns about re-creating the ½\" channel", cd && /channel/.test(cd.warnings[0]));
    ok("48×66 cutdown waste = 2 sf", cd && cd.waste === 2, cd && cd.waste);
    ok("48×66 extend is the cheapest option", ex && ex.badges.indexOf("Cheapest") >= 0, s2.map(function (o) { return o.kind + " $" + o.floorPrice; }));

    var s3 = solve({ w: 36, d: 60, curb: "curbless", drain: "offset" });
    ok("36×60 curbless offset → US9200007", s3[0] && s3[0].pieces[0].item.key === "US9200007", s3[0] && s3[0].pieces[0].item.key);

    var s4 = solve({ w: 32, d: 72, curb: "curbed", drain: "linear" });
    ok("32×72 linear → module US9320001 + extension US9330001", (function () {
      if (!s4[0] || s4[0].kind !== "linear") return false;
      return s4[0].pieces[0].item.key === "US9320001" && s4[0].pieces[1].item.key === "US9330001";
    })(), s4[0] && s4[0].pieces.map(function (p) { return p.item.key; }));
    ok("32×72 module extension cut to 66.25\" deep (72 − 5.75)", s4[0] && s4[0].pieces[1].d === 66.25 && !!s4[0].pieces[1].cut);
    ok("32×72 drain sits at the module wall, 27.59\" channel", s4[0] && s4[0].drain.type === "linear" && s4[0].drain.y === 2.88 && s4[0].drain.len === 27.59, s4[0] && s4[0].drain);
    ok("32×72 matches the US2000062 factory linear kit", (function () {
      var k = kitFor(s4[0].pan.key, { option: s4[0] });
      return k.factory && k.factory.kit.key === "US2000062" && k.factory.nojs.key === "US2100015";
    })());
    ok("linear-only solve returns just the linear option", s4.length === 1 && s4.every(function (o) { return o.kind === "linear"; }));
    ok("36×60 curbed also offers the US9310001 linear base", (function () {
      var lin = s1.filter(function (o) { return o.kind === "linear"; })[0];
      return lin && lin.pieces[0].item.key === "US9310001" && lin.badges.indexOf("Drain at wall") >= 0;
    })());
    ok("48×78 extend prefers the 2-piece 48×60 + a 24 cut to 18 over stacking", (function () {
      var e = solve({ w: 48, d: 78, curb: "curbed", drain: "any" }).filter(function (o) { return o.kind === "extend"; })[0];
      return e && e.pieces.length === 2 && e.pieces[0].item.key === "US9100009" && e.pieces[1].d === 18;
    })());
    // Curbless has only the 12" straight, so a 24" gap is the stacking case.
    var ex5 = solve({ w: 60, d: 96, curb: "curbless", drain: "any" }).filter(function (o) { return o.kind === "extend"; })[0];
    ok("60×96 curbless stacks 12 + 12 for the 24\" gap", (function () {
      if (!ex5) return false;
      var ext = ex5.pieces.slice(1);
      return ex5.pieces[0].item.key === "US9200009" && ext.length === 2 &&
        ext.every(function (p) { return p.item.key === "US3000035" && p.d === 12 && !p.cut; }) &&
        ext[0].y === 72 && ext[1].y === 84;
    })(), ex5 && ex5.pieces.map(function (p) { return p.item.key + " " + p.w + "×" + p.d + " @" + p.x + "," + p.y; }));
    // 72×108 forces the fundo ceiling: a 36" gap = 24 + 12 stacked, and the 48"
    // long 24-deep piece takes two runs across a 72" side.
    var ex6 = solve({ w: 72, d: 108, curb: "curbed", drain: "any" }).filter(function (o) { return o.kind === "extend"; })[0];
    ok("72×108 fundo stacks 24 + 12 and runs two pieces across the 72\" side", (function () {
      if (!ex6) return false;
      var ext = ex6.pieces.slice(1);
      return ex6.pieces[0].item.key === "US9100016" && ext.length === 3 &&
        ext[0].item.key === "073783528" && ext[0].w === 48 && ext[0].y === 72 && !ext[0].cut &&
        ext[1].item.key === "073783528" && ext[1].w === 24 && ext[1].x === 48 && ext[1].cut.w === 48 &&
        ext[2].item.key === "US3000036" && ext[2].d === 12 && ext[2].y === 96;
    })(), ex6 && ex6.pieces.map(function (p) { return p.item.key + " " + p.w + "×" + p.d + " @" + p.x + "," + p.y + (p.cut ? " cut from " + p.cut.w + "×" + p.cut.d : ""); }));
    var s6 = solve({ w: 48, d: 72, curb: "curbless", drain: "any" });
    ok("48×72 curbless → exact US9200008", s6[0].kind === "exact" && s6[0].pieces[0].item.key === "US9200008");
    var s7 = solve({ w: 54, d: 66, curb: "curbless", drain: "any" });
    var ex7 = s7.filter(function (o) { return o.kind === "extend"; })[0];
    ok("54×66 curbless extends on two sides with the curbless corner US3000052", (function () {
      if (!ex7) return false;
      return ex7.pieces.some(function (p) { return p.kind === "cornerExt" && p.item.key === "US3000052"; }) &&
        ex7.pieces.every(function (p) { return p.kind === "pan" || /US3000035|US3000052/.test(p.item.key); });
    })(), ex7 && ex7.pieces.map(function (p) { return p.kind + " " + p.item.key; }));
    ok("every solved piece stays inside the room", solve({ w: 48, d: 78, curb: "curbed", drain: "any" }).every(function (o) {
      return o.pieces.every(function (p) { return p.x >= 0 && p.y >= 0 && p.x + p.w <= o.room.w + 0.01 && p.y + p.d <= o.room.d + 0.01; });
    }));
    ok("options sort by warnings then price", solve({ w: 48, d: 66, curb: "curbed", drain: "any" }).every(function (o, i, a) {
      return i === 0 || a[i - 1].warnings.length < o.warnings.length ||
        (a[i - 1].warnings.length === o.warnings.length && a[i - 1].floorPrice <= o.floorPrice);
    }));

    // --- line payloads -------------------------------------------------------
    var rows = lineItems(kit, { tier: "builder" });
    ok("lineItems: one row per build line", rows.length === kit.lines.length);
    ok("pan row is the anchor and carries wedi.cfg", rows[0].wedi && rows[0].wedi.cfg && rows[0].wedi.cfg.panKey === "US9100004" && rows[0].wedi.mode === "kit");
    ok("companion rows carry wedi.part", rows.slice(1).every(function (r) { return r.wedi && r.wedi.part === true; }));
    ok("pan row carries the 0.82 builder stamp (566.01 → 464.13)", rows[0].tierPrice === "464.13" && rows[0].priceSqft === "566.01", rows[0].tierPrice);
    ok("stocked rows key the ERP sku, special-order rows lead with the US sku", (function () {
      var so = rows.filter(function (r) { return r.sku === ""; });
      return rows[0].sku === "1504156" && so.every(function (r) { return /^wedi US/.test(r.brandColor); });
    })(), rows[0].sku);
    ok("payload strings only (qty/price)", rows.every(function (r) {
      return typeof r.qty === "string" && typeof r.priceSqft === "string" && typeof r.costSqft === "string" && r.qtyType === "count";
    }));
    var round = kitFor(rows[0].wedi.cfg.panKey, {
      walls: rows[0].wedi.cfg.walls, panelKey: rows[0].wedi.cfg.panelKey,
      curbKey: rows[0].wedi.cfg.curbKey, coverKey: rows[0].wedi.cfg.coverKey,
      sealantForm: rows[0].wedi.cfg.sealantForm, recess: rows[0].wedi.cfg.recess,
      addons: rows[0].wedi.cfg.addons,
    });
    ok("cfg round-trips: reconfigure rebuilds the same lines", JSON.stringify(round.lines.map(function (l) { return l.item.key + "×" + l.qty; })) ===
      JSON.stringify(kit.lines.map(function (l) { return l.item.key + "×" + l.qty; })));

    // --- search entry --------------------------------------------------------
    ok("queryHit 'wedi' / 'wed'", queryHit("wedi") && queryHit("wed"));
    ok("queryHit 'shower pan', 'niche', 'curbless'", queryHit("shower pan") && queryHit("niche") && queryHit("curbless"));
    ok("queryHit '36x60 pan' (weak word + size)", queryHit("36x60 pan"));
    ok("queryHit ignores unrelated trade text", !queryHit("porcelain 12x24") && !queryHit("schluter reducer") && !queryHit("grout"));
    ok("parseQuery 'wedi 36x60 curbless' → 36×60 curbless custom", (function () {
      var p = parseQuery("wedi 36x60 curbless");
      return p.w === 36 && p.d === 60 && p.curb === "curbless" && p.tab === "custom";
    })(), parseQuery("wedi 36x60 curbless"));
    ok("parseQuery reads feet: \"wedi 3'x5'\" → 36×60", (function () {
      var p = parseQuery("wedi 3'x5' pan");
      return p.w === 36 && p.d === 60;
    })(), parseQuery("wedi 3'x5' pan"));
    ok("parseQuery bare 3x5 reads as feet", parseQuery("wedi 3x5 shower").w === 36);
    ok("parseQuery 'linear' → linear drain", parseQuery("wedi linear 32x72").drain === "linear");
    ok("parseQuery 'wedi niche' → browse tab", parseQuery("wedi niche").tab === "browse");
    ok("parseQuery bare 'wedi' → kits tab", parseQuery("wedi").tab === "kits");
    ok("seedFromQuery gives a solver input", (function () {
      var s = seedFromQuery("wedi 48x66 curbed");
      return s.tab === "custom" && s.input.w === 48 && s.input.d === 66 && s.input.curb === "curbed";
    })());
    ok("querySummary reads as one line", /48×66/.test(querySummary(parseQuery("wedi 48x66 curbed"))), querySummary(parseQuery("wedi 48x66 curbed")));

    // --- group summary -------------------------------------------------------
    log("");
    log("catalog by group (entries / stocked / special-order only):");
    var groups = {};
    cat.forEach(function (e) {
      var g = groups[e.group] || (groups[e.group] = { n: 0, s: 0, subs: {} });
      g.n++; if (e.stock) g.s++;
      g.subs[e.sub || "—"] = (g.subs[e.sub || "—"] || 0) + 1;
    });
    Object.keys(groups).sort(function (a, b) { return groups[b].n - groups[a].n; }).forEach(function (k) {
      var g = groups[k];
      var subs = Object.keys(g.subs).map(function (s) { return s + " " + g.subs[s]; }).join(", ");
      log("  " + (k + "               ").slice(0, 12) + String(g.n + "    ").slice(0, 4) +
        " stock " + String(g.s + "   ").slice(0, 3) + " so " + String((g.n - g.s) + "   ").slice(0, 3) +
        " · " + (GROUP_LABEL[k] || k) + " [" + subs + "]");
    });
    var misc = cat.filter(function (e) { return e.group === "misc"; });
    log("");
    log(misc.length ? "misc rows (" + misc.length + "):" : "misc rows: none");
    misc.forEach(function (e) { log("  " + (e.stock ? "STOCK " : "so    ") + e.us + "  " + e.name); });

    log("");
    log(pass + " passed, " + fail + " failed");
    return fail;
  }

  // Node: pull the tables in ourselves, then run the self-test. Guarded so a
  // browser <script> never touches any of it.
  var argv = typeof process !== "undefined" && process.argv;
  if (argv && /proto-engine\.js$/.test(String(argv[1] || ""))) {
    var here = String(argv[1]).replace(/[\\/][^\\/]*$/, "");
    import("node:fs").then(function (m) {
      var fs = m.readFileSync ? m : m.default;
      var src = fs.readFileSync(here + "/proto-data.js", "utf8");
      var t = new Function(src + "\n;return { stock: WEDI_STOCK, so: WEDI_SO };")();
      globalThis.WEDI_STOCK = t.stock;
      globalThis.WEDI_SO = t.so;
      var failed = selfTest(function (s) { console.log(s); });
      process.exitCode = failed ? 1 : 0;
    });
  }
}());
