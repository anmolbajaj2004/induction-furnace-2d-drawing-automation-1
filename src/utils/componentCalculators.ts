import {
  FurnaceInputs,
  CalculationResults,
  ComponentAssemblyGroup,
  SubComponentDimension,
} from '../types/furnace';
import { calculateShell } from './shellModel';

export function calculateAllComponentBreakdowns(
  inputs: FurnaceInputs,
  results: CalculationResults
): ComponentAssemblyGroup[] {
  const capRatio = results.capacityRatio;
  const linScale = Math.pow(capRatio, 0.33);

  // 1. MECHANICAL SHELL ASSEMBLY (driven by the parametric shell model — see shellModel.ts)
  const shell = calculateShell(inputs);
  const SHELL_ROWS: { id: string; category: SubComponentDimension['category'] }[] = [
    { id: 'flange', category: 'Assembly' },
    { id: 'ring', category: 'Assembly' },
    { id: 'top_inner', category: 'Assembly' },
    { id: 'body_od', category: 'Assembly' },
    { id: 'h_shell', category: 'Assembly' },
    { id: 'h_total', category: 'Assembly' },
    { id: 'cone_h', category: 'Sub-Component' },
    { id: 'tier1', category: 'Sub-Component' },
    { id: 'tier2', category: 'Sub-Component' },
    { id: 'tier3', category: 'Sub-Component' },
    { id: 'panel_pitch', category: 'Sub-Component' },
    { id: 't_rib', category: 'Detail Part' },
    { id: 't_ring', category: 'Detail Part' },
    { id: 't_base', category: 'Detail Part' },
    { id: 'spout_w', category: 'Sub-Component' },
    { id: 'spout_h', category: 'Sub-Component' },
    { id: 'cavity', category: 'Assembly' },
    { id: 'base_w', category: 'Assembly' },
    { id: 'duct_array', category: 'Sub-Component' },
  ];
  const heightIds = ['h_shell', 'h_total'];
  const shellSubComponents: SubComponentDimension[] = SHELL_ROWS.map(({ id, category }) => {
    const d = shell.dims.find((x) => x.id === id)!;
    const locked =
      (shell.scaling.mode === 'LOCK_HEIGHT' && heightIds.includes(id)) ||
      (shell.scaling.mode === 'LOCK_WIDTH' && ['flange', 'ring', 'top_inner', 'body_od', 'cavity', 'base_w'].includes(id));
    return {
      id: `shell_${id}`,
      name: d.label,
      category,
      layer: 'FURNACE_SHELL',
      referenceValueMm: d.ref,
      newValueMm: d.value,
      unit: d.unit,
      scalingFormula: d.rule,
      deltaPercent: d.deltaPct,
      notes: locked ? 'RESTRICTED: locked to reference drawing' : `Reference drawing ${shell.refCapacity} t -> ${shell.targetCapacity} t`,
      isLocked: locked,
    };
  });

  // 2. ELECTRICAL YOKE / CHOCK ASSEMBLY
  const chockHeightNew = Number((results.targetCrucibleHeightMm * 0.88).toFixed(1));
  const chockWidthNew = Number((280 * Math.pow(capRatio, 0.33)).toFixed(1));

  const chockSubComponents: SubComponentDimension[] = [
    {
      id: 'chock_stack_height',
      name: 'Magnetic Yoke Stack Height',
      category: 'Assembly',
      layer: 'FURNACE_CHOCK',
      referenceValueMm: 1200,
      newValueMm: chockHeightNew,
      unit: 'mm',
      scalingFormula: results.isHeightLocked ? 'LOCKED to Height Limit' : 'Crucible_Height * 0.88',
      deltaPercent: Number((((chockHeightNew - 1200) / 1200) * 100).toFixed(1)),
      notes: 'Grain-oriented silicon steel laminate stack height',
      isLocked: results.isHeightLocked,
    },
    {
      id: 'chock_pack_width',
      name: 'Yoke Pack Lamination Width',
      category: 'Sub-Component',
      layer: 'FURNACE_CHOCK',
      referenceValueMm: 280,
      newValueMm: chockWidthNew,
      unit: 'mm',
      scalingFormula: 'Ref_Width * (Cap_Ratio)^0.33',
      deltaPercent: Number((((chockWidthNew - 280) / 280) * 100).toFixed(1)),
      notes: 'Stack pack width to prevent magnetic flux saturation',
    },
  ];

  // 3. CRUCIBLE & REFRACTORY THERMAL ASSEMBLY
  const crucibleSubComponents: SubComponentDimension[] = [
    {
      id: 'crucible_id',
      name: 'Crucible Melt Cavity Inner Diameter',
      category: 'Assembly',
      layer: 'FURNACE_CRUCIBLE',
      referenceValueMm: inputs.baselineInnerDiameter,
      newValueMm: results.targetInnerDiameterMm,
      unit: 'mm',
      scalingFormula: results.isWidthLocked
        ? 'ðŸ”’ LOCKED to Reference Drawing Width'
        : results.isHeightLocked
        ? 'âš¡ Compensated for Fixed Height'
        : 'ID_base * (Cap_Ratio)^0.33',
      deltaPercent: Number(
        (
          ((results.targetInnerDiameterMm - inputs.baselineInnerDiameter) /
            inputs.baselineInnerDiameter) *
          100
        ).toFixed(1)
      ),
      notes: results.isWidthLocked ? 'ðŸ”’ RESTRICTED: Diameter locked to reference drawing' : 'Molten metal cavity diameter',
      isLocked: results.isWidthLocked,
    },
    {
      id: 'crucible_height',
      name: 'Crucible Chamber Bath Height',
      category: 'Assembly',
      layer: 'FURNACE_CRUCIBLE',
      referenceValueMm: inputs.baselineCrucibleHeight,
      newValueMm: results.targetCrucibleHeightMm,
      unit: 'mm',
      scalingFormula: results.isHeightLocked
        ? 'ðŸ”’ LOCKED to Reference Drawing Height'
        : results.isWidthLocked
        ? 'âš¡ Compensated for Fixed Width'
        : 'Volume / (Ï€ * (ID/2000)Â²)',
      deltaPercent: Number(
        (
          ((results.targetCrucibleHeightMm - inputs.baselineCrucibleHeight) /
            inputs.baselineCrucibleHeight) *
          100
        ).toFixed(1)
      ),
      notes: results.isHeightLocked ? 'ðŸ”’ RESTRICTED: Height locked to reference drawing' : 'Bath height including safety freeboard',
      isLocked: results.isHeightLocked,
    },
    {
      id: 'refractory_wall_thk',
      name: 'Monolithic Refractory Lining Thickness',
      category: 'Sub-Component',
      layer: 'FURNACE_REFRACTORY',
      referenceValueMm: inputs.baselineRefractoryThickness,
      newValueMm: results.targetRefractoryThicknessMm,
      unit: 'mm',
      scalingFormula: results.isRefractoryLocked ? 'ðŸ”’ LOCKED to Ref Drawing Wall' : '90 + (Target_Capacity * 7.5)',
      deltaPercent: Number(
        (
          ((results.targetRefractoryThicknessMm - inputs.baselineRefractoryThickness) /
            inputs.baselineRefractoryThickness) *
          100
        ).toFixed(1)
      ),
      notes: results.isRefractoryLocked ? 'ðŸ”’ RESTRICTED: Refractory wall locked' : 'Spinel dry vibration refractory lining',
      isLocked: results.isRefractoryLocked,
    },
  ];

  // 4. INDUCTION COIL ASSEMBLY
  const coilSubComponents: SubComponentDimension[] = [
    {
      id: 'coil_turn_count',
      name: 'Primary Induction Coil Turn Count',
      category: 'Assembly',
      layer: 'FURNACE_COIL',
      referenceValueMm: Math.round(inputs.baselinePower * 4.5),
      newValueMm: results.targetCoilTurns,
      unit: 'turns',
      scalingFormula: 'round(Target_Power * 4.5)',
      deltaPercent: Number(
        (
          ((results.targetCoilTurns - Math.round(inputs.baselinePower * 4.5)) /
            Math.round(inputs.baselinePower * 4.5)) *
          100
        ).toFixed(1)
      ),
      notes: 'Water cooled extruded copper hollow turn count',
    },
    {
      id: 'coil_pitch',
      name: 'Vertical Coil Pitch Spacing',
      category: 'Sub-Component',
      layer: 'FURNACE_COIL',
      referenceValueMm: 42.5,
      newValueMm: results.calculatedCoilPitchMm,
      unit: 'mm',
      scalingFormula: '(Crucible_Height * 0.85) / Turn_Count',
      deltaPercent: Number((((results.calculatedCoilPitchMm - 42.5) / 42.5) * 100).toFixed(1)),
      notes: 'Center-to-center vertical pitch spacing',
    },
  ];

  return [
    {
      id: 'group_shell',
      title: '1. Mechanical Shell Assembly',
      type: 'SHELL_MECHANICAL',
      description: 'Outer steel structure, tilting frame, trunnion shafts, and mounting flanges.',
      subComponents: shellSubComponents,
    },
    {
      id: 'group_chock',
      title: '2. Electrical Yoke / Chock Assembly',
      type: 'CHOCK_ELECTRICAL',
      description: 'Magnetic flux return stacks, silicon steel laminations, and water cooling passages.',
      subComponents: chockSubComponents,
    },
    {
      id: 'group_crucible',
      title: '3. Crucible & Refractory Thermal Assembly',
      type: 'CRUCIBLE_THERMAL',
      description: 'Melt bath cavity, dry vibration refractory wall, hearth pad, and pouring spout.',
      subComponents: crucibleSubComponents,
    },
    {
      id: 'group_coil',
      title: '4. Induction Coil & Water Cooling Assembly',
      type: 'COIL_ASSEMBLY',
      description: 'Water-cooled copper helical winding, turn pitch, insulation spacers, and manifold ports.',
      subComponents: coilSubComponents,
    },
  ];
}
