import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrainCircuit, Search, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_NAME,
  setSelectedModel,
  useSelectedModel,
} from '../utils/modelSelection';

interface ORModel {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number | null; // USD per token
  completionPrice: number | null;
}

// price per token -> "$x / 1M tokens"
const perMillion = (p: number | null) => (p === null || isNaN(p) ? '—' : `$${(p * 1e6).toFixed(p * 1e6 < 1 ? 3 : 2)}`);

export const ModelPicker: React.FC = () => {
  const selected = useSelectedModel();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ORModel[] | null>(null);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/openrouter/models');
      // Read as text first: behind a proxy / static host the answer can be an HTML page instead of JSON.
      const text = await r.text();
      let j: any = null;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(
          `The server did not answer the model list request (status ${r.status}, not JSON). The app must be started with the Express server ("npm run dev" or "npm start"), and the proxy must forward /api to it.`
        );
      }
      setKeyConfigured(!!j.keyConfigured);
      if (!r.ok) throw new Error(j.error || `Server responded with status ${r.status}`);
      setModels(j.models);
    } catch (e: any) {
      setError(e?.message || 'Could not load models.');
    } finally {
      setLoading(false);
    }
  };

  const [keyText, setKeyText] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const saveKey = async () => {
    setSavingKey(true);
    setKeyError(null);
    try {
      const r = await fetch('/api/openrouter/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyText }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Server responded with status ${r.status}${r.status === 404 ? ' (the /api routes are not reachable: start the Express server)' : ''}`);
      setKeyText('');
      setKeySaved(true);
      setKeyConfigured(true);
    } catch (e: any) {
      setKeyError(e?.message || 'Could not save the key.');
    } finally {
      setSavingKey(false);
    }
  };

  useEffect(() => {
    if (open && !models && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (models ?? []).filter((m) => !t || m.id.toLowerCase().includes(t) || m.name.toLowerCase().includes(t));
  }, [models, q]);

  const choose = (id: string, name: string) => {
    setSelectedModel({ id, name });
    setOpen(false);
  };

  const isDefault = selected.id === DEFAULT_MODEL_ID;

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
          isDefault
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            : 'bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300'
        }`}
        title={`Extraction model: ${selected.name}`}
      >
        <BrainCircuit className="w-4 h-4" />
        <span className="hidden xl:inline max-w-[140px] truncate">{selected.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Image extraction model</span>
              <button onClick={load} title="Reload list" className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search models (e.g. gpt-4o, claude, gemini)"
                className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            {/* always available, so the key can be entered or replaced even when the model list failed to load */}
            {(
              <div className="space-y-1.5 text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                <div className="flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {keyConfigured === true
                      ? 'The server has an OpenRouter key. Paste another one to replace it (kept in the server\'s memory only, until it restarts):'
                      : 'OpenRouter key. Paste it here (kept in the server\'s memory only, until it restarts; or set OPENROUTER_API_KEY in .env):'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={keyText}
                    onChange={(e) => setKeyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveKey()}
                    placeholder="sk-or-v1-…"
                    className="flex-1 min-w-0 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    onClick={saveKey}
                    disabled={savingKey}
                    className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
                  >
                    {savingKey ? 'Checking…' : 'Use key'}
                  </button>
                </div>
                {keyError && <div className="text-rose-600 dark:text-rose-400">{keyError}</div>}
              </div>
            )}
            {keyConfigured === true && keySaved && (
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Key accepted by OpenRouter.</div>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto py-1">
            <button
              onClick={() => choose(DEFAULT_MODEL_ID, DEFAULT_MODEL_NAME)}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
            >
              <span className="w-4">{isDefault && <Check className="w-4 h-4 text-emerald-500" />}</span>
              <span>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">{DEFAULT_MODEL_NAME}</span>
                <span className="text-[10px] text-slate-400">Default · uses the GEMINI_API_KEY</span>
              </span>
            </button>

            {loading && !models && <div className="px-3 py-4 text-xs text-slate-400">Loading OpenRouter models…</div>}
            {error && <div className="px-3 py-3 text-xs text-rose-600 dark:text-rose-400">{error}</div>}

            {shown.map((m) => (
              <button
                key={m.id}
                onClick={() => choose(m.id, m.name)}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                <span className="w-4 shrink-0">{selected.id === m.id && <Check className="w-4 h-4 text-emerald-500" />}</span>
                <span className="min-w-0">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">{m.name}</span>
                  <span className="text-[10px] text-slate-400 block truncate font-mono">{m.id}</span>
                  <span className="text-[10px] text-slate-400 block">
                    in {perMillion(m.promptPrice)} · out {perMillion(m.completionPrice)} per 1M tokens
                    {m.contextLength ? ` · ${Math.round(m.contextLength / 1000)}k ctx` : ''}
                  </span>
                </span>
              </button>
            ))}
            {models && shown.length === 0 && <div className="px-3 py-4 text-xs text-slate-400">No model matches “{q}”.</div>}
          </div>

          <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
            {models ? `${models.length} OpenRouter models that accept images.` : ''} Text-only models are hidden because they cannot read a drawing.
          </div>
        </div>
      )}
    </div>
  );
};
