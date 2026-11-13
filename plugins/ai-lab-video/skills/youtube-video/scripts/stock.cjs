#!/usr/bin/env node
// Pixabay stock video for b-roll beats (full-bleed `photo` with an .mp4 src).
//
//   node stock.cjs <project_dir> search "high speed train" "phone call restaurant" ...
//   node stock.cjs <project_dir> get ktx=15954 call=86866 ...
//
// search prints 6 hits per query (id, length, size, tags) and saves record/stock/candidates.json;
// look at a frame of each before choosing (ffmpeg -ss 2 -frames:v 1). get downloads the medium
// rendition to public/stock/<name>.mp4 and appends credits to record/stock/credits_video.json
// (put the authors in the pinned comment / description).
// Key: PIXABAY_API_KEY env, else OpenMontage .env ($VIDEO_TOOLS/OpenMontage/.env).
const path = require('path');
const fs = require('fs');
const os = require('os');

const [project, cmd, ...args] = process.argv.slice(2);
if (!project || !['search', 'get'].includes(cmd)) { console.error('usage: stock.cjs <project_dir> search <query>... | get <name>=<id>...'); process.exit(1); }
const P = path.resolve(project);

function key() {
  if (process.env.PIXABAY_API_KEY) return process.env.PIXABAY_API_KEY;
  const env = path.join(process.env.VIDEO_TOOLS || path.join(os.homedir(), 'video-tools'), 'OpenMontage', '.env');
  const m = fs.existsSync(env) && fs.readFileSync(env, 'utf8').match(/^PIXABAY_API_KEY=(.+)$/m);
  if (m) return m[1].trim().replace(/"/g, '');
  throw new Error('No PIXABAY_API_KEY (env or OpenMontage .env)');
}

(async () => {
  const K = key();
  const rec = path.join(P, 'record', 'stock');
  fs.mkdirSync(rec, { recursive: true });
  if (cmd === 'search') {
    const out = {};
    for (const q of args) {
      const j = await (await fetch(`https://pixabay.com/api/videos/?key=${K}&q=${encodeURIComponent(q)}&per_page=6&safesearch=true`)).json();
      out[q] = (j.hits || []).map((h) => ({ id: h.id, dur: h.duration, tags: h.tags, w: h.videos.medium?.width, h: h.videos.medium?.height, thumb: h.videos.medium?.thumbnail }));
      console.log(`${q} → ` + out[q].map((x) => `${x.id}(${x.dur}s ${x.w}x${x.h} ${x.tags.slice(0, 30)})`).join(' | '));
    }
    fs.writeFileSync(path.join(rec, 'candidates.json'), JSON.stringify(out, null, 1));
    return;
  }
  const pub = path.join(P, 'public', 'stock');
  fs.mkdirSync(pub, { recursive: true });
  const credFile = path.join(rec, 'credits_video.json');
  const credits = fs.existsSync(credFile) ? JSON.parse(fs.readFileSync(credFile, 'utf8')) : [];
  for (const pair of args) {
    const [name, id] = pair.split('=');
    const h = (await (await fetch(`https://pixabay.com/api/videos/?key=${K}&id=${id}`)).json()).hits?.[0];
    if (!h) { console.log('MISS', pair); continue; }
    const v = h.videos.medium?.url ? h.videos.medium : h.videos.small;
    fs.writeFileSync(path.join(pub, `${name}.mp4`), Buffer.from(await (await fetch(v.url)).arrayBuffer()));
    credits.push({ n: name, id: h.id, user: h.user, page: h.pageURL });
    console.log(`stock/${name}.mp4  ${v.width}x${v.height} ${h.duration}s  by ${h.user}`);
  }
  fs.writeFileSync(credFile, JSON.stringify(credits, null, 1));
})();
