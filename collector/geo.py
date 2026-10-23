"""Município/UF mais próximo de uma coordenada (base IBGE em site/data/lugares.json)."""
import json, os, math
_M = None
def _load():
    global _M
    if _M is None:
        d = json.load(open(os.path.join(os.path.dirname(__file__), "..", "site", "data", "lugares.json"), encoding="utf-8"))
        _M = d["municipios"]
    return _M
def nearest(lat, lon):
    best = None; bd = 1e18
    c = math.cos(math.radians(lat))
    for n, uf, la, lo, *_ in _load():
        dd = (la - lat) ** 2 + ((lo - lon) * c) ** 2
        if dd < bd: bd, best = dd, (n, uf)
    return best
