import React from 'react';
import { FurnaceInputs, CalculationResults, DxfModSchema } from '../types/furnace';
import { downloadTextFile, generateAutoLispScript, generateAutoCadCommandScript, generateDxfTextSnippet } from '../utils/cadGenerators';
import { X, Download, FileCode, Terminal, FileText, Printer, CheckCircle2 } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: FurnaceInputs;
  results: CalculationResults;
  schema: DxfModSchema;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  inputs,
  results,
  schema,
}) => {
  if (!isOpen) return null;

  const handleDownloadJson = () => {
    downloadTextFile(JSON.stringify(schema, null, 2), `furnace_dxf_mod_${inputs.targetCapacity}T.json`, 'application/json');
  };

  const handleDownloadLisp = () => {
    downloadTextFile(generateAutoLispScript(inputs, results), `furnace_update_${inputs.targetCapacity}T.lsp`, 'text/plain');
  };

  const handleDownloadScript = () => {
    downloadTextFile(generateAutoCadCommandScript(inputs, results), `furnace_draw_${inputs.targetCapacity}T.scr`, 'text/plain');
  };

  const handleDownloadDxf = () => {
    downloadTextFile(generateDxfTextSnippet(inputs, results), `furnace_entities_${inputs.targetCapacity}T.dxf`, 'text/plain');
  };

  const handlePrintSpecSheet = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-amber-500" />
              Export CAD & Engineering Package
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Target Capacity: {inputs.targetCapacity} Tons | Target Power: {inputs.targetPower} MW
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Options List */}
        <div className="space-y-3">
          
          {/* JSON DXF Mod Schema */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">DXF Mod Schema (.json)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Structured CAD layer modifications for AutoCAD automation</span>
              </div>
            </div>
            <button
              onClick={handleDownloadJson}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Download
            </button>
          </div>

          {/* AutoLISP Executable Script */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">AutoLISP Automation (.lsp)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Executable script for APPLOAD in AutoCAD to modify blocks</span>
              </div>
            </div>
            <button
              onClick={handleDownloadLisp}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Download
            </button>
          </div>

          {/* AutoCAD Command Script */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">AutoCAD Batch Script (.scr)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Command script to redraft geometry and layers</span>
              </div>
            </div>
            <button
              onClick={handleDownloadScript}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Download
            </button>
          </div>

          {/* DXF Entities Snippet */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">DXF R2020 Entities (.dxf)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Directly importable DXF geometry section</span>
              </div>
            </div>
            <button
              onClick={handleDownloadDxf}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Download
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handlePrintSpecSheet}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Specification Sheet</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
