// Capture stills or every frame of a code-animation scene (needs window.renderAt / __ready from engine.js).
// Usage:
//   node capture.cjs <scene.html> <outDir> stills 1.5 4.2 9.8      → outDir/t1.50.jpg …
//   node capture.cjs <scene.html> <outDir> random 8                → 8 random times (+ first/last)
//   node capture.cjs <scene.html> <outDir> video [fps]             → outDir/f0000.jpg … (duration from the scene)
// Headless Chromium is launched with the GPU OFF: with GPU raster, drawImage of offscreen canvases comes out black.
const path = require('path'), fs = require('fs'), os = require('os');
function findPlaywright() {
  const tk = process.env.VIDEO_TOOLKIT || path.join(process.env.VIDEO_TOOLS || path.join(os.homedir(), 'video-tools'), 'claude-code-video-toolkit');
  const tries = ['playwright', path.join(process.cwd(), 'node_modules/playwright'), path.join(tk, 'playwright/node_modules/playwright')];
  for (const p of tries) { try { return require(p); } catch (e) { } }
  throw new Error('playwright not found: set VIDEO_TOOLKIT, or `npm i playwright && npx playwright install chromium` here');
}
(async () => {
  const [, , html, out, mode = 'stills', ...rest] = process.argv;
  const { chromium } = findPlaywright();
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-gpu-compositing'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const t0 = Date.now();
  await p.goto('file://' + path.resolve(html) + '?capture=1');
  try { await p.waitForFunction('window.__ready', null, { timeout: 60000 }); }
  catch (e) { console.error('scene never became ready:\n' + errs.join('\n')); process.exit(1); }
  const { dur, fps } = await p.evaluate(() => ({ dur: window.__dur, fps: window.__fps }));
  console.log(`build ${Date.now() - t0} ms, dur ${dur}s`);
  fs.mkdirSync(out, { recursive: true });
  let times;
  if (mode === 'video') { const f = +(rest[0] || fps || 24); times = Array.from({ length: Math.round(dur * f) }, (_, i) => i / f); }
  else if (mode === 'random') { const n = +(rest[0] || 8); times = [0.8, ...Array.from({ length: n }, () => +(Math.random() * dur).toFixed(2)), dur - .6].sort((a, b) => a - b); }
  else times = rest.map(Number);
  for (let i = 0; i < times.length; i++) {
    const d = await p.evaluate(t => { window.renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', .93); }, times[i]);
    const name = mode === 'video' ? `f${String(i).padStart(4, '0')}.jpg` : `t${times[i].toFixed(2)}.jpg`;
    fs.writeFileSync(path.join(out, name), Buffer.from(d.split(',')[1], 'base64'));
  }
  if (errs.length) console.error('page errors:\n' + errs.join('\n'));
  await b.close(); console.log(`wrote ${times.length} → ${out}`);
})();
