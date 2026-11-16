// Conversion of "given" dimensions to the required size using ONLY the pasted drawings:
// the given drawing (capacity / power known), a reference drawing of a furnace of another size (capacity / power typed
// in by the user), and the target. No built-in shell model and no assumed standard sizes are used here.
//
//  1. matchReference: each given dimension is paired with the reference dimension that has the same meaning
//     (same view, same unit, agreeing label words and numbers). Unpaired dimensions get NO required value.
//  2. convertThroughImages: the paired values (given g at axis Ag, reference r at axis Ar) define a curve through the
//     two drawings, which is evaluated at the target axis value At.

import { ExtractedDwgDimension } from '../types/furnace';

export type Axis = 'capacity' | 'power';
export type Curve = 'power' | 'linear';

// ---------- matching ----------
const STOP = new Set(['the', 'and', 'each', 'side', 'with', 'from', 'after', 'label', 'unsure', 'dimension', 'nos']);
const words = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/\[.*?\]/g, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w === 'overall' ? 'total' : w === 'span' ? 'width' : w));
const nums = (s: string) => (String(s || '').replace(/\[.*?\]/g, ' ').match(/\d+/g) || []).join(',');

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter);
};

const centre = (d: ExtractedDwgDimension) => (d.cropBox ? { x: d.cropBox.x + d.cropBox.w / 2, y: d.cropBox.y + d.cropBox.h / 2 } : null);

export interface RefMatch {
  ref: ExtractedDwgDimension;
  score: number;
}

/** Pairs every given dimension with at most one reference dimension (each reference dimension used once). */
export function matchReference(given: ExtractedDwgDimension[], refs: ExtractedDwgDimension[]): Record<string, RefMatch> {
  type Pair = { g: ExtractedDwgDimension; r: ExtractedDwgDimension; score: number };
  const pairs: Pair[] = [];
  given.forEach((g) => {
    const gw = words(g.label);
    refs.forEach((r) => {
      if (r.viewSource !== g.viewSource) return;
      if ((r.unit || 'mm').toLowerCase() !== (g.unit || 'mm').toLowerCase()) return;
      if (!(g.valueMm > 0 && r.valueMm > 0)) return;
      const ratio = r.valueMm / g.valueMm;
      if (ratio < 0.25 || ratio > 4) return; // not the same feature
      const ng = nums(g.label);
      const nr = nums(r.label);
      if (ng !== '' && nr !== '' && ng !== nr) return; // "Tier 1" is not "Tier 2"
      const label = g.key === r.key ? 1 : jaccard(gw, words(r.label));
      if (label < 0.5) return; // the labels must agree
      // layout position only ranks equally good label matches
      const cg = centre(g);
      const cr = centre(r);
      const pos = cg && cr ? 1 - Math.min(1, Math.hypot(cg.x - cr.x, cg.y - cr.y) / 50) : 0.5;
      pairs.push({ g, r, score: label * 0.85 + pos * 0.15 });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  const usedG = new Set<string>();
  const usedR = new Set<string>();
  const out: Record<string, RefMatch> = {};
  pairs.forEach((p) => {
    if (usedG.has(p.g.key) || usedR.has(p.r.key)) return;
    usedG.add(p.g.key);
    usedR.add(p.r.key);
    out[p.g.key] = { ref: p.r, score: p.score };
  });
  return out;
}

// ---------- conversion ----------
export interface ConvertParams {
  axis: Axis;
  curve: Curve;
  given: { capacity: number; power: number };
  ref: { capacity: number | null; power: number | null };
  target: { capacity: number; power: number };
}
export interface Converted {
  value: number | null;
  note: string;
  extrapolated: boolean;
}

const decimalsOf = (n: number) => {
  const s = String(n);
  return s.includes('.') ? Math.min(2, s.split('.')[1].length) : 0;
};

const axisValues = (p: ConvertParams) => {
  const Ag = p.axis === 'capacity' ? p.given.capacity : p.given.power;
  const Ar = p.axis === 'capacity' ? p.ref.capacity : p.ref.power;
  const At = p.axis === 'capacity' ? p.target.capacity : p.target.power;
  return { Ag, Ar, At };
};

/** Why conversion is impossible with the numbers typed in (null when it is possible). */
export function conversionBlocker(p: ConvertParams): string | null {
  const { Ag, Ar, At } = axisValues(p);
  const what = p.axis === 'capacity' ? 'capacity' : 'power';
  if (!(Number.isFinite(Ar as number) && (Ar as number) > 0)) return `Enter the reference image ${what} in Step 1.`;
  if (!(Ag > 0)) return `The given drawing ${what} must be above 0.`;
  if (!(At > 0)) return `The required ${what} must be above 0.`;
  if (Math.abs((Ar as number) - Ag) < 1e-9) return `The reference image has the same ${what} as the given drawing, so no curve can be drawn through them.`;
  return null;
}

export function convertThroughImages(g: number, r: number, p: ConvertParams): Converted {
  const blocker = conversionBlocker(p);
  if (blocker) return { value: null, note: blocker, extrapolated: false };
  const { Ag, Ar, At } = axisValues(p);
  const ArN = Ar as number;
  const usePower = p.curve === 'power' && g > 0 && r > 0;

  let v: number;
  if (Math.abs(r - g) < 1e-9) {
    v = g; // same on both drawings: stays as drawn
  } else if (usePower) {
    const k = Math.log(r / g) / Math.log(ArN / Ag);
    v = g * Math.pow(At / Ag, k);
  } else {
    v = g + ((r - g) * (At - Ag)) / (ArN - Ag);
  }
  const dec = Math.max(decimalsOf(g), decimalsOf(r));
  const value = Number(v.toFixed(dec));
  const lo = Math.min(Ag, ArN);
  const hi = Math.max(Ag, ArN);
  const extrapolated = At < lo - 1e-9 || At > hi + 1e-9;
  const axisName = p.axis === 'capacity' ? 't' : 'MW';
  const note =
    `${p.curve === 'power' && usePower ? 'power-law' : 'linear'} through given ${g} @ ${Ag} ${axisName} and reference ${r} @ ${ArN} ${axisName}, evaluated at ${At} ${axisName}` +
    (extrapolated ? ' (beyond both drawings: extrapolated, less reliable)' : '');
  return { value, note, extrapolated };
}
