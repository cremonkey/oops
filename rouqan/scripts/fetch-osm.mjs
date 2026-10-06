#!/usr/bin/env node
// Pulls every café / restaurant in Egypt from OpenStreetMap (Overpass API, ODbL licence)
// and writes data/osm-places.json. build.mjs merges entries whose area it knows.
//
//   node scripts/fetch-osm.mjs            # all of Egypt → data/osm-places-egypt.json + Cairo subset
//
// Why OSM and not scraping Google Maps: Google's terms forbid scraping and bulk storage of Maps
// content. For live Google ratings/hours, call the official Places API at request time instead.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const areas = JSON.parse(readFileSync(join(ROOT, 'data', 'areas.json'), 'utf8'));

const query = `[out:json][timeout:600];
area["ISO3166-1"="EG"][admin_level=2]->.eg;
( nwr["amenity"~"^(cafe|restaurant|fast_food)$"]["name"](area.eg); );
out center tags;`;

const res = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ data: query }) });
if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
const { elements } = await res.json();

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const dist = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)) * 111;

const all = elements.map((e) => {
  const t = e.tags, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
  const near = areas.map((a) => [a, dist({ lat, lng }, a)]).sort((x, y) => x[1] - y[1])[0];
  const tags = [];
  if (/egyptian|koshary|ful|falafel/i.test(t.cuisine || '')) tags.push('egyptian');
  if (t.internet_access && t.internet_access !== 'no') tags.push('study');
  if (t.opening_hours === '24/7') tags.push('late');
  if (t.brand) tags.push('chain');
  return {
    id: `osm-${slug(t['name:en'] || t.name)}-${e.id}`,
    ar: t['name:ar'] || t.name, en: t['name:en'] || t.name,
    type: t.amenity === 'cafe' ? 'cafe' : 'restaurant',
    area: near && near[1] < 3 ? near[0].slug : null, // only attach to a known area within ~3 km
    price: 2, tags: tags.length ? tags : ['family'],
    desc: [t.cuisine && `المطبخ: ${t.cuisine.replace(/;/g, '، ')}`, t['addr:street'] && `العنوان: ${t['addr:street']}`].filter(Boolean).join('. ') || 'مكان مسجل على OpenStreetMap.',
    lat, lng, source: 'OpenStreetMap',
  };
}).filter((p) => p.lat && p.ar);

writeFileSync(join(ROOT, 'data', 'osm-places-egypt.json'), JSON.stringify(all));
const cairo = all.filter((p) => p.area);
writeFileSync(join(ROOT, 'data', 'osm-places.json'), JSON.stringify(cairo, null, 1));
console.log(`Egypt: ${all.length} places · matched to Rouqan areas: ${cairo.length}`);
