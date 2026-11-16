import React from 'react';
import { FurnaceInputs, CalculationResults, EngineeringAlert } from '../types/furnace';
import { Activity, ShieldAlert, ArrowUpRight, ArrowDownRight, Layers, Flame, Scale, Clock, Cpu, Lock, AlertTriangle } from 'lucide-react';

interface ResultsSummaryCardProps {
  inputs: FurnaceInputs;
  results: CalculationResults;
  alerts: EngineeringAlert[];
}

export const ResultsSummaryCard: React.FC<ResultsSummaryCardProps> = ({
  inputs,
  results,
  alerts,
}) => {
  const deltaID = results.targetInnerDiameterMm - inputs.baselineInnerDiameter;
  const deltaHeight = results.targetCrucibleHeightMm - inputs.baselineCrucibleHeight;
  const deltaThk = results.targetRefractoryThicknessMm - inputs.baselineRefractoryThickness;
  const baseTurns = Math.round(inputs.baselinePower * 4.5);
  const deltaTurns = results.targetCoilTurns - baseTurns;

  return (
    <div className="space-y-4">
      
      {/* Active Restriction Callout Banner */}
      {results.constraintCompensationNote && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-xs font-mono text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold">
            <Lock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{results.constraintCompensationNote}</span>
          </div>
          <span className="text-[10px] bg-amber-500/30 text-amber-900 dark:text-amber-100 font-bold px-2 py-0.5 rounded border border-amber-500/40 shrink-0">
            ENVELOPE RESTRICTED
          </span>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Target Crucible Volume */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Target Volume</span>
            <Scale className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {results.targetCrucibleVolumeM3}
            </span>
            <span className="text-xs text-slate-500 font-mono">m³</span>
          </div>
          <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{results.volumeScalingFactor}x scale factor</span>
          </div>
        </div>

        {/* Target Inner Diameter */}
        <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3.5 shadow-sm space-y-1 ${
          results.isWidthLocked ? 'border-amber-500/80 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider flex items-center gap-1">
              {results.isWidthLocked && <Lock className="w-3 h-3 text-amber-500" />}
              Inner Diameter
            </span>
            <Layers className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {results.targetInnerDiameterMm}
            </span>
            <span className="text-xs text-slate-500 font-mono">mm</span>
          </div>
          <div className={`text-[11px] font-mono flex items-center gap-1 ${deltaID >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            {deltaID >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{results.isWidthLocked ? '🔒 RESTRICTED' : `${deltaID >= 0 ? `+${deltaID.toFixed(1)}` : deltaID.toFixed(1)} mm`}</span>
          </div>
        </div>

        {/* Target Crucible Height */}
        <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3.5 shadow-sm space-y-1 ${
          results.isHeightLocked ? 'border-amber-500/80 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider flex items-center gap-1">
              {results.isHeightLocked && <Lock className="w-3 h-3 text-amber-500" />}
              Crucible Height
            </span>
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {results.targetCrucibleHeightMm}
            </span>
            <span className="text-xs text-slate-500 font-mono">mm</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>({results.targetCrucibleHeightM} m)</span>
            <span className={`ml-auto font-bold ${results.isHeightLocked ? 'text-amber-500' : deltaHeight >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {results.isHeightLocked ? '🔒 RESTRICTED' : deltaHeight >= 0 ? `+${deltaHeight.toFixed(0)}` : deltaHeight.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Target Refractory Lining Thickness */}
        <div className={`bg-white dark:bg-slate-900 rounded-xl border p-3.5 shadow-sm space-y-1 ${
          results.isRefractoryLocked ? 'border-amber-500/80 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider flex items-center gap-1">
              {results.isRefractoryLocked && <Lock className="w-3 h-3 text-amber-500" />}
              Refractory Thk
            </span>
            <Flame className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {results.targetRefractoryThicknessMm}
            </span>
            <span className="text-xs text-slate-500 font-mono">mm</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{results.isRefractoryLocked ? '🔒 RESTRICTED' : `+${deltaThk.toFixed(1)} mm wall`}</span>
          </div>
        </div>

      </div>

      {/* Secondary Metrics Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Coil Turn Count</span>
          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span>{results.targetCoilTurns} Turns</span>
            <span className="text-[10px] text-slate-400 font-normal">({deltaTurns >= 0 ? `+${deltaTurns}` : deltaTurns})</span>
          </div>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Outer Shell Diameter</span>
          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">
            {results.outerShellDiameterMm} <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Aspect Ratio (H / D)</span>
          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5 flex items-center gap-1.5">
            <span>{results.aspectRatioHeightToDiameter}</span>
            <span className={`text-[10px] font-sans px-1.5 py-0.2 rounded ${
              results.aspectRatioHeightToDiameter >= 1.0 && results.aspectRatioHeightToDiameter <= 1.5
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {results.aspectRatioHeightToDiameter >= 1.0 && results.aspectRatioHeightToDiameter <= 1.5 ? 'Ideal' : 'Attention'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Est. Melt Cycle Time</span>
          <div className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>~{results.estimatedMeltTimeMinutes} min</span>
          </div>
        </div>
      </div>

      {/* Engineering Safety & Optimization Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                alert.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                  : alert.type === 'danger'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200'
                  : alert.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">{alert.title}</span>
                <span className="opacity-90">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
