import { ExtractedDwgDimension, ComponentType, OrthographicViewType } from '../types/furnace';
import { getShellDimCatalog } from './shellModel';
import { getSelectedModel } from './modelSelection';

export interface TriViewImagesPayload {
  frontViewBase64?: string | null;
  topViewBase64?: string | null;
  sideViewBase64?: string | null;
}

/** Problems from the last run that did not stop it (e.g. one view failed, or a second pass was skipped). */
export let lastExtractionWarnings: string[] = [];

/**
 * Reads the dimensions printed on the pasted views with the model picked in the header.
 * If the call fails or returns nothing this throws, so the UI can say so: there is no hard-coded sample fallback and
 * no default value / default location for an entry that arrives without one.
 */
export async function extractTriViewDimensionsFromDrawingImages(
  payload: TriViewImagesPayload,
  componentType: ComponentType
): Promise<ExtractedDwgDimension[]> {
  lastExtractionWarnings = [];
  const selected = getSelectedModel();

  const res = await fetch('/api/extract-dwg-dimensions-triview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      frontViewBase64: payload.frontViewBase64,
      topViewBase64: payload.topViewBase64,
      sideViewBase64: payload.sideViewBase64,
      componentType,
      model: selected.id,
      // ask the model to locate every known shell dimension on each pasted view
      knownDimensions: componentType === 'SHELL_MECHANICAL' ? getShellDimCatalog() : undefined,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${res.status}`);
  }

  const data = await res.json();
  lastExtractionWarnings = Array.isArray(data.warnings) ? data.warnings.map(String) : [];

  const list: any[] = Array.isArray(data.extractedDimensions) ? data.extractedDimensions : [];
  const dims: ExtractedDwgDimension[] = list
    .filter((d) => d && Number.isFinite(Number(d.valueMm)))
    .map((dim, idx) => ({
      key: dim.key || `dim_triview_${idx}`,
      label: dim.label || `CAD Dimension ${idx + 1}`,
      valueMm: Number(dim.valueMm),
      unit: dim.unit || 'mm',
      layerName: dim.layerName || `FURNACE_${componentType.replace('_MECHANICAL', '').replace('_THERMAL', '').replace('_ELECTRICAL', '')}`,
      description: dim.description || 'Extracted from tri-view drawing images',
      drawingLocation: dim.drawingLocation || `Location on ${dim.viewSource || 'FRONT'} view image`,
      cadEntity: dim.cadEntity || `DIMLINEAR [${dim.valueMm}]`,
      highlightZone: dim.key || `zone_${idx}`,
      viewSource: (dim.viewSource as OrthographicViewType) || 'FRONT',
      cropBox: dim.cropBox && Number.isFinite(Number(dim.cropBox.x)) ? dim.cropBox : undefined,
    }));

  if (dims.length === 0) {
    throw new Error(`${selected.name} returned no dimensions. ${lastExtractionWarnings.join(' | ')}`.trim());
  }
  return dims;
}

export async function extractDimensionsFromDrawingImage(
  imageBase64: string,
  componentType: ComponentType
): Promise<ExtractedDwgDimension[]> {
  return extractTriViewDimensionsFromDrawingImages({ frontViewBase64: imageBase64 }, componentType);
}
