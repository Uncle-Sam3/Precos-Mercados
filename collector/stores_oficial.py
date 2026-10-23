#!/usr/bin/env python3
"""Lojas a partir do SITE OFICIAL de cada rede (fonte primária) + validação geográfica de todas as lojas.
1) VTEX pickup-points (/api/checkout/pub/pickup-points?geoCoordinates=lon;lat): endereço oficial + coordenadas da loja,
   consultado numa grade sobre os estados onde a rede atua.
2) Valida cada ponto: em terra (malha IBGE de alta resolução) e dentro do município do endereço (polígono IBGE).
   Se falhar, geocodifica o endereço oficial no Nominatim (1 req/s) e revalida. Se ainda falhar: loja OCULTA (não vai pro mar).
3) Lojas do OpenStreetMap ficam só como reserva: mantidas se não houver loja oficial a < 500 m e se passarem na validação.
Saída: site/data/stores.json (+ collector/ref/lojas_relatorio.json com o que foi corrigido/oculto).
Requer: shapely; collector/ref/geojs-100-mun.json (malha municipal IBGE, github.com/tbrugz/geodata-br)."""
import json, os, re, sys, time, math, unicodedata, requests
from shapely.geometry import shape, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely.prepared import prep
sys.path.insert(0, os.path.dirname(__file__))
from chains import CHAINS
ROOT = os.path.join(os.path.dirname(__file__), "..")
REF = os.path.join(os.path.dirname(__file__), "ref")
UA = {"User-Agent": "Mozilla/5.0 (compatible; PrecosSupermercados/1.0; +https://github.com/Uncle-Sam3/Precos-Mercados)"}
def norm(s): return re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()).strip()
LUG = json.load(open(os.path.join(ROOT, "site/data/lugares.json")))
UFCOD = {}; MUNNAME = {}
for n, uf, la, lo, _, cod in LUG["municipios"]: UFCOD[cod[:2]] = uf; MUNNAME[cod] = (n, uf)
print("carregando malhas...", flush=True)
_mf = os.path.join(REF, "geojs-100-mun.json")
if not os.path.exists(_mf):
    open(_mf, "wb").write(requests.get("https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-100-mun.json", timeout=300).content)
MG = json.load(open(_mf))
MUN = []; 
for f in MG["features"]:
    cod = str(f["properties"]["id"]); gm = f["geometry"]
    polys = gm["coordinates"] if gm["type"] == "MultiPolygon" else [gm["coordinates"]]
    MUN.append((cod, unary_union([Polygon(r).buffer(0) for p in polys for r in p if len(r) >= 4])))
TREE = STRtree([g for _, g in MUN])
LAND = shape(json.load(open(os.path.join(REF, "brasil_terra.json")))); LANDP = prep(LAND)
EST = {f["properties"]["uf"]: shape(f["geometry"]) for f in json.load(open(os.path.join(ROOT, "site/data/geo/estados.json")))["features"]}
def mun_of(lon, lat):
    p = Point(lon, lat)
    for i in TREE.query(p):
        cod, g = MUN[i]
        if g.contains(p): return cod
    return None
def dist_land_m(lon, lat):
    p = Point(lon, lat)
    if LANDP.contains(p): return 0
    return LAND.exterior.distance(p) * 111000 if LAND.geom_type == "Polygon" else min(g.distance(p) for g in LAND.geoms) * 111000
def mun_cod(city, uf):
    c = norm(city)
    for cod, (n, u) in MUNNAME.items():
        if u == uf and norm(n) == c: return cod
    return None
def check(lon, lat, city, uf):
    """None se ok, senão o motivo."""
    if lon is None or lat is None: return "sem coordenadas"
    dl = dist_land_m(lon, lat)
    if dl > 150: return f"na água ({dl:.0f} m da costa)"
    want = mun_cod(city, uf) if city else None
    got = mun_of(lon, lat)
    if want and got and got != want:
        # tolera ponto a < 300 m do limite (divisa entre municípios)
        g = dict(MUN)[want]
        if g.distance(Point(lon, lat)) * 111000 > 300: return f"fora do município ({MUNNAME.get(got, ('?',))[0]} em vez de {city})"
    return None
_last = [0]
def nominatim(street, number, city, uf, cep):
    q = {"street": f"{number or ''} {street or ''}".strip(), "city": city, "state": uf, "country": "Brasil", "format": "json", "limit": 1}
    if cep: q["postalcode"] = cep
    for params in (q, {k: v for k, v in q.items() if k != "postalcode"}):
        time.sleep(max(0, 1.1 - (time.time() - _last[0]))); _last[0] = time.time()
        try: r = requests.get("https://nominatim.openstreetmap.org/search", params=params, headers=UA, timeout=30); j = r.json()
        except Exception: j = []
        if j: return float(j[0]["lon"]), float(j[0]["lat"])
    return None
def grid(ufs, step=0.35):
    for uf in ufs:
        g = EST.get(uf)
        if g is None: continue
        x0, y0, x1, y1 = g.bounds; gp = prep(g.buffer(0.2))
        y = y0
        while y <= y1:
            x = x0
            while x <= x1:
                if gp.contains(Point(x, y)): yield round(x, 3), round(y, 3)
                x += step
            y += step
BAD_NAME = re.compile(r"locker|armario|armário|condom|drive.?thru only|ponto de coleta|clique e retire parceiro", re.I)
def pickup_points(c):
    base = re.sub(r"/io$", "", c["base"].rstrip("/"))
    S = requests.Session(); S.headers.update(UA)
    seen = {}
    for x, y in grid(c.get("ufs") or []):
        for page in (1, 2, 3):
            try:
                r = S.get(f"{base}/api/checkout/pub/pickup-points", params={"geoCoordinates": f"{x};{y}", "countryCode": "BRA", "page": page}, timeout=30)
                j = r.json() if r.status_code == 200 else {}
            except Exception: j = {}
            time.sleep(0.25)
            items = j.get("items") or []
            for it in items:
                pp = it.get("pickupPoint") or {}; a = pp.get("address") or {}
                k = pp.get("id") or a.get("addressId")
                key = (norm(a.get("street")), norm(a.get("number")), norm(a.get("city")))
                if key in seen or not a.get("city"): continue
                if BAD_NAME.search(pp.get("friendlyName") or ""): continue
                gc = a.get("geoCoordinates") or [None, None]
                seen[key] = dict(nome=pp.get("friendlyName"), rua=a.get("street"), num=a.get("number"), bairro=a.get("neighborhood"),
                                 ci=a.get("city"), uf=a.get("state"), cep=a.get("postalCode"), lon=gc[0], lat=gc[1], id=k)
            pg = (j.get("paging") or {}).get("pages") or 0
            if page >= pg: break
    return list(seen.values()), base
LOC_PATHS = ["/nossas-lojas", "/lojas", "/institucional/nossas-lojas", "/nossaslojas", "/institucional/lojas", "/encontre-uma-loja"]
def locator_url(base):
    for p in LOC_PATHS:
        try:
            r = requests.get(base + p, headers=UA, timeout=20, allow_redirects=True)
            if r.status_code == 200 and r.url.rstrip("/").endswith(p.rstrip("/")) and "404" not in r.text[:3000].lower(): return base + p
        except Exception: pass
    return None
def main():
    only = sys.argv[1:]
    old = json.load(open(os.path.join(ROOT, "site/data/stores.json")))
    out, rep = [], {"oficial": {}, "corrigidas": [], "ocultas": [], "osm_reserva": 0}
    done_chains = set()
    for c in CHAINS:
        if only and c["id"] not in only:
            out += [s for s in old if s["c"] == c["id"]]; continue
        pts, base = pickup_points(c); loc = locator_url(base) if pts else None
        print(f"[{c['id']}] {len(pts)} lojas oficiais (pickup-points); página de lojas: {loc}", flush=True)
        n_ok = 0; offi = []
        for p in pts:
            ufok = p["uf"] if p["uf"] in EST else None
            why = check(p["lon"], p["lat"], p["ci"], ufok) if ufok else "UF inválida"
            src = "site"
            if why:
                g = nominatim(p["rua"], p["num"], p["ci"], p["uf"], p["cep"])
                why2 = check(g[0], g[1], p["ci"], p["uf"]) if g else "endereço não encontrado"
                if g and not why2:
                    rep["corrigidas"].append(dict(c=c["id"], loja=p["nome"], end=f"{p['rua']} {p['num']}, {p['ci']}-{p['uf']}", motivo=why, de=[p["lat"], p["lon"]], para=[g[1], g[0]]))
                    p["lon"], p["lat"] = g; src = "site+nominatim"
                else:
                    rep["ocultas"].append(dict(c=c["id"], loja=p["nome"], end=f"{p['rua']} {p['num']}, {p['ci']}-{p['uf']}", motivo=f"{why}; geocodificação: {why2}")); continue
            end = ", ".join(x for x in [" ".join(x for x in [p["rua"], p["num"]] if x), p["bairro"], f"{p['ci']}-{p['uf']}", p["cep"]] if x)
            s = dict(c=c["id"], n=p["nome"], a=end, ci=p["ci"], uf=p["uf"], lat=round(p["lat"], 6), lon=round(p["lon"], 6), src=src, url=loc or base)
            offi.append(s); n_ok += 1
        rep["oficial"][c["id"]] = n_ok
        # OSM como reserva
        for s in old:
            if s["c"] != c["id"] or s.get("src", "osm") != "osm" and "osm" not in s: continue
            if any(abs(o["lat"] - s["lat"]) < 0.0045 and abs(o["lon"] - s["lon"]) < 0.0045 / max(.3, math.cos(math.radians(s["lat"]))) for o in offi): continue
            why = check(s["lon"], s["lat"], s.get("ci"), s.get("uf"))
            if why: rep["ocultas"].append(dict(c=c["id"], loja=s.get("n"), end=f"{s.get('a') or ''}, {s.get('ci')}-{s.get('uf')}", motivo=why, fonte="osm")); continue
            s = dict(s); s["src"] = "osm"; offi.append(s); rep["osm_reserva"] += 1
        out += offi
    json.dump(out, open(os.path.join(ROOT, "site/data/stores.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump(rep, open(os.path.join(REF, "lojas_relatorio.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in rep.items()}, ensure_ascii=False))
if __name__ == "__main__": main()
