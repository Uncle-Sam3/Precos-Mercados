"""Cosmos (Bluesoft): lista produtos por NCM e casa os GTINs com os nossos EANs. Limite: 25 req/dia (usamos <= 25), para no HTTP 429.
Percorre os NCMs das regras de categoria (site/data/ncm_regras.json), dos mais comuns no nosso catálogo para os raros.
Cursor (índice do NCM, página) em collector/ref/cosmos_cursor.json."""
import os, sys, json, re, requests
sys.path.insert(0, os.path.dirname(__file__)); from ncm_common import *
TOKEN = os.environ.get('COSMOS_TOKEN', '')
if not TOKEN: print('COSMOS_TOKEN ausente — nada a fazer.'); sys.exit(0)
MAX = int(os.environ.get('COSMOS_MAX', 25))
CUR = os.path.join(ROOT, 'collector/ref/cosmos_cursor.json')
cur = json.load(open(CUR)) if os.path.exists(CUR) else {'i': 0, 'page': 1, 'voltas': 0}
regras = json.load(open(os.path.join(ROOT, 'site/data/ncm_regras.json')))['regras']
P = produtos(); D = carregar()
# peso do NCM = soma da prioridade (básico x10 x população atendida pelas redes) dos nossos produtos que caem nele
W = pesos_redes(); cont = {}
rx = [(re.compile(r['re']), r['ncm']) for r in regras]
for e, p in P.items():
    if e in D and D[e][1] != 'categoria': continue
    t = norm(p['n']) + ' | ' + norm(p['c'])
    sc = (STAPLE_BOOST if STAPLES.match(norm(p['n'])) else 1) * sum(W.get(r, 0) for r in p['redes'])
    for r, c in rx:
        if r.search(t): cont[c] = cont.get(c, 0) + sc; break
ncms = sorted(cont, key=lambda c: -cont[c])
S = requests.Session(); S.headers.update({'X-Cosmos-Token': TOKEN, 'User-Agent': 'Cosmos-API-Request', 'Content-Type': 'application/json'})
feitos = novos = 0
while feitos < MAX and ncms:
    if cur['i'] >= len(ncms): cur.update(i=0, page=1, voltas=cur.get('voltas', 0) + 1)
    c = ncms[cur['i']]
    r = S.get(f'https://api.cosmos.bluesoft.com.br/ncms/{c}/products', params={'page': cur['page'], 'per_page': 90}, timeout=30); feitos += 1
    if r.status_code == 429: print('HTTP 429 — limite diário; parando.'); break
    if r.status_code in (401, 403): print('token recusado:', r.status_code); break
    if r.status_code == 404 or not r.ok: cur.update(i=cur['i'] + 1, page=1); continue
    j = r.json(); prods = j.get('products') or []
    for p in prods:
        e = gtin_ok(str(p.get('gtin', '')))
        if e and e in P and not (e in D and D[e][1] != 'categoria'):
            D[e] = [ncm8(c) or c, 'Cosmos', hoje()]; novos += 1
    tp = j.get('total_pages') or j.get('pages') or (cur['page'] + 1 if len(prods) >= 90 else cur['page'])
    if cur['page'] >= tp or not prods: cur.update(i=cur['i'] + 1, page=1)
    else: cur['page'] += 1
    print(f'NCM {c} pág. {cur["page"]}: {len(prods)} produtos')
json.dump(cur, open(CUR, 'w')); salvar(D); print(f'consultas: {feitos}; EANs com NCM novo: {novos}')
