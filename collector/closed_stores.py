#!/usr/bin/env python3
"""Supermercados FECHADOS -> site/data/closed.json
Fontes de localização: OpenStreetMap (tags disused:shop / was:shop / shop=vacant com nome antigo de rede,
e lojas de redes cujo fechamento foi documentado publicamente — ver EVENTS). Ano e motivo vêm sempre de uma
fonte citada; quando não há motivo documentado: "Motivo não informado".
Fotos (somente fontes de reuso permitido): Wikimedia Commons (geosearch, sem chave), Mapillary (se MAPILLARY_TOKEN
estiver definido) ou Google Street View Static API (se GOOGLE_STREETVIEW_KEY estiver definido)."""
import json, os, re, time, requests
from geo import nearest
OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data", "closed.json")
UA = "PrecosSupermercados/1.0 (github.com/jcbolsaseuniformes-dev/precos-supermercados)"
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
MAPILLARY_TOKEN = os.environ.get("MAPILLARY_TOKEN", "")
GOOGLE_STREETVIEW_KEY = os.environ.get("GOOGLE_STREETVIEW_KEY", "")  # opcional; a chave fica visível no site estático — restrinja por referer

# Fechamentos documentados (rede, regra de seleção das lojas, ano, motivo, fontes)
EVENTS = [
  dict(rede="Dia", name_rx=r"^(Supermercados? )?Dia( ?%)?( Supermercados?| Brasil)?$", brand_rx=r"^Dia( ?%)?$", where=lambda uf, city: uf == "RS", year=2020,
       motivo="A rede Dia encerrou toda a operação no Rio Grande do Sul em setembro de 2020 (70 lojas, 753 demissões), por decisão da matriz na Espanha durante reestruturação após a compra do grupo por um fundo de investimentos.",
       fontes=["https://www.jornaldocomercio.com/_conteudo/economia/2020/09/755877-rede-dia-encerra-operacoes-no-rs-e-vai-embora-da-regiao-sul.html",
               "https://gauchazh.clicrbs.com.br/colunistas/giane-guerra/noticia/2020/09/descontos-agressivos-e-filas-de-clientes-marcam-fechamento-de-supermercados-no-rs-ckex5okst003j0161yizh2v0e.html"],
       nota="O Dia deixou o RS (e a Região Sul) em 2020."),
  dict(rede="Dia", name_rx=r"^(Supermercados? )?Dia( ?%)?( Supermercados?| Brasil)?$", brand_rx=r"^Dia( ?%)?$", where=lambda uf, city: uf not in ("SP", "RS"), year=2024,
       motivo="Recuperação judicial: com dívida de cerca de R$ 1,1 bilhão (grande parte com bancos e fornecedores) e resultados negativos persistentes, o Dia fechou 343 lojas e manteve apenas as unidades do estado de São Paulo.",
       fontes=["https://g1.globo.com/economia/noticia/2024/03/22/justica-aprova-pedido-de-recuperacao-judicial-da-rede-de-supermercados-dia.ghtml",
               "https://www.bloomberglinea.com.br/negocios/os-proximos-passos-da-rede-dia-apos-receber-aval-para-entrar-em-recuperacao-judicial/"],
       nota="Loja fora de SP: segundo a rede, todas as lojas fora do estado de São Paulo foram fechadas em março/abril de 2024."),
  dict(rede="Bretas", name_rx=r"Bretas", brand_rx=r"Bretas", where=lambda uf, city: uf == "MG", year=2025,
       motivo="A Cencosud vendeu toda a operação Bretas de Minas Gerais (54 lojas) ao Supermercados BH por R$ 716 milhões; as lojas deixaram a bandeira Bretas.",
       fontes=["https://www.cencosud.com/en/centro-de-medios/venta-bretas-minas-gerais", "https://www.superhiper.com.br/cencosud-leva-bandeira-prezunic-para-goiania/"],
       nota="Fechada como Bretas; o ponto pode ter sido reaberto com a bandeira Supermercados BH."),
  dict(rede="Althoff", name_rx=r"Althoff", brand_rx=r"Althoff", where=lambda uf, city: uf == "RS", year=2025,
       motivo="Loja de Capão da Canoa fechada em agosto de 2025, na mesma semana em que a Justiça aceitou a recuperação judicial da rede (dívidas de R$ 108,3 milhões).",
       fontes=["https://agoralaguna.com.br/2025/08/rede-de-supermercados-inicia-processo-de-renegociacao-de-dividas/"], nota=""),
  dict(rede="Althoff", name_rx=r"Althoff", brand_rx=r"Althoff", where=lambda uf, city: uf == "SC" and city == "Imbituba", year=2025,
       motivo="O prédio da loja (de propriedade do banco Safra) foi a leilão e arrematado por R$ 42 milhões; a rede, em recuperação judicial, encerrou a unidade.",
       fontes=["https://ndmais.com.br/economia/o-que-levou-tradicional-rede-de-supermercados-a-fechar-as-portas-em-cidade-de-sc/"], nota=""),
  dict(rede="Bretas", name_rx=r"Bretas", brand_rx=r"Bretas", where=lambda uf, city: uf == "GO" and city == "Anápolis", year=2025,
       motivo="O Bretas encerrou as duas unidades de Anápolis em 2025; os imóveis foram vendidos para a rede Villefort.",
       fontes=["https://portal6.com.br/2026/06/18/rede-de-supermercados-anuncia-o-fechamento-de-duas-unidades-em-goiania/"], nota=""),
]

# Redes em RECUPERAÇÃO JUDICIAL (dados só de fontes citadas; valores nunca estimados)
RJ = [
  dict(rede="St Marche", name_rx=r"^St\.? ?Marche", ufs=["SP"], ano=2026, valor="R$ 574,3 milhões",
       credores="Principalmente credores financeiros (bancos); a rede já havia tentado uma recuperação extrajudicial, suspensa pelo TJSP em 2026 por disputa sobre dívida com o BTG Pactual.",
       motivo="Crise de liquidez causada pelo aumento do endividamento, alta dos juros e redução das linhas de crédito.",
       status="Pedido feito em 24/06/2026 no TJSP, junto com o acordo de venda da rede ao grupo Cencosud (depende da aprovação do plano e do Cade).",
       fontes=["https://g1.globo.com/economia/noticia/2026/06/24/cencosudo-acordo-st-marche.ghtml",
               "https://valor.globo.com/empresas/noticia/2026/06/24/st-marche-pede-recuperao-judicial-prejuzo-triplicou-em-2025.ghtml"]),
  dict(rede="Super Barão", name_rx=r"Super Bar[aã]o", ufs=["GO"], ano=2025, valor="Cerca de R$ 110 milhões (valor informado pela empresa)",
       credores="Menos da metade com fornecedores; o restante com instituições financeiras (bancos), colaboradores (trabalhista) e outros credores.",
       motivo="Endividamento da expansão, alta dos juros, queda de rentabilidade desde 2021 e disputa entre sócios.",
       status="Processamento deferido em junho de 2025 pela 25ª Vara Cível de Goiânia; administrador judicial Crosara Advogados.",
       fontes=["https://opopular.com.br/economia/pedido-de-recuperac-o-judicial-do-super-bar-o-e-acatado-1.3277833",
               "https://www.rotajuridica.com.br/juiza-defere-recuperacao-judicial-do-grupo-super-barao-e-proibe-fornecedores-de-se-negarem-a-vender-mercadorias-a-vista-para-a-rede/",
               "https://www.murillolobo.adv.br/recuperacao-judicial-nao-e-o-fim-mas-um-recomeco-para-a-empresa-diz-ceo-do-grupo-barao/"]),
  dict(rede="Althoff Supermercados", name_rx=r"Althoff", ufs=["SC"], ano=2025, valor="R$ 108.346.343,67",
       credores="Fornecedores e bancos.",
       motivo="Queda nas vendas, juros altos, custos logísticos e tributários, concorrência, endividamento da expansão, enchente do RS em 2024 e disputa entre sócios.",
       status="Pedido em 30/07/2025, deferido em 08/08/2025 pela Vara Regional de Falências de Florianópolis (processo 5049377-63.2025.8.24.0023); em 2026 o processo segue, com assembleia de credores.",
       fontes=["https://www.scalzilliaj.com.br/processo/recuperacao-judicial_althoff-supermercados-ltda__375",
               "https://garopaba.sc/economia/rede-althoff-supermercados-inicia-processo-de-recuperacao-judicial/",
               "https://ndmais.com.br/economia/althoff-nega-suspencao-da-recuperacao-judicial-em-sc/"]),
]
RJ_OUT = os.path.join(os.path.dirname(__file__), "..", "site", "data", "rj.json")

def overpass(q):
    for ep in OVERPASS:
        for a in range(2):
            try:
                r = requests.post(ep, data={"data": q}, headers={"User-Agent": UA}, timeout=400)
                if r.ok: return r.json()["elements"]
                print("  overpass", r.status_code, flush=True); time.sleep(20)
            except Exception as e: print("  overpass", type(e).__name__, flush=True); time.sleep(10)
    return []

MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
def ym(y, m): return f"{MESES[int(m)-1]}/{y}"
def photo(lat, lon):
    """Foto de reuso permitido MAIS RECENTE do local (até ~60 m). Retorna url, crédito, link e data da captura."""
    cands = []
    if MAPILLARY_TOKEN:
        try:
            d = 0.0006
            r = requests.get("https://graph.mapillary.com/images", params={"access_token": MAPILLARY_TOKEN, "fields": "id,thumb_1024_url,creator,captured_at",
                             "bbox": f"{lon-d},{lat-d},{lon+d},{lat+d}", "limit": 100}, timeout=30)
            for x in r.json().get("data") or []:
                ts = time.gmtime(x["captured_at"] / 1000)
                cands.append(dict(k=time.strftime("%Y-%m-%d", ts), url=x["thumb_1024_url"], data=ym(ts.tm_year, ts.tm_mon),
                    credito=f"Mapillary — {x.get('creator', {}).get('username', 'colaborador')} (CC BY-SA 4.0)", link=f"https://www.mapillary.com/app/?pKey={x['id']}"))
        except Exception: pass
    if GOOGLE_STREETVIEW_KEY:
        try:  # metadata é gratuita e devolve a data do panorama mais recente servido
            m = requests.get("https://maps.googleapis.com/maps/api/streetview/metadata", params={"location": f"{lat},{lon}", "radius": 60, "key": GOOGLE_STREETVIEW_KEY}, timeout=30).json()
            if m.get("status") == "OK" and m.get("date"):
                y, mo = m["date"].split("-")[:2]
                cands.append(dict(k=m["date"], url=f"https://maps.googleapis.com/maps/api/streetview?size=640x400&pano={m['pano_id']}&key={GOOGLE_STREETVIEW_KEY}",
                    data=ym(y, mo), credito=f"Google Street View {m.get('copyright', '')}".strip(), link=f"https://www.google.com/maps/@?api=1&map_action=pano&pano={m['pano_id']}"))
        except Exception: pass
    try:
        time.sleep(0.5)
        r = requests.get("https://commons.wikimedia.org/w/api.php", headers={"User-Agent": UA}, timeout=30, params={
            "action": "query", "format": "json", "generator": "geosearch", "ggscoord": f"{lat}|{lon}", "ggsradius": 60, "ggsnamespace": 6,
            "ggslimit": 20, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 640})
        for p in (r.json().get("query", {}).get("pages", {}) or {}).values():
            ii = (p.get("imageinfo") or [{}])[0]
            if not re.search(r"\.(jpe?g|png|webp)$", ii.get("url", ""), re.I): continue
            md = ii.get("extmetadata", {})
            dt = re.sub("<[^>]+>", "", (md.get("DateTimeOriginal") or md.get("DateTime") or {}).get("value", ""))
            m = re.search(r"(\d{4})-(\d{2})", dt)
            if not m: continue
            artist = re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", "")).strip()
            lic = md.get("LicenseShortName", {}).get("value", "")
            cands.append(dict(k=dt[:10], url=ii.get("thumburl") or ii["url"], data=ym(m.group(1), m.group(2)),
                credito=f"Wikimedia Commons — {artist or 'autor desconhecido'} ({lic})", link=ii.get("descriptionurl"), aviso="Foto próxima ao local (até 60 m)"))
    except Exception: pass
    if not cands: return None
    best = max(cands, key=lambda c: c["k"]); best.pop("k"); return best

def main():
    out, seen = [], set()
    # 1) OSM: lojas marcadas como desativadas (disused/was) com nome de supermercado
    els = overpass("""[out:json][timeout:300];area["ISO3166-1"="BR"][admin_level=2]->.br;
(nwr(area.br)["disused:shop"~"supermarket|wholesale"]; nwr(area.br)["was:shop"~"supermarket|wholesale"];);out center tags;""")
    print("OSM disused/was:", len(els), flush=True)
    for el in els:
        t = el.get("tags", {}); lat = el.get("lat") or el.get("center", {}).get("lat"); lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None: continue
        name = t.get("disused:name") or t.get("was:name") or t.get("old_name") or t.get("name")
        if not name: continue
        yr = None
        for k in ("end_date", "disused:end_date", "was:end_date", "closed:date", "check_date"):
            m = re.match(r"(\d{4})", t.get(k, "")) if k != "check_date" else None
            if m: yr = int(m.group(1)); break
        city, uf = nearest(lat, lon)
        key = f"{el['type']}/{el['id']}"; seen.add(key)
        out.append(dict(n=name, lat=round(lat, 6), lon=round(lon, 6), ci=city, uf=uf, ano=yr, motivo=None,
                        fontes=[f"https://www.openstreetmap.org/{key}"], nota="Marcado como desativado no OpenStreetMap.", osm=key))
    # 2) fechamentos documentados por notícias / processos
    for ev in EVENTS:
        els = overpass(f"""[out:json][timeout:300];area["ISO3166-1"="BR"][admin_level=2]->.br;
(nwr(area.br)["shop"~"supermarket|convenience|wholesale"]["name"~"{ev['name_rx']}"]; nwr(area.br)["shop"~"supermarket|convenience"]["brand"~"{ev['brand_rx']}"];
 nwr(area.br)["disused:shop"]["disused:name"~"{ev['name_rx']}"];);out center tags;""")
        n0 = len(out)
        for el in els:
            key = f"{el['type']}/{el['id']}"
            if key in seen: continue
            t = el.get("tags", {}); lat = el.get("lat") or el.get("center", {}).get("lat"); lon = el.get("lon") or el.get("center", {}).get("lon")
            if lat is None: continue
            city, uf = nearest(lat, lon)
            if not ev["where"](uf, city): continue
            nm = t.get("name") or t.get("disused:name") or ""
            if nm and not re.search(ev["name_rx"], nm, re.I): continue  # nome precisa ser da rede (evita "Dia a Dia" etc.)
            seen.add(key)
            out.append(dict(n=t.get("name") or t.get("disused:name") or ev["rede"], rede=ev["rede"], lat=round(lat, 6), lon=round(lon, 6), ci=city, uf=uf,
                            ano=ev["year"], motivo=ev["motivo"], fontes=ev["fontes"] + [f"https://www.openstreetmap.org/{key}"], nota=ev["nota"], osm=key))
        print(ev["rede"], ev["year"], "lojas:", len(out) - n0, flush=True)
    # 3) lojas de redes em recuperação judicial (exceto as já marcadas como fechadas)
    rj = []
    for ev in RJ:
        els = overpass(f"""[out:json][timeout:300];area["ISO3166-1"="BR"][admin_level=2]->.br;
(nwr(area.br)["shop"~"supermarket|convenience|wholesale"]["name"~"{ev['name_rx']}",i];);out center tags;""")
        n0 = len(rj)
        for el in els:
            key = f"{el['type']}/{el['id']}"
            if key in seen: continue
            t = el.get("tags", {}); lat = el.get("lat") or el.get("center", {}).get("lat"); lon = el.get("lon") or el.get("center", {}).get("lon")
            if lat is None: continue
            city, uf = nearest(lat, lon)
            if uf not in ev["ufs"]: continue
            seen.add(key)
            rj.append(dict(n=t.get("name") or ev["rede"], rede=ev["rede"], lat=round(lat, 6), lon=round(lon, 6), ci=city, uf=uf, ano=ev["ano"],
                           valor=ev["valor"] or "Valor não divulgado", credores=ev["credores"], motivo=ev["motivo"], status=ev["status"],
                           fontes=ev["fontes"] + [f"https://www.openstreetmap.org/{key}"], osm=key))
        print("RJ", ev["rede"], "lojas:", len(rj) - n0, flush=True)
    for i, s in enumerate(rj):
        s["foto"] = photo(s["lat"], s["lon"])
    with open(RJ_OUT, "w", encoding="utf-8") as f: json.dump(rj, f, ensure_ascii=False, separators=(",", ":"))
    for i, s in enumerate(out):
        s["foto"] = photo(s["lat"], s["lon"])
        if i % 50 == 0: print("fotos", i, "/", len(out), flush=True)
    with open(OUT, "w", encoding="utf-8") as f: json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("fechados:", len(out), "com foto:", sum(1 for s in out if s["foto"]))
if __name__ == '__main__': main()
