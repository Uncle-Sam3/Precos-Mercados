#!/usr/bin/env python3
"""Localiza as lojas de cada rede no OpenStreetMap (Overpass API) e grava site/data/stores.json.
Só usa coordenadas reais do OSM; filtra por nome/marca e pelos estados onde a rede atua."""
import json, re, os, sys, time, requests
from geo import nearest
from chains import CHAINS
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data", "stores.json")
ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
UA = "PrecosSupermercados/1.0 (github.com/jcbolsaseuniformes-dev/precos-supermercados)"
# nomes p/ consulta (regex OSM, case-insensitive)
Q = "Zaffari|Bourbon|Muffato|Max Atacadista|Bistek|Giassi|Zona Sul|Prezunic|Oba|Covabra|Savegnago|Mambo|Super ?Nosso|Pague Menos|Mercantil|Atacad|Bretas"
query = f"""[out:json][timeout:600];
area["ISO3166-1"="BR"][admin_level=2]->.br;
(nwr(area.br)["shop"~"supermarket|wholesale|greengrocer|convenience|department_store"]["name"~"{Q}",i];
 nwr(area.br)["shop"~"supermarket|wholesale|greengrocer"]["brand"~"{Q}",i];);
out center tags;"""
def uf_of(t):
    for k in ("addr:state", "is_in:state_code", "addr:province"):
        v = t.get(k)
        if v and len(v.strip()) == 2: return v.strip().upper()
    return None
# caixas aproximadas por UF (lat_min, lat_max, lon_min, lon_max) só para o filtro de região
BOX = {"RS":(-33.8,-27.0,-57.7,-49.6),"SC":(-29.4,-25.9,-53.9,-48.3),"PR":(-26.8,-22.5,-54.7,-48.0),"SP":(-25.4,-19.7,-53.2,-44.1),
"RJ":(-23.4,-20.7,-44.9,-40.9),"MG":(-22.95,-14.2,-51.1,-39.8),"DF":(-16.06,-15.5,-48.3,-47.3),"GO":(-19.5,-12.3,-53.3,-45.9),
"BA":(-18.4,-8.5,-46.7,-37.3),"SE":(-11.6,-9.5,-38.3,-36.4),"PE":(-9.5,-7.3,-41.4,-34.8),"AL":(-10.5,-8.8,-38.3,-35.1)}
def in_ufs(lat, lon, ufs, uf):
    if ufs is None: return True
    if uf: return uf in ufs
    return any(BOX[u][0] <= lat <= BOX[u][1] and BOX[u][2] <= lon <= BOX[u][3] for u in ufs if u in BOX)
def bbox(ufs):
    if not ufs: return (-34.0, -74.1, 5.4, -34.7)
    b = [BOX[u] for u in ufs if u in BOX]
    return (min(x[0] for x in b), min(x[2] for x in b), max(x[1] for x in b), max(x[3] for x in b))
def overpass(q):
    for ep in ENDPOINTS:
        for a in range(2):
            try:
                r = requests.post(ep, data={"data": q}, headers={"User-Agent": UA}, timeout=400)
                if r.ok: return r.json()["elements"]
                print("  ", ep, r.status_code, flush=True); time.sleep(20)
            except Exception as e: print("  ", ep, type(e).__name__, flush=True); time.sleep(10)
    return None
TILES_BR = [(-34.0, -58.0, -24.0, -47.0), (-24.0, -54.0, -19.0, -39.0), (-19.0, -54.0, -12.0, -37.0), (-12.0, -50.0, -1.0, -34.7),
            (-12.0, -74.1, 5.4, -50.0), (-24.0, -62.0, -12.0, -54.0), (-1.0, -50.0, 5.4, -34.7)]
def main():
    only = sys.argv[1:]
    els = []
    for c in CHAINS:
        if only and c["id"] not in only: continue
        tiles = [bbox(c["ufs"])] if c["ufs"] else TILES_BR
        for (s_, w, n, e) in tiles:
          if True:
            rx = c["osm"].replace("\\", "\\\\").replace('"', '')
            q = f"""[out:json][timeout:300];
(nwr["shop"~"supermarket|wholesale|greengrocer|convenience|department_store"]["name"~"{rx}",i]({s_},{w},{n},{e});
 nwr["shop"~"supermarket|wholesale|greengrocer"]["brand"~"{rx}",i]({s_},{w},{n},{e}););
out center tags;"""
            got = overpass(q)
            print(c["id"], "OSM:", None if got is None else len(got), flush=True)
            if got: els += got
            time.sleep(3)
    data = {"elements": els}
    stores, seen = [], set()
    for el in data["elements"]:
        t = el.get("tags", {}); name = t.get("name", ""); brand = t.get("brand", "")
        lat = el.get("lat") or el.get("center", {}).get("lat"); lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None: continue
        city, uf = nearest(lat, lon)  # UF/município pelo IBGE (mais confiável que a tag)
        for c in CHAINS:
            if re.search(c["osm"], name, re.I) or (brand and re.search(c["osm"], brand, re.I)):
                if c["id"] == "paguemenos" and t.get("shop") not in ("supermarket", "wholesale"): continue
                if not in_ufs(lat, lon, c["ufs"], uf): continue
                key = f"{el['type']}/{el['id']}"
                if key in seen: continue
                seen.add(key)
                addr = " ".join(x for x in [t.get("addr:street"), t.get("addr:housenumber")] if x)
                stores.append(dict(c=c["id"], n=name or brand, a=addr or None, ci=t.get("addr:city") or city, uf=uf,
                                   lat=round(lat, 6), lon=round(lon, 6), osm=key))
                break
    if only and os.path.exists(OUT):
        old = [x for x in json.load(open(OUT, encoding="utf-8")) if x["c"] not in only]
        stores = old + stores
    stores.sort(key=lambda s: (s["c"], s["n"]))
    with open(OUT, "w", encoding="utf-8") as f: json.dump(stores, f, ensure_ascii=False, separators=(",", ":"))
    from collections import Counter
    print(len(stores), Counter(s["c"] for s in stores))
main()
