/**
 * SHELL DIMENSION TEMPLATE  FCE-SHEL  v3.0-shell-dimensions   (supplied by the engineer, used as-is)
 * ----------------------------------------------------------------------------
 * Master  : drawing 1PIC-227-S07 (8.64 t)
 * Anchor 2: drawing 1PIC-193-S07 (6.247 t)
 * Both anchors are reproduced exactly by the steps below (see verifyTemplate()).
 *
 * Plan dimensions are a linear interpolation between the two anchors:
 *   X(T) = X1 + (X2 - X1) * (T - 6.247) / (8.64 - 6.247)
 * Heights, plate thicknesses, spout, hearth seat etc. are constants: they are copied from the Base drawing, never scaled.
 * Outside 6.247 .. 8.64 t every formula result is EXTRAPOLATED and needs a designer check.
 *
 * Nothing here is invented: a dimension that is not in the template's dimension table gets NO required value.
 */

export const TEMPLATE_ID = 'FCE-SHEL';
export const TEMPLATE_VERSION = '3.0-shell-dimensions';
export const T_MIN = 6.247;
export const T_MAX = 8.64;
export const DEFAULT_T_SIDE = 16; // mm, template input "t_side"

// Python's round() is round-half-to-even; the template was verified with it.
const pyRound = (x: number): number => (Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x));
const lerp = (T: number, a: number, b: number) => a + ((b - a) * (T - T_MIN)) / (T_MAX - T_MIN);

type Vals = Record<string, number>;
interface Step {
  name: string;
  unit: string;
  label: string;
  f: (v: Vals, T: number, ts: number) => number;
}

// Evaluated top to bottom; a step may use T, t_side and earlier steps (same order as the template).
export const TEMPLATE_STEPS: Step[] = [
  { name: 'L_clear', unit: 'mm', label: 'Clear length', f: (_v, T) => pyRound(lerp(T, 2008, 2228)) },
  { name: 'W_clear', unit: 'mm', label: 'Clear width', f: (_v, T) => pyRound(lerp(T, 1328, 1428)) },
  { name: 'L_out', unit: 'mm', label: 'Outer length', f: (v, _T, ts) => v.L_clear + 2 * ts },
  { name: 'W_out', unit: 'mm', label: 'Outer width', f: (v, _T, ts) => v.W_clear + 2 * ts },
  { name: 'frame_L', unit: 'mm', label: 'Top frame length', f: (v) => v.L_out + 2 * 160 },
  { name: 'frame_W', unit: 'mm', label: 'Top frame width', f: (v) => v.W_out + 2 * 160 },
  { name: 'ring_L', unit: 'mm', label: 'Ring length', f: (v) => v.L_out + 100 },
  { name: 'inner_open_W', unit: 'mm', label: 'Inner opening width', f: (v) => v.W_out + 100 },
  { name: 'bottom_L', unit: 'mm', label: 'Bottom length', f: (v) => v.L_out + 80 },
  { name: 'bottom_W', unit: 'mm', label: 'Bottom width', f: (v) => v.W_out + 80 },
  { name: 'bolt_line_L', unit: 'mm', label: 'Bolt line length', f: (v) => v.frame_L - 160 },
  { name: 'bolt_pitch', unit: 'mm', label: 'Bolt pitch (10 spaces)', f: (v) => v.bolt_line_L / 10 },
  { name: 'end_bay_W', unit: 'mm', label: 'End bay width', f: (v) => (v.W_out - 8 - 4 * 240 - 4 * 8) / 2 },
  { name: 'right_col_end', unit: 'mm', label: 'Right column end span', f: (v) => (v.frame_W - 80 - 1150) / 2 },
  { name: 'pipe_proj', unit: 'mm', label: 'Water pipe projection', f: (v) => (v.bottom_L - 1900) / 2 + 70 },
  { name: 'outer_end_bay_L_total', unit: 'mm', label: 'Outer end bay length (total)', f: (v) => 183 + (v.L_out - 2040) / 2 },
  { name: 'n_bays', unit: 'nos', label: 'Number of bays', f: (v) => Math.ceil((2 * (v.L_out + v.W_out)) / 530) },
  { name: 'flange_holes_18dia', unit: 'nos', label: 'Flange holes (18 dia)', f: (_v, T) => 2 * pyRound(lerp(T, 32, 40) / 2) },
  { name: 'cu_tube_length', unit: 'mm', label: 'Copper tube length', f: (_v, T) => Math.ceil(lerp(T, 5600, 6000) / 100) * 100 },
  { name: 'item18_len', unit: 'mm', label: 'Item 18 length', f: (_v, T) => 5 * pyRound(lerp(T, 360, 430) / 5) },
  { name: 'item19_len', unit: 'mm', label: 'Item 19 length', f: (_v, T) => 5 * pyRound(lerp(T, 295, 410) / 5) },
  { name: 'item20_qty', unit: 'nos', label: 'Item 20 quantity', f: (_v, T) => pyRound(lerp(T, 10, 13)) },
];

export interface TemplateValues {
  T: number;
  tSide: number;
  values: Vals;
  extrapolated: boolean; // T outside the two anchor drawings
}

export function evaluateTemplate(T: number, tSide: number = DEFAULT_T_SIDE): TemplateValues | null {
  if (!Number.isFinite(T) || T <= 0) return null;
  const values: Vals = {};
  TEMPLATE_STEPS.forEach((s) => (values[s.name] = s.f(values, T, tSide)));
  return { T, tSide, values, extrapolated: T < T_MIN - 1e-9 || T > T_MAX + 1e-9 };
}

/** End-bay layout rule: a single bay up to the 230 panel pitch, otherwise split with an 8 mm rib. */
export function endBayLayout(total: number): { split: false; single: number } | { split: true; outer: number; rib: number; inner: number } {
  if (total <= 230) return { split: false, single: total };
  const outer = 5 * Math.ceil((total - 8) / 2 / 5);
  return { split: true, outer, rib: 8, inner: total - 8 - outer };
}

// ---------------------------------------------------------------------------
// Dimension table (140 rows of the template). Code: S = same as Base (copy unchanged),
// F:<step> = formula step, L:L / L:R = end-bay layout (left / right bay).
// ---------------------------------------------------------------------------
const TABLE_SRC: string[] = [
  'shell_ring|Overall top ring width|F:frame_L',
  'shell_top_inner|Top casing width|F:ring_L',
  'front_top_inner_span|Top inner span|F:L_out',
  'shell_overhang|Top flange overhang left|S',
  'front_overhang_right|Top flange overhang right|S',
  'shell_ring_step|Ring step to casing left|S',
  'front_ring_step_right|Ring step to casing right|S',
  'shell_spout_w|Spout opening width|S',
  'shell_spout_h|Spout box height|S',
  'shell_t_top|Top rim plate thickness|S',
  'shell_cone_h|Top section height|S',
  'shell_h_shell|Shell height after M/C|S',
  'shell_h_total|Total height after M/C|S',
  'shell_allow|Machining allowance|S',
  'front_lower_height|Height below shell|S',
  'shell_duct_h|Cooling duct section height|S',
  'shell_t_base|Base plate thickness|S',
  'shell_body_step|Body step to casing left|S',
  'front_body_step_right|Body step to casing right|S',
  'shell_edge_out|Left edge panel width|L:L',
  'shell_panel_pitch|Centre panel width (x7)|S',
  'shell_edge_in|Right edge panel width|L:R',
  'shell_t_rib|Vertical rib plate thickness|S',
  'shell_tier1|Tier 1 height|S',
  'shell_t_spacer|Tier spacer thickness 1|S',
  'shell_tier2|Tier 2 height|S',
  'front_tier_spacer_2|Tier spacer thickness 2|S',
  'shell_tier3|Tier 3 height|S',
  'shell_t_ring|Bottom ring plate thickness|S',
  'shell_cavity_clear|Cavity clear width|S',
  'shell_cavity|Internal cavity width|S',
  'front_chamfer_25|Chamfer plate size 25|S',
  'front_chamfer_23|Chamfer plate size 23|S',
  'shell_vent_dia|Air vent hole diameter|S',
  'shell_duct_gap|Cooling duct clear gap|S',
  'shell_t_duct_rib|Cooling duct rib thickness|S',
  'shell_duct_array|Duct array length (183x8)|S',
  'shell_duct_pitch|Cooling duct pitch (x8)|S',
  'shell_duct_side|Duct side strip left|S',
  'front_duct_side_right|Duct side strip right|S',
  'shell_base_edge|Base edge strip left|S',
  'front_base_edge_right|Base edge strip right|S',
  'shell_base_margin|Base margin left|S',
  'shell_base_clear|Base clear width|S',
  'front_base_margin_right|Base margin right|S',
  'shell_pipe_proj|Water pipe projection|F:pipe_proj',
  'shell_base_w|Bottom base mounting width|S',
  'shell_body_od|Shell body outer width|F:bottom_L',
  'top_overall_top_width|Overall top width|F:frame_L',
  'top_inner_span_2140|Inner span width|F:ring_L',
  'top_edge_left_160|Left edge strip|S',
  'top_seg_183_left|Left outer panel width|L:L',
  'top_rib_thickness_1|Rib thickness 1|S',
  'top_seg_223_left|Left panel width 223|S',
  'top_ring_plate_thickness_left|Ring plate thickness left|S',
  'top_seg_220_left|Left panel width 220|S',
  'top_rib_8_b|Rib thickness 2|S',
  'top_centre_panel_width_1|Centre panel width 1|S',
  'top_rib_8_c|Rib thickness 3|S',
  'top_panel_230_b|Centre panel width 2|S',
  'top_rib_8_d|Rib thickness 4|S',
  'top_panel_230_c|Centre panel width 3|S',
  'top_rib_8_e|Rib thickness 5|S',
  'top_seg_220_right|Right panel width 220|S',
  'top_ring_25_right|Ring plate thickness right|S',
  'top_seg_223_right|Right panel width 223|S',
  'top_rib_8_f|Rib thickness 6|S',
  'top_seg_183_right|Right outer panel width|L:R',
  'top_edge_right_160|Right edge strip|S',
  'top_left_160_top|Left side top margin|S',
  'top_left_180_top|Left side upper strip|F:end_bay_W',
  'top_left_8_a|Left rib thickness 1|S',
  'top_left_240_a|Left panel pitch 1|S',
  'top_left_8_b|Left rib thickness 2|S',
  'top_left_240_b|Left panel pitch 2|S',
  'top_left_8_c|Left rib thickness 3|S',
  'top_left_240_c|Left panel pitch 3|S',
  'top_left_8_d|Left rib thickness 4|S',
  'top_left_240_d|Left panel pitch 4|S',
  'top_left_8_e|Left rib thickness 5|S',
  'top_left_180_bot|Left side lower strip|F:end_bay_W',
  'top_left_160_bot|Left side bottom margin|S',
  'top_inner_height_1460|Inner opening length (vertical)|F:inner_open_W',
  'top_right_40_top|Right top edge offset|S',
  'top_right_225_top|Right upper bolt span|F:right_col_end',
  'top_right_pitch_230|Right bolt pitch|S',
  'top_right_array_1150|Right bolt array total|S',
  'top_right_225_bot|Right lower bolt span|F:right_col_end',
  'top_right_40_bot|Right bottom edge offset|S',
  'top_overall_height_1680|Overall plan depth|F:frame_W',
  'top_corner_offset_40|Bolt corner offset|S',
  'top_pipe_spacing_150|Water pipe spacing|S',
  'top_bottom_80_left|Bottom left offset|S',
  'top_bottom_pitch_220|Bottom bolt pitch (10 spaces)|F:bolt_pitch',
  'top_bottom_array_2200|Bottom bolt array total|F:bolt_line_L',
  'top_bottom_80_right|Bottom right offset|S',
  'top_spout_opening_width|Spout opening width|S',
  'top_spout_depth_410|Spout projection|S',
  'top_spout_w_300|Spout lower width|S',
  'top_spout_slot_150|Spout end slot width|S',
  'shell_flange|Overall top flange span|F:frame_L',
  'side_upper_flange_ring_width|Upper flange ring width|F:ring_L',
  'side_shell_casing_width_top|Shell casing width (top)|F:L_clear',
  'side_top_flange_overhang_left|Top flange overhang left|S',
  'side_overhang_right|Top flange overhang right|S',
  'side_wall_thk_left|Casing wall thickness left|S',
  'side_wall_thk_right|Casing wall thickness right|S',
  'side_top_rim_plate_thickness|Top rim plate thickness|S',
  'side_top_cone_flange_section_height|Top cone / flange section height|S',
  'side_flange_plate_thk|Flange plate thickness|S',
  'side_tier_1_height|Tier 1 height|S',
  'side_tier_spacer_plate_thickness_upper|Tier spacer plate thickness (upper)|S',
  'side_tier_2_height|Tier 2 height|S',
  'side_spacer_thk_lower|Tier spacer plate thickness (lower)|S',
  'side_tier_3_height|Tier 3 height|S',
  'side_bottom_ring_plate_thickness|Bottom ring plate thickness|S',
  'side_active_shell_height|Active shell height|S',
  'side_total_assembly_height|Total assembly height|S',
  'side_h_lower|Lower section height|S',
  'side_cooling_duct_section_height|Cooling duct section height|S',
  'side_base_plate_thickness|Base plate thickness|S',
  'side_internal_cavity_width|Internal cavity width|S',
  'side_cavity_clear_width|Cavity clear width|S',
  'side_chamfer_25|Chamfer plate size|S',
  'side_chamfer_23|Chamfer plate size 2|S',
  'side_duct_array_length_180x8|Duct array length (180x8)|S',
  'side_duct_pitch_8_pitches|Duct pitch (8 pitches)|S',
  'side_duct_side_strip_left|Duct side strip left|S',
  'side_duct_side_right|Duct side strip right|S',
  'side_base_edge_strip_left|Base edge strip left|S',
  'side_base_edge_right|Base edge strip right|S',
  'side_base_margin_left|Base margin left|S',
  'side_base_margin_right|Base margin right|S',
  'side_base_clear_width|Base clear width|S',
  'side_base_mounting_width|Base mounting width|S',
  'side_air_vent_hole_diameter|Air vent hole diameter|S',
  'shell_h_tiers|Total tier stack (incl. spacers)|S',
  'shell_panel_count|Centre panel count|S',
  'shell_clear_off|Cavity chamfer offset (total)|S',
  'shell_duct_count|Cooling duct count|S',
];

export type TemplateStatus = 'SAME' | 'FORMULA' | 'LAYOUT';
interface Row {
  key: string;
  label: string;
  status: TemplateStatus;
  step?: string; // FORMULA
  side?: 'L' | 'R'; // LAYOUT
}

const ROWS: Row[] = TABLE_SRC.map((s) => {
  const [key, label, code] = s.split('|');
  if (code === 'S') return { key, label, status: 'SAME' as const };
  if (code.startsWith('F:')) return { key, label, status: 'FORMULA' as const, step: code.slice(2) };
  return { key, label, status: 'LAYOUT' as const, side: code.slice(2) as 'L' | 'R' };
});
const BY_KEY: Record<string, Row> = {};
ROWS.forEach((r) => (BY_KEY[r.key] = r));

export const TEMPLATE_ROW_COUNT = ROWS.length;

const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Fallback by label, only when every template row with that label behaves identically (so the match is unambiguous).
const BY_LABEL: Record<string, Row | null> = {};
ROWS.forEach((r) => {
  const k = norm(r.label);
  const prev = BY_LABEL[k];
  if (prev === undefined) BY_LABEL[k] = r;
  else if (prev && (prev.status !== r.status || prev.step !== r.step || prev.side !== r.side)) BY_LABEL[k] = null;
});

/**
 * Keys the extraction pipeline can produce besides the template's own keys, mapped to the template row that has the
 * same MEANING (checked against the drawings: the template's shell_ring is the overall top width, shell_top_inner is
 * the top casing width, front_top_inner_span is the outer casing span).
 */
const TEMPLATE_KEY_ALIASES: Record<string, string> = {
  overallTopWidth: 'shell_flange',
  topCasingWidth: 'shell_top_inner',
  shellOuterCasing: 'front_top_inner_span',
  spoutOpeningWidth: 'shell_spout_w',
  shellHeight: 'shell_h_shell',
  totalMachinedHeight: 'shell_h_total',
  innerCasingDiameter: 'shell_cavity',
  bottomBaseWidth: 'shell_base_w',
  coolingDuctPitch: 'shell_duct_array',
  airVentHoles: 'shell_vent_dia',
  dim_front_width: 'shell_flange',
  dim_front_height: 'shell_h_shell',
  dim_top_spout: 'top_spout_opening_width',
};
// The app's own shell ids ring / top_inner name other callouts than the template keys of the same name, so they must
// never be used to look a template row up.
const AMBIGUOUS_SHELL_IDS = new Set(['ring', 'top_inner']);

/** Find the template row for an extracted dimension: its own key, a known alias, an unambiguous label, then the shell id. */
export function findTemplateRow(key: string, label?: string, shellId?: string): Row | null {
  if (BY_KEY[key]) return BY_KEY[key];
  if (TEMPLATE_KEY_ALIASES[key] && BY_KEY[TEMPLATE_KEY_ALIASES[key]]) return BY_KEY[TEMPLATE_KEY_ALIASES[key]];
  if (label && BY_LABEL[norm(label)]) return BY_LABEL[norm(label)];
  if (shellId && !AMBIGUOUS_SHELL_IDS.has(shellId) && BY_KEY[`shell_${shellId}`]) return BY_KEY[`shell_${shellId}`];
  return null;
}

export interface TemplateResult {
  status: TemplateStatus;
  value: number | null; // null when the template gives no single number (split end bay)
  text?: string; // shown instead of a number, e.g. "145 + 8 + 140"
  note: string;
  extrapolated: boolean;
}

const r2 = (v: number) => Number(v.toFixed(2));

/** Required value of one extracted dimension from the template. baseValue = the value on the Base drawing. */
export function templateRequired(row: Row, baseValue: number, tv: TemplateValues): TemplateResult {
  if (row.status === 'SAME') {
    return { status: 'SAME', value: baseValue, note: 'Template: constant, copied unchanged from the Base drawing.', extrapolated: false };
  }
  if (row.status === 'FORMULA') {
    const v = tv.values[row.step!];
    return {
      status: 'FORMULA',
      value: r2(v),
      note: `Template step ${row.step} at ${tv.T} t = ${r2(v)}${tv.extrapolated ? ' (outside 6.247-8.64 t: EXTRAPOLATED, designer check required)' : ''}`,
      extrapolated: tv.extrapolated,
    };
  }
  // LAYOUT: end bay of the panel row
  const total = tv.values.outer_end_bay_L_total;
  const lay = endBayLayout(total);
  if (!lay.split) {
    // Only the 183 mm bay is tracked by the template; the 223 mm bay has no rule below the split width.
    if (Math.abs(baseValue - 183) < 0.5) {
      return { status: 'LAYOUT', value: r2(lay.single), note: `Template end bay (single) at ${tv.T} t = ${r2(lay.single)}`, extrapolated: tv.extrapolated };
    }
    return {
      status: 'LAYOUT',
      value: null,
      text: 'no rule',
      note: 'Template gives no rule for this bay below the split width; designer check required.',
      extrapolated: tv.extrapolated,
    };
  }
  const text = row.side === 'R' ? `${lay.inner} + ${lay.rib} + ${lay.outer}` : `${lay.outer} + ${lay.rib} + ${lay.inner}`;
  return {
    status: 'LAYOUT',
    value: null,
    text,
    note: `Template split end bay at ${tv.T} t: outer ${lay.outer} + ${lay.rib} mm rib + inner ${lay.inner} (total ${r2(total)}). Two numbers, so no single value.`,
    extrapolated: tv.extrapolated,
  };
}

/** The Base drawing is meant to be one of the two anchor drawings. */
export function anchorWarning(baseTons: number): string | null {
  const near = (a: number) => Math.abs(baseTons - a) < 0.005;
  if (near(T_MIN) || near(T_MAX)) return null;
  return `Base capacity ${baseTons} t is not one of the template's anchor drawings (${T_MIN} t or ${T_MAX} t). Constants are copied from your Base drawing, but formula results come from the template's own two drawings.`;
}

// ---------------------------------------------------------------------------
// Self-check against the verification block of the template
// ---------------------------------------------------------------------------
export const TEMPLATE_VERIFICATION: Record<string, Record<string, number>> = {
  '6.247': {
    L_clear: 2008, W_clear: 1328, L_out: 2040, W_out: 1360, frame_L: 2360, frame_W: 1680, ring_L: 2140, inner_open_W: 1460,
    bottom_L: 2120, bottom_W: 1440, bolt_line_L: 2200, bolt_pitch: 220, end_bay_W: 180, right_col_end: 225, pipe_proj: 180,
    outer_end_bay_L_total: 183, n_bays: 13, flange_holes_18dia: 32, cu_tube_length: 5600, item18_len: 360, item19_len: 295, item20_qty: 10,
  },
  '8.64': {
    L_clear: 2228, W_clear: 1428, L_out: 2260, W_out: 1460, frame_L: 2580, frame_W: 1780, ring_L: 2360, inner_open_W: 1560,
    bottom_L: 2340, bottom_W: 1540, bolt_line_L: 2420, bolt_pitch: 242, end_bay_W: 230, right_col_end: 275, pipe_proj: 290,
    outer_end_bay_L_total: 293, n_bays: 15, flange_holes_18dia: 40, cu_tube_length: 6000, item18_len: 430, item19_len: 410, item20_qty: 13,
  },
};

export function verifyTemplate(): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  Object.entries(TEMPLATE_VERIFICATION).forEach(([t, expected]) => {
    const tv = evaluateTemplate(Number(t))!;
    Object.entries(expected).forEach(([k, v]) => {
      if (Math.abs(tv.values[k] - v) > 1e-9) mismatches.push(`${t} t ${k}: got ${tv.values[k]}, template says ${v}`);
    });
  });
  const split = endBayLayout(293);
  if (!(split.split && split.outer === 145 && split.inner === 140)) mismatches.push('end bay 293 should split 145 + 8 + 140');
  const single = endBayLayout(183);
  if (single.split || single.single !== 183) mismatches.push('end bay 183 should stay single');
  return { ok: mismatches.length === 0, mismatches };
}
