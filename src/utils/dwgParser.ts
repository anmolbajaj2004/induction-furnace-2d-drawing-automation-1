import { UploadedDwgFile, ComponentType, ExtractedDwgDimension } from '../types/furnace';
import { EXTRACTED_KEY_TO_SHELL_ID, sampleCropBox } from './shellDimLocations';

export const SHELL_DRAWING_IMAGE_URL = '/assets/aistudio/image_bd466edd.png';

export function parseDxfOrDwgContent(
  fileName: string,
  contentStr: string,
  fileSizeKb: number,
  imageUrl?: string
): UploadedDwgFile {
  const lowerName = fileName.toLowerCase();
  let componentType: ComponentType = 'SHELL_MECHANICAL';

  if (lowerName.includes('chock') || lowerName.includes('yoke') || lowerName.includes('elec')) {
    componentType = 'CHOCK_ELECTRICAL';
  } else if (lowerName.includes('crucible') || lowerName.includes('refractory')) {
    componentType = 'CRUCIBLE_THERMAL';
  } else if (lowerName.includes('coil') || lowerName.includes('winding')) {
    componentType = 'COIL_ASSEMBLY';
  }

  const extractedDimensions: ExtractedDwgDimension[] = [];

  // DEFAULT / UPLOADED SHELL MECHANICAL DRAWING MATCHING EXACT BLUEPRINT (/public/assets/aistudio/image_bd466edd.png)
  if (componentType === 'SHELL_MECHANICAL') {
    extractedDimensions.push(
      {
        key: 'overallTopWidth',
        label: 'Overall Top Flange Span',
        valueMm: 2580,
        layerName: 'FURNACE_SHELL_FLANGE',
        unit: 'mm',
        description: 'Maximum outer flange span across top shell rim',
        drawingLocation: 'Top dimension line (labeled 2580) at upper centerline',
        cadEntity: 'DIMLINEAR [Text: 2580]',
        highlightZone: 'overallTopWidth',
        viewSource: 'FRONT',
        cropBox: { x: 41, y: 10, w: 20, h: 6 },
      },
      {
        key: 'topCasingWidth',
        label: 'Upper Flange Extension',
        valueMm: 2360,
        layerName: 'FURNACE_SHELL_FLANGE',
        unit: 'mm',
        description: 'Upper flange ring seat outer width',
        drawingLocation: 'Second top dimension line (labeled 2360) under 2580',
        cadEntity: 'DIMLINEAR [Text: 2360]',
        highlightZone: 'topCasingWidth',
        viewSource: 'FRONT',
        cropBox: { x: 41, y: 15, w: 20, h: 5 },
      },
      {
        key: 'shellOuterCasing',
        label: 'Shell Outer Casing Width',
        valueMm: 2260,
        layerName: 'FURNACE_SHELL',
        unit: 'mm',
        description: 'Outer steel shell casing top width (square section)',
        drawingLocation: 'Third top dimension line (labeled 2260) above spout',
        cadEntity: 'DIMLINEAR [Text: 2260]',
        highlightZone: 'shellOuterCasing',
        viewSource: 'FRONT',
        cropBox: { x: 41, y: 19, w: 20, h: 5 },
      },
      {
        key: 'spoutOpeningWidth',
        label: 'Slag Spout Throat Opening',
        valueMm: 540,
        layerName: 'FURNACE_SHELL_SPOUT',
        unit: 'mm',
        description: 'Slag spout pour mouth width (Detail Item 2.1)',
        drawingLocation: 'Center upper slag spout box (labeled 540) detail 2.1',
        cadEntity: 'DIMLINEAR [Text: 540]',
        highlightZone: 'spoutOpeningWidth',
        viewSource: 'TOP',
        cropBox: { x: 38, y: 22, w: 22, h: 18 },
      },
      {
        key: 'shellHeight',
        label: 'Active Shell Cylinder Height',
        valueMm: 1218,
        layerName: 'FURNACE_SHELL',
        unit: 'mm',
        description: 'Cylindrical shell active vertical height (334+10+280+8+280+8+282+25)',
        drawingLocation: 'Left vertical height axis (labeled 1218 mm)',
        cadEntity: 'DIMVERTICAL [Text: 1218]',
        highlightZone: 'shellHeight',
        viewSource: 'FRONT',
        cropBox: { x: 0, y: 26, w: 10, h: 52 },
      },
      {
        key: 'totalMachinedHeight',
        label: 'Total Machined Assembly Height',
        valueMm: 1365,
        layerName: 'FURNACE_SHELL',
        unit: 'mm',
        description: 'Total shell assembly height including bottom base plates',
        drawingLocation: 'Leftmost vertical dimension axis (labeled 1365 AFTER M/C)',
        cadEntity: 'DIMVERTICAL [Text: 1365 AFTER M/C]',
        highlightZone: 'totalMachinedHeight',
        viewSource: 'FRONT',
        cropBox: { x: 0, y: 18, w: 10, h: 72 },
      },
      {
        key: 'innerCasingDiameter',
        label: 'Internal Shell Cavity Width',
        valueMm: 1730,
        layerName: 'FURNACE_SHELL',
        unit: 'mm',
        description: 'Internal shell cavity clear width (1730 / 1682.41 mm)',
        drawingLocation: 'Middle lower dimension line (labeled 1730 / 1682.41 mm)',
        cadEntity: 'DIMLINEAR [Text: 1730 / 1682.41]',
        highlightZone: 'innerCasingDiameter',
        viewSource: 'FRONT',
        cropBox: { x: 40, y: 68, w: 22, h: 12 },
      },
      {
        key: 'bottomBaseWidth',
        label: 'Bottom Base Mounting Flange',
        valueMm: 1900,
        layerName: 'FURNACE_SHELL_BASE',
        unit: 'mm',
        description: 'Bottom mounting base plate flange width',
        drawingLocation: 'Bottom width dimension line (labeled 1900 / 1600 mm)',
        cadEntity: 'DIMLINEAR [Text: 1900]',
        highlightZone: 'bottomBaseWidth',
        viewSource: 'FRONT',
        cropBox: { x: 35, y: 92, w: 30, h: 8 },
      },
      {
        key: 'coolingDuctPitch',
        label: 'Bottom Cooling Duct Pitch Array',
        valueMm: 1464,
        layerName: 'FURNACE_SHELL_COOLING',
        unit: 'mm',
        description: 'Bottom duct pitch array (183 x 8 = 1464 mm)',
        drawingLocation: 'Bottom duct pitch ticks (labeled 183x8=1464 mm)',
        cadEntity: 'DIMCONTINUOUS [Text: 183x8=1464]',
        highlightZone: 'coolingDuctPitch',
        viewSource: 'FRONT',
        cropBox: { x: 25, y: 84, w: 50, h: 8 },
      },
      {
        key: 'airVentHoles',
        label: 'Shell Air Vent Holes Diameter',
        valueMm: 50,
        layerName: 'FURNACE_SHELL',
        unit: 'mm',
        description: 'Shell wall air pressure relief vent hole diameter',
        drawingLocation: 'Mid-shell callout text (50Ø AIR VENT HOLES)',
        cadEntity: 'LEADER [Text: 50Ø AIR VENT HOLES]',
        highlightZone: 'airVentHoles',
        viewSource: 'SIDE',
        cropBox: { x: 24, y: 58, w: 22, h: 8 },
      }
    );
  } else if (componentType === 'CHOCK_ELECTRICAL') {
    extractedDimensions.push(
      {
        key: 'chockHeight',
        label: 'Magnetic Yoke Stack Height',
        valueMm: 1200,
        layerName: 'FURNACE_CHOCK',
        unit: 'mm',
        description: 'Grain-oriented silicon steel laminate stack height',
        drawingLocation: 'Magnetic yoke lamination stack height',
        cadEntity: 'DIMLINEAR',
        highlightZone: 'chockHeight',
        viewSource: 'FRONT',
        cropBox: { x: 30, y: 20, w: 40, h: 60 },
      },
      {
        key: 'chockWidth',
        label: 'Yoke Pack Width',
        valueMm: 280,
        layerName: 'FURNACE_CHOCK',
        unit: 'mm',
        description: 'Width of magnetic flux returning chock stack',
        drawingLocation: 'Silicon steel laminate pack radial width',
        cadEntity: 'DIMLINEAR',
        highlightZone: 'chockWidth',
        viewSource: 'SIDE',
        cropBox: { x: 35, y: 10, w: 30, h: 20 },
      }
    );
  } else if (componentType === 'CRUCIBLE_THERMAL') {
    extractedDimensions.push(
      {
        key: 'innerDiameter',
        label: 'Crucible Inner Diameter',
        valueMm: 1100,
        layerName: 'FURNACE_CRUCIBLE',
        unit: 'mm',
        description: 'Molten metal bath cavity diameter',
        drawingLocation: 'Melt cavity central axis',
        cadEntity: 'DIMLINEAR',
        highlightZone: 'innerDiameter',
        viewSource: 'FRONT',
        cropBox: { x: 20, y: 40, w: 60, h: 30 },
      },
      {
        key: 'crucibleHeight',
        label: 'Crucible Bath Height',
        valueMm: 1400,
        layerName: 'FURNACE_CRUCIBLE',
        unit: 'mm',
        description: 'Vertical bath cavity height',
        drawingLocation: 'Vertical bath elevation',
        cadEntity: 'DIMVERTICAL',
        highlightZone: 'crucibleHeight',
        viewSource: 'FRONT',
        cropBox: { x: 10, y: 20, w: 30, h: 60 },
      }
    );
  } else {
    // COIL ASSEMBLY
    extractedDimensions.push(
      {
        key: 'coilInnerDiameter',
        label: 'Induction Coil Inner Diameter',
        valueMm: 1220,
        layerName: 'FURNACE_COIL',
        unit: 'mm',
        description: 'Copper winding clear inner diameter',
        drawingLocation: 'Copper helical coil inner radius clear diameter',
        cadEntity: 'DIMDIAMETER',
        highlightZone: 'coilInnerDiameter',
        viewSource: 'TOP',
        cropBox: { x: 25, y: 35, w: 50, h: 30 },
      },
      {
        key: 'coilTurnCount',
        label: 'Primary Coil Turn Count',
        valueMm: 27,
        layerName: 'FURNACE_COIL',
        unit: 'turns',
        description: 'Water cooled extruded copper hollow turn count',
        drawingLocation: 'Stacked copper turn array',
        cadEntity: 'ARRAY',
        highlightZone: 'coilTurnCount',
        viewSource: 'FRONT',
        cropBox: { x: 60, y: 20, w: 30, h: 60 },
      }
    );
  }

  // The bundled reference drawing is a single FRONT view with known callout positions:
  // replace the rough boxes with pixel-accurate ones so highlights land exactly on the callout.
  const isReferenceImage = !imageUrl || imageUrl === SHELL_DRAWING_IMAGE_URL;
  if (componentType === 'SHELL_MECHANICAL' && isReferenceImage) {
    extractedDimensions.forEach((d) => {
      const box = sampleCropBox(EXTRACTED_KEY_TO_SHELL_ID[d.key]);
      if (box) {
        d.cropBox = box;
        d.viewSource = 'FRONT';
      }
    });
  }

  return {
    filename: fileName,
    fileSizeKb,
    componentType,
    uploadedAt: new Date().toLocaleTimeString(),
    extractedDimensions,
    rawDxfContent: contentStr,
    imageUrl: imageUrl || SHELL_DRAWING_IMAGE_URL,
    frontViewImageUrl: imageUrl || SHELL_DRAWING_IMAGE_URL,
    boundingWidthMm: 2580,
    boundingHeightMm: 1365,
  };
}

export function getSampleDwgFile(type: ComponentType): UploadedDwgFile {
  return parseDxfOrDwgContent(
    'FURNACE_SHELL_MECH_10T.dwg',
    '',
    384,
    SHELL_DRAWING_IMAGE_URL
  );
}

