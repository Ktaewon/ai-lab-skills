#!/usr/bin/env node
// Capture public X posts as clean cards for a Short (reviews, reactions) — no login, public embed page.
//
//   node capture_posts.cjs <out_dir> name=<tweetId> [name2=<id2> ...] [--text-only]
//
// Writes <out_dir>/post_<name>.png at 3x. The avatar and every @handle are blurred (people's faces and
// handles stay out of the video; credit the platform, and the person only when they are a public figure
// quoted by the press). --text-only crops the card right under the post's own text, dropping media,
// quoted posts and the like/reply bar — the form that reads best in a `headline` beat or a `meme` sticker.
// Check every PNG by eye: X changes its embed markup, and if the avatar is not blurred, blur it afterwards:
//   ffmpeg -i post.png -filter_complex "[0]format=rgba,split[a][b];[b]crop=150:150:45:32,boxblur=20:3,
//     geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-75,Y-75),74),255,0)'[bl];[a][bl]overlay=45:32" out.png
const path = require('path');
const os = require('os');
const fs = require('fs');

function loadPlaywright() {
  const tools = process.env.VIDEO_TOOLS || path.join(os.homedir(), 'video-tools');
  const candidates = [
    path.join(process.cwd(), 'node_modules/playwright'),
    process.env.AUTO_DEMO_PLAYWRIGHT,
    path.join(process.env.VIDEO_TOOLKIT || path.join(tools, 'claude-code-video-toolkit'), 'playwright/node_modules/playwright'),
  ].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch {} }
  throw new Error('playwright not found: set VIDEO_TOOLS (folder holding claude-code-video-toolkit) or run from a project with playwright');
}

(async () => {
  const args = process.argv.slice(2);
  const textOnly = args.includes('--text-only');
  const [out, ...pairs] = args.filter((a) => a !== '--text-only');
  if (!out || !pairs.length) { console.error('usage: capture_posts.cjs <out_dir> name=<tweetId> ... [--text-only]'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 1400 }, deviceScaleFactor: 3 });
  for (const p of pairs) {
    const [name, id] = p.split('=');
    const url = `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=light&hideThread=true&lang=en&dnt=true`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForSelector('article', { timeout: 20000 });
      await page.waitForTimeout(1500);
      const clip = await page.evaluate((textOnly) => {
        const art = document.querySelector('article');
        // avatars: <img> or a div with a background-image, depending on the embed version
        art.querySelectorAll('img, div').forEach((el) => {
          const src = el.tagName === 'IMG' ? el.src : getComputedStyle(el).backgroundImage;
          if (/profile_images/.test(src || '')) (el.parentElement || el).style.filter = 'blur(10px)';
        });
        art.querySelectorAll('a, span, div').forEach((el) => {
          if (el.children.length === 0 && /^@\w+/.test((el.textContent || '').trim())) el.style.filter = 'blur(7px)';
        });
        art.querySelectorAll('video').forEach((v) => v.pause());
        const a = art.getBoundingClientRect();
        let bottom = a.bottom;
        if (textOnly) {
          const text = art.querySelector('[lang]'); // the post's own text comes first; quoted posts follow
          if (text) bottom = Math.min(a.bottom, text.getBoundingClientRect().bottom + 22);
        }
        return { x: a.left, y: a.top, width: a.width, height: bottom - a.top };
      }, textOnly);
      await page.screenshot({ path: path.join(out, `post_${name}.png`), clip });
      console.log(`  ok post_${name}.png  (aspect h/w ${(clip.height / clip.width).toFixed(3)})`);
    } catch (e) {
      console.log(`  (failed: post_${name}: ${e.message.split('\n')[0]})`);
    }
  }
  await browser.close();
})();
