import type { ReactNode } from 'react';
import type { GeoToolId } from '../core/geometry/tools';

// ציורים קטנים לכפתורי הגיאומטריה – כל ציור מראה את הצורה/הבנייה של הכלי.
// (SVG פשוט, בצבע הטקסט של הכפתור – מתאים גם למצב כהה)

/** נקודה */
const P = (x: number, y: number, filled = true) => (
  <circle
    cx={x}
    cy={y}
    r={1.8}
    fill={filled ? 'currentColor' : 'var(--tb-surface)'}
    stroke="currentColor"
    strokeWidth={1.2}
  />
);

const ICONS: Record<GeoToolId, ReactNode> = {
  move: (
    <>
      <path d="M5 4 L5 17 L8.5 13.5 L11 19 L13 18 L10.5 12.5 L15 12.5 Z" fill="none" />
    </>
  ),
  point: (
    <>
      <circle cx={12} cy={12} r={3} fill="currentColor" />
    </>
  ),
  segment: (
    <>
      <path d="M5 17 L19 7" />
      {P(5, 17)}
      {P(19, 7)}
    </>
  ),
  line: (
    <>
      <path d="M2 19 L22 5" />
      {P(8, 14.8)}
      {P(16, 9.2)}
    </>
  ),
  ray: (
    <>
      <path d="M5 17 L22 5" />
      <path d="M22 5 L18 5.6 M22 5 L20.4 8.6" />
      {P(5, 17)}
    </>
  ),
  polygon: (
    <>
      <path d="M4 18 L9 5 L19 7 L21 16 L11 20 Z" fill="none" />
    </>
  ),
  regularPolygon: (
    <>
      <path d="M12 3 L20.5 9.2 L17.3 19.2 L6.7 19.2 L3.5 9.2 Z" fill="none" />
    </>
  ),
  shape: (
    <>
      <path d="M3 20 L10 20 L6.5 13 Z" fill="none" />
      <path d="M13 20 L21 20 L21 13 L13 13 Z" fill="none" />
      <path d="M8 4 L12 8 L8 12 L4 8 Z" fill="none" />
      <path d="M14.5 10 L19.5 10 L21 5 L16 5 Z" fill="none" />
    </>
  ),
  circle: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      {P(12, 12)}
      {P(19.6, 9.5)}
    </>
  ),
  chord: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      <path d="M5.1 16 L18.9 16" />
      {P(5.1, 16)}
      {P(18.9, 16)}
    </>
  ),
  radius: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      <path d="M12 12 L17.7 6.3" />
      {P(12, 12)}
      {P(17.7, 6.3)}
    </>
  ),
  centralAngle: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      <path d="M4.5 14.7 L12 12 L19.5 14.7" fill="none" />
      <path d="M8.2 13.4 A 4 4 0 0 0 15.8 13.4" fill="none" strokeWidth={1.1} />
      {P(12, 12)}
    </>
  ),
  inscribedAngle: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      <path d="M5.4 16.5 L12 4 L18.6 16.5" fill="none" />
      <path d="M10.6 6.7 A 3 3 0 0 0 13.4 6.7" fill="none" strokeWidth={1.1} />
      {P(12, 4)}
    </>
  ),
  circleR: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      <path d="M12 12 L20 12" />
      {P(12, 12)}
      <text x={14.5} y={10.8} fontSize={7} fontStyle="italic" fill="currentColor" stroke="none">
        r
      </text>
    </>
  ),
  circle3: (
    <>
      <circle cx={12} cy={12} r={8} fill="none" />
      {P(4.5, 9.5)}
      {P(17, 18.2)}
      {P(16, 5)}
    </>
  ),
  arc: (
    <>
      <path d="M5 16 A 8 8 0 0 1 19 16" fill="none" />
      {P(12, 18, false)}
      {P(5, 16)}
      {P(19, 16)}
    </>
  ),
  ellipse: (
    <>
      <ellipse cx={12} cy={12} rx={9} ry={5.5} fill="none" />
      {P(7.5, 12)}
      {P(16.5, 12)}
    </>
  ),
  midpoint: (
    <>
      <path d="M4 16 L20 8" />
      {P(4, 16)}
      {P(20, 8)}
      <circle cx={12} cy={12} r={2.4} fill="var(--tb-accent)" stroke="var(--tb-accent)" />
    </>
  ),
  intersection: (
    <>
      <path d="M4 18 L20 6 M4 6 L20 18" />
      <circle cx={12} cy={12} r={2.4} fill="var(--tb-accent)" stroke="var(--tb-accent)" />
    </>
  ),
  perpendicular: (
    <>
      <path d="M3 18 L21 18 M12 18 L12 3" />
      <path d="M12 15 L15 15 L15 18" fill="none" strokeWidth={1.1} />
    </>
  ),
  parallel: (
    <>
      <path d="M3 9 L21 5 M3 19 L21 15" />
      <path d="M10 7 L12 7.5 L10.6 9 M10 17 L12 17.5 L10.6 19" fill="none" strokeWidth={1.1} />
    </>
  ),
  perpBisector: (
    <>
      <path d="M4 15 L20 15" />
      {P(4, 15)}
      {P(20, 15)}
      <path d="M12 21 L12 3" strokeDasharray="2 2" />
      <path d="M7.5 13.5 L7.5 16.5 M16.5 13.5 L16.5 16.5" strokeWidth={1.1} />
    </>
  ),
  angleBisector: (
    <>
      <path d="M21 19 L4 19 L17 5" fill="none" />
      <path d="M4 19 L21 11" strokeDasharray="2 2" />
      <path d="M9 19 A 5 5 0 0 0 7.6 15.6" fill="none" strokeWidth={1.1} />
    </>
  ),
  median: (
    <>
      <path d="M3 19 L21 19 L10 4 Z" fill="none" />
      <path d="M10 4 L12 19" strokeDasharray="2 2" />
      <circle cx={12} cy={19} r={1.8} fill="var(--tb-accent)" stroke="var(--tb-accent)" />
    </>
  ),
  altitude: (
    <>
      <path d="M3 19 L21 19 L9 4 Z" fill="none" />
      <path d="M9 4 L9 19" strokeDasharray="2 2" />
      <path d="M9 16.5 L11.5 16.5 L11.5 19" fill="none" strokeWidth={1.1} />
    </>
  ),
  tangent: (
    <>
      <circle cx={10} cy={13} r={6} fill="none" />
      <path d="M2 4.5 L22 9.5" />
      {P(8.6, 7.2)}
    </>
  ),
  length: (
    <>
      <path d="M4 15 L20 15" />
      <path d="M4 12 L4 18 M20 12 L20 18" />
      <text x={8.2} y={10} fontSize={6} fill="currentColor" stroke="none">
        cm
      </text>
    </>
  ),
  angle: (
    <>
      <path d="M21 19 L4 19 L16 6" fill="none" />
      <path d="M10.5 19 A 6.5 6.5 0 0 0 8.4 14.3" fill="none" strokeWidth={1.2} />
      <text x={12} y={16.5} fontSize={6} fill="currentColor" stroke="none">
        °
      </text>
    </>
  ),
  area: (
    <>
      <path d="M4 18 L8 5 L20 8 L18 19 Z" fill="currentColor" fillOpacity={0.25} />
      <text x={9.5} y={15} fontSize={7} fill="currentColor" stroke="none">
        S
      </text>
    </>
  ),
  perimeter: (
    <>
      <path d="M4 18 L8 5 L20 8 L18 19 Z" fill="none" strokeWidth={2.2} />
      <text x={9.5} y={15} fontSize={7} fill="currentColor" stroke="none">
        P
      </text>
    </>
  ),
  delete: (
    <>
      <path
        d="M6 7 L18 7 M10 7 L10 4.5 L14 4.5 L14 7 M7.5 7 L8.5 20 L15.5 20 L16.5 7"
        fill="none"
      />
      <path d="M10.5 10.5 L10.5 17 M13.5 10.5 L13.5 17" />
    </>
  ),
};

export function GeoToolIcon({ tool }: { tool: GeoToolId }) {
  return (
    <svg
      className="tb-geo-icon"
      viewBox="0 0 24 24"
      width={36}
      height={36}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[tool]}
    </svg>
  );
}
