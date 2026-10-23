#!/usr/bin/env python3
"""Coleta em massa de preços REGULARES antigos em arquivos da web (nada estimado, nada inventado).
Fontes: w = Wayback Machine (CDX matchType=domain, paginado)   c = Common Crawl (todas as coleções CC-MAIN, WARC por range)
        a = Arquivo.pt (CDX pywb)
Saída incremental (checkpoint): collector/hist/<fonte>_<rede>.jsonl  (1 linha por preço encontrado)
                                collector/hist/<fonte>_<rede>.done   (snapshots já processados)
O merge para site/data/chains/<rede>.json é feito por collector/merge_hist.py.
Regras: só preço regular -> ListPrice quando ListPrice > Price (promoção), "de" do HTML legado; JSON-LD sozinho é ignorado.
Uso: python collector/harvest.py <fonte> <rede> [rede...]   env BUDGET_MIN (tempo máx), WORKERS, DELAY"""
import sys, os, re, json, time, html, zlib, random, threading, collections
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor
import requests
sys.path.insert(0, os.path.dirname(__file__))
from chains import BY_ID
import store
UA = "Mozilla/5.0 (compatible; PrecosSupermercados/1.0; +https://github.com/Uncle-Sam3/Precos-Mercados)"
HIST = os.path.join(os.path.dirname(__file__), "hist"); os.makedirs(HIST, exist_ok=True)
T0 = time.time(); BUDGET = float(os.environ.get("BUDGET_MIN", "60")) * 60
def left(): return BUDGET - (time.time() - T0)
_tl = threading.local()
def sess():
    if not hasattr(_tl, "s"): _tl.s = requests.Session(); _tl.s.headers["User-Agent"] = UA
    return _tl.s
class Rate:
    def __init__(self, per_s): self.iv = 1.0 / per_s; self.t = 0; self.lk = threading.Lock(); self.pen = 0
    def wait(self):
        with self.lk:
            now = time.time(); t = max(now, self.t); self.t = t + self.iv + self.pen
        time.sleep(max(0, t - now))
RATE = {"w": Rate(float(os.environ.get("RPS_W", "1.5"))), "c": Rate(6), "a": Rate(3), "cdx": Rate(0.5)}
def get(url, kind, tries=6, timeout=90, **kw):
    for a in range(tries):
        if left() < 30: return None
        RATE[kind].wait()
        try:
            r = sess().get(url, timeout=timeout, **kw)
            if r.status_code in (200, 206): RATE[kind].pen = max(0, RATE[kind].pen - 0.05); return r
            if r.status_code in (429, 500, 502, 503, 504, 520, 522, 524):
                RATE[kind].pen = min(5, RATE[kind].pen + 0.5); time.sleep(min(120, 10 * 2 ** a) * random.uniform(.7, 1.3)); continue
            return None
        except requests.TooManyRedirects: return None
        except requests.RequestException as e:
            time.sleep(min(90, 5 * 2 ** a) * random.uniform(.7, 1.3))
    return None

# ---------- listagem ----------
INTEREST = re.compile(r"(/p/?$|/p\?|catalog_system/pub/products/search|intelligent-search|/api/catalog)", re.I)
STATIC = re.compile(r"\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|eot|pdf|xml|txt|mp4|map)(\?|$)", re.I)
def kind_of(u):
    if re.search(r"catalog_system|intelligent-search|/api/", u, re.I): return 0  # API JSON: muitos produtos
    if re.search(r"/p/?($|\?)", u): return 1                                     # página de produto
    return 2                                                                     # outras páginas HTML (prateleiras SSR)

def list_w(dom):
    base = {"url": dom, "matchType": "domain", "output": "json", "fl": "timestamp,original,mimetype",
            "filter": ["statuscode:200", "mimetype:(text/html|application/json|text/plain|application/javascript)"]}
    r = get("https://web.archive.org/cdx/search/cdx", "cdx", params={**base, "showNumPages": "true"}, timeout=180)
    try: n = int(r.text.strip()) if r is not None else 0
    except ValueError: n = 0
    print(f"  wayback {dom}: {n} páginas CDX", flush=True)
    for pg in range(n):
        if left() < BUDGET * 0.45: print("  (listagem interrompida por tempo)", flush=True); break
        r = get("https://web.archive.org/cdx/search/cdx", "cdx", params={**base, "page": str(pg)}, timeout=300)
        if r is None: continue
        try: rows = r.json()
        except Exception: continue
        for x in rows[1:]:
            if len(x) >= 2 and not STATIC.search(x[1]): yield dict(ts=x[0], url=x[1])
_CC = None
def list_c(dom):
    global _CC
    if _CC is None:
        r = get("https://index.commoncrawl.org/collinfo.json", "cdx", timeout=60)
        _CC = [c["cdx-api"] for c in (r.json() if r is not None else []) if re.search(r"CC-MAIN-20(1[6-9]|2[0-5])", c["id"])]
        print(f"  common crawl: {len(_CC)} coleções 2016-2025", flush=True)
    for api in _CC:
        if left() < BUDGET * 0.45: break
        base = {"url": f"*.{dom}", "output": "json", "filter": ["=status:200", "~mime:.*(html|json).*"]}
        r = get(api, "cdx", params={**base, "showNumPages": "true"}, timeout=180, tries=4)
        try: n = r.json()["pages"] if r is not None else 0
        except Exception: n = 0
        for pg in range(n):
            r = get(api, "cdx", params={**base, "page": str(pg)}, timeout=300, tries=4)
            if r is None: continue
            for l in r.text.splitlines():
                try: j = json.loads(l)
                except Exception: continue
                if STATIC.search(j["url"]): continue
                yield dict(ts=j["timestamp"], url=j["url"], f=j["filename"], o=int(j["offset"]), n=int(j["length"]))
def list_a(dom):
    for host in (dom, "www." + dom):
        r = get("https://arquivo.pt/wayback/cdx", "cdx", params={"url": f"{host}/*", "output": "json", "filter": "status:200", "limit": "1000000"}, timeout=300)
        if r is None: continue
        for l in r.text.splitlines():
            try: j = json.loads(l)
            except Exception: continue
            if STATIC.search(j["url"]) or not re.search(r"html|json", j.get("mime", "")): continue
            yield dict(ts=j["timestamp"], url=j["url"])
LIST = {"w": list_w, "c": list_c, "a": list_a}

def fetch(src, s):
    if src == "w":
        r = get(f"https://web.archive.org/web/{s['ts']}id_/{s['url']}", "w"); return r.text if r is not None else None
    if src == "a":
        r = get(f"https://arquivo.pt/wayback/{s['ts']}id_/{s['url']}", "a"); return r.text if r is not None else None
    r = get(f"https://data.commoncrawl.org/{s['f']}", "c", headers={"Range": f"bytes={s['o']}-{s['o']+s['n']-1}"})
    if r is None: return None
    try:
        raw = zlib.decompress(r.content, 16 + zlib.MAX_WBITS)
        parts = raw.split(b"\r\n\r\n", 2); return parts[2].decode("utf-8", "ignore") if len(parts) == 3 else None
    except Exception: return None

# ---------- extração (preço regular) ----------
def reg(price, lp):
    try: price = float(price or 0); lp = float(lp or 0)
    except (TypeError, ValueError): return None
    if price <= 0: return None
    v = lp if lp > price else price
    return round(v, 2) if 0.05 <= v <= 50000 else None
def num(s):
    s = str(s).replace("R$", "").replace("\xa0", "").strip()
    if "," in s: s = s.replace(".", "").replace(",", ".")
    try: return round(float(s), 2)
    except ValueError: return None
def from_vtex_products(arr):
    out = []
    for p in arr if isinstance(arr, list) else []:
        if not isinstance(p, dict): continue
        for it in (p.get("items") or [])[:1]:
            for se in (it.get("sellers") or [])[:1]:
                o = se.get("commertialOffer") or {}
                v = reg(o.get("Price"), o.get("ListPrice"))
                if v: out.append(dict(slug=(p.get("linkText") or "").lower() or None, pid=str(p.get("productId") or "") or None,
                                      ean=it.get("ean") or None, sku=str(it.get("itemId") or "") or None, n=p.get("productName"), p=v))
    return out
def from_state(s):
    out = []
    for k, o in s.items():
        if not (k.startswith("$Product:") and k.endswith("commertialOffer") and isinstance(o, dict)): continue
        v = reg(o.get("Price"), o.get("ListPrice"))
        if not v: continue
        pk = k[1:].split(".items.")[0]; ik = k[1:].split(".sellers.")[0]
        p = s.get(pk) or {}; it = s.get(ik) or {}
        if ".items.0." not in k: continue  # só o SKU principal
        out.append(dict(slug=(p.get("linkText") or "").lower() or None, pid=str(p.get("productId") or "") or None,
                        ean=it.get("ean") or None, sku=str(it.get("itemId") or "") or None, n=p.get("productName"), p=v))
    return out
def extract(t, url):
    t = t.lstrip("\ufeff")
    if t[:1] in "[{":
        try: j = json.loads(t)
        except Exception: j = None
        if isinstance(j, list): return from_vtex_products(j)
        if isinstance(j, dict):
            if isinstance(j.get("products"), list): return from_vtex_products(j["products"])
            if isinstance(j.get("data"), dict):
                ps = j["data"].get("productSearch") or j["data"].get("products") or {}
                ps = ps.get("products") if isinstance(ps, dict) else ps
                return from_vtex_products(ps or [])
        return []
    out = []
    m = re.search(r'data-varname="__STATE__"[^>]*>\s*<script>(.*?)</script>', t, re.S)
    if m:
        try: out = from_state(json.loads(m.group(1)))
        except Exception: out = []
        if out: return out
    # VTEX legado: página de produto com skuJson (centavos)
    m = re.search(r'var skuJson_0 = (\{.*?\});', t, re.S)
    if m:
        try:
            j = json.loads(m.group(1)); sk = [x for x in j.get("skus", []) if x.get("available")] or j.get("skus", [])
            if sk and sk[0].get("bestPrice"):
                v = reg(sk[0]["bestPrice"] / 100, (sk[0].get("listPrice") or 0) / 100)
                pid = str(j.get("productId") or "") or None
                ean = None; me = re.search(r'"productEans"\s*:\s*\["(\d+)"', t)
                if me: ean = me.group(1)
                if v: return [dict(slug=slug_of(url), pid=pid, ean=ean, sku=str(sk[0].get("sku") or "") or None, n=j.get("name"), p=v)]
        except Exception: pass
    # VTEX legado sem skuJson: skuBestPrice / skuListPrice
    m = re.search(r'class="skuBestPrice"[^>]*>\s*(R\$\s*[\d.,]+)', t)
    if m and kind_of(url) == 1:
        lp = re.search(r'class="skuListPrice"[^>]*>\s*(R\$\s*[\d.,]+)', t)
        v = reg(num(m.group(1)), num(lp.group(1)) if lp else 0)
        nm = re.search(r'<meta property="og:title" content="([^"]+)"', t)
        if v: return [dict(slug=slug_of(url), pid=None, ean=None, sku=None, n=html.unescape(nm.group(1)) if nm else None, p=v)]
    return []
def slug_of(url):
    parts = urlparse(url).path.rstrip("/").split("/")
    return unquote(parts[-2]).lower() if len(parts) >= 3 and parts[-1] == "p" else None

def plan(snaps, cur_slugs, done):
    """1 snapshot por URL por mês; prioridade API > produto do catálogo atual > outros produtos > outras páginas;
    dentro de cada grupo, intercala anos (mais antigos primeiro) para cobrir todos os anos mesmo com tempo limitado."""
    seen, groups = set(), collections.defaultdict(lambda: collections.defaultdict(list))
    for s in snaps:
        u = s["url"].split("#")[0]; k = kind_of(u)
        key = (re.sub(r"^https?://(www\d?\.)?", "", u).lower(), s["ts"][:6])
        if key in seen or f"{s['ts']}|{s['url']}" in done: continue
        seen.add(key)
        g = k if k != 1 else (1 if slug_of(u) in cur_slugs else 2)
        if k == 2: g = 3
        groups[g][s["ts"][:4]].append(s)
    byyear = collections.defaultdict(list)
    for g in groups:
        for y, v in groups[g].items():
            v = sorted(v, key=lambda x: x["ts"])
            if g == 3: v = v[:4000]
            byyear[y] += [(g, x["ts"], x) for x in v]
    for y in byyear: byyear[y].sort(key=lambda t: (t[0], t[1]))
    out, ys = [], sorted(byyear)
    while any(byyear[y] for y in ys):  # intercala anos (todos os anos avançam juntos)
        for y in ys:
            if byyear[y]: out.append(byyear[y].pop(0)[2])
    return out

def run(src, cid):
    c = BY_ID[cid]; d = store.load(cid)
    cur_slugs = {(v.get("s") or "").lower() for v in d["p"].values() if v.get("s")}
    outf, donef = os.path.join(HIST, f"{src}_{cid}.jsonl"), os.path.join(HIST, f"{src}_{cid}.done")
    done = set(open(donef).read().split("\n")) if os.path.exists(donef) else set()
    snaps = []
    for dom in c.get("wb", []):
        try:
            for s in LIST[src](dom): snaps.append(s)
        except Exception as e: print(f"[{cid}/{src}] erro listando {dom}: {e}", flush=True)
    by = collections.Counter((s["ts"][:4], kind_of(s["url"])) for s in snaps)
    print(f"[{cid}/{src}] {len(snaps)} capturas; por ano/tipo(0=api,1=prod,2=outras): {dict(sorted(by.items()))}", flush=True)
    todo = plan(snaps, cur_slugs, done)
    print(f"[{cid}/{src}] {len(todo)} a baixar (orçamento {left()/60:.0f} min)", flush=True)
    lk = threading.Lock(); st = collections.Counter()
    fo, fd = open(outf, "a"), open(donef, "a")
    def work(s):
        if left() < 60: return
        t = fetch(src, s)
        items = extract(t, s["url"]) if t else []
        date = f"{s['ts'][:4]}-{s['ts'][4:6]}-{s['ts'][6:8]}"
        rf = f"{s['ts']}/{s['url']}" + (f"|{s['f']}" if src == "c" else "")
        with lk:
            st["baixados"] += 1; st["com_preco"] += bool(items); st["precos"] += len(items)
            for it in items:
                it.update(d=date, src=src, ref=rf); fo.write(json.dumps(it, ensure_ascii=False) + "\n")
                st["ano_" + date[:4]] += 1
            if t is not None or left() > 60: fd.write(f"{s['ts']}|{s['url']}\n")
            if st["baixados"] % 200 == 0:
                fo.flush(); fd.flush(); print(f"[{cid}/{src}] {dict(st)}  restam {left()/60:.0f} min", flush=True)
    with ThreadPoolExecutor(int(os.environ.get("WORKERS", "3"))) as ex:
        list(ex.map(work, todo))
    fo.close(); fd.close()
    print(f"[{cid}/{src}] FIM {dict(st)}", flush=True)

if __name__ == "__main__":
    src = sys.argv[1]
    for cid in sys.argv[2:]: run(src, cid)
