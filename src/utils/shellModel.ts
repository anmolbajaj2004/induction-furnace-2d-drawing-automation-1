import type { FurnaceInputs, DimensionalConstraint } from '../types/furnace';

/**
 * PARAMETRIC SHELL MODEL
 * ----------------------------------------------------------------------------
 * Every dimension of the reference shell drawing (FURNACE_SHELL front view) is
 * captured here as either
 *   - an INDEPENDENT parameter (read from the drawing, scaled by a rule), or
 *   - a DERIVED dimension (a chain / sum of independent parameters).
 *
 * Because the overall dimensions are always derived from the independent ones,
 * the redrawn shell for any tonnage is dimensionally closed (the chains add up
 * exactly, the way the callouts on the original drawing do).
 *
 * Scaling rules (first-order, geometric similarity — verify with structural
 * calculation before release to the shop floor):
 *   - Widths (plan dimensions) : x s_w
 *   - Heights             : x s_h
 *   - Plate thicknesses   : x (Cap ratio)^0.25, snapped to a standard plate
 *   - Counts / hole dia   : fixed
 * with s_d = s_h = (Cap ratio)^(1/3) unless a dimensional restriction is
 * active, in which case the volume (capacity) is re-balanced:  s_d^2 * s_h = ratio.
 */

export type ShellGroupId = 'envelope' | 'flange' | 'body' | 'panels' | 'spout' | 'base';
type Kind = 'W' | 'H' | 'T' | 'FIXED';

export const SHELL_GROUPS: { id: ShellGroupId; title: string; note: string }[] = [
  { id: 'envelope', title: '1. Overall Envelope', note: 'Headline dimensions that set the shop-floor and crane envelope.' },
  { id: 'flange', title: '2. Top Flange & Cone', note: 'Top rim, flange overhang and the tapered cone section.' },
  { id: 'body', title: '3. Shell Body Tiers', note: 'Cylindrical tiers, spacer plates and bottom ring.' },
  { id: 'panels', title: '4. Panel / Rib Layout', note: 'Vertical rib spacing around the shell (yoke panels).' },
  { id: 'spout', title: '5. Pouring Spout', note: 'Spout box on top of the shell.' },
  { id: 'base', title: '6. Bottom Base & Cooling Ducts', note: 'Cavity, base plate, cooling duct array and pipe projection.' },
];

interface ParamSpec {
  ref: number;
  kind: Kind;
  step: number;
}

// Independent parameters, values read from the reference drawing (mm).
const P: Record<string, ParamSpec> = {
  // widths
  top_inner: { ref: 2260, kind: 'W', step: 10 },
  body_step: { ref: 40, kind: 'W', step: 5 },
  ring_step: { ref: 50, kind: 'W', step: 5 },
  overhang: { ref: 110, kind: 'W', step: 5 },
  cavity: { ref: 1730, kind: 'W', step: 10 },
  clear_off: { ref: 47.59, kind: 'W', step: 0.01 },
  base_margin: { ref: 150, kind: 'W', step: 5 },
  base_edge: { ref: 32, kind: 'W', step: 1 },
  duct_side: { ref: 186, kind: 'W', step: 1 },
  duct_gap: { ref: 175, kind: 'W', step: 5 },
  pipe_proj: { ref: 290, kind: 'W', step: 5 },
  panel_pitch: { ref: 230, kind: 'W', step: 5 },
  edge_in: { ref: 140, kind: 'W', step: 5 },
  spout_w: { ref: 540, kind: 'W', step: 5 },
  // heights
  cone_h: { ref: 334, kind: 'H', step: 5 },
  tier1: { ref: 280, kind: 'H', step: 5 },
  tier2: { ref: 280, kind: 'H', step: 5 },
  tier3: { ref: 282, kind: 'H', step: 5 },
  duct_h: { ref: 100, kind: 'H', step: 5 },
  spout_h: { ref: 248, kind: 'H', step: 5 },
  // plate thicknesses
  t_top: { ref: 10, kind: 'T', step: 1 },
  t_spacer: { ref: 8, kind: 'T', step: 1 },
  t_rib: { ref: 8, kind: 'T', step: 1 },
  t_duct_rib: { ref: 8, kind: 'T', step: 1 },
  t_ring: { ref: 25, kind: 'T', step: 1 },
  t_base: { ref: 22, kind: 'T', step: 1 },
  // fixed
  allow: { ref: 1, kind: 'FIXED', step: 1 },
  vent_dia: { ref: 5, kind: 'FIXED', step: 1 },
  panel_count: { ref: 7, kind: 'FIXED', step: 1 },
  duct_count: { ref: 8, kind: 'FIXED', step: 1 },
};

const STD_PLATES = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 63, 70, 80];
const snapPlate = (v: number) => STD_PLATES.reduce((best, p) => (Math.abs(p - v) < Math.abs(best - v) ? p : best), STD_PLATES[0]);
const roundTo = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(2));
const r2 = (v: number) => Number(v.toFixed(2));

export type ShellGeometry = Record<string, number>;

function derive(v: Record<string, number>): ShellGeometry {
  const g: ShellGeometry = { ...v };
  g.ring = v.top_inner + 2 * v.ring_step;
  g.flange = g.ring + 2 * v.overhang;
  g.body_od = v.top_inner + 2 * v.body_step;
  // 2*edge_out + 2*edge_in + n*pitch + 10 ribs = top_inner  (closes exactly as on the drawing)
  g.edge_out = (v.top_inner - v.panel_count * v.panel_pitch - 10 * v.t_rib - 2 * v.edge_in) / 2;
  g.cavity_clear = v.cavity - v.clear_off;
  g.duct_pitch = v.duct_gap + v.t_duct_rib;
  g.duct_array = v.duct_count * g.duct_pitch;
  g.base_w = 2 * v.base_edge + 2 * v.duct_side + g.duct_array;
  g.base_clear = g.base_w - 2 * v.base_margin;
  g.h_tiers = v.tier1 + v.t_spacer + v.tier2 + v.t_spacer + v.tier3;
  g.h_shell = v.cone_h + g.h_tiers + v.t_ring + v.allow;
  g.h_below = v.t_ring + v.duct_h + v.t_base;
  g.h_total = g.h_shell + g.h_below;
  Object.keys(g).forEach((k) => (g[k] = r2(g[k])));
  return g;
}

export function buildReferenceGeometry(): ShellGeometry {
  const v: Record<string, number> = {};
  Object.entries(P).forEach(([k, s]) => (v[k] = s.ref));
  return derive(v);
}

export interface ShellScaling {
  ratio: number; // target tonnage / reference tonnage
  sD: number; // width (plan) scale
  sH: number; // height scale
  sT: number; // plate thickness scale
  mode: 'FREE' | 'LOCK_HEIGHT' | 'LOCK_WIDTH' | 'CAPPED_HEIGHT' | 'CAPPED_WIDTH';
  note: string;
  lockTotalH?: number; // when set, the lower tier absorbs plate-thickness growth so total height stays exact
}

export function computeShellScaling(
  refCap: number,
  targetCap: number,
  constraint: DimensionalConstraint = 'NONE',
  customMaxHeightMm?: number,
  customMaxWidthMm?: number
): ShellScaling {
  const ratio = Math.max(0.05, targetCap) / Math.max(0.05, refCap);
  const free = Math.cbrt(ratio);
  const sT = Math.pow(ratio, 0.25);
  const ref = buildReferenceGeometry();

  let sD = free;
  let sH = free;
  let mode: ShellScaling['mode'] = 'FREE';
  let lockTotalH: number | undefined;
  let note = `Geometric similarity: all widths and heights x ${free.toFixed(3)} (cube root of tonnage ratio ${ratio.toFixed(2)}).`;

  const geomOf = (d: number, h: number) => buildScaledGeometry({ ratio, sD: d, sH: h, sT, mode: 'FREE', note: '' });

  if (constraint === 'LOCK_HEIGHT') {
    sH = 1;
    sD = Math.sqrt(ratio);
    mode = 'LOCK_HEIGHT';
    lockTotalH = ref.h_total;
    note = `Overall height locked to the reference drawing (${ref.h_total} mm). Widths x ${sD.toFixed(3)} (square root of ratio) to carry the new capacity; Tier 3 absorbs plate growth.`;
  } else if (constraint === 'LOCK_WIDTH') {
    sD = 1;
    sH = ratio;
    mode = 'LOCK_WIDTH';
    note = `Overall width locked to the reference drawing. Heights x ${sH.toFixed(3)} to carry the new capacity.`;
  } else if (constraint === 'CUSTOM_MAX_HEIGHT' && customMaxHeightMm && customMaxHeightMm > 0) {
    if (geomOf(free, free).h_total > customMaxHeightMm) {
      sH = customMaxHeightMm / ref.h_total;
      sD = Math.sqrt(ratio / sH);
      // tighten until the rounded drawing really fits under the limit
      for (let i = 0; i < 200 && geomOf(sD, sH).h_total > customMaxHeightMm; i++) {
        sH *= 0.995;
        sD = Math.sqrt(ratio / sH);
      }
      mode = 'CAPPED_HEIGHT';
      note = `Overall height capped at ${customMaxHeightMm} mm. Heights x ${sH.toFixed(3)}, widths x ${sD.toFixed(3)} to keep the capacity.`;
    }
  } else if (constraint === 'CUSTOM_MAX_WIDTH' && customMaxWidthMm && customMaxWidthMm > 0) {
    if (geomOf(free, free).flange > customMaxWidthMm) {
      sD = customMaxWidthMm / ref.flange;
      sH = ratio / (sD * sD);
      for (let i = 0; i < 200 && geomOf(sD, sH).flange > customMaxWidthMm; i++) {
        sD *= 0.995;
        sH = ratio / (sD * sD);
      }
      mode = 'CAPPED_WIDTH';
      note = `Overall flange width capped at ${customMaxWidthMm} mm. Widths x ${sD.toFixed(3)}, heights x ${sH.toFixed(3)} to keep the capacity.`;
    }
  }

  return { ratio, sD, sH, sT, mode, note, lockTotalH };
}

export function buildScaledGeometry(s: ShellScaling): ShellGeometry {
  const v: Record<string, number> = {};
  // A scale of exactly 1 keeps the drawing value untouched (no rounding drift).
  Object.entries(P).forEach(([k, spec]) => {
    if (spec.kind === 'W') v[k] = s.sD === 1 ? spec.ref : roundTo(spec.ref * s.sD, spec.step);
    else if (spec.kind === 'H') v[k] = s.sH === 1 ? spec.ref : roundTo(spec.ref * s.sH, spec.step);
    else if (spec.kind === 'T') v[k] = s.sT === 1 ? spec.ref : snapPlate(spec.ref * s.sT);
    else v[k] = spec.ref;
  });
  let g = derive(v);
  if (s.lockTotalH !== undefined && Math.abs(g.h_total - s.lockTotalH) > 0.004) {
    v.tier3 = r2(v.tier3 + (s.lockTotalH - g.h_total));
    g = derive(v);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Dimension register (what is listed in the tables)
// ---------------------------------------------------------------------------
interface DimDef {
  id: string;
  label: string;
  group: ShellGroupId;
  rule?: string; // only for derived dims; independent dims get an automatic rule
  unit?: string;
  extractedKey?: string; // key in the pasted-drawing extraction table
  decimals?: number;
}

const DIMS: DimDef[] = [
  // 1 envelope
  { id: 'flange', label: 'Overall top flange span', group: 'envelope', rule: 'Ring width + 2 x flange overhang', extractedKey: 'overallTopWidth' },
  { id: 'ring', label: 'Upper flange ring width', group: 'envelope', rule: 'Top casing width + 2 x ring step', extractedKey: 'topCasingWidth' },
  { id: 'top_inner', label: 'Shell outer casing width (top)', group: 'envelope', extractedKey: 'shellOuterCasing' },
  { id: 'body_od', label: 'Shell body outer width', group: 'envelope', rule: 'Top casing width + 2 x body step' },
  { id: 'h_shell', label: 'Active shell cylinder height', group: 'envelope', rule: 'Cone + 3 tiers + 2 spacers + bottom ring + M/C stock', extractedKey: 'shellHeight' },
  { id: 'h_total', label: 'Total machined assembly height', group: 'envelope', rule: 'Shell height + (ring + duct height + base plate)', extractedKey: 'totalMachinedHeight' },
  // 2 flange
  { id: 'overhang', label: 'Top flange overhang (each side)', group: 'flange' },
  { id: 'ring_step', label: 'Ring step to casing (each side)', group: 'flange' },
  { id: 'body_step', label: 'Body step to casing (each side)', group: 'flange' },
  { id: 'cone_h', label: 'Top cone / flange section height', group: 'flange' },
  { id: 't_top', label: 'Top rim plate thickness', group: 'flange' },
  // 3 body
  { id: 'tier1', label: 'Tier 1 height (upper)', group: 'body' },
  { id: 'tier2', label: 'Tier 2 height (middle)', group: 'body' },
  { id: 'tier3', label: 'Tier 3 height (lower)', group: 'body' },
  { id: 'h_tiers', label: 'Total tier stack (incl. spacers)', group: 'body', rule: 'Tier 1 + Tier 2 + Tier 3 + 2 x spacer' },
  { id: 't_spacer', label: 'Tier spacer plate thickness', group: 'body' },
  { id: 't_ring', label: 'Bottom ring plate thickness', group: 'body' },
  { id: 'allow', label: 'Machining stock (M/C allowance)', group: 'body' },
  // 4 panels
  { id: 'panel_pitch', label: 'Centre panel width', group: 'panels' },
  { id: 'edge_out', label: 'Outer edge panel width', group: 'panels', rule: '(Casing width - 7 x panel - 10 x rib - 2 x inner edge) / 2' },
  { id: 'edge_in', label: 'Inner edge panel width', group: 'panels' },
  { id: 't_rib', label: 'Vertical rib plate thickness', group: 'panels' },
  { id: 'panel_count', label: 'Centre panel count', group: 'panels', unit: 'nos' },
  { id: 'vent_dia', label: 'Air vent hole dia', group: 'panels' },
  // 5 spout
  { id: 'spout_w', label: 'Spout opening width', group: 'spout', extractedKey: 'spoutOpeningWidth' },
  { id: 'spout_h', label: 'Spout box height', group: 'spout' },
  // 6 base
  { id: 'cavity', label: 'Internal shell cavity width', group: 'base', extractedKey: 'innerCasingDiameter' },
  { id: 'cavity_clear', label: 'Cavity clear width (after chamfer)', group: 'base', rule: 'Cavity width - chamfer offset', decimals: 2 },
  { id: 'clear_off', label: 'Cavity chamfer offset (total)', group: 'base', decimals: 2 },
  { id: 'base_w', label: 'Bottom base mounting width', group: 'base', rule: '2 x edge + 2 x side + duct array', extractedKey: 'bottomBaseWidth' },
  { id: 'base_clear', label: 'Base clear width (between margins)', group: 'base', rule: 'Base width - 2 x base margin' },
  { id: 'base_margin', label: 'Base margin (each side)', group: 'base' },
  { id: 'base_edge', label: 'Base edge strip (each side)', group: 'base' },
  { id: 'duct_side', label: 'Duct side strip (each side)', group: 'base' },
  { id: 'duct_gap', label: 'Cooling duct clear gap', group: 'base' },
  { id: 't_duct_rib', label: 'Cooling duct rib thickness', group: 'base' },
  { id: 'duct_pitch', label: 'Cooling duct pitch', group: 'base', rule: 'Duct gap + rib thickness' },
  { id: 'duct_array', label: 'Duct array length (8 x pitch)', group: 'base', rule: 'Duct count x duct pitch', extractedKey: 'coolingDuctPitch' },
  { id: 'duct_count', label: 'Cooling duct count', group: 'base', unit: 'nos' },
  { id: 'duct_h', label: 'Cooling duct section height', group: 'base' },
  { id: 't_base', label: 'Base plate thickness', group: 'base' },
  { id: 'pipe_proj', label: 'Water pipe projection beyond base', group: 'base' },
];

const KIND_LABEL: Record<Kind, (step: number) => string> = {
  W: (s) => `Ref x width scale (s_w), round ${s} mm`,
  H: (s) => `Ref x height scale (s_h), round ${s} mm`,
  T: () => 'Ref x (Cap ratio)^0.25, snap to std plate',
  FIXED: () => 'Fixed - not scaled with tonnage',
};

export interface ShellDimension {
  id: string;
  label: string;
  group: ShellGroupId;
  unit: string;
  ref: number;
  value: number;
  delta: number;
  deltaPct: number;
  rule: string;
  changed: boolean;
  decimals: number;
  extractedKey?: string;
}

export interface ShellCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ShellResult {
  refCapacity: number;
  targetCapacity: number;
  scaling: ShellScaling;
  ref: ShellGeometry;
  req: ShellGeometry;
  dims: ShellDimension[];
  byExtractedKey: Record<string, ShellDimension>;
  checks: ShellCheck[];
  changedCount: number;
}

export function calculateShell(inputs: FurnaceInputs): ShellResult {
  const scaling = computeShellScaling(
    inputs.baselineCapacity,
    inputs.targetCapacity,
    inputs.dimensionalConstraint,
    inputs.customMaxHeightMm,
    inputs.customMaxWidthMm
  );
  const ref = buildReferenceGeometry();
  const req = buildScaledGeometry(scaling);

  const dims: ShellDimension[] = DIMS.map((d) => {
    const spec = P[d.id];
    const rule = d.rule ?? (spec ? KIND_LABEL[spec.kind](spec.step) : '');
    const decimals = d.decimals ?? 0;
    const value = req[d.id];
    const refV = ref[d.id];
    const delta = r2(value - refV);
    return {
      id: d.id,
      label: d.label,
      group: d.group,
      unit: d.unit ?? 'mm',
      ref: refV,
      value,
      delta,
      deltaPct: refV !== 0 ? Number((((value - refV) / refV) * 100).toFixed(1)) : 0,
      rule,
      changed: Math.abs(delta) > 0.004,
      decimals,
      extractedKey: d.extractedKey,
    };
  });

  const byExtractedKey: Record<string, ShellDimension> = {};
  dims.forEach((d) => {
    if (d.extractedKey) byExtractedKey[d.extractedKey] = d;
  });

  const tol = 0.011;
  const panelChain = 2 * req.edge_out + 2 * req.edge_in + req.panel_count * req.panel_pitch + 10 * req.t_rib;
  const checks: ShellCheck[] = [
    {
      label: 'Reference chain reproduces the drawing',
      ok: ref.flange === 2580 && ref.h_total === 1365 && ref.h_shell === 1218 && ref.base_w === 1900 && ref.duct_array === 1464 && ref.base_clear === 1600 && ref.cavity_clear === 1682.41,
      detail: `Flange ${ref.flange}, shell ${ref.h_shell}, total ${ref.h_total}, base ${ref.base_w}, duct array ${ref.duct_array}, clear ${ref.cavity_clear}`,
    },
    {
      label: 'Panel row closes to casing width',
      ok: req.edge_out > 0 && Math.abs(panelChain - req.top_inner) < tol,
      detail: `2 x ${req.edge_out} + 2 x ${req.edge_in} + ${req.panel_count} x ${req.panel_pitch} + 10 x ${req.t_rib} = ${r2(panelChain)} (casing ${req.top_inner})`,
    },
    {
      label: 'Flange > ring > casing > cavity',
      ok: req.flange > req.ring && req.ring > req.top_inner && req.top_inner > req.cavity,
      detail: `${req.flange} > ${req.ring} > ${req.top_inner} > ${req.cavity}`,
    },
    {
      label: 'Base plate wider than cavity',
      ok: req.base_w > req.cavity,
      detail: `Base ${req.base_w} vs cavity ${req.cavity}`,
    },
    {
      label: 'Height chain closes',
      ok: Math.abs(req.h_total - (req.h_shell + req.h_below)) < tol,
      detail: `${req.h_shell} + ${req.h_below} = ${r2(req.h_shell + req.h_below)} (total ${req.h_total})`,
    },
  ];

  if (inputs.dimensionalConstraint === 'CUSTOM_MAX_HEIGHT' && inputs.customMaxHeightMm) {
    checks.push({
      label: 'Within custom height limit',
      ok: req.h_total <= inputs.customMaxHeightMm + 5,
      detail: `Total ${req.h_total} vs limit ${inputs.customMaxHeightMm} (5 mm rounding tolerance)`,
    });
  }
  if (inputs.dimensionalConstraint === 'CUSTOM_MAX_WIDTH' && inputs.customMaxWidthMm) {
    checks.push({
      label: 'Within custom width limit',
      ok: req.flange <= inputs.customMaxWidthMm + 10,
      detail: `Flange ${req.flange} vs limit ${inputs.customMaxWidthMm} (10 mm rounding tolerance)`,
    });
  }

  return {
    refCapacity: inputs.baselineCapacity,
    targetCapacity: inputs.targetCapacity,
    scaling,
    ref,
    req,
    dims,
    byExtractedKey,
    checks,
    changedCount: dims.filter((d) => d.changed).length,
  };
}

/**
 * Required value for ANY dimension read from a drawing that is not one of the catalogued shell dimensions.
 * It is a transparent rule, not a design calculation, and the UI/exports label it as "rule":
 *  - counts, vent/hole sizes, machining allowances, lugs/stiffeners, inlet/outlet spacing and non-length units: unchanged
 *  - plate / rib / flat / spacer thicknesses (<= 40): reference x tonnage ratio^0.25, snapped to a standard plate
 *  - heights (height, tier, drop, cone, section height): reference x height scale
 *  - everything else (widths, depths, edge distances, spacings): reference x width scale
 * Lengths are rounded to 5 mm from 100 mm up, 1 mm from 20 mm, 0.5 mm below; non-integer inputs keep 2 decimals.
 */
export function scaleGenericDimension(label: string, valueMm: number, unit: string, s: ShellScaling): number {
  const L = label.toLowerCase();
  if (!/^(mm|millimet)/i.test((unit || 'mm').trim())) return valueMm;
  if (/(vent|allowance|lug|stiffener|inlet|outlet|\bnos?\b\.?$|holes?\b(?!.*(spacing|pitch|edge|offset|distance)))/i.test(L)) return valueMm;
  if (/(thk|thick|plate|rib|flat|spacer|rim|wall)/i.test(L) && !/(width|length|depth|bay|panel|array|pitch)/i.test(L) && valueMm <= 40) {
    return snapPlate(valueMm * s.sT);
  }
  const vertical = /(height|tier|drop|cone|rise|stack|elevation)/i.test(L);
  const f = vertical ? s.sH : s.sD;
  if (f === 1) return valueMm;
  const raw = valueMm * f;
  if (!Number.isInteger(valueMm)) return r2(raw);
  return roundTo(raw, valueMm >= 100 ? 5 : valueMm >= 20 ? 1 : 0.5);
}

/** Every shell dimension with its reference value (used to ask the vision model to locate each one). */
export function getShellDimCatalog(): { id: string; label: string; value: number; unit: string }[] {
  const ref = buildReferenceGeometry();
  return DIMS.map((d) => ({ id: d.id, label: d.label, value: ref[d.id], unit: d.unit ?? 'mm' }));
}

export function formatDim(v: number, decimals = 0): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(decimals || 2);
}

export function shellDimsToCsv(shell: ShellResult): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ['Group', 'Dimension', 'Unit', `Reference (${shell.refCapacity} t)`, `Target (${shell.targetCapacity} t)`, 'Change', 'Change %', 'Rule'].map(q).join(','),
  ];
  shell.dims.forEach((d) => {
    const g = SHELL_GROUPS.find((x) => x.id === d.group)?.title ?? d.group;
    rows.push([q(g), q(d.label), q(d.unit), d.ref, d.value, d.delta, d.deltaPct, q(d.rule)].join(','));
  });
  return rows.join('\r\n');
}

