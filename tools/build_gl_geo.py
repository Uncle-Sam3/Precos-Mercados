"""Gera geometrias para o mapa MapLibre: máscara (fora do Brasil) e contorno orientado (sombra/linha).
Entrada: collector/ref/brasil_terra.json (IBGE, alta resolução) e site/data/geo/brasil-simples.json."""
import json
from shapely.geometry import shape, mapping, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
def polys(g): return list(g.geoms) if g.geom_type == 'MultiPolygon' else [g]
def rnd(o, nd):
    if isinstance(o, float): return round(o, nd)
    if isinstance(o, (list, tuple)): return [rnd(x, nd) for x in o]
    if isinstance(o, dict): return {k: rnd(v, nd) for k, v in o.items()}
    return o
def save(path, geom, nd):
    d = rnd(mapping(geom), nd); json.dump(d, open(path, 'w'), separators=(',', ':')); print(path, len(json.dumps(d, separators=(',', ':'))) // 1024, 'KB')
MUNDO = box(-110, -65, -5, 30)
hi = unary_union([p.buffer(0) for p in polys(shape(json.load(open('collector/ref/brasil_terra.json'))))])
lo = unary_union([p.buffer(0) for p in polys(shape(json.load(open('site/data/geo/brasil-simples.json'))))])
for nome, g, nd, simp in [('hi', hi, 5, 0.0003), ('lo', lo, 3, 0.01)]:
    g = g.simplify(simp, preserve_topology=True)
    contorno = unary_union([orient(p, 1.0) for p in polys(g)])          # exterior anti-horário: lado direito = fora
    from shapely.geometry import MultiPolygon
    contorno = MultiPolygon([orient(p, 1.0) for p in polys(contorno)])
    save(f'site/data/geo/gl-brasil-{nome}.json', contorno, nd)
    save(f'site/data/geo/gl-mascara-{nome}.json', orient(MUNDO.difference(g), 1.0) if MUNDO.difference(g).geom_type == 'Polygon' else MUNDO.difference(g), nd)
