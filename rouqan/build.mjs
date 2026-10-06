#!/usr/bin/env node
// Rouqan static site generator — no dependencies.
// Usage: node build.mjs            (SITE_URL env overrides the canonical base)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_URL = (process.env.SITE_URL || 'https://cremonkey.github.io/oops/rouqan').replace(/\/$/, '');
const BUILT = new Date().toISOString().slice(0, 10);

const read = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
const areas = read('areas.json');
const collections = read('collections.json');
let places = read('places.json');

// Optional: merge the OpenStreetMap dump produced by scripts/fetch-osm.mjs
const osmFile = join(ROOT, 'data', 'osm-places.json');
if (existsSync(osmFile)) {
  const known = new Set(places.map((p) => p.en.toLowerCase()));
  const extra = JSON.parse(readFileSync(osmFile, 'utf8')).filter((p) => areas.some((a) => a.slug === p.area) && !known.has(p.en.toLowerCase()));
  places = places.concat(extra);
}

const areaBy = Object.fromEntries(areas.map((a) => [a.slug, a]));
const TYPE = { cafe: 'كافيه', restaurant: 'مطعم', hub: 'وجهة خروج' };
const TYPE_PL = { cafe: 'كافيهات', restaurant: 'مطاعم', hub: 'وجهات' };
const TAGS = {
  study: 'للمذاكرة والشغل', nile: 'على النيل', historic: 'تاريخي', late: 'سهر', egyptian: 'أكل مصري',
  family: 'عائلي', budget: 'رخيص', breakfast: 'فطار وبرانش', dessert: 'حلويات', grill: 'مشويات',
  pyramids: 'قدام الأهرامات', specialty: 'قهوة مختصة', chain: 'فروع كتير', rooftop: 'روف', view: 'إطلالة',
  italian: 'إيطالي', lebanese: 'لبناني', asian: 'آسيوي', french: 'فرنسي', burger: 'برجر', books: 'كتب',
  art: 'فن ومزيكا', homemade: 'أكل بيتي', hub: 'مول / وجهة',
};
const PRICE_TXT = ['', 'اقتصادي', 'متوسط', 'فوق المتوسط', 'راقي'];
const FEATURED_TAGS = ['study', 'nile', 'historic', 'late', 'egyptian', 'breakfast', 'family', 'budget', 'pyramids', 'specialty'];

// Search phrases people in Egypt commonly type into Google, mapped to pages on the site.
const TRENDING = [
  ['كافيهات التجمع الخامس', 'area/new-cairo/'], ['كافيهات الزمالك', 'area/zamalek/'],
  ['كافيه هادي للمذاكرة', 'list/study-cafes/'], ['كافيهات على النيل', 'list/nile-view/'],
  ['مطاعم الشيخ زايد', 'area/sheikh-zayed/'], ['أحسن كشري في مصر', 'place/koshary-abou-tarek/'],
  ['فطار في القاهرة', 'list/breakfast-brunch/'], ['خروجات رخيصة', 'list/budget-outings/'],
  ['أماكن سهر في القاهرة', 'list/late-night/'], ['مطاعم قدام الأهرامات', 'list/pyramids-view/'],
  ['كافيهات المعادي', 'area/maadi/'], ['مقاهي وسط البلد', 'area/downtown/'],
  ['أكل مصري أصلي', 'list/egyptian-food/'], ['كافيهات مصر الجديدة', 'area/heliopolis/'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HUES = [14, 24, 34, 168, 186, 352, 8, 40, 200, 160];
const hue = (s) => HUES[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % HUES.length];
const mapsUrl = (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.en}, ${areaBy[p.area].en}, Cairo, Egypt`)}`;
const dirUrl = (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${p.en}, ${areaBy[p.area].en}, Cairo, Egypt`)}`;
const matches = (p, m) => (!m.type || p.type === m.type) && (!m.tag || p.tags.includes(m.tag)) && (!m.price || p.price === m.price) && (!m.area || p.area === m.area);
const priceDots = (n) => `<span class="price" aria-label="مستوى السعر: ${PRICE_TXT[n]}">${'<b>$</b>'.repeat(n)}${'<i>$</i>'.repeat(4 - n)}</span>`;

const ICON = {
  cafe: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path class="steam" d="M8 2c-1 1.5 1 2.5 0 4M11 2c-1 1.5 1 2.5 0 4M14 2c-1 1.5 1 2.5 0 4"/>',
  restaurant: '<path d="M4 3v7a3 3 0 0 0 3 3v8M7 3v6M10 3v7a3 3 0 0 1-3 3"/><path d="M18 21V3c-2 1-3 4-3 7v3h3"/>',
  hub: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6M9 11h.01M15 11h.01"/>',
};
const svgIcon = (t, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[t]}</svg>`;

function card(p, rel, i = 0) {
  const a = areaBy[p.area];
  const search = [p.ar, p.en, a.ar, a.en, TYPE[p.type], ...p.tags.map((t) => TAGS[t])].join(' ').toLowerCase();
  return `<li class="card reveal" style="--h:${hue(p.id)};--i:${i % 12}" data-type="${p.type}" data-area="${p.area}" data-price="${p.price}" data-tags="${p.tags.join(' ')}" data-name="${esc(p.ar)}" data-search="${esc(search)}">
  <a href="${rel}place/${p.id}/" class="card-link">
    <div class="art" style="view-transition-name:art-${p.id}">${svgIcon(p.type)}<span class="art-type">${TYPE[p.type]}</span></div>
    <div class="card-body">
      <h3>${esc(p.ar)}</h3>
      <p class="en" lang="en">${esc(p.en)}</p>
      <p class="meta"><span>📍 ${esc(a.ar)}${p.chain ? ' وفروع تانية' : ''}</span>${priceDots(p.price)}</p>
      <ul class="tags">${p.tags.filter((t) => t !== 'chain').slice(0, 3).map((t) => `<li>${TAGS[t]}</li>`).join('')}</ul>
    </div>
  </a>
</li>`;
}

function placeLd(p) {
  const a = areaBy[p.area];
  return {
    '@type': p.type === 'cafe' ? 'CafeOrCoffeeShop' : p.type === 'restaurant' ? 'Restaurant' : 'ShoppingCenter',
    '@id': `${SITE_URL}/place/${p.id}/#place`,
    name: p.ar, alternateName: p.en, description: p.desc, url: `${SITE_URL}/place/${p.id}/`,
    priceRange: '$'.repeat(p.price), hasMap: mapsUrl(p),
    address: { '@type': 'PostalAddress', addressLocality: a.en, addressRegion: 'Cairo', addressCountry: 'EG' },
    ...(p.type !== 'hub' && { servesCuisine: p.tags.includes('egyptian') ? 'Egyptian' : undefined }),
    keywords: p.tags.map((t) => TAGS[t]).join('، '),
  };
}

function shell({ rel, path, title, desc, body, ld = [], crumbs = [], ogType = 'website' }) {
  const url = `${SITE_URL}/${path}`;
  const graph = [
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: 'روقان', alternateName: 'Rouqan', url: `${SITE_URL}/`, inLanguage: 'ar-EG',
      potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'روقان Rouqan', url: `${SITE_URL}/`, logo: `${SITE_URL}/assets/icon.svg`, areaServed: 'Cairo, Egypt' },
    ...(crumbs.length ? [{ '@type': 'BreadcrumbList', itemListElement: [['الرئيسية', ''], ...crumbs].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: `${SITE_URL}/${u}` })) }] : []),
    ...ld,
  ];
  return `<!doctype html>
<html lang="ar-EG" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ar-EG" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="geo.region" content="EG-C"><meta name="geo.placename" content="Cairo"><meta name="geo.position" content="30.0444;31.2357"><meta name="ICBM" content="30.0444, 31.2357">
<meta property="og:type" content="${ogType}"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="روقان">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE_URL}/assets/og.svg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1b120d">
<link rel="icon" href="${rel}assets/icon.svg" type="image/svg+xml">
<link rel="manifest" href="${rel}manifest.webmanifest">
<link rel="alternate" type="text/plain" title="LLM summary" href="${rel}llms.txt">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lalezar&family=Readex+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rel}assets/style.css">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>
</head>
<body>
<div class="progress" aria-hidden="true"></div>
<a class="skip" href="#main">تخطى للمحتوى</a>
<header class="top">
  <a class="logo" href="${rel}" aria-label="روقان - الرئيسية"><span class="logo-mark">${svgIcon('cafe')}</span><span>روقان</span></a>
  <nav class="nav" aria-label="القائمة الرئيسية">
    <a href="${rel}#explore">استكشف</a><a href="${rel}#areas">المناطق</a><a href="${rel}#lists">القوائم</a><a href="${rel}#faq">أسئلة</a>
  </nav>
  <button class="theme" type="button" aria-label="تبديل الوضع الليلي">◐</button>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-grid">
    <div><p class="logo"><span class="logo-mark">${svgIcon('cafe')}</span><span>روقان</span></p><p>دليلك لأحلى كافيهات ومطاعم القاهرة والجيزة. اختار القعدة اللي تروقك.</p></div>
    <div><h2>المناطق</h2><ul>${areas.slice(0, 8).map((a) => `<li><a href="${rel}area/${a.slug}/">كافيهات ${esc(a.ar)}</a></li>`).join('')}</ul></div>
    <div><h2>القوائم</h2><ul>${collections.slice(0, 8).map((c) => `<li><a href="${rel}list/${c.slug}/">${esc(c.title)}</a></li>`).join('')}</ul></div>
  </div>
  <p class="note">التقييمات ومواعيد الفتح والأسعار الدقيقة بتتغير، فكل مكان ليه زرار يفتحه مباشرة على جوجل ماب. آخر تحديث للدليل: ${BUILT}.</p>
</footer>
<script src="${rel}assets/app.js" defer></script>
</body>
</html>
`;
}

function grid(list, rel) {
  return `<ul class="grid" id="grid">${list.map((p, i) => card(p, rel, i)).join('\n')}</ul>`;
}

function faqBlock(items) {
  return {
    html: `<section class="faq" id="faq" aria-labelledby="faq-h"><h2 id="faq-h" class="h2 reveal">أسئلة بيسألها الناس</h2>${items.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</section>`,
    ld: { '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) },
  };
}

const names = (list, n = 4) => list.slice(0, n).map((p) => p.ar).join('، ');
const itemList = (list, name) => ({ '@type': 'ItemList', name, numberOfItems: list.length, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, item: placeLd(p) })) });

const out = (path, html) => { const f = join(ROOT, path, 'index.html'); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
for (const d of ['place', 'area', 'list']) rmSync(join(ROOT, d), { recursive: true, force: true });

// ---------- Home ----------
{
  const rel = '';
  const cafes = places.filter((p) => p.type === 'cafe');
  const faq = faqBlock([
    ['إيه أحسن كافيهات في القاهرة؟', `من أشهر كافيهات القاهرة: ${names(cafes, 6)}. اختار حسب المنطقة والقعدة اللي تحبها من <a href="list/best-cafes-cairo/">قايمة أفضل كافيهات القاهرة</a>.`],
    ['فين ألاقي كافيه هادي للمذاكرة في القاهرة؟', `أماكن زي ${names(places.filter((p) => p.tags.includes('study')), 5)} معروفة بقعدتها المريحة للمذاكرة والشغل. شوف <a href="list/study-cafes/">قايمة كافيهات المذاكرة</a>.`],
    ['إيه أحلى كافيهات ومطاعم على النيل؟', `في الزمالك وجاردن سيتي: ${names(places.filter((p) => p.tags.includes('nile')), 5)}. التفاصيل في <a href="list/nile-view/">قايمة مطاعم وكافيهات النيل</a>.`],
    ['أنهي منطقة فيها كافيهات أكتر في القاهرة؟', 'التجمع الخامس والشيخ زايد فيهم أكبر عدد من الكافيهات الحديثة في وجهات زي ووتر واي وأركان بلازا، والزمالك ووسط البلد فيهم أشهر الأماكن الكلاسيكية والتاريخية.'],
    ['فين آكل أكل مصري أصلي في القاهرة؟', `${names(places.filter((p) => p.tags.includes('egyptian')), 6)} من أشهر الأماكن. شوف <a href="list/egyptian-food/">قايمة الأكل المصري</a>.`],
    ['هل روقان بيعرض تقييمات جوجل؟', 'روقان بيعرض وصف وتصنيف كل مكان، وكل مكان ليه زرار يفتحه على جوجل ماب مباشرة عشان تشوف التقييمات والصور والمواعيد المحدثة لحظياً.'],
  ]);
  const areaCount = (s) => places.filter((p) => p.area === s).length;
  const body = `
<section class="hero">
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <div class="hero-inner">
    <p class="eyebrow reveal">دليل كافيهات ومطاعم القاهرة</p>
    <h1 class="hero-title"><span class="split">لاقي</span> <span class="split">قعدتك</span> <span class="split">الجاية</span><br><span class="rotator" aria-live="polite"><span>في الزمالك</span><span>على النيل</span><span>للمذاكرة</span><span>قدام الأهرامات</span><span>للسهر</span><span>للفطار</span></span></h1>
    <p class="lede reveal">روقان بيجمعلك أشهر ${places.length} كافيه ومطعم ووجهة خروج في ${areas.length} منطقة في القاهرة والجيزة، وتقدر تقارن وتفلتر وتفتح أي مكان على جوجل ماب بضغطة.</p>
    <form class="search reveal" role="search" action="#explore">
      <label for="q" class="sr">دور على كافيه أو مطعم أو منطقة</label>
      <input id="q" name="q" type="search" placeholder="جرّب: كافيه هادي في الزمالك" autocomplete="off" enterkeyhint="search">
      <button type="submit" class="btn">دوّر</button>
    </form>
    <dl class="stats reveal">
      <div><dt>مكان</dt><dd data-count="${places.length}">${places.length}</dd></div>
      <div><dt>منطقة</dt><dd data-count="${areas.length}">${areas.length}</dd></div>
      <div><dt>قايمة</dt><dd data-count="${collections.length}">${collections.length}</dd></div>
    </dl>
  </div>
  <div class="cup" aria-hidden="true">
    <svg viewBox="0 0 200 200"><path class="s s1" d="M80 70c-12-16 12-22 0-40"/><path class="s s2" d="M100 70c-12-16 12-22 0-40"/><path class="s s3" d="M120 70c-12-16 12-22 0-40"/>
    <path class="c" d="M45 85h110v35a45 45 0 0 1-45 45h-20a45 45 0 0 1-45-45z"/><path class="c" d="M155 95h12a18 18 0 0 1 0 36h-14"/><ellipse class="c" cx="100" cy="182" rx="75" ry="8"/></svg>
  </div>
</section>

<section class="trending" aria-labelledby="tr-h">
  <h2 id="tr-h" class="sr">الأكثر بحثاً</h2>
  <div class="marquee"><div class="marquee-track">${[...TRENDING, ...TRENDING].map(([t, u], i) => `<a href="${u}"${i >= TRENDING.length ? ' aria-hidden="true" tabindex="-1"' : ''}>🔥 ${esc(t)}</a>`).join('')}</div></div>
</section>

<section class="explore" id="explore" aria-labelledby="ex-h">
  <div class="section-head"><h2 id="ex-h" class="h2 reveal">استكشف وقارن</h2><p class="count" aria-live="polite"><b id="count">${places.length}</b> مكان</p></div>
  <div class="filters" id="filters">
    <div class="seg" role="radiogroup" aria-label="النوع">
      <button type="button" role="radio" aria-checked="true" data-type="">الكل</button>
      ${Object.keys(TYPE).map((t) => `<button type="button" role="radio" aria-checked="false" data-type="${t}">${TYPE_PL[t]}</button>`).join('')}
    </div>
    <div class="row">
      <label class="sel"><span class="sr">المنطقة</span><select id="f-area"><option value="">كل المناطق</option>${areas.map((a) => `<option value="${a.slug}">${esc(a.ar)}</option>`).join('')}</select></label>
      <label class="sel"><span class="sr">السعر</span><select id="f-price"><option value="">أي ميزانية</option>${[1, 2, 3, 4].map((n) => `<option value="${n}">${PRICE_TXT[n]}</option>`).join('')}</select></label>
      <label class="sel"><span class="sr">الترتيب</span><select id="f-sort"><option value="">ترتيب روقان</option><option value="price-asc">الأرخص الأول</option><option value="price-desc">الأغلى الأول</option><option value="name">أبجدي</option></select></label>
    </div>
    <div class="chips" role="group" aria-label="القعدة">${FEATURED_TAGS.map((t) => `<button type="button" class="chip" aria-pressed="false" data-tag="${t}">${TAGS[t]}</button>`).join('')}</div>
  </div>
  ${grid(places, rel)}
  <p class="empty" hidden>مفيش أماكن بالفلاتر دي، جرّب تشيل فلتر.</p>
</section>

<section class="areas" id="areas" aria-labelledby="ar-h">
  <div class="section-head"><h2 id="ar-h" class="h2 reveal">كافيهات ومطاعم حسب المنطقة</h2></div>
  <div class="area-rail">${areas.map((a, i) => `<a class="area reveal" style="--h:${hue(a.slug)};--i:${i % 8}" href="area/${a.slug}/"><b>${esc(a.ar)}</b><span lang="en">${esc(a.en)}</span><em>${areaCount(a.slug)} مكان</em></a>`).join('')}</div>
  <div id="map" class="map reveal" role="img" aria-label="خريطة مناطق القاهرة على روقان" data-areas='${esc(JSON.stringify(areas.map((a) => ({ s: a.slug, n: a.ar, lat: a.lat, lng: a.lng, c: areaCount(a.slug) }))))}'></div>
</section>

<section class="lists" id="lists" aria-labelledby="li-h">
  <div class="section-head"><h2 id="li-h" class="h2 reveal">قوائم روقان</h2></div>
  <div class="list-grid">${collections.map((c, i) => `<a class="list-card reveal" style="--h:${hue(c.slug)};--i:${i % 6}" href="list/${c.slug}/"><b>${esc(c.title)}</b><span>${places.filter((p) => matches(p, c.match)).length} مكان ←</span></a>`).join('')}</div>
</section>

<section class="about reveal" aria-labelledby="ab-h">
  <h2 id="ab-h" class="h2">يعني إيه روقان؟</h2>
  <p><strong>روقان</strong> دليل مصري لكافيهات ومطاعم القاهرة والجيزة، زي محركات مقارنة الفنادق بس للقعدات. بنرتب الأماكن حسب المنطقة ونوع القعدة والميزانية، وبنكتب عن كل مكان وصف قصير يوضحلك هو مناسب لإيه، وبنوديك لجوجل ماب عشان التقييمات والمواعيد اللحظية.</p>
</section>
${faq.html}`;
  writeFileSync(join(ROOT, 'index.html'), shell({
    rel, path: '', title: 'روقان | أفضل كافيهات ومطاعم القاهرة 2026 – قارن واختار قعدتك',
    desc: `دليل روقان لأشهر ${places.length} كافيه ومطعم في القاهرة والجيزة: كافيهات التجمع والزمالك، أماكن للمذاكرة، مطاعم على النيل وقدام الأهرامات، وخروجات رخيصة.`,
    body, ld: [itemList(places, 'كافيهات ومطاعم القاهرة على روقان'), faq.ld],
  }));
}

// ---------- Places ----------
for (const p of places) {
  const rel = '../../';
  const a = areaBy[p.area];
  const similar = places.filter((x) => x.id !== p.id && (x.area === p.area || x.tags.some((t) => p.tags.includes(t) && t !== 'chain'))).slice(0, 6);
  const body = `
<nav class="crumbs" aria-label="مسار التصفح"><a href="${rel}">الرئيسية</a> / <a href="${rel}area/${a.slug}/">${esc(a.ar)}</a> / <span>${esc(p.ar)}</span></nav>
<article class="place" style="--h:${hue(p.id)}">
  <div class="art art-xl" style="view-transition-name:art-${p.id}">${svgIcon(p.type)}<span class="art-type">${TYPE[p.type]}</span></div>
  <div class="place-body">
    <h1 class="h1">${esc(p.ar)} <small lang="en">${esc(p.en)}</small></h1>
    <p class="answer"><strong>${esc(p.ar)}</strong> ${TYPE[p.type]} في ${esc(a.ar)}، القاهرة${p.chain ? ' وليه فروع في مناطق تانية' : ''}. ${esc(p.desc)}</p>
    <dl class="facts">
      <div><dt>النوع</dt><dd>${TYPE[p.type]}</dd></div>
      <div><dt>المنطقة</dt><dd><a href="${rel}area/${a.slug}/">${esc(a.ar)}</a></dd></div>
      <div><dt>الميزانية</dt><dd>${priceDots(p.price)} ${PRICE_TXT[p.price]}</dd></div>
      <div><dt>مناسب لـ</dt><dd>${p.tags.map((t) => TAGS[t]).join('، ')}</dd></div>
    </dl>
    <div class="actions">
      <a class="btn" href="${mapsUrl(p)}" target="_blank" rel="noopener">افتحه على جوجل ماب ↗</a>
      <a class="btn ghost" href="${dirUrl(p)}" target="_blank" rel="noopener">الاتجاهات</a>
      <button class="btn ghost share" type="button" data-title="${esc(p.ar)}">شارك</button>
    </div>
    <p class="hint">التقييمات والصور ومواعيد النهارده متاحة لحظياً على جوجل ماب.</p>
  </div>
</article>
<section class="explore"><h2 class="h2 reveal">أماكن شبه ${esc(p.ar)}</h2>${grid(similar, rel)}</section>`;
  out(`place/${p.id}`, shell({
    rel, path: `place/${p.id}/`, ogType: 'article',
    title: `${p.ar} ${p.en} – ${TYPE[p.type]} في ${a.ar} | روقان`,
    desc: `${p.ar} (${p.en}) ${TYPE[p.type]} في ${a.ar}، القاهرة. ${p.desc}`.slice(0, 158),
    body, crumbs: [[a.ar, `area/${a.slug}/`], [p.ar, `place/${p.id}/`]], ld: [placeLd(p)],
  }));
}

// ---------- Areas ----------
for (const a of areas) {
  const rel = '../../';
  const list = places.filter((p) => p.area === a.slug);
  const cafes = list.filter((p) => p.type === 'cafe');
  const restos = list.filter((p) => p.type === 'restaurant');
  const faq = faqBlock([
    [`إيه أحسن كافيهات في ${a.ar}؟`, cafes.length ? `من أشهر كافيهات ${a.ar}: ${names(cafes, 5)}.` : `${a.ar} معروفة أكتر بالمطاعم، ومن أشهرها: ${names(list, 5)}.`],
    [`إيه أشهر مطاعم ${a.ar}؟`, restos.length ? `${names(restos, 5)}.` : `شوف الوجهات في ${a.ar}: ${names(list, 4)}، فيها مطاعم كتير.`],
  ]);
  const body = `
<nav class="crumbs" aria-label="مسار التصفح"><a href="${rel}">الرئيسية</a> / <span>${esc(a.ar)}</span></nav>
<header class="page-head" style="--h:${hue(a.slug)}">
  <h1 class="h1">كافيهات ومطاعم ${esc(a.ar)} <small lang="en">Cafés & Restaurants in ${esc(a.en)}</small></h1>
  <p class="answer">${esc(a.intro)} في ${esc(a.ar)} على روقان ${list.length} مكان${list.length ? `، أشهرها ${esc(names(list, 3))}` : ''}.</p>
</header>
<section class="explore">${grid(list, rel)}</section>
<section class="areas"><h2 class="h2 reveal">مناطق تانية</h2><div class="area-rail">${areas.filter((x) => x.slug !== a.slug).map((x, i) => `<a class="area reveal" style="--h:${hue(x.slug)};--i:${i % 8}" href="${rel}area/${x.slug}/"><b>${esc(x.ar)}</b><span lang="en">${esc(x.en)}</span></a>`).join('')}</div></section>
${faq.html}`;
  out(`area/${a.slug}`, shell({
    rel, path: `area/${a.slug}/`,
    title: `أفضل كافيهات ومطاعم ${a.ar} 2026 | روقان`,
    desc: `كافيهات ومطاعم ${a.ar} (${a.en}): ${a.intro}`.slice(0, 158),
    body, crumbs: [[a.ar, `area/${a.slug}/`]], ld: [itemList(list, `كافيهات ومطاعم ${a.ar}`), faq.ld],
  }));
}

// ---------- Collections ----------
for (const c of collections) {
  const rel = '../../';
  const list = places.filter((p) => matches(p, c.match));
  const byArea = [...new Set(list.map((p) => p.area))].map((s) => areaBy[s].ar);
  const body = `
<nav class="crumbs" aria-label="مسار التصفح"><a href="${rel}">الرئيسية</a> / <span>${esc(c.title)}</span></nav>
<header class="page-head" style="--h:${hue(c.slug)}">
  <h1 class="h1">${esc(c.title)}</h1>
  <p class="answer">${esc(c.intro)} القايمة فيها ${list.length} مكان في ${byArea.length} منطقة (${esc(byArea.join('، '))})، وأبرزهم ${esc(names(list, 3))}.</p>
</header>
<section class="explore"><ol class="rank">${list.map((p, i) => `<li class="reveal" style="--i:${i % 10}"><a href="${rel}place/${p.id}/"><b>${i + 1}</b><span><strong>${esc(p.ar)}</strong> – ${esc(areaBy[p.area].ar)}<br><small>${esc(p.desc)}</small></span></a></li>`).join('')}</ol></section>
<section class="lists"><h2 class="h2 reveal">قوائم تانية</h2><div class="list-grid">${collections.filter((x) => x.slug !== c.slug).map((x, i) => `<a class="list-card reveal" style="--h:${hue(x.slug)};--i:${i % 6}" href="${rel}list/${x.slug}/"><b>${esc(x.title)}</b><span>←</span></a>`).join('')}</div></section>`;
  out(`list/${c.slug}`, shell({
    rel, path: `list/${c.slug}/`, ogType: 'article',
    title: `${c.title} 2026 – ${list.length} مكان | روقان`,
    desc: c.intro.slice(0, 158), body, crumbs: [[c.title, `list/${c.slug}/`]], ld: [itemList(list, c.title)],
  }));
}

// ---------- SEO / GEO / LLM files ----------
const urls = ['', ...areas.map((a) => `area/${a.slug}/`), ...collections.map((c) => `list/${c.slug}/`), ...places.map((p) => `place/${p.id}/`)];
writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}/${u}</loc><lastmod>${BUILT}</lastmod><changefreq>${u ? 'weekly' : 'daily'}</changefreq><priority>${u ? (u.startsWith('place') ? '0.6' : '0.8') : '1.0'}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(ROOT, 'robots.txt'), `# robots.txt only takes effect at a domain root; copy it there when Rouqan gets its own domain.
User-agent: *
Allow: /

# AI crawlers are welcome (GEO / LLM visibility)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
const llms = `# روقان (Rouqan)

> روقان دليل عربي (مصري) لكافيهات ومطاعم القاهرة والجيزة. بيرتب ${places.length} مكان في ${areas.length} منطقة حسب النوع والميزانية ونوع القعدة، وكل مكان ليه رابط مباشر على جوجل ماب.
> Rouqan is an Arabic guide to cafés and restaurants in Cairo & Giza, Egypt — a trivago-style comparison of places by area, budget and vibe.

## المناطق (Areas)
${areas.map((a) => `- [كافيهات ومطاعم ${a.ar} – ${a.en}](${SITE_URL}/area/${a.slug}/): ${a.intro}`).join('\n')}

## القوائم (Curated lists)
${collections.map((c) => `- [${c.title}](${SITE_URL}/list/${c.slug}/): ${c.intro}`).join('\n')}

## Optional
- [كل الأماكن بالتفصيل](${SITE_URL}/llms-full.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
`;
writeFileSync(join(ROOT, 'llms.txt'), llms);
writeFileSync(join(ROOT, 'llms-full.txt'), `# روقان – كل الأماكن (${BUILT})

${areas.map((a) => {
  const list = places.filter((p) => p.area === a.slug);
  return `## ${a.ar} (${a.en})\n${a.intro}\n\n${list.map((p) => `### ${p.ar} (${p.en})\n- النوع: ${TYPE[p.type]}\n- الميزانية: ${PRICE_TXT[p.price]}\n- مناسب لـ: ${p.tags.map((t) => TAGS[t]).join('، ')}\n- ${p.desc}\n- صفحة روقان: ${SITE_URL}/place/${p.id}/\n- جوجل ماب: ${mapsUrl(p)}`).join('\n\n')}`;
}).join('\n\n')}
`);
console.log(`Built ${urls.length} pages → ${SITE_URL}`);
