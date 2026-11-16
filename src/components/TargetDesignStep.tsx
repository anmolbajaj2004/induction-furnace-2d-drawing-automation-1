import React from 'react';
import { FurnaceInputs, DimensionalConstraint } from '../types/furnace';
import { Zap, ArrowRight, ArrowLeft, Lock, Unlock, ShieldAlert, ArrowUpDown, ArrowLeftRight, HardDrive } from 'lucide-react';

interface TargetDesignStepProps {
  inputs: FurnaceInputs;
  onChangeInput: (key: keyof FurnaceInputs, value: any) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  lockProportions: boolean;
  onToggleLockProportions: () => void;
  onQuickScaleTarget: (multiplier: number) => void;
}

export const TargetDesignStep: React.FC<TargetDesignStepProps> = ({
  inputs,
  onChangeInput,
  onNextStep,
  onPrevStep,
  lockProportions,
  onToggleLockProportions,
  onQuickScaleTarget,
}) => {
  const capRatio = (inputs.targetCapacity / (inputs.baselineCapacity || 1)).toFixed(2);
  const powerRatio = (inputs.targetPower / (inputs.baselinePower || 1)).toFixed(2);
  const currentConstraint: DimensionalConstraint = inputs.dimensionalConstraint || 'NONE';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      
      {/* Step Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
            STEP 3 OF 4
          </span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <Zap className="w-5 h-5 text-amber-500" />
            Target Design Parameters & Dimensional Restrictions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Specify desired capacity/power ratings and lock overall height or width dimensions to reference drawing limits.
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
            <span>Calculate Assembly Dimensions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Operating Parameters Card */}
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Target Scale Factor:
          </span>

          <div className="flex items-center gap-2">
            {[1.25, 1.5, 2.0, 2.5].map((mult) => (
              <button
                key={mult}
                onClick={() => onQuickScaleTarget(mult)}
                className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                {mult}x Scale
              </button>
            ))}

            <button
              onClick={onToggleLockProportions}
              className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                lockProportions
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold'
                  : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {lockProportions ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{lockProportions ? 'Power Ratio Locked' : 'Power Ratio Unlocked'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Target Furnace Capacity
              </label>
              <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">
                {capRatio}x Capacity
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={inputs.targetCapacity}
                onChange={(e) => onChangeInput('targetCapacity', parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-3 top-2.5 font-mono text-xs text-slate-400">Tons</span>
            </div>

            <input
              type="range"
              min="1"
              max="60"
              step="0.5"
              value={inputs.targetCapacity}
              onChange={(e) => onChangeInput('targetCapacity', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white">
                Target Furnace Power
              </label>
              <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">
                {powerRatio}x Power
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.5"
                value={inputs.targetPower}
                onChange={(e) => onChangeInput('targetPower', parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-3 top-2.5 font-mono text-xs text-slate-400">MW</span>
            </div>

            <input
              type="range"
              min="0.5"
              max="35"
              step="0.5"
              value={inputs.targetPower}
              onChange={(e) => onChangeInput('targetPower', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

      </div>

      {/* DIMENSIONAL ENVELOPE RESTRICTIONS PANEL (NEW FEATURE) */}
      <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
              Define Dimensional Restrictions (Fixed Envelope Limits)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 font-bold">
            Parametric Volume Re-balancing
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          {/* Restriction Option 1: None */}
          <button
            type="button"
            onClick={() => onChangeInput('dimensionalConstraint', 'NONE')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentConstraint === 'NONE'
                ? 'bg-amber-500/20 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Unlock className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold block">Free 3D Volumetric Scaling</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              No envelope limits. Both Height & Diameter expand proportionally.
            </span>
          </button>

          {/* Restriction Option 2: Lock Height */}
          <button
            type="button"
            onClick={() => onChangeInput('dimensionalConstraint', 'LOCK_HEIGHT')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentConstraint === 'LOCK_HEIGHT'
                ? 'bg-amber-500/20 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40 font-bold'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpDown className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold block">Lock Overall Height</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Height restricted to {inputs.baselineCrucibleHeight} mm. Diameter expands to satisfy volume.
            </span>
          </button>

          {/* Restriction Option 3: Lock Width / Diameter */}
          <button
            type="button"
            onClick={() => onChangeInput('dimensionalConstraint', 'LOCK_WIDTH')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              currentConstraint === 'LOCK_WIDTH'
                ? 'bg-amber-500/20 border-amber-500 text-slate-900 dark:text-white ring-2 ring-amber-500/40 font-bold'
                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold block">Lock Overall Width / Diameter</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Inner Diameter restricted to {inputs.baselineInnerDiameter} mm. Height increases to satisfy volume.
            </span>
          </button>

        </div>

        {/* Custom Limit Numeric Inputs */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-amber-500/20">
          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Max Crane Height Limit:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="e.g. 1500"
                value={inputs.customMaxHeightMm || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChangeInput('customMaxHeightMm', val);
                  if (val > 0) onChangeInput('dimensionalConstraint', 'CUSTOM_MAX_HEIGHT');
                }}
                className="w-24 text-right bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold"
              />
              <span className="text-[10px] font-mono text-slate-400">mm</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Max Pit Width Limit:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="e.g. 2000"
                value={inputs.customMaxWidthMm || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChangeInput('customMaxWidthMm', val);
                  if (val > 0) onChangeInput('dimensionalConstraint', 'CUSTOM_MAX_WIDTH');
                }}
                className="w-24 text-right bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold"
              />
              <span className="text-[10px] font-mono text-slate-400">mm</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
