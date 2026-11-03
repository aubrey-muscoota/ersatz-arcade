import { memo } from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { Grade, rng, Star, starRadius } from './logic';
import { colors } from '../theme';

export const gradeColor: Record<Grade, string> = {
  perfect: colors.gold,
  good: colors.pink,
  close: colors.cyan,
  miss: colors.inkSoft,
};

export function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

export function dotSize(n: number, R: number) {
  return R * (0.022 + 0.014 * starRadius(n));
}

type Props = { stars: Star[]; cx: number; cy: number; R: number; opacity?: number; rotate?: number };

/** The placed stars, each with a soft glow. Memoized so the 60fps arm redraw doesn't touch them. */
export const Galaxy = memo(function Galaxy({ stars, cx, cy, R, opacity = 1, rotate = 0 }: Props) {
  return (
    <G opacity={opacity} transform={rotate ? `rotate(${rotate} ${cx} ${cy})` : undefined}>
      {stars.map((s) => {
        const p = polar(cx, cy, R * starRadius(s.n), s.angle);
        const r = dotSize(s.n, R);
        if (s.grade === 'miss') {
          return <Circle key={s.n} cx={p.x} cy={p.y} r={r * 0.8} fill="none" stroke={colors.inkSoft} strokeWidth={1.2} />;
        }
        const c = gradeColor[s.grade];
        return (
          <G key={s.n}>
            <Circle cx={p.x} cy={p.y} r={r * 1.9} fill={c} opacity={0.14} />
            {s.golden ? (
              // Supernova: a bright four-point twinkle
              <G>
                <Circle cx={p.x} cy={p.y} r={r * 2.4} fill={colors.gold} opacity={0.18} />
                <Line x1={p.x - r * 2.3} y1={p.y} x2={p.x + r * 2.3} y2={p.y} stroke={colors.gold} strokeWidth={1.6} strokeLinecap="round" />
                <Line x1={p.x} y1={p.y - r * 2.3} x2={p.x} y2={p.y + r * 2.3} stroke={colors.gold} strokeWidth={1.6} strokeLinecap="round" />
              </G>
            ) : null}
            <Circle cx={p.x} cy={p.y} r={r} fill={c} />
          </G>
        );
      })}
    </G>
  );
});

/** Faint background stars. Fixed positions, so it never re-renders. */
export const Starfield = memo(function Starfield({ w, h, count = 70 }: { w: number; h: number; count?: number }) {
  const r = rng(2026);
  return (
    <G>
      {Array.from({ length: count }, (_, i) => (
        <Circle key={i} cx={r() * w} cy={r() * h} r={0.5 + r() * 1.1} fill={colors.ink} opacity={0.12 + r() * 0.3} />
      ))}
    </G>
  );
});
