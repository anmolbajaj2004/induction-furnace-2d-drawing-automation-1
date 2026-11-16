import React, { useState } from 'react';
import { UploadedDwgFile, ComponentType } from '../types/furnace';
import { parseDxfOrDwgContent, getSampleDwgFile } from '../utils/dwgParser';
import { FileUp, FileCode, CheckCircle2, Layers, Cpu, Flame, Zap, ArrowRight, HardDrive } from 'lucide-react';

interface DwgUploaderStepProps {
  uploadedFile: UploadedDwgFile | null;
  onSelectFile: (file: UploadedDwgFile) => void;
  onNextStep: () => void;
}

export const DwgUploaderStep: React.FC<DwgUploaderStepProps> = ({
  uploadedFile,
  onSelectFile,
  onNextStep,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    if (!file) return;

    const fileName = file.name;
    const fileSizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const parsed = parseDxfOrDwgContent(fileName, content, fileSizeKb);
      onSelectFile(parsed);
    };
    reader.onerror = () => {
      setUploadError('Could not read CAD file. Using simulated DWG geometry parser.');
      // Fallback
      const fallback = parseDxfOrDwgContent(fileName, '', fileSizeKb);
      onSelectFile(fallback);
    };

    if (fileName.toLowerCase().endsWith('.dxf') || fileName.toLowerCase().endsWith('.dwg') || fileName.toLowerCase().endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
            STEP 1 OF 4
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <FileUp className="w-5 h-5 text-amber-500" />
            Upload Existing AutoCAD DWG Drawing
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select or upload an existing component drawing file (Shell, Chock / Yoke, Crucible, or Induction Coil).
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

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${
          isDragging
            ? 'border-amber-500 bg-amber-500/10'
            : uploadedFile
            ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-amber-500/60'
        }`}
      >
        <input
          type="file"
          accept=".dwg,.dxf,.txt"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        <div className="space-y-3 pointer-events-none">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
            {uploadedFile ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <FileUp className="w-6 h-6" />}
          </div>

          {uploadedFile ? (
            <div>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                ✓ CAD Drawing Loaded: {uploadedFile.filename} ({uploadedFile.fileSizeKb} KB)
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Type: {uploadedFile.componentType.replace('_', ' ')} · Extracted {uploadedFile.extractedDimensions.length} dimension keys
              </span>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Drag & Drop .DWG / .DXF File Here
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supports AutoCAD drawing files (.dwg, .dxf) for Mechanical Shells, Electrical Yokes, Crucibles, & Coils
              </p>
            </div>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-lg">
          {uploadError}
        </div>
      )}

      {/* Pre-Loaded Reference Sample DWG Drawings */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
          Or Select a Reference Component Drawing from Sample Library:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Mechanical Shell */}
          <button
            onClick={() => onSelectFile(getSampleDwgFile('SHELL_MECHANICAL'))}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              uploadedFile?.componentType === 'SHELL_MECHANICAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold block">Shell (Mechanical)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              FURNACE_SHELL_MECH_10T.dwg
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Outer casing, top flange, trunnion shafts
            </span>
          </button>

          {/* Electrical Chock */}
          <button
            onClick={() => onSelectFile(getSampleDwgFile('CHOCK_ELECTRICAL'))}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              uploadedFile?.componentType === 'CHOCK_ELECTRICAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold block">Chock (Electrical)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              ELECTRICAL_YOKE_CHOCK_10T.dwg
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Silicon steel yoke stack, cooling channels
            </span>
          </button>

          {/* Crucible Refractory */}
          <button
            onClick={() => onSelectFile(getSampleDwgFile('CRUCIBLE_THERMAL'))}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              uploadedFile?.componentType === 'CRUCIBLE_THERMAL'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold block">Crucible (Thermal)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              CRUCIBLE_REFRACTORY_10T.dwg
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Melt cavity, refractory wall, spout
            </span>
          </button>

          {/* Induction Coil */}
          <button
            onClick={() => onSelectFile(getSampleDwgFile('COIL_ASSEMBLY'))}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              uploadedFile?.componentType === 'COIL_ASSEMBLY'
                ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold block">Coil Assembly</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
              INDUCTION_COIL_COOLING_10T.dwg
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              Copper turns, pitch, water cooling ports
            </span>
          </button>

        </div>
      </div>

    </div>
  );
};
