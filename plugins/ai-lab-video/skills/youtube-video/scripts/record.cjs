#!/usr/bin/env node
// Record a browser demo with a visible cursor + click ripples, log every click, and hand
// Remotion a trimmed MP4 plus the click timeline.
//
// Usage: node record.cjs <project_dir> <steps.json> <scene_id>
// Writes: <project_dir>/public/rec/<scene_id>.mp4, <project_dir>/record/<scene_id>.clicks.json
//         (then run prepare.py so the timeline picks them up)
//
// steps.json:
// {
//   "url": "http://localhost:3000" | "file:///abs/path.html",
//   "viewport": { "width": 1920, "height": 1080 },      // optional, default 1920x1080
//   "settleMs": 800,                                      // optional, idle time before the kept part starts
//   "actions": [
//     { "click": "#task", "label": "입력창" },           // CSS/Playwright selector; label is the fallback caption
//     { "type": "할 일", "delay": 70 },                  // types into the focused element
//     { "press": "Enter" },
//     { "hover": ".menu" },
//     { "scroll": 600 },                                  // wheel down by px (negative = up)
//     { "wait": 500 },
//     { "goto": "http://localhost:3000/settings" }
//   ],
//   "tailMs": 1500                                        // optional, hold at the end
// }
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const [projectDir, stepsFile, sceneId] = process.argv.slice(2);
if (!projectDir || !stepsFile || !sceneId) {
  console.error('Usage: node record.cjs <project_dir> <steps.json> <scene_id>');
  process.exit(2);
}
const PROJECT = path.resolve(projectDir);
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
const W = steps.viewport?.width ?? 1920;
const H = steps.viewport?.height ?? 1080;

// Playwright: the project's own install first, then the video toolkit's.
function loadPlaywright() {
  const candidates = [
    path.join(PROJECT, 'node_modules/playwright'),
    process.env.AUTO_DEMO_PLAYWRIGHT,
    path.join(process.env.VIDEO_TOOLKIT || path.join(process.env.VIDEO_TOOLS || path.join(require('os').homedir(), 'video-tools'), 'claude-code-video-toolkit'), 'playwright/node_modules/playwright'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch {}
  }
  throw new Error('playwright not found. Run `npm install` in the project, then `npx playwright install chromium`.');
}
const { chromium } = loadPlaywright();

const CURSOR_CSS = `
  .pw-cursor { position: fixed; width: 26px; height: 26px; border-radius: 50%;
    background: rgba(15,23,42,.85); border: 3px solid #fff; pointer-events: none;
    z-index: 2147483647; transform: translate(-50%,-50%); transition: transform .12s; }
  .pw-cursor.down { transform: translate(-50%,-50%) scale(.75); }
  .pw-ripple { position: fixed; width: 70px; height: 70px; border-radius: 50%;
    border: 4px solid #6366f1; pointer-events: none; z-index: 2147483646;
    transform: translate(-50%,-50%) scale(.2); animation: pw-r .5s ease-out forwards; }
  @keyframes pw-r { to { transform: translate(-50%,-50%) scale(1.4); opacity: 0; } }`;

// Re-injected after every navigation so the cursor survives page loads.
async function injectCursor(page, x, y) {
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate(([x, y]) => {
    if (document.querySelector('.pw-cursor')) return;
    const c = document.createElement('div'); c.className = 'pw-cursor';
    c.style.left = x + 'px'; c.style.top = y + 'px'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      c.classList.add('down');
      const r = document.createElement('div'); r.className = 'pw-ripple';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  }, [x, y]);
}

(async () => {
  const rawDir = path.join(PROJECT, 'record/raw', sceneId);
  fs.rmSync(rawDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROJECT, 'public/rec'), { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: W, height: H } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now(); // the video timeline starts when the page is created
  const now = () => (Date.now() - t0) / 1000;
  const mouse = { x: W / 2, y: H * 0.85 };
  const clicks = [];

  await page.goto(steps.url, { waitUntil: 'load' });
  await injectCursor(page, mouse.x, mouse.y);
  await page.mouse.move(mouse.x, mouse.y);
  await page.waitForTimeout(steps.settleMs ?? 800);
  const startAt = now();

  const moveTo = async (x, y) => {
    await page.mouse.move(x, y, { steps: 25 });
    mouse.x = x; mouse.y = y;
  };
  const centerOf = async (sel) => {
    const loc = page.locator(sel).first();
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (!b) throw new Error(`Element not visible: ${sel}`);
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  };

  for (const a of steps.actions) {
    if (a.click) {
      const p = await centerOf(a.click);
      await moveTo(p.x, p.y);
      await page.waitForTimeout(150);
      clicks.push({ t: +now().toFixed(3), x: p.x, y: p.y, label: a.label ?? a.click });
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
      await page.waitForTimeout(a.after ?? 400);
    } else if (a.type != null) {
      await page.keyboard.type(a.type, { delay: a.delay ?? 70 });
      await page.waitForTimeout(250);
    } else if (a.press) {
      await page.keyboard.press(a.press);
      await page.waitForTimeout(400);
    } else if (a.hover) {
      const p = await centerOf(a.hover);
      await moveTo(p.x, p.y);
      await page.waitForTimeout(400);
    } else if (a.scroll) {
      await page.mouse.wheel(0, a.scroll);
      await page.waitForTimeout(600);
    } else if (a.wait) {
      await page.waitForTimeout(a.wait);
    } else if (a.goto) {
      await page.goto(a.goto, { waitUntil: 'load' });
      await injectCursor(page, mouse.x, mouse.y);
    } else {
      throw new Error('Unknown action: ' + JSON.stringify(a));
    }
    // Clicks that navigate drop the injected cursor; put it back.
    if (!(await page.locator('.pw-cursor').count())) await injectCursor(page, mouse.x, mouse.y);
  }
  await page.waitForTimeout(steps.tailMs ?? 1500);
  const endAt = now();

  const video = page.video();
  await ctx.close();
  await browser.close();
  const raw = await video.path();

  const out = path.join(PROJECT, 'public/rec', `${sceneId}.mp4`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(startAt), '-to', String(endAt), '-i', raw,
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]);

  const timeline = {
    width: W, height: H,
    duration: +(endAt - startAt).toFixed(3),
    clicks: clicks.map((c) => ({ ...c, t: +(c.t - startAt).toFixed(3) })),
  };
  fs.writeFileSync(path.join(PROJECT, 'record', `${sceneId}.clicks.json`), JSON.stringify(timeline, null, 2));
  console.log(JSON.stringify({ video: out, duration: timeline.duration, clicks: timeline.clicks.length }));
})().catch((e) => { console.error(e.message || e); process.exit(1); });
