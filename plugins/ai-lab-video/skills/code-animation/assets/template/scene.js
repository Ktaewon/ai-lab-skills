/* __TITLE__
 * Brief:   __BRIEF__
 * Style:   __STYLE__   (see references/styles.md)
 *
 * SHOT LIST — keep this block the single source of truth for timing (sound.py reads the same numbers)
 *   0.0  establishing: ...
 *   ...
 */
'use strict';
const T = {            // every beat time in one place
  end: 12,
};

const scene = {
  W: 1920, H: 1080, dur: T.end, fps: 24,

  // Paint everything static ONCE into offscreen canvases; pre-render character drawings per variant.
  build(E) {
    const { W, H } = this, L = {};
    const SUN = [1450, 600];
    L.sun = SUN;
    L.sky = E.sky(W, H, [[0, '#4a5f93'], [.5, '#cfa3a3'], [.8, '#ffd99c'], [1, '#fff1cc']], { sun: SUN, h: 720 });
    const g = L.sky.getContext('2d'), r = E.rng(40);
    E.cloud(g, 500, 220, 560, 100, r);
    E.ridge(g, W, H, 660, 40, '#8e93b6', '#a4a6c2', 17);
    L.trees = E.foliage(W, H, { y: 820, size: 70, base: '#2d4a44', mid: '#4a6e4e', hi: '#9bb75f', haze: .1, seed: 23, sun: SUN });
    L.mist = E.mistTex(5, 2600, 240, '#fde9d2', 22);
    return L;
  },

  render(g, t, L, E) {
    const tq = E.twos(t);                      // characters & FX on twos; camera/mist/light may use t
    const [sx, sy] = E.shake(tq, []);          // e.g. [[6.3, 7.4, 5]]
    g.fillStyle = '#000'; g.fillRect(0, 0, this.W, this.H);
    g.save(); g.translate(this.W / 2, this.H / 2); g.scale(1.015, 1.015); g.translate(-this.W / 2 + sx, -this.H / 2 + sy);
    g.drawImage(L.sky, 0, 0);
    E.mist(g, L.mist, 600, 12, t, .7);
    // ... characters here ...
    g.drawImage(L.trees, 0, 0);
    g.restore();
    E.grade(g, t, { sun: L.sun, fade: [.6, .5], dur: this.dur });
  },
};
E.run(scene);
