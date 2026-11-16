import React, { useState } from 'react';
import { DxfModSchema } from '../types/furnace';
import { Copy, Download, Check, FileCode, Play, Sparkles } from 'lucide-react';
import { downloadTextFile } from '../utils/cadGenerators';

interface CodeOutputWindowProps {
  schema: DxfModSchema;
  onGenerateSchema: () => void;
  isGenerating?: boolean;
}

export const CodeOutputWindow: React.FC<CodeOutputWindowProps> = ({
  schema,
  onGenerateSchema,
  isGenerating = false,
}) => {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(schema, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadTextFile(jsonString, `furnace_dxf_mod_${schema.engineering_summary.capacity_tons}T.json`, 'application/json');
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4 shadow-sm text-slate-100">
      
      {/* Output Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            CAD Drawing Modification Schema (JSON)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Copy JSON to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
          </button>

          {/* Download JSON Button */}
          <button
            onClick={handleDownload}
            className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors flex items-center gap-1.5"
            title="Download JSON File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .json</span>
          </button>

        </div>
      </div>

      {/* Code Display Area */}
      <div className="relative">
        <pre className="w-full h-[360px] overflow-auto bg-slate-950 p-4 rounded-lg border border-slate-800/80 font-mono text-xs text-amber-300/90 leading-relaxed selection:bg-amber-500/30">
          <code>{jsonString}</code>
        </pre>
      </div>

      {/* Primary Action Button Required by Prompt */}
      <div className="pt-2">
        <button
          onClick={onGenerateSchema}
          disabled={isGenerating}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-lg shadow-md hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] disabled:opacity-60"
        >
          {isGenerating ? (
            <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>Generate DXF Mod Schema</span>
        </button>
      </div>

    </div>
  );
};
