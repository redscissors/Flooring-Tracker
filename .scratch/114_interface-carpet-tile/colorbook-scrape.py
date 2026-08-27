# Step 2 of the color-book refresh: enumerate shop.interface.com's US carpet
# tile + LVT catalogs, match each price-list style to its product page, scrape
# every colorway swatch (name, color number, QuickShip badge), and rewrite
# src/interfacecolors.js wholesale.
#
#   node colorbook-styles.mjs <price-list.pdf> > styles.json
#   python3 colorbook-scrape.py styles.json ../../src/interfacecolors.js
#
# Needs network egress to shop.interface.com (the Claude environment's
# allowlist, or any machine that can reach it). The storefront is Salesforce
# Commerce Cloud: category grids page through Search-ShowAjax, and each product
# page's color swatches carry data-name / data-color-number / data-badges.
import concurrent.futures, datetime, html, json, os, re, ssl, sys, time, urllib.request

SHOP = "https://shop.interface.com"
GRID = SHOP + "/on/demandware.store/Sites-int-us-Site/en_US/Search-ShowAjax?cgid={cgid}&start={start}&sz=48"

ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt") \
    if os.path.exists(os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt") else ssl.create_default_context()
proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"https": proxy, "http": proxy} if proxy else {}),
    urllib.request.HTTPSHandler(context=ctx))
opener.addheaders = [("User-Agent", "Mozilla/5.0 (X11; Linux x86_64)")]

def get(url, tries=4):
    for attempt in range(tries):
        try:
            with opener.open(url, timeout=90) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            if attempt == tries - 1: raise
            time.sleep(2 * (attempt + 1))

def category_urls(cgid, path_re):
    urls, start = set(), 0
    while True:
        page = get(GRID.format(cgid=cgid, start=start))
        found = set(re.findall(path_re, page))
        if not found - urls: break
        urls |= found
        m = re.search(r"([0-9,]+) [Rr]esults", page)
        total = int(m.group(1).replace(",", "")) if m else 0
        start += 48
        if start >= total: break
    return sorted(urls)

# Slugging mirrors the storefront's own inconsistencies: "&" spells "and",
# an apostrophe is sometimes a hyphen (dot-o-mine) and sometimes nothing
# (natures-course), so both forms are tried.
def slug_variants(name):
    base = name.lower().replace("&", " and ")
    return [re.sub(r"[^a-z0-9]+", "-", base.replace("'", apo).replace("’", apo)).strip("-")
            for apo in ("-", "")]

# Sheet spelling -> shop slug, where the two genuinely differ.
ALIAS = {
    "iinterpret": "interpret",
    "thread-count-i": "thread-counts-i",
    "thread-count-ii": "thread-counts-ii",
    "touch-of-timber-emea": "touch-of-timber",
}

BTN = re.compile(r"<button\b((?:[^>])*?b-variation_swatch(?:[^>])*?)>", re.S)
def attr(a, n):
    m = re.search(n + r'="([^"]*)"', a)
    return m.group(1) if m else None

def colors_of(page):
    out, seen = [], set()
    for m in BTN.finditer(page):
        a = m.group(1)
        no, name = attr(a, "data-color-number"), attr(a, "data-name")
        # the widget's handlebars template renders as one {{colorNumber}} swatch
        if not no or not name or no in seen or "{{" in no or "{{" in name: continue
        seen.add(no)
        qs = False
        b = attr(a, "data-badges")
        if b:
            try: qs = any(x.get("badgeType") == "quickShip" for x in json.loads(html.unescape(b)))
            except Exception: pass
        out.append([no.strip(), name.strip()] + ([1] if qs else []))
    return out

def main(styles_file, out_file):
    styles = json.load(open(styles_file))
    carpet_urls = category_urls("carpet-tile", r'href="(/US/en-US/carpet-tile/[^"]+\.html)"')
    lvt_urls = category_urls("resilient-lvt", r'href="(/US/en-US/resilient/lvt/[^"]+\.html)"')
    by_slug = {}
    for u in carpet_urls + lvt_urls:
        m = re.search(r"/([^/]+)/([^/.]+)\.html$", u)
        by_slug[m.group(1)] = (u, m.group(2))

    jobs, unmatched, seen = [], [], set()
    for s in styles:
        if s["type"] == "carpet":
            base = re.sub(r"\s+(SP|50|M|P)$", "", s["sku"])
            variants = [ALIAS.get(v, v) for v in slug_variants(base)]
        else:
            t = s["thickness"].replace(" ", "").replace("mm", "")
            base = re.sub(r"\s*\d\.\d\s*mm$", "", s["sku"], flags=re.I)
            variants = [f"{v}-{t}-mm" for v in slug_variants(base)]
        hit = next(((by_slug[v], v) for v in variants if v in by_slug), None)
        if not hit:
            unmatched.append(s["sku"]); continue
        (url, pid), slug = hit
        if slug in seen: continue  # cross-format twins share one product page
        seen.add(slug)
        jobs.append({"key": base if s["type"] == "carpet" else s["sku"], "url": url, "pid": pid})

    print(f"{len(jobs)} styles to scrape; unmatched (import style-only): {unmatched}", file=sys.stderr)

    entries = {}
    def fetch(j):
        return j["key"], j["pid"], colors_of(get(SHOP + j["url"]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        for i, (key, pid, cols) in enumerate(ex.map(fetch, jobs)):
            if cols: entries[key] = (pid, cols)
            else: print(f"NO COLORS: {key}", file=sys.stderr)
            if (i + 1) % 25 == 0: print(f"{i+1}/{len(jobs)}", file=sys.stderr)

    today = datetime.date.today().isoformat()
    head = re.match(r"(?s)^(.*?)export const INTERFACE_COLORS_DATE", open(out_file).read())
    lines = []
    for k in sorted(entries):
        pid, cols = entries[k]
        cjs = ",".join("[" + json.dumps(c[0]) + "," + json.dumps(c[1]) + (",1" if len(c) > 2 else "") + "]" for c in cols)
        lines.append(f"  {json.dumps(k)}: {{ no: {json.dumps(pid)}, colors: [{cjs}] }},")
    with open(out_file, "w") as f:
        f.write(head.group(1))
        f.write(f'export const INTERFACE_COLORS_DATE = "{today}";\n\n')
        f.write("export const INTERFACE_COLORS = {\n" + "\n".join(lines) + "\n};\n")
    n = sum(len(c) for _, c in entries.values())
    print(f"wrote {out_file}: {len(entries)} styles, {n} colorways", file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
