/**
 * Equipment illustrations as plain data so web (SVG) and mobile (react-native-svg) draw the same art.
 * viewBox is 0 0 120 80. Colours are tokens resolved by the renderer.
 */
export type Tone = 'body' | 'shade' | 'accent' | 'dark' | 'light' | 'ground';
export type Shape =
  | { t: 'path'; d: string; fill?: Tone; stroke?: Tone; w?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: Tone; stroke?: Tone; w?: number }
  | { t: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: Tone };

export const VIEW_BOX = '0 0 120 80';

export const TONES: Record<Tone, string> = {
  body: '#2f7d3b', shade: '#1f5a2a', accent: '#e09a1f', dark: '#2b2a26', light: '#f4efe1', ground: '#c9b58c',
};

const ground: Shape = { t: 'path', d: 'M4 70h112', stroke: 'ground', w: 4 };
const wheel = (cx: number, cy: number, r: number): Shape[] => [
  { t: 'circle', cx, cy, r, fill: 'dark' },
  { t: 'circle', cx, cy, r: r * 0.55, fill: 'accent' },
  { t: 'circle', cx, cy, r: r * 0.2, fill: 'dark' },
];
const rect = (x: number, y: number, width: number, height: number, fill: Tone, rx = 2): Shape => ({ t: 'rect', x, y, width, height, rx, fill });
const path = (d: string, fill: Tone): Shape => ({ t: 'path', d, fill });
const line = (d: string, stroke: Tone = 'dark', w = 3): Shape => ({ t: 'path', d, stroke, w });

/** A tractor scaled for use with a towed implement. Faces right, occupies x 58–112. */
const smallTractor: Shape[] = [
  path('M72 38h16v-14h-14z', 'light'), line('M72 40 74 23h16v16', 'shade', 3), rect(84, 38, 24, 15, 'body', 3),
  rect(66, 44, 24, 12, 'shade', 3), line('M101 38V26', 'dark', 3), ...wheel(75, 56, 14), ...wheel(103, 61, 9),
];

const illustrations: Record<string, Shape[]> = {
  tractor: [
    ground, path('M38 34h24V14H42z', 'light'), line('M38 36 41 13h24v22', 'shade', 4), rect(58, 32, 44, 22, 'body', 4),
    rect(30, 42, 34, 16, 'shade', 4), line('M88 32V16', 'dark', 4), rect(92, 37, 8, 4, 'light'), rect(92, 44, 8, 4, 'light'),
    ...wheel(42, 50, 20), ...wheel(94, 58, 12),
  ],
  tillage: [
    ground, ...smallTractor, line('M58 48H28', 'dark', 4), rect(12, 38, 36, 10, 'accent', 3),
    line('M16 48q-5 8 1 18M25 48q-5 8 1 18M34 48q-5 8 1 18M43 48q-5 8 1 18', 'shade', 4),
    path('M6 70q6-8 12 0 6-8 12 0 6-8 12 0 6-8 12 0z', 'ground'),
  ],
  sowing: [
    ground, ...smallTractor, line('M60 50H46', 'dark', 4), path('M10 26h40l-6 18H16z', 'accent'), rect(12, 44, 36, 6, 'shade'),
    line('M18 50v14M28 50v14M38 50v14', 'dark', 3), { t: 'circle', cx: 18, cy: 68, r: 2.5, fill: 'body' },
    { t: 'circle', cx: 28, cy: 68, r: 2.5, fill: 'body' }, { t: 'circle', cx: 38, cy: 68, r: 2.5, fill: 'body' },
    line('M8 68v-7m0 2q-4-1-4-5m4 5q4-1 4-5', 'body', 2),
  ],
  spraying: [
    ground, ...smallTractor, rect(24, 28, 32, 20, 'light', 8), rect(24, 38, 32, 10, 'accent', 4), line('M60 50H44', 'dark', 4),
    line('M6 50h36', 'shade', 4), line('M10 54v3M20 54v3M30 54v3', 'dark', 3),
    line('M10 60l-3 7M10 60l3 7M20 60l-3 7M20 60l3 7M30 60l-3 7M30 60l3 7', 'body', 1.5),
  ],
  drone: [
    ground, line('M30 26 52 34M90 26 68 34', 'dark', 4), rect(46, 28, 28, 14, 'body', 6), rect(50, 42, 20, 10, 'accent', 4),
    line('M16 22h28M76 22h28', 'shade', 4), line('M30 22v5M90 22v5', 'dark', 4), line('M50 52l-4 8M70 52l4 8', 'dark', 3),
    line('M56 56l-4 9M60 56v10M64 56l4 9', 'body', 1.5), { t: 'circle', cx: 60, cy: 35, r: 3, fill: 'light' },
    line('M14 69v-6M26 69v-6M94 69v-6M106 69v-6', 'body', 3),
  ],
  harvesting: [
    ground, rect(26, 24, 56, 30, 'body', 4), path('M62 24V8h20l6 16z', 'light'), line('M62 25V8h20l6 17', 'shade', 3), rect(30, 14, 26, 10, 'accent', 3),
    line('M28 20 10 12', 'shade', 5), rect(30, 32, 30, 5, 'light'), path('M82 44h10l10 18H86z', 'shade'),
    { t: 'circle', cx: 104, cy: 58, r: 11, stroke: 'accent', w: 3 }, line('M104 47v22M93 58h22M96 50l16 16M112 50 96 66', 'accent', 2),
    ...wheel(72, 56, 14), ...wheel(36, 60, 10),
  ],
  excavation: [
    ground, path('M28 38V18h22l4 20z', 'light'), line('M28 39V17h22l5 22', 'shade', 3), rect(18, 36, 44, 16, 'accent', 4), rect(16, 54, 50, 14, 'dark', 7),
    { t: 'circle', cx: 24, cy: 61, r: 4, fill: 'ground' }, { t: 'circle', cx: 41, cy: 61, r: 4, fill: 'ground' }, { t: 'circle', cx: 58, cy: 61, r: 4, fill: 'ground' },
    line('M58 40 82 14 102 32', 'accent', 7), line('M102 32 98 50', 'accent', 6), path('M88 48h20l-4 16-12 2z', 'shade'),
  ],
  transport: [
    ground, ...smallTractor, line('M62 56H50', 'dark', 4), path('M4 30h48l-3 24H7z', 'accent'), rect(4, 28, 48, 5, 'shade'),
    line('M16 34v18M28 34v18M40 34v18', 'shade', 2), ...wheel(18, 61, 9), ...wheel(38, 61, 9),
  ],
  irrigation: [
    ground, rect(34, 34, 40, 24, 'body', 5), line('M42 38v16M50 38v16M58 38v16', 'shade', 3), { t: 'circle', cx: 82, cy: 46, r: 15, fill: 'accent' },
    { t: 'circle', cx: 82, cy: 46, r: 6, fill: 'dark' }, line('M82 31V16h22', 'shade', 7), line('M104 20q10 4 10 20M104 20q4 6 4 22', 'body', 2.5),
    rect(28, 58, 70, 8, 'dark', 2), rect(44, 26, 18, 8, 'shade', 2), line('M34 46H12v20', 'dark', 5),
  ],
  levelling: [
    ground, ...smallTractor, line('M60 52H44', 'dark', 4), path('M8 44h36v14q-20 10-40 6z', 'accent'), line('M26 44V16', 'dark', 3),
    rect(19, 10, 14, 8, 'shade', 3), line('M4 14h12M36 14h12', 'accent', 2), path('M4 70q10-6 24-2l26 2z', 'ground'),
  ],
  other: [
    ground, { t: 'circle', cx: 48, cy: 42, r: 20, stroke: 'body', w: 9 }, line('M48 12v12M48 60v10M18 42h12M66 42h12M27 21l8 8M61 55l8 8M27 63l8-8M61 29l8-8', 'body', 8),
    { t: 'circle', cx: 48, cy: 42, r: 6, fill: 'shade' }, line('M78 66 104 34', 'accent', 8), line('M98 24q-2 10 6 12 8 0 12-8', 'accent', 6),
  ],
};

export function illustrationFor(...keys: (string | null | undefined)[]): Shape[] {
  for (const key of keys) {
    const found = key ? illustrations[key] : undefined;
    if (found) return found;
  }
  return illustrations.other!;
}
