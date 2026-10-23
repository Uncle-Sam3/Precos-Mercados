#!/usr/bin/env python3
"""Gera site/data/chains.json (resumo por rede) a partir dos arquivos de catálogo.
has_old = existe algum preço guardado com data anterior ao ano corrente (dado real do arquivo)."""
import json, os, glob, datetime
from chains import CHAINS
import store
YEAR = str(datetime.date.today().year)
# Regra da cor do ícone (histórico de anos anteriores):
#   "full"    (azul)     -> >= FULL_MIN_SHARE dos produtos atuais têm algum preço de ano anterior E o histórico cobre >= FULL_MIN_YEARS anos anteriores distintos
#   "partial" (amarelo)  -> existe algum preço de ano anterior, mas abaixo disso
#   "none"    (vermelho) -> nenhum preço de ano anterior
FULL_MIN_SHARE = 0.50
FULL_MIN_YEARS = 2
out = []
for c in CHAINS:
    p = store.path(c["id"])
    if not os.path.exists(p):
        out.append(dict(id=c["id"], name=c["name"], site=c["base"].replace("/io", ""), n=0, status="sem dados")); continue
    d = store.load(c["id"])
    dates = [e[0] for pr in d["p"].values() for e in pr.get("h", [])]
    wb = [e[0] for pr in d["p"].values() for e in pr.get("h", []) if e[2] != "v"]  # registros de arquivos da web (w/a/c/t)
    by_src = {}
    for pr in d["p"].values():
        for e in pr.get("h", []): by_src[e[2]] = by_src.get(e[2], 0) + 1
    cur = [pr for pr in d["p"].values() if not pr.get("arch") and "x" not in pr]
    old_years = {e[0][:4] for pr in d["p"].values() for e in pr.get("h", []) if e[0][:4] < YEAR}
    share = (sum(1 for pr in cur if any(e[0][:4] < YEAR for e in pr.get("h", []))) / len(cur)) if cur else 0
    level = "full" if share >= FULL_MIN_SHARE and len(old_years) >= FULL_MIN_YEARS else ("partial" if old_years else "none")
    out.append(dict(id=c["id"], name=c["name"], site=c["base"].replace("/io", ""), updated=d.get("updated"),
        hist_level=level, old_share=round(share, 4), old_years=sorted(old_years),
        n=sum(1 for pr in d["p"].values() if not pr.get("arch")), n_arch=sum(1 for pr in d["p"].values() if pr.get("arch")),
        oldest=min(dates) if dates else None, n_prices=len(dates), n_archive=len(wb), oldest_archive=min(wb) if wb else None, by_source=by_src,
        has_old=bool(dates) and min(dates) < YEAR, size=os.path.getsize(p), status="ok"))
with open(os.path.join(store.ROOT, "chains.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
for o in out: print(o["id"], o.get("n"), o.get("oldest"), o.get("hist_level"), o.get("n_archive"), o.get("by_source"))
