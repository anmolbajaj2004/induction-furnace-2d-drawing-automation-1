export type ComponentType = 'SHELL_MECHANICAL' | 'CHOCK_ELECTRICAL' | 'CRUCIBLE_THERMAL' | 'COIL_ASSEMBLY' | 'FULL_FURNACE';
export type OrthographicViewType = 'FRONT' | 'TOP' | 'SIDE';

export type DimensionalConstraint =
  | 'NONE'
  | 'LOCK_HEIGHT'
  | 'LOCK_WIDTH'
  | 'LOCK_REFRACTORY'
  | 'CUSTOM_MAX_HEIGHT'
  | 'CUSTOM_MAX_WIDTH';

export interface DwgCropBox {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  w: number; // percentage 0-100
  h: number; // percentage 0-100
}

export interface ExtractedDwgDimension {
  key: string;
  label: string;
  valueMm: number;
  layerName: string;
  unit: string;
  description: string;
  drawingLocation: string; // Drawing location details
  cadEntity: string; // Entity type
  highlightZone: string;
  viewSource: OrthographicViewType;
  cropBox?: DwgCropBox;
}

/**
 * A second drawing set (front / top / side) of a furnace of a DIFFERENT size, used together with the given drawing
 * to convert dimensions to the required size. Its capacity and power are typed in by the user (never assumed).
 */
export interface ReferenceSet {
  frontViewImageUrl?: string;
  topViewImageUrl?: string;
  sideViewImageUrl?: string;
  capacityT: number | null; // tons of the furnace drawn in the reference images
  powerMW: number | null; // MW of that furnace
  extractedDimensions: ExtractedDwgDimension[];
  extractionModel?: string;
}

export interface UploadedDwgFile {
  filename: string;
  fileSizeKb: number;
  componentType: ComponentType;
  uploadedAt: string;
  extractedDimensions: ExtractedDwgDimension[];
  rawDxfContent?: string;
  imageUrl?: string;
  frontViewImageUrl?: string;
  topViewImageUrl?: string;
  sideViewImageUrl?: string;
  /** Model that produced extractedDimensions (shown in downloads). */
  extractionModel?: string;
  boundingWidthMm: number;
  boundingHeightMm: number;
}

export interface SubComponentDimension {
  id: string;
  name: string;
  category: 'Assembly' | 'Sub-Component' | 'Detail Part';
  layer: string;
  referenceValueMm: number;
  newValueMm: number;
  unit: string;
  scalingFormula: string;
  deltaPercent: number;
  notes: string;
  isLocked?: boolean;
}

export interface ComponentAssemblyGroup {
  id: string;
  title: string;
  type: ComponentType;
  description: string;
  subComponents: SubComponentDimension[];
}

export interface FurnaceInputs {
  // Baseline / Reference Specs
  baselineCapacity: number; // Tons
  baselinePower: number; // MW
  baselineFrequency: number; // Hz
  baselineInnerDiameter: number; // mm
  baselineCrucibleHeight: number; // mm
  baselineRefractoryThickness: number; // mm

  // Target Specs
  targetCapacity: number; // Tons
  targetPower: number; // MW

  // Dimensional Envelope Restrictions
  dimensionalConstraint: DimensionalConstraint;
  customMaxHeightMm?: number;
  customMaxWidthMm?: number;
}

export interface CalculationResults {
  targetCrucibleVolumeM3: number;
  targetRefractoryThicknessMm: number;
  targetInnerDiameterMm: number;
  targetCrucibleHeightM: number;
  targetCrucibleHeightMm: number;
  targetCoilTurns: number;

  volumeScalingFactor: number;
  capacityRatio: number;
  powerRatio: number;
  baselineCrucibleVolumeM3: number;
  outerShellDiameterMm: number;
  aspectRatioHeightToDiameter: number;
  powerDensityKwPerM3: number;
  estimatedMeltTimeMinutes: number;
  calculatedCoilPitchMm: number;

  // Constraint Status
  activeConstraint: DimensionalConstraint;
  constraintCompensationNote?: string;
  isHeightLocked: boolean;
  isWidthLocked: boolean;
  isRefractoryLocked: boolean;
}

export interface CadModificationItem {
  layer: string;
  property: string;
  value: number;
  unit?: string;
  description?: string;
}

export interface DxfModSchema {
  engineering_summary: {
    calculated_volume_m3: number;
    scaling_factor: number;
    capacity_tons: number;
    power_mw: number;
    aspect_ratio: number;
    outer_shell_diameter_mm: number;
    active_restriction: string;
  };
  cad_modifications: CadModificationItem[];
  component_breakdown?: ComponentAssemblyGroup[];
  metadata: {
    generated_at: string;
    app_version: string;
    standard: string;
  };
}

export interface PresetModel {
  id: string;
  name: string;
  category: string;
  description: string;
  inputs: FurnaceInputs;
  sampleDwgFileName?: string;
}

export interface EngineeringAlert {
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
}
