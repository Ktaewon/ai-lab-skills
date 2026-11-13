#!/usr/bin/env node
// Collect a product site's own media for a hybrid Short: demo videos, character loops, images,
// plus phone-sized full-page screenshots. Real product footage beats stock and generated art.
//
//   node site_media.cjs <url> <project_dir>                 # list media + save screenshots
//   node site_media.cjs <url> <project_dir> --get <regex>   # also download media whose URL matches
//
// Writes  <project>/record/site/<host>_mobile.png (+ _full.png) and media.json (every URL found),
// downloads into <project>/public/site/. Afterwards:
//   - transparent character loops: `ffprobe -show_entries stream_tags=alpha_mode x.webm` → 1 means
//     alpha; use them as `blobs` (OffthreadVideo transparent). Pull a still with
//     `ffmpeg -c:v libvpx-vp9 -i x.webm -frames:v 1 x.png` (the vp9 decoder keeps alpha).
//   - CDN files often come in size variants (`-300.webm` / `-600.mp4`): try the larger ones.
//   - crop 9:16 frames from _full.png with ffmpeg `crop=W:H:0:Y` for `photo`/`tapes`.
// Use media only to show the product the video is about, credit it (`credit`, upload text).
const path = require('path');
const fs = require('fs');

const [url, project, flag, pattern] = process.argv.slice(2);
if (!url || !project) { console.error('usage: site_media.cjs <url> <project_dir> [--get <regex>]'); process.exit(1); }
const PROJECT = path.resolve(project);

function loadPlaywright() {
  const candidates = [
    path.join(PROJECT, 'node_modules/playwright'),
    process.env.AUTO_DEMO_PLAYWRIGHT,
    path.join(process.env.VIDEO_TOOLKIT || path.join(process.env.VIDEO_TOOLS || path.join(require('os').homedir(), 'video-tools'), 'claude-code-video-toolkit'), 'playwright/node_modules/playwright'),
  ].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch {} }
  throw new Error('playwright not found. Run `npm install` in the project, then `npx playwright install chromium`.');
}

(async () => {
  const { chromium } = loadPlaywright();
  const host = new URL(url).hostname.replace(/^www\./, '');
  const recDir = path.join(PROJECT, 'record', 'site');
  const pubDir = path.join(PROJECT, 'public', 'site');
  fs.mkdirSync(recDir, { recursive: true });
  const browser = await chromium.launch();

  // 1) phone screenshots (first screen + full page) for photo / tapes beats
  const m = await browser.newContext({ viewport: { width: 430, height: 860 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  const mp = await m.newPage();
  await mp.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: path.join(recDir, `${host}_mobile.png`) });
  for (let y = 0; y < 20000; y += 700) { await mp.mouse.wheel(0, 700); await mp.waitForTimeout(150); }
  await mp.screenshot({ path: path.join(recDir, `${host}_full.png`), fullPage: true }).catch(() => {});
  await m.close();

  // 2) desktop pass: scroll everything into view so lazy videos load, then list media
  const d = await browser.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'ko-KR' });
  await d.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  for (let y = 0; y < 20000; y += 800) { await d.mouse.wheel(0, 800); await d.waitForTimeout(250); }
  const media = await d.evaluate(() => {
    const out = new Map();
    for (const e of document.querySelectorAll('video, video source, img, picture source')) {
      const src = e.currentSrc || e.src || e.srcset?.split(' ')[0];
      if (!src || src.startsWith('data:')) continue;
      const host = e.closest('video') || e;
      const r = host.getBoundingClientRect();
      out.set(src, { src, tag: host.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return [...out.values()];
  });
  await browser.close();
  fs.writeFileSync(path.join(recDir, 'media.json'), JSON.stringify(media, null, 1));
  for (const x of media) console.log(`${x.tag.padEnd(6)} ${String(x.w).padStart(5)}x${String(x.h).padEnd(5)} ${x.src}`);
  console.log(`\n${media.length} media → record/site/media.json; screenshots → record/site/${host}_mobile.png, _full.png`);

  if (flag === '--get' && pattern) {
    const re = new RegExp(pattern);
    fs.mkdirSync(pubDir, { recursive: true });
    for (const x of media.filter((x) => re.test(x.src))) {
      const name = decodeURIComponent(new URL(x.src).pathname.split('/').pop());
      const res = await fetch(x.src);
      if (!res.ok) { console.log('FAIL', res.status, x.src); continue; }
      fs.writeFileSync(path.join(pubDir, name), Buffer.from(await res.arrayBuffer()));
      console.log('saved public/site/' + name);
    }
  }
})();
