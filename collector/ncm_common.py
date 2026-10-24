"""Base comum dos coletores de NCM por EAN (Cosmos e OSCBR).
Resultado: site/data/ncm_ean.json = {ean: [ncm8, fonte, data]} — usado pelo site no lugar da estimativa por categoria."""
import json, glob, re, os, unicodedata, datetime, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site/data/ncm_ean.json')
STAPLES = re.compile(r'^(arroz|feijao|oleo de soja|oleo|acucar|cafe|leite|ovos?|farinha|macarrao|carne|picanha|alcatra|patinho|acem|costela|frango|file de frango|coxa|linguica|carne moida)\b')
def norm(s): return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
def gtin_ok(e):
    e = re.sub(r'\D', '', e or '')
    if len(e) not in (8, 12, 13, 14) or (len(e) == 13 and e[0] == '2') or set(e) == {'0'}: return None
    d = [int(c) for c in e.zfill(14)]
    s = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(d[:-1]))
    return e if (10 - s % 10) % 10 == d[-1] else None
def produtos():
    """{ean: {'n': nome, 'redes': set}} de todas as redes."""
    P = {}
    for f in glob.glob(os.path.join(ROOT, 'site/data/chains/*.json')):
        cid = os.path.basename(f)[:-5]
        for p in json.load(open(f)).get('p', {}).values():
            e = gtin_ok(p.get('e'))
            if not e: continue
            it = P.setdefault(e, {'n': p.get('n', ''), 'c': p.get('c', ''), 'redes': set()}); it['redes'].add(cid)
    return P
def prioridade(P):
    """EANs ordenados: itens básicos primeiro, depois os vendidos em mais redes."""
    return sorted(P, key=lambda e: (0 if STAPLES.match(norm(P[e]['n'])) else 1, -len(P[e]['redes']), e))
def carregar():
    try: return json.load(open(OUT))
    except Exception: return {}
def salvar(d):
    json.dump(dict(sorted(d.items())), open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
hoje = lambda: datetime.date.today().isoformat()
def ncm8(v):
    v = re.sub(r'\D', '', str(v or ''))
    return v if len(v) == 8 else None
def acha_ncm(o):
    """procura um campo 'ncm' (código de 8 dígitos) em qualquer nível do JSON."""
    if isinstance(o, dict):
        for k, v in o.items():
            if 'ncm' in k.lower():
                c = ncm8(v if not isinstance(v, dict) else v.get('code') or v.get('codigo'))
                if c: return c
        for v in o.values():
            c = acha_ncm(v)
            if c: return c
    elif isinstance(o, list):
        for v in o:
            c = acha_ncm(v)
            if c: return c
    return None
