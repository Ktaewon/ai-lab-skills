export type Caption = { from: number; to: number; text: string };
export type Click = { t: number; x: number; y: number; label: string };
export type Recording = { video: string; width: number; height: number; duration: number; clicks: Click[] };

// Scene-specific fields from episode.json land in `props` (title, bullets, bars, ...).
export type Scene = {
  id: string;
  type: 'title' | 'statement' | 'recording' | 'terminal' | 'chart' | 'media' | 'outro' | 'compare' | 'prompt' | 'beats' | 'chat'
    | 'tier' | 'quiz' | 'scoreboard' | 'news' | 'doc' | 'race' | 'flow' | 'code' | 'receipt' | 'map';
  from: number;
  frames: number;
  audio: string | null;
  audioEstimated: boolean;
  captionTiming?: 'words' | 'ratio' | 'none';
  captions: { long: Caption[]; short: Caption[] };
  rec: Recording | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
};

// thumb: optional vertical cover (ShortThumb-<id> still), see ShortThumbnail.tsx
export type ShortThumb = { bg?: string; label: string; big: string; lines: string[]; pose: string; say?: string; card?: string; cardLabel?: string; stamp?: string; letters?: string;
  // brand: big product/model title in the top band (replaces the small label pill), e.g. {kicker: "Claude", text: "Fable 5.2", sub: "vs Mythos 5.2"}.
  // The last word of `text` is drawn in the accent colour.
  brand?: { kicker?: string; text: string; sub?: string } };
export type Short = { id: string; hook: string; scenes: string[]; seconds: number; thumb?: ShortThumb };

export type Timeline = {
  fps: number;
  title: string;
  channel: string;
  episode: string;
  accent?: string | null;
  music: string | null;
  musicVolume: number;
  totalFrames: number;
  leadInFrames?: number; // narration starts this many frames into each scene (prepare.py LEAD_IN)
  scenes: Scene[];
  shortScenes?: Scene[]; // short-only scenes (not in the long video)
  shorts: Short[];
  thumbnail: { lines: string[]; sub?: string; image?: string };
};
