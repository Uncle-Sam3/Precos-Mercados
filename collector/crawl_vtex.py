#!/usr/bin/env python3
"""Baixa o catálogo completo de redes VTEX (API pública catalog_system) e grava o preço do dia.
Uso: python collector/crawl_vtex.py [rede ...]   (sem argumentos = todas)
Educado: 1 requisição por vez por rede, pausa entre requisições, User-Agent identificado."""
import sys, time, json, re, datetime, threading, requests
from concurrent.futures import ThreadPoolExecutor
from chains import CHAINS, BY_ID
import store

UA = "Mozilla/5.0 (compatible; PrecosSupermercados/1.0; +https://github.com/jcbolsaseuniformes-dev/precos-supermercados)"
DELAY = float(__import__("os").environ.get("CRAWL_DELAY", "0.5"))
PAGE = 50
MAXFROM = 2500  # limite da API VTEX
TODAY = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date().isoformat()

class Crawler:
    def __init__(self, c):
        self.c = c; self.s = requests.Session(); self.s.headers["User-Agent"] = UA
        self.found = {}; self.req = 0
    def get(self, path, params=None):
        for attempt in range(5):
            time.sleep(DELAY); self.req += 1
            try:
                r = self.s.get(self.c["base"] + path, params=params, timeout=40)
                if r.status_code in (200, 206): return r
                if r.status_code in (429, 500, 502, 503, 504):
                    print(f"[{self.c['id']}] HTTP {r.status_code}, aguardando", flush=True); time.sleep(5 * (attempt + 1)); continue
                return r
            except requests.RequestException as e:
                print(f"[{self.c['id']}] erro rede {type(e).__name__}", flush=True); time.sleep(5 * (attempt + 1))
        return None
    def total(self, fq):
        r = self.get("/api/catalog_system/pub/products/search", [("fq", f) for f in fq] + [("_from", 0), ("_to", 0)])
        if r is None: return 0, []
        m = re.search(r"/(\d+)", r.headers.get("resources", ""))
        try: data = r.json()
        except Exception: data = []
        return (int(m.group(1)) if m else len(data)), data
    def page_all(self, fq, n):
        for start in range(0, min(n, MAXFROM), PAGE):
            r = self.get("/api/catalog_system/pub/products/search", [("fq", f) for f in fq] + [("_from", start), ("_to", min(start + PAGE, MAXFROM) - 1)])
            if r is None: continue
            try: data = r.json()
            except Exception: continue
            if not data: break
            for p in data: self.add(p)
    def add(self, p):
        try:
            it = p["items"][0]
            offers = [s["commertialOffer"] for s in it.get("sellers", [])]
            avail = [o for o in offers if o.get("Price") and o.get("AvailableQuantity", 0) > 0]
            o = (avail or offers or [{}])[0]
            # preço REGULAR: se há promoção ativa (ListPrice > Price), guarda o preço "de" (ListPrice); nunca o promocional
            price = max(o.get("Price") or 0, o.get("ListPrice") or 0) if (o.get("Price") or 0) > 0 else 0
            self.found[str(p["productId"])] = dict(
                n=p.get("productName"), b=p.get("brand"), e=it.get("ean") or None, s=p.get("linkText"),
                i=(it.get("images") or [{}])[0].get("imageUrl", "").split("?")[0] or None,
                c=(p.get("categories") or [""])[0].strip("/").split("/")[-1] or None,
                price=round(float(price), 2), ok=bool(avail))
        except Exception as e:
            pass
    def crawl_fq(self, fq, children, depth=0):
        n, _ = self.total(fq)
        if n == 0: return
        if n <= MAXFROM:
            self.page_all(fq, n); return
        if children:
            for ch in children:
                self.crawl_fq([f"C:{ch['_path']}"], ch.get("children", []), depth + 1)
            return
        self.price_split(fq, 0, 5000, n)
    def price_split(self, fq, lo, hi, n=None):
        if n is None: n, _ = self.total(fq + [f"P:[{lo} TO {hi}]"])
        if n == 0: return
        if n <= MAXFROM or hi - lo < 0.02:
            self.page_all(fq + [f"P:[{lo} TO {hi}]"], n); return
        mid = round((lo + hi) / 2, 2)
        self.price_split(fq, lo, mid); self.price_split(fq, round(mid + 0.01, 2), hi)
    def run(self):
        r = self.get("/api/catalog_system/pub/category/tree/5")
        tree = r.json() if r is not None and r.status_code == 200 else []
        def mark(nodes, prefix):
            for nd in nodes:
                nd["_path"] = f"{prefix}{nd['id']}/"; mark(nd.get("children", []), nd["_path"])
        mark(tree, "/")
        known_n, _ = self.total([])
        for top in tree:
            before = len(self.found)
            self.crawl_fq([f"C:{top['_path']}"], top.get("children", []))
            print(f"[{self.c['id']}] {top['name']}: +{len(self.found)-before} (total {len(self.found)}, req {self.req})", flush=True)
        return known_n

def crawl(cid):
    c = BY_ID[cid]; cr = Crawler(c); t0 = time.time()
    try: total = cr.run()
    except Exception as e:
        print(f"[{cid}] ERRO {e}", flush=True); total = 0
    if not cr.found:
        print(f"[{cid}] nada coletado", flush=True); return cid, 0, total
    d = store.load(cid)
    for pid, f in cr.found.items():
        pr = d["p"].setdefault(pid, {})
        for k in ("n", "b", "e", "s", "i", "c"): pr[k] = f[k]
        if f["price"] > 0: store.add_live(pr, TODAY, f["price"])
        pr["ok"] = f["ok"]; pr.pop("x", None); pr.pop("ls", None)
    # produtos que não apareceram nesta coleta completa: marca data de saída (só se a coleta cobriu >= 90% do catálogo)
    if total and len(cr.found) >= 0.9 * total:
        for pid, pr in d["p"].items():
            if pid not in cr.found and not pr.get("arch") and "x" not in pr: pr["x"] = TODAY
    d["updated"] = TODAY; d["name"] = c["name"]; d["site"] = c["base"].replace("/io", "")
    d["api_total"] = total
    store.save(cid, d)
    print(f"[{cid}] FIM {len(cr.found)} produtos (API diz {total}) em {time.time()-t0:.0f}s, {cr.req} req", flush=True)
    return cid, len(cr.found), total

if __name__ == "__main__":
    ids = sys.argv[1:] or [c["id"] for c in CHAINS]
    with ThreadPoolExecutor(max_workers=int(__import__("os").environ.get("PAR", "6"))) as ex:
        for cid, n, t in ex.map(crawl, ids): pass
