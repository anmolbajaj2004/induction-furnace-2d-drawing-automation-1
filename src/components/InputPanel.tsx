import React from 'react';
import { FurnaceInputs } from '../types/furnace';
import { Sliders, RotateCcw, Lock, Unlock, Zap, Shield, Flame, Activity } from 'lucide-react';

interface InputPanelProps {
  inputs: FurnaceInputs;
  onChangeInput: (key: keyof FurnaceInputs, value: number) => void;
  onResetToDefault: () => void;
  lockProportions: boolean;
  onToggleLockProportions: () => void;
  onQuickScaleTarget: (multiplier: number) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  inputs,
  onChangeInput,
  onResetToDefault,
  lockProportions,
  onToggleLockProportions,
  onQuickScaleTarget,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-500" />
            Furnace Specification Inputs
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure baseline parameters and target scaling dimensions
          </p>
        </div>
        
        <button
          onClick={onResetToDefault}
          className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Reset values to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Target Specifications Section (Highlighted First for User Focus) */}
      <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-lg p-4 border border-amber-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              Target Scaling Specifications
            </h3>
          </div>
          
          {/* Quick Scaling Ratio Buttons */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">Scale:</span>
            {[1.25, 1.5, 2.0].map((mult) => (
              <button
                key={mult}
                onClick={() => onQuickScaleTarget(mult)}
                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 transition-colors"
                title={`Scale target capacity and power by ${mult}x baseline`}
              >
                {mult}x
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Target Capacity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Desired Capacity
              </label>
              <span className="font-mono text-slate-500 dark:text-slate-400">Tons</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={inputs.targetCapacity}
                onChange={(e) => onChangeInput('targetCapacity', parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <input
              type="range"
              min="1"
              max="60"
              step="0.5"
              value={inputs.targetCapacity}
              onChange={(e) => onChangeInput('targetCapacity', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Target Power */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Desired Power
              </label>
              <span className="font-mono text-slate-500 dark:text-slate-400">MW</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={inputs.targetPower}
                onChange={(e) => onChangeInput('targetPower', parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <input
              type="range"
              min="0.5"
              max="35"
              step="0.5"
              value={inputs.targetPower}
              onChange={(e) => onChangeInput('targetPower', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

        </div>
      </div>

      {/* Baseline Specifications Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            Baseline Furnace Specifications
          </h3>

          <button
            onClick={onToggleLockProportions}
            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
              lockProportions
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
            title="Lock power-to-capacity baseline ratio when updating target"
          >
            {lockProportions ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span className="text-[11px]">{lockProportions ? 'Ratio Locked' : 'Ratio Unlocked'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Baseline Capacity */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Baseline Capacity</span>
              <span className="font-mono text-[11px] text-slate-400">Tons</span>
            </label>
            <input
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={inputs.baselineCapacity}
              onChange={(e) => onChangeInput('baselineCapacity', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Baseline Power */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Baseline Power</span>
              <span className="font-mono text-[11px] text-slate-400">MW</span>
            </label>
            <input
              type="number"
              min="0.1"
              max="50"
              step="0.1"
              value={inputs.baselinePower}
              onChange={(e) => onChangeInput('baselinePower', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Operating Frequency */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Operating Frequency</span>
              <span className="font-mono text-[11px] text-slate-400">Hz</span>
            </label>
            <input
              type="number"
              min="50"
              max="3000"
              step="50"
              value={inputs.baselineFrequency}
              onChange={(e) => onChangeInput('baselineFrequency', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Current Inner Diameter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Current Inner Diameter</span>
              <span className="font-mono text-[11px] text-slate-400">mm</span>
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              step="10"
              value={inputs.baselineInnerDiameter}
              onChange={(e) => onChangeInput('baselineInnerDiameter', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Current Crucible Height */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Current Crucible Height</span>
              <span className="font-mono text-[11px] text-slate-400">mm</span>
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              step="10"
              value={inputs.baselineCrucibleHeight}
              onChange={(e) => onChangeInput('baselineCrucibleHeight', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Current Refractory Thickness */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Current Refractory Thk</span>
              <span className="font-mono text-[11px] text-slate-400">mm</span>
            </label>
            <input
              type="number"
              min="50"
              max="1000"
              step="5"
              value={inputs.baselineRefractoryThickness}
              onChange={(e) => onChangeInput('baselineRefractoryThickness', parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

        </div>
      </div>

      {/* Embedded Formula Reference Note */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
        <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          Core Scaling Formula Rules Applied:
        </div>
        <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
          <li>Vol = Cap / 7.1 m³</li>
          <li>Thk = 90 + (Cap * 7.5) mm</li>
          <li>ID = ID_base * (Cap / Cap_base)^0.33</li>
          <li>Height = Vol / (π * (ID/2000)²) m</li>
          <li>Coil Turns = round(Power * 4.5)</li>
        </ul>
      </div>

    </div>
  );
};
