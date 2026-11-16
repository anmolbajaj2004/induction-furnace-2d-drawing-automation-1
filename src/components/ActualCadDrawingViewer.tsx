import React, { useState } from 'react';
import { ExtractedDwgDimension, UploadedDwgFile } from '../types/furnace';
import { generateActualDxfDrawing, ParsedDxfDrawing } from '../utils/dxfVectorParser';
import { ZoomIn, ZoomOut, Maximize2, Layers, MapPin, Eye, Compass, Focus } from 'lucide-react';

interface ActualCadDrawingViewerProps {
  uploadedFile: UploadedDwgFile;
  hoveredDimension: ExtractedDwgDimension | null;
}

export const ActualCadDrawingViewer: React.FC<ActualCadDrawingViewerProps> = ({
  uploadedFile,
  hoveredDimension,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  // Parse actual DXF CAD drawing geometry for uploaded file
  const cadDrawing: ParsedDxfDrawing = generateActualDxfDrawing(
    uploadedFile.filename,
    uploadedFile.componentType,
    uploadedFile.rawDxfContent
  );

  // SVG viewBox settings
  const viewBoxWidth = cadDrawing.width;
  const viewBoxHeight = cadDrawing.height;
  const minX = cadDrawing.minX;
  const minY = cadDrawing.minY;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-4 space-y-3 relative overflow-hidden shadow-xl">
      
      {/* CAD Viewer Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-amber-300 font-mono">
            Actual Uploaded DWG CAD Vector Drawing
          </span>
        </div>

        {/* CAD Controls */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2 py-0.5 rounded border text-[11px] font-mono flex items-center gap-1 transition-colors ${
              showDimensions
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Dims</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] px-1 text-slate-400">{Math.round(zoomLevel * 100)}%</span>
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
              title="Reset View"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Actual Drawing Vector Canvas Viewport */}
      <div className="relative w-full h-[280px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
        
        {/* CAD Grid Backdrop */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px), radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
          }}
        />

        {/* Active Portion Zoom Focus Indicator */}
        {hoveredDimension && (
          <div className="absolute top-2 left-2 z-20 bg-amber-500/90 text-slate-950 px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-lg backdrop-blur">
            <Focus className="w-3.5 h-3.5 animate-spin" />
            <span>PORTION: {hoveredDimension.label} ({hoveredDimension.valueMm} {hoveredDimension.unit})</span>
          </div>
        )}

        <svg
          viewBox={`${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full select-none"
          style={{
            transform: `scale(${zoomLevel})`,
            transition: 'transform 0.2s ease-out',
          }}
        >
          <defs>
            <marker id="dxfArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Render Actual Parsed DXF Vector Entities */}
          <g transform="scale(1, -1) translate(0, -1600)" opacity="0.95">
            
            {cadDrawing.entities.map((entity) => {
              const isMatch = hoveredDimension && entity.dimensionKey === hoveredDimension.key;

              // Color mapping by CAD layer
              let strokeColor = '#94a3b8'; // Default slate
              if (entity.layer.includes('SHELL')) strokeColor = '#60a5fa'; // Blue
              else if (entity.layer.includes('CHOCK')) strokeColor = '#f59e0b'; // Amber
              else if (entity.layer.includes('CRUCIBLE')) strokeColor = '#06b6d4'; // Cyan
              else if (entity.layer.includes('REFRACTORY')) strokeColor = '#f97316'; // Orange
              else if (entity.layer.includes('COIL')) strokeColor = '#eab308'; // Yellow

              if (isMatch) {
                strokeColor = '#f59e0b'; // Highlight matched entity in bold amber
              }

              if (entity.type === 'LINE') {
                return (
                  <line
                    key={entity.id}
                    x1={entity.x1}
                    y1={entity.y1}
                    x2={entity.x2}
                    y2={entity.y2}
                    stroke={strokeColor}
                    strokeWidth={isMatch ? '6' : '2'}
                    strokeDasharray={isMatch ? '8 4' : 'none'}
                    className={isMatch ? 'animate-pulse' : ''}
                  />
                );
              }

              if (entity.type === 'CIRCLE') {
                return (
                  <circle
                    key={entity.id}
                    cx={entity.cx}
                    cy={entity.cy}
                    r={entity.r}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isMatch ? '5' : '2'}
                    className={isMatch ? 'animate-pulse' : ''}
                  />
                );
              }

              if (entity.type === 'DIMENSION' && showDimensions) {
                return (
                  <g key={entity.id} opacity={hoveredDimension && !isMatch ? 0.3 : 1.0}>
                    <line
                      x1={entity.x1}
                      y1={entity.y1}
                      x2={entity.x2}
                      y2={entity.y2}
                      stroke={isMatch ? '#f59e0b' : '#10b981'}
                      strokeWidth={isMatch ? '4' : '1.5'}
                      markerEnd="url(#dxfArrow)"
                    />
                    <text
                      x={(entity.x1! + entity.x2!) / 2}
                      y={(entity.y1! + entity.y2!) / 2 + 15}
                      fill={isMatch ? '#f59e0b' : '#10b981'}
                      fontSize={isMatch ? '28' : '22'}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      transform="scale(1, -1)"
                    >
                      {entity.text}
                    </text>
                  </g>
                );
              }

              return null;
            })}

          </g>

          {/* Title Stamp */}
          <g transform={`translate(${minX + 20}, ${minY + viewBoxHeight - 60})`}>
            <rect width="220" height="40" fill="#0f172a" stroke="#334155" strokeWidth="1" rx="4" />
            <text x="10" y="16" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">
              CAD FILE: {uploadedFile.filename}
            </text>
            <text x="10" y="30" fill="#94a3b8" fontSize="9" fontFamily="monospace">
              COMPONENT: {uploadedFile.componentType}
            </text>
          </g>

        </svg>

      </div>

      {/* Spatial Location & Coordinates Explanation Callout Box */}
      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1 font-sans">
        {hoveredDimension ? (
          <>
            <div className="flex items-center justify-between text-amber-400 font-bold">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                <span>Extracted Dimension: {hoveredDimension.label}</span>
              </span>
              <span className="font-mono text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300">
                DXF {hoveredDimension.cadEntity}
              </span>
            </div>

            <div className="font-mono text-[11px] text-emerald-300">
              Drawing Location: {hoveredDimension.drawingLocation}
            </div>

            <div className="text-[11px] text-slate-300">
              Layer: <span className="font-mono font-bold text-amber-300">{hoveredDimension.layerName}</span> · {hoveredDimension.description}
            </div>
          </>
        ) : (
          <div className="text-center py-1 text-slate-400 text-[11px]">
            <span>Hover over any CAD Dimension Label in the table on the left to highlight and zoom into the exact drawing portion of this uploaded DWG file.</span>
          </div>
        )}
      </div>

    </div>
  );
};
