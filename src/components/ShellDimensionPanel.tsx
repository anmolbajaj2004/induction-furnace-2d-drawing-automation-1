import React, { useState } from 'react';
import { ShellResult, SHELL_GROUPS, ShellDimension, formatDim, shellDimsToCsv } from '../utils/shellModel';
import { ShellDrawing, ShellDrawingMode } from './ShellDrawing';
import type { PlanShape } from './ShellViewDrawing';
import { Ruler, Download, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface ShellDimensionPanelProps {
  shell: ShellResult;
}

const signed = (v: number, decimals = 0) => `${v > 0 ? '+' : ''}${formatDim(v, decimals)}`;

export const ShellDimensionPanel: React.FC<ShellDimensionPanelProps> = ({ shell }) => {
  const [mode, setMode] = useState<ShellDrawingMode>('overlay');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [view, setView] = useState<'FRONT' | 'TOP' | 'SIDE'>('FRONT');
  const [plan, setPlan] = useState<PlanShape>('square');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const refT = shell.refCapacity;
  const reqT = shell.targetCapacity;

  const headline = ['flange', 'h_total', 'top_inner', 'cavity', 'base_w'].map((id) => shell.dims.find((d) => d.id === id)!);

  const handleCsv = () => {
    const blob = new Blob([shellDimsToCsv(shell)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SHELL_dimensions_${refT}T_to_${reqT}T.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modes: { id: ShellDrawingMode; label: string }[] = [
    { id: 'overlay', label: `Required ${reqT} t + reference outline` },
    { id: 'required', label: `Required ${reqT} t only` },
    { id: 'reference', label: `Reference ${refT} t (as given)` },
  ];

  const row = (d: ShellDimension) => (
    <tr
      key={d.id}
      onMouseEnter={() => setHoveredId(d.id)}
      onMouseLeave={() => setHoveredId(null)}
      className={
        hoveredId === d.id
          ? 'bg-blue-500/20 dark:bg-blue-500/25'
          : d.changed
          ? 'bg-amber-500/10 dark:bg-amber-500/10'
          : 'hover:bg-slate-50 dark:hover:bg-slate-950/60'
      }
    >
      <td className="px-3 py-2 font-sans font-semibold text-slate-900 dark:text-white">{d.label}</td>
      <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
        {formatDim(d.ref, d.decimals)} <span className="text-[10px] text-slate-400">{d.unit}</span>
      </td>
      <td className={`px-3 py-2 text-right font-mono font-bold ${d.changed ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
        {formatDim(d.value, d.decimals)} <span className="text-[10px] font-normal text-slate-400">{d.unit}</span>
      </td>
      <td className={`px-3 py-2 text-right font-mono ${d.changed ? (d.delta > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400') : 'text-slate-400'}`}>
        {d.changed ? signed(d.delta, d.decimals) : '—'}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${d.changed ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
        {d.changed ? `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}%` : '—'}
      </td>
      <td className="px-3 py-2 font-sans text-[11px] text-slate-500 dark:text-slate-400">{d.rule}</td>
    </tr>
  );

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ruler className="w-4 h-4 text-amber-500" />
            Shell Dimension Changes — Reference {refT} t → Required {reqT} t
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every dimension needed to fabricate the shell, recalculated for the selected tonnage. Changed values are highlighted.
          </p>
        </div>
        <button
          onClick={handleCsv}
          className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download dimension sheet (CSV)</span>
        </button>
      </div>

      {/* Headline before / after */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {headline.map((d) => (
          <div key={d.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold truncate">{d.label}</div>
            <div className="flex items-center gap-1.5 font-mono mt-0.5">
              <span className="text-xs text-slate-500">{formatDim(d.ref)}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className={`text-base font-bold ${d.changed ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{formatDim(d.value)}</span>
              <span className="text-[10px] text-slate-400">mm</span>
            </div>
            <div className={`text-[11px] font-mono ${d.changed ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
              {d.changed ? `${signed(d.delta)} mm (${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}%)` : 'no change'}
            </div>
          </div>
        ))}
      </div>

      {/* Drawing */}
      <div className="space-y-3">
        {/* which view of the parametric shell model */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {([
              ['FRONT', 'Front elevation'],
              ['TOP', 'Top plan'],
              ['SIDE', 'Side elevation'],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                  view === v ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-300 hover:text-amber-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === 'TOP' && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
              <span>Plan section:</span>
              {(['square', 'round'] as PlanShape[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className={`px-2 py-0.5 rounded border cursor-pointer ${
                    plan === p ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {p === 'square' ? 'Square (box shell)' : 'Round'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                mode === m.id
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ShellDrawing req={shell.req} ref0={shell.ref} mode={mode} refCapacity={refT} targetCapacity={reqT} view={view} plan={plan} />
      </div>

      {/* Integrity checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {shell.checks.map((c) => (
          <div
            key={c.label}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              c.ok
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300'
            }`}
          >
            {c.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>
              <div className="font-bold">{c.label}</div>
              <div className="font-mono text-[11px] opacity-80">{c.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Full dimension register */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Complete shell dimension register ({shell.dims.length} dimensions, {shell.changedCount} changed)
          </h4>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="accent-amber-500" />
            Show changed only
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-200">Dimension</th>
                <th className="px-3 py-3 font-semibold text-right">Reference ({refT} t)</th>
                <th className="px-3 py-3 font-semibold text-right text-amber-600 dark:text-amber-400">Required ({reqT} t)</th>
                <th className="px-3 py-3 font-semibold text-right">Change</th>
                <th className="px-3 py-3 font-semibold text-right">%</th>
                <th className="px-3 py-3 font-semibold">How it is calculated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {SHELL_GROUPS.map((grp) => {
                const rows = shell.dims.filter((d) => d.group === grp.id && (!onlyChanged || d.changed));
                if (rows.length === 0) return null;
                return (
                  <React.Fragment key={grp.id}>
                    <tr className="bg-slate-50 dark:bg-slate-950/80">
                      <td colSpan={6} className="px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {grp.title} <span className="font-normal text-slate-400">— {grp.note}</span>
                      </td>
                    </tr>
                    {rows.map(row)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
