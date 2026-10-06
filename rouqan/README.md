# روقان (Rouqan)

دليل لكافيهات ومطاعم القاهرة والجيزة على طريقة trivago. موقع ثابت، موبايل فيرست، عربي RTL، ومن غير أي dependencies.

## التشغيل
```bash
node build.mjs                      # بيولد كل الصفحات + sitemap + llms.txt
SITE_URL=https://rouqan.com node build.mjs   # لما يبقى للموقع دومين خاص
python3 -m http.server -d ..        # وبعدين افتح http://localhost:8000/rouqan/
```

## البيانات
- `data/places.json`: الأماكن (منسقة يدوياً). عدّل هنا وشغّل البناء من جديد.
- `data/areas.json`: المناطق. `data/collections.json`: القوائم اللي بتستهدف كلمات البحث.
- `scripts/fetch-osm.mjs`: بيسحب كل كافيهات ومطاعم مصر من OpenStreetMap (ترخيص ODbL)، و`build.mjs` بيدمج تلقائياً الأماكن اللي جوه المناطق المعروفة.
  شروط جوجل ماب بتمنع سحب بياناتها وتخزينها، فالتقييمات والمواعيد بتتفتح لحظياً على جوجل ماب من زرار في صفحة كل مكان.

## SEO / GEO / LLM
- صفحة لكل مكان ولكل منطقة ولكل قايمة، والمحتوى كله متولد كـ HTML عشان محركات البحث تقرأه.
- JSON-LD: WebSite + SearchAction وOrganization وBreadcrumbList وItemList وCafeOrCoffeeShop/Restaurant وFAQPage.
- Meta tags للموقع الجغرافي (EG-C) وhreflang ar-EG وOpen Graph.
- `llms.txt` و`llms-full.txt` لمحركات الذكاء الاصطناعي، و`robots.txt` بيسمح لـ GPTBot وClaudeBot وPerplexityBot وGoogle-Extended. الملف ده بيشتغل بس على جذر الدومين.
- `sitemap.xml`.
