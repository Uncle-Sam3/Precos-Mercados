"""Formato compacto por rede: site/data/chains/<id>.json
{ "chain": id, "updated": "YYYY-MM-DD",
  "p": { "<productId>": {"n": nome, "b": marca, "e": ean, "s": slug, "i": imagem, "c": categoria,
                          "h": [[data, preco, fonte, ref], ...],   # só mudanças de preço (fonte v=site ao vivo, w=Wayback)
                          "x": data em que sumiu do site (ausente = ainda à venda na última coleta) } } }
"""
import json, os, gzip
ROOT = os.path.join(os.path.dirname(__file__), "..", "site", "data")
def path(cid): return os.path.join(ROOT, "chains", f"{cid}.json")
def load(cid):
    p = path(cid)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f: return json.load(f)
    return {"chain": cid, "updated": None, "p": {}}
def save(cid, d):
    p = path(cid); tmp = p + ".tmp"
    # ordena histórico por data e remove duplicados exatos
    for pr in d["p"].values():
        seen=set(); h=[]
        for e in sorted(pr.get("h", []), key=lambda x: (x[0], x[2])):
            k=(e[0], e[2], e[1])
            if k in seen: continue
            seen.add(k); h.append(e)
        pr["h"]=h
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, p)
def add_live(pr, date, price):
    """Acrescenta preço ao vivo só se mudou desde o último preço ao vivo."""
    live = [e for e in pr.setdefault("h", []) if e[2] == "v"]
    if not live or live[-1][1] != price:
        if live and live[-1][0] == date: live[-1][1] = price
        else: pr["h"].append([date, price, "v", None])
