"""OSCBR (gtin.rscsistemas.com.br): NCM exato por EAN. Plano bronze: 50 req/dia, 2/min; acima disso a API devolve 403 até o dia seguinte.
Usamos no máx. 48 consultas por execução, 1 a cada 35 s; para no primeiro 403/429. Cursor e 404 ficam em collector/ref/oscbr_estado.json."""
import os, sys, json, time, base64, datetime, requests
sys.path.insert(0, os.path.dirname(__file__)); from ncm_common import *
USER, PASS = os.environ.get('OSCBR_USER', ''), os.environ.get('OSCBR_PASS', '')
if not USER or not PASS: print('OSCBR_USER/OSCBR_PASS ausentes — nada a fazer.'); sys.exit(0)
BASE = 'https://gtin.rscsistemas.com.br'
MAX, PAUSA = int(os.environ.get('OSCBR_MAX', 48)), float(os.environ.get('OSCBR_PAUSA', 35))
EST = os.path.join(ROOT, 'collector/ref/oscbr_estado.json')
est = json.load(open(EST)) if os.path.exists(EST) else {'nao_encontrado': {}, 'ultimo': None}
S = requests.Session(); S.headers['User-Agent'] = 'Precos-Mercados/1.0 (+https://uncle-sam3.github.io/Precos-Mercados/)'
tok = {'v': None, 't': 0}
def token():
    if tok['v'] and time.time() - tok['t'] < 3300: return tok['v']
    r = S.post(f'{BASE}/oauth/token', headers={'Authorization': 'Basic ' + base64.b64encode(f'{USER}:{PASS}'.encode()).decode()}, data={'grant_type': 'client_credentials'}, timeout=30)
    if r.status_code in (403, 429): print('limite atingido ao obter token:', r.status_code); return None
    r.raise_for_status(); j = r.json()
    tok['v'] = j.get('access_token') or j.get('token'); tok['t'] = time.time(); return tok['v']
P = produtos(); D = carregar(); hj = datetime.date.today()
def pular(e):
    if e in D and D[e][1] != 'categoria': return True
    d = est['nao_encontrado'].get(e)
    return bool(d) and (hj - datetime.date.fromisoformat(d)).days < 60   # 404: tenta de novo só após 60 dias
fila = [e for e in prioridade(P) if not pular(e)]
print(f'{len(P)} EANs válidos; {len(fila)} na fila; já com NCM exato: {sum(1 for v in D.values() if v[1] != "categoria")}')
feitos = novos = 0
for e in fila:
    if feitos >= MAX: break
    t = token()
    if not t: break
    if feitos: time.sleep(PAUSA)
    r = S.get(f'{BASE}/api/gtin/infor/{e}', headers={'Authorization': f'Bearer {t}'}, timeout=30); feitos += 1
    if r.status_code == 401: tok['v'] = None; continue
    if r.status_code in (403, 429): print('limite diário atingido (HTTP %d) — parando.' % r.status_code); break
    if r.status_code == 404: est['nao_encontrado'][e] = hoje(); continue
    if not r.ok: print('erro', e, r.status_code); continue
    c = acha_ncm(r.json())
    if c: D[e] = [c, 'OSCBR', hoje()]; novos += 1; print(e, c, P[e]['n'][:60])
    else: est['nao_encontrado'][e] = hoje()
est['ultimo'] = hoje(); json.dump(est, open(EST, 'w'), indent=0)
salvar(D); print(f'consultas: {feitos}; NCM novos: {novos}')
