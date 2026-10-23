#!/usr/bin/env python3
"""Gera a máscara "fora do Brasil" e o recorte do Brasil a partir da malha municipal IBGE em resolução cheia
(github.com/tbrugz/geodata-br, geojs-100-mun.json; ilhas incluídas: Ilhabela, Florianópolis, São Luís, Vitória, Marajó...).
- site/data/geo/mascara.json            baixa resolução (zoom < 8), mundo menos Brasil
- site/data/geo/brasil-simples.json     Brasil simplificado (filtro de rótulos do estilo vetorial)
- site/data/geo/cel/<lon>_<lat>.json    células de 2°: {"f": fora do Brasil, "d": dentro do Brasil}, alta resolução (zoom >= 8)
- site/data/geo/cel/indice.json         tipo de cada célula: 0 = toda fora, 1 = toda dentro, 2 = borda (tem arquivo)
Buffer de ~300 m para fora: a máscara nunca cobre terra brasileira (praias, ilhas)."""
import json, os, sys
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
from shapely import set_precision
SRC = sys.argv[1]; OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data", "geo")
g = json.load(open(SRC))
from shapely.geometry import Polygon as _P
def rings_of(geom):  # a malha traz ilhas codificadas como "buracos" fora da casca: usa cada anel como polígono
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [_P(r).buffer(0) for p in polys for r in p if len(r) >= 4]
br = unary_union([q for f in g["features"] for q in rings_of(f["geometry"])])
from shapely.geometry import Polygon, MultiPolygon
print("buracos antes:", sum(len(p.interiors) for p in getattr(br, "geoms", [br])))
br = MultiPolygon([Polygon(p.exterior) for p in getattr(br, "geoms", [br]) if p.area > 1e-7])  # sem buracos (frestas entre municípios)
print("união ok", br.geom_type, len(getattr(br, "geoms", [br])))
brb = br.buffer(0.003, quad_segs=2)          # ~300 m
lo = brb.buffer(0.02, quad_segs=2).simplify(0.01)   # baixa resolução (mais folgada)
world = box(-180, -85, 180, 85)
def dump(geom, path, nd):
    geom = set_precision(geom, 10 ** -nd)
    json.dump(mapping(geom), open(path, "w"), separators=(",", ":"))
dump(world.difference(lo), os.path.join(OUT, "mascara.json"), 3)
dump(br.simplify(0.01), os.path.join(OUT, "brasil-simples.json"), 3)
os.makedirs(os.path.join(OUT, "cel"), exist_ok=True)
hi = brb.simplify(0.0004)
idx = {}
for x in range(-84, -24, 2):
    for y in range(-42, 14, 2):
        b = box(x, y, x + 2, y + 2)
        if not b.intersects(hi): idx[f"{x}_{y}"] = 0; continue
        if b.within(hi): idx[f"{x}_{y}"] = 1; continue
        d = b.intersection(hi); f = b.difference(hi)
        idx[f"{x}_{y}"] = 2
        json.dump({"f": mapping(set_precision(f, 1e-5)), "d": mapping(set_precision(d, 1e-5))}, open(os.path.join(OUT, "cel", f"{x}_{y}.json"), "w"), separators=(",", ":"))
json.dump(idx, open(os.path.join(OUT, "cel", "indice.json"), "w"), separators=(",", ":"))
json.dump(mapping(set_precision(br.simplify(0.0002), 1e-5)), open("/tmp/brasil_terra.json", "w"))
print("células borda:", sum(v == 2 for v in idx.values()))
