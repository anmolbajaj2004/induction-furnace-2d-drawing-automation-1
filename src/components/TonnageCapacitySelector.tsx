import React from 'react';
import { FurnaceInputs, DimensionalConstraint } from '../types/furnace';
import { ShellResult } from '../utils/shellModel';
import { Gauge, Lock, Unlock, ArrowUpDown, ArrowLeftRight } from 'lucide-react';

export const STANDARD_TONNAGES = [1, 2, 3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60];

interface TonnageCapacitySelectorProps {
  inputs: FurnaceInputs;
  shell: ShellResult;
  onSelectTonnage: (tons: number) => void;
  onChangeInput: (key: keyof FurnaceInputs, value: any) => void;
}

export const TonnageCapacitySelector: React.FC<TonnageCapacitySelectorProps> = ({
  inputs,
  shell,
  onSelectTonnage,
  onChangeInput,
}) => {
  const constraint: DimensionalConstraint = inputs.dimensionalConstraint || 'NONE';
  const kwPerTon = inputs.baselineCapacity > 0 ? (inputs.baselinePower * 1000) / inputs.baselineCapacity : 0;
  const targetKwPerTon = inputs.targetCapacity > 0 ? (inputs.targetPower * 1000) / inputs.targetCapacity : 0;
  const same = Math.abs(inputs.targetCapacity - inputs.baselineCapacity) < 1e-9;

  const options: { id: DimensionalConstraint; label: string; hint: string; icon: React.ReactNode }[] = [
    { id: 'NONE', label: 'Free scaling', hint: 'Height and width both grow', icon: <Unlock className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: 'LOCK_HEIGHT', label: 'Lock height', hint: 'Keep overall height, widen shell', icon: <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" /> },
    { id: 'LOCK_WIDTH', label: 'Lock width', hint: 'Keep width, make shell taller', icon: <ArrowLeftRight className="w-3.5 h-3.5 text-amber-500" /> },
  ];

  return (
    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
            Select Target Tonnage &amp; Capacity
          </h3>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
          Base drawing: {inputs.baselineCapacity} t / {inputs.baselinePower} MW &nbsp;→&nbsp; Target:{' '}
          <span className="text-emerald-600 dark:text-emerald-400">
            {inputs.targetCapacity} t / {inputs.targetPower} MW
          </span>
        </span>
      </div>

      {/* Tonnage chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Furnace tonnage (melt capacity, tons)</span>
        <div className="flex flex-wrap gap-1.5">
          {STANDARD_TONNAGES.map((t) => {
            const active = Math.abs(inputs.targetCapacity - t) < 1e-9;
            const isRef = Math.abs(inputs.baselineCapacity - t) < 1e-9;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onSelectTonnage(t)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-sm'
                    : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                }`}
                title={isRef ? 'Tonnage of the Base drawing' : undefined}
              >
                {t} t{isRef ? ' ●' : ''}
              </button>
            );
          })}
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">● = tonnage of the drawing you pasted</span>
      </div>

      {/* Custom inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Target capacity (custom)</span>
            <span className="font-mono text-[11px] text-slate-500">Tons</span>
          </label>
          <input
            type="number"
            min="0.5"
            max="100"
            step="0.5"
            value={inputs.targetCapacity}
            onChange={(e) => onSelectTonnage(parseFloat(e.target.value) || 0)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Target power</span>
            <span className="font-mono text-[11px] text-slate-500">MW</span>
          </label>
          <input
            type="number"
            min="0.1"
            max="50"
            step="0.1"
            value={inputs.targetPower}
            onChange={(e) => onChangeInput('targetPower', parseFloat(e.target.value) || 0)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
            Auto-set at the drawing's {kwPerTon.toFixed(0)} kW/t on tonnage change · now {targetKwPerTon.toFixed(0)} kW/t
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Dimensional restriction</span>
          </label>
          <select
            value={constraint}
            onChange={(e) => onChangeInput('dimensionalConstraint', e.target.value as DimensionalConstraint)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {o.hint}
              </option>
            ))}
            {constraint === 'CUSTOM_MAX_HEIGHT' && <option value="CUSTOM_MAX_HEIGHT">Custom max height (set in Step 3)</option>}
            {constraint === 'CUSTOM_MAX_WIDTH' && <option value="CUSTOM_MAX_WIDTH">Custom max width (set in Step 3)</option>}
            {constraint === 'LOCK_REFRACTORY' && <option value="LOCK_REFRACTORY">Lock refractory (no shell effect)</option>}
          </select>
        </div>
      </div>

      {/* Scale summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
        {[
          { k: 'Tonnage ratio', v: `${shell.scaling.ratio.toFixed(3)}x` },
          { k: 'Width scale', v: `${shell.scaling.sD.toFixed(3)}x` },
          { k: 'Height scale', v: `${shell.scaling.sH.toFixed(3)}x` },
          { k: 'Plate scale', v: `${shell.scaling.sT.toFixed(3)}x` },
          { k: 'Dims changed', v: same ? 'none (same tonnage)' : `${shell.changedCount} of ${shell.dims.length}` },
        ].map((c) => (
          <div key={c.k} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">{c.k}</div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">{c.v}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">{shell.scaling.note}</p>
    </div>
  );
};

