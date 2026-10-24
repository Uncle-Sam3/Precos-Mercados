"""Base comum dos coletores de NCM por EAN (Cosmos e OSCBR).
Resultado: site/data/ncm_ean.json = {ean: [ncm8, fonte, data]} — usado pelo site no lugar da estimativa por categoria."""
import json, glob, re, os, unicodedata, datetime, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site/data/ncm_ean.json')
NAO_BASICO = re.compile(r'fermentad|condensad|capsula|instantane|lamen|soluvel|cappuccino|achocolat|bebida|sobremesa|biscoito|salgadinho|tempero|pronto|congelad[oa] empanad|vegetal|vegan|plant based|soja texturizada')
STAPLES_RE = re.compile(r'^(arroz|feijao|oleo de soja|oleo|acucar|cafe|leite|ovos?|farinha|macarrao|carne|picanha|alcatra|patinho|acem|costela|frango|file de frango|coxa|linguica|carne moida)\b')
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

# ---- prioridade pela população atendida (IBGE) ----
POP_CACHE = os.path.join(ROOT, 'collector/ref/populacao_ibge.json')
POP_URL = 'https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6%5Ball%5D'
STAPLE_BOOST = 10
class _St:
    @staticmethod
    def match(n): return bool(STAPLES_RE.match(n)) and not NAO_BASICO.search(n)
STAPLES = _St()
def populacao():
    """{código IBGE do município: população estimada mais recente}; atualiza pela API e cai no cache se falhar."""
    try:
        import requests
        s = requests.get(POP_URL, timeout=60).json()[0]['resultados'][0]['series']; per = list(s[0]['serie'])[0]
        d = {'fonte': 'IBGE — agregado 6579 (População residente estimada)', 'periodo': per,
             'pop': {x['localidade']['id']: int(x['serie'][per]) for x in s if x['serie'][per].isdigit()}}
        if len(d['pop']) > 5000: json.dump(d, open(POP_CACHE, 'w'), separators=(',', ':'))
    except Exception as e:
        print('IBGE indisponível, usando cache:', e)
    return json.load(open(POP_CACHE))['pop']
def pesos_redes():
    """peso da rede = soma da população dos municípios (distintos) onde ela tem loja."""
    pop = populacao()
    lug = json.load(open(os.path.join(ROOT, 'site/data/lugares.json')))
    cod = {(norm(m[0]), m[1]): str(m[5]) for m in lug['municipios']}
    mun = collections.defaultdict(set)
    for s in json.load(open(os.path.join(ROOT, 'site/data/stores.json'))):
        c = cod.get((norm(s.get('ci')), s.get('uf')))
        if c: mun[s['c']].add(c)
    return {r: sum(pop.get(c, 0) for c in ms) for r, ms in mun.items()}
def prioridade(P, W=None):
    """EANs ordenados por: (x10 se item básico) x soma dos pesos das redes que vendem o EAN."""
    W = W if W is not None else pesos_redes()
    score = lambda e: (STAPLE_BOOST if STAPLES.match(norm(P[e]['n'])) else 1) * sum(W.get(r, 0) for r in P[e]['redes'])
    return sorted(P, key=lambda e: (-score(e), e))
