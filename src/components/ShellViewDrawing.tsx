import React from 'react';
import { ShellGeometry, formatDim } from '../utils/shellModel';

export type GeneratedView = 'FRONT' | 'TOP' | 'SIDE';
export type PlanShape = 'square' | 'round';

interface ShellViewDrawingProps {
  view: GeneratedView;
  g: ShellGeometry;
  /** Reference geometry: dimensions that differ from it are drawn amber. */
  cmp?: ShellGeometry;
  /** shell dimension id -> pin number shown in the table */
  numberById: Record<string, number>;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  /** 0..1 opacity of the shell outline (0 = dimensions only, for overlaying on a pasted image). */
  geomOpacity?: number;
  /** white halo behind text so numbers stay readable on top of a pasted drawing. */
  halo?: boolean;
  /** print "(was X)" next to every dimension that changed against `cmp`. */
  showWas?: boolean;
  /** 'main' = the headline dimensions only (like the front diagram); 'all' = every dimension of the view. */
  dimSet?: 'main' | 'all';
  /** TOP view section: square (box shell) or round. */
  plan?: PlanShape;
  /** outline drawn dashed grey underneath (e.g. the reference shell behind the required one). */
  ghost?: ShellGeometry;
  /** a geometry that must also fit in the frame (so a larger ghost is never clipped). */
  extent?: ShellGeometry;
  /** internal: draw only outlines (used for the ghost layer) */
  geomOnly?: boolean;
  ghostStyle?: boolean;
  vbOverride?: [number, number, number, number];
}

const HOV = '#2563eb';
const CHG = '#d97706';
const NORM = '#334155';
const GHOST = '#94a3b8';
const noop = () => {};

type Ext = [x: number, y1: number, y2: number];

const SvgRoot: React.FC<{ vb: [number, number, number, number]; nested: boolean; label: string; children: React.ReactNode }> = ({ vb, nested, label, children }) =>
  nested ? (
    <svg x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} viewBox={vb.join(' ')} fontFamily="ui-monospace, Menlo, Consolas, monospace">
      {children}
    </svg>
  ) : (
    <svg viewBox={vb.join(' ')} className="w-full h-full" fontFamily="ui-monospace, Menlo, Consolas, monospace" role="img" aria-label={label}>
      {children}
    </svg>
  );

/** Generated front / plan / side views of the shell, with every dimension of that view marked. */
export const ShellViewDrawing: React.FC<ShellViewDrawingProps> = ({
  view,
  g,
  cmp,
  numberById,
  hoveredId,
  onHover,
  geomOpacity = 1,
  halo = false,
  showWas = false,
  dimSet = 'all',
  plan = 'square',
  ghost,
  extent,
  geomOnly = false,
  ghostStyle = false,
  vbOverride,
}) => {
  // Annotation unit: scaled up so numbers and text stay readable when the whole shell is fitted into a small card.
  const U = (g.flange / 2580) * 2.2;
  const fs = 32 * U;
  const tp = (halo ? { stroke: '#fff', strokeWidth: 7 * U, paintOrder: 'stroke', strokeLinejoin: 'round' } : {}) as React.SVGProps<SVGTextElement>;
  // layout geometry: the larger of the shown one and anything else that must fit
  const L = extent && extent.flange > g.flange ? extent : g;
  const LR = L.flange / 2;
  const Llip = 0.19 * L.spout_w;

  const isCh = (id: string) => !!cmp && Math.abs(g[id] - cmp[id]) > 0.004;
  const col = (id: string) => (hoveredId === id ? HOV : isCh(id) ? CHG : NORM);
  const arrow = (id: string) => (hoveredId === id ? 'url(#svArrH)' : isCh(id) ? 'url(#svArrC)' : 'url(#svArrN)');
  const lw = (id: string) => (hoveredId === id ? 2.8 : 1.5) * U;
  const txtW = (s: string) => s.length * fs * 0.62;
  const wasOf = (id: string) => (showWas && isCh(id) ? `  (was ${formatDim(cmp![id], 2)})` : '');
  const wasNode = (id: string) =>
    wasOf(id) ? (
      <tspan fontSize={fs * 0.72} fill="#64748b" fontWeight={400}>
        {wasOf(id)}
      </tspan>
    ) : null;

  const badge = (id: string, cx: number, cy: number) => {
    const n = numberById[id];
    if (!n) return null;
    return (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={15 * U} fill={col(id)} />
        <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={16 * U} fill="#fff" fontWeight={700}>
          {n}
        </text>
      </g>
    );
  };

  const main = dimSet === 'main';
  const MAIN: Record<GeneratedView, string[]> = {
    FRONT: ['top_inner', 'ring', 'flange', 'spout_w', 'h_shell', 'h_total', 'cone_h', 'tier1', 'tier2', 'tier3', 'cavity', 'duct_array', 'base_clear', 'base_w'],
    SIDE: ['top_inner', 'ring', 'flange', 'spout_h', 'h_shell', 'h_total', 'cone_h', 'tier1', 'tier2', 'tier3', 'cavity', 'duct_array', 'base_clear', 'base_w'],
    TOP: ['flange', 'ring', 'top_inner', 'body_od', 'cavity', 'base_w', 'spout_w', 'pipe_proj'],
  };
  const shown = (id: string) => !main || MAIN[view].includes(id);

  /** Pulsing point marking the dimension under the cursor. */
  const pin = (id: string, cx: number, cy: number) =>
    hoveredId === id ? (
      <g pointerEvents="none">
        <circle cx={cx} cy={cy} r={14 * U} fill={HOV} opacity={0.4}>
          <animate attributeName="r" values={`${12 * U};${46 * U};${12 * U}`} dur="1.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="1.3s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={10 * U} fill={HOV} stroke="#fff" strokeWidth={3.5 * U} />
      </g>
    ) : null;

  const wrap = (id: string, children: React.ReactNode) =>
    geomOnly || !shown(id) ? null : (
      <g key={id} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
        {children}
      </g>
    );

  const extLines = (id: string, ext?: Ext[]) =>
    ext?.map(([x, y1, y2], i) => <line key={`${id}-e${i}`} x1={x} y1={y1} x2={x} y2={y2} stroke={col(id)} strokeWidth={U} opacity={0.5} />);

  /** Horizontal dimension. `left` puts the label to the left of the span (for short spans). */
  const dimH = (id: string, x1: number, x2: number, y: number, o: { ext?: Ext[]; left?: boolean; right?: boolean } = {}) => {
    const s = formatDim(g[id], 2);
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    const mid = (x1 + x2) / 2;
    const tw = txtW(s + wasOf(id));
    return wrap(
      id,
      <>
        {extLines(id, o.ext)}
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={col(id)} strokeWidth={lw(id)} markerStart={arrow(id)} markerEnd={arrow(id)} />
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={18 * U} />
        {pin(id, mid, y)}
        {o.left ? (
          <>
            <text x={lo - 38 * U} y={y} dy="0.35em" textAnchor="end" fontSize={fs} {...tp} fill={col(id)} fontWeight={hoveredId === id || isCh(id) ? 700 : 400}>
              {s}{wasNode(id)}
            </text>
            {badge(id, lo - 18 * U, y)}
          </>
        ) : o.right ? (
          <>
            <text x={hi + 38 * U} y={y} dy="0.35em" textAnchor="start" fontSize={fs} {...tp} fill={col(id)} fontWeight={hoveredId === id || isCh(id) ? 700 : 400}>
              {s}{wasNode(id)}
            </text>
            {badge(id, hi + 18 * U, y)}
          </>
        ) : (
          <>
            <text x={mid} y={y - 10 * U} textAnchor="middle" fontSize={fs} {...tp} fill={col(id)} fontWeight={hoveredId === id || isCh(id) ? 700 : 400}>
              {s}{wasNode(id)}
            </text>
            {badge(id, mid - tw / 2 - 20 * U, y - 10 * U - fs * 0.33)}
          </>
        )}
      </>
    );
  };

  /** Vertical dimension. rot = rotated label centred on the line (long spans); otherwise a horizontal label beside it. */
  const dimV = (id: string, x: number, y1: number, y2: number, side: 'L' | 'R', o: { ext?: Ext[]; rot?: boolean } = {}) => {
    const s = formatDim(g[id], 2);
    const my = (y1 + y2) / 2;
    const sign = side === 'R' ? 1 : -1;
    const tw = txtW(s + wasOf(id));
    return wrap(
      id,
      <>
        {o.ext?.map(([y, xa, xb], i) => (
          <line key={`${id}-h${i}`} x1={xa} y1={y} x2={xb} y2={y} stroke={col(id)} strokeWidth={U} opacity={0.5} />
        ))}
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={col(id)} strokeWidth={lw(id)} markerStart={arrow(id)} markerEnd={arrow(id)} />
        <line x1={x} y1={y1} x2={x} y2={y2} stroke="transparent" strokeWidth={18 * U} />
        {pin(id, x, my)}
        {o.rot ? (
          <>
            <text
              transform={`translate(${x - 10 * U} ${my}) rotate(-90)`}
              textAnchor="middle"
              fontSize={fs}
              {...tp}
              fill={col(id)}
              fontWeight={hoveredId === id || isCh(id) ? 700 : 400}
            >
              {s}{wasNode(id)}
            </text>
            {badge(id, x - 10 * U - fs * 0.33, my + tw / 2 + 22 * U)}
          </>
        ) : (
          <>
            <text
              x={x + sign * 38 * U}
              y={my}
              dy="0.35em"
              textAnchor={side === 'R' ? 'start' : 'end'}
              fontSize={fs}
              {...tp}
              fill={col(id)}
              fontWeight={hoveredId === id || isCh(id) ? 700 : 400}
            >
              {s}{wasNode(id)}
            </text>
            {badge(id, x + sign * 18 * U, my)}
          </>
        )}
      </>
    );
  };

  const defs = (
    <defs>
      {[
        ['svArrN', NORM],
        ['svArrC', CHG],
        ['svArrH', HOV],
      ].map(([mid, c]) => (
        <marker key={mid} id={mid} viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={16 * U} markerHeight={16 * U} orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill={c} />
        </marker>
      ))}
    </defs>
  );

  const line = ghostStyle
    ? { stroke: GHOST, strokeWidth: 2.2 * U, fill: 'none', strokeLinejoin: 'round' as const, strokeDasharray: `${16 * U} ${10 * U}` }
    : { stroke: '#0f172a', strokeWidth: 2.4 * U, fill: 'none', strokeLinejoin: 'round' as const };
  const hid = { stroke: ghostStyle ? GHOST : '#64748b', strokeWidth: 1.6 * U, fill: 'none', strokeDasharray: `${14 * U} ${9 * U}` };
  const lip = 0.19 * g.spout_w;
  const wt = 0.56 * g.spout_w;
  const fillSpout = ghostStyle ? 'none' : '#fff';
  const ghostLayer = (vb: [number, number, number, number]) =>
    ghost && !geomOnly ? (
      <ShellViewDrawing view={view} g={ghost} numberById={{}} hoveredId={null} onHover={noop} plan={plan} geomOnly ghostStyle vbOverride={vb} />
    ) : null;

  // ============================ shared: rib / panel layout ============================
  // e_out R e_in R p R p ... p R e_in R e_out   (closes to the casing width)
  const ribs: { x: number }[] = [];
  {
    let x = -g.top_inner / 2 + g.edge_out;
    const push = () => {
      ribs.push({ x });
      x += g.t_rib;
    };
    push();
    x += g.edge_in;
    push();
    for (let i = 0; i < g.panel_count; i++) {
      x += g.panel_pitch;
      push();
    }
    x += g.edge_in;
    push();
  }
  const down = (xs: number[], yFrom: number, yTo: number): Ext[] => xs.map((x) => [x, yFrom, yTo] as Ext);
  const wasPad = showWas && cmp ? 230 * U : 0; // extra frame width for the "(was X)" text

  // ============================ TOP (plan) ============================
  // Orthographic convention: the plan sits above the front view, so the FRONT face (where the spout is) is the
  // bottom of the plan. Dimension rows therefore go on the far (top) side.
  if (view === 'TOP') {
    const sq = plan === 'square';
    const R = g.flange / 2;
    const rIn = g.top_inner / 2; // centre -> casing edge at the spout
    const topY = (w: number) => (sq ? -w / 2 : 0); // where a side edge starts (extension lines, far side)
    const botY = (w: number) => (sq ? w / 2 : 0); // ... near (front) side
    const shape = (w: number, p: Record<string, unknown>) =>
      sq ? <rect x={-w / 2} y={-w / 2} width={w} height={w} {...p} /> : <circle r={w / 2} {...p} />;
    const gap = 66 * U;
    const nPanelRows = main ? 0 : 5;
    const yP = (i: number) => -(R + 60 * U + i * gap); // panel rows (far side, one dimension per row)
    const yB = -(R + 60 * U + nPanelRows * gap + (main ? 30 * U : 0)); // first width row (far side)
    const rows = ['cavity', 'base_w', 'top_inner', 'body_od', 'ring', 'flange'].sort((a, b) => g[a] - g[b]);
    const yT1 = R + 50 * U; // flange overhang / pipe rows (front side, beside the spout)
    const yT2 = R + 116 * U;
    const yT3 = R + 182 * U;
    const ySp = R + lip + 70 * U; // spout width row (front side)
    const vb: [number, number, number, number] = (() => {
      const x = -(LR + 250 * U) - wasPad;
      const top = -(LR + 60 * U + nPanelRows * gap + (main ? 30 * U : 0) + rows.length * gap + 40 * U);
      const bottom = Math.max(LR + (main ? 50 : 182) * U, LR + Llip + 70 * U) + 80 * U;
      return [x, top, 2 * (LR + 250 * U) + 2 * wasPad, bottom - top];
    })();
    const V = vbOverride ?? vb;
    const bo = g.body_od / 2;
    const ti = g.top_inner / 2;

    return (
      <SvgRoot vb={V} nested={!!vbOverride} label={`Generated top plan view (${plan})`}>
        {defs}
        {ghostLayer(V)}
        <g opacity={geomOpacity}>
          {/* hidden: body, rib plates in the step between casing and body, base plate, water pipe */}
          {shape(g.body_od, hid)}
          {shape(g.base_w, hid)}
          {sq && (
            <g stroke={ghostStyle ? GHOST : '#475569'} strokeWidth={1.2 * U} fill="none">
              {ribs.map((r, i) => (
                <React.Fragment key={`pr${i}`}>
                  <rect x={r.x} y={ti} width={g.t_rib} height={g.body_step} />
                  <rect x={r.x} y={-bo} width={g.t_rib} height={g.body_step} />
                  <rect x={ti} y={r.x} width={g.body_step} height={g.t_rib} />
                  <rect x={-bo} y={r.x} width={g.body_step} height={g.t_rib} />
                </React.Fragment>
              ))}
            </g>
          )}
          <rect x={g.base_w / 2} y={-14 * U} width={g.pipe_proj} height={28 * U} {...hid} />
          {/* visible: flange plate, sloped faces up to the rim, rim plate, casing top, cavity */}
          {shape(g.flange, line)}
          {sq && (
            <g {...line} strokeWidth={1.5 * U}>
              {[-1, 1].flatMap((sx) =>
                [-1, 1].map((sy) => (
                  <line key={`hip${sx}${sy}`} x1={(sx * g.ring) / 2} y1={(sy * g.ring) / 2} x2={(sx * g.flange) / 2} y2={(sy * g.flange) / 2} />
                ))
              )}
            </g>
          )}
          {shape(g.ring, { ...line, strokeWidth: 1.8 * U })}
          {shape(g.top_inner, { ...line, strokeWidth: 1.6 * U })}
          {shape(g.cavity, { ...line, strokeWidth: 1.4 * U })}
          {/* pouring spout on the front face (towards the bottom of the plan) */}
          <polygon points={`${-g.spout_w / 2},${rIn} ${-wt / 2},${R + lip} ${wt / 2},${R + lip} ${g.spout_w / 2},${rIn}`} {...line} fill={fillSpout} />
          <rect x={-0.08 * g.spout_w} y={R + lip - 0.07 * g.spout_w} width={0.16 * g.spout_w} height={0.07 * g.spout_w} {...line} strokeWidth={1.4 * U} />
          {!ghostStyle && (
            <>
              <line x1={-R - 40 * U} y1={0} x2={R + 40 * U} y2={0} stroke="#94a3b8" strokeWidth={U} strokeDasharray={`${30 * U} ${8 * U} ${6 * U} ${8 * U}`} />
              <line x1={0} y1={-R - 20 * U} x2={0} y2={R + lip + 20 * U} stroke="#94a3b8" strokeWidth={U} strokeDasharray={`${30 * U} ${8 * U} ${6 * U} ${8 * U}`} />
            </>
          )}
        </g>

        {/* panel row along the far side (same layout as the front view) */}
        {dimH('edge_out', -ti, ribs[0].x, yP(0), { ext: down([-ti, ribs[0].x], -bo, yP(0) - 8 * U) })}
        {dimH('edge_in', ribs[0].x + g.t_rib, ribs[1].x, yP(1), { ext: down([ribs[0].x + g.t_rib, ribs[1].x], -bo, yP(1) - 8 * U) })}
        {dimH('panel_pitch', ribs[1].x + g.t_rib, ribs[2].x, yP(2), { ext: down([ribs[1].x + g.t_rib, ribs[2].x], -bo, yP(2) - 8 * U) })}
        {dimH('t_rib', ribs[2].x, ribs[2].x + g.t_rib, yP(3), { right: true, ext: down([ribs[2].x, ribs[2].x + g.t_rib], -bo, yP(3) - 8 * U) })}
        {dimH('panel_count', ribs[1].x + g.t_rib, ribs[g.panel_count + 1].x, yP(4), { ext: down([ribs[1].x + g.t_rib, ribs[g.panel_count + 1].x], -bo, yP(4) - 8 * U) })}

        {/* width rows on the far side, smallest nearest the plan */}
        {rows.map((id, i) =>
          dimH(id, -g[id] / 2, g[id] / 2, yB - i * gap, {
            ext: [
              [-g[id] / 2, topY(g[id]), yB - i * gap - 8 * U],
              [g[id] / 2, topY(g[id]), yB - i * gap - 8 * U],
            ],
          })
        )}
        {dimH('spout_w', -g.spout_w / 2, g.spout_w / 2, ySp, { ext: [[-g.spout_w / 2, rIn, ySp + 8 * U], [g.spout_w / 2, rIn, ySp + 8 * U]] })}
        {dimH('overhang', -R, -g.ring / 2, yT1, { left: true, ext: [[-R, botY(g.flange), yT1 + 8 * U], [-g.ring / 2, botY(g.ring), yT1 + 8 * U]] })}
        {dimH('ring_step', -g.ring / 2, -g.top_inner / 2, yT2, { left: true, ext: [[-g.ring / 2, botY(g.ring), yT2 + 8 * U], [-g.top_inner / 2, botY(g.top_inner), yT2 + 8 * U]] })}
        {dimH('body_step', -g.body_od / 2, -g.top_inner / 2, yT3, { left: true, ext: [[-g.body_od / 2, botY(g.body_od), yT3 + 8 * U], [-g.top_inner / 2, botY(g.top_inner), yT3 + 8 * U]] })}
        {dimH('pipe_proj', g.base_w / 2, g.base_w / 2 + g.pipe_proj, yT1, { ext: [[g.base_w / 2, 14 * U, yT1 + 8 * U], [g.base_w / 2 + g.pipe_proj, 14 * U, yT1 + 8 * U]] })}
      </SvgRoot>
    );
  }

  // ============================ FRONT / SIDE elevation (same drawing; the spout differs) ============================
  const isSide = view === 'SIDE';
  const ya = g.h_shell;
  const yb = ya + g.t_ring;
  const yd = yb + g.duct_h;
  const ydT = yd + g.t_base;
  const y1 = g.cone_h + g.tier1;
  const y2 = y1 + g.t_spacer + g.tier2;
  const tiersEnd = g.cone_h + g.h_tiers;
  const Hmax = Math.max(ydT, L.h_total);
  const edgeX = (y: number) => (y <= g.cone_h ? g.ring / 2 + ((g.flange - g.ring) / 2) * (Math.max(0, y) / g.cone_h) : g.body_od / 2);
  const chain: [string, number, number][] = [
    ['t_top', -g.t_top, 0],
    ['cone_h', 0, g.cone_h],
    ['tier1', g.cone_h, y1],
    ['t_spacer', y1, y1 + g.t_spacer],
    ['tier2', y1 + g.t_spacer, y2],
    ['tier3', y2 + g.t_spacer, tiersEnd],
    ['t_ring', tiersEnd, tiersEnd + g.t_ring],
    ['duct_h', yb, yd],
    ['t_base', yd, ydT],
  ];
  const xL1 = -(g.flange / 2 + 80 * U);
  const xL2 = -(g.flange / 2 + 170 * U);
  const xL3 = -(g.flange / 2 + 260 * U);

  const centres: number[] = [];
  for (let i = 1; i < 1 + g.panel_count; i++) centres.push((ribs[i].x + g.t_rib + ribs[i + 1].x) / 2);
  const tierMid = [g.cone_h + g.tier1 / 2, g.cone_h + g.tier1 + g.t_spacer + g.tier2 / 2, y2 + g.t_spacer + g.tier3 / 2];
  const ductStart = -g.duct_array / 2;
  const sc = '#475569';

  // spout seen edge-on (side) sits on the cone face; seen face-on (front) it is the 540 box
  const spX0 = g.ring / 2 + ((g.flange - g.ring) / 2) * Math.min(1, g.spout_h / g.cone_h) + 6 * U;
  const spX1 = spX0 + 1.6 * lip;

  const gap = 70 * U;
  const base = -(lip + 110 * U);
  const yIn = base;
  const yRing = base - gap;
  const yFl = base - 2 * gap;
  const yOv = base - 3 * gap;
  const yRs = base - 4 * gap;
  const ySp = -lip - 36 * U;
  // Panel rows (one dimension per row so long "(was …)" labels never collide) and the three cavity dimensions are
  // stacked inside the shell body; the spacing shrinks when the shell is low.
  const fz = Math.max(0.55, Math.min(1, (g.h_shell - g.cone_h) / (470 * U)));
  const yPr = (i: number) => g.cone_h + 50 * U * fz + i * 40 * U * fz;
  const yCav = (i: number) => yPr(5) + 40 * U * fz + i * 64 * U * fz;
  const yBot = ydT + 80 * U;
  // main set: only the duct array (3), base clear (5) and base width (6) rows exist, so close up the gaps
  const bot = (i: number) => yBot + (main ? ({ 3: 0, 5: 1, 6: 2 } as Record<number, number>)[i] ?? i : i) * gap;
  const nTop = main ? 2 : 4;
  const nBot = main ? 2 : 6;
  const xCh = isSide ? Math.max(g.flange / 2 + 90 * U, spX1 + 170 * U) : g.flange / 2 + 90 * U;
  const vb: [number, number, number, number] = (() => {
    const x = -(LR + 340 * U) - wasPad;
    const r = Math.max(xCh + 170 * U, LR + 260 * U) + wasPad;
    const y = -(Math.max(lip, Llip) + 110 * U) - nTop * gap - 60 * U;
    return [x, y, r - x, Hmax + 80 * U + nBot * gap + 60 * U - y];
  })();
  const V = vbOverride ?? vb;

  const hol = (id: string, x: number, y: number, tx: number, ty: number, text: string) =>
    wrap(
      id,
      <>
        <polyline points={`${x},${y} ${tx - 6 * U},${ty}`} fill="none" stroke={col(id)} strokeWidth={lw(id)} />
        <circle cx={x} cy={y} r={7 * U} fill="none" stroke={col(id)} strokeWidth={lw(id)} />
        {pin(id, x, y)}
        <text x={tx} y={ty} dy="0.35em" fontSize={fs} {...tp} fill={col(id)} fontWeight={hoveredId === id ? 700 : 400}>
          {text}
        </text>
        {badge(id, tx - 22 * U, ty)}
      </>
    );

  return (
    <SvgRoot vb={V} nested={!!vbOverride} label={isSide ? 'Generated side elevation' : 'Generated front elevation'}>
      {defs}
      {ghostLayer(V)}
      <g opacity={geomOpacity}>
        {/* silhouette */}
        <rect x={-g.ring / 2} y={-g.t_top} width={g.ring} height={g.t_top} {...line} />
        <polygon points={`${-g.ring / 2},0 ${g.ring / 2},0 ${g.flange / 2},${g.cone_h} ${-g.flange / 2},${g.cone_h}`} {...line} />
        <rect x={-g.body_od / 2} y={g.cone_h} width={g.body_od} height={ya - g.cone_h} {...line} />
        <rect x={-g.body_od / 2} y={y1} width={g.body_od} height={g.t_spacer} {...line} />
        <rect x={-g.body_od / 2} y={y2} width={g.body_od} height={g.t_spacer} {...line} />
        <rect x={-g.body_od / 2} y={ya} width={g.body_od} height={g.t_ring} {...line} />
        <polygon points={`${-g.body_od / 2},${yb} ${g.body_od / 2},${yb} ${g.base_w / 2},${yd} ${-g.base_w / 2},${yd}`} {...line} />
        <rect x={-g.base_w / 2} y={yd} width={g.base_w} height={g.t_base} {...line} />
        {isSide ? (
          <>
            {/* water pipe seen end-on */}
            <circle cx={0} cy={yd + g.t_base / 2} r={Math.max(9 * U, g.t_base * 0.32)} {...line} strokeWidth={1.6 * U} />
            {/* spout in profile */}
            <polygon
              points={`${g.ring / 2},${-lip} ${spX1},${-lip} ${spX1},${g.spout_h * 0.35} ${spX0 + 0.5 * lip},${g.spout_h} ${spX0 - 6 * U},${g.spout_h} ${g.ring / 2},0`}
              {...line}
              fill={fillSpout}
            />
          </>
        ) : (
          <>
            <rect x={g.base_w / 2} y={yd + g.t_base * 0.2} width={g.pipe_proj} height={Math.max(8 * U, g.t_base * 0.55)} {...line} strokeWidth={1.6 * U} />
            <polygon points={`${-g.spout_w / 2},${g.spout_h} ${-g.spout_w / 2},0 ${-wt / 2},${-lip} ${wt / 2},${-lip} ${g.spout_w / 2},0 ${g.spout_w / 2},${g.spout_h}`} {...line} fill={fillSpout} />
            <rect x={-0.08 * g.spout_w} y={-lip} width={0.16 * g.spout_w} height={0.07 * g.spout_w} {...line} strokeWidth={1.4 * U} />
          </>
        )}
        {!ghostStyle && (
          <>
            {/* panel ribs, vents, duct ribs (the same four-sided panel layout is seen from either face) */}
            <g stroke={sc} strokeWidth={1.3 * U} fill="none">
              {ribs.map((r, i) => (
                <rect key={`r${i}`} x={r.x} y={0} width={g.t_rib} height={tiersEnd} />
              ))}
              {tierMid.map((y, ti) => centres.map((cx, ci) => <circle key={`v${ti}-${ci}`} cx={cx} cy={y} r={5 * U} fill={sc} stroke="none" />))}
              {Array.from({ length: g.duct_count + 1 }).map((_, i) => (
                <rect key={`d${i}`} x={ductStart + i * g.duct_pitch - (i === g.duct_count ? g.t_duct_rib : 0)} y={yb} width={g.t_duct_rib} height={g.duct_h} />
              ))}
            </g>
            <line x1={0} y1={-lip - 20 * U} x2={0} y2={ydT + 30 * U} stroke="#94a3b8" strokeWidth={U} strokeDasharray={`${30 * U} ${8 * U} ${6 * U} ${8 * U}`} />
          </>
        )}
      </g>

      {/* ---- top rows ---- */}
      {!isSide && dimH('spout_w', -g.spout_w / 2, g.spout_w / 2, ySp, { ext: down([-g.spout_w / 2, g.spout_w / 2], -lip, ySp - 8 * U) })}
      {dimH('top_inner', -g.top_inner / 2, g.top_inner / 2, yIn, { ext: down([-g.top_inner / 2, g.top_inner / 2], 0, yIn - 8 * U) })}
      {dimH('ring', -g.ring / 2, g.ring / 2, yRing, { ext: down([-g.ring / 2, g.ring / 2], -g.t_top, yRing - 8 * U) })}
      {dimH('flange', -g.flange / 2, g.flange / 2, yFl, { ext: down([-g.flange / 2, g.flange / 2], g.cone_h, yFl - 8 * U) })}
      {dimH('overhang', -g.flange / 2, -g.ring / 2, yOv, { left: true, ext: down([-g.flange / 2, -g.ring / 2], g.cone_h, yOv - 8 * U) })}
      {dimH('ring_step', -g.ring / 2, -g.top_inner / 2, yRs, { left: true, ext: down([-g.ring / 2, -g.top_inner / 2], 0, yRs - 8 * U) })}
      {isSide
        ? dimV('spout_h', spX1 + 110 * U, 0, g.spout_h, 'R', { rot: true, ext: [[0, spX1 + 6 * U, spX1 + 118 * U], [g.spout_h, spX0 + 0.5 * lip + 6 * U, spX1 + 118 * U]] })
        : dimV('spout_h', -g.spout_w / 2 - 70 * U, 0, g.spout_h, 'L', { ext: [[0, -g.spout_w / 2 - 78 * U, -g.spout_w / 2], [g.spout_h, -g.spout_w / 2 - 78 * U, -g.spout_w / 2]] })}

      {/* ---- panel rows (under the flange) ---- */}
      {dimH('edge_out', -g.top_inner / 2, ribs[0].x, yPr(0), { ext: down([-g.top_inner / 2, ribs[0].x], g.cone_h, yPr(0) + 8 * U) })}
      {dimH('edge_in', ribs[0].x + g.t_rib, ribs[1].x, yPr(1), { ext: down([ribs[0].x + g.t_rib, ribs[1].x], g.cone_h, yPr(1) + 8 * U) })}
      {dimH('panel_pitch', ribs[1].x + g.t_rib, ribs[2].x, yPr(2), { ext: down([ribs[1].x + g.t_rib, ribs[2].x], g.cone_h, yPr(2) + 8 * U) })}
      {dimH('body_step', -g.body_od / 2, -g.top_inner / 2, yPr(3), { right: true, ext: down([-g.body_od / 2, -g.top_inner / 2], g.cone_h, yPr(3) + 8 * U) })}
      {dimH('t_rib', ribs[2].x, ribs[2].x + g.t_rib, yPr(4), { left: true, ext: down([ribs[2].x, ribs[2].x + g.t_rib], g.cone_h, yPr(4) + 8 * U) })}
      {dimH('panel_count', ribs[1].x + g.t_rib, ribs[g.panel_count + 1].x, yPr(4), { ext: down([ribs[1].x + g.t_rib, ribs[g.panel_count + 1].x], g.cone_h, yPr(4) + 8 * U) })}
      {dimH('body_od', -g.body_od / 2, g.body_od / 2, yPr(5), {})}
      {hol('vent_dia', centres[centres.length - 1], tierMid[0], centres[centres.length - 1] - txtW(`Ø${formatDim(g.vent_dia, 2)} vent`) - 110 * U, tierMid[0] - 70 * U, `Ø${formatDim(g.vent_dia, 2)} vent`)}

      {/* ---- left chains ---- */}
      {dimV('h_shell', xL1, 0, g.h_shell, 'L', { rot: true, ext: [[0, xL1 - 8 * U, -g.ring / 2], [g.h_shell, xL1 - 8 * U, -g.body_od / 2]] })}
      {dimV('h_total', xL2, 0, ydT, 'L', { rot: true, ext: [[ydT, xL2 - 8 * U, -g.base_w / 2]] })}
      {dimV('h_tiers', xL3, g.cone_h, tiersEnd, 'L', { rot: true, ext: [[g.cone_h, xL3 - 8 * U, -g.flange / 2], [tiersEnd, xL3 - 8 * U, -g.body_od / 2]] })}
      {dimV('allow', xL3, g.h_shell - g.allow, g.h_shell, 'L', { ext: [[g.h_shell - g.allow, xL3 - 8 * U, -g.body_od / 2]] })}

      {/* ---- right chain ---- */}
      {chain.map(([id, a, b]) =>
        dimV(id, xCh, a, b, 'R', {
          ext: [
            [a, edgeX(a) + 8 * U, xCh + 8 * U],
            [b, edgeX(b) + 8 * U, xCh + 8 * U],
          ],
        })
      )}

      {/* ---- inside: cavity ---- */}
      {dimH('clear_off', -g.cavity / 2, -g.cavity / 2 + g.clear_off, yCav(0), { right: true })}
      {dimH('cavity_clear', -g.cavity_clear / 2, g.cavity_clear / 2, yCav(1), {})}
      {dimH('cavity', -g.cavity / 2, g.cavity / 2, main ? g.h_shell - 44 * U : yCav(2), {})}

      {/* ---- bottom rows ---- */}
      {dimH('t_duct_rib', ductStart, ductStart + g.t_duct_rib, bot(0), { left: true, ext: down([ductStart, ductStart + g.t_duct_rib], yd, bot(0) + 8 * U) })}
      {dimH('duct_gap', ductStart + g.t_duct_rib, ductStart + g.duct_pitch, bot(0), { ext: down([ductStart + g.duct_pitch], yd, bot(0) + 8 * U) })}
      {dimH('duct_pitch', ductStart, ductStart + g.duct_pitch, bot(1), { ext: down([ductStart, ductStart + g.duct_pitch], yd, bot(1) + 8 * U) })}
      {dimH('base_edge', -g.base_w / 2, -g.base_w / 2 + g.base_edge, bot(2), { left: true, ext: down([-g.base_w / 2, -g.base_w / 2 + g.base_edge], ydT, bot(2) + 8 * U) })}
      {dimH('duct_side', -g.base_w / 2 + g.base_edge, -g.base_w / 2 + g.base_edge + g.duct_side, bot(2), { ext: down([-g.base_w / 2 + g.base_edge + g.duct_side], ydT, bot(2) + 8 * U) })}
      {dimH('duct_array', -g.duct_array / 2, g.duct_array / 2, bot(3), { ext: down([-g.duct_array / 2, g.duct_array / 2], yd, bot(3) + 8 * U) })}
      {dimH('duct_count', -g.duct_array / 2, g.duct_array / 2, bot(4), {})}
      {dimH('base_margin', -g.base_w / 2, -g.base_clear / 2, bot(5), { ext: down([-g.base_clear / 2], ydT, bot(5) + 8 * U) })}
      {dimH('base_clear', -g.base_clear / 2, g.base_clear / 2, bot(5), { ext: down([g.base_clear / 2], ydT, bot(5) + 8 * U) })}
      {!isSide && dimH('pipe_proj', g.base_w / 2, g.base_w / 2 + g.pipe_proj, bot(5), { ext: down([g.base_w / 2 + g.pipe_proj], yd, bot(5) + 8 * U) })}
      {dimH('base_w', -g.base_w / 2, g.base_w / 2, bot(6), { ext: down([-g.base_w / 2, g.base_w / 2], ydT, bot(6) + 8 * U) })}
    </SvgRoot>
  );
};
