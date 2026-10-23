# Preços de Supermercados no Brasil

Site estático (GitHub Pages) com um mapa do Brasil mostrando lojas de redes de supermercado que
publicam preços online. Clique no ícone da loja → janela flutuante → pesquise (vários itens com `+`,
ex.: `salgadinho+bolacha+oleo`). Cada termo mostra um item com o **preço médio por kg/L**; ao abrir,
aparecem os produtos (foto, nome, gramatura, ano/data do preço, preço) e, clicando num produto, o
**histórico** (mais antigo → mais recente), com a fonte de cada registro.

Cor do ícone (calculada em `collector/build_index.py` a partir dos dados reais):
* **vermelho** = sem histórico de anos anteriores; **amarelo** = histórico parcial (algum preço de ano anterior);
* **azul** = histórico completo (≥ 50% dos produtos atuais com preço de ano anterior **e** ≥ 2 anos anteriores distintos);
* **laranja** = rede em recuperação judicial (valor da dívida, credores, motivo e situação do processo, com fonte);
* **cinza com X** = loja fechada ("Fechado em <ano>"), com motivo e fonte (ou "Motivo não informado").

Somente preços **regulares** são guardados: quando há promoção ativa, grava-se o preço "de" (ListPrice), nunca o
promocional. Encartes/folhetos não são usados (são promocionais).

Outros recursos: busca de cidades/estados (base IBGE embutida) com contorno e animação das lojas, 3 estilos de
mapa (Preto minimalista/OpenFreeMap, Cinza escuro/Esri, Escuro detalhado/OSM invertido), botão de nomes de
ruas/bairros, máscara pontilhada escondendo tudo fora do Brasil (limites IBGE), som de bolha (Pixabay — "Bubble Pop 04" de Universfield,
Pixabay Content License; ver `site/assets/sounds/CREDITOS.txt`).

## Estrutura
```
site/                     → publicado no GitHub Pages
  index.html, style.css, app.js
  data/stores.json        → lojas (coordenadas reais do OpenStreetMap)
  data/chains.json        → resumo por rede (nº de produtos, data mais antiga, has_old)
  data/chains/<rede>.json → catálogo completo da rede + histórico (só mudanças de preço)
  data/closed.json        → lojas fechadas (ano, motivo, fontes, foto)
  data/rj.json            → lojas de redes em recuperação judicial (dívida, credores, situação, fontes, foto)
  data/lugares.json       → estados e 5.571 municípios (IBGE) para a busca
  data/geo/               → limites de estados/municípios (IBGE, simplificados) e máscara "mundo menos Brasil"
  assets/                 → som e miniaturas dos estilos de mapa
collector/
  chains.py               → redes suportadas (API VTEX pública)
  crawl_vtex.py           → baixa o catálogo inteiro de cada rede e grava o preço do dia
  archives.py             → importa preços regulares antigos de arquivos da web: Arquivo.pt (a), Wayback Machine (w),
                            Common Crawl (c). Grava data do snapshot + link (nunca estima)
  closed_stores.py        → lojas fechadas (OSM disused/was:shop + fechamentos documentados em notícias) e foto livre mais recente
  geo.py                  → município/UF mais próximo (IBGE)
  stores_osm.py           → localiza as lojas no OpenStreetMap (Overpass)
  build_index.py          → gera data/chains.json
  state/                  → snapshots do Wayback já processados (para não baixar de novo)
.github/workflows/
  coletar.yml             → todo dia às 06:00 (Brasília): coleta, Wayback, (segunda) lojas, commit
  pages.yml               → publica a pasta site/ no GitHub Pages
```

Formato do histórico: `"h": [[data, preço, fonte, ref], ...]` — fonte `v` = site da rede (coleta
diária; só grava quando o preço muda), `a` = Arquivo.pt (`https://arquivo.pt/wayback/<ref>`),
`w` = Wayback Machine (`https://web.archive.org/web/<ref>`), `c` = Common Crawl (`<ref>|<arquivo WARC>`).
`x` = data em que o produto sumiu do site; `arch: 1` = produto que só existe no arquivo histórico.
Nenhum preço é estimado ou inventado.

## Rodar localmente
```
pip install -r requirements.txt
python collector/crawl_vtex.py giassi zaffari      # ou sem argumentos = todas
python collector/archives.py --fontes a,w,c giassi # histórico dos arquivos da web (lento, educado)
python collector/closed_stores.py                  # lojas fechadas
python collector/stores_osm.py
python collector/build_index.py
./serve.sh                                         # http://localhost:8080
```

## Publicar
1. Crie o repositório `precos-supermercados` na conta `jcbolsaseuniformes-dev`.
2. `git remote add origin https://github.com/jcbolsaseuniformes-dev/precos-supermercados.git && git push -u origin main`
3. Em *Settings → Pages*, escolha **Source: GitHub Actions**.
4. Em *Actions*, rode "Coletar preços (diário)" uma vez manualmente (Run workflow).

## Chaves opcionais (Settings → Secrets → Actions)
* `MAPILLARY_TOKEN` — token gratuito do Mapillary para fotos de rua das lojas fechadas (recomendado).
* `GOOGLE_STREETVIEW_KEY` — chave da Street View Static API (opcional). Atenção: num site estático a URL da imagem
  expõe a chave; restrinja-a por referer (jcbolsaseuniformes-dev.github.io) no Google Cloud.
Sem chaves, usa só Wikimedia Commons (fotos a até 60 m) ou mostra "Sem foto disponível".
