const $ = id => document.getElementById(id);
// Preços de Supermercados — frontend estático (GitHub Pages)
const BRL = v => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s?(kg|g|gr|mg|ml|l|lt|litros?|un|unid(?:ades)?)\b/i;
const sizeOf = n => { const m = (n || '').match(SIZE_RE); return m ? m[0].replace(/\s+/, '') : ''; };
// ícones dos cartões: regras específicas primeiro, genéricas depois (palavras inteiras: "maca" ≠ "macarrao", "mel" ≠ "melancia", "pao" ≠ "sabao")
const ICONS = [
  [/batata palha|salgadinho|chips|snack|pipoca|amendoim/, '🍿'], [/\b(sabao|detergente|amaciante|desinfetante|limpa\w*|alvejante|agua sanitaria)\b/, '🧴'],
  [/\b(feijao|feijoes|lentilhas?|grao de bico|ervilhas?)\b/, '🫘'], [/\barroz\b/, '🍚'], [/\b(macarrao|massas?|espaguete|lasanha|talharim|penne|parafuso)\b/, '🍝'],
  [/\b(alfaces?|couves?|rucula|espinafre|agriao|repolho|verduras?|cheiro verde)\b/, '🥬'], [/\b(cenouras?|legumes?)\b/, '🥕'], [/\btomates?\b/, '🍅'],
  [/\bcebolas?\b/, '🧅'], [/\balhos?\b/, '🧄'], [/\bbatatas?\b/, '🥔'], [/\bbrocolis\b/, '🥦'], [/\b(pepinos?|abobrinhas?)\b/, '🥒'],
  [/\b(pimentao|pimentoes|pimentas?)\b/, '🫑'], [/\bmilho\b/, '🌽'], [/\babacates?\b/, '🥑'], [/\bbananas?\b/, '🍌'], [/\bmacas?\b/, '🍎'],
  [/\b(laranjas?|tangerinas?|mexericas?|bergamotas?)\b/, '🍊'], [/\b(limao|limoes)\b/, '🍋'], [/\buvas?\b/, '🍇'], [/\bmorangos?\b/, '🍓'], [/\bmelancias?\b/, '🍉'],
  [/\babacaxis?\b/, '🍍'], [/\bmangas?\b/, '🥭'], [/\bperas?\b/, '🍐'], [/\bcocos?\b/, '🥥'], [/\b(frutas?)\b/, '🍎'],
  [/\b(frango|galinha|peito|coxas?|sobrecoxas?|asas?)\b/, '🍗'], [/\bovos?\b/, '🥚'], [/\b(queijos?|requeijao|mussarela)\b/, '🧀'], [/\b(manteiga|margarina)\b/, '🧈'],
  [/\bmel\b/, '🍯'], [/\b(camarao|camaroes)\b/, '🦐'], [/\b(peixes?|atum|sardinhas?|salmao|tilapia|bacalhau)\b/, '🐟'],
  [/\b(carnes?|bife|picanha|alcatra|maminha|costela|patinho|acem|linguica|salsicha|bacon|presunto|mortadela)\b/, '🥩'],
  [/\b(chocolates?|bombom|bombons|cacau)\b/, '🍫'], [/\b(biscoitos?|bolachas?|cookies?|wafer)\b/, '🍪'], [/\b(cha|chas)\b/, '🍵'], [/\b(cafe|capsulas?)\b/, '☕'],
  [/\b(leite|iogurtes?|bebida lactea)\b/, '🥛'], [/\b(cervejas?|chopp)\b/, '🍺'], [/\b(vinhos?|espumantes?)\b/, '🍷'], [/\baguas?\b/, '💧'],
  [/\b(refrigerantes?|sucos?|energeticos?|bebidas?)\b/, '🥤'], [/\bpizzas?\b/, '🍕'], [/\bbolos?\b/, '🍰'], [/\b(pao|paes|bisnaguinha|torradas?)\b/, '🍞'],
  [/\b(oleo|azeite|oliva)\b/, '🫒'], [/\b(papel higienico|guardanapos?|papel toalha)\b/, '🧻'], [/\b(shampoo|condicionador|sabonetes?|creme dental|desodorante)\b/, '🧼'],
  [/\b(racao|pet|cachorro|gato)\b/, '🐾'], [/\b(sorvetes?|picoles?)\b/, '🍦'], [/\b(acucar|adocante|sal|temperos?|molhos?|ketchup|maionese)\b/, '🧂'],
  [/\b(farinha|fuba|aveia|cereais|cereal|granola)\b/, '🌾'], [/\b(fraldas?|bebe)\b/, '🍼'],
];
// quantidade normalizada: {q: quantidade em kg ou L, u: 'kg'|'L'}
function qtyOf(name) {
  const n = norm(name).replace(/(\d),(\d)/g, '$1.$2');
  const SZ = '(\\d+(?:\\.\\d+)?)\\s?(kg|kilos?|quilos?|g|gr|grs|gramas?|mg|ml|l|lt|lts|litros?)\\b';
  // multipacks: "6x1L", "12 x 500ml", "12 un de 500ml", "c/ 6 un 1l", "pack 3 un 500g", "500ml c/12", "1l 6 unidades"
  let m = n.match(new RegExp('(\\d+)\\s?(?:x|un\\.?|unid\\.?|unidades?)\\s?(?:de\\s|x\\s?|c\\/\\s?)?' + SZ));
  let mult = 1, v, u;
  if (m) { mult = +m[1]; v = +m[2]; u = m[3]; }
  else {
    m = n.match(new RegExp(SZ));
    if (!m) return /\b(kg|quilo)\b/.test(n) ? {q: 1, u: 'kg'} : null;
    v = +m[1]; u = m[2];
    const after = n.slice(m.index + m[0].length);
    const mm = n.match(/\b(?:c\/|com|cx\.?\s?c\/|pack|kit|fardo|leve)\s?(\d+)\s?(?:un|unid|unidades)\b/) || after.match(/^\s*(?:c\/\s?|x\s?)(\d+)\b/) || after.match(/^\s*(\d+)\s?(?:un|unid|unidades)\b/);
    if (mm) mult = +mm[1];
  }
  if (!v || mult > 200) return null;
  if (/^(kg|kilos?|quilos?)$/.test(u)) return {q: v * mult, u: 'kg'};
  if (/^(g|gr|grs|gramas?)$/.test(u)) return {q: v * mult / 1000, u: 'kg'};
  if (u === 'mg') return null;
  if (u === 'ml') return {q: v * mult / 1000, u: 'L'};
  return {q: v * mult, u: 'L'};
}
// categorias que não são alimento/bebida (ignoradas quando o termo também existe em alimentos)
const NAO_ALIMENTO = /higiene|beleza|cabelo|capilar|perfum|cosmet|maquiag|limpeza|lavanderia|pet ?shop|\bpets?$|animais|bebe|infantil|farma|saude|essenc|aromat|automot|bazar|utilidade|casa|jardim|ferrament|eletro|papelaria|banho|corpo|pele|barba|unha|desodor|sabonete|repelente|vela/;  // categoria
const NAO_ALIMENTO_NOME = /bronzead|desengripa|lubrific|massagem|hidratante|shampoo|condicionador|peroba|restaurador|serum|finalizador|reparador|capilar|cabelo|corporal|essencial|madeira|perfum|protetor|automotiv|motor\b|2 tempos|maquina|racao|cachorro|gato/;  // nome
// itens básicos usados no preço de referência quando o termo é genérico (o resto continua listado)
const BASICOS = {
  arroz: {re: /^arroz\b.*\b(branco|parboilizado|tipo 1|tipo1|agulhinha|integral|polido)\b/, not: /arboreo|basmati|jasmim|jasmine|carnaroli|risot|negro|vermelho|selvagem|cateto|graos|japones|gohan|sasanishiki|pronto|cozido|biscoito|bolinho/, rot: 'arroz branco/parboilizado/integral'},
  oleo: {re: /^oleo (de )?soja\b/, not: /spray|trufad|organic/, rot: 'óleo de soja (o "óleo" comum)'},
  feijao: {re: /^feijao\b.*\b(carioca|preto|tipo 1|tipo1)\b/, not: /pronto|temperado|cozido|congelado|feijoada|sopa/, rot: 'feijão carioca/preto cru'},
  acucar: {re: /^acucar\b.*\b(refinado|cristal)\b/, not: /sache|stick|cubo/, rot: 'açúcar refinado/cristal'},
  cafe: {re: /^cafe\b.*\b(po|torrado e moido|moido|grao|graos)\b/, not: /capsula|sache|soluvel|cappuccino|bebida/, rot: 'café em pó/grão'},
  leite: {re: /^leite\b.*\b(integral|desnatado|semidesnatado|uht)\b/, not: /condensado|po\b|fermentado|coco|amendoa|aveia|soja|castanha|creme/, rot: 'leite UHT'},
};

const wordRe = t => new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?([^a-z0-9]|$)');
// Busca: casa palavras inteiras no NOME do produto; "principais" = nome começa pelo termo e categoria de alimento
function searchTerm(list, q) {
  const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return {hits: [], core: []};
  const res = toks.map(wordRe), qn = toks.join(' ');
  const hits = list.filter(p => { const n = norm(p.n); return res.every(r => r.test(n)); });
  const food = hits.filter(p => !NAO_ALIMENTO.test(norm(p.c || '')) && !NAO_ALIMENTO_NOME.test(norm(p.n)));
  const starts = food.filter(p => norm(p.n).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().startsWith(qn));
  let core = starts.length >= 1 ? starts : food.length ? food : hits, basic = null;
  const B = BASICOS[qn];
  if (B) { const bb = core.filter(p => { const n = norm(p.n); return B.re.test(n) && !B.not.test(n); }); if (bb.length >= 1) basic = {list: bb, rot: B.rot}; else basic = {list: null, rot: B.rot, none: true}; }
  const rest = hits.filter(p => !core.includes(p));
  const by = (a, b) => a.last[1] - b.last[1];
  return {hits: [...core.sort(by), ...rest.sort(by)], core, basic};
}
// estatística robusta: mediana + média aparada (remove fora de 1,5×IQR)
function robust(vals) {
  const v = vals.slice().sort((a, b) => a - b), n = v.length; if (!n) return null;
  const qt = f => { const i = (n - 1) * f, lo = Math.floor(i); return v[lo] + (v[Math.min(lo + 1, n - 1)] - v[lo]) * (i - lo); };
  const med = qt(.5), q1 = qt(.25), q3 = qt(.75), iqr = q3 - q1;
  const kept = n >= 4 ? v.filter(x => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr) : v;
  return {med, mean: kept.reduce((a, b) => a + b, 0) / kept.length, n, kept: kept.length};
}
// unidade da média por grupo de produto (configurável): o que faz sentido para quem compra.
// u: 'un' = por unidade/embalagem · 'duzia' = por dúzia (ovos) · 'pacote' = por pacote · 'kg' / 'L' = por peso/volume.
// A primeira regra que casar com o termo pesquisado vale; se nenhuma casar, testa a categoria da maioria dos produtos.
const UNIDADE_MEDIA = [
  {re: /\bovos?\b/, u: 'duzia'},
  {re: /papel higienico|papel toalha|guardanapo|lenco de papel|fralda|absorvente/, u: 'pacote'},
  {re: /\b(alfaces?|couves?|rucula|agriao|cheiro verde)\b/, u: 'un'},  // folhas: vendidas por pé/maço
  {re: /salgadinho|chips|snack|batata (frita|chips|palha)|pipoca de micro|amendoim japones|biscoito|bolacha|cookie|wafer|chocolate|bombom|barra de cereal|chiclete|goma de mascar|\bbalas?\b|pirulito|pilha|bateria|lampada|escova|desodorante|sabonete|sabao em barra|creme dental|pasta de dente|fio dental|aparelho de barbear|lamina|esponja|vela|isqueiro|fosforo|picole|sorvete|iogurte|petit suisse|bebida lactea|refrigerante lata|cerveja lata/, u: 'un'},
  {re: /carne|picanha|alcatra|maminha|costela|patinho|acem|frango|peito|coxa|linguica|bacon|peixe|file|camarao|arroz|feijao|farinha|fuba|acucar|cafe|sal\b|batata|tomate|cebola|banana|maca|laranja|limao|cenoura|queijo|presunto|mortadela|macarrao|massa/, u: 'kg'},
  {re: /oleo|azeite|leite|suco|refrigerante|agua|cerveja|vinho|bebida|detergente|amaciante|desinfetante|sabao liquido|lava roupas|agua sanitaria|alvejante|vinagre/, u: 'L'},
];
const ROT_UN = {un: 'unidade', duzia: 'dúzia', pacote: 'pacote', kg: 'kg', L: 'L'};
function unidadeDe(q, core) {
  const n = norm(q || ''); for (const r of UNIDADE_MEDIA) if (r.re.test(n)) return r.u;
  const cats = {}; for (const p of core) { const c = norm(p.c || ''); for (const r of UNIDADE_MEDIA) if (r.re.test(c)) { cats[r.u] = (cats[r.u] || 0) + 1; break; } }
  const best = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] * 2 >= core.length ? best[0] : null;
}
const nOvos = n => { n = norm(n); if (/\bduzia\b/.test(n) && !/meia duzia/.test(n)) return 12; if (/meia duzia/.test(n)) return 6;
  const m = n.match(/\b(?:c\/|com|cx\.?\s?c\/)?\s?(\d{1,2})\s?(?:un|unid|unidades|ovos)\b/) || n.match(/\bc\/\s?(\d{1,2})\b/); return m ? +m[1] : null; };
function termStats(core, q) {
  const live = core.filter(p => !p.arch && !p.x), base = live.length ? live : core;
  const forc = unidadeDe(q, base);
  if (forc === 'un' || forc === 'pacote') return {unit: forc, ...robust(base.map(p => p.last[1]))};
  if (forc === 'duzia') { const sel = base.filter(p => nOvos(p.n)); if (sel.length) return {unit: 'duzia', ...robust(sel.map(p => p.last[1] * 12 / nOvos(p.n)))}; }  // sem contagem (ex.: ovo de codorna em conserva): cai no peso
  const withQ = base.filter(p => p.qu);
  const nkg = withQ.filter(p => p.qu.u === 'kg').length, nl = withQ.length - nkg;
  const unit = forc === 'kg' || forc === 'L' ? (withQ.some(p => p.qu.u === forc) ? forc : (nkg >= nl ? 'kg' : 'L')) : (nkg >= nl ? 'kg' : 'L');
  const sel = withQ.filter(p => p.qu.u === unit);
  if (sel.length) return {unit, ...robust(sel.map(p => p.last[1] / p.qu.q))};
  return {unit: 'un', semPeso: true, ...robust(base.map(p => p.last[1]))};
}
const perUnit = (p, price) => p.qu ? price / p.qu.q : null;
// produto vendido por unidade/pacote (ex.: salgadinho, chocolate): não mostra R$/kg nem R$/L na linha
const ehUnidade = p => p._un ??= (() => { for (const t of [norm(p.n), norm(p.c || '')]) for (const r of UNIDADE_MEDIA) if (r.re.test(t)) return r.u === 'un' || r.u === 'pacote' || r.u === 'duzia'; return false; })();
const mostraQ = p => p.qu && !ehUnidade(p);
const iconFor = q => { const n = norm(q); for (const [re, ic] of ICONS) if (re.test(n)) return ic; return '🛒'; };
const storeSvg = color => `<svg width="30" height="30" viewBox="0 0 30 30" style="overflow:visible"><circle cx="15" cy="15" r="13.5" fill="${color}" stroke="#fff" stroke-width="1.8"/>
<path d="M7 10.5 h16 l-1.5 4 H8.5z M8.5 14.5 v7 h13 v-7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><rect x="13" y="17.5" width="4" height="4" fill="#fff"/></svg>`;
// cores por nível de histórico (regra calculada em collector/build_index.py: FULL_MIN_SHARE=50%, FULL_MIN_YEARS=2)
const HIST_COLORS = {none: '#cf2b35', partial: '#f2c230', full: '#2f7cf6', rj: '#f28c28'};
// ===== MAPA: um único mapa MapLibre GL. Base (vetorial ou raster), máscara pontilhada fora do Brasil, sombra,
// contorno da busca e ícones das lojas são camadas do MESMO canvas WebGL — tudo se move junto, sem DOM sobre o mapa.
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BASEMAPS = {
  preto: {nome: 'Preto minimalista', thumb: 'assets/maps/preto.jpg'},
  cinza: {nome: 'Cinza escuro', thumb: 'assets/maps/cinza.jpg'},
  detalhado: {nome: 'Escuro detalhado', thumb: 'assets/maps/detalhado.jpg'},
};
const BASEMAP_PADRAO = 'detalhado';   // sempre abre em Escuro detalhado (OSM invertido); a troca vale só para esta visita
let baseKey = null;
// ---- rótulos (nomes de ruas / bairros) ----
const LBL = Object.assign({ruas: false, bairros: true},  // nomes de ruas ocultos por padrão
  JSON.parse(localStorage.getItem('rotulos') || '{}'));
const ML_LAYERS = {ruas: ['highway_name_other', 'highway_name_motorway', 'road_oneway', 'road_oneway_opposite'], bairros: ['place_suburb', 'place_other']};
// camadas vetoriais pesadas ou inúteis aqui (prédios, aeroportos, trilhos urbanos, gelo, nomes de países)
const PODA = /^(highway_major_inner|building|aeroway|road_area_pier|road_pier|railway_transit|railway_minor|landcover_ice|landcover_glacier|place_country)/;
const MASK_HI_ZOOM = 7;           // zoom MapLibre (= 8 no Leaflet): a partir daqui contorno IBGE em alta resolução
const MIN_ZOOM_LOJAS = 9;         // zoom MapLibre (= 10 no Leaflet)
const WORLD = [[-110, -65], [-5, -65], [-5, 30], [-110, 30], [-110, -65]];
const EMPTY = {type: 'FeatureCollection', features: []};
const DATA = {'br-lo': EMPTY, 'br-hi': EMPTY, 'mask-lo': EMPTY, 'mask-hi': EMPTY, lojas: EMPTY, busca: EMPTY};
const GEOC = {};
const getJ = u => GEOC[u] ||= fetch(u).then(r => r.json());
const feat_ = g => g.type === 'Feature' ? g : {type: 'Feature', properties: {}, geometry: g};
const maskOf = br => ({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [WORLD, ...(br.geometry || br).coordinates.map(p => p[0].slice().reverse())]}});
function setSrc(id, data) { DATA[id] = data; const s = map && map.getSource(id); if (s) s.setData(data); }
let OFM = null, BR_LO = null, FORCE = null;
const hiOk = () => DATA['br-hi'] !== EMPTY;
function ourLayers() {
  const hi = hiOk(), shadow = (src, minz, maxz) => [[3, 1.5, 0.42, 1.5], [9, 4.5, 0.22, 5], [20, 10, 0.12, 10]].map(([w, o, op, bl], i) => ({
    id: `sombra-${src}-${i}`, type: 'line', source: src, minzoom: minz, maxzoom: maxz,
    paint: {'line-color': '#000', 'line-width': w, 'line-offset': o, 'line-opacity': op, 'line-blur': bl}}));
  return [
    {id: 'busca-fill', type: 'fill', source: 'busca', paint: {'fill-color': '#2f7cf6', 'fill-opacity': 0.06}},
    {id: 'mask-lo', type: 'fill', source: 'mask-lo', maxzoom: hi ? MASK_HI_ZOOM : 24, paint: {'fill-pattern': 'pontilhado', 'fill-antialias': false}},
    {id: 'mask-hi', type: 'fill', source: 'mask-hi', minzoom: MASK_HI_ZOOM, paint: {'fill-pattern': 'pontilhado', 'fill-antialias': false}},
    ...shadow('br-lo', 0, hi ? MASK_HI_ZOOM : 24), ...shadow('br-hi', MASK_HI_ZOOM, 24),
    {id: 'contorno-lo', type: 'line', source: 'br-lo', maxzoom: MASK_HI_ZOOM, paint: {'line-color': '#2f7cf6', 'line-width': 1, 'line-opacity': 0.35}},
    {id: 'busca-glow', type: 'line', source: 'busca', paint: {'line-color': '#2f7cf6', 'line-width': 10, 'line-blur': 7, 'line-opacity': 0.55}},
    {id: 'busca-line', type: 'line', source: 'busca', paint: {'line-color': '#3b8cff', 'line-width': 2.5, 'line-opacity': 0.95}},
    {id: 'lojas', type: 'symbol', source: 'lojas', minzoom: MIN_ZOOM_LOJAS, layout: {'icon-image': ['get', 'k'], 'icon-allow-overlap': true, 'icon-ignore-placement': true},
      paint: {'icon-opacity': ['case', ['boolean', ['feature-state', 'anim'], false], 0, 1]}},
    {id: 'lojas-rede', type: 'symbol', source: 'lojas', maxzoom: MIN_ZOOM_LOJAS, filter: ['==', ['get', 'c'], FORCE || '-'],
      layout: {'icon-image': ['get', 'k'], 'icon-allow-overlap': true, 'icon-ignore-placement': true},
      paint: {'icon-opacity': ['case', ['boolean', ['feature-state', 'anim'], false], 0, 1]}},
  ];
}
function ourSources() {
  const o = {}; for (const [k, v] of Object.entries(DATA)) o[k] = {type: 'geojson', data: v, ...(k === 'lojas' ? {} : k === 'br-lo' ? {tolerance: 0.6, buffer: 256, maxzoom: 7} : k === 'mask-lo' ? {tolerance: 0.6, maxzoom: 7} : k === 'br-hi' ? {tolerance: 0.6, buffer: 256} : {tolerance: 0.6})};
  return o;
}
async function buildStyle(key) {
  let s;
  if (key === 'preto') {
    OFM ||= await fetch('https://tiles.openfreemap.org/styles/dark').then(r => r.json());
    s = structuredClone(OFM);
    s.layers = s.layers.filter(l => !PODA.test(l.id));
    const vis = {}; for (const [k, ids] of Object.entries(ML_LAYERS)) for (const id of ids) vis[id] = LBL[k] ? 'visible' : 'none';
    for (const l of s.layers) {
      if (l.id === 'highway_minor') l.minzoom = 13;          // ruas locais: só bem de perto (era o maior custo de desenho)
      if (l.id === 'highway_path') l.minzoom = 15;
      if (l.id === 'highway_major_casing') { delete l.paint['line-dasharray']; l.paint['line-color'] = '#2c2c2c'; l.paint['line-width'] = ['interpolate', ['exponential', 1.3], ['zoom'], 10, 1.6, 20, 20]; }
      if (l.id === 'highway_motorway_casing') delete l.paint['line-dasharray'];
      if (l.type !== 'symbol') continue;
      if (BR_LO) l.filter = l.filter ? ['all', l.filter, ['within', BR_LO]] : ['within', BR_LO];   // nenhum nome de país vizinho
      if (vis[l.id]) l.layout = {...l.layout, visibility: vis[l.id]};
      if (l.id === 'highway_name_other' || l.id === 'highway_name_motorway') l.paint = {...l.paint, 'text-color': '#f2c230', 'text-halo-width': 0};  // ruas em amarelo
    }
  } else {
    const esri = n => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_${n}/MapServer/tile/{z}/{y}/{x}`;
    s = {version: 8, sources: {}, layers: [{id: 'background', type: 'background', paint: {'background-color': '#1a1a1a'}}]};
    if (key === 'cinza') {
      s.sources.esri = {type: 'raster', tiles: [esri('Base')], tileSize: 256, maxzoom: 16, attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community'};
      s.sources.esriRef = {type: 'raster', tiles: [esri('Reference')], tileSize: 256, maxzoom: 16, attribution: 'Rótulos &copy; Esri'};
      s.layers.push({id: 'esri', type: 'raster', source: 'esri'},
        {id: 'esri-ref', type: 'raster', source: 'esriRef', minzoom: 5, layout: {visibility: LBL.ruas || LBL.bairros ? 'visible' : 'none'}});
    } else {
      s.sources.osm = {type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: OSM_ATTR};
      // "escuro" sem filtro CSS: inversão por brilho (min 0,9 → max 0) + giro de matiz no próprio shader raster
      s.layers.push({id: 'osm', type: 'raster', source: 'osm', paint: {'raster-brightness-min': 0.9, 'raster-brightness-max': 0, 'raster-hue-rotate': 180, 'raster-saturation': -0.3, 'raster-contrast': -0.1}});
    }
  }
  Object.assign(s.sources, ourSources());
  s.layers.push(...ourLayers());
  return s;
}
// imagens do mapa (ícones das lojas e padrão pontilhado) — 2x para telas retina
const IMG = {};
function svgImg(svg) { return new Promise(res => { const im = new Image(60, 60); im.onload = () => res(im); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('width="30" height="30"', 'width="60" height="60"')); }); }
const CLOSED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="-2 -2 34 34"><circle cx="15" cy="16" r="13.5" fill="#000" opacity=".45"/><circle cx="15" cy="15" r="13.5" fill="#6b6b6b" stroke="#ddd" stroke-width="1.8"/>
<path d="M7 10.5 h16 l-1.5 4 H8.5z M8.5 14.5 v7 h13 v-7" fill="none" stroke="#bbb" stroke-width="1.4"/><path d="M8 8 L22 22 M22 8 L8 22" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const glSvg = color => storeSvg(color).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace('viewBox="0 0 30 30" style="overflow:visible">', 'viewBox="-2 -2 34 34"><circle cx="15" cy="16" r="13.5" fill="#000" opacity=".45"/>');
const IMG_READY = Promise.all([...Object.entries(HIST_COLORS).map(async ([k, c]) => IMG['loja-' + k] = await svgImg(glSvg(c))), svgImg(CLOSED_SVG).then(im => IMG['loja-fechada'] = im)]).then(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 44; const g = cv.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 44, 44); g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.arc(22, 22, 2.8, 0, 7); g.fill();
  IMG.pontilhado = g.getImageData(0, 0, 44, 44);
});
function addImgs() { for (const [k, im] of Object.entries(IMG)) if (!map.hasImage(k)) map.addImage(k, im, {pixelRatio: 2}); }

let map = null;
async function setBasemap(key) {
  if (!BASEMAPS[key]) key = BASEMAP_PADRAO;
  let st;
  try { st = await buildStyle(key); } catch (e) { key = 'cinza'; st = await buildStyle(key); }   // OpenFreeMap fora do ar
  baseKey = key;
  if (!map) {
    map = new maplibregl.Map({container: 'map', style: st, bounds: [[-73.9, -33.8], [-34.8, 5.3]], fitBoundsOptions: {padding: 10},
      maxBounds: [[-82, -40], [-25, 12]], minZoom: 2.5, maxZoom: 18.5, renderWorldCopies: false, dragRotate: false, pitchWithRotate: false,
      attributionControl: false, pixelRatio: Math.min(devicePixelRatio || 1, 2), fadeDuration: 150});
    map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation();
    map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-right');
    map.on('styleimagemissing', e => { if (IMG[e.id] && !map.hasImage(e.id)) map.addImage(e.id, IMG[e.id], {pixelRatio: 2}); });
    map.on('style.load', addImgs);
    wireMap();
  } else map.setStyle(st, {diff: false});
  drawLabelUI();
  document.querySelectorAll('#bmenu .opt').forEach(o => o.classList.toggle('on', o.dataset.k === key));
}
function applyLabels() {
  localStorage.setItem('rotulos', JSON.stringify(LBL));
  if (!map || !map.isStyleLoaded()) return;
  if (baseKey === 'preto') { for (const [k, ids] of Object.entries(ML_LAYERS)) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', LBL[k] ? 'visible' : 'none'); }
  else if (baseKey === 'cinza' && map.getLayer('esri-ref')) map.setLayoutProperty('esri-ref', 'visibility', LBL.ruas || LBL.bairros ? 'visible' : 'none');
}
function drawLabelUI() {
  const btn = $('lbtn'), m = $('lmenu'); if (!btn) return;
  const dis = baseKey === 'detalhado', both = baseKey === 'cinza';
  btn.disabled = dis; btn.title = dis ? 'Indisponível neste estilo' : 'Mostrar/ocultar nomes';
  if (dis) m.hidden = true;
  m.innerHTML = `<label><input type="checkbox" data-k="ruas" ${LBL.ruas ? 'checked' : ''} ${both ? 'disabled' : ''}> Nomes de ruas</label>
    <label><input type="checkbox" data-k="bairros" ${LBL.bairros ? 'checked' : ''} ${both ? 'disabled' : ''}> Bairros</label>
    ${both ? `<label class="all"><input type="checkbox" data-k="todos" ${LBL.ruas || LBL.bairros ? 'checked' : ''}> Todos os nomes</label><div class="hint">Neste estilo ruas e bairros vêm juntos.</div>` : ''}`;
  m.querySelectorAll('input').forEach(i => i.onchange = () => {
    if (i.dataset.k === 'todos') LBL.ruas = LBL.bairros = i.checked; else LBL[i.dataset.k] = i.checked;
    applyLabels(); drawLabelUI();
  });
}
// contorno em alta resolução: baixado só quando o zoom chega perto do nível em que ele aparece
function loadHi() {
  if (loadHi.p || !map || map.getZoom() < MASK_HI_ZOOM - 1.5) return;
  loadHi.p = getJ('data/geo/gl-brasil-hi.json').then(g => {
    setSrc('br-hi', feat_(g)); setSrc('mask-hi', maskOf(g));
    for (const id of ['mask-lo', 'sombra-br-lo-0', 'sombra-br-lo-1', 'sombra-br-lo-2']) if (map.getLayer(id)) map.setLayerZoomRange(id, 0, MASK_HI_ZOOM);
  });
}
function wireMap() {
  const LAY = ['lojas', 'lojas-rede'];
  map.on('click', e => {
    $('bmenu').hidden = true; $('lmenu').hidden = true;
    const r = 8, f = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], {layers: LAY.filter(l => map.getLayer(l))});
    if (f.length) { const it = ALL[f[0].properties.i]; if (it) { audioInit(); it.open(); return; } }
    closeAll();
  });
  const tip = new maplibregl.Popup({closeButton: false, closeOnClick: false, offset: 16, className: 'tip'});
  for (const l of LAY) {
    map.on('mouseenter', l, e => { map.getCanvas().style.cursor = 'pointer'; const it = ALL[e.features[0].properties.i]; if (it && it.tip) tip.setLngLat([it.lon, it.lat]).setText(it.tip).addTo(map); });
    map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; tip.remove(); });
  }
  map.on('moveend', refreshMarkers);
  map.on('zoom', () => { if (ALL.length) $('zhint').hidden = map.getZoom() >= MIN_ZOOM_LOJAS || !!FORCE; });
  map.on('moveend', loadHi);
  }
// mask-lo vem pronta em pedaços sem furos (tools/build_gl_geo.py): o polígono "mundo com o Brasil como furo", recortado
// nos tiles de baixo zoom, gerava uma cunha escura atravessando o Norte (Roraima → Macapá).
Promise.all([getJ('data/geo/gl-brasil-lo.json'), getJ('data/geo/gl-mascara-lo.json'), IMG_READY]).then(([lo, mlo]) => {
  BR_LO = lo; DATA['br-lo'] = feat_(lo); DATA['mask-lo'] = mlo;
  return (localStorage.removeItem('mapa'), setBasemap(BASEMAP_PADRAO));
}).then(() => { init(); loadHi(); });
$('bmenu').innerHTML = Object.entries(BASEMAPS).map(([k, b]) => `<button class="opt" data-k="${k}"><img src="${b.thumb}" alt="" loading="lazy"><span>${b.nome}</span></button>`).join('');
$('bmenu').querySelectorAll('.opt').forEach(o => o.onclick = () => { setBasemap(o.dataset.k); $('bmenu').hidden = true; });
$('bbtn').onclick = e => { e.stopPropagation(); $('lmenu').hidden = true; $('bmenu').hidden = !$('bmenu').hidden; };
$('lbtn').onclick = e => { e.stopPropagation(); $('bmenu').hidden = true; $('lmenu').hidden = !$('lmenu').hidden; };

let CH = {}, cache = {}, cur = null;

// ---- lojas: camada de símbolos WebGL (ícones aparecem com zoom >= MIN_ZOOM_LOJAS; rede escolhida na busca aparece sempre) ----
const ALL = [];   // {lat, lon, cid, open(), tip}
const STORES = [];
const padB = (b, f) => { const dx = (b.getEast() - b.getWest()) * f, dy = (b.getNorth() - b.getSouth()) * f;
  return {w: b.getWest() - dx, e: b.getEast() + dx, s: b.getSouth() - dy, n: b.getNorth() + dy}; };
let refreshT = 0, PREV = new Set();
function setForce(cid) { FORCE = cid; if (map.getLayer('lojas-rede')) map.setFilter('lojas-rede', ['==', ['get', 'c'], FORCE || '-']); }
function refreshMarkers() {
  clearTimeout(refreshT);
  refreshT = setTimeout(() => {
    const z = map.getZoom(), show = z >= MIN_ZOOM_LOJAS;
    $('zhint').hidden = show || !!FORCE || !ALL.length;
    const b = padB(map.getBounds(), 0.15), vis = new Set(), novos = [];
    ALL.forEach((it, i) => {
      if ((show || (FORCE && it.cid === FORCE)) && it.lon >= b.w && it.lon <= b.e && it.lat >= b.s && it.lat <= b.n) { vis.add(i); if (!PREV.has(i)) novos.push(it); }
    });
    PREV = vis; sproutNew(novos);
  }, 150);
}
async function init() {
  const [chains, stores] = await Promise.all([fetch('data/chains.json').then(r => r.json()), fetch('data/stores.json').then(r => r.json())]);
  chains.forEach(c => CH[c.id] = c);
  let n = 0;
  for (const s of stores) {
    const c = CH[s.c]; if (!c || !c.n) continue; n++;
    STORES.push(s); s._k = norm(`${c.name} ${s.n || ''} ${s.a || ''} ${s.ci || ''} ${s.uf || ''}`);
    ALL.push({lat: s.lat, lon: s.lon, cid: s.c, k: 'loja-' + (HIST_COLORS[c.hist_level] ? c.hist_level : 'none'), s, open: () => openStore(s)});
  }
  const ok = chains.filter(c => c.n);
  $('stats').textContent = `${n} lojas · ${ok.length} redes · ${ok.reduce((a, c) => a + c.n, 0).toLocaleString('pt-BR')} produtos`;
  const [closed, rj] = await Promise.all(['data/closed.json', 'data/rj.json'].map(u => fetch(u).then(r => r.ok ? r.json() : []).catch(() => [])));
  for (const c of closed) ALL.push({lat: c.lat, lon: c.lon, k: 'loja-fechada', tip: c.ano ? `Fechado em ${c.ano}` : 'Fechado (ano não informado)', open: () => openClosed(c)});
  for (const c of rj) ALL.push({lat: c.lat, lon: c.lon, k: 'loja-rj', tip: `${c.rede} — em recuperação judicial`, open: () => openRJ(c)});
  setSrc('lojas', {type: 'FeatureCollection', features: ALL.map((it, i) => ({type: 'Feature', id: i, properties: {i, k: it.k, c: it.cid || ''}, geometry: {type: 'Point', coordinates: [it.lon, it.lat]}}))});
  refreshMarkers();
}

// item pesado na loja (EAN de peso variável 2xxxxxxxxxxxx ou URL terminada em -kg): o preço do site é por kg
const pesado = p => (/(^|-)kg$/.test(p.s || '') || /^2\d{12}$/.test(p.e || '')) ? {q: 1, u: 'kg', pes: 1} : null;
async function loadChain(id) {
  if (!cache[id]) cache[id] = fetch(`data/chains/${id}.json`).then(r => r.json()).then(d => {
    d.list = Object.entries(d.p).map(([id, p]) => {
      const h = (p.h || []).slice().sort((a, b) => a[0] < b[0] ? -1 : 1);
      const last = h[h.length - 1];
      return {id, ...p, h, last, qu: qtyOf(p.n) || pesado(p), nn: norm(p.n + ' ' + (p.b || ''))};
    }).filter(p => p.last);
    return d;
  });
  return cache[id];
}

// uma janela de loja por vez: abrir qualquer loja fecha as anteriores; Esc ou clique no mapa vazio fecham
function closeAll() { if (typeof acClose === 'function' && acState) acClose(); $('panel').classList.add('hidden'); $('closed').classList.add('hidden'); cur = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.activeElement !== $('gq')) closeAll(); });
function openStore(s) {
  closeAll();
  const c = CH[s.c]; cur = s;
  $('panel').classList.remove('hidden');
  $('pt').textContent = `${c.name}`;
  $('ps').innerHTML = `${esc(s.n)}${s.a ? ' · ' + esc(s.a) : (s.ci ? ' · ' + esc(s.ci) + (s.uf ? '/' + s.uf : '') : '')}
    ${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">Ver no site da loja</a>` : ''}<br>
    Preços do site <a href="${c.site}" target="_blank" rel="noopener">${esc(c.site.replace('https://', ''))}</a> · atualizado em ${fmtDate(c.updated)}
    ${c.oldest ? ' · histórico desde ' + fmtDate(c.oldest) : ''}`;
  $('q').value = ''; $('pq').value = ''; MAIN = []; $('results').innerHTML = '';
  $('q').focus();
  loadChain(s.c).then(d => (window.requestIdleCallback || setTimeout)(() => acVocab(s.c, d)));  // pré-carrega catálogo e vocabulário do autocompletar
}
function openClosed(c) {
  closeAll();
  const f = c.foto;
  $('cphoto').innerHTML = f ? `<img src="${esc(f.url)}" alt="Foto do local">
    <div class="cred">${f.data ? 'Foto de ' + esc(f.data) + ' · ' : ''}${f.aviso ? esc(f.aviso) + ' · ' : ''}<a href="${esc(f.link || f.url)}" target="_blank" rel="noopener">${esc(f.credito)}</a></div>`
    : `<div class="ph">Sem foto disponível</div><div class="cred">Nenhuma foto de uso livre encontrada perto do local.</div>`;
  const host = u => { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return 'link'; } };
  $('cinfo').innerHTML = `<h3>${c.ano ? 'Fechado em ' + c.ano : 'Fechado'}</h3><div class="nm">${esc(c.n)}</div>
    <div class="loc">${esc(c.ci || '')}${c.uf ? ' - ' + c.uf : ''}</div>
    <div class="mot"><b>Motivo:</b> ${c.motivo ? esc(c.motivo) : 'Motivo não informado'}</div>
    ${c.nota ? `<div class="nota">${esc(c.nota)}</div>` : ''}
    <div class="fontes">Fonte: ${c.fontes.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('')}</div>`;
  $('closed').classList.remove('hidden');
}
function photoBox(f) {
  return f ? `<img src="${esc(f.url)}" alt="Foto do local">
    <div class="cred">${f.data ? 'Foto de ' + esc(f.data) + ' · ' : ''}${f.aviso ? esc(f.aviso) + ' · ' : ''}<a href="${esc(f.link || f.url)}" target="_blank" rel="noopener">${esc(f.credito)}</a></div>`
    : `<div class="ph">Sem foto disponível</div><div class="cred">Nenhuma foto de uso livre encontrada perto do local.</div>`;
}
const hostOf = u => { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return 'link'; } };
function openRJ(c) {
  closeAll();
  $('cphoto').innerHTML = photoBox(c.foto);
  $('cinfo').innerHTML = `<h3 style="color:#f2a050">Em recuperação judicial</h3><div class="nm">${esc(c.rede)} — ${esc(c.n)}</div>
    <div class="loc">${esc(c.ci || '')}${c.uf ? ' - ' + c.uf : ''} · pedido em ${c.ano}</div>
    <div class="mot"><b>Valor da dívida:</b> ${esc(c.valor || 'Valor não divulgado')}</div>
    <div class="mot"><b>Credores:</b> ${esc(c.credores || 'Não informado')}</div>
    <div class="mot"><b>Motivo:</b> ${esc(c.motivo || 'Motivo não informado')}</div>
    <div class="nota"><b>Situação do processo:</b> ${esc(c.status || 'Não informada')}</div>
    <div class="fontes">Fonte: ${c.fontes.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(hostOf(u))}</a>`).join('')}</div>`;
  $('closed').classList.remove('hidden');
}
$('cclose').onclick = () => $('closed').classList.add('hidden');
$('pclose').onclick = () => $('panel').classList.add('hidden');

// ---- tamanho da embalagem digitado na busca de produto (#pq) ----
// Peso (g/kg) só casa produtos com PESO no nome (qtyOf → kg); volume (ml/L) só os com VOLUME (qtyOf → L). 1 kg = 1000 g, 1 L = 1000 ml.
// Margem de ±10% do valor digitado (500 ml pega a lata de 473 ml; 350 ml pega 315–385 ml); o tamanho mais próximo vem primeiro.
// Multipacks usam o tamanho total (o mesmo do preço por kg/L). Itens pesados na hora (preço do site já é por kg) ficam de fora.
const fmtTam = (v, m) => { const big = v >= 1000, n = big ? (v / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 3}) : v;
  return `${n} ${m === 'ml' ? (big ? 'L' : 'ml') : (big ? 'kg' : 'g')}`; };
const tamDe = (p, f) => p.qu && !p.qu.pes && p.qu.u === (f.m === 'ml' ? 'L' : 'kg') ? p.qu.q * 1000 : null;
const casaTam = (p, f) => { const t = tamDe(p, f); return t != null && Math.abs(t - f.v) <= f.v * 0.10 + 1e-6; };
const ordemTam = f => (a, b) => Math.abs(tamDe(a, f) - f.v) - Math.abs(tamDe(b, f) - f.v) || a.last[1] - b.last[1];

// tamanho digitado na busca de produto (só no campo de baixo): "500g", "1,5 kg", "473ml", "2 litros", "900 gramas", "1 quilo"…
// O tamanho sai das palavras e vira filtro (±10%, mais próximo primeiro).
const NUM_PAL = {um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, meio: 0.5, meia: 0.5};
const UN_GR = 'kg|kgs|quilogramas?|kilogramas?|quilos?|kilos?|g|gr|grs|gramas?|mililitros?|ml|l|lt|lts|litros?';
const TAM_TXT = new RegExp(`(?:^|\\s)(\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?|${Object.keys(NUM_PAL).join('|')})\\s?(${UN_GR})(\\s+e\\s+meio)?(?=\\s|$)`);
function tamNoTexto(txt) {
  const n = norm(txt).replace(/\s+/g, ' ').trim(), m = n.match(TAM_TXT); if (!m) return {resto: n, f: null};
  const u = m[2], vol = /^(mililitros?|ml|l|lt|lts|litros?)$/.test(u), mil = /^(kg|kgs|quilogramas?|kilogramas?|quilos?|kilos?|l|lt|lts|litros?)$/.test(u);
  let x = m[1] in NUM_PAL ? NUM_PAL[m[1]] : /^\d{1,3}(\.\d{3})+$/.test(m[1]) && !mil ? +m[1].replace(/\./g, '') : parseFloat(m[1].replace(',', '.'));  // "1.000 g" = 1000 g
  if (m[3]) x += 0.5;  // "um quilo e meio"
  const v = Math.round(mil ? x * 1000 : x);
  return {resto: (n.slice(0, m.index) + ' ' + n.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(), f: v > 0 ? {v, m: vol ? 'ml' : 'g'} : null};
}
let MAIN = [], renderT = null;
const agenda = (ms = 250) => { clearTimeout(renderT); renderT = setTimeout(render, ms); };
async function render() {
  clearTimeout(renderT);
  if (!cur) return;
  const R = $('results'), pt = tamNoTexto($('pq').value), toks = pt.resto.split(/\s+/).filter(Boolean);
  const busca = toks.length || pt.f;
  if (!MAIN.length && !busca) { R.innerHTML = ''; return; }
  if (!cache[cur.c]) R.innerHTML = '<div class="msg">Carregando catálogo…</div>';
  const myCur = cur, d = await loadChain(cur.c);
  if (myCur !== cur) return;
  R.innerHTML = '';
  const nome = CH[cur.c].name;
  if (busca) return produtos(R, d, pt.f ? d.list.filter(p => casaTam(p, pt.f)) : d.list, toks, pt.f, nome);
  for (const q of MAIN) {
    const {hits, core, basic} = searchTerm(d.list, q);
    if (!hits.length) { const box = document.createElement('div'); box.className = 'term'; R.appendChild(box); box.innerHTML = `<div class="msg">Nenhum produto encontrado para “${esc(q)}” em ${esc(nome)}.</div>`; continue; }
    // cortes de carne com o mesmo nome (picanha bovina × suína × cordeiro): um cartão e uma média por espécie
    const grupos = basic || ESPECIE.some(([, re]) => re.test(norm(q))) ? null : porEspecie(core);
    if (!grupos) { termCard(R, q, q, hits, core, basic, nome); continue; }
    for (const [rot, g] of grupos) termCard(R, q, `${q} ${rot}`, g.slice().sort((x, y) => x.last[1] - y.last[1]), g, null, nome);
    const rest = hits.filter(p => !core.includes(p));
    if (rest.length) termCard(R, q, `outros com “${q}” no nome`, rest, rest, null, nome, true);
  }
}
// busca de produto/marca: todas as palavras (sem acento, por pedaço) no nome ou na marca; dentro dos cartões da busca principal, se houver
function produtos(R, d, lista, toks, f, nome) {
  let base = lista, onde = `em ${nome}`;
  if (MAIN.length) { const S = new Set(); for (const q of MAIN) for (const p of searchTerm(lista, q).hits) S.add(p); base = [...S]; onde = `nos resultados de “${MAIN.join(' + ')}”`; }
  // sem palavras (só "500ml"): lista tudo desse tamanho
  const hits = base.filter(p => toks.every(t => p.nn.includes(t))).sort(f ? ordemTam(f) : (a, b) => a.last[1] - b.last[1]);
  const head = document.createElement('div'); head.className = 'fnote'; R.appendChild(head);
  const oq = toks.length ? ` com “${toks.join(' ')}”` : '', tam = f ? ` · ~${fmtTam(f.v, f.m)} (±10%)` : '';
  head.textContent = hits.length ? `${hits.length} produto${hits.length > 1 ? 's' : ''}${oq} ${onde}${tam}` : `Nenhum produto${oq} ${onde}${tam}.`;
  if (!hits.length) return;
  const list = document.createElement('div'); list.className = 'list'; R.appendChild(list); let shown = 0;
  const more = () => {
    list.querySelector('.more')?.remove();
    for (const p of hits.slice(shown, shown + 60)) list.appendChild(rowEl(p));
    shown += 60;
    if (shown < hits.length) { const b = document.createElement('button'); b.className = 'more'; b.textContent = `Mostrar mais (${hits.length - shown})`; b.onclick = more; list.appendChild(b); }
  };
  more();
}
$('sform').onsubmit = e => { e.preventDefault(); MAIN = $('q').value.split('+').map(t => t.trim()).filter(Boolean); render(); };
$('q').addEventListener('input', () => { if (!$('q').value.trim() && MAIN.length) { MAIN = []; agenda(0); } });
$('pform').onsubmit = e => { e.preventDefault(); render(); };
$('pq').addEventListener('input', () => agenda());


const ESPECIE = [['bovina', /\b(bovin[ao]s?|boi|novilh[ao]|angus|wagyu|hereford|vitela|vaca)\b/], ['suína', /\b(suin[ao]s?|porco|leitao|pernil)\b/],
  ['de cordeiro', /\b(cordeiro|ovin[ao]s?|carneiro|borrego)\b/], ['de frango', /\b(frango|galinha|galeto)\b/], ['de peru', /\bperu\b/],
  ['de peixe', /\b(peixe|salmao|tilapia|atum|bacalhau)\b/]];
function porEspecie(core) {
  const G = new Map();
  for (const p of core) { const n = norm(p.n) + ' ' + norm(p.c || ''); const e = ESPECIE.find(([, re]) => re.test(n)); const k = e ? e[0] : '(espécie não informada)'; if (!G.has(k)) G.set(k, []); G.get(k).push(p); }
  const comEsp = [...G.keys()].filter(k => k[0] !== '(');
  if (comEsp.length < 2) return null;
  return [...G.entries()].sort((a, b) => (a[0][0] === '(') - (b[0][0] === '(') || b[1].length - a[1].length);
}
function termCard(R, q, titulo, hits, core, basic, nome, semMedia) {
  const box = document.createElement('div'); box.className = 'term'; R.appendChild(box);
  const st = termStats(basic && basic.list ? basic.list : core, q);
  const un = ROT_UN[st.unit] || st.unit, porUn = ['un', 'duzia', 'pacote'].includes(st.unit);
  // número grande = mediana ("preço típico"); média aparada (robust(): tira os fora de 1,5×IQR) no texto
  const avgTxt = semMedia ? '' : `${BRL(st.med)}/${un}`;
  const avgSub = semMedia ? 'itens variados — sem média' : `Preço típico do ${esc(nome)} · média ${BRL(st.mean)}/${un} (${st.kept} de ${st.n} produtos${st.semPeso ? ', sem peso/volume no nome' : ''})${basic ? (basic.none ? `<br>sem ${esc(basic.rot)} com preço nesta loja — média de todos os itens` : `<br>referência: ${esc(basic.rot)}`) : ''}`;
  box.innerHTML = `<div class="card"><div class="ico" style="font-size:34px">${iconFor(q)}</div>
    <div><div class="t">${esc(titulo)}</div><div class="sub">${hits.length} produto${hits.length > 1 ? 's' : ''} à venda em ${esc(nome)}${core.length < hits.length ? ` (${core.length} principais)` : ''} · clique para ver</div></div>
    <div class="avg"><b>${avgTxt}</b><div>${avgSub}</div></div></div><div class="list" hidden></div>`;
  const list = box.querySelector('.list'); let shown = 0;
  const more = () => {
    list.querySelector('.more')?.remove();
    for (const p of hits.slice(shown, shown + 60)) list.appendChild(rowEl(p));
    shown += 60;
    if (shown < hits.length) { const b = document.createElement('button'); b.className = 'more'; b.textContent = `Mostrar mais (${hits.length - shown})`; b.onclick = more; list.appendChild(b); }
  };
  box.querySelector('.card').onclick = () => { list.hidden = !list.hidden; if (!shown) more(); };
}

const SRC = {v: 'site da rede', w: 'Wayback Machine', a: 'Arquivo.pt', c: 'Common Crawl', t: 'archive.today'};
function srcLink(s, ref) {
  if (!ref || s === 'v') return SRC[s] || s;
  const r = ref.split('|')[0];
  const url = s === 'w' ? `https://web.archive.org/web/${r}` : s === 'a' ? `https://arquivo.pt/wayback/${r}` : s === 't' ? `https://archive.ph/${r}`
    : `https://index.commoncrawl.org/`;
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${SRC[s] || s}</a>`;
}
function img(p) { return p.i ? `<img loading="lazy" src="${esc(p.i.replace('/arquivos/ids/', '/arquivos/ids/').replace(/(ids\/\d+)(-\d+-\d+)?/, '$1-96-96'))}" alt="" onerror="this.outerHTML='<div class=noimg></div>'">` : '<div class="noimg"></div>'; }
function rowEl(p) {
  const el = document.createElement('div');
  const [d0, v, src] = p.last;
  const d = (!p.arch && src === 'v') ? (p.x || CH[cur.c].updated || d0) : d0; // data em que esse preço foi visto por último
  el.innerHTML = `<div class="row">${img(p)}<div class="nm">${esc(p.n)}<small>${esc(sizeOf(p.n))}${p.b ? ' · marca ' + esc(p.b) : ''}${p.arch ? ' · só no arquivo histórico' : ''}${p.ok === false ? ' · indisponível' : ''}</small></div>
    <div class="yr">${d.slice(0, 4)}<small>${fmtDate(d)}</small></div><div class="pr">${BRL(v)}<small class="meta">${mostraQ(p) ? BRL(perUnit(p, v)) + '/' + p.qu.u + ' · ' : ''}${p.h.length > 1 ? p.h.length + ' registros ▾' : '1 registro ▾'}</small></div></div>`;
  el.firstChild.onclick = () => {
    const open = el.querySelector('.hist');
    if (open) { open.remove(); return; }
    const h = document.createElement('div'); h.className = 'hist';
    h.innerHTML = p.h.map(([d, v, s, ref]) => `<div class="row">${img(p)}<div class="nm">${esc(p.n)}<small>${esc(sizeOf(p.n))} · <span class="src">${srcLink(s, ref)}</span></small></div>
      <div class="yr">${d.slice(0, 4)}<small>${fmtDate(d)}</small></div><div class="pr">${BRL(v)}${mostraQ(p) ? `<small class="meta">${BRL(perUnit(p, v))}/${p.qu.u}</small>` : ''}</div></div>`).join('');
    const tx = document.createElement('div'); tx.className = 'tax'; tx.textContent = 'Tributos aproximados…';
    h.appendChild(tx); el.appendChild(h);
    taxBox(p, v, cur && cur.uf).then(html => tx.innerHTML = html);
    h.querySelectorAll('.pr').forEach((pr, i) => semImp(pr, p, p.h[i][1]));
  };
  semImp(el.querySelector('.pr'), p, v);
  return el;
}
// ---- tributos aproximados (Lei 12.741/2012, tabela oficial IBPT por NCM e UF da loja) ----
const IBPT = {};
let NCMR = null;
const ncmRules = () => NCMR ||= fetch('data/ncm_regras.json').then(r => r.json()).then(d => ({...d, regras: d.regras.map(x => ({...x, rx: new RegExp(x.re)}))}));
// alíquota aproximada total (%) do produto na UF: {tot, fed, es, mun, ncm, est, T} ou null
let NCME = null;  // NCM exato por EAN (coletores Cosmos/OSCBR): data/ncm_ean.json = {ean: [ncm, fonte, data]}
async function ncmExato(p) {
  if (p.ncm || !p.e) return;
  const m = (await (NCME ||= fetch('data/ncm_ean.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))))[p.e];
  if (m) { p.ncm = m[0]; p.ncm_src = m[1]; }
}
async function taxInfo(p, uf) {
  if (!uf) return null;
  await ncmExato(p);
  let ncm = p.ncm && String(p.ncm).replace(/\D/g, ''), est = null;
  if (!ncm || ncm.length !== 8) {
    ncm = null;
    try { const R = await ncmRules(), t = norm(p.n) + ' | ' + norm(p.c || ''); est = R.regras.find(r => r.rx.test(t)); if (est) ncm = est.ncm; } catch (e) {}
    if (!ncm) return null;
  }
  let T; try { T = await (IBPT[uf] ||= fetch(`data/ibpt/${uf}.json`).then(r => r.json())); } catch (e) { return null; }
  const a = T.t[ncm]; if (!a) return null;
  return {fed: a[0], es: a[2], mun: a[3], tot: a[0] + a[2] + a[3], ncm, est, T};
}
// linha "sem impostos" sob o preço verde (omitida quando o imposto não está disponível)
function semImp(el, p, price) {
  taxInfo(p, cur && cur.uf).then(ti => {
    if (!ti) return;
    const d = document.createElement('small'); d.className = 'semimp';
    d.textContent = `sem impostos ${ti.est ? '~' : ''}${BRL(price * (1 - ti.tot / 100))}`;
    d.title = ti.est ? 'estimativa pela categoria (IBPT)' : 'tributos aproximados pelo NCM do produto (IBPT)';
    const m = el.querySelector('.meta'); m ? el.insertBefore(d, m) : el.appendChild(d); // "sem impostos" acima da linha kg · registros
  });
}
async function taxBox(p, price, uf) {
  await ncmExato(p);
  const na = '<div class="tt">Tributos</div><div class="tn">Imposto não disponível <small>(sem NCM do produto e sem categoria reconhecida)</small></div>';
  if (!uf) return na;
  let ncm = p.ncm && String(p.ncm).replace(/\D/g, ''), est = null, fonte = p.ncm_src || 'site da rede';
  if (!ncm || ncm.length !== 8) {
    ncm = null;
    try { const R = await ncmRules(), t = norm(p.n) + ' | ' + norm(p.c || ''); est = R.regras.find(r => r.rx.test(t)); if (est) ncm = est.ncm; } catch (e) {}
    if (!ncm) return na;
  }
  let T; try { T = await (IBPT[uf] ||= fetch(`data/ibpt/${uf}.json`).then(r => r.json())); } catch (e) { return na; }
  const a = T.t[ncm]; if (!a) return na;
  const [fed, , es, mun] = a, tot = fed + es + mun, R = x => BRL(price * x / 100), P = x => x.toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%';
  const titulo = est ? `Tributos estimados pela categoria (aproximado): <b>${R(tot)}</b>` : `Tributos aproximados (NCM do produto, fonte: ${esc(fonte)}): <b>${R(tot)}</b>`;
  const ncmTxt = est ? `NCM provável ${ncm.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')} — ${esc(est.d)}` : `NCM ${ncm.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}`;
  return `<div class="tt">${titulo} <small>(${P(tot)} do preço)</small></div>
    <div class="tb"><span>Federal <b>${R(fed)}</b> <small>${P(fed)}</small></span><span>Estadual (${uf}) <b>${R(es)}</b> <small>${P(es)}</small></span><span>Municipal <b>${R(mun)}</b> <small>${P(mun)}</small></span></div>
    <div class="tf">${ncmTxt}. Alíquotas: IBPT — De Olho no Imposto, tabela ${esc(T.versao)} (vigência ${esc(T.vigencia[0])} a ${esc(T.vigencia[1])}), federal para produto nacional.${est ? ' Estimativa: o NCM foi deduzido do nome/categoria, não informado pelo site.' : ''}</div>`;
}

// ---- busca de cidades/estados (dados IBGE embutidos) ----
let LUG = null, sugs = [], sel = -1;
const lugares = () => LUG ||= fetch('data/lugares.json').then(r => r.json()).then(d => [
  ...d.estados.map(([n, uf, la, lo, bb]) => ({n, uf, la, lo, bb, t: 'Estado', k: norm(n), ku: uf.toLowerCase()})),
  ...d.municipios.map(([n, uf, la, lo, cap, cod]) => ({n, uf, la, lo, cap, cod, t: cap ? 'Capital' : 'Cidade', k: norm(n)}))]);
async function suggest(q) {
  const L_ = await lugares(); let qn = norm(q).trim(); if (!qn) return [];
  let uf = null; const m = qn.match(/^(.*?)[\s,\/-]+([a-z]{2})$/); if (m) { qn = m[1].trim(); uf = m[2].toUpperCase(); }
  const score = x => (x.k === qn || x.ku === qn ? 0 : x.k.startsWith(qn) ? 1 : 2) * 10 + (x.t === 'Estado' ? 0 : x.cap ? 1 : 2);
  const lug = L_.filter(x => (!uf || x.uf === uf) && (x.k.includes(qn) || x.ku === qn)).sort((a, b) => score(a) - score(b) || a.k.length - b.k.length);
  // mercados: redes e lojas (sem acento; todas as palavras precisam aparecer)
  const tk = qn.split(/\s+/).filter(Boolean);
  const redes = Object.values(CH).filter(c => c.n && STORES.some(s => s.c === c.id) && tk.every(t => norm(c.name).includes(t)))
    .map(c => ({t: 'Rede', n: c.name, cid: c.id, cnt: STORES.filter(s => s.c === c.id).length}));
  const lojas = STORES.filter(s => (!uf || s.uf === uf) && tk.every(t => s._k.includes(t)))
    .sort((a, b) => (norm(a.n).startsWith(qn) ? 0 : 1) - (norm(b.n).startsWith(qn) ? 0 : 1)).slice(0, 5)
    .map(st => ({t: 'Loja', n: `${CH[st.c].name} — ${st.n && norm(st.n) !== norm(CH[st.c].name) ? st.n : (st.a || st.ci || st.n)}`, st, uf: st.uf}));
  const nl = redes.length || lojas.length ? 4 : 8;
  return [...redes.slice(0, 2), ...lug.slice(0, nl), ...lojas].slice(0, 10);
}
// ---- contorno do lugar + animação de "brotar" das lojas ----
const GEO = {};
const geoFile = f => GEO[f] ||= fetch(`data/geo/${f}.json`).then(r => r.json());
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function inRing(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
  const [xi, yi] = ring[i], [xj, yj] = ring[j];
  if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; }
function inGeom(pt, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some(p => inRing(pt, p[0]) && !p.slice(1).some(h => inRing(pt, h)));
}
// ---- som de "bolha" (Web Audio; só toca após gesto do usuário) ----
const SND = {ctx: null, buf: null, muted: localStorage.getItem('mudo') === '1', last: 0, burst: 0};
async function audioInit() {  // chamado dentro do gesto (Enter / clique)
  if (SND.muted) return;
  try {
    SND.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (SND.ctx.state === 'suspended') await SND.ctx.resume();
    SND.buf ||= await fetch('assets/sounds/bubble-pop-04.mp3').then(r => r.arrayBuffer()).then(b => SND.ctx.decodeAudioData(b));
  } catch (e) {}
}
function pop() {
  if (SND.muted || !SND.ctx || !SND.buf || SND.burst >= 8) return;
  const now = performance.now(); if (now - SND.last < 40) return;
  SND.last = now; SND.burst++;
  const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
  src.buffer = SND.buf; src.playbackRate.value = 0.9 + Math.random() * 0.25; g.gain.value = 0.35;
  src.connect(g).connect(SND.ctx.destination); src.start();
}
const muteBtn = $('mute');
const SPK = '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>';
const ICON_ON = `<svg width="20" height="20" viewBox="0 0 24 24">${SPK}<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_OFF = `<svg width="20" height="20" viewBox="0 0 24 24">${SPK}<path d="M16 10l4 4M20 10l-4 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const drawMute = () => { muteBtn.innerHTML = SND.muted ? ICON_OFF : ICON_ON; muteBtn.title = SND.muted ? 'Ativar som' : 'Silenciar'; };
muteBtn.onclick = () => { SND.muted = !SND.muted; localStorage.setItem('mudo', SND.muted ? '1' : '0'); drawMute(); if (!SND.muted) audioInit(); };
drawMute();
// legenda (ajuda "?")
$('help').onclick = e => { e.stopPropagation(); $('legend').hidden = !$('legend').hidden; };
document.addEventListener('click', e => { if (!$('legend').hidden && !$('legend').contains(e.target) && e.target !== $('help')) $('legend').hidden = true; });
function sproutNew(list) {
  if (!list.length) return;
  SND.burst = 0;
  const c = map.getCenter();
  list.sort((p, q) => ((p.lat - c.lat) ** 2 + (p.lon - c.lng) ** 2) - ((q.lat - c.lat) ** 2 + (q.lon - c.lng) ** 2));
  if (reduceMotion) return;
  // "brotar": só os ícones novos ganham um elemento DOM temporário animado (no máx. 40); o ícone WebGL fica oculto até o fim
  list.slice(0, 40).forEach((it, i) => {
    const idx = ALL.indexOf(it), delay = Math.min(i * 35, 600);
    const el = document.createElement('div'); el.className = 'storeicon sprout'; el.style.setProperty('--d', `${delay}ms`);
    el.innerHTML = it.k === 'loja-fechada' ? CLOSED_SVG : storeSvg(HIST_COLORS[it.k.slice(5)] || HIST_COLORS.none);
    const mk = new maplibregl.Marker({element: el}).setLngLat([it.lon, it.lat]).addTo(map);
    map.setFeatureState({source: 'lojas', id: idx}, {anim: true});
    setTimeout(() => { mk.remove(); if (map.getSource('lojas')) map.setFeatureState({source: 'lojas', id: idx}, {anim: false}); }, delay + 1000);
    if (i < 8) setTimeout(pop, delay + 60);       // som: no máx. 8 por leva (pop() também limita a 1 a cada 40 ms)
  });
}
const bboxOf = g => { let w = 180, s = 90, e = -180, n = -90;
  const walk = a => typeof a[0] === 'number' ? (w = Math.min(w, a[0]), e = Math.max(e, a[0]), s = Math.min(s, a[1]), n = Math.max(n, a[1])) : a.forEach(walk);
  walk(g.geometry ? g.geometry.coordinates : g.coordinates); return [[w, s], [e, n]]; };
const DUR = () => reduceMotion ? 0 : 1300;
async function go(x) {
  audioInit();
  setForce(null);
  if (x.t === 'Rede' || x.t === 'Loja') {
    $('gsug').hidden = true; $('gq').value = x.n;
    setSrc('busca', EMPTY);
    if (x.t === 'Rede') {
      setForce(x.cid);
      const pts = STORES.filter(s => s.c === x.cid);
      map.once('moveend', () => { collapseGeo(); refreshMarkers(); });
      if (pts.length === 1) map.flyTo({center: [pts[0].lon, pts[0].lat], zoom: 13, duration: DUR()});
      else map.fitBounds(bboxOf({coordinates: pts.map(s => [s.lon, s.lat])}), {padding: 50, maxZoom: 13, duration: DUR()});
    } else {
      const st = x.st;
      map.once('moveend', () => { collapseGeo(); refreshMarkers(); setTimeout(() => openStore(st), 250); });
      map.flyTo({center: [st.lon, st.lat], zoom: Math.max(map.getZoom(), 15), duration: DUR()});
    }
    return;
  }
  $('gsug').hidden = true; $('gq').value = x.t === 'Estado' ? x.n : `${x.n} - ${x.uf}`;
  let feat = null;
  try {
    if (x.t === 'Estado') feat = (await geoFile('estados')).features.find(f => f.properties.uf === x.uf);
    else feat = (await geoFile('mun-' + x.uf)).features.find(f => String(f.properties.id) === String(x.cod));
  } catch (e) {}
  setSrc('busca', feat || EMPTY);
  const bounds = feat ? bboxOf(feat) : x.bb ? [[x.bb[1], x.bb[0]], [x.bb[3], x.bb[2]]] : null;
  map.once('moveend', () => collapseGeo());
  if (bounds) map.fitBounds(bounds, {padding: 40, duration: DUR()});
  else map.flyTo({center: [x.lo, x.la], zoom: 11, duration: DUR()});
}
function drawSug() {
  const b = $('gsug'); b.hidden = !sugs.length;
  b.innerHTML = sugs.map((x, i) => `<div data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(x.n)}<small>${x.t === 'Estado' ? 'Estado · ' + x.uf : x.t === 'Rede' ? `Mercado · rede · ${x.cnt} loja${x.cnt > 1 ? 's' : ''}` : x.t === 'Loja' ? `Mercado · ${esc(x.st.ci || '')}/${x.uf}` : 'Cidade · ' + x.uf}</small></div>`).join('');
  b.querySelectorAll('div').forEach(d => d.onmousedown = e => { e.preventDefault(); go(sugs[+d.dataset.i]); });
}
$('gq').addEventListener('input', async () => { sugs = await suggest($('gq').value); sel = -1; drawSug(); });
$('gq').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, sugs.length - 1); drawSug(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); drawSug(); e.preventDefault(); }
  if (e.key === 'Escape') $('gsug').hidden = true;
});
$('gq').addEventListener('blur', () => setTimeout(() => { $('gsug').hidden = true; if (!$('gq').value.trim()) collapseGeo(); }, 150));
function collapseGeo() { $('gsug').hidden = true; $('gq').blur(); $('geo').classList.add('collapsed'); }
function expandGeo() { $('geo').classList.remove('collapsed'); setTimeout(() => { $('gq').focus(); $('gq').select(); }, 200); }
$('gopen').onclick = expandGeo;
$('geo').onsubmit = async e => {
  e.preventDefault();
  const r = sel >= 0 ? sugs[sel] : (await suggest($('gq').value))[0];
  if (r) go(r); else { $('gsug').hidden = false; $('gsug').innerHTML = '<div>Nenhuma cidade ou estado encontrado.</div>'; }
};

// ---- assistente de escrita (autocompletar) nos dois campos do painel da loja ----
// Vocabulário montado uma vez por rede (em memória, sem localStorage) a partir do catálogo carregado:
//  • campo de cima (#q, termos com "+"): 1ª palavra / 1ªs duas palavras dos nomes, categorias (no singular) e termos dos ícones/unidades;
//  • campo de baixo (#pq): marcas (p.b) e palavras/pares de palavras dos nomes, com a grafia mais comum.
// Contagem = nº de produtos cujo nome tem a palavra/expressão (o mesmo critério da busca). Começa com 2 letras, prefixo sem acento.
const AC_STOP = new Set('de da do das dos com sem e em para ao a o as os na no por tipo un und unid ml g gr grs kg l lt lts cx pct pc pcs cm mm mg kit'.split(' '));
const AC = {};
function acVocab(id, d) {
  if (AC[id]) return AC[id];
  const df = new Map(), form = new Map(), first = new Map(), cats = new Map(), brands = new Map(), bform = new Map();
  const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
  for (const p of d.list) {
    const raw = (p.n || '').match(/[\p{L}]+(?:-[\p{L}]+)*/gu) || [], toks = raw.map(norm), seen = new Set();
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]; if (t.length < 2 || AC_STOP.has(t)) continue;
      if (!seen.has(t)) { seen.add(t); bump(df, t); } bump(form, t + '\t' + raw[i]);
      const j = i + 1 < toks.length && AC_STOP.has(toks[i + 1]) && /^d[eao]s?$/.test(toks[i + 1]) ? i + 2 : i + 1;  // "óleo de soja"
      if (j < toks.length && toks[j].length >= 2 && !AC_STOP.has(toks[j])) {
        const k = toks.slice(i, j + 1).join(' ');
        if (!seen.has(k)) { seen.add(k); bump(df, k); } bump(form, k + '\t' + raw.slice(i, j + 1).join(' '));
        if (i === 0) bump(first, k);
      }
      if (i === 0) bump(first, t);
    }
    if (p.c) bump(cats, norm(p.c));
    if (p.b) { const k = norm(p.b).trim(); if (k.length >= 2) { bump(brands, k); bump(bform, k + '\t' + p.b.trim()); } }
  }
  // grafia mais comum de cada chave (marcas: como a loja escreve; nomes: como mais aparece)
  const pick = m => { const B = new Map(); for (const [kf, n] of m) { const i = kf.indexOf('\t'), k = kf.slice(0, i), o = B.get(k); if (!o || n > o[1]) B.set(k, [kf.slice(i + 1), n]); } return B; };
  const best = pick(form), bestB = pick(bform);
  const sing = k => k.split(' ').map(w => w.length > 4 && w.endsWith('es') && df.has(w.slice(0, -2)) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && df.has(w.slice(0, -1)) ? w.slice(0, -1) : w).join(' ');
  // campo de cima
  const C = new Map(), addC = k => { k = sing(k); const n = df.get(k); if (n && !AC_STOP.has(k)) C.set(k, n); };
  for (const [k, n] of first) if (n >= (k.includes(' ') ? 3 : 2)) addC(k);
  for (const k of cats.keys()) if (k.split(' ').length <= 3) addC(k);
  const termos = [...ICONS.map(([re]) => re), ...UNIDADE_MEDIA.map(r => r.re), ...Object.values(BASICOS).map(b => b.re)]
    .flatMap(re => (re.source.replace(/\\[bswd]/g, ' ').match(/[a-z]{3,}(?: [a-z]{3,})?/g) || []));
  for (const t of termos) addC(t), addC(t.split(' ')[0]);
  const cat = [...C].map(([k, n]) => ({k, d: (best.get(k)?.[0] || k).toLowerCase(), n})).sort((a, b) => b.n - a.n);
  // campo de baixo
  const P = new Map();
  for (const [k, n] of df) if (n >= 2 || first.has(k)) P.set(k, {k, d: best.get(k)?.[0] || k, n});
  for (const [k, n] of brands) { const d = bestB.get(k)?.[0] || k, o = P.get(k); P.set(k, {k, d, n: Math.max(n, o ? o.n : 0), b: 1}); }
  const prod = [...P.values()].sort((a, b) => b.n - a.n || (b.b || 0) - (a.b || 0));
  return AC[id] = {cat, prod};
}
// candidatos por prefixo; ordem: mais produtos, com bônus para marca e para quando o que foi digitado já é a 1ª palavra inteira ("red" → "Red Bull")
function acCands(list, pref, max) {
  const out = [];
  for (const it of list) if (it.k.startsWith(pref) && it.k !== pref) out.push(it);
  const sc = it => it.n * (it.b ? 2 : 1) * (it.k[pref.length] === ' ' ? 3 : 1);
  return out.sort((a, b) => sc(b) - sc(a)).slice(0, max);
}
const acBox = document.createElement('div'); acBox.id = 'acbox'; acBox.hidden = true; acBox.setAttribute('role', 'listbox'); $('panel').appendChild(acBox);
let acState = null, acT = null;  // {inp, items:[{it, before}], sel}
function acClose() { acBox.hidden = true; acState = null; }
function acDraw() {
  const {inp, items, sel} = acState, F = inp.form, P = $('panel').getBoundingClientRect(), r = F.getBoundingClientRect(), cs = getComputedStyle(F);
  const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), ir = inp.getBoundingClientRect();
  acBox.style.left = (r.left - P.left + pl) + 'px'; acBox.style.width = (r.width - pl - pr) + 'px'; acBox.style.top = (ir.bottom - P.top + 3) + 'px';
  acBox.innerHTML = items.map(({it, typed, base}, i) => { const d = it.d, m = Math.min(typed, d.length), pre = base.slice(inp.id === 'q' ? base.lastIndexOf('+') + 1 : 0).trim();
    return `<div class="aci${i === sel ? ' on' : ''}" role="option" data-i="${i}"><span class="act">${pre ? `<i>${esc(pre)} </i>` : ''}<b>${esc(d.slice(0, m))}</b>${esc(d.slice(m))}</span><small>${it.n}</small></div>`; }).join('');
  acBox.hidden = false;
}
async function acUpdate(inp) {
  if (!cur || document.activeElement !== inp) return acClose();
  const top = inp.id === 'q', v = inp.value, cut = top ? v.lastIndexOf('+') + 1 : 0;  // em cima: só o termo depois do último "+"
  const lead = v.slice(cut).match(/^\s*/)[0], termo = v.slice(cut + lead.length), pref = norm(termo).replace(/\s+/g, ' ');
  if (pref.replace(/\s/g, '').length < 2 || /\s$/.test(termo)) return acClose();
  const myCur = cur, d = await loadChain(cur.c); if (myCur !== cur || document.activeElement !== inp) return;
  const list = (V => top ? V.cat : V.prod)(acVocab(cur.c, d)), antes = v.slice(0, cut) + lead;
  const items = acCands(list, pref, 6).map(it => ({it, base: antes, typed: termo.length}));
  // várias palavras: também completa só a última, mantendo as anteriores (um tamanho como "500ml" fica como está)
  const sp = termo.lastIndexOf(' '), last = sp > 0 ? norm(termo.slice(sp + 1)) : '';
  if (items.length < 6 && last.length >= 2 && !/^\d/.test(last))
    for (const it of acCands(list, last, 6)) { if (items.length >= 6) break; if (!items.some(x => x.it.k === it.k)) items.push({it, base: antes + termo.slice(0, sp + 1), typed: last.length}); }
  if (!items.length) return acClose();
  acState = {inp, items, sel: -1}; acDraw();
}
function acPick(i) {
  const s = acState; if (!s || !s.items[i]) return;
  const {inp} = s, x = s.items[i];
  inp.value = x.base + x.it.d; acClose(); inp.focus();
  if (inp.id === 'q') $('sform').requestSubmit(); else render();
}
for (const inp of [$('q'), $('pq')]) {
  inp.addEventListener('input', () => { clearTimeout(acT); acT = setTimeout(() => acUpdate(inp), 120); });
  inp.addEventListener('focus', () => { clearTimeout(acT); acT = setTimeout(() => acUpdate(inp), 120); });
  inp.addEventListener('blur', () => setTimeout(() => { if (acState && acState.inp === inp && document.activeElement !== inp) acClose(); }, 150));
  inp.addEventListener('keydown', e => {
    const s = acState; if (!s || s.inp !== inp || acBox.hidden) return;
    const n = s.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); s.sel = (s.sel + 1) % n; acDraw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); s.sel = (s.sel - 1 + n) % n; acDraw(); }
    else if (e.key === 'Enter') { if (s.sel >= 0) { e.preventDefault(); acPick(s.sel); } else acClose(); }
    else if (e.key === 'Tab') { if (!e.shiftKey) { e.preventDefault(); acPick(Math.max(s.sel, 0)); } }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); }
  });
}
acBox.addEventListener('pointerdown', e => e.preventDefault());  // não tira o foco do campo
acBox.addEventListener('click', e => { const el = e.target.closest('.aci'); if (el) acPick(+el.dataset.i); });
