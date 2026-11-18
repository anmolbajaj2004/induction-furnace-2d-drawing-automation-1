import React, { useState, useEffect } from 'react';
import { UploadedDwgFile, ComponentType, ReferenceSet } from '../types/furnace';
import { extractTriViewDimensionsFromDrawingImages, lastExtractionWarnings } from '../utils/aiVisionExtractor';
import { SHELL_DRAWING_IMAGE_URL } from '../utils/dwgParser';
import { getSelectedModel, useSelectedModel } from '../utils/modelSelection';
import { Clipboard, Sparkles, Layers, Cpu, Flame, Zap, CheckCircle2, ArrowRight, RefreshCw, Eye, Image as ImageIcon } from 'lucide-react';

interface DwgImagePasteUploaderProps {
  uploadedFile: UploadedDwgFile | null;
  onSelectFile: (file: UploadedDwgFile) => void;
  onNextStep: () => void;
  referenceSet: ReferenceSet;
  onChangeReferenceSet: (patch: Partial<ReferenceSet>) => void;
  /** capacity (t) and power (MW) of the furnace drawn in the given image */
  givenCapacity: number;
  givenPower: number;
  onChangeGiven: (patch: { capacity?: number; power?: number }) => void;
}

export const DwgImagePasteUploader: React.FC<DwgImagePasteUploaderProps> = ({
  uploadedFile,
  onSelectFile,
  onNextStep,
  referenceSet,
  onChangeReferenceSet,
  givenCapacity,
  givenPower,
  onChangeGiven,
}) => {
  // typed text of the given-image size boxes (so a box can be emptied while typing)
  const [capText, setCapText] = useState(String(givenCapacity));
  const [powText, setPowText] = useState(String(givenPower));
  // Which drawing set the next Ctrl+V goes to: the given drawing or the reference image set
  const [activeSet, setActiveSet] = useState<'GIVEN' | 'REFERENCE'>('GIVEN');
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const [refStatus, setRefStatus] = useState<string | null>(null);

  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType>('SHELL_MECHANICAL');
  const [activeTargetView, setActiveTargetView] = useState<'FRONT' | 'TOP' | 'SIDE'>('FRONT');

  // 3 Orthographic View Images
  const [frontViewSrc, setFrontViewSrc] = useState<string | null>(uploadedFile?.frontViewImageUrl || uploadedFile?.imageUrl || SHELL_DRAWING_IMAGE_URL);
  const [topViewSrc, setTopViewSrc] = useState<string | null>(uploadedFile?.topViewImageUrl || null);
  const [sideViewSrc, setSideViewSrc] = useState<string | null>(uploadedFile?.sideViewImageUrl || null);

  const activeModel = useSelectedModel();
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Global Paste Event Listener for Clipboard pasting into active view
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (activeSet === 'REFERENCE') handleReferenceImage(file, activeTargetView);
            else handleImagePasteOrDrop(file, activeTargetView);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeSet, activeTargetView, selectedComponentType, frontViewSrc, topViewSrc, sideViewSrc]);

  // ----- Reference image set (second furnace drawing in 3 views) -----
  const handleReferenceImage = (file: File, view: 'FRONT' | 'TOP' | 'SIDE') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onChangeReferenceSet(
        view === 'FRONT' ? { frontViewImageUrl: url } : view === 'TOP' ? { topViewImageUrl: url } : { sideViewImageUrl: url }
      );
      setRefStatus(`Reference ${view} view added. Fill in its capacity and power, then extract its dimensions.`);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractReference = async () => {
    if (!referenceSet.frontViewImageUrl && !referenceSet.topViewImageUrl && !referenceSet.sideViewImageUrl) {
      setRefStatus('Add at least one reference view image first.');
      return;
    }
    setIsExtractingRef(true);
    setRefStatus(`${getSelectedModel().name} reading the reference views...`);
    try {
      const dims = await extractTriViewDimensionsFromDrawingImages(
        {
          frontViewBase64: referenceSet.frontViewImageUrl,
          topViewBase64: referenceSet.topViewImageUrl,
          sideViewBase64: referenceSet.sideViewImageUrl,
        },
        selectedComponentType
      );
      onChangeReferenceSet({ extractedDimensions: dims, extractionModel: getSelectedModel().name });
      const w = lastExtractionWarnings.length ? ` Note: ${lastExtractionWarnings.join(' | ')}` : '';
      setRefStatus(`Read ${dims.length} reference dimensions with ${getSelectedModel().name}. They appear in the Reference column of Step 2.${w}`);
    } catch (err: any) {
      setRefStatus(`Reference extraction failed with ${getSelectedModel().name}: ${err?.message || 'unknown error'}`);
    } finally {
      setIsExtractingRef(false);
    }
  };

  const clearReference = () => {
    onChangeReferenceSet({
      frontViewImageUrl: undefined,
      topViewImageUrl: undefined,
      sideViewImageUrl: undefined,
      extractedDimensions: [],
      extractionModel: undefined,
    });
    setRefStatus(null);
  };

  const refCards: { view: 'FRONT' | 'TOP' | 'SIDE'; title: string; src?: string }[] = [
    { view: 'FRONT', title: 'R1. FRONT ELEVATION', src: referenceSet.frontViewImageUrl },
    { view: 'TOP', title: 'R2. TOP PLAN', src: referenceSet.topViewImageUrl },
    { view: 'SIDE', title: 'R3. SIDE PROJECTION', src: referenceSet.sideViewImageUrl },
  ];

  const handleImagePasteOrDrop = (file: File, viewTarget: 'FRONT' | 'TOP' | 'SIDE') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target?.result as string;

      if (viewTarget === 'FRONT') setFrontViewSrc(base64Url);
      else if (viewTarget === 'TOP') setTopViewSrc(base64Url);
      else if (viewTarget === 'SIDE') setSideViewSrc(base64Url);

      setStatusMessage(`Pasted ${viewTarget} View image. Click "Extract Tri-View Dimensions" to run AI OCR.`);
    };

    reader.readAsDataURL(file);
  };

  const handleRunTriViewExtraction = async () => {
    if (!frontViewSrc && !topViewSrc && !sideViewSrc) {
      setStatusMessage('Please paste or upload at least 1 view image first.');
      return;
    }

    setIsExtracting(true);
    setStatusMessage(`${getSelectedModel().name} analyzing Front, Top & Side view drawing images...`);

    try {
      const extractedDims = await extractTriViewDimensionsFromDrawingImages(
        {
          frontViewBase64: frontViewSrc,
          topViewBase64: topViewSrc,
          sideViewBase64: sideViewSrc,
        },
        selectedComponentType
      );

      const newUploadedFile: UploadedDwgFile = {
        filename: `TriView_${selectedComponentType}_Drawing.dwg`,
        fileSizeKb: 512,
        componentType: selectedComponentType,
        uploadedAt: new Date().toLocaleTimeString(),
        extractedDimensions: extractedDims,
        imageUrl: frontViewSrc || SHELL_DRAWING_IMAGE_URL,
        frontViewImageUrl: frontViewSrc || undefined,
        topViewImageUrl: topViewSrc || undefined,
        sideViewImageUrl: sideViewSrc || undefined,
        extractionModel: getSelectedModel().name,
        boundingWidthMm: 2580,
        boundingHeightMm: 1365,
      };

      onSelectFile(newUploadedFile);
      const w = lastExtractionWarnings.length ? ` Note: ${lastExtractionWarnings.join(' | ')}` : '';
      setStatusMessage(`Extracted ${extractedDims.length} dimensions from the pasted views with ${getSelectedModel().name}.${w}`);
    } catch (err: any) {
      console.error('Tri-view extraction error:', err);
      setStatusMessage(`Extraction failed with ${getSelectedModel().name}: ${err?.message || 'unknown error'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
            STEP 1 OF 4
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <Clipboard className="w-5 h-5 text-amber-500" />
            Paste 3 Orthographic View Drawings (Front View, Top View, Side View)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click on a view card below and press <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">Ctrl+V</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">Cmd+V</kbd> to paste that specific view image directly from your clipboard!
          </p>
        </div>

        {uploadedFile && (
          <button
            onClick={onNextStep}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Proceed to Step 2</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Component Type Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
          Component Category for Tri-View Drawings:
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setSelectedComponentType('SHELL_MECHANICAL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
              selectedComponentType === 'SHELL_MECHANICAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block">Shell (Mechanical)</span>
              <span className="text-[10px] text-slate-400 block">Outer casing & flanges</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedComponentType('CHOCK_ELECTRICAL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
              selectedComponentType === 'CHOCK_ELECTRICAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block">Chock (Electrical)</span>
              <span className="text-[10px] text-slate-400 block">Silicon steel yoke pack</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedComponentType('CRUCIBLE_THERMAL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
              selectedComponentType === 'CRUCIBLE_THERMAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block">Crucible (Thermal)</span>
              <span className="text-[10px] text-slate-400 block">Melt bath & refractory</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedComponentType('COIL_ASSEMBLY')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
              selectedComponentType === 'COIL_ASSEMBLY'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block">Coil Assembly</span>
              <span className="text-[10px] text-slate-400 block">Copper turns & pitch</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3 ORTHOGRAPHIC VIEW DROPZONES / PASTE TARGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* VIEW 1: FRONT VIEW */}
        <div
          onClick={() => { setActiveSet('GIVEN'); setActiveTargetView('FRONT'); }}
          className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative cursor-pointer ${
            (activeSet === 'GIVEN' && activeTargetView === 'FRONT')
              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImagePasteOrDrop(e.target.files[0], 'FRONT')}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="space-y-2 pointer-events-none">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-800">
              <span>1. FRONT ELEVATION VIEW</span>
              {(activeSet === 'GIVEN' && activeTargetView === 'FRONT') && (
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                  Active Paste Target
                </span>
              )}
            </div>

            {frontViewSrc ? (
              <div className="relative border rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                <img src={frontViewSrc} alt="Front View" className="max-h-[130px] object-contain" />
              </div>
            ) : (
              <div className="py-6 text-slate-400 space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
                <span className="text-xs block font-bold text-slate-600 dark:text-slate-300">Click & Press Ctrl+V</span>
                <span className="text-[10px] text-slate-400 block">Paste Front Elevation View</span>
              </div>
            )}
          </div>
        </div>

        {/* VIEW 2: TOP PLAN VIEW */}
        <div
          onClick={() => { setActiveSet('GIVEN'); setActiveTargetView('TOP'); }}
          className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative cursor-pointer ${
            (activeSet === 'GIVEN' && activeTargetView === 'TOP')
              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImagePasteOrDrop(e.target.files[0], 'TOP')}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="space-y-2 pointer-events-none">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-800">
              <span>2. TOP PLAN VIEW</span>
              {(activeSet === 'GIVEN' && activeTargetView === 'TOP') && (
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                  Active Paste Target
                </span>
              )}
            </div>

            {topViewSrc ? (
              <div className="relative border rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                <img src={topViewSrc} alt="Top View" className="max-h-[130px] object-contain" />
              </div>
            ) : (
              <div className="py-6 text-slate-400 space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
                <span className="text-xs block font-bold text-slate-600 dark:text-slate-300">Click & Press Ctrl+V</span>
                <span className="text-[10px] text-slate-400 block">Paste Top Plan View</span>
              </div>
            )}
          </div>
        </div>

        {/* VIEW 3: SIDE VIEW */}
        <div
          onClick={() => { setActiveSet('GIVEN'); setActiveTargetView('SIDE'); }}
          className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative cursor-pointer ${
            (activeSet === 'GIVEN' && activeTargetView === 'SIDE')
              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleImagePasteOrDrop(e.target.files[0], 'SIDE')}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="space-y-2 pointer-events-none">
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-800">
              <span>3. SIDE PROJECTION VIEW</span>
              {(activeSet === 'GIVEN' && activeTargetView === 'SIDE') && (
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-mono font-bold">
                  Active Paste Target
                </span>
              )}
            </div>

            {sideViewSrc ? (
              <div className="relative border rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                <img src={sideViewSrc} alt="Side View" className="max-h-[130px] object-contain" />
              </div>
            ) : (
              <div className="py-6 text-slate-400 space-y-1">
                <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
                <span className="text-xs block font-bold text-slate-600 dark:text-slate-300">Click & Press Ctrl+V</span>
                <span className="text-[10px] text-slate-400 block">Paste Side Projection View</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* size of the furnace drawn in the given image (used as the "given" point in Step 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-950/40">
        {(
          [
            ['Base image size (capacity)', 'Tons', 'e.g. 10', capText, setCapText, 'capacity'],
            ['Base image power', 'MW', 'e.g. 6', powText, setPowText, 'power'],
          ] as const
        ).map(([label, unit, ph, text, setText, field]) => (
          <div key={field} className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{label}</span>
              <span className="font-mono text-[11px] text-slate-500">{unit}</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder={ph}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) onChangeGiven({ [field]: v });
              }}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        ))}
        <p className="sm:col-span-2 text-[11px] text-slate-500 dark:text-slate-400">
          The capacity and power of the furnace shown in the base three views. Target values in Step 2 are calculated from this size to the required tonnage
          (the value stays at the last valid number if a box is left empty).
        </p>
      </div>

      {/* Action Button: Extract All Tri-View Dimensions */}
      <div className="pt-2">
        <button
          onClick={handleRunTriViewExtraction}
          disabled={isExtracting}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isExtracting ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 fill-current" />
          )}
          <span>{isExtracting ? `${activeModel.name} Analyzing Tri-View Drawings...` : `Extract All Tri-View Dimensions with ${activeModel.name}`}</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* REFERENCE IMAGE SET: a second furnace drawing (front / top / side) used to convert the given dimensions */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-slate-50/60 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Reference image and its three views (optional)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-3xl">
              A drawing of a furnace of a different size. Its dimensions appear between <b>Base</b> and <b>Target</b> in Step 2, and
              the required dimensions are then converted <b>only</b> from the base drawing and this reference drawing. Click a card, then press Ctrl+V.
            </p>
          </div>
          {(referenceSet.frontViewImageUrl || referenceSet.topViewImageUrl || referenceSet.sideViewImageUrl || referenceSet.extractedDimensions.length > 0) && (
            <button onClick={clearReference} className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              Clear reference
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {refCards.map((c) => {
            const active = activeSet === 'REFERENCE' && activeTargetView === c.view;
            return (
              <div
                key={c.view}
                onClick={() => {
                  setActiveSet('REFERENCE');
                  setActiveTargetView(c.view);
                }}
                className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative cursor-pointer ${
                  active
                    ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-slate-400'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleReferenceImage(e.target.files[0], c.view)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="space-y-2 pointer-events-none">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white pb-1 border-b border-slate-200 dark:border-slate-800">
                    <span>{c.title}</span>
                    {active && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded font-mono font-bold">Active Paste Target</span>}
                  </div>
                  {c.src ? (
                    <div className="relative border rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                      <img src={c.src} alt={`Reference ${c.view} view`} className="max-h-[130px] object-contain" />
                    </div>
                  ) : (
                    <div className="py-6 text-slate-400 space-y-1">
                      <ImageIcon className="w-8 h-8 mx-auto text-slate-400" />
                      <span className="text-xs block font-bold text-slate-600 dark:text-slate-300">Click &amp; Press Ctrl+V</span>
                      <span className="text-[10px] text-slate-400 block">Reference {c.view.toLowerCase()} view</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* what the user has to tell us about the reference furnace (never assumed) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference image size (capacity)</span>
              <span className="font-mono text-[11px] text-slate-500">Tons</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 25"
              value={referenceSet.capacityT ?? ''}
              onChange={(e) => onChangeReferenceSet({ capacityT: e.target.value === '' ? null : parseFloat(e.target.value) })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Reference image power</span>
              <span className="font-mono text-[11px] text-slate-500">MW</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 15"
              value={referenceSet.powerMW ?? ''}
              onChange={(e) => onChangeReferenceSet({ powerMW: e.target.value === '' ? null : parseFloat(e.target.value) })}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleExtractReference}
            disabled={isExtractingRef}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isExtractingRef ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isExtractingRef ? 'Reading reference views...' : `Extract reference dimensions (${activeModel.name})`}</span>
          </button>
        </div>

        {(referenceSet.capacityT === null || referenceSet.powerMW === null) && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Enter the capacity and the power of the furnace drawn in the reference images. Nothing is assumed for them, and without them the required
            dimensions cannot be converted.
          </p>
        )}

        {refStatus && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
            <span>{refStatus}</span>
          </div>
        )}
        {referenceSet.extractedDimensions.length > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {referenceSet.extractedDimensions.length} reference dimensions are loaded
            {referenceSet.extractionModel ? ` (read by ${referenceSet.extractionModel})` : ''}.
          </p>
        )}
      </div>

    </div>
  );
};
