import React, { useState } from 'react';
import { FurnaceInputs, CalculationResults } from '../types/furnace';
import { generateAutoLispScript, generateAutoCadCommandScript, generateDxfTextSnippet, downloadTextFile } from '../utils/cadGenerators';
import { Copy, Download, Check, Code, FileText, Terminal } from 'lucide-react';

interface AutoLispWindowProps {
  inputs: FurnaceInputs;
  results: CalculationResults;
}

export const AutoLispWindow: React.FC<AutoLispWindowProps> = ({ inputs, results }) => {
  const [activeFormat, setActiveFormat] = useState<'lisp' | 'script' | 'dxf'>('lisp');
  const [copied, setCopied] = useState(false);

  const lispCode = generateAutoLispScript(inputs, results);
  const scriptCode = generateAutoCadCommandScript(inputs, results);
  const dxfSnippet = generateDxfTextSnippet(inputs, results);

  const activeCode = activeFormat === 'lisp' ? lispCode : activeFormat === 'script' ? scriptCode : dxfSnippet;
  const fileExt = activeFormat === 'lisp' ? 'lsp' : activeFormat === 'script' ? 'scr' : 'dxf';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadTextFile(activeCode, `furnace_mod_${inputs.targetCapacity}T.${fileExt}`, 'text/plain');
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4 shadow-sm text-slate-100">
      
      {/* Format Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveFormat('lisp')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
              activeFormat === 'lisp' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            AutoLISP (.LSP)
          </button>
          <button
            onClick={() => setActiveFormat('script')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
              activeFormat === 'script' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            AutoCAD Script (.SCR)
          </button>
          <button
            onClick={() => setActiveFormat('dxf')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
              activeFormat === 'dxf' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            DXF Entities (.DXF)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .{fileExt}</span>
          </button>
        </div>

      </div>

      {/* Code Editor Frame */}
      <pre className="w-full h-[360px] overflow-auto bg-slate-950 p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-emerald-300/90 leading-relaxed selection:bg-emerald-500/30">
        <code>{activeCode}</code>
      </pre>

      {/* Usage Guide */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
        <Terminal className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-slate-300 block">How to run in AutoCAD:</span>
          {activeFormat === 'lisp' && (
            <span>
              1. Type <code className="text-amber-300 bg-slate-800 px-1 rounded">APPLOAD</code> in AutoCAD and load this <code className="text-emerald-300">.lsp</code> file.<br />
              2. Type <code className="text-amber-300 bg-slate-800 px-1 rounded">UPDATE_FURNACE_2D</code> in the command line to modify dynamic block attributes automatically.
            </span>
          )}
          {activeFormat === 'script' && (
            <span>
              1. Save as <code className="text-emerald-300">furnace_draw.scr</code>.<br />
              2. Drag and drop into AutoCAD viewport, or type <code className="text-amber-300 bg-slate-800 px-1 rounded">SCRIPT</code>.
            </span>
          )}
          {activeFormat === 'dxf' && (
            <span>
              Directly import into AutoCAD using <code className="text-amber-300 bg-slate-800 px-1 rounded">DXFIN</code> or open with any CAD software (SolidWorks, QCAD, LibreCAD).
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
