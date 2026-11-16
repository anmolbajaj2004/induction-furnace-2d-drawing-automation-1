// Model-independent drawing extraction pipeline (used by server.ts for Gemini and for every OpenRouter model).
//
// Why per view + two passes: a single request over three drawings makes models stop after a few dozen callouts.
// One focused request per view, followed by a "what did you miss?" pass, gets the full list out of weaker models too.
// Nothing here invents values: every entry must come from the model reading the image, and unreadable ones are dropped.

export type ViewName = 'FRONT' | 'TOP' | 'SIDE';
export interface ViewImage {
  view: ViewName;
  dataUrl: string;
}
export interface CatalogueEntry {
  id: string;
  label: string;
  value: number;
  unit?: string;
}
export type CallFn = (images: { label: string; dataUrl: string }[], prompt: string) => Promise<any[]>;

const VIEW_TITLE: Record<ViewName, string> = {
  FRONT: 'FRONT ELEVATION VIEW',
  TOP: 'TOP PLAN VIEW',
  SIDE: 'SIDE PROJECTION VIEW',
};

// ---------- tolerant JSON handling ----------
const salvageArray = (t: string): any[] | null => {
  // For answers cut off by the token limit: keep every complete object, close the array.
  const a = t.indexOf('[');
  if (a < 0) return null;
  let s = t.slice(a);
  for (let i = 0; i < 600; i++) {
    const b = s.lastIndexOf('}');
    if (b < 0) return null;
    try {
      const v = JSON.parse(s.slice(0, b + 1) + ']');
      return Array.isArray(v) ? v : null;
    } catch {
      s = s.slice(0, b);
    }
  }
  return null;
};

export const parseJsonLoose = (text: string): any => {
  const t = (text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const a = Math.min(...['[', '{'].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
    const b = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
    if (a !== Infinity && b > a) {
      try {
        return JSON.parse(t.slice(a, b + 1));
      } catch {
        /* fall through to salvage */
      }
    }
    const s = salvageArray(t);
    if (s) return s;
    throw new Error('The model did not return JSON.');
  }
};

export const toList = (parsed: any): any[] => {
  const list = Array.isArray(parsed) ? parsed : parsed?.dimensions || parsed?.extractedDimensions;
  if (!Array.isArray(list)) throw new Error('The model answer did not contain a list of dimensions.');
  return list;
};

// ---------- prompts ----------
const RULES = (view: ViewName, componentType: string) => `
You are a senior mechanical-drafting engineer reading ONE orthographic view of a "${componentType}" drawing: the ${VIEW_TITLE[view]}.
Produce the COMPLETE dimension list for this view, the way a drafter would type it into a spreadsheet. Leave nothing out.

WHAT TO INCLUDE (every one of these):
- every dimension-line value, including EACH segment of a chain dimension AND the overall total of that chain;
- array / pitch callouts such as "183x8=1464" or "220x10=2420": one entry for the total and one entry for the pitch (put the count in the label);
- thickness and plate callouts ("25 THK", "16 THK", "10 THK"), rib / flat / spacer thicknesses, item-bubble plate sizes;
- hole, vent, pipe and bolt sizes (diameters, counts), edge distances, offsets, spacings, steps, overhangs - also the ones marked "each side" or "x2";
- heights, tier heights, machining allowances ("3 M/C"), chamfer / diagonal plate sizes, spout sizes;
- dimensions printed inside section or detail views that sit in this image, and derived callouts such as "2260-2x16".
- If the same number appears on two different features, list both as separate entries.

STRICT RULES (no guessing):
- Only values that are legible in this image. Never invent a value, never measure from the drawing scale, never fill a gap with a typical value. If a number is unreadable, skip it.
- valueMm = the number as printed, without THK / Ø / mm. For an expression such as "2260-2x16" evaluate it (2228) and write the expression in description. For "NxP=T" return T and P as two entries.
- unit = the unit printed on the drawing. If none is printed use "mm" and say "unit not printed" in description.
- Self-check before answering: chain segments must add up to their total. Re-read every entry that does not add up and fix it or drop the doubtful one.
- cropBox = tight box around the dimension line AND its number, in percent of THIS image (x, y = top-left corner, w, h = size, all 0-100).
- key = lowercase snake_case, "${view.toLowerCase()}_" followed by a short label, unique within this view.
- label = short human label in drafting words (e.g. "Spout opening width", "Tier 2 height"). layerName = "DIM_${view}". viewSource = "${view}".
- description = what it measures and where; drawingLocation = where in the image; cadEntity = DIMLINEAR, DIMDIAMETER, DIMANGULAR, LEADER or NOTE.
- Do not stop early: list every callout you can read.

OUTPUT: ONLY a JSON array (no prose, no markdown). Each element has exactly: key, label, valueMm, unit, layerName, description, drawingLocation, cadEntity, viewSource, cropBox {x,y,w,h}.
`;

const catalogueHint = (cat: CatalogueEntry[]) => `
OPTIONAL MATCHING HINT: this component is a furnace shell. If a callout you extract is the same feature as one of the entries below, use key exactly "shell_<id>" for it (the drawing may be a different size - match by meaning and position, not by number). The list is NOT a limit: still extract every other callout with normal keys.
${cat
  .slice(0, 80)
  .map((d) => `- id=${d.id} | ${d.label} | reference ${d.value} ${d.unit || 'mm'}`)
  .join('\n')}
`;

const missedPrompt = (view: ViewName, found: any[]) => `
This is the ${VIEW_TITLE[view]} again. These entries were already extracted from it:
${found.map((d) => `- ${d.label} = ${d.valueMm}`).join('\n')}

Scan the image again, systematically: top to bottom, left to right, every section / detail view, every note, every item bubble, every "each side" or "x2" callout, and every chain segment.
Return ONLY callouts that are clearly readable in the image and NOT already in the list above, in the same JSON array format as before (same field names, key prefix "${view.toLowerCase()}_", layerName "DIM_${view}", viewSource "${view}", cropBox in percent of this image).
If nothing is missing return []. Never repeat an entry, never invent one.
`;

// ---------- cleaning ----------
const slug = (s: string) =>
  String(s || 'dim')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'dim';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const cleanBox = (b: any) => {
  if (!b || ![b.x, b.y, b.w, b.h].every((n) => Number.isFinite(Number(n)))) return undefined;
  const x = clamp(Number(b.x), 0, 100);
  const y = clamp(Number(b.y), 0, 100);
  return { x, y, w: clamp(Number(b.w), 0.5, 100 - x), h: clamp(Number(b.h), 0.5, 100 - y) };
};

const labelKey = (d: any) => `${Number(d.valueMm)}|${String(d.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

async function extractOneView(
  call: CallFn,
  img: ViewImage,
  componentType: string,
  catalogue: CatalogueEntry[] | undefined
): Promise<{ list: any[]; warning?: string }> {
  const images = [{ label: `IMAGE: ${VIEW_TITLE[img.view]}`, dataUrl: img.dataUrl }];
  const first = await call(images, RULES(img.view, componentType) + (catalogue?.length ? catalogueHint(catalogue) : ''));

  const usable = (l: any[]) =>
    l.filter((d) => d && Number.isFinite(Number(d.valueMm))).map((d) => ({ ...d, valueMm: Number(d.valueMm), viewSource: img.view }));

  let list = usable(first);
  let warning: string | undefined;
  try {
    const more = usable(await call(images, missedPrompt(img.view, list)));
    const have = new Set(list.map(labelKey));
    more.forEach((d) => {
      if (!have.has(labelKey(d))) {
        have.add(labelKey(d));
        list.push(d);
      }
    });
  } catch (e: any) {
    warning = `${img.view}: second (missed-callouts) pass failed: ${e?.message || e}`;
  }
  return { list, warning };
}

export async function extractAllViews(
  call: CallFn,
  views: ViewImage[],
  componentType: string,
  catalogue?: CatalogueEntry[]
): Promise<{ dimensions: any[]; warnings: string[] }> {
  const warnings: string[] = [];
  const settled = await Promise.allSettled(views.map((v) => extractOneView(call, v, componentType, catalogue)));

  const seen = new Set<string>();
  const out: any[] = [];
  const unique = (base: string) => {
    let k = base;
    for (let i = 2; seen.has(k); i++) k = `${base}_${i}`;
    seen.add(k);
    return k;
  };

  let failures = 0;
  settled.forEach((r, i) => {
    const view = views[i].view;
    if (r.status === 'rejected') {
      failures++;
      warnings.push(`${view}: ${r.reason?.message || r.reason}`);
      return;
    }
    if (r.value.warning) warnings.push(r.value.warning);
    r.value.list.forEach((d: any) => {
      let key = String(d.key || '').trim();
      // a catalogue key may be used once; later hits on other views get a view-prefixed key
      const isCat = key.startsWith('shell_');
      if (!key || (isCat && seen.has(key))) key = `${view.toLowerCase()}_${slug(d.label)}`;
      if (!isCat && !key.startsWith(view.toLowerCase() + '_')) key = `${view.toLowerCase()}_${slug(key)}`;
      out.push({
        key: unique(key),
        label: String(d.label || key),
        valueMm: d.valueMm,
        unit: String(d.unit || 'mm'),
        layerName: String(d.layerName || `DIM_${view}`),
        description: String(d.description || ''),
        drawingLocation: String(d.drawingLocation || ''),
        cadEntity: String(d.cadEntity || 'DIMLINEAR'),
        viewSource: view,
        cropBox: cleanBox(d.cropBox),
      });
    });
  });

  if (failures === views.length) throw new Error(warnings.join(' | ') || 'Extraction failed for every view.');
  return { dimensions: out, warnings };
}
