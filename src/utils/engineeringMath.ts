import { FurnaceInputs, CalculationResults, DxfModSchema, EngineeringAlert, DimensionalConstraint } from '../types/furnace';
import { calculateShell } from './shellModel';

const STEEL_DENSITY_CONSTANT = 7.1; // t/m³

export function calculateFurnaceScaling(inputs: FurnaceInputs): CalculationResults {
  const baseCap = Math.max(0.1, inputs.baselineCapacity);
  const basePower = Math.max(0.1, inputs.baselinePower);
  const targetCap = Math.max(0.1, inputs.targetCapacity);
  const targetPower = Math.max(0.1, inputs.targetPower);
  const baseID = Math.max(100, inputs.baselineInnerDiameter);
  const baseHeight = Math.max(100, inputs.baselineCrucibleHeight);
  const baseRefThk = Math.max(50, inputs.baselineRefractoryThickness);

  // 1. Target Crucible Volume (m³)
  const targetCrucibleVolumeM3 = targetCap / STEEL_DENSITY_CONSTANT;
  const baselineCrucibleVolumeM3 = baseCap / STEEL_DENSITY_CONSTANT;

  // Unconstrained Target Specifications
  const capacityRatio = targetCap / baseCap;
  const unconstrainedRefractoryThicknessMm = 90 + targetCap * 7.5;
  const unconstrainedInnerDiameterMm = baseID * Math.pow(capacityRatio, 0.33);

  const radiusMetersUnconstrained = unconstrainedInnerDiameterMm / 2000;
  const denomUnconstrained = 3.141592653589793 * Math.pow(radiusMetersUnconstrained, 2);
  const unconstrainedCrucibleHeightM = denomUnconstrained > 0 ? targetCrucibleVolumeM3 / denomUnconstrained : 1.0;
  const unconstrainedCrucibleHeightMm = unconstrainedCrucibleHeightM * 1000;

  // 2. Apply Dimensional Restrictions Logic
  let targetRefractoryThicknessMm = unconstrainedRefractoryThicknessMm;
  let targetInnerDiameterMm = unconstrainedInnerDiameterMm;
  let targetCrucibleHeightMm = unconstrainedCrucibleHeightMm;
  let constraintCompensationNote: string | undefined = undefined;

  const constraint: DimensionalConstraint = inputs.dimensionalConstraint || 'NONE';
  let isHeightLocked = false;
  let isWidthLocked = false;
  let isRefractoryLocked = false;

  if (constraint === 'LOCK_HEIGHT') {
    // RESTRICTION: Lock overall height to reference drawing height
    isHeightLocked = true;
    targetCrucibleHeightMm = baseHeight;
    const fixedHeightM = baseHeight / 1000;
    const requiredRadiusSq = targetCrucibleVolumeM3 / (3.141592653589793 * fixedHeightM);
    const requiredRadiusM = Math.sqrt(Math.max(0.01, requiredRadiusSq));
    targetInnerDiameterMm = requiredRadiusM * 2000;

    constraintCompensationNote = `🔒 Height Restricted to Reference Drawing (${baseHeight} mm). Inner Diameter compensated to ${targetInnerDiameterMm.toFixed(1)} mm to achieve ${targetCap} Ton volume.`;

  } else if (constraint === 'LOCK_WIDTH') {
    // RESTRICTION: Lock inner diameter / width to reference drawing diameter
    isWidthLocked = true;
    targetInnerDiameterMm = baseID;
    const fixedRadiusM = baseID / 2000;
    const requiredHeightM = targetCrucibleVolumeM3 / (3.141592653589793 * Math.pow(fixedRadiusM, 2));
    targetCrucibleHeightMm = requiredHeightM * 1000;

    constraintCompensationNote = `🔒 Width/Diameter Restricted to Reference Drawing (${baseID} mm). Crucible Height compensated to ${targetCrucibleHeightMm.toFixed(1)} mm to achieve ${targetCap} Ton volume.`;

  } else if (constraint === 'LOCK_REFRACTORY') {
    // RESTRICTION: Lock refractory lining thickness to reference drawing value
    isRefractoryLocked = true;
    targetRefractoryThicknessMm = baseRefThk;

    constraintCompensationNote = `🔒 Refractory Lining Wall Restricted to Reference Drawing (${baseRefThk} mm).`;

  } else if (constraint === 'CUSTOM_MAX_HEIGHT' && inputs.customMaxHeightMm) {
    const maxHeight = Math.max(300, inputs.customMaxHeightMm);
    if (unconstrainedCrucibleHeightMm > maxHeight) {
      isHeightLocked = true;
      targetCrucibleHeightMm = maxHeight;
      const fixedHeightM = maxHeight / 1000;
      const requiredRadiusSq = targetCrucibleVolumeM3 / (3.141592653589793 * fixedHeightM);
      targetInnerDiameterMm = Math.sqrt(Math.max(0.01, requiredRadiusSq)) * 2000;

      constraintCompensationNote = `⚠️ Height Capped at Custom Limit (${maxHeight} mm). Inner Diameter expanded to ${targetInnerDiameterMm.toFixed(1)} mm.`;
    }

  } else if (constraint === 'CUSTOM_MAX_WIDTH' && inputs.customMaxWidthMm) {
    const maxWidth = Math.max(300, inputs.customMaxWidthMm);
    if (unconstrainedInnerDiameterMm > maxWidth) {
      isWidthLocked = true;
      targetInnerDiameterMm = maxWidth;
      const fixedRadiusM = maxWidth / 2000;
      const requiredHeightM = targetCrucibleVolumeM3 / (3.141592653589793 * Math.pow(fixedRadiusM, 2));
      targetCrucibleHeightMm = requiredHeightM * 1000;

      constraintCompensationNote = `⚠️ Width Capped at Custom Limit (${maxWidth} mm). Crucible Height expanded to ${targetCrucibleHeightMm.toFixed(1)} mm.`;
    }
  }

  // 3. Finalize Derived Parameters
  const targetCrucibleHeightM = targetCrucibleHeightMm / 1000;
  const targetCoilTurns = Math.round(targetPower * 4.5);

  const powerRatio = targetPower / basePower;
  const volumeScalingFactor = baselineCrucibleVolumeM3 > 0 ? targetCrucibleVolumeM3 / baselineCrucibleVolumeM3 : 1.0;
  const outerShellDiameterMm = targetInnerDiameterMm + 2 * targetRefractoryThicknessMm;
  const aspectRatioHeightToDiameter = targetInnerDiameterMm > 0 ? targetCrucibleHeightMm / targetInnerDiameterMm : 1.2;
  const powerDensityKwPerM3 = targetCrucibleVolumeM3 > 0 ? (targetPower * 1000) / targetCrucibleVolumeM3 : 0;

  const totalHeatKwh = targetCap * 580;
  const effectivePowerKw = targetPower * 1000 * 0.72;
  const estimatedMeltTimeMinutes = effectivePowerKw > 0 ? (totalHeatKwh / effectivePowerKw) * 60 : 45;

  const activeCoilHeightMm = targetCrucibleHeightMm * 0.85;
  const calculatedCoilPitchMm = targetCoilTurns > 0 ? activeCoilHeightMm / targetCoilTurns : 50;

  return {
    targetCrucibleVolumeM3: Number(targetCrucibleVolumeM3.toFixed(3)),
    targetRefractoryThicknessMm: Number(targetRefractoryThicknessMm.toFixed(1)),
    targetInnerDiameterMm: Number(targetInnerDiameterMm.toFixed(1)),
    targetCrucibleHeightM: Number(targetCrucibleHeightM.toFixed(3)),
    targetCrucibleHeightMm: Number(targetCrucibleHeightMm.toFixed(1)),
    targetCoilTurns: Math.max(1, targetCoilTurns),

    volumeScalingFactor: Number(volumeScalingFactor.toFixed(2)),
    capacityRatio: Number(capacityRatio.toFixed(2)),
    powerRatio: Number(powerRatio.toFixed(2)),
    baselineCrucibleVolumeM3: Number(baselineCrucibleVolumeM3.toFixed(3)),
    outerShellDiameterMm: Number(outerShellDiameterMm.toFixed(1)),
    aspectRatioHeightToDiameter: Number(aspectRatioHeightToDiameter.toFixed(2)),
    powerDensityKwPerM3: Number(powerDensityKwPerM3.toFixed(0)),
    estimatedMeltTimeMinutes: Math.round(estimatedMeltTimeMinutes),
    calculatedCoilPitchMm: Number(calculatedCoilPitchMm.toFixed(1)),

    activeConstraint: constraint,
    constraintCompensationNote,
    isHeightLocked,
    isWidthLocked,
    isRefractoryLocked,
  };
}

export function generateDxfModSchema(
  inputs: FurnaceInputs,
  results: CalculationResults
): DxfModSchema {
  return {
    engineering_summary: {
      calculated_volume_m3: results.targetCrucibleVolumeM3,
      scaling_factor: results.volumeScalingFactor,
      capacity_tons: inputs.targetCapacity,
      power_mw: inputs.targetPower,
      aspect_ratio: results.aspectRatioHeightToDiameter,
      outer_shell_diameter_mm: results.outerShellDiameterMm,
      active_restriction: results.activeConstraint !== 'NONE' ? results.activeConstraint : 'FREE_3D_SCALING',
    },
    cad_modifications: [
      {
        layer: "FURNACE_CRUCIBLE",
        property: "Inner_Diameter",
        value: results.targetInnerDiameterMm,
        unit: "mm",
        description: results.isWidthLocked ? "LOCKED to reference drawing diameter" : "Internal refractory lining diameter",
      },
      {
        layer: "FURNACE_CRUCIBLE",
        property: "Crucible_Height",
        value: results.targetCrucibleHeightMm,
        unit: "mm",
        description: results.isHeightLocked ? "LOCKED to reference drawing height" : "Vertical melt chamber cavity height",
      },
      {
        layer: "FURNACE_REFRACTORY",
        property: "Thickness",
        value: results.targetRefractoryThicknessMm,
        unit: "mm",
        description: results.isRefractoryLocked ? "LOCKED to reference refractory wall" : "Spinel-forming monolithic lining thickness",
      },
      {
        layer: "FURNACE_COIL",
        property: "Turn_Count",
        value: results.targetCoilTurns,
        unit: "turns",
        description: "Primary copper induction coil helical winding turns",
      },
      // Full shell dimension set (parametric shell model, reference drawing -> required tonnage)
      ...calculateShell(inputs).dims.map((d) => ({
        layer: "FURNACE_SHELL",
        property: d.id,
        value: d.value,
        unit: d.unit,
        description: `${d.label} (reference ${d.ref} -> required ${d.value})`,
      })),
    ],
    metadata: {
      generated_at: new Date().toISOString(),
      app_version: "v2.5-PARACAD-CONSTRAINED",
      standard: "ISO 13584 / AutoCAD DXF R2020",
    },
  };
}

export function evaluateEngineeringAlerts(
  inputs: FurnaceInputs,
  results: CalculationResults
): EngineeringAlert[] {
  const alerts: EngineeringAlert[] = [];

  // Active Restriction Alert
  if (results.constraintCompensationNote) {
    alerts.push({
      type: 'info',
      title: 'Dimensional Restriction Active',
      message: results.constraintCompensationNote,
    });
  }

  // Aspect ratio checks
  if (results.aspectRatioHeightToDiameter < 0.9) {
    alerts.push({
      type: 'warning',
      title: 'Low Aspect Ratio (H/D < 0.9)',
      message: 'Crucible is relatively squat. Expect higher top surface heat loss. Recommend monitoring bath stirring forces.',
    });
  } else if (results.aspectRatioHeightToDiameter > 1.6) {
    alerts.push({
      type: 'warning',
      title: 'High Aspect Ratio (H/D > 1.6)',
      message: 'Deep bath geometry may increase lining mechanical shear stress. Check crane overhead hook clearance.',
    });
  } else {
    alerts.push({
      type: 'success',
      title: 'Optimal Aspect Ratio',
      message: `H/D ratio of ${results.aspectRatioHeightToDiameter} provides ideal electromagnetic bath stirring and thermal efficiency.`,
    });
  }

  return alerts;
}
