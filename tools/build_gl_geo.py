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

# Máscara de baixo zoom SEM furos: mundo − contorno principal, cortado em pedaços (lat −15 e lon −52) para que nenhum
# polígono tenha furo. Um polígono com o Brasil como furo, recortado pelo geojson-vt nas bordas dos tiles, fazia o
# triangulador (earcut) gerar uma cunha escura atravessando o Norte (Roraima → Macapá) nos zooms 2–4.
def mascara_lo_sem_furos():
    from shapely.geometry import Polygon
    g = shape(json.load(open('site/data/geo/gl-brasil-lo.json')))
    principal = Polygon(max(polys(g), key=lambda p: p.area).exterior)   # ilhotas (≤ 1 px nesse zoom) ficam de fora
    resto = MUNDO.difference(principal); pedacos = []
    for q in [box(-110, -65, -52, -15), box(-52, -65, -5, -15), box(-110, -15, -52, 30), box(-52, -15, -5, 30)]:
        r = resto.intersection(q)
        pedacos += [orient(p, 1.0) for p in polys(r) if p.geom_type == 'Polygon' and p.area > 0]
    assert all(not p.interiors for p in pedacos)
    fc = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {}, 'geometry': rnd(mapping(p), 3)} for p in pedacos]}
    json.dump(fc, open('site/data/geo/gl-mascara-lo.json', 'w'), separators=(',', ':')); print('gl-mascara-lo.json', len(pedacos), 'pedaços')

if __name__ == '__main__':
    mascara_lo_sem_furos()
