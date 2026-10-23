#!/usr/bin/env python3
"""Importa preços REGULARES antigos de arquivos da web (nada estimado):
  w = Wayback Machine (web.archive.org)        a = Arquivo.pt (pywb CDX)
  c = Common Crawl (índice CDX + WARC por range)  t = archive.today (timemap por URL; captcha limita uso em massa)
Para cada rede, lista snapshots de páginas de produto VTEX (/<slug>/p) e respostas arquivadas da API
catalog_system, baixa o conteúdo bruto, extrai nome + preço REGULAR (ListPrice/"de" quando há promoção; nunca o
preço promocional) e grava no histórico com a data do snapshot e a referência para abrir o arquivo.
Uso: python collector/archives.py [--fontes w,a,c] [rede ...]   env MAX_FETCH (por rede e fonte), ARCH_DELAY"""
import sys, os, re, json, time, html, gzip, zlib, requests
from urllib.parse import urlparse, unquote, quote
from chains import CHAINS, BY_ID
import store
UA = "PrecosSupermercados/1.0 (github.com/jcbolsaseuniformes-dev/precos-supermercados)"
DELAY = float(os.environ.get("ARCH_DELAY", "1.2"))
MAX_FETCH = int(os.environ.get("MAX_FETCH", "400"))
CC_COLLS = int(os.environ.get("CC_COLLS", "12"))  # quantas coleções Common Crawl consultar (mais recentes)
STATE = os.path.join(os.path.dirname(__file__), "state"); os.makedirs(STATE, exist_ok=True)
S = requests.Session(); S.headers["User-Agent"] = UA
PROD_RE = re.compile(r"/p/?(\?.*)?$")

def get(url, tries=4, **kw):
    for a in range(tries):
        time.sleep(DELAY)
        try:
            r = S.get(url, timeout=kw.pop("timeout", 120), **kw)
            if r.status_code in (200, 206): return r
            if r.status_code in (429, 502, 503, 504): time.sleep(15 * (a + 1)); continue
            return None
        except requests.TooManyRedirects:
            return None
        except requests.RequestException as e:
            print("   rede:", type(e).__name__, url[:80], flush=True); time.sleep(8 * (a + 1))
    return None

# ---------- listagem de snapshots ----------
def list_wayback(host):
    out, resume = [], None
    while True:
        q = {"url": f"{host}/*", "output": "json", "fl": "timestamp,original", "filter": ["statuscode:200"], "collapse": "digest", "limit": "20000", "showResumeKey": "true"}
        if resume: q["resumeKey"] = resume
        r = get("https://web.archive.org/cdx/search/cdx", params=q, timeout=300)
        if r is None: break
        rows = r.json() if r.text.strip() else []
        if not rows: break
        rows = rows[1:]; resume = None
        if len(rows) >= 2 and rows[-2] == []: resume = rows[-1][0]; rows = rows[:-2]
        out += [dict(ts=x[0], url=x[1]) for x in rows if len(x) == 2]
        if not resume: break
    return out
def list_arquivo(host):
    r = get("https://arquivo.pt/wayback/cdx", params={"url": f"{host}/*", "output": "json", "filter": "status:200", "limit": "200000"}, timeout=300)
    if r is None: return []
    out = []
    for l in r.text.splitlines():
        try: j = json.loads(l); out.append(dict(ts=j["timestamp"], url=j["url"]))
        except Exception: pass
    return out
_CC = None
def list_cc(host):
    global _CC
    if _CC is None:
        r = get("https://index.commoncrawl.org/collinfo.json", timeout=60)
        _CC = [c["cdx-api"] for c in (r.json() if r else [])][:CC_COLLS]
    out = []
    for api in _CC:
        r = get(api, params={"url": f"{host}/*", "output": "json", "filter": ["=status:200", "~url:.*(/p|catalog_system.*)$"]}, timeout=300, tries=2)
        if r is None: continue
        for l in r.text.splitlines():
            try: j = json.loads(l); out.append(dict(ts=j["timestamp"], url=j["url"], f=j["filename"], o=int(j["offset"]), n=int(j["length"])))
            except Exception: pass
    return out
LISTERS = {"w": list_wayback, "a": list_arquivo, "c": list_cc}

# ---------- download do conteúdo bruto ----------
def fetch(src, s):
    if src == "w": r = get(f"https://web.archive.org/web/{s['ts']}id_/{s['url']}")
    elif src == "a": r = get(f"https://arquivo.pt/wayback/{s['ts']}id_/{s['url']}")
    elif src == "c":
        r = get(f"https://data.commoncrawl.org/{s['f']}", headers={"Range": f"bytes={s['o']}-{s['o']+s['n']-1}"})
        if r is None: return None
        try:
            raw = zlib.decompress(r.content, 16 + zlib.MAX_WBITS)
            body = raw.split(b"\r\n\r\n", 2)[2]
            return body.decode("utf-8", "ignore")
        except Exception: return None
    else: return None
    return r.text if r is not None else None
def ref(src, s):
    if src == "c": return f"{s['ts']}/{s['url']}|{s['f']}"
    return f"{s['ts']}/{s['url']}"

# ---------- extração do preço REGULAR ----------
def num(s):
    s = str(s).strip().replace("R$", "").replace("\xa0", "").strip()
    if "," in s: s = s.replace(".", "").replace(",", ".")
    try: return round(float(s), 2)
    except ValueError: return None
def parse_page(t):
    """(nome, preço regular) ou (nome, None) se não der para garantir que é preço regular."""
    name = None
    m = re.search(r'"productName"\s*:\s*"([^"]+)"', t) or re.search(r'<meta property="og:title" content="([^"]+)"', t)
    if m: name = html.unescape(m.group(1))
    # 1) VTEX IO: commertialOffer com Price e ListPrice
    m = re.search(r'"commertialOffer"\s*:\s*\{[^{}]*?"Price"\s*:\s*([\d.]+)\s*,\s*"ListPrice"\s*:\s*([\d.]+)', t) or \
        re.search(r'commertialOffer"\s*:\s*\{[^}]*?\}\s*\}?,\s*"\$Product[^"]*commertialOffer"\s*:\s*\{[^{}]*?"Price"\s*:\s*([\d.]+)\s*,\s*"ListPrice"\s*:\s*([\d.]+)', t) or \
        re.search(r'"Price"\s*:\s*([\d.]+)\s*,\s*"ListPrice"\s*:\s*([\d.]+)', t)
    if m:
        p, lp = float(m.group(1)), float(m.group(2))
        reg = lp if lp > p else p
        return name, (round(reg, 2) if p > 0 else None)
    # 2) VTEX legado: skuJson (centavos); listPrice = preço "de"
    m = re.search(r'var skuJson_0 = (\{.*?\});', t, re.S)
    if m:
        try:
            j = json.loads(m.group(1)); name = name or j.get("name")
            sk = [x for x in j.get("skus", []) if x.get("available")] or j.get("skus", [])
            if sk and sk[0].get("bestPrice"):
                bp, lp = sk[0]["bestPrice"], sk[0].get("listPrice") or 0
                return name, round(max(bp, lp) / 100, 2)
        except Exception: pass
    # 3) HTML legado com "de/por"
    m = re.search(r'class="skuBestPrice"[^>]*>\s*(R\$\s*[\d.,]+)', t)
    if m:
        lp = re.search(r'class="skuListPrice"[^>]*>\s*(R\$\s*[\d.,]+)', t)
        v = num(lp.group(1)) if lp else num(m.group(1))
        return name, v
    # 4) só JSON-LD (sem informação de preço "de"): não dá para saber se é promoção -> ignora
    return name, None

def slug_of(url):
    parts = urlparse(url).path.rstrip("/").split("/")
    return unquote(parts[-2]).lower() if len(parts) >= 3 and parts[-1] == "p" else None

def run(cid, fontes):
    c = BY_ID[cid]; d = store.load(cid); P = d["p"]
    by_slug = {(v.get("s") or "").lower(): k for k, v in P.items() if v.get("s")}
    stats = {}
    for src in fontes:
        donef = os.path.join(STATE, f"arch_{src}_{cid}.txt")
        done = set(open(donef).read().split("\n")) if os.path.exists(donef) else set()
        snaps = []
        for dom in c.get("wb", []):
            for host in (dom, "www." + dom):
                try: rows = LISTERS[src](host)
                except Exception as e: print(f"[{cid}/{src}] erro listando {host}: {e}", flush=True); rows = []
                rows = [r for r in rows if PROD_RE.search(urlparse(r["url"]).path + ("?" + urlparse(r["url"]).query if urlparse(r["url"]).query else "")) or "catalog_system/pub/products/search" in r["url"]]
                print(f"[{cid}/{src}] {host}: {len(rows)} snapshots de produto/API", flush=True)
                snaps += rows
        seen, todo = set(), []
        for s in sorted(snaps, key=lambda x: x["ts"]):  # mais antigos primeiro; 1 por produto por mês
            key = (slug_of(s["url"]) or s["url"], s["ts"][:6])
            if key in seen or f"{s['ts']}|{s['url']}" in done: continue
            seen.add(key); todo.append(s)
        print(f"[{cid}/{src}] {len(todo)} novos (limite {MAX_FETCH})", flush=True)
        added = fetched = skipped = 0
        with open(donef, "a") as df:
            for s in todo[:MAX_FETCH]:
                t = fetch(src, s); fetched += 1
                df.write(f"{s['ts']}|{s['url']}\n"); df.flush()
                if not t: continue
                date = f"{s['ts'][:4]}-{s['ts'][4:6]}-{s['ts'][6:8]}"
                items = []
                if "catalog_system" in s["url"]:
                    try:
                        for p in json.loads(t):
                            o = p["items"][0]["sellers"][0]["commertialOffer"]; pr, lp = o.get("Price") or 0, o.get("ListPrice") or 0
                            if pr: items.append(((p.get("linkText") or "").lower(), str(p["productId"]), p.get("productName"), round(max(pr, lp), 2)))
                    except Exception: pass
                else:
                    name, price = parse_page(t)
                    if price and 0.05 <= price <= 50000: items.append((slug_of(s["url"]), None, name, price))
                    else: skipped += 1
                for slug, pid, name, price in items:
                    k = by_slug.get(slug) if slug else None
                    if k is None and pid and pid in P: k = pid
                    if k is None:
                        k = f"{src}:{slug or pid}"
                        if k not in P: P[k] = {"n": name or slug, "s": slug, "h": [], "arch": 1}
                        if slug: by_slug[slug] = k
                    h = P[k].setdefault("h", [])
                    if not any(e[0] == date and e[2] == src for e in h):
                        h.append([date, price, src, ref(src, s)]); added += 1
                if fetched % 50 == 0:
                    print(f"[{cid}/{src}] {fetched} baixados, {added} preços", flush=True); store.save(cid, d)
        store.save(cid, d)
        stats[src] = (fetched, added, skipped)
        print(f"[{cid}/{src}] FIM: {fetched} snapshots, {added} preços regulares, {skipped} sem preço regular confiável", flush=True)
    return stats

if __name__ == "__main__":
    args = sys.argv[1:]; fontes = ["a", "w", "c"]
    if args and args[0] == "--fontes": fontes = args[1].split(","); args = args[2:]
    for cid in (args or [c["id"] for c in CHAINS]): run(cid, fontes)
