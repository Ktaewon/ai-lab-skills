import { continueRender, delayRender, staticFile } from 'remotion';
import brand from './brand.json';

// Load the channel fonts from public/fonts (copied by scaffold.sh) before any frame renders.
// A missing file is skipped with a warning so a render still works on system fallbacks.
const handle = delayRender('channel fonts');
const jobs: Promise<unknown>[] = [];
for (const f of Object.values(brand.fonts)) {
  for (const spec of f.files) {
    const [file, weight = '400'] = spec.split(':');
    const face = new FontFace(f.family, `url(${staticFile(`fonts/${file}`)})`, { weight });
    jobs.push(
      face
        .load()
        .then((loaded) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded))
        .catch(() => console.warn(`font missing: fonts/${file} (run scripts/get_fonts.sh)`)),
    );
  }
}
Promise.all(jobs).then(() => continueRender(handle));
