import React, { useState } from 'react';
import { FurnaceInputs, CalculationResults } from '../types/furnace';
import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, Layers, Compass, Check } from 'lucide-react';

interface SchematicCanvasProps {
  inputs: FurnaceInputs;
  results: CalculationResults;
}

export const SchematicCanvas: React.FC<SchematicCanvasProps> = ({ inputs, results }) => {
  const [viewMode, setViewMode] = useState<'section' | 'top' | 'comparison'>('section');
  const [showCrucibleLayer, setShowCrucibleLayer] = useState(true);
  const [showRefractoryLayer, setShowRefractoryLayer] = useState(true);
  const [showCoilLayer, setShowCoilLayer] = useState(true);
  const [showShellLayer, setShowShellLayer] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showBaselineOverlay, setShowBaselineOverlay] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [activeHoverLayer, setActiveHoverLayer] = useState<string | null>(null);

  // SVG viewport bounds
  const svgWidth = 800;
  const svgHeight = 600;
  const centerX = svgWidth / 2;
  const centerY = svgHeight / 2 + 30;

  // Scaling SVG pixel factor based on outer diameter and height
  const maxDimMm = Math.max(results.outerShellDiameterMm + 300, results.targetCrucibleHeightMm + 400);
  const scale = (380 / maxDimMm) * zoomLevel;

  // Target Dimensions in SVG space
  const targetRadiusPx = (results.targetInnerDiameterMm / 2) * scale;
  const targetRefractoryPx = results.targetRefractoryThicknessMm * scale;
  const targetOuterRadiusPx = targetRadiusPx + targetRefractoryPx;
  const targetShellRadiusPx = (results.outerShellDiameterMm / 2) * scale;
  const targetHeightPx = results.targetCrucibleHeightMm * scale;

  // Baseline Dimensions in SVG space
  const baseRadiusPx = (inputs.baselineInnerDiameter / 2) * scale;
  const baseRefractoryPx = inputs.baselineRefractoryThickness * scale;
  const baseOuterRadiusPx = baseRadiusPx + baseRefractoryPx;
  const baseHeightPx = inputs.baselineCrucibleHeight * scale;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3 relative overflow-hidden text-slate-200">
      
      {/* Schematic Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('section')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'section' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            2D Cross-Section
          </button>
          <button
            onClick={() => setViewMode('top')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'top' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Top Plan View
          </button>
        </div>

        {/* Baseline Overlay Toggle & Layer Toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowBaselineOverlay(!showBaselineOverlay)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors ${
              showBaselineOverlay
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {showBaselineOverlay ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Baseline Overlay</span>
          </button>

          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2.5 py-1 rounded border flex items-center gap-1.5 transition-colors ${
              showDimensions
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Dimensions</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] px-1 text-slate-400">{Math.round(zoomLevel * 100)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1.0)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Layer Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-slate-500 font-mono uppercase">CAD Layers:</span>
        <button
          onClick={() => setShowCrucibleLayer(!showCrucibleLayer)}
          className={`px-2 py-0.5 rounded border flex items-center gap-1 font-mono ${
            showCrucibleLayer
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          FURNACE_CRUCIBLE
        </button>
        <button
          onClick={() => setShowRefractoryLayer(!showRefractoryLayer)}
          className={`px-2 py-0.5 rounded border flex items-center gap-1 font-mono ${
            showRefractoryLayer
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          FURNACE_REFRACTORY
        </button>
        <button
          onClick={() => setShowCoilLayer(!showCoilLayer)}
          className={`px-2 py-0.5 rounded border flex items-center gap-1 font-mono ${
            showCoilLayer
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          FURNACE_COIL
        </button>
        <button
          onClick={() => setShowShellLayer(!showShellLayer)}
          className={`px-2 py-0.5 rounded border flex items-center gap-1 font-mono ${
            showShellLayer
              ? 'bg-slate-400/10 border-slate-500/30 text-slate-300'
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          FURNACE_SHELL
        </button>
      </div>

      {/* SVG Canvas Viewport */}
      <div className="relative w-full h-[450px] bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center">
        
        {/* CAD Grid Background Lines */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px), radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
          }}
        />

        {/* Hover Layer Data Banner */}
        {activeHoverLayer && (
          <div className="absolute top-3 left-3 z-20 bg-slate-900/90 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded text-xs font-mono backdrop-blur shadow-lg">
            {activeHoverLayer}
          </div>
        )}

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full select-none cursor-crosshair"
        >
          <defs>
            {/* Refractory Brick Pattern */}
            <pattern id="refractoryPattern" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 12 12 M 12 0 L 0 12" stroke="#ea580c" strokeWidth="0.8" opacity="0.4" />
            </pattern>

            {/* Coil Metallic Copper Gradient */}
            <radialGradient id="copperCoil">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>

            {/* Molten Metal Liquid Glow Gradient */}
            <linearGradient id="moltenMetal" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#f97316" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>

            {/* Dimension Arrow Markers */}
            <marker id="arrowStart" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 10 0 L 0 5 L 10 10 z" fill="#10b981" />
            </marker>
            <marker id="arrowEnd" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Center Line Axis (CAD Centerline Standard) */}
          <line
            x1={centerX}
            y1={20}
            x2={centerX}
            y2={svgHeight - 20}
            stroke="#0284c7"
            strokeWidth="1"
            strokeDasharray="12 4 3 4"
            opacity="0.6"
          />

          {viewMode === 'section' ? (
            /* 2D CROSS-SECTION DRAWING */
            <g transform={`translate(0, 0)`}>
              
              {/* 1. Baseline Overlay Phantom Lines */}
              {showBaselineOverlay && (
                <g opacity="0.4">
                  {/* Baseline Crucible Inner Wall */}
                  <rect
                    x={centerX - baseRadiusPx}
                    y={centerY - baseHeightPx}
                    width={baseRadiusPx * 2}
                    height={baseHeightPx}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  {/* Baseline Refractory Wall */}
                  <rect
                    x={centerX - baseOuterRadiusPx}
                    y={centerY - baseHeightPx - baseRefractoryPx}
                    width={baseOuterRadiusPx * 2}
                    height={baseHeightPx + baseRefractoryPx * 2}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="6 3"
                  />
                  <text
                    x={centerX - baseOuterRadiusPx - 10}
                    y={centerY - baseHeightPx / 2}
                    fill="#60a5fa"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    Baseline {inputs.baselineCapacity}T
                  </text>
                </g>
              )}

              {/* 2. FURNACE_SHELL (Outer Enclosure Frame) */}
              {showShellLayer && (
                <g
                  onMouseEnter={() =>
                    setActiveHoverLayer(`FURNACE_SHELL | OD: ${results.outerShellDiameterMm} mm`)
                  }
                  onMouseLeave={() => setActiveHoverLayer(null)}
                >
                  <rect
                    x={centerX - targetShellRadiusPx}
                    y={centerY - targetHeightPx - targetRefractoryPx - 15}
                    width={targetShellRadiusPx * 2}
                    height={targetHeightPx + targetRefractoryPx * 2 + 30}
                    fill="#1e293b"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    rx="4"
                  />
                  {/* Hydraulic Tilting Trunnions */}
                  <rect
                    x={centerX - targetShellRadiusPx - 25}
                    y={centerY - targetHeightPx / 2 - 15}
                    width="25"
                    height="30"
                    fill="#334155"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={centerX + targetShellRadiusPx}
                    y={centerY - targetHeightPx / 2 - 15}
                    width="25"
                    height="30"
                    fill="#334155"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* 3. FURNACE_REFRACTORY (Lining Structure) */}
              {showRefractoryLayer && (
                <g
                  onMouseEnter={() =>
                    setActiveHoverLayer(`FURNACE_REFRACTORY | Thickness: ${results.targetRefractoryThicknessMm} mm`)
                  }
                  onMouseLeave={() => setActiveHoverLayer(null)}
                >
                  <rect
                    x={centerX - targetOuterRadiusPx}
                    y={centerY - targetHeightPx - targetRefractoryPx}
                    width={targetOuterRadiusPx * 2}
                    height={targetHeightPx + targetRefractoryPx * 1.5}
                    fill="url(#refractoryPattern)"
                    stroke="#f97316"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* 4. FURNACE_CRUCIBLE (Melt Cavity) */}
              {showCrucibleLayer && (
                <g
                  onMouseEnter={() =>
                    setActiveHoverLayer(
                      `FURNACE_CRUCIBLE | ID: ${results.targetInnerDiameterMm} mm | Height: ${results.targetCrucibleHeightMm} mm`
                    )
                  }
                  onMouseLeave={() => setActiveHoverLayer(null)}
                >
                  {/* Molten Liquid Bath Pool */}
                  <rect
                    x={centerX - targetRadiusPx}
                    y={centerY - targetHeightPx}
                    width={targetRadiusPx * 2}
                    height={targetHeightPx}
                    fill="url(#moltenMetal)"
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                  {/* Slag Line Wave Surface */}
                  <path
                    d={`M ${centerX - targetRadiusPx} ${centerY - targetHeightPx + 10} Q ${centerX} ${
                      centerY - targetHeightPx + 20
                    } ${centerX + targetRadiusPx} ${centerY - targetHeightPx + 10}`}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                  />
                  {/* Spout Pouring Mouth */}
                  <polygon
                    points={`${centerX + targetOuterRadiusPx},${centerY - targetHeightPx - targetRefractoryPx} ${
                      centerX + targetOuterRadiusPx + 45
                    },${centerY - targetHeightPx - targetRefractoryPx - 25} ${
                      centerX + targetOuterRadiusPx + 40
                    },${centerY - targetHeightPx - targetRefractoryPx}`}
                    fill="#f97316"
                    stroke="#ef4444"
                  />
                </g>
              )}

              {/* 5. FURNACE_COIL (Water-Cooled Induction Helical Coil Turns) */}
              {showCoilLayer && (
                <g
                  onMouseEnter={() =>
                    setActiveHoverLayer(`FURNACE_COIL | Turns: ${results.targetCoilTurns} | Pitch: ${results.calculatedCoilPitchMm} mm`)
                  }
                  onMouseLeave={() => setActiveHoverLayer(null)}
                >
                  {Array.from({ length: Math.min(24, results.targetCoilTurns) }).map((_, i) => {
                    const coilSpacing = (targetHeightPx * 0.85) / Math.min(24, results.targetCoilTurns);
                    const coilY = centerY - targetHeightPx * 0.92 + i * coilSpacing;
                    const coilR = Math.max(5, Math.min(10, coilSpacing * 0.4));
                    return (
                      <React.Fragment key={i}>
                        {/* Left Coil Turn */}
                        <circle
                          cx={centerX - targetOuterRadiusPx + targetRefractoryPx * 0.4}
                          cy={coilY}
                          r={coilR}
                          fill="url(#copperCoil)"
                          stroke="#fbbf24"
                          strokeWidth="1"
                        />
                        {/* Right Coil Turn */}
                        <circle
                          cx={centerX + targetOuterRadiusPx - targetRefractoryPx * 0.4}
                          cy={coilY}
                          r={coilR}
                          fill="url(#copperCoil)"
                          stroke="#fbbf24"
                          strokeWidth="1"
                        />
                      </React.Fragment>
                    );
                  })}
                </g>
              )}

              {/* 6. FURNACE_DIMENSIONS (CAD Dimension Callouts) */}
              {showDimensions && (
                <g fill="#10b981" fontSize="11" fontFamily="monospace">
                  
                  {/* Inner Diameter Dimension Line */}
                  <line
                    x1={centerX - targetRadiusPx}
                    y1={centerY + 20}
                    x2={centerX + targetRadiusPx}
                    y2={centerY + 20}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    markerStart="url(#arrowStart)"
                    markerEnd="url(#arrowEnd)"
                  />
                  <text x={centerX} y={centerY + 38} textAnchor="middle" fontWeight="bold">
                    ID = {results.targetInnerDiameterMm} mm
                  </text>

                  {/* Refractory Thickness Dimension */}
                  <line
                    x1={centerX - targetOuterRadiusPx}
                    y1={centerY + 60}
                    x2={centerX - targetRadiusPx}
                    y2={centerY + 60}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    markerStart="url(#arrowStart)"
                    markerEnd="url(#arrowEnd)"
                  />
                  <text
                    x={centerX - (targetRadiusPx + targetOuterRadiusPx) / 2}
                    y={centerY + 76}
                    textAnchor="middle"
                    fontSize="10"
                  >
                    Thk = {results.targetRefractoryThicknessMm} mm
                  </text>

                  {/* Crucible Height Vertical Dimension */}
                  <line
                    x1={centerX + targetShellRadiusPx + 30}
                    y1={centerY - targetHeightPx}
                    x2={centerX + targetShellRadiusPx + 30}
                    y2={centerY}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    markerStart="url(#arrowStart)"
                    markerEnd="url(#arrowEnd)"
                  />
                  <text
                    x={centerX + targetShellRadiusPx + 42}
                    y={centerY - targetHeightPx / 2}
                    writingMode="vertical-rl"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    H = {results.targetCrucibleHeightMm} mm
                  </text>

                </g>
              )}

            </g>
          ) : (
            /* TOP PLAN VIEW DRAWING */
            <g transform={`translate(${centerX}, ${centerY - 40})`}>
              
              {/* Outer Shell Circle */}
              {showShellLayer && (
                <circle
                  r={targetShellRadiusPx}
                  fill="#1e293b"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                />
              )}

              {/* Refractory Outer Wall Circle */}
              {showRefractoryLayer && (
                <circle
                  r={targetOuterRadiusPx}
                  fill="url(#refractoryPattern)"
                  stroke="#f97316"
                  strokeWidth="2"
                />
              )}

              {/* Copper Coil Ring Array */}
              {showCoilLayer && (
                <circle
                  r={targetOuterRadiusPx - targetRefractoryPx * 0.4}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="12"
                  strokeDasharray="18 6"
                />
              )}

              {/* Crucible Internal Bath Ring */}
              {showCrucibleLayer && (
                <circle
                  r={targetRadiusPx}
                  fill="url(#moltenMetal)"
                  stroke="#06b6d4"
                  strokeWidth="2"
                />
              )}

              {/* Baseline Phantom Rings */}
              {showBaselineOverlay && (
                <g opacity="0.5">
                  <circle
                    r={baseRadiusPx}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <circle
                    r={baseOuterRadiusPx}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="6 3"
                  />
                </g>
              )}

              {/* Dimensions in Top View */}
              {showDimensions && (
                <g fill="#10b981" fontSize="11" fontFamily="monospace">
                  <line
                    x1={-targetRadiusPx}
                    y1="0"
                    x2={targetRadiusPx}
                    y2="0"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    markerStart="url(#arrowStart)"
                    markerEnd="url(#arrowEnd)"
                  />
                  <text x="0" y="-10" textAnchor="middle" fontWeight="bold">
                    Ø {results.targetInnerDiameterMm} mm
                  </text>
                </g>
              )}

            </g>
          )}

          {/* Title Block Legend (AutoCAD Standard Border Stamp) */}
          <g transform={`translate(15, ${svgHeight - 75})`}>
            <rect width="260" height="60" fill="#0f172a" stroke="#334155" strokeWidth="1" rx="4" />
            <text x="10" y="18" fill="#f59e0b" fontSize="11" fontFamily="monospace" fontWeight="bold">
              PROJECT: INDUCTION FURNACE 2D
            </text>
            <text x="10" y="34" fill="#94a3b8" fontSize="10" fontFamily="monospace">
              CAP: {inputs.targetCapacity} T | POWER: {inputs.targetPower} MW | FREQ: {inputs.baselineFrequency} Hz
            </text>
            <text x="10" y="48" fill="#64748b" fontSize="9" fontFamily="monospace">
              SCALE: PARAMETRIC 1:{Math.round(maxDimMm / 380)} | DWG NO: VULCAN-2D-{inputs.targetCapacity}T
            </text>
          </g>

        </svg>

      </div>

    </div>
  );
};
