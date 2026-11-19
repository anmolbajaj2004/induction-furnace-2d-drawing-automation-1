import React, { useMemo, useState } from 'react';
import { UploadedDwgFile, FurnaceInputs, ExtractedDwgDimension, OrthographicViewType, ReferenceSet } from '../types/furnace';
import { matchReference, convertThroughImages, conversionBlocker, Axis, Curve, ConvertParams, Converted } from '../utils/referenceConversion';
import { RealDrawingVisualizer, DimMarker, RefMarker } from './RealDrawingVisualizer';
import { TonnageCapacitySelector } from './TonnageCapacitySelector';
import { ShellDimensionPanel } from './ShellDimensionPanel';
import { ShellResult, SHELL_GROUPS, ShellGroupId, formatDim, scaleGenericDimension } from '../utils/shellModel';
import { EXTRACTED_KEY_TO_SHELL_ID, VIEWS_BY_ID, sampleCropBox } from '../utils/shellDimLocations';
import { SHELL_DRAWING_IMAGE_URL } from '../utils/dwgParser';
import { Scale, Activity, ArrowRight, ArrowLeft, Layers, MapPin, Eye, Plus, Trash2, Download } from 'lucide-react';
import { buildDocx, buildXlsx, buildJson, saveBlob, ExportRow, ExportMeta } from '../utils/exportFormats';
import {
  evaluateTemplate,
  findTemplateRow,
  templateRequired,
  anchorWarning,
  endBayLayout,
  TemplateResult,
  TEMPLATE_STEPS,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  TEMPLATE_ROW_COUNT,
  T_MIN,
  T_MAX,
} from '../utils/shellTemplate';

interface ReferenceSpecsStepProps {
  referenceSet: ReferenceSet;
  uploadedFile: UploadedDwgFile;
  inputs: FurnaceInputs;
  shell: ShellResult;
  onSelectTonnage: (tons: number) => void;
  onChangeInput: (key: keyof FurnaceInputs, value: any) => void;
  onUpdateExtractedDimensions: (dimensions: ExtractedDwgDimension[]) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
}

export const ReferenceSpecsStep: React.FC<ReferenceSpecsStepProps> = ({
  referenceSet,
  uploadedFile,
  inputs,
  shell,
  onSelectTonnage,
  onChangeInput,
  onUpdateExtractedDimensions,
  onNextStep,
  onPrevStep,
}) => {
  // Target value for an extracted callout: the model's scaled value for that dimension
  // (if the user edited the extracted value, the same scale factor is applied to the edited number).
  const shellDimFor = (dim: ExtractedDwgDimension) => {
    if (dim.key.startsWith('shell_')) return shell.dims.find((d) => d.id === dim.key.slice(6));
    const id = EXTRACTED_KEY_TO_SHELL_ID[dim.key];
    return (id && shell.dims.find((d) => d.id === id)) || shell.byExtractedKey[dim.key];
  };
  // ---- Reference image set: when its dimensions were read, Target is converted ONLY from the pasted drawings ----
  const imageMode = referenceSet.extractedDimensions.length > 0;
  const [axis, setAxis] = useState<Axis>('capacity');
  const [curve, setCurve] = useState<Curve>('power');
  // manual pairing: given key -> reference key ('__none' = deliberately unpaired)
  const [refOverride, setRefOverride] = useState<Record<string, string>>({});
  const convertParams: ConvertParams = {
    axis,
    curve,
    given: { capacity: inputs.baselineCapacity, power: inputs.baselinePower },
    ref: { capacity: referenceSet.capacityT, power: referenceSet.powerMW },
    target: { capacity: inputs.targetCapacity, power: inputs.targetPower },
  };
  const autoMatches = useMemo(
    () => (imageMode ? matchReference(uploadedFile.extractedDimensions, referenceSet.extractedDimensions) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [imageMode, uploadedFile.extractedDimensions, referenceSet.extractedDimensions]
  );
  const refFor = (dim: ExtractedDwgDimension): ExtractedDwgDimension | undefined => {
    const ov = refOverride[dim.key];
    if (ov === '__none') return undefined;
    if (ov) return referenceSet.extractedDimensions.find((r) => r.key === ov);
    return autoMatches[dim.key]?.ref;
  };
  const convertedFor = (dim: ExtractedDwgDimension): Converted | null => {
    if (!imageMode) return null;
    const r = refFor(dim);
    if (!r) return { value: null, note: 'No matching dimension on the reference images, so no required value is given.', extrapolated: false };
    return convertThroughImages(dim.valueMm, r.valueMm, convertParams);
  };

  // ---- Shell template FCE-SHEL: the engineer's formulas are the logic for Target when no reference images are used ----
  const templateMode = !imageMode && uploadedFile.componentType === 'SHELL_MECHANICAL';
  const tv = useMemo(() => evaluateTemplate(inputs.targetCapacity), [inputs.targetCapacity]);
  // COMPUTED column: what the engineer's template formulas give for a dimension. Always available for a shell drawing,
  // whether or not a reference image set is loaded (the Extracted column is the separate, image-read value).
  const computedOn = uploadedFile.componentType === 'SHELL_MECHANICAL';
  const computedFor = (dim: ExtractedDwgDimension): TemplateResult | null => {
    if (!computedOn || !tv) return null;
    const shellId = EXTRACTED_KEY_TO_SHELL_ID[dim.key] ?? shell.byExtractedKey[dim.key]?.id;
    const row = findTemplateRow(dim.key, dim.label, shellId);
    return row ? templateRequired(row, dim.valueMm, tv) : null;
  };
  const tplFor = (dim: ExtractedDwgDimension): TemplateResult | null => (templateMode ? computedFor(dim) : null);

  // 'template' = engineer's shell template, 'model' = taken from the parametric shell model,
  // 'rule' = general scaling rule (see scaleGenericDimension), 'images' = converted from the base and reference drawings only
  const basisFor = (dim: ExtractedDwgDimension): 'template' | 'model' | 'rule' | 'images' | null =>
    templateMode
      ? tplFor(dim)?.value != null
        ? 'template'
        : null
      : imageMode
      ? convertedFor(dim)?.value != null
        ? 'images'
        : null
      : shellDimFor(dim)
      ? 'model'
      : uploadedFile.componentType === 'SHELL_MECHANICAL'
      ? 'rule'
      : null;
  const requiredFor = (dim: ExtractedDwgDimension): number | null => {
    if (templateMode) return tplFor(dim)?.value ?? null;
    if (imageMode) return convertedFor(dim)?.value ?? null;
    const m = shellDimFor(dim);
    if (!m) {
      if (uploadedFile.componentType !== 'SHELL_MECHANICAL') return null;
      return scaleGenericDimension(dim.label, dim.valueMm, dim.unit, shell.scaling);
    }
    if (dim.valueMm === m.ref) return m.value;
    const factor = m.ref !== 0 ? m.value / m.ref : 1;
    return Number((dim.valueMm * factor).toFixed(2));
  };
  // Hovered dimension state for highlighting on user's pasted images
  const [hoveredDimension, setHoveredDimension] = useState<ExtractedDwgDimension | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(false);

  // ---- Table rows: what was read from the drawing + every other shell dimension ----
  const LAYER_BY_GROUP: Record<ShellGroupId, string> = {
    envelope: 'FURNACE_SHELL',
    flange: 'FURNACE_SHELL_FLANGE',
    body: 'FURNACE_SHELL',
    panels: 'FURNACE_SHELL_PANEL',
    spout: 'FURNACE_SHELL_SPOUT',
    base: 'FURNACE_SHELL_BASE',
  };
  const onReferenceDrawing =
    (uploadedFile.frontViewImageUrl || uploadedFile.imageUrl || SHELL_DRAWING_IMAGE_URL) === SHELL_DRAWING_IMAGE_URL;

  const registerDims = useMemo(() => {
    // With a reference image set the table lists only what was read from the drawings (the built-in model rows are not images)
    // (same with the shell template: rows that were not read from the user's drawing are not listed, no value is made up)
    if (uploadedFile.componentType !== 'SHELL_MECHANICAL' || imageMode || templateMode) return [];
    const covered = new Set<string>();
    uploadedFile.extractedDimensions.forEach((d) => {
      const id = d.key.startsWith('shell_')
        ? d.key.slice(6)
        : EXTRACTED_KEY_TO_SHELL_ID[d.key] ?? shell.byExtractedKey[d.key]?.id;
      if (id) covered.add(id);
    });
    return shell.dims
      .filter((sd) => !covered.has(sd.id))
      .map((sd) => {
        const grp = SHELL_GROUPS.find((g) => g.id === sd.group)!;
        const dim: ExtractedDwgDimension = {
          key: `shell_${sd.id}`,
          label: sd.label,
          valueMm: sd.ref,
          unit: sd.unit,
          layerName: LAYER_BY_GROUP[sd.group],
          description: sd.rule,
          drawingLocation: `${grp.title} — ${grp.note}`,
          cadEntity: `DIMENSION [${sd.ref} ${sd.unit}]`,
          highlightZone: `shell_${sd.id}`,
          viewSource: 'FRONT',
          cropBox: onReferenceDrawing ? sampleCropBox(sd.id) : undefined,
        };
        return { dim, group: grp };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFile.extractedDimensions, uploadedFile.componentType, shell, onReferenceDrawing, imageMode, templateMode]);

  const isChanged = (dim: ExtractedDwgDimension) => {
    const req = requiredFor(dim);
    return req !== null && Math.abs(req - dim.valueMm) > 0.004;
  };
  // Pin numbers: stable order = extracted dims first, then the remaining shell dimensions.
  const allRows = [
    ...uploadedFile.extractedDimensions.map((d) => ({ dim: d, shellId: shellDimFor(d)?.id })),
    ...registerDims.map((r) => ({ dim: r.dim, shellId: r.dim.key.slice(6) as string | undefined })),
  ].map((r, i) => ({ ...r, n: i + 1 }));
  const numberByKey: Record<string, number> = {};
  allRows.forEach((r) => (numberByKey[r.dim.key] = r.n));

  // Every view a dimension appears in (the one it was read from first).
  const viewsFor = (dim: ExtractedDwgDimension): OrthographicViewType[] => {
    const sid = shellDimFor(dim)?.id;
    const list: OrthographicViewType[] = [dim.viewSource || 'FRONT'];
    (sid ? VIEWS_BY_ID[sid] ?? [] : []).forEach((v) => {
      if (!list.includes(v)) list.push(v);
    });
    return list;
  };
  const markers: DimMarker[] = allRows.map((r) => ({
    key: r.dim.key,
    n: r.n,
    shellId: r.shellId,
    label: r.dim.label,
    box: r.dim.cropBox,
    boxView: r.dim.viewSource || 'FRONT',
    views: viewsFor(r.dim),
  }));
  // Reference-image marks: same number as the given dimension they are paired with, extra numbers for unpaired ones.
  const refMarkers: RefMarker[] = (() => {
    if (!imageMode) return [];
    const givenOf: Record<string, string> = {};
    uploadedFile.extractedDimensions.forEach((g) => {
      const r = refFor(g);
      if (r && !(r.key in givenOf)) givenOf[r.key] = g.key;
    });
    let extra = allRows.length;
    return referenceSet.extractedDimensions.map((dim) => {
      const gk = givenOf[dim.key];
      return { key: dim.key, dim, givenKey: gk, n: gk ? numberByKey[gk] : ++extra };
    });
  })();
  const hoverByKey = (key: string | null) => setHoveredDimension(key ? allRows.find((r) => r.dim.key === key)?.dim ?? null : null);

  const extractedRows = uploadedFile.extractedDimensions.filter((d) => !onlyChanged || isChanged(d));
  const totalRows = uploadedFile.extractedDimensions.length + registerDims.length;
  const changedRows =
    uploadedFile.extractedDimensions.filter(isChanged).length + registerDims.filter((r) => isChanged(r.dim)).length;

  const handleDownloadTable = (fmt: 'docx' | 'xlsx' | 'json') => {
    const rows: ExportRow[] = allRows.map((r) => {
      const req = requiredFor(r.dim);
      return {
        n: r.n,
        label: r.dim.label,
        key: r.dim.key,
        views: viewsFor(r.dim).join(', '),
        layer: r.dim.layerName,
        given: r.dim.valueMm,
        reference: refFor(r.dim)?.valueMm ?? null,
        computed: computedFor(r.dim)?.value ?? computedFor(r.dim)?.text ?? null,
        required: req,
        change: req === null ? null : Number((req - r.dim.valueMm).toFixed(2)),
        unit: r.dim.unit,
        source: registerDims.some((x) => x.dim.key === r.dim.key)
          ? 'shell model (not read from drawing)'
          : templateMode
          ? tplFor(r.dim)
            ? `read from drawing; required by template ${TEMPLATE_ID} v${TEMPLATE_VERSION}: ${tplFor(r.dim)!.note}`
            : `read from drawing; not in template ${TEMPLATE_ID}, so no required value`
          : imageMode
          ? req !== null
            ? 'read from drawing; required converted from the base and reference images only'
            : 'read from drawing; no matching reference dimension or conversion not possible, so no required value'
          : basisFor(r.dim) === 'rule'
          ? 'read from drawing; required by general rule'
          : 'read from drawing; required by shell model',
      };
    });
    const meta: ExportMeta = {
      model: uploadedFile.extractionModel || 'not recorded',
      referenceModel: imageMode ? referenceSet.extractionModel || 'not recorded' : undefined,
      referenceTons: imageMode ? referenceSet.capacityT : undefined,
      referencePower: imageMode ? referenceSet.powerMW : undefined,
      conversion: templateMode
        ? `template ${TEMPLATE_ID} v${TEMPLATE_VERSION} (linear between ${T_MIN} t and ${T_MAX} t drawings; constants copied from the Base drawing)`
        : imageMode
        ? `${curve === 'power' ? 'power-law' : 'linear'} through base and reference images, axis: ${axis}`
        : 'built-in shell model',
      givenTons: inputs.baselineCapacity,
      requiredTons: inputs.targetCapacity,
      file: uploadedFile.filename,
      when: new Date().toLocaleString(),
    };
    const base = `dimensions_${inputs.baselineCapacity}t_to_${inputs.targetCapacity}t`;
    if (fmt === 'docx') saveBlob(buildDocx(rows, meta), `${base}.docx`);
    else if (fmt === 'xlsx') saveBlob(buildXlsx(rows, meta), `${base}.xlsx`);
    else saveBlob(buildJson(rows, meta), `${base}.json`);
  };

  // New custom dimension input state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValueMm, setNewValueMm] = useState<number>(1000);
  const [newViewSource, setNewViewSource] = useState<'FRONT' | 'TOP' | 'SIDE'>('FRONT');

  // Add custom dimension extracted from pasted image
  const handleAddDimension = () => {
    if (!newLabel.trim()) return;

    const newDim: ExtractedDwgDimension = {
      key: `custom_dim_${Date.now()}`,
      label: newLabel.trim(),
      valueMm: newValueMm,
      unit: 'mm',
      layerName: `FURNACE_${uploadedFile.componentType.replace('_MECHANICAL', '')}`,
      description: 'Manually identified dimension on pasted drawing image',
      drawingLocation: `User highlighted region on ${newViewSource} view image`,
      cadEntity: `DIMENSION [${newValueMm} mm]`,
      highlightZone: `custom_${Date.now()}`,
      viewSource: newViewSource,
      cropBox: { x: 35, y: 35, w: 30, h: 30 },
    };

    const updated = [...uploadedFile.extractedDimensions, newDim];
    onUpdateExtractedDimensions(updated);

    setNewLabel('');
    setNewValueMm(1000);
    setShowAddModal(false);
  };

  // Delete dimension
  const handleDeleteDimension = (key: string) => {
    const updated = uploadedFile.extractedDimensions.filter((d) => d.key !== key);
    onUpdateExtractedDimensions(updated);
  };

  // Edit dimension value directly
  const handleEditDimensionValue = (key: string, val: number) => {
    const updated = uploadedFile.extractedDimensions.map((d) =>
      d.key === key ? { ...d, valueMm: val } : d
    );
    onUpdateExtractedDimensions(updated);

    if (key === 'innerCasingDiameter' || key === 'innerDiameter' || key === 'dim_front_width') {
      onChangeInput('baselineInnerDiameter', val);
    } else if (key === 'shellHeight' || key === 'crucibleHeight' || key === 'dim_front_height') {
      onChangeInput('baselineCrucibleHeight', val);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
            STEP 2 OF 4
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <Scale className="w-5 h-5 text-amber-500" />
            Extracted CAD Dimensions, Tonnage Selector &amp; Dimension Changes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pick the tonnage you need — the shell dimensions are recalculated, compared with your Base drawing, and the shell is redrawn below.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrevStep}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          <button
            onClick={onNextStep}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Define Target Design</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reference Drawing Rating Inputs */}
      <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
            Reference Drawing Operating Rating (Set for Pasted Drawings)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference Capacity</span>
              <span className="font-mono text-[11px] text-slate-500">Tons</span>
            </label>
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.5"
              value={inputs.baselineCapacity}
              onChange={(e) => onChangeInput('baselineCapacity', parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference Power</span>
              <span className="font-mono text-[11px] text-slate-500">MW</span>
            </label>
            <input
              type="number"
              min="0.1"
              max="50"
              step="0.5"
              value={inputs.baselinePower}
              onChange={(e) => onChangeInput('baselinePower', parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference Frequency</span>
              <span className="font-mono text-[11px] text-slate-500">Hz</span>
            </label>
            <input
              type="number"
              min="50"
              max="3000"
              step="50"
              value={inputs.baselineFrequency}
              onChange={(e) => onChangeInput('baselineFrequency', parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Tonnage & capacity selector (drives the Target column + redrawn shell below) */}
      <TonnageCapacitySelector
        inputs={inputs}
        shell={shell}
        onSelectTonnage={onSelectTonnage}
        onChangeInput={onChangeInput}
      />

      {/* Main Extracted CAD Dimensions Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left 8 Cols: Extracted Dimensions Table */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              Dimensions Extracted Across Tri-View Images
            </h3>

            <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {totalRows} dimensions · <span className="text-amber-600 dark:text-amber-400 font-bold">{changedRows} changed</span>
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="accent-amber-500" />
              Changed only
            </label>
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dimension</span>
            </button>
            </div>
          </div>

          {/* Add Custom Dimension Modal */}
          {showAddModal && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">Add Custom Dimension Callout:</span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Label (e.g. Flange Thickness)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
                <input
                  type="number"
                  placeholder="Value (mm)"
                  value={newValueMm}
                  onChange={(e) => setNewValueMm(parseFloat(e.target.value) || 0)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                />
                <select
                  value={newViewSource}
                  onChange={(e) => setNewViewSource(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                >
                  <option value="FRONT">FRONT View</option>
                  <option value="TOP">TOP View</option>
                  <option value="SIDE">SIDE View</option>
                </select>
                <button
                  onClick={handleAddDimension}
                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* How Target is produced: from the pasted drawings only (reference set present) or from the built-in model */}
          {imageMode ? (
            <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs space-y-2 text-blue-900 dark:text-blue-100">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold">Target is converted only from your drawings:</span>
                <label className="flex items-center gap-1">
                  by
                  <select
                    value={axis}
                    onChange={(e) => setAxis(e.target.value as Axis)}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
                  >
                    <option value="capacity">capacity (t)</option>
                    <option value="power">power (MW)</option>
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  curve
                  <select
                    value={curve}
                    onChange={(e) => setCurve(e.target.value as Curve)}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5"
                  >
                    <option value="power">power-law through the two drawings</option>
                    <option value="linear">straight line through the two drawings</option>
                  </select>
                </label>
              </div>
              <div className="font-mono text-[11px]">
                Base {inputs.baselineCapacity} t / {inputs.baselinePower} MW → Extracted (reference image) {referenceSet.capacityT ?? '?'} t / {referenceSet.powerMW ?? '?'} MW → Target{' '}
                {inputs.targetCapacity} t / {inputs.targetPower} MW
              </div>
              {conversionBlocker(convertParams) && <div className="text-rose-700 dark:text-rose-300 font-semibold">{conversionBlocker(convertParams)}</div>}
              <div className="text-[11px] text-blue-800/80 dark:text-blue-200/80">
                A dimension is converted only when the same dimension was read on the reference images (the Extracted column). Otherwise it shows — and no value is made up. The Computed column is separate: it always shows what the template formulas give.
              </div>
            </div>
          ) : templateMode ? (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs space-y-2 text-emerald-900 dark:text-emerald-100">
              <div className="font-bold">
                Target is calculated with shell template {TEMPLATE_ID} v{TEMPLATE_VERSION}
              </div>
              <div className="font-mono text-[11px]">
                Base {inputs.baselineCapacity} t → Target {inputs.targetCapacity} t · {TEMPLATE_ROW_COUNT} template dimensions · t_side 16 mm
              </div>
              <div className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                Plan dimensions: X = X1 + (X2 − X1) × (T − {T_MIN}) / ({T_MAX} − {T_MIN}), from the {T_MIN} t and {T_MAX} t drawings. Heights, plates, spout and hearth seat are constants copied from the Base
                drawing. A dimension that is not in the template shows — and no value is made up.
              </div>
              {tv?.extrapolated && (
                <div className="text-amber-700 dark:text-amber-300 font-semibold">
                  {inputs.targetCapacity} t is outside {T_MIN}–{T_MAX} t: formula results are EXTRAPOLATED, designer check required.
                </div>
              )}
              {anchorWarning(inputs.baselineCapacity) && (
                <div className="text-amber-700 dark:text-amber-300">{anchorWarning(inputs.baselineCapacity)}</div>
              )}
              {uploadedFile.extractedDimensions.some((d) => !tplFor(d)) && (
                <div className="text-slate-600 dark:text-slate-300">
                  {uploadedFile.extractedDimensions.filter((d) => !tplFor(d)).length} extracted dimension(s) are not in the template and have no required value.
                </div>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              Target currently comes from the built-in parametric shell model. Add a reference image set in Step 1 to convert from your own drawings only.
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="pl-3 pr-1 py-3 font-semibold text-center">#</th>
                  <th className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-200">Views</th>
                  <th className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                    CAD Dimension Label <span className="text-[9px] text-amber-500 font-normal">(Hover to locate)</span>
                  </th>
                  <th className="px-3 py-3 font-semibold">Layer</th>
                  <th className="px-3 py-3 font-semibold text-right">Base ({inputs.baselineCapacity} t)</th>
                  <th className="px-3 py-3 font-semibold text-right text-blue-600 dark:text-blue-400">
                    Extracted ({referenceSet.capacityT ?? '?'} t)
                    <div className="text-[9px] font-normal normal-case tracking-normal text-slate-400">read from reference image</div>
                  </th>
                  <th className="px-3 py-3 font-semibold text-right text-emerald-600 dark:text-emerald-400">
                    Computed ({inputs.targetCapacity} t)
                    <div className="text-[9px] font-normal normal-case tracking-normal text-slate-400">by template formula</div>
                  </th>
                  <th className="px-3 py-3 font-semibold text-right text-amber-600 dark:text-amber-400">Target ({inputs.targetCapacity} t)</th>
                  <th className="px-3 py-3 font-semibold text-right">Change</th>
                  <th className="px-2 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900">
                {(() => {
                  const renderRow = (dim: ExtractedDwgDimension, editable: boolean) => {
                  const isHovered = hoveredDimension?.key === dim.key;
                  const rowChanged = isChanged(dim);
                  return (
                    <tr
                      key={dim.key}
                      onMouseEnter={() => setHoveredDimension(dim)}
                      onMouseLeave={() => setHoveredDimension(null)}
                      className={`transition-colors cursor-pointer ${
                        isHovered
                          ? 'bg-amber-500/25 dark:bg-amber-500/30 font-bold'
                          : rowChanged
                          ? 'bg-amber-500/10 hover:bg-amber-500/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-950/60'
                      }`}
                    >
                      {/* PIN NUMBER (same number is drawn on the views) */}
                      <td className="pl-3 pr-1 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold text-white ${
                            isHovered ? 'bg-blue-600' : 'bg-amber-600'
                          }`}
                        >
                          {numberByKey[dim.key]}
                        </span>
                      </td>

                      {/* VIEW BADGES: every view this dimension is marked on */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {viewsFor(dim).map((v) => (
                            <span
                              key={v}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                v === 'FRONT'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                  : v === 'TOP'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* CAD DIMENSION LABEL CELL WITH HOVER HIGHLIGHT */}
                      <td className="px-4 py-3 font-sans font-semibold text-slate-900 dark:text-white relative group">
                        <div className="flex items-center gap-2">
                          <MapPin
                            className={`w-3.5 h-3.5 transition-all ${
                              isHovered ? 'text-amber-500 scale-125 animate-bounce' : 'text-slate-400'
                            }`}
                          />
                          <span className="underline decoration-amber-500/50 underline-offset-4 font-bold">
                            {dim.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                          {dim.layerName}
                        </span>
                      </td>

                      {/* INLINE EDITABLE VALUE */}
                      <td className="px-3 py-3 text-right">
                        {editable ? (
                          <input
                            type="number"
                            value={dim.valueMm}
                            onChange={(e) => handleEditDimensionValue(dim.key, parseFloat(e.target.value) || 0)}
                            className="w-24 text-right bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-amber-500"
                          />
                        ) : (
                          <span className="inline-block w-24 text-right px-2 py-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                            {formatDim(dim.valueMm, 2)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-1">{dim.unit}</span>
                      </td>

                      {/* REFERENCE IMAGE VALUE: the matching dimension read from the reference drawings (between Base and Target) */}
                      <td className="px-3 py-3 text-right">
                        {(() => {
                          if (!imageMode) return <span className="text-slate-400">—</span>;
                          const r = refFor(dim);
                          if (r) {
                            return (
                              <span title={`Matched to "${r.label}" on the reference ${r.viewSource} view${refOverride[dim.key] ? ' (chosen manually)' : ''}`}>
                                <span className="font-bold text-blue-700 dark:text-blue-300">{formatDim(r.valueMm, 2)}</span>{' '}
                                <span className="text-[10px] text-slate-400">{r.unit}</span>
                                {editable && (
                                  <button
                                    onClick={() => setRefOverride((p) => ({ ...p, [dim.key]: '__none' }))}
                                    className="ml-1 text-[10px] text-slate-400 hover:text-rose-500 cursor-pointer"
                                    title="This is not the same dimension - unpair it"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            );
                          }
                          if (!editable) return <span className="text-slate-400">—</span>;
                          const options = referenceSet.extractedDimensions.filter((x) => x.viewSource === dim.viewSource);
                          return (
                            <select
                              value=""
                              onChange={(e) => e.target.value && setRefOverride((p) => ({ ...p, [dim.key]: e.target.value }))}
                              className="max-w-[120px] text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 text-slate-500"
                              title="No reference dimension matched automatically. Pick the same dimension on the reference image, if it was read."
                            >
                              <option value="">pick…</option>
                              {options.map((x) => (
                                <option key={x.key} value={x.key}>
                                  {x.label} = {x.valueMm}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>

                      {/* COMPUTED: generated by the template formulas, independent of the reference image */}
                      <td className="px-3 py-3 text-right">
                        {(() => {
                          const c = computedFor(dim);
                          if (!c) return <span className="text-slate-400" title={computedOn ? 'Not in the template, so no computed value' : 'Template applies to shell drawings only'}>—</span>;
                          return (
                            <span title={c.note}>
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">{c.text ?? formatDim(c.value as number, 2)}</span>
                              {c.text !== 'no rule' && <span className="text-[10px] text-slate-400"> {dim.unit}</span>}
                              {c.status === 'FORMULA' && (
                                <span className="ml-1 text-[9px] font-sans font-semibold text-emerald-600 border border-emerald-500/40 rounded px-1 align-middle">formula</span>
                              )}
                              {c.status === 'LAYOUT' && (
                                <span className="ml-1 text-[9px] font-sans font-semibold text-slate-500 border border-slate-300 dark:border-slate-600 rounded px-1 align-middle">layout</span>
                              )}
                              {c.extrapolated && (
                                <span className="ml-1 text-[9px] font-sans font-semibold text-amber-600 border border-amber-500/50 rounded px-1 align-middle">extrapolated</span>
                              )}
                            </span>
                          );
                        })()}
                      </td>

                      {/* TARGET (NEW TONNAGE) VALUE + CHANGE */}
                      {(() => {
                        const req = requiredFor(dim);
                        if (req === null) {
                          const tr = tplFor(dim);
                          if (tr?.text) {
                            return (
                              <>
                                <td className="px-3 py-3 text-right font-bold text-amber-700 dark:text-amber-300" title={tr.note}>
                                  {tr.text}
                                  {tr.text !== 'no rule' && <span className="text-[10px] font-normal text-slate-400"> {dim.unit}</span>}
                                  <span className="ml-1 text-[9px] font-sans font-semibold text-slate-500 border border-slate-300 dark:border-slate-600 rounded px-1 align-middle">
                                    layout
                                  </span>
                                  {tr.extrapolated && (
                                    <span className="ml-1 text-[9px] font-sans font-semibold text-amber-600 border border-amber-500/50 rounded px-1 align-middle">extrapolated</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-right text-slate-400">—</td>
                              </>
                            );
                          }
                          return (
                            <>
                              <td className="px-3 py-3 text-right text-slate-400">—</td>
                              <td className="px-3 py-3 text-right text-slate-400">—</td>
                            </>
                          );
                        }
                        const delta = Number((req - dim.valueMm).toFixed(2));
                        const changed = Math.abs(delta) > 0.004;
                        return (
                          <>
                            <td className={`px-3 py-3 text-right font-bold ${changed ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                              {formatDim(req, 2)} <span className="text-[10px] font-normal text-slate-400">{dim.unit}</span>
                              {basisFor(dim) === 'images' && convertedFor(dim)?.extrapolated && (
                                <span
                                  className="ml-1 text-[9px] font-sans font-semibold text-amber-600 border border-amber-500/50 rounded px-1 align-middle"
                                  title={convertedFor(dim)?.note}
                                >
                                  extrapolated
                                </span>
                              )}
                              {basisFor(dim) === 'template' && tplFor(dim)?.extrapolated && (
                                <span
                                  className="ml-1 text-[9px] font-sans font-semibold text-amber-600 border border-amber-500/50 rounded px-1 align-middle"
                                  title={tplFor(dim)?.note}
                                >
                                  extrapolated
                                </span>
                              )}
                              {basisFor(dim) === 'template' && !tplFor(dim)?.extrapolated && tplFor(dim)?.status === 'FORMULA' && (
                                <span
                                  className="ml-1 text-[9px] font-sans font-semibold text-emerald-600 border border-emerald-500/40 rounded px-1 align-middle"
                                  title={tplFor(dim)?.note}
                                >
                                  formula
                                </span>
                              )}
                              {basisFor(dim) === 'rule' && (
                                <span
                                  className="ml-1 text-[9px] font-sans font-semibold text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1 align-middle"
                                  title="Scaled by the general rule (thickness: tonnage ratio^0.25 snapped to a standard plate; heights: height scale; other lengths: width scale; counts/vents/allowances unchanged). Not from the parametric shell model."
                                >
                                  rule
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-right ${changed ? (delta > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400') : 'text-slate-400'}`}>
                              {changed ? `${delta > 0 ? '+' : ''}${formatDim(delta, 2)}` : '—'}
                            </td>
                          </>
                        );
                      })()}

                      <td className="px-2 py-3 text-center">
                        {editable ? (
                          <button
                            onClick={() => handleDeleteDimension(dim.key)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded"
                            title="Remove dimension"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 uppercase">model</span>
                        )}
                      </td>
                    </tr>
                  );
                  };

                  return (
                    <>
                      {extractedRows.map((d) => renderRow(d, true))}
                      {SHELL_GROUPS.map((grp) => {
                        const rows = registerDims.filter((r) => r.group.id === grp.id && (!onlyChanged || isChanged(r.dim)));
                        if (rows.length === 0) return null;
                        return (
                          <React.Fragment key={grp.id}>
                            <tr className="bg-slate-50 dark:bg-slate-950/80">
                              <td colSpan={10} className="px-3 py-2 text-[11px] font-sans font-bold text-slate-700 dark:text-slate-200">
                                {grp.title} <span className="font-normal text-slate-400">— {grp.note}</span>
                              </td>
                            </tr>
                            {rows.map((r) => renderRow(r.dim, false))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Download the whole table (all rows, not only the filtered ones) */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mr-1">
              Download output
            </span>
            {([
              ['Word (.docx)', 'docx'],
              ['Excel (.xlsx)', 'xlsx'],
              ['JSON (.json)', 'json'],
            ] as const).map(([lbl, fmt]) => (
              <button
                key={fmt}
                onClick={() => handleDownloadTable(fmt)}
                className="px-3 py-1.5 text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {lbl}
              </button>
            ))}
            <span className="text-[10px] text-slate-400 ml-auto">
              {totalRows} rows · model: {uploadedFile.extractionModel || 'not recorded (sample / earlier run)'}
            </span>
          </div>

          {/* Every template step evaluated at the required tonnage (includes values that are not dimension rows) */}
          {computedOn && tv && (
            <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
              <summary className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 cursor-pointer">
                Template outputs at {inputs.targetCapacity} t ({TEMPLATE_STEPS.length} steps)
                {tv.extrapolated && <span className="ml-2 text-amber-600 normal-case font-semibold">extrapolated</span>}
              </summary>
              <table className="w-full text-xs font-mono mt-2">
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {TEMPLATE_STEPS.map((s) => (
                    <tr key={s.name}>
                      <td className="py-1 pr-3 text-slate-500">{s.name}</td>
                      <td className="py-1 pr-3 font-sans text-slate-700 dark:text-slate-300">{s.label}</td>
                      <td className="py-1 text-right font-bold text-slate-900 dark:text-white">
                        {formatDim(tv.values[s.name], 2)} <span className="text-[10px] font-normal text-slate-400">{s.unit}</span>
                      </td>
                    </tr>
                  ))}
                  {(() => {
                    const lay = endBayLayout(tv.values.outer_end_bay_L_total);
                    return (
                      <tr>
                        <td className="py-1 pr-3 text-slate-500">end_bay_layout</td>
                        <td className="py-1 pr-3 font-sans text-slate-700 dark:text-slate-300">Outer end bay (L) layout</td>
                        <td className="py-1 text-right font-bold text-slate-900 dark:text-white">
                          {lay.split ? `${lay.outer} + ${lay.rib} + ${lay.inner} (split)` : `${formatDim(lay.single, 2)} (single bay)`}{' '}
                          <span className="text-[10px] font-normal text-slate-400">mm</span>
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </details>
          )}
        </div>

        {/* Right 5 Cols: Real Drawing Visualizer displaying user's tri-view images and bounding overlays */}
        <div className="lg:col-span-5 lg:self-stretch">
          <RealDrawingVisualizer
            uploadedFile={uploadedFile}
            referenceSet={referenceSet}
            refMarkers={refMarkers}
            hoveredDimension={hoveredDimension}
            requiredValue={hoveredDimension ? requiredFor(hoveredDimension) : null}
            hoveredViews={hoveredDimension ? viewsFor(hoveredDimension) : []}
            markers={markers}
            shell={uploadedFile.componentType === 'SHELL_MECHANICAL' ? shell : null}
            onHoverKey={hoverByKey}
          />
        </div>

      </div>

      {/* Full shell dimension register, redrawn shell and reference-vs-required changes */}
      <ShellDimensionPanel shell={shell} />

    </div>
  );
};
