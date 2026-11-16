import type { DwgCropBox } from '../types/furnace';

/**
 * Pixel-accurate callout locations on the reference shell drawing
 * (public/assets/aistudio/image_bd466edd.png, 1912 x 1404 px).
 * Each box wraps the dimension line + its text, keyed by shell-model dimension id.
 * They are only valid for that exact drawing; a pasted image uses its own AI boxes.
 */
export const SAMPLE_IMG_W = 1912;
export const SAMPLE_IMG_H = 1404;

type PxBox = [x: number, y: number, w: number, h: number];

const PX: Record<string, PxBox> = {
  // 1 envelope
  flange: [163, 176, 1462, 34],
  ring: [226, 220, 1338, 34],
  top_inner: [254, 262, 1283, 34],
  body_od: [232, 622, 1325, 16],
  h_shell: [42, 423, 42, 690],
  h_total: [8, 423, 32, 775],
  // 2 flange
  overhang: [163, 220, 68, 32],
  ring_step: [222, 262, 42, 32],
  body_step: [194, 650, 52, 40],
  cone_h: [100, 430, 44, 190],
  t_top: [100, 384, 34, 44],
  // 3 body
  tier1: [100, 634, 34, 152],
  tier2: [100, 796, 34, 152],
  tier3: [100, 958, 34, 152],
  h_tiers: [100, 628, 34, 484],
  t_spacer: [100, 778, 34, 22],
  t_ring: [100, 1078, 34, 36],
  allow: [0, 630, 30, 270],
  // 4 panels
  panel_pitch: [425, 650, 132, 40],
  edge_out: [256, 650, 86, 40],
  edge_in: [342, 650, 80, 40],
  t_rib: [418, 650, 24, 40],
  panel_count: [425, 650, 940, 40],
  vent_dia: [485, 884, 300, 46],
  // 5 spout
  spout_w: [740, 304, 310, 34],
  spout_h: [696, 466, 52, 98],
  // 6 base
  cavity: [405, 1060, 982, 32],
  cavity_clear: [418, 974, 954, 32],
  clear_off: [368, 1040, 118, 126],
  base_w: [357, 1352, 1078, 34],
  base_clear: [440, 1308, 905, 34],
  base_margin: [357, 1308, 90, 34],
  base_edge: [308, 1264, 58, 32],
  duct_side: [372, 1264, 110, 32],
  duct_gap: [540, 1216, 100, 32],
  t_duct_rib: [514, 1216, 36, 32],
  duct_pitch: [524, 1216, 118, 32],
  duct_array: [478, 1264, 834, 32],
  duct_count: [524, 1216, 772, 32],
  duct_h: [100, 1130, 34, 58],
  t_base: [100, 1188, 34, 42],
  pipe_proj: [1432, 1308, 168, 34],
};

/**
 * Which orthographic views each shell dimension is shown in.
 * FRONT = callout on the supplied drawing; TOP / SIDE = generated plan & side elevation.
 */
export const VIEWS_BY_ID: Record<string, ('FRONT' | 'TOP' | 'SIDE')[]> = (() => {
  const top = [
    'flange', 'ring', 'top_inner', 'body_od', 'cavity', 'base_w', 'spout_w', 'pipe_proj', 'overhang', 'ring_step', 'body_step',
    'edge_out', 'edge_in', 'panel_pitch', 't_rib', 'panel_count',
  ];
  // The side elevation is the same drawing as the front (same four-sided panel layout); only the spout is seen
  // edge-on, so its width and the water-pipe projection (pointing at the viewer) are not measurable there.
  const side = Object.keys(PX).filter((id) => id !== 'spout_w' && id !== 'pipe_proj');
  const out: Record<string, ('FRONT' | 'TOP' | 'SIDE')[]> = {};
  Object.keys(PX).forEach((id) => {
    out[id] = ['FRONT'];
  });
  top.forEach((id) => (out[id] = [...(out[id] ?? ['FRONT']), 'TOP']));
  side.forEach((id) => (out[id] = [...(out[id] ?? ['FRONT']), 'SIDE']));
  return out;
})();

/** Keys produced by the built-in reference extraction -> shell dimension id. */
export const EXTRACTED_KEY_TO_SHELL_ID: Record<string, string> = {
  overallTopWidth: 'flange',
  topCasingWidth: 'ring',
  shellOuterCasing: 'top_inner',
  spoutOpeningWidth: 'spout_w',
  shellHeight: 'h_shell',
  totalMachinedHeight: 'h_total',
  innerCasingDiameter: 'cavity',
  bottomBaseWidth: 'base_w',
  coolingDuctPitch: 'duct_array',
  airVentHoles: 'vent_dia',
  // fallback tri-view extraction keys that describe the same callouts
  dim_front_width: 'flange',
  dim_front_height: 'h_shell',
  dim_top_spout: 'spout_w',
};

/** Crop box (percent of the image) for a shell dimension on the reference drawing. */
export function sampleCropBox(shellId: string): DwgCropBox | undefined {
  const b = PX[shellId];
  if (!b) return undefined;
  const pct = (v: number, total: number) => Number(((v / total) * 100).toFixed(2));
  return { x: pct(b[0], SAMPLE_IMG_W), y: pct(b[1], SAMPLE_IMG_H), w: pct(b[2], SAMPLE_IMG_W), h: pct(b[3], SAMPLE_IMG_H) };
}
