import { illustrationFor, TONES, VIEW_BOX, type Shape } from '@yantramitra/illustrations';

function render(shape: Shape, i: number) {
  if (shape.t === 'rect') return <rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={shape.fill ? TONES[shape.fill] : 'none'} />;
  const stroke = 'stroke' in shape && shape.stroke ? { stroke: TONES[shape.stroke], strokeWidth: shape.w ?? 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {};
  const fill = shape.fill ? TONES[shape.fill] : 'none';
  if (shape.t === 'circle') return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} {...stroke} />;
  return <path key={i} d={shape.d} fill={fill} {...stroke} />;
}

/** Local SVG illustration for an equipment type; no images need to be uploaded. */
export function EquipmentArt({ iconKey, fallbackKey, className }: { iconKey?: string | null; fallbackKey?: string | null; className?: string }) {
  return (
    <svg viewBox={VIEW_BOX} className={className} role="img" aria-hidden focusable="false">
      {illustrationFor(iconKey, fallbackKey).map(render)}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#2f7d3b" />
      <path d="M20 31V18" stroke="#f4efe1" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 21c-1-6-6-8-10-8 0 5 4 9 10 8Z" fill="#b3d9ad" />
      <path d="M20 18c1-6 6-8 10-8 0 5-4 9-10 8Z" fill="#e09a1f" />
      <path d="M11 31h18" stroke="#f4efe1" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
