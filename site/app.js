const $ = id => document.getElementById(id);
// Preços de Supermercados — frontend estático (GitHub Pages)
const BRL = v => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s?(kg|g|gr|mg|ml|l|lt|litros?|un|unid(?:ades)?)\b/i;
const sizeOf = n => { const m = (n || '').match(SIZE_RE); return m ? m[0].replace(/\s+/, '') : ''; };
const ICONS = [
  [/oleo|azeite|oliva/, '🫒'], [/salgadinho|chips|batata palha|snack|amendoim/, '🍿'], [/biscoito|bolacha|cookie|wafer/, '🍪'],
  [/chocolate|bombom|cacau/, '🍫'], [/cafe|capsula/, '☕'], [/leite|iogurte|bebida lactea/, '🥛'], [/queijo|requeijao/, '🧀'],
  [/cerveja|chopp/, '🍺'], [/vinho|espumante/, '🍷'], [/refrigerante|suco|agua|energetico|bebida/, '🥤'],
  [/arroz|feijao|graos|lentilha/, '🍚'], [/macarrao|massa|espaguete|lasanha/, '🍝'], [/pao|bisnaguinha|torrada/, '🍞'],
  [/carne|bife|picanha|alcatra|frango|linguica|salsicha|bacon|presunto|mortadela/, '🥩'], [/peixe|atum|sardinha|salmao|camarao/, '🐟'],
  [/ovo/, '🥚'], [/fruta|banana|maca|laranja|uva|morango|limao/, '🍎'], [/legume|verdura|tomate|cebola|alface|batata/, '🥕'],
  [/sabao|detergente|amaciante|desinfetante|limpa|alvejante|agua sanitaria/, '🧴'], [/papel higienico|guardanapo|papel toalha/, '🧻'],
  [/shampoo|condicionador|sabonete|creme dental|desodorante/, '🧼'], [/racao|pet|cachorro|gato/, '🐾'], [/sorvete|picole/, '🍦'],
  [/acucar|adocante|sal\b|tempero|molho|ketchup|maionese/, '🧂'], [/farinha|fuba|aveia|cereal|granola/, '🌾'], [/fralda|bebe/, '🍼'],
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
function termStats(core) {
  const live = core.filter(p => !p.arch && !p.x), base = live.length ? live : core;
  const withQ = base.filter(p => p.qu);
  const nkg = withQ.filter(p => p.qu.u === 'kg').length, nl = withQ.length - nkg;
  const unit = nkg >= nl ? 'kg' : 'L';
  const sel = withQ.filter(p => p.qu.u === unit);
  if (sel.length) return {unit, ...robust(sel.map(p => p.last[1] / p.qu.q))};
  return {unit: 'un', ...robust(base.map(p => p.last[1]))};
}
const perUnit = (p, price) => p.qu ? price / p.qu.q : null;
const iconFor = q => { const n = norm(q); for (const [re, ic] of ICONS) if (re.test(n)) return ic; return '🛒'; };
const storeSvg = color => `<svg width="30" height="30" viewBox="0 0 30 30" style="overflow:visible"><circle cx="15" cy="15" r="13.5" fill="${color}" stroke="#fff" stroke-width="1.8"/>
<path d="M7 10.5 h16 l-1.5 4 H8.5z M8.5 14.5 v7 h13 v-7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><rect x="13" y="17.5" width="4" height="4" fill="#fff"/></svg>`;
// cores por nível de histórico (regra calculada em collector/build_index.py: FULL_MIN_SHARE=50%, FULL_MIN_YEARS=2)
const HIST_COLORS = {none: '#cf2b35', partial: '#f2c230', full: '#2f7cf6', rj: '#f28c28'};
const closedIcon = L.divIcon({className: 'storeicon', iconSize: [30, 30], iconAnchor: [15, 15], html: `<svg width="30" height="30" viewBox="0 0 30 30" style="overflow:visible"><circle cx="15" cy="15" r="13.5" fill="#6b6b6b" stroke="#ddd" stroke-width="1.8"/>
<path d="M7 10.5 h16 l-1.5 4 H8.5z M8.5 14.5 v7 h13 v-7" fill="none" stroke="#bbb" stroke-width="1.4"/><path d="M8 8 L22 22 M22 8 L8 22" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`});
const icons = {};
const mkIcon = lv => icons[lv] ||= L.divIcon({className: 'storeicon', html: storeSvg(HIST_COLORS[lv] || HIST_COLORS.none), iconSize: [30, 30], iconAnchor: [15, 15]});

// ===== MAPAS BASE (3 opções; padrão = 'preto'; a escolha fica salva no navegador) =====
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const BASEMAPS = {
  preto: {nome: 'Preto minimalista', thumb: 'assets/maps/preto.jpg',
    make: () => L.maplibreGL ? L.maplibreGL({style: 'https://tiles.openfreemap.org/styles/dark', attribution: `<a href="https://openfreemap.org">OpenFreeMap</a> ${OSM_ATTR}`}) : null},
  cinza: {nome: 'Cinza escuro', thumb: 'assets/maps/cinza.jpg',
    make: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {maxZoom: 16, attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community'})},
  detalhado: {nome: 'Escuro detalhado', thumb: 'assets/maps/detalhado.jpg',
    make: () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: OSM_ATTR, className: 'tiles-invert'})},
};
const BASEMAP_PADRAO = 'preto';
let baseLayer = null, baseKey = null, refLayer = null;
// ---- rótulos (nomes de ruas / bairros) ----
const LBL = Object.assign({ruas: false, bairros: true},  // nomes de ruas ocultos por padrão
  JSON.parse(localStorage.getItem('rotulos') || '{}'));
const ML_LAYERS = {ruas: ['highway_name_other', 'highway_name_motorway', 'road_oneway', 'road_oneway_opposite'], bairros: ['place_suburb', 'place_other']};
function applyLabels() {
  localStorage.setItem('rotulos', JSON.stringify(LBL));
  if (baseKey === 'preto') {
    const ml = baseLayer && baseLayer.getMaplibreMap && baseLayer.getMaplibreMap();
    if (!ml || !ml.getStyle || !ml.isStyleLoaded()) return;
    for (const [k, ids] of Object.entries(ML_LAYERS)) for (const id of ids)
      if (ml.getLayer(id) && ml.getLayoutProperty(id, 'visibility') !== (LBL[k] ? 'visible' : 'none')) ml.setLayoutProperty(id, 'visibility', LBL[k] ? 'visible' : 'none');
    for (const id of ['place_country_other', 'place_country_minor', 'place_country_major'])  // sem nome de país ("Brazil")
      if (ml.getLayer(id) && ml.getLayoutProperty(id, 'visibility') !== 'none') ml.setLayoutProperty(id, 'visibility', 'none');
    for (const id of ['highway_name_other', 'highway_name_motorway'])  // nomes de ruas em amarelo para leitura
      if (ml.getLayer(id) && ml.getPaintProperty(id, 'text-color') !== '#f2c230') {
        ml.setPaintProperty(id, 'text-color', '#f2c230'); ml.setPaintProperty(id, 'text-halo-width', 0);
      }
  } else if (baseKey === 'cinza') {
    const on = LBL.ruas || LBL.bairros;
    if (on && !refLayer) refLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {maxZoom: 16, pane: 'labels', attribution: 'Rótulos &copy; Esri'}).addTo(map);
    if (!on && refLayer) { map.removeLayer(refLayer); refLayer = null; }
  }
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
function setBasemap(key) {
  if (!BASEMAPS[key]) key = BASEMAP_PADRAO;
  let layer = BASEMAPS[key].make();
  if (!layer) { key = 'cinza'; layer = BASEMAPS.cinza.make(); }  // MapLibre indisponível
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = layer.addTo(map); baseKey = key;
  if (baseLayer.bringToBack) baseLayer.bringToBack();
  if (refLayer) { map.removeLayer(refLayer); refLayer = null; }
  if (key === 'preto') { const ml = baseLayer.getMaplibreMap && baseLayer.getMaplibreMap(); if (ml) { ml.on('styledata', applyLabels); ml.on('load', applyLabels); ml.on('idle', applyLabels); } }
  applyLabels(); drawLabelUI();
  localStorage.setItem('mapa', key);
  document.querySelectorAll('#bmenu .opt').forEach(o => o.classList.toggle('on', o.dataset.k === key));
}
const map = L.map('map', {zoomControl: false, minZoom: 4, maxBounds: [[-40, -82], [12, -25]], maxBoundsViscosity: 0.9, scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true}).fitBounds([[-33.8, -73.9], [5.3, -34.8]]);
map.attributionControl.setPrefix(false);
// créditos compactos: botão "i" que mostra a atribuição (exigida pelas licenças OSM/Esri/OpenFreeMap)
(() => { const el = map.attributionControl.getContainer(); el.classList.add('compact');
  const C = L.Control.extend({options: {position: 'bottomright'}, onAdd() {
    const b = L.DomUtil.create('button', 'attr-i'); b.type = 'button'; b.textContent = 'i'; b.title = 'Créditos do mapa';
    L.DomEvent.on(b, 'click', e => { L.DomEvent.stop(e); el.classList.toggle('open'); }); return b; }});
  new C().addTo(map); })();
map.createPane('mask'); map.getPane('mask').style.zIndex = 350; map.getPane('mask').style.pointerEvents = 'none';
// máscara: cobre tudo fora do Brasil (limites IBGE) em todos os estilos — some países vizinhos e seus rótulos
const maskRenderer = L.svg({pane: 'mask', padding: 1});
fetch('data/geo/mascara.json').then(r => r.json()).then(g => {
  const maskLayer = L.geoJSON(g, {renderer: maskRenderer, interactive: false,
    style: {stroke: true, color: '#2f7cf6', weight: 1, opacity: 0.35, fillColor: 'url(#pontilhado)', fillOpacity: 1}}).addTo(map);
  // textura pontilhada (fundo #1a1a1a + pontos brancos 16%) só fora do Brasil; acompanha o mapa ao arrastar
  const svg = maskRenderer._container, NS = 'http://www.w3.org/2000/svg';
  if (svg && !svg.querySelector('#pontilhado')) {
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `<pattern id="pontilhado" patternUnits="userSpaceOnUse" width="22" height="22"><rect width="22" height="22" fill="#1a1a1a"/><circle cx="11" cy="11" r="1.4" fill="rgba(255,255,255,0.16)"/></pattern>
      <filter id="sombra-brasil" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB">
        <feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
        <feOffset in="inv" dx="6" dy="7" result="off"/><feGaussianBlur in="off" stdDeviation="7" result="blur"/>
        <feComposite in="blur" in2="SourceAlpha" operator="in" result="sh"/>
        <feFlood flood-color="#000" flood-opacity="0.65"/><feComposite in2="sh" operator="in" result="sombra"/>
        <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sombra"/></feMerge>
      </filter>`;
    svg.insertBefore(defs, svg.firstChild);
  }
  // sombra do Brasil projetada sobre o fundo pontilhado (sombra interna da máscara, só fora do Brasil)
  maskLayer.eachLayer(l => l._path && l._path.setAttribute('filter', 'url(#sombra-brasil)'));
});
setBasemap(localStorage.getItem('mapa') || BASEMAP_PADRAO);
$('bmenu').innerHTML = Object.entries(BASEMAPS).map(([k, b]) => `<button class="opt${k === baseKey ? ' on' : ''}" data-k="${k}"><img src="${b.thumb}" alt=""><span>${b.nome}</span></button>`).join('');
$('bmenu').querySelectorAll('.opt').forEach(o => o.onclick = () => { setBasemap(o.dataset.k); $('bmenu').hidden = true; });
$('bbtn').onclick = e => { e.stopPropagation(); $('lmenu').hidden = true; $('bmenu').hidden = !$('bmenu').hidden; };
$('lbtn').onclick = e => { e.stopPropagation(); $('bmenu').hidden = true; $('lmenu').hidden = !$('lmenu').hidden; };
drawLabelUI();
map.on('click', () => { $('bmenu').hidden = true; $('lmenu').hidden = true; });

let CH = {}, cache = {}, cur = null; const MARKERS = [];

async function init() {
  const [chains, stores] = await Promise.all([fetch('data/chains.json').then(r => r.json()), fetch('data/stores.json').then(r => r.json())]);
  chains.forEach(c => CH[c.id] = c);
  let n = 0;
  for (const s of stores) {
    const c = CH[s.c]; if (!c || !c.n) continue; n++;
    const mk = L.marker([s.lat, s.lon], {icon: mkIcon(c.hist_level), title: `${c.name} — ${s.n}`}).addTo(map).on('click', () => openStore(s));
    MARKERS.push({marker: mk, lat: s.lat, lon: s.lon});
  }
  try {
    const closed = await fetch('data/closed.json').then(r => r.ok ? r.json() : []);
    for (const c of closed) MARKERS.push({lat: c.lat, lon: c.lon, marker: L.marker([c.lat, c.lon], {icon: closedIcon}).addTo(map)
      .bindTooltip(c.ano ? `Fechado em ${c.ano}` : 'Fechado (ano não informado)', {direction: 'top', offset: [0, -14]}).on('click', () => openClosed(c))});
  } catch (e) {}
  try {
    const rj = await fetch('data/rj.json').then(r => r.ok ? r.json() : []);
    for (const c of rj) MARKERS.push({lat: c.lat, lon: c.lon, marker: L.marker([c.lat, c.lon], {icon: mkIcon('rj')}).addTo(map)
      .bindTooltip(`${c.rede} — em recuperação judicial`, {direction: 'top', offset: [0, -14]}).on('click', () => openRJ(c))});
  } catch (e) {}
  const ok = chains.filter(c => c.n);
  $('stats').textContent = `${n} lojas · ${ok.length} redes · ${ok.reduce((a, c) => a + c.n, 0).toLocaleString('pt-BR')} produtos`;
}

async function loadChain(id) {
  if (!cache[id]) cache[id] = fetch(`data/chains/${id}.json`).then(r => r.json()).then(d => {
    d.list = Object.entries(d.p).map(([id, p]) => {
      const h = (p.h || []).slice().sort((a, b) => a[0] < b[0] ? -1 : 1);
      const last = h[h.length - 1];
      return {id, ...p, h, last, qu: qtyOf(p.n), nn: norm(p.n + ' ' + (p.b || ''))};
    }).filter(p => p.last);
    return d;
  });
  return cache[id];
}

function openStore(s) {
  const c = CH[s.c]; cur = s;
  $('panel').classList.remove('hidden');
  $('pt').textContent = `${c.name}`;
  $('ps').innerHTML = `${esc(s.n)}${s.a ? ' · ' + esc(s.a) : ''}${s.ci ? ' · ' + esc(s.ci) : ''}${s.uf ? '/' + s.uf : ''}<br>
    Preços do site <a href="${c.site}" target="_blank" rel="noopener">${esc(c.site.replace('https://', ''))}</a> · atualizado em ${fmtDate(c.updated)}
    ${c.oldest ? ' · histórico desde ' + fmtDate(c.oldest) : ''}`;
  $('q').value = ''; $('results').innerHTML = '';
  $('q').focus();
  loadChain(s.c); // pré-carrega
}
function openClosed(c) {
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

$('sform').onsubmit = async e => {
  e.preventDefault();
  const terms = $('q').value.split('+').map(t => t.trim()).filter(Boolean);
  if (!terms.length || !cur) return;
  const R = $('results');
  R.innerHTML = '<div class="msg">Carregando catálogo…</div>';
  const d = await loadChain(cur.c);
  R.innerHTML = '';
  for (const q of terms) {
    const {hits, core, basic} = searchTerm(d.list, q);
    const box = document.createElement('div'); box.className = 'term'; R.appendChild(box);
    if (!hits.length) { box.innerHTML = `<div class="msg">Nenhum produto encontrado para “${esc(q)}” em ${esc(CH[cur.c].name)}.</div>`; continue; }
    const st = termStats(basic && basic.list ? basic.list : core);
    const un = st.unit === 'un' ? 'un' : st.unit;
    const avgTxt = `${BRL(st.med)}/${un}`;
    const avgSub = `mediana · média ${BRL(st.mean)}/${un} (${st.kept} de ${st.n} produtos${st.unit === 'un' ? ', sem peso/volume no nome' : ''})${basic ? (basic.none ? `<br>sem ${esc(basic.rot)} com preço nesta loja — média de todos os itens` : `<br>referência: ${esc(basic.rot)}`) : ''}`;
    box.innerHTML = `<div class="card"><div class="ico" style="font-size:34px">${iconFor(q)}</div>
      <div><div class="t">${esc(q)}</div><div class="sub">${hits.length} produto${hits.length > 1 ? 's' : ''}${core.length < hits.length ? ` (${core.length} principais)` : ''} · clique para ver</div></div>
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
};

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
  el.innerHTML = `<div class="row">${img(p)}<div class="nm">${esc(p.n)}<small>${esc(sizeOf(p.n))}${p.b ? ' · ' + esc(p.b) : ''}${p.arch ? ' · só no arquivo histórico' : ''}${p.ok === false ? ' · indisponível' : ''}</small></div>
    <div class="yr">${d.slice(0, 4)}<small>${fmtDate(d)}</small></div><div class="pr">${BRL(v)}<small>${p.qu ? BRL(perUnit(p, v)) + '/' + p.qu.u + ' · ' : ''}${p.h.length > 1 ? p.h.length + ' registros ▾' : '1 registro ▾'}</small></div></div>`;
  el.firstChild.onclick = () => {
    const open = el.querySelector('.hist');
    if (open) { open.remove(); return; }
    const h = document.createElement('div'); h.className = 'hist';
    h.innerHTML = p.h.map(([d, v, s, ref]) => `<div class="row">${img(p)}<div class="nm">${esc(p.n)}<small>${esc(sizeOf(p.n))} · <span class="src">${srcLink(s, ref)}</span></small></div>
      <div class="yr">${d.slice(0, 4)}<small>${fmtDate(d)}</small></div><div class="pr">${BRL(v)}${p.qu ? `<small>${BRL(perUnit(p, v))}/${p.qu.u}</small>` : ''}</div></div>`).join('');
    el.appendChild(h);
  };
  return el;
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
  return L_.filter(x => (!uf || x.uf === uf) && (x.k.includes(qn) || x.ku === qn)).sort((a, b) => score(a) - score(b) || a.k.length - b.k.length).slice(0, 8);
}
// ---- contorno do lugar + animação de "brotar" das lojas ----
const GEO = {};
const geoFile = f => GEO[f] ||= fetch(`data/geo/${f}.json`).then(r => r.json());
let outline = null;
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
function sprout(feature) {
  SND.burst = 0;
  const inside = MARKERS.filter(m => feature ? inGeom([m.lon, m.lat], feature.geometry) : map.getBounds().contains([m.lat, m.lon]));
  inside.forEach((m, i) => {
    const el = m.marker.getElement(); if (!el) return;
    el.classList.remove('sprout'); void el.offsetWidth;
    const delay = reduceMotion ? 0 : Math.min(i * 35, 600);
    el.style.setProperty('--d', `${delay}ms`); el.classList.add('sprout');
    setTimeout(pop, delay + 60);
  });
}
async function go(x) {
  audioInit();
  $('gsug').hidden = true; $('gq').value = x.t === 'Estado' ? x.n : `${x.n} - ${x.uf}`;
  let feat = null;
  try {
    if (x.t === 'Estado') feat = (await geoFile('estados')).features.find(f => f.properties.uf === x.uf);
    else feat = (await geoFile('mun-' + x.uf)).features.find(f => String(f.properties.id) === String(x.cod));
  } catch (e) {}
  if (outline) { map.removeLayer(outline); outline = null; }
  let bounds;
  if (feat) {
    outline = L.geoJSON(feat, {interactive: false, style: {color: '#3b8cff', weight: 2.5, opacity: 0.95, fill: true, fillColor: '#2f7cf6', fillOpacity: 0.06, className: 'outline-glow'}}).addTo(map);
    bounds = outline.getBounds();
  } else if (x.bb) bounds = L.latLngBounds([x.bb[0], x.bb[1]], [x.bb[2], x.bb[3]]);
  const done = () => { sprout(feat); collapseGeo(); };
  if (bounds) { map.once('moveend', done); map.flyToBounds(bounds, {padding: [40, 40], duration: reduceMotion ? 0 : 1.3}); }
  else { map.once('moveend', done); map.flyTo([x.la, x.lo], 12, {duration: reduceMotion ? 0 : 1.3}); }
}
function drawSug() {
  const b = $('gsug'); b.hidden = !sugs.length;
  b.innerHTML = sugs.map((x, i) => `<div data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(x.n)}<small>${x.t === 'Estado' ? 'Estado · ' + x.uf : x.t + ' · ' + x.uf}</small></div>`).join('');
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
map.on('dragstart', () => { if (!$('geo').classList.contains('collapsed')) collapseGeo(); });
$('geo').onsubmit = async e => {
  e.preventDefault();
  const r = sel >= 0 ? sugs[sel] : (await suggest($('gq').value))[0];
  if (r) go(r); else { $('gsug').hidden = false; $('gsug').innerHTML = '<div>Nenhuma cidade ou estado encontrado.</div>'; }
};
init();
