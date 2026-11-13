#!/usr/bin/env node
// Official app icons (512px) from the App Store's public search API, for `icons` / `connect` beats.
//
//   node app_icons.cjs <project_dir> "쿠팡=coupang" "코레일+=korail" "정부24=gov24" "카카오톡=kakao"
//
// Each arg is "<search term>=<file slug>" → public/icons/<slug>.jpg. The chosen app's name and seller
// are printed: check them (the first hit for "코레일톡" was "코레일+", which is the right one; for
// "카카오톡" make sure it is not YouTube). Add "#2" to the term to take the 2nd result.
const path = require('path');
const fs = require('fs');

const [project, ...pairs] = process.argv.slice(2);
if (!project || !pairs.length) { console.error('usage: app_icons.cjs <project_dir> "검색어=slug" ...'); process.exit(1); }
const dir = path.join(path.resolve(project), 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });

(async () => {
  for (const pair of pairs) {
    const [rawTerm, slug] = pair.split('=');
    const [term, nth] = rawTerm.split('#');
    const q = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=kr&entity=software&limit=5`;
    const r = await (await fetch(q)).json();
    const hit = (r.results || [])[(Number(nth) || 1) - 1];
    if (!hit) { console.log(`MISS ${term}`); continue; }
    const img = await fetch(hit.artworkUrl512);
    fs.writeFileSync(path.join(dir, `${slug}.jpg`), Buffer.from(await img.arrayBuffer()));
    console.log(`icons/${slug}.jpg  ← ${hit.trackName} (${hit.sellerName})`);
  }
})();
