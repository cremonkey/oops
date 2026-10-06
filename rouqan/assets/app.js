// روقان — progressive enhancement. All content is server-rendered; this only adds motion & filtering.
(() => {
  const d = document, root = d.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  // Theme toggle (remembered per viewer)
  try { const t = localStorage.getItem('rq-theme'); if (t) root.dataset.theme = t; } catch {}
  d.querySelector('.theme')?.addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('rq-theme', root.dataset.theme); } catch {}
  });

  // Scroll progress
  const bar = d.querySelector('.progress');
  const onScroll = () => {
    const h = root.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Reveal on scroll
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  const observe = (els) => els.forEach((el) => (reduce ? el.classList.add('in') : io.observe(el)));
  observe(d.querySelectorAll('.reveal'));

  // Hero word rotator
  const rot = d.querySelectorAll('.rotator span');
  if (rot.length) {
    let i = 0; rot[0].classList.add('on');
    if (!reduce) setInterval(() => {
      rot[i].classList.replace('on', 'off');
      const prev = rot[i]; setTimeout(() => prev.classList.remove('off'), 600);
      i = (i + 1) % rot.length; rot[i].classList.add('on');
    }, 2200);
  }

  // Count-up stats
  d.querySelectorAll('[data-count]').forEach((el) => {
    if (reduce) return;
    const n = +el.dataset.count; let s = null;
    const step = (t) => { s ??= t; const p = Math.min((t - s) / 1400, 1); el.textContent = Math.round(n * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(step); };
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); requestAnimationFrame(step); } }).observe(el);
  });

  // 3D tilt on cards (fine pointers only)
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    d.addEventListener('pointermove', (e) => {
      const c = e.target.closest?.('.card'); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
    });
    d.addEventListener('pointerout', (e) => { const c = e.target.closest?.('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });
  }

  // Share
  d.querySelectorAll('.share').forEach((b) => b.addEventListener('click', async () => {
    const data = { title: b.dataset.title, url: location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); b.textContent = 'اتنسخ الرابط ✓'; } } catch {}
  }));

  // Explorer filters with FLIP animation
  const grid = d.getElementById('grid'), filters = d.getElementById('filters');
  if (grid && filters) {
    const cards = [...grid.children];
    const order = new Map(cards.map((c, i) => [c, i]));
    const q = d.getElementById('q'), area = d.getElementById('f-area'), price = d.getElementById('f-price'), sort = d.getElementById('f-sort');
    const count = d.getElementById('count'), empty = d.querySelector('.empty');
    const st = { type: '', tags: new Set() };
    const norm = (s) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
    const stop = new Set(['في', 'على', 'كافيه', 'كافيهات', 'مطعم', 'مطاعم', 'قريب', 'من', 'ال']);

    const apply = () => {
      const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
      const words = norm(q?.value || '').split(/\s+/).filter((w) => w && !stop.has(w));
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!st.type || c.dataset.type === st.type) && (!area.value || c.dataset.area === area.value) && (!price.value || c.dataset.price === price.value)
          && [...st.tags].every((t) => c.dataset.tags.split(' ').includes(t)) && words.every((w) => norm(c.dataset.search).includes(w));
        c.hidden = !ok; if (ok) shown++;
      });
      const s = sort.value, sorted = [...cards].sort((a, b) =>
        s === 'price-asc' ? a.dataset.price - b.dataset.price || order.get(a) - order.get(b)
        : s === 'price-desc' ? b.dataset.price - a.dataset.price || order.get(a) - order.get(b)
        : s === 'name' ? a.dataset.name.localeCompare(b.dataset.name, 'ar') : order.get(a) - order.get(b));
      grid.append(...sorted);
      count.textContent = shown; empty.hidden = shown > 0;
      if (reduce) return;
      cards.forEach((c) => {
        if (c.hidden) return;
        c.classList.add('in');
        const a = first.get(c), b = c.getBoundingClientRect();
        if (!a.width) { c.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    };

    filters.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
      filters.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-checked', x === b));
      st.type = b.dataset.type; apply();
    }));
    filters.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on); on ? st.tags.add(b.dataset.tag) : st.tags.delete(b.dataset.tag); apply();
    }));
    [area, price, sort].forEach((el) => el.addEventListener('change', apply));
    let t; q?.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 160); });
    q?.form.addEventListener('submit', (e) => { e.preventDefault(); apply(); d.getElementById('explore').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });

    // Deep link: ?q=... (WebSite SearchAction) and ?area=...
    const p = new URLSearchParams(location.search);
    if (p.get('q')) q.value = p.get('q');
    if (p.get('area')) area.value = p.get('area');
    if (p.get('q') || p.get('area')) apply();

    // Collapse the sticky filter on scroll down (mobile)
    let last = scrollY;
    addEventListener('scroll', () => { filters.classList.toggle('compact', scrollY > last && scrollY > filters.offsetTop + 200); last = scrollY; }, { passive: true });
  }

  // Area map — Leaflet loaded lazily when the map scrolls into view
  const map = d.getElementById('map');
  if (map) new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return; o.disconnect();
    const css = d.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; d.head.append(css);
    const s = d.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => {
      const L = window.L, m = L.map(map, { scrollWheelZoom: false, attributionControl: true }).setView([30.04, 31.25], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 18, attribution: '© OpenStreetMap © CARTO' }).addTo(m);
      JSON.parse(map.dataset.areas).forEach((a) => {
        const size = 30 + Math.min(a.c, 12) * 3;
        L.marker([a.lat, a.lng], { icon: L.divIcon({ className: '', html: `<div class="pin" style="width:${size}px;height:${size}px">${a.c}</div>`, iconSize: [size, size] }) })
          .addTo(m).bindPopup(`<a href="area/${a.s}/"><b>${a.n}</b> – ${a.c} مكان</a>`);
      });
    };
    d.head.append(s);
  }, { rootMargin: '200px' }).observe(map);
})();
