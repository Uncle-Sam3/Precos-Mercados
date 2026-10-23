#!/usr/bin/env python3
"""Junta os preços encontrados por collector/harvest.py (collector/hist/*.jsonl) nos arquivos de cada rede.
Casamento com o catálogo atual: EAN -> slug -> productId (com nome parecido). Sem casamento: produto antigo próprio
("h:<id>"), marcado arch=1 (vendido no passado). Guarda só mudanças de preço (mantendo ao menos 1 registro por ano)."""
import sys, os, re, json, glob, collections
sys.path.insert(0, os.path.dirname(__file__))
import store
from util import norm
HIST = os.path.join(os.path.dirname(__file__), "hist")
def toks(s): return {w for w in re.findall(r"[a-z]{4,}", norm(s or ""))}
def compact(h):
    out = []
    for e in sorted(h, key=lambda x: (x[0], x[2] != "v")):
        if out and e[2] != "v" and out[-1][1] == e[1] and out[-1][0][:4] == e[0][:4]: continue  # mesmo preço, mesmo ano
        if out and out[-1][0] == e[0] and out[-1][2] == e[2]: continue
        out.append(e)
    return out
def merge(cid, files):
    d = store.load(cid); P = d["p"]
    by_ean, by_slug, by_ns = {}, {}, {}
    for k, v in P.items():
        if v.get("e"): by_ean.setdefault(str(v["e"]), k)
        if v.get("s"): by_slug.setdefault(v["s"].lower(), k); by_ns.setdefault(re.sub(r"[^a-z0-9]", "", v["s"].lower()), k)
    st = collections.Counter(); before = sum(len(v.get("h", [])) for v in P.values())
    for f in files:
        for line in open(f, encoding="utf-8"):
            try: it = json.loads(line)
            except Exception: continue
            if not (it.get("p") and it.get("d")): continue
            k = None
            if it.get("ean") and str(it["ean"]) in by_ean: k = by_ean[str(it["ean"])]; st["ean"] += 1
            elif it.get("slug") and it["slug"] in by_slug: k = by_slug[it["slug"]]; st["slug"] += 1
            elif it.get("slug") and re.sub(r"[^a-z0-9]", "", it["slug"]) in by_ns: k = by_ns[re.sub(r"[^a-z0-9]", "", it["slug"])]; st["slug~"] += 1
            elif it.get("pid") and it["pid"] in P and (not it.get("n") or toks(it["n"]) & toks(P[it["pid"]].get("n"))): k = it["pid"]; st["pid"] += 1
            else:
                k = "h:" + (it.get("ean") or it.get("pid") or it.get("slug") or norm(it.get("n") or ""))[:80]
                if k not in P:
                    P[k] = {"n": it.get("n") or it.get("slug"), "s": it.get("slug"), "e": it.get("ean"), "h": [], "arch": 1}
                    if it.get("ean"): by_ean[str(it["ean"])] = k
                    if it.get("slug"): by_slug[it["slug"]] = k
                st["novo_antigo"] += 1
            P[k].setdefault("h", []).append([it["d"], it["p"], it["src"], it["ref"]])
    for v in P.values():
        if v.get("h"): v["h"] = compact(v["h"])
    store.save(cid, d)
    after = sum(len(v.get("h", [])) for v in P.values())
    pre = [v for v in P.values() if any(e[0] < "2026" for e in v.get("h", []))]
    yrs = sorted({e[0][:4] for v in pre for e in v["h"] if e[0] < "2026"})
    print(f"{cid}: +{after-before} entradas; casamento {dict(st)}; produtos com preço < 2026: {len(pre)} ({yrs[0] if yrs else '-'}–{yrs[-1] if yrs else '-'})", flush=True)
if __name__ == "__main__":
    src_dir = sys.argv[1] if len(sys.argv) > 1 else HIST
    groups = collections.defaultdict(list)
    for f in glob.glob(os.path.join(src_dir, "**", "*.jsonl"), recursive=True):
        cid = os.path.basename(f)[:-6].split("_", 1)[1]; groups[cid].append(f)
    for cid, fs in sorted(groups.items()): merge(cid, fs)
