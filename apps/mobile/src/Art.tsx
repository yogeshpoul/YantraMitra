import { illustrationFor, TONES, VIEW_BOX, type Shape } from '@yantramitra/illustrations';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

function render(shape: Shape, i: number) {
  if (shape.t === 'rect') return <Rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={shape.fill ? TONES[shape.fill] : 'none'} />;
  const stroke = shape.stroke ? { stroke: TONES[shape.stroke], strokeWidth: shape.w ?? 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const } : {};
  const fill = shape.fill ? TONES[shape.fill] : 'none';
  if (shape.t === 'circle') return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} {...stroke} />;
  return <Path key={i} d={shape.d} fill={fill} {...stroke} />;
}

/** Same equipment art as the website, from the shared illustrations package. */
export function Art({ iconKey, fallbackKey, height = 80 }: { iconKey?: string | null; fallbackKey?: string | null; height?: number }) {
  return (
    <Svg viewBox={VIEW_BOX} width={height * 1.5} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {illustrationFor(iconKey, fallbackKey).map(render)}
    </Svg>
  );
}
