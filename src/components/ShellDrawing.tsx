import React, { useRef } from 'react';
import { ShellGeometry, formatDim } from '../utils/shellModel';
import { Download } from 'lucide-react';

export type ShellDrawingMode = 'overlay' | 'required' | 'reference';

interface ShellDrawingProps {
  req: ShellGeometry;
  ref0: ShellGeometry; // reference geometry (named ref0 because `ref` is reserved in React)
  mode: ShellDrawingMode;
  refCapacity: number;
  targetCapacity: number;
  /** which view of the parametric model to draw (all three share the same drawing style) */
  view?: 'FRONT' | 'TOP' | 'SIDE';
  /** TOP view section */
  plan?: 'square' | 'round';
}

const CHG = '#d97706'; // amber-600 : changed dimension
const GHOST = '#94a3b8'; // slate-400 : reference outline

/** Ribs run through the panel row: e2 R e1 R p R p ... p R e1 R e2 (10 ribs, closes to casing dia). */
function ribPositions(g: ShellGeometry): { x: number; w: number }[] {
  const out: { x: number; w: number }[] = [];
  let x = -g.top_inner / 2;
  const rib = () => {
    out.push({ x, w: g.t_rib });
    x += g.t_rib;
  };
  x += g.edge_out;
  rib();
  x += g.edge_in;
  rib();
  for (let i = 0; i < g.panel_count; i++) {
    x += g.panel_pitch;
    rib();
  }
  x += g.edge_in;
  rib();
  x += g.edge_out;
  return out;
}

/** Centres of the vent-hole panels (centre panels only). */
function panelCentres(g: ShellGeometry): number[] {
  const rs = ribPositions(g);
  // ribs index 2..(2+n-1) are the ones that follow edge panels; centre panels sit between rib[1] and rib[2+n-1]
  const centres: number[] = [];
  for (let i = 1; i < 1 + g.panel_count; i++) {
    const left = rs[i].x + rs[i].w;
    const right = rs[i + 1].x;
    centres.push((left + right) / 2);
  }
  return centres;
}

export const ShellDrawing: React.FC<ShellDrawingProps> = ({ req, ref0, mode, refCapacity, targetCapacity, view = 'FRONT', plan = 'square' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const isTop = view === 'TOP';
  const isSide = view === 'SIDE';
  const sq = plan === 'square';

  const g = mode === 'reference' ? ref0 : req;
  const showGhost = mode === 'overlay';
  const cmp = mode === 'reference' ? undefined : ref0;

  const mxFlange = Math.max(ref0.flange, req.flange);
  const mxTotal = Math.max(ref0.h_total, req.h_total);
  const mxSpout = Math.max(ref0.spout_w, req.spout_w);
  const U = mxFlange / 2580; // drawing unit: keeps lines & text legible at any size
  const fs = 34 * U;
  const lipMax = 0.19 * mxSpout;

  // side elevation: the spout is seen in profile on the right, so the right-hand chain moves out beyond it
  const spOut = (a: ShellGeometry) => {
    const x0 = a.ring / 2 + ((a.flange - a.ring) / 2) * Math.min(1, a.spout_h / a.cone_h) + 6 * U;
    return { x0, x1: x0 + 1.6 * 0.19 * a.spout_w };
  };
  const xRight = (a: ShellGeometry) => (isSide ? Math.max(a.flange / 2 + 70 * U, spOut(a).x1 + 200 * U) : a.flange / 2 + 70 * U);
  const mxRight = Math.max(xRight(ref0), xRight(req));
  // plan: rows of widths above, spout row below
  const mxR = mxFlange / 2;
  const planGap = 62 * U;
  const planHalf = Math.max(mxR, ref0.base_w / 2 + ref0.pipe_proj, req.base_w / 2 + req.pipe_proj) + 250 * U;
  const planTop = -(mxR + 50 * U + 6 * planGap + 20 * U);
  const planBottom = mxR + lipMax + 150 * U;

  const vbX = isTop ? -planHalf : -(mxFlange / 2 + 230 * U);
  const vbW = isTop ? 2 * planHalf : isSide ? mxRight + 200 * U - vbX : mxFlange + 500 * U;
  const vbY = isTop ? planTop : -(lipMax + 270 * U);
  const vbH = isTop ? planBottom - planTop : mxTotal + lipMax + 560 * U;

  // ---- geometry helpers -------------------------------------------------
  const yTiersEnd = (a: ShellGeometry) => a.cone_h + a.h_tiers;
  const ya = (a: ShellGeometry) => a.h_shell; // bottom of active shell

  const silhouette = (a: ShellGeometry, stroke: string, dash?: string, sw = 2.6 * U) => {
    const lip = 0.19 * a.spout_w;
    const wt = 0.56 * a.spout_w;
    const y1 = a.cone_h + a.tier1; // spacer 1 top
    const y2 = y1 + a.t_spacer + a.tier2; // spacer 2 top
    const yb = ya(a) + a.t_ring; // taper start
    const yd = yb + a.duct_h; // taper end / base plate top
    const common = { stroke, strokeWidth: sw, strokeDasharray: dash, fill: 'none', strokeLinejoin: 'round' as const };
    return (
      <g>
        {/* top rim plate */}
        <rect x={-a.ring / 2} y={-a.t_top} width={a.ring} height={a.t_top} {...common} />
        {/* top cone / flange */}
        <polygon points={`${-a.ring / 2},0 ${a.ring / 2},0 ${a.flange / 2},${a.cone_h} ${-a.flange / 2},${a.cone_h}`} {...common} />
        {/* body */}
        <rect x={-a.body_od / 2} y={a.cone_h} width={a.body_od} height={ya(a) - a.cone_h} {...common} />
        {/* spacer plates */}
        <rect x={-a.body_od / 2} y={y1} width={a.body_od} height={a.t_spacer} {...common} />
        <rect x={-a.body_od / 2} y={y2} width={a.body_od} height={a.t_spacer} {...common} />
        {/* bottom ring + taper + base plate */}
        <rect x={-a.body_od / 2} y={ya(a)} width={a.body_od} height={a.t_ring} {...common} />
        <polygon points={`${-a.body_od / 2},${yb} ${a.body_od / 2},${yb} ${a.base_w / 2},${yd} ${-a.base_w / 2},${yd}`} {...common} />
        <rect x={-a.base_w / 2} y={yd} width={a.base_w} height={a.t_base} {...common} />
        {isSide ? (
          <>
            {/* water pipe seen end-on */}
            <circle cx={0} cy={yd + a.t_base / 2} r={Math.max(9 * U, a.t_base * 0.32)} {...common} />
            {/* spout in profile */}
            <polygon
              points={`${a.ring / 2},${-lip} ${spOut(a).x1},${-lip} ${spOut(a).x1},${a.spout_h * 0.35} ${spOut(a).x0 + 0.5 * lip},${a.spout_h} ${spOut(a).x0 - 6 * U},${a.spout_h} ${a.ring / 2},0`}
              {...common}
            />
          </>
        ) : (
          <>
            {/* water pipe projection */}
            <rect x={a.base_w / 2} y={yd + a.t_base * 0.2} width={a.pipe_proj} height={Math.max(8 * U, a.t_base * 0.55)} {...common} />
            {/* spout */}
            <polygon
              points={`${-a.spout_w / 2},${a.spout_h} ${-a.spout_w / 2},0 ${-wt / 2},${-lip} ${wt / 2},${-lip} ${a.spout_w / 2},0 ${a.spout_w / 2},${a.spout_h}`}
              {...common}
            />
          </>
        )}
      </g>
    );
  };

  const details = (a: ShellGeometry) => {
    const stroke = 'currentColor';
    const ribs = ribPositions(a);
    const yEnd = yTiersEnd(a);
    const yd = ya(a) + a.t_ring;
    const centres = panelCentres(a);
    const tierMid = [a.cone_h / 2, a.cone_h + a.tier1 / 2, a.cone_h + a.tier1 + a.t_spacer + a.tier2 / 2, a.cone_h + a.tier1 + a.t_spacer + a.tier2 + a.t_spacer + a.tier3 / 2];
    const ductStart = -a.duct_array / 2;
    const wt = 0.56 * a.spout_w;
    const lip = 0.19 * a.spout_w;
    return (
      <g stroke={stroke} strokeWidth={1.6 * U} fill="none">
        {/* vertical ribs (panel row) */}
        {ribs.map((r, i) => (
          <rect key={`rib${i}`} x={r.x} y={0} width={r.w} height={yEnd} />
        ))}
        {/* dashed casing centre-lines */}
        <line x1={-a.top_inner / 2} y1={-10 * U} x2={-a.top_inner / 2} y2={ya(a)} strokeDasharray={`${14 * U} ${8 * U}`} />
        <line x1={a.top_inner / 2} y1={-10 * U} x2={a.top_inner / 2} y2={ya(a)} strokeDasharray={`${14 * U} ${8 * U}`} />
        {/* air-vent holes */}
        {tierMid.map((y, ti) =>
          centres.map((cx, ci) => <circle key={`v${ti}-${ci}`} cx={cx} cy={y} r={5 * U} fill="currentColor" stroke="none" />)
        )}
        {/* cooling duct ribs */}
        {Array.from({ length: a.duct_count + 1 }).map((_, i) => (
          <rect key={`d${i}`} x={ductStart + i * a.duct_pitch - (i === a.duct_count ? a.t_duct_rib : 0)} y={yd} width={a.t_duct_rib} height={a.duct_h} />
        ))}
        {!isSide && (
          <>
            {/* spout pour notch */}
            <rect x={-0.08 * a.spout_w} y={-lip} width={0.16 * a.spout_w} height={0.07 * a.spout_w} />
            {/* spout inner chamfer lines */}
            <line x1={-wt / 2} y1={-lip} x2={-wt / 2} y2={0.6 * a.spout_h} strokeDasharray={`${10 * U} ${6 * U}`} />
            <line x1={wt / 2} y1={-lip} x2={wt / 2} y2={0.6 * a.spout_h} strokeDasharray={`${10 * U} ${6 * U}`} />
          </>
        )}
      </g>
    );
  };

  // ---- dimension helpers ------------------------------------------------
  const isCh = (id: string, val: number) => cmp !== undefined && Math.abs(val - cmp[id]) > 0.004;
  const label = (id: string, val: number) => (
    <>
      {formatDim(val, 2)}
      {isCh(id, val) ? (
        <tspan fontSize={fs * 0.72} fill="#64748b" fontWeight={400}>{`  (was ${formatDim(cmp![id], 2)})`}</tspan>
      ) : null}
    </>
  );

  const ext = (k: string, x1: number, y1: number, x2: number, y2: number) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1 * U} opacity={0.4} />
  );

  const dimH = (k: string, id: string, x1: number, x2: number, y: number, val: number) => {
    const ch = isCh(id, val);
    const col = ch ? CHG : 'currentColor';
    const mk = ch ? 'url(#shArrowC)' : 'url(#shArrowN)';
    return (
      <g key={k} stroke={col} fill={col}>
        <line x1={x1} y1={y} x2={x2} y2={y} strokeWidth={1.6 * U} markerStart={mk} markerEnd={mk} />
        <text x={(x1 + x2) / 2} y={y - 9 * U} fontSize={fs} textAnchor="middle" stroke="none" fontWeight={ch ? 700 : 400}>
          {label(id, val)}
        </text>
      </g>
    );
  };

  const dimV = (k: string, id: string, x: number, y1: number, y2: number, val: number, side: 'L' | 'R') => {
    const ch = isCh(id, val);
    const col = ch ? CHG : 'currentColor';
    const mk = ch ? 'url(#shArrowC)' : 'url(#shArrowN)';
    const tx = side === 'L' ? x - 9 * U : x + 9 * U + fs * 0.8;
    return (
      <g key={k} stroke={col} fill={col}>
        <line x1={x} y1={y1} x2={x} y2={y2} strokeWidth={1.6 * U} markerStart={mk} markerEnd={mk} />
        <text transform={`translate(${tx} ${(y1 + y2) / 2}) rotate(-90)`} fontSize={fs} textAnchor="middle" stroke="none" fontWeight={ch ? 700 : 400}>
          {label(id, val)}
        </text>
      </g>
    );
  };

  const lip = 0.19 * g.spout_w;
  const R0 = g.flange / 2;
  const rowGap = 62 * U;
  const topBase = -(lipMax + 40 * U);
  const yRowInner = topBase - rowGap * 0.6;
  const yRowRing = topBase - rowGap * 1.6;
  const yRowFlange = topBase - rowGap * 2.6;
  const xL1 = -(g.flange / 2 + 70 * U);
  const xL2 = -(g.flange / 2 + 150 * U);
  const xR = xRight(g);
  const yTotal = g.h_total;
  const yBot1 = yTotal + 80 * U;
  const yBot2 = yTotal + 150 * U;
  const yBot3 = yTotal + 220 * U;

  const y1s = g.cone_h;
  const y2s = g.cone_h + g.tier1 + g.t_spacer;
  const y3s = y2s + g.tier2 + g.t_spacer;
  const ydT = ya(g) + g.t_ring + g.duct_h + g.t_base;

  // ---- plan (top view), same drawing style as the elevation ----
  const planShape = (w: number, p: Record<string, unknown>) =>
    sq ? <rect x={-w / 2} y={-w / 2} width={w} height={w} {...p} /> : <circle r={w / 2} {...p} />;

  const planGeom = (a: ShellGeometry, stroke: string, dash?: string, sw = 2.6 * U, full = true) => {
    const lipA = 0.19 * a.spout_w;
    const wtA = 0.56 * a.spout_w;
    const R = a.flange / 2;
    const common = { stroke, strokeWidth: sw, strokeDasharray: dash, fill: 'none', strokeLinejoin: 'round' as const };
    const hid = { stroke: full ? '#64748b' : stroke, strokeWidth: 1.6 * U, strokeDasharray: `${14 * U} ${9 * U}`, fill: 'none' };
    return (
      <g>
        {/* hidden: body, base plate, water pipe */}
        {planShape(a.body_od, hid)}
        {planShape(a.base_w, hid)}
        <rect x={a.base_w / 2} y={-14 * U} width={a.pipe_proj} height={28 * U} {...hid} />
        {/* visible: flange, sloped faces up to the rim, rim, casing top, cavity */}
        {planShape(a.flange, common)}
        {sq && (
          <g {...common} strokeWidth={sw * 0.6}>
            {[-1, 1].flatMap((sx) =>
              [-1, 1].map((sy) => <line key={`h${sx}${sy}`} x1={(sx * a.ring) / 2} y1={(sy * a.ring) / 2} x2={(sx * a.flange) / 2} y2={(sy * a.flange) / 2} />)
            )}
          </g>
        )}
        {planShape(a.ring, { ...common, strokeWidth: sw * 0.75 })}
        {planShape(a.top_inner, { ...common, strokeWidth: sw * 0.65 })}
        {planShape(a.cavity, { ...common, strokeWidth: sw * 0.55 })}
        {/* spout on the front face (bottom of the plan) */}
        <polygon points={`${-a.spout_w / 2},${a.top_inner / 2} ${-wtA / 2},${R + lipA} ${wtA / 2},${R + lipA} ${a.spout_w / 2},${a.top_inner / 2}`} {...common} />
        {full && <rect x={-0.08 * a.spout_w} y={R + lipA - 0.07 * a.spout_w} width={0.16 * a.spout_w} height={0.07 * a.spout_w} {...common} strokeWidth={sw * 0.55} />}
      </g>
    );
  };

  const planDims = () => {
    const R = g.flange / 2;
    const rowsAsc = ['cavity', 'base_w', 'top_inner', 'body_od', 'ring', 'flange'].sort((a, b) => g[a] - g[b]);
    const yRow = (i: number) => -(mxR + 50 * U + i * planGap);
    const edgeY = (w: number) => (sq ? -w / 2 : 0);
    const ySp = R + lip + 70 * U;
    const yPipe = R + 50 * U;
    return (
      <>
        {rowsAsc.map((id, i) => (
          <React.Fragment key={`pw-${id}`}>
            {ext(`pe-${id}-l`, -g[id] / 2, edgeY(g[id]), -g[id] / 2, yRow(i) - 10 * U)}
            {ext(`pe-${id}-r`, g[id] / 2, edgeY(g[id]), g[id] / 2, yRow(i) - 10 * U)}
            {dimH(`pd-${id}`, id, -g[id] / 2, g[id] / 2, yRow(i), g[id])}
          </React.Fragment>
        ))}
        {ext('pe-sp-l', -g.spout_w / 2, g.top_inner / 2, -g.spout_w / 2, ySp + 8 * U)}
        {ext('pe-sp-r', g.spout_w / 2, g.top_inner / 2, g.spout_w / 2, ySp + 8 * U)}
        {dimH('pd-spout', 'spout_w', -g.spout_w / 2, g.spout_w / 2, ySp, g.spout_w)}
        {ext('pe-pp-l', g.base_w / 2, 14 * U, g.base_w / 2, yPipe + 8 * U)}
        {ext('pe-pp-r', g.base_w / 2 + g.pipe_proj, 14 * U, g.base_w / 2 + g.pipe_proj, yPipe + 8 * U)}
        {dimH('pd-pipe', 'pipe_proj', g.base_w / 2, g.base_w / 2 + g.pipe_proj, yPipe, g.pipe_proj)}
      </>
    );
  };

  const handleDownload = () => {
    const el = svgRef.current;
    if (!el) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('style', 'color:#0f172a;background:#ffffff');
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
    a.download = `SHELL_${mode === 'reference' ? refCapacity : targetCapacity}T_${view.toLowerCase()}_view.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 border-t-2 border-slate-800 dark:border-slate-200" />
            {mode === 'reference' ? `Reference ${refCapacity} t (as given)` : `Required ${targetCapacity} t`}
          </span>
          {showGhost && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: GHOST }} />
              Reference {refCapacity} t outline
            </span>
          )}
          {mode !== 'reference' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: CHG }} />
              Changed dimension
            </span>
          )}
        </div>
        <button
          onClick={handleDownload}
          className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download SVG</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="w-full h-auto text-slate-800 dark:text-slate-200"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          role="img"
          aria-label={`Parametric shell ${view.toLowerCase()} view`}
        >
          <defs>
            <marker id="shArrowN" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={18 * U} markerHeight={18 * U} orient="auto-start-reverse">
              <path d="M0,1 L10,5 L0,9 z" fill="currentColor" />
            </marker>
            <marker id="shArrowC" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth={18 * U} markerHeight={18 * U} orient="auto-start-reverse">
              <path d="M0,1 L10,5 L0,9 z" fill={CHG} />
            </marker>
          </defs>

          {isTop ? (
            <>
              {showGhost && planGeom(ref0, GHOST, `${16 * U} ${10 * U}`, 2.2 * U, false)}
              <g stroke="currentColor" style={{ color: 'inherit' }}>
                {planGeom(g, 'currentColor')}
                <line x1={-R0 - 40 * U} y1={0} x2={R0 + 40 * U} y2={0} stroke="#94a3b8" strokeWidth={U} strokeDasharray={`${30 * U} ${8 * U} ${6 * U} ${8 * U}`} />
                <line x1={0} y1={-R0 - 20 * U} x2={0} y2={R0 + lip + 20 * U} stroke="#94a3b8" strokeWidth={U} strokeDasharray={`${30 * U} ${8 * U} ${6 * U} ${8 * U}`} />
              </g>
              {planDims()}
            </>
          ) : (
          <>
          {/* reference ghost */}
          {showGhost && silhouette(ref0, GHOST, `${16 * U} ${10 * U}`, 2.2 * U)}

          {/* main shell */}
          <g stroke="currentColor" style={{ color: 'inherit' }}>
            {silhouette(g, 'currentColor')}
            {details(g)}
          </g>

          {/* ---- top dimension rows ---- */}
          {ext('e-fl-l', -g.flange / 2, g.cone_h, -g.flange / 2, yRowFlange - 10 * U)}
          {ext('e-fl-r', g.flange / 2, g.cone_h, g.flange / 2, yRowFlange - 10 * U)}
          {ext('e-rg-l', -g.ring / 2, -g.t_top, -g.ring / 2, yRowRing - 10 * U)}
          {ext('e-rg-r', g.ring / 2, -g.t_top, g.ring / 2, yRowRing - 10 * U)}
          {ext('e-ti-l', -g.top_inner / 2, 0, -g.top_inner / 2, yRowInner - 10 * U)}
          {ext('e-ti-r', g.top_inner / 2, 0, g.top_inner / 2, yRowInner - 10 * U)}
          {dimH('d-flange', 'flange', -g.flange / 2, g.flange / 2, yRowFlange, g.flange)}
          {dimH('d-ring', 'ring', -g.ring / 2, g.ring / 2, yRowRing, g.ring)}
          {dimH('d-top', 'top_inner', -g.top_inner / 2, g.top_inner / 2, yRowInner, g.top_inner)}
          {!isSide && ext('e-sp-l', -g.spout_w / 2, -lip, -g.spout_w / 2, -lip - 28 * U)}
          {!isSide && ext('e-sp-r', g.spout_w / 2, -lip, g.spout_w / 2, -lip - 28 * U)}
          {!isSide && dimH('d-spout', 'spout_w', -g.spout_w / 2, g.spout_w / 2, -lip - 22 * U, g.spout_w)}
          {/* side view: spout height, measured on the spout profile */}
          {isSide && ext('e-sh0', spOut(g).x1, 0, spOut(g).x1 + 100 * U, 0)}
          {isSide && ext('e-sh1', spOut(g).x0 + 0.5 * lip, g.spout_h, spOut(g).x1 + 100 * U, g.spout_h)}
          {isSide && dimV('d-spouth', 'spout_h', spOut(g).x1 + 90 * U, 0, g.spout_h, g.spout_h, 'R')}

          {/* ---- left vertical dims ---- */}
          {ext('e-h0', -g.ring / 2, 0, xL2 - 10 * U, 0)}
          {ext('e-hs', -g.body_od / 2, g.h_shell, xL1 - 10 * U, g.h_shell)}
          {ext('e-ht', -g.base_w / 2, ydT, xL2 - 10 * U, ydT)}
          {dimV('d-hshell', 'h_shell', xL1, 0, g.h_shell, g.h_shell, 'L')}
          {dimV('d-htotal', 'h_total', xL2, 0, ydT, g.h_total, 'L')}

          {/* ---- right vertical chain: cone + tiers ---- */}
          {ext('e-r0', g.flange / 2, 0, xR + 10 * U, 0)}
          {ext('e-r1', g.flange / 2, y1s, xR + 10 * U, y1s)}
          {ext('e-r2', g.body_od / 2, y2s, xR + 10 * U, y2s)}
          {ext('e-r3', g.body_od / 2, y3s, xR + 10 * U, y3s)}
          {ext('e-r4', g.body_od / 2, y3s + g.tier3, xR + 10 * U, y3s + g.tier3)}
          {dimV('d-cone', 'cone_h', xR, 0, y1s, g.cone_h, 'R')}
          {dimV('d-t1', 'tier1', xR, y1s, y1s + g.tier1, g.tier1, 'R')}
          {dimV('d-t2', 'tier2', xR, y2s, y2s + g.tier2, g.tier2, 'R')}
          {dimV('d-t3', 'tier3', xR, y3s, y3s + g.tier3, g.tier3, 'R')}

          {/* ---- inside: cavity dia ---- */}
          {dimH('d-cavity', 'cavity', -g.cavity / 2, g.cavity / 2, g.h_shell - 44 * U, g.cavity)}

          {/* ---- bottom rows ---- */}
          {ext('e-b1-l', -g.duct_array / 2, ydT, -g.duct_array / 2, yBot1 + 8 * U)}
          {ext('e-b1-r', g.duct_array / 2, ydT, g.duct_array / 2, yBot1 + 8 * U)}
          {dimH('d-duct', 'duct_array', -g.duct_array / 2, g.duct_array / 2, yBot1, g.duct_array)}
          {ext('e-b2-l', -g.base_clear / 2, ydT, -g.base_clear / 2, yBot2 + 8 * U)}
          {ext('e-b2-r', g.base_clear / 2, ydT, g.base_clear / 2, yBot2 + 8 * U)}
          {dimH('d-baseclear', 'base_clear', -g.base_clear / 2, g.base_clear / 2, yBot2, g.base_clear)}
          {ext('e-b3-l', -g.base_w / 2, ydT, -g.base_w / 2, yBot3 + 8 * U)}
          {ext('e-b3-r', g.base_w / 2, ydT, g.base_w / 2, yBot3 + 8 * U)}
          {dimH('d-basew', 'base_w', -g.base_w / 2, g.base_w / 2, yBot3, g.base_w)}
          </>
          )}
        </svg>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {isTop
          ? `Top plan redrawn from the parametric shell model (${sq ? 'square box section' : 'round section'}, spout at the bottom; dashed = body, base plate and water pipe). `
          : isSide
          ? 'Side elevation redrawn from the parametric shell model (spout in profile, water pipe end-on). '
          : 'Front view redrawn from the parametric shell model. '}
        Amber callouts changed against the reference drawing; grey dashed outline is the reference shell.
      </p>
    </div>
  );
};
