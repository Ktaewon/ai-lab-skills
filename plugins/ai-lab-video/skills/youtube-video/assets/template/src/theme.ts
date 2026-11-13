import { useVideoConfig } from 'remotion';
import brand from './brand.json';
import timeline from './timeline.json';

const c = brand.colors;

// Channel look: premium graphite stage + scrappy doodles + felt otter. Values come from brand.json
// (copied from the skill's assets/brand.json at scaffold time) so every scene and pipeline agrees.
export const theme = {
  ink: c.stage, // stage background; just above 10% luma so QC's black-frame check stays meaningful
  panel: c.panel,
  panelBorder: c.panelBorder,
  bone: c.text,
  muted: c.muted,
  accent: (timeline as { accent?: string | null }).accent || c.accent,
  barMuted: c.barMuted,
  caption: c.captionHighlight,
  doodle: c.doodle,
  postit: c.postit,
  mint: c.mint,
  light: c.lightStage,
  display: `"${brand.fonts.display.family}", "Pretendard", sans-serif`,
  font: `"${brand.fonts.body.family}", -apple-system, "Apple SD Gothic Neo", sans-serif`,
  mono: `"${brand.fonts.code.family}", "SF Mono", Menlo, monospace`,
  hand: `"${brand.fonts.hand.family}", "${brand.fonts.body.family}", cursive`,
};

// Sizes are written for 1080 px on the short side and scaled, so one scene works at 16:9 and 9:16.
export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return { width, height, vertical, u, px: (n: number) => n * u };
};

// Vertical frames keep the top for the short's hook and the lower third for captions.
export const safeArea = (vertical: boolean) =>
  vertical ? { top: 300, bottom: 620, side: 70 } : { top: 110, bottom: 170, side: 140 };
