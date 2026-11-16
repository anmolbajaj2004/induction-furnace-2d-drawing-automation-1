import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { DwgImagePasteUploader } from './components/DwgImagePasteUploader';
import { ReferenceSpecsStep } from './components/ReferenceSpecsStep';
import { TargetDesignStep } from './components/TargetDesignStep';
import { AssemblyBreakdownView } from './components/AssemblyBreakdownView';
import { ResultsSummaryCard } from './components/ResultsSummaryCard';
import { SchematicCanvas } from './components/SchematicCanvas';
import { CodeOutputWindow } from './components/CodeOutputWindow';
import { AutoLispWindow } from './components/AutoLispWindow';
import { AiEngineeringAssistant } from './components/AiEngineeringAssistant';
import { ExportModal } from './components/ExportModal';

import { FurnaceInputs, UploadedDwgFile, ExtractedDwgDimension, ReferenceSet } from './types/furnace';
import { FURNACE_PRESETS } from './data/presets';
import { getSampleDwgFile } from './utils/dwgParser';
import {
  calculateFurnaceScaling,
  generateDxfModSchema,
  evaluateEngineeringAlerts,
} from './utils/engineeringMath';
import { calculateAllComponentBreakdowns } from './utils/componentCalculators';
import { calculateShell } from './utils/shellModel';
import { Layers, Sliders, Terminal, Sparkles, CheckCircle2, Clipboard } from 'lucide-react';

export default function App() {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Workflow Step State (1: Paste Image, 2: Ref Specs & Extraction, 3: Target Specs, 4: New Dimensions)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Uploaded / Pasted DWG image state (defaults to sample Shell DWG)
  const [uploadedDwg, setUploadedDwg] = useState<UploadedDwgFile>(getSampleDwgFile('SHELL_MECHANICAL'));

  // Optional reference image set (front/top/side of a furnace of another size) used to convert dimensions.
  // Capacity and power are typed in by the user; nothing is assumed.
  const [referenceSet, setReferenceSet] = useState<ReferenceSet>({ capacityT: null, powerMW: null, extractedDimensions: [] });
  const handleChangeReferenceSet = (patch: Partial<ReferenceSet>) => setReferenceSet((prev) => ({ ...prev, ...patch }));

  // Default preset (10 Ton Standard Coreless Furnace)
  const defaultPreset = FURNACE_PRESETS[1];
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset.id);
  const [inputs, setInputs] = useState<FurnaceInputs>(defaultPreset.inputs);

  // Proportions locking (Power-to-Capacity ratio lock)
  const [lockProportions, setLockProportions] = useState(false);

  // Output View Tab
  const [activeTab, setActiveTab] = useState<'breakdown' | 'schematic' | 'json' | 'lisp' | 'ai'>('breakdown');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);

  // Dark Mode side effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Recalculate calculations whenever inputs change
  const results = useMemo(() => calculateFurnaceScaling(inputs), [inputs]);
  const shell = useMemo(() => calculateShell(inputs), [inputs]);
  const schema = useMemo(() => generateDxfModSchema(inputs, results), [inputs, results]);
  const alerts = useMemo(() => evaluateEngineeringAlerts(inputs, results), [inputs, results]);
  const assemblyGroups = useMemo(
    () => calculateAllComponentBreakdowns(inputs, results),
    [inputs, results]
  );

  // Input change handler
  const handleInputChange = (key: keyof FurnaceInputs, value: number) => {
    setInputs((prev) => {
      const updated = { ...prev, [key]: value };

      if (lockProportions && key === 'targetCapacity' && prev.baselineCapacity > 0) {
        const ratio = prev.baselinePower / prev.baselineCapacity;
        updated.targetPower = Number((value * ratio).toFixed(2));
      }

      return updated;
    });
  };

  // Tonnage selector (Step 2): sets required capacity and keeps the drawing's kW/t ratio for power
  const handleSelectTonnage = (tons: number) => {
    setInputs((prev) => {
      const ratio = prev.baselineCapacity > 0 ? prev.baselinePower / prev.baselineCapacity : 0;
      return {
        ...prev,
        targetCapacity: tons,
        targetPower: ratio > 0 ? Number((tons * ratio).toFixed(2)) : prev.targetPower,
      };
    });
  };

  // DWG File / Image selection handler
  const handleSelectDwgFile = (file: UploadedDwgFile) => {
    setUploadedDwg(file);

    // Sync baseline dimensions if extracted from user image
    const idDim = file.extractedDimensions.find((d) => d.key === 'innerCasingDiameter' || d.key === 'innerDiameter')?.valueMm;
    const hDim = file.extractedDimensions.find((d) => d.key === 'shellHeight' || d.key === 'crucibleHeight')?.valueMm;

    setInputs((prev) => ({
      ...prev,
      baselineInnerDiameter: idDim || prev.baselineInnerDiameter,
      baselineCrucibleHeight: hDim || prev.baselineCrucibleHeight,
    }));
  };

  // Update extracted dimensions directly
  const handleUpdateExtractedDimensions = (dims: ExtractedDwgDimension[]) => {
    setUploadedDwg((prev) => ({
      ...prev,
      extractedDimensions: dims,
    }));
  };

  // Preset Selection
  const handleSelectPreset = (preset: typeof defaultPreset) => {
    setSelectedPresetId(preset.id);
    setInputs(preset.inputs);
  };

  // Reset to default
  const handleReset = () => {
    const currentPreset = FURNACE_PRESETS.find((p) => p.id === selectedPresetId) || defaultPreset;
    setInputs(currentPreset.inputs);
  };

  // Quick Scaling Multiplier
  const handleQuickScaleTarget = (multiplier: number) => {
    setInputs((prev) => ({
      ...prev,
      targetCapacity: Number((prev.baselineCapacity * multiplier).toFixed(1)),
      targetPower: Number((prev.baselinePower * multiplier).toFixed(1)),
    }));
  };

  // Action Button Handler: "Generate DXF Mod Schema"
  const handleGenerateDxfSchema = () => {
    setIsGeneratingSchema(true);
    setActiveTab('json');
    setTimeout(() => {
      setIsGeneratingSchema(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Bar Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onReset={handleReset}
        activeTab={activeTab === 'breakdown' ? 'schematic' : activeTab}
        onChangeTab={(t) => setActiveTab(t)}
      />

      {/* Main Desktop Dashboard Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        
        {/* Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Induction Furnace Manufacturing 2D Drawing Automation
            </h1>
            <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Paste or upload any CAD DWG drawing snippet, extract dimensions in real-time with Gemini AI Vision, and calculate new scaled component designs.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-300/50 dark:border-slate-800">
            <span>Pasted Image:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {uploadedDwg.filename} ({uploadedDwg.extractedDimensions.length} Dims)
            </span>
          </div>
        </div>

        {/* 4-STEP CAD RE-ENGINEERING WORKFLOW WIZARD BAR */}
        <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            
            {/* Step 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentStep === 1
                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/30'
                  : currentStep > 1
                  ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs shrink-0">
                {currentStep > 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : '1'}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold block text-slate-400">Step 1</span>
                <span className="text-xs font-bold block truncate">1. Paste Drawing Image</span>
              </div>
            </button>

            {/* Step 2 */}
            <button
              onClick={() => setCurrentStep(2)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentStep === 2
                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/30'
                  : currentStep > 2
                  ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs shrink-0">
                {currentStep > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : '2'}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold block text-slate-400">Step 2</span>
                <span className="text-xs font-bold block truncate">2. Inspect Extracted Dims</span>
              </div>
            </button>

            {/* Step 3 */}
            <button
              onClick={() => setCurrentStep(3)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentStep === 3
                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/30'
                  : currentStep > 3
                  ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs shrink-0">
                {currentStep > 3 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : '3'}
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold block text-slate-400">Step 3</span>
                <span className="text-xs font-bold block truncate">3. Target Design Specs</span>
              </div>
            </button>

            {/* Step 4 */}
            <button
              onClick={() => setCurrentStep(4)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                currentStep === 4
                  ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/30'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-xs shrink-0">
                4
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold block text-slate-400">Step 4</span>
                <span className="text-xs font-bold block truncate">4. Component Assembly</span>
              </div>
            </button>

          </div>
        </div>

        {/* STEP-BY-STEP WORKFLOW RENDERING */}
        {currentStep === 1 && (
          <DwgImagePasteUploader
            uploadedFile={uploadedDwg}
            onSelectFile={(file) => {
              handleSelectDwgFile(file);
              setCurrentStep(2);
            }}
            onNextStep={() => setCurrentStep(2)}
            referenceSet={referenceSet}
            onChangeReferenceSet={handleChangeReferenceSet}
            givenCapacity={inputs.baselineCapacity}
            givenPower={inputs.baselinePower}
            onChangeGiven={({ capacity, power }) =>
              setInputs((prev) => ({
                ...prev,
                baselineCapacity: capacity ?? prev.baselineCapacity,
                baselinePower: power ?? prev.baselinePower,
              }))
            }
          />
        )}

        {currentStep === 2 && (
          <ReferenceSpecsStep
            referenceSet={referenceSet}
            uploadedFile={uploadedDwg}
            inputs={inputs}
            shell={shell}
            onSelectTonnage={handleSelectTonnage}
            onChangeInput={handleInputChange}
            onUpdateExtractedDimensions={handleUpdateExtractedDimensions}
            onNextStep={() => setCurrentStep(3)}
            onPrevStep={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <TargetDesignStep
            inputs={inputs}
            onChangeInput={handleInputChange}
            onNextStep={() => setCurrentStep(4)}
            onPrevStep={() => setCurrentStep(2)}
            lockProportions={lockProportions}
            onToggleLockProportions={() => setLockProportions(!lockProportions)}
            onQuickScaleTarget={handleQuickScaleTarget}
          />
        )}

        {/* STEP 4 & DASHBOARD OUTPUT PANELS */}
        {currentStep === 4 && (
          <div className="space-y-6">
            
            {/* Visual Engineering Summary Cards */}
            <ResultsSummaryCard inputs={inputs} results={results} alerts={alerts} />

            {/* View Selector Tabs */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-1 w-full overflow-x-auto no-scrollbar">
                
                <button
                  onClick={() => setActiveTab('breakdown')}
                  className={`flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'breakdown'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Assembly & Sub-Component Breakdown</span>
                </button>

                <button
                  onClick={() => setActiveTab('schematic')}
                  className={`flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'schematic'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2D Schematic Preview</span>
                </button>

                <button
                  onClick={() => setActiveTab('json')}
                  className={`flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'json'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>DXF Mod Schema (JSON)</span>
                </button>

                <button
                  onClick={() => setActiveTab('lisp')}
                  className={`flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'lisp'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>AutoLISP / SCR</span>
                </button>

                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 min-w-[140px] py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Diagnostics</span>
                </button>

              </div>
            </div>

            {/* Display Active Tab Content */}
            {activeTab === 'breakdown' && (
              <AssemblyBreakdownView assemblyGroups={assemblyGroups} />
            )}

            {activeTab === 'schematic' && (
              <SchematicCanvas inputs={inputs} results={results} />
            )}

            {activeTab === 'json' && (
              <CodeOutputWindow
                schema={schema}
                onGenerateSchema={handleGenerateDxfSchema}
                isGenerating={isGeneratingSchema}
              />
            )}

            {activeTab === 'lisp' && (
              <AutoLispWindow inputs={inputs} results={results} />
            )}

            {activeTab === 'ai' && (
              <AiEngineeringAssistant inputs={inputs} results={results} />
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto py-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">VULCAN Parametric Engine</span>
            <span>·</span>
            <span>DWG Image OCR & Dimension Scaling Automation</span>
            <span>·</span>
            <span>ISO 13584 / DXF R2020 Compliant</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Gemini AI Vision OCR Powered | Steel Density Constant = 7.1 t/m³
          </div>
        </div>
      </footer>

      {/* Export CAD Package Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        inputs={inputs}
        results={results}
        schema={schema}
      />

    </div>
  );
}
