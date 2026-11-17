import React from 'react';
import { Sun, Moon, Download, Layers, Sparkles, Sliders, RefreshCw, LogOut } from 'lucide-react';
import { PresetModel } from '../types/furnace';
import { ModelPicker } from './ModelPicker';
import { useAuth } from './AuthGate';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  selectedPresetId: string;
  onSelectPreset: (preset: PresetModel) => void;
  onOpenExportModal: () => void;
  onReset: () => void;
  activeTab: 'schematic' | 'json' | 'lisp' | 'ai';
  onChangeTab: (tab: 'schematic' | 'json' | 'lisp' | 'ai') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleDarkMode,
  selectedPresetId,
  onSelectPreset,
  onOpenExportModal,
  onReset,
  activeTab,
  onChangeTab,
}) => {
  const auth = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-6">
        
        {/* Zone 1: Single element brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-lg">
            ⚡
          </div>
          <a
            href="/"
            className="text-base lg:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            VULCAN<span className="text-amber-600 dark:text-amber-400 font-mono font-medium text-xs lg:text-sm px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">CAD v2.4</span>
          </a>
        </div>

        {/* Zone 2: Navigation & Preset Quick Picker */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onChangeTab('schematic')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'schematic'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              2D Schematic
            </button>
            <button
              onClick={() => onChangeTab('json')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'json'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-500" />
              DXF Mod Schema
            </button>
            <button
              onClick={() => onChangeTab('lisp')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'lisp'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] text-emerald-500 font-bold">.LSP</span>
              AutoLISP / SCR
            </button>
            <button
              onClick={() => onChangeTab('ai')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ai'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              AI Thermal Advisor
            </button>
          </div>
        </div>

        {/* Zone 3: Actions (Presets, Reset, Theme Toggle, Export) */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          
          {/* Extraction model picker (OpenRouter) */}
          <ModelPicker />

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset to Baseline Values"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Export Action */}
          <button
            onClick={onOpenExportModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CAD Suite</span>
          </button>

          {auth && (
            <button
              onClick={auth.logout}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={`Log out (${auth.email})`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
