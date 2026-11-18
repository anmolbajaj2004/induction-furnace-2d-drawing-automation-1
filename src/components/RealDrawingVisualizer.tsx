import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DwgCropBox, ExtractedDwgDimension, UploadedDwgFile, OrthographicViewType, ReferenceSet } from '../types/furnace';
import { SHELL_DRAWING_IMAGE_URL } from '../utils/dwgParser';
import { ShellResult } from '../utils/shellModel';
import { ShellViewDrawing } from './ShellViewDrawing';
import { ShellIsoDrawing } from './ShellIsoDrawing';
import { renderToStaticMarkup } from 'react-dom/server';
import { Compass, MapPin, Info, Layers, ZoomIn, ZoomOut, Tag, Maximize2, Minimize2, Download } from 'lucide-react';

/** One numbered dimension that can be marked on a view. */
export interface DimMarker {
  key: string;
  n: number;
  shellId?: string;
  label: string;
  box?: DwgCropBox;
  boxView: OrthographicViewType;
  /** every view this dimension belongs to */
  views: OrthographicViewType[];
}

/** One dimension read from the reference image, marked on the reference views. */
export interface RefMarker {
  /** key of the reference dimension */
  key: string;
  /** same number as the paired given dimension; numbers after the given ones when unpaired */
  n: number;
  /** key of the given dimension it is paired with (if any) */
  givenKey?: string;
  dim: ExtractedDwgDimension;
}

interface RealDrawingVisualizerProps {
  uploadedFile: UploadedDwgFile;
  /** reference image set (3 views); enables the Given / Reference switch */
  referenceSet?: ReferenceSet;
  refMarkers?: RefMarker[];
  hoveredDimension: ExtractedDwgDimension | null;
  /** Required value (new tonnage) for the hovered dimension, if the model has one. */
  requiredValue?: number | null;
  /** Views the hovered dimension is shown in (first one is preferred). */
  hoveredViews: OrthographicViewType[];
  markers: DimMarker[];
  shell: ShellResult | null;
  onHoverKey: (key: string | null) => void;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

export const RealDrawingVisualizer: React.FC<RealDrawingVisualizerProps> = ({
  uploadedFile,
  referenceSet,
  refMarkers = [],
  hoveredDimension: hoveredGiven,
  requiredValue: requiredGiven,
  hoveredViews,
  markers: givenMarkers,
  shell: shellProp,
  onHoverKey: onHoverGiven,
}) => {
  const [activeTab, setActiveTab] = useState<OrthographicViewType>('FRONT');
  const [iso, setIso] = useState(false); // isometric view of the generated shell model (not one of the three pasted views)
  const [set, setSet] = useState<'given' | 'reference'>('given');
  const [refHoverKey, setRefHoverKey] = useState<string | null>(null);
  const hasReference = !!(referenceSet && (referenceSet.frontViewImageUrl || referenceSet.topViewImageUrl || referenceSet.sideViewImageUrl));
  const refMode = set === 'reference' && hasReference;

  // In Reference mode the marks, hover and image all come from the reference set; the generated model drawing is not shown.
  const shell = refMode ? null : shellProp;
  const markers: DimMarker[] = refMode
    ? refMarkers.map((r) => ({
        key: r.key,
        n: r.n,
        label: r.dim.label,
        box: r.dim.cropBox,
        boxView: r.dim.viewSource || 'FRONT',
        views: [r.dim.viewSource || 'FRONT'],
      }))
    : givenMarkers;
  const hoveredDimension: ExtractedDwgDimension | null = refMode
    ? (refHoverKey ? refMarkers.find((r) => r.key === refHoverKey)?.dim : hoveredGiven ? refMarkers.find((r) => r.givenKey === hoveredGiven.key)?.dim : undefined) ?? null
    : hoveredGiven;
  const requiredValue = refMode ? null : requiredGiven;
  const onHoverKey = (key: string | null) => {
    if (!refMode) return onHoverGiven(key);
    const r = key ? refMarkers.find((x) => x.key === key) : undefined;
    if (r?.givenKey) {
      setRefHoverKey(null);
      onHoverGiven(r.givenKey);
    } else {
      onHoverGiven(null);
      setRefHoverKey(key);
    }
  };
  const [autoZoom, setAutoZoom] = useState(true);
  const [markAll, setMarkAll] = useState(true);
  const [genMode, setGenMode] = useState<'required' | 'given'>('required');
  const [expanded, setExpanded] = useState(false);

  const frontImage = refMode ? referenceSet?.frontViewImageUrl || null : uploadedFile.frontViewImageUrl || uploadedFile.imageUrl || SHELL_DRAWING_IMAGE_URL;
  const topImage = (refMode ? referenceSet?.topViewImageUrl : uploadedFile.topViewImageUrl) || null;
  const sideImage = (refMode ? referenceSet?.sideViewImageUrl : uploadedFile.sideViewImageUrl) || null;

  // Hovering a dimension keeps the current tab if the dimension is on it, else jumps to a view that shows it.
  const currentView: OrthographicViewType =
    !refMode && hoveredDimension && hoveredViews.length > 0 && !hoveredViews.includes(activeTab) ? hoveredViews[0] : activeTab;
  const currentImage = currentView === 'TOP' ? topImage : currentView === 'SIDE' ? sideImage : frontImage;

  const isShell = !refMode && uploadedFile.componentType === 'SHELL_MECHANICAL' && !!shell;
  const isoOn = iso && isShell;
  // Pasted image vs. the generated model drawing (which carries every dimension of the view).
  type Source = 'image' | 'overlay' | 'model';
  const [sourceChoice, setSourceChoice] = useState<Partial<Record<OrthographicViewType, Source>>>({});
  const [adjByView, setAdjByView] = useState<Record<string, { s: number; x: number; y: number; o: number }>>({});
  const adj = adjByView[currentView] ?? { s: 1, x: 0, y: 0, o: 0.35 };
  const setAdj = (patch: Partial<{ s: number; x: number; y: number; o: number }>) =>
    setAdjByView((a) => ({ ...a, [currentView]: { ...adj, ...patch } }));
  const hasImage = !!currentImage;
  const marksOnView = markers.filter((mk) => mk.box && mk.boxView === currentView);
  const expectedOnView = markers.filter((mk) => mk.views.includes(currentView)).length;
  // Your pasted drawing is never replaced: with an image we show it (with every mark overlaid when the AI
  // located only a few); the model-only drawing is a separate choice.
  const autoSource: Source = hasImage && marksOnView.length >= 0.6 * expectedOnView ? 'image' : isShell && hasImage ? 'overlay' : 'model';
  const source: Source = !isShell ? 'image' : !hasImage ? 'model' : sourceChoice[currentView] ?? autoSource;
  const generated = isShell && source === 'model';
  const overlay = isShell && hasImage && source === 'overlay';

  const hoveredMarker = hoveredDimension ? markers.find((mk) => mk.key === hoveredDimension.key) : undefined;
  const hoveredShellId = hoveredMarker?.shellId ?? null;
  const cropBox = hoveredDimension?.cropBox;
  const showBox = !!cropBox && hoveredDimension?.viewSource === currentView && !generated;

  const numberById: Record<string, number> = {};
  markers.forEach((mk) => {
    if (mk.shellId && !(mk.shellId in numberById)) numberById[mk.shellId] = mk.n;
  });
  const onHoverShellId = (id: string | null) => {
    if (id === null) return onHoverKey(null);
    const mk = markers.find((x) => x.shellId === id);
    if (mk) onHoverKey(mk.key);
  };

  // ---- measure the viewport and the image so overlay % map onto the real image pixels ----
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ cw: 0, ch: 0, iw: 0, ih: 0, il: 0, it: 0 });

  const measure = () => {
    const vp = viewportRef.current;
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!vp || !img || !stage) return;
    setM({
      cw: vp.clientWidth,
      ch: vp.clientHeight,
      iw: img.clientWidth,
      ih: img.clientHeight,
      il: stage.offsetLeft,
      it: stage.offsetTop,
    });
  };

  useLayoutEffect(measure, [currentImage, currentView, generated, refMode]);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  // ---- zoom / pan towards the hovered callout ----
  let scale = 1;
  let tx = 0;
  let ty = 0;
  if (showBox && cropBox && autoZoom && m.iw > 0) {
    const bw = (cropBox.w / 100) * m.iw;
    const bh = (cropBox.h / 100) * m.ih;
    scale = Math.min(3.5, Math.max(1, Math.min((0.7 * m.cw) / bw, (0.7 * m.ch) / bh)));
    const cx = ((cropBox.x + cropBox.w / 2) / 100) * m.iw;
    const cy = ((cropBox.y + cropBox.h / 2) / 100) * m.ih;
    const place = (center: number, size: number, vp: number, off: number) => {
      if (size * scale <= vp) return (vp - size * scale) / 2 - off;
      const wanted = vp / 2 - off - center * scale;
      return Math.min(-off, Math.max(vp - off - size * scale, wanted));
    };
    tx = place(cx, m.iw, m.cw, m.il);
    ty = place(cy, m.ih, m.ch, m.it);
  }

  const changed = requiredValue != null && hoveredDimension != null && Math.abs(requiredValue - hoveredDimension.valueMm) > 0.004;
  const modelCount = markers.filter((mk) => mk.shellId && mk.views.includes(currentView)).length;

  const sourceSwitch =
    isShell && hasImage ? (
      <div className="flex gap-1 bg-slate-950/90 p-0.5 rounded-md border border-slate-700 text-[10px] font-mono">
        {(
          [
            ['image', `Image (${marksOnView.length})`, `Your pasted ${currentView} image with the ${marksOnView.length} of ${expectedOnView} dimensions the AI located on it`],
            ['overlay', `Image + all (${modelCount})`, 'Your pasted image with every dimension of this view marked on top (align with the sliders)'],
            ['model', 'Model', 'Generated drawing only'],
          ] as [Source, string, string][]
        ).map(([k, label, tip]) => (
          <button
            key={k}
            onClick={() => setSourceChoice((s) => ({ ...s, [currentView]: k }))}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${source === k ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'}`}
            title={tip}
          >
            {label}
          </button>
        ))}
      </div>
    ) : null;

  // ---- SVG export (generated drawings: marked + numbered) ----
  const exportGeom = shell ? (genMode === 'required' ? shell.req : shell.ref) : null;
  const exportCmp = shell && genMode === 'required' ? shell.ref : undefined;
  type GenView = OrthographicViewType | 'ISO';
  const markupFor = (v: GenView) =>
    renderToStaticMarkup(
      v === 'ISO' ? (
        <ShellIsoDrawing
          compact
          req={shell!.req}
          ref0={shell!.ref}
          mode={genMode === 'required' ? 'required' : 'reference'}
          refCapacity={shell!.refCapacity}
          targetCapacity={shell!.targetCapacity}
        />
      ) : (
        <ShellViewDrawing view={v} g={exportGeom!} cmp={exportCmp} numberById={numberById} hoveredId={null} onHover={() => {}} />
      )
    );
  const viewBoxOf = (markup: string): [number, number, number, number] => {
    const mm = markup.match(/viewBox="([^"]+)"/);
    const p = (mm?.[1] ?? '0 0 1000 1000').split(/\s+/).map(Number);
    return [p[0], p[1], p[2], p[3]];
  };
  const saveSvg = (svg: string, name: string) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const capLabel = shell ? (genMode === 'required' ? `${shell.targetCapacity}T` : `${shell.refCapacity}T`) : '';
  const downloadView = (v: GenView) => {
    if (!shell || !exportGeom) return;
    const markup = markupFor(v);
    const [x, y, w, h] = viewBoxOf(markup);
    const svg = markup
      .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="${Math.round((2400 * h) / w)}" `)
      .replace(/(<svg[^>]*>)/, `$1<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`);
    saveSvg(svg, `SHELL_${capLabel}_${v}_view.svg`);
  };
  const downloadAll = () => {
    if (!shell || !exportGeom) return;
    const cellW = 2000;
    const pad = 100;
    let yy = 0;
    let body = '';
    (['FRONT', 'TOP', 'SIDE', 'ISO'] as GenView[]).forEach((v) => {
      const markup = markupFor(v);
      const [, , w, h] = viewBoxOf(markup);
      const cellH = Math.round((cellW * h) / w);
      const inner = markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
      const vb = viewBoxOf(markup).join(' ');
      body += `<text x="${pad}" y="${yy + 70}" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="52" font-weight="700" fill="#0f172a">${v} VIEW — ${
        genMode === 'required' ? `required ${shell.targetCapacity} t` : `reference ${shell.refCapacity} t`
      }</text>`;
      body += `<svg x="${pad}" y="${yy + 100}" width="${cellW}" height="${cellH}" viewBox="${vb}" font-family="ui-monospace,Menlo,Consolas,monospace">${inner}</svg>`;
      yy += 100 + cellH + 120;
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cellW + 2 * pad}" height="${yy}" viewBox="0 0 ${cellW + 2 * pad} ${yy}"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`;
    saveSvg(svg, `SHELL_${capLabel}_all_views.svg`);
  };

  return (
    <div
      className={`bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-4 space-y-3 shadow-2xl ${
        expanded ? 'fixed inset-4 z-50 overflow-auto ring-4 ring-black/60' : 'relative overflow-hidden lg:sticky lg:top-20'
      }`}
    >
      {/* Visualizer Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-amber-300 font-mono">Tri-View Orthographic CAD Visualizer</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Close full-screen' : 'Full-screen (bigger text)'}
            className={`p-1 rounded border cursor-pointer transition-colors ${
              expanded ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-400'
            }`}
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setMarkAll((v) => !v)}
            title={markAll ? 'Marking every dimension: ON' : 'Marking every dimension: OFF'}
            className={`p-1 rounded border cursor-pointer transition-colors ${
              markAll ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-400'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          {!generated && (
            <button
              onClick={() => setAutoZoom((z) => !z)}
              title={autoZoom ? 'Auto-zoom on hover: ON' : 'Auto-zoom on hover: OFF'}
              className={`p-1 rounded border cursor-pointer transition-colors ${
                autoZoom ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-400'
              }`}
            >
              {autoZoom ? <ZoomIn className="w-3.5 h-3.5" /> : <ZoomOut className="w-3.5 h-3.5" />}
            </button>
          )}

          {hasReference && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
              {(
                [
                  ['given', 'Base'],
                  ['reference', `Ref${referenceSet!.capacityT ? ` ${referenceSet!.capacityT} t` : ''}`],
                ] as ['given' | 'reference', string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => {
                    setSet(k);
                    setRefHoverKey(null);
                  }}
                  title={k === 'given' ? 'Your base drawing with its marked dimensions' : 'The reference drawing with its marked dimensions'}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    set === k ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
            {(['FRONT', 'TOP', 'SIDE'] as OrthographicViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setIso(false);
                  setActiveTab(v);
                }}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  currentView === v && !isoOn ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
            {isShell && (
              <button
                onClick={() => setIso(true)}
                title="Isometric view of the generated shell (built from the dimension register)"
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  isoOn ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                ISO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Drawing Viewport Canvas */}
      <div
        ref={viewportRef}
        className={`relative w-full bg-white rounded-xl border-2 border-slate-800 overflow-hidden flex items-center justify-center ${
          expanded ? 'h-[calc(100vh-290px)]' : 'h-[420px]'
        }`}
      >
        {isoOn && shell ? (
          <>
            <ShellIsoDrawing
              compact
              req={shell.req}
              ref0={shell.ref}
              mode={genMode === 'required' ? 'required' : 'reference'}
              refCapacity={shell.refCapacity}
              targetCapacity={shell.targetCapacity}
              hoveredId={hoveredShellId}
              onHover={onHoverShellId}
              numberById={markAll ? numberById : {}}
              names={Object.fromEntries(shell.dims.map((d) => [d.id, d.label]))}
            />
            <div className="absolute top-2 left-2 bg-slate-950/90 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded text-[10px] font-mono font-bold shadow-md">
              ISOMETRIC · model
            </div>
            <div className="absolute top-2 right-2 flex gap-1 bg-slate-950/90 p-0.5 rounded-md border border-slate-700 text-[10px] font-mono">
              {(['given', 'required'] as const).map((md) => (
                <button
                  key={md}
                  onClick={() => setGenMode(md)}
                  className={`px-1.5 py-0.5 rounded cursor-pointer ${genMode === md ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'}`}
                >
                  {md === 'given' ? `${shell.refCapacity} t base` : `${shell.targetCapacity} t target`}
                </button>
              ))}
            </div>
          </>
        ) : generated && shell ? (
          <>
            <ShellViewDrawing
              view={currentView}
              g={genMode === 'required' ? shell.req : shell.ref}
              cmp={genMode === 'required' ? shell.ref : undefined}
              numberById={markAll ? numberById : {}}
              hoveredId={hoveredShellId}
              onHover={onHoverShellId}
            />
            <div className="absolute top-2 left-2 bg-slate-950/90 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded text-[10px] font-mono font-bold shadow-md">
              {currentView === 'TOP' ? 'TOP PLAN' : currentView === 'SIDE' ? 'SIDE ELEVATION' : 'FRONT ELEVATION'} · model · {modelCount} dims
            </div>
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
              {sourceSwitch}
              <div className="flex gap-1 bg-slate-950/90 p-0.5 rounded-md border border-slate-700 text-[10px] font-mono">
                {(['given', 'required'] as const).map((md) => (
                  <button
                    key={md}
                    onClick={() => setGenMode(md)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${genMode === md ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'}`}
                  >
                    {md === 'given' ? `${shell.refCapacity} t base` : `${shell.targetCapacity} t target`}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : currentImage ? (
          <>
            {/* Stage: wraps the image exactly, so the overlay % are % of the drawing itself */}
            <div
              ref={stageRef}
              className="relative"
              style={{
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: '0 0',
                transition: 'transform 350ms ease-out',
              }}
            >
              <img
                ref={imgRef}
                src={currentImage}
                alt={`${currentView} View Drawing`}
                onLoad={measure}
                className="block max-w-full w-auto h-auto select-none"
                style={{ maxHeight: expanded ? 'calc(100vh - 300px)' : 412 }}
                draggable={false}
              />

              {/* every dimension marked on the drawing */}
              {markAll &&
                source === 'image' &&
                marksOnView.map((mk) => {
                  const b = mk.box!;
                  const hov = hoveredDimension?.key === mk.key;
                  return (
                    <div
                      key={mk.key}
                      onMouseEnter={() => onHoverKey(mk.key)}
                      onMouseLeave={() => onHoverKey(null)}
                      className="absolute cursor-pointer"
                      style={{
                        left: `${b.x}%`,
                        top: `${b.y}%`,
                        width: `${b.w}%`,
                        height: `${b.h}%`,
                        border: `${(hov ? 2 : 1) / scale}px solid ${hov ? '#2563eb' : 'rgba(217,119,6,0.75)'}`,
                        background: hov ? 'rgba(37,99,235,0.18)' : 'rgba(245,158,11,0.07)',
                        zIndex: hov ? 12 : 5,
                      }}
                    >
                      <span
                        className="absolute font-mono font-bold text-white rounded-full flex items-center justify-center leading-none"
                        style={{
                          left: 0,
                          top: 0,
                          transform: `translate(-35%, -45%) scale(${1 / scale})`,
                          transformOrigin: 'center',
                          minWidth: 14,
                          height: 14,
                          padding: '0 3px',
                          fontSize: 9,
                          background: hov ? '#2563eb' : '#d97706',
                        }}
                      >
                        {mk.n}
                      </span>
                    </div>
                  );
                })}

              {/* every dimension of this view drawn over YOUR pasted drawing */}
              {overlay && shell && (
                <div
                  className="absolute inset-0"
                  style={{ transform: `translate(${adj.x}%, ${adj.y}%) scale(${adj.s})`, transformOrigin: '50% 50%' }}
                >
                  <ShellViewDrawing
                    view={currentView}
                    g={genMode === 'required' ? shell.req : shell.ref}
                    cmp={genMode === 'required' ? shell.ref : undefined}
                    numberById={markAll ? numberById : {}}
                    hoveredId={hoveredShellId}
                    onHover={onHoverShellId}
                    geomOpacity={adj.o}
                    halo
                  />
                </div>
              )}

              {/* pulsing point on the hovered dimension (centre of its callout on the image) */}
              {showBox && cropBox && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${cropBox.x + cropBox.w / 2}%`,
                    top: `${cropBox.y + cropBox.h / 2}%`,
                    transform: `scale(${1 / scale})`,
                    transformOrigin: '0 0',
                    zIndex: 30,
                  }}
                >
                  <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-blue-500 opacity-60 animate-ping" />
                  <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white shadow" />
                </div>
              )}

              {/* the hovered callout, emphasised even when "mark all" is off */}
              {(!markAll || source !== 'image') && showBox && cropBox && (
                <div
                  className="absolute rounded-sm pointer-events-none z-10"
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.w}%`,
                    height: `${cropBox.h}%`,
                    border: `${2 / scale}px solid #2563eb`,
                    background: 'rgba(37,99,235,0.2)',
                  }}
                />
              )}
            </div>

            <div className="absolute top-2 left-2 bg-slate-950/90 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded text-[10px] font-mono font-bold backdrop-blur shadow-md">
              {refMode ? `REFERENCE${referenceSet?.capacityT ? ` ${referenceSet.capacityT} t` : ''} · ` : ''}VIEW: {currentView} · {marksOnView.length} marked{scale > 1 ? ` · ${scale.toFixed(1)}×` : ''}
            </div>
            {sourceSwitch && <div className="absolute top-2 right-2">{sourceSwitch}</div>}
          </>
        ) : (
          <div className="text-center p-6 text-slate-500 font-sans text-xs space-y-2">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <span className="block font-bold text-slate-700">No Image Uploaded for {currentView} View</span>
            <span className="text-slate-400 block">Paste an image into the {currentView} View dropzone in Step 1 to inspect this view.</span>
          </div>
        )}

        {/* Floating callout read-out */}
        {hoveredDimension && (showBox || generated) && (
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 border border-amber-500/50 rounded-lg px-3 py-1.5 backdrop-blur shadow-lg flex items-center justify-between gap-3 text-[11px] font-mono pointer-events-none">
            <span className="text-amber-300 font-bold truncate">
              {hoveredMarker ? `#${hoveredMarker.n} ` : ''}📍 {hoveredDimension.label}
            </span>
            <span className="shrink-0 text-slate-200">
              {fmt(hoveredDimension.valueMm)}
              {requiredValue != null && (
                <>
                  <span className="text-slate-500"> → </span>
                  <span className={changed ? 'text-amber-300 font-bold' : 'text-slate-200'}>{fmt(requiredValue)}</span>
                </>
              )}{' '}
              <span className="text-slate-500">{hoveredDimension.unit}</span>
            </span>
          </div>
        )}
        {hoveredDimension && !showBox && !generated && currentImage && (
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 border border-slate-700 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 font-sans pointer-events-none">
            No callout location is known for this dimension on the {currentView} image.
          </div>
        )}
      </div>

      {/* Alignment of the overlay on your pasted drawing */}
      {overlay && (
        <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-bold text-amber-300">Align marks to your {currentView} drawing</span>
            <button
              onClick={() => setAdjByView((a) => ({ ...a, [currentView]: { s: 1, x: 0, y: 0, o: 0.35 } }))}
              className="px-2 py-0.5 rounded border border-slate-700 hover:border-amber-500 cursor-pointer"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            {(
              [
                ['Scale', 's', 0.4, 2, 0.01],
                ['Outline', 'o', 0, 1, 0.05],
                ['Move X', 'x', -50, 50, 0.5],
                ['Move Y', 'y', -50, 50, 0.5],
              ] as [string, 's' | 'o' | 'x' | 'y', number, number, number][]
            ).map(([label, key, min, max, step]) => (
              <label key={key} className="flex items-center gap-2">
                <span className="w-14 shrink-0">{label}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={adj[key]}
                  onChange={(e) => setAdj({ [key]: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* SVG downloads */}
      {isShell && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="text-slate-400">SVG ({genMode === 'required' ? `${shell!.targetCapacity} t` : `${shell!.refCapacity} t`}):</span>
          {(['FRONT', 'TOP', 'SIDE', 'ISO'] as GenView[]).map((v) => (
            <button
              key={v}
              onClick={() => downloadView(v)}
              className="px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              {v}
            </button>
          ))}
          <button
            onClick={downloadAll}
            className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 cursor-pointer flex items-center gap-1"
          >
            <Download className="w-3 h-3" />
            All 4 views
          </button>
          <div className="ml-auto flex gap-1 bg-slate-950 p-0.5 rounded-md border border-slate-700">
            {(['given', 'required'] as const).map((md) => (
              <button
                key={md}
                onClick={() => setGenMode(md)}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${genMode === md ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'}`}
              >
                {md === 'given' ? 'base' : 'target'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spatial Location & View Source Details Card */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
        {hoveredDimension ? (
          <>
            <div className="flex items-center justify-between gap-2 text-amber-400 font-bold">
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">
                  [{hoveredViews.join(' · ') || hoveredDimension.viewSource}] {hoveredDimension.label}
                </span>
              </span>
              <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40 text-amber-300 shrink-0">
                {fmt(hoveredDimension.valueMm)}
                {requiredValue != null && ` → ${fmt(requiredValue)}`} {hoveredDimension.unit}
              </span>
            </div>
            <div className="font-mono text-[11px] text-emerald-300">Drawing Location: {hoveredDimension.drawingLocation}</div>
            <div className="text-[11px] text-slate-300 font-sans">
              Layer: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">{hoveredDimension.layerName}</code> · {hoveredDimension.description}
            </div>
          </>
        ) : (
          <div className="text-center py-1 text-slate-400 text-[11px] flex items-center justify-center gap-1.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Every dimension is numbered on the drawing and in the table. Hover either one to light up the other; switch FRONT / TOP / SIDE / ISO to see each view.</span>
          </div>
        )}
      </div>
    </div>
  );
};
