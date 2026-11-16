import React, { useState } from 'react';
import { FurnaceInputs, CalculationResults } from '../types/furnace';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, Activity, Flame, ShieldAlert, Cpu, RefreshCw, Send } from 'lucide-react';

interface AiEngineeringAssistantProps {
  inputs: FurnaceInputs;
  results: CalculationResults;
}

export const AiEngineeringAssistant: React.FC<AiEngineeringAssistantProps> = ({
  inputs,
  results,
}) => {
  const [loading, setLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunAiAnalysis = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // Initialize Gemini SDK with runtime env or default constructor
      const ai = new GoogleGenAI({});

      const prompt = `
You are a senior metallurgical and electrical induction furnace design engineer.
Analyze the following scaled induction furnace specifications and calculated CAD parameters:

BASELINE FURNACE:
- Capacity: ${inputs.baselineCapacity} Tons
- Power: ${inputs.baselinePower} MW
- Operating Frequency: ${inputs.baselineFrequency} Hz
- Inner Diameter: ${inputs.baselineInnerDiameter} mm
- Crucible Height: ${inputs.baselineCrucibleHeight} mm
- Refractory Thickness: ${inputs.baselineRefractoryThickness} mm

TARGET SCALED FURNACE:
- Desired Capacity: ${inputs.targetCapacity} Tons
- Desired Power: ${inputs.targetPower} MW
- Calculated Volume: ${results.targetCrucibleVolumeM3} m³
- Volume Scaling Factor: ${results.volumeScalingFactor}x
- Calculated Refractory Thickness: ${results.targetRefractoryThicknessMm} mm
- Calculated Inner Diameter: ${results.targetInnerDiameterMm} mm
- Calculated Crucible Height: ${results.targetCrucibleHeightMm} mm
- Calculated Coil Turns: ${results.targetCoilTurns} Turns
- Aspect Ratio (H/D): ${results.aspectRatioHeightToDiameter}
- Electrical Power Density: ${results.powerDensityKwPerM3} kW/m³
- Estimated Melt Time: ~${results.estimatedMeltTimeMinutes} minutes

Please provide a concise, structured engineering assessment containing:
1. THERMAL EFFICIENCY & INSULATION: (Refractory heat loss & lining wear risk)
2. ELECTROMAGNETIC & STIRRING DYNAMICS: (Bath meniscus turbulence & optimum frequency advice)
3. STRUCTURAL & CAD DRAWING RECOMMENDATIONS: (Specific AutoCAD layering or geometric tolerance notes)
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        setAnalysisText(response.text);
      } else {
        setAnalysisText('AI analysis completed but returned empty output.');
      }
    } catch (err: any) {
      console.error('Gemini API Analysis Error:', err);
      setErrorMsg(
        err?.message || 'Failed to generate AI analysis. Please verify GEMINI_API_KEY setting.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-4 text-slate-100 shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-200">
            AI Metallurgical & Thermal Diagnostics
          </h3>
        </div>

        <button
          onClick={handleRunAiAnalysis}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{loading ? 'Analyzing Parameters...' : 'Run Gemini Assessment'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {!analysisText && !loading && !errorMsg && (
        <div className="p-8 text-center bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-3">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto opacity-80" />
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-200">AI Furnace Optimization Engine</h4>
            <p className="text-xs text-slate-400">
              Click the button above to generate real-time metallurgical, thermal gradient, and induction electromagnetic stirring analysis for your scaled furnace design.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center bg-slate-950/60 rounded-lg border border-slate-800 space-y-3">
          <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-purple-300">
            Gemini 2.5 is calculating thermal flux, refractory boundary erosion rates, and electromagnetic coil pitch recommendations...
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs space-y-1">
          <span className="font-bold block">AI Diagnostic Error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {analysisText && !loading && (
        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3 text-xs font-sans text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-purple-500/30">
          {analysisText}
        </div>
      )}

    </div>
  );
};
