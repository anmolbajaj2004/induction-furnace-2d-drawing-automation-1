import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShellGeometry, formatDim } from '../utils/shellModel';
import type { ShellDrawingMode } from './ShellDrawing';
import type { PlanShape } from './ShellViewDrawing';
import { Download, RotateCcw, RotateCw, Play, Pause, Undo2 } from 'lucide-react';

/**
 * ISOMETRIC VIEW of the furnace shell, built from the same parametric geometry as the front / top / side drawings.
 * Nothing is invented: every size comes from the shell geometry (the dimension register). The overall callouts
 * (flange span, total height, base width, water pipe projection) are the register values.
 *
 * The shell can be turned about its vertical axis (drag, slider, buttons or auto-rotate). Faces are culled by their
 * normal, so only the faces that face the viewer are drawn, and the spout / water pipe are ordered front or back.
 *
 * Axes at 0 deg: X to the lower right, Y (front of the shell, where the spout is) to the lower left, Z up.
 *   screen_x = (x' - y') cos 30      screen_y = (x' + y') sin 30 - z      with (x', y') = (x, y) turned by the azimuth
 */

interface ShellIsoDrawingProps {
  req: ShellGeometry;
  ref0: ShellGeometry;
  mode: ShellDrawingMode;
  refCapacity: number;
  targetCapacity: number;
  plan?: PlanShape;
  /** drawing only (no header / footnote), fills its container; used inside the tri-view visualizer */
  compact?: boolean;
  /** starting rotation in degrees (default 0) */
  initialAz?: number;
  /** selected dimension (shell dimension id); controlled by the parent when given */
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  /** shell dimension id -> pin number shown in the table */
  numberById?: Record<string, number>;
  /** shell dimension id -> name shown in the pop-up */
  names?: Record<string, string>;
}

const C30 = Math.cos(Math.PI / 6);
const RX = Math.SQRT2 * C30; // iso circle: horizontal semi-axis = RX * r
const RY = Math.SQRT2 * 0.5; // iso circle: vertical semi-axis   = RY * r
const INK = '#0f172a';
const GHOST = '#94a3b8';
const CHG = '#d97706';
const HOV = '#2563eb';
const DIMC = '#475569';
const FILL = { top: '#f8fafc', left: '#e2e8f0', right: '#cbd5e1', dark: '#94a3b8', opening: '#e5e7eb' };

const fx = (n: number) => Number(n.toFixed(2));
type XY = [number, number];
type XYZ = [number, number, number];
/** project a model point after turning the shell about the vertical axis by az (radians) */
const proj = (az: number, x: number, y: number, z: number): XY => {
  const c = Math.cos(az);
  const s = Math.sin(az);
  const xr = x * c - y * s;
  const yr = x * s + y * c;
  return [fx((xr - yr) * C30), fx((xr + yr) * 0.5 - z)];
};
const poly = (pp: XY[]) => pp.map((p) => `${p[0]},${p[1]}`).join(' ');
// the four side faces of a square section: outward normal in model coordinates
const SIDES: XY[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const STEP = (15 * Math.PI) / 180;

/**
 * One dimension of the register placed in 3D: a segment A-B (model coordinates, z up) drawn with arrows, optional
 * extension lines from the object to the dimension line, or a 'pt' leader (a hole). Placement follows the edge /
 * corner that faces the viewer at the current azimuth, so every dimension stays readable while the shell turns.
 */
export interface IsoDim {
  id: string;
  kind: 'seg' | 'pt';
  A: XYZ;
  B: XYZ;
  ext?: [XYZ, XYZ];
}

/** values shown without selecting them (the headline dimensions) */
const MAIN_IDS = new Set(['flange', 'h_total', 'base_w', 'pipe_proj']);
const COUNT_IDS = new Set(['panel_count', 'duct_count']);

const buildDims = (a: ShellGeometry, az: number, sq: boolean, U: number): IsoDim[] => {
  const c = Math.cos(az);
  const s = Math.sin(az);
  const sy = c - s >= 0 ? 1 : -1; // model +Y or -Y side faces the viewer
  const F = a.flange;
  const B = a.base_w;
  const bo = a.body_od;
  const ti = a.top_inner;
  const lip = 0.19 * a.spout_w;
  const wt = 0.56 * a.spout_w;
  const yb = a.h_shell + a.t_ring;
  const yd = yb + a.duct_h;
  const ydT = yd + a.t_base;
  const y1 = a.cone_h + a.tier1;
  const y2 = y1 + a.t_spacer + a.tier2;
  const tiersEnd = a.cone_h + a.h_tiers;
  const out: IsoDim[] = [];

  const yObj = (w: number) => (sq ? (sy * w) / 2 : 0);
  /** a width running along X on the face nearest the viewer */
  const xd = (id: string, x1: number, x2: number, z: number, wObj: number, off: number, ext = true) => {
    const yy = sy * (wObj / 2 + off);
    out.push({ id, kind: 'seg', A: [x1, yy, z], B: [x2, yy, z], ext: ext ? [[x1, yObj(wObj), z], [x2, yObj(wObj), z]] : undefined });
  };
  /** a height running along Z at the screen-left or screen-right corner */
  const corner = (dir: 'L' | 'R', off: number): [number, number] => {
    let best: XY = [-1, 1];
    let bv = dir === 'L' ? Infinity : -Infinity;
    for (const [sx, sy2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as XY[]) {
      const v = sx * (c - s) - sy2 * (s + c);
      if (dir === 'L' ? v < bv : v > bv) {
        bv = v;
        best = [sx, sy2];
      }
    }
    const r = (F / 2 + off) / (sq ? 1 : Math.SQRT2);
    return [best[0] * r, best[1] * r];
  };
  const zd = (id: string, dir: 'L' | 'R', off: number, d1: number, d2: number) => {
    const [x, y] = corner(dir, off);
    out.push({ id, kind: 'seg', A: [x, y, -d1], B: [x, y, -d2] });
  };

  // ribs of the four-sided panel layout (same as the front / top / side drawings)
  const ribs: number[] = [];
  {
    let x = -ti / 2 + a.edge_out;
    ribs.push(x);
    x += a.t_rib + a.edge_in;
    ribs.push(x);
    for (let i = 0; i < a.panel_count; i++) {
      x += a.t_rib + a.panel_pitch;
      ribs.push(x);
    }
    x += a.t_rib + a.edge_in;
    ribs.push(x);
  }

  // ---- top: overall widths and steps --------------------------------------------------------------
  xd('flange', -F / 2, F / 2, -a.cone_h, F, 200 * U);
  xd('ring', -a.ring / 2, a.ring / 2, 0, a.ring, 120 * U);
  xd('top_inner', -ti / 2, ti / 2, -a.cone_h, bo, 330 * U);
  xd('overhang', -F / 2, -a.ring / 2, -a.cone_h, F, 460 * U);
  xd('ring_step', -a.ring / 2, -ti / 2, 0, a.ring, 260 * U);
  xd('body_step', -bo / 2, -ti / 2, -a.cone_h, bo, 600 * U);
  xd('body_od', -bo / 2, bo / 2, -(a.h_shell - 90 * U), bo, 80 * U);

  // ---- panel row on the body face -----------------------------------------------------------------
  const zp = (i: number) => -(a.cone_h + 70 * U + i * 56 * U);
  xd('edge_out', -ti / 2, ribs[0], zp(0), bo, 38 * U, false);
  xd('edge_in', ribs[0] + a.t_rib, ribs[1], zp(1), bo, 38 * U, false);
  xd('panel_pitch', ribs[1] + a.t_rib, ribs[2], zp(2), bo, 38 * U, false);
  xd('t_rib', ribs[2], ribs[2] + a.t_rib, zp(3), bo, 38 * U, false);
  xd('panel_count', ribs[1] + a.t_rib, ribs[a.panel_count + 1], zp(4), bo, 38 * U, false);
  {
    // air vent: leader from a vent hole on the nearest face
    const cx = (ribs[a.panel_count] + a.t_rib + ribs[a.panel_count + 1]) / 2;
    const zv = -(a.cone_h + a.tier1 / 2);
    const A: XYZ = [cx, sy * (bo / 2), zv];
    out.push({ id: 'vent_dia', kind: 'pt', A, B: [cx - 330 * U, sy * (bo / 2 + 150 * U), zv + 90 * U] });
  }

  // ---- heights ---------------------------------------------------------------------------------------
  zd('h_shell', 'L', 150 * U, 0, a.h_shell);
  zd('h_total', 'L', 250 * U, 0, ydT);
  zd('h_tiers', 'L', 350 * U, a.cone_h, tiersEnd);
  zd('allow', 'L', 350 * U, a.h_shell - a.allow, a.h_shell);
  const chain: [string, number, number][] = [
    ['t_top', -a.t_top, 0],
    ['cone_h', 0, a.cone_h],
    ['tier1', a.cone_h, y1],
    ['t_spacer', y1, y1 + a.t_spacer],
    ['tier2', y1 + a.t_spacer, y2],
    ['tier3', y2 + a.t_spacer, tiersEnd],
    ['t_ring', tiersEnd, tiersEnd + a.t_ring],
    ['duct_h', yb, yd],
    ['t_base', yd, ydT],
  ];
  chain.forEach(([id, d1, d2]) => zd(id, 'R', 150 * U, d1, d2));

  // ---- cavity, drawn across the top face -----------------------------------------------------------------
  const zt = a.t_top;
  out.push({ id: 'cavity', kind: 'seg', A: [-a.cavity / 2, 0, zt], B: [a.cavity / 2, 0, zt] });
  out.push({ id: 'cavity_clear', kind: 'seg', A: [-a.cavity_clear / 2, sy * 90 * U, zt], B: [a.cavity_clear / 2, sy * 90 * U, zt] });
  out.push({ id: 'clear_off', kind: 'seg', A: [-a.cavity / 2, -sy * 90 * U, zt], B: [-a.cavity / 2 + a.clear_off, -sy * 90 * U, zt] });

  // ---- cooling ducts and base plate -------------------------------------------------------------------
  const ds = -a.duct_array / 2;
  const zD = -(yb + a.duct_h / 2);
  xd('t_duct_rib', ds, ds + a.t_duct_rib, zD, B, 110 * U);
  xd('duct_gap', ds + a.t_duct_rib, ds + a.duct_pitch, zD, B, 110 * U);
  xd('duct_pitch', ds, ds + a.duct_pitch, zD, B, 190 * U);
  xd('duct_array', -a.duct_array / 2, a.duct_array / 2, zD, B, 270 * U);
  xd('duct_count', -a.duct_array / 2, a.duct_array / 2, zD, B, 350 * U, false);
  const zB = -ydT;
  xd('base_edge', -B / 2, -B / 2 + a.base_edge, zB, B, 100 * U);
  xd('duct_side', -B / 2 + a.base_edge, -B / 2 + a.base_edge + a.duct_side, zB, B, 100 * U);
  xd('base_margin', -B / 2, -a.base_clear / 2, zB, B, 200 * U);
  xd('base_clear', -a.base_clear / 2, a.base_clear / 2, zB, B, 200 * U);
  xd('base_w', -B / 2, B / 2, zB, B, 300 * U);

  // ---- spout and water pipe ----------------------------------------------------------------------------------
  const yOut = F / 2 + lip;
  out.push({ id: 'spout_w', kind: 'seg', A: [-a.spout_w / 2, yOut + 80 * U, 0], B: [a.spout_w / 2, yOut + 80 * U, 0] });
  out.push({ id: 'spout_h', kind: 'seg', A: [wt / 2 + 70 * U, yOut, 0], B: [wt / 2 + 70 * U, yOut, -a.spout_h] });
  const zpipe = -(yd + 0.475 * a.t_base);
  out.push({
    id: 'pipe_proj',
    kind: 'seg',
    A: [B / 2, sy * 260 * U, zpipe],
    B: [B / 2 + a.pipe_proj, sy * 260 * U, zpipe],
    ext: [[B / 2, 0, zpipe], [B / 2 + a.pipe_proj, 0, zpipe]],
  });
  return out;
};

export const ShellIsoDrawing: React.FC<ShellIsoDrawingProps> = ({ req, ref0, mode, refCapacity, targetCapacity, plan = 'square', compact = false, initialAz = 0, hoveredId: hovProp, onHover: onHoverProp, numberById, names }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [az, setAz] = useState(initialAz); // degrees
  const [auto, setAuto] = useState(false);
  const drag = useRef<{ x: number; az: number } | null>(null);
  const [hovLocal, setHovLocal] = useState<string | null>(null);
  const [vals, setVals] = useState<'all' | 'select'>('select');
  const [pinned, setPinned] = useState<string | null>(null); // dimension picked by a click
  const [ext, setExt] = useState<string | null>(null); // dimension selected from outside (the table)
  const [cam, setCam] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const overDims = useRef(false);
  const moved = useRef(false);
  const hoveredId = hovProp !== undefined ? hovProp : hovLocal;
  const onHover = onHoverProp ?? setHovLocal;
  // a selection made outside the drawing (a table row) also turns and zooms the view
  useEffect(() => {
    if (hovProp === undefined || overDims.current) return;
    setExt(hovProp ?? null);
  }, [hovProp]);

  const sq = plan === 'square';
  const g = mode === 'reference' ? ref0 : req;
  const showGhost = mode === 'overlay';
  const cmp = mode === 'reference' ? undefined : ref0;

  const U = Math.max(ref0.flange, req.flange) / 2580; // keeps lines and text legible at any size
  const sw = 2.4 * U;
  const fs = 50 * U;

  const rad = (az * Math.PI) / 180;
  const cA = Math.cos(rad);
  const sA = Math.sin(rad);
  const P = (x: number, y: number, z: number): XY => proj(rad, x, y, z);

  // auto-rotate
  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setAz((v) => (v + dt * 0.03) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  const norm = (v: number) => ((v % 360) + 360) % 360;
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, az };
    moved.current = false;
    setAuto(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x) > 4) moved.current = true;
    setAz(norm(drag.current.az + (e.clientX - drag.current.x) * 0.5));
  };
  const onUp = (e: React.PointerEvent) => {
    const wasDrag = moved.current;
    drag.current = null;
    if (wasDrag) return;
    // a click on a dimension pins it (turn + zoom); a click on the drawing clears it
    const id = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-dim]')?.getAttribute('data-dim') ?? null;
    setPinned((p) => (id ? (p === id ? null : id) : null));
  };
  const onCancel = () => {
    drag.current = null;
  };

  // ---- face visibility ------------------------------------------------------
  const rn = (n: XY): XY => [n[0] * cA - n[1] * sA, n[0] * sA + n[1] * cA];
  const facing = (n: XY) => {
    const r = rn(n);
    return r[0] + r[1] > 1e-9;
  };
  const tone = (n: XY) => {
    const r = rn(n);
    return r[0] - r[1] > 0 ? FILL.right : FILL.left;
  };

  // ---- primitives -------------------------------------------------------
  type Sty = (fill: string) => Record<string, unknown>;

  /** a side face of a square section: corners at +/- t along the face tangent */
  const face = (n: XY, h0: number, z0: number, h1: number, z1: number): XY[] => {
    const t: XY = [-n[1], n[0]];
    const at = (h: number, sg: number, z: number) => P(h * (n[0] + sg * t[0]), h * (n[1] + sg * t[1]), z);
    return [at(h0, 1, z0), at(h0, -1, z0), at(h1, -1, z1), at(h1, 1, z1)];
  };

  const prism = (w: number, zt: number, zb: number, k: string, S: Sty) => {
    const h = w / 2;
    if (sq) {
      return (
        <g key={k}>
          {SIDES.filter(facing).map((n, i) => (
            <polygon key={i} points={poly(face(n, h, zt, h, zb))} {...S(tone(n))} />
          ))}
          <polygon points={poly([P(-h, -h, zt), P(h, -h, zt), P(h, h, zt), P(-h, h, zt)])} {...S(FILL.top)} />
        </g>
      );
    }
    const rx = RX * h;
    const ry = RY * h;
    return (
      <g key={k}>
        <path d={`M${-rx},${-zt} L${-rx},${-zb} A${rx},${ry} 0 0 0 ${rx},${-zb} L${rx},${-zt}`} {...S(FILL.left)} />
        <ellipse cx={0} cy={-zt} rx={rx} ry={ry} {...S(FILL.top)} />
      </g>
    );
  };

  // wide-at-the-bottom (or top) sloped section; its top face is always covered by the part above
  const frustum = (w0: number, zt: number, w1: number, zb: number, k: string, S: Sty) => {
    const h0 = w0 / 2;
    const h1 = w1 / 2;
    if (sq) {
      return (
        <g key={k}>
          {SIDES.filter(facing).map((n, i) => (
            <polygon key={i} points={poly(face(n, h0, zt, h1, zb))} {...S(tone(n))} />
          ))}
        </g>
      );
    }
    const rx0 = RX * h0;
    const rx1 = RX * h1;
    const ry1 = RY * h1;
    return <path key={k} d={`M${-rx0},${-zt} L${-rx1},${-zb} A${rx1},${ry1} 0 0 0 ${rx1},${-zb} L${rx0},${-zt}`} {...S(FILL.left)} />;
  };

  const flat = (w: number, z: number, fill: string, k: string, S: Sty) => {
    const h = w / 2;
    return sq ? (
      <polygon key={k} points={poly([P(-h, -h, z), P(h, -h, z), P(h, h, z), P(-h, h, z)])} {...S(fill)} />
    ) : (
      <ellipse key={k} cx={0} cy={-z} rx={RX * h} ry={RY * h} {...S(fill)} />
    );
  };

  // a plate line running round the faces that are visible (spacer plates)
  const band = (w: number, z: number, k: string) => {
    const h = w / 2;
    return sq ? (
      <g key={k}>
        {SIDES.filter(facing).map((n, i) => {
          const f = face(n, h, z, h, z);
          return <line key={i} x1={f[0][0]} y1={f[0][1]} x2={f[1][0]} y2={f[1][1]} stroke={INK} strokeWidth={sw * 0.6} />;
        })}
      </g>
    ) : (
      <path key={k} d={`M${-RX * h},${-z} A${RX * h},${RY * h} 0 0 0 ${RX * h},${-z}`} fill="none" stroke={INK} strokeWidth={sw * 0.6} />
    );
  };

  // ---- the whole shell for one geometry ---------------------------------
  const shell = (a: ShellGeometry, solid: boolean) => {
    const z = (y: number) => -y; // model height (y down from the rim) -> iso z
    const yb = a.h_shell + a.t_ring; // taper start
    const yd = yb + a.duct_h; // base plate top
    const y2s = a.cone_h + a.tier1 + a.t_spacer + a.tier2;
    const S: Sty = (fill) =>
      solid
        ? { fill, stroke: INK, strokeWidth: sw, strokeLinejoin: 'round' }
        : { fill: 'none', stroke: GHOST, strokeWidth: sw * 0.85, strokeDasharray: `${16 * U} ${10 * U}`, strokeLinejoin: 'round' };

    // water pipe along model +X at the base plate
    const rp = Math.max(6 * U, 0.275 * a.t_base);
    const zc = z(yd + 0.475 * a.t_base);
    const p0 = P(a.base_w / 2, 0, zc);
    const p1 = P(a.base_w / 2 + a.pipe_proj, 0, zc);
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const n: XY = [(-dy / len) * rp, (dx / len) * rp]; // screen normal of the pipe axis
    const pipe = [
      [p0[0] + n[0], p0[1] + n[1]],
      [p1[0] + n[0], p1[1] + n[1]],
      [p1[0] - n[0], p1[1] - n[1]],
      [p0[0] - n[0], p0[1] - n[1]],
    ] as XY[];
    const pipeEl = <polygon key="pipe" points={poly(pipe)} {...S(FILL.dark)} />;
    const pipeBehind = cA + sA < 0; // +X axis points away from the viewer

    // pouring spout on the model +Y face (same proportions as the front / top / side drawings)
    const sp = a.spout_w;
    const wt = 0.56 * sp;
    const lip = 0.19 * sp;
    const yIn = a.ring / 2;
    const yOut = a.flange / 2 + lip;
    const yBot = a.ring / 2 + ((a.flange - a.ring) / 2) * Math.min(1, a.spout_h / a.cone_h);
    const wE = sp / 2 + (wt / 2 - sp / 2) * ((yBot - yIn) / (yOut - yIn));
    const zOutLow = -0.35 * a.spout_h;
    const spoutEl = (
      <g key="spout">
        <polygon points={poly([P(sp / 2, yIn, 0), P(wt / 2, yOut, lip), P(wt / 2, yOut, zOutLow), P(wE, yBot, -a.spout_h)])} {...S(tone([1, 0]))} />
        <polygon points={poly([P(-sp / 2, yIn, 0), P(sp / 2, yIn, 0), P(wt / 2, yOut, lip), P(-wt / 2, yOut, lip)])} {...S(FILL.top)} />
        <polygon points={poly([P(-wt / 2, yOut, lip), P(wt / 2, yOut, lip), P(wt / 2, yOut, zOutLow), P(-wt / 2, yOut, zOutLow)])} {...S(tone([0, 1]))} />
        <polygon points={poly([P(-sp / 2, yIn, 0), P(-wt / 2, yOut, lip), P(-wt / 2, yOut, zOutLow), P(-wE, yBot, -a.spout_h)])} {...S(tone([-1, 0]))} />
      </g>
    );
    const spoutBehind = cA - sA < 0; // +Y axis points away from the viewer

    return (
      <g>
        {spoutBehind && spoutEl}
        {pipeBehind && pipeEl}
        {prism(a.base_w, z(yd), z(yd + a.t_base), 'base', S)}
        {!pipeBehind && pipeEl}
        {frustum(a.body_od, z(yb), a.base_w, z(yd), 'taper', S)}
        {prism(a.body_od, z(a.h_shell), z(yb), 'ring', S)}
        {prism(a.body_od, z(a.cone_h), z(a.h_shell), 'body', S)}
        {solid && [a.cone_h + a.tier1, a.cone_h + a.tier1 + a.t_spacer, y2s, y2s + a.t_spacer].map((y, i) => band(a.body_od, z(y), `sp${i}`))}
        {frustum(a.ring, z(0), a.flange, z(a.cone_h), 'cone', S)}
        {prism(a.ring, a.t_top, 0, 'rim', S)}
        {solid && flat(a.top_inner, a.t_top, FILL.opening, 'inner', S)}
        {solid && flat(a.cavity, a.t_top, FILL.dark, 'cavity', S)}
        {!spoutBehind && spoutEl}
      </g>
    );
  };

  // base plate sits under the wider body: from above it is a hidden line
  const hiddenBase = (a: ShellGeometry) => {
    const yd = a.h_shell + a.t_ring + a.duct_h;
    const HS: Sty = () => ({ fill: 'none', stroke: '#64748b', strokeWidth: sw * 0.55, strokeDasharray: `${10 * U} ${8 * U}`, strokeLinejoin: 'round' });
    return <g key="hidden-base">{prism(a.base_w, -yd, -(yd + a.t_base), 'hb', HS)}</g>;
  };

  // ---- dimensions: every register dimension, drawn in 3D; the selected one pops up -------------------------------
  const isCh = (id: string, val: number) => cmp !== undefined && Math.abs(val - cmp[id]) > 0.004;
  const wasOf = (id: string, val: number) => (isCh(id, val) ? `  (was ${formatDim(cmp![id], 2)})` : '');
  const unitOf = (id: string) => (COUNT_IDS.has(id) ? 'nos' : 'mm');

  const dimEl = (d: IsoDim, a: ShellGeometry) => {
    const val = a[d.id];
    const hov = hoveredId === d.id;
    const ch = isCh(d.id, val);
    const col = hov ? HOV : ch ? CHG : DIMC;
    const mk = hov ? 'url(#isoArrowH)' : ch ? 'url(#isoArrowC)' : 'url(#isoArrowN)';
    const A = P(...d.A);
    const Bp = P(...d.B);
    const mx = (A[0] + Bp[0]) / 2;
    const my = (A[1] + Bp[1]) / 2;
    const showVal = hov || vals === 'all' || MAIN_IDS.has(d.id);
    const n = numberById?.[d.id];
    const halo = { stroke: '#ffffff', strokeWidth: 7 * U, paintOrder: 'stroke', strokeLinejoin: 'round' } as React.SVGProps<SVGTextElement>;
    const txt = `${formatDim(val, 2)}${d.kind === 'pt' ? '' : ''}`;
    let body: React.ReactNode;
    if (d.kind === 'pt') {
      body = (
        <>
          <polyline points={`${A[0]},${A[1]} ${Bp[0]},${Bp[1]}`} fill="none" stroke={col} strokeWidth={(hov ? 3 : 1.5) * U} />
          <circle cx={A[0]} cy={A[1]} r={8 * U} fill="none" stroke={col} strokeWidth={(hov ? 3 : 1.5) * U} />
          <circle cx={Bp[0]} cy={Bp[1]} r={14 * U} fill="transparent" />
          {(showVal || n) && (
            <text x={Bp[0] - 12 * U} y={Bp[1]} dy="0.35em" textAnchor="end" fontSize={fs * (hov ? 1.12 : 1)} fill={col} fontWeight={hov || ch ? 700 : 400} {...halo}>
              {showVal ? `Ø${txt} vent${wasOf(d.id, val)}` : null}
            </text>
          )}
        </>
      );
    } else {
      let ang = (Math.atan2(Bp[1] - A[1], Bp[0] - A[0]) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      const e0 = d.ext ? P(...d.ext[0]) : null;
      const e1 = d.ext ? P(...d.ext[1]) : null;
      body = (
        <>
          {e0 && e1 && (
            <>
              <line x1={e0[0]} y1={e0[1]} x2={A[0]} y2={A[1]} stroke={col} strokeWidth={U} opacity={hov ? 0.9 : 0.4} />
              <line x1={e1[0]} y1={e1[1]} x2={Bp[0]} y2={Bp[1]} stroke={col} strokeWidth={U} opacity={hov ? 0.9 : 0.4} />
            </>
          )}
          <line x1={A[0]} y1={A[1]} x2={Bp[0]} y2={Bp[1]} stroke={col} strokeWidth={(hov ? 3 : 1.6) * U} markerStart={mk} markerEnd={mk} />
          <line x1={A[0]} y1={A[1]} x2={Bp[0]} y2={Bp[1]} stroke="transparent" strokeWidth={22 * U} />
          {showVal && (
            <text transform={`translate(${mx} ${my}) rotate(${ang})`} dy={-14 * U} fontSize={fs * (hov ? 1.12 : 1)} textAnchor="middle" fill={col} fontWeight={hov || ch ? 700 : 400} {...halo}>
              {txt}
              {ch ? <tspan fontSize={fs * 0.72} fill="#64748b" fontWeight={400}>{wasOf(d.id, val)}</tspan> : null}
            </text>
          )}
        </>
      );
    }
    return (
      <g
        key={d.id}
        data-dim={d.id}
        onMouseEnter={() => {
          overDims.current = true;
          onHover(d.id);
        }}
        onMouseLeave={() => {
          overDims.current = false;
          onHover(null);
        }}
        style={{ cursor: 'pointer' }}
      >
        {body}
        {hov && (
          <g pointerEvents="none">
            <circle cx={mx} cy={my} r={14 * U} fill={HOV} opacity={0.4}>
              <animate attributeName="r" values={`${12 * U};${46 * U};${12 * U}`} dur="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <circle cx={mx} cy={my} r={10 * U} fill={HOV} stroke="#fff" strokeWidth={3.5 * U} />
          </g>
        )}
        {n ? (
          <g pointerEvents="none">
            <circle cx={mx} cy={my} r={15 * U} fill={col} stroke="#fff" strokeWidth={2 * U} />
            <text x={mx} y={my} dy="0.35em" textAnchor="middle" fontSize={16 * U} fill="#fff" fontWeight={700}>
              {n}
            </text>
          </g>
        ) : null}
      </g>
    );
  };

  const dims = (a: ShellGeometry) => {
    const list = buildDims(a, rad, sq, U);
    // the selected dimension is drawn last, so it sits on top
    return [...list.filter((d) => d.id !== hoveredId), ...list.filter((d) => d.id === hoveredId)].map((d) => dimEl(d, a));
  };

  /** pop-up banner for the selected dimension */
  const banner = () => {
    if (!hoveredId || !(hoveredId in g)) return null;
    const val = g[hoveredId];
    const nm = names?.[hoveredId] ?? hoveredId;
    const no = numberById?.[hoveredId];
    const line = `${no ? `#${no}  ` : ''}${nm}   ${formatDim(val, 2)} ${unitOf(hoveredId)}${wasOf(hoveredId, val)}`;
    const w = line.length * fs * 0.62 + fs * 1.6;
    const h = fs * 1.9;
    return (
      <g pointerEvents="none">
        <rect x={vb.x + 24 * U} y={vb.y + 24 * U} width={w} height={h} rx={10 * U} fill="#eff6ff" stroke={HOV} strokeWidth={2.5 * U} />
        <text x={vb.x + 24 * U + fs * 0.8} y={vb.y + 24 * U + h / 2} dy="0.35em" fontSize={fs * 1.05} fill="#1e3a8a" fontWeight={700}>
          {line}
        </text>
      </g>
    );
  };

  // ---- view box: every point of both geometries at every azimuth, so it never jumps while turning --------
  const box = useMemo(() => {
    const out: XY[] = [];
    const extentOf = (a: ShellGeometry, azr: number) => {
      const Pa = (x: number, y: number, z: number) => proj(azr, x, y, z);
      const ringPts = (w: number, zz: number) => {
        const h = w / 2;
        if (sq) [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(([x, y]) => out.push(Pa(x, y, zz)));
        else {
          const c = Pa(0, 0, zz);
          out.push([c[0] - RX * h, c[1]], [c[0] + RX * h, c[1]], [c[0], c[1] - RY * h], [c[0], c[1] + RY * h]);
        }
      };
      ringPts(a.flange, -a.cone_h);
      ringPts(a.ring, a.t_top);
      ringPts(a.body_od, -a.h_shell);
      ringPts(a.base_w, -a.h_total);
      const rp = Math.max(6 * U, 0.275 * a.t_base);
      const zc = -(a.h_shell + a.t_ring + a.duct_h + 0.475 * a.t_base);
      out.push(Pa(a.base_w / 2 + a.pipe_proj, rp, zc - rp), Pa(a.base_w / 2 + a.pipe_proj, -rp, zc + rp));
      const sp = a.spout_w;
      const wt = 0.56 * sp;
      const lip = 0.19 * sp;
      const yOut = a.flange / 2 + lip;
      const zLow = -0.35 * a.spout_h;
      out.push(Pa(wt / 2, yOut, lip), Pa(-wt / 2, yOut, lip), Pa(wt / 2, yOut, zLow), Pa(-wt / 2, yOut, zLow));
      for (const e of buildDims(a, azr, sq, U)) {
        out.push(Pa(...e.A), Pa(...e.B));
        if (e.kind === 'pt') out.push(Pa(e.B[0] - 450 * U, e.B[1], e.B[2]));
      }
    };
    for (let t = 0; t < 2 * Math.PI - 1e-9; t += STEP) {
      extentOf(ref0, t);
      extentOf(req, t);
    }
    const pad = 320 * U;
    const x0 = Math.min(...out.map((p) => p[0])) - pad;
    const y0 = Math.min(...out.map((p) => p[1])) - pad;
    return { x: x0, y: y0, w: Math.max(...out.map((p) => p[0])) + pad - x0, h: Math.max(...out.map((p) => p[1])) + pad - y0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref0, req, sq, U]);
  const vbX = box.x;
  const vbY = box.y;
  const vbW = box.w;
  const vbH = box.h;

  // ---- select a dimension: turn the shell towards it and zoom in ----------------------------------------------
  const vb = cam ?? { x: vbX, y: vbY, w: vbW, h: vbH };
  const focus = pinned ?? ext;
  const camRef = useRef(cam);
  camRef.current = cam;
  const azRef = useRef(az);
  azRef.current = az;
  const animRef = useRef(0);
  useEffect(() => {
    window.clearInterval(animRef.current);
    if (!focus && !camRef.current) return;
    const fromAz = azRef.current;
    const fromCam = camRef.current ?? { x: box.x, y: box.y, w: box.w, h: box.h };
    let toAz = fromAz;
    let toCam: { x: number; y: number; w: number; h: number } | null = null;
    if (focus) {
      const d0 = buildDims(g, 0, sq, U).find((d) => d.id === focus);
      if (!d0) return;
      // turn the shell so the side the dimension is on faces the viewer (the viewer looks along +X +Y)
      const mx = (d0.A[0] + d0.B[0]) / 2;
      const my = (d0.A[1] + d0.B[1]) / 2;
      // 25 deg off dead-on, so it stays a three-quarter (isometric) view rather than flattening to an elevation
      toAz = norm(45 + 25 - (Math.atan2(my, mx) * 180) / Math.PI);
      const tr = (toAz * Math.PI) / 180;
      const dd = buildDims(g, tr, sq, U).find((d) => d.id === focus)!;
      const pa = proj(tr, ...dd.A);
      const pb = proj(tr, ...dd.B);
      const len = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      const w = Math.min(box.w, Math.max(box.w / 3.4, len * 1.8 + 500 * U, 900 * U));
      const h = (w * box.h) / box.w;
      toCam = { x: (pa[0] + pb[0]) / 2 - w / 2, y: (pa[1] + pb[1]) / 2 - h / 2, w, h };
    }
    const target = toCam ?? { x: box.x, y: box.y, w: box.w, h: box.h };
    const dAz = focus ? ((toAz - fromAz + 540) % 360) - 180 : 0;
    const t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / 750);
      const k = ease(t);
      setAz(norm(fromAz + dAz * k));
      if (t >= 1 && !toCam) setCam(null);
      else
        setCam({
          x: fromCam.x + (target.x - fromCam.x) * k,
          y: fromCam.y + (target.y - fromCam.y) * k,
          w: fromCam.w + (target.w - fromCam.w) * k,
          h: fromCam.h + (target.h - fromCam.h) * k,
        });
      if (t >= 1) window.clearInterval(animRef.current);
    };
    animRef.current = window.setInterval(step, 16);
    return () => window.clearInterval(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);


  const handleDownload = () => {
    const el = svgRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '2200');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(vbX));
    bg.setAttribute('y', String(vbY));
    bg.setAttribute('width', String(vbW));
    bg.setAttribute('height', String(vbH));
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SHELL_${mode === 'reference' ? refCapacity : targetCapacity}T_iso_view${Math.round(az) ? `_rot${Math.round(az)}` : ''}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const svg = (
    <svg
      ref={svgRef}
      viewBox={`${fx(vb.x)} ${fx(vb.y)} ${fx(vb.w)} ${fx(vb.h)}`}
      className={`${compact ? 'w-full h-full' : 'w-full h-auto'} cursor-grab active:cursor-grabbing select-none`}
      fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      role="img"
      aria-label="Parametric shell isometric view (drag to rotate)"
      style={{ color: INK, touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      <defs>
        <marker id="isoArrowN" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={28 * U} markerHeight={28 * U} orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill={INK} />
        </marker>
        <marker id="isoArrowC" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={28 * U} markerHeight={28 * U} orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill={CHG} />
        </marker>
        <marker id="isoArrowH" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={30 * U} markerHeight={30 * U} orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 z" fill={HOV} />
        </marker>
      </defs>
      {shell(g, true)}
      {hiddenBase(g)}
      {/* reference outline over the solid, so a smaller / larger reference is visible through the faces */}
      {showGhost && shell(ref0, false)}
      {dims(g)}
      {banner()}
    </svg>
  );

  const btn = 'p-1 rounded border border-slate-300 bg-white text-slate-700 hover:border-amber-500 hover:text-amber-600 cursor-pointer';
  const controls = (
    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300">
      <button className={btn} title="Rotate left 15°" onClick={() => { setAuto(false); setAz((v) => norm(v - 15)); }}>
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(az)}
        onChange={(e) => { setAuto(false); setAz(Number(e.target.value)); }}
        className="w-28 accent-amber-500"
        aria-label="Rotation angle"
      />
      <button className={btn} title="Rotate right 15°" onClick={() => { setAuto(false); setAz((v) => norm(v + 15)); }}>
        <RotateCw className="w-3.5 h-3.5" />
      </button>
      <span className="w-9 text-right">{Math.round(az)}°</span>
      <button className={btn} title={auto ? 'Stop auto-rotate' : 'Auto-rotate'} onClick={() => setAuto((v) => !v)}>
        {auto ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <button className={btn} title="Reset view" onClick={() => { setAuto(false); setPinned(null); setAz(0); }}>
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        className={`${btn} px-2 font-bold text-[10px]`}
        title={vals === 'all' ? 'Values of every dimension are shown' : 'Only the headline values are shown; select a dimension to pop its value up'}
        onClick={() => setVals((v) => (v === 'all' ? 'select' : 'all'))}
      >
        {vals === 'all' ? 'Values: all' : 'Values: on select'}
      </button>
    </div>
  );

  if (compact)
    return (
      <div className="relative w-full h-full">
        {svg}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-white/90 border border-slate-200 rounded-lg px-2 py-1 shadow-sm">{controls}</div>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-slate-800 dark:border-slate-200" />
            {mode === 'reference' ? `Base ${refCapacity} t` : `Target ${targetCapacity} t`}
          </span>
          {showGhost && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: GHOST }} />
              Base {refCapacity} t outline
            </span>
          )}
          {mode !== 'reference' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHG }} />
              Changed dimension
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {controls}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download SVG</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white overflow-hidden">{svg}</div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Drag the drawing (or use the slider) to rotate it; the spout and water pipe turn with the shell. Isometric view built from the parametric shell model ({sq ? 'square box section' : 'round section'}).
        Callouts are the dimension register values; amber = changed against the base drawing, grey dashed outline = the base shell, fine dashed lines = base plate hidden under the body.
      </p>
    </div>
  );
};
